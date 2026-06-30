import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { forge } from '../store.js'
import { COPY } from '../brand.js'
import ChannelFloor from './channelFloor.jsx'
import ChannelCopy from './ChannelCopy.jsx'
import LetterCast from './LetterCast.jsx'
import ForgeSplit, { CHANNELS } from './ForgeSplit.jsx'

/**
 * ForgeJourney — the home experience as one scroll-driven descent through the forge:
 *   beat 1-3  ride above an OPEN MOLTEN TROUGH (a river of metal between basalt banks),
 *             reading carved Clan-Voice tablets on the banks
 *   beat 4    the Celtic SPLIT — the camera angles THROUGH each of the four forks in turn
 *             (Voice · Software · Automations · Web) as that branch's tablet is told
 *   beat 5    the CAST — the metal pours into GAELWORX; all cools to iron but the A and E
 *
 * The channel runs at a shallow grade (a real launder holds its metal), meandering across
 * the dark floor and descending gently, then pours into the splitting chamber below.
 */

// acts stacked so the pour is continuous: the river ends at ~(0,-4.6,-19); the split hangs
// its feeder trunk (local +6) there; the cast sits below the split's rejoin trunk.
const SPLIT_POS = new THREE.Vector3(0, -10.6, -19)
const FINALE_POS = [0, -28, -19]

// ── the channel path — a gentle meander across the floor, descending just enough to flow ──
function makeCurve() {
  const pts = []
  const N = 12
  for (let i = 0; i <= N; i++) {
    const t = i / N
    pts.push(
      new THREE.Vector3(
        Math.sin(t * Math.PI * 3.0) * 4.2, // meander across the floor, recentred at the end
        0.0, // flat — this is the forge FLOOR, read top-down (the channel is carved into it)
        -t * 19.0 // travel forward into the dark
      )
    )
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
}

// Beat 3 — the story carved on the banks (Reframe · Enemy · Clan · Proof).
const TABLETS = [
  { t: 0.16, side: -1, kicker: 'The Reframe', head: 'AUTOMATIC EXECUTION', body: 'You don’t need artificial intelligence. You need the work to run itself.' },
  { t: 0.36, side: 1, kicker: 'The Enemy', head: 'WE BILL FOR EXECUTION', body: 'Agencies bill for motion. We bill for execution — whether it ships.' },
  { t: 0.56, side: -1, kicker: '01 · The Clan', head: 'FOR OPERATORS', body: 'GAELWORX runs this exact system on our own shops. We built it for us. Now it’s yours.' },
  { t: 0.78, side: 1, kicker: 'The Proof', head: 'IT SHIPS THEN EARNS', body: 'No pilots that rot in phase two. It goes live, runs the work, pays for itself.' },
]

// Beat 4 — one tablet per fork, the branch's pain line, mounted outboard on that fork.
const B = COPY.arsenal.branches
const FORK_TABLETS = [
  [{ t: 0.34, side: -1, kicker: 'GW–01 · Voice', head: 'EVERY CALL ANSWERED', body: B[0].line }],
  [{ t: 0.34, side: -1, kicker: 'GW–02 · Software', head: 'YOU OWN THE CODE', body: B[1].line }],
  [{ t: 0.34, side: 1, kicker: 'GW–03 · Automations', head: 'IT RUNS ITSELF', body: B[2].line }],
  [{ t: 0.34, side: 1, kicker: 'GW–04 · Web', head: 'BUILT TO BOOK', body: B[3].line }],
]

// ── the camera: discrete top-down SHOTS that SNAP from one to the next ──
// Each copy beat gets its own high, top-down framing of the channel. Scroll selects the shot;
// the camera snaps to it (a fast move that lands and holds — Brutalist Snap, no glide) and the
// beat's copy turns to face it. The angle CHANGES to bring the next block up.
function buildShots(curve) {
  const up = new THREE.Vector3(0, 1, 0)
  const sideN = (T, sign) => new THREE.Vector3(-T.z, 0, T.x).normalize().multiplyScalar(sign)
  const shots = []

  // ride beats — a high top-down 3/4 over each bank tablet
  for (const tab of TABLETS) {
    const P = curve.getPointAt(tab.t)
    const T = curve.getTangentAt(tab.t).normalize()
    const N = sideN(T, tab.side < 0 ? -1 : 1)
    shots.push({
      pos: P.clone().addScaledVector(up, 5.2).addScaledVector(N, 2.7).addScaledVector(T, -0.6),
      target: P.clone().addScaledVector(N, 0.8),
      fork: -1,
    })
  }
  // split beats — a top-down over each fork's widest, most readable point
  for (let i = 0; i < 4; i++) {
    const P = CHANNELS[i].getPointAt(0.34).clone().add(SPLIT_POS)
    const T = CHANNELS[i].getTangentAt(0.34).clone().normalize()
    const N = sideN(T, i < 2 ? -1 : 1)
    shots.push({
      pos: P.clone().addScaledVector(up, 5.8).addScaledVector(N, 2.2).addScaledVector(T, -0.9),
      target: P.clone().addScaledVector(N, 0.95).addScaledVector(up, 0.2),
      fork: i,
    })
  }
  // the cast — the one head-on beat
  shots.push({
    pos: new THREE.Vector3(FINALE_POS[0], FINALE_POS[1] + 1.6, FINALE_POS[2] + 7.0),
    target: new THREE.Vector3(FINALE_POS[0], FINALE_POS[1], FINALE_POS[2]),
    fork: -1,
  })
  return shots
}

function JourneyCamera({ curve, onFork }) {
  const { camera } = useThree()
  const shots = useMemo(() => buildShots(curve), [curve])
  const look = useMemo(() => new THREE.Vector3(), [])
  const forkRef = useRef(-2)
  const initRef = useRef(false)

  useFrame(() => {
    const s = THREE.MathUtils.clamp(forge.scroll, 0, 0.9999)
    const idx = THREE.MathUtils.clamp(Math.floor(s * shots.length), 0, shots.length - 1)
    const shot = shots[idx]
    if (forkRef.current !== shot.fork) { forkRef.current = shot.fork; onFork(shot.fork) }
    if (!initRef.current) { camera.position.copy(shot.pos); look.copy(shot.target); initRef.current = true }
    // fast lerp = snap-and-hold: the target is constant within a beat, so the camera lands on
    // the new framing and sits still until scroll crosses into the next shot
    camera.position.lerp(shot.pos, 0.16)
    look.lerp(shot.target, 0.16)
    camera.lookAt(look)
  })
  return null
}

export default function ForgeJourney() {
  const curve = useMemo(() => makeCurve(), [])
  const [activeFork, setActiveFork] = useState(-1)
  const splitPos = useMemo(() => SPLIT_POS.toArray(), [])

  return (
    <>
      <JourneyCamera curve={curve} onFork={setActiveFork} />

      {/* beats 1-3: the molten channel CARVED into the basalt forge floor, read top-down */}
      <ChannelFloor curve={curve} half={0.6} />
      <ChannelCopy curve={curve} items={TABLETS} offset={1.55} width={2.4} />

      {/* beat 4: the four-fork Celtic split + one branch tablet per fork */}
      <group position={splitPos}>
        <ForgeSplit active={activeFork} intensity={1} />
        {FORK_TABLETS.map((items, i) => (
          <ChannelCopy key={i} curve={CHANNELS[i]} items={items} offset={1.05} width={2.1} active={activeFork === i} />
        ))}
      </group>

      {/* beat 5: the cast — GAELWORX, the A and E eternal */}
      <LetterCast progress={1} position={FINALE_POS} size={1.0} />
    </>
  )
}
