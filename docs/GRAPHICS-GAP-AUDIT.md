# WHY IT READS PS1 — the stack-hole audit (2026-07-02)

Owner question: *"look up the necessary holes in our stack as to why we keep producing PS1
graphics instead of avatar masterpieces… what code language, what shader, what anything are we
missing."*

Audited facts of THIS repo (not vibes): three **0.171** · r3f **8.17** · drei **9.114** ·
postprocessing **6.36** · assets = **2 jpg** (knotwork) · **0 PBR map sets · 0 GLB models ·
0 HDRI/IBL · 0 AO · 0 reflections · 0 volumetrics · 0 AA** · hero surfaces = **unlit
`ShaderMaterial` paint on flat `PlaneGeometry`** · post = dual Bloom + CA + ACES + grain.

**The one-sentence answer:** we paint light instead of computing it, on surfaces with no
micro-detail and no real relief, with no occlusion/reflection/volume to ground anything, on a
2024-era three.js — each alone is survivable; stacked, they read exactly like PS1.

---

## HOLE 1 — No lighting model (the #1 cause)
Everything big (floor, molten, letters) is an **unlit ShaderMaterial**: color is *painted*, so
stone never responds to the molten beside it. Real scenes read "lit" because of **IBL + AO + local
lights**, not emissive paint.

**Fix (drop-in, this stack):**
- Convert hero surfaces to `MeshStandardMaterial`/`MeshPhysicalMaterial` **keeping our look via
  injection** — either `onBeforeCompile` (house pattern, see `shader-fx` skill) or
  **three-custom-shader-material** (cleaner API, active 2026):
  https://github.com/FarazzShaikh/THREE-CustomShaderMaterial
  ```jsx
  import CustomShaderMaterial from 'three-custom-shader-material'
  <mesh>
    <planeGeometry args={[w, l, 256, 512]} />
    <CustomShaderMaterial
      baseMaterial={THREE.MeshStandardMaterial}
      roughness={0.92} metalness={0.04}
      vertexShader={displaceVert}      // csm_Position (real relief, HOLE 3)
      fragmentShader={moltenFrag}      // csm_DiffuseColor / csm_Emissive (our molten stays)
      uniforms={u}
    />
  </mesh>
  ```
  Our molten becomes `csm_Emissive` (HDR >1 → bloom contract intact); the stone becomes *lit*.
- **Environment (IBL) without runtime EXR** (house scar): use **gain-map HDRIs** (HDR packed in
  jpg) — `@monogrid/gainmap-js`, supported by drei `<Environment files="*.jpg">`; or bundled
  presets via `@pmndrs/assets`; or keep the pure-code route: drei `<Lightformer>` rig (warm key
  above the molten + vast dark dome). https://github.com/MONOGRID/gainmap-js ·
  https://github.com/pmndrs/assets
- 2–3 **PointLights riding the molten** (pooled/reused, not per-segment) so the channel actually
  throws light on the flanking stone + copy.

## HOLE 2 — No surface micro-detail (the "plastic" tell)
Zero normal/roughness/AO maps; 3–4-octave fbm reads smooth at every distance.

**Fix:**
- **PBR basalt/rock sets** (CC0): Poly Haven https://polyhaven.com/textures (e.g. columned basalt,
  cliff rock) or ambientCG https://ambientcg.com — albedo+normal+rough+AO(+disp).
- **Compress to KTX2/BasisU** (GPU-native, small):
  `npx gltf-transform etc1s in.glb out.glb` for models, or `toktx --genmipmap --t2 --encode etc1s`
  per texture; load via `KTX2Loader` (three includes it; drei `useKTX2`).
- **Triplanar mapping** on the shaft/rock (no UV seams) — lygia has a drop-in:
  https://lygia.xyz (`sample/triplanar.glsl`), or 12-line classic (blend by |normal| powers).
- **Detail-normal trick:** macro fbm (ours) *plus* a tiling 2k normal map at 8–12× repeat —
  this one change kills most of the plastic.

## HOLE 3 — No real relief (flat planes cosplaying as carved stone)
The "carved channel" is a fragment painting on ONE flat quad — any grazing camera angle exposes
zero parallax, zero silhouette. PS1 in one sentence.

**Fix (three tiers, cheapest first):**
1. **Vertex displacement + recomputed normals** on a high-seg plane (256×512 verts ≈ free on
   2026 GPUs): displace the groove profile + hex joints in `csm_Position`, normals via
   neighbor-sample or `computeVertexNormals` for static.
2. **Parallax Occlusion Mapping** for the knotwork engraving (deep relief from a heightmap
   without geometry): canonical impl https://learnopengl.com/Advanced-Lighting/Parallax-Mapping
   — port into the fragment (16–32 steps, grazing-angle fade). Our
   `public/textures/knotwork-relief.jpg` is ALREADY the heightmap for this.
3. **Real meshes for heroes:** the cast letters must be **extruded 3D glyphs** —
   `TextGeometry` (three/examples, needs typeface.json via https://gero3.github.io/facetype.js/
   from Cinzel Decorative 900) with `bevelEnabled` — molten fill + divine A/E as CSM emissive on
   REAL depth letterforms that can "break from the mold." Crucible/arches/plinths → GLB
   (Meshy/Tripo image→3D pipeline we validated, or Poly Haven models), decimated + draco'd.

## HOLE 4 — Nothing occludes, nothing reflects
No AO → props float. No reflections → molten doesn't exist in the stone's world.

**Fix (verified drop-ins for our postprocessing stack):**
- **N8AO** (fast, artist-friendly SSAO): https://github.com/N8python/n8ao
  ```js
  import { N8AOPostPass } from 'n8ao'
  composer.addPass(new N8AOPostPass(scene, camera, w, h))  // r3f: wrap in <primitive> inside EffectComposer
  // aoRadius 2.0 · distanceFalloff 0.4 · intensity 3 · screenSpaceRadius for big scenes
  ```
- **realism-effects** (SSGI/SSR/TRAA/MotionBlur/HBAO): https://github.com/0beqz/realism-effects
  ```js
  import { SSGIEffect, TRAAEffect, VelocityDepthNormalPass } from 'realism-effects'
  const v = new VelocityDepthNormalPass(scene, camera); composer.addPass(v)
  composer.addPass(new EffectPass(camera, new SSGIEffect(composer, scene, camera, { velocityDepthNormalPass: v })))
  ```
  SSGI makes the molten *bleed light onto the basalt for free* (it treats emissive as a light
  source) — the single biggest "avatar" jump available to us. Quality-gate to `high` tier.
- drei `<ContactShadows>` under plinths/cauldron for grounded props.

## HOLE 5 — No volumetrics, weak atmosphere
Heat-haze is a screen wiggle; no god rays; embers are naked gl_Points.

**Fix:**
- **God rays** through the shaft and over the pour: postprocessing `GodRays` (needs an emissive sun
  mesh — the molten mouth disc qualifies) or https://github.com/DefinitelyMaybe/three-good-godrays
  (screen-space, depth-aware); cheap fallback: 3–4 additive gradient cones (classic trick).
- **Soft particles**: textured sprite atlas + depth-fade (soft-particle shader), or
  **three.quarks** (GPU, 2026-active, batching): https://github.com/Alchemist0823/three.quarks —
  sparks with stretch-billboards, smoke wisps, mote dust in the light shafts.
- Height fog: `FogExp2` reads wrong for us; use a custom depth-based floor haze in the grade.

## HOLE 6 — No anti-aliasing at all
`antialias:false` + no SMAA/TRAA pass = crawling jaggies on every molten edge. Instant retro.

**Fix:** postprocessing `SMAAEffect` (cheap, one line) now; **TRAA** (realism-effects) at high
tier — temporal AA is what makes offline-render smoothness. This is disproportionate value for
one line of code.

## HOLE 7 — The 2024 engine (language/pipeline question answered)
three **0.171 / r3f 8 / drei 9** predates the TSL era. 2026 reality: **three r184 ships TSL
(Three Shading Language) first-class**; **WebGPURenderer** covers ~95% of users **with automatic
WebGL2 fallback**; r3f **v9** supports it via the `gl` factory. TSL compiles to **WGSL + GLSL**
from one JS-composable source — and node materials (the modern material graph) only run on
WebGPURenderer. Compute shaders (real particle sims, flow fields) come with it.
- Docs: https://threejs.org/docs/pages/TSL.html · wiki: Three.js-Shading-Language
- Field guide (excellent): https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
- Migration checklist (2026): https://www.utsubo.com/blog/webgpu-threejs-migration-guide
- r3f v9: `<Canvas gl={(props) => new THREE.WebGPURenderer(props)} />`

**Language answer:** GLSL is not the problem — *unlit* GLSL on *flat* geometry is. Keep GLSL
know-how; adopt TSL when we take the r184+r3f9 upgrade (recommended as its own migration pass,
not mid-feature).

## HOLE 8 — Camera/lens finish (cheap cinema)
No DoF, fixed FOV, no LUT grade. Add at high tier: postprocessing `DepthOfField` on the cast
finale only, slight FOV kick on the launch (18→24 speed feel), `LUT3DEffect` with a teal-crushed
warm .cube for the final grade.

---

## Learning/reference sources (verified live, 2026)
- Maxime Heckel — TSL/WebGPU field guide, volumetric/painterly/caustics deep dives: https://blog.maximeheckel.com
- Codrops WebGL/R3F tutorials: https://tympanus.net/codrops
- Inigo Quilez (SDF/noise/POM math): https://iquilezles.org/articles
- The Book of Shaders: https://thebookofshaders.com · lygia GLSL lib: https://lygia.xyz
- three.js examples (POM, godrays, KTX2, TSL): https://threejs.org/examples
- Bruno Simon Three.js Journey (TSL/WebGPU lessons added 2025): https://threejs-journey.com
- Poly Haven (CC0 PBR/HDRI): https://polyhaven.com · ambientCG: https://ambientcg.com
- three-mesh-bvh (fast raycast/instancing at scale): https://github.com/gkjohnson/three-mesh-bvh

## Attack order (max visual delta per day)
1. **SMAA + N8AO + molten PointLights** (day-one wins, zero art needed)
2. **CSM conversion of channelFloor + LetterCast → lit materials, emissive molten** + Lightformer/gain-map env
3. **Displacement relief on the floor + POM knotwork** (uses existing knotwork-relief.jpg)
4. **PBR basalt detail-normals (KTX2)** on shaft/floor/flanks
5. **Extruded TextGeometry cast letters** (the mold-break finale needs real depth)
6. **SSGI/SSR + TRAA at high tier** (the avatar jump) · soft sparks via three.quarks
7. **r184 + r3f9 + TSL/WebGPU migration** (own branch, after the look lands)

## The Cúchulainn-knot finale (owner directive, recorded)
The channel split must form a **real Gaelic knot at the head** — owner reference: "the Knot of
Cúchulainn". Research note: no canonical knot is documented under that exact name; the closest
canonical form is the **Celtic Shield Knot** (four-corner interlace, one unbroken cord — warrior
protection; Cúchulainn is its usual modern association). Plan: pattern the split's plan-view on a
four/five-cord shield-knot medallion (strict over-under per `radial-svg`), **GAELWORX in the
middle breaking free from the mold** — extruded letters tearing up from the stone matrix — **A+E
still white-hot, rising to center** as the finale. If the owner has a specific knot image, drop it
in `docs/references/` and we pattern the medallion on it exactly.
