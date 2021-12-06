import { Schema } from "@taquito/michelson-encoder";
import {
  Contract,
  TezosOperationErrorWithMessage,
  TezosToolkit,
} from "@taquito/taquito";
import { MichelsonV1Expression } from "@taquito/rpc";
import { Dex } from "../helpers/dexFA2";
import {
  AccountsLiteral,
  initTezos,
  prepareProviderOptions,
} from "../helpers/utils";
import { accounts } from "./constants";
import { confirmOperation } from "../helpers/confirmation";
import blake from "blakejs";
import failCase from "../fail-test";
import { tokenFunctions } from '../storage/Functions';
import { MichelsonMap } from '@taquito/taquito';

const { hex2buf } = require("@taquito/utils");

const permitSchemaType: MichelsonV1Expression = {
  prim: "pair",
  args: [
    {
      prim: "pair",
      args: [{ prim: "address" }, { prim: "chain_id" }],
    },
    {
      prim: "pair",
      args: [{ prim: "nat" }, { prim: "bytes" }],
    },
  ],
};

const permitSchema = new Schema(permitSchemaType);

// // Permit part

export async function permitParamHash(
  tz: TezosToolkit,
  contract,
  entrypoint,
  parameter
): Promise<string> {
  const raw_packed = await tz.rpc.packData({
    data: contract.parameterSchema.Encode(entrypoint, parameter),
    type: contract.parameterSchema.root.typeWithoutAnnotations(),
  });
  return blake.blake2bHex(hex2buf(raw_packed.packed), null, 32);
}

export async function createPermitPayload(
  tz: TezosToolkit,
  contract: Contract,
  entrypoint: string,
  params: any
): Promise<[string, string, string]> {
  const signer_key = await tz.signer.publicKey();
  const permit_counter = await contract
    .storage()
    .then((storage: any) => storage.permits_counter.toNumber());
  const param_hash = await permitParamHash(tz, contract, entrypoint, params);
  const chain_id = await tz.rpc.getChainId();
  const bytesToSign = await tz.rpc.packData({
    data: permitSchema.Encode({
      0: contract.address,
      1: chain_id,
      2: permit_counter,
      3: param_hash
    }),
    type: permitSchemaType,
  });
  const sig = await tz.signer.sign(bytesToSign.packed).then((s) => s.prefixSig);
  return [signer_key, sig, param_hash];
}

export async function addPermitFromSignerByReceiverSuccessCase(
  dex: Dex,
  signer: AccountsLiteral,
  sender: AccountsLiteral,
  params: any
) {
  const signer_account = accounts[signer];
  const tzSigner = await initTezos(signer);
  const tzSender = await initTezos(sender);
  const permitContractSender = await tzSender.contract.at(dex.contract.address);
  let [bobsKey, bobsSig, permitHash] = await createPermitPayload(
    tzSigner,
    dex.contract,
    "transfer",
    params
  );
  let op = await permitContractSender.methods
    .permit(bobsKey, bobsSig, permitHash)
    .send();
  await confirmOperation(tzSender, op.hash);

  let storage = (await dex.contract.storage()) as any;
  let permitValue = await storage.permits
    .get(signer_account.pkh)
    .then((signer_permits) => signer_permits.permits);
  expect(permitValue.has(permitHash)).toBeTruthy();
  return permitHash;
}

export async function usePermit(
  Tezos: TezosToolkit,
  dex: Dex,
  signer: AccountsLiteral,
  sender: AccountsLiteral,
  receiver: AccountsLiteral,
  expPermitHash: string
) {
  let config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  let storage = (await dex.contract.storage()) as any;
  let permitValue: MichelsonMap<string, any> = await storage.permits
    .get(accounts[signer].pkh)
    .then((signer_permits) => signer_permits.permits);
  expect(permitValue.has(expPermitHash)).toBeTruthy();
  let transferParams = [
    {
      from_: accounts[signer].pkh,
      txs: [{ to_: accounts[receiver].pkh, token_id: 0, amount: 10 }],
    },
  ];
  let op = await dex.contract.methods.transfer(transferParams).send();
  await confirmOperation(Tezos, op.hash);

  storage = (await dex.contract.storage()) as any;
  permitValue = await storage.permits
    .get(accounts[signer].pkh)
    .then((signer_permits) => signer_permits.permits);
  expect(permitValue.has(expPermitHash)).toBeFalsy();
}

export async function setWithExpiry(
  dex: Dex,
  signer: AccountsLiteral,
  sender: AccountsLiteral,
  params: any
) {
  const tzSigner = await initTezos(signer);
  const tzSender = await initTezos(sender);
  let permitContractSender = await tzSender.contract.at(dex.contract.address);
  let [bobsKey, bobsSig, permitHash] = await createPermitPayload(
    tzSigner,
    dex.contract,
    "transfer",
    params
  );
  let op = await permitContractSender.methods
    .permit(bobsKey, bobsSig, permitHash)
    .send();
  await confirmOperation(tzSender, op.hash);
  const permitContractSigner = await tzSigner.contract.at(dex.contract.address);
  op = await permitContractSigner.methods
    .set_expiry(accounts[signer].pkh, 60, permitHash)
    .send();
  await confirmOperation(tzSigner, op.hash);

  let storage = (await dex.contract.storage()) as any;
  let permitValue = await storage.permits
    .get(accounts[signer].pkh)
    .then((signer_permits) => signer_permits.permits);
  expect(permitValue.has(permitHash)).toBeTruthy();
  let permit = await permitValue.get(permitHash);
  expect(permit.expiry.toNumber()).toStrictEqual(60);
}
