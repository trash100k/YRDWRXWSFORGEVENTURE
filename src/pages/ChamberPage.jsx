import { useLocation, Link } from 'react-router-dom'
import { PAGES, COPY } from '../brand.js'
import PageShell from '../ui/PageShell.jsx'
import Section from '../ui/Section.jsx'

// Generic chamber page — renders /voice, /software, /automations, /web, /about, /work
// from the PAGES copy deck, with the conversion path threaded through it:
//   hero → sections… → MID-CTA band (after the 2nd section) → …sections → trust strip → CTA.
// No prices here (brand law: numbers live only on /pricing) — every path points the sword.
const IGNITE_TITLES = new Set(['Maeve'])

// three rungs of the trust ladder as compact proof chips (kills the top objections in-line)
const TRUST_CHIPS = [0, 2, 4]

export default function ChamberPage() {
  const { pathname } = useLocation()
  const p = PAGES[pathname]
  if (!p) return null
  const rungs = TRUST_CHIPS.map((i) => COPY.trust.rungs[i]).filter(Boolean)
  return (
    <PageShell kicker={p.kicker} title={p.title} lede={p.lede} ignite={IGNITE_TITLES.has(p.title)}>
      {p.sections.map((s, i) => (
        <div key={i}>
          <Section h={s.h} b={s.b} />
          {i === 1 && (
            /* the mid-page ask — catches readers who are already sold before the bottom */
            <aside className="mid-cta" aria-label="Start the forge">
              <p className="mid-cta-line">Name the bottleneck. We put a number on ending it — before you owe a thing.</p>
              <div className="mid-cta-actions">
                <Link className="cta cta--solid" to="/contact"><span>Start the Forge</span></Link>
                <Link className="link-cta" to="/pricing">See pricing →</Link>
              </div>
            </aside>
          )}
        </div>
      ))}

      {/* proof strip — three rungs of the trust ladder, sharp bordered chips */}
      <section className="psection trust-strip" aria-label="Why GAELWORX">
        {rungs.map((r) => (
          <div className="trust-chip" key={r.n}>
            <span className="trust-chip-n">{r.n}</span>
            <span className="trust-chip-head">{r.head}</span>
          </div>
        ))}
      </section>

      <section className="psection page-cta">
        <Link className="cta cta--solid" to="/contact"><span>{p.cta}</span></Link>
        <Link className="link-cta" to="/pricing">See pricing →</Link>
      </section>
    </PageShell>
  )
}
