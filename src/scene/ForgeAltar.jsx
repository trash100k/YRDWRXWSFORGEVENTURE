import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ForgeAltar — THE ALTAR. The raised, stepped basalt forge-altar that is the SOURCE of
 * the pour; it sits at the TOP of the journey, ancient and sacred. A blocky stepped
 * dark-basalt plinth: every face hints carved Celtic interlace (procedural emissive
 * relief that warms with the forge's temperature), a molten pool glows and boils on the
 * top surface (emissive >1.0 → the shared bloom catches it), and heat shimmer rises off
 * the metal above. One temperature signal, one noise basis, brand palette only.
 *
 * Renders INSIDE the existing <Canvas>. Self-contained: drop it in and place it.
 *
 * @typedef {Object} ForgeAltarProps
 * @property {[number,number,number]} [position=[0,0,0]] World position of the altar base centre.
 * @property {number} [scale=1] Uniform scale of the whole altar assembly.
 * @property {[number,number,number]} [rotation=[0,0,0]] Euler rotation (radians).
 * @property {number} [poolTemp=0.92] Local temperature floor for the molten pool (0..1);
 *   the altar is the source, so its metal stays hot regardless of scroll. Master
 *   forge.temperature still modulates the carved relief + glow.
 */

/* ── shared noise + the master temperature ramp (one basis, brand-anchored) ── */
const COMMON = /* glsl */ `
  precision highp float;
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
    float val = 0.0, a = 0.55; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) { val += a * (snoise(p) * 0.5 + 0.5); p = m * p + 0.031; a *= 0.5; }
    return val;
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
  float gw_em(float t){ t = clamp(t, 0.0, 1.0); return pow(t, 3.0) * 2.6 + t * 0.12; }
`

/* ── BASALT FACES — dark Irish basalt with procedural Celtic-interlace relief that
   glows from within as the forge heats. Three.js box uv repeats per-face, so the knot
   tiles cleanly on every side. The interlace is the classic two-direction over/under
   weave built from offset sine bands; valleys carry molten light. ── */
const basaltVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWP;
  void main(){
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const basaltFrag = /* glsl */ `
  ${COMMON}
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWP;
  uniform float uTime, uTemp, uHeat;
  uniform vec2  uTile;   // knot repeats across this face
  uniform float uTopGlow; // 0..1 extra warmth on faces near the molten top

  // one strand of the interlace: a soft band travelling along an axis, woven over/under
  float strand(vec2 p, float phase){
    float band = sin((p.x + p.y) * 3.14159 + phase);
    return smoothstep(0.55, 0.0, abs(band) - 0.18); // 1 on the strand ridge
  }

  void main(){
    vec2 uv = fract(vUv * uTile);
    vec2 cp = uv * 6.2831853; // cell coords for the weave

    // two crossing strand directions form the basket-weave knot
    float s1 = strand(vec2(cp.x, cp.y), 0.0);
    float s2 = strand(vec2(cp.x, -cp.y), 1.5707963);
    // over/under: alternate which strand wins per cell (the interlace trick)
    float weaveSel = step(0.5, fract((floor(vUv.x * uTile.x) + floor(vUv.y * uTile.y)) * 0.5));
    float overUnder = mix(s1, s2, weaveSel);
    float knot = max(max(s1, s2) * 0.55, overUnder);

    // carved valleys (between strands) trap the molten light; ridges stay cold stone
    float groove = 1.0 - knot;

    // basalt body: dark green-black, fine grain + micro-fracture
    float grain = fbm(vUv * uTile * 9.0 + 11.0);
    vec3 basalt = mix(${v3(PAL.void)}, ${v3(PAL.steel)}, 0.32 + grain * 0.22);
    basalt *= 0.36 + grain * 0.18;
    // a whisper of green-black (cool the steel toward void-green)
    basalt.g *= 1.06;

    // the interlace glows from the grooves — warms with master temperature + the hot top
    float warm = clamp(uTemp * 0.7 + uHeat * 0.35 + uTopGlow * 0.5, 0.0, 1.0);
    float pulse = 0.78 + 0.22 * sin(uTime * 1.3 + (vUv.x + vUv.y) * uTile.x);
    float chan = pow(groove, 1.6) * (0.18 + warm * 0.95) * pulse;
    vec3 glow = gw_tempColor(0.34 + warm * 0.5) * gw_em(0.34 + warm * 0.5) * chan;

    // faint top-down forge spill so the upper faces read lit by the pour above them
    float spill = smoothstep(-0.2, 1.0, vN.y) * uTopGlow * 0.4;
    glow += gw_tempColor(0.5) * gw_em(0.45) * spill * 0.12;

    // edge AO: cell borders darken so the blocks read carved, not painted
    float ao = smoothstep(0.0, 0.12, min(uv.x, min(uv.y, min(1.0 - uv.x, 1.0 - uv.y))));
    vec3 col = basalt * (0.5 + ao * 0.5) + glow;

    gl_FragColor = vec4(col, 1.0);
  }
`

/* ── MOLTEN POOL — the boiling metal in the altar's basin. Emissive >1.0 so the shared
   bloom blooms it. Two-octave warped flow + a hot rim where it meets the stone. ── */
const poolFrag = /* glsl */ `
  ${COMMON}
  varying vec2 vUv;
  uniform float uTime, uTemp, uHeat, uPoolTemp;

  void main(){
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * 2.0;
    float rad = length(p);
    if (rad > 1.0) discard; // circular basin

    // domain-warped boil (no scrolling coords — it churns in place)
    float t = uTime * 0.12;
    vec2 q = vec2(fbm(uv * 3.0 + vec2(0.0, t)), fbm(uv * 3.0 + vec2(4.3, 1.7) - t));
    float f = fbm(uv * 3.0 + 1.8 * q + t * 0.4);

    // local pool temperature: the altar is the SOURCE, so it stays hot; master temp + strike lift it
    float base = max(uPoolTemp, 0.55 + uTemp * 0.4) + uHeat * 0.18;
    float temp = clamp(base * (0.7 + f * 0.55), 0.0, 1.0);

    // crust skin: cooler dark islands that drift and crack open to white-hot
    float crust = smoothstep(0.46, 0.62, fbm(uv * 5.0 + q * 1.2 - t * 0.6));
    temp *= mix(1.0, 0.42, crust);

    // blistering hot rim where metal kisses the stone lip
    float rim = smoothstep(0.78, 1.0, rad);
    temp = mix(temp, min(temp + 0.22, 1.0), rim);

    vec3 col = gw_tempColor(temp) * gw_em(temp);
    // slight darkening into the very centre so it reads as depth, not a flat disc
    col *= 0.82 + 0.18 * smoothstep(0.0, 0.6, rad);

    gl_FragColor = vec4(col, 1.0);
  }
`

/* ── HEAT SHIMMER — a thin additive veil rising off the pool. Refractive-look ripple
   that fades upward; pure heat distortion, no hard edges. Skipped under reduced motion. ── */
const shimmerFrag = /* glsl */ `
  ${COMMON}
  varying vec2 vUv;
  uniform float uTime, uTemp, uHeat;

  void main(){
    vec2 uv = vUv;
    // rising warble — cells lift with time, wobble horizontally
    float lift = uv.y - uTime * 0.18;
    float n = fbm(vec2(uv.x * 6.0 + sin(lift * 8.0) * 0.4, lift * 4.0));
    float ripple = pow(n, 2.0);

    // fade: strongest just above the metal, gone by the top; pinch the sides
    float vert = smoothstep(0.0, 0.12, uv.y) * (1.0 - smoothstep(0.45, 1.0, uv.y));
    float horiz = 1.0 - smoothstep(0.32, 0.5, abs(uv.x - 0.5));
    float a = ripple * vert * horiz;

    float warm = clamp(0.45 + uTemp * 0.5 + uHeat * 0.3, 0.0, 1.0);
    vec3 col = gw_tempColor(warm) * gw_em(warm * 0.7);
    gl_FragColor = vec4(col, a * (0.10 + warm * 0.16));
  }
`

export default function ForgeAltar({
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0],
  poolTemp = 0.92,
}) {
  // ── geometry: a blocky stepped plinth. Three boxes, widest at the base, narrowing
  // up, capped by the basin rim. Modest tri-count; reused basalt material on all. ──
  const steps = useMemo(
    () => [
      { size: [3.4, 0.9, 3.4], y: 0.45, tile: [4, 1] },   // base course
      { size: [2.6, 0.8, 2.6], y: 1.30, tile: [3, 1] },   // mid course
      { size: [1.9, 0.7, 1.9], y: 2.05, tile: [2.5, 1] }, // upper course (basin block)
    ],
    []
  )

  const basaltUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.16 },
      uHeat: { value: 0 },
      uTile: { value: new THREE.Vector2(3, 1) },
      uTopGlow: { value: 0 },
    }),
    []
  )

  // one material per step so each can carry its own tiling + top-glow falloff
  const stepMats = useMemo(
    () =>
      steps.map((s, i) => ({
        uTime: { value: 0 },
        uTemp: { value: 0.16 },
        uHeat: { value: 0 },
        uTile: { value: new THREE.Vector2(s.tile[0], s.tile[1]) },
        uTopGlow: { value: i / (steps.length - 1) }, // upper blocks catch more pour-light
      })),
    [steps]
  )

  const poolUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.16 },
      uHeat: { value: 0 },
      uPoolTemp: { value: poolTemp },
    }),
    [poolTemp]
  )

  const shimmerUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uTemp: { value: 0.16 }, uHeat: { value: 0 } }),
    []
  )

  const tAcc = useRef(0)
  const shimmerRef = useRef()

  useFrame((state, dt) => {
    const d = Math.min(1, dt || 0.016)
    // boil in place; calmer altar chamber slows the clock, reduced-motion freezes it
    if (!forge.reduced) tAcc.current += d * (forge.still ? 0.4 : 1.0)
    const time = tAcc.current

    // strike pulse → transient heat (mirrors the shared driver)
    const since = performance.now() / 1000 - forge.strikeAt
    const pulse = since >= 0 && since < 1.2 ? Math.exp(-since * 3) * 0.6 : 0
    const targetHeat = Math.min(forge.heat + pulse, 1)

    for (const u of stepMats) {
      u.uTime.value = time
      u.uTemp.value += (forge.temperature - u.uTemp.value) * d * 2.2
      u.uHeat.value += (targetHeat - u.uHeat.value) * d * 3.0
    }
    poolUniforms.uTime.value = time
    poolUniforms.uTemp.value += (forge.temperature - poolUniforms.uTemp.value) * d * 2.2
    poolUniforms.uHeat.value += (targetHeat - poolUniforms.uHeat.value) * d * 3.0

    shimmerUniforms.uTime.value = time
    shimmerUniforms.uTemp.value += (forge.temperature - shimmerUniforms.uTemp.value) * d * 2.2
    shimmerUniforms.uHeat.value += (targetHeat - shimmerUniforms.uHeat.value) * d * 3.0

    // shimmer veil always faces the camera (billboard) so it reads from any approach
    if (shimmerRef.current) shimmerRef.current.quaternion.copy(state.camera.quaternion)
  })

  const topY = 2.05 + 0.35 // top surface of the upper basin block
  const poolY = topY + 0.005

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* stepped basalt plinth — carved Celtic interlace on every face */}
      {steps.map((s, i) => (
        <mesh key={i} position={[0, s.y, 0]} castShadow={false} receiveShadow={false}>
          <boxGeometry args={s.size} />
          <shaderMaterial
            vertexShader={basaltVert}
            fragmentShader={basaltFrag}
            uniforms={stepMats[i]}
          />
        </mesh>
      ))}

      {/* the molten pool — boiling metal in the basin. Emissive >1 → blooms. */}
      <mesh position={[0, poolY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.78, 48]} />
        <shaderMaterial
          vertexShader={/* glsl */ `
            varying vec2 vUv;
            void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
          `}
          fragmentShader={poolFrag}
          uniforms={poolUniforms}
          toneMapped={false}
        />
      </mesh>

      {/* a hot point light let the pool spill real radiance onto nearby geometry */}
      <pointLight
        position={[0, topY + 0.5, 0]}
        color={PAL.ember}
        intensity={2.2}
        distance={7}
        decay={2}
      />

      {/* heat shimmer rising off the metal — additive billboard, reduced-motion safe */}
      {!forge.reduced && (
        <mesh ref={shimmerRef} position={[0, topY + 1.15, 0]}>
          <planeGeometry args={[2.0, 2.4]} />
          <shaderMaterial
            vertexShader={/* glsl */ `
              varying vec2 vUv;
              void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
            `}
            fragmentShader={shimmerFrag}
            uniforms={shimmerUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  )
}
