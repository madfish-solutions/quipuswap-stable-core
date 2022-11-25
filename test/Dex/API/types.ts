/* eslint-disable @typescript-eslint/no-explicit-any */
import BigNumber from "bignumber.js";
import { MichelsonMap } from "@taquito/taquito";
import {
  BytesString,
  FA12TokenType,
  FA2,
  FA2TokenType,
  TezosAddress,
} from "../../../utils/helpers";
import { DevStorage } from "../../Developer/API/storage";

export declare type AllowancesDataType = Array<string>;

export declare type FeeType = {
  lp_f: BigNumber;
  stakers_f: BigNumber;
  ref_f: BigNumber;
};

export declare type TokenInfo = {
  rate_f: BigNumber;
  precision_multiplier_f: BigNumber;
  reserves: BigNumber;
};

export declare type TokenStrategyConfiguration = {
  des_reserves_rate_f: BigNumber;
  delta_rate_f: BigNumber;
  min_invest: BigNumber;
  strategy_reserves: BigNumber;
  is_rebalance: boolean;
};

export declare type StrategyStoreType = {
  strat_contract?: TezosAddress;
  configuration: MichelsonMap<string, TokenStrategyConfiguration>;
};

export declare type PairInfo = {
  initial_A_f: BigNumber;
  initial_A_time: Date;
  future_A_f: BigNumber;
  future_A_time: Date;
  tokens_info: MichelsonMap<string, TokenInfo>;

  fee: FeeType;
  strategy: StrategyStoreType;
  staker_accumulator: {
    accumulator_f: MichelsonMap<string, BigNumber>;
    total_staked: BigNumber;
  };
  total_supply: BigNumber;
};

export declare type DexMainStorage = {
  admin: TezosAddress;
  default_referral: TezosAddress;
  managers: Array<TezosAddress>;
  pools_count: BigNumber;
  tokens: MichelsonMap<
    string,
    MichelsonMap<string, FA12TokenType | FA2TokenType>
  >;
  pool_to_id: MichelsonMap<BytesString, number>;
  pools: MichelsonMap<string, PairInfo>;
  ledger: MichelsonMap<string, BigNumber>;
  token_metadata: MichelsonMap<string, any>;
  allowances: MichelsonMap<string, AllowancesDataType>;
  dev_rewards: MichelsonMap<FA12TokenType | FA2TokenType, BigNumber>;
  referral_rewards: MichelsonMap<
    {
      0: TezosAddress;
      1: FA12TokenType | FA2TokenType;
    },
    BigNumber
  >;
  quipu_token: FA2;
  stakers_balance: MichelsonMap<
    {
      0: TezosAddress;
      1: string;
    },
    StakerInfo
  >;
  dev_store?: DevStorage;
  factory_address?: TezosAddress;
  strategy_factory?: TezosAddress[];
};

export declare type DexStorage = {
  storage: DexMainStorage;
  metadata: MichelsonMap<string, BytesString>;
  admin_lambdas: MichelsonMap<string, BytesString>;
  dex_lambdas: MichelsonMap<string, BytesString>;
  token_lambdas: MichelsonMap<string, BytesString>;
  strat_lambdas: MichelsonMap<string, BytesString>;
};

export declare type RewardsType = {
  reward_f: BigNumber;
  former_f: BigNumber;
};

export declare type StakerInfo = {
  balance: BigNumber;
  earnings: MichelsonMap<string, RewardsType>;
};
