import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * RaisedChannel — ONE straight, RAISED molten channel (the reference frame 004). A white-hot river
 * runs in a trough between two basalt walls carved with REAL Celtic knotwork relief (a photo texture,
 * gold recesses glowing); the whole causeway is elevated — the walls drop into the void below. The
 * metal cools white-hot → dark iron down its length. A forward camera RIDES down it as you scroll.
 *
 * The four-cord plait is set aside; get ONE channel great. Renders inside the shared <Canvas>.
 */

const LEN = 42      // channel length (z=0 at the source → z=-LEN)
const HALFW = 0.7   // molten half-width
const WALLW = 0.9   // wall thickness
const H = 7         // wall height (drops into the void)
const TOPY = 0.42   // wall top height above the molten

// shared GLSL — noise + the brand temperature ramp
const COMMON = /* glsl */ `
  float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; } return v; }
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

const vert = /* glsl */ `
  varying vec3 vW;
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
`

// the molten river — boiling, flowing away, cooling down its length, meniscus lip at the walls
const moltenFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  uniform float uTime, uLen, uHalfW;
  ${COMMON}
  void main(){
    float along  = clamp(-vW.z / uLen, 0.0, 1.0);      // 0 at source → 1 far
    float across = clamp(vW.x / uHalfW, -1.0, 1.0);
    vec2 q = vec2(across * 2.6, along * 5.5 - uTime * 0.6);   // flow drifts down the channel
    vec2 w = vec2(fbm(q), fbm(q + 3.1));
    float boil = fbm(q + 1.5 * w);
    float vein = clamp(pow(1.0 - abs(boil - 0.5) * 2.0, 3.0), 0.0, 1.0);
    float ore  = smoothstep(0.55, 0.46, fbm(q * 2.4 - uTime * 0.5));   // dark ore breaks up the white
    float baseT = mix(0.86, 0.20, along);              // COOLING: white-hot source → dark iron
    float lip = smoothstep(0.74, 1.0, abs(across));    // meniscus where metal meets the wall
    float tt = clamp(baseT + vein * 0.18 + lip * 0.16 - ore * 0.34, 0.0, 1.0);
    gl_FragColor = vec4(tempColor(tt) * em(tt), 1.0);
  }
`

// the raised walls — REAL knotwork relief sampled by world position; gold recesses glow, rim-lit
// near the top + the hot source, falling to black as it descends into the void and cools down-length
const wallFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  uniform float uTime, uLen;
  uniform sampler2D uTex;
  ${COMMON}
  void main(){
    float along = clamp(-vW.z / uLen, 0.0, 1.0);
    float down  = clamp((0.42 - vW.y) / 3.4, 0.0, 1.0);        // 0 at top rim → 1 down into void
    vec2 uv = vec2(vW.z / 6.5, (0.42 - vW.y) / 3.4);           // map the relief by WORLD pos (~6.5u panels)
    vec3 t = texture2D(uTex, uv).rgb;
    float lum = dot(t, vec3(0.299, 0.587, 0.114));
    float gold = clamp((t.r - t.b) * 2.0, 0.0, 1.0) * smoothstep(0.12, 0.45, t.r);  // molten in the recesses
    float warm = (1.0 - down) * mix(1.0, 0.14, along);        // lit near the top + the hot source
    vec3 stone = vec3(0.02, 0.024, 0.028) * (0.25 + lum) * (0.25 + warm);
    vec3 col = stone;
    col += tempColor(0.82) * gold * warm * 1.7;               // GLOWING gold interlace in the carving
    col += tempColor(0.5) * warm * 0.05;
    col *= (1.0 - down) * (1.0 - down) + 0.02;                // fall to black into the void
    gl_FragColor = vec4(col, 1.0);
  }
`

// a forward camera that RIDES down the channel as forge.scroll goes 0..1 (the pour adventure)
function RideCam() {
  const { camera } = useThree()
  useFrame(() => {
    const s = THREE.MathUtils.clamp(forge.scroll, 0, 1)
    const zc = THREE.MathUtils.lerp(3.5, -LEN + 9, s)
    camera.position.set(0, 2.1, zc)
    camera.lookAt(0, -0.4, zc - 13)
    if (typeof window !== 'undefined') { window.__camPos = [0, 2.1, Math.round(zc * 10) / 10]; window.__camShot = 'ride' } // QA
  })
  return null
}

export default function RaisedChannel() {
  const uTime = useMemo(() => ({ value: 0 }), [])
  const moltenU = useMemo(() => ({ uTime, uLen: { value: LEN }, uHalfW: { value: HALFW } }), [uTime])
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load('/textures/knotwork-relief.jpg')
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  const wallU = useMemo(() => ({ uTime, uLen: { value: LEN }, uTex: { value: tex } }), [uTime, tex])
  useFrame((state) => { if (!forge.reduced) uTime.value = state.clock.elapsedTime })

  return (
    <>
      <RideCam />
      {/* the molten river, lying flat in the trough */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -LEN / 2]}>
        <planeGeometry args={[HALFW * 2, LEN]} />
        <shaderMaterial vertexShader={vert} fragmentShader={moltenFrag} uniforms={moltenU} toneMapped={false} />
      </mesh>
      {/* the two raised knotwork walls, descending into the void */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (HALFW + WALLW / 2), TOPY - H / 2, -LEN / 2]}>
          <boxGeometry args={[WALLW, H, LEN]} />
          <shaderMaterial vertexShader={vert} fragmentShader={wallFrag} uniforms={wallU} />
        </mesh>
      ))}
    </>
  )
}
