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

const MAXP = 64 // uniform path-point capacity (shared across all carved paths)

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
  uniform float uBreak[${MAXP}]; // 1 = this point starts a new path (don't connect across)

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

  // honeycomb — Giant's Causeway basalt pavement, read top-down (Shane's hex tiling)
  vec4 getHex(vec2 p){
    vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / vec4(1.0, 1.7320508, 1.0, 1.7320508).xyxy) + 0.5;
    vec4 h = vec4(p - hC.xy * vec2(1.0, 1.7320508), p - (hC.zw + 0.5) * vec2(1.0, 1.7320508));
    return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
  }
  float hexEdge(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }

  void main(){
    vec2 p = vWorld;

    // distance to the carved channel path (+ along-length for the flow)
    float bestD = 1e9, along = 0.0;
    for (int i = 0; i < ${MAXP - 1}; i++) {
      if (i >= uCount - 1) break;
      if (uBreak[i + 1] > 0.5) continue; // skip the gap between two separate paths
      vec2 a = uPath[i], b = uPath[i+1];
      vec2 ba = b - a, pa = p - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      float dd = length(pa - ba * h);
      if (dd < bestD) { bestD = dd; along = mix(uCum[i], uCum[i+1], h); }
    }

    float halfW = uHalf;
    float groove = 0.42;
    float molten = smoothstep(halfW, halfW - 0.10, bestD);
    float lip = smoothstep(halfW + groove, halfW, bestD) * (1.0 - molten);

    // the metal is the ONLY light: stone only reveals where the channel's glow reaches it
    float lightFall = exp(-max(bestD - halfW, 0.0) * 0.5);
    float vig = smoothstep(uRadius, uRadius * 0.35, length(p - uCenter));

    // ── basalt honeycomb pavement — Giant's Causeway, top-down ──
    vec4 hx = getHex(p * 1.3);
    float edge = hexEdge(hx.xy);
    float joint = smoothstep(0.44, 0.5, edge);            // dark joints between columns
    float cell = hash21(hx.zw);                            // per-column variation
    vec3 stoneDark  = vec3(0.009, 0.013, 0.015);
    vec3 stoneGreen = vec3(0.022, 0.041, 0.034);          // Connemara green, only under light
    vec3 basalt = mix(stoneDark, stoneGreen, 0.25 + cell * 0.6);
    basalt *= (1.0 - joint * 0.85);                        // cut the joints dark
    basalt *= mix(0.10, 1.0, lightFall) * vig;             // reveal near the metal, else void
    basalt += gw_tempColor(0.5) * lightFall * (1.0 - joint) * 0.10 * (0.4 + 0.6 * cell);

    // ── carved interlace accent hugging the levee (high-cross knotwork, raking light) ──
    float bandZone = smoothstep(halfW + groove * 2.4, halfW + groove * 0.7, bestD) * (1.0 - lip) * (1.0 - molten);
    float w1 = sin(along * 5.5 + bestD * 6.0);
    float w2 = sin(along * 5.5 - bestD * 6.0);
    float weave = smoothstep(0.55, 0.95, max(w1, w2) * 0.5 + 0.5); // over/under bands
    basalt += gw_tempColor(0.55) * bandZone * weave * lightFall * 0.30;

    // ── groove wall: warm crusted levee at the inner edge (the Kilauea crust) ──
    float innerWarm = smoothstep(halfW + groove, halfW, bestD);
    vec3 wall = basalt * 0.5 + gw_tempColor(0.4) * pow(innerWarm, 2.0) * 0.7 * vig;

    // ── the molten river: a continuous flowing skin, not blobs ──
    float core = clamp(1.0 - bestD / halfW, 0.0, 1.0);
    float skin  = fbm(vec2(along * 3.0, bestD * 5.0) + vec2(uTime * 0.7, 0.0));
    float pulse = sin(along * 2.2 - uTime * 1.7) * 0.5 + 0.5;
    float tf = (0.66 + skin * 0.16 + pulse * 0.07 + uTemp * 0.05) * (0.55 + core * 0.55);
    vec3 moltenCol = gw_tempColor(tf) * gw_em(tf);

    vec3 col = basalt;
    col = mix(col, wall, lip);
    col = mix(col, moltenCol, molten);
    gl_FragColor = vec4(col, 1.0);
  }
`

export default function ChannelFloor({ curve, curves, floorY = 0, half = 0.55, margin = 5, samples }) {
  const matRef = useRef()

  const { geo, position, uniforms } = useMemo(() => {
    const paths = curves && curves.length ? curves : curve ? [curve] : []
    const nPaths = Math.max(1, paths.length)
    const perPath = samples || Math.max(6, Math.floor(MAXP / nPaths))
    const upath = [], ucum = [], ubreak = []
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const c of paths) {
      const k = Math.min(perPath, MAXP - upath.length)
      if (k < 2) break
      let len = 0, prev = null
      for (let i = 0; i < k; i++) {
        const P = c.getPointAt(i / (k - 1))
        const v = new THREE.Vector2(P.x, P.z)
        if (prev) len += v.distanceTo(prev)
        upath.push(v); ucum.push(len); ubreak.push(i === 0 ? 1 : 0)
        prev = v
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x)
        minZ = Math.min(minZ, v.y); maxZ = Math.max(maxZ, v.y)
      }
    }
    const count = upath.length
    while (upath.length < MAXP) { upath.push(new THREE.Vector2(0, 0)); ucum.push(0); ubreak.push(1) }

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
      uCount: { value: count },
      uPath: { value: upath },
      uCum: { value: ucum },
      uBreak: { value: ubreak },
    }
    return { geo: g, position: [cx, floorY, cz], uniforms: u }
  }, [curve, curves, floorY, half, margin, samples])

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
