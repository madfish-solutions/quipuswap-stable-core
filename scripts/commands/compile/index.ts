import { Command } from "commander";
import { getLigo } from "../../../test/helpers/utils";

import { em, debug, getCWD } from "create-tezos-smart-contract/dist/console";
import { ContractsBundle } from "create-tezos-smart-contract/dist/modules/bundle";
import { preferredLigoFlavor } from "../../../config.json";
const fs = require("fs");
import { execSync } from "child_process";
export const addCompileLambdaCommand = (
  program: Command,
  debugHook: (cmd: Command) => void
) => {
  program
    .command("compile-lambda")
    .description("compile lambdas for the specified contract")
    .requiredOption("-T, --type <type>", "Type of contracts lambdas")
    .requiredOption(
      "-J, --json <json>",
      "input file relative path (with lambdas indexes and names)"
    )
    .requiredOption(
      "-C, --contract <contract>",
      "input file realtive path (with lambdas Ligo code)"
    )
    .showHelpAfterError(true)
    .action(async (argv) => {
      compileLambdas(argv.json, argv.contract, argv.type);
    })
    .hook("preAction", debugHook);
};

// Run LIGO compiler
export const compileLambdas = async (
  json: string,
  contract: string,
  type: "Dex" | "Token" | "Permit" | "Admin"
) => {
  em(`Compiling ${contract} contract lambdas of ${type} type...\n`);
  // Read configfile
  const contractsBundle = new ContractsBundle(getCWD());
  const { ligoVersion, outputDirectory } =
    await contractsBundle.readConfigFile();

  const ligo = getLigo(true);
  const pwd = execSync("echo $PWD").toString();
  const lambdas = JSON.parse(
    fs.readFileSync(`${pwd.slice(0, pwd.length - 1)}/${json}`)
  );
  let res = [];
  const old_cli = Number(ligoVersion.split(".")[2]) > 25;
  let ligo_command: string;
  if (old_cli) {
    ligo_command = "compile-expression";
  } else {
    ligo_command = "compile expression";
  }
  const init_file = `$PWD/${contract}`;
  try {
    for (const lambda of lambdas) {
      const func = `Set_${type.toLowerCase()}_function(record [index=${lambda.index}n; func=Bytes.pack(${lambda.name})])`;
      const params = `'${func}' --michelson-format json --init-file ${init_file}`;
      const command = `${ligo} ${ligo_command} ${preferredLigoFlavor} ${params}`;
      const michelson = execSync(command, { maxBuffer: 1024 * 500 }).toString();

      res.push(JSON.parse(michelson).args[0].args[0].args[0]);
      debug(JSON.parse(michelson).args[0].args[0].args[0]);
      em(
        lambda.index +
          1 +
          "." +
          " ".repeat(4 - (lambda.index + 1).toString().length) +
          lambda.name +
          " ".repeat(21 - lambda.name.length) +
          " successfully compiled."
      );
    }

    if (!fs.existsSync(`${outputDirectory}/lambdas`)) {
      fs.mkdirSync(`${outputDirectory}/lambdas`);
    }
    const json_file_path = json.split("/");
    const file_name = json_file_path[json_file_path.length - 1];
    fs.writeFileSync(
      `${outputDirectory}/lambdas/${file_name}`,
      JSON.stringify(res)
    );
    em(`Saved to ${outputDirectory}/lambdas/${file_name}`);
  } catch (e) {
    console.error(e);
  }
};
