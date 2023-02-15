import { Contract } from "../../utils/types";
import { TezosAddress } from "../../../utils/helpers";
import { DevStorage } from "../../Developer/API/storage";
import { TezosToolkit, TransactionOperation } from "@taquito/taquito";

export declare interface StrategyFactorySetter extends Contract {
  storage: any & {
    storage: any & {
      dev_store: DevStorage;
      strategy_factory: TezosAddress[];
    };
  };
  manageStrategyFactories: (
    strategy_factory: TezosAddress,
    add: boolean
  ) => Promise<TransactionOperation>;
  addStrategyFactory: (
    strategy_factory: TezosAddress
  ) => Promise<TransactionOperation>;
  removeStrategyFactory: (
    strategy_factory: TezosAddress
  ) => Promise<TransactionOperation>;
}
