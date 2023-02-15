import * as common_before from "./before";
import * as admin from "./admin";
import * as pools from "./pool_part";
import * as rewards from "./rewards";
import * as views from "./views";
import strategy from "./strategy";

const before = { ...common_before, ...strategy.before };
export const cases = {
  before,
  admin,
  pools,
  rewards,
  views,
  strategy: strategy.cases,
};
export default cases;
