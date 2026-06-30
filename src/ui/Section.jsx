import BrandText from './BrandText.jsx'

// One content section — heading (brand-term aware) + body, with vertical rhythm.
export default function Section({ h, b, children, className = '' }) {
  return (
    <section className={'psection ' + className}>
      {h && <h2 className="psection-h"><BrandText text={h} /></h2>}
      {b && <p className="psection-b"><BrandText text={b} /></p>}
      {children}
    </section>
  )
}
