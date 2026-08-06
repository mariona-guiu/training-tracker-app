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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { deleteSession, endSession, getSession, saveSession } from '../../src/db/sessions.js'
import { getSettings } from '../../src/db/settings.js'
import { inkOn, styleFor } from '../../src/data/routineStyles.js'
import { useLaunch } from '../../src/components/LaunchOverlay.jsx'
import { CheckIcon, CloseIcon, PencilIcon } from '../../src/components/WorkoutIcons.jsx'
import { EditSetSheet } from '../../src/components/EditSetSheet.jsx'
import {
  CAROUSEL_SPRING,
  DRAG_ELASTIC,
  FADE_RATE,
  SWIPE_DISTANCE,
  SWIPE_VELOCITY,
} from '../../src/data/motion.js'
import { DARK, FONTS, SPACE } from '../../src/theme/index.js'

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

const isDone = (exercise) => exercise.sets.filter((set) => set.done).length >= exercise.targetSets

// One exercise. It carries its own animated style so the fade follows the
// finger through the drag rather than waiting for it to end — read from the
// track's position, not from which exercise happens to be selected.
function ExercisePanel({
  exercise,
  width,
  position,
  trackX,
  ink,
  colour,
  live,
  editing,
  draft,
  onDraft,
  onStartEditing,
  onConfirmEditing,
  onLogSet,
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

  // A TextInput does not size itself to what is in it, so a fixed width left
  // a single digit sitting in a box built for two and pushed the unit away
  // from it. This is the web's field-sizer idea: an invisible copy of the
  // digits is laid out, measured, and its width given to the field — so the
  // unit sits exactly where it would if the two were one piece of text.
  const [fieldWidth, setFieldWidth] = useState(0)

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
            <Text
              style={[styles.figure, styles.ghost]}
              onLayout={(event) => setFieldWidth(event.nativeEvent.layout.width)}
            >
              {draft === '' ? '0' : draft}
            </Text>
            <TextInput
              value={draft}
              onChangeText={onDraft}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              style={[styles.figure, { width: Math.max(fieldWidth, 1), color: ink }]}
            />
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
            // fill from the same end. A filled one is corrected by holding
            // it, never by a tap, so a mistimed press cannot undo a set.
            onPress={() => live && !set.done && onLogSet()}
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
  const insets = useSafeAreaInsets()
  const screen = useWindowDimensions()
  const router = useRouter()
  const { beginReveal } = useLaunch()

  const width = screen.width
  const trackX = useSharedValue(0)
  const start = useSharedValue(0)
  // The selected exercise and how many there are, mirrored where the gesture
  // can read them: it runs on the UI thread and cannot see React state.
  const live = useSharedValue(0)
  const count = useSharedValue(1)
  // Whether the touch in progress turned out to be a swipe. Set the moment
  // the pan actually activates, and cleared when a fresh touch begins — so it
  // is still true when the finger lifts, which is when a press would fire.
  const swiping = useRef(false)
  const markSwiping = (value) => {
    swiping.current = value
  }

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

  // Worn on the very first frame from the colour the card handed over —
  // without its '#', which a URL parameter cannot carry — so there is no
  // flash of anything else while the session loads.
  const handed = color ? `#${color}` : null
  const colour = handed ?? (session ? styleFor(session.routineName, 0).background : DARK.bg)
  const ink = inkOn(colour)

  function goTo(next) {
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

  if (!session) return <View style={{ flex: 1, backgroundColor: colour }} />

  const exercise = session.exercises[index]
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
    update(replaceExercise({ sets }))
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
  function leave() {
    beginReveal(colour)
    router.dismissTo('/')
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
    const settings = await getSettings()
    await endSession(session.id, {
      endedEarly,
      bodyWeightKg: settings.bodyWeightKg,
      restMode: settings.restEnabled ? settings.restMode : null,
    })
    leave()
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
      <StatusBar style={ink === '#ffffff' ? 'light' : 'dark'} />

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
                colour={colour}
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
                onEditSet={setEditingSet}
                restLabel={null}
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
              <Text style={[styles.navLabel, { color: ink }]} numberOfLines={2}>
                ← {session.exercises[index - 1].exerciseName}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.navLink} />
          )}
          {!isLastExercise ? (
            <Pressable onPress={() => slideTo(index + 1)} style={styles.navLink}>
              <Text
                style={[styles.navLabel, styles.navRight, { color: ink }]}
                numberOfLines={2}
              >
                {session.exercises[index + 1].exerciseName} →
              </Text>
            </Pressable>
          ) : (
            <View style={styles.navLink} />
          )}
        </View>

        <Pressable
          onPress={() => (isLastExercise ? finish() : allSetsLogged ? slideTo(index + 1) : skip())}
          style={({ pressed }) => [
            styles.primary,
            { borderColor: ink },
            pressed && styles.primaryPressed,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: ink }]}>{primaryLabel}</Text>
        </Pressable>
      </View>

      {editingSet !== null ? (
        <EditSetSheet
          exercise={exercise}
          setIndex={editingSet}
          isLast={editingSet === logged - 1}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },

  head: { paddingHorizontal: SPACE[3] },
  routine: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.88,
    opacity: 0.85,
  },
  stepper: { flexDirection: 'row', gap: 6, marginTop: SPACE[2] },
  step: { flex: 1, height: 3, borderRadius: 999 },
  close: { alignSelf: 'flex-end', marginTop: SPACE[3], marginRight: -SPACE[2], padding: SPACE[2] },

  window: { flex: 1, overflow: 'hidden', justifyContent: 'center' },
  track: { flexDirection: 'row' },
  panel: { paddingHorizontal: SPACE[3] },
  name: { fontFamily: FONTS.bold, fontSize: 30, letterSpacing: -0.3, marginBottom: SPACE[2] },

  // The web sets line-height 1.05 on these, which works there because CSS
  // lets glyphs spill outside their line box. React Native clips to it, so
  // at 64pt the tops and tails were being cut off. The box is given room
  // for the whole glyph and the gap taken back out of the stack instead.
  values: { marginBottom: SPACE[4] },
  value: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  // The web sets line-height 1.05 on these figures, which works there
  // because CSS lets glyphs spill outside their line box. React Native clips
  // to it, so any line height below Favorit Bold's own 1.249em cuts the tops
  // and tails off. Measured from the font, that is 79.9pt at 64pt.
  //
  // So no line height is stated at all — the font decides, and nothing can
  // be cut. The tight stack the design wants is recovered by pulling the
  // second figure up by the difference (1.249em - 1.05em = 12.7pt), which a
  // margin does without touching the line box.
  valueStacked: { marginTop: -12.7 },
  figureRow: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  figurePress: { flex: 1, minWidth: 0, justifyContent: 'center' },
  figure: {
    fontFamily: FONTS.bold,
    fontSize: 64,
    letterSpacing: -1.9,
    padding: 0,
  },
  // Laid out but never seen, and taken out of the flow so it cannot push
  // anything around while it is being measured.
  ghost: { position: 'absolute', opacity: 0 },
  unit: { fontFamily: FONTS.bold, fontSize: 64, letterSpacing: -1.9 },
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

  setsLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.88,
  },
  sets: { flexDirection: 'row', gap: SPACE[2], marginTop: SPACE[2] },
  muted: { opacity: 0 },
  dot: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, backgroundColor: 'transparent' },
  dotPressed: { transform: [{ scale: 0.94 }] },

  foot: { paddingHorizontal: SPACE[3], gap: SPACE[3] },
  // Held at two lines whether or not the names need them, so the button
  // below doesn't move as you go through the workout.
  nav: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE[3] },
  navLink: { flex: 1, paddingVertical: SPACE[2] },
  navLabel: { fontFamily: FONTS.regular, fontSize: 16, lineHeight: 21.6, opacity: 0.8 },
  navRight: { textAlign: 'right' },

  primary: {
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { transform: [{ scale: 0.99 }] },
  primaryLabel: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
})
