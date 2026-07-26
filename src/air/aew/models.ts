import * as THREE from "three";

const paint = (color: number) => new THREE.MeshStandardMaterial({ color, metalness:.32, roughness:.5 });
const dark = new THREE.MeshStandardMaterial({ color:0x252b2c, metalness:.5, roughness:.38 });
const glass = new THREE.MeshPhysicalMaterial({ color:0x21475a, roughness:.12, clearcoat:1 });
const propellerBlade = new THREE.MeshStandardMaterial({ color:0x434b4a, metalness:.44, roughness:.42 });
const propellerBlur = new THREE.MeshBasicMaterial({
  color:0xa8b4b1,
  transparent:true,
  opacity:.075,
  side:THREE.DoubleSide,
  depthWrite:false,
});

function fuselage(radius:number, length:number, material:THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius,length-radius*2,6,18),material);
  mesh.rotation.x=Math.PI/2; return mesh;
}

function halfWing(
  side:number,
  span:number,
  rootChord:number,
  tipChord:number,
  sweep:number,
  material:THREE.Material,
  thickness=.1,
) {
  const tipLeading=-rootChord*.5+sweep;
  const shape=new THREE.Shape();
  shape.moveTo(0,-rootChord*.5);
  shape.lineTo(side*span,tipLeading);
  shape.lineTo(side*span,tipLeading+tipChord);
  shape.lineTo(0,rootChord*.5);
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});
  geometry.translate(0,0,-thickness*.5);
  geometry.rotateX(Math.PI/2);
  return new THREE.Mesh(geometry,material);
}

function verticalFin(points:readonly [number,number][],thickness:number,material:THREE.Material) {
  const shape=new THREE.Shape();
  points.forEach(([z,y],index)=>index?shape.lineTo(z,y):shape.moveTo(z,y));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});
  geometry.translate(0,0,-thickness*.5);
  geometry.rotateY(-Math.PI/2);
  return new THREE.Mesh(geometry,material);
}

function starGeometry(radius:number) {
  const shape=new THREE.Shape();
  for(let index=0;index<10;index++) {
    const angle=Math.PI/2+index*Math.PI/5;
    const r=index%2?radius*.42:radius;
    const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
    if(index===0)shape.moveTo(x,y);else shape.lineTo(x,y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function addSovietWingMarking(group:THREE.Group,x:number,y:number,z:number) {
  const marking=new THREE.Group();
  const border=new THREE.Mesh(starGeometry(.34),new THREE.MeshStandardMaterial({color:0xf2cf4b,roughness:.66}));
  border.rotation.x=-Math.PI/2;
  marking.add(border);
  const star=new THREE.Mesh(starGeometry(.285),new THREE.MeshStandardMaterial({color:0xc52228,roughness:.7}));
  star.rotation.x=-Math.PI/2;
  star.position.y=.008;
  marking.add(star);
  marking.position.set(x,y,z);
  group.add(marking);
}

function addUsWingMarking(group:THREE.Group,x:number,y:number,z:number) {
  const marking=new THREE.Group();
  const white=new THREE.MeshStandardMaterial({color:0xe7ece8,roughness:.7});
  const center=new THREE.Mesh(
    new THREE.CircleGeometry(.31,24),
    new THREE.MeshStandardMaterial({color:0x214c78,roughness:.68}),
  );
  center.rotation.x=-Math.PI/2;
  marking.add(center);
  const star=new THREE.Mesh(starGeometry(.19),white);
  star.rotation.x=-Math.PI/2;
  star.position.y=.008;
  marking.add(star);
  for(const side of [-1,1]) {
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.31,.018,.13),white);
    bar.position.set(side*.35,.006,0);
    marking.add(bar);
  }
  marking.position.set(x,y,z);
  group.add(marking);
}

function addNavigationLights(group:THREE.Group,span:number,y:number,z:number) {
  for(const side of [-1,1]) {
    const light=new THREE.Mesh(
      new THREE.SphereGeometry(.075,8,6),
      new THREE.MeshBasicMaterial({color:side<0?0xff4038:0x4cf08b}),
    );
    light.position.set(side*span,y,z);
    group.add(light);
  }
}

function addPropeller(
  group:THREE.Group,
  x:number,
  z:number,
  nacelleScale:number,
  material:THREE.Material,
  propellerScale=nacelleScale,
) {
  const nacelle=fuselage(.32*nacelleScale,1.65*nacelleScale,material); nacelle.position.set(x,0,z); group.add(nacelle);
  const propeller=new THREE.Group(); propeller.position.set(x,0,z-.94*nacelleScale);
  const spinner=new THREE.Mesh(new THREE.ConeGeometry(.18*propellerScale,.36*propellerScale,12),dark);
  spinner.rotation.x=-Math.PI/2;
  spinner.position.z=-.12*propellerScale;
  propeller.add(spinner);
  for(const rotorOffset of [-.035,.035]) {
    const rotor=new THREE.Group();
    rotor.position.z=rotorOffset*propellerScale;
    rotor.rotation.z=rotorOffset>0?Math.PI/8:0;
    for(let index=0;index<4;index++) {
      const arm=new THREE.Group();
      arm.rotation.z=index*Math.PI/2;
      const blade=new THREE.Mesh(new THREE.BoxGeometry(.075*propellerScale,1.08*propellerScale,.025),propellerBlade);
      blade.position.y=.5*propellerScale;
      arm.add(blade);
      rotor.add(arm);
    }
    propeller.add(rotor);
  }
  const blur=new THREE.Mesh(new THREE.CircleGeometry(1.08*propellerScale,32),propellerBlur);
  blur.position.z=.055*propellerScale;
  propeller.add(blur);
  group.add(propeller); ((group.userData.propellers??=[]) as THREE.Group[]).push(propeller);
}

function addRotodome(group:THREE.Group,radius:number,y:number,material:THREE.Material,baseY=.62,supportSpan=.52) {
  const domeBottom=y-.11;
  const supportHeight=Math.max(.28,domeBottom-baseY);
  const base=new THREE.Mesh(new THREE.BoxGeometry(supportSpan*1.5,.12,.48),dark);
  base.position.y=baseY;
  group.add(base);
  for(const side of [-1,1]) {
    const pylon=new THREE.Mesh(new THREE.BoxGeometry(.14,supportHeight,.18),dark);
    pylon.position.set(side*supportSpan*.36,baseY+supportHeight*.5,0);
    pylon.rotation.z=side*-.16;
    group.add(pylon);
  }
  const rotodome=new THREE.Group(); rotodome.position.y=y;
  rotodome.add(new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.22,32),material));
  const rim=new THREE.Mesh(new THREE.TorusGeometry(radius*.96,.035,6,32),dark);
  rim.rotation.x=Math.PI/2;
  rotodome.add(rim);
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
  for(const side of [-1,1]) {
    const mainWing=halfWing(side,6.15,2.1,.72,.38,metal,.1);
    mainWing.position.y=.36;
    g.add(mainWing);
    const tailplane=halfWing(side,2.35,1.05,.45,.28,metal,.08);
    tailplane.position.set(0,.35,3.42);
    g.add(tailplane);
  }
  addPropeller(g,-2.25,-.25,1.05,metal,.95); addPropeller(g,2.25,-.25,1.05,metal,.95);
  for(const side of [-1,1])for(const x of [.65,1.62]) {
    const fin=verticalFin([[-.42,0],[.42,0],[.27,1.22],[-.1,1.22]],.08,metal);
    fin.position.set(side*x,.36,3.38);
    g.add(fin);
  }
  addRotodome(g,1.82,1.45,paint(0xd0d2c9),.65,.62);
  addUsWingMarking(g,-3.65,.422,-.16);
  addUsWingMarking(g,3.65,.422,-.16);
  addNavigationLights(g,6.08,.37,-.3);
  const tailLight=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),new THREE.MeshBasicMaterial({color:0xe8f2ef}));
  tailLight.position.set(0,.42,4.32);
  g.add(tailLight);
  return finish(g,8.8,["high-tapered-wing","twin-turboprop","four-fin-tail","7.3m-rotodome","us-markings","carrier-aew"]);
}

export function createTu126Model() {
  const g=new THREE.Group(),metal=paint(0xb2b3ad);
  g.add(fuselage(.84,14.3,metal));
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.6,14,8),glass); cockpit.scale.set(1,.6,1.35); cockpit.position.set(0,.5,-5.8); g.add(cockpit);
  for(const side of [-1,1]) {
    const mainWing=halfWing(side,6.38,3.2,1.05,2.45,metal,.11);
    mainWing.position.y=.32;
    g.add(mainWing);
    const tailplane=halfWing(side,3.12,1.5,.58,1.12,metal,.09);
    tailplane.position.set(0,.48,5.15);
    g.add(tailplane);
  }
  addPropeller(g,-2.25,-.48,1.2,metal,.65);
  addPropeller(g,2.25,-.48,1.2,metal,.65);
  addPropeller(g,-4.35,.3,1.15,metal,.65);
  addPropeller(g,4.35,.3,1.15,metal,.65);
  const fin=verticalFin([[-1.05,0],[1.0,0],[.72,2.78],[.18,2.78]],.14,metal);
  fin.position.set(0,.55,5.25);
  g.add(fin);
  addRotodome(g,1.38,1.92,paint(0xc4c3b9),.82,.78);
  addSovietWingMarking(g,-3.9,.392,.98);
  addSovietWingMarking(g,3.9,.392,.98);
  addNavigationLights(g,6.33,.34,1.42);
  const tailLight=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshBasicMaterial({color:0xe8f2ef}));
  tailLight.position.set(0,.62,7.0);
  g.add(tailLight);
  return finish(g,14.3,["very-large-airframe","four-contra-rotating-turboprops","tapered-swept-wing","single-fin","twin-strut-liana-rotodome","soviet-markings","land-based-aew"]);
}
