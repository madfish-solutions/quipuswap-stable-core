import { Command } from "commander";
import { useSandbox } from "./utils";

export const addSandboxCommand = (program: Command) => {
  program
    .command("sandbox")
    .description("start or stop sandbox node")
    .option("--start, --up", "start sandbox")
    .option("--stop, --down", "stop sandbox")
    .showHelpAfterError(true)
    .action(async (argv) => await useSandbox(argv));
};
