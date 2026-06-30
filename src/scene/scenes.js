/**
 * Per-route scene presets. The ONE forge re-tempers per chamber: a base temperature
 * bias + a "still" flag (cooler, calmer chambers). Not a second renderer — one world,
 * re-lit per route (the cohesion-map "chambers as configs" rule, v1).
 */
export const SCENES = {
  '/':            { tempBias: 0.0,   still: false }, // the pour journey
  '/voice':       { tempBias: -0.05, still: true  }, // scrying pool — cool, still
  '/software':    { tempBias: 0.12,  still: false }, // casting room — warm
  '/automations': { tempBias: 0.08,  still: false }, // channel hall
  '/web':         { tempBias: 0.16,  still: false }, // jewel chamber — vivid
  '/work':        { tempBias: 0.06,  still: false }, // four plinths
  '/pricing':     { tempBias: 0.0,   still: true  }, // stone ledger — still
  '/about':       { tempBias: 0.03,  still: true  }, // altar approach — reverent
  '/contact':     { tempBias: 0.28,  still: false }, // forge mouth — hottest
}

export const sceneFor = (p) => SCENES[p] || SCENES['/']
