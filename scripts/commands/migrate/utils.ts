import fs from "fs";
import config from "../../../config";
import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { accounts } from "../../../test/Dex/constants";
import { confirmOperation } from "../../helpers/confirmation";
import { NetworkLiteral, TezosAddress } from "../../helpers/utils";

export const getMigrationsList = () => {
  if (!fs.existsSync(config.migrationsDir)) fs.mkdirSync(config.migrationsDir);
  return fs
    .readdirSync(config.migrationsDir)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.slice(0, file.length - 3));
};

export const runMigrations = async (
  network: NetworkLiteral,
  from: number,
  to: number
) => {
  try {
    const networkConfig = `http://${config.networks[network].host}:${config.networks[network].port}`;

    const tezos = new TezosToolkit(networkConfig);

    tezos.setProvider({
      signer: await InMemorySigner.fromSecretKey(accounts.alice.sk),
    });

    const migrations = getMigrationsList().filter(
      (value, idx) => idx >= from && idx <= to
    );
    for (const migration of migrations) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const func = require(`../../../${config.migrationsDir}/${migration}.ts`);
      await func(tezos);
    }
  } catch (e) {
    console.error(e);
  }
};

export async function migrate(
  tezos: TezosToolkit,
  directory: string,
  contract: string,
  storage: any,
  network: NetworkLiteral
): Promise<TezosAddress> {
  try {
    const artifacts = JSON.parse(
      fs.readFileSync(`${directory}/${contract}.json`).toString()
    );
    const operation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage,
      })
      .catch((e) => {
        console.error(JSON.stringify(e));

        return { contractAddress: null, hash: null };
      });

    await confirmOperation(tezos, operation.hash);

    artifacts.networks[network] = { [contract]: operation.contractAddress };

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }

    fs.writeFileSync(
      `${directory}/${contract}.json`,
      JSON.stringify(artifacts, null, 2)
    );

    return operation.contractAddress;
  } catch (e) {
    console.error(e);
  }
}
