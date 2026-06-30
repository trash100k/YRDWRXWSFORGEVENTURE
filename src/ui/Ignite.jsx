/**
 * Ignite — the A+E rule, in DOM. Within each WORD, only the FIRST `A` and FIRST `E`
 * ignite (900 Cinzel, forge-glow gradient via .forge-letter). Use in ALL-CAPS display
 * only (Cinzel has no lowercase). For running prose, use <BrandText> instead.
 */

// indices of the first A and first E in a word (case-insensitive)
export function igniteIndices(word) {
  const idx = new Set()
  const a = word.search(/[Aa]/)
  if (a >= 0) idx.add(a)
  const e = word.search(/[Ee]/)
  if (e >= 0) idx.add(e)
  return idx
}

export default function Ignite({ text, className = '' }) {
  const tokens = String(text).split(/(\s+)/) // keep the whitespace tokens
  return (
    <span className={className}>
      {tokens.map((tok, ti) => {
        if (/^\s+$/.test(tok) || tok === '') return tok
        const ig = igniteIndices(tok)
        return (
          <span key={ti} className="ignite-word">
            {[...tok].map((ch, ci) =>
              ig.has(ci) ? (
                <span key={ci} className="forge-letter">{ch}</span>
              ) : (
                <span key={ci}>{ch}</span>
              )
            )}
          </span>
        )
      })}
    </span>
  )
}
