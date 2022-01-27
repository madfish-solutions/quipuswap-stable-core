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

export declare type AccountDataType = {
  allowances: MichelsonMap<string, Array<string>>;
};

export declare type FeeType = {
  lp: BigNumber;
  stakers: BigNumber;
  ref: BigNumber;
};

export declare type TokenInfo = {
  rate: BigNumber;
  precision_multiplier: BigNumber;
  reserves: BigNumber;
};

export declare type PairInfo = {
  initial_A: BigNumber;
  initial_A_time: Date;
  future_A: BigNumber;
  future_A_time: Date;
  tokens_info: MichelsonMap<string, TokenInfo>;

  fee: FeeType;
  staker_accumulator: {
    accumulator: MichelsonMap<string, BigNumber>;
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
  account_data: MichelsonMap<string, AccountDataType>;
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
};

export declare type DexStorage = {
  storage: DexMainStorage;
  metadata: MichelsonMap<string, BytesString>;
  token_metadata: MichelsonMap<string, any>;
  admin_lambdas: MichelsonMap<string, BytesString>;
  dex_lambdas: MichelsonMap<string, BytesString>;
  token_lambdas: MichelsonMap<string, BytesString>;
};

export declare type RewardsType = {
  reward: BigNumber;
  former: BigNumber;
};

export declare type StakerInfo = {
  balance: BigNumber;
  earnings: MichelsonMap<string, RewardsType>;
};
