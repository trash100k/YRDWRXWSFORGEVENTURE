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
  uniform float uDepth[${MAXP}]; // over/under weave height per point (higher = on top)
  uniform float uStrand[${MAXP}]; // strand id per point
  uniform float uActiveStrand;   // strand to burn hotter (-1 = none)

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

    // Celtic OVER-UNDER: among the strands covering this point, the one with the greatest weave
    // height shows its molten — the others pass beneath it. wallD = nearest strand (basalt + walls).
    float wallD = 1e9;
    float overD = 1e9, overAlong = 0.0, overDepth = -2.0, overStrand = -1.0;
    for (int i = 0; i < ${MAXP - 1}; i++) {
      if (i >= uCount - 1) break;
      if (uBreak[i + 1] > 0.5) continue; // skip the gap between two separate strands
      vec2 a = uPath[i], b = uPath[i + 1];
      vec2 ba = b - a, pa = p - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      float dd = length(pa - ba * h);
      wallD = min(wallD, dd);
      if (dd < uHalf + 0.06) {
        float dpt = mix(uDepth[i], uDepth[i + 1], h);
        if (dpt > overDepth) { overDepth = dpt; overD = dd; overAlong = mix(uCum[i], uCum[i + 1], h); overStrand = uStrand[i]; }
      }
    }

    float halfW = uHalf;
    float groove = 0.42;
    float molten = smoothstep(halfW, halfW - 0.10, overD);
    float lip = smoothstep(halfW + groove, halfW, wallD) * (1.0 - molten);

    // the metal is the ONLY light: stone reveals only where the channel's glow reaches it
    float lightFall = exp(-max(wallD - halfW, 0.0) * 0.5);
    float vig = smoothstep(uRadius, uRadius * 0.35, length(p - uCenter));

    // ── basalt honeycomb pavement — Giant's Causeway, top-down ──
    vec4 hx = getHex(p * 1.3);
    float edge = hexEdge(hx.xy);
    float joint = smoothstep(0.44, 0.5, edge);
    float cell = hash21(hx.zw);
    vec3 stoneDark  = vec3(0.009, 0.013, 0.015);
    vec3 stoneGreen = vec3(0.022, 0.041, 0.034);          // Connemara green, only under light
    vec3 basalt = mix(stoneDark, stoneGreen, 0.25 + cell * 0.6);
    basalt *= (1.0 - joint * 0.85);
    basalt *= mix(0.10, 1.0, lightFall) * vig;
    basalt += gw_tempColor(0.5) * lightFall * (1.0 - joint) * 0.10 * (0.4 + 0.6 * cell);

    // ── groove wall: warm crusted levee at the inner edge (the Kilauea crust) ──
    float innerWarm = smoothstep(halfW + groove, halfW, wallD);
    vec3 wall = basalt * 0.5 + gw_tempColor(0.4) * pow(innerWarm, 2.0) * 0.7 * vig;

    // ── the molten river (the OVER strand) — white-hot core cooling to a crusted edge ──
    float actLit = abs(overStrand - uActiveStrand) < 0.5 ? 1.0 : 0.0;
    float core = clamp(1.0 - overD / halfW, 0.0, 1.0);          // 1 at the channel centre
    // viscous flowing skin (two scales, slow drift — heavy molten metal, not water)
    float skin1 = fbm(vec2(overAlong * 2.0, overD * 7.0) + vec2(uTime * 0.45, 0.0));
    float skin2 = fbm(vec2(overAlong * 6.5, overD * 12.0) - vec2(uTime * 0.8, 0.0));
    float skin = skin1 * 0.65 + skin2 * 0.35;
    // crust crackle at the cooler edge: bright veins inside a darker setting skin
    float edgeMask = smoothstep(0.62, 0.06, core);              // 1 at the levee edge
    float vein = smoothstep(0.5, 0.62, fbm(vec2(overAlong * 4.0, overD * 4.0) + uTime * 0.08));
    float tf = 0.46 + core * 0.46 + skin * 0.08 + actLit * 0.10 + uTemp * 0.04;
    tf -= edgeMask * 0.20 * (1.0 - vein);                       // crust sets darker; cracks stay hot
    tf = clamp(tf, 0.0, 1.0);
    vec3 moltenCol = gw_tempColor(tf) * gw_em(tf) * mix(1.0, 1.3, actLit);

    vec3 col = basalt;
    col = mix(col, wall, lip);
    col = mix(col, moltenCol, molten);
    gl_FragColor = vec4(col, 1.0);
  }
`

export default function ChannelFloor({ curve, curves, strands, activeStrand = -1, floorY = 0, half = 0.55, margin = 5, samples }) {
  const matRef = useRef()
  const activeRef = useRef(activeStrand)
  activeRef.current = activeStrand

  const { geo, position, uniforms } = useMemo(() => {
    // a strand = { curve, depth?(t)->[-1..1] }. Plain curves/curve become flat strands (depth 0).
    const list = strands && strands.length
      ? strands
      : curves && curves.length
        ? curves.map((c) => ({ curve: c }))
        : curve ? [{ curve }] : []
    const nPaths = Math.max(1, list.length)
    const perPath = samples || Math.max(6, Math.floor(MAXP / nPaths))
    const upath = [], ucum = [], ubreak = [], udepth = [], ustrand = []
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (let s = 0; s < list.length; s++) {
      const c = list[s].curve
      const depthFn = list[s].depth
      const k = Math.min(perPath, MAXP - upath.length)
      if (k < 2) break
      let len = 0, prev = null
      for (let i = 0; i < k; i++) {
        const t = i / (k - 1)
        const P = c.getPointAt(t)
        const v = new THREE.Vector2(P.x, P.z)
        if (prev) len += v.distanceTo(prev)
        upath.push(v); ucum.push(len); ubreak.push(i === 0 ? 1 : 0)
        udepth.push(depthFn ? depthFn(t) : 0.0); ustrand.push(s)
        prev = v
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x)
        minZ = Math.min(minZ, v.y); maxZ = Math.max(maxZ, v.y)
      }
    }
    const count = upath.length
    while (upath.length < MAXP) { upath.push(new THREE.Vector2(0, 0)); ucum.push(0); ubreak.push(1); udepth.push(-2); ustrand.push(-1) }

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
      uDepth: { value: udepth },
      uStrand: { value: ustrand },
      uActiveStrand: { value: -1 },
    }
    return { geo: g, position: [cx, floorY, cz], uniforms: u }
  }, [curve, curves, strands, floorY, half, margin, samples])

  useFrame((state, dt) => {
    const u = uniforms
    if (!forge.reduced) u.uTime.value = state.clock.elapsedTime
    u.uTemp.value += (forge.temperature - u.uTemp.value) * Math.min(1, (dt || 0.016) * 2)
    u.uActiveStrand.value = activeRef.current
  })

  // lie flat (XZ), normal up
  return (
    <mesh geometry={geo} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <shaderMaterial ref={matRef} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} />
    </mesh>
  )
}
