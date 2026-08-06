import { useFonts } from 'expo-font'
import { FONTS } from './index.js'

// React Native has no font-family/font-weight pairing: each cut is its own
// family name, and asking for weight 500 on a family that only shipped one
// file gets you a synthesised bold rather than Favorit Medium. So every cut
// is registered separately here under the names in FONTS, and styles name the
// cut they want instead of setting fontWeight.
const SOURCES = {
  [FONTS.light]: require('../../assets/fonts/Favorit_Light.ttf'),
  [FONTS.regular]: require('../../assets/fonts/Favorit_Regular.ttf'),
  [FONTS.medium]: require('../../assets/fonts/Favorit_Medium.ttf'),
  [FONTS.bold]: require('../../assets/fonts/Favorit_Bold.ttf'),
  [FONTS.mono]: require('../../assets/fonts/Favorit_Regular_Mono.ttf'),
  [FONTS.italic]: require('../../assets/fonts/Favorit_Regular-Italic.ttf'),
  [FONTS.mediumItalic]: require('../../assets/fonts/Favorit_Medium-Italic.ttf'),
  [FONTS.lightItalic]: require('../../assets/fonts/Favorit_Light-Italic.ttf'),
}

export function useAppFonts() {
  const [loaded, error] = useFonts(SOURCES)
  return { loaded, error }
}
