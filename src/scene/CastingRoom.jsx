import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * CastingRoom — THE SOFTWARE CHAMBER, the casting room.
 *
 * A single finished forged CAST sits on a dark Irish-basalt plinth, still warm. The
 * camera slowly orbits it (or it self-rotates under reduced-motion). The cast's iron
 * surface carries Celtic-knotwork that, read up close, resolves into circuit / logic-gate
 * paths: procedural emissive ember lines flowing across a dark-iron PBR body. The object
 * IS the argument for ownership — you own the casting, not a rented seat.
 *
 * The metal is the only light: a hot point-light lives inside the cast, the emissive
 * circuitry pushes radiance >1.0 so the shared EffectComposer bloom catches it, and the
 * residual forge-heat (forge.temperature) modulates how warm the whole room reads.
 *
 * Renders INSIDE the existing <Canvas>. No EXR, modest geometry, mobile-affordable.
 *
 * @typedef {Object} CastingRoomProps
 * @property {[number,number,number]} [position=[0,0,0]] - world position of the plinth base.
 * @property {number} [scale=1] - uniform scale of the whole tableau.
 * @property {boolean} [orbit=true] - true: camera slowly orbits the cast (disabled by
 *   forge.reduced, which falls back to gentle self-rotation). false: leaves the camera
 *   alone and the cast self-rotates — use when a parent rig drives the camera.
 * @property {number} [orbitRadius=4.2] - camera orbit radius around the cast.
 * @property {number} [orbitHeight=1.4] - camera height above the cast centre while orbiting.
 * @property {number} [speed=1] - master tempo multiplier for orbit + circuit flow.
 */

/* ── the master temperature ramp (brand-anchored, identical to the rest of the world) ── */
const TEMP_RAMP = /* glsl */ `
  vec3 gw_tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    c = mix(c, ${v3(PAL.gold)},    smoothstep(0.64, 0.85, t));
    c = mix(c, ${v3(PAL.hot)},     smoothstep(0.82, 1.00, t));
    return c;
  }
`

/* shared value-noise + fbm — same organic basis, cheap on mobile */
const NOISE = /* glsl */ `
  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++){ v += a * vnoise(p); p *= 2.02; a *= 0.5; }
    return v;
  }
`

/**
 * The circuit-knotwork field. Returns line intensity in 0..1: orthogonal traces (the
 * circuit logic) braided over a triangular interlace bias (the Celtic knot), with travelling
 * pulses that read as data / current. UVs are the cast's surface coords.
 */
const CIRCUIT = /* glsl */ `
  // distance to a regular grid of traces, with knotwork offset so lines weave
  float traces(vec2 uv, float density){
    vec2 g = uv * density;
    // knot bias: shove the grid along a 3-fold interlace so paths braid, not crosshatch
    g.x += 0.18 * sin(g.y * 2.0943951 + 1.2);
    g.y += 0.18 * sin(g.x * 2.0943951);
    vec2 c = abs(fract(g) - 0.5);
    float lx = smoothstep(0.06, 0.0, c.x);
    float ly = smoothstep(0.06, 0.0, c.y);
    // logic-gate nodes where traces meet
    float node = smoothstep(0.12, 0.0, length(c)) * 0.8;
    return clamp(max(lx, ly) + node, 0.0, 1.0);
  }
  // current pulses travelling along the traces
  float current(vec2 uv, float t){
    float p = sin((uv.x + uv.y) * 26.0 - t * 3.2);
    p = pow(max(p, 0.0), 6.0);
    float q = sin((uv.x - uv.y) * 18.0 - t * 2.1 + 1.7);
    q = pow(max(q, 0.0), 8.0);
    return clamp(p + q * 0.7, 0.0, 1.0);
  }
`

/**
 * Build a dark-iron PBR material and inject the emissive circuit/knotwork into its
 * emissive term via onBeforeCompile. The metal gets real lighting from the inner forge
 * light; only the traces exceed 1.0, so the shared bloom selectively catches them.
 */
function makeCastMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PAL.steel).multiplyScalar(0.35),
    metalness: 0.92,
    roughness: 0.52,
    emissive: new THREE.Color(PAL.ember),
    emissiveIntensity: 1.0,
  })

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uTemp = uniforms.uTemp
    shader.uniforms.uHeat = uniforms.uHeat
    shader.uniforms.uFlow = uniforms.uFlow

    // pass surface uv (+ a touch of world pos) to the fragment stage
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec2 vCastUv;
         varying vec3 vCastPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vCastUv = uv;
         vCastPos = position;`
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec2 vCastUv;
         varying vec3 vCastPos;
         uniform float uTime, uTemp, uHeat, uFlow;
         ${TEMP_RAMP}
         ${NOISE}
         ${CIRCUIT}`
      )
      // roughen the iron with grain + scratch so it reads as cast metal, not plastic
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float grain = fbm(vCastUv * 90.0);
         roughnessFactor = clamp(roughnessFactor + (grain - 0.5) * 0.35, 0.18, 0.95);`
      )
      // the emissive circuitry — the divine fire of the casting
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         vec2 cuv = vCastUv;
         // two scales of knotwork: a broad Celtic band + a fine circuit weave up close
         float broad = traces(cuv, 7.0);
         float fine  = traces(cuv + vec2(0.13, 0.27), 22.0);
         float lines = max(broad, fine * 0.85);
         // break the lattice with noise so it's organic cast knotwork, not a clean PCB
         float mask  = smoothstep(0.42, 0.62, fbm(cuv * 3.5 + 4.0));
         lines *= mask;
         // travelling current — data flowing through the gates
         float cur = current(cuv, uTime * uFlow);
         // the surrounding iron is barely warm; the traces are hot. temp/heat lift both.
         float baseT = 0.20 + uTemp * 0.30 + uHeat * 0.22;
         float traceT = clamp(baseT + 0.45 + cur * 0.35, 0.0, 1.0);
         vec3 traceCol = gw_tempColor(traceT);
         // radiance >1.0 on the live traces so the shared bloom blooms them
         float radiance = (1.4 + cur * 2.6 + uHeat * 1.2) * lines;
         totalEmissiveRadiance += traceCol * radiance;
         // a faint overall warm afterglow on the body (still-warm casting)
         totalEmissiveRadiance += gw_tempColor(baseT) * (0.10 + uHeat * 0.12);`
      )
  }

  return mat
}

/** A faceted cast object — a forged software billet. Icosahedron-ish but readable. */
function Cast({ uniforms }) {
  const mat = useMemo(() => makeCastMaterial(uniforms), [uniforms])

  // a chunky cast form: subdivided so UVs span and the knot reads across the faces
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1.0, 4)
    // shrink toward a forged ingot: flatten slightly, give it weight
    g.scale(1.0, 0.92, 1.0)
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <mesh geometry={geo} castShadow={false} position={[0, 1.55, 0]}>
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Dark Irish-basalt plinth — a hexagonal columnar block, cold and matte. */
function Plinth() {
  return (
    <group>
      {/* the column */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.95, 1.05, 1.1, 6]} />
        <meshStandardMaterial
          color={new THREE.Color(PAL.void).lerp(new THREE.Color(PAL.steel), 0.45)}
          metalness={0.1}
          roughness={0.95}
        />
      </mesh>
      {/* the cap the cast rests on */}
      <mesh position={[0, 1.13, 0]}>
        <cylinderGeometry args={[1.02, 0.98, 0.08, 6]} />
        <meshStandardMaterial
          color={new THREE.Color(PAL.steel)}
          metalness={0.2}
          roughness={0.85}
        />
      </mesh>
    </group>
  )
}

/** Slowly orbit the camera around the cast — or self-rotate the cast under reduced-motion. */
function OrbitRig({ enabled, radius, height, speed, target, selfRotateRef }) {
  const { camera } = useThree()
  const a = useRef(0)
  const DES = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    const d = Math.min(1, dt || 0.016)
    if (enabled && !forge.reduced) {
      a.current += d * 0.12 * speed
      DES.set(
        target[0] + Math.sin(a.current) * radius,
        target[1] + height,
        target[2] + Math.cos(a.current) * radius
      )
      camera.position.lerp(DES, 0.05)
      camera.lookAt(target[0], target[1], target[2])
    } else if (selfRotateRef.current && !forge.reduced) {
      selfRotateRef.current.rotation.y += d * 0.18 * speed
    }
  })
  return null
}

export default function CastingRoom({
  position = [0, 0, 0],
  scale = 1,
  orbit = true,
  orbitRadius = 4.2,
  orbitHeight = 1.4,
  speed = 1,
}) {
  const groupRef = useRef()
  const spinRef = useRef()

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.2 },
      uHeat: { value: 0 },
      uFlow: { value: 1.0 },
    }),
    []
  )

  // the cast centre in world space (plinth + cast offset), for the orbit target + lights
  const target = useMemo(
    () => [position[0], position[1] + 1.55 * scale, position[2]],
    [position, scale]
  )

  const lightRef = useRef()

  useFrame((state, dt) => {
    const d = Math.min(1, dt || 0.016)
    if (!forge.reduced) uniforms.uTime.value += d * (forge.still ? 0.5 : 1.0) * speed

    // strike pulse → transient heat (same contract as the rest of the forge)
    const since = performance.now() / 1000 - forge.strikeAt
    const pulse = since >= 0 && since < 1.2 ? Math.exp(-since * 3) * 0.6 : 0
    const targetHeat = Math.min(forge.heat + pulse, 1)

    uniforms.uTemp.value += (forge.temperature - uniforms.uTemp.value) * d * 2.2
    uniforms.uHeat.value += (targetHeat - uniforms.uHeat.value) * d * 3.0
    uniforms.uFlow.value = 1.0 + uniforms.uHeat.value * 1.5

    // the inner forge light breathes with the heat — the metal is the only light
    if (lightRef.current) {
      lightRef.current.intensity = 2.4 + uniforms.uHeat.value * 4.0 + uniforms.uTemp.value * 2.0
    }
  })

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <OrbitRig
        enabled={orbit}
        radius={orbitRadius}
        height={orbitHeight}
        speed={speed}
        target={target}
        selfRotateRef={spinRef}
      />

      {/* the metal is the only light: a warm point-light living inside the cast, plus a
          faint cold fill so the basalt isn't pure void. No EXR, no shadow maps. */}
      <pointLight
        ref={lightRef}
        position={[0, 1.55, 0]}
        color={PAL.ember}
        intensity={2.4}
        distance={9}
        decay={2}
      />
      <ambientLight color={PAL.steel} intensity={0.12} />
      <hemisphereLight color={PAL.crimsonDeep} groundColor={PAL.void} intensity={0.18} />

      <Plinth />
      <group ref={spinRef} position={[0, 0, 0]}>
        <Cast uniforms={uniforms} />
      </group>
    </group>
  )
}
