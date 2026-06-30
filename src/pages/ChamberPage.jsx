import { useLocation, Link } from 'react-router-dom'
import { PAGES } from '../brand.js'
import PageShell from '../ui/PageShell.jsx'
import Section from '../ui/Section.jsx'

// Generic chamber page — renders /voice, /software, /automations, /web, /about, /work
// from the PAGES copy deck. Bespoke 3D per chamber layers on later; for now each route
// re-tempers the shared forge (see scenes.js) and reads its copy.
const IGNITE_TITLES = new Set(['Maeve'])

export default function ChamberPage() {
  const { pathname } = useLocation()
  const p = PAGES[pathname]
  if (!p) return null
  return (
    <PageShell kicker={p.kicker} title={p.title} lede={p.lede} ignite={IGNITE_TITLES.has(p.title)}>
      {p.sections.map((s, i) => (
        <Section key={i} h={s.h} b={s.b} />
      ))}
      <section className="psection page-cta">
        <Link className="cta cta--solid" to="/contact"><span>{p.cta}</span></Link>
        <Link className="link-cta" to="/pricing">See pricing →</Link>
      </section>
    </PageShell>
  )
}
