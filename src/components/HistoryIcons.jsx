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

export function TrashIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6" {...stroke(color)} />
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
