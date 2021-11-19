import { TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { Dex } from "../../helpers/dexFA2";
import { prepareProviderOptions } from "../../helpers/utils";
import { accounts } from "../constants";

export async function investLiquiditySuccessCase(
  dex: Dex,
  sender: string,
  pool_id: BigNumber,
  referral: string,
  min_shares: BigNumber,
  in_amounts: Map<string, BigNumber>,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);

  await dex.updateStorage({
    pools: [pool_id.toString()],
    ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
  });
  const initLPBalance = new BigNumber(
    dex.storage.storage.pools[pool_id.toNumber()].total_supply
  );
  const initLedger =
    dex.storage.storage.ledger[accounts[sender].pkh] || new BigNumber(0);

  await dex.investLiquidity(pool_id, in_amounts, min_shares, referral);

  await dex.updateStorage({
    pools: [pool_id.toString()],
    ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
  });
  const updatedLPBalance = new BigNumber(
    dex.storage.storage.pools[pool_id.toNumber()].total_supply
  );
  const updatedLedger = dex.storage.storage.ledger[accounts[sender].pkh];

  expect(updatedLPBalance.toNumber()).toBeGreaterThan(initLPBalance.toNumber());
  expect(updatedLedger.minus(initLedger).toNumber()).toBeGreaterThanOrEqual(
    min_shares.toNumber()
  );
}