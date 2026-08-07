import { useEffect } from 'react'
import { withLayoutContext } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SettingsIcon, StatsIcon, WorkoutIcon } from '../../src/components/TabIcons.jsx'
import { Glass, LIQUID_GLASS } from '../../src/components/Glass.jsx'
import { NAV_FLOAT_GAP, NAV_HEIGHT } from '../../src/theme/index.js'
import { TAB_SPRING } from '../../src/data/motion.js'

// The three tabbed screens and the floating bar that switches them. A workout
// in progress deliberately sits outside this group, so it fills the display
// with no bar over it — the same split the web app makes, for the same reason.
//
// Built on material top tabs with the bar moved to the bottom, rather than on
// bottom tabs. The reason is the swipe: a bottom-tab navigator mounts one
// screen at a time and stacks them, so there is never a neighbour on screen to
// follow your finger. This one lays them side by side on a pager, which is how
// the web's tab transition behaves — each screen entering and leaving from its
// own side.
const { Navigator } = createMaterialTopTabNavigator()
const MaterialTopTabs = withLayoutContext(Navigator)

const TABS = [
  { name: 'index', Icon: WorkoutIcon, label: 'Workouts' },
  { name: 'stats', Icon: StatsIcon, label: 'Stats' },
  { name: 'settings', Icon: SettingsIcon, label: 'Settings' },
]

const ICON_INK = '#191919'

// One pill, moved — not one per tab, switched. The bar's own padding puts the
// first item here, and each one after it is a width and a gap further along,
// so where the pill belongs is arithmetic rather than measurement.
const ITEM_WIDTH = 64
const ITEM_HEIGHT = 44
const ITEM_GAP = 4
const BAR_PAD = 4
const STEP = ITEM_WIDTH + ITEM_GAP

// The cards own the middle of the Workouts screen, so the pager's own swipe is
// turned off there and only a drag begun at the right edge leaves the tab —
// the same rule the web uses, for the same reason.
const EDGE_BAND = 32
const EDGE_SWIPE = 48

function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets()
  const pill = useSharedValue(state.index * STEP)

  useEffect(() => {
    pill.value = withSpring(state.index * STEP, TAB_SPRING)
  }, [state.index, pill])

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pill.value }] }))

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.dock,
        // The system's bottom inset and our own float gap serve the same
        // purpose, so this takes the larger rather than stacking both.
        { bottom: Math.max(NAV_FLOAT_GAP, insets.bottom) },
      ]}
    >
      {/* The system's own material where the phone has it. Where it does not,
          the blur and the lit gradient ported from .bottom-nav — which is what
          that CSS was approximating in the first place. */}
      <Glass
        intensity={60}
        style={[styles.bar, !LIQUID_GLASS && styles.barFallback]}
        fallback={
          <LinearGradient
            colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.32)']}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        {/* Under the icons and over the surface, so it reads as part of the
            bar rather than as something laid on top of it. */}
        <Animated.View style={[styles.highlight, pillStyle]} pointerEvents="none" />

        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name)
          if (!tab) return null
          const active = state.index === index

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
              onPress={() => {
                if (!active) navigation.navigate(route.name)
              }}
              style={styles.item}
            >
              <tab.Icon active={active} color={ICON_INK} />
            </Pressable>
          )
        })}
      </Glass>
    </View>
  )
}

// A drag begun within a thumb's width of the right edge of the Workouts screen
// moves on to Stats. It does not follow the finger the way the pager does — it
// cannot, since the pager's own swipe is off on this screen — but it leaves
// the cards the whole canvas, which matters more.
function HomeEdgeSwipe({ navigation, state }) {
  const onHome = state.index === 0

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-24, 24])
    .onEnd((event) => {
      // Only ever forwards: there is nothing to the left of Workouts.
      if (event.translationX > -EDGE_SWIPE) return
      runOnJS(navigation.navigate)('stats')
    })

  if (!onHome) return null

  return (
    <GestureDetector gesture={swipe}>
      <View style={[styles.edge, { width: EDGE_BAND }]} />
    </GestureDetector>
  )
}

export default function TabsLayout() {
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      tabBar={(props) => (
        <>
          <HomeEdgeSwipe {...props} />
          <TabBar {...props} />
        </>
      )}
    >
      {/* The cards need the whole canvas, so the pager does not take swipes
          here — the edge strip stands in for it. */}
      <MaterialTopTabs.Screen name="index" options={{ swipeEnabled: false }} />
      <MaterialTopTabs.Screen name="stats" />
      <MaterialTopTabs.Screen name="settings" />
    </MaterialTopTabs>
  )
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  // A strip down the right-hand side of the Workouts screen, invisible and
  // narrow enough that the cards keep everything else.
  // Starts below the header. Run to the top and it lies over the restack
  // button, which sits 16 from the same edge — the strip is invisible, so
  // what looks like a missing control is a missing *tap*.
  edge: { position: 'absolute', right: 0, top: 140, bottom: 0, zIndex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: BAR_PAD,
    gap: ITEM_GAP,
    height: NAV_HEIGHT,
    borderRadius: 35,
    overflow: 'hidden',
  },
  // Only for the blurred stand-in: the real material draws its own edge and
  // casts its own shadow, and these on top of it read as a drawn outline.
  barFallback: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  item: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    left: BAR_PAD,
    top: BAR_PAD,
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: 27,
    // A quarter lighter than the web's 0.16 — the material underneath is the
    // system's now rather than a blurred gradient, and the pill does not need
    // to work as hard against it.
    backgroundColor: 'rgba(10,10,10,0.12)',
  },
})
