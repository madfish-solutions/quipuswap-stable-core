import BigNumber from "bignumber.js";

import {
  failCase,
  prepareProviderOptions,
  Tezos,
  TezosAddress,
} from "../scripts/helpers/utils";

describe("factory", () => {
  beforeAll(async () => {});

  describe("1.", () => {
    it(
      "should fail if",
      async () => await failCase("bob", async () => {}, "ERROR"),
      10000
    );

    it.todo("should",  async () => {}, 50000);
  });
});
