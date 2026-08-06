import { useCallback, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { listRoutines } from '../../src/db/routines.js'
import { startSession, getActiveSession } from '../../src/db/sessions.js'
import { CANONICAL_ORDER, styleFor, inkFor } from '../../src/data/routineStyles.js'
import { originFrom, useLaunch } from '../../src/components/LaunchOverlay.jsx'
import { FONTS, LIGHT, SPACE, TAB_BAR_CLEARANCE } from '../../src/theme/index.js'

// The Workouts screen. The card canvas itself is still to be ported — this
// list is a stand-in — but tapping a card already does the real thing: the
// routine's colour grows out of it and becomes the workout screen.
export default function Workouts() {
  const [routines, setRoutines] = useState([])
  const insets = useSafeAreaInsets()
  const screen = useWindowDimensions()
  const router = useRouter()
  const { beginLaunch, endLaunch } = useLaunch()
  const cards = useRef({})
  const launching = useRef(false)

  // Reloads on every focus rather than once on mount: coming back from a
  // finished workout, this screen is still mounted.
  useFocusEffect(
    useCallback(() => {
      launching.current = false
      listRoutines().then((rows) =>
        setRoutines(
          [...rows].sort(
            (a, b) => CANONICAL_ORDER.indexOf(a.type) - CANONICAL_ORDER.indexOf(b.type),
          ),
        ),
      )
    }, []),
  )

  function start(routine, index) {
    if (launching.current) return
    launching.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const colour = styleFor(routine.name, index).background
    // The session is created while the colour is still expanding, so the
    // database write never shows up as a delay before the tap responds.
    const pending = (async () => (await getActiveSession()) ?? startSession(routine))()

    async function arrive() {
      let session
      try {
        session = await pending
      } catch (error) {
        // A failure here would otherwise strand the screen: the colour has
        // already filled it and there is nothing to navigate to, so it
        // simply stays. Better to retreat than to hang with no way out.
        console.error('Could not start the workout', error)
        launching.current = false
        endLaunch()
        return
      }
      // The colour is handed over as a parameter so the workout screen is
      // already wearing it on its very first frame, rather than having to
      // load the session to look it up.
      router.push({
        pathname: '/workout/[sessionId]',
        // Without the leading '#': the colour travels as a URL parameter,
        // and a hash there is a fragment delimiter, not part of the value.
        params: { sessionId: session.id, color: colour.replace('#', '') },
      })
      endLaunch()
    }

    const card = cards.current[routine.id]
    if (!card) {
      arrive()
      return
    }
    card.measureInWindow((x, y, width, height) => {
      beginLaunch({
        from: originFrom({ x, y, width, height }, screen),
        color: colour,
        onArrived: arrive,
      })
    })
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{
        paddingTop: insets.top + SPACE[4],
        paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + SPACE[4],
        paddingHorizontal: SPACE[3],
        gap: SPACE[3],
      }}
    >
      <Text style={styles.title}>Workouts</Text>

      {routines.map((routine, index) => {
        const ink = inkFor(routine.name, index)
        return (
          <Pressable
            key={routine.id}
            ref={(node) => {
              cards.current[routine.id] = node
            }}
            accessibilityRole="button"
            accessibilityLabel={`Start ${routine.name} workout`}
            onPress={() => start(routine, index)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: styleFor(routine.name, index).background },
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={[styles.cardTitle, { color: ink }]}>{routine.name}</Text>
            <Text style={[styles.cardMeta, { color: ink }]}>{routine.slots.length} exercises</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: LIGHT.bg },
  title: { fontFamily: FONTS.medium, fontSize: 20, color: LIGHT.text },
  card: { borderRadius: 8, padding: SPACE[4], gap: SPACE[1] },
  cardPressed: { opacity: 0.92 },
  cardTitle: { fontFamily: FONTS.medium, fontSize: 24 },
  cardMeta: { fontFamily: FONTS.regular, fontSize: 14, opacity: 0.8 },
})
