import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { Glass } from './Glass.jsx'
import { SYSTEM_LINE, LIGHT, SPACE, TYPE } from '../theme/index.js'

// A page title the content runs behind.
//
// Nothing behind it at rest, so it carries no surface — the material arrives
// only once something is passing underneath and the title needs somewhere to
// sit. Shared, so every screen frosts identically rather than each one
// deciding for itself, which is how the web's `.screen h1` and
// `body.is-scrolled` work together.
//
// The title floats rather than scrolling away, so the screen using it has to
// leave TITLE_CLEARANCE of room at the top of its content.
// What the bar actually occupies below `top`: one line of the title, plus the
// padding under it. Derived rather than stated — 52 was measured against a
// 40pt title and quietly stopped being true when that became 32.
export const TITLE_HEIGHT = TYPE.screenTitle.fontSize * SYSTEM_LINE + SPACE[2]
// And the air between the bar and the first card. SPACE[3] rather than
// SPACE[4]: at 40pt the gap came to 18, and letting both halves follow the
// smaller title put it at 28 — more space than the smaller title had earned.
// This brings it to 16.
export const TITLE_CLEARANCE = TITLE_HEIGHT + SPACE[3]

export function ScreenTitle({ title, scrolled, top }) {
  const frost = useSharedValue(0)

  useEffect(() => {
    frost.value = withTiming(scrolled ? 1 : 0, { duration: 220 })
  }, [scrolled, frost])

  const surface = useAnimatedStyle(() => ({ opacity: frost.value }))

  return (
    <View style={[styles.bar, { paddingTop: top }]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, surface]} pointerEvents="none">
        {/* No wash over the top. The web pairs rgba(253,253,252,0.72) with a
            backdrop-filter, where that value *tints* the blurred backdrop —
            but BlurView already frosts with a light tint of its own, so the
            same number on top of it comes out very nearly solid. The blur is
            the whole surface here. */}
        <Glass intensity={70} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
    paddingHorizontal: SPACE[3],
    paddingBottom: SPACE[2],
  },
  title: { ...TYPE.screenTitle, color: LIGHT.text },
})
