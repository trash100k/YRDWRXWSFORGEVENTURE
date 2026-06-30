import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * Plinths — THE WORK CHAMBER. Four finished CASTS on dark Irish-basalt plinths, arranged
 * in a slight arc in the void. Each cast is a distinct forged form frozen at a different
 * TEMPERATURE on the shared brand ramp: AgentWorx still glows white-hot (newest off the
 * mould), SalesWorx ember, RepairWorx dull crimson, YardWorx cold forged iron. The metal
 * is the only light — each cast is gallery-lit ONLY by its own emissive point light, so a
 * cold cast sits in near-darkness and a hot one floods its plinth. The casts' hot bands
 * exceed 1.0 so the shared EffectComposer bloom catches them.
 *
 * The camera pans along the arc to frame the `active` cast (Brutalist-Snap-flavoured damp).
 * Renders INSIDE the existing <Canvas> — no Canvas, no composer of its own.
 *
 * @typedef {Object} PlinthsProps
 * @property {number} [active=3]   index 0..3 of the cast to frame (0 YardWorx … 3 AgentWorx).
 * @property {boolean} [pan=true]  let the camera pan to the active cast. False = leave camera alone.
 * @property {number} [radius=7.2] arc radius the plinths sit on (world units).
 * @property {number} [spread=0.62] angular spread of the arc, in radians (total fan).
 * @property {[number,number,number]} [position=[0,-0.6,-2]] group origin of the whole chamber.
 *
 * @param {PlinthsProps} props
 */

// ── the four casts. temp = where on the brand ramp this cast has cooled to ──
const CASTS = [
  { key: 'YardWorx',   temp: 0.06, form: 'pillar', spin: 0.05 }, // cold forged iron
  { key: 'RepairWorx', temp: 0.34, form: 'gear',   spin: 0.10 }, // dull crimson
  { key: 'SalesWorx',  temp: 0.62, form: 'blade',  spin: 0.08 }, // ember
  { key: 'AgentWorx',  temp: 0.97, form: 'core',   spin: 0.16 }, // still white-hot, newest
]

// ── shared molten-shell material. A forged metal body whose hot bands glow on the ramp.
// onBeforeCompile injection keeps it lit by emissive only (the chamber has no key light).
const sharedVein = /* glsl */ `
  // ridged value-noise — cooling-crust filaments crawling over the cast
  float gw_hash(vec3 p){
    p = fract(p * 0.3183099 + 0.1); p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float gw_vnoise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(gw_hash(i + vec3(0,0,0)), gw_hash(i + vec3(1,0,0)), f.x),
                   mix(gw_hash(i + vec3(0,1,0)), gw_hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(gw_hash(i + vec3(0,0,1)), gw_hash(i + vec3(1,0,1)), f.x),
                   mix(gw_hash(i + vec3(0,1,1)), gw_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float gw_fbm(vec3 p){
    float v = 0.0, a = 0.55;
    for (int i = 0; i < 4; i++) { v += a * gw_vnoise(p); p = p * 2.02 + 0.11; a *= 0.5; }
    return v;
  }
  vec3 gw_tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    c = mix(c, ${v3(PAL.gold)},    smoothstep(0.64, 0.85, t));
    c = mix(c, ${v3(PAL.hot)},     smoothstep(0.82, 1.00, t));
    return c;
  }
  float gw_em(float t){ t = clamp(t, 0.0, 1.0); return pow(t, 3.0) * 3.2 + t * 0.10; }
`

/** Build one cast geometry per `form`. Modest poly counts — mobile-affordable. */
function makeForm(form) {
  switch (form) {
    case 'gear': {
      // a thick forged ring — RepairWorx
      return new THREE.TorusGeometry(0.62, 0.26, 18, 40)
    }
    case 'blade': {
      // a tapered cast wedge — SalesWorx (point the sword)
      const g = new THREE.ConeGeometry(0.42, 1.7, 4, 1)
      g.rotateZ(Math.PI) // point up
      return g
    }
    case 'core': {
      // a faceted molten core, still hot — AgentWorx
      return new THREE.IcosahedronGeometry(0.74, 1)
    }
    case 'pillar':
    default: {
      // a squat octagonal billet, cold — YardWorx
      return new THREE.CylinderGeometry(0.5, 0.62, 1.35, 8, 1)
    }
  }
}

/** One basalt plinth + its cast + its own emissive light. */
function Cast({ cfg, position }) {
  const matRef = useRef()
  const lightRef = useRef()
  const castRef = useRef()

  const geo = useMemo(() => makeForm(cfg.form), [cfg.form])

  const uniforms = useMemo(
    () => ({
      uTime: { value: Math.random() * 100 },
      uTemp: { value: cfg.temp },
    }),
    [cfg.temp]
  )

  // forged-metal standard material with the molten ramp injected as emissive radiance
  const onBeforeCompile = useMemo(
    () => (shader) => {
      shader.uniforms.uTime = uniforms.uTime
      shader.uniforms.uTemp = uniforms.uTemp
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>\n varying vec3 vGwPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n vGwPos = position;`
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\n varying vec3 vGwPos;\n uniform float uTime, uTemp;\n ${sharedVein}`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           {
             // crawling cooling crust over the body
             float n = gw_fbm(vGwPos * 2.7 + vec3(0.0, uTime * 0.18, 0.0));
             float band = clamp(pow(1.0 - abs(n - 0.5) * 2.2, 2.4), 0.0, 1.0);
             // local temp = the cast's frozen temp, modulated by the crust bands.
             // a cold cast (low uTemp) barely lifts off the void; a hot one floods.
             float lt = clamp(uTemp * (0.32 + band * 0.95), 0.0, 1.0);
             vec3 glow = gw_tempColor(lt) * gw_em(lt);
             totalEmissiveRadiance += glow;
           }`
        )
    },
    [uniforms]
  )

  // the cast's own emissive light pool — colour + intensity track its temperature, so
  // the metal is the only light. Cold casts barely light their plinth.
  const lightColor = useMemo(() => {
    const c = new THREE.Color()
    // sample the ramp roughly in JS for the point-light tint
    const t = cfg.temp
    if (t < 0.22) c.set(PAL.crimsonDeep)
    else if (t < 0.45) c.set(PAL.crimson)
    else if (t < 0.66) c.set(PAL.ember)
    else if (t < 0.85) c.set(PAL.gold)
    else c.set(PAL.hot)
    return c
  }, [cfg.temp])

  useFrame((state, dt) => {
    const d = Math.min(1, dt || 0.016)
    if (!forge.reduced) uniforms.uTime.value += d
    // slow ceremonial spin — skipped under reduced-motion
    if (castRef.current && !forge.reduced) {
      castRef.current.rotation.y += d * cfg.spin
    }
    // breathe the light a touch so hot casts feel alive (forge flicker)
    if (lightRef.current) {
      const flick = forge.reduced ? 1 : 1 + Math.sin(state.clock.elapsedTime * 2.3 + cfg.temp * 9.0) * 0.06 * cfg.temp
      lightRef.current.intensity = (0.6 + cfg.temp * cfg.temp * 9.0) * flick
    }
  })

  return (
    <group position={position}>
      {/* basalt plinth — dark green-black Irish basalt, sharp brutalist column */}
      <mesh position={[0, -1.35, 0]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[1.5, 2.4, 1.5]} />
        <meshStandardMaterial
          color={'#0d1411'}
          roughness={0.92}
          metalness={0.08}
          emissive={'#070b09'}
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* a thin steel rim cap on the plinth top (sharp 0px-corner detail) */}
      <mesh position={[0, -0.13, 0]}>
        <boxGeometry args={[1.54, 0.06, 1.54]} />
        <meshStandardMaterial color={PAL.steel} roughness={0.5} metalness={0.7} />
      </mesh>

      {/* the cast itself */}
      <mesh ref={castRef} geometry={geo} position={[0, 0.55, 0]}>
        <meshStandardMaterial
          ref={matRef}
          color={'#15171c'}
          roughness={0.42}
          metalness={0.95}
          emissive={'#000000'}
          onBeforeCompile={onBeforeCompile}
        />
      </mesh>

      {/* the cast IS the light. Pool sits at the cast, tinted to its temperature. */}
      <pointLight
        ref={lightRef}
        position={[0, 0.55, 0]}
        color={lightColor}
        intensity={0.6 + cfg.temp * cfg.temp * 9.0}
        distance={5.5}
        decay={2}
      />
    </group>
  )
}

export default function Plinths({
  active = 3,
  pan = true,
  radius = 7.2,
  spread = 0.62,
  position = [0, -0.6, -2],
}) {
  const { camera } = useThree()
  const groupRef = useRef()

  // place the four plinths on a shallow arc facing the chamber centre
  const layout = useMemo(() => {
    const n = CASTS.length
    return CASTS.map((cfg, i) => {
      // angle fans the casts left→right; arc bows slightly toward camera (−z front)
      const a = (i / (n - 1) - 0.5) * spread
      const x = Math.sin(a) * radius
      const z = -Math.cos(a) * radius + radius // bow forward so centre casts sit nearer
      return { cfg, pos: [x, 0, z] }
    })
  }, [radius, spread])

  // a faint ambient + cold fill so basalt isn't pure black — kept low; metal dominates
  // (set once; brutalist void stays crushed)

  // camera pan target — frame the active cast
  const desired = useMemo(() => new THREE.Vector3(), [])
  const lookAt = useMemo(() => new THREE.Vector3(), [])
  const curLook = useRef(new THREE.Vector3())
  const tmp = useRef(new THREE.Vector3())

  useLayoutEffect(() => {
    curLook.current.set(position[0], position[1] + 0.4, position[2])
  }, [position])

  useFrame((state, dt) => {
    if (!pan || !groupRef.current) return
    const idx = THREE.MathUtils.clamp(Math.round(active), 0, layout.length - 1)
    const l = layout[idx]
    // world position of the active cast
    tmp.current.set(l.pos[0], l.pos[1] + 0.55, l.pos[2])
    groupRef.current.localToWorld(tmp.current)

    // sit the camera in front of (and slightly above) the active cast, looking at it
    desired.set(tmp.current.x * 0.55, tmp.current.y + 0.9, tmp.current.z + 4.6)
    lookAt.copy(tmp.current)

    const d = Math.min(1, (dt || 0.016) * (forge.reduced ? 12 : 3.4)) // snap-flavoured damp
    camera.position.lerp(desired, d)
    curLook.current.lerp(lookAt, d)
    camera.lookAt(curLook.current)
  })

  return (
    <group ref={groupRef} position={position}>
      {/* crushed fill so basalt reads as form, not a hole — metal stays the key light */}
      <ambientLight intensity={0.06} color={PAL.steel} />
      <hemisphereLight intensity={0.08} color={PAL.steel} groundColor={PAL.void} />

      {layout.map(({ cfg, pos }) => (
        <Cast key={cfg.key} cfg={cfg} position={pos} />
      ))}
    </group>
  )
}
