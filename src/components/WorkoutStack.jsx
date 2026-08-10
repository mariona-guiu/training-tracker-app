import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { CANONICAL_ORDER, inkFor, styleFor } from '../data/routineStyles.js'
import { GLIDE_SPRING, TILT_SPRING } from '../data/motion.js'
import { RADIUS, SPACE, SYSTEM_ASCENT, SYSTEM_CAP, TYPE } from '../theme/index.js'

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

// How the cards move. Arrived at on the phone with a panel of sliders, now
// that they are settled — the panel is gone, and these are the numbers it
// ended on.
//
// A released card is thrown to a projected target and springs into it, rather
// than decaying. `withDecay` is the obvious tool and the wrong feel: it bleeds
// the velocity away and halts, or stops dead against the boundary, which reads
// as abrupt however the friction is set. THROW is the fraction of the
// velocity it carries — the same 0.15 the web hands Framer's inertia — and
// GLIDE_SPRING, in motion.js, is how it settles once thrown.
const THROW = 0.15

// The tilt is a target the angle springs toward, not the angle itself. That
// lag behind the finger is the whole of the lean; set directly, the card stays
// straight however far it is dragged.
const TILT_PER_PX = 0.12
const TILT_MAX = 25

// Framer's dragElastic: how far past the boundary a card still follows.
const ELASTIC = 0.05

// How far a finger may travel and still count as a tap rather than a drag.
// Both gestures read it, so they cannot disagree about where the line is.
const TAP_SLOP = 8

// Past the boundary the card keeps following the finger, but only by this
// fraction of the overshoot — Framer's dragElastic. It gives the edge some
// give instead of the card simply stopping against it.
function rubber(value, min, max, elastic) {
  'worklet'
  if (value < min) return min + (value - min) * elastic
  if (value > max) return max + (value - max) * elastic
  return value
}

function StackCard({ routine, slotIndex, zIndex, isTop, canvas, resetAt, onLift, onDisturb, onStart }) {
  const kind = routine.type ?? routine.name
  const style = styleFor(kind, slotIndex)
  const ink = inkFor(kind, slotIndex)
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
  // Whether this card was already on top when the finger landed, read by the
  // tap below. It has to be captured then rather than on release: touching a
  // card lifts it, so by the time the tap ends every card is the top card.
  const onTop = useSharedValue(isTop)
  const wasTop = useSharedValue(false)
  useEffect(() => {
    onTop.value = isTop
  }, [isTop, onTop])

  // Whether this drag has already told the screen the cards have been moved.
  // Without it the callback would cross to JavaScript on every frame of the
  // gesture to set a flag that is already set.
  const reported = useSharedValue(false)

  // Back to where it began, angle and all.
  useEffect(() => {
    if (!resetAt) return
    x.value = withSpring(0, TILT_SPRING)
    y.value = withSpring(0, TILT_SPRING)
    turn.value = withSpring(restAngle, TILT_SPRING)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetAt])

  // Where the card is on screen, measured at the moment it is opened rather
  // than remembered: the launch colour grows from this box, and the card may
  // have been dragged anywhere by then.
  const start = useCallback(() => {
    card.current?.measureInWindow((left, top, width, height) =>
      onStart(routine, slotIndex, { x: left, y: top, width, height }),
    )
  }, [onStart, routine, slotIndex])

  // The whole card is the target now that the design has no button on it, so
  // one finger has to mean two things. A threshold separates them: the pan
  // does not claim the gesture until the finger has travelled far enough that
  // it cannot be a tap, and the tap will not fire if it has.
  //
  // onBegin still runs on touch-down, so a card still lifts and tilts under a
  // finger that has not moved yet — the press feedback arrives before either
  // gesture has decided what it is.
  const pan = Gesture.Pan()
    .activeOffsetX([-TAP_SLOP, TAP_SLOP])
    .activeOffsetY([-TAP_SLOP, TAP_SLOP])
    .onBegin(() => {
      startX.value = x.value
      startY.value = y.value
      // Cumulative from the start of the gesture, so this is the baseline the
      // tilt is added on top of.
      startTurn.value = turn.value
      held.value = withSpring(1, TILT_SPRING)
      reported.value = false
      wasTop.value = onTop.value
      runOnJS(onLift)(routine.id)
    })
    .onUpdate((event) => {
      x.value = rubber(startX.value + event.translationX, minX, maxX, ELASTIC)
      y.value = rubber(startY.value + event.translationY, minY, maxY, ELASTIC)
      // The angle is a target, not the angle itself: the card leans toward it
      // on a spring, so the tilt eases in behind the finger rather than being
      // pinned to it. That lag is the whole of the lean. Re-aiming a spring
      // that is already running keeps its velocity, which is what makes this
      // continuous rather than a series of jumps.
      const proposed = startTurn.value + event.translationX * TILT_PER_PX
      turn.value = withSpring(
        Math.min(Math.max(proposed, -TILT_MAX), TILT_MAX),
        TILT_SPRING,
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
        stiffness: GLIDE_SPRING.stiffness,
        damping: GLIDE_SPRING.damping,
        mass: GLIDE_SPRING.mass,
      }
      const throwTo = (from, velocity, min, max) =>
        Math.min(Math.max(from + velocity * THROW, min), max)
      // A card let go beyond the boundary is already outside it; the target
      // above is clamped back inside, so the same spring brings it home.

      x.value = withSpring(throwTo(x.value, event.velocityX, minX, maxX), glide)
      y.value = withSpring(throwTo(y.value, event.velocityY, minY, maxY), {
        ...glide,
        velocity: event.velocityY,
      })
    })
    .onFinalize(() => {
      held.value = withSpring(0, TILT_SPRING)
    })

  // A tap means one of two things depending on where the card was. Buried, it
  // means bring this one up — which touching it has already done, so there is
  // nothing left to do here. On top, it means open it.
  //
  // The same as picking up a real pile: you bring a card to the front, then you
  // act on it. It also means no card can be opened without being fully visible
  // first, which is worth having when the tap target is the whole card.
  const tap = Gesture.Tap()
    .maxDistance(TAP_SLOP)
    .onEnd((_event, success) => {
      'worklet'
      if (success && wasTop.value) runOnJS(start)()
    })

  // Exclusive, not Simultaneous: the pan has priority, so a finger that moves
  // opens nothing. A finger that does not move never lets the pan activate,
  // and the tap is left to win.
  const gesture = Gesture.Exclusive(pan, tap)

  const moved = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${turn.value}deg` },
      { scale: 1 - held.value * 0.02 },
    ],
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        ref={card}
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          isTop ? `Start ${routine.name} workout` : `${routine.name}, bring to front`
        }
        accessibilityHint="Drag to move the card around"
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

        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: ink }]}>{estimatedMinutes(routine)} min</Text>
          <Text style={[styles.metaText, { color: ink }]}>
            {routine.slots.length} exercises
          </Text>
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
export function WorkoutStack({ routines, resetAt, onDisturb, onStart }) {
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
          isTop={zOrder[zOrder.length - 1] === routine.id}
          canvas={{ width, height }}
          resetAt={resetAt}
          onLift={lift}
          onDisturb={onDisturb}
          onStart={onStart}
        />
      ))}
    </View>
  )
}

// Where the design puts the top of the card name's capitals, measured from
// the top of the card. Held fixed while the font underneath it changes: the
// old `top: 10` was that distance minus the 0.325em Funnel left above its
// capitals, and SF Pro leaves 0.262em, so the same 10 would have lifted the
// name by 2pt.
const CARD_CAP_TOP = 19.75

const styles = StyleSheet.create({
  canvas: { ...StyleSheet.absoluteFillObject },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: RADIUS.card,
  },
  // Measured from the design: the capitals sit 19.4 from the card's top edge.
  // Stated as the text box that produces, since layout takes the box and the
  // font leaves above its capitals — 0.262em for SF Pro, and the constant
  // above holds the capitals still while that changes.
  label: {
    position: 'absolute',
    top: CARD_CAP_TOP - (SYSTEM_ASCENT - SYSTEM_CAP) * TYPE.routineCard.fontSize,
    left: SPACE[3],
    right: SPACE[3],
    ...TYPE.routineCard,
    textAlign: 'center',
  },
  // Two centred lines and no icons — the design has three elements on a card
  // and these are two of them. At full strength: with the arrow gone they are
  // the only thing on the card besides its name, and there is nothing left for
  // them to recede behind.
  meta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center',
    gap: SPACE[1],
  },
  metaText: { ...TYPE.routineCardMeta },
})
