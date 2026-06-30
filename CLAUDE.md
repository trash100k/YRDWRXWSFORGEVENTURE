# GAELWORX — Design Source of Truth (the new build)

**This repo is the NEW GAELWORX website**, built avatar-level from scratch. The old site lives in the
`GWOBSDNWEB` repo (reference only). Binding brand/design logic below. Ethos: **Neo-Gaelic Brutalist** —
unapologetic, raw, meticulously engineered. Tagline: _"Automatic Execution. Clan Protected."_

The full forge-world vision, the ~1,100-page graphics research, the sales-journey/pricing decisions, and
the master build plan are the spec this executes against (mirrored from `GWOBSDNWEB/docs/` — port docs in
as needed).

---

## Typography (non-negotiable)
- **Cinzel Decorative** — the ONLY display/brand serif. Weights **700 and 900 only**. The GAELWORX
  wordmark, "Automatic Execution", brand headings. Token `--gw-display`.
- **A+E IGNITED (mandatory).** Within each WORD of a brand proper-noun, only the **first `A` and first `E`**
  ignite — 900 Cinzel with the forge-glow gradient. "**A**utomatic **E**xecution", never "Autom**a**tic
  Ex**e**cution". One A + one E per word, max. Ignited terms: **GAELWORX · Automatic Execution · Maeve ·
  YardWorx · RepairWorx · SalesWorx · AgentWorx.** Implemented in `src/ui/Ignite.jsx` (`igniteIndices`),
  detected in prose by `src/ui/BrandText.jsx` (`TERMS`). Ignite only in ALL-CAPS display (Cinzel has no
  lowercase). Gradient: `linear-gradient(to bottom,#E85D04,#C1292E,#E34A27,#C0392B)`, animated, ember glow.
- **Bricolage Grotesque** (`--gw-headline`) — headlines, 700–800, tight tracking.
- **Hanken Grotesk** (`--gw-sans`) — body, subheads, labels.

## Palette — Industrial Metallurgy
| Name | Hex | Token |
|---|---|---|
| Celtic Blood | `#C1292E` | `--gw-forge` |
| Ember Glow | `#E85D04` | `--gw-ember` |
| Forged Iron (void) | `#0B0C10` | `--gw-void` |
| Cold Steel | `#1F2833` | `--gw-iron` |
| Fog White | `#F1F2F6` | `--gw-bone` |
| Ash | `#8D99AE` | `--gw-steel` |

## Neo-Gaelic Brutalism
- **0px border-radius. SHARP corners everywhere.** 1–2px solid borders. Iron Grid (12-col, 0px gaps).
- Depth: L1 1px Ash border · L2 inner forge-glow `#E34A27` @10% · L3 **8px hard `#000` drop shadow**.
- Motion: **Brutalist Snap** (0ms delay, impact not bounce) · Atmospheric Drift · Forge Reveal (blur→sharp).

## Voice — The Clan Voice
Aggressive (direct commands, no passive voice), clean (zero fluff), battle-tested. CTAs = "Point the Sword."

## The forge world (this build)
A Middle-Earth-meets-true-Gaelic **giant dwarf forge** in React + react-three-fiber, **one** WebGL renderer,
route-swapped chambers, cinematic to Active-Theory/Lusion caliber, **60fps on iPhone 15 OLED**. One
temperature signal · one noise basis · one palette · one tone-map · one bloom contract · the metal is the
only light · the **A and E** are the eternal divine-fire exception. Build the spine first. No runtime EXR.

- Tokens + CSS: `src/index.css`. Fonts + entry: `src/main.jsx`. Copy: `src/brand.js`.
- Commands: `npm run dev`, `npm run build`.
