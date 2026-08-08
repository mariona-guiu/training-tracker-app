import { useEffect } from 'react'
import { withLayoutContext } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SettingsIcon, StatsIcon, WorkoutIcon } from '../../src/components/TabIcons.jsx'
import { Glass, LIQUID_GLASS } from '../../src/components/Glass.jsx'
import { createSpringTabNavigator } from '../../src/components/SpringTabs.jsx'
import { NAV_FLOAT_GAP, NAV_HEIGHT } from '../../src/theme/index.js'
import { TAB_SPRING } from '../../src/data/motion.js'

// The three tabbed screens and the floating bar that switches them. A workout
// in progress deliberately sits outside this group, so it fills the display
// with no bar over it — the same split the web app makes, for the same reason.
//
// The screens lie side by side and settle on a spring — see SpringTabs, which
// exists because no pager on offer lets its landing be configured, and the web
// app lands on PUSH_SPRING rather than stopping dead.
const { Navigator } = createSpringTabNavigator()
const SpringTabs = withLayoutContext(Navigator)

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

export default function TabsLayout() {
  return (
    <SpringTabs tabBar={(props) => <TabBar {...props} />}>
      <SpringTabs.Screen name="index" />
      <SpringTabs.Screen name="stats" />
      <SpringTabs.Screen name="settings" />
    </SpringTabs>
  )
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 2 },
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
