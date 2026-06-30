import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ForgeJourney — the home experience, for real this time. A molten channel winds DOWN
 * through the dark forge; the camera RIDES it as you scroll (you follow the metal down).
 * Stage 1: the channel + the pour + the scroll-driven camera + ominous depth-fade.
 * Next stages: copy carved on the channel walls, the Celtic 4-way split, and the pour
 * into the GAELWORX letterforms for the final cast.
 */

// The channel path — winds and descends. Scroll maps to position along it.
function makeCurve() {
  const pts = []
  const N = 11
  for (let i = 0; i <= N; i++) {
    const t = i / N
    pts.push(
      new THREE.Vector3(
        Math.sin(t * Math.PI * 2.4) * 2.3,
        2.0 - t * 22.0,
        Math.cos(t * Math.PI * 1.6) * 1.7
      )
    )
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
}

const moltenVert = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const moltenFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying float vDepth;
  uniform float uTime, uTemp;

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
    float u = vUv.x, v = vUv.y;
    // hot bands flowing DOWN the channel
    float flow  = sin(u * 64.0 - uTime * 2.2) * 0.5 + 0.5;
    float flow2 = sin(u * 26.0 - uTime * 1.4 + 1.6) * 0.5 + 0.5;
    float t = 0.5 + flow * 0.26 + flow2 * 0.16 + uTemp * 0.08;
    // brightest along the molten core (channel centre), cooler at the lips
    float core = clamp(1.0 - abs(v - 0.5) * 1.7, 0.0, 1.0);
    t *= 0.5 + core * 0.62;
    vec3 col = gw_tempColor(t) * gw_em(t);
    // ominous depth — the channel emerges from darkness ahead
    col *= smoothstep(24.0, 1.5, vDepth);
    gl_FragColor = vec4(col, 1.0);
  }
`

function CameraDolly({ curve }) {
  const { camera } = useThree()
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const P = useMemo(() => new THREE.Vector3(), [])
  const TAN = useMemo(() => new THREE.Vector3(), [])
  const LOOK = useMemo(() => new THREE.Vector3(), [])
  const DES = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const t = THREE.MathUtils.clamp(forge.scroll, 0.001, 0.93)
    curve.getPointAt(t, P)
    curve.getTangentAt(t, TAN)
    // ride behind + above the current point, looking ahead down the flow
    DES.copy(P).addScaledVector(TAN, -2.7).addScaledVector(up, 1.15)
    camera.position.lerp(DES, 0.1)
    LOOK.copy(P).addScaledVector(TAN, 3.0)
    camera.lookAt(LOOK)
  })
  return null
}

export default function ForgeJourney() {
  const curve = useMemo(() => makeCurve(), [])
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 320, 0.32, 14, false), [curve])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uTemp: { value: 0.5 } }), [])

  useFrame((state, dt) => {
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uTemp.value += (forge.temperature - uniforms.uTemp.value) * Math.min(1, (dt || 0.016) * 2)
  })

  return (
    <>
      <CameraDolly curve={curve} />
      <mesh geometry={geo}>
        <shaderMaterial vertexShader={moltenVert} fragmentShader={moltenFrag} uniforms={uniforms} />
      </mesh>
    </>
  )
}
