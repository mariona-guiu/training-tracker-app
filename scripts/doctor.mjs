// Checks the things the documentation claims against the code.  npm run doctor
//
// **Only reports what is definitely wrong.** A check that flags things which
// might be fine teaches you to skim past it, and then it catches nothing at
// all. Everything here is a fact with one answer: a path exists or it does not.
//
// Written after a day on which seven comments turned out to describe code that
// had moved — three quoting the metrics of a typeface the app no longer used, a
// type role's weight, a count of uppercase roles, a role's description, and a
// tracking rule the scale contradicts. Every one was accurate when written.
//
// What it checks:
//
//   1. Paths named in CLAUDE.md and the README resolve to a file.
//   2. CONSTANT_CASE names in backticks exist somewhere in the source.
//   3. Everything the theme exports is consumed by something.
//   4. docs/design-tokens.html matches what the generator would produce.
//
// What it deliberately does not check: prose. "The frost reinforces the ground"
// is either true or not and no script can tell. Those still need reading.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const problems = []
const fail = (where, what) => problems.push({ where, what })

// every source file, once
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === '.expo') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(jsx?|mjs)$/.test(full)) out.push(full)
  }
  return out
}
const sources = walk(root)
const allSource = sources.map((f) => readFileSync(f, 'utf8')).join('\n')

// ── 1. paths named in the docs resolve ────────────────────────────────────
//
// Matched by suffix against every tracked file, because the docs refer to files
// both fully (`src/theme/index.js`) and in shorthand (`theme/index.js`,
// `client.js`). Both are claims that a file exists; neither is a claim about
// the exact path from the root.
//
// A mention wrapped in past or conditional tense is skipped. The docs
// deliberately discuss files that were deleted and files that would have been
// created by a mistake, and reporting those would be reporting the docs for
// doing their job.

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
const HISTORIC = /\b(was|were|used to|no longer|before it|is gone|has gone|deleted|removed|would have|does not want|never)\b/

for (const doc of ['CLAUDE.md', 'README.md']) {
  const text = readFileSync(join(root, doc), 'utf8')
  for (const raw of new Set(text.match(/`([\w./[\]()-]+\.(?:jsx?|mjs|json|md|html))`/g) ?? [])) {
    const path = raw.slice(1, -1)
    if (tracked.some((f) => f === path || f.endsWith('/' + path))) continue
    // the sentence it appears in, so tense can be read
    const at = text.indexOf(raw)
    const sentence = text.slice(Math.max(0, at - 200), at + 200).replace(/\n/g, ' ')
    if (HISTORIC.test(sentence)) continue
    fail(doc, `names \`${path}\`, which is not a file in this repository`)
  }
}

// ── 2. CONSTANT_CASE names in the docs exist in the source ────────────────

const words = new Set(allSource.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [])
for (const doc of ['CLAUDE.md']) {
  const text = readFileSync(join(root, doc), 'utf8')
  for (const raw of new Set(text.match(/`([A-Z][A-Z0-9_]{3,})`/g) ?? [])) {
    const name = raw.slice(1, -1)
    if (!words.has(name)) fail(doc, `names \`${name}\`, which is in no source file`)
  }
}

// ── 3. the theme exports nothing unused ───────────────────────────────────

const themeFile = join(root, 'src/theme/index.js')
const theme = readFileSync(themeFile, 'utf8')
const outside = sources.filter((f) => f !== themeFile).map((f) => readFileSync(f, 'utf8')).join('\n')

for (const block of ['LIGHT', 'DARK', 'TYPE', 'CAP']) {
  const m = theme.match(new RegExp(`export const ${block} = \\{(.*?)\\n\\}`, 's'))
  if (!m) continue
  for (const key of m[1].match(/^ {2}(\w+):/gm)?.map((k) => k.trim().slice(0, -1)) ?? []) {
    if (key === 'scheme') continue
    // CAP.body and CAP.caption are empty on purpose — they document that those
    // roles are uncapped, so being unspread is correct rather than dead.
    if (block === 'CAP' && ['body', 'caption'].includes(key)) continue
    const pattern = block === 'CAP' ? `CAP\\.${key}\\b` : `\\.${key}\\b`
    if (!new RegExp(pattern).test(outside)) fail('src/theme/index.js', `${block}.${key} is exported and nothing uses it`)
  }
}
for (const name of theme.match(/^export const ([A-Z][A-Z0-9_]+) =/gm)?.map((l) => l.split(' ')[2]) ?? []) {
  if (!new RegExp(`\\b${name}\\b`).test(outside)) fail('src/theme/index.js', `${name} is exported and nothing imports it`)
}

// ── 4. the tokens page matches the theme ──────────────────────────────────

try {
  execFileSync('node', [join(here, 'generate-tokens.mjs'), '--check'], { stdio: 'pipe' })
} catch {
  fail('docs/design-tokens.html', 'is out of date — run `npm run tokens`')
}

// ── report ────────────────────────────────────────────────────────────────

if (problems.length === 0) {
  console.log('doctor: nothing wrong')
} else {
  console.log(`doctor: ${problems.length} thing${problems.length === 1 ? '' : 's'} to fix\n`)
  for (const p of problems) console.log(`  ${p.where}\n    ${p.what}\n`)
  process.exitCode = 1
}
