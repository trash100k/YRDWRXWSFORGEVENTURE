import { useState } from 'react'
import PageShell from '../ui/PageShell.jsx'
import { strike } from '../store.js'

// Contact — the forge mouth. Lead capture. The real CRM/nurture backend (Supabase/Attio/
// n8n) is gated on connector auth; until then this composes a forge-mail so no lead drops.
const SERVICES = ['Voice (Maeve)', 'Software', 'Automations', 'Web', 'Not sure yet']

export default function Contact() {
  const [sent, setSent] = useState(false)

  const onSubmit = (e) => {
    e.preventDefault()
    strike()
    const f = new FormData(e.currentTarget)
    const body = [
      `Name: ${f.get('name') || ''}`,
      `Business: ${f.get('business') || ''}`,
      `Email: ${f.get('email') || ''}`,
      `Phone: ${f.get('phone') || ''}`,
      `Service: ${f.get('service') || ''}`,
      '',
      'Bottleneck:',
      f.get('bottleneck') || '',
    ].join('\n')
    const subject = 'Start the Forge — ' + (f.get('business') || f.get('name') || 'New lead')
    window.location.href = `mailto:hello@gaelworx.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  return (
    <PageShell
      kicker="Start the Forge"
      title="Name the Bottleneck."
      lede="One call. No discovery-call theater. You name the bottleneck — we forge the system that kills it. Fixed scope, fixed price, before you owe a thing."
    >
      <form className="contact-form" onSubmit={onSubmit}>
        <div className="cf-row">
          <label className="cf-field"><span>Name</span><input name="name" required autoComplete="name" /></label>
          <label className="cf-field"><span>Business</span><input name="business" autoComplete="organization" /></label>
        </div>
        <div className="cf-row">
          <label className="cf-field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
          <label className="cf-field"><span>Phone</span><input name="phone" type="tel" autoComplete="tel" /></label>
        </div>
        <label className="cf-field">
          <span>What do you need?</span>
          <select name="service" defaultValue="">
            <option value="" disabled>Point the sword…</option>
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="cf-field">
          <span>Name the bottleneck</span>
          <textarea name="bottleneck" rows={4} placeholder="The thing eating your week." />
        </label>
        <button className="cta cta--solid" type="submit"><span>Start the Forge</span></button>
        {sent && (
          <p className="cf-sent">Your forge-mail is opening. If it didn’t, write us at hello@gaelworx.com.</p>
        )}
        <p className="cf-note">Available · Continental US · 7 Days</p>
      </form>
    </PageShell>
  )
}
