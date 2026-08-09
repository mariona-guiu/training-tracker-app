import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeIn } from 'react-native-reanimated'
import { StatusBar } from 'expo-status-bar'

import { Confetti } from './Confetti.jsx'
import { caloriesFor, KCAL_DISCLAIMER } from '../data/calories.js'
import { washFor } from '../data/routineStyles.js'
import { WORKOUT_CONTENT_FADE } from '../data/motion.js'
import { FONTS, LIGHT, RADIUS, SPACE, TYPE } from '../theme/index.js'

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
      <StatusBar style={ink === LIGHT.onInk ? 'light' : 'dark'} />
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
            <Text style={styles.caption}>Total time</Text>
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
            style={[styles.primary, { backgroundColor: ink }]}
          >
            <Text style={[styles.primaryLabel, { color: colour }]}>See completed workouts</Text>
          </Pressable>
          <Pressable
            onPress={onAgain}
            style={[styles.secondary, { backgroundColor: washFor(session.routineType ?? session.routineName) }]}
          >
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

// What the design leaves between the bottom of the figure's capitals and the
// top of the tallies', and the two things the fonts spend before any margin
// is applied: what Funnel drops below a baseline at `hero` size, and what a
// 40pt line box leaves above capitals at `heading` size.
const STATS_CAP_GAP = 33.6
const FIGURE_DESCENT = 0.25 * TYPE.hero.fontSize
const STATS_CAP_INSET = (40 - 1.25 * TYPE.heading.fontSize) / 2 + 0.325 * TYPE.heading.fontSize

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: SPACE[4] },
  routine: { ...TYPE.caption, textTransform: 'uppercase', opacity: 0.85 },
  // The same room the exercise had during the workout, so nothing moves
  // underneath you when the screen changes what it says.
  body: { flex: 1, justifyContent: 'center', gap: SPACE[2] },
  // No line height stated anywhere here: the font's own is 1.25em and
  // anything below it clips. See native/CLAUDE.md.
  title: { ...TYPE.heading, marginBottom: SPACE[2] },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE[2] },
  time: { ...TYPE.hero },
  // White rather than the routine's ink, and at full strength: it labels the
  // figure beside it and is not a footnote to it.
  caption: {
    ...TYPE.caption,
    fontFamily: FONTS.medium,
    textTransform: 'uppercase',
    color: LIGHT.onInk,
  },
  // One block with a stated line height, which is what the design asks for
  // and what an earlier reading of it got wrong: three lines 40 apart, not
  // small print with a large gap. 40 sits above Funnel's own 37.5 at this
  // size, so stating it cannot clip anything.
  //
  // The margin is negative because the two line boxes already spend more
  // between the figure and these than the design leaves: 20.5 below the
  // figure's baseline at 82pt, 11 above these capitals inside a 40 box, and
  // the body's own 8 between them — 39.5 where the design wants 33.6. Written
  // as the difference rather than as -6, so it follows if either size moves.
  stats: {
    ...TYPE.heading,
    lineHeight: 40,
    marginTop: STATS_CAP_GAP - FIGURE_DESCENT - SPACE[2] - STATS_CAP_INSET,
  },
  actions: { gap: SPACE[2] },
  primary: {
    height: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE[3],
  },
  secondary: {
    height: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE[3],
  },
  primaryLabel: { ...TYPE.control },
  // A footnote qualifying the figure above, not a caution about it.
  note: {
    ...TYPE.caption,
    fontFamily: FONTS.light,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: SPACE[3],
  },
})
