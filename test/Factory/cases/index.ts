import { setupFactoryEnvironment } from "./before";
import {
  setDevAddrSuccessCase,
  setDevFeeSuccessCase,
} from "../../Developer/cases";
import { initializeExchangeSuccessCase } from "./init_pool";
// import * as rates from "./rates";
import { claimRewardsSuccessCase } from "./rewards";
// import * as views from "./views";
import { updateWhitelistSuccessCase } from "./whitelist";
export const cases = {
  before: {
    setupFactoryEnvironment,
  },
  dev: {
    setDevAddrSuccessCase,
    setDevFeeSuccessCase,
  },
  whitelist: {
    updateWhitelistSuccessCase,
  },
  initPool: {
    initializeExchangeSuccessCase,
  },
  rewards: {
    claimRewardsSuccessCase,
  },
  // rates,
  // views,
};
export default cases;
