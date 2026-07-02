import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { forge } from '../store.js'

/**
 * ChamberRig — the Game-of-Thrones title-sequence mechanic for the inner-page dioramas
 * (owner directive, docs/VISION-RIDE.md):
 *
 *   INTRO  — the chamber ASSEMBLES itself: its pieces rise from below and turn into place
 *            like clockwork, staggered, landing with Brutalist Snap (expo-out, no bounce).
 *   HOLD   — the rig goes completely hands-off; the chamber owns its own motion (the float).
 *   OUTRO  — on route change the assembled structure RAISES up and away (the intro's motion
 *            continued past the frame) before the next chamber assembles.
 *
 * One rig for every chamber: it staggers the chamber's top-level groups, so no room needs
 * bespoke re-animation. Transform ownership is phase-scoped — bases are captured when a
 * transition STARTS and restored exactly when it ENDS, so a chamber's own animators never
 * fight the rig while holding.
 */

const EASE = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)) // expo-out: impact, no bounce
const OUT_MS = 700 // outro length (raise-away) before the next chamber mounts
const IN_S = 1.6 // intro assembly length (seconds)

/** Collect the pieces the rig staggers: the chamber root's top-level children. */
function collectParts(root) {
  const parts = []
  for (const child of root.children) {
    // a chamber component renders one root group; stagger ITS children (the real pieces)
    if (child.children && child.children.length > 1) parts.push(...child.children)
    else parts.push(child)
  }
  return parts
}

export function ChamberRig({ children }) {
  const group = useRef()
  const state = useRef({ parts: null, bases: null, active: false, tIn: 0 })

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const st = state.current
    const a = forge.assembly
    const settled = a >= 0.999 && forge.assemblyDir === -1

    if (settled) {
      // HOLD — restore bases once, then hands-off (the chamber owns its own motion)
      if (st.active && st.parts) {
        st.parts.forEach((p, i) => {
          const b = st.bases[i]
          p.position.y = b.y
          p.rotation.y = b.ry
          if (p.visible === false) p.visible = true
        })
        st.active = false
        st.parts = null
        st.bases = null
      }
      return
    }

    // a transition is live — (re)capture bases at its start
    if (!st.active) {
      st.parts = collectParts(g)
      st.bases = st.parts.map((p) => ({ y: p.position.y, ry: p.rotation.y }))
      st.active = true
      st.tIn = 0
    }
    st.tIn += dt

    const n = st.parts.length || 1
    const dir = forge.assemblyDir // -1 intro (from below) · +1 outro (raise away)
    for (let i = 0; i < n; i++) {
      const p = st.parts[i]
      const b = st.bases[i]
      // clockwork stagger — each piece seats a beat after the one before it
      const local = THREE.MathUtils.clamp(a * (1 + 0.09 * n) - i * 0.09, 0, 1)
      const e = EASE(local)
      const drop = (1 - e) * (3.2 + (i % 3) * 1.4) // varied throws read as machinery, not a sheet
      p.position.y = b.y + drop * (dir === 1 ? 1 : -1)
      // the gear turn: pieces yaw into place; alternating sense = interlocking cogs
      p.rotation.y = b.ry + (1 - e) * 0.7 * (i % 2 === 0 ? 1 : -1)
      p.visible = local > 0.001
    }
  })

  return <group ref={group}>{children}</group>
}

/**
 * ChamberStage — the transition manager. Owns which chamber is SHOWN (kept mounted through
 * its outro) and drives forge.assembly through out → swap → in on route change.
 * `render(route)` returns the chamber JSX for a route (camera + scene).
 */
export function ChamberStage({ route, render }) {
  const [shown, setShown] = useState(route)
  const phase = useRef('hold') // 'hold' | 'out' | 'in'

  // route changed → play the outro on the CURRENT chamber, then swap + assemble the next
  useEffect(() => {
    if (route === shown) return
    if (forge.reduced) { forge.assembly = 1; forge.assemblyDir = -1; setShown(route); return }
    phase.current = 'out'
    forge.assemblyDir = 1
    const t = setTimeout(() => {
      setShown(route)
      forge.assembly = 0
      forge.assemblyDir = -1
      phase.current = 'in'
    }, OUT_MS)
    return () => clearTimeout(t)
  }, [route, shown])

  // first mount of a chamber route: assemble from nothing
  useEffect(() => {
    if (forge.reduced) { forge.assembly = 1; forge.assemblyDir = -1; return }
    forge.assembly = 0
    forge.assemblyDir = -1
    phase.current = 'in'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const d = Math.min(0.05, dt || 0.016)
    if (phase.current === 'in') {
      forge.assembly = Math.min(1, forge.assembly + d / IN_S)
      if (forge.assembly >= 1) phase.current = 'hold'
    } else if (phase.current === 'out') {
      // raise-away runs faster than the build (leaving is decisive, arriving is ceremony)
      forge.assembly = Math.max(0, forge.assembly - d / (OUT_MS / 1000))
    }
  })

  return <ChamberRig key={shown}>{render(shown)}</ChamberRig>
}
