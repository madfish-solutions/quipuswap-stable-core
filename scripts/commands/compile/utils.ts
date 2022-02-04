import { getLigo } from "../../../utils/helpers";
import config from "../../../config";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";

const _compileFile = async (
  contractFileName: string,
  ligoVersion: string,
  isDockerizedLigo = config.dockerizedLigo,
  format: "tz" | "json" = "json"
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
    if (
      fs.existsSync(
        `${
          format === "json"
            ? config.outputDirectory
            : config.contractsDirectory + "/../" + "compiled"
        }/${contractFileName}.${format}`
      )
    ) {
      if (format === "json") {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const oldBuildFile = require(`${process.cwd()}/${
          config.outputDirectory
        }/${contractFileName}.${format}`);

        if (oldBuildFile.sourcePath !== sourcePath) {
          console.error(
            `There is a compiled version of a contract with the same name which code is located at:\n\n${oldBuildFile.sourcePath}`
          );
          return;
        }
      } else
        fs.rmSync(
          `${
            config.contractsDirectory + "/../" + "compiled"
          }/${contractFileName}.${format}`
        );
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

    const { ligo_executable, args } = isDockerizedLigo
      ? {
          ligo_executable: "docker",
          args: [
            "run",
            "--rm",
            "-v",
            `${cwd}:${cwd}`,
            "-w",
            `${cwd}`,
            `ligolang/ligo:${ligoVersion}`,
          ],
        }
      : {
          ligo_executable: config.ligoLocalPath,
          args: [],
        };
    args.push(
      "compile",
      "contract",
      `${sourcePath}`,
      "-e",
      "main",
      "--protocol",
      "hangzhou"
    );
    if (format === "json") args.push("--michelson-format", "json");

    console.debug(`\t🔥 Compiling with LIGO (${ligoVersion})...`);
    const ligo = spawn(ligo_executable, args, {});

    ligo.on("close", async () => {
      console.log("\t\t✅ Done.");
      built.michelson =
        format === "json" ? JSON.parse(built.michelson) : built.michelson;
      const outFile = `${
        format === "json"
          ? config.outputDirectory
          : config.contractsDirectory + "/../" + "compiled"
      }/${contractFileName}.${format}`;

      console.log(
        `\t📦 Writing output file "${path.relative(cwd, outFile)}"...`
      );
      fs.writeFileSync(
        outFile,
        format === "json" ? JSON.stringify(built) : built.michelson
      );
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
        console.error(message);
        reject(ligo.stderr);
        process.exit(1);
      } else console.warn(message);
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
  const outputDirectory =
    options.format === "json"
      ? config.outputDirectory
      : config.contractsDirectory + "/../" + "compiled";
  if (!fs.existsSync(outputDirectory)) {
    console.log(
      `Creating output directory "${outputDirectory}" since it was not present.`
    );
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  if (options.contract) {
    await _compileFile(
      options.contract,
      config.ligoVersion,
      options.docker,
      options.format
    );
  } else {
    const contracts = getContractsList();

    for (const contract of contracts) {
      await _compileFile(
        contract,
        config.ligoVersion,
        options.docker,
        options.format
      );
    }
  }
};

// Run LIGO compiler
export const compileLambdas = async (
  json: string,
  contract: string,
  isDockerizedLigo = config.dockerizedLigo,
  type: "Dex" | "Token" | "Permit" | "Admin" | "Dev"
) => {
  console.log(`Compiling ${contract} contract lambdas of ${type} type...\n`);

  const test_path = contract.toLowerCase().includes("test");
  const factory_path = contract.toLowerCase().includes("factory");
  const ligo = isDockerizedLigo
    ? `docker run -v $PWD:$PWD --rm -i -w $PWD ligolang/ligo:${config.ligoVersion}`
    : config.ligoLocalPath;
  const pwd = execSync("echo $PWD").toString();
  const lambdas = JSON.parse(
    fs.readFileSync(`${pwd.slice(0, pwd.length - 1)}/${json}`).toString()
  );
  const res = [];
  const version = !isDockerizedLigo
    ? execSync(`${ligo} version -version`).toString()
    : config.ligoVersion;
  const old_cli = version ? Number(version.split(".")[2]) > 25 : false;
  let ligo_command: string;
  if (old_cli) {
    ligo_command = "compile-expression";
  } else {
    ligo_command = "compile expression";
  }
  const init_file = `$PWD/${contract}`;
  try {
    for (const lambda of lambdas) {
      let func;
      if (factory_path) {
        if (lambda.name == "add_pool" && factory_path) continue;
        func = `Bytes.pack(${lambda.name})`;
      } else {
        func = `Set_${type.toLowerCase()}_function(record [index=${
          lambda.index
        }n; func=Bytes.pack(${lambda.name})])`;
      }
      const params = `'${func}' --michelson-format json --init-file ${init_file} --protocol hangzhou`;
      const command = `${ligo} ${ligo_command} ${config.preferredLigoFlavor} ${params}`;
      const michelson = execSync(command, { maxBuffer: 1024 * 500 }).toString();

      const bytes = factory_path
        ? {
            prim: "Pair",
            args: [
              { bytes: JSON.parse(michelson).bytes },
              { int: lambda.index.toString() },
            ],
          }
        : JSON.parse(michelson).args[0].args[0].args[0];
      res.push(bytes);

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
    let out_path = "/lambdas";
    if (test_path) {
      out_path += "/test";
    }
    if (factory_path) {
      out_path += "/factory";
    }
    if (!fs.existsSync(`${config.outputDirectory + out_path}`)) {
      fs.mkdirSync(`${config.outputDirectory + out_path}`, { recursive: true });
    }
    const json_file_path = json.split("/");
    const file_name = json_file_path[json_file_path.length - 1];
    const save_path = `${config.outputDirectory + out_path}/${file_name}`;
    fs.writeFileSync(save_path, JSON.stringify(res));
    console.log(`Saved to ${save_path}`);
  } catch (e) {
    console.error(e);
  }
};

export const compileFactoryLambda = (
  lambda: string,
  isDockerizedLigo: boolean = config.dockerizedLigo
) => {
  console.log(`Compiling Factory contract lambda ${lambda}...\n`);
  const ligo = isDockerizedLigo
    ? `docker run -v $PWD:$PWD --rm -i -w $PWD ligolang/ligo:${config.ligoVersion}`
    : config.ligoLocalPath;
  const version = !isDockerizedLigo
    ? execSync(`${ligo} version -version`).toString()
    : config.ligoVersion;
  const old_cli = version ? Number(version.split(".")[2]) > 25 : false;
  let ligo_command: string;
  if (old_cli) {
    ligo_command = "compile-expression";
  } else {
    ligo_command = "compile expression";
  }
  const init_file = `$PWD/${config.contractsDirectory}/factory.ligo`;
  try {
    const func = `Bytes.pack(${lambda})`;
    const params = `'${func}' --michelson-format json --init-file ${init_file} --protocol hangzhou`;
    const command = `${ligo} ${ligo_command} ${config.preferredLigoFlavor} ${params}`;
    const michelson = execSync(command, { maxBuffer: 1024 * 1000 }).toString();
    console.log(lambda + " successfully compiled.");
    if (!fs.existsSync(`${config.outputDirectory}/lambdas/factory`)) {
      fs.mkdirSync(`${config.outputDirectory}/lambdas/factory`, {
        recursive: true,
      });
    }
    const file_name = lambda;
    const save_path = `${config.outputDirectory}/lambdas/factory/${file_name}.txt`;
    fs.writeFileSync(save_path, JSON.parse(michelson).bytes);
    console.log(`Saved to ${save_path}`);
  } catch (e) {
    console.error(e);
  }
};
