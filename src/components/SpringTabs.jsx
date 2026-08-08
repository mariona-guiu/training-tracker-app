import { useEffect } from 'react'
import { Keyboard, StyleSheet, View, useWindowDimensions } from 'react-native'
import {
  createNavigatorFactory,
  TabRouter,
  useNavigationBuilder,
} from '@react-navigation/native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { PUSH_SPRING } from '../data/motion.js'

// A tab navigator whose screens lie side by side and settle on a spring.
//
// Built by hand rather than taken off the shelf, for one reason: the landing.
// react-native-pager-view follows a finger beautifully and then stops, because
// what settles it is iOS's own scroll snap — and neither
// @react-navigation/material-top-tabs nor react-native-tab-view nor the pager
// itself exposes anything but `animationEnabled: true | false`. The web app
// settles on PUSH_SPRING, which arrives rather than stopping, and the two
// should feel the same.
//
// Everything else here is what the pager was doing for nothing and now has to
// be done on purpose: laying the screens out, deciding which one a release
// lands on, and keeping the navigator's index in step with the offset.

// How far across a screen a drag has to travel to land on the next tab, as a
// fraction of the width, and the flick that can carry it with less.
const SWIPE_DISTANCE = 0.28
const SWIPE_VELOCITY = 420

// The cards own the middle of the Workouts screen, so a swipe only leaves that
// tab if it begins within a thumb's width of the right edge.
const EDGE_BAND = 32

function SpringTabsNavigator({ children, screenOptions, tabBar, initialRouteName }) {
  const { state, navigation, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, {
    children,
    screenOptions,
    initialRouteName,
  })

  const { width } = useWindowDimensions()
  const count = state.routes.length
  const index = state.index

  const offset = useSharedValue(-index * width)
  const start = useSharedValue(0)
  // The index the gesture reads, since it runs on the UI thread and cannot see
  // React state.
  const live = useSharedValue(index)
  // Whether this gesture is allowed to move anything at all. Decided once, as
  // it begins, so a drag that started in the wrong place cannot become a swipe
  // halfway through.
  const allowed = useSharedValue(true)
  // A raised keyboard belongs to a field on the screen it was raised from, so
  // the pager stays put while one is up. Swiping away left the keyboard
  // standing over a screen with nothing to type into, and the half-finished
  // edit behind it. Same events the screens themselves listen to, so the
  // three agree about when the keyboard is up.
  const keyboardUp = useSharedValue(false)

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardWillShow', () => {
      keyboardUp.value = true
    })
    const hidden = Keyboard.addListener('keyboardWillHide', () => {
      keyboardUp.value = false
    })
    return () => {
      shown.remove()
      hidden.remove()
    }
  }, [keyboardUp])

  // Tapping a tab lands the same way a swipe does.
  useEffect(() => {
    live.value = index
    offset.value = withSpring(-index * width, PUSH_SPRING)
  }, [index, width, offset, live])

  function go(next) {
    if (next !== state.index) navigation.navigate(state.routes[next].name)
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-24, 24])
    .onBegin((event) => {
      start.value = offset.value
      // Workouts is the only screen with something else wanting horizontal
      // drags, so it is the only one with an edge to respect.
      allowed.value =
        !keyboardUp.value && (live.value !== 0 || event.x >= width - EDGE_BAND)
    })
    .onUpdate((event) => {
      if (!allowed.value) return
      const next = start.value + event.translationX
      // Past either end there is nowhere to go, so the edge gives rather than
      // following the finger.
      const min = -(count - 1) * width
      offset.value = next > 0 ? next * 0.2 : next < min ? min + (next - min) * 0.2 : next
    })
    .onEnd((event) => {
      if (!allowed.value) return
      const far = width * SWIPE_DISTANCE
      let target = live.value
      if (event.translationX < -far || event.velocityX < -SWIPE_VELOCITY) target += 1
      else if (event.translationX > far || event.velocityX > SWIPE_VELOCITY) target -= 1
      if (target < 0 || target >= count) target = live.value

      // Always stated, including when nothing changed, so a short drag springs
      // back rather than staying where the finger left it.
      offset.value = withSpring(-target * width, PUSH_SPRING)
      if (target !== live.value) {
        live.value = target
        runOnJS(go)(target)
      }
    })

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }))

  return (
    <NavigationContent>
      <View style={styles.host}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.track, { width: width * count }, track]}>
            {state.routes.map((route) => (
              <View key={route.key} style={[styles.page, { width }]}>
                {descriptors[route.key].render()}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
        {tabBar ? tabBar({ state, navigation, descriptors }) : null}
      </View>
    </NavigationContent>
  )
}

export const createSpringTabNavigator = createNavigatorFactory(SpringTabsNavigator)

const styles = StyleSheet.create({
  host: { flex: 1 },
  track: { flex: 1, flexDirection: 'row' },
  // A screen keeps to its own width. The card canvas deliberately draws past
  // the edge — the top card sits half off-screen — and with the screens laid
  // side by side in one track, past the edge meant on top of the next tab: an
  // orange card over Stats mid-swipe, and a sliver of it left behind after.
  //
  // Clipping here rather than on the canvas, because it is the track that
  // makes "past the edge" mean "over the neighbour". Safe in a way the web's
  // equivalent was not: overflow on a React Native View clips and nothing
  // else, where CSS overflow made an ancestor a scroll container and unstuck
  // every page title.
  page: { overflow: 'hidden' },
})
