import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, ToneMapping, Noise, ChromaticAberration } from '@react-three/postprocessing'
import { ToneMappingMode, BlendFunction } from 'postprocessing'
import HeatHaze from './HeatHaze.jsx'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'
import Embers from './Embers.jsx'
import ForgeJourney from './ForgeJourney.jsx'
import ForgeConcept from './ForgeConcept.jsx'
import LabScene from './LabScene.jsx'

/**
 * The ONE renderer. A full-screen forge surface — void-black obsidian with living
 * fire-opal ember veins, driven by the master temperature system. Scroll heats the
 * forge (the descent); the pointer warms the metal near it; a strike pulses heat.
 * This is Phase A of the build: the temperature spine wired to a first hot surface.
 * Bloom / chambers / the pour layer onto this single renderer later.
 */

// fullscreen: a clip-space quad, camera-independent
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const frag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uTemp, uHeat, uAspect;
  uniform vec2 uPointer;

  // simplex noise (Ashima / Gustavson) — organic, no grid artifacts
  vec3 permute(vec3 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.55; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) { v += a * (snoise(p) * 0.5 + 0.5); p = m * p + 0.031; a *= 0.5; }
    return v;
  }

  // ── the master temperature ramp (brand-anchored) ──
  vec3 gw_tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    c = mix(c, ${v3(PAL.gold)},    smoothstep(0.64, 0.85, t));
    c = mix(c, ${v3(PAL.hot)},     smoothstep(0.82, 1.00, t));
    return c;
  }
  float gw_tempEmissive(float t){ t = clamp(t, 0.0, 1.0); return pow(t, 3.0) * 2.6 + t * 0.12; }
  vec3 gw_forge(float t){ return gw_tempColor(t) * gw_tempEmissive(t); }

  void main(){
    vec2 uv = vUv;
    vec2 p = (uv - 0.5); p.x *= uAspect; p *= 3.0;

    // domain warp — boil in place (time offsets the field, never scrolls a coord)
    float t = uTime * 0.06;
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(fbm(p + 2.4 * q + vec2(1.7, 9.2)), fbm(p + 2.4 * q + vec2(8.3, 2.8)));
    float f = fbm(p + 2.2 * r);

    // ridged filaments = the fire-opal veins
    float vein = clamp(pow(1.0 - abs(f - 0.52) * 2.0, 3.2), 0.0, 1.0);

    // pointer warms the metal near it
    vec2 pp = uPointer * 0.5 + 0.5;
    float pointGlow = smoothstep(0.40, 0.0, distance(uv, pp)) * 0.22;

    // master temperature for the veins (scroll heat + strike + local)
    float baseT = 0.14 + uTemp * 0.6 + uHeat * 0.3;
    float temp = clamp(baseT * (0.4 + vein) + pointGlow, 0.0, 1.0);

    vec3 col = ${v3(PAL.void)};
    col += gw_forge(temp) * vein * 1.35;
    col += ${v3(PAL.steel)} * 0.025 * (1.0 - vein); // faint cold-steel body

    // vignette toward the void
    float vig = smoothstep(1.30, 0.30, length((uv - 0.5) * vec2(uAspect, 1.0)));
    col *= mix(0.68, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`

function Slab() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.16 },
      uHeat: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uAspect: { value: 1 },
    }),
    []
  )

  const tAcc = useRef(0)

  useFrame((state, dt) => {
    const u = uniforms
    const d = Math.min(1, dt || 0.016)
    // boil in place; calmer chambers slow the clock, reduced-motion freezes it
    if (!forge.reduced) tAcc.current += d * (forge.still ? 0.32 : 1.0)
    u.uTime.value = tAcc.current

    // strike pulse → transient heat
    const since = performance.now() / 1000 - forge.strikeAt
    const pulse = since >= 0 && since < 1.2 ? Math.exp(-since * 3) * 0.6 : 0
    const targetHeat = Math.min(forge.heat + pulse, 1)

    u.uAspect.value = state.size.width / Math.max(1, state.size.height)
    u.uTemp.value += (forge.temperature - u.uTemp.value) * d * 2.2
    u.uHeat.value += (targetHeat - u.uHeat.value) * d * 3.0
    u.uPointer.value.x += (forge.pointer.x - u.uPointer.value.x) * d * 4.0
    u.uPointer.value.y += (forge.pointer.y - u.uPointer.value.y) * d * 4.0
  })

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

export default function ForgeCanvas({ route }) {
  const dpr = useRef(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5))

  useEffect(() => {
    forge.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      forge.scroll = max > 0 ? Math.min(window.scrollY / max, 1) : 0
      // the descent heats the forge, on top of the chamber's base temperature
      forge.temperature = 0.14 + (forge.routeTemp || 0) + forge.scroll * 0.6
    }
    const onPointer = (e) => {
      forge.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      forge.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onPointer, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [])

  return (
    <Canvas
      dpr={dpr.current}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
      camera={{ position: [0, 0, 5], fov: 50 }}
      frameloop={forge.reduced ? 'demand' : 'always'}
    >
      <color attach="background" args={[PAL.void]} />
      {/* /concept = posed art-direction renders · / = the molten channel journey ·
          other routes = the forge backdrop */}
      {route === '/lab' ? (
        <LabScene />
      ) : route === '/concept' ? (
        <ForgeConcept />
      ) : route === '/' ? (
        <ForgeJourney />
      ) : (
        <>
          <Slab />
          {!forge.reduced && <Embers />}
        </>
      )}
      {/* HDR pipeline: scene (linear, >1 hot band) → bloom → ACES → vignette.
          Only the accent band exceeds 1.0, so threshold bloom IS selective bloom. */}
      <EffectComposer frameBufferType={THREE.HalfFloatType}>
        {/* the forge glow — the molten's hot band (>1) blooms; cinematic, not washed */}
        <Bloom mipmapBlur luminanceThreshold={0.5} luminanceSmoothing={0.25} intensity={1.05} radius={0.85} />
        {/* heat shimmer over the molten only (masked to the hot band); the void stays sharp */}
        <HeatHaze strength={0.0055} scale={3.4} speed={0.5} rise={1.0} threshold={0.2} smoothing={0.5} />
        {/* a whisper of lens dispersion at the edges — film, not gimmick */}
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.0006, 0.0006]} radialModulation modulationOffset={0.45} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.26} darkness={0.72} />
        {/* fine film grain so the blacks read as photographed, not dead digital void */}
        <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.055} />
      </EffectComposer>
    </Canvas>
  )
}
