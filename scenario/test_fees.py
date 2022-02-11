
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
from initial_storage import admin_lambdas, dex_lambdas, token_lambdas, dev_lambdas

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
        storage["storage"]["dev_store"]["dev_address"] = dev
        storage["storage"]["dev_store"]["dev_lambdas"] = dev_lambdas
        storage["storage"]["quipu_token"] = {
            "token_address" : quipu_token,
            "token_id": 0,
        }

        cls.init_storage = storage

    def test_ref_fee(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(int(1e12), int(1e12)))
        chain.execute(add_pool, sender=admin)
        res = chain.execute(self.dex.set_fees(0, fees), sender=admin)
        
        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000_000, 1: 100_000_000}, deadline=1, receiver=None, referral=alice))

        # balanced invest yields no referral rewards
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_referral(token_a, 1))
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_referral(token_b, 1))

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000_000, 1: 100_000}, deadline=1, receiver=None, referral=alice))

        res = chain.execute(self.dex.claim_referral(token_a, 1248), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertAlmostEqual(transfers[0]["amount"], 1248)
        self.assertEqual(transfers[0]["token_address"], token_a_address)

        res = chain.execute(self.dex.claim_referral(token_b, 1248), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertAlmostEqual(transfers[0]["amount"], 1248)
        self.assertEqual(transfers[0]["token_address"], token_b_address)

        # can no longer claim referral rewards
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_referral(token_a, 1))
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_referral(token_b, 1))

    def test_dev_fee(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(int(1e12), int(1e12)))
        chain.execute(add_pool, sender=admin)
        res = chain.execute(self.dex.set_dev_fee(200_000), sender=dev)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000_000, 1: 100_000_000}, deadline=1, receiver=None, referral=alice))

        # balanced invest yields no referral rewards
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_developer(token_a, 1), sender=dev)
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_developer(token_b, 1), sender=dev)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000_000, 1: 100_000}, deadline=1, receiver=None, referral=alice))

        res = chain.execute(self.dex.claim_developer(token_a, 499), sender=dev)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], dev)
        self.assertAlmostEqual(transfers[0]["amount"], 499)
        self.assertEqual(transfers[0]["token_address"], token_a_address)

        res = chain.execute(self.dex.claim_developer(token_b, 499), sender=dev)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["destination"], dev)
        self.assertAlmostEqual(transfers[0]["amount"], 499)
        self.assertEqual(transfers[0]["token_address"], token_b_address)

        # can no longer claim developer rewards
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_developer(token_a, 1))
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_developer(token_b, 1))

    def test_lp_fees(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(int(1e12), int(1e12)))
        chain.execute(add_pool, sender=admin)
        res = chain.execute(self.dex.set_fees(0, fees), sender=admin)

        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000_000_000, 1: 100_000_000_000}, deadline=1, receiver=None, referral=None), sender=alice)
        res = chain.execute(self.dex.invest(pool_id=0, shares=1, in_amounts={0: 100_000_000_000, 1: 100_000_000_000}, deadline=1, receiver=None, referral=None), sender=bob)

        for i in range(5):
            res = chain.execute(self.dex.swap(0, 0, 1, 10_000_000_000, 1, 0, None, None))

        alice_shares = get_shares(res, 0, alice)
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=alice_shares, deadline=1, receiver=None), sender=alice)

        transfers = parse_transfers(res) 
        alice_total = sum(tx["amount"] for tx in transfers)
        self.assertGreater(alice_total, 200_000_000_000)

        bob_shares = get_shares(res, 0, bob)
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=bob_shares, deadline=1, receiver=None), sender=bob)

        transfers = parse_transfers(res) 
        bob_total = sum(tx["amount"] for tx in transfers)
        self.assertGreater(bob_total, 200_000_000_000)
       
        self.assertEqual(alice_total, bob_total)

    def test_smallest_fees(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(int(1e12), int(1e12)))
        chain.execute(add_pool, sender=admin)
        res = chain.execute(self.dex.set_fees(0, fees), sender=admin)

        res = chain.execute(self.dex.stake(add=dict(pool_id=0, amount=20)), sender=bob)

        swap = self.dex.swap(pool_id=0, idx_from=0, idx_to=1, amount=1, min_amount_out=0, deadline=1, receiver=None, referral=alice)
        res = chain.execute(swap)

        transfers = parse_transfers(res)
        self.assertEqual(transfers[1]["amount"], 0)

        res = chain.execute(self.dex.stake(remove=dict(pool_id=0, amount=20)), sender=bob)
        trxs = parse_transfers(res)
        self.assertEqual(len(trxs), 1) #only one transfer is stake. No rewards paid
        self.assertEqual(trxs[0]["amount"], 20)
        self.assertEqual(trxs[0]["source"], contract_self_address)
        self.assertEqual(trxs[0]["destination"], bob)
        self.assertEqual(trxs[0]["token_address"], quipu_token)

        # no dev rewards
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_developer(token_a, 1))
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_developer(token_b, 1))        

        # no referral rewards
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_developer(token_a, 1), sender=alice)
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.claim_developer(token_b, 1), sender=alice)