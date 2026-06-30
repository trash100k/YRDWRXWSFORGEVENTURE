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
  void: '#0B0C10',        // 0.00  cold iron / void
  crimsonDeep: '#7A1418', // 0.22  first dull red
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
