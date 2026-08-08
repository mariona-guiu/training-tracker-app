import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
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
import { inkFor, inkOn, paleFor, restTintFor, styleFor } from '../src/data/routineStyles.js'
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
import { FONTS, LIGHT, RADIUS, SPACE, TYPE } from '../src/theme/index.js'

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

function WorkoutCell({ session, open, built, onToggle, onReveal, onDelete }) {
  const root = useRef(null)
  const pending = useRef(null)
  const pale = paleFor(session.routineName)
  const ink = inkFor(session.routineName)
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
              <Text style={[styles.summaryText, { color: pale.ink }]}>
                {durationLabel(session) ?? '—'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <DumbbellIcon size={24} color={pale.ink} />
              <Text style={[styles.summaryText, { color: pale.ink }]}>
                {exercisesDone}/{exercises} exercises completed
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <RepeatIcon size={24} color={pale.ink} />
              <Text style={[styles.summaryText, { color: pale.ink }]}>
                {setsDone}/{sets} sets completed
              </Text>
            </View>
            {/* Left out entirely for a workout recorded without a body
                weight — there is nothing honest to put here. */}
            {kcal !== null ? (
              <View style={styles.summaryRow}>
                <BoltIcon size={24} color={pale.ink} />
                <Text style={[styles.summaryText, { color: pale.ink }]}>~{kcal} kcal*</Text>
              </View>
            ) : null}
          </View>

          {/* The one control here that destroys something, so it keeps its
              own red on every colour rather than joining the palette — and
              it only exists once the cell is open and you can see what you
              would be deleting. */}
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Delete this ${session.routineName} workout`}
            hitSlop={10}
            style={styles.delete}
          >
            <TrashIcon size={24} color={LIGHT.danger} />
          </Pressable>

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
                    style={[
                      styles.liftName,
                      { color: pale.ink },
                      untouched && styles.faded,
                    ]}
                  >
                    {exercise.exerciseName}
                    {untouched ? '*' : ''}
                  </Text>
                  <View style={styles.liftSets}>
                    {setRuns(exercise).map((run, j) => (
                      <Text
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
            <Text style={[styles.footnote, styles.sentence, { color: pale.ink }, styles.faded]}>
              {KCAL_DISCLAIMER}
            </Text>
          ) : null}
    </>
  ) : null

  return (
    <View ref={root} style={styles.cell}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
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
        style={[styles.head, { backgroundColor: styleFor(session.routineName).background }]}
      >
        <View style={styles.heading}>
          {/* Sentence case whatever the routine is stored as, matching the
              page titles — "Lower Body" reads as a label, "Lower body" as a
              thing you did. */}
          <Text style={[styles.name, { color: ink }]}>{sentenceCase(session.routineName)}</Text>
          <Text style={[styles.when, { color: ink }]}>
            {fullDate(session.startedAt)}, {clockTime(session.startedAt)}
          </Text>
        </View>

        {/* Only flagged when we actually know: sessions recorded before this
            was tracked have no answer either way. */}
        {session.endedEarly === true ? (
          <View style={[styles.tag, { backgroundColor: restTintFor(session.routineName) }]}>
            <Text style={[styles.tagText, { color: inkOn(restTintFor(session.routineName)) }]}>
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
            setBodyHeight((current) => (Math.abs(current - measured) > 1 ? measured : current))
          }}
        >
          {body}
        </View>
        <Animated.View style={[styles.reveal, { backgroundColor: pale.background }, reveal]}>
          <View style={styles.body}>{body}</View>
        </Animated.View>
      </View>
    </View>
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
  // The bar compresses rather than swapping: the surface, and the year that
  // joins the title, are both faded so nothing appears or jumps. The big year
  // heading below simply scrolls away under it.
  const compressed = useSharedValue(0)
  const insets = useSafeAreaInsets()
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

  const revealInView = useCallback((top, finalHeight, grow) => {
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
  }, [glide, barClearance, windowHeight, insets.bottom])

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
            await deleteSession(session.id)
            load()
          },
        },
      ],
    )
  }

  const years = sessions ? groupByWeek(sessions) : []

  return (
    <View style={styles.screen}>
      <View style={[styles.barSlot, { paddingTop: insets.top + SPACE[2] }]} pointerEvents="box-none">
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
            <BackIcon color={LIGHT.text} />
          </Pressable>
          <Text style={styles.title}>My workouts</Text>
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
            <Text style={styles.year}>{year}</Text>
            {weeks.map(({ weekStart, sessions: inWeek }) => (
              <View key={weekStart}>
                <Text style={styles.weekLabel}>{weekLabel(weekStart)}</Text>
                <View style={styles.weekList}>
                  {inWeek.map((session) => (
                    <WorkoutCell
                      key={session.id}
                      session={session}
                      open={openIds.has(session.id)}
                      built={built}
                      onToggle={() => toggle(session.id)}
                      onReveal={revealInView}
                      onDelete={() => confirmDelete(session)}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: LIGHT.bg },
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
  barYear: { ...TYPE.body, color: LIGHT.text, textAlign: 'center', overflow: 'hidden' },
  title: { ...TYPE.title, color: LIGHT.text },
  year: { ...TYPE.title, fontFamily: FONTS.bold, color: LIGHT.text, marginTop: SPACE[4] },
  weekLabel: {
    ...TYPE.label,
    color: LIGHT.textDim,
    paddingTop: SPACE[3],
    paddingBottom: SPACE[2],
  },
  weekList: { gap: SPACE[2] },
  cell: { borderRadius: RADIUS.card, overflow: 'hidden' },
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
    marginRight: SPACE[2],
    paddingTop: 7.5,
    paddingBottom: 4.5,
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
  // Level with the duration, which is the first line of the body.
  delete: { position: 'absolute', top: SPACE[3], right: SPACE[2], padding: SPACE[1] },
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
  faded: { opacity: 0.4 },
  footnote: { ...TYPE.label, marginTop: SPACE[3] },
  // A sentence, where the marks above it are labels.
  sentence: { fontFamily: FONTS.regular, textTransform: 'none', letterSpacing: 0 },
  empty: { ...TYPE.body, color: LIGHT.textDim, marginTop: SPACE[5] },
})
