import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../ui/PageShell.jsx'
import BrandText from '../ui/BrandText.jsx'

/**
 * /pricing — tabbed, flagship-first. Software's $15–50k sets the anchor so Voice reads
 * as the easy yes; Voice carries the ★Recommended flag (the entry rung). Each tab:
 * anchor → tiers (decoy "Most Forged" middle) → de-risk note → CTA. Numbers are
 * authoritative here (the home page never shows a price).
 */
const TABS = [
  {
    id: 'software', tag: 'Software', label: 'The Flagship Build',
    anchor: 'Agencies bill $75k–$200k. An in-house dev runs $180k+/yr.',
    tiers: [
      { name: 'Foundation', price: '$15,000', blurb: 'An accessible custom build — a real platform, owned outright.', feats: ['Custom-built + documented', 'Open-sourced to you', 'Fixed scope, fixed price'] },
      { name: 'Core Build', price: '$30,000', forged: true, blurb: 'The platform most operations need. The most forged.', feats: ['Everything in Foundation', 'Deeper integrations', 'The system that runs YardWorx'] },
      { name: 'Full Platform', price: '$50,000', blurb: 'Your whole operation, one owned system, built to scale.', feats: ['Everything in Core', 'Multi-module platform', 'Built to scale with you'] },
    ],
    note: 'A 25% deposit locks scope and puts the forge to work — the line between buyers who build and browsers who don’t.',
    cta: 'Start the Forge',
  },
  {
    id: 'voice', tag: 'Voice', label: 'Recommended', recommended: true,
    anchor: 'An outbound rep costs $50k–$70k/yr + commission and dials ~80×/day. Maeve dials 1,000+.',
    tiers: [
      { name: 'Setup', price: '$2,500', unit: 'one-time', blurb: 'We build the agent, scripts, objection-handling, CRM + dialer integration.', feats: [] },
      { name: 'Per agent', price: '$699', unit: '/mo', forged: true, blurb: 'Includes a minute bucket; $0.30/min beyond it.', feats: ['Inbound + outbound', 'Books straight to calendar', 'No caller clocks AI'] },
      { name: 'Performance', price: '$50', unit: '/booked appt', blurb: 'The upside — you pay more only when it books more.', feats: [] },
    ],
    note: 'Month-to-month. The base covers your minute cost; the performance kicker aligns our incentive with yours.',
    cta: 'Deploy Maeve',
  },
  {
    id: 'automations', tag: 'Automations', label: 'Kill the Busywork',
    anchor: 'By hand, the rote work costs you hours every week. Agencies bill $5k–$15k a build.',
    tiers: [
      { name: 'Project', price: '$2,500–$7,500', blurb: 'Quoting, follow-up, invoicing, reviews — built to run on their own.', feats: ['You own the data', 'No black box', 'No hostage tool'] },
      { name: 'Forge Care', price: '$500–$1,500', unit: '/mo', forged: true, blurb: 'Monitoring, tweaks, new flows — the system keeps earning.', feats: ['Ongoing optimization', 'New automations', 'Priority support'] },
    ],
    note: 'Start with a project or go straight to a care plan — the easy second move after Voice or Web.',
    cta: 'Start the Forge',
  },
  {
    id: 'web', tag: 'Web', label: 'Book the Build',
    anchor: 'Premium cinematic studios bill $50k+. We deliver studio-grade at a front-door price.',
    tiers: [
      { name: 'Launch', price: '$1,499', blurb: 'Cinematic 3D via the forge engine — live in 7 days.', feats: ['Routes leads to your phone', 'Built to book, not just look', '7-day delivery'] },
      { name: 'Full Cinematic', price: '$4,999', forged: true, blurb: 'Bespoke beats on the engine. The most forged.', feats: ['Everything in Launch', 'Custom 3D moments', 'Deeper lead routing'] },
      { name: 'Custom', price: '$9,999+', blurb: 'A bespoke avatar-level 3D world — nobody else has it.', feats: ['From-scratch 3D', 'Scales to $15–25k+', 'Studio-tier craft'] },
    ],
    note: 'Every site comes with Forge Care from $49/mo — hosting, SSL, security, monitoring, monthly edits.',
    cta: 'Book the Build',
  },
]

export default function Pricing() {
  const [active, setActive] = useState('software')
  const tab = TABS.find((t) => t.id === active)
  return (
    <PageShell
      kicker="The Forge Runs Lean"
      title="Premium Work. Honest Prices."
      lede="Name the bottleneck — we put a number on ending it before any work begins, and we carry the risk until it executes."
    >
      <div className="pricing">
        <div className="pricing-tabs" role="tablist" aria-label="Pricing by service">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === active}
              className={'pricing-tab' + (t.id === active ? ' is-active' : '') + (t.recommended ? ' is-rec' : '')}
              onClick={() => setActive(t.id)}
            >
              <span className="pricing-tab-tag">{t.tag}</span>
              <span className="pricing-tab-label">{t.recommended ? '★ ' + t.label : t.label}</span>
            </button>
          ))}
        </div>

        <div className="pricing-panel" role="tabpanel">
          <p className="pricing-anchor">{tab.anchor}</p>
          <div className="pricing-tiers">
            {tab.tiers.map((ti) => (
              <article key={ti.name} className={'tier' + (ti.forged ? ' tier--forged' : '')}>
                {ti.forged && <span className="tier-flag">Most Forged</span>}
                <span className="tier-name">{ti.name}</span>
                <span className="tier-price">{ti.price}{ti.unit && <em> {ti.unit}</em>}</span>
                <span className="tier-blurb"><BrandText text={ti.blurb} /></span>
                {ti.feats.length > 0 && (
                  <ul className="tier-feats">
                    {ti.feats.map((f) => <li key={f}><BrandText text={f} /></li>)}
                  </ul>
                )}
              </article>
            ))}
          </div>
          <p className="pricing-note"><BrandText text={tab.note} /></p>
          <div className="pricing-cta">
            <Link className="cta cta--solid" to="/contact"><span>{tab.cta}</span></Link>
          </div>
        </div>
      </div>
      <p className="pricing-foot">Fixed scope. Fixed price. Continental US · 7 Days. You own what we build.</p>
    </PageShell>
  )
}
