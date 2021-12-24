import { TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { confirmOperation } from "../../helpers/confirmation";
import Dex from "../API";
import {
  AccountsLiteral,
  mapTokensToIdx,
  prepareProviderOptions,
} from "../../helpers/utils";
import { accounts, decimals, swap_routes } from "../constants";
import { setupTokenAmounts } from "../tokensSetups";
import { AmountsMap, IndexMap, TokensMap } from "../types";
import {
  MichelsonV1ExpressionBase,
  MichelsonV1ExpressionExtended,
} from "@taquito/rpc";
import { TokenFA12 } from "../../Token";

export async function setupTokenMapping(
  dex: Dex,
  tokens: TokensMap,
  inputs: AmountsMap
): Promise<{
  pool_id: BigNumber;
  amounts: Map<string, BigNumber>;
  idx_map: IndexMap;
}> {
  const stp = await setupTokenAmounts(dex, tokens, inputs);
  const amounts = new Map<string, BigNumber>();
  stp.amounts.forEach((v, k) => {
    amounts.set(k, v);
  });
  const pool_id = stp.pool_id;
  const tokens_map = dex.storage.storage.tokens[pool_id.toNumber()];
  return {
    pool_id,
    amounts,
    idx_map: mapTokensToIdx(tokens_map, tokens),
  };
}

export async function swapSuccessCase(
  dex: Dex,
  tokens: TokensMap,
  sender: AccountsLiteral,
  pool_id: BigNumber,
  t_in,
  t_to,
  exp: Date,
  referral: string,
  idx_map: IndexMap,
  normalized_input: BigNumber,
  amounts: Map<string, BigNumber>,
  lambdaContractAddress: string,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  const i = idx_map[t_in];
  const j = idx_map[t_to];
  await dex.updateStorage({ pools: [pool_id.toString()] });
  // printFormattedOutput(dex.storage.storage.pools[pool_id.toString()]);
  const init_reserves =
    dex.storage.storage.pools[pool_id.toString()].tokens_info;
  const rates = {};
  dex.storage.storage.pools[pool_id.toString()].tokens_info.forEach((v, k) => {
    rates[k] = new BigNumber(10).pow(18).dividedBy(v.rate);
  });
  const tok_in = tokens[t_in];
  const tok_out = tokens[t_to];
  const t_in_ep =
    tok_in.contract.views.balance_of || tok_in.contract.views.getBalance;
  const t_out_ep =
    tok_out.contract.views.balance_of || tok_out.contract.views.getBalance;
  let init_in = await (tok_in instanceof TokenFA12
    ? t_in_ep(accounts[sender].pkh)
    : t_in_ep([{ owner: accounts[sender].pkh, token_id: "0" }])
  ).read(lambdaContractAddress);

  let init_out = await (tok_out instanceof TokenFA12
    ? t_out_ep(accounts[sender].pkh)
    : t_out_ep([{ owner: accounts[sender].pkh, token_id: "0" }])
  ).read(lambdaContractAddress);

  const in_amount = amounts.get(i);
  let min_out = amounts.get(j);
  min_out = min_out.minus(min_out.multipliedBy(1).div(100));

  console.debug(
    `[SWAP] ${in_amount
      .dividedBy(rates[i])
      .div(new BigNumber(10).pow(18))
      .toFormat()} ${t_in} -> min ${min_out
      .dividedBy(rates[j])
      .div(new BigNumber(10).pow(18))
      .toFormat()} ${t_to}`
  );
  const op = await dex.swap(
    pool_id,
    new BigNumber(i),
    new BigNumber(j),
    in_amount,
    min_out,
    exp,
    accounts[sender].pkh,
    referral
  );
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd_reserves =
    dex.storage.storage.pools[pool_id.toString()].tokens_info;
  expect(upd_reserves.get(i.toString()).reserves).toStrictEqual(
    init_reserves.get(i.toString()).reserves.plus(amounts.get(i))
  );

  // Get output from internal transaction
  const output_params =
    op.operationResults[0].metadata.internal_operation_results // swap operation // internal operations
      .find((val) => val.destination == tok_out.contract.address).parameters // find needed transfer
      .value as MichelsonV1ExpressionExtended; // transfer params
  let output: BigNumber;
  if (tok_out instanceof TokenFA12)
    output = new BigNumber(
      (
        (output_params.args[1] as MichelsonV1ExpressionExtended) // unpack
          .args[1] as MichelsonV1ExpressionBase
      ).int
    );
  else
    output = new BigNumber(
      (
        (
          (output_params[0].args[1][0] as MichelsonV1ExpressionExtended)
            .args[1] as MichelsonV1ExpressionExtended
        ).args[1] as MichelsonV1ExpressionBase
      ).int
    );

  console.debug(
    `[SWAP] Swapped to ${output
      .dividedBy(rates[j])
      .div(new BigNumber(10).pow(18))
      .toFormat(10)} ${t_to}.`
  );
  let upd_in = await (tok_in instanceof TokenFA12
    ? t_in_ep(accounts[sender].pkh)
    : t_in_ep([{ owner: accounts[sender].pkh, token_id: "0" }])
  ).read(lambdaContractAddress);
  let upd_out = await (tok_out instanceof TokenFA12
    ? t_out_ep(accounts[sender].pkh)
    : t_out_ep([{ owner: accounts[sender].pkh, token_id: "0" }])
  ).read(lambdaContractAddress);

  expect(output.toNumber()).toBeGreaterThanOrEqual(min_out.toNumber());

  expect(
    output.dividedBy(rates[j]).dividedBy(new BigNumber(10).pow(18)).toNumber()
  ).toBeCloseTo(
    normalized_input
      .minus(normalized_input.multipliedBy(5).dividedBy(10000))
      .toNumber()
  );

  init_in = init_in instanceof BigNumber ? init_in : init_in[0].balance;
  init_out = init_out instanceof BigNumber ? init_out : init_out[0].balance;
  upd_in = upd_in instanceof BigNumber ? upd_in : upd_in[0].balance;
  upd_out = upd_out instanceof BigNumber ? upd_out : upd_out[0].balance;
  console.debug(
    `[SWAP] Balance ${t_in}: ${init_in
      .dividedBy(rates[i])
      .div(new BigNumber(10).pow(18))
      .toFormat(10)} -> ${upd_in
      .dividedBy(rates[i])
      .div(new BigNumber(10).pow(18))
      .toFormat(10)}`
  );
  console.debug(
    `[SWAP] Balance ${t_to}: ${init_out
      .dividedBy(rates[j])
      .div(new BigNumber(10).pow(18))
      .toFormat(10)} -> ${upd_out
      .dividedBy(rates[j])
      .div(new BigNumber(10).pow(18))
      .toFormat(10)}`
  );
  console.debug(
    `[SWAP] Reserves ${t_in}: ${init_reserves
      .get(i)
      .reserves.dividedBy(rates[i])
      .div(new BigNumber(10).pow(18))
      .toFormat(10)} -> ${upd_reserves
      .get(i)
      .reserves.dividedBy(rates[i])
      .div(new BigNumber(10).pow(18))
      .toFormat(10)}`
  );

  console.debug(
    `[SWAP] Reserves ${t_to}: ${init_reserves
      .get(j)
      .reserves.dividedBy(rates[j])
      .div(new BigNumber(10).pow(18))
      .toFormat(10)} -> ${upd_reserves
      .get(j)
      .reserves.dividedBy(rates[j])
      .div(new BigNumber(10).pow(18))
      .toFormat(10)}`
  );

  expect(
    init_in.minus(upd_in).dividedBy(decimals[t_in]).toNumber()
  ).toBeCloseTo(normalized_input.toNumber());

  expect(
    upd_out.minus(init_out).dividedBy(decimals[t_to]).toNumber()
  ).toBeCloseTo(
    normalized_input
      .minus(normalized_input.multipliedBy(5).dividedBy(10000))
      .toNumber()
  );
}

export async function batchSwap(
  dex: Dex,
  tokens: TokensMap,
  times: number,
  poolId: BigNumber,
  amount: BigNumber,
  exp: Date,
  ref: string,
  Tezos: TezosToolkit
): Promise<void> {
  const inputs: AmountsMap = {
    kUSD: decimals.kUSD.multipliedBy(amount),
    uUSD: decimals.uUSD.multipliedBy(amount),
    USDtz: decimals.USDtz.multipliedBy(amount),
  };
  const stp = await setupTokenAmounts(dex, tokens, {
    kUSD: inputs.kUSD.multipliedBy(2),
    uUSD: inputs.uUSD.multipliedBy(2),
    USDtz: inputs.USDtz.multipliedBy(2),
  });
  const amounts: Map<string, BigNumber> = new Map<string, BigNumber>();
  stp.amounts.forEach((v, k) => {
    amounts.set(k, v.dividedBy(2));
  });
  const tokens_map = dex.storage.storage.tokens[poolId.toNumber()];
  const map_tokens_idx: IndexMap = mapTokensToIdx(tokens_map, tokens);
  for (let i = 0; i < times; i++) {
    const batch = Tezos.contract.batch();
    for (const [t_in, t_out] of swap_routes) {
      const i = map_tokens_idx[t_in];
      const j = map_tokens_idx[t_out];
      let min_out = amounts.get(j);
      min_out = min_out.minus(min_out.multipliedBy(1).div(100));
      batch.withContractCall(
        dex.contract.methods.swap(
          poolId,
          i,
          j,
          amounts.get(i),
          min_out,
          new BigNumber(exp.getTime()),
          null,
          ref
        )
      );
    }
    const op = await batch.send();
    await confirmOperation(Tezos, op.hash);
    console.debug(`[BATCH:SWAP] ${i + 1}/${times} ${op.hash}`);
    await dex.updateStorage({ pools: [poolId.toString()] });
  }
}
