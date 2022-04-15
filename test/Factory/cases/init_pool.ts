import {
  AccountsLiteral,
  FA12TokenType,
  FA2TokenType,
  prepareProviderOptions,
  TezosAddress,
} from "../../../utils/helpers";
import { DexFactory } from "../API/factoryAPI";
import BigNumber from "bignumber.js";
import { TokenFA12, TokenFA2 } from "../../Token";
import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { defaultTokenId } from "../../Token/token";
import { Dex } from "../../Dex/API/dexAPI";
import chalk from "chalk";
import { FeeType } from "../../Dex/API/types";
export async function initializeExchangeSuccessCase(
  factory: DexFactory,
  sender: AccountsLiteral,
  a_const: BigNumber = new BigNumber("1000000"),
  exp_input: BigNumber,
  inputs: {
    asset: TokenFA12 | TokenFA2;
    in_amount: BigNumber;
    rate_f: BigNumber;
    precision_multiplier_f: BigNumber;
  }[],
  default_referral: TezosAddress,
  managers = [],
  fees: FeeType = {
    lp_f: new BigNumber("0"),
    stakers_f: new BigNumber("0"),
    ref_f: new BigNumber("0"),
  },
  approve = false,
  quipuToken: TokenFA2,
  tezos: TezosToolkit,
  lambda: TezosAddress
) {
  const config = await prepareProviderOptions(sender);
  tezos.setProvider(config);
  const sender_addr = await tezos.signer.publicKeyHash();

  const init_balance = await quipuToken.contract.views
    .balance_of([{ owner: sender_addr, token_id: "0" }])
    .read(lambda);

  await factory.updateStorage({});
  const init_rew: BigNumber = factory.storage.storage.quipu_rewards;
  const price = factory.storage.storage.whitelist.includes(sender_addr)
    ? new BigNumber(0)
    : factory.storage.storage.init_price;
  const initPairCount = new BigNumber(factory.storage.storage.pools_count);

  expect(init_balance[0].balance.toNumber()).toBeGreaterThanOrEqual(
    price.toNumber()
  );

  if (approve)
    await quipuToken.approve(
      factory.contract.address,
      factory.storage.storage.init_price
    );
  await factory.addPool(
    tezos,
    inputs,
    default_referral,
    a_const,
    managers,
    fees,
    approve
  );
  await factory.updateStorage({});
  const upd_balance: BigNumber = await quipuToken.contract.views
    .balance_of([{ owner: sender_addr, token_id: "0" }])
    .read(lambda);
  const upd_rew: BigNumber = factory.storage.storage.quipu_rewards;

  expect(init_balance[0].balance.minus(price).toNumber()).toStrictEqual(
    upd_balance[0].balance.toNumber()
  );

  expect(upd_rew.minus(init_rew).toNumber()).toStrictEqual(
    price
      .minus(
        price.multipliedBy(
          factory.storage.storage.burn_rate_f.dividedBy("1000000")
        )
      )
      .toNumber()
  );
  const tokens: Array<FA2TokenType | FA12TokenType> = inputs.map((value) =>
    value.asset instanceof TokenFA12
      ? ({ fa12: value.asset.contract.address } as FA12TokenType)
      : ({
          fa2: {
            token_address: value.asset.contract.address,
            token_id: new BigNumber(defaultTokenId),
          },
        } as FA2TokenType)
  );
  const dex_address: TezosAddress = await factory.contract.contractViews
    .get_pool({ tokens: tokens, deployer: sender_addr })
    .executeView({ viewCaller: sender_addr });
  console.log(`DEX is ${chalk.green("ONLINE")}: ${dex_address}`);
  const dex = await Dex.init(tezos, dex_address, true);
  await dex.updateStorage({
    pools: [(0).toString()],
    ledger: [[sender_addr, 0]],
  });
  const updatedPairCount = new BigNumber(factory.storage.storage.pools_count);
  expect(initPairCount.toNumber() + 1).toStrictEqual(
    updatedPairCount.toNumber()
  );
  const updatedSenderBalance: BigNumber =
    dex.storage.storage.ledger[sender_addr];
  expect(updatedSenderBalance.toNumber()).toStrictEqual(
    new BigNumber(10)
      .pow(18)
      .multipliedBy(exp_input)
      .multipliedBy(inputs.length)
      .toNumber()
  );
  return dex;
}
