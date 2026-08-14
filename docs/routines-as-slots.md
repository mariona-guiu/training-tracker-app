# A routine is a list of slots

Settled 2026-08-04. This note is the thing to hold a concept screen against.

## The idea

A routine no longer names its exercises. It describes the **jobs** to be
done, and which exercise fills each job is worked out when you start.

```
Upper Body
  slot 1  horizontal push   3 x 8    normally Bench Press
  slot 2  horizontal pull   3 x 10   normally Barbell Row
  slot 3  vertical push     3 x 8    normally Overhead Press
  ...
```

Bench press satisfies slot 1. So does dumbbell bench press, and so does a
machine chest press. Which one you get depends on the week and on what
equipment you have said you train with.

## Why it has to be this way

Three of the stories collapse into one mechanism once routines are slots,
and none of them work cleanly without it.

**Rotation.** "The same Upper Body shouldn't be the same five exercises
every week." A slot has more than one exercise that can fill it, so
rotating means choosing a different one. With fixed lists there is nothing
to rotate between.

**Equipment preference.** "Machines only" becomes a constraint on how a slot
resolves, so a machines-only user gets the machine version of Upper Body.
With fixed lists the best you could do is hide whole routines from them,
which loses the workout rather than adapting it.

**"Users cannot edit predefined workouts."** If equipment preference changed
the contents of a fixed list, it *would* be editing it. With slots the
routine is untouched and only its resolution differs, so the rule holds.

## The vocabulary

Every exercise carries these. Filters and slot constraints are written in
the same terms, so what a designer can filter by is exactly what the data
knows.

**Equipment** — `barbell`, `dumbbell`, `machine`, `cable`, `bodyweight`.
Also decides what a weight *means*: a barbell figure includes the bar, a
dumbbell figure is per hand, a machine figure is the stack.

**Movement pattern** — `horizontal-push`, `vertical-push`,
`horizontal-pull`, `vertical-pull`, `squat`, `hinge`, `lunge`, `core`,
`isolation`, `stretch`. What makes two exercises interchangeable.

**Difficulty** — `beginner`, `intermediate`, `advanced`. A slot in a
beginner routine never resolves to an advanced exercise.

## What equipment a person has

The setting is about where someone trains, not about preference. Somebody
with dumbbells, a barbell and some plates at home should only ever be shown
workouts they can actually do, rather than being offered a leg extension
they have no machine for.

Three options, and **bodyweight belongs to all of them** — a plank and a
hamstring stretch need nothing, so nobody is excluded from them:

| setting | equipment it means |
| --- | --- |
| Free weight | barbell, dumbbell, bodyweight |
| Machines | machine, cable, bodyweight |
| Mix (default) | everything |

Bodyweight is not an option a user picks. It is always in the pool, because
excluding it would empty Core and Stretching entirely for a home user and
take the press-ups off someone with a rack.

Machines and cables are one option rather than two. Separately, cables
cannot fill a hinge or a triceps slot, and no gym keeps them apart anyway.

Every movement pattern has at least two exercises under both settings, so
rotation still works whichever is chosen — the one exception is the front
raise, which has a single free-weight and a single machine option and so
never varies. It is a marginal pattern and no preset uses it.

## Resolution

```
resolve(routine, { week, equipment, difficulty }) -> concrete exercises
```

Two rules that matter:

**It must be deterministic.** The same routine in the same week must give
the same exercises every time. Derived from the week number, never from a
random pick and never from stored state — otherwise reopening the app
mid-week changes your workout.

**The result is copied onto the session.** Sessions already work this way
and it stays: what you did is recorded on the session itself, so editing a
routine, rotating it, or deleting it can never rewrite your history.

## Substitutions

Settled 2026-08-04: the alternatives a slot could have resolved to are shown
as a **note in the exercise view** — "you could also do X, Y or Z to train
the same muscle" — rather than as a swap control inside a running workout.

It reuses the pattern classification exactly, costs no new data, and keeps
the workout screen as it is: one exercise, one thing to do.

## Not yet decided

- Whether a slot lists its candidates explicitly or derives them from
  pattern plus equipment. Deriving is less to maintain; listing gives
  tighter control over what counts as a sensible swap.
- How often rotation turns over. "Once a week" was the starting thought.
- Whether custom routines get slots too, or are plain fixed lists to begin
  with. Rotation for custom routines was described as a maybe-later.

## The line this must not cross

**Rotation changes _which_ exercises. A programme changes _how much_.**

Swapping bench press for dumbbell press is variety, and serves someone who
knows what they are doing and is bored of the same five lifts. Telling them
to add 2.5kg this week is prescription. Everything that would turn this app
into a coach — progression schemes, deload weeks, "week 3 of 8" — follows
from crossing that line once, so sets and reps are never touched by
rotation.
