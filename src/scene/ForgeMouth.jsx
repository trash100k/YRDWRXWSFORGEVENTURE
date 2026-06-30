import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ForgeMouth — THE CONTACT CHAMBER. The forge MOUTH: the threshold you stand before.
 *
 * A stone ARCH cut from dark green-black Irish basalt (an extruded round-topped arch
 * frame), carved OGHAM marching up both jambs, and BEYOND the opening the blazing
 * white-hot forge INTERIOR radiating toward the viewer — a bright emissive plane (with
 * a hotter molten floor + heat haze) seen through the arch, output >1.0 so the shared
 * EffectComposer bloom blooms it heavily. The hottest chamber: the invitation.
 *
 * Renders INSIDE the shared <Canvas>. The metal is the only light; no scene lights.
 * All heat is driven by the shared `forge` temperature signal (dt-damped). Honors
 * forge.reduced (freezes the boil / haze). Mobile-affordable: a handful of meshes,
 * no particles, no EXR.
 *
 * @typedef {Object} ForgeMouthProps
 * @property {[number,number,number]} [position=[0,0,0]] Group position (world units).
 * @property {number} [scale=1]        Uniform scale of the whole mouth.
 * @property {number} [width=3.0]      Arch opening width (inner clear span, world units).
 * @property {number} [height=4.4]     Arch opening height to the crown (inner, world units).
 * @property {number} [jamb=0.62]      Basalt frame thickness around the opening.
 * @property {number} [depth=0.9]      Extrusion depth of the basalt arch (toward viewer).
 * @property {number} [heat=1.0]       Extra heat bias for this chamber (added to forge.temperature, clamped). The mouth is the hottest, so default full.
 * @property {boolean} [ogham=true]    Carve glowing Ogham strokes up the jambs.
 */

// ── shared temperature ramp + emissive (matches ForgeCanvas / ForgeJourney) ──
const RAMP = /* glsl */ `
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
`

// compact hash/value noise — enough grain for basalt + a boiling interior, no textures
const NOISE = /* glsl */ `
  float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.02 + 7.1; a *= 0.5; }
    return v;
  }
`

// ── the blazing forge INTERIOR seen through the mouth (bright, blooms) ──
const interiorVert = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const interiorFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uTemp, uHeat;
  ${RAMP}
  ${NOISE}
  void main(){
    vec2 uv = vUv;
    // boiling furnace field — domain-warped fbm, brightest at the molten hearth (low centre)
    float t = uTime * 0.08;
    vec2 p = uv * vec2(3.4, 4.6);
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(4.3, 1.7) - t));
    float f = fbm(p + 1.8 * q);

    // the hearth glows from a low pool and rises; sides fall to cooler crimson
    float floorPool = smoothstep(0.0, 0.55, uv.y);            // 0 at bottom (hottest), 1 up top
    float sideFall  = smoothstep(0.62, 0.0, abs(uv.x - 0.5)); // bright core, cooler walls
    float core = (1.0 - floorPool) * 0.55 + sideFall * 0.45;

    float heat = clamp(0.66 + uTemp * 0.34 + uHeat * 0.22, 0.0, 1.0);
    float temp = clamp(heat * (0.46 + core * 0.7) + (f - 0.5) * 0.18, 0.0, 1.0);

    vec3 col = gw_tempColor(temp) * gw_em(temp);
    // a white-hot throat right at the molten mouth of the hearth — pushes hard past 1.0
    float throat = smoothstep(0.34, 0.0, distance(uv, vec2(0.5, 0.12)));
    col += ${v3(PAL.hot)} * throat * (1.6 + uHeat * 1.2);
    col += ${v3(PAL.gold)} * pow(1.0 - floorPool, 2.0) * 0.6;

    gl_FragColor = vec4(col, 1.0);
  }
`

// ── basalt arch frame: dark green-black Irish stone, faintly heat-licked at the inner edge ──
const basaltVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vPos;
  void main(){
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const basaltFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vPos;
  uniform float uTime, uTemp, uHeat, uInnerR;
  ${RAMP}
  ${NOISE}
  void main(){
    // dark green-black basalt body with coarse grain + fracture mottling
    float grain = fbm(vPos.xy * 5.5 + vPos.z * 2.0);
    float frac  = smoothstep(0.42, 0.5, fbm(vPos.xy * 1.6 + 13.0)); // faint fracture veins
    vec3 greenBlack = mix(${v3(PAL.void)}, ${v3(PAL.steel)}, 0.5);
    greenBlack += vec3(0.004, 0.018, 0.012);                         // Irish green cast
    vec3 stone = greenBlack * (0.55 + grain * 0.7) - frac * 0.03;

    // the interior fire LICKS the inner edge of the arch — rim heat, strongest facing in
    // faces pointing toward +Z (toward viewer / the bevel) and inner faces catch the glow
    float rim = pow(clamp(1.0 - abs(vN.z), 0.0, 1.0), 1.5);          // grazing inner walls
    float prox = smoothstep(uInnerR + 1.3, uInnerR, length(vPos.xy)); // near the opening
    float lick = rim * prox;
    float t = clamp(0.30 + uTemp * 0.4 + uHeat * 0.3, 0.0, 1.0);
    vec3 heatGlow = gw_tempColor(t) * gw_em(t) * lick * 0.9;

    // a slow ember flicker along the inner lip so the stone reads as forge-lit, never lit by a lamp
    float flick = 0.85 + 0.15 * sin(uTime * 2.0 + vPos.y * 3.0);
    vec3 col = stone + heatGlow * flick;

    gl_FragColor = vec4(col, 1.0);
  }
`

// ── glowing carved OGHAM up the jambs (instanced quads, additive) ──
const oghamFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying float vSeed;
  uniform float uTime, uTemp, uHeat;
  ${RAMP}
  void main(){
    // each instance is one Ogham character cell: a vertical stem with 1..5 cross strokes,
    // some to the left, some right, some through — driven by the per-instance seed.
    float stem = smoothstep(0.06, 0.03, abs(vUv.x - 0.5));
    int n = 1 + int(mod(vSeed * 91.7, 5.0));      // 1..5 strokes
    float side = mod(vSeed * 53.3, 3.0);          // 0 left, 1 right, 2 through
    float strokes = 0.0;
    for (int i = 0; i < 5; i++){
      if (i >= n) break;
      float y = 0.30 + float(i) * (0.40 / float(n));
      float band = smoothstep(0.045, 0.02, abs(vUv.y - y));
      // left strokes fill [0.12,0.5], right [0.5,0.88], through [0.12,0.88]
      float lo = side < 0.5 ? 0.12 : (side < 1.5 ? 0.5 : 0.12);
      float hi = side < 0.5 ? 0.5  : (side < 1.5 ? 0.88 : 0.88);
      float seg = step(lo, vUv.x) * step(vUv.x, hi);
      strokes = max(strokes, band * seg);
    }
    float mark = max(stem, strokes);
    if (mark < 0.02) discard;

    float t = clamp(0.6 + uTemp * 0.35 + uHeat * 0.25, 0.0, 1.0);
    vec3 col = gw_tempColor(t) * gw_em(t) * mark * 1.25;
    col += ${v3(PAL.divine)} * mark * 0.18;   // the carving holds a sliver of the eternal fire
    gl_FragColor = vec4(col, mark);
  }
`
const oghamVert = /* glsl */ `
  attribute float aSeed;
  varying vec2 vUv;
  varying float vSeed;
  void main(){
    vUv = uv;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

function dampToTemp(u, dt, bias) {
  const d = Math.min(1, dt || 0.016)
  // the mouth is the hottest chamber: bias the master temperature up, clamp to 1
  const target = Math.min((forge.temperature || 0) + bias, 1)
  u.uTemp.value += (target - u.uTemp.value) * d * 2.2
  // strike pulse → transient heat surge in the throat
  const since = performance.now() / 1000 - forge.strikeAt
  const pulse = since >= 0 && since < 1.2 ? Math.exp(-since * 3) * 0.6 : 0
  const targetHeat = Math.min((forge.heat || 0) + pulse, 1)
  u.uHeat.value += (targetHeat - u.uHeat.value) * d * 3.0
  if (!forge.reduced) u.uTime.value += d * (forge.still ? 0.4 : 1.0)
}

/**
 * Build the basalt arch profile as a 2D Shape with a round-topped arch HOLE, then extrude
 * it toward the viewer. The hole is the opening; the ring of stone is the jamb + crown.
 */
function makeArchGeometry(width, height, jamb, depth) {
  const halfW = width / 2
  const r = halfW                      // semicircular crown radius = half the span
  const straight = Math.max(0.001, height - r) // jamb height before the arch springs
  const outerW = halfW + jamb
  const outerR = r + jamb
  const outerStraight = straight + jamb * 0.4  // base sits a touch lower than the spring

  // outer silhouette (round-topped, like the inner — a thick stone arch)
  const shape = new THREE.Shape()
  shape.moveTo(-outerW, -outerStraight - jamb)
  shape.lineTo(-outerW, outerStraight)
  shape.absarc(0, outerStraight, outerR, Math.PI, 0, true)
  shape.lineTo(outerW, -outerStraight - jamb)
  shape.lineTo(-outerW, -outerStraight - jamb)

  // inner hole = the clear opening (round-topped arch)
  const hole = new THREE.Path()
  hole.moveTo(-halfW, -outerStraight - jamb + 0.0001) // open the bottom (no sill)
  hole.lineTo(-halfW, straight)
  hole.absarc(0, straight, r, Math.PI, 0, true)
  hole.lineTo(halfW, -outerStraight - jamb + 0.0001)
  hole.lineTo(-halfW, -outerStraight - jamb + 0.0001)
  shape.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: jamb * 0.18,
    bevelSize: jamb * 0.16,
    bevelSegments: 2,
    curveSegments: 24,
    steps: 1,
  })
  geo.center()
  geo.computeVertexNormals()
  return geo
}

function OghamJambs({ width, height, jamb, depth, count = 5 }) {
  const meshRef = useRef()
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uTemp: { value: 0.6 }, uHeat: { value: 0 } }),
    []
  )

  // place `count` marks up the LEFT jamb and `count` up the RIGHT jamb, on the bevel face
  const { instances, seeds } = useMemo(() => {
    const halfW = width / 2
    const cell = 0.46
    const xL = -(halfW + jamb * 0.5)
    const xR = halfW + jamb * 0.5
    const z = depth * 0.5 + 0.02
    const baseY = -height * 0.42
    const span = height * 0.62
    const list = []
    const sd = []
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? xL : xR
      for (let i = 0; i < count; i++) {
        const y = baseY + (i / Math.max(1, count - 1)) * span
        const m = new THREE.Matrix4()
        m.compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion(),
          new THREE.Vector3(cell * 0.6, cell, 1)
        )
        list.push(m)
        sd.push(Math.random() * 6.283 + side * 1.7 + i)
      }
    }
    return { instances: list, seeds: new Float32Array(sd) }
  }, [width, height, jamb, depth, count])

  useFrame((state, dt) => dampToTemp(uniforms, dt))

  return (
    <instancedMesh
      ref={(node) => {
        meshRef.current = node
        if (node) {
          for (let i = 0; i < instances.length; i++) node.setMatrixAt(i, instances[i])
          node.instanceMatrix.needsUpdate = true
          if (!node.geometry.getAttribute('aSeed')) {
            node.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
          }
        }
      }}
      args={[undefined, undefined, instances.length]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={oghamVert}
        fragmentShader={oghamFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}

export default function ForgeMouth({
  position = [0, 0, 0],
  scale = 1,
  width = 3.0,
  height = 4.4,
  jamb = 0.62,
  depth = 0.9,
  heat = 1.0,
  ogham = true,
}) {
  const archGeo = useMemo(
    () => makeArchGeometry(width, height, jamb, depth),
    [width, height, jamb, depth]
  )
  // dispose the generated geometry on unmount / param change
  useMemo(() => () => archGeo.dispose && archGeo.dispose(), [archGeo])

  const basaltUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.6 },
      uHeat: { value: 0 },
      uInnerR: { value: width * 0.5 },
    }),
    [width]
  )
  const interiorUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uTemp: { value: 0.7 }, uHeat: { value: 0 } }),
    []
  )

  useFrame((state, dt) => {
    dampToTemp(basaltUniforms, dt, heat)
    dampToTemp(interiorUniforms, dt, heat)
  })

  // the blazing interior plane sits BEHIND the arch opening; sized to overfill the hole
  const interiorW = width * 1.18
  const interiorH = height * 1.18

  return (
    <group position={position} scale={scale}>
      {/* THE INTERIOR — blazing white-hot forge seen through the mouth, placed behind the
          opening so the arch frames it; emissive >1.0, the bloom blooms it heavily. */}
      <mesh position={[0, height * 0.02, -depth * 0.5 - 0.35]} renderOrder={-1}>
        <planeGeometry args={[interiorW, interiorH]} />
        <shaderMaterial
          vertexShader={interiorVert}
          fragmentShader={interiorFrag}
          uniforms={interiorUniforms}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* THE BASALT ARCH — extruded dark green-black Irish stone, inner edge heat-licked */}
      <mesh geometry={archGeo}>
        <shaderMaterial
          vertexShader={basaltVert}
          fragmentShader={basaltFrag}
          uniforms={basaltUniforms}
        />
      </mesh>

      {/* OGHAM up both jambs — glowing carved strokes that hold a sliver of the divine fire */}
      {ogham && <OghamJambs width={width} height={height} jamb={jamb} depth={depth} />}
    </group>
  )
}
