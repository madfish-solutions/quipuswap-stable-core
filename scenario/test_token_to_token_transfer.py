from unittest import TestCase
from decimal import Decimal
from pprint import pprint

import json
from helpers import *
from constants import *

from pytezos import ContractInterface, pytezos, MichelsonRuntimeError
from pytezos.context.mixin import ExecutionContext
from initial_storage import admin_lambdas, dex_lambdas, token_lambdas

pair = {
    "token_a_type" : {
        "fa2": {
            "token_address": "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton",
            "token_id": 0
        }
    },
    "token_b_type": {
        "fa2": {
            "token_address": "KT1Wz32jY2WEwWq8ZaA2C6cYFHGchFYVVczC",
            "token_id": 1
        }
    },
}

class TokenToTokenTransferTest(TestCase):

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

    def test_tt_transfer_divest(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(100_000_000, 1_000))
        res = chain.execute(add_pool, sender=admin)

        all_shares = get_shares(res, 0, admin)
        res = chain.interpret(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, deadline=1, receiver=None), sender=admin)
        transfers = parse_transfers(res) 
        # pprint(transfers)

        transfer = self.dex.transfer(
            [{ "from_" : admin,
                "txs" : [{
                    "amount": all_shares,
                    "to_": bob,
                    "token_id": 0
                }]
            }])
        
        res = chain.execute(transfer, sender=admin)

        # alice cant divest a single share after transfer
        with self.assertRaises(MichelsonRuntimeError) as error:
            res = chain.interpret(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=1_000_000, deadline=1, receiver=None), sender=admin)

        # bob successfully divests his shares
        all_shares = get_shares(res, 0, bob)
        res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, deadline=1, receiver=None), sender=bob)

        transfers = parse_transfers(res)
        token_a_out_after = transfers[0]["amount"]
        token_b_out_after = transfers[1]["amount"]

        self.assertEqual(token_b_out_after, 100_000_000)
        self.assertEqual(token_a_out_after, 1_000)

    def test_tt_cant_double_transfer(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(100_000, 10_000))
        # res = chain.execute(self.dex.addPair(pair, 100_000, 10_000), sender=alice)
        res = chain.execute(add_pool, sender=admin)
        
        transfer = self.dex.transfer(
            [{ "from_" : alice,
                "txs" : [
                    {
                        "amount": 5_000,
                        "to_": bob,
                        "token_id": 0
                    },
                    {
                        "amount": 6_000,
                        "to_": bob,
                        "token_id": 0
                    }
                ]
            }])
        
        with self.assertRaises(MichelsonRuntimeError) as error:
            res = chain.execute(transfer, sender=alice)

        self.assertIn("FA2_INSUFFICIENT_BALANCE", error.exception.args[-1])



