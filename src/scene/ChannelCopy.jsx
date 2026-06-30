import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { PAL } from './palette.js'
import { FONT_DISPLAY, FONT_BODY } from './fonts.js'
import { forge } from '../store.js'

/**
 * ChannelCopy — the STORY ON THE CHANNEL WALLS. Stone tablets / carved text mounted
 * beside the molten channel; the camera reads them as it rides down the pour.
 *
 * Each item is a self-contained block (kicker · head · body) anchored to the channel
 * wall at its `t` along the curve, pushed out to the left/right `side`, and turned to
 * face the riding camera (so the carving always reads square-on). A dark Irish-basalt
 * backing slab sits behind the text for legibility over the dark forge; the kicker rule
 * glows ember (>1.0 → the shared bloom catches it). Reveal is a per-block proximity
 * fade as the camera approaches/passes — no heavy motion, reduced-motion safe.
 *
 * Brand law: within head/kicker, the FIRST `A` and FIRST `E` of each WORD-run ignite to
 * eternal white-gold divine fire and radiate (see igniteRanges). One A + one E per word.
 *
 * Renders INSIDE the existing <Canvas>. No own renderer, no EXR, modest geometry.
 *
 * @typedef {Object} CopyItem
 * @property {number} t       0..1 position along the curve where the tablet mounts
 * @property {-1|1}  side     -1 = left wall, +1 = right wall
 * @property {string} [kicker] short overline label (Clan-Voice, e.g. "CHAPTER I")
 * @property {string} head    the headline (short, ALL-CAPS reads as carved)
 * @property {string} [body]  one or two short lines of supporting copy
 *
 * @param {Object} props
 * @param {THREE.CatmullRomCurve3} props.curve   the channel path the camera rides
 * @param {CopyItem[]} [props.items]             tablets to mount along the curve
 * @param {number} [props.offset=1.55]           lateral distance from channel centre to the wall
 * @param {number} [props.width=2.6]             tablet width in world units (text wrap box)
 */

const DIVINE = new THREE.Color(PAL.divine)
const BONE = new THREE.Color(PAL.bone)
const EMBER = new THREE.Color(PAL.ember)
const ASH = new THREE.Color(PAL.ash)

// Brand proper-nouns whose first A + first E hold the divine fire.
const TERMS = [
  'GAELWORX', 'AUTOMATIC', 'EXECUTION', 'MAEVE',
  'YARDWORX', 'REPAIRWORX', 'SALESWORX', 'AGENTWORX',
]

/**
 * For a string, return the character indices that must ignite (white-gold divine fire):
 * the first A and first E of every brand WORD present. Non-brand words never ignite.
 * Returns a Set<number> of indices into the original string.
 */
function igniteRanges(text) {
  const out = new Set()
  if (!text) return out
  const upper = text.toUpperCase()
  // walk word runs (letters only); ignite the leading A/E of recognised terms
  const re = /[A-Z]+/g
  let m
  while ((m = re.exec(upper)) !== null) {
    const word = m[0]
    if (!TERMS.includes(word)) continue
    const base = m.index
    const a = word.indexOf('A')
    const e = word.indexOf('E')
    if (a >= 0) out.add(base + a)
    if (e >= 0) out.add(base + e)
  }
  return out
}

/**
 * Split a head string into segments so ignited letters can be drawn in divine fire
 * while the rest stays forged-bone. Returns [{ ch, ignite }].
 */
function segmentHead(text) {
  const idx = igniteRanges(text)
  return text.split('').map((ch, i) => ({ ch, ignite: idx.has(i) }))
}

/**
 * One mounted tablet. Anchored at curve(t), pushed to the wall on `side`, oriented to
 * face the camera. A basalt backing slab + carved head/kicker/body. Per-frame it fades
 * by camera proximity and keeps facing the rider.
 */
function Tablet({ curve, item, offset, width }) {
  const { camera } = useThree()
  const group = useRef()
  const slabRef = useRef()
  const matRefs = useRef([])

  // Solve the static anchor + wall normal ONCE from the curve (the curve is stable).
  const { anchor, normal } = useMemo(() => {
    const t = THREE.MathUtils.clamp(item.t, 0.001, 0.999)
    const P = curve.getPointAt(t)
    const TAN = curve.getTangentAt(t)
    // wall normal = horizontal perpendicular to the flow, on the requested side
    const side = item.side < 0 ? -1 : 1
    const N = new THREE.Vector3(-TAN.z, 0, TAN.x)
    if (N.lengthSq() < 1e-6) N.set(1, 0, 0)
    N.normalize().multiplyScalar(side)
    const anchor = P.clone().addScaledVector(N, offset)
    return { anchor, normal: N }
  }, [curve, item.t, item.side, offset])

  const segs = useMemo(() => segmentHead((item.head || '').toUpperCase()), [item.head])

  // scratch
  const FACE = useMemo(() => new THREE.Vector3(), [])
  const Q = useMemo(() => new THREE.Quaternion(), [])
  const M = useMemo(() => new THREE.Matrix4(), [])
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const d = Math.min(1, dt || 0.016)

    // Face the rider: yaw the tablet toward the camera (kept upright, no roll/pitch
    // so the carving stays level like real wall-mounted stone).
    FACE.copy(camera.position).sub(anchor)
    FACE.y = 0
    if (FACE.lengthSq() < 1e-5) FACE.copy(normal)
    FACE.normalize()
    // troika text faces its local +Z; Matrix4.lookAt sets +Z = normalize(eye - target), so to
    // point +Z AT the camera we look toward (anchor - FACE), not (anchor + FACE) — otherwise we
    // read the glyphs from behind (mirrored).
    M.lookAt(g.position, g.position.clone().sub(FACE), UP)
    Q.setFromRotationMatrix(M)
    if (forge.reduced) g.quaternion.copy(Q)
    else g.quaternion.slerp(Q, 1 - Math.pow(0.001, d)) // dt-damped settle

    // Proximity reveal: brightest when the camera is near this tablet's t.
    // Use camera distance to the anchor as the cheap, robust signal.
    const dist = camera.position.distanceTo(anchor)
    const near = THREE.MathUtils.clamp(1.0 - (dist - 2.0) / 8.0, 0.0, 1.0)
    const reveal = near * near * (3.0 - 2.0 * near) // smoothstep
    const target = forge.reduced ? 1.0 : reveal
    // hard-hide far/edge-on tablets so their backing slabs never read as stray bars in the void
    g.visible = target > 0.03

    // damp opacities toward target (text materials are transparent)
    const k = forge.reduced ? 1 : 1 - Math.pow(0.0015, d)
    if (slabRef.current) {
      slabRef.current.opacity += (target * 0.82 - slabRef.current.opacity) * k
    }
    for (const mat of matRefs.current) {
      if (mat) mat.opacity += (target - mat.opacity) * k
    }
  })

  const COMMON = {
    font: FONT_BODY, // bundled Hanken (local asset) — never fetches Roboto over the network
    anchorX: 'left',
    'material-toneMapped': false,
    'material-transparent': true,
    'material-depthWrite': false,
  }

  const padX = width * 0.5
  const slabH = 1.55
  const slabW = width + 0.5

  return (
    <group ref={group} position={anchor}>
      {/* Basalt backing slab — dark, sharp-cornered (Neo-Gaelic Brutalism), 1px-ash
          rim faked by a slightly larger steel plate behind. Sits just behind the text. */}
      <mesh position={[0, 0, -0.04]} renderOrder={-1}>
        <planeGeometry args={[slabW + 0.06, slabH + 0.06]} />
        <meshBasicMaterial color={ASH} transparent opacity={0.18} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.02]} renderOrder={0}>
        <planeGeometry args={[slabW, slabH]} />
        <meshBasicMaterial
          ref={slabRef}
          color={PAL.void}
          transparent
          opacity={0.0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* KICKER — ember overline, glows (>1.0 emissive via color scale) */}
      {item.kicker ? (
        <Text
          {...COMMON}
          position={[-padX, 0.5, 0.01]}
          fontSize={0.13}
          letterSpacing={0.18}
          color={EMBER.clone().multiplyScalar(1.9)}
          ref={(r) => {
            if (r) {
              matRefs.current[0] = r.material
              r.material.opacity = 0
            }
          }}
        >
          {item.kicker.toUpperCase()}
        </Text>
      ) : null}

      {/* HEAD — carved bone, with the A/E divine-fire exception per brand word.
          Drawn as a row of per-char Text so ignited letters radiate. */}
      <HeadRow
        segs={segs}
        x={-padX}
        y={0.18}
        z={0.01}
        max={width}
        common={COMMON}
        register={(mat, slot) => mat && (matRefs.current[slot] = mat)}
      />

      {/* BODY — ash-bone supporting copy, wrapped */}
      {item.body ? (
        <Text
          {...COMMON}
          position={[-padX, -0.42, 0.01]}
          fontSize={0.105}
          lineHeight={1.32}
          maxWidth={width}
          color={BONE.clone().multiplyScalar(0.78)}
          ref={(r) => {
            if (r) {
              matRefs.current[1] = r.material
              r.material.opacity = 0
            }
          }}
        >
          {item.body}
        </Text>
      ) : null}
    </group>
  )
}

/**
 * HeadRow — lays out the headline as per-character <Text> on one baseline so the
 * ignited A/E can render in divine fire (and bloom) while the rest is forged bone.
 * Approximate monospace advance keeps it cheap and predictable (no measuring).
 */
function HeadRow({ segs, x, y, z, max, common, register }) {
  const size = 0.22
  const adv = size * 0.62 // approximate per-glyph advance for the ALL-CAPS display
  // scale down if the line would overflow the tablet width
  const lineW = segs.length * adv
  const scale = lineW > max ? max / lineW : 1
  const s = size * scale
  const a = adv * scale

  let slot = 2 // matRefs 0=kicker,1=body, head chars start at 2
  return (
    <group position={[x, y, z]}>
      {segs.map((seg, i) => {
        const mySlot = slot++
        const baseCol = seg.ignite ? DIVINE.clone().multiplyScalar(2.4) : BONE.clone().multiplyScalar(1.05)
        return (
          <Text
            key={i}
            {...common}
            font={FONT_DISPLAY}
            anchorX="left"
            anchorY="middle"
            position={[i * a, 0, 0]}
            fontSize={s}
            color={baseCol}
            ref={(r) => {
              if (r) {
                register(r.material, mySlot)
                r.material.opacity = 0
              }
            }}
          >
            {seg.ch === ' ' ? ' ' : seg.ch}
          </Text>
        )
      })}
    </group>
  )
}

const DEFAULT_ITEMS = []

export default function ChannelCopy({ curve, items = DEFAULT_ITEMS, offset = 1.55, width = 2.6 }) {
  // Guard: nothing to mount without a curve.
  const list = useMemo(() => (curve ? items : []), [curve, items])
  if (!curve) return null
  return (
    <group>
      {list.map((item, i) => (
        <Tablet key={i} curve={curve} item={item} offset={offset} width={width} />
      ))}
    </group>
  )
}
