# GAELWORX — Production Checklist (the ship gate)

The bar is **cinematic, avatar-level**. Nothing ships until it clears this gate. Judge every frame
against `docs/references/AESTHETIC-DIRECTION.md` §0 ("the one feeling") and the reference library.
QA is done in the browser like a human art director: `npm run qa` → read the PNGs → fix the
worst-reading frame → re-shoot, until every frame holds.

## The 9 look laws (apply to every route)
1. **The metal is the only light.** No ambient/hemisphere on the hero. ~90% of every frame is void.
2. **One brightest line — the meniscus** (molten curve meeting cold carved stone) in every channel frame.
3. **Cooling descent.** White-hot at the source → dark iron down the length; the light dies as you go.
4. **Stone is SET, not tiled.** Procedural columnar basalt, irregular courses, no visible repeat.
5. **Typography carries the beats.** Cinzel display, ember kicker, ash body; A·E divine white-gold fire.
6. **A·E law.** First A + first E of each brand word ignite; everything else forged bone/iron. Never cool.
7. **Sharp brutalism.** 0px radius on all stone/UI; curvature reserved for flame/light/metal only.
8. **Motion has weight.** Brutalist Snap between framings, Atmospheric Drift on holds, embers the only idle motion.
9. **One system.** One noise basis, one palette (`PAL` via `v3()`), one tone-map, one bloom contract (thr 0.85).

## Home journey (`/`) — the showpiece
- [x] Wall repetition killed — procedural columnar basalt, no tile (was the tiled knotwork JPG).
- [x] Riding embers throughout the descent; cooled-crust molten (not a flame-plume).
- [x] Story tablets on the walls carry Enemy · Clan · Proof + the four services (typography beats).
- [x] Cast finale: GAELWORX materializes L→R, cools to iron, **A·E eternal white-gold fire**.
- [x] Finale camera adapts to aspect so the wordmark fits on iPhone portrait.
- [ ] God-ray shafts down-channel (nice-to-have polish).
- [ ] Beat pacing / tablet kerning final tighten.

## Inner chambers — each its own room in the one forge (see AESTHETIC-DIRECTION §8)
Each: hero object + its copy carried by carved Cinzel + the 9 laws. QA desktop + iPhone 15.
Wired + distinct + legible on both viewports; deeper polish (bespoke cameras, motion) can follow.
- [x] `/voice` — The Scrying Pool (ember pool beneath Maeve)
- [x] `/software` — The Casting Room (circuit-knotwork cast, self-orbit)
- [x] `/automations` — The Channel Hall (parallel molten lanes)
- [x] `/web` — The Jewel Chamber (faceted gem, prismatic facets)
- [x] `/about` — The Altar Approach (carved altar face)
- [x] `/work` — The Four Plinths (four temperatures, self-pan)
- [ ] `/pricing` — The Stone Ledger (still on the Slab backdrop — no bespoke scene yet)
- [x] `/contact` — The Forge Mouth (glowing mouth behind the form)

## Performance & platform
- [ ] 60fps on iPhone 15 OLED (DPR ≤ 1.5, one WebGL renderer, modest geo, InstancedMesh where it repeats).
- [ ] No per-frame allocations in `useFrame` hot paths; shaders damp toward `forge.*` (no React churn on scroll).
- [ ] Bundle: three/r3f code-split; DOM shell paints before WebGL.

## Accessibility & correctness
- [ ] `prefers-reduced-motion`: boil frozen, embers off, reveals land straight, no camera drift sickness.
- [ ] Copy is indexable (sr-only mirror of the 3D story) — SEO/AEO intact.
- [ ] Keyboard/focus on all DOM CTAs and nav; contrast on DOM text.

## Ship
- [x] `npm run build` clean (no errors; chunk-size warning is acceptable).
- [x] Full `npm run qa -- --all` sweep; every route × desktop + iPhone renders clean (36/36, no errors).
- [x] Commit + push each pass to `claude/enhance-graphics-quality-wn1yq3`.
- [ ] Deploy (repo carries `wrangler.jsonc` → Cloudflare) — needs credentials + explicit go-ahead.

## How to QA (the art-director loop)
```
npm run qa                 # home beats × desktop + iPhone 15  (the core loop)
npm run qa -- --all        # + every route + bare scenes
npm run qa -- --fast       # 3 home beats, desktop only (quick glance)
npm run qa -- --beats 0.4,1.0 --routes /,/voice   # targeted
```
Screenshots land in `qa/` (gitignored). Read them, judge against the references, fix, re-shoot.
