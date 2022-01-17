/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema } from "@taquito/michelson-encoder";
import { Contract, TezosToolkit } from "@taquito/taquito";
import { MichelsonV1Expression } from "@taquito/rpc";
import Dex from "../API";
import {
  AccountsLiteral,
  initTezos,
  prepareProviderOptions,
} from "../../../utils/helpers";
import { accounts } from "../../../utils/constants";
import { confirmOperation } from "../../../utils/confirmation";
import blake from "blakejs";
import { MichelsonMap } from "@taquito/taquito";

import { hex2buf } from "@taquito/utils";
import { DexStorage } from "../API/types";

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
    .then((storage: DexStorage) => storage.permits_counter.toNumber());
  const param_hash = await permitParamHash(tz, contract, entrypoint, params);
  const chain_id = await tz.rpc.getChainId();
  const bytesToSign = await tz.rpc.packData({
    data: permitSchema.Encode({
      0: contract.address,
      1: chain_id,
      2: permit_counter,
      3: param_hash,
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
  const [bobsKey, bobsSig, permitHash] = await createPermitPayload(
    tzSigner,
    dex.contract,
    "transfer",
    params
  );
  const op = await permitContractSender.methods
    .permit(bobsKey, bobsSig, permitHash)
    .send();
  await confirmOperation(tzSender, op.hash);

  const storage = (await dex.contract.storage()) as DexStorage;
  const permitValue = await storage.permits
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
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  let storage = (await dex.contract.storage()) as DexStorage;
  let permitValue: MichelsonMap<string, any> = await storage.permits
    .get(accounts[signer].pkh)
    .then((signer_permits) => signer_permits.permits);
  expect(permitValue.has(expPermitHash)).toBeTruthy();
  const transferParams = [
    {
      from_: accounts[signer].pkh,
      txs: [{ to_: accounts[receiver].pkh, token_id: 0, amount: 10 }],
    },
  ];
  const op = await dex.contract.methods.transfer(transferParams).send();
  await confirmOperation(Tezos, op.hash);

  storage = (await dex.contract.storage()) as DexStorage;
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
  const permitContractSender = await tzSender.contract.at(dex.contract.address);
  const [bobsKey, bobsSig, permitHash] = await createPermitPayload(
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

  const storage = (await dex.contract.storage()) as DexStorage;
  const permitValue = await storage.permits
    .get(accounts[signer].pkh)
    .then((signer_permits) => signer_permits.permits);
  expect(permitValue.has(permitHash)).toBeTruthy();
  const permit = await permitValue.get(permitHash);
  expect(permit.expiry.toNumber()).toBe(60);
}
