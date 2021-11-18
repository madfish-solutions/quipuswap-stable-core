import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { confirmOperation } from "../../helpers/confirmation";
import { Dex } from "../../helpers/dexFA2";
import { TokenFA12 } from "../../helpers/tokenFA12";
import { FA12TokenType, FA2TokenType, TokenInfo } from "../../helpers/types";
import { AccountsLiteral, mapTokensToIdx, prepareProviderOptions, printFormattedOutput } from "../../helpers/utils";
import { accounts, decimals, swap_routes } from "../constants";
import { setupTokenAmounts } from "../tokensSetups";
import { AmountsMap, IndexMap, TokensMap } from "../types";

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
  let amounts = new Map<string, BigNumber>();
  stp.amounts.forEach((v, k) => {
    amounts.set(k, v);
  });
  const pool_id = stp.pool_id;
  const tokens_map = dex.storage.storage.tokens[
    pool_id.toNumber()
  ] as any as Map<string, FA2TokenType | FA12TokenType>;
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
  referral: string,
  idx_map: IndexMap,
  normalized_input: BigNumber,
  amounts: Map<string, BigNumber>,
  lambdaContractAddress: string,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  const i = idx_map[t_in];
  const j = idx_map[t_to];
  await dex.updateStorage({ pools: [pool_id.toString()] });
  // printFormattedOutput(dex.storage.storage.pools[pool_id.toString()]);
  const init_reserves = dex.storage.storage.pools[pool_id.toString()]
    .tokens_info as any as Map<string, TokenInfo>;
  const rates = {};
  (
    dex.storage.storage.pools[pool_id.toString()].tokens_info as any as Map<
      string,
      TokenInfo
    >
  ).forEach((v, k) => {
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

  printFormattedOutput(
    global.startTime,
    `Swapping ${t_in} with amount ${in_amount
      .dividedBy(rates[i])
      .div(new BigNumber(10).pow(18))
      .toFormat()} to ${t_to} with min amount ${min_out
      .dividedBy(rates[j])
      .div(new BigNumber(10).pow(18))
      .toFormat()}`
  );
  await dex.swap(
    pool_id,
    new BigNumber(i),
    new BigNumber(j),
    in_amount,
    min_out,
    accounts[sender].pkh,
    referral
  );
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd_reserves = dex.storage.storage.pools[pool_id.toString()]
    .tokens_info as any as Map<string, TokenInfo>;
  expect(upd_reserves.get(i.toString()).reserves).toEqual(
    init_reserves.get(i.toString()).reserves.plus(amounts.get(i))
  );
  const output = init_reserves
    .get(j.toString())
    .reserves.minus(upd_reserves.get(j.toString()).reserves);
  printFormattedOutput(
    global.startTime,
    `Swapped to ${output
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
  printFormattedOutput(global.startTime, init_in.toFormat(), upd_in.toFormat());
  printFormattedOutput(
    global.startTime,
    init_out.toFormat(),
    upd_out.toFormat()
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
  ref: string,
  Tezos: TezosToolkit
): Promise<void> {
  let amounts: Map<string, BigNumber>;
  const inputs: AmountsMap = {
    kUSD: decimals.kUSD.multipliedBy(amount),
    uUSD: decimals.uUSD.multipliedBy(amount),
    USDtz: decimals.USDtz.multipliedBy(amount)
  };
  let map_tokens_idx: IndexMap;
  const stp = await setupTokenAmounts(
    dex,
    tokens,
    {
      kUSD:inputs.kUSD.multipliedBy(2),
      uUSD:inputs.uUSD.multipliedBy(2),
      USDtz:inputs.USDtz.multipliedBy(2)
    }
  );
  amounts = new Map<string, BigNumber>();
  stp.amounts.forEach((v, k) => {
    amounts.set(k, v.dividedBy(2));
  });
  const tokens_map = dex.storage.storage.tokens[
    poolId.toNumber()
  ] as any as Map<string, FA2TokenType | FA12TokenType>;
  map_tokens_idx = mapTokensToIdx(tokens_map, tokens);
  for (let i = 0; i < times; i++) {
    let batch = Tezos.contract.batch();
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
          null,
          ref
        )
      );
    }
    const op = await batch.send();
    await confirmOperation(Tezos, op.hash);
    printFormattedOutput(global.startTime, `${i + 1} BatchSwap ${op.hash}`);
    await dex.updateStorage({ pools: [poolId.toString()] });
    const res = dex.storage.storage.pools[poolId.toNumber()]
      .tokens_info as any as MichelsonMap<string, TokenInfo>;
    let raw_res = {};
    res.forEach(
      (value, key) => (raw_res[key] = value.reserves.toFormat(0).toString())
    );
    printFormattedOutput(global.startTime, raw_res);
  }
}
