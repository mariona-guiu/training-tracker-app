import { useEffect } from 'react'
import { withLayoutContext } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SettingsIcon, StatsIcon, WorkoutIcon } from '../../src/components/TabIcons.jsx'
import { Glass, LIQUID_GLASS } from '../../src/components/Glass.jsx'
import { createSpringTabNavigator } from '../../src/components/SpringTabs.jsx'
import { NAV_FLOAT_GAP, NAV_HEIGHT, RADIUS } from '../../src/theme/index.js'
import { useTheme, useThemedStyles } from '../../src/theme/ThemeProvider.jsx'
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
  const theme = useTheme()
  const styles = useThemedStyles(makeStyles)
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
            colors={theme.glassWash}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        {!LIQUID_GLASS && <View style={styles.barEdge} pointerEvents="none" />}

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
              <tab.Icon active={active} color={theme.text} />
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

const makeStyles = (t) => StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: BAR_PAD,
    gap: ITEM_GAP,
    height: NAV_HEIGHT,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  // Only for the blurred stand-in: the real material draws its own edge and
  // casts its own shadow, and these on top of it read as a drawn outline.
  barFallback: {
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  // The edge, drawn rather than bordered. A borderWidth on the bar comes out
  // of its 52: it left 42 of content for a 44 item, so the items overflowed by
  // two and alignItems centred them a pixel up, while the pill — positioned
  // against the box rather than against them — stayed where it was told. Laid
  // over instead, it is the same hairline at no cost in height, so the item
  // fits its box exactly and the pill and the icons agree by construction.
  barEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: t.glassEdge,
    borderRadius: RADIUS.pill,
  },
  item: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    left: BAR_PAD,
    top: BAR_PAD,
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: RADIUS.pill,
    // The value it landed on — a quarter lighter than the web's 0.16, since
    // the material underneath is the system's now rather than a blurred
    // gradient and the pill does not have to work as hard against it — is
    // recorded on the palette, which is also where its dark counterpart is.
    backgroundColor: t.highlight,
  },
})
