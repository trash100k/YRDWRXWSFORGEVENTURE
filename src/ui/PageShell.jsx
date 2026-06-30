import Ignite from './Ignite.jsx'
import BrandText from './BrandText.jsx'

/**
 * PageShell — the shared inner-page frame. A transparent hero (the chamber's forge shows
 * through) over a dimmed pane that keeps copy sharp. Title ignites only for brand-term
 * titles (e.g. Maeve); otherwise it's plain Cinzel display.
 */
export default function PageShell({ kicker, title, lede, ignite = false, children }) {
  return (
    <main className="page">
      <header className="page-hero">
        {kicker && <span className="kicker">{kicker}</span>}
        <h1 className="page-title">{ignite ? <Ignite text={title} /> : title}</h1>
        {lede && <p className="page-lede"><BrandText text={lede} /></p>}
      </header>
      <div className="below page-below">{children}</div>
    </main>
  )
}
