import { Link, useLocation } from 'react-router-dom'
import { NAV } from '../brand.js'
import Ignite from './Ignite.jsx'

// Persistent top nav. Mark left (ignited), routes right. Mobile: horizontal-scroll
// the links (a full menu comes later). Brutalist: sharp, translucent over the void.
export default function Nav() {
  const { pathname } = useLocation()
  return (
    <header className="nav">
      <Link className="nav-mark" to="/" aria-label="GAELWORX home">
        <Ignite text="GAELWORX" />
      </Link>
      <nav className="nav-links" aria-label="Primary">
        {NAV.slice(1).map(([n, label, path]) => (
          <Link
            key={path}
            to={path}
            className={'nav-link' + (pathname === path ? ' is-active' : '')}
          >
            <span className="nav-n" aria-hidden="true">{n}</span>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
