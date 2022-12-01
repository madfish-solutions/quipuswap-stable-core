import * as strategyConfigToken from "./cofigure-token";
import * as strategyConnect from "./connect";
import * as before from "./before";
import * as autoRebalance from "./auto_rebalance";

export const strategyCases = {
  token: strategyConfigToken,
  connect: strategyConnect,
  autoRebalance,
};

export default {
  before,
  cases: strategyCases,
};
