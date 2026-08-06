import { getDB, newId, fromFlag, toFlag } from './client.js'
import { DEFAULT_EXERCISES } from '../data/defaultExercises.js'

// The exercise library. Despite the name this runs on every start and adds
// only what is missing, so new default exercises reach installs that already
// exist and nothing the user added is ever touched.
//
// Missing is decided by name, because names are what everything else refers
// to: a routine's slot names the exercise it was written around. That is now
// a UNIQUE constraint rather than a convention, so INSERT OR IGNORE does the
// whole job and seeding twice is impossible by construction.
//
// Unlike the web version, this stores equipment, pattern and difficulty.
// That version dropped them on the way in, which left candidatesFor() —
// filtering on exactly those fields — with nothing to match. It has not bitten
// yet only because slots still resolve to their primary by name.

const toRow = (row) => ({ ...row, isCustom: fromFlag(row.isCustom) })

export async function seedExercisesIfEmpty() {
  const db = await getDB()
  const now = Date.now()

  await db.withTransactionAsync(async () => {
    for (const exercise of DEFAULT_EXERCISES) {
      await db.runAsync(
        `INSERT OR IGNORE INTO exercises
           (id, name, muscleGroup, equipment, pattern, difficulty, isCustom, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          newId(),
          exercise.name,
          exercise.muscleGroup,
          exercise.equipment ?? null,
          exercise.pattern ?? null,
          exercise.difficulty ?? null,
          now,
        ],
      )
    }
  })
}

export async function listExercises() {
  const db = await getDB()
  return (await db.getAllAsync('SELECT * FROM exercises')).map(toRow)
}

export async function addExercise({ name, muscleGroup }) {
  const db = await getDB()
  const exercise = {
    id: newId(),
    name: name.trim(),
    muscleGroup,
    equipment: null,
    pattern: null,
    difficulty: null,
    isCustom: true,
    createdAt: Date.now(),
  }
  await db.runAsync(
    `INSERT INTO exercises
       (id, name, muscleGroup, equipment, pattern, difficulty, isCustom, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exercise.id,
      exercise.name,
      exercise.muscleGroup,
      exercise.equipment,
      exercise.pattern,
      exercise.difficulty,
      toFlag(exercise.isCustom),
      exercise.createdAt,
    ],
  )
  return exercise
}

export async function deleteExercise(id) {
  const db = await getDB()
  await db.runAsync('DELETE FROM exercises WHERE id = ?', [id])
}
