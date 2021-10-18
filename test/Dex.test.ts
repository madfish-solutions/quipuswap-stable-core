import { Dex } from "./helpers/dexFA2";
import BigNumber from "bignumber.js";
import { sandbox } from "../config.json";
import { prepareProviderOptions, AccountsLiteral } from "./helpers/utils";
import { rejects } from "assert";
import { FeeType } from "./helpers/types";
import storage from "./storage/Dex";

const accounts = sandbox.accounts;

describe("Dex", () => {
  let dex: Dex;
  let dex_contract;
  const aliceAddress: string = accounts.alice.pkh;
  const bobAddress: string = accounts.bob.pkh;
  const eveAddress: string = accounts.eve.pkh;

  // Contract will be deployed before every single test, to make sure we
  // do a proper unit test in a stateless testing process
  beforeAll(async () => {
    storage.storage.admin = aliceAddress;
    storage.storage.dev_address = eveAddress;
    dex_contract = await global.deployContract("Dex.ligo", storage);
    console.log(dex_contract.address);
    dex = await Dex.init(dex_contract.address);
    return true;
  });

  function failCase(
    decription: string,
    sender: AccountsLiteral,
    act,
    errorMsg: string
  ) {
    test(decription, async function () {
      let config = await prepareProviderOptions(sender);
      global.Tezos.setProvider(config);
      console.log(config);
      console.log(global.Tezos);
      rejects(act(), (err: any) => {
        if (err.message == errorMsg) return true;
        else throw err;
      });
    });
  }

  describe("Testing Admin endpoints", () => {
    function setAdminSuccessCase(
      decription: string,
      sender: AccountsLiteral,
      admin: string
    ) {
      test(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        console.log(config);
        console.log(global.Tezos);
        await dex.updateStorage({});
        const initAdmin = dex.storage.storage.admin;

        await dex.setAdmin(admin);
        await dex.updateStorage({});
        const updatedAdmin = dex.storage.storage.admin;
        expect(admin).toEqual(updatedAdmin);
      });
    }

    function updateManagersSuccessCase(decription, sender, manager, add) {
      test(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await dex.updateStorage({});
        console.log(config);
        console.log(global.Tezos);
        const initManagers = dex.storage.storage.managers;

        await dex.addRemManager(add, manager);
        await dex.updateStorage({});
        const updatedManagers = dex.storage.storage.managers;
        expect(updatedManagers.includes(manager)).toBe(add);
      });
    }

    function setDevAddrSuccessCase(
      decription: string,
      sender: AccountsLiteral,
      dev: string
    ) {
      test(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await dex.updateStorage({});
        console.log(config);
        console.log(global.Tezos);
        const initDev = dex.storage.storage.dev_address;

        await dex.setDevAddress(dev);
        await dex.updateStorage({});
        const updatedDev = dex.storage.storage.dev_address;
        expect(dev).toEqual(updatedDev);
      });
    }

    function setFeesSuccessCase(
      decription: string,
      sender: AccountsLiteral,
      pool_id: BigNumber,
      fees: FeeType
    ) {
      test(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        console.log(config);
        console.log(global.Tezos);
        await dex.updateStorage();
        const initFees = dex.storage.storage.pools[pool_id.toString()].fee;
        await dex.setFees(pool_id, fees);
        await dex.updateStorage();
        const updatedFees = dex.storage.storage.pools[pool_id.toString()].fee as FeeType;
        for (let i in updatedFees) {
          console.log(i);
          expect(updatedFees[i].toNumber()).toEqual(fees[i].toNumber());
        }
        expect(updatedFees.lp_fee.toNumber()).toEqual(fees.lp_fee.toNumber());
        expect(updatedFees.stakers_fee.toNumber()).toEqual(fees.stakers_fee.toNumber());
        expect(updatedFees.ref_fee.toNumber()).toEqual(fees.ref_fee.toNumber());
        expect(updatedFees.dev_fee.toNumber()).toEqual(fees.dev_fee.toNumber());
      });
    }
    describe("Test setting new admin", () => {
      failCase(
        "should fail if not admin try to set admin",
        "bob",
        async () => await dex.setAdmin(eveAddress),
        "Dex/not-contact-admin"
      );
      setAdminSuccessCase("should change admin", "alice", eveAddress);
    });

    describe("Test setting new dev_address", () => {
      failCase(
        "should fail if not admin try to set dev_address",
        "bob",
        async () => await dex.setDevAddress(eveAddress),
        "Dex/not-contact-admin"
      );
      setDevAddrSuccessCase("should change dev address", "alice", eveAddress);
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

    describe("Test setting managers", () => {
      failCase(
        "should fail if not admin try set manager",
        "bob",
        async () => await dex.addRemManager(true, aliceAddress),
        "Dex/not-contact-admin"
      );
      updateManagersSuccessCase(
        "should set new manager",
        "eve",
        aliceAddress,
        true
      );
      updateManagersSuccessCase(
        "should remove manager",
        "eve",
        aliceAddress,
        false
      );
    });
  });

  describe("Testing Pools endpoints", () => {
    function addNewPair(
      decription: string,
      sender: AccountsLiteral,
      admin: string
    ) {
      test(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        console.log(config);
        console.log(global.Tezos);
        await dex.updateStorage({});
        const initPairCount = new BigNumber(dex.storage.storage.pools_count);

        await dex.addPair(admin);
        await dex.updateStorage({});
        const updatedPairCount = new BigNumber(dex.storage.storage.pools_count);
        expect(initPairCount.toNumber() + 1).toEqual(
          updatedPairCount.toNumber()
        );
      });
    }

    function investLiquidity(decription, sender, pool_id, params) {
      test(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await dex.updateStorage({});
        console.log(config);
        console.log(global.Tezos);
        const initLPBalance = new BigNumber(dex.storage.storage.pools[pool_id].total_supply);

        await dex.addLiqidity(pair_id, manager);
        await dex.updateStorage({});
        const updatedManagers = dex.storage.storage.managers;
        expect(updatedManagers.includes(manager)).toBe(add);
      });
    }

    function setDevAddrSuccessCase(
      decription: string,
      sender: AccountsLiteral,
      dev: string
    ) {
      test(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await dex.updateStorage({});
        console.log(config);
        console.log(global.Tezos);
        const initDev = dex.storage.storage.dev_address;

        await dex.setDevAddress(dev);
        await dex.updateStorage({});
        const updatedDev = dex.storage.storage.dev_address;
        expect(dev).toEqual(updatedDev);
      });
    }

    function setFeesSuccessCase(
      decription: string,
      sender: AccountsLiteral,
      pool_id: BigNumber,
      fees: FeeType
    ) {
      test(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        console.log(config);
        console.log(global.Tezos);
        await dex.updateStorage();
        const initFees = dex.storage.storage.pools[pool_id.toString()].fee;
        await dex.setFees(pool_id, fees);
        await dex.updateStorage();
        const updatedFees = dex.storage.storage.pools[pool_id.toString()]
          .fee as FeeType;
        for (let i in updatedFees) {
          console.log(i);
          expect(updatedFees[i].toNumber()).toEqual(fees[i].toNumber());
        }
        expect(updatedFees.lp_fee.toNumber()).toEqual(fees.lp_fee.toNumber());
        expect(updatedFees.stakers_fee.toNumber()).toEqual(
          fees.stakers_fee.toNumber()
        );
        expect(updatedFees.ref_fee.toNumber()).toEqual(fees.ref_fee.toNumber());
        expect(updatedFees.dev_fee.toNumber()).toEqual(fees.dev_fee.toNumber());
      });
    }
    describe("Test setting new admin", () => {
      failCase(
        "should fail if not admin try to set admin",
        "bob",
        async () => await dex.setAdmin(eveAddress),
        "Dex/not-contact-admin"
      );
      setAdminSuccessCase("should change admin", "alice", eveAddress);
    });

    describe("Test setting new dev_address", () => {
      failCase(
        "should fail if not admin try to set dev_address",
        "bob",
        async () => await dex.setDevAddress(eveAddress),
        "Dex/not-contact-admin"
      );
      setDevAddrSuccessCase("should change dev address", "alice", eveAddress);
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

    describe("Test setting managers", () => {
      failCase(
        "should fail if not admin try set manager",
        "bob",
        async () => await dex.addRemManager(true, aliceAddress),
        "Dex/not-contact-admin"
      );
      updateManagersSuccessCase(
        "should set new manager",
        "eve",
        aliceAddress,
        true
      );
      updateManagersSuccessCase(
        "should remove manager",
        "eve",
        aliceAddress,
        false
      );
    });
  });

  test.todo("it should be views here");
});
