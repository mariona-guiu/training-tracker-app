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
    // Black rather than weighed. inkOn switches at a luminance of 0.36 and the
    // real crossover is 0.179, so orange lands in the band that takes white
    // when black reads far better — 2.86:1 against 6.93:1 in light, 3.37:1
    // against 5.88:1 in dark. The white version failed even the 3:1 that large
    // text is allowed, on the 82pt figure.
    light: {
      base: '#F37500',
      sweep: '#E46C1B',
      card: '#FFBF83',
      ink: '#0a0a0a',
      wash: 'rgba(162, 65, 17, 0.46)',
    },
    // The one base that moved during tuning: #E46701 to #EB7100, a shade
    // brighter, which is what gave the button somewhere to sit without its
    // label going under. Mid-sweep that label still reads 4.25:1 against AA's
    // 4.5 — accepted deliberately rather than chased, because recovering the
    // last 0.25 meant moving the sweep and the card as well.
    dark: {
      base: '#EB7100',
      sweep: '#DF6316',
      card: '#FFA65D',
      ink: '#0a0a0a',
      wash: 'rgba(135, 47, 13, 0.33)',
    },
  },
  'lower body': {
    glow: 0.41,
    // #00ADF0 rather than the #0091C9 it started as: the same hue and
    // saturation, lightness 39.4% to 47%. Lifted so black had somewhere to go —
    // on the old blue the button could only darken 7.1 before its own label
    // fell under AA, which read as no button at all.
    //
    // The only routine whose ink differs by scheme: black on the lifted light
    // blue at 7.76:1, white on the darker one where the two are a tie and the
    // colour is dark enough that white is what it looks like it wants.
    light: {
      base: '#00ADF0',
      sweep: '#0096DB',
      card: '#87D7F6',
      ink: '#0a0a0a',
      wash: 'rgba(15, 64, 117, 0.27)',
    },
    dark: { base: '#0081BC', sweep: '#0067A3', card: '#69C1EA', wash: 'rgba(20, 102, 173, 0.31)' },
  },
  glutes: {
    glow: 0.41,
    light: { base: '#FCD22E', sweep: '#F7C319', card: '#FFE373', wash: 'rgba(179, 128, 0, 0.31)' },
    dark: { base: '#F5B000', sweep: '#EBA400', card: '#FFCE53', wash: 'rgba(184, 123, 10, 0.45)' },
  },
  core: {
    glow: 1,
    light: { base: '#FBCEDF', sweep: '#FFBDD6', card: '#FCDEE9', wash: 'rgba(217, 99, 157, 0.21)' },
    dark: { base: '#F3ABC5', sweep: '#F292B3', card: '#FFC3D9', wash: 'rgba(166, 58, 112, 0.24)' },
  },
  'full body': {
    glow: 0.41,
    // White in both. Black was tried and reverted: on the card the two are a
    // tie (4.48 to 4.42, and neither clears 4.5 for 12pt), while on the sweep
    // black cost 6.07 down to 3.26. The one colour in the palette where no ink
    // passes AA on the card, which is a fact about the colour, not the ink.
    //
    // The only tone left untouched by the tuning: confirmed as it shipped.
    light: { base: '#EC1C22', sweep: '#C41419', card: '#FF7175', wash: 'rgba(196, 20, 25, 0.36)' },
    dark: { base: '#DD0004', sweep: '#AD0003', card: '#F26163', wash: 'rgba(138, 0, 2, 0.27)' },
  },
  mobility: {
    glow: 0.41,
    light: { base: '#D7ED00', sweep: '#C5D716', card: '#EBF86D', wash: 'rgba(136, 144, 35, 0.29)' },
    dark: { base: '#BFD200', sweep: '#AEBF00', card: '#E0EE5A', wash: 'rgba(52, 77, 0, 0.21)' },
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
// it. Stated per routine per scheme, like every other tone.
//
// **This used to be solved and no longer is.** The solver held a constant
// perceptual step from the card, floored the distance from the sweep, chose
// between darkening and lightening by whether the label survived it, and let a
// routine override the direction. It was doing real work — it is what found
// that a wash tuned against the card can vanish the moment the rest countdown
// starts — but every value it produced was a neutral film or, on Core, a
// hand-picked pink, and that made Core look like an exception to a rule nobody
// had chosen.
//
// All twelve were then set by eye in a preview that showed the button across
// the card/sweep boundary, with contrast read out live. Every one came back a
// shade of its own routine. So the rule is simply that — a wash is the
// routine's colour, deepened, at an opacity chosen by looking — and there is
// nothing left for a solver to decide.
//
// Kept as a colour and an opacity rather than pre-blended: this sits over a
// blur, and an opaque fill would hide the very thing it is meant to be part of.
export function washFor(scheme, name, index) {
  return tonesFor(scheme, name, index).wash
}
