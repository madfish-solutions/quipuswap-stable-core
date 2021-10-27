import { AccountsLiteral, prepareProviderOptions, Tezos } from "./helpers/utils";

export async function failCase(
  sender: AccountsLiteral,
  act: Promise<unknown> | (() => Promise<unknown>),
  errorMsg: string
) {
  let config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  expect.assertions(1);
  return await expect(act).rejects.toMatchObject({
    message: errorMsg,
  });
}

export default failCase;
