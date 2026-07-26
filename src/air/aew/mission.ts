import * as THREE from "three";
export { updateAewModelAnimation } from "./model-assets/animation.js";

export function aewOrbitDirection(input:{
  position:THREE.Vector3;
  station:THREE.Vector3;
  clockwise:boolean;
  radius:number;
}) {
  const radial=input.position.clone().sub(input.station).setY(0);
  if(radial.lengthSq()<25)radial.set(input.radius,0,0);
  const tangent=new THREE.Vector3(-radial.z,0,radial.x)
    .multiplyScalar(input.clockwise?1:-1).normalize();
  const radialError=(radial.length()-input.radius)/Math.max(1,input.radius);
  tangent.addScaledVector(radial.normalize(),-radialError*.8);
  tangent.y=(input.station.y-input.position.y)*.01;
  return tangent.normalize();
}
