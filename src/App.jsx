import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
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
  useEffect(() => {
    const s = sceneFor(pathname)
    forge.routeTemp = s.tempBias
    forge.still = !!s.still
    forge.route = pathname
    window.scrollTo(0, 0)
  }, [pathname])

  // /concept renders the bare posed scene (no nav/content) for art-direction screenshots
  const bare = pathname === '/concept'

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
