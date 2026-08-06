import { STRETCH_GROUPS } from './defaultExercises.js'

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
    tracksWeight: !STRETCH_GROUPS.includes(exercise.muscleGroup),
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
      const primary = byName.get(slot.primary)
      // A slot whose exercise is missing from the library is dropped rather
      // than guessed at — the same way seeding has always behaved.
      return primary ? shape(primary, slot) : null
    })
    .filter(Boolean)
}
