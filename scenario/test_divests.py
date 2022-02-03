
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
from initial_storage import admin_lambdas, dex_lambdas, token_lambdas

class DivestsTest(TestCase):

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

    def test_threeway_pool_single_divest(self):
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

    def test_fail_divest_nonowner(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000)), sender=admin)

        invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100, 1: 100_000}, deadline=1, receiver=None, referral=None)
        chain.execute(invest, sender=alice)
        
        # should fail due to alice not owning any shares 
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=100, deadline=1, receiver=None), sender=alice)

    def test_divest_imbalanced(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], form_pool_rates(100_000, 100_000, 100_000))
        res = chain.execute(add_pool, sender=admin)

        all_shares = get_shares(res, 0, admin)

        res = chain.execute(self.dex.divest_imbalanced(pool_id=0, max_shares=all_shares, amounts_out={0: 100_000 - 3, 1: 100_000 - 3}, deadline=1, receiver=None, referral=None), sender=admin)

        transfers = parse_transfers(res)
        pprint(transfers)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["destination"], admin)
        self.assertAlmostEqual(transfers[0]["amount"], 100_000, delta=3)
        self.assertEqual(transfers[1]["destination"], admin)
        self.assertAlmostEqual(transfers[1]["amount"], 100_000, delta=3)

        res = chain.execute(self.dex.divest_imbalanced(pool_id=0, max_shares=all_shares, amounts_out={2: 100_000 - 3}, deadline=1, receiver=None, referral=None), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], admin)
        self.assertAlmostEqual(transfers[0]["amount"], 100_000, delta=3)

    
    def test_divest_imbalanced_vs_single_coin(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], form_pool_rates(100_000, 100_000, 100_000))
        res = chain.execute(add_pool, sender=admin)
        res = chain.execute(self.dex.set_fees(0, fees), sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 500_000, 1: 300_000, 2: 100_000}, deadline=1, receiver=None, referral=None))

        all_shares = get_shares(res, 0, me)

        # interpret one coin divest
        res = chain.interpret(self.dex.divest_one_coin(pool_id=0, shares=all_shares, token_index=0, min_amount_out=1, deadline=1, receiver=None, referral=None))

        transfers = parse_transfers(res)
        one_coin_withdraw = transfers[0]["amount"]

        shares_left_after_one_coin = get_shares(res, 0, me)
        print("shares_left_after_one_coin", shares_left_after_one_coin)

        # execute imbalanced divest
        res = chain.execute(self.dex.divest_imbalanced(pool_id=0, max_shares=all_shares, amounts_out={0: 600_000 - 13}, deadline=1, receiver=None, referral=None))

        transfers = parse_transfers(res)
        imbalanced_withdraw = transfers[0]["amount"]
        shares_left_after_imbalance = get_shares(res, 0, me)
        print("shares_left_after_imbalance", shares_left_after_imbalance)

        self.assertAlmostEqual(imbalanced_withdraw, one_coin_withdraw, delta=10)


    # TODO
    def test_divests_rates(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], {
            0:  {
                    "rate": pow(10,18),
                    "precision_multiplier": 1,
                    "reserves": 100_000,
                },
            1:  {
                    "rate": pow(10,24),
                    "precision_multiplier": 1_000_000,
                    "reserves": 100_000 * int(1e6),
                },
            2:  {
                    "rate": pow(10,36),
                    "precision_multiplier": int(1e18),
                    "reserves": 100_000 * int(1e18),
                },
            }
        )
        res = chain.execute(add_pool, sender=admin)

        all_shares = get_shares(res, 0, admin)

        res = chain.execute(self.dex.divest_imbalanced(pool_id=0, max_shares=all_shares, amounts_out={0: 100_000 - 3, 1: 100_000 - 3}, deadline=1, receiver=None, referral=None), sender=admin)

        transfers = parse_transfers(res)
        pprint(transfers)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["destination"], admin)
        self.assertAlmostEqual(transfers[0]["amount"], 100_000, delta=3)
        self.assertEqual(transfers[1]["destination"], admin)
        self.assertAlmostEqual(transfers[1]["amount"], 100_000, delta=3)

        res = chain.execute(self.dex.divest_imbalanced(pool_id=0, max_shares=all_shares, amounts_out={2: 100_000 - 3}, deadline=1, receiver=None, referral=None), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], admin)
        self.assertAlmostEqual(transfers[0]["amount"], 100_000, delta=3)