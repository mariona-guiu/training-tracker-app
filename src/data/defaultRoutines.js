// Pre-built starter routines, written as slots rather than as lists of
// exercises. See docs/routines-as-slots.md.
//
// A slot describes the job — a horizontal push for three sets of eight —
// and names the exercise the routine was written around. Which exercise
// actually fills it is worked out when a workout starts, from the slot's
// pattern, the routine's difficulty and whatever equipment the user trains
// with. Today that always comes back as the primary; rotation will make it
// vary by week without any of this changing.
//
// `key` is what seeding matches on and never changes. The display name is
// free to, and a user creating their own routine called "Upper Body" can no
// longer stop the real one from updating.
//
// `type` is the canonical kind of session, and is what colour, rest length
// and the calorie rate all key off. Presets happen to share it with their
// name; custom routines will have to choose one, which is why it is a field
// of its own rather than something read from the name.

export const ROUTINE_TYPES = [
  'upper body',
  'lower body',
  'glutes',
  'core',
  'full body',
  'stretching',
]

// pattern, the exercise it was written around, sets, reps
const S = (pattern, primary, targetSets, targetReps) => ({
  pattern,
  primary,
  targetSets,
  targetReps,
})

export const DEFAULT_ROUTINES = [
  {
    key: 'upper-body',
    name: 'Upper Body',
    type: 'upper body',
    difficulty: 'intermediate',
    slots: [
      S('horizontal-push', 'Bench Press', 3, 8),
      S('horizontal-pull', 'Barbell Row', 3, 10),
      S('vertical-push', 'Overhead Press', 3, 8),
      S('vertical-pull', 'Lat Pulldown', 3, 12),
      S('elbow-flexion', 'Barbell Curl', 3, 12),
      S('elbow-extension', 'Tricep Pushdown', 3, 12),
    ],
  },
  {
    key: 'lower-body',
    name: 'Lower Body',
    type: 'lower body',
    difficulty: 'intermediate',
    slots: [
      S('squat', 'Squat', 4, 8),
      S('hinge', 'Romanian Deadlift', 3, 10),
      S('squat', 'Leg Press', 3, 12),
      S('knee-flexion', 'Leg Curl', 3, 12),
      S('calf', 'Calf Raise', 3, 15),
    ],
  },
  {
    key: 'glutes',
    name: 'Glutes',
    type: 'glutes',
    difficulty: 'intermediate',
    slots: [
      S('hip-extension', 'Hip Thrust', 4, 10),
      S('hinge', 'Sumo Deadlift', 3, 8),
      S('lunge', 'Bulgarian Split Squat', 3, 10),
      S('hip-extension', 'Glute Bridge', 3, 15),
      S('hip-abduction', 'Cable Kickback', 3, 15),
    ],
  },
  {
    key: 'core',
    name: 'Core',
    type: 'core',
    difficulty: 'beginner',
    slots: [
      S('core-brace', 'Plank', 3, 30),
      S('core-flexion', 'Hanging Leg Raise', 3, 12),
      S('core-flexion', 'Cable Crunch', 3, 15),
      S('core-rotation', 'Russian Twist', 3, 20),
      S('core-brace', 'Ab Wheel Rollout', 3, 10),
    ],
  },
  {
    key: 'stretching',
    name: 'Stretching',
    type: 'stretching',
    difficulty: 'beginner',
    slots: [
      S('stretch', 'Hamstring Stretch', 1, 30),
      S('stretch', 'Quad Stretch', 1, 30),
      S('stretch', 'Hip Flexor Stretch', 1, 30),
      S('stretch', 'Cat-Cow', 1, 30),
      S('stretch', "Child's Pose", 1, 30),
      S('stretch', 'Standing Forward Fold', 1, 30),
      S('stretch', 'Chest Doorway Stretch', 1, 30),
      S('stretch', 'Shoulder Cross-Body Stretch', 1, 30),
    ],
  },
  {
    key: 'full-body',
    name: 'Full Body',
    type: 'full body',
    difficulty: 'beginner',
    slots: [
      S('squat', 'Squat', 3, 10),
      S('horizontal-push', 'Bench Press', 3, 10),
      S('horizontal-pull', 'Barbell Row', 3, 10),
      S('vertical-push', 'Overhead Press', 3, 8),
      S('core-brace', 'Plank', 3, 30),
    ],
  },
]
