import * as THREE from "three";

export interface ArcticCoastBackdrop {
  object: THREE.Group;
  setEnabled(enabled: boolean): void;
  update(time: number): void;
  dispose(): void;
}

export function createArcticCoastBackdrop(): ArcticCoastBackdrop {
  const object = new THREE.Group();
  object.name = "norwegian-barents-distant-coast";
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const mountainMaterial = new THREE.MeshStandardMaterial({ color:0x17242b,roughness:.95,metalness:0 });
  const snowMaterial = new THREE.MeshStandardMaterial({ color:0xb9c8ce,roughness:.88,metalness:0 });
  materials.push(mountainMaterial,snowMaterial);
  for(let index=0;index<18;index++){
    const height=55+(index%5)*18, radius=70+(index%4)*22;
    const geometry=new THREE.ConeGeometry(radius,height,5,1);
    geometry.rotateY((index%3)*.34); geometries.push(geometry);
    const mountain=new THREE.Mesh(geometry,mountainMaterial);
    mountain.position.set(-1260+(index%3)*35,height*.42,-2700+index*310);
    mountain.scale.z=1.7; object.add(mountain);
    const capGeometry=new THREE.ConeGeometry(radius*.48,height*.33,5,1);
    geometries.push(capGeometry);
    const cap=new THREE.Mesh(capGeometry,snowMaterial);
    cap.position.set(mountain.position.x,height*.78,mountain.position.z);
    cap.scale.z=1.7; object.add(cap);
  }
  const lightMaterial=new THREE.MeshBasicMaterial({color:0xf2c478,transparent:true,opacity:.58,depthWrite:false});
  materials.push(lightMaterial);
  const lightGeometry=new THREE.SphereGeometry(1.6,8,5); geometries.push(lightGeometry);
  for(let index=0;index<24;index++){
    const light=new THREE.Mesh(lightGeometry,lightMaterial);
    light.position.set(-1170,4+index%3,-2550+index*225); light.userData.phase=index*.71; object.add(light);
  }
  object.visible=false;
  return {object,setEnabled(enabled){object.visible=enabled;},update(time){if(!object.visible)return;for(const child of object.children){if(child.userData.phase===undefined)continue;const material=(child as THREE.Mesh).material as THREE.MeshBasicMaterial;material.opacity=.38+.22*Math.sin(time*.35+child.userData.phase);}},dispose(){object.removeFromParent();geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());}};
}
