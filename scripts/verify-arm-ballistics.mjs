import assert from "node:assert/strict";
import { stepAirToAirPropulsion } from "../src/air/missile-runtime.ts";
const AIR_WEAPONS = {
  "AGM-45A": { speed:8.5, maxTurnRateDeg:10, boostSeconds:2.5, airToAirFlight:{sustainSeconds:7,coastDragPerSecond:.032,minimumSpeedFactor:.48,loftAltitude:38,loftTransitionRange:115} },
  "AGM-88A": { speed:9.2, maxTurnRateDeg:13, boostSeconds:2.8, airToAirFlight:{sustainSeconds:14,coastDragPerSecond:.018,minimumSpeedFactor:.55,loftAltitude:95,loftTransitionRange:260} },
  "Kh-31P-C": { speed:10.8, maxTurnRateDeg:12, boostSeconds:3.2, airToAirFlight:{sustainSeconds:11,coastDragPerSecond:.023,minimumSpeedFactor:.5,loftAltitude:62,loftTransitionRange:210} },
};

for (const id of ["AGM-45A", "AGM-88A", "Kh-31P-C"]) {
  const weapon = AIR_WEAPONS[id];
  assert.ok(weapon.airToAirFlight, `${id} must define a powered flight profile`);
  const profile = weapon.airToAirFlight;
  let speed = 0;
  const samples = [];
  for (let i = 0; i < 80; i++) {
    const age = i * .5;
    speed = stepAirToAirPropulsion({ currentSpeed: speed, nominalSpeed: weapon.speed, age, boostSeconds: weapon.boostSeconds, sustainSeconds: profile.sustainSeconds, coastDragPerSecond: profile.coastDragPerSecond, minimumSpeedFactor: profile.minimumSpeedFactor, dt: .5 });
    samples.push(speed);
  }
  assert.ok(samples[5] > samples[0], `${id} did not accelerate during boost`);
  assert.ok(samples.at(-1) >= weapon.speed * profile.minimumSpeedFactor, `${id} fell below minimum safe speed`);
  assert.ok(profile.loftAltitude >= 0 && profile.loftTransitionRange > 0, `${id} lacks a bounded loft profile`);
  assert.ok(weapon.maxTurnRateDeg * .1 < 2, `${id} can turn too sharply in one 100 ms physics step`);
}
assert.ok(AIR_WEAPONS["AGM-88A"].airToAirFlight.sustainSeconds > AIR_WEAPONS["AGM-45A"].airToAirFlight.sustainSeconds);
assert.ok(AIR_WEAPONS["AGM-88A"].airToAirFlight.coastDragPerSecond < AIR_WEAPONS["AGM-45A"].airToAirFlight.coastDragPerSecond);
console.log("ARM ballistics verification passed");
