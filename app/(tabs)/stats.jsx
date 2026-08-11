import { useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { listCompletedSessions } from '../../src/db/sessions.js'
import { WeeklyChart } from '../../src/components/WeeklyChart.jsx'
import { ChevronRightIcon } from '../../src/components/WorkoutIcons.jsx'
import { addDays, buildWeeks, startOfDay } from '../../src/data/weeks.js'
import { ScreenTitle, useTitleMetrics } from '../../src/components/ScreenTitle.jsx'
import { CAP, RADIUS, SPACE, SYSTEM_DESCENT, TAB_BAR_CLEARANCE, TYPE } from '../../src/theme/index.js'
import { useTheme, useThemedStyles } from '../../src/theme/ThemeProvider.jsx'

// What the font reserves below the baseline at `figure` size and a row of
// digits never uses. Derived rather than stated, because it has had to move
// every time anything underneath it did: 17.5 under Favorit, 14 under Funnel,
// and now 13.5 — a smaller descent on a larger figure. See the note on line
// heights in native/CLAUDE.md.
const FIGURE_DESCENDER = SYSTEM_DESCENT * TYPE.figure.fontSize

function monthsBefore(ts, months) {
  const d = new Date(ts)
  d.setMonth(d.getMonth() - months)
  return d.getTime()
}

// Both counters are rolling windows back from today rather than calendar
// periods: "last 30 days" answers what you have been doing lately, which a
// calendar month cannot on the 2nd.
function countSince(sessions, from) {
  return sessions.filter((s) => s.startedAt >= from).length
}

// Three digits is enough by construction rather than by capping: 999 workouts
// a year is 2.7 every single day, and training twice daily without a rest day
// all year only reaches 730. The card is laid out for three so a big year
// does not reflow it.
function Counter({ label, value }) {
  const styles = useThemedStyles(makeStyles)

  return (
    <View style={styles.counter}>
      <Text {...CAP.label} style={styles.counterLabel}>{label}</Text>
      <Text {...CAP.figure} style={styles.counterValue}>
        {value}
      </Text>
    </View>
  )
}

export default function Stats() {
  // null = still loading, [] = loaded and genuinely empty. Kept distinct so
  // the loading screen and the empty state are not confused with each other.
  const [sessions, setSessions] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const theme = useTheme()
  const styles = useThemedStyles(makeStyles)
  const title = useTitleMetrics()

  // Two ways in — the words and the chevron — and a tap on either takes a
  // moment to commit. A second tap inside that moment used to push History
  // twice, leaving two identical views to come back through.
  //
  // Latched rather than debounced by a timer: a timer has to guess how long
  // the push takes, and would still be wrong on a slow launch. This reopens
  // when the screen is focused again, which is exactly when another push is
  // due to be allowed.
  const pushing = useRef(false)
  const openHistory = useCallback(() => {
    if (pushing.current) return
    pushing.current = true
    router.push('/history')
  }, [router])

  // Reloaded on focus rather than once: deleting a workout in History changes
  // what this page is counting, and this screen is never unmounted while that
  // happens.
  useFocusEffect(
    useCallback(() => {
      pushing.current = false
      listCompletedSessions().then(setSessions)
    }, []),
  )

  const stats = useMemo(() => {
    if (!sessions) return null
    const now = Date.now()
    return {
      // 29 days back from the start of today, so the window is 30 whole days
      // including this one.
      last30: countSince(sessions, addDays(startOfDay(now), -29)),
      last12: countSince(sessions, monthsBefore(now, 12)),
      weeks: buildWeeks(sessions, now),
    }
  }, [sessions])

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Stats" scrolled={scrolled} top={insets.top + SPACE[4]} />
      <ScrollView
        scrollEventThrottle={32}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        contentContainerStyle={{
          paddingTop: insets.top + SPACE[4] + title.clearance,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + SPACE[4],
          paddingHorizontal: SPACE[3],
          gap: SPACE[4],
        }}
      >
        {/* No empty state of its own: with nothing logged the counters read 0
            and the chart draws eight empty weeks, which says the same thing
            without a separate screen to maintain. */}
        {stats ? (
          <>
            <View style={styles.counters}>
              <Counter label="Last 30 days" value={stats.last30} />
              <Counter label="Last 12 months" value={stats.last12} />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="All past workouts"
                  onPress={openHistory}
                  hitSlop={10}
                >
                  <Text {...CAP.title} style={styles.sectionTitle}>My workouts</Text>
                </Pressable>
                {/* Per-workout detail and earlier months live in History, a
                  view pushed over this one rather than a tab of its own. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="All past workouts"
                  onPress={openHistory}
                  hitSlop={10}
                >
                  <ChevronRightIcon size={22} color={theme.text} />
                </Pressable>
              </View>
              <WeeklyChart weeks={stats.weeks} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const makeStyles = (t) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  counters: { flexDirection: 'row', gap: SPACE[2] },
  // Height and radius as designed; the padding has been moved onto the
  // spacing scale — 21/19/30 became 24/16/24, which is a deliberate change
  // to the design rather than a rounding of it. The width is the one value
  // that was never literal: the mock's 168 is half a ~375 frame, so the pair
  // already spans the row — as equal flex they keep doing that on every
  // phone instead of leaving a strip of dead space on a wider one.
  counter: {
    flex: 1,
    // minHeight, not height. At 1.17x text — one step above the default — the
    // label and the figure together no longer fit 153 and the figure was
    // clipped. A floor lets the card grow with whatever the reader has asked
    // for; at the default nothing moves, since the content comes to 137.
    minHeight: 153,
    paddingTop: SPACE[4],
    paddingHorizontal: SPACE[3],
    paddingBottom: SPACE[4],
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderRadius: RADIUS.card,
    backgroundColor: t.bgRaised,
  },
  counterLabel: { ...TYPE.label, color: t.text },
  // Sized for three digits. No line height stated — the font's own is 1.25em
  // and anything below it clips, which is why the web's trick of trimming to
  // the cap height cannot be ported directly. See native/CLAUDE.md.
  counterValue: {
    ...TYPE.figure,
    color: t.text,
    // The gap under the figure is the card's bottom padding plus the depth
    // the font reserves for descenders at this size, which digits never use.
    // Half of the two together, pulled back — written as the sum rather than
    // as -24, so that moving the padding onto the scale moved this with it
    // instead of leaving the figure sitting wrong.
    marginBottom: -(SPACE[4] + FIGURE_DESCENDER) / 2,
  },
  section: { gap: SPACE[2] },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE[2],
  },
  // Sentence case: this reads as a section of the page, not a label on it.
  // `title` sets the size and tracking; the weight is the screen's choice.
  // 20 carries two jobs in this app — a section heading in bold here, an
  // object's own name in medium on a history cell — and that is a real
  // difference rather than a drift, so the role does not fix the weight.
  sectionTitle: { ...TYPE.title, color: t.text },
})
