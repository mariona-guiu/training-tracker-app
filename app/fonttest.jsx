import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LIGHT, SPACE, TYPE } from '../src/theme/index.js'

// TEMPORARY — delete once the SF Pro question is settled.
//
// React Native reaches SF Pro with `fontFamily: 'System'`. SF Pro *Rounded*
// is the open question: iOS exposes rounded as a system font *design* rather
// than as a named family, and the underlying family is private. Seven of the
// twelve roles in the new type spec are Rounded, so if no name here resolves,
// the fonts have to be bundled after all — and the whole "no bundled fonts"
// simplification goes with it.
//
// The failure mode is silent: an unknown family falls back to the system font
// and renders perfectly, looking like a working answer. So this shows each
// candidate directly above the same string in System, and measures both. Two
// readings, because neither alone is conclusive — a width that matches proves
// nothing (Rounded may share SF Pro's metrics), and eyes on a small sample can
// talk themselves into a difference that isn't there.

const SAMPLE = 'Back squat 8·380'

// ROUND ONE, answered on the device 2026-08-10: of twelve candidates only
// `ui-rounded` and `.AppleSystemUIFontRounded` render rounded. Every other
// name — including the plausible-looking 'SF Pro Rounded' and
// 'SFProRounded-Regular' — falls back to plain SF Pro silently.
//
// Round two is below, and is the question that actually decides the spec:
// whether either name honours fontWeight. Seven roles are Rounded across
// three weights, and React Native frequently ignores fontWeight once a family
// is named, handing back one cut for all of them.
const CANDIDATES = ['ui-rounded', '.AppleSystemUIFontRounded', 'System']

// The three the spec needs, plus the two either side so a ladder that is not
// really moving is obvious — six identical lines say fontWeight is ignored.
const WEIGHTS = ['300', '400', '500', '600', '700', '800']

export default function FontTest() {
  const insets = useSafeAreaInsets()
  const [widths, setWidths] = useState({})

  const measure = useCallback((key) => (event) => {
    const { width } = event.nativeEvent.layout
    setWidths((prev) => (prev[key] === width ? prev : { ...prev, [key]: width }))
  }, [])

  const base = widths.System

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SPACE[3],
          paddingBottom: insets.bottom + SPACE[6],
          paddingHorizontal: SPACE[3],
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>Back</Text>
        </Pressable>

        <Text style={styles.h1}>Font test</Text>
        <Text style={styles.intro}>
          Each block shows the sample in a candidate family, then the same sample in System
          underneath. If the two look identical, the name did not resolve. Rounded letterforms show
          up first in a, s, e, g and the digits.
        </Text>

        <View style={styles.card}>
          <Text style={styles.name}>System — the reference</Text>
          <Text
            style={[styles.sample, { fontFamily: 'System' }]}
            onLayout={measure('System')}
          >
            {SAMPLE}
          </Text>
          <Text style={styles.verdict}>
            {base ? `${base.toFixed(1)}pt wide` : 'measuring…'}
          </Text>
        </View>

        {CANDIDATES.map((family) => (
          <View key={family} style={styles.card}>
            <Text style={styles.name}>{family} — weight ladder</Text>
            {WEIGHTS.map((weight) => {
              const key = family + weight
              const width = widths[key]
              const prev = widths[family + WEIGHTS[WEIGHTS.indexOf(weight) - 1]]
              const moved = typeof width === 'number' && typeof prev === 'number'
                ? Math.abs(width - prev) > 0.5
                : null
              return (
                <View key={weight} style={styles.line}>
                  <Text style={styles.weightTag}>{weight}</Text>
                  <Text
                    style={[styles.ladder, { fontFamily: family, fontWeight: weight }]}
                    onLayout={measure(key)}
                  >
                    {SAMPLE}
                  </Text>
                  <Text style={[styles.verdict, moved ? styles.hit : null]}>
                    {typeof width === 'number' ? width.toFixed(1) : '…'}
                    {moved === true ? '  ↑' : ''}
                  </Text>
                </View>
              )
            })}
          </View>
        ))}

        {/* Digits have to line up in History's set columns and on the chart, so
            whichever name wins has to carry tabular figures too. Equal widths
            means it does. */}
        <View style={styles.card}>
          <Text style={styles.name}>Tabular figures</Text>
          {CANDIDATES.map((family) => {
            const one = widths[family + 'ones']
            const eight = widths[family + 'eights']
            const even = typeof one === 'number' && typeof eight === 'number'
              ? Math.abs(one - eight) < 0.5
              : null
            return (
              <View key={family} style={styles.line}>
                <Text style={styles.weightTag}>{family === 'System' ? 'sys' : family.slice(0, 6)}</Text>
                <View>
                  <Text
                    style={[styles.tab, { fontFamily: family }]}
                    onLayout={measure(family + 'ones')}
                  >
                    1111111
                  </Text>
                  <Text
                    style={[styles.tab, { fontFamily: family }]}
                    onLayout={measure(family + 'eights')}
                  >
                    8888888
                  </Text>
                </View>
                <Text style={[styles.verdict, even ? styles.hit : null]}>
                  {even === null ? '…' : even ? 'aligned' : 'not tabular'}
                </Text>
              </View>
            )
          })}
        </View>

        <Text style={styles.intro}>
          Two questions. Does each ladder actually get heavier from 300 to 800, or are all six lines
          the same? And in the last block, do the ones and eights line up?
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: LIGHT.bg },
  back: { ...TYPE.body, color: LIGHT.textDim, marginBottom: SPACE[2] },
  h1: { ...TYPE.screenTitle, color: LIGHT.text },
  intro: { ...TYPE.caption, lineHeight: 17, color: LIGHT.textDim, marginTop: SPACE[2] },
  card: {
    backgroundColor: LIGHT.bgRaised,
    borderRadius: 12,
    padding: SPACE[3],
    marginTop: SPACE[3],
  },
  name: { ...TYPE.caption, color: LIGHT.textDim, marginBottom: SPACE[2] },
  // Deliberately no lineHeight: a family that resolves may well have different
  // metrics, and stating one would hide exactly that.
  sample: { fontSize: 30, color: LIGHT.text, alignSelf: 'flex-start' },
  ghost: { color: LIGHT.textDim, opacity: 0.55 },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], marginTop: SPACE[2] },
  weightTag: { ...TYPE.caption, color: LIGHT.textDim, width: 34 },
  ladder: { fontSize: 21, color: LIGHT.text, flex: 1 },
  tab: { fontSize: 19, color: LIGHT.text, fontVariant: ['tabular-nums'] },
  verdict: { ...TYPE.caption, color: LIGHT.textDim, marginTop: SPACE[2] },
  hit: { color: LIGHT.text },
})
