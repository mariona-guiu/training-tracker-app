@AGENTS.md

# The app

The React Native tracker. It began as a port of the web app at the repository
root, and for as long as that port was catching up, the web app was the
reference for how everything should look and behave.

**That is over.** Decided on 2026-08-09: this is V1. The web app is the MVP —
it stays on Vercel exactly as it is, and it is no longer being kept in step
with. When the two disagree, this one is right, and a difference is not drift
to be repaired.

The gap is going to widen, and not only in styling. The design system landed
here and only here, and what comes next — the four-tab restructure, custom
workouts, rotation — changes UX, logic and the data model. Each of those makes
the web app a less useful thing to look at. Expect to consult it rarely, and
to stop consulting it entirely.

One practical consequence while it lasts: `src/data/` is still a literal copy
in both, so a change to the calorie model, the rest tiers, the week grouping,
the routine colours or slot resolution belongs in both copies today. Springs
likewise, per the rule in `motion.js`. That sharing ends the moment the data
model here moves — when it does, let it end rather than porting the change
backwards.

Read the root `CLAUDE.md` first. Everything it says about what the app *is*
still holds; what follows is only what differs on native.

## Commands

```bash
npm start        # Metro; open it in Expo Go on the phone
npm run lint     # oxlint; must report nothing
npm run ios      # simulator, if Xcode is installed
npx expo export --platform ios --output-dir /tmp/x   # does it still bundle?
```

There is no test suite here yet, so those two are the whole of the automated
check and they cover different things.

`npx expo export` catches bad *module* paths, missing packages and anything
that does not exist in this SDK. It does **not** catch a name used but never
imported — the bundler resolves modules, not identifiers, so that sails
through and crashes on the device. `WORKOUT_REVEAL_FADE` did exactly that.

`npm run lint` is what catches those. `.oxlintrc.json` turns on `no-undef` and
`no-unused-vars` and declares the globals React Native provides, without which
every `setTimeout` and `require` is a false positive. Run both.

Neither sees layout, motion or touch behaviour. Those still need the phone.

Neither sees stray text either. JSX strips whitespace at line boundaries but
keeps it *within* a line, so `) : null}    </>` on one line leaves four spaces
as a string child and React Native throws "Text strings must be rendered
within a `<Text>` component" — at runtime, on the phone, past both checks.
Worth knowing because scripted edits that join lines produce exactly this.

## Working agreement: how to not loop

Agreed with the user on 2026-08-08, after the set-edit panel's keyboard
stagger took six attempts and several other bugs took three or four. The cost
is real — it is slow, and it is taxing for the person having to be the test
harness every round.

**The shape of the trap.** Nothing here can see the screen. Every visual or
motion problem needs the user as the sensor, so the loop is: change something,
ask them to look, repeat. That is fine once. It is corrosive by the fourth
round, and the fourth round is usually a *worse* guess than the first, because
by then the reasoning has drifted from the evidence.

**What actually ended the loops, every time it happened:** getting information
instead of trying another value. Reading the font's own tables rather than
nudging a line height. Reading the library's source and finding
`requireNativeViewManager`, which explained why the glass drew nothing.
Checking the docs and finding `useAnimatedKeyboard` deprecated. And building
the tuning panel — one round to make, and it ended a conversation that would
otherwise have run and run.

### Rules

**One change per reported bug.** Two changes means a failure cannot be
attributed, and the next round starts from a worse position than the last. If
two things genuinely need changing, say which is the fix and which is
speculative, or split them across rounds.

**Never say "fixed" for anything visual.** `npm run lint` and `npx expo
export` prove that modules resolve and identifiers exist. They prove nothing
whatever about behaviour. Say what was changed, what was verified, and what
was not.

**Two failed attempts is a hard stop.** This rule is already in the root
CLAUDE.md and was ignored all day. At the second failure: no third code
change. Either ask the one question that separates the remaining hypotheses,
or build something that measures — an on-screen readout, a control the user
can drive. `src/components/TuningPanel.jsx` is the model.

**Check the patch landed.** A scripted edit that fails partway writes nothing,
so the parts that "were applied" silently were not. Grep the result before
describing it. Lint caught this twice today; that was luck.

### Build the user a panel

When something is visual — a spring, a spacing, a fade — **build a panel of
sliders and hand it over.** Do not iterate on numbers by description. The user
asked for this explicitly: adjusting it themselves, on the phone, is far
faster and less taxing than saying "a bit slower" and waiting a round to see.

`src/components/TuningPanel.jsx` was the shape of it, and it is worth copying
from the commit that removed it (values live in the screen's state, sliders
drive them, a Defaults button, and the whole thing behind a long-press on the
title). It cost one round to build and ended an exchange that had already run
several. The card canvas's `THROW`, `GLIDE`, `TILT_PER_PX` and `ELASTIC` are
the numbers it landed on.

Mark it TEMPORARY, and when the values settle write them into the component as
named constants — with the reasoning, not just the number — and delete the
panel.

This is a **first** resort for styling work, not something to reach for only
once stuck.

### What the user has agreed to do

- Say whether it is the **same** wrong or a **different** wrong. That one
  distinction says whether the model is broken or only the number.
- For motion: **which element leads, which lags**, and whether it is wrong at
  the start, the middle or the end.
- Call it out when two changes are made for one bug, or when something
  unverifiable is described as fixed.

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

`src/data/motion.js` **has** been ported, and carries the same rule with one
addition. Framer Motion and Reanimated describe a spring identically —
stiffness, damping and mass, fed to the same physics — so the numbers crossed
over unchanged and the two apps genuinely share a feel rather than
approximating each other. **A spring retuned in one app must be retuned in the
other.** Durations are the one difference: seconds on the web, milliseconds
here.

Not everything in it is shared, though, because the same name can drive
different things in the two apps. `PUSH_SPRING` settles the web's History push
*and* its tab changes; here it drives only the tab pager, because History is
pushed by the native stack, whose speed is `animationDuration` on the route in
`app/_layout.jsx`. Check which one a screen actually uses before retuning it.

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

**Funnel Sans and Funnel Display**, seven cuts, each registered as its own
family name (`src/theme/fonts.js`). React Native has no family/weight pairing:
asking for weight 500 on a family that shipped one file gets a synthesised
bold, not the real Medium. Style with `FONTS.medium`, never with `fontWeight`.

Sans for what is read, Display for what is looked at — the routine card, the
page title, the exercise name, the figure being lifted. `TYPE` in
`src/theme/index.js` already encodes which is which; pick a role from there
rather than naming a family directly.

Both are OFL from Google Fonts. There is **no Funnel Mono**, which is why the
tracked capitals that were the app's voice are now Sans rather than a mono
cut, and why anything needing to align in columns asks for tabular figures
explicitly — `TYPE.label`, `caption`, `figure` and `hero` all do.

Favorit was here until 2026-08-09 and is gone. Comments that name it are
explaining why a derived constant changed, not describing the present.

## A CSS value carries its mechanism with it

Three separate bugs today were the same mistake: taking a number out of the
web app's stylesheet and putting it in a React Native style, where the thing
underneath it works differently. The number was right; what it was doing was
not.

| The value | On the web | Here |
| --- | --- | --- |
| `line-height: 1.05` on a 64px figure | CSS lets glyphs spill outside their line box, so a tight one just overflows | React Native **clips** to it, so it cut the tops and tails off |
| `gap: 20` between two figures | The designer's 20 was measured against boxes already carrying the font's leading | The same 20 *added* to that leading, and the pair sat 60 apart |
| `rgba(253,253,252,0.72)` on a bar | Tints a `backdrop-filter`, which does the blurring | Laid over a `BlurView` that already frosts, it came out solid white |

A fourth, the same shape but about animation: the web transitions a
segment's `height`, and the port eased the **row count** the height is derived
from. Height is `230 / rows`, a curve — so easing rows from 17 to 1 leaves the
segment at 25pt when the animation is half over and does the whole visible
change in the last moments. It stalls, then snaps. **Interpolate the value the
eye is watching, not an input to a non-linear function.** CSS only ever offers
the former, so a ported transition has to be pointed at the same quantity.

So: when porting a value, port what it was doing, not what it said. If the
mechanism underneath is different — a line box that clips, a leading that is
already there, a blur that already tints — the number has to be worked out
again for this one. The next two sections are the worked examples.

## Type: never set a line height below the font's own

CSS lets glyphs spill outside their line box, so the web app can set
`line-height: 1.05` on a 64px figure and it simply overflows, visibly intact.
**React Native clips to the line box.** Any `lineHeight` below the font's
natural one cuts the tops and tails off, and it is worst exactly where it
shows most — large, bold numbers.

Funnel's own metrics, read from the files: ascent 1200, descent -300, gap 0,
on a **1200** unit em — and identical across all seven cuts, Sans and Display,
which is why one constant covers the lot. That is **1.25 em**: 102.5pt at the
82pt the workout figures now use.

So: state no `lineHeight` on display type and let the font decide, then
recover whatever tightness the design wants with margins, which do not clip.
Porting a `line-height` from the CSS directly is the wrong move.

If a figure looks cut, measure the font rather than trying numbers — the
head/hhea/OS-2 tables give the answer in one pass.

The same tables answer the other half of it: **a gap in a design is not a gap
in a style.** Funnel's ascent is exactly 1.0 em and its cap height 0.675em, so
every line carries 0.325em of empty space above the capitals and 0.25em below
the baseline. Two stacked figures are already **0.575em** apart before any gap
is set — 47.2pt at 82pt type. A design asking for 20pt of visible separation
therefore wants a **negative** margin, not `gap: 20`.

This is not theoretical: it is why `stats` on the completion screen carries a
negative `marginTop`, and why the set sheet's gap is 47.2. Both are written as
the subtraction with the arithmetic in a comment, so they follow if a size
moves — which is exactly what saved them when the figure grew from 72 to 82
and the typeface changed under them on the same day.

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

## Waiting on a development build

A growing list, all blocked by the same thing rather than by separate ones:
running a build of this app rather than Expo Go, which needs the Apple
Developer Program. Keep adding to it rather than deciding each in isolation.

| Waiting for | What it unblocks |
| --- | --- |
| A development build (any SDK) | **Liquid Glass.** `expo-glass-effect` is installed and wired; flip `USE_LIQUID_GLASS` in `src/components/Glass.jsx`. Both the tab bar and the restack button become the system's material. |
| A development build | **Confetti.** `react-native-fast-confetti` needs Skia, which Expo Go does not carry either. Replaces the hand-drawn `src/components/Confetti.jsx`. |
| SDK 56+ | **`@expo/ui`'s PagerView**, the drop-in for `react-native-pager-view` that Expo now prefers. The drop-in replacements arrived in 56; SDK 54's `@expo/ui` is 0.2.0-beta.9 and has none of them. |
| SDK 56+ | Whatever else has landed since. Read the changelogs at the time rather than trusting this list to be complete. |
| A real build | **The app on the home screen** with its own icon and name, rather than living inside Expo Go. |

Two habits that would have saved time here. Expo's docs default to the newest
SDK: a URL without `/v54.0.0/` in it may describe something this project does
not have. And a package being "supported in Expo Go" in its own docs is not
the same as its **native view being compiled into Expo Go's binary** — which
is what actually decides it, and what caught out both the glass and Skia.

## Liquid Glass does not work in Expo Go

`expo-glass-effect` is installed and wired up, and `USE_LIQUID_GLASS` in
`src/components/Glass.jsx` is **false**.

`GlassView` on iOS is `requireNativeViewManager('ExpoGlassEffect')` — a native
view compiled into the app binary. Expo Go's binary is fixed and does not
carry it, so the view resolves to nothing and draws nothing: the tab bar and
the restack button both lost their surfaces entirely rather than looking
wrong. The package's docs list expo-go among its platforms, which is what it
was adopted on; the phone disagreed.

So every glass surface goes through `Glass`, which falls back to a blur. Turn
the flag on once the app is on a development build and check both surfaces
before trusting it.

Its one rule, for when that happens: **opacity below 1 on a GlassView or any
view above it stops the effect rendering.** Fading a glass surface in by
wrapping it is the obvious move and it makes the surface disappear. Fade what
is inside it, or switch `glassEffectStyle` between 'regular' and 'none' and
let the material animate itself — which is what `hidden` does.

## The confetti is a placeholder

`src/components/Confetti.jsx` is drawn by hand, because `canvas-confetti` —
which the web app vendors — has no native equivalent. It works but it does not
look good, and the user has parked it rather than settle.

The research, so it is not repeated: **`react-native-fast-confetti`** is the
one worth having (560 stars, MIT, maintained, built for Reanimated 4, which is
what this project runs). It needs `@shopify/react-native-skia` ≥2.0.0, and
whether Expo Go for SDK 54 carries a new enough Skia is the open question —
if not it needs a development build, which needs a paid Apple account.
`react-native-simple-confetti` would certainly run, needing only Reanimated
and react-native-svg, but it has three stars and nine commits.

So: revisit when the app is on a development build anyway, at which point
`react-native-fast-confetti` is a straightforward choice. Do not install
anything here without asking — the user vendored `canvas-confetti` into the
web repo rather than depending on it, and reviews dependencies before they
land.

## Temporary scaffolding

None. Both pieces were removed on 2026-08-10 once they had answered their
questions, and both are worth knowing about because the next hard problem
will want one like them.

**The mock training** was a long-press on "My workouts" that cycled
fabricated weeks — `typical`, copied from the web app so the two charts could
be compared against identical data, and `dense`, running 1 to 17 workouts a
week. `dense` existed because the chart's scale only moves when the busiest
visible week changes, and a real install almost never swings far enough to
show a fault. It is what made the segment easing bug visible at all. In
`app/(tabs)/stats.jsx` before it went.

**The font test** was a screen listing candidate font family names with a
sample in each, reachable from the bottom of Settings. It settled which names
iOS actually resolves for SF Pro Rounded — the answer is recorded in
`src/theme/index.js`, since the failure is silent and someone will otherwise
try 'SF Pro Rounded' and believe it worked. `app/fonttest.jsx` before it went.

Both took one round to build and each ended an exchange that was going
nowhere. Reach for the same thing rather than guessing a fourth time — the
chart's own readout, added and deleted the same day, is the shortest example
in the history.

The web app's `/stats?mock` still exists and is now unrelated: that app is
frozen, so it keeps whatever it had.

## Where the port has got to

**Every screen is ported.** The card canvas, the workout with its carousel,
rest sweep and completion screen, Stats and its weekly chart, History, and
Settings. The colour grows out of a tapped card and hands itself back on the
way out. The tabs settle on the same spring the web uses, from the same
`motion.js`. The push to History does **not** — it is the native stack's
`simple_push`, timed by `animationDuration` in `app/_layout.jsx`, and no
spring is involved.

What is left is not screens. It is the list under "Waiting on a development
build" — the glass, the confetti, `@expo/ui`'s PagerView, and the app on the
home screen with its own icon. All four want the same thing.

Still standing after that: the four-tab restructure from the roadmap, which
waits on the user's cue cards and is a change to both apps rather than to this
one. Read `docs/routines-as-slots.md` and the roadmap before starting it.
