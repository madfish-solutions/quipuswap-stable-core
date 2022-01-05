import BigNumber from "bignumber.js";

import {
  failCase,
  mapTokensToIdx,
  prepareProviderOptions,
  Tezos,
  TezosAddress,
} from "../scripts/helpers/utils";

import { API, cases as DexTests, constants, TokenSetups } from "./Dex";
const { decimals, a_const, accounts, zero_amount, swap_routes } = constants;
import {
  AmountsMap,
  FA12TokenType,
  FA2TokenType,
  IndexMap,
  TokensMap,
} from "./Dex/types";
import { TokenFA12, TokenFA2 } from "./Token";
import { defaultTokenId } from "./Token/token";

describe("dex", () => {
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
  let lambdaContractAddress: TezosAddress;

  const {
    before: TInit,
    admin: TMng,
    pools: TPool,
    rewards: TReward,
    permit: TPermit,
    views: TView,
  } = DexTests;

  // Contract will be deployed before every single test, to make sure we
  // do a proper unit test in a stateless testing process

  beforeAll(
    async () =>
      ({ dex, tokens, quipuToken, lambdaContractAddress } =
        await TInit.setupDexEnvironment(Tezos))
  );

  describe("1. Testing Admin endpoints", () => {
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
          await TMng.setAdminSuccessCase(dex, "alice", new_admin, Tezos),
        50000
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
        async () =>
          await TMng.setDevAddrSuccessCase(dex, "eve", new_dev, Tezos),
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
          await failCase(
            "bob",
            async () => dex.setDefaultReferral(aliceAddress),
            "Dex/not-contract-admin"
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
        rate: BigNumber;
        precision_multiplier: BigNumber;
      }[];
      const norm_input = new BigNumber(10).pow(6);

      beforeAll(async () => {
        inputs = await TPool.AddPool.manageInputs(norm_input, tokens);
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
          await TPool.AddPool.addNewPair(
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
                    TPool.PoolAdmin.Ramp_A.future_a_const,
                    TPool.PoolAdmin.Ramp_A.future_a_time
                  )
                  .send(),
              "Dex/not-contract-admin"
            ),
          10000
        );

        it(
          "should ramp A",
          async () =>
            await prepareProviderOptions("eve").then((config) => {
              Tezos.setProvider(config);
              return TPool.PoolAdmin.Ramp_A.rampASuccessCase(
                dex,
                pool_id,
                TPool.PoolAdmin.Ramp_A.future_a_const,
                new BigNumber(Date.now())
                  .plus(20)
                  .plus(TPool.PoolAdmin.Ramp_A.future_a_time)
              );
            }),
          30000
        );

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

        it("should stop ramp A", async () =>
          await prepareProviderOptions("eve").then((config) => {
            Tezos.setProvider(config);
            return TPool.PoolAdmin.Ramp_A.stopRampASuccessCase(dex, pool_id);
          }));
      });

      describe("2.2.2 Setting fees", () => {
        it(
          "should fail if not admin try to set new fee",
          async () =>
            await failCase(
              "bob",
              async () => await dex.setFees(pool_id, TPool.PoolAdmin.Fee.fees),
              "Dex/not-contract-admin"
            ),
          10000
        );

        it(
          "should change fees",
          async () =>
            await TPool.PoolAdmin.Fee.setFeesSuccessCase(
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
          await TPool.stake.stakeToPoolSuccessCase(
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
          ),
        10000
      );

      it(
        "should fail if wrong indexes",
        async () =>
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
          ),
        10000
      );

      it(
        "should invest liq balanced",
        async () =>
          await TPool.PoolInvest.investLiquiditySuccessCase(
            dex,
            sender,
            pool_id,
            referral,
            min_shares,
            amounts,
            Tezos
          ),
        50000
      );

      it("should invest liq imbalanced", async () => {
        await dex.updateStorage({
          tokens: [pool_id.toString()],
          pools: [pool_id.toString()],
        });
        const tokens_map = dex.storage.storage.tokens[pool_id.toNumber()];
        const idx_map = mapTokensToIdx(tokens_map, tokens);
        const USDtz_amt = amounts.get(idx_map.USDtz);
        const in_amt = amounts.set(idx_map.USDtz, new BigNumber(0));
        min_shares = min_shares.multipliedBy(2).dividedToIntegerBy(3);
        await TPool.PoolInvest.investLiquiditySuccessCase(
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
        await TPool.PoolInvest.investLiquiditySuccessCase(
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
          await failCase(
            "bob",
            async () =>
              await dex.swap(
                pool_id,
                new BigNumber(idx_map.uUSD),
                new BigNumber(idx_map.kUSD),
                decimals.uUSD.multipliedBy(normalized),
                new BigNumber(0),
                new Date(0),
                bobAddress,
                referral
              ),
            "Dex/time-expired"
          ),
        10000
      );

      it.each(swap_routes)(
        "should fail if zero input [%s, %s]",
        async (t_in, t_to) =>
          await failCase(
            "bob",
            async () =>
              await dex.swap(
                pool_id,
                new BigNumber(idx_map[t_in]),
                new BigNumber(idx_map[t_to]),
                zero_amount,
                new BigNumber(0),
                new Date(Date.now() + 1000 * 60 * 60 * 24),
                bobAddress,
                referral
              ),
            "Dex/zero-amount-in"
          ),
        10000
      );

      it.each(swap_routes)(
        `Should swap [${normalized.toString()} %s, ~ ${normalized.toString()} %s]`,
        async (t_in, t_to) =>
          await TPool.PoolSwap.swapSuccessCase(
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
          await failCase(
            "eve",
            async () =>
              await dex.divestLiquidity(
                pool_id,
                min_amounts,
                new BigNumber("0")
              ),
            "Dex/zero-amount-in"
          ),
        10000
      );

      it(
        "should divest liq balanced",
        async () =>
          await TPool.PoolDivest.divestLiquiditySuccessCase(
            dex,
            "eve",
            pool_id,
            amount_in,
            min_amounts,
            Tezos
          ),
        20000
      );

      it(
        "should divest liq imbalanced",
        async () =>
          await TPool.PoolDivest.divestLiquidityImbalanceSuccessCase(
            dex,
            "eve",
            pool_id,
            imb_amounts,
            amount_in,
            Tezos
          ),
        20000
      );

      it(
        "should divest liq in one coin",
        async () =>
          await TPool.PoolDivest.divestLiquidityOneSuccessCase(
            dex,
            "eve",
            pool_id,
            amount_in,
            new BigNumber(idx_map.kUSD),
            min_out_amount,
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
          await failCase(
            "bob",
            async () =>
              await dex.transfer(pool_id, bobAddress, aliceAddress, amount),
            "FA2_INSUFFICIENT_BALANCE"
          ),
        10000
      );

      it(
        "should send from self",
        async () =>
          await prepareProviderOptions("alice").then((config) => {
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
          await failCase(
            "bob",
            async () =>
              await dex.transfer(pool_id, aliceAddress, bobAddress, amount),
            "FA2_NOT_OPERATOR"
          ),
        10000
      );

      it(
        "should update operator",
        async () =>
          await prepareProviderOptions("alice").then((config) => {
            Tezos.setProvider(config);
            return dex.approve(bobAddress, amount);
          }),
        20000
      );

      it(
        "should send as operator",
        async () =>
          await prepareProviderOptions("bob").then((config) => {
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
        await TView.pool.getASuccessCase(dex, pool_id));

      it("should return fees", async () =>
        await TView.pool.getFeesSuccessCase(dex, pool_id));

      it("should return reserves", async () =>
        await TView.pool.getReservesSuccessCase(dex, pool_id));

      it("should return token map", async () =>
        await TView.pool.getTokenMapSuccessCase(
          dex,
          pool_id,
          tokens,
          map_tokens_idx
        ));

      it("should return dy", async () =>
        await TView.pool.getDySuccessCase(dex, pool_id, map_tokens_idx));

      it("should fail when return dy because of pool_id", async () =>
        await failCase(
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
          'The simulation of the on-chain view named get_dy failed with: {"string":"Dex/not-launched"}'
        ));

      it("should return LP value", async () =>
        await TView.pool.getLPValueSuccessCase(dex, pool_id, map_tokens_idx));

      it("should return calc divest one", async () =>
        await TView.pool.calcDivestOneSuccessCase(
          dex,
          {
            pool_id: pool_id,
            token_amount: new BigNumber(10).pow(18).times(100),
            i: new BigNumber(map_tokens_idx.uUSD),
          },
          map_tokens_idx
        ));

      it("should return referral rewards", async () =>
        await TView.pool.getRefRewardsSuccessCase(dex, [
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
        await TView.pool.getStkrInfoSuccessCase(dex, [
          {
            user: staker,
            pool_id: pool_id,
          },
        ]));
    });

    describe("4.2.Token views", () => {
      it("should return balance of account", async () =>
        await dex.contract.views
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
          .read(lambdaContractAddress)
          .then((balances) => {
            expect(balances[0].balance.toNumber()).toBeGreaterThanOrEqual(0);
            expect(balances[1].balance.toNumber()).toBeGreaterThanOrEqual(0);
            expect(balances[2].balance.toNumber()).toBeGreaterThanOrEqual(0);
          }));

      it("should return total supply", async () =>
        await dex.contract.views
          .total_supply(pool_id)
          .read(lambdaContractAddress)
          .then((total_supply) => {
            expect(total_supply.toNumber()).toStrictEqual(
              dex.storage.storage.pools[
                pool_id.toString()
              ].total_supply.toNumber()
            );
          }));
    });
  });

  describe("5 Test unstake QUIPU token from pool", () => {
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
        await TPool.stake.unstakeFromPoolSuccessCase(
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

    describe("6.1. Referral reward", () => {
      it(
        "should get referral rewards",
        async () =>
          await TReward.referral.getReferralRewardsSuccessCase(
            dex,
            tokens,
            pool_id,
            batchTimes,
            referral,
            lambdaContractAddress,
            Tezos
          ),
        30000
      );
    });

    describe("6.2. QT stakers reward", () => {
      it(
        "should harvest staking rewards",
        async () =>
          await prepareProviderOptions("bob").then((config) => {
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
        await TReward.developer.getDeveloperRewardsSuccessCase(
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

  describe("7. Permits", () => {
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

    describe("7.1 Standart Permit", () => {
      it(`${signer} generates permit payload, ${receiver} submits test to contract`, async () =>
        (paramHash = await TPermit.addPermitFromSignerByReceiverSuccessCase(
          dex,
          signer,
          receiver,
          permitTransferParams
        )));

      it(`${sender} calls contract entrypoint on ${signer}'s behalf`, async () =>
        await TPermit.usePermit(
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

    describe("7.2 Timeout Permit", () => {
      it(`${signer} generates permit, ${receiver} submits test, ${signer} sets expiry`, async () =>
        await TPermit.setWithExpiry(
          dex,
          signer,
          sender,
          transferParamsTimeExpiry
        ));

      it(`${sender} calls entrypoint on ${signer}'s behalf, but its too late`, async () =>
        await new Promise((r) => setTimeout(r, 60000)).then(() =>
          failCase(
            sender,
            async () =>
              await dex.contract.methods
                .transfer(transferParamsTimeExpiry)
                .send(),
            "EXPIRED_PERMIT"
          )
        ));
    });
  });
});
