import Svg, { Path } from 'react-native-svg'

// Drawn rather than shipped as images, the same as everywhere else in the
// app, so the ink is a prop. Ported from the shapes in the web app's
// WorkoutMode.

export function CloseIcon({ size = 26, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

export function PencilIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4L20 8l-4-4L4 16v4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// Shown in the pencil's place while a value is being typed: the value only
// changes when this is pressed.
export function CheckIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
