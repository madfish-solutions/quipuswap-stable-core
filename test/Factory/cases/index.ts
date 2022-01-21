import { setupFactoryEnvironment } from "./before";
import {
  setDevAddrSuccessCase,
  setDevFeeSuccessCase,
} from "../../Developer/cases";
import { initializeExchangeSuccessCase } from "./init_pool";
import { setBurnRateSuccessCase, setInitPriceSuccessCase } from "./rates";
import { claimRewardsSuccessCase, getDeveloperRewardsDexSuccessCase } from "./rewards";
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
    getDeveloperRewardsDexSuccessCase,
  },
  rates: {
    setBurnRateSuccessCase,
    setInitPriceSuccessCase,
  },
};
export default cases;
