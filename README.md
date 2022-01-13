# QuipuSwap StableDex core

**Currently Work In Progress**

Contracts of DEX with Curve-like invariant implementation. This contracts allows to exchange tokens with equal price.  💵 -> 💰

Core concept is to provide low slippage swap between stablecoins like uUSD, kUSD, USDtz, etc.

**The code here is currently unverified and unaudited, and is made publicly available only for exploration and discussion purposes. You should not use it for anything serious.**

## Project structure

```shell
├./
├── build/                        # (gitignored) builded sources of contracts (*.json files)
├─────── lambdas/                 # (gitignored) builded sources of contract lambdas (*.json files)
├──────────── test/               # (gitignored) builded lambdas for tests (*.json files)
├── contracts/                    # contracts sources directory (*.ligo files)
├─────── main/                    # the contracts to be compiled
├──────────── dex.ligo            # main DEX contract
├──────────── dex_test.ligo       # modified DEX contract for tests
├─────── partials/                # the code parts imported by main contracts
├──────────── admin/              # admin part of DEX contact
├──────────── dex_core/           # core codebase of DEX contact
├──────────── fa2/                # token of FA2 standart sources for DEX contact
├──────────── fa12/               # helpers for interaction with FA12 tokens for DEX contact
├──────────── permit/             # permit part for token methods of DEX contract
├──────────── common_types.ligo   # common types used for interaction with contracts
├──────────── constants.ligo      # constants that used in DEX contract
├──────────── constants_test.ligo # modified constants that used in tests of DEX contract
├──────────── errors.ligo         # errors thrown from DEX contract
├──────────── utils.ligo          # utils for contracts
├── migrations/                   # migrations folder
├─────── NN_xxxx.ts               # migration file with deployment data (storage and initial contract setup)
├── test/                         # test cases
├──────── storage/                # initial storage for contract originations
├──────── lambdas/                # *.json files that contains indexes and names of lambdas to be compiled
├──────── Dex/                    # DEX test codebase
├──────────── API/                # DEX contract base API
├──────── Token/                  # Token (FA12/FA2) contract API
├──────── Dex.test.ts             # main test case file
├── scripts/                      # cli for setup environment, test and deploy contracts
├── .gitignore
├── .eslintrc
├── config.ts                     # configuration file for compile, deploy and test
├── jest.setup.ts                 # setup environment file for jest tests
├── jest.config.ts                # configuration file of jest tests
├── README.md                     # current file
├── package.json
├── yarn.lock
└── tsconfig.json
```

## Requirements

This repository based on [Docker](https://www.docker.com) and [Node.js](https://nodejs.org/).

You can download Docker Desktop for your operative system at <https://www.docker.com/products/docker-desktop>. When download is ready, you can proceed to install it.

Same goes for Node.js, for which we suggest you download the LTS version for your system at <https://nodejs.org/>.

Suggested but not necessary, you can [install Yarn package manager](https://yarnpkg.com/getting-started/install) which will enable you to write shorter commands.

## Preparation

To start using this contracts, make sure you have all the needed packages to run it. To do so, in your Terminal just type:

```bash
npm i
```

or with yarn

```bash
yarn
```

## Cli

Project provides cli interface for compile test and deploy contracts.

With cli you can `compile`, `compile-lambda`, start/stop `sandbox` and `migrate` (deploy contracts)

Launch `npm run cli -- --help` or the shorter `yarn cli --help` to see the full guide.

## Compiling

You can compile all contracts and lambdas with one simple command:

```bash
npm run compile
```

or with yarn

```bash
yarn compile
```

Or if you want to compile modified version for tests replace `compile` with `compile-for-test`

This commands is shotcut for running `yarn cli compile` and `yarn cli compile-lambda` for specified contracts.

## Testing

Tests are run by [**Jest**](https://jestjs.io), with a proper setup to write unit tests with [Taquito](https://tezostaquito.io).

You can find tests in the `test` folder.

Testing is thought to be simulating user interaction with smart contract. This is to ensure that the expected usage of contract produces the expexted storage/operations in the Tezos blockchain.

To easily start a local Sandboxed environment (local Tezos network)

```bash
npm run start-sandbox
```

or, with Yarn

```bash
yarn start-sandbox
```

to easily start a local Sandboxed environment (local Tezos network) which processes blockchain packages much faster than real Tezos network. This makes you able to **deploy a separate contract** with a determined storage for every single unit test you might want to run.

Then you just need to run

```bash
npm run test
```

or, with Yarn

```bash
yarn test
```

and you'll see your tests being performed. If you want contracts to be compilled and the local sandbox to be started and stopped automatically every test run, please use the `yarn compile-n-test` command.

## Deploy

----------

### Before deployment

Setup storage objects inside migrations. Replace `null` values with needed and setup other params if needed.

----------

This repository contains command that allows deploy the contracts to chosen network (from [config.ts](./config.ts)). To bring it up, just launch this command:

```bash
npm run migrate
```

or, with Yarn

```bash
yarn migrate
```

Pass `--network=testnet` or `--network=mainnet` to deploy in the specific network.

Pass `--from <number>` or `--to <number>` to deploy only specific migrations, provided at [migrations](./migrations) directory.

Pass `--key <string>` to deploy from specific account. By default this is "Alice" (`edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq`) standard private key.

<p align="center"> Made with ❤️ by <a href=https://www.madfish.solutions>Madfish.Solutions</a>
