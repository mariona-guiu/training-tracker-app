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
// The card's resting tilt is not in here any more — see `tiltFor` below. It
// used to be a stated `rotate` per routine and is now derived, because six
// hand-typed angles stopped looking casually stacked the moment the stack was
// reordered.
//
// `glow` is the opacity of the outer half of the card's shadow. Core takes 1
// where every other routine takes 0.41: its pink is pale enough that a shadow
// at 0.41 is not there at all.
const ROUTINES = {
  'upper body': {
    glow: 0.41,
    // TRIAL, 2026-08-11. Stated rather than weighed, because weighing it gets
    // the answer wrong here: inkOn switches at a luminance of 0.36, and black
    // and white actually cross over at 0.179, so orange lands in the band that
    // takes white when black reads far better — 2.86:1 against 6.93:1 in light,
    // 3.37:1 against 5.88:1 in dark. The white version fails even the 3:1 that
    // large text is allowed, on the 82pt figure.
    //
    // Being tried on this routine alone. Lower body and full body sit in the
    // same band and are deliberately untouched, so there is one change to look
    // at rather than three.
    light: { base: '#F37500', sweep: '#C75000', card: '#FFBF83', ink: '#0a0a0a' },
    // Darkens by choice. Left to the label rule it would lighten, since a
    // full-depth darkening takes its black label to 4.24:1 — see `wash` in
    // washFor, which honours the choice by stopping where the label does.
    dark: { base: '#E46701', sweep: '#B54103', card: '#FFA65D', ink: '#0a0a0a', wash: 'darken' },
  },
  'lower body': {
    glow: 0.41,
    // Black: 5.56:1 against white's 3.56:1. The dark scheme keeps white,
    // where the two are a tie (4.59 to 4.32) and the colour is dark enough
    // that white is what it looks like it wants.
    // #00ADF0 rather than the #0091C9 it was: the same hue and saturation,
    // lightness 39.4% to 47%. Lifted so that black has somewhere to go —
    // on the old blue the button could only darken 7.1 before its own
    // label fell under AA, which read as no button at all. On this one a
    // full-depth darkening leaves the label at 5.12:1.
    light: { base: '#00ADF0', sweep: '#0071A5', card: '#87D7F6', ink: '#0a0a0a', wash: 'darken' },
    dark: { base: '#0081BC', sweep: '#1C598F', card: '#69C1EA' },
  },
  glutes: {
    glow: 0.41,
    light: { base: '#FCD22E', sweep: '#EEB722', card: '#FFE373' },
    dark: { base: '#F5B000', sweep: '#E79507', card: '#FFCE53' },
  },
  core: {
    glow: 1,
    light: { base: '#FBCEDF', sweep: '#FFBAD4', card: '#FCDEE9' },
    dark: { base: '#F3ABC5', sweep: '#F48AAF', card: '#FFC3D9' },
  },
  'full body': {
    glow: 0.41,
    // White in both. Black was tried and reverted: on the card the two are a
    // tie (4.48 to 4.42, and neither clears 4.5 for 12pt), while on the sweep
    // black costs 6.07 down to 3.26 — so it bought nothing and lost the rest
    // countdown. This colour is the one place in the palette where no ink
    // passes AA on the card, which is a fact about the colour, not the ink.
    light: { base: '#EC1C22', sweep: '#C41419', card: '#FF7175' },
    dark: { base: '#DD0004', sweep: '#AD0003', card: '#F26163' },
  },
  mobility: {
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
//
// **The order alternates bright and dark, every card.** Not body part, and
// not a gradient from light to dark either — three of the six sit within 4 L*
// of each other (mobility 89.4, core 87.0, glutes 85.5), so any ordering *by*
// brightness stacks that cluster together, which is the fault this exists to
// avoid.
//
//   glutes      85.5  bright
//   full body   50.4  dark
//   core        87.0  bright
//   upper body  63.2  dark
//   mobility    89.4  bright
//   lower body  66.7  dark
//
// It took three attempts and each exposed the next condition, so all three are
// written down rather than left to whoever edits this next:
//
//   1. Not near-complementary. The original order — upper, lower, glutes,
//      core, full body, mobility — put orange directly above blue, 12 degrees
//      off complementary, and the two vibrated where the cards overlap.
//   2. Far enough apart in Lab to read as two colours. Walking the hue wheel
//      fixed 1 and broke this: yellow landed on lime, 18 degrees apart in hue.
//   3. **A step in lightness.** Fixing 2 on Lab distance alone put core above
//      glutes — 83 apart in Lab, almost all of it hue, and 1.5 apart in L*. It
//      is the lightness step that draws the edge where cards overlap, so a
//      pair can be far apart in colour and still have no visible boundary.
//
// What this order holds:
//
//   weakest lightness step   22.7 L*
//   weakest separation       79.4 dE
//   nearest to complementary 48.8 degrees clear of 180
//
// The cost, taken deliberately: upper body and lower body are nowhere near
// each other. The pile is a set of colours you recognise, not a list you read
// down — and the four-tab restructure gives the list a home of its own.
export const CANONICAL_ORDER = [
  'glutes',
  'full body',
  'core',
  'upper body',
  'mobility',
  'lower body',
]

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

// Which ink stays readable on a colour. The palette spans a deep blue and a
// near-fluorescent lime, so a single fixed text colour would be unreadable at
// one end or the other.
//
// **The threshold is not where black and white are equally legible**, which is
// what this used to claim. That point is a luminance of 0.179; this switches at
// 0.36, so everything in between takes white when black would read better —
// upper body, lower body and full body, in one scheme or both. Raising it would
// flip three routines from white text to black, which is a change to how the
// app looks rather than a correction, so the number stays and a routine that
// wants the other answer states it (see `ink` in the table above).
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

// The tilt each card rests at, so the pile looks dropped rather than aligned.
//
// **The angles belong to the position in the pile, not to the routine.** Which
// is why they are a plain list rather than a field on each entry: a card sits
// at whatever angle its place in the stack calls for, and reordering the stack
// keeps the rhythm rather than carrying six angles around with it.
//
// Chosen by eye, and the unevenness is the point. A hashed magnitude with
// alternating signs was tried first and came out too regular — every other
// card at nearly the same lean, which reads as a pattern rather than as a pile.
// This has a flat one and five that disagree by different amounts, which is
// what a stack of cards actually does when you drop it.
//
// **Never random.** It has to be stable — a tilt that changed would jolt the
// whole pile every time a card was tapped — so this is indexed, never drawn.
// Same rule the roadmap sets for exercise rotation: a pure function of the
// thing, never a draw.
const TILTS = [3, -5, -2, 0, 4, -3]

function tiltFor(name, index) {
  // The stack passes the card's own position; anything else falls back to
  // where the routine sits in the canonical order.
  const key = name?.toLowerCase() ?? ''
  const slot = index ?? CANONICAL_ORDER.indexOf(ALIASES[key] ?? key)
  return TILTS[((slot % TILTS.length) + TILTS.length) % TILTS.length]
}

export function styleFor(scheme, name, index) {
  // Before the name lookup, not after. Called the old way — styleFor(kind,
  // index) — the arguments shift by one and `name` becomes a number, so the
  // lookup throws first with "name?.toLowerCase is not a function", which says
  // nothing about the actual mistake.
  assertScheme(scheme)
  const entry = entryFor(name, index)
  const { base } = entry[scheme]
  return { background: base, rotate: tiltFor(name, index), boxShadow: glowOf(base, entry.glow) }
}

export function inkFor(scheme, name, index) {
  const tones = tonesFor(scheme, name, index)
  return tones.ink ?? inkOn(tones.base)
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
// A dark ground and a light one do not just want different *amounts* of wash.
// They want different **directions**, which is what the reported bug turned out
// to be.
//
// On a dark ground the sweep is a genuinely deeper shade and laying it over the
// card separates the button properly. On a light one — the pale pink, the
// yellow, the lime — the sweep is barely a different colour from the card, 11
// to 16 apart in Lab, so no opacity of it buys much: the button came out at 5.6
// to 6.8 from its ground and read as not being there. Reported on all three,
// in both schemes.
//
// So a light ground gets a **shadow** instead: the same near-black the card's
// own text uses, at a low opacity. That is not the "mixed with black drains the
// colour out" trap noted on the sweep above — that was about replacing a colour
// outright, where this is a translucent film that darkens and keeps the hue.
//
// The step is much larger because it has to be. On these three it lands 12.9 to
// 18.7 from the card, and the label still reads at 7.2:1 at worst.
const WASH_STEP_ON_LIGHT = 14
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

// Which way a light ground darkens, where near-black is the wrong answer.
//
// Core is the app's one pastel, and a neutral film reads on it as grey rather
// than as pink: it drops the colour's chroma from 18.6 to 15.7 in light and
// 30.2 to 25.1 in dark, and that drop is exactly what "greyed out" means. The
// vivid yellow and lime survive the same film because they have chroma to
// spare — reported as fine, and left alone.
//
// So Core states its direction and keeps solving for the amount. #EC4899 is
// the card's own hue with the chroma pushed rather than the lightness pulled,
// and it takes the button to 33.7 in light and 49.3 in dark — more intense
// than its ground rather than deeper than it.
//
// A tint here is a *direction*, not a colour: the opacity is still worked out
// against the same two distances as everything else, which is what the old
// WASH_BY_NAME got wrong by stating both and leaving nothing to check.
const WASH_TINT_BY_NAME = { core: '#EC4899' }

// The light branch needs its own, and mobility is why. Darkening lime walks it
// straight through its own sweep — at the opacity that first clears the card
// target it sits 3.6 from it — and only clears again on the far side. A floor
// of 7 is what carries it past.
const WASH_LIGHT_MIN_FROM_SWEEP = 7

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

// A label has to survive the surface it sits on, which is the constraint the
// two distances above say nothing about. 4.5:1, the same AA threshold the rest
// of the app is held to.
const WASH_MIN_LABEL_CONTRAST = 4.5

function contrastBetween(a, b) {
  const [x, y] = [luminanceOf(a), luminanceOf(b)]
  const [hi, lo] = x > y ? [x, y] : [y, x]
  return (hi + 0.05) / (lo + 0.05)
}

// The opacity, for a given direction. Walked rather than solved: the blend is
// not linear in Lab, and a hundredth is finer than any screen can show.
//
// Distance from the card grows with the opacity and distance from the sweep
// shrinks, so the first opacity satisfying both is the shallowest one that
// does. Failing that, the best available is where the two cross.
//
// `ink`, when given, bounds it: the walk stops at the deepest opacity whose
// label still clears AA rather than running on to the target. That is what a
// stated `wash: 'darken'` uses — the direction is the designer's, the depth is
// still answerable to whether the label can be read on the result.
function solveWash(ground, sweep, toward, target, floor, ink) {
  let chosen = 0.02
  let best = -1
  let deepestLegible = null
  for (let a = 0.02; a <= 1; a += 0.01) {
    const blended = toward.map((c, i) => a * c + (1 - a) * ground[i])
    const fromCard = difference(blended, ground)
    const fromSweep = difference(blended, sweep)
    if (ink) {
      if (contrastBetween(blended, ink) >= WASH_MIN_LABEL_CONTRAST) deepestLegible = a
      else return deepestLegible ?? a
    }
    if (fromCard >= target && fromSweep >= floor) return a
    const worst = Math.min(fromCard, fromSweep)
    if (worst > best) {
      best = worst
      chosen = a
    }
  }
  return chosen
}

const asRgba = (channels, alpha) => {
  const [r, g, b] = channels.map((c) => Math.round(c * 255))
  // Returned as the colour and its opacity rather than already blended: this
  // sits over a blur, and an opaque fill would hide the very thing it is meant
  // to be part of.
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
}

export function washFor(scheme, name, index) {
  const tones = tonesFor(scheme, name, index)
  const ground = channelsOf(tones.base)
  const sweep = channelsOf(tones.sweep)

  // Decided by **the ink actually in use**, not by weighing the base colour.
  // Those two disagree the moment a routine states its own ink, and when they
  // did the button went nearly invisible: upper body and lower body kept the
  // dark-ground treatment — a 5-step deepening, which only works underneath
  // white text — while their labels had turned black. A routine wearing black
  // ink is a light ground whatever its luminance says.
  const ink = tones.ink ?? inkOn(tones.base)
  if (ink !== CARD_INK) {
    return asRgba(sweep, solveWash(ground, sweep, sweep, WASH_STEP_ON_DARK, WASH_MIN_FROM_SWEEP))
  }

  // Darken first, and check the label survives it.
  const stated = WASH_TINT_BY_NAME[ALIASES[name?.toLowerCase()] ?? name?.toLowerCase()]
  const darker = channelsOf(stated ?? CARD_INK)
  const alpha = solveWash(ground, sweep, darker, WASH_STEP_ON_LIGHT, WASH_LIGHT_MIN_FROM_SWEEP)
  const blended = darker.map((c, i) => alpha * c + (1 - alpha) * ground[i])
  if (contrastBetween(blended, channelsOf(ink)) >= WASH_MIN_LABEL_CONTRAST) {
    return asRgba(darker, alpha)
  }

  // Stated as darkening even though the label rule would send it the other
  // way. Honoured, but bounded: it darkens as far as the label can take and
  // stops there rather than going to the full step.
  if (tones.wash === 'darken') {
    const bounded = solveWash(
      ground,
      sweep,
      darker,
      WASH_STEP_ON_LIGHT,
      WASH_LIGHT_MIN_FROM_SWEEP,
      channelsOf(ink),
    )
    return asRgba(darker, bounded)
  }

  // It did not, so go the other way. Darkening a *mid*-luminance ground pushes
  // it towards its own black label: lower body came out at 3.40:1 and upper
  // body dark at 4.24:1, both unreadable, while the pale three have so much
  // headroom they never notice. Lightening is better on all three counts for
  // exactly those grounds — further from the sweep as well, since the sweep is
  // the darker direction.
  //
  // Which direction a routine ends up on is therefore decided by its own
  // numbers rather than listed here, and the pale three keep the darkening
  // film they were signed off with.
  const lighter = [1, 1, 1]
  return asRgba(
    lighter,
    solveWash(ground, sweep, lighter, WASH_STEP_ON_LIGHT, WASH_LIGHT_MIN_FROM_SWEEP),
  )
}
