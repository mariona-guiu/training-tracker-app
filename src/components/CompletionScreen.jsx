import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeIn } from 'react-native-reanimated'
import { StatusBar } from 'expo-status-bar'

import { Confetti } from './Confetti.jsx'
import { caloriesFor, KCAL_DISCLAIMER } from '../data/calories.js'
import { useRoutineColours } from '../theme/ThemeProvider.jsx'
import { WORKOUT_CONTENT_FADE } from '../data/motion.js'
import {
  CAP,
  LIGHT,
  RADIUS,
  SPACE,
  SYSTEM_ASCENT,
  SYSTEM_CAP,
  SYSTEM_DESCENT,
  SYSTEM_LINE,
  TYPE,
} from '../theme/index.js'

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

const targetSetCount = (session) => session.exercises.reduce((n, ex) => n + ex.targetSets, 0)

// An exercise counts as done the moment one set is logged — the same
// threshold that decides whether the session is worth keeping at all.
const isDone = (exercise) => exercise.sets.some((set) => set.done)

export function CompletionScreen({ session, colour, ink, onSeeHistory, onAgain }) {
  const insets = useSafeAreaInsets()
  const { washFor } = useRoutineColours()
  const kcal = caloriesFor(session)
  const logged = loggedSetCount(session)
  const done = session.exercises.filter(isDone).length

  return (
    <View style={[styles.screen, { backgroundColor: colour }]}>
      {/* LIGHT.onInk as the constant '#ffffff', not as a theme lookup: the ink
          is weighed against the *routine's* colour, which does not follow the
          app's scheme, so this must not either. Same idiom as the workout
          screen's inkIsLight. */}
      <StatusBar style={ink === LIGHT.onInk ? 'light' : 'dark'} />
      <Confetti />

      <Animated.View
        entering={FadeIn.duration(WORKOUT_CONTENT_FADE.duration)}
        style={[
          styles.content,
          { paddingTop: insets.top + SPACE[3], paddingBottom: insets.bottom + SPACE[3] },
        ]}
      >
        <Text {...CAP.label} style={[styles.routine, { color: ink }]}>
          {session.routineName} workout
        </Text>

        <View style={styles.body}>
          <Text {...CAP.heading} style={[styles.title, { color: ink }]}>
            Nice work!
          </Text>
          <View style={styles.timeRow}>
            <Text {...CAP.hero} style={[styles.time, { color: ink }]}>
              {formatDuration(session.endedAt - session.startedAt)}
            </Text>
            <Text {...CAP.label} style={[styles.caption, { color: ink }]}>
              Total time
            </Text>
          </View>
          <Text {...CAP.screenTitle} style={[styles.stats, { color: ink }]}>
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
          <Pressable onPress={onSeeHistory} style={[styles.primary, { backgroundColor: ink }]}>
            <Text {...CAP.control} style={[styles.primaryLabel, { color: colour }]}>
              See completed workouts
            </Text>
          </Pressable>
          <Pressable
            onPress={onAgain}
            style={[
              styles.secondary,
              { backgroundColor: washFor(session.routineType ?? session.routineName) },
            ]}
          >
            <Text {...CAP.control} style={[styles.primaryLabel, { color: ink }]}>
              Do another workout
            </Text>
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
// is applied: what the font drops below a baseline at `hero` size — 17.3pt in
// SF Pro — and what a 40pt line box leaves above capitals at `heading` size.
// Both come from SYSTEM_* rather than from any one typeface, so they followed
// when the face changed and this note did not.
const STATS_CAP_GAP = 33.6
const FIGURE_DESCENT = SYSTEM_DESCENT * TYPE.hero.fontSize
const STATS_LINE = 40
const STATS_CAP_INSET =
  (STATS_LINE - SYSTEM_LINE * TYPE.screenTitle.fontSize) / 2 +
  (SYSTEM_ASCENT - SYSTEM_CAP) * TYPE.screenTitle.fontSize

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: SPACE[4] },
  routine: { ...TYPE.label },
  // The same room the exercise had during the workout, so nothing moves
  // underneath you when the screen changes what it says.
  body: { flex: 1, justifyContent: 'center', gap: SPACE[2] },
  // No line height stated anywhere here: the font's own is 1.25em and
  // anything below it clips. See native/CLAUDE.md.
  title: { ...TYPE.heading, marginBottom: SPACE[2] },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE[2] },
  time: { ...TYPE.hero },
  // It was white, spelled out as caption plus medium plus uppercase — which
  // is `label`, written the long way. White was right when it was specified
  // and wrong once seen: on a pale routine the ink is near-black and a white
  // label beside a near-black figure reads as a mistake. It takes the ink now,
  // like everything else on the screen.
  caption: { ...TYPE.label },
  // One block with a stated line height: three lines a fixed distance apart,
  // not small print with a large gap. STATS_LINE sits above what SF Pro spends
  // on a line at this size, so stating it cannot clip anything.
  //
  // The margin is negative because the two line boxes already spend more
  // between the figure and these than the design leaves. Written as the
  // difference rather than as a number, which is what let the size change here
  // without anything else being touched.
  stats: {
    ...TYPE.screenTitle,
    lineHeight: STATS_LINE,
    marginTop: STATS_CAP_GAP - FIGURE_DESCENT - SPACE[2] - STATS_CAP_INSET,
  },
  actions: { gap: SPACE[2] },
  primary: {
    minHeight: 52,
    paddingVertical: SPACE[2],
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE[3],
  },
  secondary: {
    minHeight: 52,
    paddingVertical: SPACE[2],
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE[3],
  },
  primaryLabel: { ...TYPE.control },
  // A footnote qualifying the figure above, not a caution about it.
  note: {
    ...TYPE.caption,
    textAlign: 'center',
    marginTop: SPACE[3],
  },
})
