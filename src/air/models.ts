// Compatibility facade. Each v1.1 airframe owns an independent model module;
// callers keep the historical import path while platform-specific geometry
// and LOD policy remain out of the simulation/runtime layer.
export { createA6Model, createF14Model } from "./model-assets/us/index.js";
export { createMig29Model, createTu16Model } from "./model-assets/soviet/index.js";
