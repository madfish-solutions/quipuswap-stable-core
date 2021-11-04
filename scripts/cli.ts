#!/usr/bin/env node
import { Command } from 'commander';
import { addCompileLambdaCommand } from './commands/compile';
import {
  debug,
  setCWD,
  setDebug,
} from "create-tezos-smart-contract/dist/console";

const program = new Command();

program
  .version("0.0.1")
  .option('--debug', 'run the command in debug mode, with a lot more details about it')
  .option('-f, --folder <cwd>', 'change the working directory to the specified folder')
  .hook('preAction', (cmd: Command) => {
    const options = cmd.opts();

    if (options.debug) {
      setDebug(true);
    }
    if (options.folder) {
      debug(`Change working directory to ${options.folder}`);
      setCWD(options.folder);
    }
  });

const debugHook = (cmd: Command) => {
  const options = cmd.opts();
  const optionsString = JSON.stringify(options, null, 2);

  // Debug options code
  if (options && optionsString !== "{}") {
    debug(`Command options:\n${optionsString}\n`);
  } else {
    debug('No options were passed to this command.\n');
  }
}


addCompileLambdaCommand(program, debugHook);

program.parse(process.argv);
