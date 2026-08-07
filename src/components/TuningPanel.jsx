import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { FONTS, LIGHT } from '../theme/index.js'

// TEMPORARY — scaffolding for tuning the card canvas by hand.
//
// Here so the feel of the cards can be dialled in on the phone, where it can
// actually be judged, instead of being described in words and guessed at in
// numbers. Opened by holding the "Workouts" title; invisible otherwise.
//
// When the values settle, write them into DEFAULT_TUNING in the Workouts
// screen and delete this file along with the state it hangs off. It is not
// meant to ship, the same way /stats?mock was not.

export const TUNING_CONTROLS = [
  { key: 'power', label: 'Throw distance', min: 0, max: 0.5, step: 0.01, hint: 'how far it carries' },
  {
    key: 'glideStiffness',
    label: 'Glide softness',
    min: 15,
    max: 250,
    step: 5,
    hint: 'lower is slower and softer',
  },
  { key: 'glideDamping', label: 'Glide damping', min: 8, max: 60, step: 1, hint: 'higher stops sooner' },
  { key: 'tilt', label: 'Tilt per px', min: 0, max: 0.4, step: 0.01 },
  { key: 'elastic', label: 'Edge give', min: 0, max: 0.5, step: 0.01, hint: 'past the boundary' },
  { key: 'tiltMax', label: 'Tilt limit', min: 0, max: 45, step: 1, hint: 'degrees' },
  { key: 'stiffness', label: 'Restack stiffness', min: 40, max: 500, step: 10 },
  { key: 'damping', label: 'Restack damping', min: 4, max: 60, step: 1 },
]

const round = (value, step) => Math.round(value / step) * step

function Slider({ control, value, onChange }) {
  const [width, setWidth] = useState(0)
  const span = control.max - control.min

  const set = (px) => {
    if (!width) return
    const ratio = Math.min(Math.max(px / width, 0), 1)
    onChange(control.key, Number(round(control.min + ratio * span, control.step).toFixed(4)))
  }

  const pan = Gesture.Pan()
    .onBegin((event) => set(event.x))
    .onUpdate((event) => set(event.x))
    .runOnJS(true)

  const filled = width ? ((value - control.min) / span) * width : 0

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Text style={styles.label}>
          {control.label}
          {control.hint ? <Text style={styles.hint}> · {control.hint}</Text> : null}
        </Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.fill, { width: filled }]} />
          <View style={[styles.knob, { left: Math.max(0, filled - 9) }]} />
        </View>
      </GestureDetector>
    </View>
  )
}

export function TuningPanel({ tuning, onChange, onReset, onClose }) {
  return (
    <View style={styles.panel}>
      <View style={styles.bar}>
        <Text style={styles.title}>Card feel · temporary</Text>
        <View style={styles.barActions}>
          <Pressable onPress={onReset} style={styles.action}>
            <Text style={styles.actionLabel}>Defaults</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.action}>
            <Text style={styles.actionLabel}>Close</Text>
          </Pressable>
        </View>
      </View>

      {TUNING_CONTROLS.map((control) => (
        <Slider
          key={control.key}
          control={control}
          value={tuning[control.key]}
          onChange={onChange}
        />
      ))}

      <Text style={styles.note}>
        Tell me the numbers you land on and I will write them in as the defaults.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 92,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: LIGHT.border,
    gap: 10,
    zIndex: 50,
  },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: LIGHT.textDim,
  },
  barActions: { flexDirection: 'row', gap: 8 },
  action: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: LIGHT.bgRaised },
  actionLabel: { fontFamily: FONTS.medium, fontSize: 12, color: LIGHT.text },
  row: { gap: 4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontFamily: FONTS.regular, fontSize: 12, color: LIGHT.text },
  hint: { color: LIGHT.textDim },
  value: { fontFamily: FONTS.mono, fontSize: 12, color: LIGHT.text },
  // Tall enough to grab without hunting for it.
  track: { height: 22, justifyContent: 'center' },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: LIGHT.text },
  knob: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: LIGHT.text,
  },
  note: { fontFamily: FONTS.regular, fontSize: 11, color: LIGHT.textDim, marginTop: 2 },
})
