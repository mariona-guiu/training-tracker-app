import { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated'

import { inkFor, styleFor } from '../data/routineStyles.js'
import { VISIBLE_WEEKS, yearOfWeek } from '../data/weeks.js'
import { FONTS, LIGHT, SPACE } from '../theme/index.js'

// How long a finger has to stay put before the press is read as "show me this
// workout" rather than the beginning of a scroll. Short enough to feel
// immediate, long enough that a flick never triggers it.
const HOLD_MS = 200

const TRACK_HEIGHT = 230
const TRACK_WIDTH = 9

const DAY = (ts) => {
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, '0')}/${d.getMonth() + 1}`
}

// 5pt between capsules, until that stops being affordable. The gaps come out
// of the track before the segments divide up what is left, so at a fixed 5 a
// busy enough week spends the whole column on gaps: forty workouts is 195pt
// of gap in a 230pt track, and every segment in the chart collapses to under
// a point — not only that week's, since they all share one scale. Capped at a
// quarter of each segment's share, the gap gives way as the column fills.
function gapFor(rows) {
  'worklet'
  return Math.min(5, TRACK_HEIGHT / rows / 4)
}

function segmentHeight(rows) {
  'worklet'
  return (TRACK_HEIGHT - (rows - 1) * gapFor(rows)) / rows
}

// One workout in a week's column. Its height comes from the busiest week
// currently on screen, so that week fills its column exactly and every other
// is read as a fraction of it — which means a column's height is only
// comparable within one screenful. That is the trade for never wasting the
// card on a quiet stretch.
function Segment({ workout, rows, dimmed, last }) {
  const style = useAnimatedStyle(() => ({
    height: segmentHeight(rows.value),
    marginBottom: last ? 0 : gapFor(rows.value),
  }))

  return (
    <Animated.View
      style={[
        styles.segment,
        { backgroundColor: styleFor(workout.routineName).background },
        dimmed && styles.segmentDimmed,
        style,
      ]}
    />
  )
}

export function WeeklyChart({ weeks }) {
  const [columnWidth, setColumnWidth] = useState(0)
  const [reading, setReading] = useState(null)
  const scrollX = useRef(0)
  const trackTop = useRef(0)
  const scroller = useRef(null)

  // What the card is showing: the span of fully visible columns, and the
  // busiest of them. Seeded from the last VISIBLE_WEEKS rather than a
  // placeholder, because that is exactly where the chart opens — guessing and
  // correcting made the columns grow into place every time this screen was
  // returned to.
  const [view, setView] = useState(() => {
    const first = Math.max(0, weeks.length - VISIBLE_WEEKS)
    const last = Math.max(0, weeks.length - 1)
    let rows = 1
    for (let i = first; i <= last; i++) rows = Math.max(rows, weeks[i].workouts.length)
    return { first, last, rows }
  })

  // Mirrored where the animation can read it. The scale changing under your
  // finger is worth animating, so this eases rather than jumping.
  const rows = useSharedValue(view.rows)
  // What the scale was last *told* to become, which is not the same as what
  // it currently is: mid-animation the shared value is somewhere between the
  // two, so comparing against it re-fires the animation on every scroll frame
  // and the columns judder instead of easing across once.
  const target = useRef(view.rows)
  // Transitions stay off until the chart has been measured and scrolled to
  // its opening position once. The scale changing under your finger is worth
  // animating; the chart arriving at its correct size is not — that reads as
  // the whole thing loading every time this screen is returned to. The web
  // does the same with a `settled` class.
  const settled = useRef(false)

  // Only columns wholly inside the card count. A sliver at the edge that
  // re-scaled every bar — or flipped the year — would be reacting to
  // something you cannot read yet, twice per column as you scroll.
  const readScroll = useCallback(
    (x, cardWidth) => {
      if (!columnWidth || weeks.length === 0) return
      const slack = 1
      const first = Math.max(0, Math.ceil((x - slack) / columnWidth))
      const last = Math.min(
        weeks.length - 1,
        Math.floor((x + cardWidth + slack) / columnWidth) - 1,
      )
      let next = 1
      for (let i = first; i <= last; i++) next = Math.max(next, weeks[i].workouts.length)
      setView((prev) =>
        prev.first === first && prev.last === last && prev.rows === next
          ? prev
          : { first, last, rows: next },
      )
      if (next !== target.current) {
        target.current = next
        if (settled.current) {
          rows.value = withTiming(next, { duration: 320, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        } else {
          rows.value = next
        }
      }
      settled.current = true
    },
    [columnWidth, weeks, rows],
  )

  // Which workout is under the finger. Rows are counted up from the baseline
  // in the same pitch the segments are drawn at, so the reading matches what
  // is under the finger even as the scale changes.
  const readAt = useCallback(
    (x, y) => {
      if (!columnWidth) return
      const week = weeks[Math.floor((x + scrollX.current) / columnWidth)]
      if (!week || week.workouts.length === 0) {
        setReading(null)
        return
      }
      const fromBottom = trackTop.current + TRACK_HEIGHT - y
      const row = Math.floor((fromBottom / TRACK_HEIGHT) * view.rows)
      setReading(row >= 0 && row < week.workouts.length ? week.workouts[row] : null)
    },
    [columnWidth, weeks, view.rows],
  )

  const stopReading = useCallback(() => setReading(null), [])

  // The hold is the whole of the conflict: this card scrolls sideways and
  // also wants to be scrubbed, and both are a finger dragging across it.
  // Waiting for the press means a flick always scrolls and only a deliberate
  // hold reads — the same rule the web arrives at with a timer and a movement
  // tolerance, expressed here as one property.
  const scrub = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .onStart((event) => runOnJS(readAt)(event.x, event.y))
    .onUpdate((event) => runOnJS(readAt)(event.x, event.y))
    .onFinalize(() => runOnJS(stopReading)())

  const year = yearOfWeek(weeks[view.first]?.weekStart ?? Date.now())

  return (
    <View style={styles.chart}>
      {/* The readout takes the year's place while a workout is being read,
          rather than floating by the finger: up here it runs the full width
          without truncating a routine name, it never lands under the hand,
          and it is not clipped by the scroller. */}
      <View style={styles.caption}>
        {reading ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={[
              styles.readout,
              { backgroundColor: styleFor(reading.routineName).background },
            ]}
          >
            <Text style={[styles.readoutText, { color: inkFor(reading.routineName) }]}>
              {DAY(reading.startedAt)}
            </Text>
            <Text style={[styles.readoutText, { color: inkFor(reading.routineName) }]}>
              {reading.routineName}
            </Text>
          </Animated.View>
        ) : (
          <Text style={styles.year}>{year}</Text>
        )}
      </View>

      <GestureDetector gesture={scrub}>
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Settles on whole columns, so the card at rest always holds
          // exactly VISIBLE_WEEKS of them and "fully visible" is never
          // ambiguous.
          snapToInterval={columnWidth || undefined}
          decelerationRate="fast"
          scrollEnabled={!reading}
          onLayout={(e) => setColumnWidth(e.nativeEvent.layout.width / VISIBLE_WEEKS)}
          // Opens on the current week — the right-hand end — rather than on
          // the first workout ever logged.
          contentOffset={{ x: Math.max(0, (weeks.length - VISIBLE_WEEKS) * columnWidth), y: 0 }}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollX.current = e.nativeEvent.contentOffset.x
            readScroll(scrollX.current, e.nativeEvent.layoutMeasurement.width)
          }}
        >
          {weeks.map((week) => (
            <View key={week.weekStart} style={[styles.week, { width: columnWidth || 1 }]}>
              <View
                style={styles.track}
                onLayout={(e) => {
                  trackTop.current = e.nativeEvent.layout.y
                }}
              >
                {/* Reversed so the first workout of the week sits on the
                    baseline and the rest stack on top of it — gravity, not a
                    slot per weekday. A week trained only on Friday looks
                    exactly like a week trained only on Monday. */}
                {[...week.workouts].reverse().map((workout, i) => (
                  <Segment
                    key={workout.id}
                    workout={workout}
                    rows={rows}
                    last={i === week.workouts.length - 1}
                    // While a workout is being read the rest of the chart
                    // steps back, so the readout is unambiguously about one
                    // segment.
                    dimmed={reading != null && reading.id !== workout.id}
                  />
                ))}
              </View>
              <Text style={styles.label}>{DAY(week.weekStart)}</Text>
            </View>
          ))}
        </ScrollView>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  chart: {
    backgroundColor: LIGHT.bgRaised,
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  caption: { height: 50, justifyContent: 'flex-start' },
  year: { fontFamily: FONTS.regular, fontSize: 12, letterSpacing: -0.12, color: '#191919' },
  // Full width so a long routine name never truncates, and carrying that
  // routine's colour — which is what ties it to the segment under the finger,
  // since it is not sitting next to it.
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 33,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  readoutText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.52,
  },
  week: { alignItems: 'center', gap: SPACE[2] },
  // The empty column: a pale capsule the full height of the chart, so a week
  // without training still reads as a week rather than as nothing.
  track: {
    justifyContent: 'flex-end',
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: 999,
    backgroundColor: LIGHT.bg,
    overflow: 'hidden',
  },
  segment: { width: TRACK_WIDTH, borderRadius: 999 },
  segmentDimmed: { opacity: 0.3 },
  // Fixed width and centred, so the date sits under the middle of its column
  // whatever the column works out to on a given phone.
  label: {
    width: 29,
    textAlign: 'center',
    fontFamily: FONTS.regular,
    fontSize: 12,
    letterSpacing: -0.12,
    color: '#191919',
  },
})
