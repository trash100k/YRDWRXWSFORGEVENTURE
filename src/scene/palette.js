import * as THREE from 'three'

/**
 * PAL — the one palette every shader samples (Industrial Metallurgy + the temperature
 * ramp stops). The ramp marches the Planckian hue order (black→red→orange→gold→white)
 * but lands on brand-anchored stops. v3() inlines a hex as a GLSL vec3 literal.
 *
 * NOTE: hot/gold/divine stay <=1 for now (no bloom pass yet). When the post-FX bloom
 * lands, push them >1 so only the accent band blooms (see the cohesion map).
 */
export const PAL = {
  void: '#060709',        // 0.00  cold iron / void (deeper, near-black)
  crimsonDeep: '#5C1014', // 0.22  first dull red (darker, more ominous)
  crimson: '#C1292E',     // 0.45  Celtic Blood
  ember: '#E85D04',       // 0.66  Ember Glow
  gold: '#FFB24D',        // 0.85  hot shoulder
  hot: '#FFF2E0',         // 1.00  white-hot
  divine: '#FFF6E8',      // the eternal A/E white-gold
  steel: '#1F2833',       // Cold Steel
  ash: '#8D99AE',
  bone: '#F1F2F6',
}

// hex -> "vec3(r,g,b)" GLSL literal (linear-ish; good enough pre-tonemap)
export const v3 = (hex) => {
  const c = new THREE.Color(hex)
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`
}

/* ── JS mirror of the GLSL temperature ramp ─────────────────────────────────────
 * rampColor(t) walks the SAME five smoothstep stops as every shader's tempColor(),
 * so a JS consumer (the flow-parented point lights) lands on identical hues. Writes
 * into `out` if given (no per-frame allocation in useFrame hot paths). */
const _stops = ['void', 'crimsonDeep', 'crimson', 'ember', 'gold', 'hot'].map((k) => new THREE.Color(PAL[k]))
const _edges = [[0.0, 0.22], [0.18, 0.45], [0.42, 0.66], [0.64, 0.85], [0.82, 1.0]]
const _sm = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u) }
export function rampColor(t, out = new THREE.Color()) {
  t = Math.min(1, Math.max(0, t))
  out.copy(_stops[0])
  for (let i = 0; i < 5; i++) out.lerp(_stops[i + 1], _sm(_edges[i][0], _edges[i][1], t))
  return out
}
