import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import net from 'node:net'

const PORT = 4319
const waitPort = (port, t = 20000) => new Promise((res, rej) => {
  const s0 = Date.now()
  const tick = () => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.destroy(); res() }); s.once('error', () => { s.destroy(); Date.now() - s0 > t ? rej(new Error('no preview')) : setTimeout(tick, 300) }) }
  tick()
})

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
try {
  await waitPort(PORT)
  const b = await chromium.launch({ headless: true })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e.message).split('\n')[0]))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().split('\n')[0]) })
  await p.goto(`http://localhost:${PORT}/?beat=0.93`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  let ok = false
  for (let i = 0; i < 20; i++) {
    ok = await p.evaluate(() => { const c = document.querySelector('canvas'); return !!(c && c.width > 0 && window.__forge) })
    if (ok) break
    await new Promise((r) => setTimeout(r, 400))
  }
  console.log('canvas+forge ready:', ok)
  console.log('errors:\n  ' + (errs.length ? [...new Set(errs)].slice(0, 8).join('\n  ') : '(none)'))
  await b.close()
} catch (e) {
  console.error('PROBE FAIL', e.message)
} finally {
  preview.kill('SIGTERM')
}
process.exit(0)
