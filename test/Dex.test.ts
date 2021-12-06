import BigNumber from "bignumber.js";
import { MichelsonMap } from "@taquito/taquito";
import { failCase } from "./fail-test";
import { Dex } from "./helpers/dexFA2";

import { mapTokensToIdx, prepareProviderOptions, Tezos } from "./helpers/utils";

import * as DexTests from "./Dex";
import { AmountsMap, IndexMap } from "./Dex/types";
import { FA12TokenType, FA2TokenType } from "./helpers/types";
import { TokenFA2 } from "./helpers/tokenFA2";
const { decimals, a_const, accounts, zero_amount, swap_routes } =
  DexTests.constants;

describe("Dex", () => {
  global.startTime = new Date();

  const aliceAddress: string = accounts.alice.pkh;
  const bobAddress: string = accounts.bob.pkh;
  const eveAddress: string = accounts.eve.pkh;

  const new_admin = eveAddress;
  const new_dev = bobAddress;
  const manager = aliceAddress;
  const staker = bobAddress;

  let tokens: DexTests.types.TokensMap;
  let dex: Dex;
  let quipuToken: TokenFA2;
  let lambdaContractAddress: string;

  // Contract will be deployed before every single test, to make sure we
  // do a proper unit test in a stateless testing process

  beforeAll(
    async () =>
      ({ dex, tokens, quipuToken, lambdaContractAddress } =
        await DexTests.before.setupDexEnvironment(Tezos))
  );

  describe("1. Testing Admin endpoints", () => {
    const adm = DexTests.admin;
    describe("1.1. Test setting new admin", () => {
      it(
        "Should fail if not admin try to set admin",
        async () =>
          await failCase(
            "bob",
            async () => await dex.setAdmin(new_admin),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it(
        "Should change admin",
        async () =>
          await adm.setAdminSuccessCase(dex, "alice", new_admin, Tezos),
        30000
      );
    });
    describe("1.2. Test setting new dev_address", () => {
      it(
        "Should fail if not admin try to set dev_address",
        async () =>
          await failCase(
            "bob",
            async () => dex.setDevAddress(new_dev),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it(
        "Should change dev address",
        async () => await adm.setDevAddrSuccessCase(dex, "eve", new_dev, Tezos),
        20000
      );
    });

    describe("1.3. Test setting managers", () => {
      it(
        "Should fail if not admin try set manager",
        async () =>
          await failCase(
            "bob",
            async () => dex.addRemManager(true, manager),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it(
        "Should set new manager",
        async () =>
          await adm.updateManagersSuccessCase(dex, "eve", manager, true, Tezos),
        20000
      );
      it(
        "Should remove manager",
        async () =>
          await adm.updateManagersSuccessCase(
            dex,
            "eve",
            manager,
            false,
            Tezos
          ),
        20000
      );
    });
    describe("1.4. Test default referral", () => {
      it(
        "Should fail if not admin try change default referral",
        async () =>
          await failCase(
            "bob",
            async () => dex.setDefaultReferral(aliceAddress),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it("Should change default referral", async () =>
        await adm.setDefaultRefSuccessCase(dex, "eve", aliceAddress, Tezos));
    });
    describe("1.5. Test DeFi reward rates", () => {
      const rate = new BigNumber(10_00000);
      it(
        "Should fail if not admin try set DeFi reward rates",
        async () =>
          await failCase(
            "bob",
            async () => dex.setRewardRate(rate),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it(
        "Should fail if try set DeFi reward rates above 100%",
        async () =>
          await failCase(
            "eve",
            async () => dex.setRewardRate(new BigNumber(100_00001)),
            "Dex/wrong-precision"
          ),
        10000
      );
      it("Should change DeFi reward rates", async () =>
        await adm.setAdminRateSuccessCase(dex, "eve", rate, Tezos));
    });
  });

  describe("2. Testing Pools endpoints", () => {
    const pool = DexTests.pools;

    describe("2.1. Test adding new pool", () => {
      let inputs: any[];
      const norm_input = new BigNumber(10).pow(6);
      beforeAll(async () => {
        inputs = await pool.AddPool.manageInputs(norm_input, tokens);
      }, 80000);
      it(
        "Should fail if not admin try to add pool",
        async () =>
          await failCase(
            "alice",
            async () => await dex.initializeExchange(a_const, inputs, false),
            "Dex/not-contract-admin"
          ),
        10000
      );
      it(
        "Should add new pool",
        async () =>
          await pool.AddPool.addNewPair(
            dex,
            "eve",
            a_const,
            norm_input,
            inputs,
            false,
            Tezos
          ),
        20000
      );
    });

    describe("2.2. Test pool administration", () => {
      const adm = pool.PoolAdmin;
      let pool_id: BigNumber;
      beforeAll(async () => {
        await dex.updateStorage({});
        pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      }, 80000);
      describe("2.2.1. Ramping A constant", () => {
        it(
          "Should fail if not admin performs ramp A",
          async () =>
            await failCase(
              "bob",
              async () =>
                await dex.contract.methods
                  .rampA(
                    pool_id,
                    adm.RampA.future_a_const,
                    adm.RampA.future_a_time
                  )
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
        const adm_fee = adm.Fee;
        it(
          "Should fail if not admin try to set new fee",
          async () =>
            await failCase(
              "bob",
              async () => await dex.setFees(pool_id, adm_fee.fees),
              "Dex/not-contract-admin"
            ),
          10000
        );
        it(
          "Should change fees",
          async () =>
            await adm_fee.setFeesSuccessCase(
              dex,
              "eve",
              pool_id,
              adm_fee.fees,
              Tezos
            ),
          20000
        );
      });
      describe("2.2.3 Setting proxy", () => {
        const adm_proxy = adm.Proxy;
        it("Should fail if not admin try to set new proxy", async () => {
          const proxy: string = bobAddress;
          return await failCase(
            "bob",
            async () =>
              await dex.contract.methods.setProxy(pool_id, proxy).send(),
            "Dex/not-contract-admin"
          );
        }, 10000);
        it(
          "Should set proxy",
          async () => await adm_proxy.setProxySuccessCase(dex, pool_id, Tezos),
          20000
        );
        it(
          "Should remove proxy",
          async () =>
            await adm_proxy.removeProxySuccessCase(dex, pool_id, Tezos),
          20000
        );
      });
      describe("2.2.4 Update proxy limits", () => {
        const adm_proxy = adm.Proxy;
        let limits: MichelsonMap<string, BigNumber>;

        beforeAll(async () => {
          limits = await adm_proxy.setupLimits(dex, pool_id);
        }, 80000);
        it("Should fail if not admin try to set new proxy limits", async () => {
          return await failCase(
            "bob",
            async () =>
              await dex.contract.methods
                .updateProxyLimits(pool_id, "0", limits.get("0"))
                .send(),
            "Dex/not-contract-admin"
          );
        }, 10000);
        it(
          "Should set proxy limits",
          async () =>
            await adm_proxy.setupProxyLimitsSuccessCase(
              dex,
              pool_id,
              limits,
              Tezos
            ),
          20000
        );
      });
    });

    describe("2.3. Test stake QUIPU to pool", () => {
      const stake = pool.stake;
      const input = new BigNumber(10).pow(9);
      let pool_id: BigNumber;
      beforeAll(async () => {
        const config = await prepareProviderOptions("bob");
        Tezos.setProvider(config);
        await quipuToken.approve(dex.contract.address, input);
        await dex.updateStorage({});
        pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      }, 80000);
      it(
        "Should fail if zero stake amount",
        async () =>
          await failCase(
            "bob",
            async () =>
              await dex.contract.methods
                .stake(pool_id, new BigNumber(0))
                .send(),
            "Dex/zero-amount-in"
          ),
        10000
      );
      it(
        `Should stake ${input.dividedBy(decimals.QUIPU)} QUIPU to pool`,
        async () =>
          await stake.stakeToPoolSuccessCase(
            dex,
            staker,
            pool_id,
            input,
            Tezos
          ),
        20000
      );
    });

    describe("2.4. Test invest liq", () => {
      const invest = pool.PoolInvest;
      const sender = "alice";
      let amounts: Map<string, BigNumber>;
      let min_shares: BigNumber;
      let pool_id: BigNumber;
      const input = new BigNumber(10).pow(6);
      const inputs: AmountsMap = {
        kUSD: decimals.kUSD.multipliedBy(input),
        uUSD: decimals.uUSD.multipliedBy(input),
        USDtz: decimals.USDtz.multipliedBy(input),
      };
      const referral = aliceAddress;

      beforeAll(async () => {
        let config = await prepareProviderOptions(sender);
        Tezos.setProvider(config);
        const stp = await DexTests.TokenSetups.setupTokenAmounts(
          dex,
          tokens,
          inputs
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
        await invest.investLiquiditySuccessCase(
          dex,
          sender,
          pool_id,
          referral,
          min_shares,
          amounts,
          Tezos
        );
      }, 30000);

      it("Should invest liq imbalanced", async () => {
        await dex.updateStorage({
          tokens: [pool_id.toString()],
          pools: [pool_id.toString()],
        });
        const tokens_map = dex.storage.storage.tokens[
          pool_id.toNumber()
        ] as any as Map<string, FA2TokenType | FA12TokenType>;
        const idx_map = mapTokensToIdx(tokens_map, tokens);
        const USDtz_amt = amounts.get(idx_map.USDtz);
        let in_amt = amounts.set(idx_map.USDtz, new BigNumber(0));
        min_shares = min_shares.multipliedBy(2).dividedToIntegerBy(3);
        await invest.investLiquiditySuccessCase(
          dex,
          sender,
          pool_id,
          referral,
          min_shares,
          in_amt,
          Tezos
        );
        let USDtz_in = new Map<string, BigNumber>().set(
          idx_map.USDtz,
          USDtz_amt
        );
        min_shares = min_shares.dividedToIntegerBy(2);
        await invest.investLiquiditySuccessCase(
          dex,
          sender,
          pool_id,
          referral,
          min_shares,
          USDtz_in,
          Tezos
        );
      });
    });

    describe("2.5. Test swap", () => {
      const swap = pool.PoolSwap;
      const sender = "bob";
      const normalized = new BigNumber(10).pow(2);
      const inputs: AmountsMap = {
        kUSD: decimals.kUSD.multipliedBy(normalized),
        uUSD: decimals.uUSD.multipliedBy(normalized),
        USDtz: decimals.USDtz.multipliedBy(normalized),
      };
      const referral = eveAddress;

      let pool_id: BigNumber;
      let amounts: Map<string, BigNumber>;
      let idx_map: IndexMap;

      beforeAll(
        async () =>
          ({ pool_id, amounts, idx_map } = await swap.setupTokenMapping(
            dex,
            tokens,
            inputs
          )),
        80000
      );
      it("Should fail if expired", async () => {
        const i = idx_map.uUSD;
        const j = idx_map.kUSD;
        const min_out = new BigNumber(0);
        const exp = new Date(0);
        await failCase(
          "bob",
          async () =>
            await dex.swap(
              pool_id,
              new BigNumber(i),
              new BigNumber(j),
              decimals.uUSD.multipliedBy(normalized),
              min_out,
              exp,
              bobAddress,
              referral
            ),
          "Dex/time-expired"
        );
      }, 10000);
      it.each(swap_routes)(
        "Should fail if zero input [%s, %s]",
        async (t_in, t_to) => {
          const zero_amount = new BigNumber("0");
          const i = idx_map[t_in];
          const j = idx_map[t_to];
          const min_out = new BigNumber(0);
          const exp = new Date(Date.now() + 1000 * 60 * 60 * 24);
          await failCase(
            "bob",
            async () =>
              await dex.swap(
                pool_id,
                new BigNumber(i),
                new BigNumber(j),
                zero_amount,
                min_out,
                exp,
                bobAddress,
                referral
              ),
            "Dex/zero-amount-in"
          );
        },
        10000
      );
      it.each(swap_routes)(
        `Should swap [${normalized.toString()} %s, ~ ${normalized.toString()} %s]`,
        async (t_in, t_to) =>
          await swap.swapSuccessCase(
            dex,
            tokens,
            sender,
            pool_id,
            t_in,
            t_to,
            new Date(Date.now() + 1000 * 60 * 60 * 24),
            referral,
            idx_map,
            normalized,
            amounts,
            lambdaContractAddress,
            Tezos
          ),
        40000
      );
    });

    describe("2.6. Test divest liq", () => {
      const divesting = pool.PoolDivest;
      let min_amounts: Map<string, BigNumber>;
      let imb_amounts: Map<string, BigNumber>;
      const normalized: BigNumber = new BigNumber(10).pow(3); // 3K
      const min_out_amount: BigNumber = decimals.kUSD
        .multipliedBy(normalized)
        .multipliedBy(3)
        .minus(
          decimals.kUSD
            .multipliedBy(normalized)
            .multipliedBy(3)
            .multipliedBy(3)
            .dividedBy(100)
        ); // 3K kUSD tokens - 3% (slippage)
      const outputs: AmountsMap = {
        kUSD: decimals.kUSD.multipliedBy(normalized),
        uUSD: decimals.uUSD.multipliedBy(normalized),
        USDtz: decimals.USDtz.multipliedBy(normalized),
      };
      const amount_in = new BigNumber(10)
        .pow(18)
        .multipliedBy(normalized)
        .multipliedBy(3); // 3K LP tokens
      let pool_id: BigNumber;
      let idx_map: IndexMap;

      beforeAll(async () => {
        ({ pool_id, min_amounts, idx_map } =
          await divesting.setupMinTokenMapping(dex, tokens, outputs));
        imb_amounts = new Map<string, BigNumber>();
        imb_amounts.set(idx_map.USDtz, new BigNumber(0));
        imb_amounts.set(idx_map.kUSD, outputs.kUSD);
        imb_amounts.set(idx_map.uUSD, outputs.uUSD);
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
          await divesting.divestLiquiditySuccessCase(
            dex,
            "eve",
            pool_id,
            amount_in,
            min_amounts,
            Tezos
          ),
        20000
      );
      it("Should divest liq imbalanced", async () => {
        await divesting.divestLiquidityImbalanceSuccessCase(
          dex,
          "eve",
          pool_id,
          imb_amounts,
          amount_in,
          Tezos
        );
      });
      it("Should divest liq in one coin", async () => {
        await divesting.divestLiquidityOneSuccessCase(
          dex,
          "eve",
          pool_id,
          amount_in,
          new BigNumber(idx_map.kUSD),
          min_out_amount,
          Tezos
        );
      });
    });
    describe("2.7 Test unstake QUIPU token from pool", () => {
      const stake = pool.stake;
      const output = new BigNumber(10).pow(7);
      let pool_id: BigNumber;
      beforeAll(async () => {
        const config = await prepareProviderOptions("bob");
        Tezos.setProvider(config);
        await dex.updateStorage({});
        pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      }, 80000);
      it(
        `Should unstake ${output.dividedBy(
          decimals.QUIPU
        )} QUIPU tokens from pool`,
        async () =>
          await stake.unstakeFromPoolSuccessCase(
            dex,
            staker,
            pool_id,
            output,
            Tezos
          ),
        20000
      );
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
    const rew = DexTests.rewards;
    let pool_id: BigNumber;
    const batchTimes = 5;
    const referral = "eve";
    let dev_address: string;

    beforeAll(async () => {
      await dex.updateStorage({});
      dev_address = dex.storage.storage.dev_address;
      const amount = new BigNumber(10).pow(4);
      pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      const exp = new Date(Date.now() + 1000 * 60 * 60 * 24);
      await DexTests.pools.PoolSwap.batchSwap(
        dex,
        tokens,
        batchTimes,
        pool_id,
        amount,
        exp,
        accounts[referral].pkh,
        Tezos
      );
    });
    describe("4.1. Referral reward", () => {
      it("Should get referral rewards", async () =>
        await rew.referral.getReferralRewardsSuccessCase(
          dex,
          tokens,
          pool_id,
          batchTimes,
          referral,
          lambdaContractAddress,
          Tezos
        ));
    });
    describe("4.2. QT stakers reward", () => {
      it("Should harvest staking rewards", async () => {
        let config = await prepareProviderOptions("bob");
        Tezos.setProvider(config);
        await rew.staker.harvestFromPoolSuccessCase(
          dex,
          staker,
          pool_id,
          Tezos
        );
      });
    });

    describe("4.3. Developer reward", () => {
      it("Should get dev rewards", async () =>
        await rew.developer.getDeveloperRewardsSuccessCase(
          dex,
          tokens,
          pool_id,
          batchTimes,
          dev_address,
          lambdaContractAddress,
          Tezos
        ));
    });
  });

  describe("5. Views", () => {
    const views = DexTests.views;
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
      map_tokens_idx = mapTokensToIdx(tokens_map, tokens);
    }, 80000);
    describe("5.1. Dex views", () => {
      it("Should return A", async () =>
        await views.pool.getASuccessCase(dex, pool_id, lambdaContractAddress));
      it("Should return fees", async () =>
        await views.pool.getFeesSuccessCase(
          dex,
          pool_id,
          lambdaContractAddress
        ));
      it("Should return token info", async () =>
        await views.pool.getTokensInfoSuccessCase(
          dex,
          pool_id,
          lambdaContractAddress
        ));
      it.todo("Should return min received");
      it.skip("Should return dy", async () =>
        views.pool.getDySuccessCase(
          dex,
          pool_id,
          map_tokens_idx,
          lambdaContractAddress
        ));
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
  describe("6. Permits", () => {
    const permit = DexTests.permit;

    const signer = "bob";
    const receiver = "alice";
    const sender = "eve";

    const signer_account = accounts[signer];
    const receiver_account = accounts[receiver];
    const permitTransferParams = [
      {
        from_: signer_account.pkh,
        txs: [{ to_: receiver_account.pkh, token_id: 0, amount: 10 }],
      },
    ];
    let transferParamsTimeExpiry = [
      {
        from_: signer_account.pkh,
        txs: [{ to_: receiver_account.pkh, token_id: 0, amount: 15 }],
      },
    ];
    let paramHash: string;
    describe("6.1 Standart Permit", () => {
      it(`${signer} generates permit payload, ${receiver} submits it to contract`, async () => {
        paramHash = await permit.addPermitFromSignerByReceiverSuccessCase(
          dex,
          signer,
          receiver,
          permitTransferParams
        );
      });
      it(`${sender} calls contract entrypoint on ${signer}'s behalf`, async () =>
        await permit.usePermit(
          Tezos,
          dex,
          signer,
          sender,
          receiver,
          paramHash
        ));
      it(`${sender} can't use bob's transfer anymore`, async () =>
        await failCase(
          sender,
          async () =>
            await dex.contract.methods.transfer(permitTransferParams).send(),
          "FA2_NOT_OPERATOR"
        ));
    });
    describe("6.2 Timeout Permit", () => {
      it(`${signer} generates permit, ${receiver} submits it, ${signer} sets expiry`, async () =>
        await permit.setWithExpiry(
          dex,
          signer,
          sender,
          transferParamsTimeExpiry
        ));
      it(`${sender} calls entrypoint on ${signer}'s behalf, but its too late`, async () => {
        await new Promise((r) => setTimeout(r, 60000));
        return await failCase(
          sender,
          async () =>
            await dex.contract.methods
              .transfer(transferParamsTimeExpiry)
              .send(),
          "EXPIRED_PERMIT"
        );
      });
    });
  });
});
