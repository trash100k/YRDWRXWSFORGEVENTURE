import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ScryingPool — THE VOICE CHAMBER.
 *
 * A circular still-water surface sunk into dark green-black Irish basalt, ringed by an
 * Ogham-carved rim, holding a single bright forge-light reflection on its skin and a
 * SUB-SURFACE ember glow welling up from deep below. A dark mirror with fire under it.
 *
 * Calm and ominous: concentric sine-wave ripples emanate from the centre, their amplitude
 * driven by forge.heat + forge.temperature (the chamber "speaking"). The water is a
 * vertex-rippled disc with a fresnel-ish fragment — no EXR; the reflection is faked with a
 * sky/forge gradient plus the sub-surface glow. The pool deck only blooms where the divine
 * forge-light reflection and the deep ember well exceed 1.0.
 *
 * Renders inside the shared <Canvas>; the EffectComposer's Bloom + ACES catch the emissive.
 * Respects forge.reduced (freezes ripple animation). No props.
 *
 * @component
 * @returns {JSX.Element}
 */

// ── geometry budget (mobile-first) ──────────────────────────────────────────
const POOL_RADIUS = 2.6
const POOL_SEGS = 96 // radial+ring resolution of the water disc — modest, enough for smooth ripples
const RIM_INNER = POOL_RADIUS
const RIM_OUTER = POOL_RADIUS + 0.55
const OGHAM_TICKS = 40 // Ogham strokes carved around the rim

// ── water surface ───────────────────────────────────────────────────────────
const waterVert = /* glsl */ `
  uniform float uTime, uHeat, uRipple;
  varying vec2 vUv;
  varying float vRad;       // 0 at centre → 1 at the lip
  varying float vRipple;    // signed wave height (for shading)
  varying vec3 vWorldNrm;
  varying vec3 vViewDir;

  // concentric sine rings emanating from the centre — calm, ordered, ominous
  float pool_ripples(float r, float t, float amp){
    // three detuned rings travelling outward + a slow breathing swell
    float a = sin(r * 18.0 - t * 2.1);
    float b = sin(r * 31.0 - t * 1.35 + 1.7) * 0.55;
    float c = sin(r * 9.0  - t * 0.8) * 0.7;
    // damp toward the rim so the lip stays glassy-still
    float damp = smoothstep(1.0, 0.18, r);
    return (a + b + c) * amp * damp;
  }

  void main(){
    vUv = uv;
    // CircleGeometry lies in the local XY plane; radius normalised to the pool edge.
    // The group rotates this flat into world XZ, so we displace along local +Z (=world up).
    float r = length(position.xy) / ${POOL_RADIUS.toFixed(3)};
    vRad = clamp(r, 0.0, 1.0);

    float amp = uRipple * (0.02 + uHeat * 0.05);
    float h = pool_ripples(r, uTime, amp);
    vRipple = h;

    vec3 p = position;
    p.z += h;

    // cheap analytic normal from the radial wave derivative (surface normal ≈ local +Z)
    float dr = 0.004;
    float h2 = pool_ripples(r + dr, uTime, amp);
    float slope = (h2 - h) / dr;
    vec2 radialDir = normalize(position.xy + 1e-5);
    vec3 nrm = normalize(vec3(-radialDir.x * slope, -radialDir.y * slope, 1.0));

    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorldNrm = normalize(mat3(modelMatrix) * nrm);
    vViewDir = normalize(cameraPosition - wp.xyz);

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const waterFrag = /* glsl */ `
  precision highp float;
  uniform float uTime, uTemp, uHeat;
  varying vec2 vUv;
  varying float vRad;
  varying float vRipple;
  varying vec3 vWorldNrm;
  varying vec3 vViewDir;

  // the master temperature ramp (brand-anchored, matches the rest of the forge)
  vec3 gw_tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    c = mix(c, ${v3(PAL.gold)},    smoothstep(0.64, 0.85, t));
    c = mix(c, ${v3(PAL.hot)},     smoothstep(0.82, 1.00, t));
    return c;
  }

  void main(){
    vec3 N = normalize(vWorldNrm);
    vec3 V = normalize(vViewDir);
    float ndv = clamp(dot(N, V), 0.0, 1.0);

    // ── fresnel: glancing skin reflects the dim sky/steel; head-on shows the depth ──
    float fres = pow(1.0 - ndv, 3.2);

    // faked "reflection": a cold steel→void gradient (the dark cavern overhead), no EXR.
    // glancing angles pick up cold cavern light; very faint — this is a black mirror.
    vec3 reflCol = mix(${v3(PAL.void)}, ${v3(PAL.steel)}, 0.6) * 0.5;

    // ── SUB-SURFACE ember glow welling from deep below ──
    // brightest at the centre, breathing slowly; reads THROUGH the dark water as a
    // bruised crimson→ember core. This is the fire under the mirror.
    float well = smoothstep(0.95, 0.0, vRad);              // centred pool of light
    float breathe = 0.62 + 0.38 * sin(uTime * 0.6);        // slow pulse, the chamber speaking
    float deepT = 0.30 + uTemp * 0.34 + uHeat * 0.30;      // how hot the deep is
    vec3 deep = gw_tempColor(deepT);
    // emissive sub-surface: pushed >1.0 at the very core so bloom catches the well
    float wellEnergy = well * (0.85 + uHeat * 1.3) * (0.55 + breathe * 0.85);
    vec3 subsurface = deep * wellEnergy * 1.65;

    // ripple crests pick up a thread of ember on their faces (the light catching wave skin)
    float crest = smoothstep(0.0, 0.012, vRipple) * well;
    subsurface += ${v3(PAL.ember)} * crest * 0.5 * (0.4 + uHeat);

    // ── the SINGLE bright forge-light reflection on the skin ──
    // a sharp spec highlight offset from centre (a lone forge-mouth burning above the pool).
    // its position drifts faintly with the breathing so it shivers on the ripples.
    vec2 hotUv = vUv - vec2(0.5);
    vec2 lampPos = vec2(0.14, -0.20) + vec2(sin(uTime * 0.5) * 0.01, 0.0);
    float lamp = smoothstep(0.16, 0.0, distance(hotUv, lampPos));
    // the highlight shimmers along ripple slopes (fresnel + crest)
    lamp *= (0.5 + fres * 1.2) * (0.7 + crest * 1.4);
    // divine white-gold forge-light — drive >1.0 so the reflection blooms
    vec3 forgeLight = mix(${v3(PAL.gold)}, ${v3(PAL.divine)}, 0.55) * lamp * (2.0 + uHeat * 1.4);

    // ── compose: a black mirror, fire beneath, one bright eye of forge-light ──
    vec3 col = ${v3(PAL.void)} * 0.4;          // the dark water body
    col += reflCol * fres;                      // faint cold sky on the glancing skin
    col += subsurface;                          // ember well from below
    col += forgeLight;                          // the lone reflection

    // hold the very rim glassy-dark so the pool reads as still and contained
    col *= mix(0.7, 1.0, smoothstep(1.0, 0.7, vRad));

    gl_FragColor = vec4(col, 1.0);
  }
`

// ── basalt deck + Ogham rim ─────────────────────────────────────────────────
const rimVert = /* glsl */ `
  varying vec2 vUv;
  varying float vRad;
  varying vec3 vWorldPos;
  void main(){
    vUv = uv;
    vRad = uv.y; // ring geometry: uv.y runs inner(0)→outer(1)
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const rimFrag = /* glsl */ `
  precision highp float;
  uniform float uTime, uTemp, uHeat;
  varying vec2 vUv;
  varying float vRad;

  vec3 gw_tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    return c;
  }

  // hash for matte basalt micro-grain
  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  void main(){
    // dark green-black Irish basalt: void with the faintest cold-steel/green cast
    vec3 basalt = mix(${v3(PAL.void)}, ${v3(PAL.steel)}, 0.35);
    basalt += vec3(0.004, 0.012, 0.008); // whisper of green-black
    // matte grain
    float g = hash(floor(vUv * vec2(220.0, 30.0)));
    basalt *= 0.82 + g * 0.22;

    // ── OGHAM carving: strokes crossing a central spine line around the band ──
    // uv.x runs around the ring; the spine sits mid-band (vRad ~0.5).
    float around = vUv.x * ${OGHAM_TICKS.toFixed(1)};
    float cell = fract(around);
    float idx = floor(around);
    // pseudo-random Ogham group: 1–5 strokes, on one side / both / across the spine
    float kind = hash(vec2(idx, 7.0));
    // a thin stroke mark within the cell
    float stroke = smoothstep(0.46, 0.40, abs(cell - 0.5));
    // strokes only where the band is (carved channel), fading at rim edges
    float bandMask = smoothstep(0.12, 0.30, vRad) * smoothstep(0.92, 0.74, vRad);
    // which side of the spine: above, below, or across
    float spine = 0.5;
    float aboveSel = step(0.33, kind);
    float belowSel = step(0.66, kind) + step(kind, 0.33);
    float side =
        (vRad > spine ? aboveSel : 1.0) *
        (vRad < spine ? belowSel : 1.0);
    side = clamp(side, 0.0, 1.0);
    float ogham = stroke * bandMask * side;

    // the carved spine groove
    float spineLine = smoothstep(0.020, 0.0, abs(vRad - spine)) * 0.5;

    // carved channels read as shadow (recessed) with a faint inner ember catch
    float carve = max(ogham, spineLine);
    vec3 col = basalt * (1.0 - carve * 0.7);

    // the forge-light from the pool kisses the inner lip; embers pool in the deepest carving
    float innerLip = smoothstep(0.18, 0.0, vRad);
    float emberCatch = carve * (0.10 + uHeat * 0.45) + innerLip * (0.12 + uHeat * 0.4);
    col += gw_tempColor(0.34 + uTemp * 0.3 + uHeat * 0.25) * emberCatch * (0.9 + uHeat * 0.8);

    gl_FragColor = vec4(col, 1.0);
  }
`

export default function ScryingPool() {
  const waterUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.2 },
      uHeat: { value: 0 },
      uRipple: { value: 1 }, // 0 under reduced-motion (glassy still), 1 active
    }),
    []
  )
  const rimUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.2 },
      uHeat: { value: 0 },
    }),
    []
  )

  const tAcc = useRef(0)

  // water disc — circle geometry triangulated from centre, plenty for smooth radial waves
  const waterGeo = useMemo(
    () => new THREE.CircleGeometry(POOL_RADIUS, POOL_SEGS, 0, Math.PI * 2),
    []
  )
  // ring deck for the Ogham rim
  const rimGeo = useMemo(
    () => new THREE.RingGeometry(RIM_INNER, RIM_OUTER, 128, 1),
    []
  )

  useFrame((state, dt) => {
    const d = Math.min(1, dt || 0.016)
    // calmer chamber: the still pool slows its clock; reduced-motion freezes the ripples
    if (!forge.reduced) tAcc.current += d * (forge.still ? 0.5 : 1.0)
    const t = tAcc.current

    const targetRipple = forge.reduced ? 0 : 1

    // strike pulse → the chamber "speaks", ripples surge briefly
    const since = performance.now() / 1000 - forge.strikeAt
    const pulse = since >= 0 && since < 1.4 ? Math.exp(-since * 2.4) * 0.7 : 0
    const targetHeat = Math.min(forge.heat + pulse, 1)

    const w = waterUniforms
    w.uTime.value = t
    w.uTemp.value += (forge.temperature - w.uTemp.value) * d * 2.0
    w.uHeat.value += (targetHeat - w.uHeat.value) * d * 3.0
    w.uRipple.value += (targetRipple - w.uRipple.value) * d * 2.0

    const r = rimUniforms
    r.uTime.value = t
    r.uTemp.value = w.uTemp.value
    r.uHeat.value = w.uHeat.value
  })

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* CircleGeometry lies in XY; rotate the group so the pool lies flat in XZ */}
      {/* The Ogham basalt rim — sits a hair below the water lip */}
      <mesh geometry={rimGeo} position={[0, 0, 0.02]}>
        <shaderMaterial
          vertexShader={rimVert}
          fragmentShader={rimFrag}
          uniforms={rimUniforms}
        />
      </mesh>
      {/* The still water — dark mirror with the ember well beneath */}
      <mesh geometry={waterGeo}>
        <shaderMaterial
          vertexShader={waterVert}
          fragmentShader={waterFrag}
          uniforms={waterUniforms}
          transparent={false}
        />
      </mesh>
    </group>
  )
}
