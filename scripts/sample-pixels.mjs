// Read actual pixel colours out of a screenshot.  npm run sample
//
// This exists to make measuring cheaper than guessing.
//
// On 2026-08-19 the button-wash swatch took eight rounds, each a different
// theory about what the app renders, each reviewed by the user on their own
// screen. The screenshots that settled it had been available since round one.
// Measuring them was the slow-feeling option only because it meant hand-writing
// a TIFF reader every time; the guess was genuinely cheaper. So the guess won,
// eight times.
//
// With this, measuring is one command, and the excuse is gone. The rule it
// serves is in the working agreement: **one failed attempt at a visual problem
// is the stop signal.** Do not offer a second theory — run this first.
//
//   npm run sample -- <image> 15,80 80,80         # points, as % of width,height
//   npm run sample -- <image> --scan-y 20 66,100  # colour changes down a column
//   npm run sample -- <image> --scan-x 91 0,100   # and across a row
//
// Screenshots are Display P3 and sips may write 16-bit; both are handled. If a
// known flat area comes back as the exact palette value, the reading is sound —
// a shifted ground means a shifted subject and the numbers cannot be trusted.

import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [, , file, ...rest] = process.argv
if (!file) {
  console.error('usage: npm run sample -- <image> 15,80 [80,80 …]')
  console.error('       npm run sample -- <image> --scan-y <x%> <from%,to%>')
  process.exit(1)
}

const tiff = join(mkdtempSync(join(tmpdir(), 'sample-')), 'i.tiff')
execFileSync('sips', ['-s', 'format', 'tiff', file, '--out', tiff], { stdio: 'pipe' })

// A minimal TIFF reader. Only the tags needed to find pixels, and only the
// types they use — anything else would be guessing at the format too.
const b = readFileSync(tiff)
const le = b.toString('ascii', 0, 2) === 'II'
const u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o))
const u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o))

const ifd = u32(4)
const tags = {}
for (let i = 0; i < u16(ifd); i++) {
  const e = ifd + 2 + i * 12
  const [tag, type, count] = [u16(e), u16(e + 2), u32(e + 4)]
  if (![3, 4].includes(type)) continue
  const size = type === 3 ? 2 : 4
  const at = size * count <= 4 ? e + 8 : u32(e + 8)
  tags[tag] = Array.from({ length: count }, (_, j) =>
    type === 3 ? u16(at + j * 2) : u32(at + j * 4),
  )
}

const [w, h] = [tags[256][0], tags[257][0]]
const spp = tags[277]?.[0] ?? 3
const bps = tags[258]?.[0] ?? 8
const rows = tags[278]?.[0] ?? h
const strips = tags[273]
if ((tags[259]?.[0] ?? 1) !== 1) throw new Error('the TIFF is compressed — cannot sample')

const bytes = bps / 8
const px = (x, y) => {
  const o = strips[Math.floor(y / rows)] + ((y % rows) * w + x) * spp * bytes
  const at = (i) => (bytes === 1 ? b[o + i] : u16(o + i * 2) >> 8)
  return '#' + [0, 1, 2].map((i) => at(i).toString(16).padStart(2, '0').toUpperCase()).join('')
}

console.log(`  ${file}\n  ${w} x ${h}, ${bps}-bit, ${spp} samples per pixel\n`)

const scan = rest.indexOf('--scan-y') !== -1 ? 'y' : rest.indexOf('--scan-x') !== -1 ? 'x' : null
if (scan) {
  const i = rest.indexOf(`--scan-${scan}`)
  const fixed = +rest[i + 1]
  const [from, to] = (rest[i + 2] ?? '0,100').split(',').map(Number)
  const span = scan === 'y' ? h : w
  const other = scan === 'y' ? w : h
  const at = Math.round((fixed / 100) * other)
  console.log(`  changes along ${scan}, at ${scan === 'y' ? 'x' : 'y'}=${fixed}%:`)
  let prev = null
  for (let n = Math.round((from / 100) * span); n < Math.round((to / 100) * span); n++) {
    const c = scan === 'y' ? px(at, n) : px(n, at)
    if (c !== prev) {
      console.log(`     ${scan}=${String(n).padEnd(5)} (${(n / span).toFixed(3)})  ${c}`)
      prev = c
    }
  }
} else {
  for (const point of rest) {
    const [fx, fy] = point.split(',').map(Number)
    const [x, y] = [Math.round((fx / 100) * w), Math.round((fy / 100) * h)]
    console.log(`     ${point.padEnd(9)} -> ${px(x, y)}   (${x}, ${y})`)
  }
}
