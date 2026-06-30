# GAELWORX — Build TODO

Status of the avatar-level forge build. The **home journey is complete** (ride the molten
Celtic plait → four service cords → cast into GAELWORX, A·E divine fire, cinematic/sacred
grade). Remaining work below, in priority order.

---

## 1. Wire + verify the real `/` route  ⟵ FIRST
The journey is QA'd only in the `/lab?m=Journey&s=` harness (forced scroll). Make it run as a
real scrolling page.
- [ ] Lenis momentum scroll wired and driving `forge.scroll` (0..1 over the journey).
- [ ] `Home.jsx` reconciled with the 3D — the story lives in the 3D tablets, so the DOM is a
      tall scroll-driver + minimal hero/CTA, not a second copy deck doubling the 3D.
- [ ] Beats land on scroll: open → plait story → four services → cast. No dead zones.
- [ ] Reduced-motion + mobile (iPhone 15) sanity.

## 2. Inner-page chambers (brief §4) — each its own location in the one forge
Integrate per-route chambers (modules drafted in `src/scene/*`), each to the home's caliber via
brief → photos → cohesion.
- [ ] `/voice` — The Scrying Pool (flagship): basalt pool, Ogham rim, ember beneath, Maeve ripples.
- [ ] `/software` — The Casting Room: forged cast on a plinth, circuit-knotwork, camera orbit.
- [ ] `/automations` — The Channel Hall: top-down parallel molten channels flowing in concert.
- [ ] `/web` — The Jewel Chamber: faceted gem in a basalt niche, A·E dispersion across facets.
- [ ] `/about` — The Altar Approach: floor-level before the carved altar, GAELWORX dark/cast.
- [ ] `/work` — The Four Plinths: YardWorx · RepairWorx · SalesWorx · AgentWorx as four casts.
- [ ] `/pricing` — The Stone Ledger: prices cut in deep relief, ember rake-light (tabbed tiers).
- [ ] `/contact` — The Forge Mouth: stone arch, Ogham jambs, "Name the bottleneck." keystone.

## 3. Refine the home journey
- [ ] The cords visibly STREAM into the GAELWORX letters during the cast (connect pour → fill).
- [ ] Ogham revealed in the word's border by the A·E light at the finale.
- [ ] Tighten beat pacing / copy legibility / fork brightness where needed.

## 4. QA loop (after the above)
- [ ] Screenshot every route + every home beat (headless Chromium harness).
- [ ] Judge each against the brief + the reference library (`docs/references/`).
- [ ] Fix what fails; re-shoot until each reads at the cinematic bar.
- [ ] `npm run build` clean; commit + push each pass.
