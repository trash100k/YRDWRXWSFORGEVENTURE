import { Link } from 'react-router-dom'
import { COPY } from '../brand.js'
import Ignite from '../ui/Ignite.jsx'
import BrandText from '../ui/BrandText.jsx'

// HOME — the full sales journey in DOM: hero (reframe) → enemy → Clan → Arsenal →
// trust ladder → finale → footer. The forge-world 3D engine layers behind this later.
export default function Home() {
  const { hero, enemy, clan, arsenal, trust, finale, footer } = COPY
  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <main>
      {/* 00 — hero */}
      <section className="hero">
        <span className="eyebrow">{hero.eyebrow}</span>
        <p className="hero-pre">{hero.pre}</p>
        <h1 className="headline"><Ignite text={hero.headline} /></h1>
        <p className="hero-sub">{hero.sub}</p>
        <Link className="cta cta--solid" to="/contact"><span>{hero.cta}</span></Link>
        <span className="scrollcue" aria-hidden="true">Descend</span>
      </section>

      {/* the descent — content rides over the dimmed living forge */}
      <div className="below">

      {/* 01 — name the enemy */}
      <section className="section section--enemy">
        <p className="enemy-line"><BrandText text={enemy} /></p>
      </section>

      {/* 02 — the clan */}
      <section className="section">
        <span className="kicker">{clan.kicker}</span>
        <h2 className="section-head">{clan.head}</h2>
        <p className="section-body"><BrandText text={clan.body} /></p>
      </section>

      {/* 03 — the arsenal (Voice first) */}
      <section className="section section--arsenal">
        <span className="kicker">{arsenal.kicker}</span>
        <h2 className="section-head">{arsenal.head}</h2>
        <p className="section-intro">{arsenal.intro}</p>
        <ul className="arsenal-grid">
          {arsenal.branches.map((b) => (
            <li key={b.id}>
              <Link to={b.path} className="branch-card">
                <span className="branch-id">{b.id} · <BrandText text={b.tag} /></span>
                <span className="branch-line"><BrandText text={b.line} /></span>
                <span className="branch-body"><BrandText text={b.body} /></span>
                <span className="branch-go" aria-hidden="true">Enter →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 04 — the trust ladder */}
      <section className="section section--trust">
        <span className="kicker">{trust.kicker}</span>
        <ol className="trust-ladder">
          {trust.rungs.map((r) => (
            <li key={r.n} className="trust-rung">
              <span className="trust-n" aria-hidden="true">{r.n}</span>
              <div className="trust-body">
                <h3 className="trust-head">{r.head}</h3>
                <p className="section-body"><BrandText text={r.body} /></p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 05 — the finale */}
      <section className="finale">
        <button className="finale-mark" onClick={toTop} aria-label="Back to top">
          <Ignite text={finale.mark} />
        </button>
        <p className="finale-closer">{finale.closer}</p>
        <Link className="cta cta--solid" to="/contact"><span>{finale.cta}</span></Link>
        <span className="avail">{finale.avail}</span>
        <span className="finale-scarcity">{finale.scarcity}</span>
        <div className="finale-secondary">
          <Link className="link-cta" to="/about">See how it works →</Link>
          <Link className="link-cta" to="/pricing">Full pricing →</Link>
        </div>
      </section>

      {/* footer */}
      <footer className="footer">
        <span className="footer-mark"><Ignite text="GAELWORX" /> · One Forge</span>
        <span className="footer-tag">{footer.tag}</span>
      </footer>

      </div>{/* /below */}
    </main>
  )
}
