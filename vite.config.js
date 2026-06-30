import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GAELWORX — Vite config. Single-page React + react-three-fiber.
// Three is heavy; split it (and r3f) into their own chunks so the DOM shell
// paints before the WebGL engine loads.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'],
        },
      },
    },
  },
})
