import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View } from 'react-native'

import { useAppFonts } from '../src/theme/fonts.js'
import { LIGHT } from '../src/theme/index.js'
import { seedExercisesIfEmpty } from '../src/db/exercises.js'
import { seedRoutinesIfEmpty } from '../src/db/routines.js'
import { LaunchProvider } from '../src/components/LaunchOverlay.jsx'

// The root of the app. Two things have to finish before anything renders:
// the fonts, because text laid out in the fallback and then reflowed is
// visible and cheap to avoid, and seeding, because the first screen reads the
// routines it adds.
//
// Routing mirrors the web app's split, and for the same reason: the tabbed
// screens live in (tabs) and share the floating tab bar, while a workout in
// progress sits outside them so it fills the display with no tab bar.
export default function RootLayout() {
  const { loaded, error } = useAppFonts()
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await seedExercisesIfEmpty()
      await seedRoutinesIfEmpty()
      if (!cancelled) setSeeded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if ((!loaded && !error) || !seeded) {
    return <View style={{ flex: 1, backgroundColor: LIGHT.bg }} />
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {/* The launch colour is provided above the navigator so it can cover
            the tab bar and everything else. See LaunchOverlay. */}
        <LaunchProvider>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: LIGHT.bg } }}
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
        </LaunchProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
