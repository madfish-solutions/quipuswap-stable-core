
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
from initial_storage import admin_lambdas, dex_lambdas, token_lambdas

class StableSwapTest(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        text = open("./build/dex.json").read()
        code = json.loads(text)

        cls.dex = ContractInterface.from_micheline(code["michelson"])

        storage = cls.dex.storage.dummy()
        storage["token_lambdas"] = token_lambdas
        storage["dex_lambdas"] = dex_lambdas
        storage["admin_lambdas"] = admin_lambdas
        storage["storage"]["admin"] = admin 

        cls.init_storage = storage

    def test_dex_init(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(1_000_000, 1_000_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        res = chain.execute(add_pool, sender=admin)
        
        trxs = parse_transfers(res)
        pprint(trxs)
        
        res = chain.execute(self.dex.swap({
            "pool_id" : 0,
            "idx_from" : 0,
            "idx_to" : 1,
            "amount" : 1_000,
            "min_amount_out" : 1,
            "deadline" : 0,
            "receiver" : None,
            "referral" : None,
        }))

        trxs = parse_transfers(res)
        pprint(trxs)

    
    def test_dex_swap_and_divest(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000, 100_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        res = chain.execute(add_pool, sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000, 1: 100_000}, deadline=1, receiver=None, referral=None))
        
        res = chain.execute(self.dex.swap(0, 0, 1, 10_000, 1, 0, None, None))
        trxs = parse_transfers(res)
        amount_bought = trxs[1]["amount"]
        self.assertEqual(trxs[1]["destination"], me)

        res = chain.execute(self.dex.swap(0, 1, 0, amount_bought, 1, 0, None, None))

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_001, deadline=1, receiver=None))
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_000, deadline=1, receiver=None))
        
        transfers = parse_transfers(res)
        # TODO in isn't precise enough
        self.assertGreaterEqual(transfers[0]["amount"], 100_000) 
        self.assertGreaterEqual(transfers[1]["amount"], 100_000)

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_000, deadline=1, receiver=None), sender=admin)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.swap(0, 0, 1, 100, 1, 0, None, None))

    def test_cant_init_already_init(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000, 100_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        res = chain.execute(add_pool, sender=admin)
        
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(add_pool, sender=admin)

    def test_propotions(self):
        init_supply_a = 100
        init_supply_b = 10**127
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000, 100_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        res = chain.execute(add_pool, sender=admin)
        
        res = chain.execute(self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=100, min_amount_out=1, deadline=0, receiver=None, referral=None))
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], trxs[1]["amount"], delta=1)
        
        res = chain.execute(self.dex.swap(pool_id=0, idx_from=1, idx_to=0, amount=100, min_amount_out=1, deadline=0, receiver=None, referral=None))
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], trxs[1]["amount"], delta=1)

    def test_two_pairs_dont_interfere(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        res = chain.execute(add_pool, sender=admin)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_c], form_pool_rates(10_000, 100_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        res = chain.execute(add_pool, sender=admin)

        key_swap = self.dex.swap(pool_id=0, idx_from=1, idx_to=0, amount=100, min_amount_out=1, deadline=0, receiver=None, referral=None)
        res = chain.interpret(key_swap)
        trxs = parse_transfers(res)
        token_a_out_before = trxs[0]["amount"]
        token_b_out_before = trxs[1]["amount"]

        # perform a swap on the second pair
        res = chain.execute(self.dex.swap(pool_id=1, idx_from=1, idx_to=0, amount=100, min_amount_out=1, deadline=0, receiver=None, referral=None))
        res = chain.execute(self.dex.swap(pool_id=1, idx_from=0, idx_to=1, amount=1, min_amount_out=1, deadline=0, receiver=None, referral=None))

        # ensure first token price in unscathed
        res = chain.interpret(key_swap)
        transfers = parse_transfers(res)
        token_a_out_after = transfers[0]["amount"]
        token_b_out_after = transfers[1]["amount"]

        self.assertEqual(token_a_out_before, token_a_out_after)
        self.assertEqual(token_b_out_before, token_b_out_after)

    def test_fee_even_distribution(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)

        # invest equally by Alice and Bob
        invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000, 1: 100_000}, deadline=1, receiver=None, referral=None)
        res = chain.execute(invest, sender=alice)
        res = chain.execute(invest, sender=bob)

        # perform a few back and forth swaps
        for i in range(0, 5):
            res = chain.execute(self.dex.swap(pool_id=0, idx_from=1, idx_to=0, amount=10_000, min_amount_out=1, deadline=0, receiver=None, referral=None))
            transfers = parse_transfers(res)
            amount_bought = transfers[1]["amount"]
            res = chain.execute(self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=amount_bought, min_amount_out=1, deadline=0, receiver=None, referral=None))

        # divest alice's shares
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_000, deadline=1, receiver=None), sender=alice)
        alice_trxs = parse_transfers(res)
        alice_profit = alice_trxs[1]["amount"] - 100_000
    
        # divest bob's shares
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_000, deadline=1, receiver=None), sender=bob)
        bob_trxs = parse_transfers(res)
        bob_profit = bob_trxs[1]["amount"] - 100_000

        # profits are equal +-1 due to rounding errors
        self.assertAlmostEqual(alice_profit, bob_profit, delta=1)

    def test_small_amounts(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(10, 10), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)

        res = chain.execute(self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=2, min_amount_out=1, deadline=0, receiver=None, referral=None))

        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == me)
        self.assertEqual(token_out["amount"], 1)

    def test_huge_amounts(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000_000, 100_000_000_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)

        res = chain.execute(self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=100_000_000_000, min_amount_out=1, deadline=0, receiver=None, referral=None))

        transfers = parse_transfers(res)
        self.assertLess(transfers[1]["amount"], 100_000_000_000)
        self.assertGreater(transfers[1]["amount"], 99_900_000_000)

    def test_multiple_singular_invests(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(10, 10), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)
        invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 1, 1: 1}, deadline=1, receiver=None, referral=None)
        chain.execute(invest, sender=alice)
        chain.execute(invest, sender=alice)
        chain.execute(invest, sender=alice)
        
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=6, deadline=1, receiver=None), sender=alice)
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=1, deadline=1, receiver=None), sender=alice)

        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 3)
        self.assertEqual(transfers[1]["amount"], 3)

    def test_multiple_small_invests(self):
        ratios = [1, 0.01, 100]

        for ratio in ratios:
            token_b_amount = int(100 * ratio)
            chain = LocalChain(storage=self.init_storage)
            res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100, token_b_amount), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)
            invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100, 1: token_b_amount}, deadline=1, receiver=None, referral=None)

            for i in range(3):
                res = chain.execute(invest)            

            all_shares = get_shares(res, 0, me)
            print("all shares", all_shares)

            res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares - 1, deadline=1, receiver=None))
    
            transfers = parse_transfers(res)
            self.assertAlmostEqual(transfers[0]["amount"], int(300 * ratio), delta=1)
            self.assertAlmostEqual(transfers[1]["amount"], 300, delta=1)

    def test_reinitialize(self):
        invest_chain = LocalChain(storage=self.init_storage)
        add_pool_chain = LocalChain(storage=self.init_storage)

        # perform a set of identical operations on two separate chains
        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(10_000, 10_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        swap = self.dex.swap(0, 0, 1, 1_000, 1, 0, None, None)
        divest = self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=20_000, deadline=1, receiver=None)

        res = invest_chain.execute(add_pool, sender=admin)
        res = invest_chain.execute(swap, sender=admin)
        res = invest_chain.execute(divest, sender=admin)
        res = add_pool_chain.execute(add_pool, sender=admin)
        res = add_pool_chain.execute(swap, sender=admin)
        res = add_pool_chain.execute(divest, sender=admin)

        # now in one chain try to invest
        invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 10_000, 1: 10_000}, deadline=1, receiver=None, referral=None)
        res = invest_chain.execute(invest, sender=admin)
        invest_storage = res.storage["storage"]

        # in other try to add new pool
        res = add_pool_chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(10_000, 10_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)
        add_pool_storage = res.storage["storage"]

        # compare resulting storages
        self.assertDictEqual(invest_storage, add_pool_storage)

    def test_divest_smallest(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(3, 3), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 2, 1: 2}, deadline=1, receiver=None, referral=None))

        res = chain.execute(self.dex.swap(0, 0, 1, 3, 1, 0, None, None))

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=4, deadline=1, receiver=None))
        transfers = parse_transfers(res) 
        self.assertLessEqual(transfers[0]["amount"], 2)
        self.assertLessEqual(transfers[1]["amount"], 3)

    def test_simple_divest_all(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(42, 777_777_777), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)

        all_shares = get_shares(res, 0, admin)
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, deadline=1, receiver=None), sender=admin)
        transfers = parse_transfers(res) 
        self.assertLessEqual(transfers[0]["amount"], 777_777_777)
        self.assertLessEqual(transfers[1]["amount"], 42)

    def test_threeway_pool(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], form_pool_rates(100_000, 100_000, 100_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        res = chain.execute(add_pool, sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000, 1: 100_000}, deadline=1, receiver=None, referral=None))
        
        res = chain.execute(self.dex.swap(0, 0, 1, 10_000, 1, 0, None, None))
        res = chain.execute(self.dex.swap(0, 1, 2, 10_000, 1, 0, None, None))
        res = chain.execute(self.dex.swap(0, 2, 0, 10_000, 1, 0, None, None))

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_001, deadline=1, receiver=None))

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_000 - 1, deadline=1, receiver=None))
        
        transfers = parse_transfers(res)
        pprint(transfers)
        total = sum(tx["amount"] for tx in transfers)
        self.assertAlmostEqual(total, 200_000, delta=3)

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=300_000, deadline=1, receiver=None), sender=admin)
        transfers = parse_transfers(res)
        total = sum(tx["amount"] for tx in transfers)
        self.assertAlmostEqual(total, 300_000, delta=3)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.swap(0, 0, 1, 100, 1, 0, None, None))

    def test_threeway_pool_different_precision(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], {
            0:  {
                    "rate_f": pow(10,18) * int(1e18 // BITCOIN_PRECISION),
                    "precision_multiplier_f": int(1e18 // BITCOIN_PRECISION),
                    "reserves": 100_000 *  BITCOIN_PRECISION,
                },
            1:  {
                    "rate_f": pow(10,18) * int(1e18 // TEZOS_PRECISION),
                    "precision_multiplier_f": int(1e18 // TEZOS_PRECISION),
                    "reserves": 100_000 * TEZOS_PRECISION,
                },
            2:  {
                    "rate_f": pow(10,18) * int(1e18 // ETH_PRECISION),
                    "precision_multiplier_f": int(1e18 // ETH_PRECISION),
                    "reserves": 100_000 * ETH_PRECISION,
                },
            }, { "lp_f": 0, "stakers_f": 0, "ref_f": 0}
        )
        res = chain.execute(add_pool, sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={
            0: 100_000 * BITCOIN_PRECISION,
            1: 100_000 * TEZOS_PRECISION,
            2: 100_000 * ETH_PRECISION
        }, deadline=1, receiver=None, referral=None))
        
        res = chain.execute(self.dex.swap(0, 0, 1, 10_000 * BITCOIN_PRECISION, 1, 0, None, None))
        res = chain.execute(self.dex.swap(0, 1, 2, 10_000 * TEZOS_PRECISION, 1, 0, None, None))
        res = chain.execute(self.dex.swap(0, 2, 0, 10_000 * ETH_PRECISION, 1, 0, None, None))

        all_shares = get_shares(res, 0, me)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares + 1, deadline=1, receiver=None))

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, deadline=1, receiver=None))
        
        transfers = parse_transfers(res)
        self.assertAlmostEqual(transfers[2]["amount"], 100_000 * BITCOIN_PRECISION, delta=30_000)
        self.assertAlmostEqual(transfers[1]["amount"], 100_000 * TEZOS_PRECISION, delta=30_000)
        self.assertAlmostEqual(transfers[0]["amount"], 100_000 * ETH_PRECISION, delta=30_000_000)


    def test_threeway_pool_different_rates(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], {
            0:  {
                    "rate_f": pow(10,18) * int(1e18 // BITCOIN_PRECISION),
                    "precision_multiplier_f": int(1e18 // BITCOIN_PRECISION),
                    "reserves": 400_000 * BITCOIN_PRECISION,
                },
            1:  {
                    "rate_f": pow(10,18) * int(1e18 // TEZOS_PRECISION) * 2,
                    "precision_multiplier_f": int(1e18 // TEZOS_PRECISION),
                    "reserves": 200_000 * TEZOS_PRECISION,
                },
            2:  {
                    "rate_f": pow(10,18) * int(1e18 // ETH_PRECISION) * 4,
                    "precision_multiplier_f": int(1e18 // ETH_PRECISION),
                    "reserves": 100_000 * ETH_PRECISION,
                },
            }, { "lp_f": 0, "stakers_f": 0, "ref_f": 0}
        )
        res = chain.execute(add_pool, sender=admin)
        
        res = chain.interpret(self.dex.swap(0, 0, 1, 10_000 * BITCOIN_PRECISION, 1, 0, None, None))
        transfers = parse_transfers(res)
        self.assertAlmostEqual(transfers[1]["amount"], 5_000 * TEZOS_PRECISION, delta=TEZOS_PRECISION // 100)
        # delta is 0.01 of TEZOS

        res = chain.interpret(self.dex.swap(0, 1, 2, 10_000 * TEZOS_PRECISION, 1, 0, None, None))
        transfers = parse_transfers(res)
        self.assertAlmostEqual(transfers[1]["amount"], 5_000 * ETH_PRECISION, delta=ETH_PRECISION // 100)
        # delta is 0.01 of ETH

        res = chain.interpret(self.dex.swap(0, 2, 0, 10_000 * ETH_PRECISION, 1, 0, None, None))
        transfers = parse_transfers(res)
        self.assertAlmostEqual(transfers[1]["amount"], 40_000 * BITCOIN_PRECISION, delta=BITCOIN_PRECISION // 100)

        all_shares = get_shares(res, 0, admin)
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares + 1, deadline=1, receiver=None), sender=admin)

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, deadline=1, receiver=None), sender=admin)
        
        transfers = parse_transfers(res)
        self.assertAlmostEqual(transfers[2]["amount"], 400_000 * BITCOIN_PRECISION, delta=30_000)
        self.assertAlmostEqual(transfers[1]["amount"], 200_000 * TEZOS_PRECISION, delta=30_000)
        self.assertAlmostEqual(transfers[0]["amount"], 100_000 * ETH_PRECISION, delta=30_000_000)

    # WARNING: long-running test (6+ min)
    def test_threeway_pool_different_rates_many_swaps(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], {
            0:  {
                    "rate_f": pow(10,18) * int(1e18 // BITCOIN_PRECISION),
                    "precision_multiplier_f": int(1e18 // BITCOIN_PRECISION),
                    "reserves": 100 * BITCOIN_PRECISION * 4,
                },
            1:  {
                    "rate_f": pow(10,18) * int(1e18 // TEZOS_PRECISION) * 2,
                    "precision_multiplier_f": int(1e18 // TEZOS_PRECISION),
                    "reserves": 100 * TEZOS_PRECISION * 2,
                },
            2:  {
                    "rate_f": pow(10,18) * int(1e18 // ETH_PRECISION) * 4,
                    "precision_multiplier_f": int(1e18 // ETH_PRECISION),
                    "reserves": 100 * ETH_PRECISION,
                },
            }, { "lp_f": 0, "stakers_f": 0, "ref_f": 0}
        )
        res = chain.execute(add_pool, sender=admin)
        init = 0
        end = 0
        for i in range(4): # 4 * 50 = 200
            res = chain.execute(self.dex.swap(0, 0, 1, 100 * BITCOIN_PRECISION, 1, 0, None, None)) # 100 * 4 = 400
            transfers = parse_transfers(res)
            if i == 0:
                init = transfers[1]["amount"]/TEZOS_PRECISION
            self.assertAlmostEqual(transfers[1]["amount"] / TEZOS_PRECISION, 50 , delta=0.25)        #100 BTC -> 50 XTZ
        end = transfers[1]["amount"]/TEZOS_PRECISION
        self.assertLess((init/end - 1) * 100, 0.4)
        for i in range(4): # 4 * 200 = 800 (400 inital + 400 swap)
            res = chain.execute(self.dex.swap(0, 1, 0, 100 * TEZOS_PRECISION, 1, 0, None, None))
            transfers = parse_transfers(res)
            if i == 0:
                init = transfers[1]["amount"] / BITCOIN_PRECISION
            self.assertAlmostEqual(transfers[1]["amount"] / BITCOIN_PRECISION, 100 * 2, delta=0.5) #100 XTZ -> 200 BTC
        end = transfers[1]["amount"] / BITCOIN_PRECISION
        self.assertLess((init/end - 1) * 100, 0.4)

    def test_threeway_pool_same_rates(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], {
            0:  {
                    "rate_f": pow(10,18) * TEZOS_PRECISION,
                    "precision_multiplier_f": TEZOS_PRECISION,
                    "reserves": 100_000 * TEZOS_PRECISION,
                },
            1:  {
                    "rate_f": pow(10,18) * TEZOS_PRECISION,
                    "precision_multiplier_f": TEZOS_PRECISION,
                    "reserves": 100_000 * TEZOS_PRECISION,
                },
            2:  {
                    "rate_f": pow(10,18) * TEZOS_PRECISION,
                    "precision_multiplier_f": TEZOS_PRECISION,
                    "reserves": 100_000 * TEZOS_PRECISION,
                },
            }, { "lp_f": 0, "stakers_f": 0, "ref_f": 0}
        )
        res = chain.execute(add_pool, sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={
            0: 100_000 * TEZOS_PRECISION,
            1: 100_000 * TEZOS_PRECISION,
            2: 100_000 * TEZOS_PRECISION
        }, deadline=1, receiver=None, referral=None))
        
        res = chain.execute(self.dex.swap(0, 0, 1, 10_000 * TEZOS_PRECISION, 1, 0, None, None))
        res = chain.execute(self.dex.swap(0, 1, 2, 10_000 * TEZOS_PRECISION, 1, 0, None, None))
        res = chain.execute(self.dex.swap(0, 2, 0, 10_000 * TEZOS_PRECISION, 1, 0, None, None))

        all_shares = get_shares(res, 0, me)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares + 1, deadline=1, receiver=None))

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, deadline=1, receiver=None))
        
        transfers = parse_transfers(res)
        self.assertAlmostEqual(transfers[2]["amount"], 100_000 * TEZOS_PRECISION, delta=300)
        self.assertAlmostEqual(transfers[1]["amount"], 100_000 * TEZOS_PRECISION, delta=300)
        self.assertAlmostEqual(transfers[0]["amount"], 100_000 * TEZOS_PRECISION, delta=300)

    def test_pools_with_same_rates(self):
        for n_coins in range(2, 5):
            with self.subTest(n_coins=n_coins):
                chain = LocalChain(storage=self.init_storage)

                reserves = [100_000] * n_coins
                tokens = [token_a, token_b, token_c, token_d]
                tokens_in = tokens[:n_coins]

                add_pool = self.dex.add_pool(A_CONST, tokens_in, equal_pool_rates(reserves), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
                chain.execute(add_pool, sender=admin)

                amounts_in = {k: v for k, v in enumerate(reserves)}

                res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts=amounts_in, deadline=1, receiver=None, referral=None))
                
                for i in range(n_coins):
                    res = chain.execute(self.dex.swap(0, i, (i + 1) % n_coins, 10_000, 1, 0, None, None))


                min_amounts =  amounts_in = {k: 1 for k, v in enumerate(reserves)}

                all_shares = get_shares(res, 0, me)
                with self.assertRaises(MichelsonRuntimeError):
                    res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out=min_amounts, shares=all_shares + 1, deadline=1, receiver=None))
                res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out=min_amounts, shares=all_shares, deadline=1, receiver=None))
                transfers = parse_transfers(res)
                self.assertEqual(len(transfers), n_coins)
                for i in range(n_coins):
                    self.assertAlmostEqual(transfers[i]["amount"], 100_000)

    def test_no_more_than_four_coins_per_pool(self):
        chain = LocalChain(storage=self.init_storage)

        reserves = [100_000] * 5

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c, token_d, token_e], equal_pool_rates(reserves), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(add_pool, sender=admin)

    def test_not_enough_tokens_for_reserves(self):
        chain = LocalChain(storage=self.init_storage)

        reserves = [100_000] * 5

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c, token_d, token_e], equal_pool_rates(reserves), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(add_pool, sender=admin)

    def test_invest_one_coin(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(10, 10), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)
        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 1_000}, deadline=1, receiver=None, referral=None))

        all_shares = get_shares(res, 0, me)
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, deadline=1, receiver=None))
        
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=1, deadline=1, receiver=None), sender=alice)

        transfers = parse_transfers(res)
        self.assertAlmostEqual(transfers[0]["amount"], 10, delta=1)
        self.assertAlmostEqual(transfers[1]["amount"], 1_000, delta=10)

        all_shares = get_shares(res, 0, admin)
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, deadline=1, receiver=None), sender=admin)
        transfers = parse_transfers(res)
        pprint(transfers)

    def test_add_pool_same_coin(self):
        chain = LocalChain(storage=self.init_storage)
        with self.assertRaises(ValueError):
            chain.execute(self.dex.add_pool(A_CONST, [token_a, token_a], form_pool_rates(100_000, 100_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0}), sender=admin)

    