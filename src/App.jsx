import { lazy, Suspense, useEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import Nav from './ui/Nav.jsx'
import Home from './pages/Home.jsx'
import ChamberPage from './pages/ChamberPage.jsx'
import Pricing from './pages/Pricing.jsx'
import Contact from './pages/Contact.jsx'
import { forge } from './store.js'
import { sceneFor } from './scene/scenes.js'

// The forge engine is lazy so the DOM shell paints before WebGL loads. It mounts ONCE,
// fixed behind all content (the single renderer), and never tears down on navigation.
const ForgeCanvas = lazy(() => import('./scene/ForgeCanvas.jsx'))

function Shell() {
  const { pathname } = useLocation()
  const lenisRef = useRef(null)

  // Lenis momentum scroll — glides the page (and through it forge.scroll) with forge weight
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true })
    lenisRef.current = lenis
    if (typeof window !== 'undefined') { window.__lenis = lenis; window.__forge = forge } // QA hooks
    // drive the forge straight off Lenis (exact scroll + limit) — robust vs the window 'scroll'
    // event, which Lenis doesn't always fire on an immediate jump
    lenis.on('scroll', (e) => {
      const max = e.limit || 0
      forge.scroll = max > 0 ? Math.min(e.scroll / max, 1) : 0
      forge.temperature = 0.14 + (forge.routeTemp || 0) + forge.scroll * 0.6
    })
    let raf
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf); lenis.destroy(); lenisRef.current = null
      if (typeof window !== 'undefined') window.__lenis = null
    }
  }, [])

  useEffect(() => {
    const s = sceneFor(pathname)
    forge.routeTemp = s.tempBias
    forge.still = !!s.still
    forge.route = pathname
    if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
  }, [pathname])

  // dev beat-viewer: /?beat=0.3 pins the journey's scroll to a value (hero hidden) so any beat can
  // be screenshot on the REAL, working home render. The /lab harness loop is dead; this replaces it.
  const beat = typeof window !== 'undefined' && window.location.search.match(/[?&]beat=([0-9.]+)/)
  useEffect(() => {
    if (!beat) return
    const v = parseFloat(beat[1])
    let raf
    const loop = () => { forge.scroll = v; forge.temperature = 0.14 + (forge.routeTemp || 0) + v * 0.6; raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // /concept + /lab render bare scenes (no nav/content) for art-direction + QA screenshots;
  // /?beat= also hides the DOM so the forge reads alone
  const bare = pathname === '/concept' || pathname === '/lab' || !!beat

  return (
    <>
      <div className="forge-bg" aria-hidden="true">
        <Suspense fallback={null}>
          <ForgeCanvas route={pathname} />
        </Suspense>
      </div>
      {!bare && (
      <div className="app-content">
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/voice" element={<ChamberPage />} />
          <Route path="/software" element={<ChamberPage />} />
          <Route path="/automations" element={<ChamberPage />} />
          <Route path="/web" element={<ChamberPage />} />
          <Route path="/about" element={<ChamberPage />} />
          <Route path="/work" element={<ChamberPage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      )}
    </>
  )
}

export default function App() {
  return <Shell />
}
