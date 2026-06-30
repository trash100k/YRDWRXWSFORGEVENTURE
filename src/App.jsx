import { Routes, Route } from 'react-router-dom'
import Nav from './ui/Nav.jsx'
import Home from './pages/Home.jsx'

// Persistent Nav + routed pages. Inner chambers (/voice, /software, …) come online as
// they're built; until then they resolve to Home so the shell is always reachable.
export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  )
}
