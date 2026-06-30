import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL } from './palette.js'
import Embers from './Embers.jsx'

/**
 * ForgeConcept — posed, cinematic CONCEPT renders of the target look (not the live app).
 * The ominous basalt forge, a winding molten channel receding into the dark, lit only by
 * the metal. Reached at /concept?shot=N to screenshot the art-direction frames.
 */

function makeCurve() {
  const pts = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    pts.push(new THREE.Vector3(Math.sin(t * Math.PI * 1.3) * 3.2, 0.0, -t * 42))
  }
  return new THREE.CatmullRomCurve3(pts)
}

const POSES = [
  { pos: [5, 4.2, 8], look: [0, 0, -14] },   // 0 establishing
  { pos: [2.2, 0.9, 4], look: [-1, 0.4, -16] }, // 1 riding low
  { pos: [-6.5, 6.5, 5], look: [0, 0, -16] }, // 2 high three-quarter
  { pos: [0, 1.3, 1.5], look: [1.2, 0.5, -20] }, // 3 down the throat
]

function CameraPose() {
  const camera = useThree((s) => s.camera)
  const shot = useMemo(() => {
    const m = typeof window !== 'undefined' && window.location.search.match(/shot=(\d)/)
    return m ? Math.min(+m[1], POSES.length - 1) : 0
  }, [])
  useEffect(() => {
    const p = POSES[shot]
    camera.position.set(p.pos[0], p.pos[1], p.pos[2])
    camera.lookAt(p.look[0], p.look[1], p.look[2])
    camera.fov = 47
    camera.updateProjectionMatrix()
  }, [camera, shot])
  return null
}

export default function ForgeConcept() {
  const curve = useMemo(() => makeCurve(), [])
  const moltenGeo = useMemo(() => new THREE.TubeGeometry(curve, 260, 0.5, 12, false), [curve])
  const lights = useMemo(() => {
    const arr = []
    for (let i = 0; i < 7; i++) {
      const p = curve.getPointAt(Math.min(i / 6, 1))
      arr.push([p.x, p.y + 0.6, p.z])
    }
    return arr
  }, [curve])

  return (
    <>
      <CameraPose />
      <fogExp2 attach="fog" args={[PAL.void, 0.05]} />
      <ambientLight intensity={0.05} color="#1a2230" />

      {/* the molten channel — emissive, the only real light */}
      <mesh geometry={moltenGeo}>
        <meshStandardMaterial color={PAL.crimsonDeep} emissive={PAL.ember} emissiveIntensity={3.4} roughness={0.35} toneMapped={false} />
      </mesh>
      {lights.map((p, i) => (
        <pointLight key={i} position={p} color={PAL.ember} intensity={7} distance={11} decay={2} />
      ))}

      {/* basalt floor + flanking cavern walls (lit only by the metal) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, -18]}>
        <planeGeometry args={[70, 90]} />
        <meshStandardMaterial color="#0b0d11" roughness={0.96} metalness={0.05} />
      </mesh>
      <mesh position={[-8, 5, -18]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[90, 18]} />
        <meshStandardMaterial color="#090b0f" roughness={1} />
      </mesh>
      <mesh position={[8, 5, -18]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[90, 18]} />
        <meshStandardMaterial color="#090b0f" roughness={1} />
      </mesh>
      {/* a low back ridge so the channel reads as descending into a cavern */}
      <mesh position={[0, 3, -44]}>
        <planeGeometry args={[40, 22]} />
        <meshStandardMaterial color="#070809" roughness={1} />
      </mesh>

      <Embers />
    </>
  )
}
