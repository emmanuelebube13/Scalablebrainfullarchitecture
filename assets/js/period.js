/* ============================================================
   period.js — the one place that knows what a `period` string
   means. `goals[].period` and `tasks[].period` carry three
   shapes: `2026-09` (month), `2026-W36` (ISO week) and
   `2026-Q3` (quarter). Everything that filters by time reads
   them through here, so the calendar and the cards can never
   disagree about which week a task belongs to.

   All arithmetic is UTC. A period is a closed interval of whole
   days, returned as [startMs, endMs].
   ============================================================ */

const DAY = 86400000;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
/* Monday-first, matching ISO 8601 — the week numbering the data uses. */
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday of the ISO week containing `ms`. */
function isoMonday(ms) {
  const d = new Date(ms);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
}

/** `2026-W36` for the ISO week containing `ms`. */
export function isoWeekKey(ms) {
  // The ISO year is the year of that week's Thursday, which is why this cannot
  // just read getUTCFullYear() off the date itself around New Year.
  const thursday = isoMonday(ms) + 3 * DAY;
  const isoYear = new Date(thursday).getUTCFullYear();
  const week = Math.round((thursday - isoWeek1Monday(isoYear)) / (7 * DAY)) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Monday of ISO week 1 — the week containing 4 January. */
function isoWeek1Monday(isoYear) {
  return isoMonday(Date.UTC(isoYear, 0, 4));
}

/**
 * [startMs, endMs] for a period string, or null if it is not a shape we know.
 * Null is deliberate: an unparseable period must be visible as "no date", never
 * silently bucketed into today.
 */
export function periodRange(period) {
  if (typeof period !== 'string') return null;
  let m;

  if ((m = /^(\d{4})-(\d{2})$/.exec(period))) {
    const [y, mo] = [+m[1], +m[2]];
    if (mo < 1 || mo > 12) return null;
    return [Date.UTC(y, mo - 1, 1), Date.UTC(y, mo, 0)];
  }

  if ((m = /^(\d{4})-W(\d{1,2})$/i.exec(period))) {
    const [y, w] = [+m[1], +m[2]];
    if (w < 1 || w > 53) return null;
    const start = isoWeek1Monday(y) + (w - 1) * 7 * DAY;
    return [start, start + 6 * DAY];
  }

  if ((m = /^(\d{4})-Q([1-4])$/i.exec(period))) {
    const [y, q] = [+m[1], +m[2]];
    return [Date.UTC(y, (q - 1) * 3, 1), Date.UTC(y, q * 3, 0)];
  }

  return null;
}

/** Do two closed intervals share at least one day? */
export const overlaps = (a, b) => !!a && !!b && a[0] <= b[1] && b[0] <= a[1];

/** `2026-09` for the month containing `ms`. */
export function monthKey(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key) {
  const [y, mo] = key.split('-').map(Number);
  return `${MONTH_SHORT[mo - 1]} ${y}`;
}

/** Every month key a period touches — a week in the last days of a month touches two. */
export function monthsSpanned(period) {
  const r = periodRange(period);
  if (!r) return [];
  const out = [];
  let cursor = Date.UTC(new Date(r[0]).getUTCFullYear(), new Date(r[0]).getUTCMonth(), 1);
  while (cursor <= r[1]) {
    out.push(monthKey(cursor));
    const d = new Date(cursor);
    cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return out;
}

/**
 * The weeks of a calendar month, as rows of seven UTC day-stamps starting on
 * Monday. Leading and trailing days belong to the neighbouring months and are
 * flagged so the grid can dim them.
 */
export function monthWeeks(key) {
  const [y, mo] = key.split('-').map(Number);
  const first = Date.UTC(y, mo - 1, 1);
  const last = Date.UTC(y, mo, 0);
  const rows = [];
  for (let cursor = isoMonday(first); cursor <= last; cursor += 7 * DAY) {
    rows.push({
      week: isoWeekKey(cursor),
      start: cursor,
      end: cursor + 6 * DAY,
      days: Array.from({ length: 7 }, (_, i) => {
        const ms = cursor + i * DAY;
        return { ms, day: new Date(ms).getUTCDate(), inMonth: ms >= first && ms <= last };
      }),
    });
  }
  return rows;
}

/** `2026-W36` -> `W36`, for a compact row label. */
export const weekLabel = (weekKey) => weekKey.slice(weekKey.indexOf('W'));
