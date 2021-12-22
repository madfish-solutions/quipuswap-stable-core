import { MichelsonMap } from "@taquito/taquito";
import { sandbox } from "../../../config.json";
import { BigNumber } from "bignumber.js";
const aliceAddress: string = sandbox.accounts.alice.pkh;
const bobAddress: string = sandbox.accounts.bob.pkh;
const eveAddress: string = sandbox.accounts.eve.pkh;

const kUSDstorage = {
  administrator: aliceAddress,
  balances: MichelsonMap.fromLiteral({
    [aliceAddress]: {
      balance: "1000000000000000000000000000000",
      approvals: MichelsonMap.fromLiteral({}),
    },
    [bobAddress]: {
      balance: "1000000000000000000000000000000",
      approvals: MichelsonMap.fromLiteral({}),
    },
    [eveAddress]: {
      balance: "1000000000000000000000000000000",
      approvals: MichelsonMap.fromLiteral({}),
    },
  }),
  debtCeiling: "8000000000000000000000000000000",
  governorContractAddress: "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg",
  token_metadata: MichelsonMap.fromLiteral({}),
  metadata: MichelsonMap.fromLiteral({
    data: Buffer.from(
      JSON.stringify({
        name: "Test Kolibri Token Contract",
        description: "FA1.2 Implementation of TkUSD",
        homepage: "https://none",
        interfaces: ["TZIP-007-2021-01-29"],
        events: [
          {
            name: "singleAssetBalanceUpdates",
            description: "Get token balance updates",
            implementations: [
              {
                michelsonExtendedStorageEvent: {
                  parameter: {
                    args: [
                      {
                        args: [
                          {
                            args: [
                              {
                                prim: "address",
                                annots: ["%administrator"],
                              },
                              {
                                args: [
                                  {
                                    prim: "address",
                                  },
                                  {
                                    args: [
                                      {
                                        args: [
                                          {
                                            prim: "address",
                                          },
                                          {
                                            prim: "nat",
                                          },
                                        ],
                                        prim: "map",
                                        annots: ["%approvals"],
                                      },
                                      {
                                        prim: "nat",
                                        annots: ["%balance"],
                                      },
                                    ],
                                    prim: "pair",
                                  },
                                ],
                                prim: "map",
                                annots: ["%balances"],
                              },
                            ],
                            prim: "pair",
                          },
                          {
                            args: [
                              {
                                prim: "nat",
                                annots: ["%debtCeiling"],
                              },
                              {
                                prim: "address",
                                annots: ["%governorContractAddress"],
                              },
                            ],
                            prim: "pair",
                          },
                        ],
                        prim: "pair",
                      },
                      {
                        args: [
                          {
                            args: [
                              {
                                args: [
                                  {
                                    prim: "string",
                                  },
                                  {
                                    prim: "bytes",
                                  },
                                ],
                                prim: "map",
                                annots: ["%metadata"],
                              },
                              {
                                prim: "bool",
                                annots: ["%paused"],
                              },
                            ],
                            prim: "pair",
                          },
                          {
                            args: [
                              {
                                args: [
                                  {
                                    prim: "nat",
                                  },
                                  {
                                    args: [
                                      {
                                        prim: "nat",
                                      },
                                      {
                                        args: [
                                          {
                                            prim: "string",
                                          },
                                          {
                                            prim: "bytes",
                                          },
                                        ],
                                        prim: "map",
                                      },
                                    ],
                                    prim: "pair",
                                  },
                                ],
                                prim: "map",
                                annots: ["%token_metadata"],
                              },
                              {
                                prim: "nat",
                                annots: ["%totalSupply"],
                              },
                            ],
                            prim: "pair",
                          },
                        ],
                        prim: "pair",
                      },
                    ],
                    prim: "pair",
                  },
                  returnType: {
                    args: [
                      {
                        prim: "address",
                      },
                      {
                        prim: "nat",
                      },
                    ],
                    prim: "map",
                  },
                  code: [
                    [
                      {
                        prim: "CAR",
                      },
                      {
                        prim: "CAR",
                      },
                      {
                        prim: "CAR",
                      },
                      {
                        prim: "CDR",
                      },
                    ],
                    {
                      args: [
                        [
                          [
                            {
                              prim: "CDR",
                            },
                            {
                              prim: "CDR",
                            },
                          ],
                        ],
                      ],
                      prim: "MAP",
                    },
                    {
                      args: [
                        {
                          prim: "operation",
                        },
                      ],
                      prim: "NIL",
                    },
                    {
                      prim: "PAIR",
                    },
                  ],
                  entrypoints: ["mint", "burn"],
                },
              },
            ],
          },
        ],
      }),
      "ascii"
    ).toString("hex"),
  }),
  totalSupply: "6000000000000000000000000000000",
  paused: false,
};

export default kUSDstorage;
