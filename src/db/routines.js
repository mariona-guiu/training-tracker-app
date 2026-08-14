import { getDB, newId, fromFlag } from './client.js'
import { DEFAULT_ROUTINES } from '../data/defaultRoutines.js'

// Brings the pre-built routines up to date on every start: adds any that are
// missing and refreshes the ones that exist, so changing a preset reaches
// installs that already have it. Anything the user made is never touched.
//
// Matched on `key`, never on the display name. By name, a user creating
// their own routine called "Upper Body" would quietly stop the real one from
// ever updating again — and only for the people who had used the app long
// enough to make their own.
//
// The name is deliberately left alone once a routine exists, so renaming a
// preset in the seed data never overwrites what a user is used to seeing.
// Everything that decides what the workout *is* — slots, type, difficulty —
// is refreshed.
//
// The web version also adopts routines stored before keys existed, matching
// them by name that once. Nothing here needs that: this database starts
// empty, so there is no pre-slot data for it to find.

const toRow = (row) => ({
  ...row,
  isCustom: fromFlag(row.isCustom),
  slots: JSON.parse(row.slots),
})

export async function seedRoutinesIfEmpty() {
  const db = await getDB()
  const existing = await db.getAllAsync(
    'SELECT * FROM routines WHERE isCustom = 0 AND key IS NOT NULL',
  )
  const byKey = new Map(existing.map((row) => [row.key, row]))

  await db.withTransactionAsync(async () => {
    for (const preset of DEFAULT_ROUTINES) {
      const current = byKey.get(preset.key)
      await db.runAsync(
        `INSERT OR REPLACE INTO routines (id, key, name, type, difficulty, isCustom, slots)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [
          current?.id ?? newId(),
          preset.key,
          current?.name ?? preset.name,
          preset.type,
          preset.difficulty,
          JSON.stringify(preset.slots),
        ],
      )
    }
  })
}

export async function listRoutines() {
  const db = await getDB()
  return (await db.getAllAsync('SELECT * FROM routines')).map(toRow)
}

export async function getRoutine(id) {
  const db = await getDB()
  const row = await db.getFirstAsync('SELECT * FROM routines WHERE id = ?', [id])
  return row ? toRow(row) : undefined
}
