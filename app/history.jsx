import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import {
  cachedCompletedSessions,
  deleteSession,
  listCompletedSessions,
} from '../src/db/sessions.js'
import { caloriesFor, KCAL_DISCLAIMER } from '../src/data/calories.js'
import { inkOn } from '../src/data/routineStyles.js'
import { addDays, startOfWeek } from '../src/data/weeks.js'
import {
  BackIcon,
  BoltIcon,
  ChevronIcon,
  ClockIcon,
  DumbbellIcon,
  RepeatIcon,
  TrashIcon,
} from '../src/components/HistoryIcons.jsx'
import { Glass } from '../src/components/Glass.jsx'
import { EXPAND_SPRING } from '../src/data/motion.js'
import {
  CAP,
  RADIUS,
  SPACE,
  SYSTEM_ASCENT,
  SYSTEM_CAP,
  SYSTEM_DESCENT,
  TYPE,
} from '../src/theme/index.js'
import { useRoutineColours, useTheme, useThemedStyles } from '../src/theme/ThemeProvider.jsx'

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long' })

function clockTime(ts) {
  const d = new Date(ts)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fullDate(ts) {
  const d = new Date(ts)
  return `${d.getDate()} ${MONTH.format(d)} ${d.getFullYear()}`
}

// "13 - 19 July, 2026" when a week sits inside one month, "27 July - 2 August,
// 2026" when it straddles two, and both years spelt out when it straddles New
// Year.
function weekLabel(weekStart) {
  const from = new Date(weekStart)
  const to = new Date(addDays(weekStart, 6))
  if (from.getFullYear() !== to.getFullYear()) {
    return `${from.getDate()} ${MONTH.format(from)} ${from.getFullYear()} - ${to.getDate()} ${MONTH.format(to)}, ${to.getFullYear()}`
  }
  if (from.getMonth() === to.getMonth()) {
    return `${from.getDate()} - ${to.getDate()} ${MONTH.format(to)}, ${to.getFullYear()}`
  }
  return `${from.getDate()} ${MONTH.format(from)} - ${to.getDate()} ${MONTH.format(to)}, ${to.getFullYear()}`
}

function durationLabel(session) {
  if (!session.endedAt) return null
  const seconds = Math.max(0, Math.round((session.endedAt - session.startedAt) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`
}

// An exercise counts as done once a single set is logged — the same threshold
// the workout screen uses, so a skipped exercise never counts.
function tallies(session) {
  const exercises = session.exercises.length
  const exercisesDone = session.exercises.filter((ex) => ex.sets.some((s) => s.done)).length
  const sets = session.exercises.reduce((total, ex) => total + ex.targetSets, 0)
  const setsDone = session.exercises.reduce(
    (total, ex) => total + ex.sets.filter((s) => s.done).length,
    0,
  )
  return { exercises, exercisesDone, sets, setsDone }
}

// Consecutive sets performed identically collapse into one entry, so the
// common case reads as "4x 8x45kg" rather than the same line four times. Only
// consecutive ones: a session that went 30kg, 45kg, 30kg, 45kg genuinely is
// not "two at 30 and two at 45", and flattening it would invent a shape the
// workout did not have.
//
// A set that was never logged still appears, carrying what it was going to be,
// marked so it can be drawn faded.
function setRuns(exercise) {
  const runs = []
  for (const set of exercise.sets) {
    const done = Boolean(set.done)
    const reps = done ? set.reps : exercise.targetReps
    const weight = done ? set.weight : exercise.targetWeight
    const last = runs[runs.length - 1]
    if (last && last.done === done && last.reps === reps && last.weight === weight) {
      last.count += 1
    } else {
      runs.push({ count: 1, done, reps, weight })
    }
  }
  return runs
}

function runLabel(run, tracksWeight) {
  const reps = run.reps ?? 0
  // A timed exercise has neither weight nor repetitions — the number is how
  // long the position was held.
  if (!tracksWeight) return `${run.count}x ${reps}sec`
  return `${run.count}x ${reps}x${run.weight ?? 0}kg`
}

// Newest first, then split into years and the calendar weeks inside them.
function groupByWeek(sessions) {
  const years = []
  let year = null
  let week = null
  for (const session of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
    const y = new Date(session.startedAt).getFullYear()
    const w = startOfWeek(session.startedAt)
    if (!year || year.year !== y) {
      year = { year: y, weeks: [] }
      years.push(year)
      week = null
    }
    if (!week || week.weekStart !== w) {
      week = { weekStart: w, sessions: [] }
      year.weeks.push(week)
    }
    week.sessions.push(session)
  }
  return years
}

const sentenceCase = (name) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()

// Swipe a cell aside to uncover the one thing that can be done to it.
//
// Hand-rolled rather than taken from gesture-handler, which was the first
// choice: its modern ReanimatedSwipeable is not exported from the package
// index and has no import path of its own in 2.28, and the one that *is*
// exported is the deprecated component built on the old Animated API, which
// would be fighting Reanimated for the same transform. The interaction is a
// clamp and two snaps, so owning it costs less than working around that.
//
// iOS convention: leftward reveals, the action is a target rather than a
// commitment, and the destructive part is the alert behind it. A full swipe
// deliberately does not delete — this app has no undo, and the whole reason
// the old control lived inside an expanded cell was so you saw what you were
// deleting first.
// Measured off the design: the cell sits at x 24 and slides to x -36, so 60pt
// of the action is uncovered.
const ACTION_WIDTH = 60
// Past this much of the action, let go and it opens rather than springs back.
const SNAP_FRACTION = 0.4

function WorkoutCell({ session, open, built, onToggle, onReveal, onDelete, removing, onRemoved }) {
  const theme = useTheme()
  const styles = useThemedStyles(makeStyles)
  const { inkFor, paleFor, restTintFor, styleFor } = useRoutineColours()
  const root = useRef(null)
  const pending = useRef(null)
  // The kind of session, falling back to its name for anything recorded
  // before the type was stored.
  const kind = session.routineType ?? session.routineName
  const pale = paleFor(kind)
  const ink = inkFor(kind)
  const kcal = caloriesFor(session)
  const { exercises, exercisesDone, sets, setsDone } = tallies(session)
  const anySkipped = session.exercises.some((ex) => ex.skipped || ex.sets.some((set) => !set.done))

  // The body is measured once and then kept, so opening it again is a spring
  // rather than a measurement. Height is animated on a wrapper rather than on
  // the body itself: padding on a collapsed element still occupies space, so
  // the cell would never close all the way.
  const [bodyHeight, setBodyHeight] = useState(0)
  const height = useSharedValue(0)
  const turn = useSharedValue(open ? 1 : 0)
  // How far the cell has been dragged aside, and where it was when the finger
  // landed — so a second drag continues from where the first stopped.
  const slid = useSharedValue(0)
  const slidFrom = useSharedValue(0)
  // Its own height while it is being deleted. -1 means "leave it to the
  // layout" — the cell has no fixed height at any other time, since it depends
  // on whether the body is open.
  const shrink = useSharedValue(-1)
  const measured = useSharedValue(0)

  const swipe = Gesture.Pan()
    // Horizontal intent only. Without the vertical failure the list would stop
    // scrolling wherever a finger happened to land on a cell.
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      'worklet'
      slidFrom.value = slid.value
    })
    .onUpdate((e) => {
      'worklet'
      const next = slidFrom.value + e.translationX
      // Freely to the left as far as the action, and not past it; rightward
      // only as far as shut.
      slid.value = Math.min(0, Math.max(-ACTION_WIDTH, next))
    })
    .onEnd((e) => {
      'worklet'
      // A flick decides on its own, whatever distance it covered.
      const flung = e.velocityX < -500
      const shutFast = e.velocityX > 500
      const past = slid.value < -ACTION_WIDTH * SNAP_FRACTION
      const opening = !shutFast && (flung || past)
      slid.value = withSpring(opening ? -ACTION_WIDTH : 0, EXPAND_SPRING)
    })

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: slid.value }] }))

  const shut = useCallback(() => {
    slid.value = withSpring(0, EXPAND_SPRING)
  }, [slid])

  // Deleting is a collapse this cell performs on itself, not an exit animation.
  //
  // Reanimated's `exiting` takes the element out of the layout on the frame it
  // starts and plays its animation over a snapshot, so everything below jumps
  // to its new place immediately however long the animation runs. A `layout`
  // animation on the siblings is the intended answer, and it cannot be used
  // here: it would also animate the height change while a cell is expanding,
  // on top of the spring already doing that, which is what made opening crawl.
  //
  // So the cell keeps its place in the tree and animates its own height down.
  // That is precisely what opening already does, and the rows below follow it
  // frame by frame for the same reason.
  const removal = useAnimatedStyle(() => {
    if (shrink.value < 0) return {}
    const left = shrink.value / Math.max(measured.value, 1)
    return {
      height: shrink.value,
      // The gap goes with it, in step, so the row below does not travel the
      // last 8pt on its own at the end.
      marginBottom: left * SPACE[2],
      // Gone at once. It was fading as it shrank, which showed the workout
      // being squashed — and a card being crushed is a strange last thing to
      // see of it. What should be animated is the space closing, not the thing
      // that was in it.
      opacity: 0,
    }
  })

  useEffect(() => {
    if (!removing) return
    // Fixed at what it currently occupies, then taken to nothing on the spring
    // the cell opens with, so leaving looks like the reverse of arriving.
    shrink.value = measured.value
    shrink.value = withSpring(0, EXPAND_SPRING, (done) => {
      'worklet'
      if (done) runOnJS(onRemoved)()
    })
  }, [removing, shrink, measured, onRemoved])

  useEffect(() => {
    height.value = withSpring(open ? bodyHeight : 0, EXPAND_SPRING)
    // On the cell's own spring rather than a timing curve of its own. The
    // chevron and the body are one movement, and they read as one only if they
    // share a curve — a spring that settles beside a 240ms ease that stops dead
    // is what made this feel abrupt. It also arrives a little slower, and
    // overshoots 180 by a hair before coming back, which is the difference
    // between a mark turning over and a mark being flipped.
    turn.value = withSpring(open ? 1 : 0, EXPAND_SPRING)
    // Set going here rather than from the press, so the page and the cell
    // start in the same effect on the same frame. measureInWindow answers
    // asynchronously, so a spring started from inside its callback begins a
    // frame or two after this one and the two read as separate movements.
    if (open && pending.current) {
      onReveal(...pending.current)
      pending.current = null
    }
  }, [open, bodyHeight, height, turn, onReveal])

  // Never below nothing: the spring is underdamped, so on the way closed it
  // carries past zero and the layout clamps it, which reads as a snap.
  const reveal = useAnimatedStyle(() => ({ height: Math.max(0, height.value) }))
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }))

  // Written once and rendered twice — once out of sight to be measured, once
  // inside the wrapper to be seen. That is two full bodies per cell, and with
  // a page of them it was the whole cost of the first paint, which the push
  // has to wait for before it can start moving. So a closed cell builds
  // nothing until the page says it is past that first paint; an open one —
  // arriving from the completion screen — still builds immediately, because
  // it has to be measured to be opened.
  const show = built || open
  const body = show ? (
    <>
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <ClockIcon size={24} color={pale.ink} />
          <Text {...CAP.label} style={[styles.summaryText, { color: pale.ink }]}>
            {durationLabel(session) ?? '—'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <DumbbellIcon size={24} color={pale.ink} />
          <Text {...CAP.label} style={[styles.summaryText, { color: pale.ink }]}>
            {exercisesDone}/{exercises} exercises completed
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <RepeatIcon size={24} color={pale.ink} />
          <Text {...CAP.label} style={[styles.summaryText, { color: pale.ink }]}>
            {setsDone}/{sets} sets completed
          </Text>
        </View>
        {/* Left out entirely for a workout recorded without a body
                weight — there is nothing honest to put here. */}
        {kcal !== null ? (
          <View style={styles.summaryRow}>
            <BoltIcon size={24} color={pale.ink} />
            <Text {...CAP.label} style={[styles.summaryText, { color: pale.ink }]}>
              ~{kcal} kcal*
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.lifts}>
        {session.exercises.map((exercise, i) => {
          // Not the stored `skipped` flag: that records pressing Skip,
          // which is true of an exercise you logged sets on before
          // moving off it. What was done is what counts, so an exercise
          // only reads as skipped when nothing was logged for it at all.
          const untouched = !exercise.sets.some((set) => set.done)
          return (
            <View key={`${exercise.exerciseId}-${i}`} style={styles.lift}>
              <Text
                {...CAP.label}
                style={[styles.liftName, { color: pale.ink }, untouched && styles.faded]}
              >
                {exercise.exerciseName}
                {untouched ? '*' : ''}
              </Text>
              <View style={styles.liftSets}>
                {setRuns(exercise).map((run, j) => (
                  <Text
                    {...CAP.label}
                    key={j}
                    style={[
                      styles.liftRun,
                      { color: pale.ink },
                      // Not both. A missed set inside a skipped exercise
                      // was being faded twice over, which read as a
                      // third state that does not exist.
                      (untouched || !run.done) && styles.faded,
                    ]}
                  >
                    {runLabel(run, exercise.tracksWeight)}
                    {run.done ? '' : '*'}
                  </Text>
                ))}
              </View>
            </View>
          )
        })}
      </View>

      {anySkipped ? (
        <Text style={[styles.footnote, { color: pale.ink }, styles.faded]}>*Skipped</Text>
      ) : null}
      {/* After the skipped note when both are here, so the marks are
              explained in the order they appear above. */}
      {kcal !== null ? (
        <Text style={[styles.footnote, { color: pale.ink }, styles.faded]}>{KCAL_DISCLAIMER}</Text>
      ) : null}
    </>
  ) : null

  return (
    <Animated.View
      ref={root}
      style={[styles.cell, removal]}
      onLayout={(e) => {
        // Only while it is settled: once the collapse starts this is the very
        // thing being animated, and reading it back would chase itself to zero.
        if (shrink.value < 0) measured.value = e.nativeEvent.layout.height
      }}
    >
      {/* Uncovered by the swipe, and clipped by the cell's own rounded corners
          so it reads as part of the cell rather than a panel behind it. */}
      {/* Fills the cell, which is what the design draws — an expanded cell shows
          the red down its whole height and centres the icon in all of it, not
          in the row at the top. My first guess was the other way round.

          No opacity of its own: it sits *under* the cell and is covered
          completely at rest, so fading it in was both unnecessary and visible —
          the threshold cut it off a couple of points before the cell was home,
          which is the red edge that flashed on the way back. */}
      <View style={styles.action}>
        {/* The card's own shape, doubled underneath it, purely to cast a
            shadow. A gradient strip could not do this: it is a rectangle, so
            where the card's corners curve away it stood proud of them — the
            nick at the top and bottom of the edge.
            
            The silhouette is never seen. It is the same size, radius and
            colour as the card and moves with it, so the card covers it exactly;
            only what spills out from underneath shows. And because the action
            clips to the cell, the spill above, below and to the left is cut off
            there — leaving just the right-hand edge, on the red, which is the
            only place two surfaces meet. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.silhouette, { backgroundColor: styleFor(kind).background }, slide]}
        />
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete this ${session.routineName} workout`}
          style={styles.actionHit}
        >
          <TrashIcon size={24} color={theme.onInk} />
        </Pressable>
      </View>

      <GestureDetector gesture={swipe}>
        {/* The shadow is what separates the cell from the action beneath it,
            and it has to be: on a full-body workout the two are the same red.
            Cast to the right only — offset x 2, no y — so it reads as the cell
            lifted off the action rather than floating above the page.

            The background matters as much as the shadow. iOS draws a layer's
            shadow from its own shape, and a container with a transparent
            background has none, so the shadow simply would not appear. It is
            never seen: the head covers it while shut and the body while open. */}
        <Animated.View
          style={[styles.slider, { backgroundColor: styleFor(kind).background }, slide]}
        >
          <View style={styles.sliderClip}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => {
                // A cell that has been swiped aside puts itself back rather than
                // opening — the same tap that would dismiss the action elsewhere.
                if (slid.value !== 0) {
                  shut()
                  return
                }
                // Measured on the press, while the cell is still shut, so the
                // numbers describe a settled layout rather than one already
                // springing. Where it will end up is that plus the body, which has
                // been measured out of the flow since before it was ever opened.
                if (!open) {
                  root.current?.measureInWindow((x, y, w, h) => {
                    pending.current = [y, h + bodyHeight, bodyHeight]
                  })
                }
                onToggle()
              }}
              style={[styles.head, { backgroundColor: styleFor(kind).background }]}
            >
              <View style={styles.heading}>
                {/* Sentence case whatever the routine is stored as, matching the
              page titles — "Lower Body" reads as a label, "Lower body" as a
              thing you did. */}
                <Text {...CAP.title} style={[styles.name, { color: ink }]}>
                  {sentenceCase(session.routineName)}
                </Text>
                <Text {...CAP.label} style={[styles.when, { color: ink }]}>
                  {fullDate(session.startedAt)}, {clockTime(session.startedAt)}
                </Text>
              </View>

              {/* Only flagged when we actually know: sessions recorded before this
            was tracked have no answer either way. */}
              {session.endedEarly === true ? (
                <View style={[styles.tag, { backgroundColor: restTintFor(kind) }]}>
                  <Text
                    {...CAP.label}
                    style={[styles.tagText, { color: inkOn(restTintFor(kind)) }]}
                  >
                    Ended early
                  </Text>
                </View>
              ) : null}

              <Animated.View style={[styles.chevron, chevron]}>
                <ChevronIcon size={24} color={ink} />
              </Animated.View>
            </Pressable>

            {/* A wash of the routine's own colour rather than a fresh surface, with
          the colour itself as ink wherever it holds up against that wash. */}
            <View>
              {/* Measured here, out of the flow, rather than inside the wrapper.
            Measuring the copy inside is circular: it sits in a box whose
            height is the very thing being measured, and is clipped to it, so
            the first pass comes back short — and being kept, the cell opens
            short from then on. Settings' Reveal was fixed this way; this was
            missed. */}
              <View
                style={[styles.body, styles.measure]}
                pointerEvents="none"
                onLayout={(e) => {
                  const measured = e.nativeEvent.layout.height
                  setBodyHeight((current) =>
                    Math.abs(current - measured) > 1 ? measured : current,
                  )
                }}
              >
                {body}
              </View>
              <Animated.View style={[styles.reveal, { backgroundColor: pale.background }, reveal]}>
                <View style={styles.body}>{body}</View>
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  )
}

export default function History() {
  const { expand } = useLocalSearchParams()
  // Seeded from what Stats has just read, so the push carries a full page in
  // rather than a white one that fills after it lands. Still loaded below —
  // the seed is a first paint, not the truth.
  //
  // Arriving from the completion screen can still land cold, since Stats may
  // not have been focused since launch. Not fixed rather than not noticed: it
  // would mean warming the cache when a workout ends, and that path already
  // opens with a cell expanded, which covers it.
  const [sessions, setSessions] = useState(cachedCompletedSessions)
  // A workout arrived at from the completion screen opens already expanded,
  // rather than as a list to go hunting through for the thing you were just
  // doing.
  const [openIds, setOpenIds] = useState(() => new Set(expand ? [expand] : []))
  // The cell bodies are what the push was waiting on — see WorkoutCell. The
  // first paint is headers only, which lets the slide start; the bodies are
  // built on the next frame, during the movement. The slide runs on the
  // native side, so that work cannot stutter it.
  const [built, setBuilt] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setBuilt(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const [scrolled, setScrolled] = useState(false)
  // The workout on its way out. It is already gone from the database by the
  // time this is set — what is left is the cell closing up, and the list is
  // told to forget it only once that has finished.
  const [removingId, setRemovingId] = useState(null)
  // The bar compresses rather than swapping: the surface, and the year that
  // joins the title, are both faded so nothing appears or jumps. The big year
  // heading below simply scrolls away under it.
  const compressed = useSharedValue(0)
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const styles = useThemedStyles(makeStyles)
  const router = useRouter()
  const { height: windowHeight } = useWindowDimensions()

  // An opening cell brings itself into view rather than growing off the
  // bottom of the screen. The page slides on the same spring the cell grows
  // on, so the two read as one movement instead of a card opening and a page
  // catching up after it.
  const scroller = useAnimatedRef()
  const scrollY = useRef(0)
  const viewport = useRef(0)
  const content = useRef(0)
  const glide = useSharedValue(0)
  useAnimatedReaction(
    () => glide.value,
    (y) => {
      scrollTo(scroller, 0, y, false)
    },
  )

  // What the floating bar covers, which is also the content's own top
  // padding — a cell tucked under the bar is as hidden as one off the bottom.
  const barClearance = insets.top + SPACE[2] + 32 + SPACE[2]

  const revealInView = useCallback(
    (top, finalHeight, grow) => {
      const visibleTop = barClearance
      const visibleBottom = windowHeight - insets.bottom - SPACE[4]
      // How far past the bottom it would end up, and how much room there is
      // above it before its own top disappears under the bar.
      const below = top + finalHeight - visibleBottom
      const above = top - visibleTop

      let delta = 0
      // Taller than the screen once open is not a failure — `above` caps the
      // move, so a long cell settles with its top under the bar and its own
      // scrolling takes over from there.
      if (below > 0) delta = Math.min(below, above)
      else if (above < 0) delta = above
      if (delta === 0) return

      // The content is about to grow by `grow`, so the end of the list moves
      // too. Without that the last cell in the list has nowhere to scroll to.
      const most = Math.max(0, content.current + grow - viewport.current)
      const dest = Math.min(most, Math.max(0, scrollY.current + delta))
      glide.value = scrollY.current
      glide.value = withSpring(dest, EXPAND_SPRING)
    },
    [glide, barClearance, windowHeight, insets.bottom],
  )

  useEffect(() => {
    compressed.value = withTiming(scrolled ? 1 : 0, { duration: 220 })
  }, [scrolled, compressed])

  const surface = useAnimatedStyle(() => ({ opacity: compressed.value }))
  const barYear = useAnimatedStyle(() => ({
    opacity: compressed.value,
    height: compressed.value * 18,
  }))

  const load = useCallback(() => listCompletedSessions().then(setSessions), [])
  useEffect(() => {
    load()
  }, [load])

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirmDelete(session) {
    Alert.alert(
      'Delete this workout?',
      `${session.routineName}, ${fullDate(session.startedAt)}. This can't be undone.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete workout',
          style: 'destructive',
          onPress: async () => {
            // Written away first, then closed up. The other order would leave
            // the cell gone from the screen and still in the database if the
            // write failed, which is the worse of the two to be wrong about.
            await deleteSession(session.id)
            setRemovingId(session.id)
          },
        },
      ],
    )
  }

  // Dropped from the list only once its cell has finished closing, and from
  // what is held here rather than by reloading — a reload would rebuild the
  // list under the animation and undo it.
  const finishRemoval = useCallback((id) => {
    setSessions((current) => (current ?? []).filter((s) => s.id !== id))
    setRemovingId((current) => (current === id ? null : current))
  }, [])

  const years = sessions ? groupByWeek(sessions) : []

  return (
    <View style={styles.screen}>
      <View
        style={[styles.barSlot, { paddingTop: insets.top + SPACE[2] }]}
        pointerEvents="box-none"
      >
        {/* Nothing behind it at rest, so it carries no surface — the material
            arrives only once a coloured cell is passing underneath and the
            title needs something to sit on. */}
        <Animated.View style={[StyleSheet.absoluteFill, surface]} pointerEvents="none">
          <Glass intensity={70} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {/* The title and the control beside it are one row, and its height
            never changes. The year grows underneath rather than inside it —
            in one row with the title, the block grew when the year arrived and
            the row grew with it, so the title drifted up while the back
            control, centring against a taller row, dropped. They moved in
            opposite directions, about twenty points apart. */}
        <View style={styles.barRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to stats"
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.back}
          >
            <BackIcon color={theme.text} />
          </Pressable>
          <Text {...CAP.title} style={styles.title}>
            My workouts
          </Text>
          {/* Balances the back control, so the title sits centred on the
              screen rather than on the space left beside it. */}
          <View style={styles.back} />
        </View>
        {/* Joins the title only once the page has scrolled, so which year is
            under you is still answered when the heading below has gone. */}
        <Animated.Text numberOfLines={1} style={[styles.barYear, barYear]}>
          {years[0]?.year ?? ''}
        </Animated.Text>
      </View>

      <Animated.ScrollView
        ref={scroller}
        scrollEventThrottle={16}
        onLayout={(e) => {
          viewport.current = e.nativeEvent.layout.height
        }}
        onContentSizeChange={(w, h) => {
          content.current = h
        }}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y
          setScrolled(scrollY.current > 4)
        }}
        contentContainerStyle={{
          // Clears the floating bar: its own padding, the back control's
          // height, and the inset above it.
          paddingTop: insets.top + SPACE[2] + 32 + SPACE[2],
          paddingHorizontal: SPACE[3],
          paddingBottom: insets.bottom + SPACE[6],
        }}
      >
        {sessions !== null && sessions.length === 0 ? (
          <Text style={styles.empty}>
            Finish a workout and it will be listed here, with everything you lifted.
          </Text>
        ) : null}

        {/* The week headings scroll past normally — every cell carries its own
            full date, so they group the list rather than being something that
            needs keeping in view. */}
        {years.map(({ year, weeks }) => (
          <View key={year}>
            <Text {...CAP.title} style={styles.year}>
              {year}
            </Text>
            {weeks.map(({ weekStart, sessions: inWeek }) => (
              <View key={weekStart}>
                <Text {...CAP.label} style={styles.weekLabel}>
                  {weekLabel(weekStart)}
                </Text>
                <View>
                  {inWeek.map((session) => (
                    <WorkoutCell
                      key={session.id}
                      session={session}
                      open={openIds.has(session.id)}
                      built={built}
                      onToggle={() => toggle(session.id)}
                      onReveal={revealInView}
                      onDelete={() => confirmDelete(session)}
                      removing={removingId === session.id}
                      onRemoved={() => finishRemoval(session.id)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  )
}

// The chip around "Ended early": its total vertical padding, kept at what it
// was so the chip stays the same height, and how unevenly that has to be
// split for the capitals inside it to look centred.
const TAG_PADDING = 12
const TAG_CAP_OFFSET = (SYSTEM_ASCENT - SYSTEM_CAP - SYSTEM_DESCENT) * TYPE.label.fontSize

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    barSlot: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      zIndex: 10,
      paddingHorizontal: SPACE[3],
      paddingBottom: SPACE[2],
    },
    barRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    barYear: { ...TYPE.body, color: t.text, textAlign: 'center', overflow: 'hidden' },
    title: { ...TYPE.title, color: t.text },
    year: { ...TYPE.title, color: t.text, marginTop: SPACE[4] },
    weekLabel: {
      ...TYPE.label,
      color: t.textDim,
      paddingTop: SPACE[3],
      paddingBottom: SPACE[2],
    },
    // Deliberately not clipping. The card is meant to travel out of the cell and
    // off the screen keeping its own rounded corners, the way the design draws it
    // at x -36 — clipping here would cut it square against the cell's edge
    // instead. What stops it is the scroll view, which is the screen.
    cell: { marginBottom: SPACE[2] },
    // Two views because the inner one clips its children to the rounded corners
    // and the outer one is what the swipe moves.
    slider: { borderRadius: RADIUS.card },
    sliderClip: { borderRadius: RADIUS.card, overflow: 'hidden' },
    head: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: SPACE[2],
      padding: SPACE[3],
    },
    heading: { flex: 1, minWidth: 0, gap: SPACE[2] },
    // The head is flex-start so the heading block starts at the top of the
    // padding rather than floating in it. The two things beside it are single
    // objects and centre against that block instead — which the tag already
    // did with alignSelf, and the chevron did not, so they sat at different
    // heights in the same row.
    chevron: { alignSelf: 'center' },
    name: { ...TYPE.title },
    when: { ...TYPE.label },
    // The routine's own colour with the light turned down — the same shade the
    // rest sweep paints during a workout, so the app has one idea of "this
    // colour, deeper" rather than two.
    tag: {
      alignSelf: 'center',
      // Yields before the name does. Without this the tag held its full
      // intrinsic width and squeezed `heading` down to a couple of characters —
      // at large text sizes "Core" came out one letter per line. `heading` is
      // flex: 1 with minWidth: 0, so it takes what is left once this has given
      // way rather than the other way round.
      flexShrink: 1,
      marginRight: SPACE[2],
      // What is being centred is the capitals, not the line box. Uppercase inks
      // only the cap height, and a line box is not symmetrical around it: SF Pro
      // leaves 0.262em above the capitals and 0.211em below the baseline, so
      // centring the box leaves the letters sitting high.
      //
      // The old 7.5 / 4.5 was tuned by eye against Funnel and tilted the wrong
      // way — 3pt more above where the font already gives more above. Derived now,
      // so it follows the typeface rather than needing to be re-eyeballed.
      paddingTop: (TAG_PADDING - TAG_CAP_OFFSET) / 2,
      paddingBottom: (TAG_PADDING + TAG_CAP_OFFSET) / 2,
      paddingHorizontal: 9,
      borderRadius: RADIUS.chip,
    },
    tagText: { ...TYPE.label },
    // Laid out for its height only: out of the flow so it adds none, and
    // invisible so it shows none.
    measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0, zIndex: -1 },
    reveal: { overflow: 'hidden' },
    body: { paddingTop: SPACE[4], paddingHorizontal: SPACE[3], paddingBottom: SPACE[3] },
    summary: { gap: SPACE[1] },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
    summaryText: { ...TYPE.label },
    // Uncovered by the swipe. Its own red on every routine colour rather than
    // joining the palette, because it is the one thing here that destroys
    // something.
    action: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.danger,
      borderRadius: RADIUS.card,
      // A row, so the target can stretch down the cell while sitting at its end.
      // It was a column with `alignSelf: 'stretch'` on the child, which quietly
      // cancels the parent's `alignItems: 'flex-end'` and puts the icon at the
      // *left* of the cell — under the card, where nothing could ever see it.
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'stretch',
      // So the shading is cut off at the cell rather than trailing across the
      // page while the card is home.
      overflow: 'hidden',
    },
    silhouette: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: RADIUS.card,
      shadowColor: '#6C0000',
      shadowOpacity: 0.5,
      shadowOffset: { width: 2, height: 0 },
      shadowRadius: 5,
    },
    // The icon centres in the strip the swipe uncovers, not in the cell.
    actionHit: {
      width: ACTION_WIDTH,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lifts: { marginTop: SPACE[3] },
    // Name against the left edge, sets against the right, so a long name that
    // wraps still reads across to its own figures.
    lift: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: SPACE[3],
      paddingVertical: SPACE[2],
    },
    liftName: { flexShrink: 1, ...TYPE.label },
    // Groups run along the row and wrap onto further lines when a session had
    // too many different sets to fit — right-aligned, so however many lines it
    // takes the figures stay in one column.
    liftSets: {
      flexShrink: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      maxWidth: '60%',
      gap: SPACE[1],
      columnGap: SPACE[2],
    },
    liftRun: {
      ...TYPE.label,
      // Mixed case on purpose — the x in "4x 8x45kg" is not a capital — and
      // mixed case tracks in where capitals track out.
      textTransform: 'none',
      letterSpacing: TYPE.caption.letterSpacing,
      textAlign: 'right',
    },
    // Sets that were never logged, and exercises passed over entirely: still
    // shown, carrying what they were going to be, but stepped back so the row
    // reads as something that did not happen.
    // Skipped work, and the calorie disclaimer: still secondary, but readable.
    //
    // 0.4 put this at a contrast of 1.7 to 2.7 against the cell — below any
    // legibility bar, on text that says which sets you did not do, which is
    // information rather than decoration. 0.76 is what the worst of the six
    // needs to clear 3:1.
    //
    // Not 4.5, because that is unreachable here: the cell's ink now sits at
    // exactly 4.5 at full strength, so any fading at all falls under it. The
    // choice is 3:1 secondary text or no fading at all, and this stays legible
    // while still reading as a lesser voice.
    //
    // Applied once per element, never nested — a missed set inside a skipped
    // exercise used to take it twice and read as a third state.
    faded: { opacity: 0.76 },
    footnote: { ...TYPE.caption, marginTop: SPACE[3] },
    empty: { ...TYPE.body, color: t.textDim, marginTop: SPACE[5] },
  })
