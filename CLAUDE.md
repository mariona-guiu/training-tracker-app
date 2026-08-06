@AGENTS.md

# The native port

The React Native version of the tracker, being brought to parity with the web
app at the repository root. The web app stays where it is and keeps serving on
Vercel until this replaces it, so it remains the reference for how anything is
meant to look and behave. When the two disagree, the web app is right unless a
decision was recorded otherwise.

Read the root `CLAUDE.md` first. Everything it says about what the app *is*
still holds; what follows is only what differs on native.

## Commands

```bash
npm start        # Metro; open it in Expo Go on the phone
npm run ios      # simulator, if Xcode is installed
npx expo export --platform ios --output-dir /tmp/x   # does it still bundle?
```

There is no test suite here yet. `npx expo export` is the cheapest real check
that nothing has broken at the module level — it catches bad imports, missing
packages and anything that does not exist in this SDK, none of which show up
until the bundle is built.

## Pinned to SDK 54, deliberately

Since May 2026 the App Store build of Expo Go is frozen at **SDK 54** and no
longer follows new releases. Anything newer can only be run on a real iPhone
by joining the Apple Developer Program ($99/year) and building your own Expo
Go or a development build.

The user tests everything on their own phone — that is the whole quality bar
for this app — and does not have Xcode or a paid Apple account. So the project
targets SDK 54 and stays there until there is a reason to pay for the
alternative, at which point the upgrade is a deliberate, separate job.

Do not bump the SDK to keep up. It would silently cost the user the ability to
open the app at all.

## Read the versioned docs

`AGENTS.md` says to check https://docs.expo.dev/versions/v54.0.0/ before
writing code, and it is not boilerplate. Working from memory here would have
produced a `babel.config.js` that Expo does not want (`babel-preset-expo`
configures Reanimated itself), and the SDK docs index is wrong about the blur
package — it is `expo-blur`, and `expo-blur-view` 404s on npm. Check the docs,
then check the package actually installs.

## What is shared with the web app, and what is not

`src/data/` is **copied, not adapted**. Those files were written with no I/O
and no DOM, so they run here unchanged — the calorie model, the rest tiers,
the week grouping, the routine colours, slot resolution. Keep them that way:
a change to one should be made in both copies, and anything that cannot be is
a sign it belongs in a screen instead.

`src/data/motion.js` is deliberately **not** copied. Those are Framer Motion
configs and Reanimated does not take them; the timings will be ported
alongside the animation work that needs them.

`src/db/` is rewritten rather than copied — it is the one layer that could not
come across, since IndexedDB does not exist here.

## Storage

SQLite via `expo-sqlite`, one module per table, and screens never touch the
database — the same boundary the web app keeps.

**Sessions are documents.** A session's exercises, each with their sets, live
as JSON in one column, with real columns for the handful of things that get
queried (`startedAt`, `status`). Sessions are always read and written whole
and nothing looks up a single set, so this keeps the stored object the same
shape the screens already expect. That is what let the screens port with their
logic intact, and it is worth preserving.

**Migrations are numbered and one-way**, tracked by SQLite's `user_version`.
Each block runs once and is never edited afterwards. Add a block, raise
`SCHEMA_VERSION`; do not reach back into an old one, because phones that have
already run it will never run it again.

**SQLite has no boolean.** Flags are `INTEGER` 0/1, converted in `client.js`
so nothing above that file ever sees a `1` where it expects `true`.
`endedEarly` is allowed to be genuinely unknown, and `fromNullableFlag` keeps
that third state — History shows the difference.

**The exercise library stores `equipment`, `pattern` and `difficulty`.** The
web app drops them at seed time, which leaves `candidatesFor()` — which
filters on exactly those — matching nothing. It has not bitten there yet only
because slots still resolve to their primary by name, but rotation would have
walked straight into it. Fixing it there needs a backfill; here it was free.

## Fonts

Every cut of Favorit is registered as its own family name (`src/theme/fonts.js`).
React Native has no family/weight pairing: asking for weight 500 on a family
that shipped one file gets a synthesised bold, not Favorit Medium. Style with
`FONTS.medium`, never with `fontWeight`.

## Type: never set a line height below the font's own

CSS lets glyphs spill outside their line box, so the web app can set
`line-height: 1.05` on a 64px figure and it simply overflows, visibly intact.
**React Native clips to the line box.** Any `lineHeight` below the font's
natural one cuts the tops and tails off, and it is worst exactly where it
shows most — large, bold numbers.

Favorit Bold's own metrics, read from the file: ascent 937, descent -312,
gap 0, on a 1000 unit em. That is **1.249 em** — 79.9pt at 64pt type.

So: state no `lineHeight` on display type and let the font decide, then
recover whatever tightness the design wants with margins, which do not clip.
Porting a `line-height` from the CSS directly is the wrong move.

If a figure looks cut, measure the font rather than trying numbers — the
head/hhea/OS-2 tables give the answer in one pass.

The same tables answer the other half of it: **a gap in a design is not a gap
in a style.** Favorit Bold's ascent is 0.937em and its cap height 0.700em, so
every line of it carries 0.237em of empty space above the capitals and 0.312em
below the baseline. Two stacked figures are already 0.549em apart before any
gap is set — 39.5pt at 72pt type. A design asking for 20pt of visible
separation therefore wants a **negative** margin, not `gap: 20`.

Work it out rather than nudging it: `visible - (ascent - capHeight + descent)
× size`.

## Theming

`LIGHT` and `DARK` in `src/theme/` replace the web app's two sets of CSS
variables, and carry the same rule: build with the tokens, never with literal
colours. The only literal colours belong to routines, through `styleFor()`.

## npm

Reanimated 4 — which SDK 54 already ships — needs `react-native-worklets`
listed as a direct dependency.
It arrives as a transitive one and then gets pruned the next time npm
re-resolves, which shows up as `Unable to resolve module react-native-worklets`
long after whatever removed it.

## Where the port has got to

Working: storage and seeding, theme tokens, all eight font cuts, the tab bar
and its three screens, and a workout you can open, log sets in, and end —
which lands in Stats.

The screens are deliberately plain. Every one of them is a placeholder for a
design that either exists on the web and has not been ported yet (Stats,
History, Settings) or is waiting on the user's cue cards (the four-tab
restructure). Do not polish them speculatively.

What has not been attempted yet is the part the port exists for: the colour
growing out of a tapped card, the swipeable exercise carousel, the rest sweep,
the completion screen. Those need Reanimated and Gesture Handler and should be
built one at a time against the real thing on a phone, since none of it can be
judged from a simulator or a test.
