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

export const SPACE = { 1: 4, 2: 8, 3: 16, 4: 24, 5: 32, 6: 48 }

export const NAV_HEIGHT = 52
// Breathing room between the floating tab bar and the system's bottom inset
// (gesture bar / home indicator), which is added on top of this.
export const NAV_FLOAT_GAP = 8

// How far a scrolling screen must clear the floating bar so its last item is
// not left underneath it. Screens add their own safe-area inset on top, the
// same way .app-main reserves room on the web.
export const TAB_BAR_CLEARANCE = NAV_HEIGHT + NAV_FLOAT_GAP
