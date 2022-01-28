
import json
from pprint import pprint
from constants import A_CONST

from helpers import *

from pytezos import ContractInterface, pytezos, MichelsonRuntimeError
from initial_storage import admin_lambdas, dex_lambdas, token_lambdas

import matplotlib.pyplot as plt
import matplotlib.ticker

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

class GraphDrawer:
    def __init__(cls):
        text = open("./build/dex.json").read()
        code = json.loads(text)

        cls.dex = ContractInterface.from_micheline(code["michelson"])

        storage = cls.dex.storage.dummy()
        storage["token_lambdas"] = token_lambdas
        storage["dex_lambdas"] = dex_lambdas
        storage["admin_lambdas"] = admin_lambdas
        storage["storage"]["admin"] = admin
        cls.init_storage = storage

    def divest_to_invest_proportion(self):
        x_axis = []
        y_axis = []
        for i in range(10):
            chain = LocalChain(storage=self.init_storage)
            res = chain.execute(self.dex.add_pool(A_CONST, [token_a_alt, token_b_alt], form_pool_rates(100_000_000, 50)), sender=admin)

            coef = i / 10
            invested_a = int(coef * 20_000_000) + 2_000_088

            invest = self.dex.invest(pool_id=0, shares=1, in_amounts={0: invested_a, 1: 1}, time_expiration=1, receiver=None, referral=None)
            res = chain.execute(invest)
            transfers = parse_transfers(res)

            all_shares = res.storage["storage"]["ledger"][(me,0)]
            res = chain.execute(self.dex.divest(pool_id=0, min_amounts_out={0: 1, 1: 1}, shares=all_shares, time_expiration=1, receiver=None))
            transfers = parse_transfers(res)
            divested_a = transfers[1]["amount"]
            divested_b = transfers[0]["amount"]
            
            x_axis.append(invested_a)
            y_axis.append(divested_a + divested_b)

        fig, ax = plt.subplots()
        ax.set(xlabel="invested", ylabel="divested")
        ax.plot(x_axis, y_axis)
        ax.set_ylim(0, 22_000_000)
        ax.set_xlim(0, 22_000_000)
        ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(format_number)) 
        ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(format_number)) 
        ax.grid()
        fig.savefig("test.png")

graphs = GraphDrawer()
graphs.divest_to_invest_proportion()