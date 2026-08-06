// How long to rest between sets.
//
// The ranges behind these are well established — roughly two to five
// minutes between heavy compound sets for strength, a minute or two for
// moderate work, less again for core, and thirty to sixty seconds when
// training to repeat effort with little recovery. Which end of a range a
// given routine belongs at is a judgement rather than a measurement.
//
// One thing deliberately absent: any suggestion that shorter rests burn
// more. Short rests do raise the metabolic spike after a session, but that
// doesn't carry through to total energy used — that follows how much work
// was done. The claim is common in gyms and it isn't true, so the copy
// below talks about pace, effort and session length instead.

// Routines differ in what they ask of you more than in name, so the
// durations are set per kind of work and routines point at one.
export const TIER_BY_ROUTINE = {
  'lower body': 'heavy',
  'full body': 'heavy',
  'upper body': 'moderate',
  glutes: 'moderate',
  core: 'core',
  stretching: 'stretching',
}

const DEFAULT_TIER = 'moderate'

// Written out per mode rather than derived by multiplying a base, so the
// numbers are exactly the ones a user was shown when choosing — a scale
// factor would land on 22.5 and 67.5 seconds and need rounding anyway.
//
// Stretching holds the same twenty seconds throughout: how long you pause
// between stretches isn't a training decision, so varying it would be
// noise dressed up as a choice.
export const REST_MODES = [
  {
    id: 'circuit',
    label: 'Circuit',
    description:
      'Barely any rest. One set straight into the next. Suits lighter weights, bodyweight rounds and easy holds, where the point is to keep going rather than to push each set.',
    seconds: { heavy: 20, moderate: 20, core: 20, stretching: 20 },
  },
  {
    id: 'brisk',
    label: 'Keep moving',
    description:
      'Short rests that keep the session brisk and your heart rate up. Expect to manage a bit less as you go (fewer reps, lighter weight, shorter holds) in exchange for a quicker workout.',
    seconds: { heavy: 60, moderate: 45, core: 25, stretching: 20 },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description:
      'Enough recovery to do each set properly without the session dragging. A good place to start if you are not sure.',
    seconds: { heavy: 120, moderate: 90, core: 45, stretching: 20 },
  },
  {
    id: 'strength',
    label: 'Build strength',
    description:
      'Full recovery before every set, so you can go as hard as each one allows: heavier weight, more reps, longer holds. Best for getting stronger and building muscle. Expect a longer session.',
    seconds: { heavy: 180, moderate: 135, core: 65, stretching: 20 },
  },
]

export const DEFAULT_REST_MODE = 'balanced'

export function restModeById(id) {
  return REST_MODES.find((mode) => mode.id === id) ?? REST_MODES.find((mode) => mode.id === DEFAULT_REST_MODE)
}

export function restSecondsFor(routineName, modeId = DEFAULT_REST_MODE) {
  const tier = TIER_BY_ROUTINE[routineName?.toLowerCase()] ?? DEFAULT_TIER
  return restModeById(modeId).seconds[tier]
}
