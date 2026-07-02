# GAELWORX — Build TODO

Direction (locked, `docs/VISION-RIDE.md`): the home is the **wild ride** — bottom of the colossal
forge → SHOT UP the shaft → the pour → ONE molten channel (typography carries the beats) → the
**Knot of Cúchulainn** finale (GAELWORX breaks free of the mold in the pocket after the two
eyelets; the white-hot A·E rise to the knot's centre). Inner pages = GoT-intro dioramas.
Copy = the conversion spine (hook → problem/agitate/authority → 5 services outcome-first →
industries trust → risk-reversal + scarcity + one CTA + Maeve). Graphics march the
`docs/GRAPHICS-GAP-AUDIT.md` attack order.

---

## 1. Home journey (`/` = RaisedChannel) — the showpiece
- [x] Kill the wall repetition — procedural columnar basalt (no tiled texture).
- [x] Riding embers + cooled-crust molten (reads as metal, not a flame-plume).
- [x] Story tablets: Enemy · Clan · Proof + FIVE services (adds GW-05 AI Installation) + industries.
- [x] THE LAUNCH: bottom-of-shaft hold (hero over the burning mouth-ring) → shot up → crest into the ride (`ForgeShaft.jsx`).
- [x] THE KNOT: 4 molten cords weave the pendant — lattice head, two eyelets, pocket, point (`KnotSplit.jsx`).
- [x] Cast breaks free of the mold (emerge) + A·E rise to the knot's centre (riseDivine).
- [x] Finale camera rises to a high three-quarter; DOM close owns the lower third.
- [ ] Polish: shaft rim edge at crest; dark rib edge in the cast frame's left; launch FOV kick;
      the mouth-eye artifact at dead centre of the hero.
- [ ] Hound-head terminals at the knot's head (the two dogs — flanking the lattice entry).

## 2. Inner pages — GoT dioramas (ChamberRig/ChamberStage DONE; rooms live)
- [x] Assembly intro (clockwork stagger) + float + raise-away outro + camera crane.
- [x] Chamber fill lights (key + rim) so no diorama sits unlit.
- [ ] Outro when exiting to NON-chamber routes (home/pricing) — currently instant swap.
- [ ] Per-room polish to the home bar; `/pricing` Stone Ledger chamber still missing.
- [ ] GW-05 AI Installation: own page/chamber (currently routes to /software).

## 3. Conversion layer
- [x] 5 branches + industries in brand.js; META AEO pass; sr-only track indexable.
- [x] SUMMON MAEVE stub (`gw:summon-maeve` event + `[data-gw-maeve]`) — hero/finale on-ramp.
- [ ] Hook Maeve's real voice pipeline to the event; she pitches + closes.
- [ ] Lead capture path (see `lead-capture` skill): CTA → endpoint → store → confirm.

## 4. Graphics attack order (GRAPHICS-GAP-AUDIT.md)
- [x] 1. SMAA (always) + N8AO (high tier) + chamber key/rim lights.
- [ ] 2. Lit materials (CSM) for floor/cast + gain-map env — molten as csm_Emissive.
- [ ] 3. Displacement relief + POM knotwork engraving (knotwork-relief.jpg is the heightmap).
- [ ] 4. PBR basalt detail-normals (KTX2, Poly Haven/ambientCG).
- [ ] 5. Extruded TextGeometry letters (Cinzel typeface.json) — true 3D mold-break.
- [ ] 6. SSGI/TRAA (realism-effects) at high tier — the avatar jump.
- [ ] 7. three r184 + r3f9 + TSL/WebGPU migration (own branch, after the look lands).

## 5. QA + ship (see PRODUCTION-CHECKLIST.md)
- [x] Browser-QA harness (headless Chromium; reduced-motion pass for settled states).
- [ ] Judge every route + beat against the refs; 60fps iPhone 15; reduced-motion sanity.
- [ ] `npm run build` clean; commit + push each pass; deploy.
