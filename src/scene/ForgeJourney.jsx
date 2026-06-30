import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { forge } from '../store.js'
import { COPY } from '../brand.js'
import ChannelFloor from './channelFloor.jsx'
import ChannelCopy from './ChannelCopy.jsx'
import ForgeAtmosphere from './ForgeAtmosphere.jsx'
import LetterCast from './LetterCast.jsx'

/**
 * ForgeJourney — the home journey as a real 4-cord CELTIC PLAIT of molten metal, carved into the
 * basalt forge floor and read top-down. Four strands (the four services) weave over-under down
 * the floor, converging at the mouth and again at the cast. Scroll snaps a top-down camera from
 * beat to beat: the story copy floats beside the plait; each service beat lights its own strand;
 * the finale gathers the four and pours GAELWORX, the A and E eternal.
 */

// ── the plait geometry — a real four-cord Celtic braid (over-under via the cos-phase height) ──
const Z1 = -32 // the plait runs from z=0 (the mouth) to z=Z1 (the cast)
const A = 3.1 // weave amplitude
const W = (2 * Math.PI) / 9.0 // one weave cycle per ~9 units of travel
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
const env = (t) => Math.min(smooth(0, 0.13, t), smooth(1, 0.87, t)) // strands converge at both ends
const phase = (k, t) => W * (-Z1 * t) + (k * Math.PI) / 2 // quarter-phase offset per strand
function strandCurve(k) {
  const pts = []
  for (let i = 0; i <= 30; i++) {
    const t = i / 30
    pts.push(new THREE.Vector3(A * env(t) * Math.sin(phase(k, t)), 0, Z1 * t))
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
}
const STRAND_CURVES = [0, 1, 2, 3].map(strandCurve)
// the carved strands, each with its over-under height (cos of the same phase)
const STRANDS = [0, 1, 2, 3].map((k) => ({ curve: STRAND_CURVES[k], depth: (t) => Math.cos(phase(k, t)) }))
// a straight centre line the story copy mounts to
const CENTER = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, Z1 * 0.5), new THREE.Vector3(0, 0, Z1)],
  false, 'catmullrom', 0.5
)
const FINALE_POS = [0, 0.7, Z1 - 3]

// ── the copy ── story beats float beside the plait; service beats sit on their strand
const TABLETS = [
  { t: 0.10, side: -1, kicker: 'The Reframe', head: 'AUTOMATIC EXECUTION', body: 'You don’t need artificial intelligence. You need the work to run itself.' },
  { t: 0.24, side: 1, kicker: 'The Enemy', head: 'WE BILL FOR EXECUTION', body: 'Agencies bill for motion. We bill for execution — whether it ships.' },
  { t: 0.36, side: -1, kicker: '01 · The Clan', head: 'FOR OPERATORS', body: 'GAELWORX runs this exact system on our own shops. We built it for us. Now it’s yours.' },
  { t: 0.48, side: 1, kicker: 'The Proof', head: 'IT SHIPS THEN EARNS', body: 'No pilots that rot in phase two. It goes live, runs the work, pays for itself.' },
]
const B = COPY.arsenal.branches
const SERVICES = [
  { k: 0, t: 0.60, side: -1, kicker: 'GW–01 · Voice', head: 'EVERY CALL ANSWERED', body: B[0].line },
  { k: 1, t: 0.68, side: 1, kicker: 'GW–02 · Software', head: 'YOU OWN THE CODE', body: B[1].line },
  { k: 2, t: 0.76, side: -1, kicker: 'GW–03 · Automations', head: 'IT RUNS ITSELF', body: B[2].line },
  { k: 3, t: 0.84, side: 1, kicker: 'GW–04 · Web', head: 'BUILT TO BOOK', body: B[3].line },
]

// ── the camera: discrete top-down SHOTS that SNAP from beat to beat ──
function buildShots() {
  const up = new THREE.Vector3(0, 1, 0)
  const sideN = (T, sign) => new THREE.Vector3(-T.z, 0, T.x).normalize().multiplyScalar(sign)
  const shots = []
  // story beats — a high top-down over the whole plait, copy floating to one side
  for (const tab of TABLETS) {
    const P = CENTER.getPointAt(tab.t)
    const T = CENTER.getTangentAt(tab.t).normalize()
    const N = sideN(T, tab.side < 0 ? -1 : 1)
    shots.push({
      pos: P.clone().addScaledVector(up, 9.8).addScaledVector(N, 3.4).addScaledVector(T, -1.6),
      target: P.clone().addScaledVector(N, 1.6),
      strand: -1,
    })
  }
  // service beats — a top-down on one strand at its outer excursion; that strand lights
  for (const sv of SERVICES) {
    const c = STRAND_CURVES[sv.k]
    const P = c.getPointAt(sv.t)
    const T = c.getTangentAt(sv.t).normalize()
    const N = sideN(T, sv.side < 0 ? -1 : 1)
    shots.push({
      pos: P.clone().addScaledVector(up, 7.4).addScaledVector(N, 2.6).addScaledVector(T, -1.1),
      target: P.clone().addScaledVector(N, 0.8),
      strand: sv.k,
    })
  }
  // the cast — the one head-on, eye-level beat (the brief's overhead -> eye-level reveal)
  shots.push({
    pos: new THREE.Vector3(FINALE_POS[0], FINALE_POS[1] + 1.6, FINALE_POS[2] + 7.0),
    target: new THREE.Vector3(FINALE_POS[0], FINALE_POS[1], FINALE_POS[2]),
    strand: -1,
  })
  return shots
}

function JourneyCamera({ onStrand }) {
  const { camera } = useThree()
  const shots = useMemo(() => buildShots(), [])
  const look = useMemo(() => new THREE.Vector3(), [])
  const sRef = useRef(-2)
  const initRef = useRef(false)

  useFrame((state) => {
    const s = THREE.MathUtils.clamp(forge.scroll, 0, 0.9999)
    const idx = THREE.MathUtils.clamp(Math.floor(s * shots.length), 0, shots.length - 1)
    const shot = shots[idx]
    if (sRef.current !== shot.strand) { sRef.current = shot.strand; onStrand(shot.strand) }
    if (!initRef.current) { camera.position.copy(shot.pos); look.copy(shot.target); initRef.current = true }
    // fast lerp = snap-and-hold (Brutalist Snap)
    camera.position.lerp(shot.pos, 0.16)
    look.lerp(shot.target, 0.16)
    // Atmospheric Drift — a slow living sway so a held shot never sits dead
    const t = forge.reduced ? 0 : state.clock.elapsedTime
    camera.position.x += Math.sin(t * 0.13) * 0.26 + Math.sin(t * 0.22) * 0.10
    camera.position.y += Math.sin(t * 0.17) * 0.14
    camera.position.z += Math.cos(t * 0.11) * 0.22
    camera.lookAt(look.x + Math.sin(t * 0.15) * 0.12, look.y, look.z + Math.cos(t * 0.12) * 0.12)
  })
  return null
}

export default function ForgeJourney() {
  const [activeStrand, setActiveStrand] = useState(-1)

  return (
    <>
      <JourneyCamera onStrand={setActiveStrand} />

      {/* the four-cord Celtic plait of molten metal, woven over-under, carved into the basalt
          forge floor and read top-down (the metal is the only light) */}
      <ChannelFloor strands={STRANDS} activeStrand={activeStrand} half={0.4} margin={4.5} />

      {/* living embers + sparks rising off the molten, drawn by the heat */}
      {!forge.reduced && <ForgeAtmosphere />}

      {/* story copy floats beside the plait (Reframe · Enemy · Clan · Proof) */}
      <ChannelCopy curve={CENTER} items={TABLETS} offset={3.4} width={2.4} />

      {/* one service beat per strand, lit when its strand is told */}
      {SERVICES.map((sv) => (
        <ChannelCopy
          key={sv.k}
          curve={STRAND_CURVES[sv.k]}
          items={[{ t: sv.t, side: sv.side, kicker: sv.kicker, head: sv.head, body: sv.body }]}
          offset={0.9}
          width={2.0}
          active={activeStrand === sv.k}
        />
      ))}

      {/* the cast — GAELWORX, the A and E eternal */}
      <LetterCast progress={1} position={FINALE_POS} size={1.0} />
    </>
  )
}
