import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, { SlideInDown } from 'react-native-reanimated'

import { CloseIcon } from './WorkoutIcons.jsx'
import { FONTS, SPACE } from '../theme/index.js'

// Correcting a set already logged.
//
// Reached by long-pressing the circle rather than by tapping it, so a
// mistimed tap can never quietly undo a set — the tap is reserved for
// logging, which is the thing being done every thirty seconds with tired
// hands. That is a deliberate departure from the web app, where a filled
// circle opens this on a plain tap.
export function EditSetSheet({ exercise, setIndex, isLast, colour, ink, onSave, onRemove, onClose }) {
  const set = exercise.sets[setIndex]
  const [reps, setReps] = useState(String(set.reps ?? ''))
  const [weight, setWeight] = useState(set.weight == null ? '' : String(set.weight))
  const unit = exercise.tracksWeight ? 'kg' : 'sec'

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
      {/* The sheet sits at the bottom, which is exactly where the keypad
          arrives — without this it would open underneath it. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
        style={styles.avoider}
        pointerEvents="box-none"
      >
      <Animated.View
        entering={SlideInDown.springify().damping(34).stiffness(340)}
        style={[styles.sheet, { backgroundColor: colour }]}
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: ink }]}>
            Editing set {setIndex + 1}/{exercise.targetSets}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close without saving"
            accessibilityRole="button"
            style={styles.close}
          >
            <CloseIcon size={24} color={ink} />
          </Pressable>
        </View>

        <View style={styles.values}>
          <View style={styles.value}>
            <TextInput
              value={reps}
              onChangeText={(text) => setReps(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              accessibilityLabel="Reps for this set"
              style={[styles.figure, { color: ink }]}
            />
            <Text style={[styles.unit, { color: ink }]}>reps</Text>
          </View>

          {exercise.tracksWeight ? (
            <View style={styles.value}>
              <TextInput
                value={weight}
                onChangeText={(text) => setWeight(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                accessibilityLabel="Weight for this set"
                style={[styles.figure, { color: ink }]}
              />
              <Text style={[styles.unit, { color: ink }]}>{unit}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => onSave(reps, weight)}
          style={[styles.save, { backgroundColor: ink }]}
        >
          <Text style={[styles.saveLabel, { color: colour }]}>Save</Text>
        </Pressable>

        {/* Only the most recent set can be removed, so the row always fills
            and empties from the same end and never develops a hole. */}
        {isLast ? (
          <Pressable onPress={onRemove} style={styles.remove}>
            <Text style={[styles.removeLabel, { color: ink }]}>Remove set</Text>
          </Pressable>
        ) : null}
      </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  avoider: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    padding: SPACE[3],
    paddingBottom: SPACE[5],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: SPACE[3],
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.88,
    opacity: 0.85,
  },
  close: { padding: SPACE[2], margin: -SPACE[2] },
  values: { gap: SPACE[2] },
  value: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  figure: { fontFamily: FONTS.bold, fontSize: 40, lineHeight: 48, minWidth: 90, padding: 0 },
  unit: { fontFamily: FONTS.bold, fontSize: 40, lineHeight: 48, opacity: 0.45 },
  save: {
    minHeight: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  remove: { alignItems: 'center', paddingVertical: SPACE[2] },
  removeLabel: { fontFamily: FONTS.regular, fontSize: 15, opacity: 0.7 },
})
