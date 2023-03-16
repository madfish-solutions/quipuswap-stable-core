import {
  ContractAbstractionFromContractType,
  WalletContractAbstractionFromContractType,
} from "./type-utils";
import { address, MMap, nat, TokenType } from "./type-aliases";

export type TokenMapType = {
  lending_market_id: nat;
  desired_reserves_rate_f: nat;
  delta_rate_f: nat;
  min_invest: nat;
  enabled: boolean;
  invested_tokens: nat;
};

export type PoolDataType = {
  pool_contract: address;
  pool_id: nat;
  token_map: MMap<nat, TokenType>;
};

export type Storage = {
  factory: address;
  pool_data: PoolDataType;
  token_map: MMap<nat, TokenMapType>;
};

type Methods = {
  approve_token: (
    param: Array<{
      pool_token_id: nat;
      spender: address;
      amount: nat;
    }>
  ) => Promise<void>;
  claim_rewards: (pool_token_ids: Array<nat>) => Promise<void>;
  connect_token_to_lending: (
    pool_token_id: nat,
    lending_market_id: nat
  ) => Promise<void>;
  update_token_config: (
    pool_token_id: nat,
    desired_reserves_rate_f: nat,
    delta_rate_f: nat,
    min_invest: nat,
    enabled: boolean
  ) => Promise<void>;
  update_state: (tokens: MMap<nat, nat>, manual: boolean) => Promise<void>;
};

type MethodsObject = {
  approve_token: (
    param: Array<{
      pool_token_id: nat;
      spender: address;
      amount: nat;
    }>
  ) => Promise<void>;
  claim_rewards: (pool_token_ids: Array<nat>) => Promise<void>;
  connect_token_to_lending: (params: {
    pool_token_id: nat;
    lending_market_id: nat;
  }) => Promise<void>;
  update_token_config: (params: {
    pool_token_id: nat;
    desired_reserves_rate_f: nat;
    delta_rate_f: nat;
    min_invest: nat;
    enabled: boolean;
  }) => Promise<void>;
  update_state: (params: {
    tokens: MMap<nat, nat>;
    manual: boolean;
  }) => Promise<void>;
};

type contractTypes = {
  methods: Methods;
  methodsObject: MethodsObject;
  storage: Storage;
  code: { __type: "StrategyCode"; protocol: string; code: object[] };
};
export type StrategyContractType =
  ContractAbstractionFromContractType<contractTypes>;
export type StrategyWalletType =
  WalletContractAbstractionFromContractType<contractTypes>;
