// scripts/qa-shots.mjs — the art-director QA harness.
//
// Shoots the forge across a route × beat × viewport matrix and writes PNGs to qa/ so the
// frames can be judged against docs/references/ + the Look Bible like a human art director.
//
// It builds once, spawns `vite preview`, then drives the pre-installed Chromium (build 1194,
// PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers — do NOT run `playwright install`). Before every
// shot it sets window.__forge.reduced = true so the shader boil freezes and frames are stable.
//
// Usage:
//   npm run qa                 # home beats × desktop + iPhone 15  (the core loop)
//   npm run qa -- --all        # + every route + bare scenes
//   npm run qa -- --fast       # 3 home beats, desktop only (quick glance)
//   npm run qa -- --url http://localhost:5173   # attach to a running dev server (skip build/preview)
//   npm run qa -- --beats 0,0.4,0.85            # custom beat list
//   npm run qa -- --routes /,/voice             # custom route list (home beats only apply to /)

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import net from 'node:net'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(ROOT, 'qa')
const PORT = 4317

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const FAST = has('--fast')
const ALL = has('--all')
const URL_ATTACH = val('--url', null)

const HOME_BEATS = (val('--beats', null)?.split(',').map(Number))
  || (FAST ? [0.0, 0.4, 0.85] : [0.0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0])

// routes that render their own scene / backdrop (shot once, no beat)
const ROUTE_LIST = (val('--routes', null)?.split(','))
  || (ALL ? ['/', '/voice', '/software', '/automations', '/web', '/about', '/work', '/pricing', '/contact', '/concept', '/lab'] : ['/'])

const VIEWPORTS = FAST
  ? [{ name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 }]
  : [
      { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
      { name: 'iphone15', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    ]

// ── helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const slug = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/\//g, '-'))

function waitPort(port, timeout = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const s = net.connect(port, '127.0.0.1')
      s.once('connect', () => { s.destroy(); resolve() })
      s.once('error', () => {
        s.destroy()
        if (Date.now() - start > timeout) reject(new Error('preview did not start'))
        else setTimeout(tryOnce, 300)
      })
    }
    tryOnce()
  })
}

async function waitForForge(page, beat) {
  await page.waitForSelector('canvas', { state: 'attached', timeout: 20000 })
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas')
    return c && c.width > 0 && c.height > 0 && window.__forge
  }, { timeout: 20000 })
  // freeze the boil so frames are reproducible; pin the beat if one was requested
  await page.evaluate((b) => {
    window.__forge.reduced = true
    if (b != null) { window.__forge.scroll = b; window.__forge.temperature = 0.14 + (window.__forge.routeTemp || 0) + b * 0.6 }
  }, beat ?? null)
  if (beat != null) {
    // App.jsx's rAF re-pins scroll every frame on /?beat= — give it a beat to settle the camera lerp
    await page.waitForTimeout(700)
  } else {
    await page.waitForTimeout(500)
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })

  let preview
  let base = URL_ATTACH
  if (!base) {
    if (!existsSync(path.join(ROOT, 'dist'))) {
      console.log('· building (vite build)…')
      await run('npx', ['vite', 'build'], ROOT)
    }
    console.log('· starting vite preview…')
    preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
    await waitPort(PORT)
    base = `http://localhost:${PORT}`
  }
  console.log('· base:', base)

  const browser = await chromium.launch({ headless: true })
  let shots = 0
  try {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        isMobile: !!vp.isMobile,
        hasTouch: !!vp.hasTouch,
        colorScheme: 'dark',
      })
      for (const route of ROUTE_LIST) {
        // home ('/') is shot across the beat matrix; every other route once (no beat)
        const beats = route === '/' ? HOME_BEATS : [null]
        for (const beat of beats) {
          const url = base + route + (beat != null ? `?beat=${beat}` : '')
          const page = await ctx.newPage()
          try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
            await waitForForge(page, beat)
            const name = `${vp.name}__${slug(route)}__beat-${beat != null ? beat.toFixed(2) : 'na'}.png`
            await page.screenshot({ path: path.join(OUT, name) })
            shots++
            const cam = await page.evaluate(() => (window.__camPos ? window.__camPos.map((n) => Math.round(n * 10) / 10) : null))
            console.log(`  ✔ ${name}${cam ? `  cam=${JSON.stringify(cam)}` : ''}`)
          } catch (e) {
            console.warn(`  x FAILED ${route} beat=${beat}: ${String(e.message).split('\n')[0]}`)
          } finally {
            await page.close()
          }
        }
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
    if (preview) preview.kill('SIGTERM')
  }
  console.log(`\n· ${shots} shots → ${path.relative(ROOT, OUT)}/`)
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: 'inherit' })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

main().catch((e) => { console.error(e); process.exit(1) })
