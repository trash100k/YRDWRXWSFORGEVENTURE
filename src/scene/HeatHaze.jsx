import { forwardRef, useMemo, useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Effect } from 'postprocessing'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * HeatHaze — a screen-space heat-shimmer post effect for the GAELWORX forge.
 *
 * It runs inside the existing <EffectComposer> (after Bloom, before/around ToneMapping)
 * and warps the already-composited image with a small, animated UV refraction. The warp
 * is *masked to the hottest regions*: it samples scene luminance from the input buffer and
 * only shimmers where the metal is bright (the molten band), so cold void stays razor sharp.
 * The displacement also rises (heat rises) and is biased toward the warm ramp so the haze
 * reads as forge air, not a generic wobble. Driven by the shared forge temperature/heat so
 * the whole world breathes off one signal. Deliberately subtle — no seasickness.
 *
 * This is a refraction-only effect: it does NOT add radiance (bloom already owns glow). It
 * only bends light that is already there, which keeps it bloom-safe and cheap.
 *
 * Authored the @react-three/postprocessing way: an `Effect` subclass + a forwardRef wrapper
 * component, so it drops straight into <EffectComposer> like <Bloom/> or <Vignette/>.
 *
 * @typedef {Object} HeatHazeProps
 * @property {number} [strength=0.006]   Max UV displacement, in UV units (0.004–0.010 is tasteful).
 * @property {number} [scale=3.2]        Spatial frequency of the shimmer noise (higher = finer ripples).
 * @property {number} [speed=0.55]       Animation speed of the shimmer (the boil rate).
 * @property {number} [rise=1.0]         How much the haze drifts upward (heat rises). 0 = isotropic.
 * @property {number} [threshold=0.18]   Luminance below which there is NO haze (keeps the void crisp).
 * @property {number} [smoothing=0.55]   Soft ramp width above the threshold for the hot-region mask.
 * @property {number} [tempInfluence=1.0] How much forge.temperature/heat scales the effect (0 disables).
 * @property {import('postprocessing').BlendFunction} [blendFunction] Optional blend override.
 */

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform float uScale;
  uniform float uRise;
  uniform float uThreshold;
  uniform float uSmoothing;
  uniform float uHeat;        // combined forge temperature + transient heat, 0..~1.4
  uniform float uAspect;

  // ── shared noise basis (Ashima/Gustavson simplex) — same family the slab uses ──
  vec3 gw_permute(vec3 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float gw_snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = gw_permute(gw_permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
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

  // luminance of the already-composited frame — our hot-region key
  float gw_luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
    // aspect-correct the noise domain so ripples aren't stretched
    vec2 p = vec2(uv.x * uAspect, uv.y) * uScale;

    // two decorrelated noise fields → a smooth curl-ish displacement vector.
    // upward bias on the y-sample (heat rises): the field scrolls down so warp drifts up.
    float t = uTime;
    float nx = gw_snoise(p + vec2(0.0, -t * uRise) + vec2(13.1, 0.0));
    float ny = gw_snoise(p + vec2(0.0, -t * uRise) + vec2(0.0, 47.7));

    vec2 warp = vec2(nx, ny);
    // bias displacement upward so shimmer reads as rising forge air
    warp.y += uRise * 0.35;
    warp *= uStrength;

    // mask to the hottest regions: sample local brightness, ramp above threshold.
    float key = gw_luma(inputColor.rgb);
    float hotMask = smoothstep(uThreshold, uThreshold + uSmoothing, key);

    // global heat gate — the whole forge cools/heats off one signal
    float amount = hotMask * clamp(uHeat, 0.0, 1.4);

    // refract: read the composited buffer at the warped coordinate. Pure bend, no added light.
    vec2 wUv = clamp(uv + warp * amount, vec2(0.0), vec2(1.0));
    vec4 refr = texture2D(inputBuffer, wUv);

    // keep cold pixels pristine; only blend the warped read in over the hot band
    outputColor = mix(inputColor, refr, clamp(amount, 0.0, 1.0));
  }
`

class HeatHazeEffect extends Effect {
  constructor({
    strength = 0.006,
    scale = 3.2,
    speed = 0.55,
    rise = 1.0,
    threshold = 0.18,
    smoothing = 0.55,
    blendFunction,
  } = {}) {
    super('HeatHazeEffect', fragmentShader, {
      blendFunction,
      uniforms: new Map([
        ['uTime', new THREE.Uniform(0)],
        ['uStrength', new THREE.Uniform(strength)],
        ['uScale', new THREE.Uniform(scale)],
        ['uRise', new THREE.Uniform(rise)],
        ['uThreshold', new THREE.Uniform(threshold)],
        ['uSmoothing', new THREE.Uniform(smoothing)],
        ['uHeat', new THREE.Uniform(0)],
        ['uAspect', new THREE.Uniform(1)],
      ]),
    })

    this._speed = speed
    this._tempInfluence = 1.0
    this._tAcc = 0
    this._heatU = 0
  }

  // postprocessing calls this every frame with the real frame delta
  update(_renderer, _inputBuffer, deltaTime) {
    const dt = Math.min(0.05, deltaTime || 0.016)

    // boil-in-place clock; reduced-motion freezes it (same law as the slab)
    if (!forge.reduced) {
      this._tAcc += dt * this._speed * (forge.still ? 0.45 : 1.0)
    }
    this.uniforms.get('uTime').value = this._tAcc

    // strike pulse → transient heat surge (mirrors ForgeCanvas)
    const since = performance.now() / 1000 - forge.strikeAt
    const pulse = since >= 0 && since < 1.2 ? Math.exp(-since * 3) * 0.6 : 0

    // combine master temperature + transient heat + strike, then damp toward it
    const target =
      this._tempInfluence === 0
        ? 0
        : (0.12 + forge.temperature * 0.9 + Math.min(forge.heat + pulse, 1) * 0.35) *
          this._tempInfluence

    // under reduced-motion, pin to a calm steady value (no animated boil but still keyed)
    this._heatU += (target - this._heatU) * Math.min(1, dt * 2.4)
    this.uniforms.get('uHeat').value = forge.reduced ? Math.min(target, 0.35) : this._heatU
  }

  // keep the noise aspect-correct on resize
  setSize(width, height) {
    this.uniforms.get('uAspect').value = width / Math.max(1, height)
  }

  set tempInfluence(v) { this._tempInfluence = v }
  get tempInfluence() { return this._tempInfluence }
}

/**
 * <HeatHaze /> — drop into <EffectComposer> alongside <Bloom/>, <ToneMapping/>, <Vignette/>.
 * Place it AFTER <Bloom/> so the haze warps the bloomed, hot image (the molten band shimmers),
 * and it reads best just before <ToneMapping/>.
 *
 * @param {HeatHazeProps} props
 */
const HeatHaze = forwardRef(function HeatHaze(
  {
    strength = 0.006,
    scale = 3.2,
    speed = 0.55,
    rise = 1.0,
    threshold = 0.18,
    smoothing = 0.55,
    tempInfluence = 1.0,
    blendFunction,
  },
  ref
) {
  const size = useThree((s) => s.size)

  const effect = useMemo(
    () => new HeatHazeEffect({ strength, scale, speed, rise, threshold, smoothing, blendFunction }),
    // construct once; live values are pushed via the layout effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // push prop changes onto the live effect without rebuilding it
  useLayoutEffect(() => {
    const u = effect.uniforms
    u.get('uStrength').value = strength
    u.get('uScale').value = scale
    u.get('uRise').value = rise
    u.get('uThreshold').value = threshold
    u.get('uSmoothing').value = smoothing
    effect._speed = speed
    effect.tempInfluence = tempInfluence
  }, [effect, strength, scale, speed, rise, threshold, smoothing, tempInfluence])

  // keep aspect correct (Effect.setSize is also called by the composer, this covers r3f resizes)
  useLayoutEffect(() => {
    effect.setSize(size.width, size.height)
  }, [effect, size.width, size.height])

  // dispose the GLSL program on unmount
  useLayoutEffect(() => () => effect.dispose(), [effect])

  return <primitive ref={ref} object={effect} dispose={null} />
})

export default HeatHaze
export { HeatHazeEffect }
