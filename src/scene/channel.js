import * as THREE from 'three'
import { PAL, v3 } from './palette.js'

/**
 * An OPEN MOLTEN TROUGH — not a tube. A channel carved into the dark forge floor: a flat
 * glowing river of metal along the bottom, dark Irish-basalt banks rising on either side,
 * open to the sky so the camera rides above and reads the metal flowing in it.
 *
 * buildChannelGeometry sweeps a 4-point trough profile along `curve`, orienting the profile
 * with WORLD-UP (not Frenet roll) so the trough always opens upward regardless of how the
 * path meanders. The cross-section, left→right across uv.y (0..1):
 *   0.00  outer-left lip (top of the left bank)
 *   0.33  left base    ┐
 *   0.66  right base   ┘ the flat molten floor (the river)
 *   1.00  outer-right lip (top of the right bank)
 *
 * One geometry, one shader: uv.x runs along the flow, uv.y across the profile. The shader
 * paints the floor band molten and the bank bands as basalt lit only by the river at its foot.
 */
export function buildChannelGeometry(curve, segments, opts = {}) {
  const W = (opts.width ?? 2.0) * 0.5 // outer half-width (lip to centre)
  const baseHalf = W * (opts.floorFrac ?? 0.5) // half-width of the flat molten floor
  const H = opts.wallH ?? 0.55 // bank height above the floor

  // profile points in the cross-section plane: [acrossX, upY]
  const prof = [
    [-W, H],
    [-baseHalf, 0],
    [baseHalf, 0],
    [W, H],
  ]
  const cols = prof.length
  const rows = segments + 1

  const up = new THREE.Vector3(0, 1, 0)
  const P = new THREE.Vector3()
  const T = new THREE.Vector3()
  const Bn = new THREE.Vector3()
  const Up = new THREE.Vector3()

  const pos = new Float32Array(rows * cols * 3)
  const uv = new Float32Array(rows * cols * 2)

  for (let i = 0; i < rows; i++) {
    const t = Math.min(i / segments, 0.99999)
    curve.getPointAt(t, P)
    curve.getTangentAt(t, T).normalize()
    // across-channel = tangent × world-up (horizontal, perpendicular to flow)
    Bn.crossVectors(T, up)
    if (Bn.lengthSq() < 1e-6) Bn.set(1, 0, 0)
    Bn.normalize()
    // channel-up = across × tangent (the open direction, ~world-up for a shallow grade)
    Up.crossVectors(Bn, T).normalize()
    for (let j = 0; j < cols; j++) {
      const px = prof[j][0]
      const py = prof[j][1]
      const k = i * cols + j
      pos[k * 3] = P.x + Bn.x * px + Up.x * py
      pos[k * 3 + 1] = P.y + Bn.y * px + Up.y * py
      pos[k * 3 + 2] = P.z + Bn.z * px + Up.z * py
      uv[k * 2] = t
      uv[k * 2 + 1] = j / (cols - 1)
    }
  }

  const index = []
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j
      const b = i * cols + j + 1
      const c = (i + 1) * cols + j
      const d = (i + 1) * cols + j + 1
      index.push(a, c, b, b, c, d)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(index)
  return g
}

export const channelVert = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

export const channelFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;     // x along flow, y across profile (0..1)
  varying float vDepth;
  uniform float uTime, uTemp;

  vec3 gw_tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    c = mix(c, ${v3(PAL.gold)},    smoothstep(0.64, 0.85, t));
    c = mix(c, ${v3(PAL.hot)},     smoothstep(0.82, 1.00, t));
    return c;
  }
  float gw_em(float t){ t = clamp(t, 0.0, 1.0); return pow(t, 3.0) * 2.6 + t * 0.12; }

  void main(){
    float along = vUv.x;
    float acr = vUv.y;
    float onFloor = step(0.33, acr) * step(acr, 0.66);

    // ── the molten floor (the river) ──
    float across = clamp((acr - 0.33) / 0.33, 0.0, 1.0);
    float core = clamp(1.0 - abs(across - 0.5) * 1.6, 0.0, 1.0);
    float flow  = sin(along * 120.0 - uTime * 2.2) * 0.5 + 0.5;
    float flow2 = sin(along * 47.0 - uTime * 1.4 + 1.6) * 0.5 + 0.5;
    float skin  = sin(along * 260.0 + across * 6.0 - uTime * 3.0) * 0.5 + 0.5; // fine molten skin
    float tf = (0.56 + flow * 0.24 + flow2 * 0.14 + skin * 0.06 + uTemp * 0.08) * (0.42 + core * 0.72);
    vec3 floorCol = gw_tempColor(tf) * gw_em(tf);

    // ── the basalt banks, lit only by the river at their foot ──
    float hgt = acr < 0.5 ? (0.33 - acr) / 0.33 : (acr - 0.66) / 0.34; // 0 at floor, 1 at lip
    hgt = clamp(hgt, 0.0, 1.0);
    float glow = pow(1.0 - hgt, 2.4);                       // firelight falls off up the bank
    float lick = 0.72 + 0.28 * (sin(along * 60.0 - uTime * 2.0) * 0.5 + 0.5);
    vec3 basalt = vec3(0.018, 0.026, 0.028);                // dark green-black Irish basalt
    vec3 wallCol = basalt + gw_tempColor(0.6) * glow * lick * 0.95;

    vec3 col = mix(wallCol, floorCol, onFloor);
    col *= smoothstep(30.0, 1.5, vDepth);                   // emerge from the dark ahead
    gl_FragColor = vec4(col, 1.0);
  }
`
