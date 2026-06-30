import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ChannelHall — THE AUTOMATIONS CHAMBER. A top-down "infrastructure" view of the
 * interlace channel NETWORK: many thin molten streams flowing in organized Celtic
 * paths, none colliding, lit from below against the void. The system working in
 * concert — the dense, mechanical character of the Automations fork.
 *
 * One InstancedMesh of curved channel strips (cheap, mobile-affordable) sharing a
 * single flow shader. Each instance carries a per-channel phase / speed / lane so the
 * streams pulse out of sync like real routed traffic. Molten cores output emissive
 * radiance > 1.0 so the shared EffectComposer bloom catches them; the metal is the
 * only light. Cool stone gutters separate the lanes (Iron Grid, 0px-gap discipline).
 *
 * Renders inside the existing <Canvas>. Looks best framed from above/ahead; it does
 * NOT move the camera (the ride owns that) — it only animates the metal. Respects
 * forge.reduced (freezes the flow). Drives off forge.temperature like every chamber.
 *
 * @param {number} [props.lanes=11]      Channel count across the hall (network density).
 * @param {number} [props.spacing=0.92]  Centre-to-centre lane spacing (Iron Grid pitch).
 * @param {number} [props.length=26]     Channel run length along flow (world units).
 * @param {number} [props.width=0.34]    Half-width of each molten strip.
 * @param {[number,number,number]} [props.position=[0,0,0]] Group origin.
 * @param {number} [props.tempBias=0.12] Added to forge.temperature for this chamber's heat.
 */

// ── A single channel strip: a long ribbon lying flat in the XZ plane, viewed from
// above. It RUNS along +X (uv.x) and its WIDTH spans Z (uv.y); extra segments along
// the run let the flow shader read smooth. Shared by every instance; per-instance
// lane offset (on Z) + serpentine phase come from instanceMatrix + attributes.
function makeStripGeometry(length, width) {
  const SEG_U = 96 // along flow (X)
  const SEG_V = 1 // across the ribbon (Z) — flat
  const geo = new THREE.PlaneGeometry(length, width * 2, SEG_U, SEG_V)
  // plane is XY by default; rotate so it lies in XZ → X = run, Z = width, viewed top-down.
  geo.rotateX(-Math.PI / 2)
  return geo
}

const stripVert = /* glsl */ `
  attribute vec3 iSeed;     // x: phase  · y: flow speed · z: serpentine amplitude
  attribute float iTemp;    // per-lane base temperature bias
  varying vec2 vUv;
  varying float vTemp;
  varying float vPhase;
  varying float vSpeed;
  uniform float uTime;
  uniform float uServe;     // global serpentine weave amount

  void main() {
    vUv = uv;
    vTemp = iTemp;
    vPhase = iSeed.x;
    vSpeed = iSeed.y;

    vec3 p = position;
    // Celtic weave: each lane snakes sideways (across Z) along its run, out of phase
    // with its neighbours, so the network reads as organized interlace — but lanes
    // never cross (amplitude < half the lane spacing, enforced by the caller).
    float run = uv.x;                 // 0..1 along the channel (X)
    float weave = sin(run * 6.2831853 * 1.5 + iSeed.x * 6.2831853);
    weave += 0.5 * sin(run * 6.2831853 * 3.0 - iSeed.x * 3.0);
    p.z += weave * iSeed.z * uServe;  // displace ACROSS the run, in the flat plane

    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`

const stripFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying float vTemp;
  varying float vPhase;
  varying float vSpeed;
  uniform float uTime;
  uniform float uTemp;     // damped master temperature
  uniform float uHeat;     // strike pulse

  // ── the master temperature ramp (brand-anchored, shared across the forge) ──
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

  void main() {
    float u = vUv.x;          // along flow
    float v = vUv.y;          // across the ribbon (0..1)

    // molten core down the centre of the ribbon; cold stone lips at the edges (the
    // gutter between lanes). Sharp-ish so the network reads as discrete streams.
    float across = abs(v - 0.5) * 2.0;
    float core = smoothstep(1.0, 0.30, across);          // 1 at centre → 0 at lip
    float lip  = smoothstep(0.62, 1.0, across);          // cold stone shoulder

    // routed traffic: hot packets march DOWN each channel, out of phase per lane,
    // at the lane's own speed. The metal is alive but never scrolls a coordinate.
    float march  = sin(u * 30.0 - uTime * (1.6 + vSpeed) + vPhase * 6.2831853) * 0.5 + 0.5;
    float pulse2 = sin(u * 12.0 - uTime * (0.9 + vSpeed * 0.6) - vPhase * 4.0) * 0.5 + 0.5;
    float flow = march * 0.62 + pulse2 * 0.38;

    // master temperature for this lane (chamber heat + its bias + the marching packets)
    float baseT = uTemp + vTemp + uHeat * 0.25;
    float t = clamp(baseT * (0.42 + flow * 0.66), 0.0, 1.0);
    t *= 0.30 + core * 0.92;                              // brightest at the molten core

    // lit-from-below feel: a soft floor bounce keeps the channel emergent from void
    vec3 col = gw_tempColor(t) * gw_em(t);

    // cold steel stone between the lanes (faint, non-blooming body)
    col += ${v3(PAL.steel)} * 0.05 * lip;

    // fade the very ends into darkness so the hall has no hard edges
    float ends = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.94, u);
    col *= mix(0.65, 1.0, ends);

    gl_FragColor = vec4(col, 1.0);
  }
`

export default function ChannelHall({
  lanes = 11,
  spacing = 0.92,
  length = 26,
  width = 0.34,
  position = [0, 0, 0],
  tempBias = 0.12,
}) {
  const meshRef = useRef()
  const tAcc = useRef(0)

  const geometry = useMemo(() => makeStripGeometry(length, width), [length, width])

  // serpentine amplitude is capped to < half a lane pitch so streams never collide.
  const serpAmp = useMemo(() => Math.min(width * 0.9, spacing * 0.32), [width, spacing])

  // per-instance: lane position (matrix) + seed (phase/speed/amp) + temp bias.
  const { matrices, seeds, temps } = useMemo(() => {
    const matrices = []
    const seeds = new Float32Array(lanes * 3)
    const temps = new Float32Array(lanes)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3(1, 1, 1)
    const p = new THREE.Vector3()
    const span = (lanes - 1) * spacing
    for (let i = 0; i < lanes; i++) {
      // channels RUN along X; lanes are stacked side-by-side across Z, centred on origin
      p.set(0, 0, i * spacing - span / 2)
      m.compose(p, q, s)
      matrices.push(m.clone())
      // deterministic-ish spread so the weave feels routed, not random noise
      const f = i / Math.max(1, lanes - 1)
      seeds[i * 3 + 0] = (i * 0.61803398875) % 1 // phase (golden-ratio decorrelation)
      seeds[i * 3 + 1] = 0.25 + ((i * 0.317) % 1) * 0.8 // flow speed
      seeds[i * 3 + 2] = serpAmp * (0.7 + ((i * 0.123) % 1) * 0.6) // serpentine amp
      // gentle heat gradient across the hall — outer lanes a touch cooler
      temps[i] = -0.04 + Math.sin(f * Math.PI) * 0.06
    }
    return { matrices, seeds, temps }
  }, [lanes, spacing, serpAmp])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.4 },
      uHeat: { value: 0 },
      uServe: { value: 1 },
    }),
    []
  )

  // wire instance attributes + matrices once the InstancedMesh exists
  const onMesh = (mesh) => {
    meshRef.current = mesh
    if (!mesh) return
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i])
    mesh.instanceMatrix.needsUpdate = true
    mesh.geometry.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 3))
    mesh.geometry.setAttribute('iTemp', new THREE.InstancedBufferAttribute(temps, 1))
    mesh.frustumCulled = false
  }

  useFrame((state, dt) => {
    const d = Math.min(1, dt || 0.016)
    // boil the flow forward; reduced-motion freezes it; still chambers slow it
    if (!forge.reduced) tAcc.current += d * (forge.still ? 0.4 : 1.0)
    uniforms.uTime.value = tAcc.current

    // strike pulse → transient heat (matches Slab's contract)
    const since = performance.now() / 1000 - forge.strikeAt
    const pulse = since >= 0 && since < 1.2 ? Math.exp(-since * 3) * 0.6 : 0
    const targetHeat = Math.min(forge.heat + pulse, 1)

    const target = THREE.MathUtils.clamp(forge.temperature + tempBias, 0, 1)
    uniforms.uTemp.value += (target - uniforms.uTemp.value) * d * 2.2
    uniforms.uHeat.value += (targetHeat - uniforms.uHeat.value) * d * 3.0
  })

  return (
    <group position={position}>
      <instancedMesh ref={onMesh} args={[geometry, undefined, lanes]}>
        <shaderMaterial
          vertexShader={stripVert}
          fragmentShader={stripFrag}
          uniforms={uniforms}
          toneMapped={false}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  )
}
