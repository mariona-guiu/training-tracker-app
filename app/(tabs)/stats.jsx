import { useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { listCompletedSessions } from '../../src/db/sessions.js'
import { WeeklyChart } from '../../src/components/WeeklyChart.jsx'
import { addDays, buildWeeks, startOfDay, startOfWeek } from '../../src/data/weeks.js'
import { ScreenTitle, TITLE_CLEARANCE } from '../../src/components/ScreenTitle.jsx'
import { FONTS, LIGHT, SPACE, TAB_BAR_CLEARANCE } from '../../src/theme/index.js'

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
  return (
    <View style={styles.counter}>
      <Text style={styles.counterLabel}>{label}</Text>
      <Text style={styles.counterValue}>{value}</Text>
    </View>
  )
}

function ArrowIcon({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12h15m0 0l-6-6m6 6l-6 6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// TEMPORARY: long-press "My workouts" to preview this page against a few
// months of plausible training, without writing anything to the database.
// Copied verbatim from the web app's `/stats?mock` so the two can be compared
// against identical data — the chart's scale animation only shows when the
// busiest visible week changes, which a real install rarely does. Delete both
// copies together once Stats is settled.
// Hand-picked rather than drawn at random, because uniform randomness looks
// less human than this does: good stretches, a couple of quiet weeks, and one
// missed entirely. Index 0 is the current (partial) week.
//
// `typical` is the web app's own set, so the two charts can be put side by
// side. `dense` is here for the scale animation specifically: the segments
// only move when the busiest visible week changes, and how badly they move
// depends on how far it changes by. The 17 and the 12 sit among ones and twos
// so scrolling past them swings the scale as hard as it can swing.
const MOCK_COUNTS = {
  typical: [2, 4, 3, 5, 1, 4, 4, 0, 3, 6, 2, 4, 3, 5, 2, 0, 4, 3, 5, 1, 3],
  dense: [8, 11, 9, 14, 2, 17, 10, 1, 12, 16, 3, 9, 13, 6, 11, 2, 15, 7, 12, 4, 9],
}

function mockSessions(mode) {
  const routines = ['Upper Body', 'Lower Body', 'Glutes', 'Core', 'Full Body', 'Stretching']
  const WEEKLY_COUNTS = MOCK_COUNTS[mode]

  // Seeded so the preview looks the same on every render — otherwise it
  // reshuffles itself while you're looking at it.
  let seed = 20260730
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }

  const sessions = []
  const thisWeek = startOfWeek(Date.now())
  WEEKLY_COUNTS.forEach((count, weeksAgo) => {
    const weekStart = addDays(thisWeek, -7 * weeksAgo)
    // Distinct days, so a week of three workouts shows as three separate
    // days rather than doubling up on one. A dense week wants more workouts
    // than there are days, so the list repeats rather than being capped.
    const days = [0, 1, 2, 3, 4, 5, 6]
    for (let i = days.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[days[i], days[j]] = [days[j], days[i]]
    }
    Array.from({ length: count }, (_, i) => days[i % 7]).forEach((dayOfWeek, i) => {
      sessions.push({
        id: `mock-${weeksAgo}-${i}`,
        startedAt: addDays(weekStart, dayOfWeek) + 10 * 3600 * 1000,
        routineName: routines[Math.floor(random() * routines.length)],
      })
    })
  })
  return sessions
}

export default function Stats() {
  // null = still loading, [] = loaded and genuinely empty. Kept distinct so
  // the loading screen and the empty state are not confused with each other.
  const [sessions, setSessions] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  // TEMPORARY, with mockSessions above: null, then 'typical', then 'dense'.
  const [mock, setMock] = useState(null)
  const insets = useSafeAreaInsets()
  const router = useRouter()

  // Reloaded on focus rather than once: deleting a workout in History changes
  // what this page is counting, and this screen is never unmounted while that
  // happens.
  useFocusEffect(
    useCallback(() => {
      if (mock) setSessions(mockSessions(mock))
      else listCompletedSessions().then(setSessions)
    }, [mock]),
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
          paddingTop: insets.top + SPACE[4] + TITLE_CLEARANCE,
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
                {/* TEMPORARY: long-press cycles the mock training above. */}
                <Pressable
                  onLongPress={() =>
                    setMock((now) => (now === null ? 'typical' : now === 'typical' ? 'dense' : null))
                  }
                  delayLongPress={600}
                >
                  <Text style={styles.sectionTitle}>
                    My workouts{mock === 'typical' ? ' ·' : mock === 'dense' ? ' ··' : ''}
                  </Text>
                </Pressable>
                {/* Per-workout detail and earlier months live in History, a
                  view pushed over this one rather than a tab of its own. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="All past workouts"
                  onPress={() => router.push('/history')}
                  hitSlop={10}
                >
                  <ArrowIcon color={LIGHT.text} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: LIGHT.bg },
  counters: { flexDirection: 'row', gap: SPACE[2] },
  // Height, padding and radius as designed. The width is the one value not
  // taken literally: the mock's 168 is half a ~375 frame, so the pair already
  // spans the row — as equal flex they keep doing that on every phone instead
  // of leaving a strip of dead space on a wider one.
  counter: {
    flex: 1,
    height: 153,
    paddingTop: 21,
    paddingHorizontal: 19,
    paddingBottom: 30,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderRadius: 12,
    backgroundColor: LIGHT.bgRaised,
  },
  counterLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.66,
    color: LIGHT.text,
  },
  // Sized for three digits. No line height stated — Favorit's own is 1.249em
  // and anything below it clips, which is why the web's trick of trimming to
  // the cap height cannot be ported directly. See native/CLAUDE.md.
  counterValue: {
    fontFamily: FONTS.bold,
    fontSize: 56,
    color: LIGHT.text,
    // The gap under the figure is the card's 30 of padding plus the 17.5 of
    // descender depth Favorit reserves at this size and digits never use.
    // Half of the two together, pulled back.
    marginBottom: -24,
  },
  section: { gap: SPACE[2] },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE[2],
  },
  // Sentence case: this reads as a section of the page, not a label on it.
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    letterSpacing: -0.2,
    color: LIGHT.text,
  },
})
