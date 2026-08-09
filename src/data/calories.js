import { tierFor } from './rest.js'

// An estimate of what a workout cost, by the MET method: energy is a rate
// multiplied by body weight and time.
//
//   kcal = MET × kg × hours
//
// The rate is applied to the **whole session**, rest included, because that
// is how the published figures for resistance training were measured — on
// people doing sessions that already had rest in them. An earlier version
// of this split the session into working time at a high rate and rest at a
// low one, which sounds more careful and is wrong: it discounts the rest
// twice, and landed at less than half of what Apple's Fitness app reports
// for the same workout.
//
// What is reported is **active** energy, the part above simply being alive.
// That is what "how many calories did this burn" is asking, and what the
// figures people compare against report.
//
// Where there is a choice, this errs low. An estimate that flatters is
// worse than one that disappoints: someone eating against a number they
// were given is owed the cautious end of it, not the hopeful end. Every
// judgement below leans that way, and the arithmetic rounds down.

// Whole-session rates, from the Compendium of Physical Activities. It puts
// vigorous multi-exercise resistance training at 6 and moderate at 3.5;
// these sit a step below vigorous, because that entry assumes hard effort
// throughout and a real session has warm-up sets and easier movements in
// it. Reading it as "vigorous all the way through" is the flattering
// assumption, so it isn't the one made here.
const MET_BY_TIER = {
  heavy: 5.5, // squats, deadlifts, the whole-body compounds
  moderate: 4.5,
  core: 3.5,
  // Active control through a range: more than waiting out a hold, less than
  // core work, and not continuous. The Compendium puts light calisthenics at
  // 3.5 and mild stretching at 2.3; this sits deliberately nearer the lower.
  mobility: 2.8,
  stretching: 2.3,
}

// How hard the session runs, which is a real difference rather than a
// flourish: the same Compendium separates circuit training at 8 from
// vigorous weight training at 6 from moderate at 3.5, and what mostly
// separates them is the rest between sets.
//
// Not applied to stretching, whose rest is the same twenty seconds at every
// pace — the setting doesn't change what that session is.
const PACE_FACTOR = {
  circuit: 1.35,
  brisk: 1.15,
  balanced: 1,
  strength: 0.9,
}

// Three seconds is a controlled repetition: a count up, a count and a half
// down. Only used to work out how long a session could plausibly have run
// for, never to value the work directly.
const SECONDS_PER_REP = 3

// The most a single set can be worth in wall-clock time. Someone who opens
// a workout, does a set and puts the phone down for two hours hasn't burned
// two hours of anything.
//
// Deliberately generous, and deliberately not derived from the rest pace you
// chose. Tied to that, it fired whenever anyone rested longer than their
// setting suggested — so a hard circuit session scored *below* an easy one
// of the same length, which is incoherent rather than cautious. This only
// catches a session nobody could have been in.
const SECONDS_PER_SET_CEILING = 180

// Named inputs rather than a named method: "your weight, the kind of workout
// and how long it lasted" tells you what would change the number, which is
// the useful part. The method is named too, for anyone who wants to check
// it.
export const KCAL_NOTE =
  'Estimated from your weight, the kind of workout and how long it lasted, using the MET method. A rough guide, not a measurement.'

// The same sentence with the mark that ties it to the figure above it.
export const KCAL_DISCLAIMER = `*${KCAL_NOTE}`

// Mobility is more work than a held stretch and less than core: the drills are
// active, taking a joint to the end of what it has under its own power, but
// they are not continuous. Erring low, as everything here does.
//
// Pace is not applied to either, for the reason stated above — their rest does
// not change with the setting, so the setting does not change what they are.

function loggedSets(session) {
  return session.exercises.flatMap((exercise) =>
    exercise.sets.filter((set) => set.done).map((set) => ({ set, exercise })),
  )
}

// Roughly how long the sets themselves took. A held stretch knows its own
// seconds; a weighted set is reckoned from its repetitions.
function setSeconds({ set, exercise }) {
  const reps = set.reps ?? exercise.targetReps ?? 0
  return exercise.tracksWeight ? reps * SECONDS_PER_REP : reps
}

function workingSeconds(sets) {
  return sets.reduce((total, entry) => total + setSeconds(entry), 0)
}

// The rate for one exercise: its tier, and the pace setting where the pace
// setting means anything. Timed work rests the same however the pace is set,
// so the setting is not applied to it.
function metFor(exercise, kind, restMode) {
  const tier = tierFor(kind, exercise)
  const paced = tier === 'stretching' || tier === 'mobility'
  return MET_BY_TIER[tier] * (paced ? 1 : (PACE_FACTOR[restMode] ?? 1))
}

// Each exercise's rate, weighted by the seconds it accounted for. Falls back to
// the session's own rate when nothing is measurable, so a session of sets that
// somehow took no time is still costed rather than divided by zero.
function blendedMet(sets, kind, restMode) {
  let seconds = 0
  let weighted = 0
  for (const entry of sets) {
    const s = setSeconds(entry)
    seconds += s
    weighted += s * metFor(entry.exercise, kind, restMode)
  }
  return seconds > 0 ? weighted / seconds : metFor(undefined, kind, restMode)
}

// Everything it needs is on the session: the weight recorded when the
// workout ended, and the rest setting in force at the time. So a workout
// from six months ago is costed against the person who did it, and
// correcting these numbers later corrects every session at once rather than
// leaving two identical workouts showing different figures.
//
// Null rather than zero when there is nothing to say: no weight given, a
// session that never ended, or one where nothing was logged. The screens
// leave the figure out entirely in that case rather than show a nought.
export function caloriesFor(session) {
  const bodyWeightKg = session?.bodyWeightKg
  if (!bodyWeightKg || !session.endedAt) return null

  const sets = loggedSets(session)
  if (sets.length === 0) return null

  const kind = session.routineType ?? session.routineName

  // One rate for the whole session was fine while a session was one kind of
  // work. A cooldown inside a lower body workout is not, and costing those
  // stretches at the squatting rate would be exactly the flattering assumption
  // the rest of this file refuses to make.
  //
  // So the rate is blended by how long each exercise took: every exercise
  // contributes its own tier, weighted by its share of the working seconds.
  // With one kind of work throughout the blend equals the single rate it
  // replaces, which is why no existing session's figure moves.
  const met = blendedMet(sets, kind, session.restMode)

  // A session can't have run longer than its own sets and rests allow,
  // however long the app was left open on it.
  const elapsed = Math.max(0, (session.endedAt - session.startedAt) / 1000)
  const plausible = workingSeconds(sets) + sets.length * SECONDS_PER_SET_CEILING
  const counted = Math.min(elapsed, plausible)

  // Minus one, because the rate includes simply being alive and that would
  // have happened anyway. Rounded down, not to nearest: the last thing this
  // should do is round its way upward.
  return Math.floor(((met - 1) * bodyWeightKg * counted) / 3600)
}
