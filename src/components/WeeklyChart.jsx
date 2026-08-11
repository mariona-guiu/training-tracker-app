import { useCallback, useEffect, useRef, useState } from 'react'
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

import { useRoutineColours } from '../theme/ThemeProvider.jsx'
import { VISIBLE_WEEKS, yearOfWeek } from '../data/weeks.js'
import { CAP, RADIUS, SPACE, TYPE } from '../theme/index.js'
import { useThemedStyles } from '../theme/ThemeProvider.jsx'

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
function Segment({ workout, height, gap, dimmed, last }) {
  const styles = useThemedStyles(makeStyles)
  const { styleFor } = useRoutineColours()

  const style = useAnimatedStyle(() => ({
    height: height.value,
    marginBottom: last ? 0 : gap.value,
  }))

  return (
    <Animated.View
      style={[
        styles.segment,
        { backgroundColor: styleFor(workout.routineType ?? workout.routineName).background },
        dimmed && styles.segmentDimmed,
        style,
      ]}
    />
  )
}

export function WeeklyChart({ weeks }) {
  const styles = useThemedStyles(makeStyles)
  const { inkFor, styleFor } = useRoutineColours()
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

  // What the animation actually runs on: the segment's height in points, not
  // the row count it is derived from.
  //
  // Driving `rows` and computing the height from it each frame looks like the
  // same thing and is not, because height is 230/rows — a curve, not a line.
  // Easing rows from 17 to 1 leaves the segment at 25pt when the animation is
  // half over and then does the whole visible change in the last moments, so
  // it sits still and then snaps. The web transitions the height itself, and
  // this now does too.
  const height = useSharedValue(segmentHeight(view.rows))
  // The gap is not animated, matching the web, where only `height` and
  // `opacity` are transitioned and the track's `gap` changes outright. It is
  // at most 5pt, so there is nothing to see.
  const gap = useSharedValue(gapFor(view.rows))
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
      // The offset is taken as it comes, overscroll included. It was clamped to
      // the scrollable range for a while, to stop a bounce reading as an empty
      // window — but the overlap test below cannot produce an empty window, and
      // with only eight weeks there is no scrollable range at all: `x` is 0 at
      // rest and every drag is a bounce. Clamping threw the whole gesture away.
      const at = x

      // Two windows, because two things are being asked and the answers differ.
      //
      // The year asks what you can *read*, so it counts only columns wholly
      // inside the card: a sliver at the edge flipping the heading would be
      // reacting to something not yet legible.
      const slack = 1
      const first = Math.min(
        Math.max(0, Math.ceil((at - slack) / columnWidth)),
        weeks.length - 1,
      )
      const last = Math.max(
        first,
        Math.min(weeks.length - 1, Math.floor((at + cardWidth + slack) / columnWidth) - 1),
      )

      // The scale asks what is *drawn*, so a column counts while any part of it
      // is on screen and stops the instant it has gone. Using the readable
      // window here is what made the bars resize the moment a swipe began: the
      // busiest column stopped counting as soon as its edge crossed the card,
      // while it was still visible and still being drawn at the new scale.
      //
      // Written as an overlap test rather than as first and last indices. The
      // interesting frame is the one where a column is exactly flush with the
      // edge, and rounding a division is the worst possible way to decide it —
      // whether ceil() lands on 8 or 9 there comes down to whether the card
      // measured 344.9999 or 345.0001. EDGE is what makes that a decision
      // rather than a coin toss: under half a point of a column showing is not
      // showing.
      // Against the drawn bar, not the column that holds it. A column is
      // 43pt wide and the bar inside it is TRACK_WIDTH, centred — so roughly
      // 17pt of empty column sits either side of it, and a column can be
      // partly on screen while its bar has entirely gone. The bar is what is
      // being looked at, so the bar is what decides.
      const inset = Math.max(0, (columnWidth - TRACK_WIDTH) / 2)
      const EDGE = 0.5
      let next = 0
      for (let i = 0; i < weeks.length; i++) {
        const barLeft = i * columnWidth + inset
        if (barLeft + TRACK_WIDTH <= at + EDGE) continue
        if (barLeft >= at + cardWidth - EDGE) continue
        next = Math.max(next, weeks[i].workouts.length)
      }
      // Dragged so hard that nothing is left to measure. Keep the scale rather
      // than collapsing it to a single full-height row.
      if (next === 0) return
      next = Math.max(1, next)
      setView((prev) =>
        prev.first === first && prev.last === last && prev.rows === next
          ? prev
          : { first, last, rows: next },
      )
      if (next !== target.current) {
        target.current = next
        gap.value = gapFor(next)
        if (settled.current) {
          height.value = withTiming(segmentHeight(next), {
            duration: 320,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
          })
        } else {
          height.value = segmentHeight(next)
        }
      }
      settled.current = true
    },
    [columnWidth, weeks, height, gap],
  )

  // The chart is told when to re-read by scrolling, and nothing else was
  // telling it. Logging or deleting a workout changes what the columns hold
  // without moving the scroll a pixel, so the scale stayed at whatever the
  // last swipe had left it at — and the chart only came right once you
  // happened to drag it. Re-read from where it already sits.
  //
  // It also has to follow when the card grows a column. buildWeeks runs
  // through to the current week whether or not anything was done in it, so a
  // new week arrives on its own as an empty track — and it arrives off the
  // right edge, because the opening position is a mount-time prop that does
  // not reapply.
  //
  // Only when the count actually grows, though. Doing it on every data change
  // would drag the chart back to today each time this tab is returned to,
  // undoing a scroll left where it was wanted — and the sessions reload on
  // every focus whether or not anything changed.
  const weekCount = useRef(weeks.length)
  useEffect(() => {
    if (!columnWidth) return
    const width = columnWidth * VISIBLE_WEEKS
    const grew = weeks.length > weekCount.current
    weekCount.current = weeks.length
    if (grew) {
      const end = Math.max(0, weeks.length * columnWidth - width)
      scroller.current?.scrollTo({ x: end, animated: true })
      scrollX.current = end
    }
    readScroll(scrollX.current, width)
  }, [weeks, columnWidth, readScroll])

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
              { backgroundColor: styleFor(reading.routineType ?? reading.routineName).background },
            ]}
          >
            <Text {...CAP.label} style={[styles.readoutText, { color: inkFor(reading.routineType ?? reading.routineName) }]}>
              {DAY(reading.startedAt)}
            </Text>
            <Text {...CAP.label} style={[styles.readoutText, { color: inkFor(reading.routineType ?? reading.routineName) }]}>
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
                    height={height}
                    gap={gap}
                    last={i === week.workouts.length - 1}
                    // While a workout is being read the rest of the chart
                    // steps back, so the readout is unambiguously about one
                    // segment.
                    dimmed={reading != null && reading.id !== workout.id}
                  />
                ))}
              </View>
              <Text {...CAP.label} style={styles.label} numberOfLines={1}>{DAY(week.weekStart)}</Text>
            </View>
          ))}
        </ScrollView>
      </GestureDetector>
    </View>
  )
}

const makeStyles = (t) => StyleSheet.create({
  chart: {
    backgroundColor: t.bgRaised,
    borderRadius: RADIUS.card,
    paddingTop: SPACE[3],
    paddingHorizontal: 12,
    paddingBottom: SPACE[4],
  },
  caption: { height: 50, justifyContent: 'flex-start' },
  year: { ...TYPE.caption, color: t.text },
  // Full width so a long routine name never truncates, and carrying that
  // routine's colour — which is what ties it to the segment under the finger,
  // since it is not sitting next to it.
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 33,
    paddingHorizontal: 12,
    borderRadius: RADIUS.card,
  },
  // The last type in the app that sat outside the scale: 13pt Bold with its
  // tracking written as a raw 0.52 rather than a ratio, so it would not have
  // followed a size change. It is a small uppercase mark on a chart, which is
  // what `label` is, and it gets a point smaller and a weight lighter for
  // saying so.
  readoutText: { ...TYPE.label },
  week: { alignItems: 'center', gap: SPACE[2] },
  // The empty column: a pale capsule the full height of the chart, so a week
  // without training still reads as a week rather than as nothing.
  track: {
    justifyContent: 'flex-end',
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: RADIUS.pill,
    backgroundColor: t.bg,
    overflow: 'hidden',
  },
  segment: { width: TRACK_WIDTH, borderRadius: RADIUS.pill },
  segmentDimmed: { opacity: 0.3 },
  // Fixed width and centred, so the date sits under the middle of its column
  // whatever the column works out to on a given phone.
  label: {
    // Stretches to its column rather than being pinned to 29. The fixed width
    // was there to centre the date under the middle of its column, which the
    // column's own alignItems already does — and at large text sizes 29pt was
    // narrower than the date, so it wrapped a digit at a time.
    alignSelf: 'stretch',
    textAlign: 'center',
    ...TYPE.caption,
    color: t.text,
  },
})
