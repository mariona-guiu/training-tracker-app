import * as SQLite from 'expo-sqlite'
import * as Crypto from 'expo-crypto'

// Every database access in the app goes through this folder, one module per
// table, exactly as it did on the web. Screens never open a database.
//
// Why the tables look half-relational
//
// A session carries a nested list of exercises, each carrying its own list
// of sets, and the screens read it as one object: session.exercises[i].
// sets[j]. Splitting that across three tables would be the textbook answer
// and would mean rewriting every screen to reassemble it. So anything the
// app *queries* is a real column, and the nested part is JSON in a column
// beside it. Sessions are read whole and written whole; nothing needs a set
// on its own.
//
// This keeps the stored object the same shape as the web app's, which is
// what lets the screens port across with their logic intact.
//
// SQLite has no boolean. Flags are INTEGER 0/1 and are converted at this
// boundary, so nothing above here ever sees a 1 where it expects true.

const DB_NAME = 'training-tracker.db'
const SCHEMA_VERSION = 4

let dbPromise

// Numbered, one-way migrations, tracked by SQLite's own user_version. Each
// block runs once, in order, and is never edited afterwards — a phone that
// has been used since the last release only runs the blocks it has missed.
// This is the part IndexedDB made awkward and the reason for the rewrite:
// changing the shape of stored data is now a numbered step rather than one
// upgrade function that has to know every version it might be starting from.
async function migrate(db) {
  const { user_version: current } = await db.getFirstAsync('PRAGMA user_version')
  if (current >= SCHEMA_VERSION) return

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE exercises (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        muscleGroup TEXT NOT NULL,
        equipment TEXT,
        pattern TEXT,
        difficulty TEXT,
        isCustom INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE routines (
        id TEXT PRIMARY KEY NOT NULL,
        key TEXT,
        name TEXT NOT NULL,
        type TEXT,
        difficulty TEXT,
        isCustom INTEGER NOT NULL DEFAULT 0,
        slots TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY NOT NULL,
        routineId TEXT,
        routineName TEXT,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER,
        status TEXT NOT NULL,
        endedEarly INTEGER,
        bodyWeightKg REAL,
        restMode TEXT,
        currentExerciseIndex INTEGER NOT NULL DEFAULT 0,
        exercises TEXT NOT NULL
      );

      CREATE INDEX sessions_by_startedAt ON sessions (startedAt);
      CREATE INDEX sessions_by_status ON sessions (status);

      CREATE TABLE settings (
        id TEXT PRIMARY KEY NOT NULL,
        restEnabled INTEGER,
        restMode TEXT,
        bodyWeightKg REAL
      );
    `)
  }

  if (current < 2) {
    // A session recorded what its routine was *called* but never what kind of
    // session it was. Colour, rest length and the calorie rate are all supposed
    // to follow the kind — and they have worked so far only because every
    // preset's name lowercases to its own type. A routine named "Leg Day" would
    // have broken all three at once.
    //
    // Backfilling from the name is exact rather than a guess: every routine
    // that exists at this point is a preset, and for all of them the name
    // lowercased *is* the type.
    await db.execAsync(`
      ALTER TABLE sessions ADD COLUMN routineType TEXT;
      UPDATE sessions SET routineType = lower(routineName) WHERE routineType IS NULL;
    `)
  }

  if (current < 3) {
    // Seeding refreshes a preset's type, difficulty and slots, but deliberately
    // keeps whatever it is called — so that renaming a routine, when that
    // exists, is not undone on the next launch. Which means the one thing it
    // cannot do is rename one, and that is exactly what this needs.
    //
    // The key stays 'stretching' because a key never changes; everything the
    // routine actually is has.
    await db.execAsync(`
      UPDATE routines SET name = 'Mobility'
      WHERE key = 'stretching' AND isCustom = 0 AND name = 'Stretching';
    `)
  }

  if (current < 4) {
    // Light, dark, or whatever the phone is set to. No backfill and no
    // default written: a null here means the row predates the choice, and
    // getSettings reads that as 'system' — which is also what a fresh install
    // gets, so an existing phone and a new one behave the same.
    await db.execAsync(`ALTER TABLE settings ADD COLUMN themeMode TEXT;`)
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

// One shared connection, opened on first use and migrated before anyone gets
// a handle on it. Callers await this, so no screen can read a table that a
// migration has not reached yet.
export function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME)
      // Foreign keys are off by default in SQLite and this is where that
      // would be decided if the schema ever grows relations.
      await db.execAsync('PRAGMA journal_mode = WAL')
      await migrate(db)
      return db
    })()
  }
  return dbPromise
}

export function newId() {
  return Crypto.randomUUID()
}

// Flags cross this boundary as booleans above and integers below.
export const toFlag = (value) => (value ? 1 : 0)
export const fromFlag = (value) => value === 1

// A flag that is allowed to be unknown. Sessions recorded before endedEarly
// existed have no value for it, and the difference between "not ended early"
// and "we don't know" is one History deliberately shows.
export const fromNullableFlag = (value) =>
  value === null || value === undefined ? undefined : value === 1
