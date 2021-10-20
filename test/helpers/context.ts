const standard = process.env.EXCHANGE_TOKEN_STANDARD;

import { Dex as DexFA2 } from "./DexFA2";
import { TokenFA12 } from "./tokenFA12";
import { prepareProviderOptions, Tezos } from "./utils";

import dexStorage from "../storage/Dex";
import tokenFA12Storage from "../storage/TokenFA12";
import tokenFA2Storage from "../storage/TokenFA2";
import { dexLambdas, tokenLambdas, tokenFunctions } from "../storage/Functions";
import { TokenFA2 } from "./tokenFA2";
import { Token } from "./token";
import { TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { confirmOperation } from "./confirmation";

type Dex = DexFA2;
const CTokenFA12 = "TokenFA12.ligo";
const CTokenFA2 = "TokenFA2.ligo";
const CDex = "Dex.ligo";

export class Context {
  public dex: Dex;
  public tokens: Token[];

  constructor(dex: Dex, tokens: Token[]) {
    this.dex = dex;
    this.tokens = tokens;
  }

  static async init(
    pairsConfigs: {
      tokenAAddress?: string | null;
      tokenBAddress?: string | null;
      tokenAId?: string | null;
      tokenBId?: string | null;
      tokenAAmount: number;
      tokenBAmount: number;
    }[] = [
      {
        tokenAAmount: 1000000,
        tokenBAmount: 1000000,
      },
    ],
    setDexFunctions: boolean = false,
    accountName: string = "alice",
    useDeployedDex: boolean = true
  ): Promise<Context> {
    let config = await prepareProviderOptions(accountName);
    Tezos.setProvider(config);

    const dex_op = await Tezos.contract.originate({
      code: CDex,
      storage: dexStorage,
    });
    await confirmOperation(Tezos, dex_op.hash);
    const dex = await DexFA2.init(dex_op.contractAddress);

    let context = new Context(dex, []);
    if (setDexFunctions) {
      await context.setAllDexFunctions();
    }

    await context.createPairs(pairsConfigs);

    return context;
  }

  async updateActor(accountName: string = "alice"): Promise<void> {
    await this.dex.updateProvider(accountName);
  }

  async flushPairs(): Promise<void> {
    this.tokens = [];
    this.dex = undefined;
    await this.updateActor();
  }

  async createToken(type = null, push = true): Promise<string> {
    if (!type) type = standard;
    if (type == "FA2") {
      let tokenInstance = await global.deployContract(
        CTokenFA2,
        tokenFA2Storage
      );
      let tokenAddress = tokenInstance.address.toString();
      if (push) this.tokens.push(await TokenFA2.init(tokenAddress));
      return tokenAddress;
    } else {
      let tokenInstance = await global.deployContract(
        CTokenFA12,
        tokenFA12Storage
      );
      let tokenAddress = tokenInstance.address.toString();
      if (push) this.tokens.push(await TokenFA12.init(tokenAddress));
      return tokenAddress;
    }
  }

  async setDexFunctions(): Promise<void> {
    for (let dexFunction of dexLambdas) {
      await this.dex.setDexFunction(dexFunction.index, dexFunction.name);
    }
    await this.dex.updateStorage({
      dex_lambdas: [...Array(9).keys()],
    });
  }

  async setDexFunction(index: number, name: string): Promise<void> {
    await this.dex.updateStorage({
      dex_lambdas: [index],
    });
    if (!this.dex.storage.dex_lambdas[index]) {
      await this.dex.setDexFunction(index, name);
      await this.dex.updateStorage({
        dex_lambdas: [index],
      });
    }
  }

  async setTokenDexFunctions(): Promise<void> {
    for (let tokenFunction of tokenFunctions["FA2"]) {
      await this.dex.setTokenFunction(tokenFunction.index, tokenFunction.name);
    }
    await this.dex.updateStorage({
      token_lambdas: [...Array(5).keys()],
    });
  }

  async setAllDexFunctions(): Promise<void> {
    await this.setDexFunctions();
    await this.setTokenDexFunctions();
    await this.dex.updateStorage({
      dex_lambdas: [...Array(9).keys()],
      token_lambdas: [...Array(5).keys()],
    });
  }

  async createPair(
    pairConfig: {
      tokenAAddress?: string | null;
      tokenBAddress?: string | null;
      tokenAId?: string | null;
      tokenBId?: string | null;
      tokenAAmount: number;
      tokenBAmount: number;
    } = {
      tokenAAmount: 1000000,
      tokenBAmount: 1000000,
    },
    allowReplace: boolean = true
  ): Promise<BigNumber> {
    let tokenAAddress;
    let tokenBAddress;
    do {
      tokenAAddress =
        pairConfig.tokenAAddress ||
        (await this.createToken(
          standard.toLocaleLowerCase() == "mixed" ? "FA12" : standard,
          false
        ));
      tokenBAddress =
        pairConfig.tokenBAddress ||
        (await this.createToken(
          standard.toLocaleLowerCase() == "mixed" ? "FA2" : standard,
          false
        ));
      if (
        allowReplace &&
        standard !== "MIXED" &&
        tokenAAddress > tokenBAddress
      ) {
        const tmp = tokenAAddress;
        tokenAAddress = tokenBAddress;
        tokenBAddress = tmp;
      }
    } while (tokenAAddress > tokenBAddress);
    switch (standard) {
      case "FA2":
        if (pairConfig.tokenAAddress != tokenAAddress)
          this.tokens.push(await TokenFA2.init(tokenAAddress));
        if (pairConfig.tokenBAddress != tokenBAddress)
          this.tokens.push(await TokenFA2.init(tokenBAddress));
        break;
      case "FA12":
        if (pairConfig.tokenAAddress != tokenAAddress)
          this.tokens.push(await TokenFA12.init(tokenAAddress));
        if (pairConfig.tokenBAddress != tokenBAddress)
          this.tokens.push(await TokenFA12.init(tokenBAddress));
        break;
      case "MIXED":
        if (pairConfig.tokenAAddress != tokenAAddress)
          this.tokens.push(await TokenFA12.init(tokenAAddress));
        if (pairConfig.tokenBAddress != tokenBAddress)
          this.tokens.push(await TokenFA2.init(tokenBAddress));
        break;
      default:
        break;
    }
    pairConfig.tokenAAddress = tokenAAddress;
    pairConfig.tokenBAddress = tokenBAddress;
    await this.dex.initializeExchange(
      pairConfig.tokenAAddress,
      pairConfig.tokenBAddress,
      pairConfig.tokenAAmount,
      pairConfig.tokenBAmount
    );
    return this.dex.storage.storage.token_to_id[
      this.dex.storage.storage.pairs_count.toString()
    ];
  }

  async createPairs(
    pairConfigs: {
      tokenAAddress?: string | null;
      tokenBAddress?: string | null;
      tokenAId?: string | null;
      tokenBId?: string | null;
      tokenAAmount: number;
      tokenBAmount: number;
    }[] = [
      {
        tokenAAmount: 1000000,
        tokenBAmount: 1000000,
      },
    ]
  ): Promise<void> {
    for (let pairConfig of pairConfigs) {
      await this.createPair(pairConfig);
    }
  }
}
