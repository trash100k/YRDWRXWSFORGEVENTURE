import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL } from './palette.js'
import { forge } from '../store.js'

/**
 * ForgeAtmosphere — living embers + sparks rising off the molten plait (the brief's "living
 * sparks that orbit the pour front, drawn by heat"). One additive Points draw spread over the
 * channel network; each particle rises, sways and recycles, brightening with the forge heat.
 * The shared bloom catches the hottest. Read top-down, they drift up out of the floor toward the
 * lens — the air of a working forge. ~12% are brighter, faster SPARKS. Frozen under reduced-motion.
 */
export default function ForgeAtmosphere({ count = 520, area = [11, 8, 34], center = [0, 3, -16] }) {
  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count * 4) // swayAmp, riseSpeed, size, isSpark
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * (area[0] / 2) + center[0]
      positions[i * 3 + 1] = Math.random() * area[1] + (center[1] - area[1] / 2)
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * (area[2] / 2) + center[2]
      seeds[i * 4] = 0.15 + Math.random() * 0.6
      seeds[i * 4 + 1] = 0.25 + Math.random() * 0.9
      seeds[i * 4 + 2] = 0.3 + Math.random() * 1.1
      seeds[i * 4 + 3] = Math.random() < 0.12 ? 1.0 : 0.0
    }
    return { positions, seeds }
  }, [count, area, center])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.3 },
      uHot: { value: new THREE.Color(PAL.gold) },
      uCool: { value: new THREE.Color(PAL.ember) },
      uBottom: { value: center[1] - area[1] / 2 },
      uHeight: { value: area[1] },
    }),
    [center, area]
  )

  useFrame((state, dt) => {
    if (!forge.reduced) uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uTemp.value += (forge.temperature - uniforms.uTemp.value) * Math.min(1, (dt || 0.016) * 2)
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-seed" count={count} array={seeds} itemSize={4} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          attribute vec4 seed;
          uniform float uTime, uBottom, uHeight;
          varying float vLife;
          varying float vSpark;
          void main() {
            vec3 p = position;
            float spd = seed.y * (1.0 + seed.w * 2.5);                 // sparks rise faster
            float y = mod(p.y - uBottom + uTime * spd, uHeight);       // recycle up the column
            p.y = uBottom + y;
            float life = y / uHeight;                                   // 0 bottom .. 1 top
            p.x += sin(uTime * (0.4 + seed.w) + position.z * 1.7) * seed.x * (0.4 + life);
            p.z += cos(uTime * 0.3 + position.x * 1.3) * seed.x * 0.3;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = seed.z * (1.0 + seed.w * 1.6) * (90.0 / -mv.z);
            vLife = (1.0 - life) * smoothstep(0.0, 0.12, life);         // fade in low, out at the top
            vSpark = seed.w;
          }
        `}
        fragmentShader={/* glsl */ `
          precision mediump float;
          uniform vec3 uHot, uCool;
          uniform float uTemp;
          varying float vLife;
          varying float vSpark;
          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float r = dot(d, d);
            if (r > 0.25) discard;
            float coreP = smoothstep(0.25, 0.0, r);
            vec3 col = mix(uCool, uHot, coreP * (0.5 + vSpark * 0.5)) * (0.7 + uTemp * 1.5 + vSpark * 1.2);
            gl_FragColor = vec4(col, coreP * vLife * (0.4 + uTemp * 0.7));
          }
        `}
      />
    </points>
  )
}
