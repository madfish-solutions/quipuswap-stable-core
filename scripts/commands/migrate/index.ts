import { Command } from "commander";
import { NetworkLiteral } from "../../../utils/helpers";
import { getMigrationsList, runMigrations } from "./utils";
import config from "../../../config";

export const addMigrateCommand = (program: Command) => {
  const migrations = getMigrationsList();
  program
    .command("migrate")
    .description("deploy the specified contracts")
    .requiredOption<NetworkLiteral>(
      "-n, --network <network>",
      "network to deploy",
      (value): NetworkLiteral => value.toLowerCase() as NetworkLiteral,
      config.deployNetwork
    )
    .requiredOption<number>(
      "-s, --from <from>",
      "the migrations counter to start with",
      (val, prev = 0) => parseInt(val) + prev,
      0
    )
    .requiredOption<number>(
      "-e, --to <to>",
      "the migrations counter to end with",
      (val, prev = 0) => parseInt(val) + prev,
      migrations.length - 1
    )
    .requiredOption(
      "-k --key <key>",
      "Secret key to sign with",
      config.deployerSK
    )
    .showHelpAfterError(true)
    .action(
      async (argv) =>
        await runMigrations(
          argv.network,
          argv.from,
          argv.to,
          argv.key,
          migrations
        )
    );
};
