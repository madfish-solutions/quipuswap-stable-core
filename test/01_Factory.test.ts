import BigNumber from "bignumber.js";

import {
  AccountsLiteral,
  FA12TokenType,
  FA2TokenType,
  failCase,
  prepareProviderOptions,
  Tezos,
  TezosAddress,
} from "../utils/helpers";
import {
  accounts,
  a_const,
  decimals,
  dev_fee,
  swap_routes,
} from "../utils/constants";
import { DexFactoryAPI as DexFactory } from "./Factory/API";
import { defaultTokenId, TokenFA12, TokenFA2 } from "./Token";
import { cases } from "./Factory";
import { AmountsMap, IndexMap, TokensMap } from "./utils/types";
import {
  approveAllTokens,
  setupTokenAmounts,
  setupTrioTokens,
} from "./utils/tokensSetups";
import { manageInputs } from "./Dex/cases/pool_part/add";
import { MichelsonMap } from "@taquito/taquito";
import { DexAPI as Dex } from "./Dex/API";
import { cases as dex_case } from "./Dex";

describe("01. Dex Factory", () => {
  const tezos = Tezos;
  const developer_name: AccountsLiteral = "alice";
  const developer_address: TezosAddress = accounts[developer_name].pkh;
  let factory: DexFactory;
  let lambda: TezosAddress;
  let quipuToken: TokenFA2;

  beforeAll(
    async () =>
      ({
        factory,
        quipuToken,
        lambdaContractAddress: lambda,
      } = await cases.before.setupFactoryEnvironment(tezos, developer_name))
  );

  describe("1. Fee", () => {
    it(
      "should fail if not dev try to set fee",
      async () =>
        await failCase(
          "bob",
          async () => await factory.setDevFee(dev_fee, tezos),
          "not-developer"
        ),
      10000
    );

    it(
      "should fail if dev try to set fee with overflow",
      async () =>
        await failCase(
          developer_name,
          async () =>
            await factory.setDevFee(new BigNumber("100000000000"), tezos),
          "fee-overflow"
        ),
      10000
    );

    it("should set dev fee", async () =>
      await cases.dev.setDevFeeSuccessCase(
        factory,
        developer_name,
        dev_fee,
        tezos
      ));
  });

  describe("2. Pool tests", () => {
    const norm_input = new BigNumber(10).pow(6);
    let tokens: TokensMap;
    let inputs;
    let dex: Dex;
    const pool_id = new BigNumber("0");
    const normalized = new BigNumber(10).pow(3);

    beforeAll(async () => {
      tokens = await setupTrioTokens(factory, tezos, false);
      inputs = await manageInputs(norm_input, tokens);
    });

    it("should deploy pool", async () =>
      (dex = await cases.initPool.initializeExchangeSuccessCase(
        factory,
        "bob",
        a_const,
        norm_input,
        inputs,
        accounts.bob.pkh,
        [],
        new MichelsonMap(),
        new MichelsonMap(),
        new BigNumber("2592000"),
        true,
        quipuToken,
        tezos,
        lambda
      )));

    // eslint-disable-next-line jest/prefer-expect-assertions
    it("should return pool address by set of tokens", async () => {
      expect(dex).not.toBeNull();
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
        .get_pool(tokens)
        .executeView({ viewCaller: developer_address });
      expect(dex.contract.address).toStrictEqual(dex_address);
    });

    it("should add manager", async () =>
      await dex_case.admin.updateManagersSuccessCase(
        dex,
        "bob",
        accounts.eve.pkh,
        true,
        tezos
      ));

    it("pool admin should change fees", async () =>
      await dex_case.pools.PoolAdmin.Fee.setFeesSuccessCase(
        dex,
        "bob",
        pool_id,
        dex_case.pools.PoolAdmin.Fee.fees,
        Tezos
      ));

    describe("pool use", () => {
      beforeAll(async () => {
        await approveAllTokens(dex, tokens, Tezos);
      });

      describe("invest", () => {
        let amounts: Map<string, BigNumber>;
        const inputs_amounts: AmountsMap = {
          kUSD: decimals.kUSD.multipliedBy(normalized),
          uUSD: decimals.uUSD.multipliedBy(normalized),
          USDtz: decimals.USDtz.multipliedBy(normalized),
        };

        beforeAll(async () => {
          const res = await setupTokenAmounts(dex, tokens, inputs_amounts);
          amounts = res.amounts;
        });

        it("should invest", async () =>
          await dex_case.pools.PoolInvest.investLiquiditySuccessCase(
            dex,
            "eve",
            pool_id,
            accounts.bob.pkh,
            new BigNumber(1),
            amounts,
            new Date(Date.now() + 1000 * 60 * 60 * 24),
            Tezos
          ));
      });

      describe("swap", () => {
        let amounts: Map<string, BigNumber>;
        const norm_in = new BigNumber(10).pow(2);
        let idx_map: IndexMap;
        const inputs_amounts: AmountsMap = {
          kUSD: decimals.kUSD.multipliedBy(norm_in),
          uUSD: decimals.uUSD.multipliedBy(norm_in),
          USDtz: decimals.USDtz.multipliedBy(norm_in),
        };

        beforeAll(async () => {
          const res = await dex_case.pools.PoolSwap.setupTokenMapping(
            dex,
            tokens,
            inputs_amounts
          );
          amounts = res.amounts;
          idx_map = res.idx_map;
        });

        it.each(swap_routes)(
          `should swap %s ~> %s`,
          async (t_in, t_to) =>
            await dex_case.pools.PoolSwap.swapSuccessCase(
              dex,
              tokens,
              "eve",
              pool_id,
              t_in,
              t_to,
              new Date(Date.now() + 1000 * 60 * 60 * 24),
              null,
              idx_map,
              new BigNumber(10).pow(2),
              amounts,
              lambda,
              Tezos
            ),
          40000
        );
      });

      describe("divest", () => {
        const outputs: AmountsMap = {
          kUSD: decimals.kUSD.multipliedBy(normalized),
          uUSD: decimals.uUSD.multipliedBy(normalized),
          USDtz: decimals.USDtz.multipliedBy(normalized),
        };
        const amount_in = new BigNumber(10)
          .pow(18)
          .multipliedBy(normalized)
          .multipliedBy(3); // 3K LP tokens
        let min_amounts;

        beforeAll(async () => {
          const res = await dex_case.pools.PoolDivest.setupMinTokenMapping(
            dex,
            tokens,
            outputs
          );
          min_amounts = res.min_amounts;
        });

        it("should divest", async () =>
          await dex_case.pools.PoolDivest.divestLiquiditySuccessCase(
            dex,
            "eve",
            pool_id,
            amount_in,
            min_amounts,
            new Date(Date.now() + 1000 * 60 * 60 * 24),
            Tezos
          ));
      });
    });

    it("should change default referral", async () =>
      await dex_case.admin.setDefaultRefSuccessCase(
        dex,
        "bob",
        accounts.eve.pkh,
        tezos
      ));

    describe("claim", () => {
      it("should claim dev rewards from pool", async () =>
        await cases.rewards.getDeveloperRewardsDexSuccessCase(
          dex,
          tokens,
          pool_id,
          developer_name,
          lambda,
          Tezos
        ));
    });
  });

  describe("3. Rewards", () => {
    it(
      "should fail if not dev try to claim rewards",
      async () =>
        await failCase(
          "bob",
          async () => await factory.claimRewards(tezos),
          "not-developer"
        ),
      10000
    );

    it("should claim dev rewards", async () =>
      await cases.rewards.claimRewardsSuccessCase(
        factory,
        developer_name,
        tezos
      ));
  });

  describe("4. Whitelist", () => {
    const norm_input = new BigNumber(10).pow(6);
    let tokens: TokensMap;
    let inputs;

    beforeAll(async () => {
      tokens = await setupTrioTokens(factory, tezos, false);
      inputs = await manageInputs(norm_input, tokens);
    });

    it(
      "should fail if not dev try to manipulate whitelist",
      async () =>
        await failCase(
          "bob",
          async () =>
            await factory.addRemWhitelist(true, accounts["bob"].pkh, tezos),
          "not-developer"
        ),
      10000
    );

    it("should add to whitelist", async () =>
      await cases.whitelist.updateWhitelistSuccessCase(
        factory,
        developer_name,
        accounts["eve"].pkh,
        true,
        tezos
      ));

    // eslint-disable-next-line jest/prefer-expect-assertions
    it("should deploy without QUIPU token fees", async () => {
      const init_balance: BigNumber = await quipuToken.contract.views
        .balance_of([{ owner: accounts.eve.pkh, token_id: "0" }])
        .read(lambda);

      await cases.initPool.initializeExchangeSuccessCase(
        factory,
        "eve",
        a_const,
        norm_input,
        inputs,
        accounts.bob.pkh,
        [],
        new MichelsonMap(),
        new MichelsonMap(),
        new BigNumber("2592000"),
        true,
        quipuToken,
        tezos,
        lambda
      );

      const upd_balance: BigNumber = await quipuToken.contract.views
        .balance_of([{ owner: accounts.eve.pkh, token_id: "0" }])
        .read(lambda);
      expect(init_balance[0].balance.toNumber()).toStrictEqual(
        upd_balance[0].balance.toNumber()
      );
    });

    it("should remove from whitelist", async () =>
      await cases.whitelist.updateWhitelistSuccessCase(
        factory,
        developer_name,
        accounts["eve"].pkh,
        false,
        tezos
      ));
  });

  describe("5. Init price", () => {
    const initial_price = new BigNumber("100000");
    const norm_input = new BigNumber(10).pow(6);
    let tokens: TokensMap;
    let inputs;

    beforeAll(async () => {
      tokens = await setupTrioTokens(factory, tezos, false);
      inputs = await manageInputs(norm_input, tokens);
    });

    it(
      "should fail if not dev try to set init price",
      async () =>
        await failCase(
          "bob",
          async () => await factory.setInitPrice(initial_price, tezos),
          "not-developer"
        ),
      10000
    );

    it("should set other price", async () =>
      await cases.rates.setInitPriceSuccessCase(
        factory,
        developer_name,
        initial_price,
        tezos
      ));

    it("should deploy with other price", async () =>
      await cases.initPool.initializeExchangeSuccessCase(
        factory,
        "eve",
        a_const,
        norm_input,
        inputs,
        accounts.bob.pkh,
        [],
        new MichelsonMap(),
        new MichelsonMap(),
        new BigNumber("2592000"),
        true,
        quipuToken,
        tezos,
        lambda
      ));
  });

  describe("5. Burn rate", () => {
    const burn_rate = new BigNumber("10")
      .div("100") // 10%
      .multipliedBy("1000000");
    const norm_input = new BigNumber(10).pow(6);
    let tokens: TokensMap;
    let inputs;

    beforeAll(async () => {
      tokens = await setupTrioTokens(factory, tezos, false);
      inputs = await manageInputs(norm_input, tokens);
    });

    it(
      "should fail if not dev try to set burn rate",
      async () =>
        await failCase(
          "bob",
          async () => await factory.setBurnRate(burn_rate, tezos),
          "not-developer"
        ),
      10000
    );

    it("should set different burn rate", async () =>
      await cases.rates.setBurnRateSuccessCase(
        factory,
        developer_name,
        burn_rate,
        tezos
      ));

    it("should deploy with different burn rate", async () =>
      await cases.initPool.initializeExchangeSuccessCase(
        factory,
        "eve",
        a_const,
        norm_input,
        inputs,
        accounts.bob.pkh,
        [],
        new MichelsonMap(),
        new MichelsonMap(),
        new BigNumber("2592000"),
        true,
        quipuToken,
        tezos,
        lambda
      ));
  });

  describe("7. Change developer", () => {
    const new_dev_name = "eve";
    const new_dev_address = accounts[new_dev_name].pkh;

    it(
      "should fail if not dev try to set dev address",
      async () =>
        await failCase(
          "bob",
          async () => await factory.setDevAddress(accounts["bob"].pkh, tezos),
          "not-developer"
        ),
      10000
    );

    it("should set dev address", async () =>
      await cases.dev.setDevAddrSuccessCase(
        factory,
        developer_name,
        new_dev_address,
        tezos
      ));
  });
});
