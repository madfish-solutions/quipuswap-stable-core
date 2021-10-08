import { ContractAbstraction, ContractProvider } from "@taquito/taquito";
import { Dex } from "./helpers/dexFA2";
import BigNumber from "bignumber.js";
import { sandbox, outputDirectory } from "../config.json";
import { prepareProviderOptions, AccountsLiteral } from "./helpers/utils";
import { ok, rejects, strictEqual, notStrictEqual } from "assert";
import { FeeType } from "./helpers/types";
import storage from "./storage/Dex";

const accounts = sandbox.accounts;

describe("Dex", () => {
  let dex: Dex;
  let dex_contract: ContractAbstraction<ContractProvider>;
  const aliceAddress: string = accounts.alice.pkh;
  const bobAddress: string = accounts.bob.pkh;
  const eveAddress: string = accounts.eve.pkh;

  // Contract will be deployed before every single test, to make sure we
  // do a proper unit test in a stateless testing process
  beforeAll(async () => {
    storage.storage.admin = eveAddress;
    storage.storage.dev_address = aliceAddress;
    dex_contract = await global.deployContract("Dex.ligo", storage);
    dex = await Dex.init(dex_contract.address);
  });

  function failCase(
    decription: string,
    sender: AccountsLiteral,
    act,
    errorMsg: string
  ) {
    it(decription, async function () {
      let config = await prepareProviderOptions(sender);
      global.Tezos.setProvider(config);
      await rejects(act(), (err: any) => {
        ok(err.message == errorMsg, "Error message mismatch");
        return true;
      });
    });
  }

  describe("Testing Admin endpoints", () => {
    function setAdminSuccessCase(
      decription: string,
      sender: AccountsLiteral,
      admin: string
    ) {
      it(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await dex.updateStorage({});
        const initAdmin = dex.storage.storage.admin;

        await dex.setAdmin(admin);
        await dex.updateStorage({});
        const updatedAdmin = dex.storage.storage.admin;
        strictEqual(updatedAdmin, admin);
      });
    }

    function updateManagersSuccessCase(decription, sender, manager, add) {
      it(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await dex.updateStorage({});
        const initManagers = dex.storage.storage.managers;

        await dex.addRemManager(add, manager);
        await dex.updateStorage({});
        const updatedManagers = dex.storage.storage.managers;
        strictEqual(updatedManagers.includes(manager), add);
      });
    }

    function setDevAddrSuccessCase(
      decription: string,
      sender: AccountsLiteral,
      dev: string
    ) {
      it(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await dex.updateStorage({});
        const initDev = dex.storage.storage.dev_address;

        await dex.setDevAddress(dev);
        await dex.updateStorage({});
        const updatedDev = dex.storage.storage.dev_address;
        strictEqual(updatedDev, dev);
      });
    }
    function togglePubInitSuccessCase(
      decription: string,
      sender: AccountsLiteral
    ) {
      it(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await dex.updateStorage({});
        const initial: boolean = dex.storage.storage.is_public_init;

        await dex.togglePubInit();
        await dex.updateStorage({});
        const updated: boolean = dex.storage.storage.is_public_init;
        notStrictEqual(updated, initial);
      });
    }

    function setFeesSuccessCase(
      decription: string,
      sender: AccountsLiteral,
      fees: FeeType
    ) {
      it(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await dex.updateStorage();
        const initFees = dex.storage.storage.fee;
        await dex.setFees(fees);
        await dex.updateStorage();
        const updatedFees = dex.storage.storage.fee as FeeType;
        strictEqual(
          updatedFees.lp_fee.toNumber(),
          fees.lp_fee.toNumber()
        );
        strictEqual(
          updatedFees.stakers_fee.toNumber(),
          fees.stakers_fee.toNumber()
        );
        strictEqual(
          updatedFees.ref_fee.toNumber(),
          fees.ref_fee.toNumber()
        );
        strictEqual(
          updatedFees.dev_fee.toNumber(),
          fees.dev_fee.toNumber()
        );
      });
    }
    describe("Test setting new admin", () => {
      failCase(
        "should fail if not admin try to set admin",
        "bob",
        async () => dex.setAdmin(aliceAddress),
        "Dex/not-contact-admin"
      );
      setAdminSuccessCase("should change admin", "eve", aliceAddress);
    });

    describe("Test setting new dev_address", () => {
      failCase(
        "should fail if not admin try to set dev_address",
        "bob",
        async () => dex.setDevAddress(eveAddress),
        "Dex/not-contact-admin"
      );
      setDevAddrSuccessCase("should change dev address", "alice", eveAddress);
    });

    describe("Test setting new fees", () => {
      const fees: FeeType = {
        lp_fee: new BigNumber("1000000"),
        stakers_fee: new BigNumber("1000000"),
        ref_fee: new BigNumber("1000000"),
        dev_fee: new BigNumber("1000000"),
      };
      failCase(
        "should fail if not admin try to set fees",
        "bob",
        async () => dex.setFees(fees),
        "Dex/not-contact-admin"
      );
      setFeesSuccessCase("should change fees", "alice", fees);
    });

    describe("Test toggle public init flag", () => {
      failCase(
        "should fail if not admin try to toggle public init flag",
        "bob",
        async () => dex.togglePubInit(),
        "Dex/not-contact-admin"
      );
      togglePubInitSuccessCase("should change is_public_init flag", "alice");
    });

    describe("Test setting managers", () => {
      failCase(
        "should fail if not admin try set manager",
        "bob",
        async () => dex.addRemManager(true, eveAddress),
        "Dex/not-contact-admin"
      );
      updateManagersSuccessCase(
        "should set new manager",
        "alice",
        eveAddress,
        true
      );
      updateManagersSuccessCase(
        "should remove manager",
        "alice",
        eveAddress,
        false
      );
    });

    test("it should be views here", async () => {
      return true;
    });
  });
});
