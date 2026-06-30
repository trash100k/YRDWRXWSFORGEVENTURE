import { useMemo, useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { FONT_DISPLAY } from './fonts.js'
import { forge } from '../store.js'

/**
 * LetterCast — THE FINALE CENTERPIECE.
 *
 * 3D "GAELWORX" letterforms that the molten metal CASTS. A fill front sweeps
 * left→right (driven by `progress`); as it passes each letter, that letter floods
 * with molten heat (white-hot → orange → forge-red) and then COOLS to forged iron —
 * EXCEPT the keystone divine letters (the first `A` and the first `E`), which lock to
 * eternal white-gold DIVINE FIRE: they ignite as the front reaches them and NEVER cool,
 * pushing emissive radiance well past 1.0 so the shared bloom pass catches them, each
 * haloed by its own soft point light.
 *
 * Renders INSIDE the existing <Canvas> (one shared renderer + EffectComposer/bloom).
 * Built from per-letter troika <Text> meshes (no external font/EXR assets), each driven
 * by its own clean ShaderMaterial exposing { uFill, uTemp, uDivine, ... } uniforms so a
 * letter can be addressed individually.
 *
 * @typedef {Object} LetterCastProps
 * @property {number} [progress=0]  0..1 molten fill front, sweeping left→right across the word.
 * @property {string} [text='GAELWORX']  the word to cast (ALL-CAPS; Cinzel display has no lowercase).
 * @property {[number,number,number]} [position=[0,0,0]]  world placement of the wordmark.
 * @property {number} [size=1.2]  cap height of each letter, in world units.
 *
 * @param {LetterCastProps} props
 */

// ── the divine-fire law: within the word, the FIRST 'A' and FIRST 'E' are eternal.
// Returns a Set of letter indices that must never cool (the white-gold exception).
function divineIndices(text) {
  const out = new Set()
  const up = text.toUpperCase()
  const a = up.indexOf('A')
  const e = up.indexOf('E')
  if (a !== -1) out.add(a)
  if (e !== -1) out.add(e)
  return out
}

const letterVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const letterFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  uniform float uTime;
  uniform float uFill;     // 0..1 how flooded this letter is (front already passed -> 1)
  uniform float uCool;     // 0..1 cooling progress after the flood (iron set-in)
  uniform float uTemp;     // master forge temperature (subtle global breathing)
  uniform float uDivine;   // 1.0 if this is the eternal A/E, else 0.0
  uniform float uReduced;  // 1.0 -> freeze flicker

  // shared brand temperature ramp (Planckian order, brand-anchored stops)
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

  // cheap hash for molten grain
  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  void main(){
    // bottom-up molten fill: the metal pools and RISES. A point on the glyph (vUv.y: 0 bottom
    // ..1 top) lights once the rising fill level uFill passes its height. uFill=0 -> empty,
    // uFill=1 -> the whole glyph is filled. Soft 0.14-wide wet meniscus at the rising line.
    float front = smoothstep(vUv.y - 0.12, vUv.y + 0.02, uFill);
    // grainy molten texture so the metal reads as liquid, not a flat gradient
    float grain = hash(floor(vUv * 28.0) + floor(vec2(uTime * 6.0, 0.0)));
    grain = mix(grain, hash(vUv * 12.0), 0.5);

    // ── COOLING letter (forged iron) ──
    // freshly cast: white-hot core; then cools toward dull iron as uCool -> 1.
    float castHeat = mix(0.96, 0.30, uCool);              // white-hot -> dull red glow
    castHeat = mix(0.10, castHeat, front);                // unfilled = cold iron
    castHeat += (grain - 0.5) * 0.10 * front * (1.0 - uCool); // molten shimmer while hot
    float ironT = clamp(castHeat + uTemp * 0.05, 0.0, 1.0);
    vec3 ironCol = gw_tempColor(ironT) * gw_em(ironT);
    // forged-iron body that survives the cool (cold steel, faintly catching forge light)
    vec3 ironBody = ${v3(PAL.steel)} * (0.18 + 0.20 * (1.0 - uCool));
    ironCol = max(ironCol, ironBody);

    // ── DIVINE letter (eternal white-gold, never cools) ──
    float flick = uReduced > 0.5 ? 0.0
      : (sin(uTime * 7.0 + vWorldPos.y * 3.0) * 0.5 + 0.5) * 0.18
      + (hash(vUv * 6.0 + floor(uTime * 10.0)) - 0.5) * 0.10;
    // ignites with the front, then holds forever at >1 radiance
    float ignite = front;                                  // lights as the cast reaches it
    float divHeat = 1.0 + flick;                           // already past white-hot
    // white-GOLD, not just white: a molten-gold body so the eternal letters read distinctly
    // warmer than any freshly-cast white-hot iron around them.
    vec3 divCol = mix(${v3(PAL.gold)}, ${v3(PAL.divine)}, 0.45);
    // emissive radiance pushed hard past 1.0 so the shared bloom blooms it
    divCol *= (3.6 + flick * 1.6) * mix(0.12, 1.0, ignite);
    // a hotter white-gold core down the spine of the glyph
    float spine = smoothstep(0.42, 0.0, abs(vUv.x - 0.5));
    divCol += ${v3(PAL.divine)} * spine * 1.3 * ignite;

    vec3 col = mix(ironCol, divCol, uDivine);

    // troika multiplies its glyph-coverage alpha into this; keep alpha solid.
    gl_FragColor = vec4(col, 1.0);
  }
`

function makeUniforms(isDivine) {
  return {
    uTime: { value: 0 },
    uFill: { value: 0 },
    uCool: { value: 0 },
    uTemp: { value: 0.5 },
    uDivine: { value: isDivine ? 1 : 0 },
    uReduced: { value: forge.reduced ? 1 : 0 },
  }
}

/** One cast letter: a troika <Text> glyph driven by the molten ShaderMaterial. */
function CastLetter({ char, x, size, isDivine, localFill, cooled }) {
  const matRef = useRef()
  const lightRef = useRef()
  const uniforms = useMemo(() => makeUniforms(isDivine), [isDivine])

  // a fresh ShaderMaterial we fully own; troika derives from it for glyph coverage.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: letterVert,
        fragmentShader: letterFrag,
        uniforms,
        transparent: true,
        toneMapped: false, // keep >1 radiance intact for the HDR bloom contract
      }),
    [uniforms]
  )

  useLayoutEffect(() => () => material.dispose(), [material])

  useFrame((state, dt) => {
    const d = Math.min(1, dt || 0.016)
    const u = uniforms
    u.uTime.value = forge.reduced ? 0 : state.clock.elapsedTime
    u.uReduced.value = forge.reduced ? 1 : 0
    // damp toward the target fill/cool the parent computed for this letter
    u.uFill.value += (localFill.current - u.uFill.value) * Math.min(1, d * 6)
    u.uCool.value += (cooled.current - u.uCool.value) * Math.min(1, d * 2.4)
    u.uTemp.value += (forge.temperature - u.uTemp.value) * Math.min(1, d * 2)

    // the divine A/E radiate: a soft point light that rises with the ignite, eternal.
    if (lightRef.current) {
      const lit = u.uFill.value
      const flick = forge.reduced ? 0 : 0.85 + Math.sin(state.clock.elapsedTime * 6 + x) * 0.15
      lightRef.current.intensity = lit * 2.6 * flick
    }
  })

  return (
    <group position={[x, 0, 0]}>
      <Text
        font={FONT_DISPLAY}
        fontSize={size}
        anchorX="center"
        anchorY="middle"
        letterSpacing={-0.02}
        material={material}
        // troika needs a glyph; a single uppercase char per mesh
      >
        {char}
      </Text>
      {isDivine && (
        <pointLight
          ref={lightRef}
          color={PAL.divine}
          distance={size * 7}
          decay={2}
          intensity={0}
          position={[0, 0, size * 0.55]}
        />
      )}
    </group>
  )
}

export default function LetterCast({
  progress = 0,
  liveProgress = null, // optional () => number, read every frame (scroll-driven cast, no re-render)
  text = 'GAELWORX',
  position = [0, 0, 0],
  size = 1.2,
}) {
  const chars = useMemo(() => text.toUpperCase().split(''), [text])
  const divine = useMemo(() => divineIndices(text), [text])

  // lay the word out centered on origin; advance ~ cap width per glyph.
  const layout = useMemo(() => {
    const adv = size * 0.78 // monospace-ish advance; troika centers each glyph in its cell
    const total = (chars.length - 1) * adv
    return chars.map((char, i) => ({
      char,
      i,
      x: i * adv - total / 2,
      isDivine: divine.has(i),
      // 0..1 position of this letter's center along the word (for the L→R front)
      u: chars.length > 1 ? i / (chars.length - 1) : 0,
    }))
  }, [chars, divine, size])

  // per-letter damped targets, mutated each frame from `progress` (no React churn mid-sweep)
  const fills = useRef(layout.map(() => ({ current: 0 })))
  const cools = useRef(layout.map(() => ({ current: 0 })))

  useFrame(() => {
    const p = THREE.MathUtils.clamp(liveProgress ? liveProgress() : progress, 0, 1)
    // Two phases over the scroll: the molten POUR fills the word L→R (front-loaded), then the
    // metal SETS, cooling L→R. They overlap, but by p=1 everything has cast AND cooled — the
    // settled finale: forged iron everywhere, the divine A/E the only things still alight.
    const pf = THREE.MathUtils.clamp(p / 0.55, 0, 1) // fill phase (first ~55% of the descent)
    const pc = THREE.MathUtils.clamp((p - 0.32) / 0.68, 0, 1) // cool phase, trailing
    const n = layout.length
    for (let i = 0; i < n; i++) {
      const u = layout[i].u
      // molten front sweeps L→R; the ×1.2 + bias guarantees the last glyph fills exactly at pf=1
      fills.current[i].current = THREE.MathUtils.clamp((pf * 1.2 - u + 0.06) / 0.16, 0, 1)
      // cooling trails the fill, also L→R; the divine A/E NEVER cool; all others fully set by p=1
      cools.current[i].current = layout[i].isDivine
        ? 0
        : THREE.MathUtils.clamp((pc * 1.25 - u) / 0.22, 0, 1)
    }
  })

  return (
    <group position={position}>
      {layout.map((L, idx) => (
        <CastLetter
          key={`${L.char}-${idx}`}
          char={L.char}
          x={L.x}
          size={size}
          isDivine={L.isDivine}
          localFill={fills.current[idx]}
          cooled={cools.current[idx]}
        />
      ))}
    </group>
  )
}
