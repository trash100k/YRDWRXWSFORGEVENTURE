import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, rampColor } from './palette.js'

/**
 * FlowLights — the molten river becomes an ACTUAL light source. A small entourage of warm point
 * lights parented to the camera's ride window, sitting low over the metal; each frame their color
 * + intensity are re-sampled from the SAME cooling curve the river shader uses (white-hot at the
 * source → dark iron deep), so the light literally dies around the viewer as they descend.
 * Plus ONE faint cold directional rim from deep down-channel — prism tops and back arrises catch a
 * corpse-cold edge against the void (the art bible's "villain color").
 *
 * No shadow maps, no RectArea/Spot — plain PointLights + one DirectionalLight (cheapest on mobile).
 * All mutation happens in one useFrame on refs; zero React churn.
 *
 * @param {object} props
 * @param {'high'|'mobile'} [props.quality='high']  4 warm points on high, 3 on mobile
 * @param {number} [props.len=42]  channel length (drives the cooling curve)
 */
export default function FlowLights({ quality = 'high', len = 42 }) {
  const n = quality === 'high' ? 4 : 3
  const refs = useRef([])
  const tmp = useMemo(() => new THREE.Color(), [])

  useFrame((state) => {
    const camZ = state.camera.position.z
    for (let i = 0; i < n; i++) {
      const L = refs.current[i]
      if (!L) continue
      const zi = camZ + 1.0 - i * 3.5 // window [camZ+1 .. camZ-9.5], rides with the descent
      const along = THREE.MathUtils.clamp(-zi / len, 0, 1)
      const t = THREE.MathUtils.lerp(0.86, 0.2, along) // matches the river's baseT cooling
      L.position.set(0, 0.4, zi)
      L.color.copy(rampColor(t, tmp))
      L.intensity = 14 * t * t + 3
    }
  })

  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <pointLight key={i} ref={(r) => (refs.current[i] = r)} distance={8} decay={2} intensity={0} />
      ))}
      {/* the one cold light — shines up-channel so silhouettes get a corpse-cold rim vs the void */}
      <directionalLight color={PAL.steel} intensity={0.6} position={[2, 10, -60]} />
    </>
  )
}
