import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

// A glass surface: the real one where the system has it, a blur where it
// does not.
//
// `expo-glass-effect` wraps iOS 26's own material, so on a phone running it
// these surfaces are genuinely the system's — they refract and respond the
// way every other glass control does, rather than approximating it with a
// blur and a wash. Below iOS 26 GlassView silently becomes a plain View,
// which would mean no glass *and* no blur, so the blur is kept as the
// fallback rather than replaced.
//
// Decided once at module load: whether the system has the material cannot
// change while the app is running.
export const LIQUID_GLASS = isLiquidGlassAvailable()

// One caveat worth repeating wherever these are used: **opacity below 1 on a
// GlassView or any view above it stops the effect rendering properly.** So a
// glass surface must not be faded in by its parent — fade what is inside it,
// or let the material animate itself with `glassEffectStyle`.
export function Glass({ style, children, fallback, intensity = 40, tint = 'light', ...rest }) {
  if (LIQUID_GLASS) {
    return (
      <GlassView style={style} glassEffectStyle="regular" colorScheme={tint} {...rest}>
        {children}
      </GlassView>
    )
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={style} {...rest}>
      {fallback}
      {children}
    </BlurView>
  )
}
