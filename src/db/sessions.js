import { getDB, newId, toFlag, fromNullableFlag } from './client.js'
import { resolveSlots } from '../data/resolveSlots.js'

// A session is one actual run-through of a routine:
// { id, routineId, routineName, startedAt, endedAt, status: 'in-progress' | 'completed',
//   endedEarly, bodyWeightKg, restMode, currentExerciseIndex, exercises: [ { exerciseId,
//   exerciseName, targetSets, targetReps, targetWeight, tracksWeight, skipped,
//   sets: [ { done, reps, weight, completedAt } ] } ] }
//
// `status` marks whether a session is still running; `endedEarly` records how
// it stopped — walked out partway, or seen through to the end. Both finished
// states stay 'completed' so history lists them together, and sessions
// recorded before this existed simply have no `endedEarly`.
//
// The exercises are stored as JSON in one column. They are always read and
// written as a whole session and nothing queries an individual set, so the
// nesting the screens expect survives the trip to the database unchanged.

const toRow = (row) =>
  row && {
    ...row,
    endedEarly: fromNullableFlag(row.endedEarly),
    exercises: JSON.parse(row.exercises),
  }

// What was actually lifted last time, so today starts from there. Searched by
// exercise rather than by routine — the same movement in a different routine
// is still the same movement, and the same body.
function lastLoggedSet(sessionsNewestFirst, exerciseId) {
  for (const session of sessionsNewestFirst) {
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId)
    const logged = exercise?.sets.filter((set) => set.done)
    if (logged?.length) return logged[logged.length - 1]
  }
  return null
}

export async function startSession(routine) {
  const db = await getDB()
  const previous = (await db.getAllAsync('SELECT * FROM sessions ORDER BY startedAt DESC')).map(toRow)
  const library = (await db.getAllAsync('SELECT * FROM exercises')).map((row) => ({ ...row }))

  // The routine describes jobs; this is where they become exercises. What
  // comes back is copied onto the session below, so the session stays a
  // record of what was actually done — rotating a routine or editing it later
  // can never reach back and change it.
  const resolved = resolveSlots(routine, library)

  const session = {
    id: newId(),
    routineId: routine.id,
    routineName: routine.name,
    startedAt: Date.now(),
    endedAt: null,
    status: 'in-progress',
    currentExerciseIndex: 0,
    exercises: resolved.map((ex) => {
      // Carried forward from what was performed, not from what was merely
      // typed in: a weight you set but never lifted isn't where you're
      // starting from. Falls back to the routine's own target.
      const last = lastLoggedSet(previous, ex.exerciseId)
      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        targetSets: ex.targetSets,
        targetReps: last?.reps ?? ex.targetReps,
        targetWeight: last?.weight ?? null,
        tracksWeight: ex.tracksWeight,
        skipped: false,
        sets: Array.from({ length: ex.targetSets }, () => ({ done: false })),
      }
    }),
  }

  await db.runAsync(
    `INSERT INTO sessions
       (id, routineId, routineName, startedAt, endedAt, status, endedEarly,
        bodyWeightKg, restMode, currentExerciseIndex, exercises)
     VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, NULL, ?, ?)`,
    [
      session.id,
      session.routineId,
      session.routineName,
      session.startedAt,
      session.status,
      session.currentExerciseIndex,
      JSON.stringify(session.exercises),
    ],
  )
  return session
}

export async function getActiveSession() {
  const db = await getDB()
  const row = await db.getFirstAsync("SELECT * FROM sessions WHERE status = 'in-progress'")
  return toRow(row) ?? null
}

export async function getSession(id) {
  const db = await getDB()
  return toRow(await db.getFirstAsync('SELECT * FROM sessions WHERE id = ?', [id]))
}

export async function saveSession(session) {
  const db = await getDB()
  await db.runAsync(
    `INSERT OR REPLACE INTO sessions
       (id, routineId, routineName, startedAt, endedAt, status, endedEarly,
        bodyWeightKg, restMode, currentExerciseIndex, exercises)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.routineId ?? null,
      session.routineName ?? null,
      session.startedAt,
      session.endedAt ?? null,
      session.status,
      session.endedEarly === undefined ? null : toFlag(session.endedEarly),
      session.bodyWeightKg ?? null,
      session.restMode ?? null,
      session.currentExerciseIndex ?? 0,
      JSON.stringify(session.exercises),
    ],
  )
  return session
}

// The body weight and rest setting in force are written onto the session, not
// read back from settings later: what a workout cost depends on the person
// who did it that day, and both of those change. Sessions recorded before
// this existed simply carry neither, and show no estimate.
export async function endSession(id, { endedEarly, bodyWeightKg, restMode }) {
  const db = await getDB()
  const session = await getSession(id)
  return saveSession({
    ...session,
    status: 'completed',
    endedAt: Date.now(),
    endedEarly,
    bodyWeightKg: bodyWeightKg ?? null,
    restMode: restMode ?? null,
  })
}

export async function deleteSession(id) {
  const db = await getDB()
  await db.runAsync('DELETE FROM sessions WHERE id = ?', [id])
}

export async function listCompletedSessions() {
  const db = await getDB()
  const rows = await db.getAllAsync(
    "SELECT * FROM sessions WHERE status = 'completed' ORDER BY startedAt DESC",
  )
  return rows.map(toRow)
}
