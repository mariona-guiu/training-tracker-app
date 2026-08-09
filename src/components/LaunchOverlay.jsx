import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
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
  // What the overlay is doing, if anything: { mode: 'launch' | 'reveal', ... }
  const [state, setState] = useState(null)
  // One value drives the whole opening, from sitting on the card (0) to
  // filling the screen (1). Springing a single progress value keeps the
  // translate and both scales in step, and the overshoot applies to all of
  // them together.
  const progress = useSharedValue(0)
  const fade = useSharedValue(0)
  // Whether this launch has already announced its arrival, so the reaction
  // below fires once and not on every frame after.
  const announced = useSharedValue(false)
  // Held on the JS side and called through runOnJS. The worklet cannot read a
  // ref, but the function it hands back to JavaScript can.
  const onArrivedRef = useRef(null)

  const clear = useCallback(() => setState(null), [])

  const beginLaunch = useCallback(
    (next) => {
      if (!next) {
        setState(null)
        return
      }
      setState({ mode: 'launch', ...next })
      onArrivedRef.current = next.onArrived
      announced.value = false
      progress.value = 0
      progress.value = withSpring(1, WORKOUT_SPRING)
    },
    [progress, announced],
  )

  const announce = useCallback(() => {
    onArrivedRef.current?.()
  }, [])

  // The colour has arrived when it covers the screen, not when the spring has
  // stopped moving. WORKOUT_SPRING is underdamped, so it reaches full size at
  // about 234ms and only reports finished at about 458ms — and every one of
  // those 224ms is overshoot happening outside the screen, where it is clipped
  // and cannot be seen.
  //
  // Waiting for the callback meant the workout sat behind a screen of colour
  // that had already finished arriving. This fires on the moment that is
  // actually visible instead.
  useAnimatedReaction(
    () => progress.value,
    (p) => {
      'worklet'
      if (announced.value || p < 0.995) return
      announced.value = true
      runOnJS(announce)()
    },
  )

  // Set full and left there. The fade itself cannot start here: the style
  // below only reads `fade` once React has committed `mode: 'reveal'`, and
  // until it does the overlay draws at zero. Starting the timing in the same
  // breath meant the colour was invisible while it was already fading, then
  // appeared at whatever the fade had reached — which reads as a blink rather
  // than a dissolve, and got worse the busier the commit was.
  const beginReveal = useCallback(
    (color) => {
      setState({ mode: 'reveal', color })
      fade.value = 1
    },
    [fade],
  )

  // Started once the overlay is actually on screen, so it always fades from a
  // fully painted colour.
  useEffect(() => {
    if (state?.mode !== 'reveal') return
    fade.value = withTiming(0, WORKOUT_REVEAL_FADE, (finished) => {
      'worklet'
      if (finished) runOnJS(clear)()
    })
  }, [state, fade, clear])

  const style = useAnimatedStyle(() => {
    if (state?.mode === 'reveal') return { opacity: fade.value, transform: [] }
    const from = state?.from
    if (!from) return { opacity: 0, transform: [] }
    const p = progress.value
    const at = (start) => start + (1 - start) * p
    return {
      opacity: 1,
      transform: [
        { translateX: from.x * (1 - p) },
        { translateY: from.y * (1 - p) },
        { scaleX: at(from.scaleX) },
        { scaleY: at(from.scaleY) },
      ],
    }
  }, [state])

  return (
    <LaunchContext.Provider value={{ beginLaunch, beginReveal, endLaunch: clear }}>
      {children}
      {state ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            { backgroundColor: state.color },
            style,
          ]}
        />
      ) : null}
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
