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
  // Replaces 'stretching' as a kind of session. Stretching did not become
  // mobility — the two are different work, and stretches moved to the end of
  // other workouts, where they were always going to be more use. 'stretching'
  // stays a valid key in the colour and tier tables so old sessions still
  // render; it is simply no longer something a new routine can be.
  'mobility',
]

// pattern, the exercise it was written around, sets, reps
const S = (pattern, primary, targetSets, targetReps) => ({
  pattern,
  primary,
  targetSets,
  targetReps,
})

// pattern, the muscle to work, sets, seconds held.
//
// A slot that says what to open rather than what to do. The point of a
// cooldown is that the chest gets stretched, not that one particular stretch
// happens — so the same slot can offer a different one later without the
// routine being rewritten. Which one it picks is resolved from the library,
// deterministically; see resolveSlots.
const M = (pattern, muscle, primary, targetSets, targetReps) => ({
  pattern,
  muscle,
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
      M('stretch', 'Chest', 'Chest Doorway Stretch', 1, 30),
      M('stretch', 'Shoulders', 'Shoulder Cross-Body Stretch', 1, 30),
      M('stretch', 'Back', "Child's Pose", 1, 30),
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
      M('stretch', 'Legs', 'Hamstring Stretch', 1, 30),
      M('stretch', 'Glutes', 'Hip Flexor Stretch', 1, 30),
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
      M('stretch', 'Glutes', 'Pigeon Pose', 1, 30),
      M('stretch', 'Legs', 'Hamstring Stretch', 1, 30),
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
      M('stretch', 'Back', 'Seated Spinal Twist', 1, 30),
    ],
  },
  {
    // The key never changes — it is what seeding matches on — so this stays
    // 'stretching' even though nothing else about the routine does.
    key: 'stretching',
    name: 'Mobility',
    type: 'mobility',
    difficulty: 'intermediate',
    // One drill per region rather than a tour of held positions. Jefferson
    // Curl is deliberately absent: it is the one here where doing it badly
    // costs something, and a preset should not be the thing that hands it to
    // you. Being marked advanced keeps it out of this anyway, since the
    // routine is intermediate.
    slots: [
      M('mobility', 'Glutes', '90/90 Hip Switch', 1, 45),
      M('mobility', 'Legs', 'Deep Squat Hold with Reach', 1, 45),
      M('mobility', 'Back', 'Cat-Cow', 1, 45),
      M('mobility', 'Shoulders', 'Shoulder CARs', 1, 45),
      M('mobility', 'Core', 'Bird Dog', 1, 45),
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
      M('stretch', 'Legs', 'Hamstring Stretch', 1, 30),
      M('stretch', 'Back', "Child's Pose", 1, 30),
      M('stretch', 'Chest', 'Chest Doorway Stretch', 1, 30),
    ],
  },
]
