from unittest import TestCase

import json
from pprint import pprint

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

    
    def test_tt_dex_swap_and_divest(self):
        my_address = self.dex.context.get_sender()
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a_alt, token_b_alt], form_pool_rates(100_000, 100_000))
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
