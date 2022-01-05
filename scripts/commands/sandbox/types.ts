export declare type FlextesaOptions = {
  host: string;
  port: number;
  protocol: TezosProtocols;
  genesisBlockHash: string;
  accounts?: FlextesaAccounts;
};
export declare type FlextesaAccounts = {
  [accountName: string]: {
    pkh: string;
    sk: string;
    pk: string;
  };
};

export type FlextesaTezosProtocol = {
  hash: string;
  prefix: string;
  kind: string;
};

export enum TezosProtocols {
  CARTHAGE = "carthage",
  DELPHI = "delphi",
  EDO = "edo",
  FLORENCE = "florence",
  GRANADA = "granada",
  HANGZHOU = "hangzhou",
}

export declare type FlextesaTezosProtocols = {
  [x in TezosProtocols]: FlextesaTezosProtocol;
};
