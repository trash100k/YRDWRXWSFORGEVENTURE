import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { makeBasaltMaterial, applyOghamRelief, applyInstancedUvOffset } from './basalt.js'

/**
 * BasaltPrisms — REAL columnar basalt walls (Giant's Causeway): both channel walls as ONE
 * InstancedMesh of hexagonal prisms, jittered per column so no two match, staggered two rows deep
 * with a broken-skyline top line. This replaces the flat painted wall boxes: actual 3D silhouettes
 * against the haze, actual faces whose carved relief (basalt.js) catches the river's raking light.
 *
 * One draw call. Deterministic layout (seeded PRNG) so QA screenshots are stable.
 *
 * @param {object} props
 * @param {'high'|'mobile'} [props.quality='high']  2 rows deep on high, 1 on mobile
 * @param {number} [props.len=42]    channel length (z 0 → -len)
 * @param {number} [props.halfW=0.7] molten half-width (walls sit just outside)
 * @param {number} [props.topY=0.42] nominal wall-top height above the molten
 */

// mulberry32 — tiny seeded PRNG; the layout must be identical across mounts/builds for QA
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const R = 0.42                            // prism radius (flat-to-flat ≈ 0.727)
const PITCH = R * Math.sqrt(3) * 0.92     // row pitch along z (~0.67, 8% overlap → no gaps)

export default function BasaltPrisms({ quality = 'high', len = 42, halfW = 0.7, topY = 0.42 }) {
  const rows = quality === 'high' ? 2 : 1
  const cols = Math.ceil((len + 2) / PITCH) // covers z +1 … -(len+1)

  const material = useMemo(() => {
    const m = makeBasaltMaterial({ grain: 1.1, grainScale: 30, serpentine: 0.55, roughness: 0.94, shimmer: 0.03 })
    applyOghamRelief(m, { strength: 0.9, scale: 1.0, mode: 'ogham', darkenInGroove: 0.65 })
    applyInstancedUvOffset(m)
    return m
  }, [])
  useEffect(() => () => material.dispose(), [material])

  const { geometry, count, matrices, uvOff } = useMemo(() => {
    const rnd = mulberry32(1337)
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false)
    const count = cols * rows * 2
    const matrices = new Float32Array(count * 16)
    const uvOff = new Float32Array(count * 2)
    const M = new THREE.Matrix4()
    const P = new THREE.Vector3()
    const Q = new THREE.Quaternion()
    const E = new THREE.Euler()
    const S = new THREE.Vector3()
    let i = 0
    for (const side of [-1, 1]) {
      for (let row = 0; row < rows; row++) {
        const baseX = side * (halfW + 0.15 + R + row * R * 1.5)
        const zOff = row * (PITCH / 2)
        for (let c = 0; c < cols; c++) {
          const h = 6.5 + rnd() * 2.5
          let top = topY + rnd() ** 2 * 1.1 + row * 0.35
          if (Math.floor(rnd() * 8) === 0) top += 1.6 // the occasional standing sentinel
          P.set(
            baseX + side * (rnd() - 0.5) * 0.12,
            top - h / 2,
            1 - c * PITCH - zOff + (rnd() - 0.5) * 0.24
          )
          E.set((rnd() - 0.5) * 0.06, rnd() * (Math.PI / 3), (rnd() - 0.5) * 0.06)
          Q.setFromEuler(E)
          const rr = (0.85 + rnd() * 0.35) * R
          S.set(rr, h, rr)
          M.compose(P, Q, S)
          M.toArray(matrices, i * 16)
          uvOff[i * 2] = rnd()
          uvOff[i * 2 + 1] = rnd()
          i++
        }
      }
    }
    return { geometry, count, matrices, uvOff }
  }, [cols, rows, halfW, topY])
  useEffect(() => () => geometry.dispose(), [geometry])

  // wire matrices + the per-instance UV offset once the InstancedMesh exists
  const ref = (mesh) => {
    if (!mesh) return
    mesh.instanceMatrix.array.set(matrices)
    mesh.instanceMatrix.needsUpdate = true
    if (!mesh.geometry.getAttribute('iUvOff')) {
      mesh.geometry.setAttribute('iUvOff', new THREE.InstancedBufferAttribute(uvOff, 2))
    }
    mesh.frustumCulled = false
  }

  return <instancedMesh ref={ref} args={[geometry, material, count]} />
}
