import { Link } from 'react-router-dom'
import { COPY } from '../brand.js'
import Ignite from '../ui/Ignite.jsx'

/**
 * HOME — the story is told by the FORGE (the 3D ForgeJourney): you scroll, the camera rides the
 * molten Celtic plait, reads the carved tablets, and casts GAELWORX. This DOM is the SCROLL TRACK
 * that drives it plus the two interactive bookends — the hero entry and the finale CTA (things the
 * 3D can't do: links, buttons). The body copy is carved in the forge; here it stays screen-reader
 * only so the page is still indexable (SEO/AEO) without doubling the 3D tablets.
 */
export default function Home() {
  const { hero, enemy, clan, arsenal, industries, trust, finale } = COPY

  // the voice-agent hook — the ACTION is a stub the live pipeline claims later (VISION-RIDE.md):
  // it announces the summon on the window + flags the store; Maeve pitches + closes when wired.
  const summonMaeve = () => {
    window.dispatchEvent(new CustomEvent('gw:summon-maeve', { detail: { from: 'home-finale' } }))
  }

  return (
    <main className="home-journey">
      {/* HERO — beat 1, over the opening forge */}
      <section className="home-hero">
        <span className="eyebrow">{hero.eyebrow}</span>
        <p className="hero-pre">{hero.pre}</p>
        <h1 className="headline"><Ignite text={hero.headline} /></h1>
        <p className="hero-sub">{hero.sub}</p>
        <Link className="cta cta--solid" to="/contact"><span>{hero.cta}</span></Link>
        <span className="scrollcue" aria-hidden="true">Begin the Ascent ↓</span>
      </section>

      {/* THE DESCENT — a tall track that drives the forge journey on scroll. The story is carved
          in the 3D (the tablets); kept here sr-only so the page stays indexable. */}
      <div className="home-track">
        <p className="sr-only">{enemy}</p>
        <p className="sr-only">{clan.head} {clan.body}</p>
        {arsenal.branches.map((b) => (
          <p className="sr-only" key={b.id}>{b.tag}: {b.line} {b.body}</p>
        ))}
        <p className="sr-only">{industries.head} {industries.body} {industries.list.join('. ')}.</p>
        {trust.rungs.map((r) => (
          <p className="sr-only" key={r.n}>{r.head} {r.body}</p>
        ))}
      </div>

      {/* FINALE — beat 5, over the GAELWORX cast */}
      <section className="home-finale">
        <p className="finale-closer">{finale.closer}</p>
        <Link className="cta cta--solid" to="/contact"><span>{finale.cta}</span></Link>
        <button className="cta cta--maeve" type="button" onClick={summonMaeve} data-gw-maeve>
          <span>{finale.maeve}</span>
          <small>{finale.maeveSub}</small>
        </button>
        <span className="finale-scarcity">{finale.scarcity}</span>
        <div className="finale-secondary">
          <Link className="link-cta" to="/about">See how it works →</Link>
          <Link className="link-cta" to="/pricing">Full pricing →</Link>
        </div>
      </section>
    </main>
  )
}
