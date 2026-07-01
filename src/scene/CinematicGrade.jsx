import { Effect } from 'postprocessing'
import { wrapEffect } from '@react-three/postprocessing'
import * as THREE from 'three'

/**
 * CinematicGrade — the FILM LAYER. A single post effect that does what a colorist + film stock do,
 * turning "emissive shapes on black" into a graded frame:
 *   · filmic contrast S-curve around a low pivot (dark scene)
 *   · split-tone — cold steel toe in the mid-shadows, warm gold into the highlights
 *   · HALATION — the celluloid red/orange bleed on the bright fringe (the forge's signature); it
 *     rides the bloom halo that already ran, so hot metal gets a reddish glow like real film
 *   · saturation lift + a soft filmic shoulder
 * Runs after ACES tone-map (operates in display space). Cheap: one pass, no convolution.
 */
const fragment = /* glsl */ `
  uniform float uContrast, uPivot, uSat, uHalation, uLift, uHiWarm;
  uniform vec3 uHalationColor, uShadowTint, uHighlightTint;

  float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float l = luma(c);

    // filmic contrast around a low pivot (the frame is mostly void)
    c = (c - uPivot) * uContrast + uPivot;

    // cold-steel toe in the MID shadows (not the deepest void — keep true black true)
    float shadow = smoothstep(0.015, 0.14, l) * (1.0 - smoothstep(0.14, 0.42, l));
    c += uShadowTint * shadow * uLift;

    // warm gold split-tone into the highlights
    float hi = smoothstep(0.55, 1.0, l);
    c += uHighlightTint * hi * uHiWarm;

    // HALATION — reddish bleed on the bright fringe (rides the existing bloom spread)
    float halo = smoothstep(0.32, 0.9, l);
    c += uHalationColor * halo * uHalation;

    // saturation
    float g = luma(c);
    c = mix(vec3(g), c, uSat);

    outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
  }
`

class CinematicGradeImpl extends Effect {
  constructor({
    contrast = 1.14,
    pivot = 0.30,
    saturation = 1.16,
    halation = 0.14,
    lift = 0.05,
    hiWarm = 0.06,
    halationColor = new THREE.Color(0.95, 0.30, 0.10), // celluloid red-orange
    shadowTint = new THREE.Color(0.10, 0.16, 0.26),    // cold steel (the "enemy" colour)
    highlightTint = new THREE.Color(0.55, 0.38, 0.14), // warm gold
  } = {}) {
    super('CinematicGrade', fragment, {
      uniforms: new Map([
        ['uContrast', new THREE.Uniform(contrast)],
        ['uPivot', new THREE.Uniform(pivot)],
        ['uSat', new THREE.Uniform(saturation)],
        ['uHalation', new THREE.Uniform(halation)],
        ['uLift', new THREE.Uniform(lift)],
        ['uHiWarm', new THREE.Uniform(hiWarm)],
        ['uHalationColor', new THREE.Uniform(halationColor)],
        ['uShadowTint', new THREE.Uniform(shadowTint)],
        ['uHighlightTint', new THREE.Uniform(highlightTint)],
      ]),
    })
  }
}

export const CinematicGrade = wrapEffect(CinematicGradeImpl)
export default CinematicGrade
