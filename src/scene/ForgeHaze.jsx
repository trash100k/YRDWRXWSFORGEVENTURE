import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, v3 } from './palette.js'
import { forge } from '../store.js'

/**
 * ForgeHaze — the VOLUMETRIC ATMOSPHERE layer. A stack of large, wispy fbm-smoke CURTAINS the
 * camera flies through as it rides the channel, so the molten glow travels through real drifting
 * air instead of sitting on flat black. Layered semi-transparent noise planes are the reliable way
 * to fake volumetrics for a fly-through (billboard sprites just read as dots against the void).
 *
 * Each curtain is a big plane facing the rider with a domain-warped fbm smoke shader: wispy density
 * concentrated LOW (rising off the molten), warm near the source, cooling with the descent, soft
 * edges so no plane reads as a rectangle. Additive + dim so the stack builds a soft glowing haze
 * that bloom lifts. The whole rig rides with the camera and recycles. Skipped under reduced-motion.
 *
 * @param {object} [props]
 * @param {number} [props.layers=14]  curtain count through the ride window
 * @param {number} [props.spacing=2.1] z-gap between curtains (world units)
 * @param {number} [props.width=11]   curtain width across the channel
 * @param {number} [props.height=7]   curtain height
 * @param {number} [props.opacity=0.5] overall density
 */
export default function ForgeHaze({ layers = 14, spacing = 2.1, width = 11, height = 7, opacity = 0.5 }) {
  const groupRef = useRef()
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHot: { value: new THREE.Color(PAL.ember) },
      uCool: { value: new THREE.Color(PAL.crimsonDeep) },
      uHeat: { value: 0.6 }, // scroll-cooled tint (1 warm near source → 0 cold deep)
      uOpacity: { value: opacity },
    }),
    [opacity]
  )

  const geo = useMemo(() => new THREE.PlaneGeometry(width, height, 1, 1), [width, height])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying float vLayer;
          attribute float aLayer;
          void main(){
            vUv = uv;
            vLayer = aLayer;
            // InstancedMesh: apply the per-instance matrix (each curtain's z offset)
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          varying vec2 vUv;
          varying float vLayer;
          uniform float uTime, uHeat, uOpacity;
          uniform vec3 uHot, uCool;

          float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
          float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
          float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.03+1.7; a*=0.5; } return v; }

          void main(){
            // per-curtain phase so layers don't align; slow upward + lateral drift
            float ph = vLayer * 13.7;
            vec2 uv = vUv * vec2(2.4, 1.6) + vec2(ph, ph * 0.5);
            uv += vec2(sin(uTime*0.15+ph)*0.2, -uTime*0.06);           // drift up, sway
            // domain-warped fbm → wispy smoke
            vec2 w = vec2(fbm(uv), fbm(uv+5.2));
            float dens = fbm(uv*1.3 + 1.6*w);
            dens = smoothstep(0.42, 0.85, dens);                       // wispy, not solid

            // concentrate LOW (rising off the molten); fade to nothing up top + at the edges
            float low = smoothstep(1.0, 0.15, vUv.y);                  // 1 at bottom → 0 at top
            float edge = smoothstep(0.0,0.18,vUv.x)*smoothstep(1.0,0.82,vUv.x)*smoothstep(1.0,0.9,vUv.y);
            float a = dens * low * edge;

            // warm near the source/river, cooling with the descent
            vec3 col = mix(uCool, uHot, clamp(uHeat + low*0.3, 0.0, 1.0));
            float lit = 0.10 + low * 0.5;                              // dim: the additive stack builds glow
            gl_FragColor = vec4(col * lit, a * uOpacity);
          }
        `,
      }),
    [uniforms]
  )

  // instanced curtains down the ride window, each tagged with its layer index
  const mesh = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry()
    g.index = geo.index
    g.attributes = geo.attributes
    const layerAttr = new Float32Array(layers)
    const m = new THREE.InstancedMesh(g, material, layers)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < layers; i++) {
      dummy.position.set(0, height * 0.32, -i * spacing)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      layerAttr[i] = i
    }
    g.setAttribute('aLayer', new THREE.InstancedBufferAttribute(layerAttr, 1))
    m.frustumCulled = false
    return m
  }, [geo, material, layers, spacing, height])

  useFrame((state, dt) => {
    const d = Math.min(1, dt || 0.016)
    uniforms.uTime.value = state.clock.elapsedTime
    // ride with the camera; the whole curtain stack sits ahead of the rider and recycles by spacing
    if (groupRef.current) {
      const span = layers * spacing
      const camZ = state.camera.position.z
      groupRef.current.position.z = camZ - (((camZ % spacing) + spacing) % spacing) - 1
      groupRef.current.position.y = 0
    }
    const targetHeat = THREE.MathUtils.clamp(0.85 - forge.scroll * 0.72, 0.06, 0.9)
    uniforms.uHeat.value += (targetHeat - uniforms.uHeat.value) * d * 2
  })

  return <group ref={groupRef}><primitive object={mesh} /></group>
}
