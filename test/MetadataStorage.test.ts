import { Metadata } from "./helpers/metadataStorage";
import { strictEqual, ok, notStrictEqual, rejects } from "assert";
import { sandbox, outputDirectory } from "../config.json";
const accounts = sandbox.accounts;
import { prepareProviderOptions } from "./helpers/utils";
import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";
import { MetadataStorage } from "./helpers/types";
const standard = process.env.EXCHANGE_TOKEN_STANDARD;
const CMetadataStorage = "MetadataStorage.ligo";
if (standard !== "MIXED") {
  describe("MetadataStorage", () => {
    let metadataStorage: Metadata;
    const aliceAddress: string = accounts.alice.pkh;
    const bobAddress: string = accounts.bob.pkh;
    const eveAddress: string = accounts.eve.pkh;

    beforeAll(async () => {
      const storage = {
        owners: [aliceAddress],
        metadata: MichelsonMap.fromLiteral({
          "": Buffer.from("tezos-storage:here", "ascii").toString("hex"),
          here: Buffer.from(
            JSON.stringify({
              version: "v0.0.1",
              description: "Quipuswap Share Pool Token",
              name: "Quipu Token",
              authors: ["Madfish.Solutions"],
              homepage: "https://quipuswap.com/",
              source: {
                tools: ["Ligo", "Flextesa"],
                location: "https://ligolang.org/",
              },
              interfaces: ["TZIP-12", "TZIP-16"],
              errors: [],
              views: [],
              tokens: {
                dynamic: [
                  {
                    big_map: "token_metadata",
                  },
                ],
              },
            }),
            "ascii"
          ).toString("hex"),
        }),
      };
      const contract = await global.deployContract(CMetadataStorage, storage);
      metadataStorage = await Metadata.init(
        contract.address
      );
      return true;
    });

    function updateOwnerSuccessCase(decription, sender, owner, add) {
      it(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await metadataStorage.updateStorage({});
        const initOwners = metadataStorage.storage.owners;

        await metadataStorage.updateOwners(add, owner);
        await metadataStorage.updateStorage({});
        const updatedOwners = metadataStorage.storage.owners;
        strictEqual(updatedOwners.includes(owner), add);
      });
    }

    function updateMetadataSuccessCase(decription, sender, metadata) {
      it(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await metadataStorage.updateMetadata(metadata);
      });
    }

    function matadataFailCase(decription, sender, act, errorMsg) {
      it(decription, async function () {
        let config = await prepareProviderOptions(sender);
        global.Tezos.setProvider(config);
        await rejects(act(), (err: any) => {
          ok(err.message == errorMsg, "Error message mismatch");
          return true;
        });
      });
    }

    describe("Test update user's status permission", () => {
      matadataFailCase(
        "revert in case of updating by an unprivileged user",
        "bob",
        async () => metadataStorage.updateOwners(true, bobAddress),
        "MetadataStorage/permision-denied"
      );
      updateOwnerSuccessCase(
        "success in case of updating owner by one of the owners",
        "alice",
        bobAddress,
        true
      );
    });

    describe("Test update metadata permission", () => {
      matadataFailCase(
        "revert in case of updating by an unprivileged user",
        "eve",
        async () => metadataStorage.updateMetadata(
            MichelsonMap.fromLiteral({
              some: Buffer.from("new", "ascii").toString("hex"),
            })
          ),
        "MetadataStorage/permision-denied"
      );
      updateMetadataSuccessCase(
        "success in case of updating metadata by one of the owners",
        "alice",
        MichelsonMap.fromLiteral({
          some: Buffer.from("new", "ascii").toString("hex"),
        })
      );
    });

    describe("Test owner status update", () => {
      updateOwnerSuccessCase(
        "success in case of adding existed owner",
        "alice",
        bobAddress,
        true
      );
      updateOwnerSuccessCase(
        "success in case of removing unexisted owner",
        "alice",
        eveAddress,
        false
      );
      updateOwnerSuccessCase(
        "success in case of adding unexisted owner",
        "alice",
        eveAddress,
        true
      );
      updateOwnerSuccessCase(
        "success in case of removing existed owner",
        "alice",
        eveAddress,
        false
      );
    });
  });
}