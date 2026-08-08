import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Easing,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { getSettings, saveSettings } from '../../src/db/settings.js'
import { REST_MODES, restModeById } from '../../src/data/rest.js'
import { KCAL_NOTE } from '../../src/data/calories.js'
import { ScreenTitle, TITLE_CLEARANCE } from '../../src/components/ScreenTitle.jsx'
import { FONTS, LIGHT, SPACE, TAB_BAR_CLEARANCE } from '../../src/theme/index.js'

// Opening and closing the pace options. The card is growing and pushing the
// page down with it, so it takes its time; damped just under critical, so it
// settles with a little give rather than stopping dead.
const CARD_EXPAND = { stiffness: 210, damping: 26, mass: 1 }

// iOS animates its keyboard over roughly this, on a curve of its own that is
// private. The page travels on both, so the two move as one thing rather than
// one reacting to the other.
const KEYBOARD_MS = 250

// What is left between the bottom of the weight section and the top of the
// keypad. The page rises exactly far enough to open that gap and no further.
const SAVE_GAP = SPACE[3]
const KEYBOARD_EASING = Easing.linear

const INK = '#191919'
const QUIET = '#8a8a8a'
const CARD = '#f7f7f6'

// Digits and a single decimal point. Body weight is the one number here that
// can sensibly carry one.
function numericWeight(value) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  const capped = whole.slice(0, 3)
  return rest.length ? `${capped}.${rest.join('').slice(0, 1)}` : capped
}

// The whole spread for the pace in force, so the four buttons can each carry a
// single number without hiding what the others mean.
//
// Given as pairs rather than one run of text: on a line they wrap wherever the
// width happens to break, which splits a figure from the thing it describes.
function breakdown(mode) {
  return [
    { of: 'Lower body', seconds: mode.seconds.heavy },
    { of: 'Upper body', seconds: mode.seconds.moderate },
    { of: 'Core', seconds: mode.seconds.core },
    { of: 'Stretch', seconds: mode.seconds.stretching },
  ]
}

// Drawn rather than the platform's, because the platform's cannot be given
// these measurements. Same shape as the web's.
function Switch({ value, onChange, label }) {
  const on = useSharedValue(value ? 1 : 0)

  useEffect(() => {
    on.value = withTiming(value ? 1 : 0, { duration: 200 })
  }, [value, on])

  const track = useAnimatedStyle(() => ({
    backgroundColor: on.value > 0.5 ? INK : '#d9d9d7',
  }))
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: on.value * 18 }] }))

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  )
}

// A caret of our own, matching .caret on the web: the number on screen is
// text and the real field is parked out of sight, so there is no system caret
// to show.
function Caret() {
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

  return <Animated.View style={[styles.caret, blink]} pointerEvents="none" />
}

// A card that grows to show what is inside it. The height animates on a
// wrapper: padding on a collapsed element still takes up space, so the card
// would never close all the way.
//
// The content is measured by a copy laid out beside it rather than by the
// copy inside the wrapper. Measuring the one inside is circular — it sits in
// a box whose height is the thing being worked out, and clipped to it — so a
// measurement of zero keeps it at zero and the card never opens at all. The
// copy is out of the flow, invisible and untouchable, so it is laid out at
// its natural size whatever the wrapper is doing.
function Reveal({ open, fade, children }) {
  const [height, setHeight] = useState(0)
  const shown = useSharedValue(0)

  useEffect(() => {
    shown.value = withSpring(open ? height : 0, CARD_EXPAND)
  }, [open, height, shown])

  // Never below nothing. This spring is deliberately underdamped so it
  // settles with a little give, which means it overshoots at both ends —
  // and on the way closed that overshoot is a negative height, clamped by
  // the layout, which reads as a snap rather than a settle.
  const style = useAnimatedStyle(() => ({
    height: Math.max(0, shown.value),
    // Some of these fade as well as grow. Clipping alone is right for the
    // pace options, which slide out from under an edge; the save button has
    // no edge to come from and reads as flickering without it.
    opacity: fade && height ? Math.max(0, Math.min(1, shown.value / height)) : 1,
  }))

  return (
    <View>
      <View
        style={styles.measure}
        pointerEvents="none"
        aria-hidden
        onLayout={(e) => {
          const measured = e.nativeEvent.layout.height
          setHeight((current) => (Math.abs(current - measured) > 1 ? measured : current))
        }}
      >
        {children}
      </View>
      <Animated.View style={[styles.reveal, style]}>{children}</Animated.View>
    </View>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState(null)
  // Typing is held locally and written on the way out, so the database is not
  // rewritten on every keystroke.
  const [weightDraft, setWeightDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  // Room at the foot of the page for the keypad, so there is somewhere to
  // scroll to. Without it the content ends where it ends and the scroll has
  // nowhere to go.
  const [keypadRoom, setKeypadRoom] = useState(0)
  const scroller = useAnimatedRef()
  // How far down the page has been scrolled, so the card's position on screen
  // can be worked out without measuring it again.
  const scrollY = useRef(0)
  // Where the page is scrolled to, driven on the keyboard's own duration and
  // curve from the notification that arrives before it moves — so the two
  // travel together.
  //
  // Scrolled rather than translated. Moving the whole page with a transform
  // keeps the two in step just as well, but a ScrollView clips to its own
  // frame: shifting it upward takes its bottom edge with it, and anything near
  // the foot of the content is cut off. The save button was being clipped that
  // way even before the keypad reached it.
  const offset = useSharedValue(0)
  // Where the page was before the field opened, so it can be put back.
  const restore = useRef(0)
  // The keypad's own height, for the save bar that sits on top of it. Not the
  // same as the lift, which is only ever as far as the card needed to come.
  const editingNow = useSharedValue(0)
  // Where the body weight section sits down the page and how tall it is — the
  // card and the note under it together, since both have to clear the bar.
  const weightSection = useRef({ y: 0, height: 0 })
  // The keypad's height, kept so the lift can be worked out again if the page
  // changes shape while the field is open.
  const keypadHeight = useRef(0)
  const field = useRef(null)
  // Set by the save button, which fires on press-in — before the field loses
  // focus. Everything else that ends an edit is a cancel.
  const saved = useRef(false)
  const insets = useSafeAreaInsets()
  const screen = useWindowDimensions()

  useEffect(() => {
    let cancelled = false
    getSettings().then((loaded) => {
      if (cancelled) return
      setSettings(loaded)
      setWeightDraft(loaded.bodyWeightKg == null ? '' : String(loaded.bodyWeightKg))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // The web has a far more involved version of this — measuring the card,
  // scrolling it under the title, holding room open for the journey back —
  // because iOS moves the *page* to reveal a focused field and nothing
  // anchored to the viewport survives it. None of that applies here: the field
  // is parked and invisible, so iOS has nothing it wants to scroll to, and the
  // page is ours to move.
  // How far the page has to rise for the bottom of the weight section — the
  // card, its note and the save button — to sit a gap above the keypad.
  //
  // Not capped at the keypad's height. That cap made sense while the button
  // rode the keypad and only the card had to clear it; with the button in the
  // page, this section is taller than the keypad, so the cap stopped the lift
  // short and left the button cut off by it.
  const offsetFor = useCallback(
    (height) => {
      if (!height) return scrollY.current
      const bottom = weightSection.current.y + weightSection.current.height
      return Math.max(0, bottom - (screen.height - height - SAVE_GAP))
    },
    [screen.height],
  )

  useEffect(() => {
    const move = (to, duration) => {
      offset.value = withTiming(to, {
        duration: duration || KEYBOARD_MS,
        easing: KEYBOARD_EASING,
      })
    }
    const fade = (to, duration) => {
      editingNow.value = withTiming(to, {
        duration: duration || KEYBOARD_MS,
        easing: KEYBOARD_EASING,
      })
    }
    let clearing
    const shown = Keyboard.addListener('keyboardWillShow', (event) => {
      keypadHeight.current = event.endCoordinates.height
      restore.current = scrollY.current
      offset.value = scrollY.current
      setKeypadRoom(event.endCoordinates.height)
      move(offsetFor(event.endCoordinates.height), event.duration)
      fade(1, event.duration)
    })
    const hidden = Keyboard.addListener('keyboardWillHide', (event) => {
      keypadHeight.current = 0
      move(restore.current, event.duration)
      // Trying it without a fade on the way out: the button simply goes, and
      // the page travels back on its own. Set outright rather than asked for
      // with a zero duration — `fade` falls back to its default on anything
      // falsy, and 0 is falsy. `fade(0, event.duration)` puts the fade back.
      editingNow.value = 0
      // Held until the page has finished travelling. Taken away at once, the
      // content shortens underneath a scroll still in flight and the position
      // it is heading for stops existing.
      clearing = setTimeout(() => setKeypadRoom(0), event.duration || KEYBOARD_MS)
    })
    return () => {
      shown.remove()
      hidden.remove()
      clearTimeout(clearing)
    }
  }, [offset, offsetFor, editingNow])

  // Driven straight onto the scroller every frame, on the UI thread.
  useDerivedValue(() => {
    scrollTo(scroller, 0, offset.value, false)
  })

  // Only ever a fade. It sits in the page and travels with it, so it needs no
  // movement of its own — and a height would give it a sweep.
  const saveBar = useAnimatedStyle(() => ({ opacity: editingNow.value }))

  const update = useCallback(async (changes) => {
    setSettings((current) => ({ ...current, ...changes }))
    await saveSettings(changes)
  }, [])

  function saveWeight() {
    saved.current = true
    const value = weightDraft.trim()
    // Clearing the field is a real answer — it means "don't estimate for me" —
    // so an empty box stores nothing rather than being ignored.
    update({ bodyWeightKg: value === '' ? null : Number(value) })
    setEditing(false)
    Keyboard.dismiss()
  }

  function abandonWeight() {
    setWeightDraft(settings.bodyWeightKg == null ? '' : String(settings.bodyWeightKg))
    setEditing(false)
    Keyboard.dismiss()
  }

  // Losing focus ends the edit and keeps nothing. The save button is the only
  // thing that stores what was typed, and it fires on press-in, before focus
  // goes — so by the time this runs, anything but a save is a cancel.
  //
  // Driven from the field itself rather than from a tap handler on the page:
  // the scroller claims taps before anything above it sees them, so a
  // responder up there is never offered the touch. Whatever takes the keypad
  // away takes focus with it, and that is the one signal that always arrives.
  function handleBlur() {
    if (saved.current) return
    abandonWeight()
  }

  if (!settings) {
    return (
      <View style={styles.screen}>
        <ScreenTitle title="Settings" scrolled={false} top={insets.top + SPACE[4]} />
      </View>
    )
  }

  const restOn = settings.restEnabled !== false
  const mode = restModeById(settings.restMode)

  return (
    <View
      style={styles.screen}
    >
      {/* Frosted while the page is lifted as well as while it is scrolled.
          Lifting moves content under the title without changing the scroll
          offset at all, so asking the scroller alone leaves the title bare
          with the cards passing straight through it. */}
      <ScreenTitle title="Settings" scrolled={scrolled || editing} top={insets.top + SPACE[4]} />
      <Animated.ScrollView
        ref={scroller}
        scrollEventThrottle={32}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y
          setScrolled(scrollY.current > 4)
        }}
        contentContainerStyle={{
          paddingTop: insets.top + SPACE[4] + TITLE_CLEARANCE,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + SPACE[4] + keypadRoom,
          paddingHorizontal: SPACE[3],
          gap: SPACE[5],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Show rest time between sets</Text>
              <Switch
                value={restOn}
                // A light impact, the same one the restack button and logging
                // a set use: this flips a thing, and it is the card growing
                // or closing underneath that says which way.
                onChange={(next) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  update({ restEnabled: next })
                }}
                label="Show rest time between sets"
              />
            </View>

            {/* The pace options live inside the same card as the switch that
                reveals them, so turning rest on grows one thing rather than
                adding a second. */}
            <Reveal open={restOn}>
              <View style={styles.paces}>
                <View style={styles.paceRow}>
                  {REST_MODES.map((option) => {
                    const chosen = option.id === mode.id
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: chosen }}
                        // No confirming step: the choice is the tap, and the
                        // title and description below answer it.
                        //
                        // selectionAsync rather than an impact: this is one
                        // choice among four, which is exactly what that
                        // generator is for, and it reads as a tick rather
                        // than a knock as you move along the row. Only when
                        // the selection actually moves — re-tapping the pace
                        // already in force changes nothing, and iOS's own
                        // segmented controls stay quiet for it too.
                        onPress={() => {
                          if (chosen) return
                          Haptics.selectionAsync()
                          update({ restMode: option.id })
                        }}
                        style={[styles.pace, chosen && styles.paceChosen]}
                      >
                        <Text style={[styles.paceLabel, chosen && styles.paceLabelChosen]}>
                          {option.seconds.heavy}s
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                <Text style={styles.paceName}>{mode.label}</Text>
                <Text style={styles.paceDescription}>{mode.description}</Text>
                {/* What the chosen pace means for each kind of work. Four
                    short facts, not a sentence — so they are laid out as
                    four, each figure against the thing it describes. */}
                <View style={styles.spread}>
                  {breakdown(mode).map((row) => (
                    <View key={row.of} style={styles.spreadRow}>
                      <Text style={styles.spreadOf}>{row.of}</Text>
                      <Text style={styles.spreadSeconds}>{row.seconds}s</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Reveal>
          </View>

          {/* Always there rather than only while rest is off. The second
              sentence went with it — the pace options are on screen saying
              that themselves. */}
          <Text style={styles.note}>
            When you turn Rest Time on, after logging a set you will see a countdown for your rest
            time between sets.
          </Text>
        </View>

        <View
          style={styles.section}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout
            weightSection.current = { y, height }
            // Worked out again whenever the page changes shape underneath an
            // open field — turning rest on grows the card above this one and
            // pushes it down, and a lift measured before that leaves the
            // field somewhere it cannot be reached.
            if (editing && keypadHeight.current) {
              offset.value = withTiming(offsetFor(keypadHeight.current), {
                duration: KEYBOARD_MS,
                easing: KEYBOARD_EASING,
              })
            }
          }}
        >
          <Pressable
            onPress={() => {
              // A new edit owes nothing to the last one. Saving sets the flag
              // below and then unmounts the field, and unmounting does not
              // blur — so without this the flag stays raised for good and the
              // next tap outside is swallowed as though it were a save.
              saved.current = false
              setEditing(true)
            }}
            style={[styles.card, styles.weight, editing && styles.weightEditing]}
          >
            <Text style={styles.label}>Body weight</Text>
            {/* The number on screen is text, not the field — the same
                arrangement the workout screen uses for reps and weight. */}
            <View style={styles.weightValue}>
              <Text style={styles.weightTyped}>
                {weightDraft === '' && !editing ? '0' : weightDraft}
              </Text>
              {editing ? <Caret /> : null}
              <Text style={[styles.weightUnit, editing && styles.weightUnitDimmed]}>kg</Text>
              {editing ? (
                <TextInput
                  ref={field}
                  value={weightDraft}
                  onChangeText={(text) => setWeightDraft(numericWeight(text))}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={handleBlur}
                  caretHidden
                  accessibilityLabel="Body weight in kilograms"
                  style={styles.parked}
                />
              ) : null}
            </View>
          </Pressable>

          {/* Body weight is the one thing this app asks for that people can
              feel touchy about, so the note says what it is for, that it is
              optional, and that nothing is kept beyond the single number — no
              history, no chart, no progress to live up to. */}
          <Text style={styles.note}>
            Optional, and only used to estimate the calories a workout burns. It isn’t tracked over
            time and never leaves this device. {KCAL_NOTE}
          </Text>

          {/* In the flow, below the note it belongs to, and always present
                — it only fades. Mounting it would be a layout change, and it
                is the last thing on the page, so the room it keeps costs
                nothing but stops anything moving when it arrives.

                Pressed before focus is lost, so it reads as confirming rather
                than as one more tap on the page. */}
          <Animated.View style={saveBar} pointerEvents={editing ? 'auto' : 'none'}>
            <Pressable onPressIn={saveWeight} style={styles.save}>
              <Text style={styles.saveLabel}>Save changes</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: LIGHT.bg },
  section: { gap: SPACE[2] },
  // No stroke: the fill is enough to separate it from the page, and an
  // outline as well would make two statements about the same edge.
  card: { paddingVertical: 15, paddingHorizontal: 16, borderRadius: 12, backgroundColor: CARD },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE[3],
  },
  label: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.24,
    color: INK,
  },
  // Light rather than regular: this is the one thing on the page you read
  // once and then stop seeing, so it steps back in weight as well as ink.
  note: { fontFamily: FONTS.light, fontSize: 13, lineHeight: 19, color: QUIET },
  reveal: { overflow: 'hidden' },
  // Laid out, measured, and never seen or touched.
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },

  track: {
    width: 46,
    height: 28,
    padding: 3,
    borderRadius: 999,
    justifyContent: 'center',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },

  paces: { paddingTop: SPACE[3] },
  paceRow: { flexDirection: 'row', gap: 7 },
  pace: {
    flex: 1,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paceChosen: { backgroundColor: INK },
  // Unchosen options step back rather than sitting at full strength — the row
  // reads as one selection among four, not four equal buttons.
  paceLabel: { fontFamily: FONTS.medium, fontSize: 20, color: QUIET },
  paceLabelChosen: { color: '#ffffff' },
  paceName: {
    marginTop: 20,
    fontFamily: FONTS.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.24,
    color: INK,
  },
  paceDescription: {
    marginTop: 10,
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 21,
    color: INK,
  },
  spread: { marginTop: 20 },
  spreadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e6e6e4',
  },
  spreadOf: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.24,
    color: QUIET,
  },
  spreadSeconds: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.24,
    color: INK,
  },

  weight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Outlined while it is being typed in, so it is obvious which card the
  // keypad belongs to.
  weightEditing: { borderWidth: 1, borderColor: INK },
  weightValue: { flexDirection: 'row', alignItems: 'center' },
  // No line height stated: Favorit's own is 1.249em and anything below it
  // clips. See native/CLAUDE.md.
  weightTyped: { fontFamily: FONTS.bold, fontSize: 34, letterSpacing: -0.68, color: INK },
  // At rest the figure and its unit are one thing, in one ink. The unit only
  // steps back while the number is being typed.
  weightUnit: { fontFamily: FONTS.bold, fontSize: 34, letterSpacing: -0.68, color: INK },
  weightUnitDimmed: { opacity: 0.45 },
  caret: { width: 3, height: 24, marginLeft: 2, marginRight: 1, backgroundColor: INK },
  // Present, focusable and never seen. It holds what is typed and summons the
  // keypad; everything visible is drawn.
  parked: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, padding: 0 },

  save: {
    // Clear of the note above it, which the button was sitting on top of.
    marginTop: SPACE[4],
    height: 52,
    borderRadius: 999,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    color: '#ffffff',
  },
})
