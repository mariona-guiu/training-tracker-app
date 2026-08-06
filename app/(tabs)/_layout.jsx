import { Tabs } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SettingsIcon, StatsIcon, WorkoutIcon } from '../../src/components/TabIcons.jsx'
import { LIGHT, NAV_FLOAT_GAP, NAV_HEIGHT } from '../../src/theme/index.js'

// The three tabbed screens and the floating bar that switches them. A workout
// in progress deliberately sits outside this group, so it fills the display
// with no bar over it — the same split the web app makes, for the same reason.
//
// The bar is drawn here rather than using the default tab bar because it is a
// floating pill the content runs behind, not a docked strip. Everything about
// it is ported from .bottom-nav: 64x44 items so the selected lozenge is wider
// than it is tall and still past the 44pt minimum for something tapped
// mid-workout, and a blurred, gradient-lit surface.
//
// The one web-only concern that does not come with it is the stale-pixel
// workaround — each icon needed its own compositing layer because Safari
// leaves blank pixels where a layer above a backdrop-filter is removed. That
// is a Safari bug, not an iOS one, and there is no WebKit here.

const TABS = [
  { name: 'index', Icon: WorkoutIcon, label: 'Workouts' },
  { name: 'stats', Icon: StatsIcon, label: 'Stats' },
  { name: 'settings', Icon: SettingsIcon, label: 'Settings' },
]

const ICON_INK = '#191919'

function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets()

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
      <BlurView intensity={60} tint="light" style={styles.bar}>
        <LinearGradient
          colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.32)']}
          style={StyleSheet.absoluteFill}
        />
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
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
                if (!active && !event.defaultPrevented) navigation.navigate(route.name)
              }}
              style={styles.item}
            >
              {active ? <View style={styles.highlight} /> : null}
              <tab.Icon active={active} color={ICON_INK} />
            </Pressable>
          )
        })}
      </BlurView>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="settings" />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 4,
    height: NAV_HEIGHT,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  item: {
    width: 64,
    height: 44,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 27,
    backgroundColor: 'rgba(10,10,10,0.16)',
  },
})
