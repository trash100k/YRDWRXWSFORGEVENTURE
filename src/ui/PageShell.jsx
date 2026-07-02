import { Link } from 'react-router-dom'
import Ignite from './Ignite.jsx'
import BrandText from './BrandText.jsx'
import { NAV } from '../brand.js'

/**
 * PageShell — the shared inner-page frame. A transparent hero (the chamber's forge shows
 * through) over a dimmed pane that keeps copy sharp. Title ignites only for brand-term
 * titles (e.g. Maeve); otherwise it's plain Cinzel display. Ends in the slim site footer
 * (mark · routes · email · the guarantee line) so every page closes with a next step.
 */
export default function PageShell({ kicker, title, lede, ignite = false, stickyCta = true, children }) {
  return (
    <main className="page">
      {/* mobile-only fixed bottom bar — the next step never leaves the thumb (never on /contact) */}
      {stickyCta && (
        <Link className="sticky-cta" to="/contact" aria-label="Start the Forge">
          <span>Name the bottleneck — <strong>Start the Forge</strong></span>
        </Link>
      )}
      <header className="page-hero">
        {kicker && <span className="kicker">{kicker}</span>}
        <h1 className="page-title">{ignite ? <Ignite text={title} /> : title}</h1>
        {lede && <p className="page-lede"><BrandText text={lede} /></p>}
      </header>
      <div className="below page-below">{children}</div>
      <footer className="site-foot">
        <div className="site-foot-row">
          <Link className="site-foot-mark" to="/"><Ignite text="GAELWORX" /></Link>
          <nav className="site-foot-links" aria-label="Footer">
            {NAV.slice(1).map(([, label, path]) => (
              <Link key={path} to={path}>{label}</Link>
            ))}
          </nav>
          <a className="site-foot-mail" href="mailto:hello@gaelworx.com">hello@gaelworx.com</a>
        </div>
        <p className="site-foot-line">Fixed scope. Fixed price. You own what we build. · Continental US · 7 Days</p>
      </footer>
    </main>
  )
}
