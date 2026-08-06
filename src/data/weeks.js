// Week arithmetic, shared between the Stats page and the chart it draws so
// the two can't disagree about where a week starts.

// How many weeks the chart fits at once. Column width, what counts as
// visible, and how far a snap travels are all measured against it.
export const VISIBLE_WEEKS = 8

export function addDays(ts, days) {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

// Weeks run Monday to Sunday, so which bucket a session lands in doesn't
// depend on the day the page happens to be opened. Date's own day-of-month
// arithmetic (rather than adding 7 × 24h) stays correct across DST, where a
// calendar week isn't 168 hours long.
export function startOfWeek(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Sun=0..Sat=6 -> days since Monday
  return d.getTime()
}

export function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// A week is attributed to the year its Monday falls in, so the week
// straddling New Year belongs to the old one — which is what the chart's
// year label reads when that column is on screen.
export function yearOfWeek(weekStart) {
  return new Date(weekStart).getFullYear()
}

// Every week from the first one trained to the current one, gaps included,
// each carrying its workouts in the order they happened.
//
// The workouts are a plain list, not a slot per weekday: a column has
// gravity, so the first session of the week sits on the baseline and the
// rest stack on top of it. A week trained only on Friday looks exactly like
// a week trained only on Monday, because the column counts workouts.
//
// Short histories are padded backwards with empty weeks so the chart is
// always a full card wide and a column is always the same width —
// otherwise the whole thing changes shape over the first two months of use.
export function buildWeeks(sessions, now = Date.now()) {
  const byWeek = new Map()
  for (const s of sessions) {
    const week = startOfWeek(s.startedAt)
    byWeek.set(week, [...(byWeek.get(week) ?? []), s])
  }

  const thisWeek = startOfWeek(now)
  let firstWeek = thisWeek
  for (const s of sessions) firstWeek = Math.min(firstWeek, startOfWeek(s.startedAt))

  const weeks = []
  for (let ts = firstWeek; ts <= thisWeek; ts = addDays(ts, 7)) {
    const workouts = [...(byWeek.get(ts) ?? [])].sort((a, b) => a.startedAt - b.startedAt)
    weeks.push({ weekStart: ts, workouts })
  }
  while (weeks.length < VISIBLE_WEEKS) {
    weeks.unshift({ weekStart: addDays(weeks[0].weekStart, -7), workouts: [] })
  }
  return weeks
}
