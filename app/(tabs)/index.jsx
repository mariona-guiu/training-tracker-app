import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Glass, LIQUID_GLASS } from '../../src/components/Glass.jsx'
import * as Haptics from 'expo-haptics'

import { listRoutines } from '../../src/db/routines.js'
import { startSession, getActiveSession } from '../../src/db/sessions.js'
import { styleFor } from '../../src/data/routineStyles.js'
import { originFrom, useLaunch } from '../../src/components/LaunchOverlay.jsx'
import { WorkoutStack } from '../../src/components/WorkoutStack.jsx'
import { StackIcon, StackIconPressed } from '../../src/components/StackIcon.jsx'
import { LIGHT, RADIUS, SPACE, TYPE } from '../../src/theme/index.js'

// The Workouts screen: a canvas of cards you can push around, not a list.
//
// The web version has a good deal of machinery here that native does not need
// — the canvas sits in the document flow and is a pixel taller than the
// viewport, measured against 100lvh rather than 100dvh, because iOS only
// grants a web app the full display once the document is scrollable. None of
// that applies to an app that owns its window, so it is deliberately absent
// rather than forgotten.
export default function Workouts() {
  const [routines, setRoutines] = useState([])
  // Where the cards have been pushed to is kept for as long as the screen
  // lives — coming back from a workout leaves them where you left them. The
  // restack button is the only thing that undoes it.
  const [disturbed, setDisturbed] = useState(false)
  const [resetAt, setResetAt] = useState(0)
  const insets = useSafeAreaInsets()
  const screen = useWindowDimensions()
  const router = useRouter()
  const { beginLaunch, endLaunch } = useLaunch()
  const launching = useRef(false)

  // Held or not, crossfaded between the two drawings. Short on purpose: this
  // is feedback on a press, so it wants to be felt rather than watched.
  const press = useSharedValue(0)
  // Always mounted, never faded in by a layout animation. `entering` runs
  // after the element has painted once, which is exactly the appear-vanish-
  // fade the button was doing. One shared value, one mechanism, no first
  // frame to get wrong.
  const shown = useSharedValue(0)
  const restingIcon = useAnimatedStyle(() => ({ opacity: 1 - press.value }))
  const pressedIcon = useAnimatedStyle(() => ({ opacity: press.value }))
  // A touch of give, stated here rather than left to the material's own
  // interactive response, which scales further than this wants to.
  const pressScale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.04 }],
  }))

  useFocusEffect(
    useCallback(() => {
      launching.current = false
      listRoutines().then(setRoutines)
    }, []),
  )

  const disturb = useCallback(() => setDisturbed(true), [])

  useEffect(() => {
    shown.value = withTiming(disturbed ? 1 : 0, { duration: disturbed ? 220 : 180 })
  }, [disturbed, shown])

  const restackStyle = useAnimatedStyle(() => ({ opacity: shown.value }))

  function restack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setResetAt(Date.now())
    setDisturbed(false)
    // Back to the resting drawing by hand. This button disappears the moment
    // it is tapped, so onPressOut never arrives — and the value lives on the
    // screen rather than the button, so it would still be held down the next
    // time the button appeared.
    press.value = 0
  }

  function start(routine, slotIndex, rect) {
    if (launching.current) return
    launching.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const colour = styleFor(routine.type ?? routine.name, slotIndex).background
    // The session is created while the colour is still expanding, so the
    // database write never shows up as a delay before the tap responds.
    const pending = (async () => (await getActiveSession()) ?? startSession(routine))()

    async function arrive() {
      let session
      try {
        session = await pending
      } catch (error) {
        // A failure here would otherwise strand the screen: the colour has
        // already filled it and there is nothing to navigate to, so it simply
        // stays. Better to retreat than to hang with no way out.
        console.error('Could not start the workout', error)
        launching.current = false
        endLaunch()
        return
      }
      router.push({
        pathname: '/workout/[sessionId]',
        // Without the leading '#': the colour travels as a URL parameter, and
        // a hash there is a fragment delimiter, not part of the value.
        params: { sessionId: session.id, color: colour.replace('#', '') },
      })
      endLaunch()
    }

    beginLaunch({ from: originFrom(rect, screen), color: colour, onArrived: arrive })
  }

  const headerTop = insets.top + SPACE[4]

  return (
    <View style={styles.screen}>
      <WorkoutStack
        routines={routines}
        resetAt={resetAt}
        onDisturb={disturb}
        onStart={start}
      />

      {/* Above the cards, so they pass behind it. */}
      <View style={[styles.header, { top: headerTop }]} pointerEvents="box-none">
        <Text style={styles.title}>Workouts</Text>

        {/* Only once the cards have been moved: it is a way back, so there is
            nothing for it to do until there is something to undo. Present
            either way, so nothing has to appear. */}
        <Animated.View
          pointerEvents={disturbed ? 'auto' : 'none'}
          // Opacity over a GlassView stops it rendering, so this is only for
          // the blurred stand-in; the material switches itself off instead,
          // through `hidden` below.
          style={!LIQUID_GLASS && restackStyle}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restack the cards"
            onPress={restack}
            onPressIn={() => (press.value = withTiming(1, { duration: 120 }))}
            onPressOut={() => (press.value = withTiming(0, { duration: 180 }))}
            hitSlop={12}
          >
            <Glass
              style={styles.restack}
              // The real material cannot be faded by anything above it, so it
              // switches itself off; the blurred stand-in just fades.
              hidden={LIQUID_GLASS && !disturbed}
              fallback={<View style={styles.restackWash} />}
            >
              {/* Every fade here is inside the surface, never over it: the
                  effect renders wrongly under any opacity, and both the
                  appearance and the press are opacity. */}
              <Animated.View style={[styles.icons, pressScale]}>
                <Animated.View style={restingIcon}>
                  <StackIcon color={LIGHT.text} />
                </Animated.View>
                <Animated.View style={[styles.iconOver, pressedIcon]}>
                  <StackIconPressed color={LIGHT.text} />
                </Animated.View>
              </Animated.View>
            </Glass>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: LIGHT.bg },
  header: {
    position: 'absolute',
    left: SPACE[3],
    right: SPACE[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Over the canvas, so a card dragged upward passes behind the title.
    zIndex: 20,
  },
  title: { ...TYPE.screenTitle, color: LIGHT.text },
  restack: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restackWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.5)' },
  icons: { width: 24, height: 24 },
  // Laid exactly over the resting one so the two crossfade in place.
  //
  // Invisible in its own right, not only by way of its animated style. The
  // group fades in with a layout animation while these carry animated styles
  // of their own, and the two do not necessarily land on the same first
  // frame — so without this the pressed drawing painted at full strength for
  // a frame as the button appeared, and both were briefly on screen at once.
  iconOver: { ...StyleSheet.absoluteFillObject, opacity: 0 },
})
