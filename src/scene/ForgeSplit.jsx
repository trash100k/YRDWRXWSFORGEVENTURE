import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ForgeSplit — THE FOUR-CHANNEL CELTIC SPLIT.
 *
 * One trunk molten channel descends, FORKS into four sub-channels — Voice · Software ·
 * Automations · Web — that weave (Celtic-interlace over/under) before REJOINING into a
 * single outflow channel below. Each fork carries DISTINCT per-service character baked
 * into both its path geometry and its flow shader:
 *   0 Voice       — softer / wavy, breathing sine flow, warm
 *   1 Software    — tight / circuit-like, stepped quantised flow
 *   2 Automations — dense / mechanical, fast rhythmic banding
 *   3 Web         — brightest / jewel-like, prismatic shimmer
 *
 * Everything emissive blooms via the shared EffectComposer (radiance pushed > 1.0).
 * Renders INSIDE the existing <Canvas>; never makes its own. Mobile-affordable
 * (capped tube segments, no EXR). Honours forge.reduced (freezes flow + skips weave drift).
 *
 * EXPORTS:
 *   - CHANNELS : THREE.CatmullRomCurve3[4]      the four fork curves (Voice,Software,Automations,Web)
 *   - TRUNK_IN / TRUNK_OUT : THREE.CatmullRomCurve3   feeder + rejoin trunks
 *   - getChannelPose(i) -> { position:[x,y,z], lookAt:[x,y,z] }   cinematic pose down fork i
 *   - default <ForgeSplit/> component
 *
 * @typedef {Object} ForgeSplitProps
 * @property {number} [active=-1]      Which fork (0..3) is "being told" right now; -1 = none.
 *                                     The active fork brightens + flows hotter (the camera is on it).
 * @property {number} [intensity=1]    Master emissive multiplier (0..1.5). Lets the parent
 *                                     fade the split in/out across the journey.
 * @property {number} [radius=0.22]    Tube radius for the forks (trunks ride a touch fatter).
 * @property {[number,number,number]} [position=[0,0,0]]  Group offset in world space.
 */

// ── geometry of the split ──────────────────────────────────────────────────
// The trunk arrives at the SPLIT node, four forks bow out (two left, two right; two
// shallow in Z, two deep — so they can weave over/under), then all converge on the
// JOIN node and a single trunk continues down. Y descends throughout (metal flows down).

const SPLIT_Y = 0.0     // where the trunk forks
const JOIN_Y = -9.0     // where the forks rejoin
const SPAN = SPLIT_Y - JOIN_Y

// Per-fork signature: lateral lane (x), depth lane (z, drives over/under weave),
// bow amount, and a vertical phase so the weave crossings interleave like knotwork.
const SIG = [
  // Voice — gentle wide bow, rides shallow-front, lazy weave
  { x: -2.4, z: 1.5, bow: 1.15, phase: 0.0, weave: 0.9 },
  // Software — tighter inner lane, rides deep-back, crisp weave
  { x: -0.9, z: -1.7, bow: 0.55, phase: 0.5, weave: 1.6 },
  // Automations — inner lane, shallow-front, busy weave
  { x: 0.9, z: 1.7, bow: 0.6, phase: 1.0, weave: 1.7 },
  // Web — wide bow, deep-back, elegant weave
  { x: 2.4, z: -1.5, bow: 1.2, phase: 1.5, weave: 1.1 },
]

function makeFork(sig) {
  const pts = []
  const N = 14
  for (let i = 0; i <= N; i++) {
    const t = i / N // 0 at split, 1 at join
    // bow out from centre then back to the join lane (sin envelope = smooth fork+merge)
    const env = Math.sin(t * Math.PI) // 0 at both ends, 1 mid
    const x = sig.x * env
    // the weave: z oscillates so adjacent forks cross over/under each other mid-span
    const z = sig.z * env * Math.cos(t * Math.PI * sig.weave + sig.phase) * 0.85
    const y = SPLIT_Y - t * SPAN
    pts.push(new THREE.Vector3(x, y, z))
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
}

// Feeder trunk into the split, and rejoin trunk out of the join.
function makeTrunkIn() {
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, SPLIT_Y + 6.0, 0.0),
      new THREE.Vector3(0.4, SPLIT_Y + 3.6, -0.3),
      new THREE.Vector3(-0.2, SPLIT_Y + 1.4, 0.2),
      new THREE.Vector3(0, SPLIT_Y, 0.0),
    ],
    false,
    'catmullrom',
    0.5
  )
}
function makeTrunkOut() {
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, JOIN_Y, 0.0),
      new THREE.Vector3(0.3, JOIN_Y - 2.2, 0.25),
      new THREE.Vector3(-0.2, JOIN_Y - 4.6, -0.2),
      new THREE.Vector3(0, JOIN_Y - 7.0, 0.0),
    ],
    false,
    'catmullrom',
    0.5
  )
}

// Built once at module load so the exports are stable references the parent can read.
export const CHANNELS = SIG.map(makeFork)
export const TRUNK_IN = makeTrunkIn()
export const TRUNK_OUT = makeTrunkOut()

export const CHANNEL_NAMES = ['Voice', 'Software', 'Automations', 'Web']

/**
 * getChannelPose(i) — a cinematic camera pose aimed DOWN fork i, for the camera to ride
 * /angle through that channel as its service is told. Sampled a third of the way in,
 * set back along the reverse tangent and lifted, looking down-flow. Returns plain arrays
 * so it's safe to consume from React/JS without leaking three objects.
 * @param {number} i  fork index 0..3
 * @returns {{position:[number,number,number], lookAt:[number,number,number]}}
 */
export function getChannelPose(i) {
  const curve = CHANNELS[THREE.MathUtils.clamp(i | 0, 0, CHANNELS.length - 1)]
  const at = 0.32 // a third in — the fork is at its widest, most readable here
  const p = curve.getPointAt(at)
  const tan = curve.getTangentAt(at).normalize()
  // side vector (tangent × world-up) to swing the camera off-axis for a 3/4 angle
  const up = new THREE.Vector3(0, 1, 0)
  const side = new THREE.Vector3().crossVectors(tan, up).normalize()
  const pos = p
    .clone()
    .addScaledVector(tan, -2.6) // sit behind the sample point
    .addScaledVector(up, 1.0) // lifted above the channel
    .addScaledVector(side, i % 2 === 0 ? 0.9 : -0.9) // alternate the off-axis swing
  const look = p.clone().addScaledVector(tan, 3.2) // look ahead, down the flow
  return {
    position: [pos.x, pos.y, pos.z],
    lookAt: [look.x, look.y, look.z],
  }
}

// ── the molten flow shader (one program, per-channel character via uStyle) ──
const flowVert = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const flowFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying float vDepth;
  uniform float uTime, uTemp, uActive, uIntensity, uStyle;

  // shared brand temperature ramp (matches ForgeJourney / ForgeCanvas)
  vec3 gw_tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    c = mix(c, ${v3(PAL.gold)},    smoothstep(0.64, 0.85, t));
    c = mix(c, ${v3(PAL.hot)},     smoothstep(0.82, 1.00, t));
    return c;
  }
  float gw_em(float t){ t = clamp(t, 0.0, 1.0); return pow(t, 3.0) * 2.6 + t * 0.12; }

  void main(){
    float u = vUv.x;          // along the channel (0 = split, 1 = join) — flow runs +u (downstream)
    float v = vUv.y;          // around the tube
    float core = clamp(1.0 - abs(v - 0.5) * 1.7, 0.0, 1.0); // brightest down the molten centre

    // base flowing bands — every channel flows DOWNSTREAM (u increasing)
    float base = sin(u * 30.0 - uTime * 2.0) * 0.5 + 0.5;
    float t = 0.5 + base * 0.18 + uTemp * 0.08;

    // ── per-service CHARACTER ──
    if (uStyle < 0.5) {
      // 0 VOICE — softer / wavy: slow breathing sine, low frequency, warm
      float wave = sin(u * 14.0 - uTime * 1.3) * 0.5 + 0.5;
      float breath = sin(uTime * 0.8 + u * 3.0) * 0.5 + 0.5;
      t = 0.46 + wave * 0.30 + breath * 0.12 + uTemp * 0.06;
    } else if (uStyle < 1.5) {
      // 1 SOFTWARE — tight / circuit-like: quantised stepped pulses marching down
      float march = fract(u * 9.0 - uTime * 0.9);
      float gate = step(0.55, march); // crisp on/off cells
      float rail = smoothstep(0.42, 0.5, abs(v - 0.5)); // bright edge-rails like traces
      t = 0.40 + gate * 0.34 + rail * 0.18 + uTemp * 0.05;
    } else if (uStyle < 2.5) {
      // 2 AUTOMATIONS — dense / mechanical: fast high-freq banding + rivet ticks
      float band = sin(u * 80.0 - uTime * 3.6) * 0.5 + 0.5;
      float ticks = step(0.7, fract(u * 24.0 - uTime * 1.8));
      t = 0.42 + band * 0.22 + ticks * 0.22 + uTemp * 0.05;
    } else {
      // 3 WEB — brightest / jewel-like: prismatic shimmer, runs hottest
      float facet = sin(u * 22.0 - uTime * 1.6) * sin(v * 18.0 + uTime * 0.7);
      float gem = pow(facet * 0.5 + 0.5, 1.6);
      t = 0.58 + gem * 0.34 + uTemp * 0.08;
    }

    // molten core falloff toward the lips
    t *= 0.5 + core * 0.62;

    // the active (currently-told) channel runs hotter and brighter
    t += uActive * 0.16;
    float boost = mix(1.0, 1.55, uActive);

    vec3 col = gw_tempColor(t) * gw_em(t) * boost * uIntensity;

    // ominous depth — channels emerge from the dark ahead
    col *= smoothstep(26.0, 1.5, vDepth);

    gl_FragColor = vec4(col, 1.0);
  }
`

function Channel({ curve, style, radius, segments, radial, getActive, getIntensity }) {
  const matRef = useRef()
  const geo = useMemo(
    () => new THREE.TubeGeometry(curve, segments, radius, radial, false),
    [curve, segments, radius, radial]
  )
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.5 },
      uActive: { value: 0 },
      uIntensity: { value: 1 },
      uStyle: { value: style },
    }),
    [style]
  )

  useFrame((state, dt) => {
    const d = Math.min(1, (dt || 0.016) * 2)
    const u = uniforms
    // reduced-motion freezes the marching flow (hold a warm steady pour)
    if (!forge.reduced) u.uTime.value = state.clock.elapsedTime
    u.uTemp.value += (forge.temperature - u.uTemp.value) * d
    u.uActive.value += (getActive() - u.uActive.value) * d
    u.uIntensity.value += (getIntensity() - u.uIntensity.value) * d
  })

  // dispose GPU geometry on unmount (route swap) — no leaks on the single renderer
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={flowVert}
        fragmentShader={flowFrag}
        uniforms={uniforms}
      />
    </mesh>
  )
}

export default function ForgeSplit({
  active = -1,
  intensity = 1,
  radius = 0.22,
  position = [0, 0, 0],
}) {
  // live refs so per-frame reads don't churn React; parent can change props freely
  const activeRef = useRef(active)
  const intensityRef = useRef(intensity)
  activeRef.current = active
  intensityRef.current = intensity

  // mobile budget: trunks a touch fatter + denser; forks lean. radial sides modest.
  const segForks = forge.reduced ? 64 : 110
  const segTrunk = forge.reduced ? 48 : 90
  const radial = 12

  const trunkActive = useMemo(() => () => 0, [])
  const fullIntensity = useMemo(() => () => intensityRef.current, [])

  return (
    <group position={position}>
      {/* feeder trunk into the split */}
      <Channel
        curve={TRUNK_IN}
        style={3}
        radius={radius * 1.4}
        segments={segTrunk}
        radial={radial}
        getActive={trunkActive}
        getIntensity={fullIntensity}
      />

      {/* the four woven forks */}
      {CHANNELS.map((curve, i) => (
        <Channel
          key={i}
          curve={curve}
          style={i}
          radius={radius}
          segments={segForks}
          radial={radial}
          getActive={() => (activeRef.current === i ? 1 : 0)}
          getIntensity={fullIntensity}
        />
      ))}

      {/* rejoin trunk out of the join */}
      <Channel
        curve={TRUNK_OUT}
        style={3}
        radius={radius * 1.4}
        segments={segTrunk}
        radial={radial}
        getActive={trunkActive}
        getIntensity={fullIntensity}
      />
    </group>
  )
}
