import { MichelsonMap } from "@taquito/taquito";
import { sandbox } from "../../../config.json";
import { BigNumber } from "bignumber.js";
import { defaultTokenId } from "../token";

const aliceAddress: string = sandbox.accounts.alice.pkh;
const bobAddress: string = sandbox.accounts.bob.pkh;
const eveAddress: string = sandbox.accounts.eve.pkh;

const account_info = {
  allowances: [],
  balances: MichelsonMap.fromLiteral({
    [defaultTokenId]: new BigNumber("1000000000000000000000000"),
  }) as MichelsonMap<string, BigNumber>,
};
const accounts_info = new MichelsonMap<
  string,
  {
    allowances: Array<string>;
    balances: MichelsonMap<string, BigNumber>;
  }
>();

// eslint-disable-next-line jest/require-hook
accounts_info.set(aliceAddress, account_info);
// eslint-disable-next-line jest/require-hook
accounts_info.set(bobAddress, account_info);
// eslint-disable-next-line jest/require-hook
accounts_info.set(eveAddress, account_info);

const QUIPUstorage = {
  account_info: accounts_info,
  token_info: MichelsonMap.fromLiteral({
    [defaultTokenId]: "3000000000000000000000000",
  }),
  metadata: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({
    [defaultTokenId]: {
      token_id: defaultTokenId,
      token_info: MichelsonMap.fromLiteral({}),
    },
  }),
  minters_info: MichelsonMap.fromLiteral({}),
  last_token_id: (defaultTokenId + 1).toString(),
  admin: aliceAddress,
  permit_counter: "0",
  permits: MichelsonMap.fromLiteral({}),
  default_expiry: "1000",
  total_minter_shares: "0",
};

export default QUIPUstorage;
