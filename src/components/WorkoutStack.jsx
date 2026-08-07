import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { CANONICAL_ORDER, inkFor, styleFor } from '../data/routineStyles.js'
import { FONTS } from '../theme/index.js'

function sortForStack(routines) {
  return [...routines].sort((a, b) => {
    const ai = CANONICAL_ORDER.indexOf(a.name.toLowerCase())
    const bi = CANONICAL_ORDER.indexOf(b.name.toLowerCase())
    return (ai === -1 ? CANONICAL_ORDER.length : ai) - (bi === -1 ? CANONICAL_ORDER.length : bi)
  })
}

// No real duration is tracked per routine yet — this is a rough estimate
// (~2 min per working set including rest, rounded to the nearest 5) just to
// fill the design's time slot, not a tracked figure.
function estimatedMinutes(routine) {
  const totalSets = routine.slots.reduce((sum, slot) => sum + slot.targetSets, 0)
  return Math.max(15, Math.round((totalSets * 2) / 5) * 5)
}

function ClockIcon({ color }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path
        d="M12 7v5l3.5 2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function DumbbellIcon({ color }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function ArrowIcon({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14M13 6l6 6-6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export const CARD_WIDTH = 280
export const CARD_HEIGHT = 360
const PEEK_STEP = 56
// Clearance below the "Workouts" title.
const STACK_TOP = 150

// A dragged card may hang up to 30% of its own size off any edge before
// hitting the boundary — enough room to feel free, never enough to lose it.
const OVERFLOW_X = CARD_WIDTH * 0.3
const OVERFLOW_Y = CARD_HEIGHT * 0.3

// Far enough from where it started to count as having been moved, so a card
// that was only tapped does not summon the restack button.
const DISTURBED = 8

// Past the boundary the card keeps following the finger, but only by this
// fraction of the overshoot — Framer's dragElastic. It gives the edge some
// give instead of the card simply stopping against it.
function rubber(value, min, max, elastic) {
  'worklet'
  if (value < min) return min + (value - min) * elastic
  if (value > max) return max + (value - max) * elastic
  return value
}

function StackCard({ routine, slotIndex, zIndex, canvas, tuning, resetAt, onLift, onDisturb, onStart }) {
  const style = styleFor(routine.name, slotIndex)
  const ink = inkFor(routine.name, slotIndex)
  const card = useRef(null)

  const baseLeft = (canvas.width - CARD_WIDTH) / 2
  const baseTop = STACK_TOP + slotIndex * PEEK_STEP
  // Each card rests at its own angle, which is part of the routine's style
  // rather than something worked out here.
  const restAngle = style.rotate ?? 0

  // How far this card may travel before it meets the boundary, worked out from
  // where it sits rather than shared, since every card starts somewhere
  // different down the stack.
  const minX = -OVERFLOW_X - baseLeft
  const maxX = canvas.width - CARD_WIDTH + OVERFLOW_X - baseLeft
  const minY = -OVERFLOW_Y - baseTop
  const maxY = canvas.height - CARD_HEIGHT + OVERFLOW_Y - baseTop

  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const turn = useSharedValue(restAngle)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const startTurn = useSharedValue(restAngle)
  const held = useSharedValue(0)
  // Whether this drag has already told the screen the cards have been moved.
  // Without it the callback would cross to JavaScript on every frame of the
  // gesture to set a flag that is already set.
  const reported = useSharedValue(false)

  const spring = { stiffness: tuning.stiffness, damping: tuning.damping, mass: tuning.mass }

  // Back to where it began, angle and all.
  useEffect(() => {
    if (!resetAt) return
    x.value = withSpring(0, spring)
    y.value = withSpring(0, spring)
    turn.value = withSpring(restAngle, spring)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetAt])

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value
      startY.value = y.value
      // Cumulative from the start of the gesture, so this is the baseline the
      // tilt is added on top of.
      startTurn.value = turn.value
      held.value = withSpring(1, spring)
      reported.value = false
      runOnJS(onLift)(routine.id)
    })
    .onUpdate((event) => {
      x.value = rubber(startX.value + event.translationX, minX, maxX, tuning.elastic)
      y.value = rubber(startY.value + event.translationY, minY, maxY, tuning.elastic)
      // The angle is a target, not the angle itself: the card leans toward it
      // on a spring, so the tilt eases in behind the finger rather than being
      // pinned to it. That lag is the whole of the lean. Re-aiming a spring
      // that is already running keeps its velocity, which is what makes this
      // continuous rather than a series of jumps.
      const proposed = startTurn.value + event.translationX * tuning.tilt
      turn.value = withSpring(
        Math.min(Math.max(proposed, -tuning.tiltMax), tuning.tiltMax),
        { stiffness: tuning.stiffness, damping: tuning.damping, mass: tuning.mass },
      )
      if (!reported.value && (Math.abs(x.value) > DISTURBED || Math.abs(y.value) > DISTURBED)) {
        reported.value = true
        runOnJS(onDisturb)()
      }
    })
    .onEnd((event) => {
      // Where the card is heading, then a spring to settle it there.
      //
      // Not withDecay, which is the obvious tool and the wrong feel: it bleeds
      // the velocity away and halts the moment it runs out — or stops dead
      // against the boundary — which reads as abrupt. The web uses Framer's
      // inertia, which projects a target from the velocity and eases into it,
      // and that is what this reproduces. The spring is handed the finger's
      // own velocity, so it picks up exactly where the drag left off instead
      // of starting again from rest.
      const glide = {
        velocity: event.velocityX,
        stiffness: tuning.glideStiffness,
        damping: tuning.glideDamping,
        mass: 1,
      }
      const throwTo = (from, velocity, min, max) =>
        Math.min(Math.max(from + velocity * tuning.power, min), max)
      // A card let go beyond the boundary is already outside it; the target
      // above is clamped back inside, so the same spring brings it home.

      x.value = withSpring(throwTo(x.value, event.velocityX, minX, maxX), glide)
      y.value = withSpring(throwTo(y.value, event.velocityY, minY, maxY), {
        ...glide,
        velocity: event.velocityY,
      })
    })
    .onFinalize(() => {
      held.value = withSpring(0, spring)
    })

  const moved = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${turn.value}deg` },
      { scale: 1 - held.value * 0.02 },
    ],
  }))

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        ref={card}
        accessibilityLabel={`${routine.name} workout card`}
        style={[
          styles.card,
          {
            left: baseLeft,
            top: baseTop,
            zIndex,
            backgroundColor: style.background,
            // The routine's own colour, thrown below the card. Carried across
            // from the web as-is: React Native takes the same boxShadow
            // shorthand, so the shadow does not have to be re-specified.
            boxShadow: style.boxShadow,
          },
          moved,
        ]}
      >
        <Text style={[styles.label, { color: ink }]}>{routine.name}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start ${routine.name} workout`}
          // The card's box on screen is where the launch colour grows from, so
          // it is measured at the moment of the tap — the card may have been
          // dragged anywhere by then.
          onPress={() =>
            card.current?.measureInWindow((left, top, width, height) =>
              onStart(routine, slotIndex, { x: left, y: top, width, height }),
            )
          }
          style={({ pressed }) => [
            styles.start,
            { borderColor: ink },
            pressed && styles.startPressed,
          ]}
        >
          <ArrowIcon color={ink} />
        </Pressable>

        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <ClockIcon color={ink} />
            <Text style={[styles.metaText, { color: ink }]}>{estimatedMinutes(routine)} min</Text>
          </View>
          <View style={styles.metaRow}>
            <DumbbellIcon color={ink} />
            <Text style={[styles.metaText, { color: ink }]}>{routine.slots.length} exercises</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  )
}

// The stack of cards, free to be pushed around the canvas.
//
// Position on screen comes from each card's fixed slot — its place in the
// canonical order — which never changes. Only the paint order is touched, and
// only by picking a card up, so cards never jump about when one is brought to
// the front. Where a card has been dragged to is kept for as long as the
// screen lives; the restack button is the only thing that undoes it.
export function WorkoutStack({ routines, tuning, resetAt, onDisturb, onStart }) {
  const { width, height } = useWindowDimensions()
  const stack = useMemo(() => sortForStack(routines), [routines])
  const [zOrder, setZOrder] = useState(() => stack.map((r) => r.id))

  const lift = useCallback((id) => {
    setZOrder((prev) => (prev[prev.length - 1] === id ? prev : [...prev.filter((x) => x !== id), id]))
  }, [])

  // Restacking puts the paint order back as well as the positions. Picking
  // cards up leaves the one most recently held on top, and a pile in that
  // order hides the peeking titles behind whichever card was touched last —
  // so the stack would come back tidy but unreadable.
  useEffect(() => {
    if (!resetAt) return
    setZOrder(stack.map((r) => r.id))
  }, [resetAt, stack])

  return (
    <View style={styles.canvas}>
      {stack.map((routine, slotIndex) => (
        <StackCard
          key={routine.id}
          routine={routine}
          slotIndex={slotIndex}
          zIndex={zOrder.indexOf(routine.id) + 1}
          canvas={{ width, height }}
          tuning={tuning}
          resetAt={resetAt}
          onLift={lift}
          onDisturb={onDisturb}
          onStart={onStart}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: { ...StyleSheet.absoluteFillObject },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12.607,
  },
  label: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    fontFamily: FONTS.mono,
    fontSize: 28,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  start: {
    position: 'absolute',
    top: CARD_HEIGHT / 2 - 28,
    left: CARD_WIDTH / 2 - 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  startPressed: { transform: [{ scale: 0.95 }] },
  meta: { position: 'absolute', left: 0, right: 0, bottom: 15, alignItems: 'center', gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Stepped back with opacity rather than a faded black, so it recedes the
  // same amount whichever ink the card is using.
  metaText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.52,
    opacity: 0.75,
  },
})
