import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { makeBasaltMaterial } from './basalt.js'

/**
 * Occluders — near-camera dark parallax rocks. Low-poly displaced boulders sitting just off the
 * camera path at ride height, so a dark silhouette edge wipes the frame as you pass — the
 * foreground layer that sells speed, depth and scale (film blocking, not set dressing).
 * One InstancedMesh, near-silhouette basalt (faint cold rim only).
 *
 * @param {object} props
 * @param {'high'|'mobile'} [props.quality='high']  8 rocks on high, 5 on mobile
 */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function Occluders({ quality = 'high' }) {
  const count = quality === 'high' ? 8 : 5

  const material = useMemo(
    () => makeBasaltMaterial({ grain: 1.3, grainScale: 18, serpentine: 0.3 }),
    []
  )
  useEffect(() => () => material.dispose(), [material])

  const geometry = useMemo(() => {
    const rnd = mulberry32(777)
    const g = new THREE.IcosahedronGeometry(0.5, 1)
    const pos = g.getAttribute('position')
    const nrm = g.getAttribute('normal')
    const v = new THREE.Vector3()
    const n = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      n.fromBufferAttribute(nrm, i)
      v.addScaledVector(n, (rnd() - 0.5) * 0.22)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const ref = (mesh) => {
    if (!mesh) return
    const rnd = mulberry32(4242)
    const M = new THREE.Matrix4()
    const P = new THREE.Vector3()
    const Q = new THREE.Quaternion()
    const E = new THREE.Euler()
    const S = new THREE.Vector3()
    // rocks sit in the GAPS between story tablets (tablet z ≈ -2.1,-6.7,-11.3,-16.8,-21.4,-26,
    // -30.7) so a boulder never parks on copy during its reveal window
    const Z = [-4.4, -9, -14.05, -19.1, -23.7, -28.35, -33, -37]
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1
      P.set(side * (1.0 + rnd() * 0.3), 0.9 + rnd() * 0.5, Z[i])
      E.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI)
      Q.setFromEuler(E)
      const s = 0.6 + rnd() * 0.8
      S.set(s, s * (0.8 + rnd() * 0.4), s)
      M.compose(P, Q, S)
      mesh.setMatrixAt(i, M)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
  }

  return <instancedMesh ref={ref} args={[geometry, material, count]} />
}
