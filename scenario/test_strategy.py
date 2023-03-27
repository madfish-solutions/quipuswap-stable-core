
from unittest import TestCase
import pytest
import json
from pprint import pprint
from constants import *
from decimal import Decimal

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
from initial_storage import admin_lambdas, dex_lambdas, token_lambdas, strat_lambdas, dev_lambdas

# Tests of Strategy moved to strategy repo as mockup client
class DexStrategyTest(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        text = open("./build/dex.json").read()
        code = json.loads(text)

        cls.dex = ContractInterface.from_micheline(code["michelson"])

        storage = cls.dex.storage.dummy()
        storage["token_lambdas"] = token_lambdas
        storage["dex_lambdas"] = dex_lambdas
        storage["strat_lambdas"] = strat_lambdas
        storage["admin_lambdas"] = admin_lambdas
        storage["storage"]["admin"] = admin
        storage["storage"]["dev_store"]["dev_address"] = dev
        storage["storage"]["dev_store"]["dev_lambdas"] = dev_lambdas
        storage["storage"]["quipu_token"] = {
            "token_address" : quipu_token,
            "token_id": 0,
        }

        cls.init_storage = storage

    
    def test_connect_strategy(self):
        pytest.skip("Can't simulate intercontract on-chain view calls")
        chain = LocalChain(storage=self.init_storage)
        
        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(1_000_000, 1_000_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        chain.execute(add_pool, sender=admin)

        # connect new strategy address
        connect = self.dex.connect_strategy(0, strategy_address)
        res = chain.execute(connect, sender=dev)

        conneced_strategy = res.storage['storage']['pools'][0]['strategy']['strat_contract']
        self.assertEqual(conneced_strategy, strategy_address)
        
        # disconect strategy
        connect = self.dex.connect_strategy(0, None)
        res = chain.execute(connect, sender=dev)
        conneced_strategy = res.storage['storage']['pools'][0]['strategy']['strat_contract']
        self.assertIsNone(conneced_strategy)

    def test_connect_token_to_strategy(self):
        pytest.skip("Intercontract calls and changes")
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(1_000_000, 1_000_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        chain.execute(add_pool, sender=admin)
        
        pool_id = 0
        
        connect = self.dex.connect_strategy(pool_id, strategy_address)
        res = chain.execute(connect, sender=dev)

        conneced_strategy = res.storage['storage']['pools'][0]['strategy']['strat_contract']
        self.assertEqual(conneced_strategy, strategy_address)
        rates = {
            0: {
                "des_reserves_rate_f": Decimal("0.3") * Decimal("1e18"),
                "delta_rate_f": Decimal("0.05") * Decimal("1e18"),
                "min_invest": 30000
            },
            1: {
                "des_reserves_rate_f": Decimal("0.2")  * Decimal("1e18"),
                "delta_rate_f": Decimal("0.02")  * Decimal("1e18"),
                "min_invest": 10000
            }
        }

        for token_pool_id, config in rates.items():
            set_strat = self.dex.set_token_strategy(
                pool_id,
                token_pool_id,
                int(config['des_reserves_rate_f']),
                int(config['delta_rate_f']),
                config['min_invest'])
            res = chain.execute(set_strat, sender=dev)
            conneced_config = res.storage['storage']['pools'][pool_id]['strategy']['configuration'][token_pool_id]
            self.assertEqual(conneced_config,
                {
                    "is_rebalance": True,
                    "strategy_reserves": 0,
                    "connected": False,
                    **config
                })
            conn_tok_strat = self.dex.connect_token_strategy(
                pool_id,
                token_pool_id,
                lending_pool_id
            )
            res = chain.execute(conn_tok_strat, sender=dev)
            conneced_config = res.storage['storage']['pools'][pool_id]['strategy']['configuration'][token_pool_id]
            self.assertEqual(conneced_config,
                {
                    "is_rebalance": True,
                    "strategy_reserves": 0,
                    "connected": True,
                    **config
                })

    def test_manual_rebalance(self):
        pytest.skip("Intercontract calls and changes")
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.add_pool(100_000, [token_a, token_b], form_pool_rates(1_000_000, 1_000_000), { "lp_f": 0, "stakers_f": 0, "ref_f": 0})
        chain.execute(add_pool, sender=admin)
        
        pool_id = 0
        
        connect = self.dex.connect_strategy(pool_id, strategy_address)
        res = chain.execute(connect, sender=dev)

        conneced_strategy = res.storage['storage']['pools'][0]['strategy']['strat_contract']
        self.assertEqual(conneced_strategy, strategy_address)
        rates = {
            0: {
                "des_reserves_rate_f": Decimal("0.3") * Decimal("1e18"),
                "delta_rate_f": Decimal("0.05") * Decimal("1e18"),
                "min_invest": 30000
            },
            1: {
                "des_reserves_rate_f": Decimal("0.2")  * Decimal("1e18"),
                "delta_rate_f": Decimal("0.02")  * Decimal("1e18"),
                "min_invest": 10000
            }
        }

        for token_pool_id, config in rates.items():
            set_strat = self.dex.set_token_strategy(
                pool_id,
                token_pool_id,
                int(config['des_reserves_rate_f']),
                int(config['delta_rate_f']),
                config['min_invest'])
            res = chain.execute(set_strat, sender=dev)
            conneced_config = res.storage['storage']['pools'][pool_id]['strategy']['configuration'][token_pool_id]
            self.assertEqual(conneced_config,
                {
                    "is_rebalance": True,
                    "strategy_reserves": 0,
                    "connected": False,
                    **config
                })
            conn_tok_strat = self.dex.connect_token_strategy(
                pool_id,
                token_pool_id,
                lending_pool_id
            )
            res = chain.execute(conn_tok_strat, sender=dev)
            conneced_config = res.storage['storage']['pools'][pool_id]['strategy']['configuration'][token_pool_id]
            self.assertEqual(conneced_config,
                {
                    "is_rebalance": True,
                    "strategy_reserves": 0,
                    "connected": True,
                    **config
                })
        rebalance = self.dex.rebalance(pool_id, rates.keys())
        res = chain.execute(rebalance, sender=dev)
        for token_id in rates.keys():
            token_config = res.storage['storage']['pools'][pool_id]['strategy']['configuration'][token_id]
            token_reserves = res.storage['storage']['pools'][pool_id]['tokens_info'][token_id]['reserves'];
            self.assertAlmostEqual(token_config["strategy_reserves"],
                token_reserves * rates[token_id]['des_reserves_rate_f'] / Decimal("1e18"))