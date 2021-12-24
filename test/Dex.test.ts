import BigNumber from "bignumber.js";

import {
  failCase,
  mapTokensToIdx,
  prepareProviderOptions,
  Tezos,
} from "./helpers/utils";

import { API, cases as DexTests, constants, TokenSetups } from "./Dex";
type Dex = API.DexAPI;
const { decimals, a_const, accounts, zero_amount, swap_routes } = constants;
import { AmountsMap, IndexMap, TokensMap } from "./Dex/types";
import { TokenFA12, TokenFA2 } from "./Token";

describe("dex", () => {
  global.startTime = new Date();

  const aliceAddress: string = accounts.alice.pkh;
  const bobAddress: string = accounts.bob.pkh;
  const eveAddress: string = accounts.eve.pkh;

  const new_admin = eveAddress;
  const new_dev = bobAddress;
  const manager = aliceAddress;
  const staker = bobAddress;

  let tokens: TokensMap;

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
        "should fail if not admin try to set admin",
        async () =>
          await failCase(
            "bob",
            async () => await dex.setAdmin(new_admin),
            "Dex/not-contract-admin"
          ),
        10000
      );

      it(
        "should change admin",
        async () =>
          await adm.setAdminSuccessCase(dex, "alice", new_admin, Tezos),
        30000
      );
    });

    describe("1.2. Test setting new dev_address", () => {
      it(
        "should fail if not admin try to set dev_address",
        async () =>
          await failCase(
            "bob",
            async () => dex.setDevAddress(new_dev),
            "Dex/not-contract-admin"
          ),
        10000
      );

      it(
        "should change dev address",
        async () => await adm.setDevAddrSuccessCase(dex, "eve", new_dev, Tezos),
        20000
      );
    });

    describe("1.3. Test setting managers", () => {
      it(
        "should fail if not admin try set manager",
        async () =>
          await failCase(
            "bob",
            async () => dex.addRemManager(true, manager),
            "Dex/not-contract-admin"
          ),
        10000
      );

      it(
        "should set new manager",
        async () =>
          await adm.updateManagersSuccessCase(dex, "eve", manager, true, Tezos),
        20000
      );

      it(
        "should remove manager",
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
        "should fail if not admin try change default referral",
        async () =>
          await failCase(
            "bob",
            async () => dex.setDefaultReferral(aliceAddress),
            "Dex/not-contract-admin"
          ),
        10000
      );

      it("should change default referral", async () =>
        await adm.setDefaultRefSuccessCase(dex, "eve", aliceAddress, Tezos));
    });
  });

  describe("2. Testing Pools endpoints", () => {
    const pool = DexTests.pools;

    describe("2.1. Test adding new pool", () => {
      let inputs: {
        asset: TokenFA2 | TokenFA12;
        in_amount: BigNumber;
        rate: BigNumber;
        precision_multiplier: BigNumber;
      }[];
      const norm_input = new BigNumber(10).pow(6);

      beforeAll(async () => {
        inputs = await pool.AddPool.manageInputs(norm_input, tokens);
      }, 80000);

      it(
        "should fail if not admin try to add pool",
        async () =>
          await failCase(
            "alice",
            async () => await dex.initializeExchange(a_const, inputs, false),
            "Dex/not-contract-admin"
          ),
        10000
      );

      it(
        "should add new pool",
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
          "should fail if not admin performs ramp A",
          async () =>
            await failCase(
              "bob",
              async () =>
                await dex.contract.methods
                  .ramp_A(
                    pool_id,
                    adm.Ramp_A.future_a_const,
                    adm.Ramp_A.future_a_time
                  )
                  .send(),
              "Dex/not-contract-admin"
            ),
          10000
        );

        it.todo("should ramp A");

        it(
          "should fail if not admin performs stopping ramp A",
          async () =>
            await failCase(
              "bob",
              async () =>
                await dex.contract.methods.stop_ramp_A(pool_id).send(),
              "Dex/not-contract-admin"
            ),
          10000
        );

        it.todo("should stop ramp A");
      });

      describe("2.2.2 Setting fees", () => {
        const adm_fee = adm.Fee;

        it(
          "should fail if not admin try to set new fee",
          async () =>
            await failCase(
              "bob",
              async () => await dex.setFees(pool_id, adm_fee.fees),
              "Dex/not-contract-admin"
            ),
          10000
        );

        it(
          "should change fees",
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
        "should fail if zero stake amount",
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
        const config = await prepareProviderOptions(sender);
        Tezos.setProvider(config);
        const stp = await TokenSetups.setupTokenAmounts(dex, tokens, inputs);
        amounts = stp.amounts;
        pool_id = stp.pool_id;
        min_shares = new BigNumber(1); //input.multipliedBy(amounts.size).minus(100);
      }, 80000);

      it("should fail if zero input", async () => {
        //expect.assertions(1);
        const zero_amounts: Map<string, BigNumber> = new Map<string, BigNumber>(
          Array.from(amounts.entries()).map(([k]) => [k, zero_amount])
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

      it("should fail if wrong indexes", async () => {
        //expect.assertions(1);
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

      it("should invest liq balanced", async () => {
        //expect.assertions(0);
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

      it("should invest liq imbalanced", async () => {
        //expect.assertions(0);
        await dex.updateStorage({
          tokens: [pool_id.toString()],
          pools: [pool_id.toString()],
        });
        const tokens_map = dex.storage.storage.tokens[pool_id.toNumber()];
        const idx_map = mapTokensToIdx(tokens_map, tokens);
        const USDtz_amt = amounts.get(idx_map.USDtz);
        const in_amt = amounts.set(idx_map.USDtz, new BigNumber(0));
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
        const USDtz_in = new Map<string, BigNumber>().set(
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

      it("should fail if expired", async () => {
        //expect.assertions(1);
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
        "should fail if zero input [%s, %s]",
        async (t_in, t_to) => {
          //expect.assertions(1);
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

      it("should fail if zero input", async () => {
        //expect.assertions(1);
        await failCase(
          "eve",
          async () =>
            await dex.divestLiquidity(pool_id, min_amounts, new BigNumber("0")),
          "Dex/zero-amount-in"
        );
      }, 10000);

      it("should divest liq balanced", async () => {
        //expect.assertions(0);
        await divesting.divestLiquiditySuccessCase(
          dex,
          "eve",
          pool_id,
          amount_in,
          min_amounts,
          Tezos
        );
      }, 20000);

      it("should divest liq imbalanced", async () => {
        //expect.assertions(0);
        await divesting.divestLiquidityImbalanceSuccessCase(
          dex,
          "eve",
          pool_id,
          imb_amounts,
          amount_in,
          Tezos
        );
      });

      it("should divest liq in one coin", async () => {
        //expect.assertions(0);
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

      it(`Should unstake ${output.dividedBy(
        decimals.QUIPU
      )} QUIPU tokens from pool`, async () => {
        //expect.assertions(0);
        await stake.unstakeFromPoolSuccessCase(
          dex,
          staker,
          pool_id,
          output,
          Tezos
        );
      }, 20000);
    });
  });

  describe("3. Testing Token endpoints", () => {
    let pool_id: BigNumber;
    const amount = new BigNumber("100000");

    beforeAll(async () => {
      pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
    }, 80000);

    describe("3.1. Test transfer from self", () => {
      it("should fail if low balance", async () => {
        //expect.assertions(1);
        await failCase(
          "bob",
          async () =>
            await dex.transfer(pool_id, bobAddress, aliceAddress, amount),
          "FA2_INSUFFICIENT_BALANCE"
        );
      }, 10000);

      it("should send from self", async () => {
        //expect.assertions(0);
        const config = await prepareProviderOptions("alice");
        Tezos.setProvider(config);
        await dex.transfer(pool_id, aliceAddress, bobAddress, amount);
      }, 20000);
    });

    describe("3.2. Test approve", () => {
      it("should fail send if not approved", async () => {
        //expect.assertions(1);
        await failCase(
          "bob",
          async () =>
            await dex.transfer(pool_id, aliceAddress, bobAddress, amount),
          "FA2_NOT_OPERATOR"
        );
      }, 10000);

      it("should update operator", async () => {
        //expect.assertions(0);
        const config = await prepareProviderOptions("alice");
        Tezos.setProvider(config);
        await dex.approve(bobAddress, amount);
      }, 20000);

      it("should send as operator", async () => {
        //expect.assertions(0);
        const config = await prepareProviderOptions("bob");
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
      it("should get referral rewards", async () => {
        //expect.assertions(0);
        await rew.referral.getReferralRewardsSuccessCase(
          dex,
          tokens,
          pool_id,
          batchTimes,
          referral,
          lambdaContractAddress,
          Tezos
        );
      });
    });

    describe("4.2. QT stakers reward", () => {
      it("should harvest staking rewards", async () => {
        //expect.assertions(0);
        const config = await prepareProviderOptions("bob");
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
      it("should get dev rewards", async () =>
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
      const tokens_map = dex.storage.storage.tokens[pool_id.toNumber()];
      map_tokens_idx = mapTokensToIdx(tokens_map, tokens);
    }, 80000);

    describe("5.1. Dex views", () => {
      it("should return A", async () =>
        await views.pool.getASuccessCase(dex, pool_id, lambdaContractAddress));

      it("should return fees", async () =>
        await views.pool.getFeesSuccessCase(
          dex,
          pool_id,
          lambdaContractAddress
        ));

      it("should return token info", async () =>
        await views.pool.getTokensInfoSuccessCase(
          dex,
          pool_id,
          lambdaContractAddress
        ));

      it.todo("should return min received");

      it("should return dy", async () => {
        //expect.assertions(0);
        await views.pool.getDySuccessCase(
          dex,
          pool_id,
          map_tokens_idx,
          lambdaContractAddress
        );
      });

      it.todo("should return price");
    });

    describe("5.2.Token views", () => {
      it("should return balance of account", async () => {
        //expect.assertions(0);
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

      it("should return total supply", async () => {
        //expect.assertions(0);
        const total_supply = await dex.contract.views
          .total_supply(pool_id)
          .read(lambdaContractAddress);
        await dex.updateStorage({
          pools: [pool_id.toString()],
        });
        expect(total_supply.toNumber()).toStrictEqual(
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
    const transferParamsTimeExpiry = [
      {
        from_: signer_account.pkh,
        txs: [{ to_: receiver_account.pkh, token_id: 0, amount: 15 }],
      },
    ];
    let paramHash: string;

    describe("6.1 Standart Permit", () => {
      it(`${signer} generates permit payload, ${receiver} submits it to contract`, async () => {
        //expect.assertions(0);
        paramHash = await permit.addPermitFromSignerByReceiverSuccessCase(
          dex,
          signer,
          receiver,
          permitTransferParams
        );
      });

      it(`${sender} calls contract entrypoint on ${signer}'s behalf`, async () => {
        //expect.assertions(0);
        await permit.usePermit(Tezos, dex, signer, sender, receiver, paramHash);
      });

      it(`${sender} can't use bob's transfer anymore`, async () => {
        //expect.assertions(1);
        await failCase(
          sender,
          async () =>
            await dex.contract.methods.transfer(permitTransferParams).send(),
          "FA2_NOT_OPERATOR"
        );
      });
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
        //expect.assertions(1);
        await new Promise((r) => setTimeout(r, 60000));
        await failCase(
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
