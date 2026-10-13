/**
 * Business-day calendar: timezone-aware, weekends, holidays, inclusive endpoint.
 * Wall-clock time is preserved after advancing eligible local dates.
 */
import { BusinessDayCalendar } from './types';

/**
 * Advance N business days from anchor (inclusive of endpoint).
 * Preserves wall-clock time in the configured timezone.
 *
 * "Inclusive endpoint" means the anchor date itself counts as day 0,
 * and we advance N more eligible days. The deadline is end-of-day N.
 */
export function addBusinessDays(
  anchor: Date,
  days: number,
  calendar: BusinessDayCalendar,
): Date {
  const holidaySet = new Set(calendar.holidays);

  // Work in UTC-offset-aware local dates by formatting in the timezone
  let current = new Date(anchor.getTime());
  let remaining = days;

  while (remaining > 0) {
    // Advance one calendar day
    current = advanceOneCalendarDay(current, calendar.timezone);

    if (!isNonBusinessDay(current, calendar.timezone, calendar.weekendDays, holidaySet)) {
      remaining--;
    }
  }

  return current;
}

/**
 * Advance one calendar day while preserving wall-clock time in the given timezone.
 */
function advanceOneCalendarDay(date: Date, timezone: string): Date {
  // Get local date components
  const parts = getLocalDateParts(date, timezone);

  // Advance local date by 1 day
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, parts.hour, parts.minute, parts.second, parts.ms));

  // Convert back: find UTC time that produces this local time in the timezone
  return fromLocalParts(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth() + 1,
    localDate.getUTCDate(),
    parts.hour,
    parts.minute,
    parts.second,
    parts.ms,
    timezone,
  );
}

function isNonBusinessDay(
  date: Date,
  timezone: string,
  weekendDays: number[],
  holidays: Set<string>,
): boolean {
  const parts = getLocalDateParts(date, timezone);
  const dow = getLocalDayOfWeek(date, timezone);

  if (weekendDays.includes(dow)) return true;

  const isoDate = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  if (holidays.has(isoDate)) return true;

  return false;
}

/**
 * Check if the business-day deadline has elapsed relative to asOf.
 * Returns true if the reporting interval is mature (deadline <= asOf).
 */
export function isIntervalMature(
  screenOccurredAt: Date,
  reportingIntervalDays: number,
  calendar: BusinessDayCalendar,
  asOf: Date,
): boolean {
  const deadline = addBusinessDays(screenOccurredAt, reportingIntervalDays, calendar);
  return asOf >= deadline;
}

/**
 * Check if an assessment's performedAt is within the business-day window.
 * The window is [screenOccurredAt, screenOccurredAt + N business days] inclusive.
 */
export function isWithinBusinessDayWindow(
  screenOccurredAt: Date,
  assessmentPerformedAt: Date,
  reportingIntervalDays: number,
  calendar: BusinessDayCalendar,
): boolean {
  if (assessmentPerformedAt < screenOccurredAt) return false;
  const deadline = addBusinessDays(screenOccurredAt, reportingIntervalDays, calendar);
  return assessmentPerformedAt <= deadline;
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
}

function getLocalDateParts(date: Date, timezone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    fractionalSecondDigits: 3,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '0';

  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10) % 24, // Intl can return 24 for midnight
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    ms: parseInt(get('fractionalSecond'), 10) || 0,
  };
}

function getLocalDayOfWeek(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dow = formatter.format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[dow] ?? 0;
}

/**
 * Given local date/time parts in a timezone, find the UTC Date.
 * Uses binary search on offset to handle DST transitions.
 */
function fromLocalParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timezone: string,
): Date {
  // Estimate: assume UTC first, then adjust
  const estimate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));

  // Get the offset at this estimate
  const localAtEstimate = getLocalDateParts(estimate, timezone);
  const estimateLocalMs = Date.UTC(localAtEstimate.year, localAtEstimate.month - 1, localAtEstimate.day, localAtEstimate.hour, localAtEstimate.minute, localAtEstimate.second, localAtEstimate.ms);
  const targetLocalMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const offsetMs = estimateLocalMs - estimate.getTime();

  const result = new Date(targetLocalMs - offsetMs);

  // Verify and adjust if DST transition shifted things
  const verify = getLocalDateParts(result, timezone);
  if (verify.hour !== hour || verify.day !== day) {
    const verifyLocalMs = Date.UTC(verify.year, verify.month - 1, verify.day, verify.hour, verify.minute, verify.second, verify.ms);
    const offset2 = verifyLocalMs - result.getTime();
    return new Date(targetLocalMs - offset2);
  }

  return result;
}

export { getLocalDateParts, getLocalDayOfWeek };
