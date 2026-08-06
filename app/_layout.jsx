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
