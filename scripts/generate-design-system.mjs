// Builds docs/design-system.html from the app itself.  npm run design-system
//
// The whole page is generated. Unlike docs/design-tokens.html, which is prose
// written by hand with generated tables dropped into it, there is nothing here
// to preserve between runs — the explanatory text lives in this file, next to
// the code that reads the value it explains, and the output is overwritten
// whole. If a sentence here disagrees with the theme, the sentence is wrong.
//
// Nothing is transcribed. Colours, sizes, tracking, caps, spacing, radii and
// the icon path data are all read from src/theme, src/data/routineStyles.js and
// src/components/*Icons.jsx at generation time.
//
// `npm run doctor` runs this with --check and fails if the committed page
// differs from what the theme produces now.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  LIGHT,
  DARK,
  TYPE,
  CAP,
  SPACE,
  RADIUS,
  NAV_HEIGHT,
  NAV_FLOAT_GAP,
  TAB_BAR_CLEARANCE,
  SYSTEM_LINE,
  SYSTEM_CAP,
} from '../src/theme/index.js'
import {
  CANONICAL_ORDER,
  styleFor,
  restTintFor,
  paleFor,
  inkFor,
  inkOn,
  washFor,
} from '../src/data/routineStyles.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const OUT = join(root, 'docs', 'design-system.html')

// ── colour maths, for the contrast figures shown beside each pair ──────────

const ch = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (hex) => {
  const [r, g, b] = ch(hex).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
const lstar = (hex) => {
  const y = lum(hex)
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  return 116 * f(y) - 16
}
// An rgba over a known ground, so a translucent token can be shown as the
// colour it actually becomes rather than as a swatch of nothing.
const over = (rgba, groundHex) => {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/)
  if (!m) return rgba
  const a = m[4] === undefined ? 1 : +m[4]
  const g = ch(groundHex).map((c) => c * 255)
  const mix = [1, 2, 3].map((i) => Math.round(+m[i] * a + g[i - 1] * (1 - a)))
  return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('')
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ── icons, read out of the component source ───────────────────────────────
//
// The icons are react-native-svg elements whose colour is a prop, so the shapes
// can be lifted straight out and re-drawn here with currentColor. What is
// parsed: literal `d="…"`, `d={CONST}` against a module-level string, template
// literals joining two constants, arrays of path strings passed to .map(), and
// <Rect> with its transform. Anything a file cannot yield is an error rather
// than a silent omission — an icon quietly missing from a gallery of icons is
// exactly the kind of thing nobody notices.

const readIcons = (file) => {
  const src = readFileSync(join(root, 'src/components', file), 'utf8')

  const consts = {}
  for (const m of src.matchAll(/^const (\w+) =\s*\n?\s*'([^']+)'/gm)) consts[m[1]] = m[2]

  const bodies = []
  const rx = /export function (\w+)\(([^)]*)\)\s*\{/g
  let m
  while ((m = rx.exec(src))) {
    const start = m.index + m[0].length
    const next = new RegExp(rx.source, 'g')
    next.lastIndex = rx.lastIndex
    const after = next.exec(src)
    bodies.push({
      name: m[1],
      hasActive: /\bactive\b/.test(m[2]),
      body: src.slice(start, after ? after.index : src.length),
    })
  }

  const icons = []
  for (const { name, hasActive, body: raw } of bodies) {
    // An icon with two states draws one or the other, never both. Keep the
    // resting branch of `{active ? (…) : (…)}` — the selected state is the
    // tab bar's job to show, and a gallery wants the shape at rest.
    let body = raw
    const tern = body.indexOf('{active ? (')
    if (tern !== -1) {
      const elseAt = body.indexOf(') : (', tern)
      if (elseAt !== -1) body = body.slice(0, tern) + body.slice(elseAt + 5)
    }

    // `{...plate}` — an attribute bag defined next to the element — and
    // `{...stroke(color)}`, where the bag comes from a helper that returns one.
    // The second form is why six icons drew nothing: no bag was resolved, so no
    // stroke was emitted and the shape was painted in nothing at all.
    const spreads = {}
    for (const o of src.matchAll(/const (\w+) = \([^)]*\) => \(\{([\s\S]*?)\n\}\)/g)) {
      const bag = {}
      for (const kv of o[2].matchAll(/(\w+):\s*([^,\n]+)/g)) {
        bag[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '')
      }
      spreads[o[1]] = bag
    }
    for (const o of body.matchAll(/const (\w+) = \{([\s\S]*?)\n\s*\}/g)) {
      const bag = {}
      for (const kv of o[2].matchAll(/(\w+):\s*([^,\n]+)/g)) {
        let v = kv[2].trim()
        const t = v.match(/^\w+ \? .+ : (.+)$/) // active ? x : y — take the resting value
        if (t) v = t[1].trim()
        bag[kv[1]] = v.replace(/^['"]|['"]$/g, '')
      }
      spreads[o[1]] = bag
    }

    // Paths generated by mapping over an array of `d` strings.
    const mapped = [...body.matchAll(/\[((?:\s*'[^']+',?\s*)+)\]\.map/g)].map((a) =>
      [...a[1].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    )

    const shapes = []
    for (const el of body.matchAll(/<(Path|Rect|Circle)\b([\s\S]*?)\/>/g)) {
      const tag = el[1]
      let attrs = el[2]
      for (const sp of attrs.matchAll(/\{\.\.\.(\w+)(?:\([^)]*\))?\}/g)) {
        const bag = spreads[sp[1]]
        if (bag) attrs += ' ' + Object.entries(bag).map(([k, v]) => `${k}="${v}"`).join(' ')
      }

      const attr = (k) => {
        const m2 = attrs.match(new RegExp(`\\b${k}=(?:"([^"]*)"|\\{([^{}]*)\\})`))
        if (!m2) return null
        let v = (m2[1] ?? m2[2]).trim()
        const t = v.match(/^\w+ \? .+ : (.+)$/)
        if (t) v = t[1].trim()
        return v.replace(/^['"`]|['"`]$/g, '')
      }

      // Colour is a prop in the app; here it inherits.
      const strokeRaw = attr('stroke')
      const fillRaw = attr('fill')
      const filled = fillRaw && fillRaw !== 'none'
      // These are outline icons: an element that resolved neither is stroked,
      // not invisible. Getting this wrong is silent — the icon still lays out,
      // it simply has no shape in it.
      const stroked = (strokeRaw && strokeRaw !== 'none') || !filled
      const paint =
        `fill="${filled ? 'currentColor' : 'none'}"` +
        (stroked
          ? ` stroke="currentColor" stroke-width="${attr('strokeWidth') ?? 2}"` +
            ` stroke-linecap="${attr('strokeLinecap') ?? 'round'}"` +
            ` stroke-linejoin="${attr('strokeLinejoin') ?? 'round'}"`
          : '') +
        (attr('fillRule') ? ` fill-rule="${attr('fillRule')}"` : '')
      const tf = attr('transform') ? ` transform="${attr('transform')}"` : ''

      if (tag === 'Circle') {
        shapes.push(
          `<circle cx="${attr('cx') ?? 12}" cy="${attr('cy') ?? 12}" r="${attr('r') ?? 9}"${tf} ${paint}/>`,
        )
        continue
      }

      if (tag === 'Rect') {
        const need = ['width', 'height'].filter((k) => attr(k) === null)
        if (need.length) throw new Error(`${name}: <Rect> is missing ${need.join(', ')}`)
        shapes.push(
          `<rect x="${attr('x') ?? 0}" y="${attr('y') ?? 0}" width="${attr('width')}"` +
            ` height="${attr('height')}"${attr('rx') ? ` rx="${attr('rx')}"` : ''}${tf} ${paint}/>`,
        )
        continue
      }

      // d="literal" | d={CONST} | d={`${A} ${B}`} | d={x} from a .map
      const dm = attrs.match(/\bd=(?:"([^"]+)"|\{`([^`]+)`\}|\{(\w+)\})/)
      if (!dm) throw new Error(`${name}: a <Path> has no readable d attribute`)
      let ds = []
      if (dm[1]) ds = [dm[1]]
      else if (dm[2]) ds = [dm[2].replace(/\$\{(\w+)\}/g, (_, k) => consts[k] ?? '')]
      else if (consts[dm[3]]) ds = [consts[dm[3]]]
      else if (mapped.length) ds = mapped.shift()
      if (!ds.length || ds.some((d) => !d))
        throw new Error(`${name}: could not resolve the d attribute ${dm[0]}`)

      for (const d of ds) shapes.push(`<path d="${d}"${tf} ${paint}/>`)
    }

    if (!shapes.length) continue
    // A shape with neither a stroke nor a fill lays out perfectly and draws
    // nothing, which is indistinguishable from an icon that is simply missing.
    if (!shapes.some((sh) => sh.includes('currentColor')))
      throw new Error(`${name}: every shape resolved to no paint — it would render blank`)
    icons.push({ name, hasActive, shapes })
  }

  if (!icons.length) throw new Error(`no icons parsed out of ${file} — the parser needs updating`)
  return icons
}

// The card's own size, read out of the component rather than restated. Node
// cannot import a .jsx, so this is parsed the same way the icon shapes are, and
// a missing constant is an error rather than a quietly wrong number.
const readConst = (file, name) => {
  const src = readFileSync(join(root, 'src/components', file), 'utf8')
  const m = src.match(new RegExp(`export const ${name} = (\\d+)`))
  if (!m) throw new Error(`${name} is no longer exported from ${file}`)
  return +m[1]
}
// The app's springs, read out of src/data/motion.js. It imports Easing from
// Reanimated, so it cannot be imported here — the constants are parsed instead,
// and a renamed spring is an error rather than a silently different animation.
const SPRINGS = (() => {
  const src = readFileSync(join(root, 'src/data/motion.js'), 'utf8')
  const out = {}
  for (const m of src.matchAll(
    /export const (\w+_SPRING) = \{ stiffness: ([\d.]+), damping: ([\d.]+), mass: ([\d.]+) \}/g,
  )) {
    out[m[1]] = { stiffness: +m[2], damping: +m[3], mass: +m[4] }
  }
  for (const need of ['TAB_SPRING', 'EXPAND_SPRING', 'REVEAL_SPRING']) {
    if (!out[need]) throw new Error(`${need} is no longer in src/data/motion.js`)
  }
  return out
})()

const CARD_WIDTH = readConst('WorkoutStack.jsx', 'CARD_WIDTH')
const CARD_HEIGHT = readConst('WorkoutStack.jsx', 'CARD_HEIGHT')

const ICON_FILES = ['TabIcons.jsx', 'WorkoutIcons.jsx', 'HistoryIcons.jsx', 'StackIcon.jsx']
const ICONS = ICON_FILES.flatMap((f) => readIcons(f).map((i) => ({ ...i, file: f })))

// ── the page's own palette, taken from the app's ──────────────────────────
//
// The design system is rendered in the design system. The neutrals, the two
// type families and the six routine hues on this page are the app's own values,
// so the page cannot look right while the app looks wrong.

const css = `
  :root {
    --bg: ${LIGHT.bg};
    --raised: ${LIGHT.bgRaised};
    --line: ${LIGHT.border};
    --ink: ${LIGHT.text};
    --dim: ${LIGHT.textDim};
    --danger: ${LIGHT.danger};
    --shadow: rgba(25, 25, 25, 0.07);
    --nav-w: 236px;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      --bg: ${DARK.bg};
      --raised: ${DARK.bgRaised};
      --line: ${DARK.border};
      --ink: ${DARK.text};
      --dim: ${DARK.textDim};
      --danger: ${DARK.danger};
      --shadow: rgba(0, 0, 0, 0.5);
    }
  }
  :root[data-theme='dark'] {
    --bg: ${DARK.bg};
    --raised: ${DARK.bgRaised};
    --line: ${DARK.border};
    --ink: ${DARK.text};
    --dim: ${DARK.textDim};
    --danger: ${DARK.danger};
    --shadow: rgba(0, 0, 0, 0.5);
  }

  /* The specimen palettes. These are pinned by the toggle rather than by the
     viewer's theme, because a dark palette has to be inspectable from a light
     page — that is most of what this page is for. */
  [data-spec='light'] {
    --s-bg: ${LIGHT.bg};
    --s-raised: ${LIGHT.bgRaised};
    --s-line: ${LIGHT.border};
    --s-ink: ${LIGHT.text};
    --s-dim: ${LIGHT.textDim};
    --s-track: ${LIGHT.controlTrack};
    --s-onink: ${LIGHT.onInk};
    --s-danger: ${LIGHT.danger};
    --s-glass-a: ${LIGHT.glassWash[0]};
    --s-glass-b: ${LIGHT.glassWash[1]};
    --s-glass-edge: ${LIGHT.glassEdge};
    --s-highlight: ${LIGHT.highlight};
  }
  [data-spec='dark'] {
    --s-bg: ${DARK.bg};
    --s-raised: ${DARK.bgRaised};
    --s-line: ${DARK.border};
    --s-ink: ${DARK.text};
    --s-dim: ${DARK.textDim};
    --s-track: ${DARK.controlTrack};
    --s-onink: ${DARK.onInk};
    --s-danger: ${DARK.danger};
    --s-glass-a: ${DARK.glassWash[0]};
    --s-glass-b: ${DARK.glassWash[1]};
    --s-glass-edge: ${DARK.glassEdge};
    --s-highlight: ${DARK.highlight};
  }

  * { box-sizing: border-box; }

  /* Any class that sets its own display value outranks the browser's built-in
     rule for the hidden attribute, so a hidden element carries on rendering.
     This bit the light and dark token grids: both were drawn, stacked, and the
     switch between them looked like it did nothing at all. */
  [hidden] { display: none !important; }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    /* The app's own two families. \`ui-rounded\` is what the app asks iOS for,
       and Safari and Chrome on a Mac resolve it to the same SF Pro Rounded, so
       this page is set in the typeface it documents. */
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  .rounded { font-family: ui-rounded, -apple-system, system-ui, sans-serif; }

  /* ── shell ─────────────────────────────────────────────────────────── */

  .shell { display: grid; grid-template-columns: var(--nav-w) minmax(0, 1fr); }

  nav {
    position: sticky; top: 0; align-self: start;
    height: 100vh; overflow-y: auto;
    border-right: 1px solid var(--line);
    padding: 28px 0 40px;
    display: flex; flex-direction: column; gap: 22px;
  }
  .brand { padding: 0 22px; display: flex; flex-direction: column; gap: 3px; }
  .brand b { font-family: ui-rounded, system-ui, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
  .brand span { font-size: 11.5px; color: var(--dim); }

  .navgroup { display: flex; flex-direction: column; gap: 1px; }
  .navgroup > p {
    margin: 0 0 5px; padding: 0 22px;
    font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--dim);
  }
  nav a {
    padding: 6px 22px; color: var(--dim); text-decoration: none; font-size: 13.5px;
    border-left: 2px solid transparent; transition: color .12s, border-color .12s;
  }
  nav a:hover { color: var(--ink); }
  nav a.on { color: var(--ink); font-weight: 600; border-left-color: var(--ink); }
  nav a:focus-visible, .copy:focus-visible, button:focus-visible {
    outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 3px;
  }

  main { min-width: 0; padding: 0 0 140px; }
  .inner { max-width: 940px; padding: 0 40px; }

  header.top { padding: 76px 40px 46px; max-width: 940px; }
  header.top h1 {
    font-family: ui-rounded, system-ui, sans-serif;
    margin: 0 0 14px; font-size: 46px; font-weight: 700;
    letter-spacing: -0.022em; line-height: 1.04; text-wrap: balance;
  }
  header.top p { margin: 0; max-width: 60ch; color: var(--dim); font-size: 16.5px; }

  section { padding-top: 60px; scroll-margin-top: 8px; }
  section > .inner > h2 {
    font-family: ui-rounded, system-ui, sans-serif;
    margin: 0 0 6px; font-size: 30px; font-weight: 700; letter-spacing: -0.014em;
  }
  .eyebrow {
    font-size: 10.5px; font-weight: 600; letter-spacing: 0.11em;
    text-transform: uppercase; color: var(--dim); margin: 0 0 10px;
  }
  h3 {
    font-family: ui-rounded, system-ui, sans-serif;
    margin: 44px 0 10px; font-size: 18px; font-weight: 700;
  }
  h4 { margin: 26px 0 8px; font-size: 14px; font-weight: 600; }
  p { margin: 0 0 12px; max-width: 68ch; }
  .lede { color: var(--dim); font-size: 16px; margin-bottom: 22px; }
  ul { margin: 0 0 14px; padding-left: 20px; }
  li { margin-bottom: 5px; max-width: 66ch; }

  .note {
    border-left: 2px solid var(--ink); background: var(--raised);
    padding: 14px 18px; margin: 18px 0; border-radius: 0 ${RADIUS.chip}px ${RADIUS.chip}px 0;
  }
  .note p:last-child { margin-bottom: 0; }
  .note b { font-weight: 600; }

  code, .mono {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 12.5px; font-variant-numeric: tabular-nums;
  }
  code { background: var(--raised); padding: 1.5px 5px; border-radius: 3px; }

  .scroll { overflow-x: auto; margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  th {
    text-align: left; font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--dim);
    padding: 0 14px 8px 0; border-bottom: 1px solid var(--line); white-space: nowrap;
  }
  td { padding: 9px 14px 9px 0; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .num { font-variant-numeric: tabular-nums; }

  /* ── swatches, and copying ─────────────────────────────────────────── */

  .copy {
    background: none; border: 0; padding: 0; margin: 0; font: inherit; color: inherit;
    cursor: pointer; display: inline-flex; align-items: center; gap: 8px; position: relative;
  }
  .copy::after {
    content: 'copied'; position: absolute; left: 50%; bottom: calc(100% + 6px);
    transform: translate(-50%, 3px); background: var(--ink); color: var(--bg);
    font-size: 10px; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 3px;
    opacity: 0; pointer-events: none; transition: opacity .15s, transform .15s; white-space: nowrap;
  }
  .copy.done::after { opacity: 1; transform: translate(-50%, 0); }

  .chip {
    width: 30px; height: 22px; border-radius: ${RADIUS.chip}px; flex: none;
    border: 1px solid var(--line); display: inline-block; vertical-align: middle;
  }
  .tokengrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(228px, 1fr)); gap: 12px; margin-bottom: 10px; }
  .token {
    border: 1px solid var(--line); border-radius: ${RADIUS.card}px; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .token .fill { height: 66px; border-bottom: 1px solid var(--line); }
  .token .meta { padding: 9px 12px 11px; display: flex; flex-direction: column; gap: 2px; }
  .token .meta b { font-size: 12.5px; font-weight: 600; }
  .token .meta span { font-size: 11.5px; color: var(--dim); }

  .ramp { display: flex; border-radius: ${RADIUS.chip}px; overflow: hidden; border: 1px solid var(--line); }
  .ramp > div { flex: 1; height: 46px; }

  /* ── specimen stage ────────────────────────────────────────────────── */

  .stage {
    background: var(--s-bg); color: var(--s-ink);
    border: 1px solid var(--line); border-radius: ${RADIUS.card}px;
    padding: 30px; margin-bottom: 10px;
    display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-start;
  }
  .stage.col { flex-direction: column; align-items: stretch; }
  .stage.center { justify-content: center; }

  .switcher { display: flex; align-items: center; gap: 10px; margin: 20px 0 12px; flex-wrap: wrap; }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: ${RADIUS.chip}px; overflow: hidden; }
  .seg button {
    background: none; border: 0; padding: 5px 13px; font: inherit; font-size: 12.5px;
    color: var(--dim); cursor: pointer;
  }
  .seg button.on { background: var(--ink); color: var(--bg); font-weight: 600; }
  .hint { font-size: 12px; color: var(--dim); }

  /* ── the app's own components, rebuilt in HTML ─────────────────────── */
  /* Sizes here are the app's own numbers, interpolated from the theme and the
     components rather than chosen to look right on a web page. */

  .scrollrow { overflow-x: auto; flex-wrap: nowrap; }

  .rcard {
    width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px; border-radius: ${RADIUS.card}px;
    flex: none; position: relative; display: block;
  }
  .rcard-name {
    position: absolute; top: 14px; left: ${SPACE[3]}px; right: ${SPACE[3]}px;
    font-family: ui-rounded, system-ui, sans-serif;
    font-weight: ${TYPE.routineCard.fontWeight}; font-size: ${TYPE.routineCard.fontSize}px;
    text-transform: uppercase; text-align: center; line-height: ${SYSTEM_LINE};
  }
  .rcard-meta {
    position: absolute; left: 0; right: 0; bottom: 20px;
    display: flex; flex-direction: column; align-items: center; gap: ${SPACE[1]}px;
    font-family: ui-rounded, system-ui, sans-serif;
    font-size: ${TYPE.routineCardMeta.fontSize}px; text-transform: uppercase;
    font-variant-numeric: tabular-nums; line-height: ${SYSTEM_LINE};
  }

  /* history cell */
  .hcell { width: 100%; max-width: 420px; border-radius: ${RADIUS.card}px; overflow: hidden; }
  .hhead {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: ${SPACE[2]}px; padding: ${SPACE[3]}px;
  }
  .hheading { display: flex; flex-direction: column; gap: ${SPACE[2]}px; min-width: 0; flex: 1; }
  .hname { font-family: ui-rounded, system-ui, sans-serif; font-weight: 700; font-size: ${TYPE.title.fontSize}px; }
  .hwhen {
    font-size: ${TYPE.label.fontSize}px; font-weight: ${TYPE.label.fontWeight};
    letter-spacing: ${TYPE.label.letterSpacing}px; text-transform: uppercase;
  }
  .htag {
    align-self: center; flex-shrink: 1; margin-right: ${SPACE[2]}px;
    padding: 5px 9px 7px; border-radius: ${RADIUS.chip}px; white-space: nowrap;
    font-size: ${TYPE.label.fontSize}px; font-weight: ${TYPE.label.fontWeight};
    letter-spacing: ${TYPE.label.letterSpacing}px; text-transform: uppercase;
  }
  .hchev { width: 24px; height: 24px; align-self: center; flex: none; }
  .hbody { padding: ${SPACE[4]}px ${SPACE[3]}px ${SPACE[3]}px; }
  .hsummary { display: flex; flex-direction: column; gap: ${SPACE[1]}px; }
  .hstat {
    display: flex; align-items: center; gap: ${SPACE[2]}px;
    font-size: ${TYPE.label.fontSize}px; font-weight: ${TYPE.label.fontWeight};
    letter-spacing: ${TYPE.label.letterSpacing}px; text-transform: uppercase;
  }
  .statico { width: 24px; height: 24px; flex: none; }
  .hlifts { margin-top: ${SPACE[3]}px; }
  .hlift {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: ${SPACE[3]}px; padding: ${SPACE[2]}px 0;
  }
  .hliftname {
    flex-shrink: 1; font-size: ${TYPE.label.fontSize}px; font-weight: ${TYPE.label.fontWeight};
    letter-spacing: ${TYPE.label.letterSpacing}px; text-transform: uppercase;
  }
  .hliftsets {
    flex-shrink: 0; text-align: right; max-width: 60%;
    font-size: ${TYPE.label.fontSize}px; font-weight: ${TYPE.label.fontWeight};
    letter-spacing: ${TYPE.caption.letterSpacing}px;
  }
  .hfoot { font-size: ${TYPE.caption.fontSize}px; margin: ${SPACE[3]}px 0 0; max-width: none; }
  .faded { opacity: 0.76; }

  /* buttons */
  .btn {
    border: 0; border-radius: ${RADIUS.pill}px; min-height: 52px;
    padding: ${SPACE[2]}px ${SPACE[3]}px; cursor: pointer;
    font-family: -apple-system, system-ui, sans-serif;
    font-size: ${TYPE.control.fontSize}px; font-weight: ${TYPE.control.fontWeight};
    background: var(--s-ink); color: var(--s-onink);
  }
  .btn.quiet { background: var(--s-raised); color: var(--s-ink); }

  /* tab bar */
  .tabbar {
    position: relative; height: ${NAV_HEIGHT}px; padding: 4px; border-radius: ${RADIUS.pill}px;
    display: flex; gap: 4px; overflow: hidden;
    background: linear-gradient(var(--s-glass-a), var(--s-glass-b));
    -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
    outline: 1px solid var(--s-glass-edge); outline-offset: -1px;
  }
  .tabitem {
    width: 64px; height: 44px; border-radius: ${RADIUS.pill}px;
    display: grid; place-items: center; color: var(--s-ink);
  }
  .tabitem.on { background: var(--s-highlight); }
  .tabitem svg { width: 22px; height: 22px; display: block; }

  /* settings */
  .scard {
    padding: ${SPACE[3]}px; border-radius: ${RADIUS.card}px; background: var(--s-raised);
    width: 100%; max-width: 420px;
  }
  .scard.editing { outline: 1px solid var(--s-ink); outline-offset: -1px; }
  .srow { display: flex; align-items: center; justify-content: space-between; gap: ${SPACE[3]}px; }
  .slabel {
    flex: 1; font-size: ${TYPE.label.fontSize}px; font-weight: ${TYPE.label.fontWeight};
    letter-spacing: ${TYPE.label.letterSpacing}px; text-transform: uppercase; color: var(--s-ink);
  }
  .snote {
    font-size: ${TYPE.caption.fontSize}px; line-height: 17px; color: var(--s-dim);
    margin: ${SPACE[2]}px 0 0; max-width: none;
  }
  .track {
    width: 46px; height: 28px; padding: 3px; border-radius: ${RADIUS.pill}px;
    background: var(--s-track); flex: none; display: flex; align-items: center;
    transition: background .15s;
  }
  .track.on { background: var(--s-ink); justify-content: flex-end; }
  .track i { width: 22px; height: 22px; border-radius: ${RADIUS.pill}px; background: var(--s-onink); display: block; }

  .choices { display: flex; gap: ${SPACE[2]}px; margin-top: ${SPACE[3]}px; }
  .choice {
    flex: 1; min-height: 90px; padding: ${SPACE[2]}px 0; border-radius: ${RADIUS.card}px;
    display: grid; place-items: center; background: var(--s-onink); color: var(--s-dim);
    font-family: ui-rounded, system-ui, sans-serif; font-weight: 700; font-size: ${TYPE.title.fontSize}px;
  }
  .choices.low .choice { min-height: 56px; }
  .choice.chosen { background: var(--s-ink); color: var(--s-onink); }

  .spreadrow {
    display: flex; align-items: baseline; justify-content: space-between;
    padding: ${SPACE[2]}px 0; border-top: 1px solid var(--s-line);
  }
  .spreadrow:first-child { border-top: 0; }
  .spreadof {
    font-size: ${TYPE.label.fontSize}px; font-weight: ${TYPE.label.fontWeight};
    letter-spacing: ${TYPE.label.letterSpacing}px; text-transform: uppercase; color: var(--s-dim);
  }
  .spreadsec {
    font-size: ${TYPE.label.fontSize}px; font-weight: ${TYPE.label.fontWeight};
    letter-spacing: ${TYPE.caption.letterSpacing}px; color: var(--s-ink);
  }

  .weightrow { display: flex; align-items: center; justify-content: space-between; }
  .weightval {
    display: flex; align-items: center;
    font-family: ui-rounded, system-ui, sans-serif; font-weight: 700;
    font-size: ${TYPE.screenTitle.fontSize}px; letter-spacing: ${TYPE.screenTitle.letterSpacing}px;
    color: var(--s-ink);
  }
  .wunit.dim { opacity: 0.45; }
  .caret { width: 3px; height: 24px; margin: 0 1px 0 2px; background: var(--s-ink); display: inline-block; }

  /* routine colour panels, laid out like the Figma library */
  .routinepanel { margin: 26px 0 30px; }
  .rname {
    font-family: ui-rounded, system-ui, sans-serif; text-transform: uppercase;
    font-size: 15px; letter-spacing: 0.03em; margin: 0 0 10px;
  }
  .rband { position: relative; display: grid; grid-template-columns: 1fr 1fr 1fr; min-height: 150px; }
  .rcol { padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
  .rrole { font-size: 11.5px; opacity: .95; }
  .rval { font-size: 11.5px; font-variant-numeric: tabular-nums; }
  .rval b { font-weight: 600; }
  .rwash {
    position: absolute; left: 16%; top: 26px; width: 34%; height: 62%;
    border-radius: ${RADIUS.card}px; padding: 10px 12px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  @media (max-width: 620px) {
    .rwash { display: none; }
  }

  /* one section at a time */
  section { display: none; }
  section.on { display: block; animation: pagein .18s ease-out; }
  @keyframes pagein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { section.on { animation: none; } }

  /* buttons, as the completion screen stacks them */
  .btnstage { align-items: center; }
  .actions { display: flex; flex-direction: column; gap: ${SPACE[2]}px; width: 100%; max-width: 340px; }
  .btn {
    width: 100%; border: 0; border-radius: ${RADIUS.pill}px; min-height: 52px;
    padding: ${SPACE[2]}px ${SPACE[3]}px; cursor: pointer;
    font-family: -apple-system, system-ui, sans-serif;
    font-size: ${TYPE.control.fontSize}px; font-weight: ${TYPE.control.fontWeight};
    transition: opacity .12s, transform .12s;
  }
  .btn:active, .btn.pressed { opacity: .82; transform: scale(.98); }
  .btn.quiet { background: var(--s-raised); color: var(--s-ink); }

  /* The pill and the reveals are driven by a spring in JS, so nothing here
     transitions them — a CSS transition on top would fight the integrator. */
  .tabpill {
    position: absolute; left: 4px; top: 4px; width: 64px; height: 44px;
    border-radius: ${RADIUS.pill}px; background: var(--s-highlight);
    will-change: transform;
  }
  .tabitem { background: none; border: 0; cursor: pointer; position: relative; z-index: 1; }

  /* the cell, and the settings card, open and shut on their own springs */
  .hhead { width: 100%; border: 0; cursor: pointer; text-align: left; font: inherit; display: flex; align-items: flex-start; justify-content: space-between; gap: ${SPACE[2]}px; }
  .hreveal, .sreveal { height: 0; overflow: hidden; will-change: height; }
  .hchev { will-change: transform; }

  /* The stage keeps its size while the component inside it changes, so the page
     does not reflow around a component being opened. */
  .stage.holds { min-height: 520px; align-content: flex-start; }

  .settingsblock { width: 100%; max-width: 420px; }
  .snote.outside { margin: ${SPACE[2]}px 0 0; padding: 0 ${SPACE[3]}px; }
  .sinner { padding-top: ${SPACE[3]}px; }
  .pacename {
    margin: ${SPACE[4]}px 0 0; font-size: ${TYPE.label.fontSize}px; font-weight: ${TYPE.label.fontWeight};
    letter-spacing: ${TYPE.label.letterSpacing}px; text-transform: uppercase; color: var(--s-ink);
  }
  .pacedesc { margin: ${SPACE[2]}px 0 0; font-size: ${TYPE.body.fontSize}px; color: var(--s-ink); max-width: none; }
  .spread { margin-top: ${SPACE[4]}px; }
  .weightcard { display: block; width: 100%; border: 0; text-align: left; font: inherit; cursor: pointer; }
  .weightcard .caret { display: none; }
  .weightcard.editing { outline: 1px solid var(--s-ink); outline-offset: -1px; }
  .weightcard.editing .caret { display: inline-block; animation: blink 1.06s steps(1) infinite; }
  .weightcard.editing .wunit { opacity: .45; }
  @keyframes blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }

  /* workout buttons */
  .btn.workout { background: var(--s-wash, rgba(0,0,0,.1)); color: var(--s-btnink, var(--s-ink)); }
  .signposts { display: flex; justify-content: space-between; gap: ${SPACE[3]}px; margin-top: ${SPACE[3]}px; }
  .signpost {
    display: flex; align-items: center; gap: ${SPACE[2]}px; background: none; border: 0;
    cursor: pointer; font: inherit; font-size: 14px; line-height: 21.6px; max-width: 46%;
    text-align: left; padding: 0;
  }
  .signpost.right { text-align: right; }
  .signpost svg { width: 24px; height: 24px; display: block; }
  .sparrow { flex: none; }

  .track, .choice, .tabitem, .rcard { cursor: pointer; }
  .choice { border: 0; font: inherit; }
  .seg button[data-routine], .seg button[data-cellroutine] { text-transform: capitalize; }

  .icongrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 6px; width: 100%; }
  .icontile { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 16px 8px; border-radius: ${RADIUS.chip}px; text-align: center; }
  .icontile:hover { background: var(--s-raised); }
  .icontile svg { width: 26px; height: 26px; color: var(--s-ink); }
  .icontile em { font-style: normal; font-size: 10.5px; color: var(--s-dim); word-break: break-word; }

  .typerow { display: flex; align-items: baseline; gap: 20px; padding: 18px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .typerow:last-child { border-bottom: none; }
  .typerow .spec { flex: 1 1 190px; min-width: 190px; }
  .typerow .spec b { display: block; font-size: 13px; font-weight: 600; margin-bottom: 2px; }
  .typerow .spec span { font-size: 11.5px; color: var(--dim); font-variant-numeric: tabular-nums; }
  .typerow .sample { flex: 2 1 320px; min-width: 0; overflow-x: auto; color: var(--ink); }

  .spacebar { background: var(--ink); height: 15px; border-radius: 2px; display: block; }

  @media (max-width: 900px) {
    .shell { grid-template-columns: 1fr; }
    nav {
      position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line);
      flex-direction: row; flex-wrap: wrap; gap: 10px 4px; padding: 16px 20px;
    }
    .navgroup { flex-direction: row; flex-wrap: wrap; gap: 2px; }
    .navgroup > p { display: none; }
    nav a { border-left: 0; padding: 5px 10px; border-radius: ${RADIUS.chip}px; }
    nav a.on { background: var(--raised); }
    .brand { width: 100%; padding: 0; }
    header.top { padding: 40px 20px 30px; }
    .inner { padding: 0 20px; }
  }
`

// ── section builders ──────────────────────────────────────────────────────

const swatch = (name, value, ground, note) => {
  const shown = value.startsWith('rgba') ? over(value, ground) : value
  return `<div class="token">
        <div class="fill" style="background:${shown}"></div>
        <div class="meta">
          <b>${name}</b>
          <button class="copy mono" data-copy="${value}"><span>${value}</span></button>
          ${note ? `<span>${note}</span>` : ''}
        </div>
      </div>`
}

const SEMANTIC = [
  ['bg', 'The page itself'],
  ['bgRaised', 'Cards and rows. <b>Lighter</b> than the page in dark'],
  ['border', 'Hairlines and the unfilled half of a control'],
  ['text', 'Everything read'],
  ['textDim', 'Secondary and supporting text'],
  ['danger', 'Destructive actions only'],
  ['onInk', 'What sits on a filled ink surface'],
  ['controlTrack', 'The unfilled half of a control'],
]

const colourSection = () => {
  const pairs = [
    ['text on bg', LIGHT.text, LIGHT.bg, DARK.text, DARK.bg],
    ['text on bgRaised', LIGHT.text, LIGHT.bgRaised, DARK.text, DARK.bgRaised],
    ['textDim on bg', LIGHT.textDim, LIGHT.bg, DARK.textDim, DARK.bg],
    ['textDim on bgRaised', LIGHT.textDim, LIGHT.bgRaised, DARK.textDim, DARK.bgRaised],
    ['onInk on text', LIGHT.onInk, LIGHT.text, DARK.onInk, DARK.text],
  ]
  return `
  <p class="lede">Two palettes of the same shape. A screen picks one at the top and passes it
    down; nothing below re-decides.</p>

  <h3>Semantic tokens</h3>
  <p>Named for the job rather than the colour, which is what lets the same component
    serve both schemes without being restyled. Click any value to copy it.</p>

  <div class="switcher">
    <div class="seg" role="group" aria-label="Palette">
      <button class="on" data-pal="light">Light</button><button data-pal="dark">Dark</button>
    </div>
    <span class="hint">Switches the swatches below, independently of this page's own theme.</span>
  </div>

  <div class="tokengrid" data-pal-target="light">
    ${SEMANTIC.map(([k, note]) => swatch(k, LIGHT[k], LIGHT.bg, note)).join('\n    ')}
    ${swatch('surfaceCard', LIGHT.surfaceCard, LIGHT.bg, 'A tint over the page, not a panel')}
  </div>
  <div class="tokengrid" data-pal-target="dark" hidden>
    ${SEMANTIC.map(([k, note]) => swatch(k, DARK[k], DARK.bg, note)).join('\n    ')}
    ${swatch('surfaceCard', DARK.surfaceCard, DARK.bg, 'A tint over the page, not a panel')}
  </div>

  <div class="note">
    <p><b>Elevation runs the other way in dark.</b> <code>bgRaised</code> is
    ${lstar(LIGHT.bgRaised) < lstar(LIGHT.bg) ? 'darker' : 'lighter'} than the page in light
    (L* ${lstar(LIGHT.bgRaised).toFixed(1)} against ${lstar(LIGHT.bg).toFixed(1)}) and
    ${lstar(DARK.bgRaised) > lstar(DARK.bg) ? 'lighter' : 'darker'} in dark
    (L* ${lstar(DARK.bgRaised).toFixed(1)} against ${lstar(DARK.bg).toFixed(1)}).
    A dark theme has nothing for a shadow to darken, so it lifts a surface with light instead.</p>
  </div>

  <h3>Contrast, measured</h3>
  <p>Computed from the tokens each time this page is built, so these cannot drift from
    the palette. AA wants 4.5:1 for body text and 3:1 for large text and icons.</p>
  <div class="scroll"><table>
    <thead><tr><th>Pair</th><th class="num">Light</th><th class="num">Dark</th><th>Note</th></tr></thead>
    <tbody>
      ${pairs
        .map(([label, lf, lb, df, db]) => {
          const l = ratio(lf, lb)
          const d = ratio(df, db)
          const worst = Math.min(l, d)
          return `<tr><td><code>${label}</code></td><td class="num">${l.toFixed(2)}:1</td><td class="num">${d.toFixed(2)}:1</td><td>${
            worst >= 4.5 ? 'Passes AA for body text' : 'Large text and icons only'
          }</td></tr>`
        })
        .join('\n      ')}
    </tbody>
  </table></div>

  <h3>Glass</h3>
  <p>The floating tab bar has no Liquid Glass to lean on, so the material is implied by
    hand: a wash lit from the top, a hairline edge over it, and a pill marking the tab
    you are on. All three invert between schemes — light mode marks the current tab by
    darkening it, which on a dark bar would mark it by making it vanish.</p>
  <div class="scroll"><table>
    <thead><tr><th>Token</th><th>Light</th><th>Dark</th></tr></thead>
    <tbody>
      <tr><td><code>glassWash</code></td><td class="mono">${LIGHT.glassWash.join('<br>')}</td><td class="mono">${DARK.glassWash.join('<br>')}</td></tr>
      <tr><td><code>glassEdge</code></td><td class="mono">${LIGHT.glassEdge}</td><td class="mono">${DARK.glassEdge}</td></tr>
      <tr><td><code>highlight</code></td><td class="mono">${LIGHT.highlight}</td><td class="mono">${DARK.highlight}</td></tr>
    </tbody>
  </table></div>

  <h3>Routine colours</h3>
  <p>A routine's colour is its identity: the same hue carries its card in the stack, the
    workout screen it opens into, and its days on the Stats calendar. These are the only
    literal colours in the app, and the only saturation in it. Laid out the way the Figma
    library lays them out — three roles across, both schemes down, with the button wash
    shown where it actually falls, over the sweep and the base.</p>

  ${CANONICAL_ORDER.map((name) => {
    const col = (scheme) => ({
      sweep: restTintFor(scheme, name),
      base: styleFor(scheme, name).background,
      pale: paleFor(scheme, name).background,
      wash: washFor(scheme, name),
      ink: inkFor(scheme, name),
    })
    const band = (scheme, label) => {
      const c = col(scheme)
      const pct = Math.round(parseFloat(c.wash.match(/,\s*([0-9.]+)\)/)[1]) * 100)
      const hex = over(c.wash, c.base)
      return `<div class="rband">
          <div class="rcol" style="background:${c.sweep};color:${inkOn(c.sweep)}">
            <span class="rrole">Sweep ${label}</span>
            <span class="rval"><b>${c.sweep.toUpperCase()}</b></span>
          </div>
          <div class="rcol" style="background:${c.base};color:${c.ink}">
            <span class="rrole">Routine base ${label}</span>
            <span class="rval"><b>${c.base.toUpperCase()}</b></span>
          </div>
          <div class="rcol" style="background:${c.pale};color:${paleFor(scheme, name).ink}">
            <span class="rrole">History card ${label}</span>
            <span class="rval"><b>${c.pale.toUpperCase()}</b></span>
          </div>
          <div class="rwash" style="background:${c.wash};color:${inkOn(hex)}">
            <span class="rrole">Button wash</span>
            <span class="rval"><b>${hex.toUpperCase()}</b> at ${pct}%</span>
          </div>
        </div>`
    }
    return `<div class="routinepanel">
      <h4 class="rname">${name}</h4>
      ${band('light', 'Light')}
      ${band('dark', 'Dark')}
    </div>`
  }).join('\n  ')}

  <p class="hint">Every value here is copied out of the app at build time. The wash is a
    translucent layer, so it is labelled with the colour it resolves to over its own base
    and the opacity it is drawn at.</p>`
}

const typeSection = () => {
  const SAMPLE = {
    caption: 'Estimated, and deliberately low.',
    label: 'Show rest time between sets',
    body: 'Everything lives on the phone. No account, no backend.',
    control: 'Log set',
    routineCardMeta: '50 min · 6 exercises',
    title: 'This week',
    heading: 'Bulgarian split squat',
    routineCard: 'Lower body',
    screenTitle: 'Workouts',
    figure: '1,240',
    hero: '42:08',
  }
  const order = ['caption', 'label', 'body', 'control', 'routineCardMeta', 'title', 'heading', 'routineCard', 'screenTitle', 'figure', 'hero']
  return `
  <p class="lede">Eleven roles, each named for the job so a screen picks a role rather than a
    number. Two families, both from the system and neither bundled.</p>

  <div class="note">
    <p><b>Rounded is what gets looked at; plain is what gets read.</b> SF Pro Rounded carries
    the routine card, the page title, the exercise you are on and the figure you are lifting.
    Plain SF Pro carries labels, prose, controls and list rows. The split is by job, not by size.</p>
  </div>

  <h3>The scale</h3>
  ${order
    .map((role) => {
      const t = TYPE[role]
      const rounded = t.fontFamily === 'ui-rounded'
      const track = t.letterSpacing
      const pct = track ? ((track / t.fontSize) * 100).toFixed(0) : null
      const cap = CAP[role]?.maxFontSizeMultiplier
      return `<div class="typerow">
    <div class="spec">
      <b>${role}</b>
      <span>${t.fontSize}px · ${t.fontWeight} · ${rounded ? 'SF Pro Rounded' : 'SF Pro'}${
        track ? ` · ${pct > 0 ? '+' : ''}${pct}% tracking` : ''
      }${t.textTransform ? ' · uppercase' : ''}${
        t.fontVariant ? ' · tabular' : ''
      } · ${cap ? `caps at ${cap}×` : 'uncapped'}</span>
    </div>
    <div class="sample" style="font-family:${rounded ? 'ui-rounded, system-ui' : '-apple-system, system-ui'},sans-serif;
      font-size:${t.fontSize}px; font-weight:${t.fontWeight}; letter-spacing:${track}px;
      ${t.textTransform ? 'text-transform:uppercase;' : ''}${t.fontVariant ? 'font-variant-numeric:tabular-nums;' : ''}
      line-height:${SYSTEM_LINE}">${esc(SAMPLE[role])}</div>
  </div>`
    })
    .join('\n  ')}

  <h3>Tracking follows the weight, not the size</h3>
  <p>Only five roles carry any tracking at all; the other six sit at a plain zero. Where it
    is non-zero it is written as <code>size × ratio</code>, so changing a size carries its
    tracking with it.</p>
  <div class="scroll"><table>
    <thead><tr><th>Role</th><th class="num">Size</th><th>Weight</th><th class="num">Tracking</th></tr></thead>
    <tbody>
      ${order
        .filter((r) => TYPE[r].letterSpacing !== 0)
        .map((r) => {
          const t = TYPE[r]
          const pct = ((t.letterSpacing / t.fontSize) * 100).toFixed(0)
          return `<tr><td><code>${r}</code></td><td class="num">${t.fontSize}</td><td>${
            t.fontWeight === '500' ? 'medium' : t.fontWeight === '700' ? 'bold' : 'regular'
          }</td><td class="num">${pct > 0 ? '+' : ''}${pct}%</td></tr>`
        })
        .join('\n      ')}
    </tbody>
  </table></div>
  <p>Medium opens, bold tightens. Size never predicted it: <code>heading</code> at 30 opens
    while <code>screenTitle</code> at 32 tightens.</p>

  <h3>Case belongs to the role</h3>
  <p>${order.filter((r) => TYPE[r].textTransform).length} roles render uppercase —
    ${order.filter((r) => TYPE[r].textTransform).map((r) => `<code>${r}</code>`).join(', ')} — while
    the source strings stay in sentence case. Settings really does contain "Show rest time
    between sets"; the role shouts it. Copy written as prose is easier to write, read and
    eventually translate, and the same string can be reused unshouted without being edited.</p>
  <p><code>control</code> is deliberately not among them. Uppercase button labels tracked out
    is Material's convention, not Apple's — iOS sets buttons in sentence case and lets SF Pro's
    own optical tracking do the spacing. The buttons speak rather than shout.</p>

  <h3>Dynamic Type</h3>
  <p>Every role scales with the iOS text-size setting; what differs is how far. Nothing
    anywhere sets <code>allowFontScaling={false}</code>, which would refuse the setting
    outright rather than bounding it.</p>
  <div class="scroll"><table>
    <thead><tr><th>Cap</th><th>Roles</th><th>Why</th></tr></thead>
    <tbody>
      <tr><td class="num">uncapped</td><td><code>body</code>, <code>caption</code></td><td>The text someone raised their text size in order to read. Both live in boxes that grow.</td></tr>
      <tr><td class="num">1.5×</td><td><code>control</code>, <code>label</code></td><td>Fixed-width boxes; past about 1.5 they wrap and a control stops looking like one.</td></tr>
      <tr><td class="num">1.4×</td><td><code>title</code></td><td>Names in cells and bars that cannot reflow far.</td></tr>
      <tr><td class="num">1.3×</td><td><code>screenTitle</code>, <code>heading</code>, <code>routineCard</code>, <code>routineCardMeta</code></td><td>Already large, so a smaller multiplier still adds real size.</td></tr>
      <tr><td class="num">1.2×</td><td><code>figure</code>, <code>hero</code></td><td><code>hero</code> is ${TYPE.hero.fontSize}px already — the largest thing on the screen at any setting.</td></tr>
    </tbody>
  </table></div>`
}

const shapeSection = () => `
  <p class="lede">Small scales, deliberately. The app had twelve radius values, several of them
    one shape written four ways.</p>

  <h3>Space</h3>
  <p>A six-step scale, in points.</p>
  <div class="scroll"><table>
    <thead><tr><th>Step</th><th class="num">Value</th><th>Scale</th></tr></thead>
    <tbody>
      ${Object.entries(SPACE)
        .map(
          ([k, v]) =>
            `<tr><td><code>SPACE.${k}</code></td><td class="num">${v}</td><td><i class="spacebar" style="width:${v * 3}px"></i></td></tr>`,
        )
        .join('\n      ')}
    </tbody>
  </table></div>

  <h3>Radius</h3>
  <p>Three shapes, which is all this app turns out to need.</p>
  <div class="stage center spec" data-spec="light">
    ${Object.entries(RADIUS)
      .map(
        ([k, v]) =>
          `<div style="display:flex;flex-direction:column;align-items:center;gap:10px">
        <div style="width:96px;height:72px;background:var(--s-raised);border:1px solid var(--s-line);border-radius:${v}px"></div>
        <div style="font-size:12px"><b>${k}</b> <span style="color:var(--s-dim)">${v === 999 ? 'fully rounded' : v + 'px'}</span></div>
      </div>`,
      )
      .join('\n    ')}
  </div>
  <p class="hint">Not every literal has moved onto these yet. What is left is the set where
    adopting the token would <em>change</em> the shape, so those go one at a time with a look
    on the device.</p>

  <h3>The floating bar</h3>
  <div class="scroll"><table>
    <thead><tr><th>Constant</th><th class="num">Value</th><th>What it is</th></tr></thead>
    <tbody>
      <tr><td><code>NAV_HEIGHT</code></td><td class="num">${NAV_HEIGHT}</td><td>The bar itself</td></tr>
      <tr><td><code>NAV_FLOAT_GAP</code></td><td class="num">${NAV_FLOAT_GAP}</td><td>Room between the bar and the home indicator</td></tr>
      <tr><td><code>TAB_BAR_CLEARANCE</code></td><td class="num">${TAB_BAR_CLEARANCE}</td><td>How far a scrolling screen must clear the bar, before its own safe-area inset</td></tr>
    </tbody>
  </table></div>

  <h3>Type metrics</h3>
  <p>SF Pro and SF Pro Rounded share these exactly — one em, one set of numbers — so a single
    constant covers both families. Every derived measurement in the app is built from them.</p>
  <div class="scroll"><table>
    <thead><tr><th>Constant</th><th class="num">Value</th></tr></thead>
    <tbody>
      <tr><td><code>SYSTEM_LINE</code></td><td class="num">${SYSTEM_LINE}</td></tr>
      <tr><td><code>SYSTEM_CAP</code></td><td class="num">${SYSTEM_CAP}</td></tr>
    </tbody>
  </table></div>`

const componentSection = () => {
  const card = (name, scheme) => {
    const c = styleFor(scheme, name).background
    const ink = inkFor(scheme, name)
    return `<div class="rcard" data-rc="${name}" style="background:${c};color:${ink}">
        <span class="rcard-name">${name}</span>
        <span class="rcard-meta"><span>40 min</span><span>5 exercises</span></span>
      </div>`
  }

  const cell = (name, expanded) => {
    const base = styleFor('light', name).background
    const ink = inkFor('light', name)
    const tint = restTintFor('light', name)
    const pale = paleFor('light', name)
    const lifts = [
      ['Squat', '4x 8x45kg', true],
      ['Bench press', '4x 8x45kg', false],
      ['Barbell row', '4x 8x45kg', false],
      ['Overhead press', '4x 8x45kg', false],
      ['Plank', '4x 8x45kg', false],
    ]
    const stats = [
      ['ClockIcon', '56 min'],
      ['DumbbellIcon', '5/5 exercises completed'],
      ['RepeatIcon', '15/15 sets completed'],
      ['BoltIcon', '~360 kcal*'],
    ]
    const svg = (n) => {
      const i = ICONS.find((x) => x.name === n)
      return i ? `<svg viewBox="0 0 24 24" class="statico">${i.shapes.join('')}</svg>` : ''
    }
    return `<div class="hcell${expanded ? ' open' : ''}" data-cell="${name}">
      <button class="hhead" data-part="head" data-cellhead style="background:${base};color:${ink}">
        <span class="hheading">
          <span class="hname">${name[0].toUpperCase() + name.slice(1)}</span>
          <span class="hwhen">Tuesday 12 August, 09:30</span>
        </span>
        <span class="htag" data-part="tag" style="background:${tint};color:${inkOn(tint)}">Advanced</span>
        <svg viewBox="0 0 24 24" class="hchev">${
          ICONS.find((x) => x.name === 'ChevronIcon')?.shapes.join('') ?? ''
        }</svg>
      </button>
      <div class="hreveal">
        <div class="hbody" data-part="body" style="background:${pale.background};color:${pale.ink}">
          <div class="hsummary">
            ${stats.map(([ic, txt]) => `<div class="hstat">${svg(ic)}<span>${txt}</span></div>`).join('\n            ')}
          </div>
          <div class="hlifts">
            ${lifts
              .map(
                ([n, sets, skipped]) =>
                  `<div class="hlift${skipped ? ' faded' : ''}"><span class="hliftname">${n}${skipped ? '**' : ''}</span><span class="hliftsets">${sets}</span></div>`,
              )
              .join('\n            ')}
          </div>
          <p class="hfoot faded">*Kcal burn is an estimate using the MET method and should be used as a reference, not an exact measurement.</p>
          <p class="hfoot faded">**Skipped</p>
        </div>
      </div>
    </div>`
  }

  return `
  <p class="lede">Every component below is drawn from the same tokens the app uses, at the
    sizes the app uses. Where a number is stated it is the number in the source.</p>

  <div class="switcher">
    <div class="seg" role="group" aria-label="Specimen palette">
      <button class="on" data-scheme="light">Light</button><button data-scheme="dark">Dark</button>
    </div>
    <span class="hint">Applies to every specimen below.</span>
  </div>

  <h3>Routine card</h3>
  <p><b>${CARD_WIDTH} × ${CARD_HEIGHT}</b>, radius ${RADIUS.card}. The name is centred near the
    top — positioned by its capitals rather than its line box, so it holds still if the
    typeface changes — and the two meta lines are centred ${20}px from the bottom. Both are
    uppercase by role, and the source strings stay in sentence case.</p>
  <div class="stage spec scrollrow" data-spec="light">
    ${CANONICAL_ORDER.map((n) => card(n, 'light')).join('\n    ')}
  </div>

  <h3>History cell</h3>
  <p>Shut, and open. The head takes the routine's base colour; the tag takes the same deeper
    tone the rest sweep paints during a workout, so the app has one idea of "this colour,
    deeper" rather than two. The body is a wash of the routine's own colour, with that colour
    as ink wherever it holds up.</p>
  <div class="switcher">
    <div class="seg" role="group" aria-label="Routine">
      ${CANONICAL_ORDER.map(
        (n, i) => `<button class="${i === 0 ? 'on' : ''}" data-cellroutine="${n}">${n}</button>`,
      ).join('')}
    </div>
    <span class="hint">Tap the cell to open and shut it.</span>
  </div>
  <div class="stage col spec holds" data-spec="light">
    ${cell('full body', true)}
  </div>
  <p class="hint">Skipped work and the calorie footnote sit at ${'0.76'} opacity — the point at
    which the faintest of the six routines still clears 3:1. Not 4.5:1, which is unreachable
    here: the cell's ink sits at exactly 4.5 at full strength.</p>

  <h3>Buttons</h3>
  <p>One shape: height ${52}, fully rounded, set in <code>control</code> at
    ${TYPE.control.fontSize}px medium and sentence case. There is no "primary" colour token —
    the routine supplies it. Press any of them; the workout button takes
    <code>scale(0.99)</code>, which is the app's own pressed state.</p>
  <div class="switcher">
    <div class="seg" role="group" aria-label="Routine">
      ${CANONICAL_ORDER.map(
        (n, i) => `<button class="${i === 0 ? 'on' : ''}" data-routine="${n}">${n}</button>`,
      ).join('')}
    </div>
  </div>

  <h4>In a workout</h4>
  <p>The primary sits on a blurred surface at a tenth of the ink, so it reads as a panel of
    the screen rather than a shape drawn on it. Its label depends on where you are:
    <b>Skip</b> until the sets are logged, <b>Next exercise</b> once they are, and
    <b>Finish workout</b> on the last one.</p>
  <div class="stage col center spec btnstage" data-spec="light" data-btnstage>
    <div class="actions">
      <button class="btn workout" data-btn="workout">Skip</button>
      <div class="signposts">
        <button class="signpost" data-btn="prev">
          <span class="sparrow">${ICONS.find((i) => i.name === 'ChevronLeftIcon').shapes.join('') ? `<svg viewBox="0 0 24 24">${ICONS.find((i) => i.name === 'ChevronLeftIcon').shapes.join('')}</svg>` : ''}</span>
          <span class="splabel">Barbell row</span>
        </button>
        <button class="signpost right" data-btn="next">
          <span class="splabel">Overhead press</span>
          <span class="sparrow"><svg viewBox="0 0 24 24">${ICONS.find((i) => i.name === 'ChevronRightIcon').shapes.join('')}</svg></span>
        </button>
      </div>
    </div>
  </div>
  <p class="hint">The signposts are the tertiary: an arrow beside the exercise you would move
    to. The arrow is its own element rather than a character in the name, so a name that
    wraps keeps the arrow centred against the whole block.</p>

  <h4>When a workout ends</h4>
  <p>Full width and stacked with ${SPACE[2]}px between them. The primary fills with the
    routine's <em>ink</em> and takes its colour as the label; the secondary fills with the
    <em>button wash</em> — the same translucent token in the colour library — and takes ink
    as the label.</p>
  <div class="stage col center spec btnstage" data-spec="light" data-btnstage2>
    <div class="actions">
      <button class="btn" data-btn="primary">See completed workouts</button>
      <button class="btn" data-btn="secondary">Do another workout</button>
    </div>
  </div>

  <h3>Tab bar</h3>
  <p>Height ${NAV_HEIGHT}, fully rounded, ${4}px padding, items ${64} × ${44} with ${4}px between
    them. The edge is drawn over the bar rather than bordered — a border would come out of
    the ${NAV_HEIGHT} and leave the items overflowing by two. Tap a tab: the pill slides
    rather than reappearing, which is what makes the bar feel like one object.</p>
  <div class="stage center spec" data-spec="light">
    <div class="tabbar" data-tabbar>
      <span class="tabpill" data-pill></span>
      ${['WorkoutIcon', 'StatsIcon', 'SettingsIcon']
        .map((n, i) => {
          const ic = ICONS.find((x) => x.name === n)
          return `<button class="tabitem${i === 0 ? ' on' : ''}" data-tab="${i}" aria-label="${n.replace(/Icon$/, '')}"><svg viewBox="0 0 24 24">${ic.shapes.join('')}</svg></button>`
        })
        .join('\n      ')}
    </div>
  </div>

  <h3>Settings row</h3>
  <p>A card at radius ${RADIUS.card} on the raised surface, ${SPACE[3]}px padding. The label is
    <code>label</code>; the note below is <code>caption</code> with its line height stated at
    17, the one place that role needs one. The switch track is 46 × 28 with a 22 × 22 knob.</p>
  <p><b>The switch reveals the rest of the card.</b> Turn it on: the pace control, the name
    and description of that pace, and the per-routine spread unfold on
    <code>REVEAL_SPRING</code>. That is the whole point of the row, and it starts off.</p>
  <div class="stage col spec" data-spec="light">
    <div class="settingsblock">
      <div class="scard">
        <div class="srow"><span class="slabel">Show rest time between sets</span><button class="track" data-reveal-toggle aria-label="Show rest time between sets"><i></i></button></div>
        <div class="sreveal" data-reveal>
          <div class="sinner">
            <div class="choices" data-paces>
              ${['20s', '60s', '120s', '180s']
                .map((v, n) => `<button class="choice${n === 0 ? ' chosen' : ''}" data-pace="${n}">${v}</button>`)
                .join('\n              ')}
            </div>
            <p class="pacename">Circuit</p>
            <p class="pacedesc" data-pacedesc>Barely any rest. One set straight into the next. Suits lighter weights, bodyweight rounds and easy holds, where the point is to keep going rather than to push each set.</p>
            <div class="spread">
              ${[
                ['Lower body', '20s'],
                ['Upper body', '20s'],
                ['Core', '20s'],
                ['Mobility', '30s'],
              ]
                .map(([n, v]) => `<div class="spreadrow"><span class="spreadof">${n}</span><span class="spreadsec">${v}</span></div>`)
                .join('\n              ')}
            </div>
          </div>
        </div>
      </div>
      <p class="snote outside">When you turn Rest Time on, after logging a set you will see a countdown for your rest time between sets.</p>
    </div>
  </div>

  <h3>Appearance</h3>
  <p>Each option is a flexible cell at least 90 tall, radius ${RADIUS.card}, set in
    <code>title</code>. The chosen one fills with ink and its label flips to
    <code>onInk</code>; the rest step back to <code>textDim</code>, so the row reads as one
    selection among three rather than three equal buttons.</p>
  <div class="stage col spec" data-spec="light">
    <div class="settingsblock">
      <div class="scard">
        <span class="slabel">Appearance</span>
        <div class="choices low">
          ${['System', 'Light', 'Dark']
            .map((v, n) => `<button class="choice${n === 0 ? ' chosen' : ''}">${v}</button>`)
            .join('\n          ')}
        </div>
      </div>
      <p class="snote outside">System follows your phone, switching with it when it changes.</p>
    </div>
  </div>

  <h3>Body weight</h3>
  <p>The figure and its unit are one thing in one ink at rest, set in
    <code>screenTitle</code> at ${TYPE.screenTitle.fontSize}px. While it is being typed the
    card outlines itself so it is obvious which one the keypad belongs to, the unit steps
    back to 0.45, and a drawn caret stands in for the cursor — the real field is parked
    off-screen, focusable and never seen.</p>
  <div class="stage col spec" data-spec="light">
    <div class="settingsblock">
      <button class="scard weightcard" data-weight>
        <div class="weightrow"><span class="slabel">Body weight</span><span class="weightval"><span data-wnum>96</span><i class="caret"></i><span class="wunit">kg</span></span></div>
      </button>
      <p class="snote outside">Optional, and only used to estimate the calories a workout burns. It isn't tracked over time and never leaves this device.</p>
    </div>
  </div>
  <p class="hint">Tap it to start editing. The card outlines itself so it is obvious which one
    the keypad belongs to, the unit steps back to 0.45, and a drawn caret stands in for the
    cursor — the real field is parked off-screen, focusable and never seen.</p>

  <h3>Icons</h3>
  <p>${ICONS.length} icons, drawn rather than shipped as images so the ink is a prop. The
    shapes below are read out of the component source when this page is built; icons with a
    selected state are shown at rest.</p>
  <div class="stage spec" data-spec="light">
    <div class="icongrid">
      ${ICONS.map(
        (i) => `<div class="icontile">
        <svg viewBox="0 0 24 24" role="img" aria-label="${i.name}">${i.shapes.join('')}</svg>
        <em>${i.name.replace(/Icon$/, '')}</em>
      </div>`,
      ).join('\n      ')}
    </div>
  </div>`
}

const patternSection = () => `
  <p class="lede">The conventions that are not obvious from any single file, and that cost
    the most to rediscover.</p>

  <h3>Style with tokens, never with literals</h3>
  <p>The only literal colours in the app belong to routines, through
    <code>styleFor()</code>. Everything else is a token, which is what let a whole dark
    palette arrive without any component being restyled.</p>

  <h3>A routine's colour is its identity</h3>
  <p>Card, workout screen and Stats calendar all pull from the same place. A routine is not
    "the blue one" by coincidence — the colour is how you recognise it across three screens
    that otherwise look nothing alike.</p>

  <h3>Styles are a factory, not an object</h3>
  <p><code>StyleSheet.create</code> runs once at import, which is before a theme exists.
    A themed screen therefore holds a <code>makeStyles(t)</code> factory called through
    <code>useThemedStyles</code>, so the sheet is rebuilt when the palette changes.
    A screen that calls <code>StyleSheet.create</code> at module scope will look correct
    until the moment someone switches theme.</p>

  <h3>Class names are global; so are shared files</h3>
  <p>Every regression this project has had came from the same shape: a change in a shared
    file breaking a screen nobody was looking at. Before changing anything shared, say which
    screens it reaches and what you will check — the sentence is the point.</p>

  <div class="note">
    <p><b>Two failed hypotheses is a hard stop.</b> Stop changing code and go to the history
    or add a measurement instead. When something that worked stops working and its own code
    has not changed, diff it against the commit where it worked first.</p>
  </div>

  <h3>Opacity is not a colour</h3>
  <p>Fading text to imply hierarchy composites it against whatever is behind, and the result
    is invisible to every off-the-shelf contrast checker — they read the declared colour, not
    the rendered one. Quiet text uses <code>textDim</code>, which is a measured value.</p>`

// ── assemble ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'colour', eyebrow: '01 — Foundations', title: 'Colour', html: colourSection() },
  { id: 'type', eyebrow: '02 — Foundations', title: 'Typography', html: typeSection() },
  { id: 'shape', eyebrow: '03 — Foundations', title: 'Space & shape', html: shapeSection() },
  { id: 'components', eyebrow: '04 — Library', title: 'Components', html: componentSection() },
  { id: 'patterns', eyebrow: '05 — Practice', title: 'Conventions', html: patternSection() },
]

const NAV = [
  ['Foundations', [['colour', 'Colour'], ['type', 'Typography'], ['shape', 'Space & shape']]],
  ['Library', [['components', 'Components']]],
  ['Practice', [['patterns', 'Conventions']]],
]

const page = `<title>Training Tracker — design system</title>

<style>${css}</style>

<div class="shell">
  <nav>
    <div class="brand">
      <b>Training Tracker</b>
      <span>Design system</span>
    </div>
    ${NAV.map(
      ([group, items]) => `<div class="navgroup">
      <p>${group}</p>
      ${items.map(([id, label]) => `<a href="#${id}" data-page="${id}">${label}</a>`).join('\n      ')}
    </div>`,
    ).join('\n    ')}
  </nav>

  <main>
    <header class="top" data-page-el="colour">
      <h1>The system behind the app</h1>
      <p>Every value on this page is read out of <code>src/theme</code>,
        <code>src/data/routineStyles.js</code> and the icon components when the page is
        built — not from a design file, and not from memory. Where this page and the app
        disagree, the app is right and this is stale.</p>
    </header>

    ${SECTIONS.map(
      (s) => `<section id="${s.id}">
      <div class="inner">
        <p class="eyebrow">${s.eyebrow}</p>
        <h2>${s.title}</h2>
        ${s.html}
      </div>
    </section>`,
    ).join('\n\n    ')}
  </main>
</div>

<script>
  // Copy a value, and say so.
  for (const b of document.querySelectorAll('.copy')) {
    b.addEventListener('click', () => {
      navigator.clipboard?.writeText(b.dataset.copy)
      b.classList.add('done')
      setTimeout(() => b.classList.remove('done'), 900)
    })
  }

  // The specimen palette, pinned independently of the page's own theme.
  const ROUTINE = ${JSON.stringify(
    Object.fromEntries(
      CANONICAL_ORDER.map((n) => [
        n,
        {
          light: {
            base: styleFor('light', n).background,
            ink: inkFor('light', n),
            tint: restTintFor('light', n),
            tintInk: inkOn(restTintFor('light', n)),
            pale: paleFor('light', n).background,
            paleInk: paleFor('light', n).ink,
            wash: washFor('light', n),
          },
          dark: {
            base: styleFor('dark', n).background,
            ink: inkFor('dark', n),
            tint: restTintFor('dark', n),
            tintInk: inkOn(restTintFor('dark', n)),
            pale: paleFor('dark', n).background,
            paleInk: paleFor('dark', n).ink,
            wash: washFor('dark', n),
          },
        },
      ]),
    ),
  )}

  for (const seg of document.querySelectorAll('[data-scheme]')) {
    seg.addEventListener('click', () => {
      const mode = seg.dataset.scheme
      for (const b of document.querySelectorAll('[data-scheme]')) b.classList.toggle('on', b === seg)
      for (const stage of document.querySelectorAll('.stage.spec')) stage.dataset.spec = mode

      for (const c of document.querySelectorAll('[data-rc]')) {
        const r = ROUTINE[c.dataset.rc][mode]
        c.style.background = r.base
        c.style.color = r.ink
      }
      const chosenRoutine = document.querySelector('[data-routine].on')?.dataset.routine
      const chosenCell = document.querySelector('[data-cellroutine].on')?.dataset.cellroutine
      setTimeout(() => {
        if (chosenRoutine) paintButtons(chosenRoutine)
        if (chosenCell) paintCells(chosenCell)
      }, 0)
    })
  }

  // ── the app's spring, ported ───────────────────────────────────────────
  //
  // Reanimated integrates a damped harmonic oscillator from stiffness, damping
  // and mass. A CSS cubic-bezier cannot reproduce one — it has no velocity and
  // no overshoot — so rather than approximate it, the same equation runs here
  // with the same constants, read out of src/data/motion.js at build time.
  const SPRINGS = ${JSON.stringify(SPRINGS)}

  function springTo(cfg, from, to, apply, done) {
    const { stiffness: k, damping: c, mass: m } = cfg
    let x = from
    let v = 0
    let last = performance.now()
    let raf = 0
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.064)
      last = now
      // Fixed sub-steps, so the result does not depend on the frame rate.
      const steps = Math.max(1, Math.ceil(dt * 240))
      const h = dt / steps
      for (let i = 0; i < steps; i++) {
        v += ((-k * (x - to) - c * v) / m) * h
        x += v * h
      }
      apply(x)
      // Reanimated's own resting thresholds.
      if (Math.abs(to - x) < 0.01 && Math.abs(v) < 2) {
        apply(to)
        done?.()
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Height, sprung — the pattern behind both the history cell and the settings
  // card. Measured on each run, because the content can change under it.
  function sprungHeight(el, open, cfg) {
    el.__stop?.()
    const from = el.getBoundingClientRect().height
    const target = open ? el.firstElementChild.getBoundingClientRect().height : 0
    if (still) {
      el.style.height = open ? 'auto' : '0px'
      return
    }
    el.__stop = springTo(cfg, from, target, (v) => {
      el.style.height = Math.max(0, v) + 'px'
    }, () => {
      el.style.height = open ? 'auto' : '0px'
    })
  }

  // ── routing: one section at a time ─────────────────────────────────────
  const pages = [...document.querySelectorAll('section')]
  const links = [...document.querySelectorAll('nav a[data-page]')]
  const header = document.querySelector('header.top')

  function show(id) {
    const target = pages.some((p) => p.id === id) ? id : pages[0].id
    for (const p of pages) p.classList.toggle('on', p.id === target)
    for (const a of links) a.classList.toggle('on', a.dataset.page === target)
    if (header) header.hidden = target !== pages[0].id
    window.scrollTo({ top: 0 })
  }
  window.addEventListener('hashchange', () => show(location.hash.slice(1)))
  show(location.hash.slice(1))

  // ── tab bar: TAB_SPRING, the same one the app uses ─────────────────────
  const STEP = 64 + 4
  for (const bar of document.querySelectorAll('[data-tabbar]')) {
    const pill = bar.querySelector('[data-pill]')
    let at = 0
    for (const item of bar.querySelectorAll('[data-tab]')) {
      item.addEventListener('click', () => {
        for (const o of bar.querySelectorAll('[data-tab]')) o.classList.toggle('on', o === item)
        const to = +item.dataset.tab * STEP
        pill.__stop?.()
        if (still) { pill.style.transform = 'translateX(' + to + 'px)'; at = to; return }
        pill.__stop = springTo(SPRINGS.TAB_SPRING, at, to, (v) => {
          at = v
          pill.style.transform = 'translateX(' + v + 'px)'
        })
      })
    }
  }

  // ── history cell: EXPAND_SPRING ────────────────────────────────────────
  // Anything marked open at build time has to start at its real height, since
  // the reveal is closed by default in CSS.
  for (const cell of document.querySelectorAll('.hcell.open')) {
    cell.querySelector('.hreveal').style.height = 'auto'
    cell.querySelector('.hchev').style.transform = 'rotate(180deg)'
  }

  for (const head of document.querySelectorAll('[data-cellhead]')) {
    head.addEventListener('click', () => {
      const cell = head.closest('.hcell')
      const open = !cell.classList.contains('open')
      cell.classList.toggle('open', open)
      const chev = cell.querySelector('.hchev')
      let a = open ? 0 : 180
      springTo(SPRINGS.EXPAND_SPRING, a, open ? 180 : 0, (v) => {
        chev.style.transform = 'rotate(' + v + 'deg)'
      })
      sprungHeight(cell.querySelector('.hreveal'), open, SPRINGS.EXPAND_SPRING)
    })
  }
  for (const b of document.querySelectorAll('[data-cellroutine]')) {
    b.addEventListener('click', () => {
      for (const o of document.querySelectorAll('[data-cellroutine]')) o.classList.toggle('on', o === b)
      paintCells(b.dataset.cellroutine)
    })
  }
  function paintCells(name) {
    const mode = document.querySelector('[data-scheme].on')?.dataset.scheme ?? 'light'
    for (const cell of document.querySelectorAll('[data-cell]')) {
      cell.dataset.cell = name
      const r = ROUTINE[name][mode]
      const head = cell.querySelector('[data-part="head"]')
      head.style.background = r.base
      head.style.color = r.ink
      head.querySelector('.hname').textContent = name[0].toUpperCase() + name.slice(1)
      const tag = cell.querySelector('[data-part="tag"]')
      tag.style.background = r.tint
      tag.style.color = r.tintInk
      const body = cell.querySelector('[data-part="body"]')
      body.style.background = r.pale
      body.style.color = r.paleInk
    }
  }

  // ── settings: the switch reveals the card, on REVEAL_SPRING ────────────
  const PACES = [
    ['Circuit', 'Barely any rest. One set straight into the next. Suits lighter weights, bodyweight rounds and easy holds, where the point is to keep going rather than to push each set.'],
    ['Standard', 'A minute between sets. Enough to come back for the next one without the session stretching out.'],
    ['Strength', 'Two minutes. Long enough to repeat a heavy set at close to the same weight.'],
    ['Heavy', 'Three minutes. For the sets where the last rep was the point.'],
  ]
  for (const t of document.querySelectorAll('[data-reveal-toggle]')) {
    t.addEventListener('click', () => {
      const on = !t.classList.contains('on')
      t.classList.toggle('on', on)
      sprungHeight(t.closest('.scard').querySelector('[data-reveal]'), on, SPRINGS.REVEAL_SPRING)
    })
  }
  for (const group of document.querySelectorAll('[data-paces]')) {
    for (const c of group.querySelectorAll('.choice')) {
      c.addEventListener('click', () => {
        for (const o of group.querySelectorAll('.choice')) o.classList.toggle('chosen', o === c)
        const card = group.closest('.scard')
        const [name, desc] = PACES[+c.dataset.pace]
        card.querySelector('.pacename').textContent = name
        card.querySelector('.pacedesc').textContent = desc
        // The description changes length, so the open card re-measures.
        const rev = card.querySelector('[data-reveal]')
        if (rev.style.height !== '0px') requestAnimationFrame(() => sprungHeight(rev, true, SPRINGS.REVEAL_SPRING))
      })
    }
  }
  for (const t of document.querySelectorAll('.track:not([data-reveal-toggle])')) {
    t.addEventListener('click', () => t.classList.toggle('on'))
  }
  for (const group of document.querySelectorAll('.choices:not([data-paces])')) {
    for (const c of group.querySelectorAll('.choice')) {
      c.addEventListener('click', () => {
        for (const o of group.querySelectorAll('.choice')) o.classList.toggle('chosen', o === c)
      })
    }
  }
  for (const w of document.querySelectorAll('[data-weight]')) {
    w.addEventListener('click', () => w.classList.toggle('editing'))
  }

  // ── buttons ────────────────────────────────────────────────────────────
  const WORKOUT_LABELS = ['Skip', 'Next exercise', 'Finish workout']
  function paintButtons(name) {
    const mode = document.querySelector('[data-scheme].on')?.dataset.scheme ?? 'light'
    const r = ROUTINE[name][mode]
    for (const st of document.querySelectorAll('[data-btnstage], [data-btnstage2]')) {
      st.style.background = r.base
      st.style.setProperty('--s-wash', r.wash)
      st.style.setProperty('--s-btnink', r.ink)
      st.style.color = r.ink
    }
    const set = (sel, bg, fg) => {
      const el = document.querySelector(sel)
      if (el) { el.style.background = bg; el.style.color = fg }
    }
    set('[data-btn="primary"]', r.ink, r.base)
    set('[data-btn="secondary"]', r.wash, r.ink)
    set('[data-btn="workout"]', r.wash, r.ink)
    for (const sp of document.querySelectorAll('.signpost')) sp.style.color = r.ink
  }
  for (const b of document.querySelectorAll('[data-routine]')) {
    b.addEventListener('click', () => {
      for (const o of document.querySelectorAll('[data-routine]')) o.classList.toggle('on', o === b)
      paintButtons(b.dataset.routine)
    })
  }
  // The workout button says where you are, so it cycles through the three.
  const wb = document.querySelector('[data-btn="workout"]')
  if (wb) {
    let n = 0
    wb.addEventListener('click', () => {
      n = (n + 1) % WORKOUT_LABELS.length
      wb.textContent = WORKOUT_LABELS[n]
    })
  }
  paintButtons('${CANONICAL_ORDER[0]}')

  // Cards cycle through the routines, so every colour can be seen at full size.
  const ORDER = ${JSON.stringify(CANONICAL_ORDER)}
  for (const c of document.querySelectorAll('[data-rc]')) {
    c.addEventListener('click', () => {
      const mode = document.querySelector('[data-scheme].on')?.dataset.scheme ?? 'light'
      const next = ORDER[(ORDER.indexOf(c.dataset.rc) + 1) % ORDER.length]
      c.dataset.rc = next
      const r = ROUTINE[next][mode]
      c.style.background = r.base
      c.style.color = r.ink
      c.querySelector('.rcard-name').textContent = next
    })
  }
</script>
`

const current = (() => {
  try {
    return readFileSync(OUT, 'utf8')
  } catch {
    return null
  }
})()

if (process.argv.includes('--check')) {
  if (current !== page) {
    console.error('docs/design-system.html is out of date — run `npm run design-system`')
    process.exitCode = 1
  } else {
    console.log(`docs/design-system.html matches the app (${SECTIONS.length} sections, ${ICONS.length} icons)`)
  }
} else {
  writeFileSync(OUT, page)
  console.log(
    `docs/design-system.html written — ${SECTIONS.length} sections, ${ICONS.length} icons, ${CANONICAL_ORDER.length} routines`,
  )
}
