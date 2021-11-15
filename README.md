# QuipuSwap StableDex core

Contracts of DEX with Curve-like invariant implementation. This contracts allows to exchange tokens with equal price.  💵 -> 💰

Core concept is to provide low slippage swap between stablecoins like uUSD, kUSD, USDtz, etc.

## Project structure
Project based on [lava](https://github.com/uconomy/lava) toolset for fast generating all needed structure and tools.

```
.
├──  build/ # (gitignored) builded sources of contracts in json
├──  contracts/ # contracts
|──────── main/ # the contracts to be compiled
|──────── partials/ # the code parts imported by main contracts
|──────── helpers/ # helper methods for contacts
|──────── lambdas/ # lambda methods of contacts
|──────── views/ # view methods of contacts
|──────── interfaces/ # type annotations of contacts
├──  test/ # test cases
├──────── storage/ # initial storage for contract originations
├──────── helpers/ # helpers for test cases
├──  scripts/ # cli for dex/factory actions
├──  README.md # current file
├──  .gitignore
├──  config.json # configuration file for compile, deploy and test
├──  package.json
├──  yarn.lock
└──  tsconfig.json

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

## Compiling

As easy as:

```bash
npm run compile
```

or with yarn

```bash
yarn compile
```

You have several options available for this command, as the ability to specify a single contract to compile or your preferred LIGO version. Launch `npm run compile -- --help` or the shorter `yarn compile --help` to see the full guide.

## Testing

Tests are run by [**Jest**](https://jestjs.io), with a proper setup to write unit tests with [Taquito](https://tezostaquito.io).

You can find tests in the `test` folder.

Testing is tought to be simulating user interaction with your smart contract. This is to ensure that the expected usage of your contract produces the expexted storage/operations in the Tezos blockchain.

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

and you'll see your tests being performed. If you want the local sandbox to be started and stopped automatically every test run, please set `autoSandbox: true` in your *config.json*.

## Deploy

You have a super-easy deploy tool in this repository. To bring it up, just launch this command:

```bash
npm run deploy
```

or, with Yarn

```bash
yarn deploy
```

It will guide you through all the step needed to Deploy the smart contract.
Pass `--network=testnet` or `--network=mainnet` to deploy in the specific network.

<p align="center"> Made with ❤️ by <a href=https://www.madfish.solutions>Madfish.Solutions</a>
