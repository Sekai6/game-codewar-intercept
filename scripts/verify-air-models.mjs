import * as THREE from "three";
import {
  createA6Model,
  createF14Model,
  createMig29Model,
  createTu16Model,
} from "../dist-test/air/models.js";
import { AIRCRAFT_REFERENCE_DIMENSIONS } from "../dist-test/air/model-assets/dimensions.js";

const definitions = [
  {
    name:"F-14A", factory:createF14Model, dimensions:AIRCRAFT_REFERENCE_DIMENSIONS.F14A,
    required:["tandem-canopy","variable-sweep-wings","20-68-degree-wing-sweep","fixed-glove-pylons","four-fuselage-pallets","ventral-fins"],
    mounts:["wing-port-outer","wing-port-inner","wing-starboard-outer","wing-starboard-inner","tunnel-port-1","tunnel-port-2","tunnel-starboard-1","tunnel-starboard-2"],
  },
  {
    name:"Tu-16K", factory:createTu16Model, dimensions:AIRCRAFT_REFERENCE_DIMENSIONS.TU16K,
    required:["faceted-glazed-nose","full-scale-2m-per-unit","integrated-wing-root-nacelles","tail-gun-turret","twin-tail-cannon","heavy-ksr-carry-beam"],
    mounts:["wing-port-ksr","wing-starboard-ksr"],
  },
  {
    name:"A-6E", factory:createA6Model, dimensions:AIRCRAFT_REFERENCE_DIMENSIONS.A6E,
    required:["side-by-side-canopy","tram-turret","d-shaped-shoulder-intakes","folding-swept-wings","closed-wingtip-speed-brakes","five-external-pylons"],
    mounts:["wing-port-strike","wing-starboard-strike"],
  },
  {
    name:"MiG-29A", factory:createMig29Model, dimensions:AIRCRAFT_REFERENCE_DIMENSIONS.MIG29A,
    required:["73.5-degree-lerx","42-degree-main-wing","independent-engine-channels","auxiliary-intake-doors","6-degree-tail-cant","irst","three-pylon-types"],
    mounts:["wing-port-outer","wing-port-middle","wing-port-inner","wing-starboard-outer","wing-starboard-middle","wing-starboard-inner"],
  },
];

function tierStats(objects) {
  const meshes = new Set();
  const geometries = new Set();
  let triangles = 0;
  const box = new THREE.Box3();
  for (const root of objects) {
    root.updateWorldMatrix(true, true);
    box.expandByObject(root, true);
    root.traverse(object => {
      if (!object.isMesh || meshes.has(object)) return;
      meshes.add(object);
      const geometry = object.geometry;
      geometries.add(geometry.uuid);
      triangles += geometry.index ? geometry.index.count / 3 : (geometry.getAttribute("position")?.count ?? 0) / 3;
    });
  }
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  return {
    meshes:meshes.size,
    triangles:Math.round(triangles),
    extent:size.toArray().map(value=>Number(value.toFixed(3))),
    geometries,
  };
}

function tierDimensionError(tier, dimensions) {
  return Math.max(
    Math.abs(tier.extent[0] - dimensions.modelWingspan) / dimensions.modelWingspan,
    Math.abs(tier.extent[2] - dimensions.modelLength) / dimensions.modelLength,
  );
}

function sharesGeometry(first, second) {
  return [...first.geometries].some(uuid => second.geometries.has(uuid));
}

function isDescendantOfAny(object, roots) {
  for (let current = object; current; current = current.parent) if (roots.includes(current)) return true;
  return false;
}

const result = definitions.map(definition => {
  const model = definition.factory();
  model.updateMatrixWorld(true);
  const mounts = model.userData.airWeaponMounts ?? {};
  const registration = model.userData.assetDetailLod;
  const ultra = tierStats(registration?.high ?? []);
  const high = tierStats(registration?.medium ?? []);
  const low = tierStats(registration?.low ?? []);
  const tierGeometryIndependent = !sharesGeometry(ultra, high) && !sharesGeometry(ultra, low) && !sharesGeometry(high, low);
  const tierDimensionErrors = {
    ultra:Number(tierDimensionError(ultra, definition.dimensions).toFixed(4)),
    high:Number(tierDimensionError(high, definition.dimensions).toFixed(4)),
    low:Number(tierDimensionError(low, definition.dimensions).toFixed(4)),
  };
  const allTierRoots = [...(registration?.high ?? []), ...(registration?.medium ?? []), ...(registration?.low ?? [])];
  const markings = model.userData.surfaceMarkings ?? [];
  const spanError = Math.abs(ultra.extent[0] - definition.dimensions.modelWingspan) / definition.dimensions.modelWingspan;
  const lengthError = Math.abs(ultra.extent[2] - definition.dimensions.modelLength) / definition.dimensions.modelLength;
  const variableWings = model.userData.variableWings ?? [];
  const fixedGloveRig = model.userData.fixedGloveWeaponRig;
  const f14FixedStations = definition.name !== "F-14A" || definition.mounts.every(id => mounts[id]?.parent === fixedGloveRig) &&
    definition.mounts.every(id => !variableWings.includes(mounts[id]?.parent));
  return {
    name:definition.name,
    modelAssetVersion:model.userData.modelAssetVersion,
    modelLength:model.userData.modelLength,
    realLengthMeters:model.userData.realLengthMeters,
    realWingspanMeters:model.userData.realWingspanMeters,
    tags:model.userData.detailTags,
    validTags:definition.required.every(tag => model.userData.detailTags?.includes(tag)),
    noLegacyDorsalBrake:definition.name !== "A-6E" || !model.userData.detailTags?.includes("dorsal-speed-brake"),
    qualityAware:Boolean(registration?.qualityAware && registration?.exclusiveTiers),
    tiering:{ultra,high,low},
    tierDetailMonotonic:ultra.triangles > high.triangles && high.triangles > low.triangles && low.triangles > 400,
    tierReductionMeaningful:high.triangles < ultra.triangles * .85 && low.triangles < high.triangles * .85,
    tierGeometryIndependent,
    tierDimensionErrors,
    tierDimensionsValid:tierDimensionErrors.ultra < .045 && tierDimensionErrors.high < .06 && tierDimensionErrors.low < .08,
    spanError:Number(spanError.toFixed(4)),
    lengthError:Number(lengthError.toFixed(4)),
    dimensionsValid:spanError < .045 && lengthError < .045,
    exhausts:model.userData.exhausts?.length ?? 0,
    contrails:model.userData.contrails?.length ?? 0,
    mountCount:Object.keys(mounts).length,
    validMounts:definition.mounts.every(id => mounts[id]?.userData.hardware && (mounts[id]?.userData.hardwareTiers?.length ?? 0) >= 2),
    f14FixedStations,
    markingsTiered:markings.length > 0 && markings.every(marking => isDescendantOfAny(marking, allTierRoots)),
  };
});

console.log(JSON.stringify(result, null, 2));
if (result.some((model,index) =>
  model.modelAssetVersion !== "v1.1-ultra" ||
  !model.validTags || !model.noLegacyDorsalBrake || !model.qualityAware || !model.tierDetailMonotonic || !model.tierReductionMeaningful ||
  !model.tierGeometryIndependent || !model.tierDimensionsValid ||
  !model.dimensionsValid || !model.validMounts || !model.f14FixedStations || !model.markingsTiered ||
  model.mountCount !== definitions[index].mounts.length || model.contrails !== 2 || model.exhausts < 2)) process.exitCode = 1;
