import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { listCompletedSessions } from '../../src/db/sessions.js'
import { FONTS, LIGHT, SPACE, TAB_BAR_CLEARANCE } from '../../src/theme/index.js'

// A placeholder standing in for the Stats screen until the counters, the
// weekly chart and History are ported. It reads the real sessions rather than
// showing nothing, so finishing a workout visibly lands somewhere and the
// storage layer is exercised end to end.
export default function Stats() {
  const [sessions, setSessions] = useState([])
  const insets = useSafeAreaInsets()

  useFocusEffect(
    useCallback(() => {
      listCompletedSessions().then(setSessions)
    }, []),
  )

  const totalSets = sessions.reduce(
    (n, s) => n + s.exercises.reduce((m, e) => m + e.sets.filter((set) => set.done).length, 0),
    0,
  )

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
      <Text style={styles.title}>Stats</Text>

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{sessions.length}</Text>
          <Text style={styles.statLabel}>workouts</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{totalSets}</Text>
          <Text style={styles.statLabel}>sets logged</Text>
        </View>
      </View>

      {sessions.map((session) => (
        <View key={session.id} style={styles.session}>
          <Text style={styles.sessionName}>{session.routineName}</Text>
          <Text style={styles.sessionMeta}>
            {new Date(session.startedAt).toLocaleDateString()}
            {session.endedEarly ? ' · ended early' : ''}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: LIGHT.bg },
  title: { fontFamily: FONTS.medium, fontSize: 20, color: LIGHT.text },
  row: { flexDirection: 'row', gap: SPACE[3] },
  stat: {
    flex: 1,
    backgroundColor: LIGHT.bgRaised,
    borderRadius: 8,
    padding: SPACE[3],
    gap: SPACE[1],
  },
  statNumber: { fontFamily: FONTS.medium, fontSize: 34, color: LIGHT.text },
  statLabel: { fontFamily: FONTS.regular, fontSize: 13, color: LIGHT.textDim },
  session: {
    backgroundColor: LIGHT.bgRaised,
    borderRadius: 8,
    padding: SPACE[3],
    gap: SPACE[1],
  },
  sessionName: { fontFamily: FONTS.medium, fontSize: 17, color: LIGHT.text },
  sessionMeta: { fontFamily: FONTS.regular, fontSize: 13, color: LIGHT.textDim },
})
