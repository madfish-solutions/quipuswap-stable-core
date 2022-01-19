import { TezosToolkit } from "@taquito/taquito";
import {
  AccountsLiteral,
  prepareProviderOptions,
} from "../../../utils/helpers";
import DexFactoryAPI from "../API";
export async function claimRewardsSuccessCase(
  factory: DexFactoryAPI,
  sender: AccountsLiteral,
  tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  tezos.setProvider(config);
  await factory.updateStorage({});
  const initRew = factory.storage.storage.quipu_rewards;
  // initManagers includes manager if want to remove and not includes if add
  expect(initRew.toNumber()).toBeGreaterThanOrEqual(0);

  await factory.claimRewards(tezos);

  await factory.updateStorage({});
  const updRew = factory.storage.storage.quipu_rewards;
  expect(updRew.toNumber()).toBe(0);
}
