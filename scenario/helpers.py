import sys
from os import urandom
from pytezos import pytezos

from pytezos.crypto.encoding import base58_encode

BLOCK_TIME = 30

alice = "tz1iA1iceA1iceA1iceA1iceA1ice9ydjsaW"
bob = "tz1iBobBobBobBobBobBobBobBobBodTWLCX"
carol = "tz1iCaro1Caro1Caro1Caro1Caro1CbMUKN1"
dave = "tz1iDaveDaveDaveDaveDaveDaveDatFC4So"
julian = "tz1iJu1ianJu1ianJu1ianJu1ianJtvTftP8"
admin = "tz1iAdminAdminAdminAdminAdminAh4qKqu"

dummy_candidate = "tz1XXPVLyQqsMVaQKnPWvD4q6nVwgwXUG4Fp"

# the same as Pytezos' contract.context.get_self_address()
contract_self_address = 'KT1BEqzn5Wx8uJrZNvuS9DVHmLvG9td3fDLi'

# the same as Pytezos' `contract.context.get_sender()`. The default Tezos.sender
me = "tz1Ke2h7sDdakHJQh8WX4Z372du1KChsksyU"

deadline = 100_000

def format_number(data_value, indx):
    if data_value >= 1_000_000:
        formatter = '{:1.1f}M'.format(data_value*0.000_001)
    else:
        formatter = '{:1.0f}K'.format(data_value*0.001)
    return formatter

def print_pool_stats(res):
    print("\n")
    print("token_pool:", res.storage["storage"]["token_pool"])
    print("tez_pool", res.storage["storage"]["tez_pool"])

def get_pool_stats(res):
    token_pool = res.storage["storage"]["token_pool"]
    tez_pool = res.storage["storage"]["tez_pool"]
    return (tez_pool, token_pool)

def calc_shares(token_a, token_b):
    return token_a if token_a < token_b else token_b

def calc_tokens_out(res, tez_amount):
    token_pool = res.storage["storage"]["token_pool"]
    tez_pool = res.storage["storage"]["tez_pool"]
    invariant = tez_pool * token_pool

    tez_pool = tez_pool + tez_amount

    new_token_pool = invariant / abs(tez_pool - tez_amount / fee_rate)
    tokens_out = abs(token_pool - new_token_pool)
    return tokens_out

def calc_tez_out(res, token_amount):
    token_pool = res.storage["storage"]["token_pool"]
    tez_pool = res.storage["storage"]["tez_pool"]
    invariant = tez_pool * token_pool
    
    token_pool = token_pool + token_amount
    new_tez_pool = invariant / abs(token_pool - token_amount / fee_rate)
    tez_out = abs(tez_pool - new_tez_pool)
    return tez_out

def calc_pool_rate(res, pair=-1):
    if pair != -1: #token to token case
        pair_storage = res.storage["storage"]["pairs"][pair]
        token_a_pool = pair_storage["token_a_pool"]
        token_b_pool = pair_storage["token_b_pool"]
        return token_a_pool / token_b_pool


    token_pool = res.storage["storage"]["token_pool"]
    tez_pool = res.storage["storage"]["tez_pool"]
    return tez_pool / token_pool
    

def parse_tez_transfer(op):
    dest = op["destination"]
    amount = int(op["amount"])
    source = op["source"]
    return {
        "type": "tez", 
        "destination": dest,
        "amount": amount,
        "source": source
    }

def parse_as_fa12(value):
    args = value["args"]

    return {
        "type": "token",
        "amount": int(args[2]["int"]),
        "destination": args[1]["string"],
        "source": args[0]["string"]
    }

def parse_as_fa2(values):
    result = []
    value = values[0]
    source = value["args"][0]["string"]
    transfers = value["args"][1]
    for transfer in transfers:
        args = transfer["args"]

        amount = args[-1]["int"]
        amount = int(amount)

        token_id = args[1]["int"]
        token_id = int(token_id)

        dest = args[0]["string"]

        result.append({
            "type": "token",
            "token_id": token_id,
            "destination": dest,
            "amount": amount,
            "source": source
        })

    return result

def parse_transfers(res):
    token_transfers = []
    for op in res.operations:
        if op["kind"] == "transaction":
            entrypoint = op["parameters"]["entrypoint"]
            if entrypoint == "transfer":
                txs = parse_transfer(op)
                token_transfers += txs
    return token_transfers

def parse_transfer(op):
    transfers = []
    value = op["parameters"]["value"]
    if not isinstance(value, list):
        transfer = parse_as_fa12(value)
        transfers.append(transfer)
    else:
        transfers += parse_as_fa2(value)

    for transfer in transfers:
        transfer["token_address"] = op["destination"]

    return transfers

def parse_delegations(res):
    delegates = []
    for op in res.operations:
        if op["kind"] == "delegation":
            delegates.append(op["delegate"])
    return delegates


def parse_ops(res):
    result = []
    for op in res.operations:
        if op["kind"] == "transaction":
            entrypoint = op["parameters"]["entrypoint"]
            if entrypoint == "default":
                tx = parse_tez_transfer(op)
                result.append(tx)
            elif entrypoint == "transfer":
                txs = parse_transfer(op)
                result += txs
            elif entrypoint == "close":
                result.append({"type" : "close"})
    return result

# calculates shares balance
def calc_total_balance(res, address):
    ledger = res.storage["storage"]["ledger"][address]
    return ledger["balance"] + ledger["frozen_balance"]

def generate_random_address() -> str:
    return base58_encode(urandom(20), b'tz1').decode()

def calc_out_per_hundred(chain, dex):
    res = chain.interpret(dex.tokenToTezPayment(amount=100, min_out=1, receiver=alice), amount=0)
    ops = parse_ops(res)
    tez_out = ops[0]["amount"]

    res = chain.interpret(dex.tezToTokenPayment(min_out=1, receiver=alice), amount=100)
    ops = parse_ops(res)
    token_out = ops[0]["amount"]

    return (tez_out, token_out)

def get_shares(res, pool, user):
    storage = res.storage["storage"]
    return storage["ledger"][(user, pool)]

def get_reserves(res, pool):
    storage = res.storage["storage"]
    tokens = storage["pools"][pool]["tokens_info"]
    reserves = {}
    for (token_idx, token) in tokens.items():
        reserves[token_idx] = token["reserves"]
    return reserves

def form_pool_rates(reserves_a, reserves_b, reserves_c=None):
    rates = {
                0: {
                    "rate": pow(10,18),
                    "precision_multiplier": 1,
                    "reserves": reserves_a,
                },
                1: {
                    "rate": pow(10,18),
                    "precision_multiplier": 1,
                    "reserves": reserves_b,
                }
            }
    if reserves_c:
        rates[2] = {
                    "rate": pow(10,18),
                    "precision_multiplier": 1,
                    "reserves": reserves_c,
                }
    return rates

def equal_pool_rates(array):
    rates = {}
    for i in range(len(array)):
        reserves = array[i]

        rates[i] = {
            "rate": pow(10,18),
            "precision_multiplier": 1,
            "reserves": reserves,
        }
    return rates

def operator_add(owner, operator, token_id=0):
    return {
        "add_operator": {
            "owner": owner,
            "operator": operator,
            "token_id": token_id
        }
    }

class LocalChain():
    def __init__(self, storage):
        self.storage = storage

        self.balance = 0
        self.now = 0
        self.payouts = {}
        self.contract_balances = {}
        self.last_res = None

    def execute(self, call, amount=0, sender=None):
        new_balance = self.balance + amount
        res = call.interpret(amount=amount, \
            storage=self.storage, \
            balance=new_balance, \
            now=self.now, \
            sender=sender    
        )
        self.balance = new_balance
        self.storage = res.storage
        self.last_res = res

        # calculate total xtz payouts from contract
        ops = parse_ops(res)
        for op in ops:
            if op["type"] == "tez":
                dest = op["destination"]
                amount = op["amount"]
                self.payouts[dest] = self.payouts.get(dest, 0) + amount

                # reduce contract balance in case it has sent something
                if op["source"] == contract_self_address:
                    self.balance -= op["amount"]

            elif op["type"] == "token":
                dest = op["destination"]
                amount = op["amount"]
                address = op["token_address"]
                if address not in self.contract_balances:
                    self.contract_balances[address] = {}
                contract_balance = self.contract_balances[address] 
                if dest not in contract_balance:
                    contract_balance[dest] = 0
                contract_balance[dest] += amount 
            # imitate closing of the function for convenience
            elif op["type"] == "close":
                self.storage["storage"]["entered"] = False   

        return res

    # just interpret, don't store anything
    def interpret(self, call, amount=0, sender=None):
        res = call.interpret(amount=amount, \
            storage=self.storage, \
            balance=self.balance, \
            now=self.now, \
            sender=sender
        )
        return res

    def advance_blocks(self, count=1):
        self.now += count * BLOCK_TIME
