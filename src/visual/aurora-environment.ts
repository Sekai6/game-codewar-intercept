import * as THREE from "three";

export interface AuroraEnvironment {
  readonly object: THREE.Group;
  readonly layerCount: number;
  setEnabled(enabled: boolean): void;
  update(time: number, cameraPosition: THREE.Vector3): void;
  dispose(): void;
}

export function createAuroraEnvironment(): AuroraEnvironment {
  const object = new THREE.Group();
  object.name = "ultra-aurora-easter-egg";
  const geometry = new THREE.SphereGeometry(1180, 64, 40);
  const materials: THREE.ShaderMaterial[] = [];
  const layers: THREE.Mesh[] = [];
  for (let layer = 0; layer < 3; layer++) {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
      uniforms: {
        time: { value: 0 },
        phase: { value: layer * 2.17 },
        intensity: { value: 0.72 - layer * 0.12 },
      },
      vertexShader: `varying vec3 vDirection;void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        precision highp float;varying vec3 vDirection;uniform float time;uniform float phase;uniform float intensity;
        float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
        float fbm(vec2 p){float n=0.,a=.55;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+vec2(7.1,3.7);a*=.48;}return n;}
        void main(){
          vec3 d=normalize(vDirection);float az=atan(d.x,d.z);float alt=asin(clamp(d.y,-1.,1.));
          // Keep a dominant polar direction while giving orbit cameras a broad
          // secondary arc instead of an entirely empty rear hemisphere.
          float primary=1.-smoothstep(.85,2.55,abs(az));
          float opposite=smoothstep(1.55,2.75,abs(az));
          float oval=.42+.58*max(primary,opposite*.68);
          float horizon=smoothstep(-.012,.018,alt)*(1.-smoothstep(.78,1.34,alt));
          float drift=time*.018+phase;float warp=fbm(vec2(az*1.55+drift,phase*.31))*1.15-.52;
          float center=.092+sin(az*2.15+drift*.7+warp*2.4)*.045+sin(az*5.7-drift*.43)*.017;
          float ribbon=exp(-pow((alt-center)/(.102+noise(vec2(az*5.,drift))*.052),2.));
          float folds=.35+.65*pow(.5+.5*sin(az*83.+fbm(vec2(az*12.,drift))*13.+phase*4.),3.);
          float rays=pow(clamp(1.-abs(alt-center)/.38,0.,1.),1.7)*folds;
          float breakup=smoothstep(.2,.78,fbm(vec2(az*8.-drift*.35,alt*12.+phase)));
          float alpha=(ribbon*.72+rays*.30)*oval*horizon*(.55+.45*breakup)*intensity;
          vec3 green=vec3(.12,1.18,.52),cyan=vec3(.06,.66,1.15),violet=vec3(.62,.12,1.08);
          float colorShift=.5+.5*sin(az*5.2+phase+time*.011);
          vec3 color=mix(green,cyan,colorShift*.55);color=mix(color,violet,smoothstep(.72,1.,alt)*(.38+.25*sin(az*7.)));
          color*=alpha*(1.2+ribbon*.85);if(alpha<.004)discard;gl_FragColor=vec4(color,clamp(alpha,0.,.72));
        }`,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -8 + layer;
    mesh.rotation.y = layer * 0.17;
    mesh.scale.setScalar(1 - layer * 0.018);
    materials.push(material); layers.push(mesh); object.add(mesh);
  }
  object.visible = false;
  return {
    object,
    layerCount: layers.length,
    setEnabled(enabled) { object.visible = enabled; },
    update(time, cameraPosition) {
      if (!object.visible) return;
      object.position.copy(cameraPosition);
      materials.forEach((material, index) => { material.uniforms.time.value = time * (1 + index * 0.08); });
    },
    dispose() { geometry.dispose(); materials.forEach(material => material.dispose()); },
  };
}
