import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Nav from './ui/Nav.jsx'
import Home from './pages/Home.jsx'

// The forge engine is lazy so the DOM shell paints before WebGL loads. It mounts ONCE,
// fixed behind all content (the single renderer), and never tears down on navigation.
const ForgeCanvas = lazy(() => import('./scene/ForgeCanvas.jsx'))

export default function App() {
  return (
    <>
      <div className="forge-bg" aria-hidden="true">
        <Suspense fallback={null}>
          <ForgeCanvas />
        </Suspense>
      </div>
      <div className="app-content">
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </>
  )
}
