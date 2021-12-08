import BigNumber from "bignumber.js";
import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import { confirmOperation } from "../../../helpers/confirmation";
import { Dex } from "../../../helpers/dexFA2";
import { prepareProviderOptions } from "../../../helpers/utils";
import { accounts } from "../../constants";
import { TokenInfo } from "../../../helpers/types";

export async function setProxySuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions("eve");
  Tezos.setProvider(config);
  const proxy: string = accounts.bob.pkh;
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const init_proxy: string =
    dex.storage.storage.pools[pool_id.toString()].proxy_contract;
  const op = await dex.contract.methods.set_proxy(pool_id, proxy).send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd_proxy: string =
    dex.storage.storage.pools[pool_id.toString()].proxy_contract;
  expect(upd_proxy).toEqual(proxy);
  expect(upd_proxy).not.toEqual(init_proxy);
}
export async function removeProxySuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions("eve");
  Tezos.setProvider(config);
  const proxy: string = null;
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const init_proxy: string =
    dex.storage.storage.pools[pool_id.toString()].proxy_contract;
  expect(init_proxy).not.toBeNull();
  const op = await dex.contract.methods.set_proxy(pool_id, proxy).send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd_proxy: string =
    dex.storage.storage.pools[pool_id.toString()].proxy_contract;
  expect(upd_proxy).toBeNull();
}

export async function setupLimits(
  dex: Dex,
  pool_id: BigNumber
): Promise<MichelsonMap<string, BigNumber>> {
  const limits = new MichelsonMap<string, BigNumber>();
  await dex.updateStorage({
    pools: [pool_id.toString()],
    tokens: [pool_id.toString()],
  });
  const tokens_map = dex.storage.storage.pools[pool_id.toNumber()]
    .tokens_info as any as MichelsonMap<string, TokenInfo>;
  tokens_map.forEach((v, k) => {
    limits.set(k, new BigNumber(10).pow(6).multipliedBy(3).multipliedBy(k));
  });
  return limits;
}

export async function setupProxyLimitsSuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  limits: MichelsonMap<string, BigNumber>,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions("eve");
  Tezos.setProvider(config);
  const batch = Tezos.contract.batch();
  limits.forEach((v, k) =>
    batch.withContractCall(
      dex.contract.methods.update_proxy_limits(pool_id, k, v)
    )
  );
  const op = await batch.send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({
    pools: [pool_id.toString()],
    tokens: [pool_id.toString()],
  });
  const upd_limits = dex.storage.storage.pools[pool_id.toNumber()]
    .tokens_info as any as MichelsonMap<string, TokenInfo>;
  limits.forEach((v, k) => {
    expect(upd_limits.get(k).proxy_limit).toEqual(v);
  });
}
