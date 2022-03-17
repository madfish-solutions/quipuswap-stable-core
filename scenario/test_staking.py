

from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
from initial_storage import admin_lambdas, dex_lambdas, token_lambdas

class StableStakingTest(TestCase):

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
        storage["storage"]["quipu_token"] = {
            "token_address" : quipu_token,
            "token_id": 0,
        }

        cls.init_storage = storage

    def test_basic_stake_unstake(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(1_000_000, 1_000_000))
        res = chain.execute(add_pool, sender=admin)
        
        res = chain.execute(self.dex.stake(add = { 'pool_id': 0, 'amount': 20 }))
        trxs = parse_transfers(res)
        self.assertEqual(len(trxs), 1)
        self.assertEqual(trxs[0]["amount"], 20)
        self.assertEqual(trxs[0]["source"], me)
        self.assertEqual(trxs[0]["destination"], contract_self_address)

        res = chain.execute(self.dex.stake(remove = { 'pool_id': 0, 'amount': 20 }))
        trxs = parse_transfers(res)
        self.assertEqual(len(trxs), 1)
        self.assertEqual(trxs[0]["amount"], 20)
        self.assertEqual(trxs[0]["source"], contract_self_address)
        self.assertEqual(trxs[0]["destination"], me)

        # nothing left to unstake
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.stake(remove = { 'pool_id': 0, 'amount': 20 }))
            
    def test_get_staking_reward(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000_000))
        res = chain.execute(add_pool, sender=admin)
        res = chain.execute(self.dex.set_fees(0, fees), sender=admin)

        res = chain.execute(self.dex.stake(add = { 'pool_id': 0, 'amount': 20 }))
        print(res.storage["storage"]["stakers_balance"][(me ,0)]["earnings"])
        print(res.storage["storage"]["pools"][0]["staker_accumulator"]["accumulator_f"])

        res = chain.execute(self.dex.swap(0, 0, 1, 1_000_000, 1, 0, None, None))
        print(res.storage["storage"]["stakers_balance"][(me ,0)]["earnings"])
        print(res.storage["storage"]["pools"][0]["staker_accumulator"]["accumulator_f"])

        res = chain.execute(self.dex.stake(remove = { 'pool_id': 0, 'amount': 10 }))
        print(res.storage["storage"]["stakers_balance"][(me ,0)]["earnings"])
        print(res.storage["storage"]["pools"][0]["staker_accumulator"]["accumulator_f"])
        trxs = parse_transfers(res)
        self.assertEqual(len(trxs), 2)
        self.assertEqual(trxs[0]["amount"], 10)
        self.assertEqual(trxs[0]["source"], contract_self_address)
        self.assertEqual(trxs[0]["destination"], me)
        self.assertEqual(trxs[0]["token_address"], quipu_token)
        
        self.assertEqual(trxs[1]["amount"], 19)
        self.assertEqual(trxs[1]["source"], contract_self_address)
        self.assertEqual(trxs[1]["destination"], me)
        self.assertEqual(trxs[1]["token_address"], token_b_address)

        # unstaking the rest produces no more rewards
        res = chain.execute(self.dex.stake(remove = { 'pool_id': 0, 'amount': 10 }))
        print(res.storage["storage"]["stakers_balance"][(me ,0)]["earnings"])
        print(res.storage["storage"]["pools"][0]["staker_accumulator"]["accumulator_f"])
        trxs = parse_transfers(res)
        # print(trxs)
        self.assertEqual(len(trxs), 1)
        self.assertEqual(trxs[0]["amount"], 10)
        self.assertEqual(trxs[0]["source"], contract_self_address)
        self.assertEqual(trxs[0]["destination"], me)
        self.assertEqual(trxs[0]["token_address"], quipu_token)

    def test_get_staking_reward_all(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b, token_c], form_pool_rates(100_000_000, 100_000_000, 100_000_000))
        res = chain.execute(add_pool, sender=admin)
        res = chain.execute(self.dex.set_fees(0, fees), sender=admin)

        res = chain.execute(self.dex.stake(add = { 'pool_id': 0, 'amount': 20 }))

        res = chain.execute(self.dex.swap(0, 0, 1, 1_000_000, 1, 0, None, None))
        res = chain.execute(self.dex.swap(0, 1, 2, 1_000_000, 1, 0, None, None))
        res = chain.execute(self.dex.swap(0, 2, 0, 1_000_000, 1, 0, None, None))

        res = chain.execute(self.dex.stake(remove = { 'pool_id': 0, 'amount': 0 }))
        trxs = parse_transfers(res)
        self.assertEqual(len(trxs), 3)
        self.assertAlmostEqual(trxs[0]["amount"], 20, delta=1)
        self.assertEqual(trxs[0]["source"], contract_self_address)
        self.assertEqual(trxs[0]["destination"], me)
        self.assertEqual(trxs[0]["token_address"], token_c_address)

        self.assertAlmostEqual(trxs[1]["amount"], 20, delta=1)
        self.assertEqual(trxs[1]["source"], contract_self_address)
        self.assertEqual(trxs[1]["destination"], me)
        self.assertEqual(trxs[1]["token_address"], token_b_address)

        self.assertAlmostEqual(trxs[2]["amount"], 20, delta=1)
        self.assertEqual(trxs[2]["source"], contract_self_address)
        self.assertEqual(trxs[2]["destination"], me)
        self.assertEqual(trxs[2]["token_address"], token_a_address)

    def test_staking_proportions(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000_000))
        res = chain.execute(add_pool, sender=admin)
        res = chain.execute(self.dex.set_fees(0, fees), sender=admin)

        res = chain.execute(self.dex.stake(add = { 'pool_id': 0, 'amount': 77 }), sender=alice)
        res = chain.execute(self.dex.stake(add = { 'pool_id': 0, 'amount': 77 }), sender=bob)

        res = chain.execute(self.dex.swap(0, 0, 1, 10_000_000, 1, 0, None, None))

        res = chain.execute(self.dex.stake(remove = { 'pool_id': 0, 'amount': 77 }), sender=alice)
        trxs = parse_transfers(res)
        self.assertEqual(len(trxs), 2)
        self.assertEqual(trxs[0]["amount"], 77)
        self.assertEqual(trxs[0]["source"], contract_self_address)
        self.assertEqual(trxs[0]["destination"], alice)
        self.assertEqual(trxs[0]["token_address"], quipu_token)
        
        self.assertEqual(trxs[1]["amount"], 99)
        self.assertEqual(trxs[1]["source"], contract_self_address)
        self.assertEqual(trxs[1]["destination"], alice)
        self.assertEqual(trxs[1]["token_address"], token_b_address)

        # unstaking the rest produces no more rewards
        res = chain.execute(self.dex.stake(remove = { 'pool_id': 0, 'amount': 77 }), sender=bob)
        trxs = parse_transfers(res)
        self.assertEqual(len(trxs), 2)
        self.assertEqual(trxs[0]["amount"], 77)
        self.assertEqual(trxs[0]["source"], contract_self_address)
        self.assertEqual(trxs[0]["destination"], bob)
        self.assertEqual(trxs[0]["token_address"], quipu_token)
        
        self.assertEqual(trxs[1]["amount"], 99)
        self.assertEqual(trxs[1]["source"], contract_self_address)
        self.assertEqual(trxs[1]["destination"], bob)
        self.assertEqual(trxs[1]["token_address"], token_b_address)

    def test_stake_in_between_swaps(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000_000))
        chain.execute(add_pool, sender=admin)
        chain.execute(self.dex.set_fees(0, fees), sender=admin)

        chain.execute(self.dex.stake(add = { 'pool_id': 0, 'amount': 333_333 }), sender=alice)

        chain.execute(self.dex.swap(0, 0, 1, 10_000_000, 1, 0, None, None))

        chain.execute(self.dex.stake(add = { 'pool_id': 0, 'amount': 333_333 }), sender=bob)
        chain.execute(self.dex.swap(0, 0, 1, 10_000_000, 1, 0, None, None))

        res = chain.execute(self.dex.stake(remove = { 'pool_id': 0, 'amount': 0 }), sender=alice)
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], 300, delta=2)

        res = chain.execute(self.dex.stake(remove = { 'pool_id': 0, 'amount': 0 }), sender=bob)
        trxs = parse_transfers(res)
        print(trxs)
        self.assertAlmostEqual(trxs[0]["amount"], 100, delta=2)


    def test_stake_zero(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(A_CONST, [token_a, token_b], form_pool_rates(100_000_000, 100_000_000))
        chain.execute(add_pool, sender=admin)
        chain.execute(self.dex.set_fees(0, fees), sender=admin)

        chain.execute(self.dex.stake(add={"pool_id": 0, "amount": 333_333}), sender=alice)

        chain.execute(self.dex.swap(0, 0, 1, 10_000_000, 1, 0, None, None))

        res = chain.execute(self.dex.stake(add={"pool_id": 0, "amount": 0}), sender=alice)
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], 200, delta=2)

        res = chain.execute(self.dex.stake(add={"pool_id": 0, "amount": 0}), sender=alice)
        trxs = parse_transfers(res)
        self.assertEqual(len(trxs), 0)
