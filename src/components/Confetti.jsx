import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { ROUTINE_COLOURS } from '../data/routineStyles.js'

// The shower over the completion screen.
//
// Drawn here rather than with the canvas-confetti the web app vendors, which
// has no equivalent on native. What is worth carrying across is not the
// library but the behaviour the web arrived at: pieces fall from above the
// screen in overlapping waves rather than bursting from a point, and they
// fall lightly — slowly enough to drift and flutter rather than drop.
//
// They also have to outlast the fall. The web's first attempt had particles
// expire around halfway down and appear to evaporate in mid-air.

const PIECES = 44
const WAVES = [0, 120, 300, 560, 780]

// Deterministic enough to look scattered, cheap enough to run at mount.
const spread = (i) => (i * 0.618) % 1

function Piece({ index, width, height }) {
  const colour = ROUTINE_COLOURS[index % ROUTINE_COLOURS.length]
  const size = 7 + ((index * 3) % 6)
  const startX = spread(index) * width
  const delay = WAVES[index % WAVES.length] + ((index * 37) % 400)
  const fall = 3200 + ((index * 91) % 1400)
  const sway = 14 + ((index * 5) % 20)
  const spin = ((index % 2 ? 1 : -1) * (360 + ((index * 53) % 540)))

  const y = useSharedValue(-60)
  const x = useSharedValue(0)
  const turn = useSharedValue(0)

  useEffect(() => {
    y.value = withDelay(
      delay,
      withTiming(height + 80, { duration: fall, easing: Easing.linear }),
    )
    turn.value = withDelay(delay, withTiming(spin, { duration: fall, easing: Easing.linear }))
    // Side to side as it comes down, so pieces flutter rather than drop
    // straight. Reversed on repeat, which is what makes it read as drift.
    x.value = withDelay(
      delay,
      withRepeat(withTiming(sway, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true),
    )
  }, [y, x, turn, delay, fall, spin, sway, height])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { translateX: x.value },
      { rotate: `${turn.value}deg` },
    ],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        { left: startX, width: size, height: size * 0.62, backgroundColor: colour },
        style,
      ]}
    />
  )
}

export function Confetti() {
  const { width, height } = useWindowDimensions()

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} index={i} width={width} height={height} />
      ))}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, borderRadius: 1 },
})
