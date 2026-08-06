import { getDB, toFlag, fromFlag } from './client.js'

// Everything the user has chosen about how the app behaves, kept as a single
// row rather than a row per preference: there will only ever be a handful,
// they are always read together, and one record means no partial state to
// reconcile.
//
// { id, restEnabled, restMode, bodyWeightKg }
const ID = 'app'

// Matches the shipped behaviour, so someone who never opens this screen gets
// what they had before it existed.
const DEFAULTS = {
  id: ID,
  // On by default: resting between sets is the behaviour the app shipped
  // with, and the people who don't want it know they don't want it.
  restEnabled: true,
  restMode: 'balanced',
  // Null rather than a number: there is no sensible default body weight, and
  // guessing one would quietly make a calorie estimate about someone who
  // isn't the user.
  bodyWeightKg: null,
}

export async function getSettings() {
  const db = await getDB()
  const row = await db.getFirstAsync('SELECT * FROM settings WHERE id = ?', [ID])
  if (!row) return { ...DEFAULTS }
  return {
    ...DEFAULTS,
    ...row,
    restEnabled: row.restEnabled === null ? DEFAULTS.restEnabled : fromFlag(row.restEnabled),
  }
}

export async function saveSettings(changes) {
  const db = await getDB()
  const next = { ...(await getSettings()), ...changes, id: ID }
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (id, restEnabled, restMode, bodyWeightKg)
     VALUES (?, ?, ?, ?)`,
    [ID, toFlag(next.restEnabled), next.restMode, next.bodyWeightKg],
  )
  return next
}
