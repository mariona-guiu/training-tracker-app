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

export const DARK = {
  bg: '#0a0a0a',
  bgRaised: '#161616',
  border: '#2e2e2e',
  text: '#f5f5f2',
  textDim: '#8a8a86',
  accent: '#c6ff3d',
  accentText: '#0a0a0a',
  danger: '#ff4d4d',
  // A header the page scrolls behind: the page's own colour, thinned, with
  // the content underneath blurred through it.
  surfaceFloating: 'rgba(10, 10, 10, 0.66)',
  // A card sitting on the page: the raised colour at half strength, so it
  // reads as a tint of the page rather than a panel laid over it.
  surfaceCard: 'rgba(22, 22, 22, 0.5)',
  scheme: 'dark',
}

export const LIGHT = {
  ...DARK,
  bg: '#fdfdfc',
  // Taken from the Stats design, and the same card colour Settings already
  // draws — the two screens had drifted a step apart from each other.
  bgRaised: '#f7f7f6',
  border: '#e3e3de',
  text: '#0a0a0a',
  textDim: '#6f6f6a',
  surfaceFloating: 'rgba(253, 253, 252, 0.72)',
  surfaceCard: 'rgba(247, 247, 246, 0.5)',
  scheme: 'light',
}

// Two roles the palette was missing, which every screen had been spelling out
// by hand: what sits on top of a filled dark surface, and the unfilled half of
// a control. Named here so a second toggle cannot invent its own grey.
LIGHT.onInk = '#ffffff'
LIGHT.controlTrack = '#d9d9d7'
DARK.onInk = '#0a0a0a'
DARK.controlTrack = '#2e2e2e'

// Favorit throughout: weight does the differentiating, and the mono cut
// covers tabular numbers. These names are what the font loader registers, so
// the two have to agree.
export const FONTS = {
  light: 'Favorit-Light',
  regular: 'Favorit-Regular',
  medium: 'Favorit-Medium',
  bold: 'Favorit-Bold',
  mono: 'Favorit-Mono',
  italic: 'Favorit-Italic',
  mediumItalic: 'Favorit-MediumItalic',
  lightItalic: 'Favorit-LightItalic',
}

// The type scale. Nine roles, each taken from the size already doing that job
// rather than invented, and named for the job so a screen picks a role instead
// of a number.
//
// Tracking is written as `size * ratio`, never as a bare value, because that is
// the rule the app already half-followed: uppercase mono opens up (+2% small,
// +8% for controls), display tightens (-1% to -3%). Stating it as a ratio means
// changing a size cannot silently change how tight the text reads. Three of
// these — label, figureInline, hero — come out at exactly the values already in
// the code, which is what says the rule was there before it was written down.
//
// No lineHeight above `note`: React Native clips text to its line box where CSS
// lets it spill, and Favorit's own is 1.249em, so anything tighter cuts the tops
// off numerals. Recover tightness with margins, which do not clip.
export const TYPE = {
  label: { fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 12 * 0.02, textTransform: 'uppercase' },
  note: { fontFamily: FONTS.light, fontSize: 13, lineHeight: 19 },
  body: { fontFamily: FONTS.regular, fontSize: 16 },
  control: { fontFamily: FONTS.mono, fontSize: 16, letterSpacing: 16 * 0.08, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.medium, fontSize: 20, letterSpacing: 20 * -0.01 },
  // An inline figure — a number sitting inside a card rather than owning the
  // screen. Kept as a role after the first attempt to retire it: body weight
  // cannot be `figure`, because the card is not tall enough to hold 56.
  figureInline: { fontFamily: FONTS.bold, fontSize: 34, letterSpacing: 34 * -0.02 },
  screenTitle: { fontFamily: FONTS.medium, fontSize: 40, letterSpacing: 40 * -0.02 },
  figure: { fontFamily: FONTS.bold, fontSize: 56, letterSpacing: 56 * -0.02 },
  hero: { fontFamily: FONTS.bold, fontSize: 72, letterSpacing: 72 * -0.03 },
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
