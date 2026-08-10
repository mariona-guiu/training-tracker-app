import Svg, { Circle, Path } from 'react-native-svg'

// The icons the expanded workout uses, drawn rather than shipped as images so
// the ink is a prop — every cell wears a different routine's colour.

const stroke = (color, width = 2) => ({
  stroke: color,
  strokeWidth: width,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

export function ClockIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3.5 2" {...stroke(color)} />
    </Svg>
  )
}

export function DumbbellIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" {...stroke(color)} />
    </Svg>
  )
}

export function RepeatIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 3l3.5 3.5L16 10M20 6.5H7.5A3.5 3.5 0 004 10v1.5M8 21l-3.5-3.5L8 14M4 17.5h12.5a3.5 3.5 0 003.5-3.5v-1.5"
        {...stroke(color)}
      />
    </Svg>
  )
}

export function BoltIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z" {...stroke(color)} />
    </Svg>
  )
}

// Taken from the swipe design rather than redrawn: a lidded can with a handle,
// where the old one was a tapering bin. Normalised into a 24x24 box from the
// file's own coordinates, so the proportions are the drawn ones.
export function TrashIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 6V20C19 20.53 18.789 21.039 18.414 21.414C18.039 21.789 17.53 22 17 22H7C6.47 22 5.961 21.789 5.586 21.414C5.211 21.039 5 20.53 5 20V6M8 6V4C8 3.47 8.211 2.961 8.586 2.586C8.961 2.211 9.47 2 10 2H14C14.53 2 15.039 2.211 15.414 2.586C15.789 2.961 16 3.47 16 4V6"
        {...stroke(color)}
      />
      <Path d="M3 6H5H21" {...stroke(color)} />
      <Path d="M10 11V17" {...stroke(color)} />
      <Path d="M14 11V17" {...stroke(color)} />
    </Svg>
  )
}

export function ChevronIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" {...stroke(color)} />
    </Svg>
  )
}

export function BackIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" {...stroke(color, 1.8)} />
    </Svg>
  )
}
