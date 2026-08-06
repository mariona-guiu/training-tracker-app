// Pre-loaded exercise library.
//
// Every exercise carries four things beyond its name, and each one earns its
// place by being used:
//
//   muscleGroup  how the library is browsed and filtered
//   equipment    what a slot can be told to prefer, and what a weight *means*
//                — a barbell figure includes the bar, a dumbbell figure is
//                per hand, a machine figure is the stack
//   pattern      what job the exercise does, and so which other exercises
//                could do it instead. This is what rotation swaps between
//                and what the "you could also do X" note is built from
//   difficulty   a slot in a beginner routine never resolves to an advanced
//                exercise
//
// The patterns are deliberately finer than "compound" and "isolation". One
// bucket for isolation would let a slot offer a calf raise in place of a
// bicep curl — technically both isolation, useless as a substitution.
//
// Nothing here is ever renamed or removed: preset routines resolve their
// exercises by name when seeding, so a rename drops them silently. Add, and
// leave what is already here alone.

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Arms', 'Core', 'Stretching']

// Muscle groups where a set is a stretch hold rather than a weighted rep — no weight field, reps means seconds held.
export const STRETCH_GROUPS = ['Stretching']

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight']

export const MOVEMENT_PATTERNS = [
  // Compound
  'horizontal-push',
  'vertical-push',
  'horizontal-pull',
  'vertical-pull',
  'squat',
  'hinge',
  'lunge',
  // Isolation, named by the joint action rather than lumped together
  'chest-fly',
  'elbow-flexion',
  'elbow-extension',
  'lateral-raise',
  'front-raise',
  'rear-delt',
  'knee-extension',
  'knee-flexion',
  'hip-extension',
  'hip-abduction',
  'calf',
  // Core and mobility
  'core-brace',
  'core-flexion',
  'core-rotation',
  'stretch',
]

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced']

// name, muscleGroup, equipment, pattern, difficulty
const E = (name, muscleGroup, equipment, pattern, difficulty) => ({
  name,
  muscleGroup,
  equipment,
  pattern,
  difficulty,
})

export const DEFAULT_EXERCISES = [
  // Chest ------------------------------------------------------------------
  E('Bench Press', 'Chest', 'barbell', 'horizontal-push', 'intermediate'),
  E('Incline Bench Press', 'Chest', 'barbell', 'horizontal-push', 'intermediate'),
  E('Decline Bench Press', 'Chest', 'barbell', 'horizontal-push', 'intermediate'),
  E('Dumbbell Bench Press', 'Chest', 'dumbbell', 'horizontal-push', 'beginner'),
  E('Incline Dumbbell Press', 'Chest', 'dumbbell', 'horizontal-push', 'intermediate'),
  E('Machine Chest Press', 'Chest', 'machine', 'horizontal-push', 'beginner'),
  E('Incline Machine Press', 'Chest', 'machine', 'horizontal-push', 'beginner'),
  E('Cable Chest Press', 'Chest', 'cable', 'horizontal-push', 'beginner'),
  E('Push-Up', 'Chest', 'bodyweight', 'horizontal-push', 'beginner'),
  E('Dip', 'Chest', 'bodyweight', 'horizontal-push', 'advanced'),
  E('Chest Fly', 'Chest', 'dumbbell', 'chest-fly', 'beginner'),
  E('Cable Fly', 'Chest', 'cable', 'chest-fly', 'beginner'),
  E('Pec Deck', 'Chest', 'machine', 'chest-fly', 'beginner'),
  E('Incline Dumbbell Fly', 'Chest', 'dumbbell', 'chest-fly', 'beginner'),

  // Back -------------------------------------------------------------------
  E('Deadlift', 'Back', 'barbell', 'hinge', 'advanced'),
  E('Barbell Row', 'Back', 'barbell', 'horizontal-pull', 'intermediate'),
  E('Pendlay Row', 'Back', 'barbell', 'horizontal-pull', 'advanced'),
  E('T-Bar Row', 'Back', 'machine', 'horizontal-pull', 'intermediate'),
  E('Seated Cable Row', 'Back', 'cable', 'horizontal-pull', 'beginner'),
  E('Single-Arm Dumbbell Row', 'Back', 'dumbbell', 'horizontal-pull', 'beginner'),
  E('Chest-Supported Row', 'Back', 'machine', 'horizontal-pull', 'beginner'),
  E('Inverted Row', 'Back', 'bodyweight', 'horizontal-pull', 'beginner'),
  E('Pull-Up', 'Back', 'bodyweight', 'vertical-pull', 'advanced'),
  E('Chin-Up', 'Back', 'bodyweight', 'vertical-pull', 'advanced'),
  E('Lat Pulldown', 'Back', 'machine', 'vertical-pull', 'beginner'),
  E('Neutral-Grip Pulldown', 'Back', 'machine', 'vertical-pull', 'beginner'),
  E('Assisted Pull-Up', 'Back', 'machine', 'vertical-pull', 'beginner'),
  E('Straight-Arm Pulldown', 'Back', 'cable', 'vertical-pull', 'beginner'),

  // Legs -------------------------------------------------------------------
  E('Squat', 'Legs', 'barbell', 'squat', 'intermediate'),
  E('Front Squat', 'Legs', 'barbell', 'squat', 'advanced'),
  E('Goblet Squat', 'Legs', 'dumbbell', 'squat', 'beginner'),
  E('Leg Press', 'Legs', 'machine', 'squat', 'beginner'),
  E('Hack Squat', 'Legs', 'machine', 'squat', 'intermediate'),
  E('Smith Machine Squat', 'Legs', 'machine', 'squat', 'beginner'),
  E('Romanian Deadlift', 'Legs', 'barbell', 'hinge', 'intermediate'),
  E('Dumbbell Romanian Deadlift', 'Legs', 'dumbbell', 'hinge', 'beginner'),
  E('Good Morning', 'Legs', 'barbell', 'hinge', 'advanced'),
  E('Cable Pull-Through', 'Legs', 'cable', 'hinge', 'beginner'),
  E('Back Extension', 'Legs', 'machine', 'hinge', 'beginner'),
  E('Smith Machine Romanian Deadlift', 'Legs', 'machine', 'hinge', 'beginner'),
  E('Walking Lunge', 'Legs', 'dumbbell', 'lunge', 'intermediate'),
  E('Reverse Lunge', 'Legs', 'dumbbell', 'lunge', 'beginner'),
  E('Static Lunge', 'Legs', 'bodyweight', 'lunge', 'beginner'),
  E('Step-Up', 'Legs', 'dumbbell', 'lunge', 'beginner'),
  E('Smith Machine Split Squat', 'Legs', 'machine', 'lunge', 'intermediate'),
  E('Single-Leg Leg Press', 'Legs', 'machine', 'lunge', 'beginner'),
  E('Leg Extension', 'Legs', 'machine', 'knee-extension', 'beginner'),
  E('Sissy Squat', 'Legs', 'bodyweight', 'knee-extension', 'advanced'),
  E('Reverse Nordic Curl', 'Legs', 'bodyweight', 'knee-extension', 'intermediate'),
  E('Leg Curl', 'Legs', 'machine', 'knee-flexion', 'beginner'),
  E('Seated Leg Curl', 'Legs', 'machine', 'knee-flexion', 'beginner'),
  E('Nordic Curl', 'Legs', 'bodyweight', 'knee-flexion', 'advanced'),
  E('Dumbbell Leg Curl', 'Legs', 'dumbbell', 'knee-flexion', 'intermediate'),
  E('Calf Raise', 'Legs', 'machine', 'calf', 'beginner'),
  E('Seated Calf Raise', 'Legs', 'machine', 'calf', 'beginner'),
  E('Dumbbell Calf Raise', 'Legs', 'dumbbell', 'calf', 'beginner'),
  E('Single-Leg Calf Raise', 'Legs', 'bodyweight', 'calf', 'beginner'),

  // Glutes -----------------------------------------------------------------
  E('Hip Thrust', 'Glutes', 'barbell', 'hip-extension', 'intermediate'),
  E('Machine Hip Thrust', 'Glutes', 'machine', 'hip-extension', 'beginner'),
  E('Glute Bridge', 'Glutes', 'bodyweight', 'hip-extension', 'beginner'),
  E('Single-Leg Glute Bridge', 'Glutes', 'bodyweight', 'hip-extension', 'beginner'),
  E('Cable Kickback', 'Glutes', 'cable', 'hip-extension', 'beginner'),
  E('Sumo Deadlift', 'Glutes', 'barbell', 'hinge', 'advanced'),
  E('Bulgarian Split Squat', 'Glutes', 'dumbbell', 'lunge', 'intermediate'),
  E('Curtsy Lunge', 'Glutes', 'dumbbell', 'lunge', 'intermediate'),
  E('Hip Abduction Machine', 'Glutes', 'machine', 'hip-abduction', 'beginner'),
  E('Cable Hip Abduction', 'Glutes', 'cable', 'hip-abduction', 'beginner'),
  E('Lateral Band Walk', 'Glutes', 'bodyweight', 'hip-abduction', 'beginner'),
  E('Side-Lying Leg Raise', 'Glutes', 'bodyweight', 'hip-abduction', 'beginner'),

  // Shoulders --------------------------------------------------------------
  E('Overhead Press', 'Shoulders', 'barbell', 'vertical-push', 'intermediate'),
  E('Dumbbell Shoulder Press', 'Shoulders', 'dumbbell', 'vertical-push', 'beginner'),
  E('Arnold Press', 'Shoulders', 'dumbbell', 'vertical-push', 'intermediate'),
  E('Machine Shoulder Press', 'Shoulders', 'machine', 'vertical-push', 'beginner'),
  E('Pike Push-Up', 'Shoulders', 'bodyweight', 'vertical-push', 'advanced'),
  E('Smith Machine Overhead Press', 'Shoulders', 'machine', 'vertical-push', 'beginner'),
  E('Lateral Raise', 'Shoulders', 'dumbbell', 'lateral-raise', 'beginner'),
  E('Cable Lateral Raise', 'Shoulders', 'cable', 'lateral-raise', 'beginner'),
  E('Machine Lateral Raise', 'Shoulders', 'machine', 'lateral-raise', 'beginner'),
  E('Seated Lateral Raise', 'Shoulders', 'dumbbell', 'lateral-raise', 'beginner'),
  E('Front Raise', 'Shoulders', 'dumbbell', 'front-raise', 'beginner'),
  E('Cable Front Raise', 'Shoulders', 'cable', 'front-raise', 'beginner'),
  E('Rear Delt Fly', 'Shoulders', 'dumbbell', 'rear-delt', 'beginner'),
  E('Reverse Pec Deck', 'Shoulders', 'machine', 'rear-delt', 'beginner'),
  E('Face Pull', 'Shoulders', 'cable', 'rear-delt', 'beginner'),
  E('Prone Y Raise', 'Shoulders', 'bodyweight', 'rear-delt', 'beginner'),

  // Arms -------------------------------------------------------------------
  E('Barbell Curl', 'Arms', 'barbell', 'elbow-flexion', 'beginner'),
  E('Dumbbell Curl', 'Arms', 'dumbbell', 'elbow-flexion', 'beginner'),
  E('Hammer Curl', 'Arms', 'dumbbell', 'elbow-flexion', 'beginner'),
  E('Incline Dumbbell Curl', 'Arms', 'dumbbell', 'elbow-flexion', 'intermediate'),
  E('Cable Curl', 'Arms', 'cable', 'elbow-flexion', 'beginner'),
  E('Preacher Curl', 'Arms', 'machine', 'elbow-flexion', 'beginner'),
  E('Tricep Pushdown', 'Arms', 'cable', 'elbow-extension', 'beginner'),
  E('Cable Overhead Extension', 'Arms', 'cable', 'elbow-extension', 'beginner'),
  E('Skull Crusher', 'Arms', 'barbell', 'elbow-extension', 'intermediate'),
  E('Close-Grip Bench Press', 'Arms', 'barbell', 'elbow-extension', 'intermediate'),
  E('Overhead Tricep Extension', 'Arms', 'dumbbell', 'elbow-extension', 'beginner'),
  E('Tricep Dip', 'Arms', 'bodyweight', 'elbow-extension', 'intermediate'),
  E('Machine Tricep Extension', 'Arms', 'machine', 'elbow-extension', 'beginner'),

  // Core -------------------------------------------------------------------
  E('Plank', 'Core', 'bodyweight', 'core-brace', 'beginner'),
  E('Side Plank', 'Core', 'bodyweight', 'core-brace', 'beginner'),
  E('Dead Bug', 'Core', 'bodyweight', 'core-brace', 'beginner'),
  E('Ab Wheel Rollout', 'Core', 'bodyweight', 'core-brace', 'advanced'),
  E('Hanging Leg Raise', 'Core', 'bodyweight', 'core-flexion', 'advanced'),
  E('Lying Leg Raise', 'Core', 'bodyweight', 'core-flexion', 'beginner'),
  E('Crunch', 'Core', 'bodyweight', 'core-flexion', 'beginner'),
  E('Cable Crunch', 'Core', 'cable', 'core-flexion', 'beginner'),
  E('Machine Crunch', 'Core', 'machine', 'core-flexion', 'beginner'),
  E('Russian Twist', 'Core', 'bodyweight', 'core-rotation', 'beginner'),
  E('Pallof Press', 'Core', 'cable', 'core-rotation', 'intermediate'),
  E('Cable Woodchop', 'Core', 'cable', 'core-rotation', 'intermediate'),
  E('Bicycle Crunch', 'Core', 'bodyweight', 'core-rotation', 'beginner'),

  // Stretching -------------------------------------------------------------
  E('Hamstring Stretch', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('Quad Stretch', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('Hip Flexor Stretch', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('Calf Stretch', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('Cat-Cow', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E("Child's Pose", 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('Downward Dog', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('Pigeon Pose', 'Stretching', 'bodyweight', 'stretch', 'intermediate'),
  E('Seated Spinal Twist', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('Thoracic Rotation', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('90/90 Hip Stretch', 'Stretching', 'bodyweight', 'stretch', 'intermediate'),
  E('Standing Forward Fold', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('Chest Doorway Stretch', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
  E('Shoulder Cross-Body Stretch', 'Stretching', 'bodyweight', 'stretch', 'beginner'),
]
