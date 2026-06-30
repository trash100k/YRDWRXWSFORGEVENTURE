import { Link } from 'react-router-dom'
import { COPY } from '../brand.js'
import Ignite from '../ui/Ignite.jsx'

// HOME — the hero reframe. The forge-world 3D engine (the pour journey) mounts behind
// this as it's built; for now the on-brand DOM hero stands on the void.
export default function Home() {
  return (
    <main className="hero">
      <span className="eyebrow">{COPY.hero.eyebrow}</span>
      <p className="hero-pre">{COPY.hero.pre}</p>
      <h1 className="headline">
        <Ignite text={COPY.hero.headline} />
      </h1>
      <p className="hero-sub">{COPY.hero.sub}</p>
      <Link className="cta cta--solid" to="/contact">
        <span>{COPY.hero.cta}</span>
      </Link>
      <span className="scrollcue" aria-hidden="true">Descend</span>
    </main>
  )
}
