
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, pytezos, MichelsonRuntimeError
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

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(1_000_000, 1_000_000))
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

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000, 100_000))
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

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000, 100_000))
        res = chain.execute(add_pool, sender=admin)
        
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(add_pool, sender=admin)

    def test_propotions(self):
        init_supply_a = 100
        init_supply_b = 10**127
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000, 100_000))
        res = chain.execute(add_pool, sender=admin)
        
        res = chain.execute(self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=100, min_amount_out=1, deadline=0, receiver=None, referral=None))
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], trxs[1]["amount"], delta=1)
        
        res = chain.execute(self.dex.swap(pool_id=0, idx_from=1, idx_to=0, amount=100, min_amount_out=1, deadline=0, receiver=None, referral=None))
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], trxs[1]["amount"], delta=1)

    def test_two_pairs_dont_interfere(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000))
        res = chain.execute(add_pool, sender=admin)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_c], form_pool_rates(10_000, 100_000))
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
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000)), sender=admin)

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
        bob_profit = alice_trxs[1]["amount"] - 100_000

        # profits are equal +-1 due to rounding errors
        self.assertAlmostEqual(alice_profit, bob_profit, delta=1)

    def test_fail_divest_nonowner(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000)), sender=admin)

        invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100, 1: 100_000}, deadline=1, receiver=None, referral=None)
        chain.execute(invest, sender=alice)
        
        # should fail due to alice not owning any shares 
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=100, deadline=1, receiver=None), sender=alice)

    def test_small_amounts(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(10, 10)), sender=admin)

        res = chain.execute(self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=2, min_amount_out=1, deadline=0, receiver=None, referral=None))

        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == me)
        self.assertEqual(token_out["amount"], 1)

    def test_multiple_singular_invests(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(10, 10)), sender=admin)
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
            res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100, token_b_amount)), sender=admin)
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
        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(10_000, 10_000))
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
        res = add_pool_chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(10_000, 10_000)), sender=admin)
        add_pool_storage = res.storage["storage"]

        # compare resulting storages
        self.assertDictEqual(invest_storage, add_pool_storage)

    def test_divest_smallest(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(3, 3)), sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 2, 1: 2}, deadline=1, receiver=None, referral=None))

        res = chain.execute(self.dex.swap(0, 0, 1, 2, 1, 0, None, None))

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=4, deadline=1, receiver=None))
        transfers = parse_transfers(res) 
        self.assertLessEqual(transfers[0]["amount"], 2)
        self.assertLessEqual(transfers[1]["amount"], 2)

    def test_simple_divest_all(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(42, 777_777_777)), sender=admin)

        all_shares = get_shares(res, 0, admin)
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, deadline=1, receiver=None), sender=admin)
        transfers = parse_transfers(res) 
        self.assertLessEqual(transfers[0]["amount"], 777_777_777)
        self.assertLessEqual(transfers[1]["amount"], 42)

    def test_different_pool_rates(self):
        # TODO not implemented
        pass

    def test_threeway_pool(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], form_pool_rates(100_000, 100_000, 100_000))
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

    def test_threeway_pool_single_invest(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], form_pool_rates(100_000, 100_000, 100_000))
        res = chain.execute(add_pool, sender=admin)

        res = chain.execute(self.dex.set_fees(0, fees), sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 500_000, 1: 300_000, 2: 100_000}, deadline=1, receiver=None, referral=None))

        all_shares = get_shares(res, 0, me)

        res = chain.interpret(self.dex.divest(pool_id=0, min_amounts_out={}, shares=all_shares, deadline=1, receiver=None))
        
        transfers = parse_transfers(res)
        total = sum(tx["amount"] for tx in transfers)
        print("usual divest", transfers)
        # TODO come up with good assertion
        # self.assertAlmostEqual(total, 1_000_000, delta=3)

        res = chain.interpret(self.dex.divest_one_coin(pool_id=0, shares=all_shares, token_index=0, min_amount_out=1, deadline=1, receiver=None, referral=None))

        print("divest one coin")
        transfers = parse_transfers(res)
        # pprint(transfers)
        self.assertEqual(len(transfers), 1)
        # self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertAlmostEqual(transfers[0]["amount"], 1_000_000, delta=3)

    def test_divest_imbalanced(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], form_pool_rates(100_000, 100_000, 100_000))
        res = chain.execute(add_pool, sender=admin)

        all_shares = get_shares(res, 0, admin)

        res = chain.interpret(self.dex.divest_imbalanced(pool_id=0, max_shares=all_shares, amounts_out={0: 100_000 - 3, 1: 100_000 - 3}, deadline=1, receiver=None, referral=None), sender=admin)

        transfers = parse_transfers(res)
        pprint(transfers)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["destination"], admin)
        self.assertAlmostEqual(transfers[0]["amount"], 100_000, delta=3)

        self.assertEqual(transfers[1]["destination"], admin)
        self.assertAlmostEqual(transfers[1]["amount"], 100_000, delta=3)
