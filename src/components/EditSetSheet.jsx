import { useCallback, useEffect, useRef, useState } from 'react'
import {
  InputAccessoryView,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { CloseIcon } from './WorkoutIcons.jsx'
import { FONTS, SPACE } from '../theme/index.js'

// Correcting a set already logged.
//
// Reached by holding the circle rather than tapping it — a tap logs a set or
// takes it back, which is the thing being done every thirty seconds with
// tired hands, so it stays the cheapest gesture.
//
// The panel is an InputAccessoryView: iOS's own mechanism for something
// attached to the top of the keyboard. That matters more than it sounds.
// Every earlier attempt animated the panel alongside the keyboard and tried
// to keep the two in step — matching the system's duration and easing,
// starting on the tap rather than on the notification, removing the entrance
// so both covered the same distance — and every one of them staggered. Two
// reasons: the panel and the keyboard were covering different distances, and
// a JavaScript animation cannot be relied on to begin in the same frame as a
// native one.
//
// There is nothing to keep in step here. The panel is part of the keyboard,
// so it moves when the keyboard moves. It also lands flush against it, which
// removes the notches its rounded top corners used to leave.
//
// iOS only. Android would need this drawn and animated by hand.
const ACCESSORY = 'edit-set-sheet'

// How long iOS takes to put its keyboard away — used only to hold the panel
// on screen long enough to ride it down before this unmounts.
const KEYBOARD_MS = 250

// A caret of our own, drawn rather than the system's. 3pt wide and 0.72em
// tall on a hard 1.1s blink, matching .caret in the web app's index.css.
function Caret({ ink }) {
  const on = useSharedValue(1)

  useEffect(() => {
    on.value = withRepeat(
      withSequence(
        withDelay(550, withTiming(0, { duration: 0 })),
        withDelay(550, withTiming(1, { duration: 0 })),
      ),
      -1,
    )
  }, [on])

  const blink = useAnimatedStyle(() => ({ opacity: on.value }))

  return (
    <Animated.View style={[styles.caret, { backgroundColor: ink }, blink]} pointerEvents="none" />
  )
}

// One editable figure. The whole row is the tap target, the digits are
// ordinary text so the unit stays tight against them at every length, and the
// real field is parked out of sight and focused by hand — the pattern the web
// app settled on. A transparent field laid over the digits is only as big as
// the number, tapping it is unreliable, and a tap that misses takes the touch
// away and dismisses the keypad.
function Figure({ value, unit, ink, active, asleep, onPress }) {
  return (
    <Pressable
      style={[styles.value, asleep && styles.dimmed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${unit} for this set`}
    >
      <Text style={[styles.figure, { color: ink }]}>{value}</Text>
      {active ? <Caret ink={ink} /> : null}
      {/* The unit steps back only while its own value is being typed, so the
          resting panel reads as one solid figure. */}
      <Text style={[styles.unit, active && styles.unitDimmed, { color: ink }]}>{unit}</Text>
    </Pressable>
  )
}

export function EditSetSheet({ exercise, setIndex, colour, ink, onSave, onRemove, onClose }) {
  const set = exercise.sets[setIndex]
  const [reps, setReps] = useState(String(set.reps ?? 0))
  // Shown as 0 rather than left blank, the same as on the workout screen: a
  // weight never lifted is stored as null, but 0 is what it means.
  const [weight, setWeight] = useState(String(set.weight ?? 0))
  const [active, setActive] = useState('reps')
  const field = useRef(null)
  const unit = exercise.tracksWeight ? 'kg' : 'sec'

  // One parked field for both figures, not one each.
  //
  // An InputAccessoryView belongs to whichever input is focused, so moving
  // focus from one field to another detaches it and reattaches it — and in
  // between, the panel drops off the screen. With a single field there is no
  // handover: switching values only changes which number this is pointed at,
  // and focus never moves. Everything on screen is drawn anyway, so a second
  // input was never buying anything.
  const value = active === 'reps' ? reps : weight
  const onChange = (text) =>
    active === 'reps'
      ? setReps(text.replace(/[^0-9]/g, ''))
      : setWeight(text.replace(/[^0-9.]/g, ''))

  // Puts the keyboard away first and waits long enough for the panel to ride
  // it down, rather than having both vanish the moment this unmounts.
  const leave = useCallback((then) => {
    Keyboard.dismiss()
    setTimeout(then, KEYBOARD_MS)
  }, [])

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        entering={FadeIn.duration(KEYBOARD_MS)}
        exiting={FadeOut.duration(180)}
        style={StyleSheet.absoluteFill}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={() => leave(onClose)}
        />
      </Animated.View>

      {/* Parked, focusable and never seen. It holds what is typed and is
          what keeps the panel on screen; everything visible is drawn. */}
      <TextInput
        ref={field}
        value={value}
        onChangeText={onChange}
        // Reps strips anything but digits, so the decimal key does nothing
        // there — and one keypad for both avoids iOS dismissing and
        // re-presenting the keyboard when the type would change.
        keyboardType="decimal-pad"
        inputAccessoryViewID={ACCESSORY}
        autoFocus
        caretHidden
        style={styles.parked}
      />

      <InputAccessoryView nativeID={ACCESSORY} backgroundColor="transparent">
        {/* No corner radius on this wrapper, so the skirt below is free to
            overflow it. Put inside the rounded panel instead, the radius
            clips it away and the notches stay. */}
        <View style={styles.assembly}>
          <View style={[styles.sheet, { backgroundColor: colour }]}>
            <View style={styles.head}>
              <Text style={[styles.title, { color: ink }]}>
                Editing set {setIndex + 1}/{exercise.targetSets}
              </Text>
              <Pressable
                onPress={() => leave(onClose)}
                accessibilityLabel="Close without saving"
                accessibilityRole="button"
                style={styles.close}
              >
                <CloseIcon size={26} color={ink} />
              </Pressable>
            </View>

            <View style={styles.values}>
              <Figure
                value={reps}
                unit={exercise.tracksWeight ? 'reps' : unit}
                ink={ink}
                active={active === 'reps'}
                asleep={active !== 'reps'}
                onPress={() => {
                  setActive('reps')
                  field.current?.focus()
                }}
              />
              {exercise.tracksWeight ? (
                <Figure
                  value={weight}
                  unit={unit}
                  ink={ink}
                  active={active === 'weight'}
                  asleep={active !== 'weight'}
                  onPress={() => {
                    setActive('weight')
                    field.current?.focus()
                  }}
                />
              ) : null}
            </View>

            <Pressable
              onPress={() => leave(() => onSave(reps, weight))}
              style={[styles.save, { backgroundColor: ink }]}
            >
              <Text style={[styles.saveLabel, { color: colour }]}>Save</Text>
            </Pressable>

            {/* Offered for every set, not only the one at the end of the row.
              Tapping a circle already takes any set back, so the row can have
              a gap in it whatever this does. */}
            <Pressable onPress={() => leave(onRemove)} style={styles.remove}>
              <Text style={[styles.removeLabel, { color: ink }]}>Remove set</Text>
            </Pressable>
          </View>

          {/* Carries the panel's colour on below its own bottom edge. The
              keypad's top corners are rounded, and without this the two
              notches they leave show what is behind. Hidden by the keypad
              itself everywhere else. */}
          <View style={[styles.skirt, { backgroundColor: colour }]} />
        </View>
      </InputAccessoryView>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  assembly: {},
  skirt: { position: 'absolute', left: 0, right: 0, top: '100%', height: 44 },
  // Sits flush on top of the keyboard, so it needs no bottom padding of its
  // own and leaves no gap for the backdrop to show through.
  sheet: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 18,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.96,
    opacity: 0.85,
  },
  close: { padding: SPACE[2], margin: -SPACE[2] },
  values: { gap: 0 },
  // The whole row is the target, so it is never a question of hitting the
  // digits themselves.
  value: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE[1] },
  // While one value is being edited the other steps back, so it is obvious
  // which number the keypad is pointed at.
  dimmed: { opacity: 0.35 },
  // In the flow rather than laid over the digits, matching .caret on the web:
  // outside it, the caret landed on top of the unit whenever the number was
  // short or had been cleared.
  caret: { width: 3, height: 32, marginLeft: 2, marginRight: 1 },
  parked: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, padding: 0 },
  // No line height stated: Favorit's own is 1.249em and anything below it
  // clips, because React Native cuts text to its line box where CSS lets it
  // spill out. See native/CLAUDE.md.
  figure: { fontFamily: FONTS.bold, fontSize: 44, letterSpacing: -1.3 },
  unit: { fontFamily: FONTS.bold, fontSize: 44, letterSpacing: -1.3 },
  unitDimmed: { opacity: 0.45 },
  save: {
    minHeight: 62,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  remove: { alignItems: 'center', paddingVertical: SPACE[2] },
  removeLabel: { fontFamily: FONTS.regular, fontSize: 16, opacity: 0.7 },
})
