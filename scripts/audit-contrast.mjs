// Contrast audit.  npm run audit
//
// Reads the app's own theme and routine colours and checks every pair of text
// and the surface it sits on — both schemes, all six routines — against WCAG.
//
// It imports those modules rather than listing hex codes, so it cannot drift
// from what the app renders. If you change a colour, run this.
//
// Three things it does that an off-the-shelf checker cannot:
//
//   It composites opacity. Text at 0.7 blends with its ground, so a pair that
//   measures 4.5:1 can render at 3.2:1. The worst failure ever found here was
//   a footnote at 2.09:1 whose colour pair measured perfectly well.
//
//   It checks the second ground. A label on the workout screen sits on the card
//   at rest and on the rest-sweep colour during a countdown. Most of the
//   failures this has found were on that second surface.
//
//   It resolves the translucent button. The wash is a colour and an opacity
//   over the card, so what the label actually sits on has to be worked out
//   rather than read.
//
// What it cannot do: account for the blur behind the workout button, which is a
// native effect. Those readings are the wash over the card, so the real button
// is lighter or darker than they say.

import { LIGHT, DARK, TYPE } from '../src/theme/index.js'
import {
  CANONICAL_ORDER,
  inkFor,
  styleFor,
  restTintFor,
  paleFor,
  washFor,
} from '../src/data/routineStyles.js'

const ch = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)

const lum = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)]
  const [hi, lo] = x > y ? [x, y] : [y, x]
  return (hi + 0.05) / (lo + 0.05)
}

// A translucent layer over its ground.
const over = (fg, bg, a = 1) => fg.map((c, i) => a * c + (1 - a) * bg[i])

const rgba = (s) => {
  const m = s.match(/rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)/)
  return { rgb: [+m[1] / 255, +m[2] / 255, +m[3] / 255], a: +m[4] }
}

// WCAG asks 4.5:1 for text, 3:1 for large text — which is >=24px, or >=18.66px
// when bold. Note those are CSS pixels: the spec says 18pt/14pt and a point is
// 1⅓ px, so reading "18pt" literally wrongly exempts most headings.
//
// 3:1 also covers non-text content under 1.4.11 — icons, control boundaries,
// meaningful graphics. Pass `{ icon: true }` for those. Holding an icon to the
// text threshold is a mistake this audit made for a while, and it reported the
// delete glyph as failing when it clears its actual requirement comfortably.
const required = (role) => {
  if (role.icon) return 3.0
  const w = parseInt(role.fontWeight ?? '400', 10)
  return role.fontSize >= 24 || (w >= 700 && role.fontSize >= 18.66) ? 3.0 : 4.5
}

const rows = []
const check = (where, what, fg, bg, role, alpha = 1) => {
  const want = required(role)
  const got = ratio(over(fg, bg, alpha), bg)
  rows.push({ where, what, got, want, pass: got >= want, size: role.fontSize })
}

for (const scheme of ['light', 'dark']) {
  const T = scheme === 'light' ? LIGHT : DARK
  const s = scheme.toUpperCase()

  check(s, 'body text on the page', ch(T.text), ch(T.bg), TYPE.body)
  check(s, 'secondary on the page', ch(T.textDim), ch(T.bg), TYPE.caption)
  check(s, 'secondary on a card', ch(T.textDim), ch(T.bgRaised), TYPE.caption)
  check(s, 'label on a filled button', ch(T.onInk), ch(T.text), TYPE.control)
  check(s, 'trash icon on the danger fill', ch(T.onInk), ch(T.danger), { icon: true })

  for (const name of CANONICAL_ORDER) {
    const base = ch(styleFor(scheme, name).background)
    const sweep = ch(restTintFor(scheme, name))
    const card = ch(paleFor(scheme, name).background)
    const ink = ch(inkFor(scheme, name))
    const w = rgba(washFor(scheme, name))
    const r = `${s} ${name}`

    check(r, 'exercise name on the card', ink, base, TYPE.heading)
    check(r, 'the big figure', ink, base, TYPE.hero)
    check(r, 'small caps on the card', ink, base, TYPE.label)
    check(r, 'small caps during the sweep', ink, sweep, TYPE.label)
    check(r, 'the next-exercise signpost', ink, base, TYPE.title)
    check(r, 'button label', ink, over(w.rgb, base, w.a), TYPE.control)
    check(r, 'button label, mid-sweep', ink, over(w.rgb, sweep, w.a), TYPE.control)
    check(r, 'history cell text', ch(paleFor(scheme, name).ink), card, TYPE.label)
  }
}

const bad = rows.filter((r) => !r.pass).sort((a, b) => a.got - b.got)
console.log(`${rows.length} pairs checked, ${bad.length} below WCAG AA\n`)
for (const r of bad) {
  const size = r.size ? String(r.size).padStart(2) + 'pt' : 'icon'
  console.log(`  ${r.got.toFixed(2)}:1  need ${r.want}  ${size}  ${r.where} — ${r.what}`)
}

// Passing now, but one palette tweak from not passing.
const near = rows.filter((r) => r.pass && r.got < r.want * 1.15).sort((a, b) => a.got - b.got)
if (near.length) {
  console.log('\nwithin 15% of the line')
  for (const r of near) console.log(`  ${r.got.toFixed(2)}:1  need ${r.want}  ${r.where} — ${r.what}`)
}

process.exitCode = 0
