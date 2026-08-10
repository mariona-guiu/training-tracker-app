import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { deleteSession, endSession, getSession, saveSession } from '../../src/db/sessions.js'
import { getSettings } from '../../src/db/settings.js'
import { inkOn, restTintFor, styleFor, washFor } from '../../src/data/routineStyles.js'
import { restSecondsFor } from '../../src/data/rest.js'
import { CompletionScreen } from '../../src/components/CompletionScreen.jsx'
import { useLaunch } from '../../src/components/LaunchOverlay.jsx'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  PencilIcon,
} from '../../src/components/WorkoutIcons.jsx'
import { EditSetSheet } from '../../src/components/EditSetSheet.jsx'
import { Glass } from '../../src/components/Glass.jsx'
import {
  WORKOUT_REVEAL_FADE,
  CAROUSEL_SPRING,
  DRAG_ELASTIC,
  FADE_RATE,
  SWIPE_DISTANCE,
  SWIPE_VELOCITY,
} from '../../src/data/motion.js'
import { DARK, SYSTEM_LINE, LIGHT, RADIUS, SPACE, TYPE } from '../../src/theme/index.js'

// A workout in progress. It lives outside the (tabs) group so it fills the
// display with no tab bar over it — the same split the web app makes.
//
// The layout is ported from the web screen, which is the specification:
// the routine and its stepper at the top with the close beneath, the
// exercise on a track that runs edge to edge, and the signposts and primary
// button in a foot that stays put.
//
// What travels with the finger and what does not is the whole point here.
// The exercise name, its figures and its set circles all belong to the
// exercise, so they ride the track. The signposts either side and the button
// belong to the workout, so they stay where they are and cross-fade.

// An exercise counts as done the moment one set is logged — the same
// threshold that decides whether the session is worth keeping at all, and
// what the stepper marks.
const isDone = (exercise) => exercise.sets.some((set) => set.done)

// One exercise. It carries its own animated style so the fade follows the
// finger through the drag rather than waiting for it to end — read from the
// track's position, not from which exercise happens to be selected.
function ExercisePanel({
  exercise,
  width,
  position,
  trackX,
  ink,
  live,
  editing,
  draft,
  onDraft,
  onStartEditing,
  onConfirmEditing,
  onLogSet,
  onUnlogSet,
  onEditSet,
  restLabel,
}) {
  const style = useAnimatedStyle(() => {
    const span = width || 1
    const fromCentre = Math.abs(trackX.value + position * span) / span
    return { opacity: Math.max(0, 1 - fromCentre * FADE_RATE) }
  })

  const logged = exercise.sets.filter((set) => set.done).length
  const allSetsLogged = logged >= exercise.targetSets


  // The big figure doubles as the edit control: tapping either the number or
  // the pencil turns it into a field, and the value only changes when the
  // tick is pressed.
  const figure = (field, unit, current, stacked) => {
    const active = editing === field
    // While one value is being edited the other steps back, so it is obvious
    // which number the keypad is pointed at.
    const asleep = editing !== null && !active
    return (
      <View style={[styles.value, stacked && styles.valueStacked, asleep && styles.dimmed]} key={field}>
        {active ? (
          // The unit stays on screen and steps back rather than vanishing —
          // it is what the number being typed means, and losing it mid-edit
          // leaves a bare figure.
          <View style={styles.figureRow}>
            {/* The digits on screen are ordinary text, so the row is laid
                out from them directly and the unit sits tight against them
                at every length. The field is invisible and laid over the
                top, contributing nothing to layout — only the keyboard, the
                caret and the selection.

                Measuring the text and feeding its width back as state was
                the obvious approach and the wrong one: onLayout arrives
                after the render that caused it, so the width was always a
                frame behind and every keystroke jumped. */}
            <View style={styles.field}>
              <Text style={[styles.figure, { color: ink }]}>{draft}</Text>
              <TextInput
                value={draft}
                onChangeText={onDraft}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                selectionColor={ink}
                style={[styles.figure, styles.fieldInput]}
              />
            </View>
            <Text style={[styles.unit, styles.unitDimmed, { color: ink }]}>{unit}</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => live && onStartEditing(field, current)}
            style={styles.figurePress}
          >
            <Text style={[styles.figure, { color: ink }]} numberOfLines={1}>
              {current ?? 0}
              <Text style={styles.unit}>{unit}</Text>
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={active ? `Save ${field}` : `Edit ${field}`}
          onPress={() => (active ? onConfirmEditing() : live && onStartEditing(field, current))}
          style={styles.valueAction}
        >
          {active ? <CheckIcon color={ink} /> : <PencilIcon color={ink} />}
        </Pressable>
      </View>
    )
  }

  return (
    <Animated.View style={[{ width }, styles.panel, style]} pointerEvents={live ? 'auto' : 'none'}>
      <Text style={[styles.name, { color: ink }]}>{exercise.exerciseName}</Text>

      <View style={styles.values}>
        {exercise.tracksWeight
          ? [
              figure('reps', 'reps', exercise.targetReps),
              figure('weight', 'kg', exercise.targetWeight, true),
            ]
          : figure('reps', 'sec', exercise.targetReps)}
      </View>

      {/* Steps aside while a value is being typed, so the only thing on
          screen is the number being changed. */}
      <Text style={[styles.setsLabel, { color: ink, opacity: editing ? 0 : 0.85 }]}>
        {restLabel ??
          (allSetsLogged ? 'All set!' : `Tap to log set ${logged + 1}/${exercise.targetSets}`)}
      </Text>

      <View style={[styles.sets, editing && styles.muted]} pointerEvents={editing ? 'none' : 'auto'}>
        {exercise.sets.map((set, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={set.done ? `Set ${i + 1}, logged` : `Log set ${i + 1}`}
            accessibilityHint={set.done ? 'Long press to correct this set' : undefined}
            // An empty circle logs the next set — any of them, since they
            // fill from the same end. Tapping a filled one takes it back,
            // and holding it opens the sheet to correct what was recorded.
            onPress={() => live && (set.done ? onUnlogSet(i) : onLogSet())}
            onLongPress={() => live && set.done && onEditSet(i)}
            style={({ pressed }) => [
              styles.dot,
              { borderColor: ink },
              set.done && { backgroundColor: ink },
              pressed && styles.dotPressed,
            ]}
          />
        ))}
      </View>
    </Animated.View>
  )
}

export default function WorkoutMode() {
  const { sessionId, color } = useLocalSearchParams()
  const [session, setSession] = useState(null)
  const [index, setIndex] = useState(0)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const [editingSet, setEditingSet] = useState(null)
  const [settings, setSettings] = useState(null)
  const [restStartedAt, setRestStartedAt] = useState(null)
  const [restLeft, setRestLeft] = useState(0)
  const [finished, setFinished] = useState(false)
  const insets = useSafeAreaInsets()
  const screen = useWindowDimensions()
  const router = useRouter()
  const leaving = useRef(false)
  const { beginReveal } = useLaunch()

  const width = screen.width
  const trackX = useSharedValue(0)
  const start = useSharedValue(0)
  // The selected exercise and how many there are, mirrored where the gesture
  // can read them: it runs on the UI thread and cannot see React state.
  const live = useSharedValue(0)
  const count = useSharedValue(1)
  // The rest sweep. Driven on the UI thread rather than re-rendered every
  // frame — moving a block of colour sixty times a second in JavaScript
  // would cost more than it buys and would stutter the swipe.
  const sweep = useSharedValue(0)
  const sweepOn = useSharedValue(0)
  // Whether the touch in progress turned out to be a swipe. Set the moment
  // the pan actually activates, and cleared when a fresh touch begins — so it
  // is still true when the finger lifts, which is when a press would fire.
  const swiping = useRef(false)
  const markSwiping = (value) => {
    swiping.current = value
  }

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    getSession(sessionId).then((loaded) => {
      if (!loaded) return
      setSession(loaded)
      setIndex(loaded.currentExerciseIndex)
      live.value = loaded.currentExerciseIndex
      count.value = loaded.exercises.length
      trackX.value = -loaded.currentExerciseIndex * width
    })
  }, [sessionId, width, trackX, live, count])

  // The exercise on screen. Derived here rather than after the `if (!session)`
  // guard below, because the rest countdown is driven by a hook and hooks
  // cannot run after an early return — so anything they read has to exist by
  // now, session or no session.
  const exercise = session?.exercises[index]

  // Asked of the exercise rather than of the session, so a stretch at the end
  // of a lower body workout rests like a stretch and not like a squat.
  const restSeconds = session
    ? restSecondsFor(kind, settings?.restMode, exercise)
    : 0

  // Only the number on screen is kept in JavaScript, and only when the second
  // it shows actually changes. The colour itself is already moving on the UI
  // thread and needs nothing from here.
  useEffect(() => {
    if (restStartedAt === null) return
    const tick = setInterval(() => {
      const remaining = restSeconds - (Date.now() - restStartedAt) / 1000
      if (remaining <= 0) {
        setRestStartedAt(null)
        setRestLeft(0)
        return
      }
      setRestLeft((shown) => (Math.ceil(remaining) === shown ? shown : Math.ceil(remaining)))
    }, 200)
    return () => clearInterval(tick)
  }, [restStartedAt, restSeconds])

  // Worn on the very first frame from the colour the card handed over —
  // without its '#', which a URL parameter cannot carry — so there is no
  // flash of anything else while the session loads.
  const handed = color ? `#${color}` : null
  // The kind of session, which colour, rest length and the calorie rate all
  // follow. Falls back to the name for anything recorded before the type was
  // stored.
  const kind = session?.routineType ?? session?.routineName
  const colour = handed ?? (session ? styleFor(kind, 0).background : DARK.bg)
  const ink = inkOn(colour)
  // Whether the routine's colour asked for white ink, which is the same
  // question the status bar and the button's material both need answering.
  const inkIsLight = ink === LIGHT.onInk

  function goTo(next) {
    stopRest()
    setEditing(null)
    setIndex(next)
    setSession((current) => {
      if (!current) return current
      const updated = { ...current, currentExerciseIndex: next }
      saveSession(updated)
      return updated
    })
  }

  function slideTo(next) {
    live.value = next
    trackX.value = withSpring(-next * width, CAROUSEL_SPRING)
    goTo(next)
  }

  const pan = Gesture.Pan()
    .enabled(editing === null)
    // Only a deliberately horizontal drag takes over the track, so a tap on
    // a set circle is never swallowed by it.
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onBegin(() => {
      start.value = trackX.value
      runOnJS(markSwiping)(false)
    })
    .onStart(() => {
      runOnJS(markSwiping)(true)
    })
    .onUpdate((event) => {
      const min = -(count.value - 1) * width
      let next = start.value + event.translationX
      // Past either end there is nothing to move on to, so the track gives a
      // little rather than following the finger.
      if (next > 0) next = next * DRAG_ELASTIC
      else if (next < min) next = min + (next - min) * DRAG_ELASTIC
      trackX.value = next
    })
    .onEnd((event) => {
      const far = width * SWIPE_DISTANCE
      const forward = event.translationX < -far || event.velocityX < -SWIPE_VELOCITY
      const back = event.translationX > far || event.velocityX > SWIPE_VELOCITY
      let target = live.value
      if (forward) target = live.value + 1
      else if (back) target = live.value - 1
      // Past either end there is nowhere to go, so a swipe outwards is a
      // short one however far it travelled.
      if (target < 0 || target >= count.value) target = live.value

      // Stated outright every time, including when nothing changed. On the
      // web the snap-back had to be asked for by hand: the track's resting
      // position was derived from the selected exercise, so a short drag
      // left the target unchanged, the animation saw nothing to do, and the
      // screen simply stayed where the finger let go.
      trackX.value = withSpring(-target * width, CAROUSEL_SPRING)

      if (target !== live.value) {
        live.value = target
        runOnJS(goTo)(target)
      }
    })

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: trackX.value }] }))
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweepOn.value,
    transform: [{ scaleX: sweep.value }],
  }))

  if (!session) return <View style={{ flex: 1, backgroundColor: colour }} />

  const logged = exercise.sets.filter((set) => set.done).length
  const allSetsLogged = logged >= exercise.targetSets

  const isLastExercise = index === session.exercises.length - 1

  async function update(next) {
    setSession(next)
    await saveSession(next)
  }

  function replaceExercise(changes) {
    return {
      ...session,
      exercises: session.exercises.map((ex, i) => (i === index ? { ...ex, ...changes } : ex)),
    }
  }

  // Grows rather than drains: the leading edge travels left to right, and
  // reaching the far side means rest is over. It clears itself afterwards
  // rather than vanishing on the tick.
  function startRest() {
    setRestStartedAt(Date.now())
    setRestLeft(restSeconds)
    sweep.value = 0
    sweepOn.value = 1
    sweep.value = withTiming(1, { duration: restSeconds * 1000, easing: Easing.linear }, (done) => {
      'worklet'
      if (done) sweepOn.value = withTiming(0, { duration: WORKOUT_REVEAL_FADE.duration })
    })
  }

  // A rest belongs to the exercise it was earned on. Moving to another one
  // ends it — otherwise the sweep carries across and the new exercise looks
  // like it started a rest of its own before a single set was logged.
  function stopRest() {
    if (restStartedAt === null) return
    setRestStartedAt(null)
    sweepOn.value = withTiming(0, { duration: WORKOUT_REVEAL_FADE.duration })
  }

  // The circles fill from the same end, so any empty one logs the next.
  function logNextSet() {
    const next = exercise.sets.findIndex((set) => !set.done)
    if (next === -1) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const sets = exercise.sets.map((set, j) =>
      j !== next
        ? set
        : {
            done: true,
            reps: exercise.targetReps,
            weight: exercise.targetWeight ?? null,
            completedAt: Date.now(),
          },
    )
    update(replaceExercise({ sets, skipped: false }))
    // Logging is the only signal that rest is over, and the only one that
    // starts the next. Turned off in settings, logging a set simply logs a
    // set.
    if (settings?.restEnabled !== false) startRest()
  }

  function unlogSet(setIndex) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    update(replaceExercise({ sets: exercise.sets.map((set, j) => (j === setIndex ? { done: false } : set)) }))
  }

  function saveSetEdit(reps, weight) {
    const sets = exercise.sets.map((set, j) =>
      j !== editingSet
        ? set
        : {
            ...set,
            reps: reps.trim() === '' ? set.reps : Number(reps),
            weight: weight.trim() === '' ? set.weight : Number(weight),
          },
    )
    update(replaceExercise({ sets }))
    setEditingSet(null)
  }

  function removeSet() {
    const sets = exercise.sets.map((set, j) => (j === editingSet ? { done: false } : set))
    update(replaceExercise({ sets }))
    setEditingSet(null)
  }

  function startEditing(field, current) {
    // A finger that happened to be resting on the number while swiping must
    // not open an edit as well. The carousel claims the touch, but the press
    // still lands on release, so it is refused here instead.
    if (swiping.current) return
    setEditing(field)
    // A weight that has never been lifted is stored as null but shown as 0,
    // so the edit starts from what is on screen rather than from nothing.
    setDraft(String(current ?? 0))
  }

  // Abandons the edit and leaves the value as it was. Deliberately not wired
  // to the field's own blur: pressing the tick blurs it first, which would
  // cancel the edit a moment before the tick could commit it.
  function cancelEditing() {
    Keyboard.dismiss()
    setEditing(null)
  }

  // The tick is the only thing that commits. Confirming an empty field keeps
  // whatever was there, so a stray press cannot blank a target.
  function confirmEditing() {
    if (!editing) return
    Keyboard.dismiss()
    const value = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(value) && value >= 0) {
      update(replaceExercise(editing === 'reps' ? { targetReps: value } : { targetWeight: value }))
    }
    setEditing(null)
  }

  function skip() {
    update(replaceExercise({ skipped: true }))
    if (!isLastExercise) slideTo(index + 1)
  }

  // Everything logged across the whole workout, not just this exercise —
  // what decides whether this session happened at all.
  const totalLogged = session.exercises.reduce(
    (n, ex) => n + ex.sets.filter((set) => set.done).length,
    0,
  )

  // The colour is handed back still covering the screen: whichever tab we
  // land on opens underneath it and dissolves it away, so there is never a
  // frame of bare page between the two.
  // Latched, like the card that opened this screen. Both buttons on the
  // completion screen come through here, and a second tap before the dismissal
  // commits would begin the reveal twice and queue a second navigation — which
  // is how two identical History views ended up stacked from Stats.
  //
  // Never reopened, and does not need to be: leaving dismisses this screen. If
  // the dismissal itself failed the buttons would be dead, but so would the
  // navigation they were asking for.
  function leave(then) {
    if (leaving.current) return
    leaving.current = true
    beginReveal(colour)
    router.dismissTo('/')
    // The tab is switched after the dismissal rather than dismissed straight
    // to it: dismissTo only dismisses when its target is already in the
    // history, and Stats never is.
    if (then) setTimeout(() => router.navigate(then), 0)
  }

  // Opening a workout and doing nothing should leave no trace. Skipping every
  // exercise and pressing finish is still a session in which nothing was
  // done, and it is discarded the same way — as is logging a set and then
  // unlogging it.
  async function discard() {
    await deleteSession(session.id)
    leave()
  }

  async function close(endedEarly) {
    Haptics.notificationAsync(
      endedEarly
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success,
    )
    // The body weight and rest setting in force are written onto the session
    // rather than read back later: what a workout cost depends on the person
    // who did it that day, and both of those change.
    const current = await getSettings()
    const ended = await endSession(session.id, {
      endedEarly,
      bodyWeightKg: current.bodyWeightKg,
      restMode: current.restEnabled ? current.restMode : null,
    })
    // Walking out of a workout goes straight back. Seeing one through earns
    // the completion screen.
    if (endedEarly) {
      leave()
      return
    }
    setSession(ended)
    setFinished(true)
  }

  function finish() {
    if (totalLogged === 0) return discard()
    return close(false)
  }

  // Leaving with nothing logged needs no confirming — there is nothing to
  // lose. Leaving partway through a real workout does.
  function requestExit() {
    if (totalLogged === 0) return discard()
    Alert.alert(
      'End workout?',
      `You've logged ${totalLogged} ${totalLogged === 1 ? 'set' : 'sets'}. This will be saved as ended early.`,
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'End workout', style: 'destructive', onPress: () => close(true) },
      ],
    )
  }

  let primaryLabel = 'Skip'
  if (isLastExercise) primaryLabel = 'Finish workout'
  else if (allSetsLogged) primaryLabel = 'Next exercise'

  if (finished) {
    return (
      <CompletionScreen
        session={session}
        colour={colour}
        ink={ink}
        onSeeHistory={() => leave({ pathname: '/history', params: { expand: session.id } })}
        onAgain={() => leave()}
      />
    )
  }

  return (
    <View
      style={[styles.screen, { backgroundColor: colour }]}
      // The tick is the only thing that saves; a tap anywhere else abandons
      // the edit. Done with the responder system rather than an overlay,
      // because an overlay has to be above everything to catch every tap and
      // below the tick so the tick still works, and it cannot be both.
      // React Native asks children first and only offers the touch here if
      // none of them claimed it — so the tick, the pencils and the field
      // keep working, and everything else lands on this.
      //
      // Attached only while editing, never merely declining. A view carrying
      // these props joins the touch negotiation even when it answers false,
      // which was enough to stop the carousel's gesture claiming a swipe —
      // so the number under the finger took the touch as a press and opened
      // an edit mid-swipe instead.
      onStartShouldSetResponder={editing !== null ? () => true : undefined}
      onResponderRelease={editing !== null ? cancelEditing : undefined}
    >
      {/* The clock and battery have to stay readable on the routine's colour,
          so they follow the same ink the screen picked. */}
      <StatusBar style={inkIsLight ? 'light' : 'dark'} />

      {/* Behind everything and unreachable: the workout stays usable while
          rest drains — you can log the next set, edit a value or move on
          without waiting for it. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.sweep,
          { backgroundColor: restTintFor(kind) },
          sweepStyle,
        ]}
      />

      <View style={[styles.head, { paddingTop: insets.top + SPACE[3], opacity: editing ? 0 : 1 }]}>
        <Text style={[styles.routine, { color: ink }]}>{session.routineName} workout</Text>

        {/* Everything up to where you've reached is marked, not only what
            was done — moving past an exercise with the arrows leaves it
            neither done nor skipped, and a hole in the middle of the bar
            reads as a glitch rather than as information. */}
        <View style={styles.stepper}>
          {session.exercises.map((ex, i) => (
            <View
              key={ex.exerciseId + i}
              style={[
                styles.step,
                { backgroundColor: ink, opacity: i <= index || isDone(ex) || ex.skipped ? 1 : 0.3 },
              ]}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close workout"
          onPress={requestExit}
          style={styles.close}
        >
          <CloseIcon color={ink} />
        </Pressable>
      </View>

      {/* Edge to edge deliberately: the exercises reach and appear from the
          very edge of the screen, with no margin holding them back. */}
      <GestureDetector gesture={pan}>
        <View style={styles.window}>
          <Animated.View style={[styles.track, track]}>
            {session.exercises.map((ex, i) => (
              <ExercisePanel
                key={`${ex.exerciseId}-${i}`}
                exercise={ex}
                width={width}
                position={i}
                trackX={trackX}
                ink={ink}
                // Only the exercise you're on responds to anything. The
                // others are along for the ride, so a tap that lands on a
                // neighbour mid-swipe can't log a set on it.
                live={i === index}
                editing={i === index ? editing : null}
                draft={draft}
                onDraft={setDraft}
                onStartEditing={startEditing}
                onConfirmEditing={confirmEditing}
                onLogSet={logNextSet}
                onUnlogSet={unlogSet}
                onEditSet={setEditingSet}
                restLabel={
                  i === index && restStartedAt !== null
                    ? `Rest ${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, '0')}`
                    : null
                }
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={[styles.foot, { paddingBottom: insets.bottom + SPACE[3] }]}>
        {/* These change with the exercise but shouldn't travel with it —
            they're signposts to either side, so they stay in place while the
            exercise itself slides. */}
        <View style={[styles.nav, { opacity: editing ? 0 : 1 }]}>
          {index > 0 ? (
            <Pressable onPress={() => slideTo(index - 1)} style={styles.navLink}>
              {/* The arrow is its own element rather than a character inside
                  the name. Inline, a name that wrapped either pushed the arrow
                  onto a line of its own or left it stranded beside the first
                  line — the arrow points at the whole name, so it centres
                  against the whole block. */}
              <View style={styles.navArrow}>
                <ChevronLeftIcon color={ink} />
              </View>
              <Text style={[styles.navLabel, { color: ink }]} numberOfLines={2}>
                {session.exercises[index - 1].exerciseName}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.navLink} />
          )}
          {!isLastExercise ? (
            <Pressable
              onPress={() => slideTo(index + 1)}
              style={[styles.navLink, styles.navLinkRight]}
            >
              <Text
                style={[styles.navLabel, styles.navRight, { color: ink }]}
                numberOfLines={2}
              >
                {session.exercises[index + 1].exerciseName}
              </Text>
              <View style={styles.navArrow}>
                <ChevronRightIcon color={ink} />
              </View>
            </Pressable>
          ) : (
            <View style={styles.navLink} />
          )}
        </View>

        <Pressable
          onPress={() => (isLastExercise ? finish() : allSetsLogged ? slideTo(index + 1) : skip())}
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
        >
          {/* The system's material where the phone has it, a blur where it does
              not — the same component the tab bar and the restack button use, so
              all three become real glass together rather than one at a time.
              The wash underneath is the ink at a tenth, which is what the design
              draws and what the blur needs to read as a surface at all.

              Tint follows the ink: a light glass lifts a button off a dark
              routine colour, a dark one settles it into a pale one. */}
          <Glass
            intensity={40}
            // The frost reinforces the ground rather than inverting it. Tinting
            // a pale routine dark was what made this read as a grey button laid
            // on top: the colour left the button while the rest of the screen
            // kept it.
            tint={inkIsLight ? 'dark' : 'light'}
            style={styles.primarySurface}
            fallback={
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: washFor(kind) },
                ]}
              />
            }
          >
            <Text style={[styles.primaryLabel, { color: ink }]}>{primaryLabel}</Text>
          </Glass>
        </Pressable>
      </View>

      {editingSet !== null ? (
        <EditSetSheet
          exercise={exercise}
          setIndex={editingSet}
          colour={colour}
          ink={ink}
          onSave={saveSetEdit}
          onRemove={removeSet}
          onClose={() => setEditingSet(null)}
        />
      ) : null}
    </View>
  )
}

// Funnel's own line height, read from the font — ascent 1200 plus descent
// 300 on a 1200 unit em — and the tighter one the design asks for.
// React Native clips to the line box where CSS lets glyphs spill, so the box
// keeps the font's own height and the difference is taken back out with a
// margin, which does not clip. Stated as ratios so this follows the type
// scale rather than staying a number measured against a 64pt figure.
const DESIGN_LINE = 1.022

const styles = StyleSheet.create({
  screen: { flex: 1 },

  head: { paddingHorizontal: SPACE[4] },
  routine: { ...TYPE.caption, textTransform: 'uppercase', opacity: 0.85 },
  stepper: { flexDirection: 'row', gap: SPACE[2], marginTop: SPACE[2] },
  step: { flex: 1, height: 3, borderRadius: RADIUS.pill },
  close: { alignSelf: 'flex-end', marginTop: SPACE[3], marginRight: -SPACE[2], padding: SPACE[2] },

  window: { flex: 1, overflow: 'hidden', justifyContent: 'center' },
  // Grows from the left edge, so the leading edge travels across and reaching
  // the far side means rest is over.
  sweep: { transformOrigin: 'left' },
  track: { flexDirection: 'row' },
  panel: { paddingHorizontal: SPACE[4] },
  name: { ...TYPE.heading, marginBottom: SPACE[2] },

  // The web sets line-height 1.05 on these, which works there because CSS
  // lets glyphs spill outside their line box. React Native clips to it, so
  // at 64pt the tops and tails were being cut off. The box is given room
  // for the whole glyph and the gap taken back out of the stack instead.
  values: { marginBottom: SPACE[4] },
  value: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  // The web sets line-height 1.05 on these figures, which works there
  // because CSS lets glyphs spill outside their line box. React Native clips
  // to it, so any line height below the font's own 1.25em cuts the tops
  // and tails off. Measured from the font, that is 79.9pt at 64pt.
  //
  // So no line height is stated at all — the font decides, and nothing can
  // be cut. The tight stack the design wants is recovered by pulling the
  // second figure up by the difference (1.249em - 1.05em = 12.7pt), which a
  // margin does without touching the line box.
  valueStacked: { marginTop: -(SYSTEM_LINE - DESIGN_LINE) * TYPE.hero.fontSize },
  figureRow: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  figurePress: { flex: 1, minWidth: 0, justifyContent: 'center' },
  figure: { ...TYPE.hero, padding: 0 },
  // Room for the caret to stand in once every digit has been deleted.
  field: { minWidth: 16 },
  // Over the visible digits and exactly aligned with them, but drawing none
  // of its own — the caret and the selection show, the glyphs do not.
  fieldInput: { ...StyleSheet.absoluteFillObject, color: 'transparent' },
  unit: { ...TYPE.hero },
  unitDimmed: { opacity: 0.45 },
  dimmed: { opacity: 0.35 },
  // Centred against the figure explicitly rather than relying on the row to
  // work it out: the figure's box is nearly twice the button's height, and
  // whichever of them decides the row's height decides where this lands.
  valueAction: {
    width: 44,
    height: 44,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },

  setsLabel: { ...TYPE.caption, textTransform: 'uppercase' },
  sets: { flexDirection: 'row', gap: 15, marginTop: SPACE[2] },
  muted: { opacity: 0 },
  dot: { width: 48, height: 48, borderRadius: RADIUS.pill, borderWidth: 2, backgroundColor: 'transparent' },
  dotPressed: { transform: [{ scale: 0.94 }] },

  foot: { paddingHorizontal: SPACE[4], gap: SPACE[3] },
  // Held at two lines whether or not the names need them, so the button
  // below doesn't move as you go through the workout.
  nav: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE[3] },
  navLink: {
    flex: 1,
    paddingVertical: SPACE[2],
    flexDirection: 'row',
    // Against the whole name, not its first line, so a wrapped name keeps its
    // arrow beside the middle of it.
    alignItems: 'center',
    gap: SPACE[1],
  },
  navLinkRight: { justifyContent: 'flex-end' },
  // Sized and faded with the name it belongs to, but never wrapping or
  // shrinking — it is one glyph and the name takes what is left.
  // Sized and faded with the name it belongs to, and never shrinking — it is
  // one mark and the name takes what is left.
  navArrow: { opacity: 0.8 },
  navLabel: {
    ...TYPE.body,
    letterSpacing: 16 * -0.01,
    lineHeight: 21.6,
    opacity: 0.8,
    flexShrink: 1,
  },
  navRight: { textAlign: 'right' },

  // Filled rather than outlined, at a tenth of the ink — so it reads as a
  // panel of the screen rather than a shape drawn on it, and works against
  // whichever ink the routine's colour asks for.
  primary: { height: 52 },
  // The surface itself, which has to clip: a blur ignores a radius on anything
  // above it, so the rounding and the overflow belong on the blurred view.
  primarySurface: {
    flex: 1,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { transform: [{ scale: 0.99 }] },
  primaryLabel: { ...TYPE.control },
})
