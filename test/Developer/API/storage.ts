import { MichelsonMap } from "@taquito/taquito";
import { BytesString, TezosAddress } from "../../../utils/helpers";
import BigNumber from "bignumber.js";

export declare type DevStorage = {
  dev_address: TezosAddress;
  dev_fee: BigNumber;
  dev_lambdas: MichelsonMap<string, BytesString>;
};
