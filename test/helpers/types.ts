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

export declare type FA2TokenType = {
  fa2: { token_address: string; token_id: BigNumber };
};

export declare type FA12TokenType = {
  fa12: string;
};

export declare type TokenType =
  string
  | {
    token_address: string,
    token_id: BigNumber
  };

export declare type TokenInfo = {
  rate: BigNumber;
  proxy_limit: BigNumber;
  precision_multiplier: BigNumber;
  reserves: BigNumber;
  virtual_reserves: BigNumber;
}

export declare type PairInfo = {
  initial_A: BigNumber;
  initial_A_time: Date;
  future_A: BigNumber;
  future_A_time: Date;
  tokens_info: { [key: string]: TokenInfo },
  token_rates: { [key: string]: BigNumber };
  reserves: { [key: string]: BigNumber };
  virtual_reserves: { [key: string]: BigNumber };

  fee: FeeType;
  staker_accumulator: {
    accumulator: { [key: string]: BigNumber };
    total_staked: BigNumber;
  };
  proxy_contract?: string;
  proxy_limits: { [key: string]: BigNumber };
  proxy_reward_acc: { [key: string]: BigNumber };
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
    default_referral: string;
    managers: string[];
    dev_address: string;
    reward_rate: BigNumber;
    pools_count: BigNumber;
    tokens: { [key: string]: { [key: string]: FA12TokenType | FA2TokenType } };
    pool_to_id: { [key: string]: BigNumber };
    pools: { [key: string]: PairInfo };
    ledger: { [key: string]: BigNumber };
    account_data: {
      [key: string]: {
        allowances: { [key: string]: Array<string> };
        earned_interest: { [key: string]: ProviderReward };
      };
    };
    dev_rewards: { [key: string]: BigNumber };
    referral_rewards: { [key: string]: BigNumber };
    stakers_balance: { [key: string]: StakerInfo };
    permits: { [key: string]: any };
    quipu_token: FA2TokenType;
  };
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
  ledger?: { [key: string]: AccountTokenInfo };
};

export declare type FactoryStorage = {
  baker_validator: string;
  token_list: string[];
  token_to_exchange: { [key: string]: string };
  dex_lambdas: { [key: number]: any };
  token_lambdas: { [key: number]: any };
};
