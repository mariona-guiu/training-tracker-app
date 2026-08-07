import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeIn } from 'react-native-reanimated'
import { StatusBar } from 'expo-status-bar'

import { Confetti } from './Confetti.jsx'
import { caloriesFor, KCAL_DISCLAIMER } from '../data/calories.js'
import { WORKOUT_CONTENT_FADE } from '../data/motion.js'
import { FONTS, SPACE } from '../theme/index.js'

// What a finished workout leaves you with.
//
// It wears the routine's colour, the same one the workout was done in, so
// finishing is a change of what the screen says rather than a change of
// screen. The greeting lands where the exercise name was and the time where
// the reps were.

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const loggedSetCount = (session) =>
  session.exercises.reduce((n, ex) => n + ex.sets.filter((set) => set.done).length, 0)

const targetSetCount = (session) =>
  session.exercises.reduce((n, ex) => n + ex.targetSets, 0)

// An exercise counts as done the moment one set is logged — the same
// threshold that decides whether the session is worth keeping at all.
const isDone = (exercise) => exercise.sets.some((set) => set.done)

export function CompletionScreen({ session, colour, ink, onSeeHistory, onAgain }) {
  const insets = useSafeAreaInsets()
  const kcal = caloriesFor(session)
  const logged = loggedSetCount(session)
  const done = session.exercises.filter(isDone).length

  return (
    <View style={[styles.screen, { backgroundColor: colour }]}>
      <StatusBar style={ink === '#ffffff' ? 'light' : 'dark'} />
      <Confetti />

      <Animated.View
        entering={FadeIn.duration(WORKOUT_CONTENT_FADE.duration)}
        style={[
          styles.content,
          { paddingTop: insets.top + SPACE[3], paddingBottom: insets.bottom + SPACE[3] },
        ]}
      >
        <Text style={[styles.routine, { color: ink }]}>{session.routineName} workout</Text>

        <View style={styles.body}>
          <Text style={[styles.title, { color: ink }]}>Nice work!</Text>
          <View style={styles.timeRow}>
            <Text style={[styles.time, { color: ink }]}>
              {formatDuration(session.endedAt - session.startedAt)}
            </Text>
            <Text style={[styles.caption, { color: ink }]}>Total time</Text>
          </View>
          <Text style={[styles.stats, { color: ink }]}>
            {logged}/{targetSetCount(session)} sets{'\n'}
            {done}/{session.exercises.length} exercises
            {/* Left out entirely without a body weight to reckon it against —
                there is no honest figure to put here. */}
            {kcal !== null ? `\n~${kcal}kcal*` : ''}
          </Text>
        </View>

        <View style={styles.actions}>
          {/* Filled with the ink colour, so its label has to be the routine's
              colour to stay readable. */}
          <Pressable
            onPress={onSeeHistory}
            style={[styles.primary, { backgroundColor: ink, borderColor: ink }]}
          >
            <Text style={[styles.primaryLabel, { color: colour }]}>See completed workouts</Text>
          </Pressable>
          <Pressable onPress={onAgain} style={[styles.primary, { borderColor: ink }]}>
            <Text style={[styles.primaryLabel, { color: ink }]}>Do another workout</Text>
          </Pressable>
          {kcal !== null ? (
            <Text style={[styles.note, { color: ink }]}>{KCAL_DISCLAIMER}</Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: SPACE[4] },
  routine: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.88,
    opacity: 0.85,
  },
  // The same room the exercise had during the workout, so nothing moves
  // underneath you when the screen changes what it says.
  body: { flex: 1, justifyContent: 'center', gap: SPACE[2] },
  // No line height stated anywhere here: Favorit's own is 1.249em and
  // anything below it clips. See native/CLAUDE.md.
  title: { fontFamily: FONTS.bold, fontSize: 40, marginBottom: SPACE[2] },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE[2] },
  time: { fontFamily: FONTS.bold, fontSize: 76, letterSpacing: -2.28 },
  caption: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.88,
    opacity: 0.7,
  },
  stats: { fontFamily: FONTS.bold, fontSize: 30, marginTop: SPACE[4] },
  actions: { gap: SPACE[2] },
  primary: {
    height: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE[3],
  },
  primaryLabel: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  // A footnote qualifying the figure above, not a caution about it.
  note: { fontFamily: FONTS.regular, fontSize: 10, textAlign: 'center', opacity: 0.7, marginTop: SPACE[3] },
})
