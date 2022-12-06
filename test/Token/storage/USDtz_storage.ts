import { MichelsonMap } from "@taquito/taquito";
import config from "../../../config";
const aliceAddress: string = config.networks.sandbox.accounts.alice.pkh;
const bobAddress: string = config.networks.sandbox.accounts.bob.pkh;
const eveAddress: string = config.networks.sandbox.accounts.eve.pkh;

const USDtzstorage = {
  admin: aliceAddress,
  ledger: MichelsonMap.fromLiteral({
    [aliceAddress]: {
      balance: "10000000000000000",
      approvals: MichelsonMap.fromLiteral({}),
    },
    [bobAddress]: {
      balance: "10000000000000000",
      approvals: MichelsonMap.fromLiteral({}),
    },
    [eveAddress]: {
      balance: "10000000000000000",
      approvals: MichelsonMap.fromLiteral({}),
    },
  }),
  paused: false,
  totalSupply: "3000000000000000",
};

export default USDtzstorage;
