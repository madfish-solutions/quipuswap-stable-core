import { Command } from 'commander';
import { getLigo } from '../../../test/helpers/utils';

import { em, debug, getCWD } from "../../console";
import { ContractsBundle } from '../../modules/bundle';
import { compileWithLigo, LigoCompilerOptions, LIGOVersions } from '../../modules/ligo';
import { toLigoVersion } from '../../modules/ligo/parameters';
const fs = require("fs");
import { execSync } from "child_process";

export const addCompileCommand = (program: Command, debugHook: (cmd: Command) => void) => {
  program
    .command('compile')
    .description('Compile contract(s) using LIGO compiler.')
      .option('-c, --contract <contract>', 'Compile a single smart contract source file')
      .option('-l, --ligo-version <version>', `Choose a specific LIGO version. Default is "next", available are: ${Object.values(LIGOVersions).join(', ')}`)
      .option('-f, --force', 'Force the compilation avoiding LIGO version warnings')
    .action((options) => {
      compile(options);
    })
    .hook('preAction', debugHook);
}

export const addCompileLambdaCommand = (
  program: Command,
  debugHook: (cmd: Command) => void
) => {
  program
    .command("compile-lambda")
    .description("compile lambdas for the specified contract")
    .requiredOption(
      "-T, --type <type>",
      "Type of contracts lambdas"
    )
    .requiredOption(
      "-J, --json <json>",
      "input file relative path (with lambdas indexes and names)"
    )
    .requiredOption(
      "-C, --contract <contract>",
      "input file realtive path (with lambdas Ligo code)"
    ).showHelpAfterError(true)
    .action(async (argv) => {
      compileLambdas(argv.json, argv.contract, argv.type);
    })
    .hook("preAction", debugHook);
};

// Run LIGO compiler
export const compile = async (options: Partial<LigoCompilerOptions>) => {
  em(`Compiling contracts...\n`);

  // Read configfile
  const contractsBundle = new ContractsBundle(getCWD());
  const { ligoVersion } = await contractsBundle.readConfigFile();

  // Extract the needed settings, with typecheck
  const compilerConfig: LigoCompilerOptions = {
    ligoVersion,
  };

  // Validate versions
  if (options.ligoVersion) {
    options.ligoVersion = toLigoVersion(options.ligoVersion);
  }

  // Build final options
  const compilerOptions = Object.assign({}, compilerConfig, options);

  await compileWithLigo(contractsBundle, compilerOptions);
};

export const compileLambdas = async (
  json: string,
  contract: string,
  type: string
) => {
  const contractsBundle = new ContractsBundle(getCWD());
  const { ligoVersion, outputDirectory } = await contractsBundle.readConfigFile();

  const ligo = getLigo(true);
  const pwd = execSync("echo $PWD").toString();
  const lambdas = JSON.parse(
    fs.readFileSync(`${pwd.slice(0, pwd.length - 1)}/${json}`)
  );
  let res = [];

  try {
    for (const lambda of lambdas) {
      const command = `${ligo} compile expression pascaligo 'Set${type}Function(record [index=${lambda.index}n; func=Bytes.pack(${lambda.name})])' --michelson-format json --init-file $PWD/${contract}`;
      const michelson = execSync(command, { maxBuffer: 1024 * 500 }).toString();

      res.push(JSON.parse(michelson).args[0].args[0].args[0].args[0]);

      console.log(
        lambda.index + 1 + ". " + lambda.name + " successfully compiled."
      );
    }

    if (!fs.existsSync(`${outputDirectory}/lambdas`)) {
      fs.mkdirSync(`${outputDirectory}/lambdas`);
    }
    const json_file_path = json.split("/");
    const file_name = json_file_path[json_file_path.length-1];
    fs.writeFileSync(
        `${outputDirectory}/lambdas/${file_name}`,
        JSON.stringify(res)
      );
  } catch (e) {
    console.error(e);
  }
};