import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * RaisedChannel — ONE straight, RAISED molten channel (the reference frame 004). A white-hot river
 * runs in a trough between two basalt walls carved with REAL Celtic knotwork relief (a photo texture,
 * gold recesses glowing); the whole causeway is elevated — the walls drop into the void below. The
 * metal cools white-hot → dark iron down its length. A forward camera RIDES down it as you scroll.
 *
 * The four-cord plait is set aside; get ONE channel great. Renders inside the shared <Canvas>.
 */

const LEN = 42      // channel length (z=0 at the source → z=-LEN)
const HALFW = 0.7   // molten half-width
const WALLW = 0.9   // wall thickness
const H = 7         // wall height (drops into the void)
const TOPY = 0.42   // wall top height above the molten

// shared GLSL — noise + the brand temperature ramp
const COMMON = /* glsl */ `
  float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; } return v; }
  vec3 tempColor(float t){
    t=clamp(t,0.0,1.0);
    vec3 c=mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.0,0.22,t));
    c=mix(c, ${v3(PAL.crimson)}, smoothstep(0.18,0.45,t));
    c=mix(c, ${v3(PAL.ember)}, smoothstep(0.42,0.66,t));
    c=mix(c, ${v3(PAL.gold)}, smoothstep(0.64,0.85,t));
    c=mix(c, ${v3(PAL.hot)}, smoothstep(0.82,1.0,t));
    return c;
  }
  float em(float t){ t=clamp(t,0.0,1.0); return pow(t,3.0)*2.6 + t*0.12; }
`

const vert = /* glsl */ `
  varying vec3 vW;
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
`

// the molten river — boiling, flowing away, cooling down its length, meniscus lip at the walls
const moltenFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  uniform float uTime, uLen, uHalfW;
  ${COMMON}
  void main(){
    float along  = clamp(-vW.z / uLen, 0.0, 1.0);      // 0 at source → 1 far
    float across = clamp(vW.x / uHalfW, -1.0, 1.0);
    vec2 q = vec2(across * 2.6, along * 5.5 - uTime * 0.6);   // flow drifts down the channel
    vec2 w = vec2(fbm(q), fbm(q + 3.1));
    float boil = fbm(q + 1.5 * w);
    float vein = clamp(pow(1.0 - abs(boil - 0.5) * 2.0, 3.0), 0.0, 1.0);
    float ore  = smoothstep(0.55, 0.46, fbm(q * 2.4 - uTime * 0.5));   // dark ore breaks up the white
    float baseT = mix(0.86, 0.20, along);              // COOLING: white-hot source → dark iron
    float lip = smoothstep(0.74, 1.0, abs(across));    // meniscus where metal meets the wall
    float tt = clamp(baseT + vein * 0.18 + lip * 0.16 - ore * 0.34, 0.0, 1.0);
    gl_FragColor = vec4(tempColor(tt) * em(tt), 1.0);
  }
`

// the raised walls — PROCEDURAL columnar Irish basalt (Giant's Causeway): vertical prisms march
// down-channel with per-block width/shade jitter (rhythm, NO repeat), ashlar courses in running
// bond, deep mortar joints + a median V-groove, carved knot interlace that glows gold ONLY where
// the river rakes it. The metal is the only light: brightest at the FOOT (the river), dying up the
// face and down the length as it cools. A hot meniscus lip sits where stone meets molten.
const wallFrag = /* glsl */ `
  precision highp float;
  varying vec3 vW;
  uniform float uTime, uLen;
  ${COMMON}

  // 4-way Truchet knot distance — quarter-arcs connect across cells into continuous interlace
  float gw_knotDist(vec2 p){
    vec2 c = floor(p), f = fract(p);
    float h = hash21(c);
    if      (h > 0.75) f = vec2(f.y, 1.0 - f.x);
    else if (h > 0.50) f = 1.0 - f;
    else if (h > 0.25) f = vec2(1.0 - f.y, f.x);
    return min(abs(length(f) - 0.5), abs(length(f - 1.0) - 0.5));
  }

  void main(){
    float along = clamp(-vW.z / uLen, 0.0, 1.0);              // 0 source → 1 far (cools down-length)
    float y = vW.y;                                            // 0.42 rim → drops into the void
    float coolAlong = mix(1.0, 0.16, along);                  // white-hot mouth → cold far
    // the river (y≈0) is the light: glow concentrated at the foot, fading up the face
    float foot  = smoothstep(0.55, -0.15, y);                 // 0 at rim → 1 at/below the molten
    float lit   = pow(foot, 1.4) * coolAlong;

    // ── columnar basalt: VERTICAL prisms dominate (Giant's Causeway), irregular courses secondary ──
    // Columns are the star: they converge to the vanishing point and read as carved rhythm without
    // repeat. Courses are few and irregular so the wall never reads as a regular staircase.
    float uu      = 0.60 - y;                                  // height coord (0 at ~rim, grows down)
    // irregular course heights: walk a jittered ladder so no two bands are the same height
    float cAcc = 0.0, courseH = 1.4, course = 0.0;
    for (int i = 0; i < 6; i++){                               // resolve which course this y falls in
      float ch = mix(1.1, 2.4, hash21(vec2(course, 12.3)));    // this course's height
      if (uu < cAcc + ch) { courseH = ch; break; }
      cAcc += ch; course += 1.0;
    }
    float rowJit  = hash21(vec2(course, 7.0));
    float colW    = mix(0.42, 0.82, hash21(vec2(course, 3.1)));// narrower → MORE vertical prisms
    float zc      = vW.z + rowJit * colW * 2.3;                // running-bond stagger per course
    float colId   = floor(zc / colW);
    float colSeed = hash21(vec2(colId, course));               // unique seed per stone block
    float colShade = 0.62 + colSeed * 0.7;                     // per-column lit variation (reads columns)

    vec2 blk = vec2(fract(zc / colW), (uu - cAcc) / courseH);
    vec2 jdst = min(blk, 1.0 - blk);
    float vJoint = smoothstep(0.070, 0.012, jdst.x);           // deep vertical mortar (dominant)
    float hJoint = smoothstep(0.045, 0.010, jdst.y);           // subtle horizontal mortar
    float joint  = max(vJoint * 1.0, hJoint * 0.7);
    float vgroove = smoothstep(0.14, 0.0, abs(blk.x - 0.5));   // median V-groove down each prism

    // ── carved knot interlace — kept subtle so it doesn't band at the grazing angle ──
    vec2 kp = vec2(zc * 1.15, uu * 1.15) + colSeed * 9.0;
    float kd = gw_knotDist(kp);
    float ribbon   = smoothstep(0.075, 0.028, kd);

    // ── grain + low-freq erosion so faces read as rough stone, not plastic ──
    float grain   = fbm(vec2(zc * 5.5, uu * 5.5));
    float erosion = fbm(vec2(zc * 0.35, uu * 0.5) + 3.7);

    // dark green-black serpentine basalt; per-block value jitter; joints cut near-black
    vec3 stoneDark  = vec3(0.010, 0.014, 0.016);
    vec3 stoneGreen = vec3(0.020, 0.038, 0.032);
    vec3 basalt = mix(stoneDark, stoneGreen, 0.2 + colSeed * 0.6);
    basalt *= (0.72 + grain * 0.5);
    basalt *= (0.82 + erosion * 0.42);
    basalt *= (1.0 - joint * 0.92);

    // compose — the metal is the only light; per-column shade makes the prisms read as columns
    vec3 col = basalt * (0.18 + lit * 1.05 * colShade);
    col += tempColor(0.45) * vgroove * lit * 0.16;            // V-groove down each prism (vertical read)
    col += tempColor(0.78) * ribbon  * lit * colShade * 0.45; // faint gold knot, varied per block

    // meniscus — the hot bright lip where basalt meets the molten (highest-contrast form)
    float men = smoothstep(0.12, 0.0, abs(y - 0.02)) * coolAlong;
    col += tempColor(0.92) * em(0.6) * men * 0.9;

    // fall to black into the void beneath the river and up the cooling face
    float voidFall = smoothstep(-3.2, 0.05, y);
    col *= voidFall;
    gl_FragColor = vec4(col, 1.0);
  }
`

// a forward camera that RIDES down the channel as forge.scroll goes 0..1 (the pour adventure)
function RideCam() {
  const { camera } = useThree()
  useFrame(() => {
    const s = THREE.MathUtils.clamp(forge.scroll, 0, 1)
    const zc = THREE.MathUtils.lerp(3.5, -LEN + 9, s)
    camera.position.set(0, 2.1, zc)
    camera.lookAt(0, -0.4, zc - 13)
    if (typeof window !== 'undefined') { window.__camPos = [0, 2.1, Math.round(zc * 10) / 10]; window.__camShot = 'ride' } // QA
  })
  return null
}

export default function RaisedChannel() {
  const uTime = useMemo(() => ({ value: 0 }), [])
  const moltenU = useMemo(() => ({ uTime, uLen: { value: LEN }, uHalfW: { value: HALFW } }), [uTime])
  const wallU = useMemo(() => ({ uTime, uLen: { value: LEN } }), [uTime])
  useFrame((state) => { if (!forge.reduced) uTime.value = state.clock.elapsedTime })

  return (
    <>
      <RideCam />
      {/* the molten river, lying flat in the trough */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -LEN / 2]}>
        <planeGeometry args={[HALFW * 2, LEN]} />
        <shaderMaterial vertexShader={vert} fragmentShader={moltenFrag} uniforms={moltenU} toneMapped={false} />
      </mesh>
      {/* the two raised knotwork walls, descending into the void */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (HALFW + WALLW / 2), TOPY - H / 2, -LEN / 2]}>
          <boxGeometry args={[WALLW, H, LEN]} />
          <shaderMaterial vertexShader={vert} fragmentShader={wallFrag} uniforms={wallU} />
        </mesh>
      ))}
    </>
  )
}
