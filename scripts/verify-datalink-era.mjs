import assert from "node:assert/strict";
import {
  DATALINK_ERAS,
  aircraftLink16Eligible,
  link16Operational,
  shipLink16Eligible,
} from "../dist-test/datalink/era.js";

assert.equal(link16Operational({ era: "ntu-baseline", enabled: true }), false);
assert.equal(shipLink16Eligible({ era: "jtids-transition", enabled: true }), false);
assert.equal(
  aircraftLink16Eligible({
    era: "jtids-transition",
    enabled: true,
    minimumEra: "jtids-transition",
  }),
  true,
);
assert.equal(
  aircraftLink16Eligible({
    era: "jtids-transition",
    enabled: true,
    minimumEra: "link16-modernized",
  }),
  false,
);
assert.equal(shipLink16Eligible({ era: "link16-modernized", enabled: true }), true);
assert.equal(shipLink16Eligible({ era: "link16-modernized", enabled: false }), false);
assert.equal(DATALINK_ERAS["cec-enabled"].selectable, false);
assert.equal(DATALINK_ERAS["cec-enabled"].cecAvailable, false);

console.log(JSON.stringify(DATALINK_ERAS, null, 2));
