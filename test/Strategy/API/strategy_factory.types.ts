import {
  ContractAbstractionFromContractType,
  WalletContractAbstractionFromContractType,
} from "./type-utils";
import { address, BigMap, MMap, nat, TokenType } from "./type-aliases";
import { PoolDataType } from "./strategy.types";

export type PoolInfo = {
  pool_contract: address;
  pool_id: nat;
};

export type PoolInfoParam = PoolDataType;

export type Storage = {
  dev: {
    dev_address: address;
    temp_dev_address?: address;
  };
  lending_contract: address;
  deployed_strategies: BigMap<PoolInfo, address>;
  connected_pools: BigMap<address, PoolInfo>;
};

type Methods = {
  deploy_strategy: (
    pool_contract: address,
    pool_id: nat,
    token_map: MMap<nat, TokenType>
  ) => Promise<void>;
  approve_developer: () => Promise<void>;
  change_developer: (param: address) => Promise<void>;
};

type MethodsObject = {
  deploy_strategy: (params: PoolInfoParam) => Promise<void>;
  approve_developer: () => Promise<void>;
  change_developer: (param: address) => Promise<void>;
};

type contractTypes = {
  methods: Methods;
  methodsObject: MethodsObject;
  storage: Storage;
  code: { __type: "StrategyFactoryCode"; protocol: string; code: object[] };
};
export type StrategyFactoryContractType =
  ContractAbstractionFromContractType<contractTypes>;
export type StrategyFactoryWalletType =
  WalletContractAbstractionFromContractType<contractTypes>;
