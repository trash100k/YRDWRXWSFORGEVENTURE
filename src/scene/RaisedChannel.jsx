import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * RaisedChannel — ONE straight, RAISED molten channel (the reference frame 004). A white-hot river
 * runs in a trough between two basalt walls carved with glowing Celtic knotwork; the whole causeway
 * is elevated — the walls drop into the void below. The metal cools white-hot → dark iron down its
 * length. A forward camera RIDES down the channel as you scroll (the pour adventure).
 *
 * This is the focused single-section build. The four-cord plait is set aside; get ONE channel great.
 * Renders inside the shared <Canvas> (the metal is the only light; emissive molten blooms).
 */

const LEN = 42      // channel length (runs from z=0 at the source to z=-LEN)
const HALFW = 0.7   // molten half-width
const WALLW = 0.9   // wall thickness
const H = 7         // wall height (drops into the void)
const TOPY = 0.4    // wall top height above the molten

// shared GLSL — noise, the brand temperature ramp, and Truchet interlace (≈ Celtic knotwork)
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
  float em(float t){ t=clamp(t,0.0,1.0); return pow(t,3.0)*2.8 + t*0.12; }
  float truchet(vec2 p){ vec2 c=floor(p),f=fract(p); if(hash21(c)>0.5) f.x=1.0-f.x; return min(abs(length(f)-0.5), abs(length(f-1.0)-0.5)); }
`

const vert = /* glsl */ `
  varying vec3 vW;
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
`

// the molten river — boiling, flowing away, cooling down its length, bright meniscus lip at the walls
const moltenFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  uniform float uTime, uLen, uHalfW;
  ${COMMON}
  void main(){
    float along  = clamp(-vW.z / uLen, 0.0, 1.0);      // 0 at the source → 1 far
    float across = clamp(vW.x / uHalfW, -1.0, 1.0);    // -1..1 across the river
    vec2 q = vec2(across * 2.2, along * 9.0 - uTime * 0.7);   // flow drifts down the channel
    vec2 w = vec2(fbm(q), fbm(q + 3.1));
    float boil = fbm(q + 1.4 * w);
    float vein = clamp(pow(1.0 - abs(boil - 0.5) * 2.0, 3.0), 0.0, 1.0);   // hot crack network
    float ore  = smoothstep(0.58, 0.5, fbm(q * 2.2 - uTime * 0.5));        // dark ore riding the melt
    float baseT = mix(0.95, 0.22, along);              // COOLING: white-hot source → dark iron
    float lip = smoothstep(0.72, 1.0, abs(across));    // bright meniscus where metal meets the wall
    float tt = clamp(baseT + vein * 0.22 + lip * 0.28 - ore * 0.28, 0.0, 1.0);
    gl_FragColor = vec4(tempColor(tt) * em(tt), 1.0);
  }
`

// the raised walls — basalt carved with knotwork that lights near the top + the hot source, and
// falls to black as it descends into the void and as the channel cools down its length
const wallFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  uniform float uTime, uLen;
  ${COMMON}
  void main(){
    float along = clamp(-vW.z / uLen, 0.0, 1.0);
    float down  = clamp((0.4 - vW.y) / 2.6, 0.0, 1.0);        // 0 at the top rim → 1 down the wall
    float kd = truchet(vec2(vW.z, vW.y) * 1.15);
    float ribbon = smoothstep(0.09, 0.03, kd);               // the carved knot band
    float warm = (1.0 - down) * mix(1.0, 0.14, along);       // lit near the top + near the hot source
    vec3 basalt = vec3(0.012, 0.016, 0.019);
    vec3 col = basalt * (0.25 + warm * 0.25);
    col += tempColor(0.74) * ribbon * warm * 0.9;            // GOLD interlace, rim-lit by the metal
    col += tempColor(0.5) * warm * 0.06;
    col *= (1.0 - down) * (1.0 - down) + 0.015;              // fall to black into the void
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
  const u = useMemo(() => ({ uTime: { value: 0 }, uLen: { value: LEN }, uHalfW: { value: HALFW } }), [])
  useFrame((state) => { if (!forge.reduced) u.uTime.value = state.clock.elapsedTime })

  return (
    <>
      <RideCam />
      {/* the molten river, lying flat in the trough */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -LEN / 2]}>
        <planeGeometry args={[HALFW * 2, LEN]} />
        <shaderMaterial vertexShader={vert} fragmentShader={moltenFrag} uniforms={u} toneMapped={false} />
      </mesh>
      {/* the two raised knotwork walls, descending into the void */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (HALFW + WALLW / 2), TOPY - H / 2, -LEN / 2]}>
          <boxGeometry args={[WALLW, H, LEN]} />
          <shaderMaterial vertexShader={vert} fragmentShader={wallFrag} uniforms={u} />
        </mesh>
      ))}
    </>
  )
}
