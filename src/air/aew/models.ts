import * as THREE from "three";

const paint = (color: number) => new THREE.MeshStandardMaterial({ color, metalness:.32, roughness:.5 });
const dark = new THREE.MeshStandardMaterial({ color:0x252b2c, metalness:.5, roughness:.38 });
const glass = new THREE.MeshPhysicalMaterial({ color:0x21475a, roughness:.12, clearcoat:1 });

function fuselage(radius:number, length:number, material:THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius,length-radius*2,6,18),material);
  mesh.rotation.x=Math.PI/2; return mesh;
}

function wing(span:number, chord:number, sweep:number, material:THREE.Material) {
  const shape=new THREE.Shape();
  shape.moveTo(-span,chord*.5-sweep); shape.lineTo(span,chord*.5-sweep);
  shape.lineTo(span,-chord*.25-sweep); shape.lineTo(-span,-chord*.25-sweep); shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:false});
  geometry.rotateX(Math.PI/2); geometry.translate(0,0,-.045);
  return new THREE.Mesh(geometry,material);
}

function addPropeller(group:THREE.Group,x:number,z:number,scale:number,material:THREE.Material) {
  const nacelle=fuselage(.32*scale,1.65*scale,material); nacelle.position.set(x,0,z); group.add(nacelle);
  const propeller=new THREE.Group(); propeller.position.set(x,0,z-.92*scale);
  for(let index=0;index<4;index++) {
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.06*scale,1.15*scale,.035),dark);
    blade.position.y=.53*scale; blade.rotation.z=index*Math.PI/2; propeller.add(blade);
  }
  group.add(propeller); ((group.userData.propellers??=[]) as THREE.Group[]).push(propeller);
}

function addRotodome(group:THREE.Group,radius:number,y:number,material:THREE.Material) {
  const pylon=new THREE.Mesh(new THREE.BoxGeometry(.16,y*.55,.16),dark); pylon.position.y=y*.65; group.add(pylon);
  const rotodome=new THREE.Group(); rotodome.position.y=y;
  rotodome.add(new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.22,32),material));
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(radius*1.8,.23,.035),dark); rotodome.add(stripe);
  group.add(rotodome); group.userData.rotodome=rotodome;
}

function finish(group:THREE.Group,length:number,tags:string[]) {
  group.rotation.order="YXZ"; group.userData.forwardAxis="-Z";
  group.userData.modelLength=length; group.userData.detailTags=tags;
  group.userData.exhausts=[]; group.userData.contrails=[];
  group.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=true;});
  return group;
}

export function createE2cModel() {
  const g=new THREE.Group(),metal=paint(0xa9b0ae);
  g.add(fuselage(.62,8.7,metal));
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.5,14,8),glass); cockpit.scale.set(1,.65,1.4); cockpit.position.set(0,.35,-3.3); g.add(cockpit);
  const mainWing=wing(6.15,2.05,.25,metal); mainWing.position.y=.35; g.add(mainWing);
  addPropeller(g,-2.25,-.25,1.05,metal); addPropeller(g,2.25,-.25,1.05,metal);
  const tailplane=wing(2.35,1.0,-.05,metal); tailplane.position.set(0,.35,3.45); g.add(tailplane);
  for(const side of [-1,1])for(const x of [.65,1.62]) {
    const fin=new THREE.Mesh(new THREE.BoxGeometry(.08,1.25,.85),metal); fin.position.set(side*x,.82,3.45); fin.rotation.x=-.22; g.add(fin);
  }
  addRotodome(g,1.82,1.45,paint(0xd0d2c9));
  return finish(g,8.8,["high-wing","twin-turboprop","four-fin-tail","7.3m-rotodome","carrier-aew"]);
}

export function createTu126Model() {
  const g=new THREE.Group(),metal=paint(0xb2b3ad);
  g.add(fuselage(.84,14.3,metal));
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.6,14,8),glass); cockpit.scale.set(1,.6,1.35); cockpit.position.set(0,.5,-5.8); g.add(cockpit);
  const mainWing=wing(7.05,3.1,1.4,metal); mainWing.position.y=.3; g.add(mainWing);
  for(const side of [-1,1]) { addPropeller(g,side*2.5,-.45,1.2,metal); addPropeller(g,side*4.65,.05,1.15,metal); }
  const tailplane=wing(3.05,1.45,-.05,metal); tailplane.position.set(0,.5,5.35); g.add(tailplane);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.12,2.75,1.55),metal); fin.position.set(0,1.35,5.05); fin.rotation.x=-.25; g.add(fin);
  addRotodome(g,1.38,1.82,paint(0xc4c3b9));
  return finish(g,14.3,["very-large-airframe","four-turboprop","swept-wing","single-fin","liana-rotodome","land-based-aew"]);
}
