import BigNumber from "bignumber.js";

export declare type FeeType = {
  lp_fee: BigNumber;
  stakers_fee: BigNumber;
  ref_fee: BigNumber;
  dev_fee: BigNumber;
}

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
  tokens_count: BigNumber;
  tokens: { [key: string]: TokenType };
  token_rates: { [key: string]: BigNumber };
  dev_balances: { [key: string]: BigNumber };
  pools: { [key: string]: BigNumber };
  virtual_pools: { [key: string]: BigNumber };
  future_A: BigNumber;
  future_A_time: Date;
  proxy_contract?: string;
  proxy_limits: { [key: string]: BigNumber };
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
    fee: FeeType | { [key: string]: BigNumber };
    is_public_init: boolean;
    reward_rate: BigNumber;
    pairs_count: BigNumber;
    tokens: { [key: string]: [value: { [key: string]: TokenType }] };
    token_to_id: { [key: string]: BigNumber };
    pairs: { [key: string]: PairInfo };
    ledger: { [key: string]: AccountInfo };
  };
  ledger: { [key: string]: AccountInfo };
  metadata: { [key: string]: any };
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

export declare type AccountTokenInfo = {
  balance: BigNumber;
  allowances: { [key: string]: BigNumber };
};

export declare type VoteInfo = {
  candidate: string | null | undefined;
  vote: BigNumber;
  veto: BigNumber;
  last_veto: number;
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
