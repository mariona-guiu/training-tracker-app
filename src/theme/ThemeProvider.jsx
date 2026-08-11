import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'

import { DARK, LIGHT } from './index.js'
import * as routines from '../data/routineStyles.js'
import { getSettings, saveSettings } from '../db/settings.js'

// Which palette a screen gets, and how a screen asks for it.
//
// The web app re-points CSS custom properties and every rule built on them
// follows for nothing. React Native has no cascade, and — the part that
// actually decides the shape of this file — `StyleSheet.create` runs *once*,
// at import. A stylesheet that names LIGHT.text has baked that colour in
// before the app has read a single preference, and no amount of re-rendering
// will change it.
//
// So a themed screen cannot hold its styles in a module constant. It holds a
// *factory* instead, and calls it through useThemedStyles, which memoises on
// the palette so the sheet is rebuilt when the theme changes and at no other
// time.

const ThemeContext = createContext(null)

// 'system' is the default: an app that quietly disagrees with the phone it is
// on is the thing people notice, and it is what iOS itself does.
export const THEME_MODES = ['system', 'light', 'dark']

export function ThemeProvider({ children, initialMode = 'system' }) {
  const [mode, setModeState] = useState(initialMode)
  const systemScheme = useColorScheme()

  const setMode = useCallback((next) => {
    // Applied immediately and written behind: the switch is the whole point of
    // the control, and it should not wait on SQLite to redraw.
    setModeState(next)
    saveSettings({ themeMode: next })
  }, [])

  const value = useMemo(() => {
    const resolved = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode
    return { theme: resolved === 'dark' ? DARK : LIGHT, mode, setMode }
  }, [mode, systemScheme, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// The palette. What almost every caller wants.
export function useTheme() {
  const value = useContext(ThemeContext)
  // Falling back to LIGHT rather than throwing keeps a component renderable
  // outside the provider — which is what the launch gate does before the
  // stored mode has been read.
  return value ? value.theme : LIGHT
}

// The preference itself, for the one screen that sets it.
export function useThemeMode() {
  const value = useContext(ThemeContext)
  return value ? { mode: value.mode, setMode: value.setMode } : { mode: 'system', setMode: () => {} }
}

// How a screen holds its styles. `makeStyles` takes the palette and returns
// the object StyleSheet.create used to be handed directly:
//
//   const makeStyles = (t) => StyleSheet.create({ screen: { backgroundColor: t.bg } })
//   ...
//   const s = useThemedStyles(makeStyles)
//
// Define the factory at module scope, not inside the component — a new
// function identity every render would rebuild the sheet every render, which
// is exactly what the memo is here to avoid.
export function useThemedStyles(makeStyles) {
  const theme = useTheme()
  return useMemo(() => makeStyles(theme), [makeStyles, theme])
}

// A routine's colour is neither a token nor scheme-independent — it is
// identity, and it is a different hex in each scheme. The functions in
// data/routineStyles.js therefore take the scheme first; this binds it, so a
// screen calls styleFor(kind, index) exactly as it always did.
//
// Bound rather than passed at each site because the alternative is ~20 call
// sites each threading theme.scheme through by hand, and one of them being
// forgotten is a screen quietly wearing the wrong palette.
export function useRoutineColours() {
  const { scheme } = useTheme()

  return useMemo(
    () => ({
      styleFor: (name, index) => routines.styleFor(scheme, name, index),
      inkFor: (name, index) => routines.inkFor(scheme, name, index),
      restTintFor: (name, index) => routines.restTintFor(scheme, name, index),
      paleFor: (name, index) => routines.paleFor(scheme, name, index),
      washFor: (name, index) => routines.washFor(scheme, name, index),
      routineColours: routines.routineColours(scheme),
    }),
    [scheme],
  )
}

// Read once at launch, before anything paints, so the app does not open in the
// wrong scheme and correct itself. Exported rather than done inside the
// provider because the root layout is already waiting on seeding, and this
// joins that wait instead of adding a second one.
export async function readStoredThemeMode() {
  try {
    const settings = await getSettings()
    return THEME_MODES.includes(settings.themeMode) ? settings.themeMode : 'system'
  } catch {
    // A preference is not worth failing to launch over.
    return 'system'
  }
}
