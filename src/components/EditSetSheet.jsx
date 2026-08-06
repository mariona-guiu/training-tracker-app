import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { CloseIcon } from './WorkoutIcons.jsx'
import { SHEET_SPRING } from '../data/motion.js'
import { FONTS, SPACE } from '../theme/index.js'

// Correcting a set already logged.
//
// Reached by holding the circle rather than tapping it — a tap logs a set or
// takes it back, which is the thing being done every thirty seconds with
// tired hands, so it stays the cheapest gesture.
//
// The panel is animated by hand rather than hung off the keyboard as an
// InputAccessoryView, so its pace is ours to choose. An accessory is in step
// with the keyboard by construction, but it also moves at the keyboard's
// speed, and that is brisker than this wants to be. Commit 112b2be has the
// attached version if this needs putting back.
//
// What makes hand-timing workable is the skirt: the panel's colour runs a
// long way below its own bottom edge, so it is behind the keypad whatever
// either of them is doing. There is no seam between the two to keep shut, and
// the only thing that can be seen moving is the panel's top edge. Every
// earlier attempt had a visible join, which is why they all read as staggered
// however the timing was tuned.

// How long iOS takes to put its keyboard away, used to hold the panel on
// screen long enough to leave with it before this unmounts.
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
function Figure({ value, unit, ink, active, asleep, stacked, onPress }) {
  return (
    <Pressable
      style={[styles.value, stacked && styles.stacked, asleep && styles.dimmed]}
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
  const [measured, setMeasured] = useState(false)
  const field = useRef(null)
  const height = useRef(0)
  const unit = exercise.tracksWeight ? 'kg' : 'sec'

  // One parked field for both figures, not one each. Switching values only
  // changes which number it is pointed at, so focus never moves and the keypad
  // never flickers. Everything on screen is drawn anyway.
  const value = active === 'reps' ? reps : weight
  const onChange = (text) =>
    active === 'reps'
      ? setReps(text.replace(/[^0-9]/g, ''))
      : setWeight(text.replace(/[^0-9.]/g, ''))

  // Where the panel sits: its own height means fully below the screen, a
  // negative value means that far above the bottom edge.
  const y = useSharedValue(0)
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))

  const measure = useCallback(
    (event) => {
      if (height.current) return
      height.current = event.nativeEvent.layout.height
      y.value = height.current
      setMeasured(true)
    },
    [y],
  )

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardWillShow', (event) => {
      y.value = withSpring(-event.endCoordinates.height, SHEET_SPRING)
    })
    const hidden = Keyboard.addListener('keyboardWillHide', () => {
      y.value = withTiming(height.current, { duration: KEYBOARD_MS })
    })
    return () => {
      shown.remove()
      hidden.remove()
    }
  }, [y])

  // Puts the keyboard away first and waits long enough for the panel to leave
  // with it, rather than having both vanish the moment this unmounts.
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

      {/* Parked, focusable and never seen. It holds what is typed and summons
          the keypad; everything visible is drawn. */}
      <TextInput
        ref={field}
        value={value}
        onChangeText={onChange}
        // Reps strips anything but digits, so the decimal key does nothing
        // there — and one keypad for both means iOS never dismisses and
        // re-presents it on a change of type.
        keyboardType="decimal-pad"
        autoFocus
        caretHidden
        style={styles.parked}
      />

      <Animated.View
        style={[styles.dock, slide, !measured && styles.unmeasured]}
        onLayout={measure}
        pointerEvents="box-none"
      >
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
                stacked
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
            <Text style={[styles.saveLabel, { color: colour }]}>Save changes</Text>
          </Pressable>

          {/* Offered for every set, not only the one at the end of the row.
              Tapping a circle already takes any set back, so the row can have
              a gap in it whatever this does. */}
          <Pressable onPress={() => leave(onRemove)} style={styles.remove}>
            <Text style={[styles.removeLabel, { color: ink }]}>Remove set</Text>
          </Pressable>
        </View>

        {/* The panel's colour, carried far enough below its own bottom edge
            that it sits behind the keypad whatever the two of them are doing.
            This is what lets the panel be timed by hand at all: no seam to
            keep shut, so nothing shows if it settles a moment after the keypad
            does. It also fills the notches the keypad's rounded top corners
            leave. */}
        <View style={[styles.skirt, { backgroundColor: colour }]} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Held back for the one frame between being laid out and knowing how tall it
  // is, so it is never seen sitting in the wrong place.
  unmeasured: { opacity: 0 },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 18,
    // The panel's bottom edge rests on the keypad, so this is the whole of
    // the distance between the buttons and it.
    paddingBottom: 8,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  skirt: { position: 'absolute', left: 0, right: 0, top: '100%', marginTop: -1, height: 600 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.96,
    opacity: 0.85,
  },
  close: { padding: SPACE[2], margin: -SPACE[2] },
  // The panel is anchored to the keypad, so opening this up lifts the figures
  // rather than pushing the buttons down. Favorit already leaves 22.5pt below
  // the baseline at 72pt, which this is on top of.
  values: { marginBottom: 36 },
  // The whole row is the target, so it is never a question of hitting the
  // digits themselves.
  value: { flexDirection: 'row', alignItems: 'center' },
  // 20pt of visible separation, which is not 20pt of gap. At 72pt Favorit
  // leaves 17.1pt above its capitals and 22.5pt below the baseline — 39.5pt
  // of space between two rows before anything is added. Measured from the
  // font rather than guessed; see native/CLAUDE.md.
  stacked: { marginTop: 20 - 39.5 },
  // While one value is being edited the other steps back, so it is obvious
  // which number the keypad is pointed at.
  dimmed: { opacity: 0.35 },
  // In the flow rather than laid over the digits, matching .caret on the web:
  // outside it, the caret landed on top of the unit whenever the number was
  // short or had been cleared.
  caret: { width: 3, height: 52, marginLeft: 2, marginRight: 1 },
  parked: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, padding: 0 },
  // No line height stated: Favorit's own is 1.249em and anything below it
  // clips, because React Native cuts text to its line box where CSS lets it
  // spill out. See native/CLAUDE.md.
  figure: { fontFamily: FONTS.bold, fontSize: 72, letterSpacing: -2.16 },
  unit: { fontFamily: FONTS.bold, fontSize: 72, letterSpacing: -2.16 },
  unitDimmed: { opacity: 0.35 },
  save: {
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 69,
    gap: 10,
  },
  saveLabel: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  remove: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 18,
    paddingHorizontal: 69,
    gap: 10,
  },
  // At full strength rather than faded back — it is a choice, not a footnote.
  removeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
})
