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
//   4. No credential, personal address or LAN address is in any commit.
//   5. docs/design-tokens.html matches what the generator would produce.
//
// Check 4 is the one with teeth now that this repo is public: it reads all of
// history, because that is what a public repo actually serves.
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

// ── 4. nothing secret is in any commit ────────────────────────────────────
//
// This repository is public, and a public repository serves **every commit**.
// Something committed by mistake and deleted the next day is still there and
// still readable — which is why the two private predecessors of this repo can
// never be opened up, a licensed typeface sitting in their history. So this
// scans all of history rather than the working tree. It costs about a tenth of
// a second at this size.
//
// Every pattern is a documented key format, matched literally. No entropy
// heuristics, and no keyword matching on "password" or "token": those produce
// false positives, and a check that cries wolf is one you learn to ignore.
// A hit here is therefore never a maybe — treat it as a live credential,
// rotate it, and assume it is already public.
//
// This file is excluded from its own scan, since it necessarily contains the
// shapes it looks for.

const SECRETS = [
  ['AWS access key ID', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ['API secret key', /\bsk-[A-Za-z0-9_-]{32,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['private key block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  // A personal address, as opposed to the no-reply one every commit here is
  // authored with. Matched by provider, so this file need not contain anyone's
  // actual address — it is published, and that is the whole point.
  ['personal email address', /[A-Za-z0-9._%+-]+@(?:gmail|googlemail|icloud|hotmail|outlook|yahoo)\.[a-z.]{2,}/],
  // Neither of these is a credential, but both are private by accident, and
  // neither works for anyone else who clones this.
  ['a LAN address', /\b(?:192\.168\.\d{1,3}|10\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3})\.\d{1,3}\b/],
  ['a hardcoded localhost URL', /\bhttps?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/],
]

const SELF = 'scripts/doctor.mjs'
const revs = execFileSync('git', ['rev-list', '--all'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

// `-P` (PCRE), not `-E`. POSIX ERE has no `\b`, no `\d` and no `(?:…)`, and the
// two failure modes are different kinds of nasty: `(?:…)` is a hard error, while
// **`\b` silently matches nothing at all** — `\btraining-tracker` finds zero
// files in a repo where `training-tracker` finds four. The first version of this
// check used `-E` and reported a clean repo while finding nothing it looked for.
const grepHistory = (source) => {
  try {
    // `-e` is not optional: the private-key pattern begins with `-----BEGIN`,
    // and git reads a leading dash as an option. Without it that one pattern
    // aborts the entire scan.
    return execFileSync('git', ['grep', '-I', '-l', '-P', '-e', source, ...revs], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 << 20,
    })
      .split('\n')
      .filter((line) => line && !line.endsWith(':' + SELF))
  } catch (err) {
    // Exit 1 is git grep's "found nothing" and is the only acceptable failure.
    // Anything else — a bad pattern, no PCRE support, a buffer overrun — must be
    // loud. Swallowing it is how a broken scan passes for a clean repo, which is
    // strictly worse than having no scan at all.
    if (err.status === 1) return []
    throw new Error(
      `git grep failed (exit ${err.status}) on /${source}/\n` +
        `    ${String(err.stderr || err.message).trim()}`,
    )
  }
}

// One combined pass first. On a clean repo — the normal case — this is the only
// scan that runs, and it is a single git invocation.
if (grepHistory(SECRETS.map(([, re]) => re.source).join('|')).length > 0) {
  // Something matched, so now pay for the per-pattern pass to say what, and where.
  for (const [label, re] of SECRETS) {
    const hits = grepHistory(re.source)
    if (hits.length === 0) continue
    const atHead = hits.filter((h) => h.startsWith(revs[0] + ':'))
    const where = atHead.length
      ? atHead.map((h) => h.slice(h.indexOf(':') + 1)).join(', ')
      : `only in ${hits.length} older commit${hits.length === 1 ? '' : 's'} — a new commit will not remove it, this needs a history rewrite`
    fail('git history', `${label} — ${where}`)
  }
}

// The other way a secret reaches a public repo. .gitignore covered `.env*.local`
// but not a plain `.env` when this was written.
for (const f of tracked) {
  if (/(^|\/)\.env(\.|$)/.test(f) || /\.(pem|p12|keystore|jks)$/.test(f)) {
    fail(f, 'is tracked, and files of this kind carry credentials')
  }
}

// ── 5. the tokens page matches the theme ──────────────────────────────────

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
