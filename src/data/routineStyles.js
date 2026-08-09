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

// A surface laid over a routine's own colour — the button in a workout, and
// anything else that has to read as part of the screen rather than on top of
// it. The routine's deeper shade, thinned until it is only just present.
//
// How thin is not one number, because a fixed one does not look fixed. At the
// same 55% the pale pink routine leapt by a colour difference of 21 while the
// blue moved by 6 — the pink read as a slab and the blue as a smudge. So the
// *step* is held constant instead of the opacity, and the opacity is solved
// for: work out how far the blend has to go before the eye registers the
// agreed amount of change, and stop there.
//
// Two targets rather than one. A dark routine already has a dark frost behind
// this, so a deep wash on top darkens it twice and the button reads as a hole
// punched in the screen; it takes half the step. A light routine has a light
// frost, the two work against each other, and it can take the full one.
const WASH_STEP_ON_LIGHT = 10
const WASH_STEP_ON_DARK = 5

// CIE Lab, so "how different" means how different it looks rather than how far
// apart the numbers are. sRGB is nowhere near uniform: the same numeric step is
// a different amount of change depending on where in the space it lands, which
// is the whole reason a single opacity could not work here.
function labOf(rgb) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgb.map(lin)
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function difference(a, b) {
  const [la, lb] = [labOf(a), labOf(b)]
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

export function washFor(name, index) {
  const ground = channelsOf(styleFor(name, index).background)
  const deeper = channelsOf(restTintFor(name, index))
  const target =
    inkOn(styleFor(name, index).background) === '#ffffff'
      ? WASH_STEP_ON_DARK
      : WASH_STEP_ON_LIGHT

  // Walked rather than solved: the blend is not linear in Lab, and a hundredth
  // is finer than any screen can show.
  let alpha = 1
  for (let a = 0.02; a <= 1; a += 0.01) {
    alpha = a
    const blended = deeper.map((c, i) => a * c + (1 - a) * ground[i])
    if (difference(blended, ground) >= target) break
  }

  // Returned as the colour and its opacity rather than already blended: this
  // sits over a blur, and an opaque fill would hide the very thing it is meant
  // to be part of.
  const [r, g, b] = deeper.map((c) => Math.round(c * 255))
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
}

// The pale version of a routine's colour, and the ink that reads on it —
// used by an expanded history cell, which is a wash of the routine's colour
// rather than a fresh surface.
//
// The ink is the routine's own colour wherever it can be made legible on its
// own tint, so the cell stays one colour throughout.
//
// It used to be the colour *unchanged*, accepted at a contrast of 2. That is
// not a legibility threshold — it is barely a "can you tell these differ"
// one, and it left orange at 2.49, blue at 3.13 and red at 3.50 against a
// standard that asks for 4.5. The other three were already sent to black and
// were never the problem.
//
// So the colour is turned down until it clears AA rather than accepted or
// abandoned as it is. Lightness only, never mixed with black, for the reason
// restTintFor gives: mixing drains the colour out.
const TINT_LIGHTNESS = 0.93
// WCAG AA for body text. Cell text is 12-16pt, so the 3:1 large-text
// allowance does not apply to it.
const INK_MIN_CONTRAST = 4.5
// How far the ink may drift from the routine's colour and still read as that
// colour. Orange, blue and red reach AA by moving 25, 12 and 9; yellow, pink
// and lime would have to move 46, 69 and 54, which is not a deeper shade but
// a different colour — darkened yellow is olive, and darkened pale pink is
// crimson. Those three keep the black they already had.
//
// Measured in Lab, like the wash step above, because the question is how
// different it looks and sRGB does not answer that.
const INK_MAX_DRIFT = 30

function contrastBetween(a, b) {
  const [light, dark] = a > b ? [a, b] : [b, a]
  return (light + 0.05) / (dark + 0.05)
}

export function paleFor(name, index) {
  const colour = styleFor(name, index).background
  const [hue, saturation, lightness] = rgbToHsl(channelsOf(colour))
  const background = toHex(hslToRgb(hue, Math.min(saturation, 0.9), TINT_LIGHTNESS))

  // Walk the lightness down until the pair clears AA, nudging intensity up on
  // the way so it deepens rather than greys — the same move restTintFor makes
  // for a routine with no hand-picked tint.
  const ground = luminanceOf(channelsOf(background))
  let ink = colour
  for (let level = lightness; level >= 0; level -= 0.005) {
    ink = toHex(hslToRgb(hue, Math.min(1, saturation * 1.05), level))
    if (contrastBetween(ground, luminanceOf(channelsOf(ink))) >= INK_MIN_CONTRAST) break
  }

  const drifted = difference(channelsOf(colour), channelsOf(ink)) > INK_MAX_DRIFT
  return { background, ink: drifted ? '#0a0a0a' : ink }
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
