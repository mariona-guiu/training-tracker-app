// Each routine's colour, shared by the workout stack and the in-workout
// screen so a routine keeps its identity from the tap through to the
// session itself. Rotation is a card's permanent resting tilt — it never
// changes, so tapping a card can't jolt the pile.
const STYLE_ORANGE = {
  background: '#F37500',
  rotate: -3,
  boxShadow: '0 0 1.9px 0 rgba(243, 117, 0, 0.62), 0 2px 8px 0 rgba(243, 117, 0, 0.41)',
}
const STYLE_BLUE = {
  background: '#0091C9',
  rotate: 4.676,
  boxShadow: '0 0 1.9px 0 rgba(0, 145, 201, 0.62), 0 2px 8px 0 rgba(0, 145, 201, 0.41)',
}
const STYLE_YELLOW = {
  background: '#FCD22E',
  rotate: -12.261,
  boxShadow: '0 0 1.9px 0 rgba(252, 210, 46, 0.62), 0 2px 8px 0 rgba(252, 210, 46, 0.41)',
}
const STYLE_PINK = {
  background: '#FBCEDF',
  rotate: 0,
  boxShadow: '0 0 1.9px 0 rgba(251, 206, 223, 0.62), 0 2px 8px 0 #FBCEDF',
}
const STYLE_RED = {
  background: '#EC1C22',
  rotate: -4.219,
  boxShadow: '0 0 1.9px 0 rgba(236, 28, 34, 0.62), 0 2px 8px 0 rgba(236, 28, 34, 0.41)',
}
const STYLE_LIME = {
  background: '#D7ED00',
  rotate: 2.574,
  boxShadow: '0 0 1.9px 0 rgba(215, 237, 0, 0.62), 0 2px 8px 0 rgba(215, 237, 0, 0.41)',
}

const CARD_STYLE_CYCLE = [STYLE_ORANGE, STYLE_BLUE, STYLE_YELLOW, STYLE_PINK, STYLE_RED, STYLE_LIME]

// The whole palette, for the rare thing that belongs to the app rather than
// to one routine — the confetti at the end of a workout uses all six.
export const ROUTINE_COLOURS = CARD_STYLE_CYCLE.map((style) => style.background)

// Keyed by the routine's *type* — the kind of session — not by its name. They
// coincide for every preset, which is why passing a name has worked so far and
// why a custom routine called "Leg Day" would have come out grey. Callers pass
// the type where they have one and fall back to the name, which keeps every
// session recorded before the type existed rendering exactly as it did.
const STYLE_BY_TYPE = {
  'upper body': STYLE_ORANGE,
  'lower body': STYLE_BLUE,
  glutes: STYLE_YELLOW,
  core: STYLE_PINK,
  'full body': STYLE_RED,
  // Mobility took over the lime when the stretching routine became one. The
  // old key stays: sessions recorded before the change still say 'stretching',
  // and history should not turn grey because a routine was renamed.
  mobility: STYLE_LIME,
  stretching: STYLE_LIME,
}

// IndexedDB's natural order follows random ids, not anything meaningful —
// pin the known routines to a deliberate stacking order; anything else
// (custom routines) falls in after them, in whatever order the DB gave us.
export const CANONICAL_ORDER = ['upper body', 'lower body', 'glutes', 'core', 'full body', 'mobility']

function channelsOf(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
}

// Relative luminance per WCAG — how bright a colour reads to the eye,
// rather than how large its numbers are.
function luminanceOf([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

// Which ink stays readable on a routine's colour. The palette spans a deep
// blue and a near-fluorescent lime, so a single fixed text colour would be
// unreadable on one end or the other. The threshold sits where black and
// white are about equally legible.
export function inkOn(hex) {
  return luminanceOf(channelsOf(hex)) > 0.36 ? '#0a0a0a' : '#ffffff'
}

export function inkFor(name, index) {
  return inkOn(styleFor(name, index).background)
}

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  if (max === min) return [0, 0, lightness]
  const span = max - min
  const saturation = lightness > 0.5 ? span / (2 - max - min) : span / (max + min)
  let hue
  if (max === r) hue = ((g - b) / span + (g < b ? 6 : 0)) / 6
  else if (max === g) hue = ((b - r) / span + 2) / 6
  else hue = ((r - g) / span + 4) / 6
  return [hue, saturation, lightness]
}

function hslToRgb(hue, saturation, lightness) {
  if (saturation === 0) return [lightness, lightness, lightness]
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  const channel = (t) => {
    const shifted = (t + 1) % 1
    if (shifted < 1 / 6) return p + (q - p) * 6 * shifted
    if (shifted < 1 / 2) return q
    if (shifted < 2 / 3) return p + (q - p) * (2 / 3 - shifted) * 6
    return p
  }
  return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)]
}

function toHex(rgb) {
  return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`
}

// The colour the rest sweep paints over a routine's own: the same hue, a
// shade deeper, so a workout keeps its colour throughout rather than
// briefly becoming a different one.
//
// Chosen by eye, like the base colours above, because no single formula
// suits every hue — yellow stays stubbornly bright when you take lightness
// off it, and red reads vivid rather than deep at the step that suits the
// others. Each of these is its routine's colour with the light turned
// down, never mixed with black, which drains the colour out and lands as a
// grey veil over the screen instead of a deeper shade of itself.
const REST_TINT_BY_NAME = {
  'upper body': '#C76000',
  'lower body': '#0077A5',
  glutes: '#E0A400',
  core: '#F97DAC',
  'full body': '#A80D12',
  stretching: '#B0C200',
}

export function restTintFor(name, index) {
  const known = REST_TINT_BY_NAME[name?.toLowerCase()]
  if (known) return known
  // Anything else: lightness down, intensity nudged up to stop it greying.
  const [hue, saturation, lightness] = rgbToHsl(channelsOf(styleFor(name, index).background))
  return toHex(hslToRgb(hue, Math.min(1, saturation * 1.08), lightness * 0.82))
}

// The pale version of a routine's colour, and the ink that reads on it —
// used by an expanded history cell, which is a wash of the routine's colour
// rather than a fresh surface.
//
// The ink is the routine's own colour wherever it holds up against its
// tint, so the cell stays one colour throughout. Three of the six don't:
// yellow, pink and lime are already light, so a pale version of them sits
// too close to the colour itself and the text turns to mush. Those fall
// back to black. The threshold is a contrast ratio, so the decision is made
// on how the pair actually reads rather than on a list of exceptions.
const TINT_LIGHTNESS = 0.93
const INK_MIN_CONTRAST = 2

function contrastBetween(a, b) {
  const [light, dark] = a > b ? [a, b] : [b, a]
  return (light + 0.05) / (dark + 0.05)
}

export function paleFor(name, index) {
  const colour = styleFor(name, index).background
  const [hue, saturation] = rgbToHsl(channelsOf(colour))
  const background = toHex(hslToRgb(hue, Math.min(saturation, 0.9), TINT_LIGHTNESS))

  const contrast = contrastBetween(
    luminanceOf(channelsOf(background)),
    luminanceOf(channelsOf(colour)),
  )
  return { background, ink: contrast >= INK_MIN_CONTRAST ? colour : '#0a0a0a' }
}

// `index` positions a custom routine in the colour cycle. The in-workout
// screen only knows a routine by name, so when it's omitted the name
// itself picks the colour — same routine, same colour, either way.
export function styleFor(name, index) {
  const known = STYLE_BY_TYPE[name.toLowerCase()]
  if (known) return known
  const slot =
    index ?? [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return CARD_STYLE_CYCLE[slot % CARD_STYLE_CYCLE.length]
}
