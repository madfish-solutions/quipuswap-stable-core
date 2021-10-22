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
import { FA12TokenType, FA2TokenType, FeeType } from "./helpers/types";
import { TokenFA12 } from "./helpers/tokenFA12";
import { TokenFA2 } from "./helpers/tokenFA2";
import { confirmOperation } from "./helpers/confirmation";
import { MichelsonMap, TezosToolkit, VIEW_LAMBDA } from "@taquito/taquito";

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

    describe("2.1. Test adding new pool", () => {
      let inputs;
      const a_const = new BigNumber("100000");
      let tokens_count: BigNumber;

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
        ).toBeGreaterThan(0);
        return true;
      }
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

    describe("2.2. Test pool administration", () => {
      describe("2.2.1. Ramping A constant", () => {
        it.todo("2.2.1.1. should fail if not admin performs ramp A");
        it.todo("2.2.1.2. should ramp A");
        it.todo("2.2.1.3. should fail if not admin performs stopping ramp A");
        it.todo("2.2.1.4. should stop ramp A");
      });
      describe("2.2.2. Ramping A constant", () => {
        it.todo("2.2.2.1. should fail if not admin performs ramp A");
        it.todo("2.2.2.2. should ramp A");
        it.todo("2.2.2.3. should fail if not admin performs stopping ramp A");
        it.todo("2.2.2.4. should stop ramp A");
      });
      describe("2.2.3 Setting fees", () => {
        const fees: FeeType = {
          lp_fee: new BigNumber("1000000"),
          stakers_fee: new BigNumber("1000000"),
          ref_fee: new BigNumber("1000000"),
          dev_fee: new BigNumber("1000000"),
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
          for (let i in updatedFees) {
            expect(updatedFees[i].toNumber()).toEqual(fees[i].toNumber());
          }
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
        it("2.2.3.1. should fail if not admin try to set new fee", async () =>
          await failCase(
            "bob",
            async () => await dex.setFees(new BigNumber("0"), fees),
            "Dex/not-contact-admin"
          ));
        it("2.2.3.2. should change fees", async () =>
          await setFeesSuccessCase("eve", new BigNumber("0"), fees));
      });
      describe("2.2.4 Setting proxy", () => {
        it.todo("2.2.4.1. should fail if not admin try to set new proxy");
        it.todo("2.2.4.2. should set proxy");
        it.todo("2.2.4.3. should remove proxy");
      });
      describe("2.2.5 Update proxy limits", () => {
        it.todo(
          "2.2.5.1. should fail if not admin try to set new proxy limits"
        );
        it.todo("2.2.5.2. should set proxy limits");
      });
    });

    describe("2.3. Test invest liq", () => {
      let amounts: Map<BigNumber, BigNumber>;
      const kUSDAmount = new BigNumber("1000000000000000000000");
      const uUSDAmount = new BigNumber("1000000000000000");
      const USDtzAmount = new BigNumber("1000000000");
      const min_shares = new BigNumber("1000");
      let pool_id: BigNumber;
      const referral = aliceAddress;

      async function investLiquidity(
        sender,
        pool_id: BigNumber,
        referral: string,
        min_shares: BigNumber,
        in_amounts: Map<BigNumber, BigNumber>
      ) {
        let config = await prepareProviderOptions(sender);
        await global.Tezos.setProvider(config);
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const initLPBalance = new BigNumber(
          dex.storage.storage.pools[pool_id.toNumber()].total_supply
        );

        await dex.investLiquidity(pool_id, in_amounts, min_shares, referral);
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const updatedLPBalance = new BigNumber(
          dex.storage.storage.pools[pool_id.toNumber()].total_supply
        );
        expect(updatedLPBalance.toNumber()).toBeGreaterThan(
          initLPBalance.toNumber()
        );
      }

      beforeAll(async () => {
        amounts = new Map<BigNumber, BigNumber>();
        await dex.updateStorage({});
        pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
        await dex.updateStorage({ tokens: [pool_id.toString()] });
        const tokens_map = dex.storage.storage.tokens[
          pool_id.toNumber()
        ] as any as Map<string, FA2TokenType | FA12TokenType>;
        for (let [k, v] of tokens_map.entries()) {
          let token: FA2TokenType | FA12TokenType = v as FA2TokenType;
          let contract_address;
          if (token.fa2) {
            contract_address = token.fa2.token_address;
          } else {
            token = v as FA12TokenType;
            contract_address = token.fa12;
          }
          if (contract_address) {
            let input_amount = new BigNumber("0");
            if (contract_address == tokens.USDtz.contract.address) {
              input_amount = USDtzAmount;
              await tokens.USDtz.approve(
                dex.contract.address,
                input_amount.toNumber()
              );
            } else if (contract_address == tokens.kUSD.contract.address) {
              input_amount = kUSDAmount;
              await tokens.kUSD.approve(
                dex.contract.address,
                input_amount.toNumber()
              );
            } else if (contract_address == tokens.uUSD.contract.address) {
              input_amount = uUSDAmount;
              await tokens.uUSD.approve(
                dex.contract.address,
                input_amount.toNumber()
              );
            }
            amounts.set(new BigNumber(k), input_amount);
          }
        }
      });

      it("2.3.1. should fail if zero input", async () => {
        const zero_amount = new BigNumber("0");
        const zero_amounts: Map<BigNumber, BigNumber> = new Map<
          BigNumber,
          BigNumber
        >(Array.from(amounts.entries()).map(([k, v]) => [k, zero_amount]));
        await failCase(
          "bob",
          async () =>
            await dex.investLiquidity(
              pool_id,
              zero_amounts,
              min_shares,
              referral
            ),
          "Dex/zero-amount-in"
        );
      });
      it("2.3.2. should fail if wrong indexes", async () => {
        const wrong_idx_amounts: Map<BigNumber, BigNumber> = new Map<
          BigNumber,
          BigNumber
        >(Array.from(amounts.entries()).map(([k, v]) => [k.plus("5"), v]));
        await failCase(
          "bob",
          async () =>
            await dex.investLiquidity(
              pool_id,
              wrong_idx_amounts,
              min_shares,
              referral
            ),
          "Dex/zero-amount-in"
        );
      });
      it("2.3.3. should invest liq balanced", async () => {
        return await investLiquidity(
          "bob",
          pool_id,
          referral,
          min_shares,
          amounts
        );
      });

      it.todo("2.3.4. should invest liq imbalanced");
    });

    describe("2.4. Test swap", () => {
      it.todo("2.4.1. should fail if zero input");
      it.todo("2.4.2. should swap");
    });

    describe("2.5. Test divest liq", () => {
      it.todo("2.5.1. should fail if zero input");
      it.todo("2.5.2. should divest liq balanced");
      it.todo("2.5.3. should divest liq imbalanced");
    });
  });

  describe("3. Testing Token endpoints", () => {
    describe("3.1. Test transfer from self", () => {
      it.todo("3.1.1. should fail if low balance");
      it.todo("3.1.2. should send from self");
    });
    describe("3.2. Test approve", () => {
      it.todo("3.2.1. should fail send if not approved");
      it.todo("3.2.2. should update operator");
      it.todo("3.2.3. should send as operator");
    });
  });

  describe("4. Views", () => {
    let lambdaContract;
    let lambdaContractAddress;
    beforeAll(async () => {
      const op = await Tezos.contract.originate({
        code: VIEW_LAMBDA.code,
        storage: VIEW_LAMBDA.storage,
      });
      await confirmOperation(Tezos, op.hash);
      lambdaContractAddress = op.contractAddress;
      lambdaContract = await Tezos.contract.at(lambdaContractAddress);
    });
    describe("4.1. Dex views", () => {
      it.todo("4.1.1. Should return A");
      it.todo("4.1.2. Should return fees");
      it.todo("4.1.3. Should return reserves");
      it.todo("4.1.4. Should return virtual reserves");
      it.todo("4.1.5. Should return fees");
      it.todo("4.1.6. Should return min received");
      it.todo("4.1.7. Should return dy");
      it.todo("4.1.8. Should return price");
    });
    describe("4.2.Token views", () => {
      it("4.2.1. Should return balance of account", async () => {
        const accounts = [
          {
            owner: aliceAddress,
            token_id: "0",
          },
          {
            owner: bobAddress,
            token_id: "0",
          },
          {
            owner: eveAddress,
            token_id: "0",
          },
        ];
        console.log(dex.contract.views);
        const balances = await dex.contract.views
          .balance_of(accounts)
          .read(lambdaContractAddress);
        expect(balances[0].balance.toNumber()).toBeGreaterThanOrEqual(0);
        expect(balances[1].balance.toNumber()).toBeGreaterThanOrEqual(0);
        expect(balances[2].balance.toNumber()).toBeGreaterThanOrEqual(0);
      });
      it("4.2.2. Should return total supply", async () => {
        console.log(dex.contract.views);
        const total_supply = await dex.contract.views
          .total_supply("0")
          .read(lambdaContractAddress);
        expect(total_supply.toNumber()).toBeGreaterThan(0);
      });
    });
  });
});
