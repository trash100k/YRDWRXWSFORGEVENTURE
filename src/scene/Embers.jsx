import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL } from './palette.js'
import { forge } from '../store.js'

/**
 * Embers — rising sparks (Atmospheric Drift). One additive Points draw; each particle is
 * a cooling metal droplet that rises, sways, recycles, and brightens with the forge's
 * temperature. Bloom catches the hottest ones. Skipped under reduced-motion.
 */
const COUNT = 260

export default function Embers() {
  const matRef = useRef()

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const seeds = new Float32Array(COUNT * 3) // x-sway amp, rise speed, size
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * 4.5
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 3
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 0.8 - 0.4
      seeds[i * 3] = 0.2 + Math.random() * 0.7
      seeds[i * 3 + 1] = 0.12 + Math.random() * 0.4
      seeds[i * 3 + 2] = 0.32 + Math.random() * 0.95
    }
    return { positions, seeds }
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.2 },
      uColorHot: { value: new THREE.Color(PAL.ember) },
      uColorCool: { value: new THREE.Color(PAL.crimson) },
    }),
    []
  )

  useFrame((state, dt) => {
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uTemp.value += (forge.temperature - uniforms.uTemp.value) * Math.min(1, (dt || 0.016) * 2)
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-seed" count={COUNT} array={seeds} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          attribute vec3 seed;
          uniform float uTime;
          varying float vLife;
          void main() {
            vec3 p = position;
            float rise = mod(p.y + uTime * seed.y, 6.0) - 3.0; // recycle across 6 units
            p.y = rise;
            p.x += sin(uTime * 0.5 + position.y * 3.0) * seed.x * 0.5;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = seed.z * (105.0 / -mv.z);
            vLife = smoothstep(-3.0, -1.6, rise) * (1.0 - smoothstep(1.6, 3.0, rise));
          }
        `}
        fragmentShader={/* glsl */ `
          precision mediump float;
          uniform vec3 uColorHot, uColorCool;
          uniform float uTemp;
          varying float vLife;
          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float r = dot(d, d);
            if (r > 0.25) discard;
            float core = smoothstep(0.25, 0.0, r);
            vec3 col = mix(uColorCool, uColorHot, core) * (0.6 + uTemp * 1.4);
            gl_FragColor = vec4(col, core * vLife * (0.45 + uTemp * 0.6));
          }
        `}
      />
    </points>
  )
}
