import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { forge } from '../store.js'
import { COPY } from '../brand.js'
import { buildChannelGeometry, channelVert, channelFrag } from './channel.js'
import ChannelCopy from './ChannelCopy.jsx'
import LetterCast from './LetterCast.jsx'
import ForgeSplit, { CHANNELS, getChannelPose } from './ForgeSplit.jsx'

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

// ── journey timeline (fractions of total scroll) ──
const RIDE_END = 0.46
const SPLIT_END = 0.86

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
        1.6 - t * 6.2, // shallow descent — a grade that holds the metal
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

// ── the one camera, across the three acts ──
function JourneyCamera({ curve, onFork }) {
  const { camera } = useThree()
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const P = useMemo(() => new THREE.Vector3(), [])
  const TAN = useMemo(() => new THREE.Vector3(), [])
  const LOOK = useMemo(() => new THREE.Vector3(), [])
  const DES = useMemo(() => new THREE.Vector3(), [])
  const forkRef = useRef(-2)

  useFrame(() => {
    const s = THREE.MathUtils.clamp(forge.scroll, 0, 0.999)

    if (s < RIDE_END) {
      // BEAT 1-3 — ride above the trough, looking down INTO the river, reading the banks
      if (forkRef.current !== -1) { forkRef.current = -1; onFork(-1) }
      const t = THREE.MathUtils.clamp((s / RIDE_END) * 0.95, 0.001, 0.95)
      curve.getPointAt(t, P)
      curve.getTangentAt(t, TAN).normalize()
      // ride well above and behind, looking ahead and gently down so the river reads inside
      // its banks (not nose-diving into the near wall as the channel meanders)
      DES.copy(P).addScaledVector(TAN, -4.3).addScaledVector(up, 3.1)
      camera.position.lerp(DES, 0.1)
      LOOK.copy(P).addScaledVector(TAN, 4.2).addScaledVector(up, -0.7)
      camera.lookAt(LOOK)
    } else if (s < SPLIT_END) {
      // BEAT 4 — angle THROUGH each fork in turn as its tablet is told
      const f = (s - RIDE_END) / (SPLIT_END - RIDE_END)
      const ff = f * 4
      const fork = THREE.MathUtils.clamp(Math.floor(ff), 0, 3)
      if (forkRef.current !== fork) { forkRef.current = fork; onFork(fork) }
      const pose = getChannelPose(fork)
      DES.set(pose.position[0], pose.position[1], pose.position[2]).add(SPLIT_POS)
      LOOK.set(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]).add(SPLIT_POS)
      // Brutalist Snap: arrive fast at each new fork, then settle to dwell on it
      const local = ff - fork
      const k = local < 0.22 ? 0.2 : 0.07
      camera.position.lerp(DES, k)
      camera.lookAt(LOOK)
    } else {
      // BEAT 5 — the cast: hold on the GAELWORX letterforms
      if (forkRef.current !== -3) { forkRef.current = -3; onFork(-1) }
      DES.set(FINALE_POS[0], FINALE_POS[1] + 0.3, FINALE_POS[2] + 7.5)
      camera.position.lerp(DES, 0.08)
      LOOK.set(FINALE_POS[0], FINALE_POS[1], FINALE_POS[2])
      camera.lookAt(LOOK)
    }
  })
  return null
}

export default function ForgeJourney() {
  const curve = useMemo(() => makeCurve(), [])
  const geo = useMemo(
    () => buildChannelGeometry(curve, 320, { width: 2.0, floorFrac: 0.5, wallH: 0.55 }),
    [curve]
  )
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uTemp: { value: 0.5 } }), [])
  const [activeFork, setActiveFork] = useState(-1)
  const splitPos = useMemo(() => SPLIT_POS.toArray(), [])

  useFrame((state, dt) => {
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uTemp.value += (forge.temperature - uniforms.uTemp.value) * Math.min(1, (dt || 0.016) * 2)
  })

  return (
    <>
      <JourneyCamera curve={curve} onFork={setActiveFork} />

      {/* beats 1-3: the open molten trough + carved bank tablets */}
      <mesh geometry={geo}>
        <shaderMaterial
          vertexShader={channelVert}
          fragmentShader={channelFrag}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>
      <ChannelCopy curve={curve} items={TABLETS} offset={1.55} width={2.4} />

      {/* beat 4: the four-fork Celtic split + one branch tablet per fork */}
      <group position={splitPos}>
        <ForgeSplit active={activeFork} intensity={1} />
        {FORK_TABLETS.map((items, i) => (
          <ChannelCopy key={i} curve={CHANNELS[i]} items={items} offset={1.05} width={2.1} />
        ))}
      </group>

      {/* beat 5: the cast — GAELWORX, the A and E eternal */}
      <LetterCast progress={1} position={FINALE_POS} size={1.0} />
    </>
  )
}
