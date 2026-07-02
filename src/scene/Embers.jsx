import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * Embers v2 — REAL spark craft, one draw call. Each particle is a textured glowing mote
 * (radial hot-core sprite, not a flat disc) with:
 *  · 3 depth bands — a few LARGE near-camera bokeh motes, a mid field, a dim far field —
 *    so the swarm reads as parallax layers, not confetti
 *  · helical buoyant rise (curl, not just sway), size-over-life (grow → gutter out)
 *  · color-over-life walked DOWN the brand temperature ramp (gold birth → crimson death)
 *  · depthTest on: prisms/rocks occlude sparks — the occlusion is what sells the depth
 *  · `follow` mode: bands recycle around the camera z, so a riding camera always has sparks
 *
 * @param {object} props
 * @param {number}  [props.count=260]
 * @param {boolean} [props.follow=false]  recycle the field around the camera (the ride)
 */

// the sprite: a 64px radial gradient with a white-hot core cooling to transparent
let _sprite = null
function makeEmberSprite() {
  if (_sprite) return _sprite
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0.0, 'rgba(255,242,224,1)')
  g.addColorStop(0.25, 'rgba(255,178,77,0.85)')
  g.addColorStop(0.55, 'rgba(232,93,4,0.35)')
  g.addColorStop(1.0, 'rgba(232,93,4,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  _sprite = new THREE.CanvasTexture(c)
  return _sprite
}

export default function Embers({ count = 260, follow = false }) {
  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count * 4) // x sway-amp · y rise-speed · z size · w band key
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * 4.5
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 3
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 0.8 - 0.4
      seeds[i * 4] = 0.2 + Math.random() * 0.7
      seeds[i * 4 + 1] = 0.12 + Math.random() * 0.4
      seeds[i * 4 + 2] = 0.32 + Math.random() * 0.95
      seeds[i * 4 + 3] = Math.random()
    }
    return { positions, seeds }
  }, [count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTemp: { value: 0.2 },
      uCamZ: { value: 0 },
      uFollow: { value: follow ? 1 : 0 },
      uMap: { value: makeEmberSprite() },
    }),
    [follow]
  )

  useFrame((state, dt) => {
    if (!forge.reduced) uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uTemp.value += (forge.temperature - uniforms.uTemp.value) * Math.min(1, (dt || 0.016) * 2)
    uniforms.uCamZ.value = state.camera.position.z
  })

  const geoRef = useRef()
  useEffect(() => () => geoRef.current?.dispose(), [])

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
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
          uniform float uTime, uCamZ, uFollow;
          varying float vLife;
          varying float vAlpha;
          void main() {
            vec3 p = position;
            float phase = fract(position.x * 3.71 + position.z * 5.33);
            float life = fract(uTime * seed.y * 0.25 + phase);

            // three parallax bands: near bokeh (few, huge, faint) · mid · far (small, dim)
            float band = seed.w;
            float near0, near1, sizeMul, alphaMul;
            if (band < 0.06)      { near0 = 0.8;  near1 = 2.6;  sizeMul = 3.4;  alphaMul = 0.32; }
            else if (band < 0.55) { near0 = 2.0;  near1 = 12.0; sizeMul = 1.0;  alphaMul = 1.0;  }
            else                  { near0 = 8.0;  near1 = 24.0; sizeMul = 0.55; alphaMul = 0.6;  }

            // buoyant helical rise
            float rise = 2.5 + band * 1.5;
            p.y = -0.15 + life * rise;
            float curl = life * 9.42 + phase * 40.0;
            p.x += sin(curl) * seed.x * 0.35 * (0.5 + life);
            p.z += cos(curl) * 0.2;

            // ride mode: recycle each band's window around the camera
            if (uFollow > 0.5) {
              float zFrac = fract(phase * 7.77 + seed.x * 3.1);
              p.z = uCamZ - mix(near0, near1, zFrac) + cos(curl) * 0.2;
            }

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            // size-over-life: swell then gutter out; perspective-scaled, iOS-safe clamp
            float sizeLife = (0.6 + 0.8 * life) * (1.0 - smoothstep(0.7, 1.0, life));
            gl_PointSize = clamp(seed.z * sizeMul * sizeLife * (150.0 / max(-mv.z, 0.5)), 0.0, 120.0);
            vLife = life;
            vAlpha = alphaMul;
          }
        `}
        fragmentShader={/* glsl */ `
          precision mediump float;
          uniform sampler2D uMap;
          uniform float uTemp;
          varying float vLife;
          varying float vAlpha;
          vec3 tempColor(float t){
            t = clamp(t, 0.0, 1.0);
            vec3 c = mix(${v3(PAL.crimsonDeep)}, ${v3(PAL.crimson)}, smoothstep(0.0, 0.35, t));
            c = mix(c, ${v3(PAL.ember)}, smoothstep(0.3, 0.65, t));
            c = mix(c, ${v3(PAL.gold)},  smoothstep(0.6, 0.9, t));
            return c;
          }
          void main() {
            vec4 tex = texture2D(uMap, gl_PointCoord);
            // color-over-life walks DOWN the ramp: gold birth → crimson death
            vec3 col = tempColor(mix(0.9, 0.15, vLife)) * (0.8 + uTemp * 1.2);
            gl_FragColor = vec4(col * tex.rgb * 1.6, tex.a * vAlpha * (0.5 + uTemp * 0.55));
          }
        `}
      />
    </points>
  )
}
