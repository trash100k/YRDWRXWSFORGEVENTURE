import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ForgeShaft — THE BOTTOM OF THE FORGE (VISION-RIDE beat 1–2). A colossal vertical shaft you
 * start at the floor of, an ant in the dark: columnar-basalt walls climb out of sight to the
 * MOUTH — a molten annulus burning far above (the only light). On scroll the camera is SHOT UP
 * the shaft, threads the mouth's eye, and crests into the channel ride.
 *
 * Geometry: one open-ended BackSide cylinder (the interior), one molten ring (the mouth — its
 * hole is exactly the camera's exit path, single-sided so it vanishes cleanly once passed),
 * one faint additive light-column falling from the mouth. The metal is the only light.
 */

export const SHAFT = { x: 0, z: 9, top: 2.4, bottom: -68, radius: 7, eye: 2.4 }

const wallVert = /* glsl */ `
  varying vec3 vW;
  varying vec3 vN;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const wallFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  varying vec3 vN;
  uniform float uTime;
  vec3 gw_tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    c = mix(c, ${v3(PAL.gold)},    smoothstep(0.64, 0.85, t));
    c = mix(c, ${v3(PAL.hot)},     smoothstep(0.82, 1.00, t));
    return c;
  }
  float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.05; a*=0.5; } return v; }
  void main(){
    // columnar basalt: tall vertical striations (around the shaft × height), broken by ledge
    // bands — the Giant's-Causeway columns turned into a chimney. The angular domain samples on
    // the unit circle (cos/sin), so the noise is CONTINUOUS around the wrap — no seam column.
    float ang = atan(vW.x, vW.z - 9.0);
    vec2 ring = vec2(cos(ang), sin(ang));
    float col = fbm(ring * 4.6 + vec2(0.0, vW.y * 0.16));
    float striae = smoothstep(0.35, 0.75, col);
    float ledges = smoothstep(0.8, 0.95, fbm(vec2(vW.y * 0.5, 0.0) + ring * 1.4));
    // the mouth's light pools DOWN the walls and dies — the deep floor is near-void
    float glow = exp(-max(2.4 - vW.y, 0.0) * 0.055);
    // faint ember veins bleeding through the rock, drifting upward (seam-free ring domain)
    float vein = pow(fbm(ring * 2.1 + vec2(0.0, vW.y * 0.35 - uTime * 0.05)), 3.0);
    float heat = glow * (0.30 + striae * 0.22) + vein * 0.18 * glow;
    vec3 rock = mix(vec3(0.006, 0.008, 0.010), vec3(0.028, 0.034, 0.040), striae) * (0.25 + glow);
    rock *= 1.0 - ledges * 0.5;
    vec3 colr = rock + gw_tempColor(clamp(heat, 0.0, 1.0)) * heat * 0.9;
    gl_FragColor = vec4(colr, 1.0);
  }
`
const mouthFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  varying vec3 vN;
  uniform float uTime;
  vec3 gw_tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    c = mix(c, ${v3(PAL.gold)},    smoothstep(0.64, 0.85, t));
    c = mix(c, ${v3(PAL.hot)},     smoothstep(0.82, 1.00, t));
    return c;
  }
  float gw_em(float t){ t = clamp(t, 0.0, 1.0); return pow(t, 3.0) * 2.6 + t * 0.12; }
  void main(){
    // the burning annulus seen from 60 units below: white-hot at the inner lip (where the
    // metal pours over into the channel) cooling to crimson at the outer rim
    float r = length(vW.xz - vec2(0.0, 9.0));
    float t01 = clamp((r - 2.4) / (7.2 - 2.4), 0.0, 1.0);
    float boil = sin(r * 9.0 - uTime * 2.2) * 0.04;
    float heat = 0.96 - t01 * 0.55 + boil;
    vec3 col = gw_tempColor(heat) * gw_em(heat);
    gl_FragColor = vec4(col, 1.0);
  }
`

export default function ForgeShaft() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const wallMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: wallVert, fragmentShader: wallFrag, uniforms, side: THREE.BackSide, fog: false }),
    [uniforms]
  )
  const mouthMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: wallVert, fragmentShader: mouthFrag, uniforms, side: THREE.BackSide, fog: false, toneMapped: false }),
    [uniforms]
  )
  useFrame((state) => { if (!forge.reduced) uniforms.uTime.value = state.clock.elapsedTime })

  const H = SHAFT.top - SHAFT.bottom
  return (
    <group>
      {/* the interior — colossal columnar-basalt chimney (BackSide: we live inside it) */}
      <mesh position={[SHAFT.x, SHAFT.bottom + H / 2, SHAFT.z]}>
        <cylinderGeometry args={[SHAFT.radius, SHAFT.radius * 1.15, H, 42, 1, true]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      {/* THE MOUTH — the molten annulus far above; its eye is the camera's exit. BackSide ring
          faces DOWN the shaft, so the instant you thread it, it's gone (a clean crest). */}
      <mesh position={[SHAFT.x, SHAFT.top, SHAFT.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SHAFT.eye, SHAFT.radius * 1.03, 48]} />
        <primitive object={mouthMat} attach="material" />
      </mesh>
      {/* the light column falling from the mouth — cheap volumetric read (additive, faint) */}
      <mesh position={[SHAFT.x, SHAFT.top - 16, SHAFT.z]}>
        <cylinderGeometry args={[SHAFT.eye * 0.95, SHAFT.eye * 1.5, 32, 20, 1, true]} />
        <meshBasicMaterial color="#E85D04" transparent opacity={0.05} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} fog={false} />
      </mesh>
      {/* the mouth's own light spilling down the walls */}
      <pointLight position={[SHAFT.x, SHAFT.top - 2.5, SHAFT.z]} intensity={55} distance={46} decay={2} color="#FF9E4F" />
    </group>
  )
}
