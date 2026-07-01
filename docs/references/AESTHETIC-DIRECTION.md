This is a synthesis task — I have all the research I need in the provided JSON. No tools required. I'll write the brief directly.

# GAELWORX — Aesthetic Direction: Ominous Gaelic × Dwarven

## 1. The One-Line Direction
A camera-ride descent down a molten channel carved into cyclopean basalt, where **the metal is the only light** — flowing Gaelic interlace lives *inside* rigid Dwarven stone frames, curves belong to the fire and angles belong to the rock, and the word GAELWORX stands as an angular carved vessel whose **A** and **E** hold eternal white-gold flame.

## 2. The Core Tension & How We Resolve It
The tension is organic Gaelic interlace vs. angular Dwarven geometry. **Do not blend them 50/50** — zone them by *state of matter*, a rule lifted from real Insular art (flowing knotwork lives inside rectilinear carpet-page frames):

| Belongs to CURVE (liquid / light / heat) | Belongs to ANGLE (solid / cold / carved) |
|---|---|
| Molten channel spline (Catmull-Rom groove) | Basalt walls, hexagonal columnar-jointed prisms |
| Over-under knotwork where the metal weaves | Chevron buttress ribs, key-step / step-fret carved dry |
| Triskele junction bosses (3 channels merge) | Cirth/Angerthas runes (straight strokes only) |
| Ember drift, spiral flame, god-ray shafts | Trapezoidal apertures, corbelled ziggurat ledges |
| The A·E flame, all `border-radius`, bezier motion | Everything stone: `border-radius:0`, `clip-path` polygons |

**The drama lives at the meniscus** — the thin bright lip where glowing liquid curve meets a cold angular stone edge. That single highest-contrast line is the thesis of the whole site. Enforce the zoning in code: reserve ALL curvature (SVG spirals, border-radius, bezier paths) for metal/light/heat elements; force sharp corners on all stone/structure. When the two never occupy the same state, the fusion reads as intentional rather than muddled.

The over-under "break" concept fuses cleanly: a knotwork breakline (a barrier that forces a cord to turn) becomes a **basalt rib that physically deflects the molten flow** — model it as real 3D over/under geometry, not a knot texture, so the fusion survives in silhouette.

## 3. Ominous Lighting Rules
**ONE LAW: the molten metal is the only light source.** No `ambientLight`, no `hemisphereLight`, no sky, no lamp. Every visible highlight must trace back to metal (steal Moria's motivated-single-source discipline — "pitch black, no source but Gandalf's staff").

Concrete directives an R3F build can use:
- **Darkness budget:** ~90% of the frame reads as void `#060709` in deep sections. Crushed-black tone curve, high key-to-fill ratio. Unlit stone falls void → cold-steel `#1F2833`.
- **Light rig:** emissive channel material + **3–6 `rectAreaLight`s or points parented to the flow**, color-sampled from the blackbody LUT (see §4), low intensity, short decay. Add **one faint cold point** (`~#1F2833`, intensity ~0.05) far off for rim separation so silhouettes read against black — Moria's "corpselike cool," but reframed as the *villain* color, the enemy of the fire.
- **Single scalar drives everything:** a `uTemp` (0..1) uniform scrubbed by GSAP ScrollTrigger, fed into a shared 1D blackbody LUT that every emissive material samples. As the camera rides down, `uTemp` drops, the palette shifts white → orange → dark iron, and **the light literally dies around the viewer** — dread through diminishing light.
- **Raking light is mandatory for carving.** Knotwork relief and Cirth grooves only read when grazed at a low angle. Author V-cut normals with walls at **~35–60°** so one wall lights and one falls to black — carving is revealed by *shadow, not albedo*. Boost normal-map strength when `uTemp` is high/white-hot; fade it as metal cools so **carving literally cools into invisibility**.
- **God-rays / shafts:** warm additive light-cones (soft radial-gradient texture) punch DOWN through ceiling slots into the haze to guide the eye down-channel. Tint by `uTemp` so shafts cool with the scene.
- **Volumetric haze:** warm-tinted near the glow (`#3A2418`), cooling to `#10141A` far/high. Dense enough for beams, thin enough that silhouettes stay readable.
- **Embers:** ~300–800 additive sprites (drei `<Instances>`/Points), upward buoyancy + curl noise, size-over-life shrink, color-over-life LUT high→low. Keep them **the only motion during still pauses.**
- **Bloom:** `@react-three/postprocessing` SelectiveBloom, `luminanceThreshold ~0.9` — ONLY white-hot cores, mithril specular, and ithildin lines exceed threshold. Add heat-haze displacement over the hottest zones. **No lens flare** (breaks carved-stone realism). Finish with faint film grain + vignette pushing edges to void.

## 4. Material & Palette
Aligned to the existing GAELWORX palette, pushed more ominous. Cooling metal follows a *real blacksmith temperature chart* — lean on this for credibility.

| Name | Hex | Use |
|---|---|---|
| Void | `#060709` | Unlit basalt & negative space; ~90% of deep frames |
| Erebor Green-Black | `#12211B` | Deepest channel-wall stone; a green-shifted alt to pure void |
| Basalt Iron-Grey | `#22262B` | Primary carved channel walls; matte, dense |
| Cold Steel Shadow | `#1F2833` | Stone touched only by cold rim/bounce — the "death" color |
| Polished Black-Wall | `#0B0C0E` | High-gloss recesses that mirror & fracture the fire (reflective, not matte) |
| Dark Iron | `#2A1410` | Cooled crust on channel edges (<500°C), warm near-black |
| Deep Crimson | `#5C1014` | Dull-red steel ~650°C — coolest still-glowing metal, deepest live channel |
| Celtic Blood | `#C1292E` | Cherry-red ~815°C — mid channel, forging heat |
| Ember | `#E85D04` | Orange steel ~870–930°C — hotter flow, spark cores |
| Gold | `#FFB24D` | Orange-yellow ~980°C — approaching the source |
| White-Hot | `#FFF2E0` | ~1300°C+; the eternal A·E flame & hottest core — the eye-magnet, use sparingly |
| Warm Gold Filigree | `#C9A227` | Tara/Ardagh gold; raised knotwork ribs & wordmark that throw fire back — the ONLY reflective ornament metal |
| Ithildin Cold-Glow | `#BFE0FF` | Rune ignition under a cold "moon-key" light — deliberately COOLER than any forge light, for max contrast |
| Crustose Lichen Orange | `#C97B2C` | Rare warm speckle trapped in stone crevices — "ancient/ominous" decay accent |
| Warm Smoke / Cold Haze | `#3A2418` / `#10141A` | Volumetric fog tint near / far from the light |

**Materials:**
- **Basalt** — `roughness 0.85–0.95`, `metalness 0`, hard flat normals (`flatShading:true`), triplanar noise; base albedo near-black `#0B0D10` so it only appears where light hits. Weather with a low-freq splotch mask biased into recesses; **round/erode carved arrises** (never perfectly sharp on aged stone).
- **Molten metal** — emissive sampled from the blackbody LUT keyed to `uTemp` minus flow-distance plus fbm noise; `flatShading:false`. Cooled-crust islands via a second noise threshold clamping emissive to dark iron, with an animated fissure mask that cracks to reveal hot metal beneath.
- **Gold/bronze inlay** — the ONLY reflective metal: `metalness 1.0`, low roughness, chip-carved (Kerbschnitt) faceting so it sparkles and *loses* the moving light as the camera passes.
- **Mithril-cool accent** — `metalness 1.0`, `roughness 0.15`, blue-tinted `Environment`, color `#C8D2DC`; canon rule: **never tarnishes, stays mirror-clean** — the one pristine surface against all the raw stone.
- **Ithildin** — flush inlay (level with stone, not raised); emissive gated by a cold "moon-key" light so runes stay dark until the flow/key rakes across them.

LUT stops: `0.0 #2A1410 · 0.2 #5C1014 · 0.4 #C1292E · 0.6 #E85D04 · 0.8 #FFB24D · 1.0 #FFF2E0`.

## 5. Motif & Form Language
- **Channel walls (carved, cold):** angular Celtic **key-pattern / step-fret** on a 45° diagonal grid (the Insular/Pictish signature — NOT the orthogonal Greek meander), plus **chevron buttress ribs**. Bake to normal + shallow height maps; add a **median V-groove** down each band (stone convention). Panelize into bordered rectangular fields with deep edge-moulding.
- **The molten channel (fluid, hot):** swept Catmull-Rom spline; over-under **ribbon knotwork** where the metal genuinely weaves over/under stone ribs (real geometry). Constant band width, constant over/under depth step — enforce these in a shared authenticity util (reject open-loop gift-shop "celtic").
- **Runes (labels/secondary type):** **Cirth/Angerthas** cut as chamfered V-grooves into wall panels; groove floor faintly emissive so a rune **glows only when the flow passes near** — reactive lighting. Straight strokes only (vertical stem + branches); curves would read Elvish/Celtic and break the Dwarven grammar.
- **The split / junctions:** **triskele triple-spiral bosses** where three molten channels converge — the ONLY sanctioned curved logo-mark. Instance one tapering trumpet-spiral arm ×3 at 120° rotational (not mirror) symmetry, slow `useFrame` rotation, centered on an enamel-boss disc.
- **Apertures & architecture:** trapezoidal (wider base) portals framed by concentric stepped-recess rings; corbelled ziggurat terraces stepping the descent; hexagonal/octagonal columns receding to black (Alan Lee's Dwarrowdelf endless-pillar composition — tiny viewer, towering verticals). Model one half, **mirror across the channel axis** (Dwarven order vs. Elven asymmetry).
- **The finale — the wordmark:** angular carved letterforms sitting in recessed stone panels; **the A and E are the only glyphs allowed curved organic white-hot flame** in their counters/negative space (radial-gradient emissive fill). The entire fusion thesis in one lockup: angular vessel, organic eternal fire.

## 6. Typography Journey
Make the "modern type journey" read as Gaelic × Dwarven by staging a **carved-rune → refined-Latin morph**:
- **Ignition beat:** open with real **Cirth** glyphs (straight-line SVG strokes: vertical stem + branches) that animate **stroke-by-stroke as if being incised** (GSAP DrawSVG-style), then cross-fade into **Cinzel Decorative** — carved rune resolving into wrought ceremonial Latin, mirroring the descent.
- **Display = Cinzel Decorative**, treated as chiselled into basalt: hard inner bevel/emboss + niello-dark drop groove so glyph edges catch the molten rim light (echo the V-cut light logic). Wide, monumental, inscription-like tracking. Dense-row setting like the Balin's-Tomb inscription.
- **Body = a tight modern grotesque** (squared-terminal neo-grotesque), cold and structural, kerned tight — the clean counter-voice to the ornate display, per the brief. Keep body legible; let *ornament, not the typeface,* carry Gaelic identity.
- **Accent glyph kits:** **Ogham** (stroke-tally around a real 3D arris/edge — never painted on a flat face) as vertical dividers/section markers; Cirth as rune labels. Both rendered as V-grooves catching forge-glow.
- **Avoid faux-uncial "celtic" freeware fonts** — they read kitsch. Insular half-uncial is inspiration for *initials only*, not body.
- **The A·E:** the one place curved white-hot glow is permitted in type — `radial-gradient` emissive fill / `text-shadow` bloom, the wordmark's beating heart.

## 7. Concrete Build Moves (prioritized, highest-impact first)
1. **Kill all ambient light.** Delete every `ambientLight`/`hemisphereLight`. Replace with emissive channel + 3–6 flow-parented `rectAreaLight`s + one faint cold rim point. This single change does 70% of the "ominous" work.
2. **Wire the `uTemp` LUT.** Build the 1D blackbody texture from the 6 stops above; drive it with ScrollTrigger; route every emissive material through it. Guarantees palette coherence and the cooling-descent narrative for free.
3. **Crush the blacks + tight SelectiveBloom.** Tone curve to void, `luminanceThreshold ~0.9`, vignette, film grain. Only white-hot/mithril/ithildin bloom.
4. **Make the channel actually weave over/under stone ribs** (real geometry at crossings) — the fusion must survive in silhouette, not rely on a texture.
5. **Add the meniscus lip** — a thin raised bright emissive rim where metal meets stone edge. Highest-contrast form in the scene; it sells "molten."
6. **Normal-map carving on walls** (key-fret + chevron + Cirth) with `uTemp`-driven strength, so carving fades as the scene cools. Raking-light reveal, no albedo detail.
7. **Enforce the curve/angle CSS zoning:** `border-radius:0` + `clip-path` polygons on all stone/UI frames; reserve all curvature for flame/light elements. Audit the existing site for stray rounded corners on "stone" elements.
8. **Ember particle field** — the only motion in pauses; parallax layers, additive, LUT color-over-life.
9. **God-ray cones** down through ceiling slots, `uTemp`-tinted, to direct the eye down-channel.
10. **A·E ignition** — radial white-gold emissive fill in the wordmark counters; reserve `#FFF2E0` almost exclusively for this + the hottest core.
11. **Cirth→Cinzel stroke-by-stroke morph** on load/hero as the type-journey opener.
12. **Triskele boss** at the main channel junction, slow rotational spin, as the sanctioned curved mark.

## 8. Canon Caveats (borrow the mood, skip the cliché)
- **The curve=liquid / angle=solid zoning is a GAELWORX invention**, though defensibly grounded: Insular manuscripts genuinely put flowing interlace inside rectilinear frames. Own it as our idiom, not a historical claim.
- **Cirth angularity is real canon:** Dwarves adopted/extended Elf-invented Cirth (Angerthas Moria/Erebor) *specifically because straight lines carve better than curves* — this authentically justifies the "angular = carved solid" half of the rule.
- **Celtic knotwork is NOT Dwarvish** — the Gaelic×Dwarven marriage is deliberate cross-cultural fan-fusion. Keep it stylistic; claim no lore authenticity.
- **The triskele/triple-spiral is Neolithic (Newgrange c.3200 BC), PRE-Celtic** and pre-Dwarven — cite it as *ancient Irish megalithic*, not "Celtic," to avoid the gift-shop conflation.
- **Distinguish the three real Gaelic layers:** Iron-Age La Tène (curvilinear, asymmetric, pagan) → early-medieval Insular (band interlace + key + zoomorphic) → generic modern "celtic" (symmetrized kitsch). GAELWORX reads authentic by keeping **interlace strict** and **spirals asymmetric.**
- **Mithril's blue cast is inference,** not text (Tolkien says "moonlit silver," never tarnishing). **Ithildin's cold-glow color is film/Weta interpretation** — Tolkien only says it becomes visible by moon/starlight. Label the cool cyan-white as our stylization.
- **Ignore Rings of Power's mithril-Silmaril metaphysics** — TV retcon, not Tolkien. Don't build lore on it.
- **Erebor's self-glowing gold** is a film emotional device (gold doesn't emit light) — deploy it, sparingly, as a deliberate "ominous wealth" interlude, not physics.
- **Zoomorphic biting-beast terminals are Hiberno-Saxon** (as much Germanic Style II as Irish) — fine to use for ominous accents, but it's a fusion, not purely Gaelic. Keep them in near-darkness, revealed only as the light sweeps past.
- **Pictish stones were likely originally painted;** our raw monochrome light-reveal is true to how they *survive*, not how they first looked. Heavy lichen reads as *decay/neglect* — use it for "ancient/ominous," knowingly.
- **There is no authentic gold-on-black knotwork** the way modern branding uses it (real manuscript knots are multicolor on vellum; real stone knots are monochrome relief). Our gold-glow-on-basalt is legitimate stylization — own it as GAELWORX's own idiom.