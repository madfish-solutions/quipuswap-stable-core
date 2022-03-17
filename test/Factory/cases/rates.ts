import { TezosToolkit } from "@taquito/taquito";
import { DexFactoryAPI as DexFactory } from "../API";
import BigNumber from "bignumber.js";
import {
  AccountsLiteral,
  prepareProviderOptions,
} from "../../../utils/helpers";
export async function setInitPriceSuccessCase(
  factory: DexFactory,
  sender: AccountsLiteral,
  initPrice: BigNumber,
  tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  tezos.setProvider(config);
  await factory.updateStorage({});
  const start_price: BigNumber = factory.storage.storage.init_price;
  expect(start_price.toNumber()).not.toStrictEqual(initPrice.toNumber());
  await factory.setInitPrice(initPrice, tezos);
  await factory.updateStorage({});
  const new_price: BigNumber = factory.storage.storage.init_price;
  expect(new_price.toNumber()).toStrictEqual(initPrice.toNumber());
}

export async function setBurnRateSuccessCase(
  factory: DexFactory,
  sender: AccountsLiteral,
  newRate: BigNumber,
  tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  tezos.setProvider(config);
  await factory.updateStorage({});
  const start_rate: BigNumber = factory.storage.storage.burn_rate_f;
  expect(start_rate.toNumber()).not.toStrictEqual(newRate.toNumber());
  await factory.setBurnRate(newRate, tezos);
  await factory.updateStorage({});
  const new_rate: BigNumber = factory.storage.storage.burn_rate_f;
  expect(new_rate.toNumber()).toStrictEqual(newRate.toNumber());
}
