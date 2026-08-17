// Regenerates the value-bearing tables in docs/design-tokens.html from the
// theme itself.  npm run tokens
//
// The page's prose is written by hand and stays that way — it explains
// decisions, which no script can do. Everything carrying a *value* sits between
// sentinels and is rewritten from src/theme/index.js and
// src/data/routineStyles.js:
//
//   <!-- generated:core -->  ...table...  <!-- /generated:core -->
//
// Why: the page was hand-transcribed twice and went stale twice — showing
// colours the app had stopped using, which is worse than showing none, because
// someone builds Figma variables from it. Generated values cannot drift.
//
// `npm run doctor` runs this against a copy and fails if the committed file
// differs, so drift is caught rather than trusted.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { LIGHT, DARK, TYPE, CAP } from '../src/theme/index.js'
import {
  CANONICAL_ORDER,
  styleFor,
  restTintFor,
  paleFor,
  inkFor,
  washFor,
} from '../src/data/routineStyles.js'

const here = dirname(fileURLToPath(import.meta.url))
const PAGE = join(here, '..', 'docs', 'design-tokens.html')

// ── helpers ───────────────────────────────────────────────────────────────

const ch = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)

const lstar = (hex) => {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = ch(hex).map(lin)
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  return 116 * f(y) - 16
}

const parts = (rgba) => {
  const m = rgba.match(/rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)/)
  return {
    hex: '#' + [1, 2, 3].map((i) => (+m[i]).toString(16).padStart(2, '0')).join('').toUpperCase(),
    pct: Math.round(+m[4] * 100),
  }
}

const pct = (v) => {
  const m = String(v).match(/rgba\([^,]+, [^,]+, [^,]+, ([0-9.]+)\)/)
  return m ? ` @ ${Math.round(+m[1] * 100)}%` : ''
}

const chip = (hex) => `<span class="chip" style="background:${hex}"></span>`

// A translucent value drawn over the ground it actually sits on, rather than
// over nothing — showing it flat is how these came out solid black once.
const sheer = (rgba, ground) =>
  `<span class="chip" style="background:${ground}"><span class="chip" style="background:${rgba};border:0;width:100%;height:100%;border-radius:3px"></span></span>`

const HUE = {
  glutes: 'yellow',
  'full body': 'red',
  core: 'pink',
  'upper body': 'orange',
  mobility: 'lime',
  'lower body': 'blue',
}
const TILT = { glutes: '3°', 'full body': '−5°', core: '−2°', 'upper body': '0°', mobility: '4°', 'lower body': '−3°' }

// Which primitive each neutral is, and what consumes it. The mapping is stated
// because it is a naming decision, but every hex beside it is read from LIGHT
// and DARK, so a repaint cannot leave this behind.
const NEUTRALS = [
  ['neutral/0', '#FFFFFF', 'both', 'text/on-ink · tab-bar edge and wash · routine ink (white)'],
  ['neutral/25', LIGHT.bg, 'l', 'surface/page'],
  ['neutral/50', LIGHT.bgRaised, 'l', 'surface/raised · surface/card-translucent'],
  ['neutral/100', DARK.text, 'd', 'text/primary · tab-bar edge and indicator'],
  ['neutral/300', LIGHT.border, 'l', 'border/default · switch track'],
  ['neutral/500', DARK.textDim, 'd', 'text/secondary'],
  ['neutral/600', LIGHT.textDim, 'l', 'text/secondary'],
  ['neutral/800', DARK.border, 'd', 'border/default · switch track · tab-bar wash'],
  ['neutral/925', DARK.bgRaised, 'd', 'surface/raised · surface/card-translucent · tab-bar wash'],
  ['neutral/950', LIGHT.text, 'l', 'text/primary'],
  ['neutral/975', DARK.bg, 'd', 'surface/page · text/on-ink'],
  ['neutral/1000', '#0A0A0A', 'both', 'tab-bar indicator · routine ink (black)'],
]
const MARK = {
  l: '<span class="pill mode-l">L</span>',
  d: '<span class="pill mode-d">D</span>',
  both: '<span class="pill mode-l">L</span> <span class="pill mode-d">D</span>',
}

// ── the generated regions ─────────────────────────────────────────────────

const regions = {}

regions.ramp =
  '<div class="ramp">' +
  NEUTRALS.map(([, hex]) => `<div style="background:${hex}"></div>`).join('') +
  '</div>'

regions.neutrals = `<table>
      <thead><tr><th>Primitive</th><th>Hex</th><th class="num">L*</th><th>Mode</th><th>Consumed by</th></tr></thead>
      <tbody>
${NEUTRALS.map(
  ([name, hex, mode, used]) =>
    `        <tr><td><code>${name}</code></td><td>${chip(hex)} <span class="mono">${hex.toUpperCase()}</span></td><td class="num">${lstar(hex).toFixed(1)}</td><td>${MARK[mode]}</td><td>${used}</td></tr>`,
).join('\n')}
      </tbody>
    </table>`

for (const name of CANONICAL_ORDER) {
  const f = HUE[name]
  const wl = parts(washFor('light', name))
  const wd = parts(washFor('dark', name))
  const rows = [
    ['200', paleFor('light', name).background, '300', paleFor('dark', name).background, 'History cell'],
    ['500', styleFor('light', name).background, '600', styleFor('dark', name).background, 'Card, and the workout screen'],
    ['700', restTintFor('light', name), '800', restTintFor('dark', name), 'Rest sweep'],
    ['900', wl.hex, '950', wd.hex, `Button wash — drawn at ${wl.pct}% and ${wd.pct}%`],
  ]
  regions[`hue-${f}`] = `<table>
      <thead><tr><th>${f} <span class="eyebrow">${name}</span></th><th>Light</th><th>Dark</th><th>Role</th></tr></thead>
      <tbody>
${rows
  .map(
    ([sl, hl, sd, hd, role]) =>
      `        <tr><td><code>${f}/${sl}</code> &nbsp;<code>${f}/${sd}</code></td><td>${chip(hl)} <span class="mono">${hl.toUpperCase()}</span></td><td>${chip(hd)} <span class="mono">${hd.toUpperCase()}</span></td><td>${role}</td></tr>`,
  )
  .join('\n')}
      </tbody>
    </table>`
}

// red/400 is the one primitive no routine produces — it is the danger red
// lightened for dark mode, so it sits outside the six hue tables above and
// needs a region of its own rather than being transcribed.
regions['hue-red-extra'] = `<table>
      <thead><tr><th>Primitive</th><th>Hex</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td><code>red/400</code></td><td>${chip(DARK.danger)} <span class="mono">${DARK.danger.toUpperCase()}</span></td><td>Danger in dark. The light red lightened until white on it clears AA</td></tr>
      </tbody>
    </table>`

const CORE = [
  ['surface/page', 'bg', 'neutral/25', 'neutral/975', 'The page'],
  ['surface/raised', 'bgRaised', 'neutral/50', 'neutral/925', 'Cards. <strong>Lighter</strong> than the page in dark'],
  ['surface/card-translucent', 'surfaceCard', 'neutral/50', 'neutral/925', 'A tint, not a panel. One use: the wash behind Home’s restack button'],
  ['text/primary', 'text', 'neutral/950', 'neutral/100', 'Type <em>and</em> filled buttons'],
  ['text/secondary', 'textDim', 'neutral/600', 'neutral/500', 'Held near 5:1, deliberately not brighter'],
  ['text/on-ink', 'onInk', 'neutral/0', 'neutral/975', 'On a filled ink surface'],
  ['border/default', 'border', 'neutral/300', 'neutral/800', 'Separators'],
  ['state/danger', 'danger', 'red/500', 'red/400', 'Destructive only'],
]
const swatch = (v, ground) => (String(v).startsWith('#') ? chip(v) : sheer(v, ground))

regions.core = `<table>
      <thead><tr><th>Token</th><th>Light</th><th>Dark</th><th>Role</th></tr></thead>
      <tbody>
${CORE.map(
  ([t, k, pl, pd, role]) =>
    `        <tr><td><code>${t}</code></td><td>${swatch(LIGHT[k], LIGHT.bg)} <code class="alias">${pl}</code>${pct(LIGHT[k])}</td><td>${swatch(DARK[k], DARK.bg)} <code class="alias">${pd}</code>${pct(DARK[k])}</td><td>${role}</td></tr>`,
).join('\n')}
      </tbody>
    </table>`

regions.component = `<table>
      <thead><tr><th>Token</th><th>Light</th><th>Dark</th><th>Was</th></tr></thead>
      <tbody>
        <tr><td><code>component/switch/track</code></td><td>${chip(LIGHT.controlTrack)} <code class="alias">neutral/300</code></td><td>${chip(DARK.controlTrack)} <code class="alias">neutral/800</code></td><td><code>control/track</code></td></tr>
        <tr><td><code>component/tab-bar/indicator</code></td><td>${sheer(LIGHT.highlight, LIGHT.bg)} <code class="alias">neutral/1000</code>${pct(LIGHT.highlight)}</td><td>${sheer(DARK.highlight, DARK.bg)} <code class="alias">neutral/100</code>${pct(DARK.highlight)}</td><td><code>control/highlight</code></td></tr>
        <tr><td><code>component/tab-bar/edge</code></td><td>${sheer(LIGHT.glassEdge, LIGHT.bg)} <code class="alias">neutral/0</code>${pct(LIGHT.glassEdge)}</td><td>${sheer(DARK.glassEdge, DARK.bg)} <code class="alias">neutral/100</code>${pct(DARK.glassEdge)}</td><td><code>line/glass-edge</code></td></tr>
        <tr><td><code>component/tab-bar/wash-start</code></td><td>${sheer(LIGHT.glassWash[0], LIGHT.bg)} <code class="alias">neutral/0</code>${pct(LIGHT.glassWash[0])}</td><td>${sheer(DARK.glassWash[0], DARK.bg)} <code class="alias">neutral/800</code>${pct(DARK.glassWash[0])}</td><td rowspan="2"><code>glass/wash-top</code> and <code>-bottom</code></td></tr>
        <tr><td><code>component/tab-bar/wash-end</code></td><td>${sheer(LIGHT.glassWash[1], LIGHT.bg)} <code class="alias">neutral/0</code>${pct(LIGHT.glassWash[1])}</td><td>${sheer(DARK.glassWash[1], DARK.bg)} <code class="alias">neutral/925</code>${pct(DARK.glassWash[1])}</td></tr>
      </tbody>
    </table>`

const inkName = (hex) => (hex === '#0a0a0a' ? 'neutral/1000' : 'neutral/0')
regions.routines = `<table>
      <thead><tr><th>Token</th><th>Light</th><th>Dark</th></tr></thead>
      <tbody>
${CANONICAL_ORDER.map((name, i) => {
  const f = HUE[name]
  const slug = name.replace(' ', '-')
  const wl = parts(washFor('light', name))
  const wd = parts(washFor('dark', name))
  // full body light kept the one wash the old solver produced, and it is
  // identical to its sweep — so it aliases 700 rather than gaining a 900.
  const washL = wl.hex.toUpperCase() === restTintFor('light', name).toUpperCase() ? `${f}/700` : `${f}/900`
  return `        <tr><td colspan="3"><strong>${i + 1} &nbsp; ${name[0].toUpperCase() + name.slice(1)}</strong> &nbsp;<span class="eyebrow">tilt ${TILT[name]}</span></td></tr>
        <tr><td><code>routine/${slug}/history</code></td><td>${chip(paleFor('light', name).background)} <code class="alias">${f}/200</code></td><td>${chip(paleFor('dark', name).background)} <code class="alias">${f}/300</code></td></tr>
        <tr><td><code>routine/${slug}/base</code></td><td>${chip(styleFor('light', name).background)} <code class="alias">${f}/500</code></td><td>${chip(styleFor('dark', name).background)} <code class="alias">${f}/600</code></td></tr>
        <tr><td><code>routine/${slug}/sweep</code></td><td>${chip(restTintFor('light', name))} <code class="alias">${f}/700</code></td><td>${chip(restTintFor('dark', name))} <code class="alias">${f}/800</code></td></tr>
        <tr><td><code>routine/${slug}/ink</code></td><td><code class="alias">${inkName(inkFor('light', name))}</code></td><td><code class="alias">${inkName(inkFor('dark', name))}</code></td></tr>
        <tr><td><code>routine/${slug}/wash</code></td><td>${chip(wl.hex)} <code class="alias">${washL}</code> @ ${wl.pct}%</td><td>${chip(wd.hex)} <code class="alias">${f}/950</code> @ ${wd.pct}%</td></tr>`
}).join('\n')}
      </tbody>
    </table>`

const USED_FOR = {
  caption: 'Notes and disclaimers — read once, then stopped being seen',
  label: 'The app’s voice. Renders shouted; the copy is written in sentence case',
  body: 'Prose. The one role written to be read at length, and uncapped for it',
  control: 'Button labels, and only those. Sentence case on purpose — see below',
  routineCardMeta: '“50 MIN”, “6 EXERCISES” under a card’s name',
  title: 'Section heads, History cell names and years, both segmented controls. Bold in all six',
  heading: 'The exercise you are on, and “Nice work!” when a workout ends',
  routineCard: 'A routine’s name on its card',
  screenTitle: 'Page titles, and the typed body weight on Settings',
  figure: 'The Stats counters. Tabular, so a column of them lines up',
  hero: 'The figure being lifted, and the finished time. <strong>Proportional</strong>, not tabular',
}
const track = (r) => {
  if (!r.letterSpacing) return '0'
  const p = Math.round((r.letterSpacing / r.fontSize) * 100)
  return (p > 0 ? '+' : '') + p + '%'
}
regions.type = `<table>
      <thead>
        <tr><th>Role</th><th class="num">Size</th><th class="num">Weight</th><th>Face</th><th class="num">Tracking</th><th>Case</th><th class="num">Max scale</th><th>Used for</th></tr>
      </thead>
      <tbody>
${Object.entries(TYPE)
  .map(
    ([k, r]) =>
      `        <tr><td><code>${k}</code></td><td class="num">${r.fontSize}</td><td class="num">${r.fontWeight}</td><td>${r.fontFamily === 'ui-rounded' ? 'Rounded' : 'SF Pro'}</td><td class="num">${track(r)}</td><td>${r.textTransform ? 'UPPER' : '—'}</td><td class="num">${CAP[k]?.maxFontSizeMultiplier ?? 'none'}</td><td>${USED_FOR[k] ?? ''}</td></tr>`,
  )
  .join('\n')}
      </tbody>
    </table>`

// ── splice ────────────────────────────────────────────────────────────────

let page = readFileSync(PAGE, 'utf8')
let replaced = 0
for (const [name, html] of Object.entries(regions)) {
  const open = `<!-- generated:${name} -->`
  const close = `<!-- /generated:${name} -->`
  const i = page.indexOf(open)
  const j = page.indexOf(close)
  if (i === -1 || j === -1) {
    console.error(`  missing sentinels for "${name}" — add ${open} … ${close} to the page`)
    process.exitCode = 1
    continue
  }
  page = page.slice(0, i + open.length) + '\n' + html + '\n' + page.slice(j)
  replaced++
}

const check = process.argv.includes('--check')
const current = readFileSync(PAGE, 'utf8')
if (check) {
  if (current !== page) {
    console.error('docs/design-tokens.html is out of date — run `npm run tokens`')
    process.exitCode = 1
  } else {
    console.log(`docs/design-tokens.html matches the theme (${replaced} regions)`)
  }
} else {
  writeFileSync(PAGE, page)
  console.log(`docs/design-tokens.html regenerated — ${replaced} regions`)
}
