import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ForgeCauldron — THE SOURCE (reference frames 001/002). A dark basalt basin sunk into the forge
 * floor at the mouth, holding a white-hot molten VORTEX that swirls and boils; a glowing knotwork
 * rim catches its light. This is where the four cords are born — the metal the journey rides down.
 *
 * Renders INSIDE the shared <Canvas>. The metal is the only light: the pool is emissive >1 (the
 * shared bloom blooms it), the rim is a dark silhouette with one hot inner lip. Honors forge.reduced
 * (freezes the boil). A handful of meshes, no particles — mobile-affordable.
 */

// the molten pool — a swirling white-hot vortex, cooling to a crusted ember edge, dark ore riding it
const poolVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const poolFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;

  float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; } return v; }

  vec3 tempColor(float t){
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(${v3(PAL.void)}, ${v3(PAL.crimsonDeep)}, smoothstep(0.00, 0.22, t));
    c = mix(c, ${v3(PAL.crimson)}, smoothstep(0.18, 0.45, t));
    c = mix(c, ${v3(PAL.ember)},   smoothstep(0.42, 0.66, t));
    c = mix(c, ${v3(PAL.gold)},    smoothstep(0.64, 0.85, t));
    c = mix(c, ${v3(PAL.hot)},     smoothstep(0.82, 1.00, t));
    return c;
  }
  float em(float t){ t = clamp(t, 0.0, 1.0); return pow(t, 3.0) * 2.8 + t * 0.12; }

  void main(){
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;                 // 0 centre → 1 rim
    float ang = atan(p.y, p.x);
    // swirl the sampling frame — a vortex draining toward the centre
    float sw = ang + uTime * 0.5 - r * 3.2;
    vec2 q = vec2(cos(sw), sin(sw)) * r;
    float n = fbm(q * 2.2 + uTime * 0.15);
    float t = clamp(1.0 - r * 0.72 + n * 0.28, 0.0, 1.0);   // white-hot core → ember crust at the rim
    t -= smoothstep(0.55, 0.47, fbm(q * 5.0 - uTime * 0.3)) * 0.36;  // dark ore chunks floating on top
    vec3 col = tempColor(t) * em(t);
    float disc = smoothstep(1.0, 0.9, r);      // clip to the round basin, soft edge
    gl_FragColor = vec4(col, disc);
  }
`

export default function ForgeCauldron({ position = [0, 0.04, 1.6], radius = 2.4 }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((state) => { if (!forge.reduced) uniforms.uTime.value = state.clock.elapsedTime })

  return (
    <group position={position}>
      {/* the white-hot vortex pool, lying flat, facing up */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 64]} />
        <shaderMaterial vertexShader={poolVert} fragmentShader={poolFrag} uniforms={uniforms} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* dark basalt rim — a silhouette ring around the pool (unlit, reads as stone against the void) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <torusGeometry args={[radius * 1.06, radius * 0.16, 10, 64]} />
        <meshBasicMaterial color="#0a0c0e" toneMapped={false} />
      </mesh>
      {/* the hot crusted inner lip — a thin glowing rim of cooling metal at the basin edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <torusGeometry args={[radius * 0.97, radius * 0.03, 8, 64]} />
        <meshBasicMaterial color={new THREE.Color(PAL.ember).multiplyScalar(2.2)} toneMapped={false} />
      </mesh>
    </group>
  )
}
