/**
 * The SOLE source of "today" and "overlap" logic in this codebase (SDP NFR-0009). Every rule
 * that needs to know whether a date is in the future, or whether two date ranges overlap, MUST
 * call these functions rather than comparing date strings inline. Calendar-day granularity,
 * local system clock — no timezone conversion, no sub-day/time-of-day comparison.
 */

export interface DateRange {
  start: string;
  end: string;
}

function todayAsIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True if `date` (YYYY-MM-DD) is strictly after today's calendar date. */
export function isInFuture(date: string): boolean {
  return date > todayAsIsoDate();
}

/** True if `date` (YYYY-MM-DD) is today's calendar date. */
export function isToday(date: string): boolean {
  return date === todayAsIsoDate();
}

/**
 * True if `range` (inclusive on both ends) includes today's calendar date — i.e., the range
 * represents something "current" as of now.
 */
export function includesToday(range: DateRange): boolean {
  const today = todayAsIsoDate();
  return range.start <= today && today <= range.end;
}

/**
 * True if rangeA and rangeB share at least one calendar day (inclusive on both ends) — the
 * standard interval-overlap test, per FR-0014's "inclusive overlap on any shared day" rule.
 */
export function rangesOverlap(rangeA: DateRange, rangeB: DateRange): boolean {
  return rangeA.start <= rangeB.end && rangeB.start <= rangeA.end;
}
