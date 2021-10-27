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
import { failCase } from "./fail-test";

describe("Dex", () => {
  type TokensMap = {
    kUSD: TokenFA12;
    USDtz: TokenFA12;
    uUSD: TokenFA2;
  };

  let tokens: TokensMap;
  let dex: Dex;
  const aliceAddress: string = accounts.alice.pkh;
  const bobAddress: string = accounts.bob.pkh;
  const eveAddress: string = accounts.eve.pkh;

  // Contract will be deployed before every single test, to make sure we
  // do a proper unit test in a stateless testing process

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
    console.log(dex.contract.methods);
    tokens = await setupTrioTokens(Tezos);
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
      it("Should fail if not admin try to set admin", async () =>
        await failCase(
          "bob",
          async () => await dex.setAdmin(eveAddress),
          "Dex/not-contract-admin"
        ));
      it("Should change admin", async () =>
        await setAdminSuccessCase("alice", eveAddress));
    });

    describe("1.2. Test setting new dev_address", () => {
      it("Should fail if not admin try to set dev_address", async () =>
        await failCase(
          "bob",
          async () => dex.setDevAddress(eveAddress),
          "Dex/not-contract-admin"
        ));
      it("Should change dev address", async () =>
        await setDevAddrSuccessCase("eve", aliceAddress));
    });

    describe("1.3. Test setting managers", () => {
      it("Should fail if not admin try set manager", async () =>
        await failCase(
          "bob",
          async () => dex.addRemManager(true, aliceAddress),
          "Dex/not-contract-admin"
        ));
      it("Should set new manager", async () =>
        await updateManagersSuccessCase("eve", aliceAddress, true));
      it("Should remove manager", async () =>
        await updateManagersSuccessCase("eve", aliceAddress, false));
    });
  });

  describe("2. Testing Pools endpoints", () => {
    const zero_amount = new BigNumber("0");

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
            await tokens.USDtz.approve(dex.contract.address, zero_amount);
            await tokens.USDtz.approve(dex.contract.address, input_amount);
            input_amount = USDtzAmount;
          } else if (contract_address == tokens.kUSD.contract.address) {
            await tokens.kUSD.approve(dex.contract.address, zero_amount);
            await tokens.kUSD.approve(dex.contract.address, input_amount);
            input_amount = kUSDAmount;
          } else if (contract_address == tokens.uUSD.contract.address) {
            await tokens.uUSD.approve(dex.contract.address, input_amount);
            input_amount = uUSDAmount;
          }
          amounts.set(k, input_amount);
        }
      }
      return { pool_id, amounts };
    }


    describe("2.1. Test adding new pool", () => {
      let inputs;
      const a_const = new BigNumber("1000000000000");
      const input = new BigNumber(10).pow(6);
      let tokens_count: BigNumber;
      async function addNewPair(
        sender: AccountsLiteral,
        a_const: BigNumber = new BigNumber("1000000000000"),
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
        ).toBe(new BigNumber("3000000").toNumber()); //TODO: change to be calculated from inputs
        return true;
      }
      beforeAll(async () => {
        inputs = [
          {
            asset: tokens.kUSD,
            in_amount: new BigNumber(10).pow(18).multipliedBy(input),
            rate: new BigNumber(10).pow(18 - 18),
          },
          {
            asset: tokens.USDtz,
            in_amount: new BigNumber(10).pow(6).multipliedBy(input),
            rate: new BigNumber(10).pow(18 - 6),
          },
          {
            asset: tokens.uUSD,
            in_amount: new BigNumber(10).pow(12).multipliedBy(input),
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
      it("Should fail if not admin try to add pool", async () =>
        await failCase(
          "bob",
          async () =>
            await dex.initializeExchange(a_const, tokens_count, inputs, true),
          "Dex/not-contract-admin"
        ));
      it("Should add new pool", async () =>
        await addNewPair("eve", a_const, tokens_count, inputs, true));
    });

    describe("2.2. Test pool administration", () => {
      let pool_id: BigNumber;
      beforeAll(async () => {
        await dex.updateStorage({});
        pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      });
      describe("2.2.1. Ramping A constant", () => {
        const future_a_const = new BigNumber("10000000000000000");
        const future_a_time = new BigNumber("86400");
        it("Should fail if not admin performs ramp A", async () =>
          await failCase(
            "bob",
            async () =>
              await dex.contract.methods.rampA(
                pool_id,
                future_a_const,
                future_a_time
              ).send(),
            "Dex/not-contract-admin"
          ));
        it.todo("Should ramp A");
        it(
          "Should fail if not admin performs stopping ramp A",
          async () =>
            await failCase(
              "bob",
              async () =>
                await dex.contract.methods
                  .stopRampA(pool_id)
                  .send(),
              "Dex/not-contract-admin"
            )
        );
        it.todo("Should stop ramp A");
      });
      describe("2.2.2 Setting fees", () => {
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
        it("Should fail if not admin try to set new fee", async () =>
          await failCase(
            "bob",
            async () => await dex.setFees(pool_id, fees),
            "Dex/not-contract-admin"
          ));
        it("Should change fees", async () =>
          await setFeesSuccessCase("eve", pool_id, fees));
      });
      describe("2.2.3 Setting proxy", () => {
        it(
          "Should fail if not admin try to set new proxy",
          async () => {
            const proxy: string = bobAddress;
            return await failCase(
              "bob",
              async () => await dex.contract.methods.setProxy(pool_id, proxy).send(),
              "Dex/not-contract-admin"
            )
          }
        );
        it("Should set proxy", async () => {
          let config = await prepareProviderOptions("eve");
          Tezos.setProvider(config);
          const proxy: string = bobAddress;
          await dex.updateStorage({ pools: [pool_id.toString()] });
          const init_proxy: string = dex.storage.storage.pools[pool_id.toString()].proxy_contract;
          const op = await dex.contract.methods.setProxy(pool_id, proxy).send();
          await confirmOperation(Tezos, op.hash);
          await dex.updateStorage({ pools: [pool_id.toString()] });
          const upd_proxy: string =
            dex.storage.storage.pools[pool_id.toString()].proxy_contract;
          expect(upd_proxy).toEqual(proxy);
          expect(upd_proxy).not.toEqual(init_proxy);
        });
        it("Should remove proxy", async () => {
          let config = await prepareProviderOptions("eve");
          Tezos.setProvider(config);
          const proxy: string = null;
          await dex.updateStorage({ pools: [pool_id.toString()] });
          const init_proxy: string = dex.storage.storage.pools[pool_id.toString()].proxy_contract;
          expect(init_proxy).not.toBeNull();
          await dex.contract.methods.setProxy(pool_id).send();
          await dex.updateStorage({ pools: [pool_id.toString()] });
          const upd_proxy: string =
            dex.storage.storage.pools[pool_id.toString()].proxy_contract;
          expect(upd_proxy).toBeNull();
        });
      });
      describe("2.2.4 Update proxy limits", () => {
        let limits: MichelsonMap<string, BigNumber>;


        beforeAll(async () => {
          limits = new MichelsonMap();
          await dex.updateStorage({ pools: [pool_id.toString()], tokens: [pool_id.toString()] })
          const tokens_map = dex.storage.storage.pools[
            pool_id.toNumber()
          ].virtual_reserves as any as MichelsonMap<string, BigNumber>;
          tokens_map.forEach((v, k) => {
            limits.set(k, new BigNumber(10).pow(6).multipliedBy(3).multipliedBy(k));
          })
          console.log(limits);
        })
        it("Should fail if not admin try to set new proxy limits",
          async () => {
            const proxy: string = bobAddress;
            return await failCase(
              "bob",
              async () =>
                await dex.contract.methods.updateProxyLimits(pool_id, limits).send(),
              "Dex/not-contract-admin"
            );
          });
        it("Should set proxy limits", async () => {
          let config = await prepareProviderOptions("eve");
          Tezos.setProvider(config);
          const op = await dex.contract.methods.updateProxyLimits(pool_id, limits).send();
          await confirmOperation(Tezos, op.hash);
          await dex.updateStorage({
            pools: [pool_id.toString()],
            tokens: [pool_id.toString()],
          });
          const upd_limits = dex.storage.storage.pools[pool_id.toNumber()].proxy_limits as any as MichelsonMap<string, BigNumber>;
          limits.forEach((v, k) => {
            expect(upd_limits.get(k)).toEqual(v);
          });
          
        });
      });
    })

      describe("2.3. Test invest liq", () => {
        let amounts: Map<string, BigNumber>;
        let min_shares: BigNumber;
        let pool_id: BigNumber;
        const input = new BigNumber(10).pow(6);
        const kUSDAmount = new BigNumber(10).pow(18).multipliedBy(input);
        const uUSDAmount = new BigNumber(10).pow(12).multipliedBy(input);
        const USDtzAmount = new BigNumber(10).pow(6).multipliedBy(input);
        const referral = aliceAddress;

        async function investLiquidity(
          sender,
          pool_id: BigNumber,
          referral: string,
          min_shares: BigNumber,
          in_amounts: Map<string, BigNumber>
        ) {
          let config = await prepareProviderOptions(sender);
          await global.Tezos.setProvider(config);
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
          const updatedLedger =
            dex.storage.storage.ledger[accounts[sender].pkh];
          expect(updatedLPBalance.toNumber()).toBeGreaterThan(
            initLPBalance.toNumber()
          );
          expect(
            updatedLedger.minus(initLedger).toNumber()
          ).toBeGreaterThanOrEqual(min_shares.toNumber()); //TODO: change to be calculated from inputs
        }

        beforeAll(async () => {
          const stp = await setupTokenAmounts(
            dex,
            USDtzAmount,
            kUSDAmount,
            uUSDAmount
          );
          amounts = stp.amounts;
          pool_id = stp.pool_id;
          min_shares = new BigNumber(1)//input.multipliedBy(amounts.size).minus(100);
        });

        it("Should fail if zero input", async () => {
          const zero_amounts: Map<string, BigNumber> = new Map<string, BigNumber>(
            Array.from(amounts.entries()).map(([k, v]) => [k, zero_amount])
          );
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
        it("Should invest liq balanced", async () => {
          return await investLiquidity(
            "bob",
            pool_id,
            referral,
            min_shares,
            amounts
          );
        });

        it.todo("Should invest liq imbalanced");
      });

      describe("2.4. Test swap", () => {
        let amounts: Map<string, BigNumber>;
        const normalized = new BigNumber("1");
        const kUSDAmount = new BigNumber(10).pow(18).multipliedBy(normalized);
        const uUSDAmount = new BigNumber(10).pow(12).multipliedBy(normalized);
        const USDtzAmount = new BigNumber(10).pow(6).multipliedBy(normalized);
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
            USDtzAmount,
            kUSDAmount,
            uUSDAmount
          );
          amounts = stp.amounts;
          pool_id = stp.pool_id;
          const tokens_map = dex.storage.storage.tokens[
            pool_id.toNumber()
          ] as any as Map<string, FA2TokenType | FA12TokenType>;
          let mapping = {} as any;
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
        });
        it.each([
          ["kUSD", "uUSD"],
          ["uUSD", "USDtz"],
          ["USDtz", "kUSD"],
        ])("Should fail if zero input [%s, %s]", async (t_in, t_to) => {
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
        });
        it.each([
          ["kUSD", "uUSD"],
          ["uUSD", "USDtz"],
          ["USDtz", "kUSD"],
        ])(
          `Should swap [${normalized.toString()} %s, ~ ${normalized.toString()} %s]`,
          async (t_in, t_to) => {
            const i = map_tokens_idx[t_in];
            const j = map_tokens_idx[t_to];
            await dex.updateStorage({ pools: [pool_id.toString()] });
            // console.log(dex.storage.storage.pools[pool_id.toString()]);
            const init_reserves = dex.storage.storage.pools[pool_id.toString()]
              .reserves as any as Map<string, BigNumber>;
            const in_amount = amounts.get(i);
            console.log(i, in_amount);
            let min_out = amounts.get(j);
            min_out = min_out.minus(min_out.multipliedBy(10).div(100));
            console.log(j, min_out);
            await dex.swap(
              pool_id,
              new BigNumber(i),
              new BigNumber(j),
              in_amount,
              min_out,
              referral,
              null
            );
            await dex.updateStorage({ pools: [pool_id.toString()] });
            const upd_reserves = dex.storage.storage.pools[pool_id.toString()]
              .reserves as any as Map<string, BigNumber>;
            expect(upd_reserves.get(i.toString())).toEqual(
              init_reserves.get(i.toString()).plus(amounts.get(i))
            );
            expect(upd_reserves.get(j.toString())).toEqual(
              init_reserves.get(j.toString()).minus(amounts.get(j))
            );
          }
        );
      });

      describe("2.5. Test divest liq", () => {
        let min_amounts: Map<string, BigNumber>;
        const kUSDAmount = new BigNumber("10000000000000000000");
        const uUSDAmount = new BigNumber("10000000000000");
        const USDtzAmount = new BigNumber("10000000");
        const normalized = new BigNumber("1");
        const amount_in = new BigNumber("30000");
        let pool_id: BigNumber;
        let map_tokens_idx: {
          kUSD: string;
          uUSD: string;
          USDtz: string;
        };

        async function divestLiquidity(
          sender,
          pool_id: BigNumber,
          shares: BigNumber,
          min_amounts: Map<string, BigNumber>
        ) {
          let config = await prepareProviderOptions(sender);
          await global.Tezos.setProvider(config);
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
          res.forEach((value, key) => (raw_res[key] = value.toFormat(0).toString()));
          console.log(raw_res);
          const v_res = dex.storage.storage.pools[pool_id.toNumber()]
            .virtual_reserves as any as MichelsonMap<string, BigNumber>;
          let virt_res = {};
          v_res.forEach(
            (value, key) => (virt_res[key] = value.toFormat(0).toString())
          );
          console.log(virt_res);
          console.log(initLPBalance);
          const init_ledger = dex.storage.storage.ledger[accounts[sender].pkh];
          console.log(init_ledger);
          await dex.divestLiquidity(pool_id, min_amounts, shares);
          await dex.updateStorage({
            pools: [pool_id.toString()],
            ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
          });
          const updatedLPBalance = new BigNumber(
            dex.storage.storage.pools[pool_id.toNumber()].total_supply
          );
          expect(updatedLPBalance.toNumber()).toBeLessThan(
            initLPBalance.toNumber()
          );
          console.log(
            dex.storage.storage.ledger[accounts[sender].pkh].toNumber()
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
            USDtzAmount,
            kUSDAmount,
            uUSDAmount
          );
          min_amounts = stp.amounts;
          pool_id = stp.pool_id;
          const tokens_map = dex.storage.storage.tokens[
            pool_id.toNumber()
          ] as any as Map<string, FA2TokenType | FA12TokenType>;
          let mapping = {} as any;
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
        });
        it("Should fail if zero input", async () => {
          await failCase(
            "eve",
            async () =>
              await dex.divestLiquidity(pool_id, min_amounts, new BigNumber("0")),
            "Dex/zero-amount-in"
          );
        });
        it("Should divest liq balanced", async () =>
          await divestLiquidity("eve", pool_id, amount_in, min_amounts));
        it.todo("Should divest liq imbalanced");
      });
    });

  describe("3. Testing Token endpoints", () => {
    let pool_id: BigNumber;
    const amount = new BigNumber("100000");
    beforeAll(async () => {
      pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
    });
    describe("3.1. Test transfer from self", () => {
      it("Should fail if low balance", async () => {
        await failCase(
          "alice",
          async () =>
            await dex.transfer(pool_id, aliceAddress, bobAddress, amount),
          "FA2_INSUFFICIENT_BALANCE"
        );
      });
      it("Should send from self", async () => {
        let config = await prepareProviderOptions("bob");
        Tezos.setProvider(config);
        await dex.transfer(pool_id, bobAddress, aliceAddress, amount);
      });
    });
    describe("3.2. Test approve", () => {
      it("Should fail send if not approved", async () => {
        await failCase(
          "bob",
          async () =>
            await dex.transfer(pool_id, aliceAddress, bobAddress, amount),
          "FA2_NOT_OPERATOR"
        );
      });
      it("Should update operator", async () => {
        let config = await prepareProviderOptions("alice");
        Tezos.setProvider(config);
        await dex.approve(bobAddress, amount);
      });
      it("Should send as operator", async () => {
        let config = await prepareProviderOptions("bob");
        Tezos.setProvider(config);
        await dex.transfer(pool_id, aliceAddress, bobAddress, amount);
      });
    });
  });

  describe.skip("4. Views", () => {
    let lambdaContract;
    let lambdaContractAddress;
    let pool_id: BigNumber;
    let map_tokens_idx: {
      kUSD: string;
      uUSD: string;
      USDtz: string;
    };
    beforeAll(async () => {
      const op = await Tezos.contract.originate({
        code: VIEW_LAMBDA.code,
        storage: VIEW_LAMBDA.storage,
      });
      await confirmOperation(Tezos, op.hash);
      lambdaContractAddress = op.contractAddress;
      lambdaContract = await Tezos.contract.at(lambdaContractAddress);
      await dex.updateStorage({})
      pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      await dex.updateStorage({ tokens: [pool_id.toString()], pools: [pool_id.toString()] });
      const tokens_map = dex.storage.storage.tokens[
        pool_id.toNumber()
      ] as any as Map<string, FA2TokenType | FA12TokenType>;
      let mapping = {} as any;
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
    });
    describe("4.1. Dex views", () => {

      it("Should return A", async () => {
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const exp_A = dex.storage.storage.pools[pool_id.toString()].initial_A;
        const a = await dex.contract.views
          .get_a(pool_id)
          .read(lambdaContractAddress);
        console.log(exp_A, a)
        expect(a.toNumber()).toEqual(exp_A.toNumber());
      });
      it("Should return fees", async () => {
        await dex.updateStorage({ pools: [pool_id.toString()] })
        const exp_fees: FeeType = dex.storage.storage.pools[pool_id.toString()].fee;
        const fees = await dex.contract.views
          .get_fees(pool_id)
          .read(lambdaContractAddress) as FeeType;
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
        console.log(exp_v_reserves.toString(), v_reserves.toString());
        expect(v_reserves).toMatchObject(exp_v_reserves);
      });
      it.todo("Should return min received");
      it("Should return dy", async () => {
        await dex.updateStorage({ pools: [pool_id.toString()] });
        const dx = new BigNumber(10).pow(18 + 6);
        const exp_dy = new BigNumber('1000000');
        const i = map_tokens_idx.kUSD;
        const j = map_tokens_idx.USDtz
        const dy = await dex.contract.views
          .get_dy(pool_id, i, j, dx)
          .read(lambdaContractAddress);
        console.log(exp_dy.toString(), dy.toString());
        expect(dy.toNumber()).toBeCloseTo(exp_dy.toNumber());
      });
      it.todo("Should return price");
    });
    describe("4.2.Token views", () => {
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
        console.log(dex.contract.views);
        const balances = await dex.contract.views
          .balance_of(accounts)
          .read(lambdaContractAddress);
        console.log(balances);
        expect(balances[0].balance.toNumber()).toBeGreaterThanOrEqual(0);
        expect(balances[1].balance.toNumber()).toBeGreaterThanOrEqual(0);
        expect(balances[2].balance.toNumber()).toBeGreaterThanOrEqual(0);
      });
      it("Should return total supply", async () => {
        const total_supply = await dex.contract.views
          .total_supply(pool_id)
          .read(lambdaContractAddress);
        console.log(total_supply);
        expect(total_supply.toNumber()).toBeGreaterThan(0);
      });
    });
  });
});
