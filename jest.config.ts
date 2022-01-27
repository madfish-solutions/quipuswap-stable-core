/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

const config = {
  coverageProvider: "v8",

  // The maximum amount of workers used to run your tests. Can be specified as % or a number. E.g. maxWorkers: 10% will use 10% of your CPU amount + 1 as the maximum worker number. maxWorkers: 2 will use a maximum of 2 workers.
  maxWorkers: "1",

  // The paths to modules that run some code to configure or set up the testing environment before each test
  //setupFiles: ["create-tezos-smart-contract/dist/modules/jest/globals.js"],
  setupFilesAfterEnv: ["./jest.setup.ts"],
  preset: "ts-jest/presets/js-with-ts",
  testEnvironment: "node",
  testRunner: "jest-circus/runner",
  verbose: true,
};

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = async () => {
  return {
    ...config,
  };
};
