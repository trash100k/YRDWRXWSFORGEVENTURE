# GAELWORX — Build TODO

Direction (locked): the home is **ONE straight molten channel** you ride on scroll, the
**typography carries the beats** (carved tablets on the walls), and it ends in an **awesome cast
finale** (GAELWORX materializes, cools to iron, the A·E hold eternal divine fire). The four-cord
plait is intentionally **shelved** (`ForgeJourney.jsx` is kept but not the live route). The full look
is locked in `docs/references/AESTHETIC-DIRECTION.md`; the ship gate is `docs/PRODUCTION-CHECKLIST.md`.

---

## 1. Home journey (`/` = RaisedChannel) — the showpiece
- [x] Kill the wall repetition — procedural columnar basalt (no tiled texture).
- [x] Riding embers + cooled-crust molten (reads as metal, not a flame-plume).
- [x] Story tablets on the walls: Enemy · Clan · Proof + the four services (ChannelCopy).
- [x] Cast finale wired to the end of the ride: materialize L→R, cool to iron, A·E fire.
- [x] Finale camera adapts to viewport aspect (wordmark fits iPhone portrait).
- [ ] God-ray shafts down-channel; tighten tablet head kerning; final beat pacing.

## 2. Inner-page chambers — each its own location in the one forge
Wire the drafted `src/scene/*` modules per route (`ChamberPage.jsx` / `scenes.js` / `ForgeCanvas.jsx`)
so every route is DISTINCT (today the non-home routes share the generic Slab backdrop). Each to the
home's caliber. See AESTHETIC-DIRECTION §8.
- [ ] `/voice` — The Scrying Pool (`ScryingPool.jsx`)
- [ ] `/software` — The Casting Room (`CastingRoom.jsx`)
- [ ] `/automations` — The Channel Hall (`ChannelHall.jsx`, de-metronome the lanes)
- [ ] `/web` — The Jewel Chamber (`JewelChamber.jsx`)
- [ ] `/about` — The Altar Approach (`ForgeAltar.jsx`)
- [ ] `/work` — The Four Plinths (`Plinths.jsx`)
- [ ] `/pricing` — The Stone Ledger
- [ ] `/contact` — The Forge Mouth (`ForgeMouth.jsx`)

## 3. QA + ship (see PRODUCTION-CHECKLIST.md)
- [x] Browser-QA harness (`npm run qa`, headless Chromium, route × beat × viewport → `qa/`).
- [ ] Judge every route + home beat against the references; fix until each holds the cinematic bar.
- [ ] 60fps iPhone 15 + reduced-motion sanity.
- [ ] `npm run build` clean; commit + push each pass; deploy.
