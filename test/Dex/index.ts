export * as constants from "./constants";
export * as TokenSetups from "./tokensSetups";

import * as before from "./before";
import * as admin from "./admin";
import * as pools from "./pool_part";
import * as rewards from "./rewards";
import * as views from "./views";
import * as permit from "./permit";
export const cases = {
  before,
  admin,
  pools,
  rewards,
  permit,
  views,
}

export * as API from "./API";

