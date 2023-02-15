import { readFileSync } from "fs";
import * as path from "path";

export const getMichelsonCode = (contract: string): string =>
  readFileSync(path.join(__dirname, "./artifacts", contract + ".tz"), "utf8");
