PRECISION = 1_000_000
A_CONST = 1_000_000

TEZOS_PRECISION = int(1e6)
BITCOIN_PRECISION = int(1e8)
ETH_PRECISION = int(1e18)

FAR_FUTURE = int(1e10)

MIN_RAMP_TIME=86_400

token_a_address = "KT18amZmM5W7qDWVt2pH6uj7sCEd3kbzLrHT"
token_b_address = "KT1AxaBxkFLCUi3f8rdDAAxBKHfzY8LfKDRA"
token_c_address = "KT1XXAavg3tTj12W1ADvd3EEnm1pu6XTmiEF"
token_d_address = "KT1PQ8TMzGMfViRq4tCMFKD2QF5zwJnY67Xn"
token_e_address = "KT1X1LgNkQShpF9nRLYw3Dgdy4qp38MX617z"

token_a = ("fa12", token_a_address)
token_b = ("fa12", token_b_address)
token_c = ("fa12", token_c_address)
token_d = ("fa12", token_d_address)
token_e = ("fa12", token_e_address)

factory = "KT1LzyPS8rN375tC31WPAVHaQ4HyBvTSLwBu"
quipu_token = "KT1LzyPS8rN375tC31WPAVHaQ4HyBvTSLwBu"
price_feed = "KT1Qf46j2x37sAN4t2MKRQRVt9gc4FZ5duMs"

fee_collector = "tz1MDhGTfMQjtMYFXeasKzRWzkQKPtXEkSEw"
dummy_sig = "sigY3oZknG7z2N9bj5aWVtdZBakTviKnwbSYTecbbT2gwQDrnLRNhP5KDcLroggq71AjXWkx27nSLfS8rodS4DYn14FyueS5"

dev = "tz1fRXMLR27hWoD49tdtKunHyfy3CQb5XZst"

vr = {
    f"{factory}%dev_fee": 500_000
}

dummy_metadata = {
    "symbol": "0x01",
    "name": "0x02",
    "decimals": "0x03",
    "icon": "0x04",
}

fees = {
  "lp": 200_000,
  "stakers": 200_000,
  "ref": 500_000,
}