
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

    def test_ramp_a(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(1_000_000, 1_000_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        res = chain.execute(add_pool, sender=admin)

        # advance initial cooldown
        chain.advance_blocks(MIN_RAMP_TIME // BLOCK_TIME)
        
        res = chain.interpret(self.dex.swap(0, 1, 0, 1_000_000, 1, FAR_FUTURE, None, None))
        transfers = parse_transfers(res)
        pre_ramp_amount = transfers[1]["amount"]

        future_a = A_CONST // 100
        res = chain.execute(self.dex.ramp_A(dict(pool_id=0, future_A=future_a, future_time=MIN_RAMP_TIME * 2 + 1)), sender=admin)

        # wait half a ramp time
        chain.advance_blocks(MIN_RAMP_TIME // BLOCK_TIME // 2)

        res = chain.interpret(self.dex.swap(0, 1, 0, 1_000_000, 1, FAR_FUTURE, None, None))
        transfers = parse_transfers(res)
        half_ramp_amount = transfers[1]["amount"]
        self.assertGreater(pre_ramp_amount, half_ramp_amount)

        chain.advance_blocks(MIN_RAMP_TIME // BLOCK_TIME // 2)

        res = chain.interpret(self.dex.swap(0, 1, 0, 1_000_000, 1, FAR_FUTURE, None, None))
        transfers = parse_transfers(res)
        full_ramp_amount = transfers[1]["amount"]
        self.assertGreater(half_ramp_amount, full_ramp_amount)

        chain.advance_blocks(MIN_RAMP_TIME // BLOCK_TIME // 2)
        res = chain.interpret(self.dex.swap(0, 1, 0, 1_000_000, 1, FAR_FUTURE, None, None))
        transfers = parse_transfers(res)
        after_ramp_amount = transfers[1]["amount"]
        self.assertEqual(full_ramp_amount, after_ramp_amount)

    def test_stop_ramp_a(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(1_000_000, 1_000_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        res = chain.execute(add_pool, sender=admin)

        # advance initial cooldown
        chain.advance_blocks(MIN_RAMP_TIME // BLOCK_TIME)
        
        res = chain.interpret(self.dex.swap(0, 1, 0, 1_000_000, 1, FAR_FUTURE, None, None))
        transfers = parse_transfers(res)
        pre_ramp_amount = transfers[1]["amount"]

        future_a = A_CONST // 100
        res = chain.execute(self.dex.ramp_A(dict(pool_id=0, future_A=future_a, future_time=MIN_RAMP_TIME * 2 + 1)), sender=admin)

        # wait half a ramp time
        chain.advance_blocks(MIN_RAMP_TIME // BLOCK_TIME // 2)

        res = chain.interpret(self.dex.swap(0, 1, 0, 1_000_000, 1, FAR_FUTURE, None, None))
        transfers = parse_transfers(res)
        half_ramp_amount = transfers[1]["amount"]
        self.assertGreater(pre_ramp_amount, half_ramp_amount)

        res = chain.execute(self.dex.stop_ramp_A(0), sender=admin)

        chain.advance_blocks(MIN_RAMP_TIME // BLOCK_TIME // 2)

        # should be the same as a previous one
        res = chain.interpret(self.dex.swap(0, 1, 0, 1_000_000, 1, FAR_FUTURE, None, None))
        transfers = parse_transfers(res)
        full_ramp_amount = transfers[1]["amount"]
        self.assertEqual(half_ramp_amount, full_ramp_amount)

        # still the same
        chain.advance_blocks(MIN_RAMP_TIME // BLOCK_TIME // 2)
        res = chain.interpret(self.dex.swap(0, 1, 0, 1_000_000, 1, FAR_FUTURE, None, None))
        transfers = parse_transfers(res)
        after_ramp_amount = transfers[1]["amount"]
        self.assertEqual(half_ramp_amount, full_ramp_amount)