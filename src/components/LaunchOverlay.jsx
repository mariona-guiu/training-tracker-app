import { createContext, useCallback, useContext, useRef } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { WORKOUT_REVEAL_FADE, WORKOUT_SPRING } from '../data/motion.js'

// The colour that carries the eye into a workout and back out of it.
//
// Owned here, above the navigator, rather than by the Workouts screen — the
// same decision the web app arrived at the hard way. There the overlay was
// rendered by the Workouts page and portalled to the body, which left it
// inheriting presence-animation context from two screens away and stopped the
// colour growing at all. Anything that has to cover the whole app, including
// the tab bar, belongs at the top of the app.
//
// Two halves of one movement:
//
//   Launching — the overlay is full-screen and gets *scaled down* onto the
//   card, then springs out to fill the screen. Scaling down rather than
//   sizing to the card and growing means only transforms animate, never
//   layout, which is the difference between smooth and stuttering on a phone.
//
//   Revealing — a workout that just ended hands its colour back still
//   covering the screen. Whichever tab we land on opens underneath it and
//   dissolves it away, so there is never a frame of bare page between the two.

const LaunchContext = createContext(null)

export function useLaunch() {
  return useContext(LaunchContext) ?? {}
}

export function LaunchProvider({ children }) {
  // The overlay is always mounted and always transparent when idle, and
  // everything about it lives in shared values.
  //
  // It used to be mounted only while it had something to do, with its mode and
  // colour in React state. That put a view creation and a React commit on the
  // path of a movement that has to begin on the very next frame — and a commit
  // is not a paint. On a cold launch the first reveal was slow enough that the
  // colour appeared part-way through its own fade, which read as a blink.
  // Moving the fade after the commit helped and did not fix it, because the
  // mount was still there. Nothing here touches React any more.
  const progress = useSharedValue(0)
  const fade = useSharedValue(0)
  // 0 idle, 1 launching, 2 revealing. A number rather than a string so the
  // worklet can read it without a round trip.
  const mode = useSharedValue(0)
  const colour = useSharedValue('transparent')
  const from = useSharedValue(null)
  // Whether this launch has already announced its arrival, so the reaction
  // below fires once and not on every frame after.
  const announced = useSharedValue(false)
  // Held on the JS side and called through runOnJS. The worklet cannot read a
  // ref, but the function it hands back to JavaScript can.
  const onArrivedRef = useRef(null)

  const clear = useCallback(() => {
    mode.value = 0
  }, [mode])

  const beginLaunch = useCallback(
    (next) => {
      if (!next) {
        mode.value = 0
        return
      }
      onArrivedRef.current = next.onArrived
      colour.value = next.color
      from.value = next.from
      announced.value = false
      mode.value = 1
      progress.value = 0
      progress.value = withSpring(1, WORKOUT_SPRING)
    },
    [progress, announced, mode, colour, from],
  )

  const announce = useCallback(() => {
    onArrivedRef.current?.()
  }, [])

  // The colour has arrived when it covers the screen, not when the spring has
  // stopped moving. WORKOUT_SPRING is underdamped, so it reaches full size at
  // about 234ms and only reports finished at about 458ms — and every one of
  // those 224ms is overshoot happening outside the screen, where it is clipped
  // and cannot be seen.
  useAnimatedReaction(
    () => progress.value,
    (p) => {
      'worklet'
      if (mode.value !== 1 || announced.value || p < 0.995) return
      announced.value = true
      runOnJS(announce)()
    },
  )

  // A workout that just ended hands its colour back still covering the screen.
  // Set full and faded from there, all on the UI thread, so the first frame of
  // the fade is drawn on a colour that is already painted.
  const beginReveal = useCallback(
    (color) => {
      colour.value = color
      fade.value = 1
      mode.value = 2
      fade.value = withTiming(0, WORKOUT_REVEAL_FADE, (finished) => {
        'worklet'
        if (finished) mode.value = 0
      })
    },
    [fade, mode, colour],
  )

  const style = useAnimatedStyle(() => {
    if (mode.value === 2) {
      return { backgroundColor: colour.value, opacity: fade.value, transform: [] }
    }
    const origin = from.value
    if (mode.value !== 1 || !origin) {
      return { backgroundColor: colour.value, opacity: 0, transform: [] }
    }
    const p = progress.value
    const at = (start) => start + (1 - start) * p
    return {
      backgroundColor: colour.value,
      opacity: 1,
      transform: [
        { translateX: origin.x * (1 - p) },
        { translateY: origin.y * (1 - p) },
        { scaleX: at(origin.scaleX) },
        { scaleY: at(origin.scaleY) },
      ],
    }
  })

  return (
    <LaunchContext.Provider value={{ beginLaunch, beginReveal, endLaunch: clear }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.overlay, style]}
      />
    </LaunchContext.Provider>
  )
}

const styles = StyleSheet.create({
  // Scaling from the card's top-left corner is what makes the colour appear
  // to grow out of the card rather than out of its middle.
  overlay: { transformOrigin: 'top left', zIndex: 2000 },
})

// Turns a card's position on screen into the overlay's starting transform.
export function originFrom(rect, screen) {
  if (!rect) return { x: 0, y: 0, scaleX: 1, scaleY: 1 }
  return {
    x: rect.x,
    y: rect.y,
    scaleX: rect.width / screen.width,
    scaleY: rect.height / screen.height,
  }
}
