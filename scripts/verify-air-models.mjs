import * as THREE from "three";
import {
  applyDeclaredWingSweep,
  createA6Model,
  createF14Model,
  createMig29Model,
  createTu16Model,
  declaredWingSweepRange,
} from "../dist-test/air/models.js";
import { AIRCRAFT_REFERENCE_DIMENSIONS } from "../dist-test/air/model-assets/dimensions.js";
import { TAPERED_PYLON_RAIL_BOTTOM_Y } from "../dist-test/air/model-assets/us/geometry.js";
import { createLoftedFuselageGeometry } from "../dist-test/air/model-assets/model-kit.js";

const definitions = [
  {
    name:"F-14A", factory:createF14Model, dimensions:AIRCRAFT_REFERENCE_DIMENSIONS.F14A,
    triangleBudget:{ultra:10000,high:4200,low:900},
    required:["tandem-canopy","variable-sweep-wings","20-68-degree-wing-sweep","fixed-glove-pylons","four-fuselage-pallets","ventral-fins"],
    mounts:["wing-port-outer","wing-port-inner","wing-starboard-outer","wing-starboard-inner","tunnel-port-1","tunnel-port-2","tunnel-starboard-1","tunnel-starboard-2"],
  },
  {
    name:"Tu-16K", factory:createTu16Model, dimensions:AIRCRAFT_REFERENCE_DIMENSIONS.TU16K,
    triangleBudget:{ultra:15000,high:6000,low:1400},
    required:["faceted-glazed-nose","full-scale-2m-per-unit","integrated-wing-root-nacelles","tail-gun-turret","twin-tail-cannon","heavy-ksr-carry-beam"],
    mounts:["wing-port-ksr","wing-starboard-ksr"],
  },
  {
    name:"A-6E", factory:createA6Model, dimensions:AIRCRAFT_REFERENCE_DIMENSIONS.A6E,
    triangleBudget:{ultra:10000,high:4200,low:900},
    required:["side-by-side-canopy","tram-turret","d-shaped-shoulder-intakes","folding-swept-wings","closed-wingtip-speed-brakes","five-external-pylons"],
    mounts:["wing-port-strike","wing-starboard-strike"],
  },
  {
    name:"MiG-29A", factory:createMig29Model, dimensions:AIRCRAFT_REFERENCE_DIMENSIONS.MIG29A,
    triangleBudget:{ultra:11000,high:4800,low:1100},
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
  const span = Math.abs(tier.extent[0] - dimensions.modelWingspan) / dimensions.modelWingspan;
  const height = Math.abs(tier.extent[1] - dimensions.modelHeight) / dimensions.modelHeight;
  const length = Math.abs(tier.extent[2] - dimensions.modelLength) / dimensions.modelLength;
  return {
    span:Number(span.toFixed(4)),
    height:Number(height.toFixed(4)),
    length:Number(length.toFixed(4)),
    maximum:Number(Math.max(span,height,length).toFixed(4)),
  };
}

function sharesGeometry(first, second) {
  return [...first.geometries].some(uuid => second.geometries.has(uuid));
}

function isDescendantOfAny(object, roots) {
  for (let current = object; current; current = current.parent) if (roots.includes(current)) return true;
  return false;
}

function sharedLoftNormalsFaceOutward() {
  const geometry = createLoftedFuselageGeometry([
    { z:-1, radiusX:1, radiusY:.7 },
    { z:0, radiusX:1, radiusY:.7 },
    { z:1, radiusX:1, radiusY:.7 },
  ], 24);
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  let minimumRadialDot = Infinity;
  for (let index = 0; index < positions.count; index++) {
    const outward = new THREE.Vector3(
      positions.getX(index),
      positions.getY(index) / (.7 * .7),
      0,
    ).normalize();
    const normal = new THREE.Vector3(
      normals.getX(index),
      normals.getY(index),
      normals.getZ(index),
    ).normalize();
    minimumRadialDot = Math.min(minimumRadialDot, outward.dot(normal));
  }
  geometry.dispose();
  return { valid:minimumRadialDot > .92, minimumRadialDot:Number(minimumRadialDot.toFixed(4)) };
}

const sharedLoftOutwardNormals = sharedLoftNormalsFaceOutward();

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
    ultra:tierDimensionError(ultra, definition.dimensions),
    high:tierDimensionError(high, definition.dimensions),
    low:tierDimensionError(low, definition.dimensions),
  };
  const allTierRoots = [...(registration?.high ?? []), ...(registration?.medium ?? []), ...(registration?.low ?? [])];
  const markings = model.userData.surfaceMarkings ?? [];
  const spanError = Math.abs(ultra.extent[0] - definition.dimensions.modelWingspan) / definition.dimensions.modelWingspan;
  const heightError = Math.abs(ultra.extent[1] - definition.dimensions.modelHeight) / definition.dimensions.modelHeight;
  const lengthError = Math.abs(ultra.extent[2] - definition.dimensions.modelLength) / definition.dimensions.modelLength;
  const variableWings = model.userData.variableWings ?? [];
  let sweptWingExtent = null;
  let sweptWingError = 0;
  let f14DeclaredSweepValid = true;
  let f14SweepDirectionsValid = true;
  let f14IntakeThroatsValid = true;
  let f14PortTailBeaconAttached = true;
  let f14GloveRailContactValid = true;
  let f14FuselageMarkingsValid = true;
  if (definition.name === "F-14A" && variableWings.length === 2 && definition.dimensions.sweptModelWingspan) {
    const originalRotations = variableWings.map(wing => wing.rotation.y);
    const range = declaredWingSweepRange(model);
    const expectedMinimum = THREE.MathUtils.degToRad(20);
    const expectedMaximum = THREE.MathUtils.degToRad(68);
    f14DeclaredSweepValid = Boolean(
      range &&
      Math.abs(range[0] - expectedMinimum) < 1e-9 &&
      Math.abs(range[1] - expectedMaximum) < 1e-9,
    );
    applyDeclaredWingSweep(model, 0);
    const minimumDirectionsValid = variableWings.every(wing => {
      const expectedSign = wing.name.includes("starboard") ? -1 : 1;
      return Math.abs(wing.rotation.y - expectedSign * expectedMinimum) < 1e-9;
    });
    applyDeclaredWingSweep(model, 1);
    const maximumDirectionsValid = variableWings.every(wing => {
      const expectedSign = wing.name.includes("starboard") ? -1 : 1;
      return Math.abs(wing.rotation.y - expectedSign * expectedMaximum) < 1e-9;
    });
    f14SweepDirectionsValid = minimumDirectionsValid && maximumDirectionsValid;
    model.updateMatrixWorld(true);
    const swept = tierStats(registration?.high ?? []);
    sweptWingExtent = swept.extent[0];
    sweptWingError = Math.abs(swept.extent[0] - definition.dimensions.sweptModelWingspan) / definition.dimensions.sweptModelWingspan;
    variableWings.forEach((wing, index) => { wing.rotation.y = originalRotations[index]; });
    model.updateMatrixWorld(true);

    const intakeThroats = [];
    model.traverse(object => {
      if (object.name.startsWith("f14-intake-throat:")) intakeThroats.push(object);
    });
    f14IntakeThroatsValid = intakeThroats.length === 6 && intakeThroats.every(throat =>
      throat.parent?.name.startsWith("f14-intake:") && throat.position.z > 0,
    );
    const portTailBeacon = model.getObjectByName("f14-vertical-tail-anti-collision:port:ultra");
    f14PortTailBeaconAttached = Boolean(
      portTailBeacon?.parent?.name === "f14-tail-fin:port:ultra" &&
      portTailBeacon.position.y > 1.2 &&
      Math.abs(portTailBeacon.position.z) < 0.2,
    );
    f14GloveRailContactValid = definition.mounts
      .filter(id => id.startsWith("wing-"))
      .every(id => Math.abs(
        Number(mounts[id]?.userData.weaponUpperContactY) - TAPERED_PYLON_RAIL_BOTTOM_Y,
      ) < 1e-9);
    const fuselageMarkings = markings.filter(marking =>
      marking.name.startsWith("f14-fuselage-marking:"),
    );
    f14FuselageMarkingsValid = fuselageMarkings.length === 4 &&
      fuselageMarkings.every(marking =>
        marking.userData.surfaceAnchor === "engine-nacelle-outboard" &&
        Number(marking.userData.surfaceOffset) > 0 &&
        Number(marking.userData.surfaceOffset) < 0.02 &&
        Math.abs(marking.position.x) > 1.6 &&
        Math.abs(marking.position.x) < 1.65 &&
        (marking.parent?.name === "aircraft-tier:ultra" ||
          marking.parent?.name === "aircraft-tier:high"),
      );
  }
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
    triangleBudget:definition.triangleBudget,
    triangleBudgetValid:
      ultra.triangles >= definition.triangleBudget.ultra &&
      high.triangles >= definition.triangleBudget.high &&
      low.triangles >= definition.triangleBudget.low,
    tierDetailMonotonic:ultra.triangles > high.triangles && high.triangles > low.triangles && low.triangles > 400,
    // Require a deliberate authored reduction, not a nominal triangle drop.
    tierReductionMeaningful:high.triangles < ultra.triangles * .6 && low.triangles < high.triangles * .5,
    tierGeometryIndependent,
    tierDimensionErrors,
    tierDimensionsValid:
      tierDimensionErrors.ultra.maximum < .055 &&
      tierDimensionErrors.high.maximum < .075 &&
      tierDimensionErrors.low.maximum < .11,
    spanError:Number(spanError.toFixed(4)),
    sweptWingExtent: sweptWingExtent === null ? null : Number(sweptWingExtent.toFixed(4)),
    sweptWingError:Number(sweptWingError.toFixed(4)),
    f14DeclaredSweepValid,
    f14SweepDirectionsValid,
    f14IntakeThroatsValid,
    f14PortTailBeaconAttached,
    f14GloveRailContactValid,
    f14FuselageMarkingsValid,
    heightError:Number(heightError.toFixed(4)),
    lengthError:Number(lengthError.toFixed(4)),
    dimensionsValid:spanError < .045 && heightError < .055 && lengthError < .045,
    exhausts:model.userData.exhausts?.length ?? 0,
    contrails:model.userData.contrails?.length ?? 0,
    mountCount:Object.keys(mounts).length,
    validMounts:definition.mounts.every(id => mounts[id]?.userData.hardware && (mounts[id]?.userData.hardwareTiers?.length ?? 0) >= 2),
    f14FixedStations,
    markingsTiered:markings.length > 0 && markings.every(marking => isDescendantOfAny(marking, allTierRoots)),
    sharedLoftOutwardNormals,
  };
});

console.log(JSON.stringify(result, null, 2));
if (result.some((model,index) =>
  model.modelAssetVersion !== "v1.1-ultra" ||
  !model.sharedLoftOutwardNormals.valid ||
  !model.validTags || !model.noLegacyDorsalBrake || !model.qualityAware || !model.triangleBudgetValid || !model.tierDetailMonotonic || !model.tierReductionMeaningful ||
  !model.tierGeometryIndependent || !model.tierDimensionsValid ||
  !model.dimensionsValid || (model.name === "F-14A" && (
    model.sweptWingError >= .055 ||
    !model.f14DeclaredSweepValid ||
    !model.f14SweepDirectionsValid ||
    !model.f14IntakeThroatsValid ||
    !model.f14PortTailBeaconAttached ||
    !model.f14GloveRailContactValid ||
    !model.f14FuselageMarkingsValid
  )) || !model.validMounts || !model.f14FixedStations || !model.markingsTiered ||
  model.mountCount !== definitions[index].mounts.length || model.contrails !== 2 || model.exhausts < 2)) process.exitCode = 1;
