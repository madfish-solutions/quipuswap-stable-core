import { TezosProtocols } from "./scripts/commands/sandbox/types";
export const config = {
  repoName: "quipuswap-stable-core",
  ligoVersion: "0.31.0",
  preferredLigoFlavor: "pascaligo",
  networks: {
    sandbox: {
      host: "localhost",
      port: 20000,
      protocol: TezosProtocols.HANGZHOU,
      genesisBlockHash: "random",
      defaultSignerSK: "edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq",
      accounts: {
        alice: {
          pkh: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
          sk: "edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq",
          pk: "edpkvGfYw3LyB1UcCahKQk4rF2tvbMUk8GFiTuMjL75uGXrpvKXhjn",
        },
        bob: {
          pkh: "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
          sk: "edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt",
          pk: "edpkurPsQ8eUApnLUJ9ZPDvu98E8VNj4KtJa1aZr16Cr5ow5VHKnz4",
        },
        eve: {
          pkh: "tz1MnmtP4uAcgMpeZN6JtyziXeFqqwQG6yn6",
          sk: "edsk3Sb16jcx9KrgMDsbZDmKnuN11v4AbTtPBgBSBTqYftd8Cq3i1e",
          pk: "edpku9qEgcyfNNDK6EpMvu5SqXDqWRLuxdMxdyH12ivTUuB1KXfGP4",
        },
      },
    },
    testnet: {
      host: "https://testnet-tezos.giganode.io",
      port: 443,
      faucet: null,
    },
    mainnet: {
      host: "https://mainnet-tezos.giganode.io",
      port: 443,
    },
  },
  contractsDirectory: "contracts/main",
  outputDirectory: "build",
  migrationsDir: "migrations",
};

export default config;
