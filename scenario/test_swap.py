
from unittest import TestCase
import json
from pprint import pprint
from constants import A_CONST

from helpers import *

from pytezos import ContractInterface, pytezos, MichelsonRuntimeError
from initial_storage import admin_lambdas, dex_lambdas, permit_lambdas, token_lambdas

token_a = {
    "fa2": {
        "token_address": "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton",
        "token_id": 0
    }
}

token_b = {
    "fa2": {
        "token_address": "KT1Wz32jY2WEwWq8ZaA2C6cYFHGchFYVVczC",
        "token_id": 1
    }
}


token_a_alt = ("fa12", "KT1Wz32jY2WEwWq8ZaA2C6cYFHGchFYVVczC")
token_b_alt = ("fa12", "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton")
token_c = ("fa12", "KT1C9X9s5rpVJGxwVuHEVBLYEdAQ1Qw8QDjH")


class StableSwapTest(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        text = open("./build/dex.json").read()
        # text = text.replace("\\n", "")
        # text = text.replace("\\", "")
        code = json.loads(text)

        # michelson = json.loads(code["michelson"])

        cls.dex = ContractInterface.from_micheline(code["michelson"])

        storage = cls.dex.storage.dummy()
        storage["token_lambdas"] = token_lambdas
        storage["dex_lambdas"] = dex_lambdas
        storage["permit_lambdas"] = permit_lambdas
        storage["admin_lambdas"] = admin_lambdas
        storage["storage"]["admin"] = admin
        cls.init_storage = storage

    def test_dex_init(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a_alt, token_b_alt], form_pool_rates(1_000_000, 1_000_000))
        res = chain.execute(add_pool, sender=admin)
        
        trxs = parse_transfers(res)
        pprint(trxs)
        
        res = chain.execute(self.dex.swap({
            "pool_id" : 0,
            "idx_from" : 0,
            "idx_to" : 1,
            "amount" : 1_000,
            "min_amount_out" : 1,
            "time_expiration" : 0,
            "receiver" : None,
            "referral" : None,
        }))

        print("")
        trxs = parse_transfers(res)
        pprint(trxs)

    
    def test_dex_swap_and_divest(self):
        my_address = self.dex.context.get_sender()
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100_000, 100_000))
        res = chain.execute(add_pool, sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000, 1: 100_000}, time_expiration=1, receiver=None, referral=None))
        
        res = chain.execute(self.dex.swap(0, 0, 1, 10_000, 1, 0, None, None))
        trxs = parse_transfers(res)
        amount_bought = trxs[1]["amount"]
        self.assertEqual(trxs[1]["destination"], me)

        res = chain.execute(self.dex.swap(0, 1, 0, amount_bought, 1, 0, None, None))

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_001, time_expiration=1, receiver=None))

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_000, time_expiration=1, receiver=None))
        
        transfers = parse_transfers(res)
        self.assertGreaterEqual(transfers[0]["amount"], 100_000) 
        self.assertGreaterEqual(transfers[1]["amount"], 100_000)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.swap(0, 0, 1, 100, 1, 0, None, None))

    def test_cant_init_already_init(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100_000, 100_000))
        res = chain.execute(add_pool, sender=admin)
        
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(add_pool, sender=admin)

    def test_propotions(self):
        init_supply_a = 100
        init_supply_b = 10**127
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100_000, 100_000))
        res = chain.execute(add_pool, sender=admin)
        
        res = chain.execute(self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=100, min_amount_out=1, time_expiration=0, receiver=None, referral=None))
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], trxs[1]["amount"], delta=1)
        
        res = chain.execute(self.dex.swap(pool_id=0, idx_from=1, idx_to=0, amount=100, min_amount_out=1, time_expiration=0, receiver=None, referral=None))
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], trxs[1]["amount"], delta=1)

    def test_two_pairs_dont_interfere(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100_000_000, 100_000))
        res = chain.execute(add_pool, sender=admin)

        add_pool = self.dex.add_pool(A_CONST, [token_a_alt, token_c], form_pool_rates(10_000, 100_000))
        res = chain.execute(add_pool, sender=admin)

        key_swap = self.dex.swap(pool_id=0, idx_from=1, idx_to=0, amount=100, min_amount_out=1, time_expiration=0, receiver=None, referral=None)
        res = chain.interpret(key_swap)
        trxs = parse_transfers(res)
        token_a_out_before = trxs[0]["amount"]
        token_b_out_before = trxs[1]["amount"]

        # perform a swap on the second pair
        res = chain.execute(self.dex.swap(pool_id=1, idx_from=1, idx_to=0, amount=100, min_amount_out=1, time_expiration=0, receiver=None, referral=None))
        res = chain.execute(self.dex.swap(pool_id=1, idx_from=0, idx_to=1, amount=1, min_amount_out=1, time_expiration=0, receiver=None, referral=None))

        # ensure first token price in unscathed
        res = chain.interpret(key_swap)
        transfers = parse_transfers(res)
        token_a_out_after = transfers[0]["amount"]
        token_b_out_after = transfers[1]["amount"]

        self.assertEqual(token_a_out_before, token_a_out_after)
        self.assertEqual(token_b_out_before, token_b_out_after)

    def test_fee_even_distribution(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100_000_000, 100_000)), sender=admin)

        # invest equally by Alice and Bob
        invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000, 1: 100_000}, time_expiration=1, receiver=None, referral=None)
        res = chain.execute(invest, sender=alice)
        res = chain.execute(invest, sender=bob)

        # perform a few back and forth swaps
        for i in range(0, 5):
            res = chain.execute(self.dex.swap(pool_id=0, idx_from=1, idx_to=0, amount=10_000, min_amount_out=1, time_expiration=0, receiver=None, referral=None))
            transfers = parse_transfers(res)
            amount_bought = transfers[1]["amount"]
            res = chain.execute(self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=amount_bought, min_amount_out=1, time_expiration=0, receiver=None, referral=None))

        # divest alice's shares
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_000, time_expiration=1, receiver=None), sender=alice)
        alice_trxs = parse_transfers(res)
        alice_profit = alice_trxs[1]["amount"] - 100_000
    
        # divest bob's shares
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=200_000, time_expiration=1, receiver=None), sender=bob)
        bob_trxs = parse_transfers(res)
        bob_profit = alice_trxs[1]["amount"] - 100_000

        # profits are equal +-1 due to rounding errors
        self.assertAlmostEqual(alice_profit, bob_profit, delta=1)

    def test_fail_divest_nonowner(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100_000_000, 100_000)), sender=admin)

        invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100, 1: 100_000}, time_expiration=1, receiver=None, referral=None)
        chain.execute(invest, sender=alice)
        
        # should fail due to alice not owning any shares 
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=100, time_expiration=1, receiver=None), sender=alice)

    def test_small_amounts(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(10, 10)), sender=admin)

        res = chain.execute(self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=2, min_amount_out=1, time_expiration=0, receiver=None, referral=None))

        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == me)
        self.assertEqual(token_out["amount"], 1)

    def test_multiple_singular_invests(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(10, 10)), sender=admin)
        invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 1, 1: 1}, time_expiration=1, receiver=None, referral=None)
        chain.execute(invest, sender=alice)
        chain.execute(invest, sender=alice)
        chain.execute(invest, sender=alice)
        
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=6, time_expiration=1, receiver=None), sender=alice)
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=1, time_expiration=1, receiver=None), sender=alice)

        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 3)
        self.assertEqual(transfers[1]["amount"], 3)

    def test_multiple_small_invests(self):
        chain = LocalChain(storage=self.init_storage)

        ratios = [1, 0.01, 100]

        for ratio in ratios:
            token_b_amount = int(100 * ratio)
            res = chain.execute(self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100, token_b_amount)), sender=admin)
            invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100, 1: token_b_amount}, time_expiration=1, receiver=None, referral=None)

            for i in range(3):
                res = chain.execute(invest)            

            all_shares = get_shares(res, 0, me)
            print("all shares", all_shares)

            res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares - 1, time_expiration=1, receiver=None))
    
            transfers = parse_transfers(res)
            self.assertEqual(transfers[0]["amount"], int(300 * ratio))
            self.assertEqual(transfers[1]["amount"], 300)

    #TODO
    def test_divest_big_a_small_b(self):
        me = self.dex.context.get_sender()
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100_000_000, 50)), sender=admin)
        
        with self.assertRaises(MichelsonRuntimeError):
            invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 2_000_000 - 1, 1: 1}, time_expiration=1, receiver=None, referral=None)
            chain.execute(invest) 

        invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 3_600_000, 1: 1}, time_expiration=1, receiver=None, referral=None)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 1)
        self.assertEqual(transfers[1]["amount"], 2_000_000)

        all_shares = res.storage["storage"]["ledger"][(me,0)]["balance"]
        res = chain.execute(self.dex.divest(0, 1, 1, all_shares, 100))
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 1)
        self.assertEqual(transfers[1]["amount"], 2_000_000)

    # TODO
    def test_reinitialize(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100_000_000, 50)), sender=admin)

        chain.execute(self.dex.divest(0, 1, 1, 10, 100))

        # following fails since pair is considered uninitialized
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.invest(0, 10, 10, 1, 100))

        chain.execute(self.dex.addPair(pair, 10, 10))

        # now you can invest normally
        chain.execute(self.dex.invest(pair_id=0, token_a_in=10, token_b_in=10, shares=10, deadline=100))

    def test_divest_smallest(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(3, 3)), sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 2, 1: 2}, time_expiration=1, receiver=None, referral=None))

        res = chain.execute(self.dex.swap(0, 0, 1, 2, 1, 0, None, None))

        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=4, time_expiration=1, receiver=None))
        transfers = parse_transfers(res) 
        self.assertLessEqual(transfers[0]["amount"], 2)
        self.assertLessEqual(transfers[1]["amount"], 2)