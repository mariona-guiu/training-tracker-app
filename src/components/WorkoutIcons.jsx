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

// The signposts either side of the exercise. Filled rather than stroked, and
// taken from the design's own files rather than redrawn — the difference shows
// at the point of the chevron, where a stroked one keeps an even width and
// these taper.
export function ChevronLeftIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.6508 19.7592C15.2315 20.1186 14.6011 20.0701 14.2416 19.6508L8.24163 12.6508C7.92064 12.2763 7.92064 11.7245 8.24163 11.35L14.2416 4.35003C14.6011 3.93071 15.2315 3.88221 15.6508 4.24163C16.0701 4.60105 16.1186 5.23149 15.7592 5.65081L10.3168 12.0004L15.7592 18.35C16.1186 18.7694 16.0701 19.3998 15.6508 19.7592Z"
        fill={color}
      />
    </Svg>
  )
}

export function ChevronRightIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.34919 4.24079C8.76851 3.88137 9.39895 3.92986 9.75837 4.34919L15.7584 11.3492C16.0794 11.7237 16.0794 12.2755 15.7584 12.65L9.75837 19.65C9.39895 20.0693 8.76851 20.1178 8.34919 19.7584C7.92986 19.3989 7.88137 18.7685 8.24079 18.3492L13.6832 11.9996L8.24079 5.64997C7.88137 5.23064 7.92986 4.60021 8.34919 4.24079Z"
        fill={color}
      />
    </Svg>
  )
}
