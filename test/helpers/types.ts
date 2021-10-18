import BigNumber from "bignumber.js";

export declare type FeeType = {
  lp_fee: BigNumber;
  stakers_fee: BigNumber;
  ref_fee: BigNumber;
  dev_fee: BigNumber;
}

export declare type LambdaFunctionType = {
  index: number;
  name: string;
};

export declare type TokenType =
  string
  | {
    token_address: string,
    token_id: BigNumber
  };

export declare type TokenInfo = {
  token_a_address: string;
  token_b_address: string;
  token_a_id?: BigNumber;
  token_b_id?: BigNumber;
  token_a_type: { [key: string]: any };
  token_b_type: { [key: string]: any };
};

export declare type PairInfo = {
  initial_A: BigNumber;
  initial_A_time: Date;
  token_rates: { [key: string]: BigNumber };
  reserves: { [key: string]: BigNumber };
  virtual_reserves: { [key: string]: BigNumber };
  future_A: BigNumber;
  future_A_time: Date;
  fee: FeeType;
  staker_accumulator: { [key: string]: BigNumber };
  proxy_contract?: string;
  proxy_limits: { [key: string]: BigNumber };
  stakers_interest: { [key: string]: BigNumber };
  total_supply: BigNumber;
};

export declare type SwapSliceType = {
  pair: TokenInfo;
  operation: { [key: string]: any };
};

export declare type DexStorage = {
  dex_lambdas: { [key: string]: any };
  token_lambdas: { [key: string]: any };
  storage: {
    admin: string;
    managers: string[];
    dev_address: string;
    reward_rate: BigNumber | string;
    pools_count: BigNumber | string;
    tokens: { [key: string]: { [key: string]: TokenType } };
    pool_to_id: { [key: string]: BigNumber };
    pools: { [key: string]: PairInfo };
    ledger: { [key: string]: BigNumber };
    allowances: { [key: string]: Array<string> };
    dev_rewards: { [key: string]: BigNumber };
    referral_rewards: { [key: string]: { [key: string]: BigNumber } };
    stakers_balance: { [key: string]: StakerInfo };
    pool_interest_rewards: { [key: string]: BigNumber };
    providers_rewards: { [key: string]: ProviderReward };
    permits: { [key: string]: any };
  };
  ledger: { [key: string]: AccountInfo };
  metadata: { [key: string]: any };
  token_metadata: { [key: string]: any };
};

export declare type MetadataStorage = {
  metadata: { [key: string]: Buffer };
  owners: string[];
};

export declare type UserRewardInfo = {
  reward: BigNumber;
  reward_paid: BigNumber;
};

export declare type AccountInfo = {
  balance: BigNumber;
  frozen_balance?: BigNumber;
  allowances: { [key: string]: BigNumber };
};

export declare type StakerInfo = {
  balance: BigNumber;
  reward: { [key: string]: BigNumber };
  former: { [key: string]: BigNumber };
};

export declare type ProviderReward = {
  reward: { [key: string]: BigNumber };
  former: { [key: string]: BigNumber };
};


export declare type VoteInfo = {
  candidate: string | null | undefined;
  vote: BigNumber;
  veto: BigNumber;
  last_veto: number;
};

export declare type AccountTokenInfo = {
  balance: BigNumber;
  allowances: { [key: string]: BigNumber };
};

export declare type TokenStorage = {
  total_supply?: BigNumber;
  ledger: { [key: string]: AccountTokenInfo };
};

export declare type FactoryStorage = {
  baker_validator: string;
  token_list: string[];
  token_to_exchange: { [key: string]: string };
  dex_lambdas: { [key: number]: any };
  token_lambdas: { [key: number]: any };
};
