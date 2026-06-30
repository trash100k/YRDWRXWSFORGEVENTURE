import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * JewelChamber — THE WEB CHAMBER. A faceted obsidian JEWEL under forge light, slowly
 * rotating, throwing CHROMATIC DISPERSION (cheap single-pass cos-split RGB) across its
 * flat-shaded facets in the forge palette: white-gold A/E divine fire + forge-red +
 * green-black void. A fresnel rim ignites the silhouette in ember (radiance > 1.0 so the
 * shared bloom catches it). The most vivid / prismatic chamber, and mobile-affordable —
 * no real transmission, no EXR, just one IcosahedronGeometry and one shader pass.
 *
 * Renders INSIDE the existing forge <Canvas>. The store `forge` drives heat coupling
 * (dt-damped, like every other module); reduced-motion freezes the spin & wobble.
 *
 * @param {number}   [detail=1]    Icosahedron subdivision (0=20 facets, 1=80, 2=320). Keep low for mobile.
 * @param {number}   [radius=1.7]  Jewel radius (world units).
 * @param {number}   [spin=0.12]   Base rotation speed (rad/s); scaled by temperature.
 * @param {number}   [dispersion=1.0]  Chromatic split strength multiplier.
 * @param {number}   [bloomBoost=1.0]  Multiplier on emissive radiance into the shared bloom.
 * @param {[number,number,number]} [position=[0,0,0]]  Group position.
 */

const vert = /* glsl */ `
  varying vec3 vViewPos;     // facet position in view space
  varying vec3 vViewNormal;  // FLAT facet normal (view space)
  varying vec3 vWorldNormal; // flat normal (world space) for dispersion sampling
  varying vec3 vObjPos;      // object-space position (stable facet id)

  void main() {
    vObjPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    // FLAT facet normals from screen-space derivatives — guarantees true faceting
    // regardless of the geometry's vertex normals (icosa is flat-shaded by face).
    vViewNormal = normalize(mat3(modelViewMatrix) * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mv;
  }
`

const frag = /* glsl */ `
  precision highp float;

  varying vec3 vViewPos;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  varying vec3 vObjPos;

  uniform float uTime, uTemp, uHeat, uDisp, uBloom;
  uniform vec3  uLightDir; // forge key light (the metal below), view space

  // forge palette stops (inlined — no raw hex)
  const vec3 C_VOID   = ${v3(PAL.void)};
  const vec3 C_DEEP   = ${v3(PAL.crimsonDeep)};
  const vec3 C_CRIM   = ${v3(PAL.crimson)};
  const vec3 C_EMBER  = ${v3(PAL.ember)};
  const vec3 C_GOLD   = ${v3(PAL.gold)};
  const vec3 C_HOT    = ${v3(PAL.hot)};
  const vec3 C_DIVINE = ${v3(PAL.divine)};
  const vec3 C_STEEL  = ${v3(PAL.steel)};

  // flat normal recomputed per-facet from derivatives — true faceted look
  vec3 flatNormal(vec3 p) {
    return normalize(cross(dFdx(p), dFdy(p)));
  }

  // ramp a scalar 0..1 along the forge temperature order
  vec3 forgeRamp(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(C_VOID,  C_DEEP,  smoothstep(0.00, 0.22, t));
    c = mix(c, C_CRIM,   smoothstep(0.18, 0.45, t));
    c = mix(c, C_EMBER,  smoothstep(0.42, 0.66, t));
    c = mix(c, C_GOLD,   smoothstep(0.64, 0.85, t));
    c = mix(c, C_HOT,    smoothstep(0.82, 1.00, t));
    return c;
  }

  // cheap per-channel cos "dispersion" — three slightly-offset sample angles fan the
  // spectrum across the facet. This is the prism trick without any transmission pass.
  float band(float a, float phase) {
    return cos(a * 9.0 + phase) * 0.5 + 0.5;
  }

  void main() {
    // FLAT facet normal in view space (overrides interpolated normal -> hard facets)
    vec3 nV = flatNormal(vViewPos);
    vec3 nW = flatNormal(vWorldNormal); // stable enough per-face for color id
    vec3 V  = normalize(-vViewPos);     // facet -> eye

    // fresnel rim — ignites the silhouette
    float fres = pow(1.0 - clamp(dot(nV, V), 0.0, 1.0), 3.0);

    // forge key light raking the facets (the metal below is the only light)
    float key = clamp(dot(nV, normalize(uLightDir)), 0.0, 1.0);

    // a per-facet "angle" the RGB split fans across — driven by facet orientation,
    // view, and a slow time march so the spectrum crawls as the jewel turns.
    float baseA = atan(nV.y, nV.x) + dot(nV, V) * 1.7 + uTime * 0.35;
    float seed  = dot(vObjPos, vec3(12.9898, 78.233, 37.719)); // stable per-facet offset

    // SPLIT RGB — three phase-shifted bands = chromatic dispersion across the facet.
    float split = (0.22 + 0.55 * fres) * uDisp;
    float rB = band(baseA, seed + 0.0   - split);
    float gB = band(baseA, seed + 2.094 + 0.0  );  // +120deg
    float bB = band(baseA, seed + 4.188 + split );  // +240deg

    // map the split bands into the FORGE spectrum (not raw RGB): the warm bands ride the
    // temperature ramp; the cold band pulls toward green-black void/steel so we read
    // obsidian, not a rainbow. R=hot/divine, G=void-green, B=crimson — the forge's prism.
    vec3 hotBand  = forgeRamp(0.55 + rB * 0.45) * (0.85 + rB * 0.9);
    vec3 coldBand = mix(C_VOID, C_STEEL, gB) * (0.30 + gB * 0.5); // green-black play
    vec3 crimBand = mix(C_DEEP, C_CRIM, bB) * (0.5 + bB * 0.7);

    vec3 disp = hotBand * (0.45 + 0.55 * rB)
              + crimBand * 0.55
              + coldBand;

    // facet base: dark obsidian body, lit by the key + a touch of the dispersion
    float temp = clamp(uTemp + uHeat * 0.25, 0.0, 1.0);
    vec3 body = mix(C_VOID, C_STEEL, 0.25 + key * 0.35);
    body += disp * (0.18 + key * 0.85) * (0.6 + temp * 0.9);

    // specular glint where a facet flips toward the key light -> divine white-gold spark
    float glint = pow(key, 22.0);
    body += C_DIVINE * glint * (1.6 + temp * 1.4);

    // EMBER fresnel rim, pushed > 1.0 so the shared bloom ignites the silhouette
    vec3 rim = mix(C_EMBER, C_DIVINE, fres * 0.6) * fres * (1.4 + temp * 1.8);
    body += rim;

    // overall heat lift — the whole jewel glows hotter as the forge climbs
    body *= 0.85 + temp * 0.65;

    // ensure the brightest accents exceed 1.0 for bloom; scale by bloomBoost
    body *= uBloom;

    gl_FragColor = vec4(body, 1.0);
  }
`

export default function JewelChamber({
  detail = 1,
  radius = 1.7,
  spin = 0.12,
  dispersion = 1.0,
  bloomBoost = 1.0,
  position = [0, 0, 0],
}) {
  const group = useRef()

  const geo = useMemo(
    () => new THREE.IcosahedronGeometry(radius, detail),
    [radius, detail]
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: forge.temperature },
      uHeat: { value: 0 },
      uDisp: { value: dispersion },
      uBloom: { value: bloomBoost },
      // key light from below-front (the molten metal is the only light)
      uLightDir: { value: new THREE.Vector3(0.2, -0.85, 0.55).normalize() },
    }),
    [dispersion, bloomBoost]
  )

  useFrame((state, dt) => {
    const d = Math.min(1, (dt || 0.016) * 2)
    const t = state.clock.elapsedTime
    uniforms.uTime.value = t
    uniforms.uTemp.value += (forge.temperature - uniforms.uTemp.value) * d
    uniforms.uHeat.value += (forge.heat - uniforms.uHeat.value) * d

    // slow rotation — frozen under reduced-motion. Temperature urges it faster.
    if (group.current && !forge.reduced) {
      const s = spin * (0.6 + uniforms.uTemp.value * 0.9)
      group.current.rotation.y += s * (dt || 0.016)
      group.current.rotation.x = Math.sin(t * 0.18) * 0.16
      // a faint pointer tilt — the jewel leans toward the cursor
      group.current.rotation.z +=
        (forge.pointer.x * 0.12 - group.current.rotation.z) * d * 0.5
    }
  })

  return (
    <group ref={group} position={position}>
      <mesh geometry={geo}>
        <shaderMaterial
          vertexShader={vert}
          fragmentShader={frag}
          uniforms={uniforms}
        />
      </mesh>
    </group>
  )
}
