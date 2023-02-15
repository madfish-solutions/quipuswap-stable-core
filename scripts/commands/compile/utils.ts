import { getLigo, LambdaType } from "../../../utils/helpers";
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
      "lima"
    );
    if (format === "json") args.push("--michelson-format", "json");

    console.debug(`\t🔥 Compiling with LIGO (${ligoVersion})...`);
    console.debug(args.reduce((p, c) => p + " " + c, ""));
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

function getLambdasFiles() {
  return fs
    .readdirSync(config.lambdasDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(config.lambdasDir, file));
}

// Run LIGO compiler
export const compileLambdas = async (
  contract: string,
  isDockerizedLigo = config.dockerizedLigo,
  json?: string
) => {
  const test_path = contract.toLowerCase().includes("test");
  const factory_path = contract.toLowerCase().includes("factory");
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
  const init_file = `$PWD/${contract}`;

  const lambdaFiles = json ? [json] : getLambdasFiles();
  const queue: { file: string; func: string; index: number; type: string }[] =
    [];
  for (const file of lambdaFiles) {
    const type = file
      .slice(file.lastIndexOf("/") + 1, file.length)
      .split("_")[0];

    const lambdas = JSON.parse(fs.readFileSync(file).toString());
    for (const lambda of lambdas) {
      if (
        factory_path &&
        (lambda.name == "add_pool" ||
          lambda.name == "set_strategy_factory" ||
          type.toLowerCase() == "dev")
      )
        continue;

      const func = `Bytes.pack(${lambda.name})`;
      queue.push({ file, func, index: lambda.index, type });
    }
  }
  const funcs = queue.map((q) => q.func).join(";");
  const types: string = [
    ...queue.reduce((set, q) => set.add(q.type), new Set()),
  ].join(",");
  console.log(
    `Compiling ${contract} contract lambdas of ${types} type${types.includes(",") ? "s" : ""
    }...\n`
  );
  let michelson: string;
  try {
    const params = `--michelson-format json --init-file ${init_file} --protocol lima`;

    const command = `${ligo} ${ligo_command} ${config.preferredLigoFlavor} 'list [${funcs}]' ${params}`;
    michelson = execSync(command, {
      maxBuffer: 2048 * 2048,
    }).toString();
  } catch (e) {
    console.error(e);
    throw e;
  }
  console.log("Compiled successfully");
  const compiledBytesMap = JSON.parse(michelson).map(
    (comp_res: { bytes: string }, idx: number) => {
      const file = queue[idx].file.slice(
        queue[idx].file.lastIndexOf("/") + 1,
        queue[idx].file.length
      );
      return { ...queue[idx], file, bytes: comp_res.bytes };
    }
  );
  const outputs = new Map();
  for (const entry of compiledBytesMap) {
    const bytes = {
      prim: "Pair",
      args: [{ bytes: entry.bytes }, { int: entry.index.toString() }],
    };
    if (outputs.has(entry.file))
      outputs.set(entry.file, [...outputs.get(entry.file), bytes]);
    else outputs.set(entry.file, [bytes]);
  }
  outputs.forEach((val, filename) => {
    try {
      let out_path = "/lambdas";
      if (test_path) {
        out_path += "/test";
      }
      if (factory_path) {
        out_path += "/factory";
      }
      if (!fs.existsSync(`${config.outputDirectory + out_path}`)) {
        fs.mkdirSync(`${config.outputDirectory + out_path}`, {
          recursive: true,
        });
      }
      const save_path = `${config.outputDirectory + out_path}/${filename}`;
      fs.writeFileSync(save_path, JSON.stringify(val));
      console.log(`Saved to ${save_path}`);
    } catch (e) {
      console.error(e);
    }
  });
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
    const params = `'${func}' --michelson-format json --init-file ${init_file} --protocol lima`;
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
