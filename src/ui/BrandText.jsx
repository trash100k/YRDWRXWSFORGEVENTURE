/**
 * BrandText — body/prose renderer. Brand proper-nouns get a weight bump (.brand-term),
 * NOT the A+E ignite (igniting lowercase Cinzel makes ransom-note caps). To add a term,
 * append it to TERMS. Longest-first so "Automatic Execution" matches before "Maeve" etc.
 */
export const TERMS = [
  'Automatic Execution',
  'GAELWORX',
  'YardWorx',
  'RepairWorx',
  'SalesWorx',
  'AgentWorx',
  'Maeve',
]

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const RE = new RegExp('(' + TERMS.map(escape).join('|') + ')', 'g')

export default function BrandText({ text, className = '' }) {
  const parts = String(text).split(RE)
  return (
    <span className={className}>
      {parts.map((p, i) =>
        TERMS.includes(p) ? (
          <span key={i} className="brand-term">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  )
}
