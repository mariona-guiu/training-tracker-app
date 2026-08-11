// The palette, as objects rather than CSS variables.
//
// The web app re-points a set of custom properties — body.theme-light for the
// tabbed screens, .workout-mode for the dark in-workout screen — so anything
// built on those variables adapts on its own without being restyled. React
// Native has no cascade to lean on, so the same idea becomes two palettes of
// the same shape, picked at the top of a screen and passed down.
//
// The rule that carries over unchanged: style with these tokens, never with
// literal colours. The only literal colours in the app belong to routines,
// via styleFor() in data/routineStyles.js — a routine's colour is its
// identity, shared by its card, its workout screen and its days on Stats.

// The accent is identity rather than scheme: the same lime in both, because it
// is the app's colour and not a shade of its background. It already carries
// 16.76:1 against its own text, which is why it needs no dark variant.
const ACCENT = '#c6ff3d'
const ACCENT_TEXT = '#0a0a0a'

export const LIGHT = {
  bg: '#fdfdfc',
  // Taken from the Stats design, and the same card colour Settings already
  // draws — the two screens had drifted a step apart from each other.
  bgRaised: '#f7f7f6',
  border: '#e3e3de',
  // #191919 rather than #0a0a0a: the Figma files specify it and Settings
  // rendered it, so it is the one with the most evidence behind it. Decided
  // once here, which is the whole point of it being a token.
  text: '#191919',
  textDim: '#6f6f6a',
  accent: ACCENT,
  accentText: ACCENT_TEXT,
  // From the swipe design. It is the same red as the full-body routine, which
  // is a collision on purpose rather than an accident: swiping that one cell
  // puts red on red, and what separates them there is the shadow the cell
  // casts onto the action, not a difference in hue.
  danger: '#EC1C22',
  // A header the page scrolls behind: the page's own colour, thinned, with
  // the content underneath blurred through it.
  surfaceFloating: 'rgba(253, 253, 252, 0.72)',
  // A card sitting on the page: the raised colour at half strength, so it
  // reads as a tint of the page rather than a panel laid over it.
  surfaceCard: 'rgba(247, 247, 246, 0.5)',
  // Two roles every screen had been spelling out by hand: what sits on top of
  // a filled ink surface, and the unfilled half of a control.
  onInk: '#ffffff',
  controlTrack: '#d9d9d7',
  // The floating bar, where the phone has no Liquid Glass and the blurred
  // stand-in has to imply the material by hand: a wash lit from the top, a
  // hairline edge over it, and the pill that marks the tab you are on.
  //
  // These were three literals inside (tabs)/_layout.jsx, all of them white or
  // near-black, which is exactly the kind of value that has no dark answer
  // until it is given a name.
  glassWash: ['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.32)'],
  glassEdge: 'rgba(255, 255, 255, 0.55)',
  highlight: 'rgba(10, 10, 10, 0.12)',
  scheme: 'light',
}

// Derived from LIGHT rather than inherited from the in-workout screen, which is
// what used to be here. That old palette was built for one dark screen sitting
// under a routine's colour, and read as a different app when it was asked to
// carry every screen.
//
// Three things decide the values, and each is a rule rather than a taste:
//
// **Never pure black.** #121211 rather than #000. Light text on true black
// smears on OLED, and a page already at the bottom of the range has nowhere
// left to go when a surface needs to sit above it.
//
// **Elevation runs the other way.** bgRaised is *lighter* than bg here and
// darker than it in LIGHT. A dark theme cannot lift a surface with a shadow —
// there is nothing for a shadow to darken — so it lifts it with light.
// controlTrack inverts for the same reason.
//
// **Saturation comes down.** A fully saturated hue against a dark ground
// vibrates, and #EC1C22 also fails AA with white on it (4.42:1). #ff5257 is
// the same red lightened until it clears: 5.89:1. The cost is that it no
// longer collides exactly with the full-body routine — see the note on
// LIGHT.danger. In dark mode that collision could not have worked anyway,
// since what separated the two there was a shadow.
//
// Contrast, measured rather than judged: text 16.71:1 on the page and 14.89:1
// on a card, textDim 5.39:1 and 4.81:1. The light palette's own figures are
// 17.27 / 16.40 and 4.96 / 4.71, so quiet text stays as quiet as it is in
// light mode instead of being brightened past it — which is the usual way a
// ported dark palette goes wrong.
//
// The warm cast is deliberate: #fdfdfc, #e3e3de and #6f6f6a all lean warm, so
// their opposites do too. A neutral or blue-grey dark would read as a
// different product.
export const DARK = {
  bg: '#121211',
  bgRaised: '#1e1e1c',
  border: '#34342f',
  text: '#f2f2ef',
  textDim: '#8a8a83',
  accent: ACCENT,
  accentText: ACCENT_TEXT,
  danger: '#ff5257',
  surfaceFloating: 'rgba(18, 18, 17, 0.66)',
  surfaceCard: 'rgba(30, 30, 28, 0.5)',
  onInk: '#121211',
  controlTrack: '#3a3a35',
  // All three invert, and the pill is the one that matters: light mode marks
  // the current tab by darkening it, which on a dark bar would mark it by
  // making it disappear. Lighter here, at a slightly higher alpha because a
  // light film over a dark ground reads weaker than a dark one over a light.
  glassWash: ['rgba(58, 58, 53, 0.62)', 'rgba(36, 36, 33, 0.38)'],
  glassEdge: 'rgba(242, 242, 239, 0.14)',
  highlight: 'rgba(242, 242, 239, 0.16)',
  scheme: 'dark',
}

// Two families, both from the system, and the split is by job rather than by
// size: SF Pro Rounded is what gets looked at — the routine card, the page
// title, the exercise you are on, the figure you are lifting. Plain SF Pro is
// what gets read and operated: labels, prose, controls, list rows.
//
// Nothing is bundled. These are the fonts iOS already has, which is the point
// of the pivot — and it means no font files, no loader, and no splash gate
// waiting on them.
//
// The names were settled on the device rather than from documentation,
// because the failure here is silent: an unresolved family renders perfectly
// in plain SF Pro and looks like it worked. Of twelve candidates only two draw
// rounded — `ui-rounded` and `.AppleSystemUIFontRounded`. Everything else,
// including the entirely plausible 'SF Pro Rounded' and 'SFProRounded-Regular',
// falls back without a word.
//
// `ui-rounded` is the one used: a standard CSS generic that iOS's font matcher
// accepts, rather than Apple's private internal name, so it is the likelier of
// the two to survive an OS update. `.AppleSystemUIFontRounded` is the fallback
// if it ever stops — it was checked alongside and behaves identically.
//
// Both honour fontWeight from 300 to 800 and both carry tabular figures, which
// is why weights below are `fontWeight` rather than a family per cut. That was
// the open question: a named family in React Native often ignores fontWeight
// and hands back one cut for every weight asked of it.
export const FONTS = {
  text: 'System',
  rounded: 'ui-rounded',
}

export const WEIGHT = { regular: '400', medium: '500', bold: '700' }

// SF Pro and SF Pro Rounded share these exactly — one em, one set of numbers,
// read from /System/Library/Fonts. Which means a single constant covers both
// families, the same way one covered Funnel's seven cuts.
//
//   upem 2048   ascent 1980   descent -432   gap 0   cap 1444
//
// Every derived measurement in the app is built from these, so they live here
// rather than being written out at each site. They replace Funnel's, which
// were 1.25 / 0.675 / 0.250 — so text boxes are shorter and capitals taller,
// and nothing that was tuned against Funnel carries over unchanged.
export const SYSTEM_LINE = 1.1777
export const SYSTEM_ASCENT = 0.9668
export const SYSTEM_CAP = 0.705
export const SYSTEM_DESCENT = 0.2109

// The type scale. Eleven roles, each named for the job so a screen picks a
// role instead of a number.
//
// Tracking is written as `size * ratio`, never as a bare value, so changing a
// size cannot silently change how tight the text reads — the page title going
// 40 to 32 carried its own tracking with it and needed no second edit.
//
// The signs run the other way from most scales: large rounded type *tightens*
// (-1% to -3%) and small type opens (+1%). SF Pro Rounded is already narrow-set
// and its counters close up if it is tracked in, so `heading` takes +1% rather
// than the 0 its neighbours use.
//
// Case is part of the role, not the copy. Four roles uppercase themselves —
// routineCard, routineCardMeta and label — and the strings stay written as
// sentences, so nothing has to be shouted in the source.
//
// `control` is deliberately not one of them. Uppercase button labels tracked
// out is Material's convention, not Apple's; iOS sets buttons in sentence case
// and lets SF Pro's own optical tracking do the spacing. Since the whole point
// of this typeface is feeling native, the buttons speak rather than shout.
export const TYPE = {
  caption: {
    fontFamily: FONTS.text,
    fontWeight: WEIGHT.regular,
    fontSize: 12,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: FONTS.text,
    fontWeight: WEIGHT.medium,
    fontSize: 12,
    letterSpacing: 12 * 0.01,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontFamily: FONTS.text,
    fontWeight: WEIGHT.regular,
    fontSize: 16,
    letterSpacing: 0,
  },
  control: {
    fontFamily: FONTS.text,
    fontWeight: WEIGHT.medium,
    fontSize: 16,
    letterSpacing: 0,
  },
  // The card's two lines under its name — "50 min", "6 exercises".
  routineCardMeta: {
    fontFamily: FONTS.rounded,
    fontWeight: WEIGHT.regular,
    fontSize: 16,
    letterSpacing: 0,
    textTransform: 'uppercase',
    // "50 MIN", "6 EXERCISES" — digits, so they hold their place as a card is
    // dragged and the numbers under it change.
    fontVariant: ['tabular-nums'],
  },
  // Everything named at 20: the heading over a section, the header of a pushed
  // view, a year in History, a routine's name in a cell, and the figures in the
  // rest-pace control.
  //
  // This was two roles for a day — a plain `title` for names read down a column
  // and a rounded `sectionTitle` for headings — on the theory that being read
  // and being looked at want different cuts. At 20pt they do not: the plain one
  // was used exactly once, and next to its rounded neighbours it read as an
  // oversight rather than a distinction.
  //
  // Rounded won because that is the one the app leans on. And `title` kept the
  // name because `sectionTitle` had already stopped being true — a figure
  // inside a control is not a section heading.
  title: {
    fontFamily: FONTS.rounded,
    fontWeight: WEIGHT.bold,
    fontSize: 20,
    letterSpacing: 0,
  },
  // The exercise being done, and the figures a finished workout comes to.
  heading: {
    fontFamily: FONTS.rounded,
    fontWeight: WEIGHT.medium,
    fontSize: 30,
    letterSpacing: 30 * 0.01,
  },
  // The routine's name on its card. Regular rather than medium: the card is
  // already a slab of colour and does not need the weight as well.
  routineCard: {
    fontFamily: FONTS.rounded,
    fontWeight: WEIGHT.regular,
    fontSize: 30,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  // A screen's own title — and the typed body weight on Settings, which used
  // to have a role of its own at 34 until it turned out to want exactly this.
  //
  // Proportional figures, like `hero`: see the note there. The body weight does
  // shuffle slightly as it is typed, which is the price, and at 32pt across
  // three digits it is small enough to accept.
  screenTitle: {
    fontFamily: FONTS.rounded,
    fontWeight: WEIGHT.bold,
    fontSize: 32,
    letterSpacing: 32 * -0.01,
  },
  figure: {
    fontFamily: FONTS.rounded,
    fontWeight: WEIGHT.bold,
    fontSize: 64,
    letterSpacing: 64 * -0.03,
    fontVariant: ['tabular-nums'],
  },
  // Proportional figures, deliberately, where every other numeric role is
  // tabular. Tabular forces each digit onto the same advance width, and at 82pt
  // the padding a 1 does not need is wide enough to read as a gap — which is
  // exactly what it looked like.
  //
  // The cost is that a figure shifts as its digits change, since this is a
  // number being edited rather than one sitting still. Accepted: the spacing is
  // visible all the time and the shuffle only while typing.
  //
  // `figure` on Stats stays tabular — it is a column of counters that should
  // line up with each other, and 64pt is small enough that the padding does not
  // show the same way.
  hero: {
    fontFamily: FONTS.rounded,
    fontWeight: WEIGHT.bold,
    fontSize: 82,
    letterSpacing: 82 * -0.01,
  },
}

// How far each role follows iOS text scaling before it stops.
//
// Spread onto a Text as props — `<Text {...CAP.label} style={styles.x}>` —
// because maxFontSizeMultiplier is a prop and not a style, so it cannot ride
// along inside the role the way size and tracking do. Explicit at the call
// site is the trade; grep for CAP to find every capped Text.
//
// The tiers, and why they differ:
//
// **Uncapped: body and caption.** These are what someone actually reads, and
// they are the reason the setting exists. A person who turns text up to 3x
// needs the prose at 3x. Both live in boxes that grow.
//
// **1.5x: control and label.** Buttons and small caps, always inside a box
// whose width is fixed by the layout around it. Past about 1.5 they wrap into
// two lines and the control stops looking like a control.
//
// **1.4x / 1.3x: title, screenTitle, heading, routineCard.** Names and
// headings. They start large, so a smaller multiplier still adds real size,
// and they sit in cells and bars that cannot reflow far.
//
// **1.2x: figure and hero.** `hero` is 82pt already. At 3.12x it is 256pt on a
// 390pt screen, which is not a layout problem to solve but a number nobody
// needs bigger — it is the largest thing on the screen at any setting.
//
// Never allowFontScaling={false} anywhere: that refuses the setting outright
// rather than bounding it.
export const CAP = {
  body: {},
  caption: {},
  control: { maxFontSizeMultiplier: 1.5 },
  label: { maxFontSizeMultiplier: 1.5 },
  title: { maxFontSizeMultiplier: 1.4 },
  screenTitle: { maxFontSizeMultiplier: 1.3 },
  heading: { maxFontSizeMultiplier: 1.3 },
  routineCard: { maxFontSizeMultiplier: 1.3 },
  routineCardMeta: { maxFontSizeMultiplier: 1.3 },
  figure: { maxFontSizeMultiplier: 1.2 },
  hero: { maxFontSizeMultiplier: 1.2 },
}

export const SPACE = { 1: 4, 2: 8, 3: 16, 4: 24, 5: 32, 6: 48 }

// Three shapes, which is all this app turns out to need: a chip, a card, and
// anything fully rounded. The app had twelve radius values, several of them
// one shape written four ways — see docs/design-tokens.json.
//
// Not every literal has moved onto these yet. What is left is the set where
// adopting the token would *change* the shape (a history cell at 8, the chart
// card at 16, the tab bar's 27 and 35), and those are a visible change rather
// than a rename, so they go one at a time with a look on the device.
export const RADIUS = { chip: 4, card: 12, pill: 999 }

export const NAV_HEIGHT = 52
// Breathing room between the floating tab bar and the system's bottom inset
// (gesture bar / home indicator), which is added on top of this.
export const NAV_FLOAT_GAP = 8

// How far a scrolling screen must clear the floating bar so its last item is
// not left underneath it. Screens add their own safe-area inset on top, the
// same way .app-main reserves room on the web.
export const TAB_BAR_CLEARANCE = NAV_HEIGHT + NAV_FLOAT_GAP
