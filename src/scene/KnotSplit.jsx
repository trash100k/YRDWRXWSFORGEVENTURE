import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * KnotSplit — THE KNOT OF CÚCHULAINN, cast in molten metal at the end of the ride
 * (owner reference decoded in docs/references/knot-of-cuchulainn-schematic.svg).
 *
 * Where the basalt walls open, the single river braids UP out of its trough into four molten
 * cords that weave the knot's HEAD (a strict over-under lattice), pass the TWO EYELETS, frame
 * the open pocket where GAELWORX breaks free of the mold slab, and CONVERGE to a single point
 * beyond it. Real tubes, real over-under (the y-profile trades height at every crossing), the
 * metal the only light.
 *
 * World span: head z −34→−40.5 · eyelets z −41.2 · pocket (the cast) z ≈ −43 · point z −50.
 */

const R = 0.12 // cord radius
const KNOT_Z_POINT = -50

// molten cord — white-hot crown cooling toward the sides, flow streaks running toward the point
const cordVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal); // world-space normal (uniform scale only)
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const cordFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
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
    // crown = the UPWARD-facing skin (world normal vs up) — NOT the tube's uv frame, which
    // twists with the path and scatters the highlight. The metal reads real only with tonal
    // range: a white-hot crown falling fast through ember to dark crimson crust on the flanks.
    float crown = clamp(vN.y, 0.0, 1.0);
    float flow = pow(sin(vUv.x * 46.0 - uTime * 2.6) * 0.5 + 0.5, 3.0);
    float heat = 0.38 + pow(crown, 2.2) * 0.58 + flow * crown * 0.06;
    vec3 col = gw_tempColor(heat) * gw_em(heat);
    gl_FragColor = vec4(col, 1.0);
  }
`

// ── the four cords, hand-set to the pendant's plan (x, y, z): y trades at every crossing so the
// over-under is strict — what crosses over goes under at the next crossing.
const HI = 0.30, LO = 0.10 // weave heights at a crossing
const CORDS = [
  // OUTER LEFT — leaves the river's left lip, swings wide, over at the first crossing,
  // under at the return, through beside the left eyelet, sweeps the pocket, crosses to the point
  [
    [-0.55, 0.14, -33.6], [-1.9, HI, -35.2], [-0.85, HI, -36.2], [0.9, LO, -37.8],
    [1.9, HI, -39.2], [1.15, HI, -40.4], [-0.4, LO, -42.2], [-2.3, 0.16, -45.0],
    [-1.4, HI, -47.8], [0.0, 0.12, -49.9],
  ],
  // INNER LEFT — under first, over centre, rings the LEFT eyelet, inner pocket line, under at the close
  [
    [-0.2, 0.12, -33.6], [-0.9, LO, -35.2], [0.0, HI, -36.9], [-0.9, HI, -38.4],
    [-1.55, LO, -39.8], [-1.1, 0.18, -41.2], [-0.55, LO, -43.4], [0.6, HI, -46.4],
    [1.0, LO, -48.4], [0.0, 0.10, -49.85],
  ],
  // INNER RIGHT — mirror of inner left; rings the RIGHT eyelet
  [
    [0.2, 0.12, -33.6], [0.9, LO, -35.2], [0.0, LO, -36.9], [0.9, HI, -38.4],
    [1.55, LO, -39.8], [1.1, 0.18, -41.2], [0.55, HI, -43.4], [-0.6, LO, -46.4],
    [-1.0, HI, -48.4], [0.0, 0.14, -49.85],
  ],
  // OUTER RIGHT — mirror of outer left
  [
    [0.55, 0.14, -33.6], [1.9, LO, -35.2], [0.85, LO, -36.2], [-0.9, HI, -37.8],
    [-1.9, LO, -39.2], [-1.15, LO, -40.4], [0.4, HI, -42.2], [2.3, 0.16, -45.0],
    [1.4, LO, -47.8], [0.0, 0.16, -49.9],
  ],
]

export default function KnotSplit({ quality = 'high' }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const material = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: cordVert, fragmentShader: cordFrag, uniforms, toneMapped: false, fog: false }),
    [uniforms]
  )
  const tubes = useMemo(() => {
    const seg = quality === 'high' ? 140 : 90
    const rad = quality === 'high' ? 12 : 8
    return CORDS.map((pts) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.35)
      return new THREE.TubeGeometry(curve, seg, R, rad, false)
    })
  }, [quality])
  const torus = useMemo(() => new THREE.TorusGeometry(0.5, 0.13, 10, 42), [])

  useFrame((state) => { if (!forge.reduced) uniforms.uTime.value = state.clock.elapsedTime })

  return (
    <group>
      {/* the four molten cords weaving the knot */}
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g} material={material} />
      ))}

      {/* THE TWO EYELETS — the circles before the mark, molten rings set flat in the dark */}
      <mesh geometry={torus} material={material} position={[-1.1, 0.14, -41.2]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={torus} material={material} position={[1.1, 0.14, -41.2]} rotation={[-Math.PI / 2, 0, 0]} />

      {/* THE MOLD — the dark stone slab the word breaks free from (lit only by the metal) */}
      <mesh position={[0, -0.72, -43.5]}>
        <boxGeometry args={[8.6, 0.55, 15]} />
        <meshStandardMaterial color="#101318" roughness={0.94} metalness={0.05} />
      </mesh>

      {/* THE POINT — every cord converges to one white-hot terminus beyond the mark */}
      <mesh position={[0, 0.13, KNOT_Z_POINT]}>
        <sphereGeometry args={[0.2, 14, 12]} />
        <meshBasicMaterial color={PAL.hot} toneMapped={false} fog={false} />
      </mesh>

      {/* the knot's own light — the cords throwing warmth on the mold and the word */}
      <pointLight position={[0, 1.7, -37.5]} intensity={20} distance={15} decay={2} color="#FFB870" />
      <pointLight position={[0, 1.2, -46]} intensity={15} distance={13} decay={2} color="#FF9A55" />
    </group>
  )
}
