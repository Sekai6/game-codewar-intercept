import * as THREE from "three";

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

export function updateAewModelAnimation(model:THREE.Group,dt:number,radarOperational:boolean,speedRatio:number) {
  const rotodome=model.userData.rotodome as THREE.Group|undefined;
  if(rotodome&&radarOperational)rotodome.rotation.y+=dt*.65;
  const propellers=model.userData.propellers as THREE.Group[]|undefined;
  propellers?.forEach((propeller,index)=>propeller.rotation.z+=dt*(22+speedRatio*24+index*.4));
}
