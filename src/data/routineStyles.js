// Each routine's colour, in both schemes, shared by the workout stack, the
// in-workout screen and History so a routine keeps its identity from the tap
// through to the session itself.
//
// **Every function here takes the scheme first.** A routine's colour is the
// one thing in the app that is neither a token nor scheme-independent: it is
// identity, but it is a different hex in light and in dark. Screens do not
// call these directly — they take `useRoutineColours()` from the theme, which
// binds the scheme and hands back the same call signatures these had before.
//
// The scheme is checked rather than defaulted. A missed call site would
// otherwise render light colours on a dark page and look merely a bit wrong,
// which is the failure this codebase keeps being bitten by; this way it stops.
//
// Three tones per routine per scheme, all stated by the designer rather than
// derived. They used to be one stated colour with the other two computed —
// lightness down for the sweep, lightness up for the History card — which is
// why the old file carried an HSL conversion, a Lab distance and two solvers.
// Only the Lab distance survives, and only for the wash.
//
//   base   the card, and the in-workout screen it opens into
//   sweep  the rest countdown painted over that colour
//   card   an expanded History cell
//
// `rotate` is the card's permanent resting tilt — it never changes, so tapping
// a card cannot jolt the pile — and it belongs to the routine rather than to
// the scheme.
//
// `glow` is the opacity of the outer half of the card's shadow. Core takes 1
// where every other routine takes 0.41: its pink is pale enough that a shadow
// at 0.41 is not there at all.
const ROUTINES = {
  'upper body': {
    rotate: -3,
    glow: 0.41,
    light: { base: '#F37500', sweep: '#C75000', card: '#FFBF83' },
    dark: { base: '#E46701', sweep: '#B54103', card: '#FFA65D' },
  },
  'lower body': {
    rotate: 4.676,
    glow: 0.41,
    light: { base: '#0091C9', sweep: '#0071A5', card: '#87D7F6' },
    dark: { base: '#0081BC', sweep: '#1C598F', card: '#69C1EA' },
  },
  glutes: {
    rotate: -12.261,
    glow: 0.41,
    light: { base: '#FCD22E', sweep: '#EEB722', card: '#FFE373' },
    dark: { base: '#F5B000', sweep: '#E79507', card: '#FFCE53' },
  },
  core: {
    rotate: 0,
    glow: 1,
    light: { base: '#FBCEDF', sweep: '#FFBAD4', card: '#FCDEE9' },
    dark: { base: '#F3ABC5', sweep: '#F48AAF', card: '#FFC3D9' },
  },
  'full body': {
    rotate: -4.219,
    glow: 0.41,
    light: { base: '#EC1C22', sweep: '#C41419', card: '#FF7175' },
    dark: { base: '#DD0004', sweep: '#AD0003', card: '#F1575A' },
  },
  mobility: {
    rotate: 2.574,
    glow: 0.41,
    light: { base: '#D7ED00', sweep: '#C5D716', card: '#EBF86D' },
    dark: { base: '#BFD200', sweep: '#AEBF00', card: '#E0EE5A' },
  },
}

// IndexedDB's natural order followed random ids, not anything meaningful — the
// known routines are pinned to a deliberate stacking order and anything else
// falls in after them. It doubles as the colour cycle a custom routine is
// assigned from, which is why the two are one list rather than two that have
// to agree.
export const CANONICAL_ORDER = ['upper body', 'lower body', 'glutes', 'core', 'full body', 'mobility']

// Sessions recorded before the routine was renamed still say 'stretching', and
// history should not turn a different colour because a routine was renamed.
const ALIASES = { stretching: 'mobility' }

function assertScheme(scheme) {
  if (scheme !== 'light' && scheme !== 'dark') {
    throw new Error(
      `routineStyles: expected 'light' or 'dark' as the first argument, got ${JSON.stringify(scheme)}. ` +
        'These all take the scheme first — screens should use useRoutineColours() rather than calling them directly.',
    )
  }
}

// `index` positions a custom routine in the colour cycle. The in-workout screen
// only knows a routine by name, so when it is omitted the name itself picks the
// colour — same routine, same colour, either way.
function entryFor(name, index) {
  const key = ALIASES[name?.toLowerCase()] ?? name?.toLowerCase()
  if (ROUTINES[key]) return ROUTINES[key]
  const slot = index ?? [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return ROUTINES[CANONICAL_ORDER[slot % CANONICAL_ORDER.length]]
}

function tonesFor(scheme, name, index) {
  assertScheme(scheme)
  return entryFor(name, index)[scheme]
}

function channelsOf(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
}

// Relative luminance per WCAG — how bright a colour reads to the eye, rather
// than how large its numbers are.
function luminanceOf([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

// Which ink stays readable on a routine's colour. The palette spans a deep
// blue and a near-fluorescent lime, so a single fixed text colour would be
// unreadable at one end or the other. The threshold sits where black and white
// are about equally legible.
//
// Scheme-free on purpose, and the one function here that is: it weighs whatever
// colour it is handed, which is usually a routine's but is sometimes the colour
// a card handed over mid-transition.
export function inkOn(hex) {
  return luminanceOf(channelsOf(hex)) > 0.36 ? '#0a0a0a' : '#ffffff'
}

function glowOf(hex, alpha) {
  const [r, g, b] = channelsOf(hex).map((c) => Math.round(c * 255))
  return `0 0 1.9px 0 rgba(${r}, ${g}, ${b}, 0.62), 0 2px 8px 0 rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function styleFor(scheme, name, index) {
  // Before the name lookup, not after. Called the old way — styleFor(kind,
  // index) — the arguments shift by one and `name` becomes a number, so the
  // lookup throws first with "name?.toLowerCase is not a function", which says
  // nothing about the actual mistake.
  assertScheme(scheme)
  const entry = entryFor(name, index)
  const { base } = entry[scheme]
  return { background: base, rotate: entry.rotate, boxShadow: glowOf(base, entry.glow) }
}

export function inkFor(scheme, name, index) {
  return inkOn(styleFor(scheme, name, index).background)
}

// The colour the rest sweep paints over a routine's own.
export function restTintFor(scheme, name, index) {
  return tonesFor(scheme, name, index).sweep
}

// An expanded History cell: the routine's palest tone, with near-black on it.
//
// The ink used to be solved for — the routine's own colour walked darker until
// it cleared AA against the cell, falling back to near-black when that would
// drift so far it stopped reading as the routine's colour. Three of the six
// were falling back anyway, and near-black clears AA on all twelve cells by a
// wide margin: 5.89:1 at worst, on full body dark. Stated, then, and the
// solver is gone.
const CARD_INK = '#0a0a0a'

export function paleFor(scheme, name, index) {
  return { background: tonesFor(scheme, name, index).card, ink: CARD_INK }
}

// The whole palette, for the rare thing that belongs to the app rather than to
// one routine — the confetti at the end of a workout uses all six.
export function routineColours(scheme) {
  assertScheme(scheme)
  return CANONICAL_ORDER.map((key) => ROUTINES[key][scheme].base)
}

// A surface laid over a routine's own colour — the button in a workout, and
// anything else that has to read as part of the screen rather than on top of
// it. The routine's sweep colour, thinned until it is only just present.
//
// How thin is not one number, because a fixed one does not look fixed. At the
// same 55% the pale pink routine leapt by a colour difference of 21 while the
// blue moved by 6 — the pink read as a slab and the blue as a smudge. So the
// *step* is held constant instead of the opacity, and the opacity is solved for.
//
// Two targets rather than one. A dark routine already has a dark frost behind
// this, so a deep wash on top darkens it twice and the button reads as a hole
// punched in the screen; it takes half the step. A light routine has a light
// frost, the two work against each other, and it can take the full one.
const WASH_STEP_ON_LIGHT = 10
const WASH_STEP_ON_DARK = 5

// And a floor against the *sweep*, which is the part that used to be missing.
//
// The button spends much of its life over the rest countdown rather than over
// the card, so holding it a fixed distance from the card says nothing about
// whether it can still be seen once the sweep arrives. On the old colours that
// bit Core alone and was fixed by pinning Core's wash by hand. On these it
// would bite three of the six — glutes lands 1.9 from its sweep, mobility 1.5,
// and mobility dark cannot reach its card target at all, since its card and
// sweep are only 8.7 apart to begin with.
//
// So the hand-pin is generalised instead of being joined by two more. Where
// both distances can hold, nothing changes and the five routines that were
// already fine keep the wash they had. Where they cannot, the wash goes to
// where the smaller of the two is largest — which is the same "split the
// difference, leaning towards being visible during rest" the pin was doing,
// arrived at rather than typed in.
const WASH_MIN_FROM_SWEEP = 5

// CIE Lab, so "how different" means how different it looks rather than how far
// apart the numbers are. sRGB is nowhere near uniform: the same numeric step is
// a different amount of change depending on where in the space it lands, which
// is the whole reason a single opacity could not work here.
function labOf(rgb) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgb.map(lin)
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function difference(a, b) {
  const [la, lb] = [labOf(a), labOf(b)]
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

export function washFor(scheme, name, index) {
  const tones = tonesFor(scheme, name, index)
  const ground = channelsOf(tones.base)
  const deeper = channelsOf(tones.sweep)
  const target = inkOn(tones.base) === '#ffffff' ? WASH_STEP_ON_DARK : WASH_STEP_ON_LIGHT

  // Walked rather than solved: the blend is not linear in Lab, and a hundredth
  // is finer than any screen can show.
  //
  // Distance from the card grows with the opacity and distance from the sweep
  // shrinks, so the first opacity that satisfies both is the shallowest one
  // that does. Failing that, the best available is where the two cross.
  let chosen = 0.02
  let best = -1
  for (let a = 0.02; a <= 1; a += 0.01) {
    const blended = deeper.map((c, i) => a * c + (1 - a) * ground[i])
    const fromCard = difference(blended, ground)
    const fromSweep = difference(blended, deeper)
    if (fromCard >= target && fromSweep >= WASH_MIN_FROM_SWEEP) {
      chosen = a
      break
    }
    const worst = Math.min(fromCard, fromSweep)
    if (worst > best) {
      best = worst
      chosen = a
    }
  }

  // Returned as the colour and its opacity rather than already blended: this
  // sits over a blur, and an opaque fill would hide the very thing it is meant
  // to be part of.
  const [r, g, b] = deeper.map((c) => Math.round(c * 255))
  return `rgba(${r}, ${g}, ${b}, ${chosen.toFixed(2)})`
}
