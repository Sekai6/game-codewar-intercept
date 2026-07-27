import * as THREE from "three";
import { AEW_PLATFORM_DEFINITIONS } from "../dist-test/air/aew/catalog.js";
import { aewOrbitDirection, updateAewModelAnimation } from "../dist-test/air/aew/mission.js";
import { AewCommandNetwork } from "../dist-test/air/aew/command-network.js";
import { AIRCRAFT_REFERENCE_DIMENSIONS } from "../dist-test/air/model-assets/dimensions.js";

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
      geometries.add(object.geometry.uuid);
      triangles += object.geometry.index
        ? object.geometry.index.count / 3
        : (object.geometry.getAttribute("position")?.count ?? 0) / 3;
    });
  }
  return {
    meshes:meshes.size,
    triangles:Math.round(triangles),
    extent:box.getSize(new THREE.Vector3()).toArray().map(value=>Number(value.toFixed(3))),
    geometries,
  };
}

function tierDimensionError(tier, dimensions) {
  const span=Math.abs(tier.extent[0]-dimensions.modelWingspan)/dimensions.modelWingspan;
  const height=Math.abs(tier.extent[1]-dimensions.modelHeight)/dimensions.modelHeight;
  const length=Math.abs(tier.extent[2]-dimensions.modelLength)/dimensions.modelLength;
  return {span:Number(span.toFixed(4)),height:Number(height.toFixed(4)),length:Number(length.toFixed(4)),maximum:Number(Math.max(span,height,length).toFixed(4))};
}

function sharesGeometry(first,second){return [...first.geometries].some(uuid=>second.geometries.has(uuid));}

const expectedDimensions={"E-2C":AIRCRAFT_REFERENCE_DIMENSIONS.E2C,"TU-126":AIRCRAFT_REFERENCE_DIMENSIONS.TU126};
const triangleBudgets={"E-2C":{ultra:13000,high:5500,low:1300},"TU-126":{ultra:19000,high:7500,low:2000}};
const byId=Object.fromEntries(AEW_PLATFORM_DEFINITIONS.map(definition=>[definition.id,definition]));
const models=AEW_PLATFORM_DEFINITIONS.map(definition=>{
  const model=definition.buildModel();
  model.updateMatrixWorld(true);
  const registration=model.userData.assetDetailLod;
  const ultra=tierStats(registration.high),high=tierStats(registration.medium),low=tierStats(registration.low);
  const dimensions=expectedDimensions[definition.id];
  const tierDimensionErrors={ultra:tierDimensionError(ultra,dimensions),high:tierDimensionError(high,dimensions),low:tierDimensionError(low,dimensions)};
  const triangleBudget=triangleBudgets[definition.id];
  const assemblies=model.userData.propellerAssemblies??[];
  const before=assemblies[0]?.rotors.map(rotor=>rotor.object.rotation.z)??[];
  updateAewModelAnimation(model,.1,true,.8);
  const rotationDelta=assemblies[0]?.rotors.map((rotor,index)=>Number((rotor.object.rotation.z-(before[index]??0)).toFixed(3)))??[];
  const spanError=Math.abs(ultra.extent[0]-dimensions.modelWingspan)/dimensions.modelWingspan;
  const heightError=Math.abs(ultra.extent[1]-dimensions.modelHeight)/dimensions.modelHeight;
  const lengthError=Math.abs(ultra.extent[2]-dimensions.modelLength)/dimensions.modelLength;
  return {
    id:definition.id,
    version:model.userData.modelAssetVersion,
    length:model.userData.modelLength,
    tags:model.userData.detailTags,
    propellers:model.userData.propellers?.length??0,
    assemblyCount:assemblies.length,
    rotorCounts:[...new Set(assemblies.map(propeller=>propeller.rotors.length))],
    rotationDelta,
    counterRotation:definition.id!=="TU-126"||rotationDelta.length===2&&rotationDelta[0]*rotationDelta[1]<0,
    rotodome:!!model.userData.rotodome,
    qualityAware:Boolean(registration.qualityAware&&registration.exclusiveTiers),
    tiering:{ultra,high,low},
    triangleBudget,
    triangleBudgetValid:ultra.triangles>=triangleBudget.ultra&&high.triangles>=triangleBudget.high&&low.triangles>=triangleBudget.low,
    tierDetailMonotonic:ultra.triangles>high.triangles&&high.triangles>low.triangles&&low.triangles>400,
    // Require a deliberate authored reduction, not a nominal triangle drop.
    tierReductionMeaningful:high.triangles<ultra.triangles*.6&&low.triangles<high.triangles*.5,
    tierGeometryIndependent:!sharesGeometry(ultra,high)&&!sharesGeometry(ultra,low)&&!sharesGeometry(high,low),
    tierDimensionErrors,
    tierDimensionsValid:tierDimensionErrors.ultra.maximum<.04&&tierDimensionErrors.high.maximum<.065&&tierDimensionErrors.low.maximum<.095,
    dimensionsValid:spanError<.025&&heightError<.04&&lengthError<.025,
    spanError:Number(spanError.toFixed(4)),
    heightError:Number(heightError.toFixed(4)),
    lengthError:Number(lengthError.toFixed(4)),
  };
});

const station=new THREE.Vector3(0,90,0),position=new THREE.Vector3(90,90,0);
const orbit=aewOrbitDirection({position,station,clockwise:true,radius:75});
const network=new AewCommandNetwork();
const track={targetId:"secret-target-entity",position:new THREE.Vector3(100,70,0),velocity:new THREE.Vector3(0,0,4),quality:.72,uncertainty:14,lastUpdate:0,classification:"aircraft",observationId:"sensor-observation-1"};
const unknownAirTrack={targetId:"unidentified-air-contact",position:new THREE.Vector3(-90,68,20),velocity:new THREE.Vector3(0,0,-3),quality:.18,uncertainty:38,lastUpdate:0,classification:"unknown",observationId:"sensor-observation-unknown-air-1"};
const nodes=[{id:"blue-e2",side:"blue",position:new THREE.Vector3(),velocity:new THREE.Vector3(),alive:true,mode:"link4a",controllerCapacity:2,commandDelay:1.2,commandLife:10,reliability:.94,fighterPlatformIds:["F-14A"],tracks:[track]},{id:"red-tu126",side:"red",position:new THREE.Vector3(),velocity:new THREE.Vector3(),alive:true,mode:"voice-gci",controllerCapacity:1,commandDelay:4.5,commandLife:16,reliability:.78,fighterPlatformIds:["MIG-29A"],tracks:[unknownAirTrack]}];
const participants=[{id:"f14-1",side:"blue",platformId:"F-14A",position:new THREE.Vector3(),alive:true},{id:"f14-2",side:"blue",platformId:"F-14A",position:new THREE.Vector3(),alive:true},{id:"mig-1",side:"red",platformId:"MIG-29A",position:new THREE.Vector3(),alive:true},{id:"mig-2",side:"red",platformId:"MIG-29A",position:new THREE.Vector3(),alive:true}];
network.update(0,nodes,participants);const beforeDelivery=network.active(1).length;
network.update(2,nodes,participants);const link4=network.active(2);
network.update(5,nodes,participants);const commands=network.active(5);
const result={models,platforms:AEW_PLATFORM_DEFINITIONS.map(definition=>({id:definition.id,mission:definition.mission,coverage:definition.sensor.coverage,fov:definition.sensor.fieldOfViewDeg,range:definition.sensor.range,ammo:Object.values(definition.loadout).reduce((sum,count)=>sum+count,0),hardpoints:definition.hardpoints.length})),orbit:{x:orbit.x,y:orbit.y,z:orbit.z},network:{beforeDelivery,link4:link4.map(command=>command.participantId),commands:commands.map(command=>({participantId:command.participantId,mode:command.mode,track:command.controllerTrackId,quality:command.quality,uncertainty:command.uncertainty,hasTruthId:Object.hasOwn(command,"targetId")}))}};
console.log(JSON.stringify(result,null,2));
const e2=models.find(model=>model.id==="E-2C"),tu126=models.find(model=>model.id==="TU-126");
if(!byId["E-2C"]||!byId["TU-126"]||byId["TU-126"].radarCrossSection<=byId["E-2C"].radarCrossSection*5||
  models.some(model=>model.version!=="v1.1-ultra"||!model.rotodome||!model.qualityAware||!model.triangleBudgetValid||!model.tierDetailMonotonic||!model.tierReductionMeaningful||!model.tierGeometryIndependent||!model.tierDimensionsValid||!model.dimensionsValid)||
  e2?.propellers!==2||e2?.assemblyCount!==6||e2?.rotorCounts.join(",")!=="1"||
  tu126?.propellers!==4||tu126?.assemblyCount!==12||tu126?.rotorCounts.join(",")!=="2"||!tu126?.counterRotation||
  result.platforms.some(platform=>platform.mission!=="aew"||platform.coverage!=="rotating-360"||platform.fov!==360||platform.ammo!==0||platform.hardpoints!==0)||
  orbit.z<.7||orbit.x>-.05||beforeDelivery!==0||link4.length!==1||commands.filter(command=>command.mode==="link4a").length!==2||commands.filter(command=>command.mode==="voice-gci").length!==1||commands.find(command=>command.mode==="voice-gci")?.quality!==.08||commands.find(command=>command.mode==="voice-gci")?.uncertainty!==88||commands.some(command=>command.controllerTrackId.includes("secret-target")||command.controllerTrackId.includes("unidentified-air-contact")||Object.hasOwn(command,"targetId")))process.exitCode=1;
