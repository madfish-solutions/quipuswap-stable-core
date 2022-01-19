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
import { accounts, a_const, dev_fee } from "../utils/constants";
import { DexFactoryAPI as DexFactory } from "./Factory/API";
import { defaultTokenId, TokenFA12, TokenFA2 } from "./Token";
import { cases } from "./Factory";
import { TokensMap } from "./utils/types";
import { setupTrioTokens } from "./utils/tokensSetups";
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
          async () => factory.setDevFee(dev_fee, tezos),
          "not-developer"
        ),
      10000
    );

    it(
      "should fail if dev try to set fee with overflow",
      async () =>
        await failCase(
          developer_name,
          async () => factory.setDevFee(new BigNumber("100000000000"), tezos),
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

    it("pool admin should change fees", async () =>
      dex_case.pools.PoolAdmin.Fee.setFeesSuccessCase(
        dex,
        "bob",
        pool_id,
        dex_case.pools.PoolAdmin.Fee.fees,
        Tezos
      ));

    it("pool admin should ramp A", async () =>
      await prepareProviderOptions("bob").then((config) => {
        expect(dex).not.toBeNull();
        Tezos.setProvider(config);
        return dex_case.pools.PoolAdmin.Ramp_A.rampASuccessCase(
          dex,
          pool_id,
          dex_case.pools.PoolAdmin.Ramp_A.future_a_const,
          dex_case.pools.PoolAdmin.Ramp_A.future_a_time
        );
      }));

    it("pool admin should stop ramp A", async () =>
      await prepareProviderOptions("bob").then((config) => {
        expect(dex).not.toBeNull();
        Tezos.setProvider(config);
        return dex_case.pools.PoolAdmin.Ramp_A.stopRampASuccessCase(
          dex,
          pool_id
        );
      }));

    it.todo("should swap");

    it.todo("should invest");

    it.todo("should divest");

    it("should claim dev rewards from pool", async () =>
      await prepareProviderOptions("bob").then((config) => {
        Tezos.setProvider(config);
        return dex_case.rewards.developer.getDeveloperRewardsSuccessCase(
          dex,
          tokens,
          pool_id,
          5,
          developer_address,
          lambda,
          Tezos
        );
      }));
  });

  describe("3. Rewards", () => {
    it(
      "should fail if not dev try to claim rewards",
      async () =>
        await failCase(
          "bob",
          async () => factory.claimRewards(tezos),
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
          async () => factory.addRemWhitelist(true, accounts["bob"].pkh, tezos),
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

    it(
      "should fail if not dev try to set init price",
      async () =>
        await failCase(
          "bob",
          async () => factory.setInitPrice(initial_price, tezos),
          "not-developer"
        ),
      10000
    );

    it.todo("should set other price");

    // eslint-disable-next-line jest/prefer-expect-assertions
    it.todo("should deploy with other price", async () => {
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
  });

  describe("5. Burn rate", () => {
    const burn_rate = new BigNumber("10")
      .div("100") // 10%
      .multipliedBy("1000000");

    it(
      "should fail if not dev try to set burn rate",
      async () =>
        await failCase(
          "bob",
          async () => factory.setBurnRate(burn_rate, tezos),
          "not-developer"
        ),
      10000
    );

    it.todo("should set different burn rate");

    it.todo("should deploy with different burn rate");
  });

  describe("7. Change developer", () => {
    const new_dev_name = "eve";
    const new_dev_address = accounts[new_dev_name].pkh;

    it(
      "should fail if not dev try to set dev address",
      async () =>
        await failCase(
          "bob",
          async () => factory.setDevAddress(accounts["bob"].pkh, tezos),
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
