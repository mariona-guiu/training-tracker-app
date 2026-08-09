import { isTimed } from './defaultExercises.js'

// Turning a routine's slots into the exercises you will actually do.
//
// A slot says what job needs doing; this decides who does it. Today the
// answer is always the exercise the routine was written around, so nothing
// about the app behaves differently from before slots existed. The point of
// having it now is that everything downstream — starting a session, showing
// a workout's contents — already goes through one place, so rotation and
// equipment preference become changes to this function rather than changes
// scattered across screens.
//
// Two rules this must keep whatever gets added:
//
//   It is a pure function. Same routine, same inputs, same exercises —
//   every time. Reopening the app mid-week must never change your workout,
//   which rules out picking at random and rules out remembering anything.
//
//   What it returns is copied onto the session. History is a record of what
//   was done, so nothing here can reach backwards and rewrite it.

const DIFFICULTY_ORDER = ['beginner', 'intermediate', 'advanced']

// Everything a slot could reasonably resolve to: the same job, no harder
// than the routine claims to be, and something the user can actually get to.
// Used for rotation later, and for the "you could also do X" note now.
export function candidatesFor(slot, library, { difficulty, equipment } = {}) {
  const ceiling = DIFFICULTY_ORDER.indexOf(difficulty)
  return library.filter((exercise) => {
    if (exercise.pattern !== slot.pattern) return false
    // A slot naming a muscle rather than an exercise wants anything that works
    // it the right way — every chest stretch answers "open the chest", which is
    // what lets one slot vary later without the routine being rewritten.
    if (slot.muscle && exercise.muscleGroup !== slot.muscle) return false
    if (ceiling >= 0 && DIFFICULTY_ORDER.indexOf(exercise.difficulty) > ceiling) return false
    if (equipment?.length && !equipment.includes(exercise.equipment)) return false
    return true
  })
}

function shape(exercise, slot) {
  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    targetSets: slot.targetSets,
    targetReps: slot.targetReps,
    // Read from the pattern, not the muscle group. It used to ask whether
    // the muscle group was 'Stretching', which stopped working the moment a
    // chest stretch started being tagged as a chest exercise — it would have
    // begun asking for kilos instead of seconds.
    tracksWeight: !isTimed(exercise),
    // Carried onto the session as a fact about what was done, so rest length
    // and the calorie rate can be worked out per exercise rather than per
    // session. The fact is stored; the tier it implies is derived, so
    // retuning a tier still corrects every past session at once.
    pattern: exercise.pattern,
  }
}

// The exercises for one run of a routine, in slot order.
//
// `context` is where rotation and equipment preference will arrive. It is
// accepted and ignored for now rather than left out, so adding them later
// doesn't change how every caller talks to this.
export function resolveSlots(routine, library, _context = {}) {
  const byName = new Map(library.map((exercise) => [exercise.name, exercise]))

  return routine.slots
    .map((slot) => {
      // Two kinds of slot. One names the exercise the routine was written
      // around; the other names the muscle to work and leaves the choice here.
      // A cooldown uses the second — "open the chest" rather than "do the
      // doorway stretch" — so the same slot can offer a different stretch once
      // rotation exists.
      //
      // Sorted and taken from the top rather than picked: this has to return
      // the same exercises every time it is asked, or reopening the app
      // mid-week would change your workout.
      // The exercise the slot was written around comes first, exactly as it
      // does for a strength slot. The muscle is what the slot *may* be filled
      // by — the set rotation will one day choose from — not a replacement for
      // having an answer today.
      //
      // Falling through to the muscle also covers a named stretch going
      // missing from the library: the slot still gets filled by something that
      // works the right muscle, rather than being dropped.
      const chosen =
        (slot.primary && byName.get(slot.primary)) ??
        (slot.muscle
          ? candidatesFor(slot, library, { difficulty: routine.difficulty }).sort((a, b) =>
              a.name.localeCompare(b.name),
            )[0]
          : undefined)

      // A slot nothing can fill is dropped rather than guessed at — the same
      // way seeding has always behaved.
      return chosen ? shape(chosen, slot) : null
    })
    .filter(Boolean)
}
