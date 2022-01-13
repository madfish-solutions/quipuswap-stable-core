import { Command } from "commander";
import { compile, compileLambdas } from "./utils";

export const addCompileCommand = (program: Command) => {
  program
    .command("compile")
    .description("Compile contract(s) using LIGO compiler.")
    .option(
      "-c, --contract <contract>",
      "Compile a single smart contract source file"
    )
    .option(
      "-l, --ligo-version <version>",
      `Choose a specific LIGO version in format exmpl: 0.31.0 or "next". Default is "next".`,
      "next"
    )
    .action((options) => {
      compile(options);
    });
};

export const addCompileLambdaCommand = (program: Command) => {
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
    });
};
