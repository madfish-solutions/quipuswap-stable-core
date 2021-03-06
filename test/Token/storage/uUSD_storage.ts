import { MichelsonMap } from "@taquito/taquito";
import { defaultTokenId } from "../token";
import config from "../../../config";
const aliceAddress: string = config.networks.sandbox.accounts.alice.pkh;
const bobAddress: string = config.networks.sandbox.accounts.bob.pkh;
const eveAddress: string = config.networks.sandbox.accounts.eve.pkh;

const ledger = new MichelsonMap();
// eslint-disable-next-line jest/require-hook
ledger.set(
  {
    token_id: defaultTokenId,
    owner: aliceAddress,
  },
  "1000000000000000000000000"
);
// eslint-disable-next-line jest/require-hook
ledger.set(
  {
    token_id: defaultTokenId,
    owner: bobAddress,
  },
  "1000000000000000000000000"
);
// eslint-disable-next-line jest/require-hook
ledger.set(
  {
    token_id: defaultTokenId,
    owner: eveAddress,
  },
  "1000000000000000000000000"
);
const admins = new MichelsonMap();
// eslint-disable-next-line jest/require-hook
admins.set(
  {
    token_id: defaultTokenId,
    owner: aliceAddress,
  },
  null
);

const uUSDstorage = {
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

export default uUSDstorage;
