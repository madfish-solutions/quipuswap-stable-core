import { MichelsonMap } from "@taquito/taquito";
import { DevStorage } from "../test/Developer/API/storage";
import { DexStorage } from "../test/Dex/API/types";
import { BytesString, FA2, TezosAddress } from "../utils/helpers";
import BigNumber from "bignumber.js";

const metadata = MichelsonMap.fromLiteral({
  "": Buffer.from("tezos-storage:ssDEXStandalone", "ascii").toString("hex"),
  ssDEXStandalone: Buffer.from(
    JSON.stringify({
      name: "QuipuSwap Stable DEX Standalone contract",
      version: "v1.0.0",
      description:
        "Contract that provides liquidity pools for swap tokens with low slippage",
      authors: ["Madfish.Solutions <https://www.madfish.solutions>"],
      source: {
        tools: ["Ligo", "Flextesa"],
        location:
          "https://github.com/madfish-solutions/quipuswap-stable-core/blob/main/contracts/main/dex.ligo",
      },
      homepage: "https://quipuswap.com",
      interfaces: ["TZIP-16", "TZIP-12 git 1728fcfe"],
      errors: [],
      views: [],
    }),
    "ascii"
  ).toString("hex"),
}) as MichelsonMap<string, BytesString>;

const storage: DexStorage = {
  storage: {
    admin: null as TezosAddress, // DON'T Touch! Setting from deployer SK
    dev_store: {
      dev_address: (process.env.DEVELOPER_ADDRESS || null) as TezosAddress,
      dev_fee_f: new BigNumber(0),
      dev_lambdas: new MichelsonMap(),
    } as DevStorage,
    default_referral: (process.env.DEFAULT_REFERRAL || null) as TezosAddress,
    managers: [],

    pools_count: new BigNumber("0"),
    tokens: new MichelsonMap(),
    pool_to_id: new MichelsonMap(),
    pools: new MichelsonMap(),
    ledger: new MichelsonMap(),
    token_metadata: new MichelsonMap(),
    allowances: new MichelsonMap(),
    dev_rewards: new MichelsonMap(),
    referral_rewards: new MichelsonMap(),
    stakers_balance: new MichelsonMap(),
    quipu_token: {
      token_address: (process.env.QUIPU_TOKEN_ADDRESS || null) as TezosAddress,
      token_id: (new BigNumber(process.env.QUIPU_TOKEN_ID) ||
        null) as BigNumber,
    } as FA2,
  },
  metadata: metadata,
  admin_lambdas: new MichelsonMap(),
  dex_lambdas: new MichelsonMap(),
  token_lambdas: new MichelsonMap(),
};

export default storage;
