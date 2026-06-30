// Bundled fonts for troika <Text> in the 3D scene.
//
// troika-three-text fetches its font over the network at runtime and defaults to a
// Google-hosted Roboto. In this sandbox (and under a strict production CSP) that fetch is
// blocked, so the text renders BLANK. We hand troika a LOCAL, same-origin Vite asset URL
// instead — it never touches the public web. troika parses .woff (NOT .woff2), so we point
// at the .woff files @fontsource ships. Cinzel Decorative 900 is the brand display weight
// (the GAELWORX wordmark + the A/E divine fire); Hanken Grotesk 600 is body/labels.
import cinzel900 from '@fontsource/cinzel-decorative/files/cinzel-decorative-latin-900-normal.woff?url'
import cinzel700 from '@fontsource/cinzel-decorative/files/cinzel-decorative-latin-700-normal.woff?url'
import hanken600 from '@fontsource/hanken-grotesk/files/hanken-grotesk-latin-600-normal.woff?url'

export const FONT_DISPLAY = cinzel900 // Cinzel Decorative 900 — brand display / headings / A·E
export const FONT_DISPLAY_700 = cinzel700 // Cinzel Decorative 700 — lighter display
export const FONT_BODY = hanken600 // Hanken Grotesk 600 — body / kicker / labels
