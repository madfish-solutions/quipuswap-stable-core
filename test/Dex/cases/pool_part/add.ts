import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";
import Dex from "../../API";
import {
  AccountsLiteral,
  prepareProviderOptions,
} from "../../../../utils/helpers";
import { TokensMap } from "../../../utils/types";
import { decimals } from "../../../../utils/constants";
import { TokenFA12, TokenFA2 } from "../../../Token";

export async function manageInputs(
  input: BigNumber,
  tokens: TokensMap
): Promise<
  Array<{
    asset: TokenFA12 | TokenFA2;
    in_amount: BigNumber;
    rate_f: BigNumber;
    precision_multiplier_f: BigNumber;
  }>
> {
  let inputs = [
    {
      asset: tokens.kUSD,
      in_amount: decimals.kUSD.multipliedBy(input),
      rate_f: new BigNumber(10).pow(18),
      precision_multiplier_f: new BigNumber(1),
    },
    {
      asset: tokens.USDtz,
      in_amount: decimals.USDtz.multipliedBy(input),
      rate_f: new BigNumber(10).pow(18 + 12),
      precision_multiplier_f: new BigNumber(10).pow(12),
    },
    {
      asset: tokens.uUSD,
      in_amount: decimals.uUSD.multipliedBy(input),
      rate_f: new BigNumber(10).pow(18 + 6),
      precision_multiplier_f: new BigNumber(10).pow(6),
    },
  ];
  inputs = inputs.sort(
    (
      a: { asset: { contract: { address: string } } },
      b: { asset: { contract: { address: string } } }
    ) => {
      if (a.asset instanceof TokenFA2 && b.asset instanceof TokenFA12) return 1;
      else if (b.asset instanceof TokenFA2 && a.asset instanceof TokenFA12)
        return -1;
      else if (a.asset.contract.address < b.asset.contract.address) return -1;
      else if (a.asset.contract.address > b.asset.contract.address) return 1;
      else 0;
    }
  );
  return inputs;
}

export async function addNewPair(
  dex: Dex,
  sender: AccountsLiteral,
  a_const: BigNumber = new BigNumber("1000000"),
  exp_input: BigNumber,
  inputs: {
    asset: TokenFA12 | TokenFA2;
    in_amount: BigNumber;
    rate_f: BigNumber;
    precision_multiplier_f: BigNumber;
  }[],
  approve = false,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  const sender_addr = await Tezos.signer.publicKeyHash();

  await dex.updateStorage({});
  const initPairCount = new BigNumber(dex.storage.storage.pools_count);

  expect(sender_addr).toStrictEqual(dex.storage.storage.admin);
  await dex.addPool(a_const, inputs, approve, Tezos);

  await dex.updateStorage({});
  await dex.updateStorage({
    pools: [(dex.storage.storage.pools_count.toNumber() - 1).toString()],
    ledger: [[sender_addr, 0]],
  });
  const updatedPairCount = new BigNumber(dex.storage.storage.pools_count);
  const updatedSenderBalance = dex.storage.storage.ledger[sender_addr];
  expect(initPairCount.toNumber() + 1).toStrictEqual(
    updatedPairCount.toNumber()
  );
  expect(updatedSenderBalance.toNumber()).toStrictEqual(
    new BigNumber(10)
      .pow(18)
      .multipliedBy(exp_input)
      .multipliedBy(inputs.length)
      .toNumber()
  );
}
