import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import config from "../config";
import {
  FA12TokenType,
  FA2TokenType,
  NetworkLiteral,
  TezosAddress,
} from "../utils/helpers";
import { DexFactoryAPI as DexFactory } from "../test/Factory/API";
import factoryInfo from "../build/factory.json";
import pools from "../storage/pairConfig.json";
import { Token, TokenFA2, TokenFA12 } from "../test/Token";
import BigNumber from "bignumber.js";
import { confirmOperation } from "../utils/confirmation";

const tokensAmount = new BigNumber("100000");

module.exports = async (tezos: TezosToolkit, network: NetworkLiteral) => {
  await new Promise((r) => setTimeout(r, 10000));
  const factoryAddress: TezosAddress = factoryInfo.networks[network].factory;
  const factory = await tezos.contract.at(factoryAddress);
  let poolData;
  for (const pair of pools) {
    console.log("Pool", pair.name);
    poolData = pair.tokensInfo;
    poolData.sort((a, b) => {
      if (a.token.fa12 && b.token.fa12)
        return a.token.fa12 > b.token.fa12 ? 1 : -1;
      else if (a.token.fa2 && b.token.fa2) {
        if (a.token.fa2.token_address == b.token.fa2.token_address)
          return a.token.fa2.token_id > b.token.fa2.token_id ? 1 : -1;
        else
          return a.token.fa2.token_address > b.token.fa2.token_address ? 1 : -1;
      } else if (a.token.fa12 && b.token.fa2) return -1;
      else if (a.token.fa2 && b.token.fa12) return 1;
      else return 0;
    });
    const tokens_info = new MichelsonMap();
    const inputs = new MichelsonMap();
    let asset: Token;
    for (const index in poolData) {
      const value = poolData[index];
      if (value.token.fa12)
        asset = await TokenFA12.init(tezos, value.token.fa12);
      else asset = await TokenFA2.init(tezos, value.token.fa2.token_address);
      const approve = await asset.approve(
        factory.address,
        tokensAmount.multipliedBy(value.precision),
        value.token.fa2 ? value.token.fa2.token_id : "0"
      );
      console.log(
        "Token ",
        asset.contract.address + value.token.fa2
          ? ":" + value.token.fa2.token_id
          : "",
        " approved"
      );
      tokens_info.set(index, {
        rate_f: value.rate_f,
        precision_multiplier_f: value.precision_multiplier_f,
      });
      inputs.set(index, {
        token: value.token,
        value: tokensAmount.multipliedBy(value.precision),
      });
    }
    let op = await factory.methodsObject
      .add_pool({
        a_constant: pair.a_const,
        input_tokens: pair.tokensInfo.map((token) => token.token),
        tokens_info,
        default_referral: process.env.DEFAULT_REFERRAL,
        managers: [],
        fees: pair.fees,
      })
      .send();
    await confirmOperation(tezos, op.hash);
    console.log("Add_pool ", op.hash);
    op = await factory.methods.start_dex(inputs).send();
    await confirmOperation(tezos, op.hash);
    console.log("Start_dex ", op.hash);
    for (const index in poolData) {
      const value = pair.tokensInfo[index];
      if (value.token.fa12)
        asset = await TokenFA12.init(tezos, value.token.fa12);
      else asset = await TokenFA2.init(tezos, value.token.fa2.token_address);
      const approve = await asset.approve(
        factory.address,
        new BigNumber(0),
        value.token.fa2 ? value.token.fa2.token_id : "0"
      );
      console.log(
        "Token ",
        asset.contract.address + value.token.fa2
          ? ":" + value.token.fa2.token_id
          : "",
        " disapproved"
      );
    }
    console.log(`Dex of ${pair.name} started`);
  }
};
