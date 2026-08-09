import { useFonts } from 'expo-font'
import { FONTS } from './index.js'

// React Native has no font-family/font-weight pairing: each cut is its own
// family name, and asking for weight 500 on a family that only shipped one
// file gets you a synthesised bold rather than the real Medium. So every cut
// is registered separately here under the names in FONTS, and styles name the
// cut they want instead of setting fontWeight.
const SOURCES = {
  [FONTS.light]: require('../../assets/fonts/FunnelSans-Light.ttf'),
  [FONTS.regular]: require('../../assets/fonts/FunnelSans-Regular.ttf'),
  [FONTS.medium]: require('../../assets/fonts/FunnelSans-Medium.ttf'),
  [FONTS.bold]: require('../../assets/fonts/FunnelSans-Bold.ttf'),
  [FONTS.displayRegular]: require('../../assets/fonts/FunnelDisplay-Regular.ttf'),
  [FONTS.displayMedium]: require('../../assets/fonts/FunnelDisplay-Medium.ttf'),
  [FONTS.displayBold]: require('../../assets/fonts/FunnelDisplay-Bold.ttf'),
}

export function useAppFonts() {
  const [loaded, error] = useFonts(SOURCES)
  return { loaded, error }
}
