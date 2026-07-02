import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeBasaltMaterial, applyOghamRelief } from './basalt.js'

/**
 * ArchRibs — trapezoidal corbelled portal ribs spanning the channel (AESTHETIC-DIRECTION §5:
 * wider-base trapezoid, corbel steps under the lintel), instanced down the descent and growing
 * slightly as they recede so the fog sinks the far ones into the void — the Moria
 * "towering verticals / endless pillars" scale cue. One merged rib geometry, one InstancedMesh.
 *
 * @param {object} props
 * @param {'high'|'mobile'} [props.quality='high']  4 ribs on high, 3 on mobile
 */
export default function ArchRibs({ quality = 'high' }) {
  const count = quality === 'high' ? 4 : 3

  const material = useMemo(() => {
    const m = makeBasaltMaterial({ grain: 0.9, grainScale: 22, serpentine: 0.4 })
    applyOghamRelief(m, { strength: 0.6, scale: 3.0, mode: 'knot' })
    return m
  }, [])
  useEffect(() => () => material.dispose(), [material])

  const geometry = useMemo(() => {
    const parts = []
    const leg = (side) => {
      const g = new THREE.BoxGeometry(0.55, 5.2, 0.7)
      g.rotateZ(side * THREE.MathUtils.degToRad(10)) // legs tilt INWARD — wider base (trapezoid law)
      g.translate(side * 2.6, 2.0, 0) // legs clear of the ride line → briefer frame wipes
      return g
    }
    parts.push(leg(-1), leg(1))
    const lintel = new THREE.BoxGeometry(4.4, 0.7, 0.7)
    lintel.translate(0, 4.7, 0)
    parts.push(lintel)
    for (const side of [-1, 1]) {
      const corbel = new THREE.BoxGeometry(0.9, 0.35, 0.7)
      corbel.translate(side * 1.7, 4.2, 0)
      parts.push(corbel)
    }
    return mergeGeometries(parts)
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  // rib planes sit in the GAPS between story tablets (tablet z ≈ -2.1,-6.7,-11.3,-16.8,-21.4,
  // -26,-30.7) so a leg never blocks copy during its reveal window
  const Z = [-4.5, -13.8, -23.5, -33]
  const ref = (mesh) => {
    if (!mesh) return
    const M = new THREE.Matrix4()
    for (let i = 0; i < count; i++) {
      const s = 1.0 + i * 0.05 // forced perspective: far ribs slightly larger
      M.makeScale(s, s, s).setPosition(0, 0, Z[i])
      mesh.setMatrixAt(i, M)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
  }

  return <instancedMesh ref={ref} args={[geometry, material, count]} />
}
