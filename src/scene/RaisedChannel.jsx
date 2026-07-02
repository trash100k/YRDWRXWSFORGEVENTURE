import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'
import Embers from './Embers.jsx'
import LetterCast from './LetterCast.jsx'
import ChannelCopy from './ChannelCopy.jsx'
import ForgeHaze from './ForgeHaze.jsx'
import BasaltPrisms from './BasaltPrisms.jsx'
import FlowLights from './FlowLights.jsx'
import { registerBasaltTick } from './basalt.js'
import { COPY } from '../brand.js'

/**
 * RaisedChannel — ONE straight, RAISED molten channel. A white-hot river runs in a trough between
 * REAL columnar-basalt walls (instanced hex prisms, BasaltPrisms) lit by ACTUAL point lights that
 * ride the flow (FlowLights) — light hitting real 3D form, not painted-on shading. The metal cools
 * white-hot → dark iron down its length; fog sinks the far channel into the void. A low forward
 * camera RIDES just above the meniscus as you scroll, then lands on the GAELWORX cast.
 *
 * Renders inside the shared <Canvas> (one renderer, one composer).
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

// the molten river — flowing metal with a cooled dark crust that cracks to reveal the hot vein
// beneath; boils, drifts down-channel, cools down its length, bright meniscus lip at the walls
const moltenFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  uniform float uTime, uLen, uHalfW;
  ${COMMON}
  void main(){
    float along  = clamp(-vW.z / uLen, 0.0, 1.0);      // 0 at source → 1 far
    float across = clamp(vW.x / uHalfW, -1.0, 1.0);
    // flow drifts down-channel; a transverse sway keeps it from streaking as a straight plume
    vec2 q = vec2(across * 2.6 + sin(along * 7.0 - uTime * 0.7) * 0.4, along * 5.5 - uTime * 0.6);
    vec2 w = vec2(fbm(q), fbm(q + 3.1));
    float boil = fbm(q + 1.5 * w);
    float vein = clamp(pow(1.0 - abs(boil - 0.5) * 2.0, 3.0), 0.0, 1.0);
    // cooled CRUST: large dark skin islands drifting on the surface (breaks the white plume),
    // fractured by a finer crack mask that lets the hot metal show through the seams
    float crustBig = smoothstep(0.60, 0.44, fbm(q * 1.6 - uTime * 0.25));       // big cooled plates
    float crackle  = smoothstep(0.46, 0.54, fbm(q * 5.0 + w * 2.0 + uTime * 0.15)); // hot cracks
    float crust = clamp(crustBig - crackle * 0.8, 0.0, 1.0);
    float ore  = smoothstep(0.55, 0.46, fbm(q * 2.4 - uTime * 0.5));   // fine dark ore flecks
    float baseT = mix(0.84, 0.18, along);              // COOLING: white-hot source → dark iron
    float lip = smoothstep(0.72, 1.0, abs(across));    // meniscus where metal meets the wall
    float tt = clamp(baseT + vein * 0.16 + lip * 0.20 - crust * 0.42 - ore * 0.20, 0.0, 1.0);
    gl_FragColor = vec4(tempColor(tt) * em(tt), 1.0);
  }
`

// embers that RIDE with the camera, drifting up off the molten so the ride always has living
// sparks in frame (the only motion during a held beat). Recycled around the current camera z.
function ChannelEmbers() {
  const g = useRef()
  useFrame(() => {
    if (!g.current) return
    const s = THREE.MathUtils.clamp(forge.scroll, 0, 1)
    g.current.position.z = THREE.MathUtils.lerp(3.5, -LEN + 9, s) - 5
  })
  return (
    <group ref={g}>
      <Embers />
    </group>
  )
}

// where the GAELWORX cast stands — just past the channel's end, so the molten pours into the word
const CASTZ = -LEN - 1 // -43

// ── the story, carved on stone tablets beside the channel (typography carries the beats) ──
// A straight center line the copy mounts to; ChannelCopy places each tablet at curve(t), pushes it
// out to the wall on `side`, billboards it to the rider, and reveals it by proximity as you pass.
// t maps 0..1 → z 0..-LEN; the ride passes t≈0.05..0.75 over scroll 0..0.8 (before the cast).
const STORY_CURVE = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(0, 0.82, 0), new THREE.Vector3(0, 0.82, -LEN * 0.5), new THREE.Vector3(0, 0.82, -LEN)],
  false, 'catmullrom', 0.5
)
const B = COPY.arsenal.branches
const STORY = [
  { t: 0.05, side: -1, kicker: 'The Enemy',          head: 'WE BILL FOR EXECUTION', body: 'Agencies bill for motion. We bill for execution — whether it ships.' },
  { t: 0.16, side: 1,  kicker: '01 · The Clan',       head: 'FOR OPERATORS',        body: 'We run this exact system on our own shops. Built for us. Now it’s yours.' },
  { t: 0.27, side: -1, kicker: 'The Proof',           head: 'IT SHIPS THEN EARNS',  body: 'No pilots that rot in phase two. It goes live, runs the work, pays for itself.' },
  { t: 0.40, side: 1,  kicker: 'GW–01 · Voice',       head: 'EVERY CALL ANSWERED',  body: B[0].line },
  { t: 0.51, side: -1, kicker: 'GW–02 · Software',    head: 'YOU OWN THE CODE',      body: B[1].line },
  { t: 0.62, side: 1,  kicker: 'GW–03 · Automations', head: 'IT RUNS ITSELF',        body: B[2].line },
  { t: 0.73, side: -1, kicker: 'GW–04 · Web',         head: 'BUILT TO BOOK',         body: B[3].line },
]

// RideCam v2 — a LOW forward camera riding just above the meniscus (scroll 0..0.8): wall tops
// break the horizon, the bright metal fills the lower frame, lateral sway drifts toward each wall
// on beats and a slight roll leans into the turns (handheld film weight). Then it ARRIVES at the
// cast and descends to a head-on eye-level read (scroll 0.8..1.0).
function RideCam() {
  const { camera } = useThree()
  // widen the lens for the ride (scale + towering verticals); restore on unmount
  useEffect(() => {
    const prev = camera.fov
    camera.fov = 57
    camera.updateProjectionMatrix()
    return () => { camera.fov = prev; camera.updateProjectionMatrix() }
  }, [camera])

  useFrame((state) => {
    const s = THREE.MathUtils.clamp(forge.scroll, 0, 1)
    const t = forge.reduced ? 0 : state.clock.elapsedTime
    const rideEnd = -LEN + 9 // -33
    let px, py, pz, lx, ly, lz, roll
    if (s < 0.8) {
      const rs = s / 0.8
      const sway = Math.sin(rs * Math.PI * 3.0) * 0.16 // drifts toward each wall on the beats
      px = sway
      py = 1.35 + Math.sin(t * 0.4) * 0.02             // LOW — just above the molten
      pz = THREE.MathUtils.lerp(3.5, rideEnd, rs)
      lx = sway * 0.35
      ly = 0.12                                        // aim AT the meniscus line, not the void
      lz = pz - 11
      roll = 0.025 * Math.sin(rs * Math.PI * 2.0) + (forge.reduced ? 0 : 0.004 * Math.sin(t * 0.23))
      forge.finaleProgress = 0
    } else {
      // THE CAST — fill GAELWORX and rise to a head-on eye-level read. Camera distance ADAPTS to
      // the viewport aspect so the wide wordmark fits on any screen (portrait pulls back).
      const fs = THREE.MathUtils.smoothstep(s, 0.8, 1.0)
      forge.finaleProgress = fs
      const aspect = camera.aspect || 1.6
      const halfW = 3.9
      const fitD = THREE.MathUtils.clamp(halfW / (Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * aspect), 5.2, 17)
      px = Math.sin(t * 0.13) * 0.1
      py = THREE.MathUtils.lerp(1.35, 1.5, fs) + Math.sin(t * 0.17) * 0.05
      pz = THREE.MathUtils.lerp(rideEnd, CASTZ + fitD, fs)
      lx = 0
      ly = THREE.MathUtils.lerp(0.12, 0.72, fs)
      lz = THREE.MathUtils.lerp(rideEnd - 11, CASTZ, fs)
      roll = forge.reduced ? 0 : 0.003 * Math.sin(t * 0.21)
    }
    camera.position.set(px, py, pz)
    camera.lookAt(lx, ly, lz)
    camera.rotateZ(roll) // lean AFTER lookAt (lookAt resets orientation)
    if (typeof window !== 'undefined') { window.__camPos = [Math.round(px * 10) / 10, Math.round(py * 10) / 10, Math.round(pz * 10) / 10]; window.__camShot = s < 0.8 ? 'ride' : 'cast' } // QA
  })
  return null
}

export default function RaisedChannel({ quality = 'high' }) {
  const uTime = useMemo(() => ({ value: 0 }), [])
  const moltenU = useMemo(() => ({ uTime, uLen: { value: LEN }, uHalfW: { value: HALFW } }), [uTime])
  useFrame((state, dt) => {
    if (!forge.reduced) uTime.value = state.clock.elapsedTime
    registerBasaltTick(dt) // drives every basalt material's shimmer/heat (one call per frame)
  })

  return (
    <>
      <RideCam />
      {/* the air: exponential fog sinks lit stone into the void down-channel (Moria depth);
          unlit emissive materials (river, haze, cast) opt out via fog:false defaults */}
      <fogExp2 attach="fog" args={[PAL.void, 0.055]} />
      {/* the light: the river's entourage of warm points + one cold rim — the ONLY lights */}
      <FlowLights quality={quality} len={LEN} />
      {!forge.reduced && <ForgeHaze layers={14} spacing={2.1} width={10} height={6.5} opacity={0.4} />}
      {!forge.reduced && <ChannelEmbers />}
      {/* the story, carved on tablets beside the channel — read as the camera rides past. Tight
          reveal so only the tablet you're passing lights (distant ones don't crowd frame-centre). */}
      <ChannelCopy curve={STORY_CURVE} items={STORY} offset={1.35} width={2.1} reveal={6.5} />
      {/* the molten river, lying flat in the trough */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -LEN / 2]}>
        <planeGeometry args={[HALFW * 2, LEN]} />
        <shaderMaterial vertexShader={vert} fragmentShader={moltenFrag} uniforms={moltenU} toneMapped={false} />
      </mesh>
      {/* REAL columnar-basalt walls: instanced hex prisms, lit by the flow lights, carved relief
          revealed by raking light (shadow, not albedo). The columns STOP short of the cast chamber
          (len-7) so the walls open up for the finale — GAELWORX stands clear at the arrival. */}
      <BasaltPrisms quality={quality} len={LEN - 7} halfW={HALFW} topY={TOPY} />

      {/* THE CAST (finale) — the channel's metal pours into GAELWORX at the end of the ride; all
          cools to forged iron except the A and E, which hold eternal white-gold divine fire. */}
      <LetterCast liveProgress={() => forge.finaleProgress} position={[0, 0.78, CASTZ]} size={0.92} />
      {/* AUTOMATIC EXECUTION crystallizes beneath, its A the same fire (trails the main fill) */}
      <LetterCast
        text="AUTOMATIC EXECUTION"
        liveProgress={() => THREE.MathUtils.clamp((forge.finaleProgress - 0.45) / 0.55, 0, 1)}
        position={[0, -0.34, CASTZ]}
        size={0.2}
      />
    </>
  )
}
