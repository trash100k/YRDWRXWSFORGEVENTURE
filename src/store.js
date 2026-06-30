/**
 * forge — the one mutable store the whole world reads (never React state mid-scroll).
 * Inputs (scroll, pointer, strike) write here; the single <ForgeDriver> per-frame loop
 * damps the GPU uniforms toward these. This is the shared driver the cohesion map calls
 * "one source of how hot the forge is right now."
 */
export const forge = {
  temperature: 0.16, // 0..1 master forge heat — scroll lifts it (the descent heats the forge)
  heat: 0,           // 0..1 transient pulse (strike + scroll velocity)
  scroll: 0,         // 0..1 page scroll progress
  pointer: { x: 0, y: 0 }, // -1..1 ndc-ish
  strikeAt: -10,     // seconds; a strike surges heat
  reduced: false,    // prefers-reduced-motion
  routeTemp: 0,      // per-route base temperature bias (the chamber)
  still: false,      // calmer chambers (scrying pool, ledger, altar) slow the boil
  route: '/',        // current path — '/' rides the channel journey, others use the backdrop
}

export const strike = () => { forge.strikeAt = performance.now() / 1000 }
