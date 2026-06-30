import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'

// Routes scaffold. Inner chambers (/voice, /software, …) come online as they're built;
// for now everything resolves to Home so the shell is always reachable.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
