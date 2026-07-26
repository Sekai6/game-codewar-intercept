import {
  createA6Model,
  createF14Model,
  createMig29Model,
  createTu16Model,
} from "../dist-test/air/models.js";

const definitions = [
  ["F-14A", createF14Model, ["tandem-canopy", "variable-sweep-wings", "twin-tails"], [
    "wing-port-outer", "wing-port-inner", "wing-starboard-outer", "wing-starboard-inner",
    "tunnel-port-1", "tunnel-port-2", "tunnel-starboard-1", "tunnel-starboard-2",
  ]],
  ["Tu-16K", createTu16Model, ["glazed-nose", "wing-engine-pods", "ventral-radar"], [
    "wing-port-ksr", "wing-starboard-ksr",
  ]],
  ["A-6E", createA6Model, ["side-by-side-canopy", "blunt-radome", "dorsal-speed-brake"], [
    "wing-port-strike", "wing-starboard-strike",
  ]],
  ["MiG-29A", createMig29Model, ["lerx", "separate-intakes", "canted-twin-tails"], [
    "wing-port-outer", "wing-port-middle", "wing-port-inner",
    "wing-starboard-outer", "wing-starboard-middle", "wing-starboard-inner",
  ]],
];
const result = definitions.map(([name, factory, required, requiredMounts]) => {
  const model = factory();
  const mounts = model.userData.airWeaponMounts ?? {};
  let meshes = 0;
  model.traverse((object) => { if (object.isMesh) meshes++; });
  const variableWings = model.userData.variableWings ?? [];
  const wingMountsFollowSwing = name !== "F-14A" || requiredMounts
    .filter((id) => id.startsWith("wing-"))
    .every((id) => variableWings.includes(mounts[id]?.parent));
  const markings = model.userData.surfaceMarkings ?? [];
  const lodHigh = model.userData.assetDetailLod?.high ?? [];
  return {
    name,
    meshes,
    tags: model.userData.detailTags,
    exhausts: model.userData.exhausts?.length ?? 0,
    contrails: model.userData.contrails?.length ?? 0,
    validTags: required.every((tag) => model.userData.detailTags?.includes(tag)),
    mountCount: Object.keys(mounts).length,
    validMounts: requiredMounts.every((id) => mounts[id]?.userData.hardware),
    wingMountsFollowSwing,
    markingsFollowLod: markings.every((marking) => lodHigh.includes(marking)),
  };
});
console.log(JSON.stringify(result, null, 2));
if (result.some((model, index) =>
  !model.validTags || !model.validMounts || !model.wingMountsFollowSwing || !model.markingsFollowLod ||
  model.mountCount !== definitions[index][3].length || model.meshes < 18 || model.meshes > 52 ||
  model.contrails !== 2 || model.exhausts < 2))
  process.exitCode = 1;
