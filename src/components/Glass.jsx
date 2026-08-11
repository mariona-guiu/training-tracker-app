import Animated from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

import { useTheme } from '../theme/ThemeProvider.jsx'

// The blurred stand-in, animatable. Opacity on it is only a problem for the
// real material, so the fallback can be faded like anything else.
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

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
// Off until it can be shown to work.
//
// GlassView is `requireNativeViewManager('ExpoGlassEffect')` — a native view
// that has to be compiled into the app binary. Expo Go's binary is fixed and
// does not carry it, so the view resolves to nothing and draws nothing: both
// the tab bar and the restack button lost their surfaces entirely rather than
// looking wrong. The package's own docs list expo-go as supported, which is
// what this was adopted on; the phone says otherwise.
//
// Turn this on once the app is on a development build, where the module is
// compiled in, and check both surfaces before trusting it. The rest of the
// file is ready for it.
const USE_LIQUID_GLASS = false

// Decided once at module load: whether the system has the material cannot
// change while the app is running.
export const LIQUID_GLASS = USE_LIQUID_GLASS && isLiquidGlassAvailable()

// `hidden` takes the surface away without ever putting an opacity on it or on
// anything above it. **Opacity below 1 on a GlassView or any view above it
// stops the effect rendering**, so the material is switched between 'regular'
// and 'none' and animates itself. The blurred stand-in has no such rule and
// simply carries the opacity.
export function Glass({
  style,
  children,
  fallback,
  hidden = false,
  fadeStyle,
  intensity = 40,
  tint,
  ...rest
}) {
  const theme = useTheme()
  // The tint follows the palette unless a caller insists otherwise. A light
  // blur under dark type is opaque haze, and it is the one property every
  // frosted surface in the app shares — so it is decided here rather than at
  // each of the three call sites, none of which has an opinion about it.
  const resolvedTint = tint ?? theme.scheme

  if (LIQUID_GLASS) {
    return (
      <GlassView
        style={style}
        glassEffectStyle={{ style: hidden ? 'none' : 'regular', animate: true }}
        colorScheme={resolvedTint}
        {...rest}
      >
        {children}
      </GlassView>
    )
  }

  return (
    <AnimatedBlurView
      intensity={intensity}
      tint={resolvedTint}
      // `fadeStyle` when the caller wants it animated; the flat `hidden`
      // otherwise, for surfaces that simply are or are not there.
      style={[style, fadeStyle ?? (hidden && { opacity: 0 })]}
      {...rest}
    >
      {fallback}
      {children}
    </AnimatedBlurView>
  )
}
