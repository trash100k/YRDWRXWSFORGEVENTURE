import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * basalt.js — the BASALT MATERIAL factory + carved-OGHAM relief helper for the GAELWORX
 * forge world. Dark green-black Irish basalt: a near-void slab that drinks light and only
 * reveals its serpentine green where the molten metal (or the A/E divine fire) actually
 * strikes it. Matte, micro-grained, ominous, sacred. This is the stone of the channel
 * walls, the altar, the plinths, the scrying-pool rim.
 *
 * This is a MODULE, not a component — it exports plain functions you attach to any mesh.
 *
 * Design law it obeys (CLAUDE.md):
 *  - "the metal is the ONLY light" — albedo is crushed to void; serpentine green emerges
 *    from the lit term, so unlit basalt vanishes into the pure-void darkness.
 *  - one noise basis, one palette (PAL via v3()), no raw hex, no EXR.
 *  - carved Ogham/knotwork stays nearly invisible in shadow and becomes LEGIBLE only under
 *    strong raking light (the divine A/E), via a relief/parallax look in onBeforeCompile.
 *  - emissive stays modest here (stone is not a light source) — the shared bloom is for the
 *    metal; basalt only catches a faint serpentine self-glow in the hottest creases.
 *
 * Because it builds on MeshStandardMaterial, it lights correctly off the scene's emissive
 * metal / point lights and runs through the shared ACES+bloom composer untouched.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  USAGE
 * ─────────────────────────────────────────────────────────────────────────────
 *   import { makeBasaltMaterial, applyOghamRelief, registerBasaltTick } from './basalt.js'
 *
 *   // once, near your scene root (drives the subtle shimmer + heat reveal):
 *   useFrame((_, dt) => registerBasaltTick(dt))
 *
 *   const wall = makeBasaltMaterial({ grain: 1.0, serpentine: 0.9 })
 *   applyOghamRelief(wall, { strength: 1.0, scale: 2.0, mode: 'ogham' })
 *   <mesh geometry={wallGeo} material={wall} />
 *
 * Dispose the materials yourself on unmount (material.dispose()).
 */

/* ── shared noise + helpers, injected once per material ─────────────────────── */
const BASALT_CHUNK = /* glsl */ `
  // hash / value-noise / fbm — the ONE noise basis (cheap, mobile-affordable)
  float gw_hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float gw_vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = gw_hash(i), b = gw_hash(i + vec2(1.0, 0.0));
    float c = gw_hash(i + vec2(0.0, 1.0)), d = gw_hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float gw_fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++){ v += a * gw_vnoise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  // ── carved-relief fields ───────────────────────────────────────────────────
  // Ogham: a vertical stem with perpendicular ticks (the ancient tree-alphabet).
  // Returns a signed "depth" in [-1,1]; 0 = flat stone, negative = carved into stone.
  float gw_ogham(vec2 uv){
    float stem = 1.0 - smoothstep(0.012, 0.05, abs(uv.x - 0.5));     // central spine
    float row  = fract(uv.y * 9.0);
    float tick = (1.0 - smoothstep(0.06, 0.12, abs(row - 0.5)))      // a tick band
               * smoothstep(0.12, 0.18, abs(uv.x - 0.5))             // off the spine
               * (1.0 - smoothstep(0.30, 0.40, abs(uv.x - 0.5)));    // not too wide
    float groove = clamp(stem + tick, 0.0, 1.0);
    return -groove;                                                   // carved IN
  }
  // Knotwork: woven over/under bands — a soft interlace relief.
  float gw_knot(vec2 uv){
    vec2 q = uv * 6.2831853;
    float a = sin(q.x + sin(q.y * 1.0)) ;
    float b = sin(q.y + sin(q.x * 1.0));
    float weave = (a * b);                                            // ridge/valley lattice
    return clamp(weave * 0.5, -1.0, 1.0) * 0.7;
  }
`

/* one shared uniform bag so registerBasaltTick drives every basalt material at once */
const SHARED = {
  uTime: { value: 0 },
  uTemp: { value: forge.temperature }, // damped serpentine-reveal / heat
}

/* every material we mint, so the tick can refresh their (cloned) uniforms */
const REGISTRY = new Set()

/**
 * registerBasaltTick(dt) — call ONCE per frame from a useFrame anywhere in the scene.
 * Advances the shared time and damps the heat toward forge.temperature (dt-damped, the
 * house style). Respects forge.reduced by freezing the shimmer (heat still reveals).
 * @param {number} dt seconds since last frame
 */
export function registerBasaltTick(dt) {
  const step = Math.min(1, (dt || 0.016) * 2)
  if (!forge.reduced) SHARED.uTime.value += dt || 0.016
  SHARED.uTemp.value += (forge.temperature - SHARED.uTemp.value) * step
  // fan the shared values out to each material's own uniform objects
  for (const u of REGISTRY) {
    u.uTime.value = SHARED.uTime.value
    u.uTemp.value = SHARED.uTemp.value
  }
}

/**
 * makeBasaltMaterial(opts) — mint a dark green-black Irish basalt MeshStandardMaterial.
 * Near-void albedo + matte (high roughness, zero metalness). Serpentine green is mixed in
 * by how strongly the surface is LIT, so unlit stone sinks into the void; micro-grain noise
 * breaks up the flatness. Lights correctly and passes through the shared composer.
 *
 * @param {object}  [opts]
 * @param {number}  [opts.grain=1.0]       micro-grain noise intensity (0 smooth..1.5 coarse)
 * @param {number}  [opts.grainScale=42]   noise frequency (higher = finer grain)
 * @param {number}  [opts.serpentine=0.9]  how much green emerges where lit (0..1)
 * @param {number}  [opts.roughness=0.92]  surface roughness (matte basalt is high)
 * @param {number}  [opts.darkness=1.0]    albedo crush toward void (1 = full void-black base)
 * @param {string}  [opts.base]            base albedo hex (default PAL.void)
 * @param {string}  [opts.green]           serpentine hex (default a green-black blend)
 * @param {number}  [opts.shimmer=0.06]    faint creep of serpentine glow in lit creases (0..0.2)
 * @returns {THREE.MeshStandardMaterial} the basalt material (dispose it yourself)
 */
export function makeBasaltMaterial(opts = {}) {
  const {
    grain = 1.25,
    grainScale = 42.0,
    serpentine = 0.62,
    roughness = 0.96,
    darkness = 1.0,
    base = PAL.void,
    green = '#0A1712', // serpentine green-black (Irish basalt under the lamp) — darker
    shimmer = 0.03,
  } = opts

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(base),
    roughness: THREE.MathUtils.clamp(roughness, 0.04, 1.0),
    metalness: 0.0,
    // a faint serpentine emissive so the hottest creases breathe under bloom (kept <1)
    emissive: new THREE.Color(green),
    emissiveIntensity: 0.0, // raised in-shader by lit-amount; this keeps drei happy
    dithering: true,
  })

  // per-material uniforms (clone the shared bag so each has its own objects to drive)
  const u = {
    uTime: { value: SHARED.uTime.value },
    uTemp: { value: SHARED.uTemp.value },
    uGrain: { value: grain },
    uGrainScale: { value: grainScale },
    uSerp: { value: THREE.MathUtils.clamp(serpentine, 0.0, 1.0) },
    uDark: { value: THREE.MathUtils.clamp(darkness, 0.0, 1.0) },
    uShimmer: { value: THREE.MathUtils.clamp(shimmer, 0.0, 0.4) },
    uGreen: { value: new THREE.Color(green) },
  }

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)

    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${BASALT_CHUNK}\n
        uniform float uTime, uTemp, uGrain, uGrainScale, uSerp, uDark, uShimmer;
        uniform vec3  uGreen;
        void main() {`)
      // crush albedo to void + micro-grain BEFORE lighting accumulates
      .replace('#include <map_fragment>', /* glsl */ `
        #include <map_fragment>
        {
          vec2 gv = vMapUv.xy;            // basalt UV (relief helper also reads this)
          float gr = gw_fbm(gv * uGrainScale) - 0.5;
          // matte micro-grain darkens albedo unevenly; crush toward pure void
          vec3 voidC = ${v3(PAL.void)};
          diffuseColor.rgb = mix(diffuseColor.rgb, voidC, uDark * 0.85);
          diffuseColor.rgb *= (1.0 + gr * 0.22 * uGrain);
          diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.0));
        }
      `)
      // roughen the creases so the grain catches raking light (after roughnessmap)
      .replace('#include <roughnessmap_fragment>', /* glsl */ `
        #include <roughnessmap_fragment>
        {
          float gr2 = gw_fbm(vMapUv.xy * uGrainScale * 0.5);
          roughnessFactor = clamp(roughnessFactor + (gr2 - 0.5) * 0.18 * uGrain, 0.25, 1.0);
        }
      `)
      // AFTER lighting: reveal serpentine green only where actually lit; faint hot-crease glow
      .replace('#include <opaque_fragment>', /* glsl */ `
        {
          // how strongly this fragment is lit by the forge metal (its own light)
          float lit = clamp(dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.333)), 0.0, 1.5);
          float reveal = smoothstep(0.02, 0.45, lit) * uSerp;
          // serpentine emerges in the LIT zone — unlit stone stays void
          vec3 serp = uGreen * (1.4 + uTemp * 0.6);
          outgoingLight = mix(outgoingLight, max(outgoingLight, serp * reveal), reveal);
          // faint self-glow in the hottest, most-lit creases (kept modest; not a light source)
          float crease = gw_fbm(vMapUv.xy * uGrainScale * 0.5 + uTime * 0.05);
          outgoingLight += uGreen * uShimmer * reveal * (0.5 + crease) * (0.6 + uTemp);
        }
        #include <opaque_fragment>
      `)

    mat.userData.shader = shader
  }

  // ensure vMapUv exists even with no map: force the map UV varying on
  mat.defines = { ...(mat.defines || {}), USE_UV: '', USE_MAP: '' }
  // a 1x1 white map so map_fragment runs and vMapUv is valid (no texture fetch cost)
  mat.map = WHITE_PIXEL()

  REGISTRY.add(u)
  // when disposed, drop it from the tick registry
  const _dispose = mat.dispose.bind(mat)
  mat.dispose = () => { REGISTRY.delete(u); _dispose() }

  return mat
}

/**
 * applyOghamRelief(material, opts) — carve Ogham strokes and/or Celtic knotwork into a
 * basalt material as a RELIEF look. It perturbs the surface normal (a bump/normal-relief
 * derived from the carved-depth field) so the grooves stay nearly invisible in shadow and
 * snap into LEGIBLE relief under strong raking light — exactly the divine A/E moment.
 *
 * Works on any material made by makeBasaltMaterial (and any MeshStandardMaterial). Reuses
 * the same map UV, so tile your geometry UVs to control glyph density.
 *
 * @param {THREE.Material} material           a basalt (or standard) material to carve
 * @param {object}         [opts]
 * @param {number}         [opts.strength=1.0]  relief depth (0 flat .. 2 deep)
 * @param {number}         [opts.scale=2.0]     glyph tiling across the UV (rows of Ogham)
 * @param {'ogham'|'knot'|'both'} [opts.mode='ogham']  which carving to apply
 * @param {number}         [opts.darkenInGroove=0.6]  how much the carved valleys drink light
 * @returns {THREE.Material} the same material (chained onBeforeCompile)
 */
export function applyOghamRelief(material, opts = {}) {
  const {
    strength = 1.0,
    scale = 2.0,
    mode = 'ogham',
    darkenInGroove = 0.6,
  } = opts

  const modeId = mode === 'both' ? 2 : mode === 'knot' ? 1 : 0
  const ru = {
    uReliefStrength: { value: THREE.MathUtils.clamp(strength, 0.0, 3.0) },
    uReliefScale: { value: scale },
    uReliefMode: { value: modeId },
    uReliefDark: { value: THREE.MathUtils.clamp(darkenInGroove, 0.0, 1.0) },
  }

  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader) => {
    if (prev) prev(shader)
    Object.assign(shader.uniforms, ru)

    // declare relief uniforms + a sampler for the carved-depth field
    if (!/uReliefStrength/.test(shader.fragmentShader)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        /* glsl */ `
        uniform float uReliefStrength, uReliefScale, uReliefDark;
        uniform int uReliefMode;
        // sample the carved-depth field at a UV (chooses ogham / knot / both)
        float gw_relief(vec2 uv){
          vec2 ruv = uv * uReliefScale;
          float d = 0.0;
          if (uReliefMode == 0) d = gw_ogham(fract(ruv));
          else if (uReliefMode == 1) d = gw_knot(ruv);
          else d = min(gw_ogham(fract(ruv)), gw_knot(ruv));
          return d; // [-1,0]: carved into the stone
        }
        void main() {`
      )
    }

    // ensure the basalt noise chunk exists even if used standalone on a plain material
    if (!/gw_fbm/.test(shader.fragmentShader)) {
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', `${BASALT_CHUNK}\nvoid main() {`)
    }

    // perturb the geometric normal from the relief height field (finite-difference bump),
    // BEFORE the lighting normal is finalized, so the grooves catch raking light.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `
        #include <normal_fragment_maps>
        {
          vec2 ruv = vMapUv.xy;
          float e = 0.0015;
          float hC = gw_relief(ruv);
          float hX = gw_relief(ruv + vec2(e, 0.0));
          float hY = gw_relief(ruv + vec2(0.0, e));
          // perturb along a basis ORTHOGONAL to the surface normal — constant world axes
          // degenerate on faces whose normal is ±x/±y (exactly the prism wall faces)
          vec3 gwT1 = normalize(cross(normal, vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
          vec3 gwT2 = cross(normal, gwT1);
          normal = normalize(normal + (hC - hX) * 4.0 * uReliefStrength * gwT1
                                    + (hC - hY) * 4.0 * uReliefStrength * gwT2);
        }
      `
    )

    // valleys of the carving drink a touch more light (deepen the cut in shadow)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
        #include <map_fragment>
        {
          float groove = -gw_relief(vMapUv.xy); // 0 flat .. 1 deep cut
          diffuseColor.rgb *= (1.0 - groove * uReliefDark * 0.7);
        }
      `
    )

    material.userData.reliefShader = shader
  }

  // make sure UVs/map plumbing is present (in case used on a bare standard material)
  material.defines = { ...(material.defines || {}), USE_UV: '', USE_MAP: '' }
  if (!material.map) material.map = WHITE_PIXEL()
  material.needsUpdate = true

  return material
}

/**
 * applyInstancedUvOffset(material) — for basalt on an InstancedMesh: each instance carries an
 * `iUvOff` InstancedBufferAttribute(vec2) that shifts vMapUv, so every column samples a DIFFERENT
 * slice of the carved/grain field (no two prisms repeat). Chains onBeforeCompile (vertex-side
 * only; the basalt fragment patches are untouched, so all variants share one program).
 *
 * @param {THREE.Material} material  a basalt (or standard) material used on an InstancedMesh
 * @returns {THREE.Material} the same material
 */
export function applyInstancedUvOffset(material) {
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader) => {
    if (prev) prev(shader)
    if (!/iUvOff/.test(shader.vertexShader)) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', 'attribute vec2 iUvOff;\n#include <common>')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv += iUvOff;')
    }
  }
  material.needsUpdate = true
  return material
}

/* ── tiny shared 1x1 white texture so map_fragment runs (gives us vMapUv, no fetch) ── */
let _white = null
function WHITE_PIXEL() {
  if (_white) return _white
  const data = new Uint8Array([255, 255, 255, 255])
  _white = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
  _white.needsUpdate = true
  return _white
}

/**
 * basaltUniforms — escape hatch: the shared uniform bag, if a caller wants to read the
 * current damped time/heat (e.g. to sync another effect to the basalt's reveal).
 */
export const basaltUniforms = SHARED
