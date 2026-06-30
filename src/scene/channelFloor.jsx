import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ChannelFloor — the forge floor, seen top-down. A slab of dark green-black Irish basalt with a
 * molten channel CARVED INTO it: the path is cut as a glowing groove (recessed bevel walls + a
 * molten river in the trough bottom), the surrounding stone is near-black with faint carved
 * knotwork that only catches the metal's light. This is the brief's read — "the channel
 * architecture IS Celtic interlace, carved into basalt; the metal is the only light" — and it
 * kills the floating-tube look because the channel is a groove in a surface, not an extrusion.
 *
 * One plane, one shader. The fragment shader computes distance to the channel polyline (sampled
 * from `curve`, passed as a uniform), so the groove follows any meandering/interlacing path.
 */

const MAXP = 32 // uniform path capacity

const vert = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying vec2 vWorld;
  uniform float uTime, uTemp, uHalf, uRadius;
  uniform vec2 uCenter;
  uniform int uCount;
  uniform vec2 uPath[${MAXP}];
  uniform float uCum[${MAXP}];

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

  float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; } return v; }

  // faint carved knotwork: a woven diagonal lattice (reads as Gaelic stonework, not a clean grid)
  float knot(vec2 p){
    float s = 0.85;
    float a = abs(fract((p.x + p.y) * s) - 0.5);
    float b = abs(fract((p.x - p.y) * s) - 0.5);
    float la = smoothstep(0.05, 0.0, a);
    float lb = smoothstep(0.05, 0.0, b);
    return max(la, lb);
  }

  void main(){
    vec2 p = vWorld;

    // distance to the carved channel path (+ along-length for the flow)
    float bestD = 1e9, along = 0.0;
    for (int i = 0; i < ${MAXP - 1}; i++) {
      if (i >= uCount - 1) break;
      vec2 a = uPath[i], b = uPath[i+1];
      vec2 ba = b - a, pa = p - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      float dd = length(pa - ba * h);
      if (dd < bestD) { bestD = dd; along = mix(uCum[i], uCum[i+1], h); }
    }

    float halfW = uHalf;
    float groove = 0.42;                                  // bevel-wall band outside the molten
    float molten = smoothstep(halfW, halfW - 0.10, bestD);
    float lip = smoothstep(halfW + groove, halfW, bestD) * (1.0 - molten);

    // ── basalt floor: near-black green, fine grain, faint knotwork, vignette to void ──
    float grain = fbm(p * 1.5);
    vec3 basalt = mix(vec3(0.010, 0.016, 0.018), vec3(0.020, 0.032, 0.029), grain);
    basalt += vec3(0.05, 0.026, 0.012) * knot(p) * 0.35;  // carved lines, ember-tinted
    float vig = smoothstep(uRadius, uRadius * 0.35, length(p - uCenter));
    basalt *= vig;

    // ── groove wall (bevel): darker stone, warming toward the molten at the inner edge ──
    float innerWarm = smoothstep(halfW + groove, halfW, bestD);
    vec3 wall = basalt * 0.45 + gw_tempColor(0.42) * pow(innerWarm, 2.2) * 0.6 * vig;

    // ── the molten river in the groove bottom ──
    float core = clamp(1.0 - bestD / halfW, 0.0, 1.0);
    float flow  = sin(along * 4.2 - uTime * 2.2) * 0.5 + 0.5;
    float flow2 = sin(along * 1.7 - uTime * 1.3 + 1.6) * 0.5 + 0.5;
    float skin  = sin(along * 9.0 + bestD * 8.0 - uTime * 3.0) * 0.5 + 0.5;
    float tf = (0.60 + flow * 0.22 + flow2 * 0.12 + skin * 0.05 + uTemp * 0.06) * (0.5 + core * 0.6);
    vec3 moltenCol = gw_tempColor(tf) * gw_em(tf);

    vec3 col = basalt;
    col = mix(col, wall, lip);
    col = mix(col, moltenCol, molten);
    gl_FragColor = vec4(col, 1.0);
  }
`

export default function ChannelFloor({ curve, floorY = 0, half = 0.55, margin = 5, samples = 28 }) {
  const matRef = useRef()

  const { geo, position, uniforms } = useMemo(() => {
    const n = Math.min(samples, MAXP)
    const pts = []
    const cum = []
    let len = 0
    let prev = null
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (let i = 0; i < n; i++) {
      const P = curve.getPointAt(i / (n - 1))
      const v = new THREE.Vector2(P.x, P.z)
      if (prev) len += v.distanceTo(prev)
      cum.push(len)
      pts.push(v)
      prev = v
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x)
      minZ = Math.min(minZ, v.y); maxZ = Math.max(maxZ, v.y)
    }
    // pad the uniform arrays to MAXP
    const upath = pts.slice()
    const ucum = cum.slice()
    while (upath.length < MAXP) { upath.push(new THREE.Vector2(0, 0)); ucum.push(cum[cum.length - 1] || 0) }

    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const w = maxX - minX + margin * 2
    const l = maxZ - minZ + margin * 2
    const g = new THREE.PlaneGeometry(w, l, 1, 1)

    const u = {
      uTime: { value: 0 },
      uTemp: { value: 0.5 },
      uHalf: { value: half },
      uRadius: { value: Math.max(w, l) * 0.62 },
      uCenter: { value: new THREE.Vector2(cx, cz) },
      uCount: { value: n },
      uPath: { value: upath },
      uCum: { value: ucum },
    }
    return { geo: g, position: [cx, floorY, cz], uniforms: u }
  }, [curve, floorY, half, margin, samples])

  useFrame((state, dt) => {
    const u = uniforms
    if (!forge.reduced) u.uTime.value = state.clock.elapsedTime
    u.uTemp.value += (forge.temperature - u.uTemp.value) * Math.min(1, (dt || 0.016) * 2)
  })

  // lie flat (XZ), normal up
  return (
    <mesh geometry={geo} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <shaderMaterial ref={matRef} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} />
    </mesh>
  )
}
