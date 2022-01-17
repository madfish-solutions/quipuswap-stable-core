import BigNumber from "bignumber.js";

import {
  failCase,
  prepareProviderOptions,
  Tezos,
  TezosAddress,
} from "../utils/helpers";
import { accounts } from "../utils/constants";
import { DexFactory } from "./Factory/API/factoryAPI";
import { TokenFA2 } from "./Token";
import { cases } from "./Factory";

describe("01. Dex Factory", () => {
  const developer_name = "alice";
  const developer_address = accounts[developer_name].pkh;
  const tezos = Tezos;
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
          async () => factory.setDevFee(new BigNumber("1000"), tezos),
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

    it.todo("should set dev fee");
  });

  describe("2. Pool tests", () => {
    it.todo("should deploy pool");

    it.todo("should return pool address by set of tokens");

    it.todo("pool admin should change fees");

    it.todo("pool admin should ramp A");

    it.todo("pool admin should stop ramp A");

    it.todo("should swap");

    it.todo("should invest");

    it.todo("should divest");
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

    it.todo("should claim dev rewards");

    it.todo("should claim dev rewards from pool");
  });

  describe("4. Whitelist", () => {
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

    it.todo("should add to whitelist");

    it.todo("should deploy without QUIPU token fees");

    it.todo("should remove from whitelist");
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

    it.todo("should deploy with other price");
  });

  describe("6. Burn rate", () => {
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

    it.todo("should set dev address");
  });
});
