import assert from "node:assert/strict";
import { evaluatePropagation } from "../dist-test/space-weather/propagation-effects.js";
import { applySpatialWeather } from "../dist-test/space-weather/spatial-effects.js";

const snapshot = {
  presetId:"TOTAL_BAND_DENIAL", phase:"intermittent", time:760, intensity:.78,
  hfAvailability:.08, vhfUhfReliability:.10, satelliteReliability:.06, gnssQuality:.2,
  radarNoise:.7, ionosphericScintillation:.72, magneticDisturbance:.8,
  communicationWindowOpen:true, communicationWindowStrength:.58, nextTransitionAt:824,
};
const zones = [
  { id:"magnetic", kind:"magnetic-disturbance", center:[0,0,0], radius:500 },
  { id:"window", kind:"comms-window", center:[1000,0,0], radius:300 },
];

const outside = applySpatialWeather(snapshot, [[1800,0,0]], zones);
const magnetic = applySpatialWeather(snapshot, [[0,0,0]], zones);
const window = applySpatialWeather(snapshot, [[1000,0,0]], zones);
assert.equal(outside.windowWeight, 0);
assert.equal(magnetic.disturbanceWeight, 1);
assert.equal(window.windowWeight, 1);
assert.ok(magnetic.snapshot.vhfUhfReliability < outside.snapshot.vhfUhfReliability);
assert.ok(window.snapshot.vhfUhfReliability >= .58);

const base = { channel:"link11", messageId:"spatial-test", senderId:"a", recipientId:"b", baseSuccessProbability:1, baseQuality:1, rangeRatio:.2, spatialZones:zones };
const outsideLink = evaluatePropagation(snapshot, { ...base, senderPosition:[1800,0,0], recipientPosition:[1700,0,0] });
const magneticLink = evaluatePropagation(snapshot, { ...base, senderPosition:[0,0,0], recipientPosition:[40,0,0] });
const windowLink = evaluatePropagation(snapshot, { ...base, senderPosition:[1000,0,0], recipientPosition:[1050,0,0] });
assert.ok(magneticLink.successProbability < outsideLink.successProbability);
assert.ok(windowLink.successProbability > outsideLink.successProbability);
assert.ok(magneticLink.spatialZoneIds.includes("magnetic"));
assert.ok(windowLink.spatialZoneIds.includes("window"));

console.log(JSON.stringify({
  outside:{success:outsideLink.successProbability,quality:outsideLink.qualityMultiplier},
  magnetic:{success:magneticLink.successProbability,quality:magneticLink.qualityMultiplier,zones:magneticLink.spatialZoneIds},
  window:{success:windowLink.successProbability,quality:windowLink.qualityMultiplier,zones:windowLink.spatialZoneIds},
}, null, 2));
