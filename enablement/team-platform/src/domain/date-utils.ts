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

/**
 * Today's calendar date as YYYY-MM-DD. Exported (as of EPIC-0004) so callers that need "today"
 * as a value — not just a comparison — don't compute it independently via `new Date()`, which
 * would be exactly the kind of duplicated date logic this module exists to prevent. This is the
 * same internal computation `isInFuture`/`isToday`/`includesToday` already used privately; only
 * its visibility changed, not its logic.
 */
export function today(): string {
  return todayAsIsoDate();
}

/**
 * `date` (YYYY-MM-DD) shifted by `days` calendar days (negative to go backward). Pure date
 * arithmetic, not comparison — added here (rather than duplicated locally by each caller that
 * needs to generate a range of dates) for the same centralization reason `today()` is exported.
 */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(year, month - 1, day + days);
  const shiftedYear = shifted.getFullYear();
  const shiftedMonth = String(shifted.getMonth() + 1).padStart(2, "0");
  const shiftedDay = String(shifted.getDate()).padStart(2, "0");
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
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
