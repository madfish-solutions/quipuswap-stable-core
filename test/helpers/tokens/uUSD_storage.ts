import { MichelsonMap } from "@taquito/taquito";
import { defaultTokenId } from '../tokenFA2';
import { sandbox } from "../../../config.json";
const aliceAddress: string = sandbox.accounts.alice.pkh;
const bobAddress: string = sandbox.accounts.bob.pkh;
const eveAddress: string = sandbox.accounts.eve.pkh;

let ledger = new MichelsonMap();
ledger.set({
    token_id: defaultTokenId,
    owner: aliceAddress,
  },
  "1000000000000000000000000"
);
ledger.set(
  {
    token_id: defaultTokenId,
    owner: bobAddress,
  },
  "1000000000000000000000000"
);
ledger.set(
  {
    token_id: defaultTokenId,
    owner: eveAddress,
  },
  "1000000000000000000000000"
);
const admins = new MichelsonMap();
admins.set({
  token_id: defaultTokenId,
  owner: aliceAddress,
}, null);


export const uUSDstorage = {
  administrators: admins,
  ledger: ledger,
  operators: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({
    [defaultTokenId]: {
      token_id: defaultTokenId,
      token_info: MichelsonMap.fromLiteral({}),
    },
  }),
  total_supply: MichelsonMap.fromLiteral({
    [defaultTokenId]: "3000000000000000000000000",
  }),
};