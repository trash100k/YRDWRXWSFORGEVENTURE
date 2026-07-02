import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * MoltenRiver — the river as REAL rolling metal: a subdivided plane vertex-displaced by flowing
 * fbm waves (calming as the metal cools down-channel), with normals rebuilt per-vertex so the
 * surface catches fresnel rim light off its own swells. Crust sits in the troughs; veins crack
 * the crests. Plus the MENISCUS LIP: a thin >1-emissive strip along each wall seam — the
 * brightest line in every frame (the thesis line: molten curve meeting cold carved stone).
 *
 * Stays UNLIT emissive (the river IS the light; FlowLights impersonate its cast light on the
 * stone — the film trick). Two draw calls total (river + merged lip strips).
 *
 * @param {object} props
 * @param {'high'|'mobile'} [props.quality='high']  16×220 segments on high, 12×160 mobile
 * @param {number} [props.len=42]    channel length (z 0 → -len)
 * @param {number} [props.halfW=0.7] molten half-width
 */

const COMMON = /* glsl */ `
  float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; } return v; }
  float fbm3(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<3;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; } return v; }
  vec3 tempColor(float t){
    t=clamp(t,0.0,1.0);
    vec3 c=mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.0,0.22,t));
    c=mix(c, ${v3(PAL.crimson)}, smoothstep(0.18,0.45,t));
    c=mix(c, ${v3(PAL.ember)}, smoothstep(0.42,0.66,t));
    c=mix(c, ${v3(PAL.gold)}, smoothstep(0.64,0.85,t));
    c=mix(c, ${v3(PAL.hot)}, smoothstep(0.82,1.0,t));
    return c;
  }
  float em(float t){ t=clamp(t,0.0,1.0); return pow(t,3.0)*2.6 + t*0.12; }
`

// vertex: displace along world-up by flowing fbm waves; rebuild the normal by finite difference
const riverVert = /* glsl */ `
  varying vec3 vW;
  varying vec3 vN;
  varying float vH;
  uniform float uTime, uLen, uHalfW;
  ${COMMON}
  void main(){
    vec4 wp0 = modelMatrix * vec4(position, 1.0);
    float along  = clamp(-wp0.z / uLen, 0.0, 1.0);
    float across = clamp(wp0.x / uHalfW, -1.0, 1.0);
    // seam stays pinned at the lip; swells calm as the metal cools down-channel
    float edgeEnv = 1.0 - smoothstep(0.75, 1.0, abs(across));
    float A = 0.07 * edgeEnv * mix(1.0, 0.35, along);
    vec2 q  = vec2(wp0.x * 2.2, wp0.z * 0.55 + uTime * 0.6);
    float e = 0.12;
    float h  = fbm3(q);
    float hX = fbm3(q + vec2(e * 2.2, 0.0));
    float hZ = fbm3(q + vec2(0.0, e * 0.55));
    vec3 pos = position;
    pos.z += h * A; // local +z = world up (plane lies rotated -90° about x)
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vW = wp.xyz;
    vH = h;
    vN = normalize(vec3(-(hX - h) * A / e, 1.0, -(hZ - h) * A / e));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

// fragment: the cooling/crust/vein skin + fresnel rim off the displaced swells
const riverFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  varying vec3 vN;
  varying float vH;
  uniform float uTime, uLen, uHalfW;
  // NOTE: cameraPosition is injected by three's ShaderMaterial fragment prefix — do not redeclare
  ${COMMON}
  void main(){
    float along  = clamp(-vW.z / uLen, 0.0, 1.0);      // 0 at source → 1 far
    float across = clamp(vW.x / uHalfW, -1.0, 1.0);
    // flow drifts down-channel; a transverse sway keeps it from streaking as a straight plume
    vec2 q = vec2(across * 2.6 + sin(along * 7.0 - uTime * 0.7) * 0.4, along * 5.5 - uTime * 0.6);
    vec2 w = vec2(fbm(q), fbm(q + 3.1));
    float boil = fbm(q + 1.5 * w);
    float vein = clamp(pow(1.0 - abs(boil - 0.5) * 2.0, 3.0), 0.0, 1.0);
    // cooled CRUST plates drifting on the skin, cracked by hot seams; crust POOLS IN THE TROUGHS
    float crustBig = smoothstep(0.60, 0.44, fbm(q * 1.6 - uTime * 0.25));
    float crackle  = smoothstep(0.46, 0.54, fbm(q * 5.0 + w * 2.0 + uTime * 0.15));
    float crust = clamp(crustBig - crackle * 0.8, 0.0, 1.0);
    float ore  = smoothstep(0.55, 0.46, fbm(q * 2.4 - uTime * 0.5));
    float baseT = mix(0.84, 0.18, along);              // COOLING: white-hot source → dark iron
    float lip = smoothstep(0.72, 1.0, abs(across));    // hotter at the wall seam
    float tt = baseT + vein * 0.16 + lip * 0.20 - crust * 0.42 - ore * 0.20;
    tt -= (0.5 - vH) * 0.12;                           // crust sits in troughs, crests run hotter
    tt = clamp(tt, 0.0, 1.0);
    vec3 col = tempColor(tt) * em(tt);
    // fresnel rim off the rolling swells — the waves catch their own light at grazing angles
    float fr = pow(1.0 - clamp(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0, 1.0), 3.0);
    col += tempColor(0.92) * em(0.92) * fr * 0.3 * (1.0 - along);
    gl_FragColor = vec4(col, 1.0);
  }
`

// the meniscus lip — a thin raised emissive strip along each wall seam, deliberately >1 so the
// bloom catches it: the brightest LINE in frame, where liquid curve meets cold carved stone
const lipVert = /* glsl */ `
  varying vec3 vW;
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
`
const lipFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  uniform float uTime, uLen;
  ${COMMON}
  void main(){
    float along = clamp(-vW.z / uLen, 0.0, 1.0);
    float tt = clamp(0.95 - along * 0.5 + (fbm3(vec2(vW.z * 4.0 - uTime, 0.5)) - 0.5) * 0.12, 0.0, 1.0);
    gl_FragColor = vec4(tempColor(tt) * em(tt) * 1.6, 1.0);
  }
`

export default function MoltenRiver({ quality = 'high', len = 42, halfW = 0.7 }) {
  const uTime = useMemo(() => ({ value: 0 }), [])
  const uniforms = useMemo(
    () => ({ uTime, uLen: { value: len }, uHalfW: { value: halfW } }),
    [uTime, len, halfW]
  )
  const lipUniforms = useMemo(() => ({ uTime, uLen: { value: len } }), [uTime, len])
  useFrame((state) => { if (!forge.reduced) uTime.value = state.clock.elapsedTime })

  const segs = quality === 'high' ? [16, 220] : [12, 160]

  // both lip strips merged into ONE geometry (one draw call)
  const lipGeo = useMemo(() => {
    const mk = (x) => {
      const g = new THREE.BoxGeometry(0.06, 0.05, len)
      g.translate(x, 0.06, -len / 2)
      return g
    }
    return mergeGeometries([mk(-(halfW + 0.01)), mk(halfW + 0.01)])
  }, [len, halfW])

  return (
    <>
      {/* the rolling molten surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -len / 2]}>
        <planeGeometry args={[halfW * 2, len, segs[0], segs[1]]} />
        <shaderMaterial vertexShader={riverVert} fragmentShader={riverFrag} uniforms={uniforms} toneMapped={false} />
      </mesh>
      {/* the meniscus lip — the thesis line */}
      <mesh geometry={lipGeo}>
        <shaderMaterial vertexShader={lipVert} fragmentShader={lipFrag} uniforms={lipUniforms} toneMapped={false} />
      </mesh>
    </>
  )
}
