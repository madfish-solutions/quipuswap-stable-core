import { FactoryStorage, InnerFactoryStore } from "../test/Factory/API/types";
import { BytesString, FA2, TezosAddress } from "../utils/helpers";
import BigNumber from "bignumber.js";
import { MichelsonMap } from "@taquito/taquito";
import { DevStorage } from "../test/Developer/API/storage";

const metadata = MichelsonMap.fromLiteral({
  "": Buffer.from("tezos-storage:ssDEXFactory", "ascii").toString("hex"),
  ssDEXFactory: Buffer.from(
    JSON.stringify({
      name: "QuipuSwap Stable DEX Factory",
      version: "v1.0.0",
      description:
        "Factory that provides DEX-as-a-Service liquidity pools for swap tokens with low slippage",
      authors: ["Madfish.Solutions <https://www.madfish.solutions>"],
      source: {
        tools: ["Ligo", "Flextesa"],
        location:
          "https://github.com/madfish-solutions/quipuswap-stable-core/blob/main/contracts/main/dex.ligo",
      },
      homepage: "https://quipuswap.com",
      interfaces: ["TZIP-16"],
      errors: [],
      views: [],
    }),
    "ascii"
  ).toString("hex"),
}) as MichelsonMap<string, BytesString>;

const factoryDefaultStorage: FactoryStorage = {
  storage: {
    dev_store: {
      dev_address: null as TezosAddress, // DON'T Touch! Setting from deployer SK
      dev_fee_f: new BigNumber(0),
      dev_lambdas: new MichelsonMap(),
    } as DevStorage,
    init_price: new BigNumber("0"),
    burn_rate_f: new BigNumber("0"),
    pools_count: new BigNumber("0"),
    pool_id_to_address: new MichelsonMap(),
    pool_to_address: new MichelsonMap(),
    quipu_token: {
      token_address: (process.env.QUIPU_TOKEN_ADDRESS || null) as TezosAddress,
      token_id: (new BigNumber(process.env.QUIPU_TOKEN_ID) ||
        null) as BigNumber,
    } as FA2,
    quipu_rewards: new BigNumber("0"),
    whitelist: [] as TezosAddress[],
    deployers: new MichelsonMap(),
  } as InnerFactoryStore,
  admin_lambdas: new MichelsonMap(),
  dex_lambdas: new MichelsonMap(),
  token_lambdas: new MichelsonMap(),
  metadata: metadata,
};

export default factoryDefaultStorage;
