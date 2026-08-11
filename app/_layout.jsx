import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, useColorScheme } from 'react-native'

import { DARK, LIGHT } from '../src/theme/index.js'
import { ThemeProvider, readStoredThemeMode, useTheme } from '../src/theme/ThemeProvider.jsx'
import { seedExercisesIfEmpty } from '../src/db/exercises.js'
import { seedRoutinesIfEmpty } from '../src/db/routines.js'
import { LaunchProvider } from '../src/components/LaunchOverlay.jsx'

// The root of the app. One thing has to finish before anything renders:
// seeding, because the first screen reads the routines it adds.
//
// It used to wait on fonts too, and no longer does. The app is set entirely in
// SF Pro and SF Pro Rounded, which iOS already has — there is nothing to load,
// so there is no gap to hide and no flash of a fallback face to prevent.
//
// Routing mirrors the web app's split, and for the same reason: the tabbed
// screens live in (tabs) and share the floating tab bar, while a workout in
// progress sits outside them so it fills the display with no tab bar.
export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const [initialMode, setInitialMode] = useState('system')
  // What the phone is set to. Only used for the gate below, where the stored
  // preference is not known yet.
  const systemScheme = useColorScheme()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await seedExercisesIfEmpty()
      await seedRoutinesIfEmpty()
      // Joins the wait that was already happening rather than adding a second
      // one, so the app knows its scheme before it draws instead of opening
      // light and correcting itself.
      const mode = await readStoredThemeMode()
      if (!cancelled) {
        setInitialMode(mode)
        setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    // The one paint that cannot consult the stored preference, since reading
    // it is what we are waiting for. The phone's own scheme is the closest
    // guess available, and it is exactly right for the default of 'system'.
    return <View style={{ flex: 1, backgroundColor: systemScheme === 'dark' ? DARK.bg : LIGHT.bg }} />
  }

  return (
    <ThemeProvider initialMode={initialMode}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* The launch colour is provided above the navigator so it can cover
              the tab bar and everything else. See LaunchOverlay. */}
          <LaunchProvider>
            <ThemedStack />
          </LaunchProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  )
}

// Split out only so it sits inside the provider and can read the palette —
// screenOptions and the status bar both need it, and both are set here.
function ThemedStack() {
  const theme = useTheme()

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}
      >
      <Stack.Screen name="(tabs)" />
      {/* Pushed over the tabs from the right and dragged back the same
          way, so "back" is a movement rather than a button — which is
          what the web arranges by hand and the native stack gives for
          nothing. */}
      <Stack.Screen
        name="history"
        // `simple_push` rather than `slide_from_right`, because on iOS
        // the duration is only honoured for slide_from_bottom,
        // fade_from_bottom, fade and simple_push. Set against
        // slide_from_right it is ignored outright, which is why asking
        // for 450 and then 600 changed nothing at all.
        // `animationMatchesGesture` defaults to false, which means a
        // swipe back is completed by iOS at its own quick pace rather
        // than by the animation set here — so going in took 900ms and
        // coming out did not. On, the two are the same movement in
        // opposite directions.
        options={{
          animation: 'simple_push',
          // 600 rather than 900: this is navigation getting out of the
          // way, and 900 made it a performance. It is also the value
          // asked for back when the option was being ignored, so it is
          // the first time that instinct has actually been felt.
          animationDuration: 600,
          animationMatchesGesture: true,
        }}
      />
      {/* A workout is pushed over the tabs rather than living inside
          them, so it covers the tab bar. The colour already fills the
          screen before this navigates, and covers it again before it
          leaves, so the stack itself must not animate — its own
          transition would only fight the colour. */}
      <Stack.Screen
        name="workout/[sessionId]"
        options={{ presentation: 'fullScreenModal', animation: 'none' }}
      />
      </Stack>
    </>
  )
}
