import BigNumber from "bignumber.js";
import {
  ContractAbstraction,
  ContractProvider,
  MichelsonMap,
  VIEW_LAMBDA,
} from "@taquito/taquito";
import expect from "expect";
import dex_contract from "../build/Dex.ligo.json";
import config from "../config.json";
import { failCase } from "./fail-test";
import { confirmOperation } from "./helpers/confirmation";
import { Dex } from "./helpers/dexFA2";
import { TokenFA12 } from "./helpers/tokenFA12";
import { defaultTokenId, TokenFA2 } from "./helpers/tokenFA2";
import kUSDstorage from "./helpers/tokens/kUSD_storage";
import uUSDstorage from "./helpers/tokens/uUSD_storage";
import USDtzstorage from "./helpers/tokens/USDtz_storage";
import { FA12TokenType, FA2TokenType, FeeType } from "./helpers/types";
import {
  prepareProviderOptions,
  AccountsLiteral,
  Tezos,
  setupLambdasToStorage,
} from "./helpers/utils";
import storage from "./storage/Dex";
import { intervalToDuration, formatDuration } from "date-fns";

import dex_lambdas_comp from "../build/lambdas/Dex_lambdas.json";
import token_lambdas_comp from "../build/lambdas/Token_lambdas.json";

const fs = require("fs");
const accounts = config.sandbox.accounts;

const uUSD_contract = fs
  .readFileSync("./test/helpers/tokens/uUSD.tz")
  .toString();
const USDtz_contract = fs
  .readFileSync("./test/helpers/tokens/USDtz.tz")
  .toString();

const kUSD_contract = fs
  .readFileSync("./test/helpers/tokens/kUSD.tz")
  .toString();

describe("Dex", () => {
  const start: Date = new Date();

  function printFormattedOutput(...args: any[]) {
    const date_now = new Date();
    const date_diff = formatDuration(
      intervalToDuration({
        start: start,
        end: date_now,
      })
    );
    return console.log(date_diff, ...args);
  }

  type TokensMap = {
    kUSD: TokenFA12;
    USDtz: TokenFA12;
    uUSD: TokenFA2;
  };

  const decimals = {
    kUSD: new BigNumber(10).pow(18),
    USDtz: new BigNumber(10).pow(6),
    uUSD: new BigNumber(10).pow(12),
  };

  let tokens: TokensMap;
  const swap_routes = [
    ["kUSD", "uUSD"],
    ["uUSD", "USDtz"],
    ["USDtz", "kUSD"],

    ["kUSD", "USDtz"],
    ["USDtz", "uUSD"],
    ["uUSD", "kUSD"],
  ];
  let dex: Dex;
  const aliceAddress: string = accounts.alice.pkh;
  const bobAddress: string = accounts.bob.pkh;
  const eveAddress: string = accounts.eve.pkh;
  let lambdaContract: ContractAbstraction<ContractProvider>;
  let lambdaContractAddress: string;

  // Contract will be deployed before every single test, to make sure we
  // do a proper unit test in a stateless testing process

  async function setupTrioTokens(): Promise<TokensMap> {
    printFormattedOutput("Setting up tokens");
    let result: any = {};
    const kUSD = await Tezos.contract.originate({
      code: kUSD_contract,
      storage: kUSDstorage,
    });
    await confirmOperation(Tezos, kUSD.hash);
    printFormattedOutput("kUSD");
    result.kUSD = await TokenFA12.init(Tezos, kUSD.contractAddress);
    await new Promise((r) => setTimeout(r, 2000));
    const USDtz = await Tezos.contract.originate({
      code: USDtz_contract,
      storage: USDtzstorage,
    });
    await confirmOperation(Tezos, USDtz.hash);
    printFormattedOutput("USDtz");
    result.USDtz = await TokenFA12.init(Tezos, USDtz.contractAddress);
    await new Promise((r) => setTimeout(r, 2000));
    const uUSD = await Tezos.contract.originate({
      code: uUSD_contract,
      storage: uUSDstorage,
    });
    await confirmOperation(Tezos, uUSD.hash);
    printFormattedOutput("uUSD");
    result.uUSD = await TokenFA2.init(Tezos, uUSD.contractAddress);
    await new Promise((r) => setTimeout(r, 2000));
    let config = await prepareProviderOptions("alice");
    Tezos.setProvider(config);
    await result.kUSD.approve(dex.contract.address, new BigNumber(10).pow(45));
    printFormattedOutput("alice kUSD approve");
    await new Promise((r) => setTimeout(r, 1000));
    await result.uUSD.approve(dex.contract.address, new BigNumber(10).pow(45));
    printFormattedOutput("alice uUSD approve");
    await new Promise((r) => setTimeout(r, 1000));
    await result.USDtz.approve(dex.contract.address, new BigNumber(10).pow(45));
    printFormattedOutput("alice USDtz approve");
    await new Promise((r) => setTimeout(r, 1000));
    config = await prepareProviderOptions("bob");
    Tezos.setProvider(config);
    await result.kUSD.approve(dex.contract.address, new BigNumber(10).pow(45));
    printFormattedOutput("bob kUSD approve");
    await new Promise((r) => setTimeout(r, 1000));
    await result.uUSD.approve(dex.contract.address, new BigNumber(10).pow(45));
    printFormattedOutput("bob uUSD approve");
    await new Promise((r) => setTimeout(r, 1000));
    await result.USDtz.approve(dex.contract.address, new BigNumber(10).pow(45));
    printFormattedOutput("bob USDtz approve");
    await new Promise((r) => setTimeout(r, 1000));
    config = await prepareProviderOptions("eve");
    Tezos.setProvider(config);
    await result.kUSD.approve(dex.contract.address, new BigNumber(10).pow(45));
    printFormattedOutput("eve kUSD approve");
    await new Promise((r) => setTimeout(r, 1000));
    await result.uUSD.approve(dex.contract.address, new BigNumber(10).pow(45));
    printFormattedOutput("eve uUSD approve");
    await new Promise((r) => setTimeout(r, 1000));
    await result.USDtz.approve(dex.contract.address, new BigNumber(10).pow(45));
    printFormattedOutput("eve USDtz approve");
    return result as TokensMap;
  }

  async function setupTokenAmounts(
    dex: Dex,
    USDtzAmount: BigNumber,
    kUSDAmount: BigNumber,
    uUSDAmount: BigNumber
  ): Promise<{ pool_id: BigNumber; amounts: Map<string, BigNumber> }> {
    let amounts = new Map<string, BigNumber>();
    await dex.updateStorage({});
    const pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
    await dex.updateStorage({ tokens: [pool_id.toString()] });
    const tokens_map = dex.storage.storage.tokens[
      pool_id.toNumber()
    ] as any as Map<string, FA2TokenType | FA12TokenType>;
    for (let [k, v] of tokens_map.entries()) {
      let token: FA2TokenType | FA12TokenType = v as FA2TokenType;
      let contract_address: string;
      if (token.fa2) {
        contract_address = token.fa2.token_address;
      } else {
        token = v as FA12TokenType;
        contract_address = token.fa12;
      }
      if (contract_address) {
        let input_amount = new BigNumber("0");
        if (contract_address == tokens.USDtz.contract.address) {
          // await tokens.USDtz.approve(dex.contract.address, zero_amount);
          input_amount = USDtzAmount;
          // if (!input_amount.isEqualTo(zero_amount))
          //   await tokens.USDtz.approve(dex.contract.address, input_amount);
          // printFormattedOutput('USDtz', input_amount.toFormat());
        } else if (contract_address == tokens.kUSD.contract.address) {
          // await tokens.kUSD.approve(dex.contract.address, zero_amount);
          input_amount = kUSDAmount;
          // if (!input_amount.isEqualTo(zero_amount))
          //   await tokens.kUSD.approve(dex.contract.address, input_amount);
          // printFormattedOutput("kUSD", input_amount.toFormat());
        } else if (contract_address == tokens.uUSD.contract.address) {
          input_amount = uUSDAmount;
          // await tokens.uUSD.approve(dex.contract.address, input_amount);
          // printFormattedOutput("uUSD", input_amount.toFormat());
        }
        amounts.set(k, input_amount);
      }
    }
    return { pool_id, amounts };
  }

  beforeAll(async () => {
    let config = await prepareProviderOptions("alice");
    Tezos.setProvider(config);
    const op = await Tezos.contract.originate({
      code: VIEW_LAMBDA.code,
      storage: VIEW_LAMBDA.storage,
    });
    await confirmOperation(Tezos, op.hash);
    printFormattedOutput("Lambda view set");
    lambdaContractAddress = op.contractAddress;
    lambdaContract = await Tezos.contract.at(lambdaContractAddress);
    storage.storage.admin = aliceAddress;
    storage.storage.default_referral = aliceAddress;
    storage.storage.dev_address = eveAddress;
    // storage.dex_lambdas = await setupLambdasToStorage(dex_lambdas_comp);
    storage.token_lambdas = await setupLambdasToStorage(token_lambdas_comp);
    const dex_op = await Tezos.contract.originate({
      code: JSON.parse(dex_contract.michelson),
      storage: storage,
    });
    printFormattedOutput("DEX op hash", dex_op.hash);
    await confirmOperation(Tezos, dex_op.hash);
    printFormattedOutput("DEX", dex_op.contractAddress);
    dex = await Dex.init(Tezos, dex_op.contractAddress);
    printFormattedOutput("DEX init finished");
    await new Promise((r) => setTimeout(r, 2000));
    tokens = await setupTrioTokens();
    return true;
  });

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

    async function updateManagersSuccessCase(
      sender: string,
      manager: string,
      add: boolean
    ) {
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
      it(
        "Should fail if not admin try to set admin",
        async () =>
          await failCase(
            "bob",
            async () => await dex.setAdmin(eveAddress),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it(
        "Should change admin",
        async () => await setAdminSuccessCase("alice", eveAddress),
        30000
      );
    });

    describe("1.2. Test setting new dev_address", () => {
      it(
        "Should fail if not admin try to set dev_address",
        async () =>
          await failCase(
            "bob",
            async () => dex.setDevAddress(eveAddress),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it(
        "Should change dev address",
        async () => await setDevAddrSuccessCase("eve", aliceAddress),
        20000
      );
    });

    describe("1.3. Test setting managers", () => {
      it(
        "Should fail if not admin try set manager",
        async () =>
          await failCase(
            "bob",
            async () => dex.addRemManager(true, aliceAddress),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it(
        "Should set new manager",
        async () => await updateManagersSuccessCase("eve", aliceAddress, true),
        20000
      );
      it(
        "Should remove manager",
        async () => await updateManagersSuccessCase("eve", aliceAddress, false),
        20000
      );
    });
    describe("1.4. Test default referral", () => {
      it.todo("Should fail if not admin try change default referral");
      it.todo("Should change default referral");
    });
    describe("1.5. Test DeFi reward rates", () => {
      it.todo("Should fail if not admin try set DeFi reward rates");
      it.todo("Should change DeFi reward rates");
    });
  });

  describe("2. Testing Pools endpoints", () => {
    const zero_amount = new BigNumber("0");

    describe("2.1. Test adding new pool", () => {
      let inputs: any[];
      const a_const = new BigNumber("2000");
      const input = new BigNumber(10).pow(6);
      let tokens_count: BigNumber;
      async function addNewPair(
        sender: AccountsLiteral,
        a_const: BigNumber = new BigNumber("1000000"),
        tokens_count: BigNumber = new BigNumber("3"),
        inputs: {
          asset: TokenFA12 | TokenFA2;
          in_amount: BigNumber;
          rate: BigNumber;
        }[],
        approve: boolean = false
      ) {
        let config = await prepareProviderOptions(sender);
        Tezos.setProvider(config);
        await dex.updateStorage({});
        expect(await Tezos.signer.publicKeyHash()).toEqual(
          dex.storage.storage.admin
        );
        const initPairCount = new BigNumber(dex.storage.storage.pools_count);
        await dex.initializeExchange(a_const, tokens_count, inputs, approve);
        await dex.updateStorage({});
        await dex.updateStorage({
          pools: [(dex.storage.storage.pools_count.toNumber() - 1).toString()],
          ledger: [[accounts[sender].pkh, 0]],
        });
        const updatedPairCount = new BigNumber(dex.storage.storage.pools_count);
        expect(initPairCount.toNumber() + 1).toEqual(
          updatedPairCount.toNumber()
        );
        expect(
          dex.storage.storage.ledger[accounts[sender].pkh].toNumber()
        ).toEqual(
          new BigNumber(10)
            .pow(18)
            .multipliedBy(input)
            .multipliedBy(3)
            .toNumber()
        ); //TODO: change to be calculated from inputs
        return true;
      }
      beforeAll(async () => {
        inputs = [
          {
            asset: tokens.kUSD,
            in_amount: decimals.kUSD.multipliedBy(input),
            rate: new BigNumber(10).pow(18),
            precision_multiplier: new BigNumber(1),
          },
          {
            asset: tokens.USDtz,
            in_amount: decimals.USDtz.multipliedBy(input),
            rate: new BigNumber(10).pow(18 + 12),
            precision_multiplier: new BigNumber(10).pow(12),
          },
          {
            asset: tokens.uUSD,
            in_amount: decimals.uUSD.multipliedBy(input),
            rate: new BigNumber(10).pow(18 + 6),
            precision_multiplier: new BigNumber(10).pow(6),
          },
        ];
        inputs = inputs.sort(
          (
            a: { asset: { contract: { address: number } } },
            b: { asset: { contract: { address: number } } }
          ) => {
            if (a.asset instanceof TokenFA2 && b.asset instanceof TokenFA12)
              return -1;
            else if (
              b.asset instanceof TokenFA2 &&
              a.asset instanceof TokenFA12
            )
              return 1;
            else if (a.asset.contract.address < b.asset.contract.address)
              return 1;
            else if (a.asset.contract.address > b.asset.contract.address)
              return -1;
            else 0;
          }
        );
        tokens_count = new BigNumber(inputs.length);
      }, 80000);
      it(
        "Should fail if not admin try to add pool",
        async () =>
          await failCase(
            "alice",
            async () =>
              await dex.initializeExchange(
                a_const,
                tokens_count,
                inputs,
                false
              ),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it(
        "Should add new pool",
        async () =>
          await addNewPair("eve", a_const, tokens_count, inputs, false),
        20000
      );
    });

    describe("2.2. Test pool administration", () => {
      let pool_id: BigNumber;
      beforeAll(async () => {
        await dex.updateStorage({});
        pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      }, 80000);
      describe("2.2.1. Ramping A constant", () => {
        const future_a_const = new BigNumber("100000");
        const future_a_time = new BigNumber("86400");
        it(
          "Should fail if not admin performs ramp A",
          async () =>
            await failCase(
              "bob",
              async () =>
                await dex.contract.methods
                  .rampA(pool_id, future_a_const, future_a_time)
                  .send(),
              "Dex/not-contract-admin"
            ),
          10000
        );
        it.todo("Should ramp A");
        it(
          "Should fail if not admin performs stopping ramp A",
          async () =>
            await failCase(
              "bob",
              async () => await dex.contract.methods.stopRampA(pool_id).send(),
              "Dex/not-contract-admin"
            ),
          10000
        );
        it.todo("Should stop ramp A");
      });
      describe("2.2.2 Setting fees", () => {
        const fees: FeeType = {
          lp_fee: new BigNumber("2000000"),
          stakers_fee: new BigNumber("2000000"),
          ref_fee: new BigNumber("500000"),
          dev_fee: new BigNumber("500000"),
        };
        async function setFeesSuccessCase(
          sender: AccountsLiteral,
          pool_id: BigNumber,
          fees: FeeType
        ) {
          let config = await prepareProviderOptions(sender);
          Tezos.setProvider(config);
          await dex.updateStorage({ pools: [pool_id.toString()] });
          expect(await Tezos.signer.publicKeyHash()).toEqual(
            dex.storage.storage.admin
          );
          const initFee = dex.storage.storage.pools[pool_id.toString()]
            .fee as FeeType;
          expect(initFee).not.toMatchObject(fees);
          await dex.setFees(pool_id, fees);
          await dex.updateStorage({ pools: [pool_id.toString()] });
          const updStorage = (await dex.contract.storage()) as any;
          const updatedFees = (await updStorage.storage.pools.get(pool_id))
            .fee as FeeType;
          expect(updatedFees.lp_fee.toNumber()).toEqual(fees.lp_fee.toNumber());
          expect(updatedFees.stakers_fee.toNumber()).toEqual(
            fees.stakers_fee.toNumber()
          );
          expect(updatedFees.ref_fee.toNumber()).toEqual(
            fees.ref_fee.toNumber()
          );
          expect(updatedFees.dev_fee.toNumber()).toEqual(
            fees.dev_fee.toNumber()
          );
          return true;
        }
        it(
          "Should fail if not admin try to set new fee",
          async () =>
            await failCase(
              "bob",
              async () => await dex.setFees(pool_id, fees),
              "Dex/not-contract-admin"
            ),
          10000
        );
        it(
          "Should change fees",
          async () => await setFeesSuccessCase("eve", pool_id, fees),
          20000
        );
      });
      describe("2.2.3 Setting proxy", () => {
        it("Should fail if not admin try to set new proxy", async () => {
          const proxy: string = bobAddress;
          return await failCase(
            "bob",
            async () =>
              await dex.contract.methods.setProxy(pool_id, proxy).send(),
            "Dex/not-contract-admin"
          );
        }, 10000);
        it("Should set proxy", async () => {
          let config = await prepareProviderOptions("eve");
          Tezos.setProvider(config);
          const proxy: string = bobAddress;
          await dex.updateStorage({ pools: [pool_id.toString()] });
          const init_proxy: string =
            dex.storage.storage.pools[pool_id.toString()].proxy_contract;
          const op = await dex.contract.methods.setProxy(pool_id, proxy).send();
          await confirmOperation(Tezos, op.hash);
          await dex.updateStorage({ pools: [pool_id.toString()] });
          const upd_proxy: string =
            dex.storage.storage.pools[pool_id.toString()].proxy_contract;
          expect(upd_proxy).toEqual(proxy);
          expect(upd_proxy).not.toEqual(init_proxy);
        }, 20000);
        it("Should remove proxy", async () => {
          let config = await prepareProviderOptions("eve");
          Tezos.setProvider(config);
          const proxy: string = null;
          await dex.updateStorage({ pools: [pool_id.toString()] });
          const init_proxy: string =
            dex.storage.storage.pools[pool_id.toString()].proxy_contract;
          expect(init_proxy).not.toBeNull();
          const op = await dex.contract.methods.setProxy(pool_id, proxy).send();
          await confirmOperation(Tezos, op.hash);
          await dex.updateStorage({ pools: [pool_id.toString()] });
          const upd_proxy: string =
            dex.storage.storage.pools[pool_id.toString()].proxy_contract;
          expect(upd_proxy).toBeNull();
        }, 20000);
      });
      describe("2.2.4 Update proxy limits", () => {
        let limits: MichelsonMap<string, BigNumber>;

        beforeAll(async () => {
          limits = new MichelsonMap();
          await dex.updateStorage({
            pools: [pool_id.toString()],
            tokens: [pool_id.toString()],
          });
          const tokens_map = dex.storage.storage.pools[pool_id.toNumber()]
            .virtual_reserves as any as MichelsonMap<string, BigNumber>;
          tokens_map.forEach((v, k) => {
            limits.set(
              k,
              new BigNumber(10).pow(6).multipliedBy(3).multipliedBy(k)
            );
          });
        }, 80000);
        it("Should fail if not admin try to set new proxy limits", async () => {
          const proxy: string = bobAddress;
          return await failCase(
            "bob",
            async () =>
              await dex.contract.methods
                .updateProxyLimits(pool_id, limits)
                .send(),
            "Dex/not-contract-admin"
          );
        }, 10000);
        it("Should set proxy limits", async () => {
          let config = await prepareProviderOptions("eve");
          Tezos.setProvider(config);
          const op = await dex.contract.methods
            .updateProxyLimits(pool_id, limits)
            .send();
          await confirmOperation(Tezos, op.hash);
          await dex.updateStorage({
            pools: [pool_id.toString()],
            tokens: [pool_id.toString()],
          });
          const upd_limits = dex.storage.storage.pools[pool_id.toNumber()]
            .proxy_limits as any as MichelsonMap<string, BigNumber>;
          limits.forEach((v, k) => {
            expect(upd_limits.get(k)).toEqual(v);
          });
        }, 20000);
      });
    });

    describe("2.3. Test invest liq", () => {
      const sender = "alice";
      let amounts: Map<string, BigNumber>;
      let min_shares: BigNumber;
      let pool_id: BigNumber;
      const input = new BigNumber(10).pow(6);
      const kUSDAmount = decimals.kUSD.multipliedBy(input);
      const uUSDAmount = decimals.uUSD.multipliedBy(input);
      const USDtzAmount = decimals.USDtz.multipliedBy(input);
      const referral = aliceAddress;

      async function investLiquidity(
        sender: string,
        pool_id: BigNumber,
        referral: string,
        min_shares: BigNumber,
        in_amounts: Map<string, BigNumber>
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
        await tokens.uUSD.updateStorage({ ledger: [accounts[sender].pkh] });
        await tokens.USDtz.updateStorage({ ledger: [accounts[sender].pkh] });
        await dex.investLiquidity(pool_id, in_amounts, min_shares, referral);
        await dex.updateStorage({
          pools: [pool_id.toString()],
          ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
        });
        const updatedLPBalance = new BigNumber(
          dex.storage.storage.pools[pool_id.toNumber()].total_supply
        );
        const updatedLedger = dex.storage.storage.ledger[accounts[sender].pkh];
        expect(updatedLPBalance.toNumber()).toBeGreaterThan(
          initLPBalance.toNumber()
        );
        expect(
          updatedLedger.minus(initLedger).toNumber()
        ).toBeGreaterThanOrEqual(min_shares.toNumber());
        await tokens.uUSD.updateStorage({ ledger: [accounts[sender].pkh] });
        await tokens.USDtz.updateStorage({ ledger: [accounts[sender].pkh] });
      }

      beforeAll(async () => {
        let config = await prepareProviderOptions(sender);
        Tezos.setProvider(config);
        const stp = await setupTokenAmounts(
          dex,
          USDtzAmount,
          kUSDAmount,
          uUSDAmount
        );
        amounts = stp.amounts;
        pool_id = stp.pool_id;
        min_shares = new BigNumber(1); //input.multipliedBy(amounts.size).minus(100);
      }, 80000);

      it("Should fail if zero input", async () => {
        const zero_amounts: Map<string, BigNumber> = new Map<string, BigNumber>(
          Array.from(amounts.entries()).map(([k, v]) => [k, zero_amount])
        );
        await failCase(
          sender,
          async () =>
            await dex.investLiquidity(
              pool_id,
              zero_amounts,
              min_shares,
              referral
            ),
          "Dex/zero-amount-in"
        );
      }, 10000);
      it("Should fail if wrong indexes", async () => {
        const wrong_idx_amounts: Map<string, BigNumber> = new Map<
          string,
          BigNumber
        >(
          Array.from(amounts.entries()).map(([k, v]) => [
            new BigNumber(k).plus("5").toString(),
            v,
          ])
        );
        await failCase(
          sender,
          async () =>
            await dex.investLiquidity(
              pool_id,
              wrong_idx_amounts,
              min_shares,
              referral
            ),
          "Dex/zero-amount-in"
        );
      }, 10000);
      it("Should invest liq balanced", async () => {
        return await investLiquidity(
          sender,
          pool_id,
          referral,
          min_shares,
          amounts
        );
      }, 20000);

      it.todo("Should invest liq imbalanced");
    });

    describe("2.4. Test swap", () => {
      const sender = "bob";
      let amounts: Map<string, BigNumber>;
      const normalized = new BigNumber(10).pow(2);
      const kUSDAmount = decimals.kUSD.multipliedBy(normalized);
      const uUSDAmount = decimals.uUSD.multipliedBy(normalized);
      const USDtzAmount = decimals.USDtz.multipliedBy(normalized);
      let pool_id: BigNumber;
      const referral = aliceAddress;
      let min_out: BigNumber;
      let map_tokens_idx: {
        kUSD: string;
        uUSD: string;
        USDtz: string;
      };
      beforeAll(async () => {
        const stp = await setupTokenAmounts(
          dex,
          USDtzAmount.multipliedBy(2),
          kUSDAmount.multipliedBy(2),
          uUSDAmount.multipliedBy(2)
        );
        amounts = new Map<string, BigNumber>();
        stp.amounts.forEach((v, k) => {
          amounts.set(k, v.dividedBy(2));
        });
        pool_id = stp.pool_id;
        const tokens_map = dex.storage.storage.tokens[
          pool_id.toNumber()
        ] as any as Map<string, FA2TokenType | FA12TokenType>;
        let mapping = {} as any;
        for (let [k, v] of tokens_map.entries()) {
          let token: FA2TokenType | FA12TokenType = v as FA2TokenType;
          let contract_address: string;
          if (token.fa2) {
            contract_address = token.fa2.token_address;
          } else {
            token = v as FA12TokenType;
            contract_address = token.fa12;
          }
          if (contract_address) {
            if (contract_address == tokens.USDtz.contract.address) {
              mapping.USDtz = k;
            } else if (contract_address == tokens.kUSD.contract.address) {
              mapping.kUSD = k;
            } else if (contract_address == tokens.uUSD.contract.address) {
              mapping.uUSD = k;
            }
          }
        }
        map_tokens_idx = mapping;
      }, 80000);
      it.each(swap_routes)(
        "Should fail if zero input [%s, %s]",
        async (t_in, t_to) => {
          const zero_amount = new BigNumber("0");
          const i = map_tokens_idx[t_in];
          const j = map_tokens_idx[t_to];
          min_out = new BigNumber(0);
          await failCase(
            "bob",
            async () =>
              await dex.swap(
                pool_id,
                new BigNumber(i),
                new BigNumber(j),
                zero_amount,
                min_out,
                referral,
                null
              ),
            "Dex/zero-amount-in"
          );
        },
        10000
      );
      it.each(swap_routes)(
        `Should swap [${normalized.toString()} %s, ~ ${normalized.toString()} %s]`,
        async (t_in, t_to) => {
          let config = await prepareProviderOptions(sender);
          Tezos.setProvider(config);
          const i = map_tokens_idx[t_in];
          const j = map_tokens_idx[t_to];
          await dex.updateStorage({ pools: [pool_id.toString()] });
          // printFormattedOutput(dex.storage.storage.pools[pool_id.toString()]);
          const init_reserves = dex.storage.storage.pools[pool_id.toString()]
            .reserves as any as Map<string, BigNumber>;
          const rates = {};
          (
            dex.storage.storage.pools[pool_id.toString()]
              .token_rates as any as Map<string, BigNumber>
          ).forEach((v, k) => {
            rates[k] = new BigNumber(10).pow(18).dividedBy(v);
          });
          const tok_in = tokens[t_in];
          const tok_out = tokens[t_to];
          const t_in_ep =
            tok_in.contract.views.balance_of ||
            tok_in.contract.views.getBalance;
          const t_out_ep =
            tok_out.contract.views.balance_of ||
            tok_out.contract.views.getBalance;
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
            .reserves as any as Map<string, BigNumber>;
          expect(upd_reserves.get(i.toString())).toEqual(
            init_reserves.get(i.toString()).plus(amounts.get(i))
          );
          const output = init_reserves
            .get(j.toString())
            .minus(upd_reserves.get(j.toString()));
          printFormattedOutput(
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
            output
              .dividedBy(rates[j])
              .dividedBy(new BigNumber(10).pow(18))
              .toNumber()
          ).toBeCloseTo(
            normalized
              .minus(normalized.multipliedBy(5).dividedBy(10000))
              .toNumber()
          );

          init_in = init_in instanceof BigNumber ? init_in : init_in[0].balance;
          init_out =
            init_out instanceof BigNumber ? init_out : init_out[0].balance;
          upd_in = upd_in instanceof BigNumber ? upd_in : upd_in[0].balance;
          upd_out = upd_out instanceof BigNumber ? upd_out : upd_out[0].balance;
          printFormattedOutput(init_in.toFormat(), upd_in.toFormat());
          printFormattedOutput(init_out.toFormat(), upd_out.toFormat());

          expect(
            init_in.minus(upd_in).dividedBy(decimals[t_in]).toNumber()
          ).toBeCloseTo(normalized.toNumber());

          expect(
            upd_out.minus(init_out).dividedBy(decimals[t_to]).toNumber()
          ).toBeCloseTo(
            normalized
              .minus(normalized.multipliedBy(5).dividedBy(10000))
              .toNumber()
          );
        },
        40000
      );
    });

    describe("2.5. Test divest liq", () => {
      let min_amounts: Map<string, BigNumber>;
      const kUSDAmount = new BigNumber(10).pow(18 + 3);
      const uUSDAmount = new BigNumber(10).pow(12 + 3);
      const USDtzAmount = new BigNumber(10).pow(6 + 3);
      const amount_in = new BigNumber(10).pow(18 + 3).multipliedBy(3);
      let pool_id: BigNumber;
      let map_tokens_idx: {
        kUSD: string;
        uUSD: string;
        USDtz: string;
      };
      async function divestLiquidity(
        sender: string,
        pool_id: BigNumber,
        shares: BigNumber,
        min_amounts: Map<string, BigNumber>
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
        const res = dex.storage.storage.pools[pool_id.toNumber()]
          .reserves as any as MichelsonMap<string, BigNumber>;
        let raw_res = {};
        res.forEach(
          (value, key) => (raw_res[key] = value.toFormat(0).toString())
        );
        printFormattedOutput(raw_res);
        const v_res = dex.storage.storage.pools[pool_id.toNumber()]
          .virtual_reserves as any as MichelsonMap<string, BigNumber>;
        let virt_res = {};
        v_res.forEach(
          (value, key) => (virt_res[key] = value.toFormat(0).toString())
        );
        printFormattedOutput(virt_res);
        printFormattedOutput(initLPBalance.toFormat());
        const init_ledger = dex.storage.storage.ledger[accounts[sender].pkh];
        printFormattedOutput(init_ledger.toFormat());
        await dex.divestLiquidity(pool_id, min_amounts, shares);
        await dex.updateStorage({
          pools: [pool_id.toString()],
          ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
        });
        const updatedLPBalance = new BigNumber(
          dex.storage.storage.pools[pool_id.toNumber()].total_supply
        );
        printFormattedOutput(updatedLPBalance.toFormat());
        expect(updatedLPBalance.toNumber()).toBeLessThan(
          initLPBalance.toNumber()
        );
        expect(
          dex.storage.storage.ledger[accounts[sender].pkh]
            .plus(shares)
            .toNumber()
        ).toBe(init_ledger.toNumber()); //TODO: change to be calculated from inputs
        expect(updatedLPBalance.toNumber()).toBe(
          initLPBalance.minus(shares).toNumber()
        );
      }

      beforeAll(async () => {
        const stp = await setupTokenAmounts(
          dex,
          USDtzAmount.minus(USDtzAmount.multipliedBy(3).dividedBy(100)),
          kUSDAmount.minus(kUSDAmount.multipliedBy(3).dividedBy(100)),
          uUSDAmount.minus(uUSDAmount.multipliedBy(3).dividedBy(100))
        );
        min_amounts = stp.amounts;
        pool_id = stp.pool_id;
        const tokens_map = dex.storage.storage.tokens[
          pool_id.toNumber()
        ] as any as Map<string, FA2TokenType | FA12TokenType>;
        let mapping = {} as any;
        for (let [k, v] of tokens_map.entries()) {
          let token: FA2TokenType | FA12TokenType = v as FA2TokenType;
          let contract_address: string;
          if (token.fa2) {
            contract_address = token.fa2.token_address;
          } else {
            token = v as FA12TokenType;
            contract_address = token.fa12;
          }
          if (contract_address) {
            if (contract_address == tokens.USDtz.contract.address) {
              mapping.USDtz = k;
            } else if (contract_address == tokens.kUSD.contract.address) {
              mapping.kUSD = k;
            } else if (contract_address == tokens.uUSD.contract.address) {
              mapping.uUSD = k;
            }
          }
        }
        map_tokens_idx = mapping;
      }, 80000);
      it("Should fail if zero input", async () => {
        await failCase(
          "eve",
          async () =>
            await dex.divestLiquidity(pool_id, min_amounts, new BigNumber("0")),
          "Dex/zero-amount-in"
        );
      }, 10000);
      it(
        "Should divest liq balanced",
        async () =>
          await divestLiquidity("eve", pool_id, amount_in, min_amounts),
        20000
      );
      it.todo("Should divest liq imbalanced");
    });
  });

  describe("3. Testing Token endpoints", () => {
    let pool_id: BigNumber;
    const amount = new BigNumber("100000");
    beforeAll(async () => {
      pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
    }, 80000);
    describe("3.1. Test transfer from self", () => {
      it("Should fail if low balance", async () => {
        await failCase(
          "bob",
          async () =>
            await dex.transfer(pool_id, bobAddress, aliceAddress, amount),
          "FA2_INSUFFICIENT_BALANCE"
        );
      }, 10000);
      it("Should send from self", async () => {
        let config = await prepareProviderOptions("alice");
        Tezos.setProvider(config);
        await dex.transfer(pool_id, aliceAddress, bobAddress, amount);
      }, 20000);
    });
    describe("3.2. Test approve", () => {
      it("Should fail send if not approved", async () => {
        await failCase(
          "bob",
          async () =>
            await dex.transfer(pool_id, aliceAddress, bobAddress, amount),
          "FA2_NOT_OPERATOR"
        );
      }, 10000);
      it("Should update operator", async () => {
        let config = await prepareProviderOptions("alice");
        Tezos.setProvider(config);
        await dex.approve(bobAddress, amount);
      }, 20000);
      it("Should send as operator", async () => {
        let config = await prepareProviderOptions("bob");
        Tezos.setProvider(config);
        await dex.transfer(pool_id, aliceAddress, bobAddress, amount);
      }, 20000);
    });
  });

  describe("4. Testing rewards separation", () => {
    let pool_id: BigNumber;
    const batchTimes = 5;
    const referral = "alice";
    const staker = "bob";
    let dev_address: string;

    async function batchSwap(
      times: number,
      poolId: BigNumber,
      amount: BigNumber,
      ref: string
    ): Promise<void> {
      let amounts: Map<string, BigNumber>;
      const kUSDAmount = decimals.kUSD.multipliedBy(amount);
      const uUSDAmount = decimals.uUSD.multipliedBy(amount);
      const USDtzAmount = decimals.USDtz.multipliedBy(amount);
      let map_tokens_idx: {
        kUSD: string;
        uUSD: string;
        USDtz: string;
      };
      const stp = await setupTokenAmounts(
        dex,
        USDtzAmount.multipliedBy(2),
        kUSDAmount.multipliedBy(2),
        uUSDAmount.multipliedBy(2)
      );
      amounts = new Map<string, BigNumber>();
      stp.amounts.forEach((v, k) => {
        amounts.set(k, v.dividedBy(2));
      });
      const tokens_map = dex.storage.storage.tokens[
        poolId.toNumber()
      ] as any as Map<string, FA2TokenType | FA12TokenType>;
      let mapping = {} as any;
      for (let [k, v] of tokens_map.entries()) {
        let token: FA2TokenType | FA12TokenType = v as FA2TokenType;
        let contract_address: string;
        if (token.fa2) {
          contract_address = token.fa2.token_address;
        } else {
          token = v as FA12TokenType;
          contract_address = token.fa12;
        }
        if (contract_address) {
          if (contract_address == tokens.USDtz.contract.address) {
            mapping.USDtz = k;
          } else if (contract_address == tokens.kUSD.contract.address) {
            mapping.kUSD = k;
          } else if (contract_address == tokens.uUSD.contract.address) {
            mapping.uUSD = k;
          }
        }
      }
      map_tokens_idx = mapping;
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
        printFormattedOutput(`${i + 1} BatchSwap ${op.hash}`);
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const res = dex.storage.storage.pools[pool_id.toNumber()]
          .reserves as any as MichelsonMap<string, BigNumber>;
        let raw_res = {};
        res.forEach(
          (value, key) => (raw_res[key] = value.toFormat(0).toString())
        );
        printFormattedOutput(raw_res);
      }
    }

    beforeAll(async () => {
      await dex.updateStorage({});
      dev_address = dex.storage.storage.dev_address;
      const amount = new BigNumber(10).pow(4);
      pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      await batchSwap(batchTimes, pool_id, amount, accounts[referral].pkh);
    });
    describe("4.1. Referral reward", () => {
      it("Should get referral rewards", async () => {
        const expectedRewardNormalized = new BigNumber(10)
          .pow(4)
          .multipliedBy(batchTimes)
          .plus(new BigNumber(10).pow(2))
          .multipliedBy(2) // swap in 2 ways
          .multipliedBy(5)
          .dividedBy(100000); // 0.005% of swap
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const ref_address = accounts[referral].pkh;
        const ref_stor = await dex.contract.storage().then((storage: any) => {
          return storage.storage.referral_rewards;
        });
        const initUSDtz = await tokens.USDtz.contract.views
          .getBalance(ref_address)
          .read(lambdaContractAddress);
        const initkUSD = await tokens.kUSD.contract.views
          .getBalance(ref_address)
          .read(lambdaContractAddress);
        const inituUSD = await tokens.uUSD.contract.views
          .balance_of([{ owner: ref_address, token_id: "0" }])
          .read(lambdaContractAddress);

        const USDtzRewards = await ref_stor.get({
          0: ref_address,
          1: { fa12: tokens.USDtz.contract.address },
        });
        expect(USDtzRewards.dividedBy(decimals.USDtz).toNumber()).toBeCloseTo(
          expectedRewardNormalized.toNumber()
        );
        printFormattedOutput(USDtzRewards.toFormat());
        const kUSDRewards = await ref_stor.get({
          0: ref_address,
          1: { fa12: tokens.kUSD.contract.address },
        });
        printFormattedOutput(kUSDRewards.toFormat());
        expect(kUSDRewards.dividedBy(decimals.kUSD).toNumber()).toBeCloseTo(
          expectedRewardNormalized.toNumber()
        );
        const uUSDRewards = await ref_stor.get({
          0: ref_address,
          1: {
            fa2: {
              token_address: tokens.uUSD.contract.address,
              token_id: new BigNumber(defaultTokenId),
            },
          },
        });
        printFormattedOutput(uUSDRewards.toFormat());
        expect(uUSDRewards.dividedBy(decimals.uUSD).toNumber()).toBeCloseTo(
          expectedRewardNormalized.toNumber()
        );
        const init_rewards = {
          USDtz: USDtzRewards,
          kUSD: kUSDRewards,
          uUSD: uUSDRewards,
        };
        const params = [
          {
            option: "referral",
            param: {
              fa12: tokens.USDtz.contract.address,
            },
          },
          {
            option: "referral",
            param: {
              fa12: tokens.kUSD.contract.address,
            },
          },
          {
            option: "referral",
            param: {
              fa2: {
                token_address: tokens.uUSD.contract.address,
                token_id: new BigNumber(defaultTokenId),
              },
            },
          },
        ];
        let op: any = dex.contract.methods.claim(params);
        console.log(op);
        op = await op.send();
        await confirmOperation(Tezos, op.hash);
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const upd_ref_stor = await dex.contract
          .storage()
          .then((storage: any) => {
            return storage.storage.referral_rewards;
          });
        const updUSDtzRewards = await upd_ref_stor.get({
          0: ref_address,
          1: { fa12: tokens.USDtz.contract.address },
        });
        expect(updUSDtzRewards.toNumber()).toEqual(0);
        printFormattedOutput(updUSDtzRewards.toFormat());
        const updkUSDRewards = await upd_ref_stor.get({
          0: ref_address,
          1: { fa12: tokens.kUSD.contract.address },
        });
        printFormattedOutput(updkUSDRewards.toFormat());
        expect(kUSDRewards.toNumber()).toEqual(0);
        const upduUSDRewards = await upd_ref_stor.get({
          0: ref_address,
          1: {
            fa2: {
              token_address: tokens.uUSD.contract.address,
              token_id: new BigNumber(defaultTokenId),
            },
          },
        });
        printFormattedOutput(upduUSDRewards.toFormat());
        expect(upduUSDRewards.toNumber()).toEqual(0);
        const updUSDtz = await tokens.USDtz.contract.views
          .getBalance(ref_address)
          .read(lambdaContractAddress);
        const updkUSD = await tokens.kUSD.contract.views
          .getBalance(ref_address)
          .read(lambdaContractAddress);
        const upduUSD = await tokens.uUSD.contract.views
          .balance_of([{ owner: ref_address, token_id: "0" }])
          .read(lambdaContractAddress);
        expect(updUSDtz.minus(initUSDtz).toNumber()).toEqual(
          init_rewards.USDtz.toNumber()
        );
        expect(updkUSD.minus(initkUSD).toNumber()).toEqual(
          init_rewards.kUSD.toNumber()
        );
        expect(upduUSD.minus(inituUSD).toNumber()).toEqual(
          init_rewards.uUSD.toNumber()
        );
      });
    });
    describe("4.2. QT stakers reward", () => {
      it.todo("Should get staking rewards");
    });

    describe("4.3. Developer reward", () => {
      it.todo("Should get dev rewards");
    });
  });

  describe("5. Views", () => {
    let pool_id: BigNumber;
    let map_tokens_idx: {
      kUSD: string;
      uUSD: string;
      USDtz: string;
    };
    beforeAll(async () => {
      await dex.updateStorage({});
      pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      await dex.updateStorage({
        tokens: [pool_id.toString()],
        pools: [pool_id.toString()],
      });
      const tokens_map = dex.storage.storage.tokens[
        pool_id.toNumber()
      ] as any as Map<string, FA2TokenType | FA12TokenType>;
      let mapping = {} as any;
      for (let [k, v] of tokens_map.entries()) {
        let token: FA2TokenType | FA12TokenType = v as FA2TokenType;
        let contract_address: string;
        if (token.fa2) {
          contract_address = token.fa2.token_address;
        } else {
          token = v as FA12TokenType;
          contract_address = token.fa12;
        }
        if (contract_address) {
          if (contract_address == tokens.USDtz.contract.address) {
            mapping.USDtz = k;
          } else if (contract_address == tokens.kUSD.contract.address) {
            mapping.kUSD = k;
          } else if (contract_address == tokens.uUSD.contract.address) {
            mapping.uUSD = k;
          }
        }
      }
      map_tokens_idx = mapping;
    }, 80000);
    describe("5.1. Dex views", () => {
      it("Should return A", async () => {
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const exp_A = dex.storage.storage.pools[pool_id.toString()].initial_A;
        const a = await dex.contract.views
          .get_a(pool_id)
          .read(lambdaContractAddress);
        expect(a.toNumber()).toEqual(exp_A.dividedBy(100).toNumber());
      });
      it("Should return fees", async () => {
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const exp_fees: FeeType =
          dex.storage.storage.pools[pool_id.toString()].fee;
        const fees = (await dex.contract.views
          .get_fees(pool_id)
          .read(lambdaContractAddress)) as FeeType;
        expect(fees).toMatchObject(exp_fees);
      });
      it("Should return reserves", async () => {
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const exp_reserves =
          dex.storage.storage.pools[pool_id.toString()].reserves;
        const reserves = await dex.contract.views
          .get_reserves(pool_id)
          .read(lambdaContractAddress);
        expect(reserves).toMatchObject(exp_reserves);
      });
      it("Should return virtual reserves", async () => {
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const exp_v_reserves =
          dex.storage.storage.pools[pool_id.toString()].virtual_reserves;
        const v_reserves = await dex.contract.views
          .get_reserves(pool_id)
          .read(lambdaContractAddress);
        expect(v_reserves).toMatchObject(exp_v_reserves);
      });
      it.todo("Should return min received");
      it.skip("Should return dy", async () => {
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const dx = new BigNumber(10).pow(12 + 3);
        const exp_dy = new BigNumber(10).pow(6 + 3);
        const i = map_tokens_idx.uUSD;
        const j = map_tokens_idx.USDtz;
        printFormattedOutput(pool_id, new BigNumber(i), new BigNumber(j), dx);
        const params = {
          pool_id: pool_id,
          i: i,
          j: j,
          dx: dx,
        };
        const getdy = dex.contract.views.get_dy(
          pool_id,
          new BigNumber(i),
          new BigNumber(j),
          dx
        );
        printFormattedOutput(getdy);
        const dy = await getdy.read();
        printFormattedOutput(dy.toString());
        printFormattedOutput(exp_dy.toString(), dy.toString());
        // expect(dy.toNumber()).toBeCloseTo(exp_dy.toNumber());
      });
      it.todo("Should return price");
    });
    describe("5.2.Token views", () => {
      it("Should return balance of account", async () => {
        const accounts = [
          {
            owner: aliceAddress,
            token_id: pool_id,
          },
          {
            owner: bobAddress,
            token_id: pool_id,
          },
          {
            owner: eveAddress,
            token_id: pool_id,
          },
        ];
        const balances = await dex.contract.views
          .balance_of(accounts)
          .read(lambdaContractAddress);
        expect(balances[0].balance.toNumber()).toBeGreaterThanOrEqual(0);
        expect(balances[1].balance.toNumber()).toBeGreaterThanOrEqual(0);
        expect(balances[2].balance.toNumber()).toBeGreaterThanOrEqual(0);
      });
      it("Should return total supply", async () => {
        const total_supply = await dex.contract.views
          .total_supply(pool_id)
          .read(lambdaContractAddress);
        await dex.updateStorage({
          pools: [pool_id.toString()],
        });
        expect(total_supply.toNumber()).toEqual(
          dex.storage.storage.pools[pool_id.toString()].total_supply.toNumber()
        );
      });
    });
  });
});
