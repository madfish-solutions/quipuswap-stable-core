import BigNumber from "bignumber.js";

import {
  FA12TokenType,
  FA2TokenType,
  failCase,
  mapTokensToIdx,
  prepareProviderOptions,
  Tezos,
  TezosAddress,
} from "../utils/helpers";

import { API, cases as DexTests } from "./Dex";
import * as constants from "../utils/constants";
import * as TokenSetups from "./utils/tokensSetups";
const { decimals, a_const, accounts, zero_amount, swap_routes, dev_fee } =
  constants;
import { AmountsMap, IndexMap, TokensMap } from "./utils/types";
import { TokenFA12, TokenFA2 } from "./Token";
import { defaultTokenId } from "./Token/token";
import { Contract } from "@taquito/taquito";

describe("00. Standalone Dex", () => {
  const aliceAddress: TezosAddress = accounts.alice.pkh;
  const bobAddress: TezosAddress = accounts.bob.pkh;
  const eveAddress: TezosAddress = accounts.eve.pkh;

  const new_admin = eveAddress;
  const new_dev = bobAddress;
  const manager = aliceAddress;
  const staker = bobAddress;
  const referral = eveAddress;

  let tokens: TokensMap;

  let dex: API.DexAPI;
  let quipuToken: TokenFA2;

  const {
    before: TInit,
    admin: TMng,
    pools: TPool,
    rewards: TReward,
    views: TView,
    strategy: TStrategy,
  } = DexTests;

  // Contract will be deployed before every single test, to make sure we
  // do a proper unit test in a stateless testing process

  beforeAll(
    async () =>
      ({ dex, tokens, quipuToken } = await TInit.setupDexEnvironment(Tezos))
  );

  describe("1. Testing Admin endpoints", () => {
    describe("1.1. Test setting new admin", () => {
      it(
        "should fail if not admin try to set admin",
        async () =>
          failCase("bob", dex.setAdmin(new_admin), "not-contract-admin"),
        10000
      );

      it(
        "should change admin",
        async () => TMng.setAdminSuccessCase(dex, "alice", new_admin, Tezos),
        50000
      );
    });

    describe("1.2. Test setting new dev params", () => {
      it(
        "should fail if not dev try to set dev_address",
        async () =>
          await failCase(
            "bob",
            async () => dex.setDevAddress(new_dev),
            "not-developer"
          ),
        10000
      );

      it(
        "should fail if not dev try to set fee",
        async () =>
          failCase("bob", async () => dex.setDevFee(dev_fee), "not-developer"),
        20000
      );

      it(
        "should change dev address",
        async () => TMng.setDevAddrSuccessCase(dex, "eve", new_dev, Tezos),
        20000
      );

      it(
        "should change dev fee",
        async () => TMng.setDevFeeSuccessCase(dex, "bob", dev_fee, Tezos),
        20000
      );
    });

    describe("1.3. Test setting managers", () => {
      it(
        "should fail if not admin try set manager",
        async () =>
          failCase(
            "bob",
            dex.addRemManager(true, manager),
            "not-contract-admin"
          ),
        10000
      );

      it(
        "should set new manager",
        async () =>
          await TMng.updateManagersSuccessCase(
            dex,
            "eve",
            manager,
            true,
            Tezos
          ),
        20000
      );

      it(
        "should remove manager",
        async () =>
          await TMng.updateManagersSuccessCase(
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
          failCase(
            "bob",
            dex.setDefaultReferral(aliceAddress),
            "not-contract-admin"
          ),
        10000
      );

      it("should change default referral", async () =>
        await TMng.setDefaultRefSuccessCase(dex, "eve", aliceAddress, Tezos));
    });
  });

  describe("2. Testing Pools endpoints", () => {
    describe("2.1. Test adding new pool", () => {
      let inputs: {
        asset: TokenFA2 | TokenFA12;
        in_amount: BigNumber;
        rate_f: BigNumber;
        precision_multiplier_f: BigNumber;
      }[];
      const norm_input = new BigNumber(10).pow(6);

      beforeAll(async () => {
        inputs = await TPool.AddPool.manageInputs(norm_input, tokens);
      }, 80000);

      it(
        "should fail if not admin try to add pool",
        async () =>
          failCase(
            "alice",
            dex.addPool(a_const, inputs, false),
            "not-contract-admin"
          ),
        10000
      );

      it(
        "should add new pool",
        async () =>
          await TPool.AddPool.addNewPair(
            dex,
            "eve",
            a_const,
            norm_input,
            inputs,
            false,
            Tezos
          ),
        30000
      );
    });

    describe("2.2. Test pool administration", () => {
      let pool_id: BigNumber;

      beforeAll(async () => {
        await dex.updateStorage({});
        pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      }, 80000);

      describe("2.2.1. Ramping A constant", () => {
        it(
          "should fail if not admin performs ramp A",
          async () =>
            failCase(
              "bob",
              dex.contract.methods
                .ramp_A(
                  pool_id,
                  TPool.PoolAdmin.Ramp_A.future_a_const.toString(),
                  TPool.PoolAdmin.Ramp_A.future_a_time.toString()
                )
                .send(),
              "not-contract-admin"
            ),
          10000
        );

        it(
          "should ramp A",
          async () =>
            prepareProviderOptions("eve").then((config) => {
              Tezos.setProvider(config);
              return TPool.PoolAdmin.Ramp_A.rampASuccessCase(
                dex,
                pool_id,
                TPool.PoolAdmin.Ramp_A.future_a_const,
                TPool.PoolAdmin.Ramp_A.future_a_time
              );
            }),
          50000
        );

        it(
          "should fail if not admin performs stopping ramp A",
          async () =>
            failCase(
              "bob",
              dex.contract.methods.stop_ramp_A(pool_id).send(),
              "not-contract-admin"
            ),
          10000
        );

        it("should stop ramp A", async () =>
          prepareProviderOptions("eve").then((config) => {
            Tezos.setProvider(config);
            return TPool.PoolAdmin.Ramp_A.stopRampASuccessCase(dex, pool_id);
          }));
      });

      describe("2.2.2 Setting fees", () => {
        it(
          "should fail if not admin try to set new fee",
          async () =>
            failCase(
              "bob",
              dex.setFees(pool_id, TPool.PoolAdmin.Fee.fees),
              "not-contract-admin"
            ),
          10000
        );

        it(
          "should change fees",
          async () =>
            TPool.PoolAdmin.Fee.setFeesSuccessCase(
              dex,
              "eve",
              pool_id,
              TPool.PoolAdmin.Fee.fees,
              Tezos
            ),
          20000
        );
      });
    });

    describe("2.3. Test stake QUIPU to pool", () => {
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
        `should stake ${input.dividedBy(decimals.QUIPU)} QUIPU to pool`,
        async () =>
          TPool.stake.stakeToPoolSuccessCase(
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
      let zero_amounts: Map<string, BigNumber>;
      let wrong_idx_amounts: Map<string, BigNumber>;

      beforeAll(async () => {
        const config = await prepareProviderOptions(sender);
        Tezos.setProvider(config);
        const stp = await TokenSetups.setupTokenAmounts(dex, tokens, inputs);
        amounts = stp.amounts;
        pool_id = stp.pool_id;
        min_shares = new BigNumber(1); //input.multipliedBy(amounts.size).minus(100);
        wrong_idx_amounts = new Map<string, BigNumber>(
          Array.from(amounts.entries()).map(([k, v]) => [
            new BigNumber(k).plus("5").toString(),
            v,
          ])
        );
        zero_amounts = new Map<string, BigNumber>(
          Array.from(amounts.entries()).map(([k]) => [k, zero_amount])
        );
      }, 80000);

      it(
        "should fail if zero input",
        async () =>
          failCase(
            sender,
            dex.investLiquidity(
              pool_id,
              zero_amounts,
              min_shares,
              new Date(Date.now() + 1000 * 60 * 60 * 24),
              null,
              referral
            ),
            "zero-amount-in"
          ),
        10000
      );

      it(
        "should fail if expired",
        async () =>
          failCase(
            sender,
            dex.investLiquidity(
              pool_id,
              amounts,
              min_shares,
              new Date(0),
              null,
              referral
            ),
            "time-expired"
          ),
        10000
      );

      it(
        "should fail if wrong indexes",
        async () =>
          failCase(
            sender,
            async () =>
              dex.investLiquidity(
                pool_id,
                wrong_idx_amounts,
                min_shares,
                new Date(Date.now() + 1000 * 60 * 60 * 24),
                null,
                referral
              ),
            "zero-amount-in"
          ),
        10000
      );

      it(
        "should invest liq balanced",
        async () =>
          TPool.PoolInvest.investLiquiditySuccessCase(
            dex,
            sender,
            pool_id,
            referral,
            min_shares,
            amounts,
            new Date(Date.now() + 1000 * 60 * 60 * 24),
            Tezos
          ),
        50000
      );

      // eslint-disable-next-line jest/prefer-expect-assertions
      it("should invest liq imbalanced", async () => {
        await dex.updateStorage({
          tokens: [pool_id.toString()],
          pools: [pool_id.toString()],
        });
        const tokens_map = dex.storage.storage.tokens[pool_id.toNumber()];
        const idx_map = mapTokensToIdx(tokens_map, tokens);
        const USDtz_amt = amounts.get(idx_map.USDtz.toString());
        const in_amt = amounts.set(idx_map.USDtz.toString(), new BigNumber(0));
        //min_shares = min_shares.multipliedBy(2).dividedToIntegerBy(3);
        await TPool.PoolInvest.investLiquiditySuccessCase(
          dex,
          sender,
          pool_id,
          referral,
          min_shares,
          in_amt,
          new Date(Date.now() + 1000 * 60 * 60 * 24),
          Tezos
        );
        const USDtz_in = new Map<string, BigNumber>().set(
          idx_map.USDtz.toString(),
          USDtz_amt
        );
        //min_shares = min_shares.dividedToIntegerBy(2);
        await TPool.PoolInvest.investLiquiditySuccessCase(
          dex,
          sender,
          pool_id,
          referral,
          min_shares,
          USDtz_in,
          new Date(Date.now() + 1000 * 60 * 60 * 24),
          Tezos
        );
      });
    });

    describe("2.5. Test swap", () => {
      const sender = "bob";
      const normalized = new BigNumber(10).pow(2);
      const inputs: AmountsMap = {
        kUSD: decimals.kUSD.multipliedBy(normalized),
        uUSD: decimals.uUSD.multipliedBy(normalized),
        USDtz: decimals.USDtz.multipliedBy(normalized),
      };

      let pool_id: BigNumber;
      let amounts: Map<string, BigNumber>;
      let idx_map: IndexMap;

      beforeAll(
        async () =>
          ({ pool_id, amounts, idx_map } =
            await TPool.PoolSwap.setupTokenMapping(dex, tokens, inputs)),
        80000
      );

      it(
        "should fail if expired",
        async () =>
          failCase(
            "bob",
            dex.swap(
              pool_id,
              new BigNumber(idx_map.uUSD),
              new BigNumber(idx_map.kUSD),
              decimals.uUSD.multipliedBy(normalized),
              new BigNumber(0),
              new Date(0),
              bobAddress,
              referral
            ),
            "time-expired"
          ),
        10000
      );

      it.each(swap_routes)(
        "should fail if zero input [%s, %s]",
        async (t_in, t_to) =>
          failCase(
            "bob",
            dex.swap(
              pool_id,
              new BigNumber(idx_map[t_in]),
              new BigNumber(idx_map[t_to]),
              zero_amount,
              new BigNumber(1),
              new Date(Date.now() + 1000 * 60 * 60 * 24),
              bobAddress,
              referral
            ),
            "zero-amount-in"
          ),
        10000
      );

      it.each(swap_routes)(
        `should swap [${normalized.toString()} %s, ~ ${normalized.toString()} %s]`,
        async (t_in, t_to) =>
          TPool.PoolSwap.swapSuccessCase(
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
            Tezos
          ),
        40000
      );
    });

    describe("2.6. Test divest liq", () => {
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
          await TPool.PoolDivest.setupMinTokenMapping(dex, tokens, outputs));
        imb_amounts = new Map<string, BigNumber>();
        imb_amounts.set(idx_map.USDtz, new BigNumber(0));
        imb_amounts.set(idx_map.kUSD, outputs.kUSD);
        imb_amounts.set(idx_map.uUSD, outputs.uUSD);
      }, 80000);

      it(
        "should fail if zero input",
        async () =>
          failCase(
            "eve",
            dex.divestLiquidity(
              pool_id,
              min_amounts,
              new BigNumber("0"),
              new Date(Date.now() + 1000 * 60 * 60 * 24),
              null
            ),
            "zero-amount-in"
          ),
        10000
      );

      it(
        "should fail if expired",
        async () =>
          failCase(
            "eve",
            dex.divestLiquidity(
              pool_id,
              min_amounts,
              amount_in,
              new Date(0),
              null
            ),
            "time-expired"
          ),
        10000
      );

      it(
        "should divest liq balanced",
        async () =>
          TPool.PoolDivest.divestLiquiditySuccessCase(
            dex,
            "eve",
            pool_id,
            amount_in,
            min_amounts,
            new Date(Date.now() + 1000 * 60 * 60 * 24),
            Tezos
          ),
        20000
      );

      it(
        "should divest liq imbalanced",
        async () =>
          TPool.PoolDivest.divestLiquidityImbalanceSuccessCase(
            dex,
            "eve",
            pool_id,
            imb_amounts,
            amount_in,
            new Date(Date.now() + 1000 * 60 * 60 * 24),
            Tezos
          ),
        20000
      );

      it(
        "should divest liq in one coin",
        async () =>
          TPool.PoolDivest.divestLiquidityOneSuccessCase(
            dex,
            "eve",
            pool_id,
            amount_in,
            new BigNumber(idx_map.kUSD),
            min_out_amount,
            new Date(Date.now() + 1000 * 60 * 60 * 24),
            Tezos
          ),
        20000
      );
    });
  });

  describe("3. Testing Token endpoints", () => {
    let pool_id: BigNumber;
    const amount = new BigNumber("100000");

    beforeAll(
      async () =>
        (pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1))),
      80000
    );

    describe("3.1. Test transfer from self", () => {
      it(
        "should fail if low balance",
        async () =>
          failCase(
            "bob",
            dex.transfer(pool_id, bobAddress, aliceAddress, amount),
            "FA2_INSUFFICIENT_BALANCE"
          ),
        10000
      );

      it(
        "should send from self",
        async () =>
          prepareProviderOptions("alice").then((config) => {
            Tezos.setProvider(config);
            return dex.transfer(pool_id, aliceAddress, bobAddress, amount);
          }),
        20000
      );
    });

    describe("3.2. Test approve", () => {
      it(
        "should fail send if not approved",
        async () =>
          failCase(
            "bob",
            dex.transfer(pool_id, aliceAddress, bobAddress, amount),
            "FA2_NOT_OPERATOR"
          ),
        10000
      );

      it(
        "should update operator",
        async () =>
          prepareProviderOptions("alice").then((config) => {
            Tezos.setProvider(config);
            return dex.approve(bobAddress, amount);
          }),
        20000
      );

      it(
        "should send as operator",
        async () =>
          prepareProviderOptions("bob").then((config) => {
            Tezos.setProvider(config);
            return dex.transfer(pool_id, aliceAddress, bobAddress, amount);
          }),
        20000
      );
    });
  });

  describe("4. Views", () => {
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

    describe("4.1. Dex views", () => {
      it("should return A", async () =>
        TView.pool.getASuccessCase(dex, pool_id));

      it("should return fees", async () =>
        TView.pool.getFeesSuccessCase(dex, pool_id));

      it("should return reserves", async () =>
        TView.pool.getReservesSuccessCase(dex, pool_id));

      it("should return token map", async () =>
        TView.pool.getTokenMapSuccessCase(
          dex,
          pool_id,
          tokens,
          map_tokens_idx
        ));

      it("should return dy", async () =>
        TView.pool.getDySuccessCase(dex, pool_id, map_tokens_idx));

      it("should fail when return dy because of pool_id", async () =>
        failCase(
          "bob",
          async () => {
            const params = {
              pool_id: pool_id.plus(3),
              i: map_tokens_idx.USDtz,
              j: map_tokens_idx.uUSD,
              dx: new BigNumber(10000000000),
            };
            return dex.contract.contractViews
              .get_dy(params)
              .executeView({ viewCaller: accounts["alice"].pkh });
          },
          'The simulation of the on-chain view named get_dy failed with: {"string":"not-launched"}'
        ));

      it("should return LP value", async () =>
        TView.pool.getLPValueSuccessCase(dex, pool_id, map_tokens_idx));

      it("should return calc divest one", async () =>
        TView.pool.calcDivestOneSuccessCase(
          dex,
          {
            pool_id: pool_id,
            token_amount: new BigNumber(10).pow(18),
            i: new BigNumber(map_tokens_idx.uUSD),
          },
          map_tokens_idx
        ));

      it("should return referral rewards", async () =>
        TView.pool.getRefRewardsSuccessCase(dex, [
          {
            user: referral,
            token: {
              fa2: {
                token_address: tokens.uUSD.contract.address,
                token_id: new BigNumber(defaultTokenId),
              },
            } as FA2TokenType,
          },
          {
            user: referral,
            token: { fa12: tokens.USDtz.contract.address } as FA12TokenType,
          },
          {
            user: referral,
            token: { fa12: tokens.kUSD.contract.address } as FA12TokenType,
          },
        ]));

      it("should return staker info", async () =>
        TView.pool.getStkrInfoSuccessCase(dex, [
          {
            user: staker,
            pool_id: pool_id,
          },
        ]));
    });

    describe("4.2.Token views", () => {
      it("should return balance of account", async () =>
        dex.contract.views
          .balance_of([
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
          ])
          .read()
          .then((balances) => {
            expect(balances[0].balance.toNumber()).toBeGreaterThanOrEqual(0);
            expect(balances[1].balance.toNumber()).toBeGreaterThanOrEqual(0);
            expect(balances[2].balance.toNumber()).toBeGreaterThanOrEqual(0);
          }));

      it("should return total supply", async () =>
        dex.contract.views
          .total_supply(pool_id)
          .read()
          .then((total_supply) => {
            expect(total_supply.toNumber()).toStrictEqual(
              dex.storage.storage.pools[
                pool_id.toString()
              ].total_supply.toNumber()
            );
          }));
    });
  });

  describe("5. Test unstake QUIPU token from pool", () => {
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
        TPool.stake.unstakeFromPoolSuccessCase(
          dex,
          staker,
          pool_id,
          output,
          Tezos
        ),
      30000
    );
  });

  describe("6. Testing rewards separation", () => {
    let pool_id: BigNumber;
    const batchTimes = 5;
    const referral = "eve";
    let dev_address: TezosAddress;

    beforeAll(async () => {
      await dex.updateStorage({});
      dev_address = dex.storage.storage.dev_store.dev_address;
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

    describe("6.1. Referral reward", () => {
      it(
        "should get referral rewards",
        async () =>
          TReward.referral.getReferralRewardsSuccessCase(
            dex,
            tokens,
            pool_id,
            batchTimes,
            referral,
            Tezos
          ),
        60000
      );
    });

    describe("6.2. QT stakers reward", () => {
      it(
        "should harvest staking rewards",
        async () =>
          prepareProviderOptions("bob").then((config) => {
            Tezos.setProvider(config);
            return TReward.staker.harvestFromPoolSuccessCase(
              dex,
              staker,
              pool_id,
              Tezos
            );
          }),
        20000
      );
    });

    describe("6.3. Developer reward", () => {
      it("should get dev rewards", async () =>
        TReward.developer.getDeveloperRewardsSuccessCase(
          dex,
          tokens,
          pool_id,
          batchTimes,
          dev_address,
          Tezos
        ));
    });
  });

  describe("7. Testing strategy", () => {
    let pool_id: BigNumber;
    let yupana: Contract;
    let price_feed: Contract;
    let strategy_factory: Contract;
    let strategy: Contract;
    let yup_ordering: IndexMap;
    let pool_ordering: IndexMap;

    beforeAll(async () => {
      pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
      await dex.updateStorage({ tokens: [pool_id.toString()] });
      ({
        yupana,
        ordering: yup_ordering,
        price_feed,
      } = await TInit.setupYupanaMocks(tokens, Tezos));
      ({ strategy_factory, strategy } = await TInit.originateStrategy(
        dex,
        pool_id,
        yupana,
        price_feed,
        Tezos
      ));
      pool_ordering = mapTokensToIdx(
        dex.storage.storage.tokens[pool_id.toString()],
        tokens
      );
      // eslint-disable-next-line jest/no-standalone-expect
      await expect(strategy.storage()).resolves.toMatchObject({
        factory: strategy_factory.address,
      });
    });

    describe("as a developer", () => {
      let min_amounts: Map<string, BigNumber>;
      let invest_amounts: Map<string, BigNumber>;
      let imb_amounts: Map<string, BigNumber>;
      const normalized: BigNumber = new BigNumber(10).pow(3); // 3K
      const min_out_amount: BigNumber = decimals.kUSD
        .multipliedBy(normalized)
        .multipliedBy("1e6")
        .multipliedBy(3)
        .minus(
          decimals.kUSD
            .multipliedBy(normalized)
            .multipliedBy("1e6")
            .multipliedBy(3)
            .dividedBy(100)
        );
      const outputs: AmountsMap = {
        kUSD: decimals.kUSD.multipliedBy(normalized),
        uUSD: decimals.uUSD.multipliedBy(normalized),
        USDtz: decimals.USDtz.multipliedBy(normalized),
      };
      const amount_in = new BigNumber(10)
        .pow(18)
        .multipliedBy(normalized)
        .multipliedBy(2)
        .multipliedBy("1e6");
      let idx_map: IndexMap;

      beforeAll(async () => {
        ({ pool_id, min_amounts, idx_map } =
          await TPool.PoolDivest.setupMinTokenMapping(dex, tokens, outputs));
        imb_amounts = new Map<string, BigNumber>()
          .set(idx_map.USDtz, outputs.USDtz.multipliedBy("1e5").multipliedBy(5))
          .set(idx_map.kUSD, new BigNumber(0))
          .set(idx_map.uUSD, outputs.uUSD.multipliedBy("1e5").multipliedBy(5));
        invest_amounts = new Map<string, BigNumber>()
          .set(idx_map.USDtz, outputs.USDtz.multipliedBy("1e6"))
          .set(idx_map.kUSD, outputs.kUSD.multipliedBy("1e6"))
          .set(idx_map.uUSD, outputs.uUSD.multipliedBy("1e6"));
        min_amounts = new Map<string, BigNumber>()
          .set(idx_map.USDtz, new BigNumber(1))
          .set(idx_map.kUSD, new BigNumber(1))
          .set(idx_map.uUSD, new BigNumber(1));
        const config = await prepareProviderOptions("bob");
        Tezos.setProvider(config);
        await dex.investLiquidity(
          pool_id,
          invest_amounts,
          new BigNumber(1),
          new Date(Date.now() + 1000 * 60 * 60 * 24)
        );
      });

      const test_factory = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";

      it("should connect and remove test strategy factory", async () =>
        TMng.addStrategyFactorySuccessCase(dex, test_factory).then(() =>
          TMng.removeStrategyFactorySuccessCase(dex, test_factory)
        ));

      it("should connect new strategy factory", async () =>
        TMng.addStrategyFactorySuccessCase(dex, strategy_factory.address));

      it("should fail when set rebalance flag to non cofigured token", async () =>
        failCase(
          "bob",
          dex.setTokenStrategyRebalance(
            pool_id,
            new BigNumber(pool_ordering.kUSD),
            false
          ),
          "no-token-strategy-set"
        ));

      it("should configure new strategy for token", async () =>
        TStrategy.token.configureTokenStrategy
          .setStrategyParamsSuccessCase(
            dex,
            pool_id,
            new BigNumber(pool_ordering.kUSD),
            new BigNumber("0.3").multipliedBy("1e18"),
            new BigNumber("0.005").multipliedBy("1e18"),
            new BigNumber("300").multipliedBy(decimals.kUSD)
          )
          .then(() =>
            TStrategy.token.configureTokenStrategy.setStrategyParamsSuccessCase(
              dex,
              pool_id,
              new BigNumber(pool_ordering.uUSD),
              new BigNumber("0.15").multipliedBy("1e18"),
              new BigNumber("0.003").multipliedBy("1e18"),
              new BigNumber("1500").multipliedBy(decimals.uUSD)
            )
          ));

      it("should fail connect token to NO strategy", async () =>
        TStrategy.token.connectTokenToStrategy.connectTokenStrategyFailCaseNoStrategy(
          dex,
          pool_id,
          new BigNumber(pool_ordering.kUSD),
          new BigNumber(yup_ordering.kUSD)
        ));

      it("should connect new strategy", async () =>
        TStrategy.connect.setStrategyAddrSuccessCase(
          dex,
          pool_id,
          strategy.address
        ));

      it("should connect token to strategy", async () =>
        TStrategy.token.connectTokenToStrategy
          .connectTokenStrategySuccessCase(
            dex,
            pool_id,
            new BigNumber(pool_ordering.kUSD),
            new BigNumber(yup_ordering.kUSD)
          )
          .then(() =>
            TStrategy.token.connectTokenToStrategy.connectTokenStrategySuccessCase(
              dex,
              pool_id,
              new BigNumber(pool_ordering.uUSD),
              new BigNumber(yup_ordering.uUSD)
            )
          ));

      it("should fail connect same token to strategy", async () =>
        TStrategy.token.connectTokenToStrategy.connectTokenStrategyFailCaseAdded(
          dex,
          pool_id,
          new BigNumber(pool_ordering.kUSD),
          new BigNumber(yup_ordering.kUSD)
        ));

      it("should call manual rebalance", async () =>
        TStrategy.token.manualRebalanceToken.manualRebalanceSuccessCase(
          dex,
          yupana,
          strategy,
          pool_id,
          new Set([
            new BigNumber(pool_ordering.kUSD),
            new BigNumber(pool_ordering.uUSD),
          ])
        ));

      it("should auto-rebalance when swap", async () =>
        TStrategy.autoRebalance.swapRebalanceSuccessCase(
          dex,
          yupana,
          strategy,
          pool_id,
          {
            i: new BigNumber(pool_ordering.kUSD),
            j: new BigNumber(pool_ordering.uUSD),
          }
        ));

      it("should auto-rebalance when invest", async () =>
        TStrategy.autoRebalance.investRebalanceSuccessCase(
          dex,
          yupana,
          strategy,
          pool_id,
          invest_amounts
        ));

      it("should auto-rebalance when divest imbalance", async () =>
        TStrategy.autoRebalance.divestImbalanceRebalanceSuccessCase(
          dex,
          yupana,
          strategy,
          pool_id,
          imb_amounts,
          amount_in
        ));

      it("should auto-rebalance when divest one", async () =>
        TStrategy.autoRebalance.divestOneRebalanceSuccessCase(
          dex,
          yupana,
          strategy,
          pool_id,
          new BigNumber(pool_ordering.kUSD),
          outputs.kUSD.multipliedBy("1e5").multipliedBy(5),
          min_out_amount
        ));

      it("should set is rebalance flag for token", async () =>
        TStrategy.token.setStrategyRebalance.setIsRebalanceSuccessCase(
          dex,
          pool_id,
          new BigNumber(pool_ordering.kUSD),
          false
        ));

      it("should auto-rebalance when divest", async () => {
        const sender = await Tezos.signer.publicKeyHash();
        const request: { owner: TezosAddress; token_id: number } = {
          owner: sender,
          token_id: pool_id.toNumber(),
        };
        const lp_balance_response: {
          request: typeof request;
          balance: BigNumber;
        }[] = await dex.contract.contractViews
          .get_balance([request])
          .executeView({ viewCaller: sender });
        await TStrategy.autoRebalance.divestRebalanceSuccessCase(
          dex,
          yupana,
          strategy,
          pool_id,
          min_amounts,
          new BigNumber(lp_balance_response[0].balance).minus("1000000")
        );
      });

      it("should configure strategy for token to zero", async () =>
        TStrategy.token.configureTokenStrategy
          .setStrategyParamsToZeroSuccessCase(
            dex,
            pool_id,
            new BigNumber(pool_ordering.kUSD)
          )
          .then(() =>
            TStrategy.token.configureTokenStrategy.setStrategyParamsToZeroSuccessCase(
              dex,
              pool_id,
              new BigNumber(pool_ordering.uUSD)
            )
          ));

      it("should call manual rebalance after set to zero", async () =>
        TStrategy.token.manualRebalanceToken.manualRebalanceSuccessCase(
          dex,
          yupana,
          strategy,
          pool_id,
          new Set([
            new BigNumber(pool_ordering.kUSD),
            new BigNumber(pool_ordering.uUSD),
          ])
        ));

      it("should disconnect strategy", async () =>
        TStrategy.connect.removeStrategyAddrSuccessCase(dex, pool_id));
    });

    describe("as a non-developer", () => {
      beforeAll(async () => {
        const config = await prepareProviderOptions("eve");
        Tezos.setProvider(config);
      });

      // eslint-disable-next-line jest/prefer-expect-assertions
      it("should fail when non-developer call the stategy EP", async () => {
        await failCase(
          "eve",
          async () =>
            await dex.setTokenStrategyRebalance(
              pool_id,
              new BigNumber(pool_ordering.kUSD),
              false
            ),
          "not-developer"
        );
        await failCase(
          "eve",
          async () => await dex.connectStrategy(pool_id, strategy.address),
          "not-developer"
        );
        await failCase(
          "eve",
          async () =>
            await dex.connectTokenStrategy(
              pool_id,
              new BigNumber(pool_ordering.kUSD),
              new BigNumber(0)
            ),
          "not-developer"
        );
        await failCase(
          "eve",
          async () =>
            await dex.setTokenStrategy(
              pool_id,
              new BigNumber(pool_ordering.kUSD),
              new BigNumber("0.3").multipliedBy("1e18"),
              new BigNumber("0.05").multipliedBy("1e18"),
              new BigNumber("300").multipliedBy("1e6")
            ),
          "not-developer"
        );
        const set = new Set([new BigNumber(pool_ordering.kUSD)]);
        await failCase(
          "eve",
          async () => await dex.rebalance(pool_id, set),
          "not-developer"
        );
      });
    });
  });
});
