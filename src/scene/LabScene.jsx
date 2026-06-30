import { Component, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import LetterCast from './LetterCast.jsx'
import ForgeSplit from './ForgeSplit.jsx'
import ChannelCopy from './ChannelCopy.jsx'
import ScryingPool from './ScryingPool.jsx'
import JewelChamber from './JewelChamber.jsx'
import CastingRoom from './CastingRoom.jsx'
import ChannelHall from './ChannelHall.jsx'
import ForgeMouth from './ForgeMouth.jsx'
import Plinths from './Plinths.jsx'
import ForgeAltar from './ForgeAltar.jsx'

/**
 * LabScene — internal QA gallery. /lab?m=ModuleName renders one section module in
 * isolation so the main agent can screenshot + grade it before integrating. ?d= camera
 * distance, ?y= look height. Not user-facing.
 */
class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(e) { return { err: e } }
  componentDidCatch(e) { console.error('LAB module error:', e && e.message) }
  render() { return this.state.err ? null : this.props.children }
}

const num = (name, def) => {
  const m = typeof window !== 'undefined' && window.location.search.match(new RegExp(name + '=([^&]+)'))
  return m ? parseFloat(m[1]) : def
}
const str = (name, def) => {
  const m = typeof window !== 'undefined' && window.location.search.match(new RegExp(name + '=([^&]+)'))
  return m ? decodeURIComponent(m[1]) : def
}

const testCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-5, 1.5, -3),
  new THREE.Vector3(-1.5, 0.4, -0.5),
  new THREE.Vector3(2, -0.4, 0.5),
  new THREE.Vector3(5.5, -1.2, -1.5),
])

const REG = {
  LetterCast: () => <LetterCast progress={num('p', 1)} position={[0, 0, 0]} size={1.2} />,
  ForgeSplit: () => <ForgeSplit active={0} position={[0, 4, 0]} />,
  ChannelCopy: () => (
    <ChannelCopy curve={testCurve} items={[
      { t: 0.35, side: -1, kicker: '01 · The Clan', head: 'For operators', body: 'GAELWORX runs this on our own shops.' },
      { t: 0.7, side: 1, kicker: '02 · The Arsenal', head: 'Automatic Execution', body: 'It books the jobs.' },
    ]} />
  ),
  ScryingPool: () => <ScryingPool />,
  JewelChamber: () => <JewelChamber />,
  CastingRoom: () => <CastingRoom />,
  ChannelHall: () => <ChannelHall />,
  ForgeMouth: () => <ForgeMouth />,
  Plinths: () => <Plinths />,
  ForgeAltar: () => <ForgeAltar />,
}

function LabCamera() {
  const camera = useThree((s) => s.camera)
  const d = num('d', 7)
  const y = num('y', 0)
  useEffect(() => {
    camera.position.set(0, 1.4, d)
    camera.lookAt(0, y, 0)
    camera.fov = 50
    camera.updateProjectionMatrix()
  }, [camera, d, y])
  return null
}

export default function LabScene() {
  const m = str('m', 'LetterCast')
  const make = REG[m]
  return (
    <>
      <LabCamera />
      {/* modest lab fill so PBR modules are visible (emissive modules self-light) */}
      <ambientLight intensity={0.12} color="#384455" />
      <pointLight position={[4, 5, 6]} intensity={30} distance={40} decay={2} color="#cfe0ff" />
      <Boundary>{make ? make() : null}</Boundary>
    </>
  )
}
