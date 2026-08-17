import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import { runOnJS } from 'react-native-reanimated'

import {
  CANONICAL_ORDER,
  styleFor,
  restTintFor,
  washFor,
  inkFor,
} from '../src/data/routineStyles.js'
import { DARK, LIGHT, RADIUS, SPACE, TYPE } from '../src/theme/index.js'

// TEMPORARY — the colour lab.
//
// Built 2026-08-17 to settle two questions that cannot be answered by reading
// hex codes: whether a routine's button wash should be a neutral film or a
// shade of the routine's own hue, and what the sweep should be once it is.
//
// Nothing here changes the app. It is a preview: move the sliders, read the
// values off the bottom, and type the ones you like into routineStyles.js.
// Then delete this file and the row at the foot of Settings that opens it.
//
// The same shape as the tuning panel that settled the card canvas — see
// "Build the user a panel" in CLAUDE.md. It exists because describing a colour
// to someone who cannot see the screen is the slowest possible way to choose
// one.

// ─── colour maths, local because this file is disposable ──────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
}

function rgbToHex([r, g, b]) {
  return (
    '#' +
    [r, g, b]
      .map((c) =>
        Math.round(clamp(c, 0, 1) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  ).toUpperCase()
}

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const span = max - min
  const s = l > 0.5 ? span / (2 - max - min) : span / (max + min)
  let h
  if (max === r) h = ((g - b) / span + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / span + 2) / 6
  else h = ((r - g) / span + 4) / 6
  return [h * 360, s, l]
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t) => {
    const x = (t + 1) % 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)]
}

const hslHex = (h, s, l) => rgbToHex(hslToRgb(h, s, l))

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)]
  const [hi, lo] = x > y ? [x, y] : [y, x]
  return (hi + 0.05) / (lo + 0.05)
}

// What a translucent layer actually resolves to over its ground.
const over = (fg, bg, alpha) => fg.map((c, i) => alpha * c + (1 - alpha) * bg[i])

// Perceptual distance, the measure the wash solver uses. Repeated here rather
// than imported because this file is going to be deleted.
function lab(rgb) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgb.map(lin)
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function deltaE(a, b) {
  const [p, q] = [lab(a), lab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

// ─── a slider, hand-rolled ────────────────────────────────────────────────
//
// The platform has none and the community one is a dependency this project
// does not have. Gesture-handler is already here, and the track is drawn with
// a gradient so the slider shows what it controls rather than a bare line.

function Slider({ label, value, min, max, step = 1, onChange, stops, readout, ink }) {
  const [width, setWidth] = useState(0)
  const fraction = (value - min) / (max - min)

  const set = (x) => {
    if (!width) return
    const raw = min + (clamp(x, 0, width) / width) * (max - min)
    onChange(Math.round(raw / step) * step)
  }

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(set)(e.x))
    .onUpdate((e) => runOnJS(set)(e.x))

  return (
    <View style={s.sliderRow}>
      <View style={s.sliderHead}>
        <Text style={[s.sliderLabel, { color: ink }]}>{label}</Text>
        <Text style={[s.sliderValue, { color: ink }]}>{readout}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={s.trackHit} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <LinearGradient
            colors={stops}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={s.track}
          />
          <View
            style={[
              s.thumb,
              { left: clamp(fraction * width - 13, -2, Math.max(0, width - 24)), borderColor: ink },
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  )
}

// ─── the screen ───────────────────────────────────────────────────────────

const HUE_STOPS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']

// Everything the lab lets you move, seeded from what the app ships today.
function seed(routine, scheme) {
  const base = styleFor(scheme, routine).background
  const sweep = restTintFor(scheme, routine)
  const wash = washFor(scheme, routine)
  const m = wash.match(/rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)/)
  const washRgb = [+m[1] / 255, +m[2] / 255, +m[3] / 255]
  return {
    base: rgbToHsl(hexToRgb(base)),
    sweep: rgbToHsl(hexToRgb(sweep)),
    wash: rgbToHsl(washRgb),
    alpha: +m[4],
  }
}

export default function ColourLab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [routine, setRoutine] = useState('core')
  const [scheme, setScheme] = useState('light')
  const [state, setState] = useState(() => seed('core', 'light'))

  const T = scheme === 'light' ? LIGHT : DARK
  const ink = inkFor(scheme, routine)

  const reload = (r, sc) => {
    setRoutine(r)
    setScheme(sc)
    setState(seed(r, sc))
  }

  const set = (key) => (v) => setState((c) => ({ ...c, [key]: v }))
  const setPart = (group, i) => (v) =>
    setState((c) => ({ ...c, [group]: c[group].map((x, j) => (j === i ? v : x)) }))

  const baseHex = hslHex(...state.base)
  const sweepHex = hslHex(...state.sweep)
  const washHex = hslHex(...state.wash)

  const measured = useMemo(() => {
    const baseRgb = hslToRgb(...state.base)
    const sweepRgb = hslToRgb(...state.sweep)
    const washRgb = hslToRgb(...state.wash)
    const inkRgb = hexToRgb(ink)
    // The button is the wash laid over the card, which is what the eye sees.
    const button = over(washRgb, baseRgb, state.alpha)
    // And over the sweep, which is where it spends the rest countdown.
    const buttonOnSweep = over(washRgb, sweepRgb, state.alpha)
    return {
      inkOnBase: contrast(inkRgb, baseRgb),
      inkOnSweep: contrast(inkRgb, sweepRgb),
      labelOnButton: contrast(inkRgb, button),
      buttonFromCard: deltaE(button, baseRgb),
      buttonFromSweep: deltaE(buttonOnSweep, sweepRgb),
      cardToSweep: deltaE(baseRgb, sweepRgb),
      buttonHex: rgbToHex(button),
    }
  }, [state, ink])

  const [h, sat, li] = state.base
  const [sh, ss, sl] = state.sweep
  const [wh, ws, wl] = state.wash

  const Stat = ({ name, value, want, unit = ':1' }) => {
    const ok = value >= want
    return (
      <View style={s.stat}>
        <Text style={[s.statName, { color: T.textDim }]}>{name}</Text>
        <Text style={[s.statValue, { color: ok ? T.text : '#FF3B30' }]}>
          {value.toFixed(2)}
          {unit}
        </Text>
        <Text style={[s.statWant, { color: T.textDim }]}>{ok ? 'ok' : 'want ' + want}</Text>
      </View>
    )
  }

  return (
    <View style={[s.screen, { backgroundColor: T.bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SPACE[2],
          paddingBottom: insets.bottom + SPACE[6],
          paddingHorizontal: SPACE[3],
          gap: SPACE[3],
        }}
      >
        <View style={s.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[s.back, { color: T.text }]}>Back</Text>
          </Pressable>
          <Text style={[s.temporary, { color: T.textDim }]}>TEMPORARY</Text>
        </View>

        {/* Which routine, and which scheme to preview. The scheme here is
            independent of the app's own setting, so both can be judged
            without leaving the screen. */}
        <View style={s.chips}>
          {CANONICAL_ORDER.map((r) => (
            <Pressable
              key={r}
              onPress={() => reload(r, scheme)}
              style={[
                s.chip,
                { borderColor: T.border },
                r === routine && {
                  backgroundColor: styleFor(scheme, r).background,
                  borderColor: 'transparent',
                },
              ]}
            >
              <Text style={[s.chipText, { color: r === routine ? inkFor(scheme, r) : T.textDim }]}>
                {r}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={s.chips}>
          {['light', 'dark'].map((sc) => (
            <Pressable
              key={sc}
              onPress={() => reload(routine, sc)}
              style={[
                s.chip,
                { borderColor: T.border },
                sc === scheme && { backgroundColor: T.text, borderColor: 'transparent' },
              ]}
            >
              <Text style={[s.chipText, { color: sc === scheme ? T.onInk : T.textDim }]}>{sc}</Text>
            </Pressable>
          ))}
        </View>

        {/* The preview. A compressed workout screen: the card colour behind,
            the sweep as a band across the lower half the way the countdown
            paints it, and the button sitting on the boundary so it can be
            judged against both grounds at once — which is the thing the
            solver has to trade off and the thing a hex cannot show. */}
        <View style={[s.preview, { backgroundColor: baseHex }]}>
          <View style={[s.sweepBand, { backgroundColor: sweepHex }]} />
          <Text style={[s.previewLabel, { color: ink }]}>{routine} workout</Text>
          <Text style={[s.previewName, { color: ink }]}>Hip Thrust</Text>
          <Text style={[s.previewFigure, { color: ink }]}>12reps</Text>
          <View style={[s.previewButton, { backgroundColor: washHex, opacity: state.alpha }]} />
          <View style={s.previewButtonLabel}>
            <Text style={[s.previewButtonText, { color: ink }]}>Skip</Text>
          </View>
        </View>

        <View style={s.stats}>
          <Stat name="ink on card" value={measured.inkOnBase} want={4.5} />
          <Stat name="ink on sweep" value={measured.inkOnSweep} want={4.5} />
          <Stat name="label on button" value={measured.labelOnButton} want={4.5} />
        </View>
        <View style={s.stats}>
          <Stat name="button ← card" value={measured.buttonFromCard} want={14} unit="" />
          <Stat name="button ← sweep" value={measured.buttonFromSweep} want={7} unit="" />
          <Stat name="card ← sweep" value={measured.cardToSweep} want={10} unit="" />
        </View>

        {/* ── card ── */}
        <Text style={[s.group, { color: T.text }]}>Card &nbsp;{baseHex}</Text>
        <Slider
          label="hue"
          value={h}
          min={0}
          max={360}
          onChange={setPart('base', 0)}
          ink={T.text}
          readout={Math.round(h) + '°'}
          stops={HUE_STOPS}
        />
        <Slider
          label="saturation"
          value={sat}
          min={0}
          max={1}
          step={0.01}
          onChange={setPart('base', 1)}
          ink={T.text}
          readout={Math.round(sat * 100) + '%'}
          stops={[hslHex(h, 0, li), hslHex(h, 1, li)]}
        />
        <Slider
          label="lightness"
          value={li}
          min={0}
          max={1}
          step={0.01}
          onChange={setPart('base', 2)}
          ink={T.text}
          readout={Math.round(li * 100) + '%'}
          stops={['#000000', hslHex(h, sat, 0.5), '#FFFFFF']}
        />

        {/* ── sweep ── */}
        <Text style={[s.group, { color: T.text }]}>Sweep &nbsp;{sweepHex}</Text>
        <Slider
          label="hue"
          value={sh}
          min={0}
          max={360}
          onChange={setPart('sweep', 0)}
          ink={T.text}
          readout={Math.round(sh) + '°'}
          stops={HUE_STOPS}
        />
        <Slider
          label="saturation"
          value={ss}
          min={0}
          max={1}
          step={0.01}
          onChange={setPart('sweep', 1)}
          ink={T.text}
          readout={Math.round(ss * 100) + '%'}
          stops={[hslHex(sh, 0, sl), hslHex(sh, 1, sl)]}
        />
        <Slider
          label="lightness"
          value={sl}
          min={0}
          max={1}
          step={0.01}
          onChange={setPart('sweep', 2)}
          ink={T.text}
          readout={Math.round(sl * 100) + '%'}
          stops={['#000000', hslHex(sh, ss, 0.5), '#FFFFFF']}
        />
        <Pressable
          onPress={() => setState((c) => ({ ...c, sweep: [c.base[0], c.base[1], c.base[2]] }))}
        >
          <Text style={[s.tiny, { color: T.textDim }]}>↺ match the card's hue exactly</Text>
        </Pressable>

        {/* ── wash ── */}
        <Text style={[s.group, { color: T.text }]}>
          Wash &nbsp;{washHex} @ {Math.round(state.alpha * 100)}% &nbsp;→&nbsp; {measured.buttonHex}
        </Text>
        <Slider
          label="hue"
          value={wh}
          min={0}
          max={360}
          onChange={setPart('wash', 0)}
          ink={T.text}
          readout={Math.round(wh) + '°'}
          stops={HUE_STOPS}
        />
        <Slider
          label="saturation"
          value={ws}
          min={0}
          max={1}
          step={0.01}
          onChange={setPart('wash', 1)}
          ink={T.text}
          readout={Math.round(ws * 100) + '%'}
          stops={[hslHex(wh, 0, wl), hslHex(wh, 1, wl)]}
        />
        <Slider
          label="lightness"
          value={wl}
          min={0}
          max={1}
          step={0.01}
          onChange={setPart('wash', 2)}
          ink={T.text}
          readout={Math.round(wl * 100) + '%'}
          stops={['#000000', hslHex(wh, ws, 0.5), '#FFFFFF']}
        />
        <Slider
          label="opacity"
          value={state.alpha}
          min={0}
          max={1}
          step={0.01}
          onChange={set('alpha')}
          ink={T.text}
          readout={Math.round(state.alpha * 100) + '%'}
          stops={[baseHex, washHex]}
        />

        {/* The question this lab exists to answer, as two buttons. */}
        <View style={s.chips}>
          <Pressable
            onPress={() =>
              setState((c) => ({ ...c, wash: [c.base[0], c.base[1], c.base[2] * 0.55] }))
            }
            style={[s.chip, { borderColor: T.border }]}
          >
            <Text style={[s.chipText, { color: T.textDim }]}>wash from the routine's hue</Text>
          </Pressable>
          <Pressable
            onPress={() => setState((c) => ({ ...c, wash: [0, 0, 0.04] }))}
            style={[s.chip, { borderColor: T.border }]}
          >
            <Text style={[s.chipText, { color: T.textDim }]}>neutral</Text>
          </Pressable>
        </View>

        {/* Read these off and type them into routineStyles.js. */}
        <View style={[s.output, { borderColor: T.border }]}>
          <Text style={[s.outputLine, { color: T.text }]}>
            {routine} &middot; {scheme}
          </Text>
          <Text style={[s.outputLine, { color: T.textDim }]}>base &nbsp;{baseHex}</Text>
          <Text style={[s.outputLine, { color: T.textDim }]}>sweep {sweepHex}</Text>
          <Text style={[s.outputLine, { color: T.textDim }]}>
            wash &nbsp;rgba(
            {hslToRgb(...state.wash)
              .map((c) => Math.round(c * 255))
              .join(', ')}
            , {state.alpha.toFixed(2)})
          </Text>
        </View>

        <Pressable
          onPress={() => reload(routine, scheme)}
          style={[s.reset, { borderColor: T.border }]}
        >
          <Text style={[s.chipText, { color: T.textDim }]}>reset to what the app ships</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { ...TYPE.control },
  temporary: { ...TYPE.label },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[1] },
  chip: {
    paddingVertical: SPACE[1],
    paddingHorizontal: SPACE[2],
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  chipText: { ...TYPE.caption },

  preview: { height: 300, borderRadius: RADIUS.card, overflow: 'hidden', padding: SPACE[3] },
  sweepBand: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  previewLabel: { ...TYPE.label },
  previewName: { ...TYPE.title, marginTop: SPACE[4] },
  previewFigure: { ...TYPE.figure },
  previewButton: {
    position: 'absolute',
    left: SPACE[3],
    right: SPACE[3],
    bottom: SPACE[3],
    height: 52,
    borderRadius: RADIUS.pill,
  },
  // The label sits outside the faded layer, because opacity on a parent would
  // fade the text with it and that is not what the app does.
  previewButtonLabel: {
    position: 'absolute',
    left: SPACE[3],
    right: SPACE[3],
    bottom: SPACE[3],
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: { ...TYPE.control },

  stats: { flexDirection: 'row', gap: SPACE[2] },
  stat: { flex: 1 },
  statName: { ...TYPE.caption, fontSize: 10 },
  statValue: { ...TYPE.control },
  statWant: { ...TYPE.caption, fontSize: 10 },

  group: { ...TYPE.label, marginTop: SPACE[3] },
  sliderRow: { gap: SPACE[1] },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { ...TYPE.caption },
  sliderValue: { ...TYPE.caption },
  trackHit: { height: 34, justifyContent: 'center' },
  track: { height: 14, borderRadius: RADIUS.pill },
  thumb: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: RADIUS.pill,
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  tiny: { ...TYPE.caption, fontSize: 11 },

  output: { borderWidth: 1, borderRadius: RADIUS.card, padding: SPACE[3], gap: 2 },
  outputLine: { ...TYPE.caption, fontVariant: ['tabular-nums'] },

  reset: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACE[2],
    alignItems: 'center',
  },
})
