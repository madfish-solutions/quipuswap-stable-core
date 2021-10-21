import config from "../config.json";
const fs = require("fs");
const accounts = config.sandbox.accounts;
import BigNumber from "bignumber.js";
import storage from "./storage/Dex";
import uUSDstorage from "./helpers/tokens/uUSD_storage";
import USDtzstorage from "./helpers/tokens/USDtz_storage";
import kUSDstorage from "./helpers/tokens/kUSD_storage";
import dex_contract from "../build/Dex.ligo.json";
const kUSD_contract = fs
  .readFileSync("./test/helpers/tokens/kUSD.tz")
  .toString();
const USDtz_contract = fs
  .readFileSync("./test/helpers/tokens/USDtz.tz")
  .toString();
const uUSD_contract = fs
  .readFileSync("./test/helpers/tokens/uUSD.tz")
  .toString();
import { Dex } from "./helpers/dexFA2";
import {
  prepareProviderOptions,
  AccountsLiteral,
  Tezos,
} from "./helpers/utils";
import { FeeType } from "./helpers/types";
import { TokenFA12 } from "./helpers/tokenFA12";
import { TokenFA2 } from "./helpers/tokenFA2";
import { confirmOperation } from "./helpers/confirmation";
import { TezosToolkit } from "@taquito/taquito";

describe("Dex", () => {
  let dex: Dex;
  const aliceAddress: string = accounts.alice.pkh;
  const bobAddress: string = accounts.bob.pkh;
  const eveAddress: string = accounts.eve.pkh;

  // Contract will be deployed before every single test, to make sure we
  // do a proper unit test in a stateless testing process

  beforeAll(async () => {
    let config = await prepareProviderOptions("alice");
    Tezos.setProvider(config);
    storage.storage.admin = aliceAddress;
    storage.storage.default_referral = aliceAddress;
    storage.storage.dev_address = eveAddress;
    const dex_op = await Tezos.contract.originate({
      code: JSON.parse(dex_contract.michelson),
      storage: storage,
    });
    await confirmOperation(Tezos, dex_op.hash);
    dex = await Dex.init(dex_op.contractAddress);
  });
  async function failCase(
    sender: AccountsLiteral,
    act: Promise<unknown> | (() => Promise<unknown>),
    errorMsg: string
  ) {
    let config = await prepareProviderOptions(sender);
    Tezos.setProvider(config);
    expect.assertions(1);
    return await expect(act).rejects.toMatchObject({
      message: errorMsg,
    });
  }

  describe("1. Testing Admin endpoints", () => {
    async function setAdminSuccessCase(sender: AccountsLiteral, admin: string) {
      let config = await prepareProviderOptions(sender);
      Tezos.setProvider(config);
      await dex.updateStorage({});
      const initAdmin = dex.storage.storage.admin;
      const sender_address = await Tezos.signer.publicKeyHash();
      expect(sender_address).toStrictEqual(initAdmin);
      await dex.setAdmin(admin);
      await dex.updateStorage({});
      const updatedAdmin = dex.storage.storage.admin;
      expect(admin).toStrictEqual(updatedAdmin);
      expect(admin).not.toStrictEqual(initAdmin);
      return true;
    }

    async function updateManagersSuccessCase(sender, manager, add) {
      let config = await prepareProviderOptions(sender);
      Tezos.setProvider(config);
      await dex.updateStorage({});
      const initManagers = dex.storage.storage.managers;
      await dex.addRemManager(add, manager);
      await dex.updateStorage({});
      const updatedManagers = dex.storage.storage.managers;
      expect(updatedManagers.includes(manager)).toBe(add);
      return true;
    }

    async function setDevAddrSuccessCase(sender: AccountsLiteral, dev: string) {
      let config = await prepareProviderOptions(sender);
      Tezos.setProvider(config);
      await dex.updateStorage({});
      const initDev = dex.storage.storage.dev_address;

      await dex.setDevAddress(dev);
      await dex.updateStorage({});
      const updatedDev = dex.storage.storage.dev_address;
      expect(dev).toEqual(updatedDev);
      return true;
    }
    describe("1.1. Test setting new admin", () => {
      it("1.1.1. should fail if not admin try to set admin", async () =>
        await failCase(
          "bob",
          async () => await dex.setAdmin(eveAddress),
          "Dex/not-contact-admin"
        ));
      it("1.1.2. should change admin", async () =>
        await setAdminSuccessCase("alice", eveAddress));
    });

    describe("1.2. Test setting new dev_address", () => {
      it("1.2.1. should fail if not admin try to set dev_address", async () =>
        await failCase(
          "bob",
          async () => dex.setDevAddress(eveAddress),
          "Dex/not-contact-admin"
        ));
      it("1.2.2. should change dev address", async () =>
        await setDevAddrSuccessCase("eve", aliceAddress));
    });

    // describe("Test setting new fees", () => {
    //   const fees: FeeType = {
    //     lp_fee: new BigNumber("1000000"),
    //     stakers_fee: new BigNumber("1000000"),
    //     ref_fee: new BigNumber("1000000"),
    //     dev_fee: new BigNumber("1000000"),
    //   };
    //   failCase(
    //     "should fail if not admin try to set fees",
    //     "bob",
    //     async () => dex.setFees(new BigNumber("0"), fees),
    //     "Dex/not-contact-admin"
    //   );
    //   setFeesSuccessCase("should change fees", "alice", new BigNumber("0"), fees);
    // });

    describe("1.3. Test setting managers", () => {
      it("1.3.1. should fail if not admin try set manager", async () =>
        await failCase(
          "bob",
          async () => dex.addRemManager(true, aliceAddress),
          "Dex/not-contact-admin"
        ));
      it("1.3.2. should set new manager", async () =>
        await updateManagersSuccessCase("eve", aliceAddress, true));
      it("1.3.3. should remove manager", async () =>
        await updateManagersSuccessCase("eve", aliceAddress, false));
    });
  });

  describe("2. Testing Pools endpoints", () => {
    type TokensMap = {
      kUSD: TokenFA12;
      USDtz: TokenFA12;
      uUSD: TokenFA2;
    };

    let tokens: TokensMap;

    async function setupTrioTokens(tezos: TezosToolkit): Promise<TokensMap> {
      let result: any = {};
      const kUSD = await tezos.contract.originate({
        code: kUSD_contract,
        storage: kUSDstorage,
      });
      await confirmOperation(tezos, kUSD.hash);
      result.kUSD = await TokenFA12.init(kUSD.contractAddress);
      const USDtz = await tezos.contract.originate({
        code: USDtz_contract,
        storage: USDtzstorage,
      });
      await confirmOperation(tezos, USDtz.hash);
      result.USDtz = await TokenFA12.init(USDtz.contractAddress);
      const uUSD = await tezos.contract.originate({
        code: uUSD_contract,
        storage: uUSDstorage,
      });
      await confirmOperation(tezos, uUSD.hash);
      result.uUSD = await TokenFA2.init(uUSD.contractAddress);
      return result as TokensMap;
    }

    beforeAll(async () => {
      tokens = await setupTrioTokens(Tezos);
    });
    async function addNewPair(
      sender: AccountsLiteral,
      a_const: BigNumber = new BigNumber("100000"),
      tokens_count: BigNumber = new BigNumber("3"),
      inputs: {
        asset: TokenFA12 | TokenFA2;
        in_amount: BigNumber;
        rate: BigNumber;
      }[],
      approve: boolean = true
    ) {
      let config = await prepareProviderOptions(sender);
      Tezos.setProvider(config);
      await dex.updateStorage({});
      expect(await Tezos.signer.publicKeyHash()).toEqual(dex.storage.storage.admin);
      const initPairCount = new BigNumber(dex.storage.storage.pools_count);
      await dex.initializeExchange(a_const, tokens_count, inputs, approve);
      await dex.updateStorage({});
      const updatedPairCount = new BigNumber(dex.storage.storage.pools_count);
      expect(initPairCount.toNumber() + 1).toEqual(updatedPairCount.toNumber());
      return true;
    }

    // function investLiquidity(decription, sender, pool_id, params) {
    //   test(decription, async function () {
    //     let config = await prepareProviderOptions(sender);
    //     await global.Tezos.setProvider(config);
    //     await dex.updateStorage({});
    //     console.log(config);
    //     console.log(global.Tezos);
    //     const initLPBalance = new BigNumber(dex.storage.storage.pools[pool_id].total_supply);

    //     await dex.addLiqidity(pair_id, manager);
    //     await dex.updateStorage({});
    //     const updatedManagers = dex.storage.storage.managers;
    //     expect(updatedManagers.includes(manager)).toBe(add);
    //   });
    // }

    async function setFeesSuccessCase(
      sender: AccountsLiteral,
      pool_id: BigNumber,
      fees: FeeType
    ) {
      let config = await prepareProviderOptions(sender);
      Tezos.setProvider(config);
      await dex.updateStorage({ pools: [pool_id.toString()] });
      const initStorage = (await dex.contract.storage()) as any;
      const initFee = (await initStorage.storage.pools.get(pool_id))
        .fee as FeeType;
      await dex.setFees(pool_id, fees);
      await dex.updateStorage({ pools: [pool_id.toString()] });
      const updStorage = (await dex.contract.storage()) as any;
      const updatedFees = (await updStorage.storage.pools.get(pool_id))
        .fee as FeeType;
      for (let i in updatedFees) {
        expect(updatedFees[i].toNumber()).toEqual(fees[i].toNumber());
      }
      expect(updatedFees.lp_fee.toNumber()).toEqual(fees.lp_fee.toNumber());
      expect(updatedFees.stakers_fee.toNumber()).toEqual(
        fees.stakers_fee.toNumber()
      );
      expect(updatedFees.ref_fee.toNumber()).toEqual(fees.ref_fee.toNumber());
      expect(updatedFees.dev_fee.toNumber()).toEqual(fees.dev_fee.toNumber());
      return true;
    }
    describe("2.1. Test adding new pool", () => {
      let inputs;
      const a_const = new BigNumber("100000");
      let tokens_count: BigNumber;
      beforeAll(async () => {
        inputs = [
          {
            asset: tokens.kUSD,
            in_amount: new BigNumber(10).pow(18 + 6),
            rate: new BigNumber(10).pow(18 - 18),
          },
          {
            asset: tokens.USDtz,
            in_amount: new BigNumber(10).pow(6 + 6),
            rate: new BigNumber(10).pow(18 - 6),
          },
          {
            asset: tokens.uUSD,
            in_amount: new BigNumber(10).pow(12 + 6),
            rate: new BigNumber(10).pow(18 - 12),
          },
        ];
        inputs = inputs.sort((a, b) => {
          if (a.asset instanceof TokenFA2 && b.asset instanceof TokenFA12)
            return -1;
          else if (b.asset instanceof TokenFA2 && a.asset instanceof TokenFA12)
            return 1;
          else if (a.asset.contract.address < b.asset.contract.address)
            return 1;
          else if (a.asset.contract.address > b.asset.contract.address)
            return -1;
          else 0;
        });
        tokens_count = new BigNumber(inputs.length);
      });
      it("2.1.1. should fail if not admin try to add pool", async () =>
        await failCase(
          "bob",
          async () =>
            await dex.initializeExchange(a_const, tokens_count, inputs, true),
          "Dex/not-contact-admin"
        ));
      it("2.1.2. should add new pool", async () =>
        await addNewPair("eve", a_const, tokens_count, inputs, true));
    });

    describe("2.2. Test setting new fees", () => {
      const fees: FeeType = {
        lp_fee: new BigNumber("1000000"),
        stakers_fee: new BigNumber("1000000"),
        ref_fee: new BigNumber("1000000"),
        dev_fee: new BigNumber("1000000"),
      };
      it("2.2.1. should fail if not admin try to set new fee", async () =>
        await failCase(
          "bob",
          async () => await dex.setFees(new BigNumber("0"), fees),
          "Dex/not-contact-admin"
        ));
      it("2.2.2. should change fees", async () =>
        await setFeesSuccessCase("eve", new BigNumber("0"), fees));
    });
  });

  it.todo("3. it should be views here");
});
