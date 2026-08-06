import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getSettings, saveSettings } from '../../src/db/settings.js'
import { FONTS, LIGHT, SPACE, TAB_BAR_CLEARANCE } from '../../src/theme/index.js'

// A placeholder for the Settings screen. Only the rest toggle is wired, and
// it is here because it is the cheapest end-to-end proof that a preference
// survives being written, read back and used by another screen.
//
// The pace selector, the body weight field and "Your data" come with the full
// port. The weight field in particular is not a quick job: on the web it took
// a drawn caret and an input parked offscreen to survive the iOS keyboard.
// Whether any of that is still needed here is an open question — a native
// TextInput and KeyboardAvoidingView may simply behave.
export default function Settings() {
  const [settings, setSettings] = useState(null)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  async function toggleRest(value) {
    setSettings((s) => ({ ...s, restEnabled: value }))
    await saveSettings({ restEnabled: value })
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{
        paddingTop: insets.top + SPACE[4],
        paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + SPACE[4],
        paddingHorizontal: SPACE[3],
        gap: SPACE[3],
      }}
    >
      <Text style={styles.title}>Settings</Text>

      {settings ? (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Rest time</Text>
              <Text style={styles.rowNote}>
                A timer runs between sets so you know when to go again.
              </Text>
            </View>
            <Switch value={settings.restEnabled} onValueChange={toggleRest} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: LIGHT.bg },
  title: { fontFamily: FONTS.medium, fontSize: 20, color: LIGHT.text },
  card: { backgroundColor: '#F7F7F6', borderRadius: 8, padding: SPACE[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE[3] },
  rowText: { flex: 1, gap: SPACE[1] },
  rowTitle: { fontFamily: FONTS.medium, fontSize: 17, color: '#191919' },
  rowNote: { fontFamily: FONTS.regular, fontSize: 13, color: '#8A8A8A' },
})
