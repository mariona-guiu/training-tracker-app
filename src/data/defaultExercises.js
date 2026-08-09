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

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Arms', 'Core']

// 'Stretching' used to sit in the list above, which meant a chest stretch
// was tagged as belonging to the muscle group 'Stretching' and the app had
// no way of knowing it stretched the chest. It was never a muscle — it
// described the kind of work, which is what `pattern` is for. Every stretch
// now carries the muscle it opens, and the pattern says how.
//
// Patterns whose sets are timed rather than loaded: reps means seconds held,
// and there is no weight field. Read from the pattern rather than the muscle
// group for exactly the reason above.
export const TIMED_PATTERNS = ['stretch', 'mobility']

export const isTimed = (exercise) => TIMED_PATTERNS.includes(exercise?.pattern)

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
  // Core
  'core-brace',
  'core-flexion',
  'core-rotation',
  // Timed work. A stretch is a position held until the muscle gives; a
  // mobility drill is active control through a range, which is a different
  // thing to train and a different thing to program.
  'stretch',
  'mobility',
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

  // Stretches ---------------------------------------------------------------
  // Held positions, each carrying the muscle it opens so a workout can end
  // with stretches for what it just trained.
  E('Hamstring Stretch', 'Legs', 'bodyweight', 'stretch', 'beginner'),
  E('Quad Stretch', 'Legs', 'bodyweight', 'stretch', 'beginner'),
  E('Calf Stretch', 'Legs', 'bodyweight', 'stretch', 'beginner'),
  E('Standing Forward Fold', 'Legs', 'bodyweight', 'stretch', 'beginner'),
  E('Hip Flexor Stretch', 'Glutes', 'bodyweight', 'stretch', 'beginner'),
  E('90/90 Hip Stretch', 'Glutes', 'bodyweight', 'stretch', 'intermediate'),
  E('Pigeon Pose', 'Glutes', 'bodyweight', 'stretch', 'intermediate'),
  E("Child's Pose", 'Back', 'bodyweight', 'stretch', 'beginner'),
  E('Seated Spinal Twist', 'Back', 'bodyweight', 'stretch', 'beginner'),
  E('Downward Dog', 'Back', 'bodyweight', 'stretch', 'beginner'),
  E('Chest Doorway Stretch', 'Chest', 'bodyweight', 'stretch', 'beginner'),
  E('Shoulder Cross-Body Stretch', 'Shoulders', 'bodyweight', 'stretch', 'beginner'),
  // Passive by design — a decompression rather than a drill — so it is a
  // stretch and not mobility, whatever its reputation.
  E('Dead Hang', 'Shoulders', 'bodyweight', 'stretch', 'intermediate'),

  // Mobility ----------------------------------------------------------------
  // Active control through a range, rather than a position waited out. Timed
  // like stretches, but they are work: the hips and shoulders here are being
  // moved under their own power to the end of what they have.
  E('90/90 Hip Switch', 'Glutes', 'bodyweight', 'mobility', 'intermediate'),
  E('Cossack Squat', 'Legs', 'bodyweight', 'mobility', 'intermediate'),
  E('Deep Squat Hold with Reach', 'Legs', 'bodyweight', 'mobility', 'beginner'),
  E('Ankle Rock', 'Legs', 'bodyweight', 'mobility', 'beginner'),
  E('Cat-Cow', 'Back', 'bodyweight', 'mobility', 'beginner'),
  E('Thoracic Rotation', 'Back', 'bodyweight', 'mobility', 'beginner'),
  // Loaded spinal flexion. Excellent for articulation and the one drill here
  // where doing it badly has a cost, so it stays out of the preset routine and
  // has to be chosen deliberately.
  E('Jefferson Curl', 'Back', 'bodyweight', 'mobility', 'advanced'),
  E('Shoulder CARs', 'Shoulders', 'bodyweight', 'mobility', 'beginner'),
  E('Scapular Push-Up', 'Shoulders', 'bodyweight', 'mobility', 'beginner'),
  E('Wall Slides', 'Shoulders', 'bodyweight', 'mobility', 'beginner'),
  E('Bird Dog', 'Core', 'bodyweight', 'mobility', 'beginner'),
]
