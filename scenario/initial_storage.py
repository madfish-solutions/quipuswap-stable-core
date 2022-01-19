import json

def parse_lambdas(path):
    lambdas = {}
    entries = json.load(open(path))
    for i in range(len(entries)):
        entry = entries[i]
        args = entry["args"]
        lbytes = args[0]["bytes"]
        lambdas[i] = lbytes

        assert int(args[1]["int"]) == i 

    return lambdas

admin_lambdas = parse_lambdas("./build/lambdas/Admin_lambdas.json")
dex_lambdas = parse_lambdas("./build/lambdas/Dex_lambdas.json")
permit_lambdas = parse_lambdas("./build/lambdas/Permit_lambdas.json")
token_lambdas = parse_lambdas("./build/lambdas/Token_lambdas.json")