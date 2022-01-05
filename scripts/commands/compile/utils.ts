import { getLigo } from "../../helpers/utils";
import config from "../../../config";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";

const _compileFile = async (
  contractFileName: string,
  ligoVersion: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Compiling contract "${contractFileName}"...`);

    console.debug("\t👓 Reading source...");
    const source = fs
      .readFileSync(`${config.contractsDirectory}/${contractFileName}.ligo`)
      .toString();
    console.debug("\t\t✅ Done.");

    if (source === "") {
      console.error(
        "The specified contract file is empty, skipping compilation."
      );
      return;
    }
    const cwd = process.cwd();

    const sourcePath = path.relative(
      cwd,
      `${config.contractsDirectory}/${contractFileName}.ligo`
    );
    if (fs.existsSync(`${config.outputDirectory}/${contractFileName}.json`)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const oldBuildFile = require(`${process.cwd()}/${
        config.outputDirectory
      }/${contractFileName}.json`);

      if (oldBuildFile.sourcePath !== sourcePath) {
        console.error(
          `There is a compiled version of a contract with the same name which code is located at:\n\n${oldBuildFile.sourcePath}`
        );
        return;
      }
    }

    const built = {
      contractName: contractFileName,
      sourcePath: sourcePath,
      updatedAt: new Date().toISOString(),
      compiler: {
        name: "ligo",
        version: ligoVersion,
      },
      networks: {},
      michelson: "",
    };

    const args = [
      "run",
      "--rm",
      "-v",
      `${cwd}:${cwd}`,
      "-w",
      `${cwd}`,
      `ligolang/ligo:${ligoVersion}`,
      "compile",
      "contract",
      `${sourcePath}`,
      "-e",
      "main",
      "--michelson-format",
      "json",
    ];

    console.debug(`\t🔥 Compiling with LIGO (${ligoVersion})...`);
    const ligo = spawn("docker", args, {});

    ligo.on("close", async () => {
      console.log("\t\t✅ Done.");

      const outFile = `${config.outputDirectory}/${contractFileName}.json`;

      console.log(
        `\t📦 Writing output file "${path.relative(cwd, outFile)}"...`
      );
      fs.writeFileSync(outFile, JSON.stringify(built));
      console.log("\t\t✅ Done.");

      console.log("\t🥖 Contract compiled succesfully.");

      resolve();
    });

    ligo.stdout.on("data", (data) => {
      built.michelson += data.toString();
    });

    ligo.stderr.on("data", (data) => {
      const message: string = data.toString();
      if (message.toLowerCase().includes("err")) {
        console.error(data.toString());
        reject(ligo.stderr);
        process.exit(1);
      }
    });
  });
};

const getContractsList = () => {
  return fs
    .readdirSync(config.contractsDirectory)
    .filter((file) => file.endsWith(".ligo"))
    .map((file) => file.slice(0, file.length - 5));
};

// Run LIGO compiler
export const compile = async (options) => {
  console.log(`Compiling contracts...\n`);
  // Check the existence of build folder
  if (!fs.existsSync(config.outputDirectory)) {
    console.log(
      `Creating output directory "${config.outputDirectory}" since it was not present.`
    );
    fs.mkdirSync(config.outputDirectory);
  }

  if (options.contract) {
    await _compileFile(options.contract, config.ligoVersion);
  } else {
    const contracts = getContractsList();

    for (const contract of contracts) {
      await _compileFile(contract, config.ligoVersion);
    }
  }
};

// Run LIGO compiler
export const compileLambdas = async (
  json: string,
  contract: string,
  type: "Dex" | "Token" | "Permit" | "Admin"
) => {
  console.log(`Compiling ${contract} contract lambdas of ${type} type...\n`);

  const ligo = getLigo(true);
  const pwd = execSync("echo $PWD").toString();
  const lambdas = JSON.parse(
    fs.readFileSync(`${pwd.slice(0, pwd.length - 1)}/${json}`).toString()
  );
  const res = [];
  const old_cli = Number(config.ligoVersion.split(".")[2]) > 25;
  let ligo_command: string;
  if (old_cli) {
    ligo_command = "compile-expression";
  } else {
    ligo_command = "compile expression";
  }
  const init_file = `$PWD/${contract}`;
  try {
    for (const lambda of lambdas) {
      const func = `Set_${type.toLowerCase()}_function(record [index=${
        lambda.index
      }n; func=Bytes.pack(${lambda.name})])`;
      const params = `'${func}' --michelson-format json --init-file ${init_file}`;
      const command = `${ligo} ${ligo_command} ${config.preferredLigoFlavor} ${params}`;
      const michelson = execSync(command, { maxBuffer: 1024 * 500 }).toString();

      res.push(JSON.parse(michelson).args[0].args[0].args[0]);
      console.log(
        lambda.index +
          1 +
          "." +
          " ".repeat(4 - (lambda.index + 1).toString().length) +
          lambda.name +
          " ".repeat(21 - lambda.name.length) +
          " successfully compiled."
      );
    }

    if (!fs.existsSync(`${config.outputDirectory}/lambdas`)) {
      fs.mkdirSync(`${config.outputDirectory}/lambdas`);
    }
    const json_file_path = json.split("/");
    const file_name = json_file_path[json_file_path.length - 1];
    fs.writeFileSync(
      `${config.outputDirectory}/lambdas/${file_name}`,
      JSON.stringify(res)
    );
    console.log(`Saved to ${config.outputDirectory}/lambdas/${file_name}`);
  } catch (e) {
    console.error(e);
  }
};
