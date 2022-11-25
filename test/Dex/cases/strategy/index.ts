import * as strategyConfigToken from "./cofigure-token";
import * as strategyConnect from "./connect";

export const strategyCases = {
  token: strategyConfigToken,
  connect: strategyConnect,
};

import * as before from "./before";

export default {
  before,
  cases: strategyCases,
};
