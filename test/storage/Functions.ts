import { LambdaFunctionType } from "../helpers/types";
import dex_lambdas from "../lambdas/Dex_lambdas.json"
import token_lambdas from "../lambdas/Token_lambdas.json";

export const dexLambdas: LambdaFunctionType[] = dex_lambdas;
export const tokenLambdas: LambdaFunctionType[] = token_lambdas;
export const tokenFunctions = {
  FA12: tokenLambdas,
  MIXED: tokenLambdas,
  FA2: tokenLambdas,
};
