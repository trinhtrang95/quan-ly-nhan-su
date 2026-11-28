import { isOvertimeFormLocked, type OvertimeFormWithItems } from './overtimeFormsService';

export type OvertimeCalendarDateStatus = 'locked' | 'open';

export interface CalendarDayCell {
  isoDate: string;
  day: number;
  inCurrentMonth: boolean;
  isSunday: boolean;
  hasOvertimeForm: boolean;
  formStatus: OvertimeCalendarDateStatus | null;
  isLocked: boolean;
}

export const CALENDAR_WEEKDAY_HEADERS = [
  'T2',
  'T3',
  'T4',
  'T5',
  'T6',
  'T7',
  'CN',
] as const;

export function formatYearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatIsoDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYearMonthKey(
  monthKey: string,
  fallbackIsoDate: string
): { year: number; month: number } {
  const match = (monthKey || '').trim().match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { year, month };
    }
  }

  const fbMatch = (fallbackIsoDate || '').trim().match(/^(\d{4})-(\d{2})/);
  if (fbMatch) {
    return { year: Number(fbMatch[1]), month: Number(fbMatch[2]) };
  }

  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function shiftYearMonth(
  year: number,
  month: number,
  delta: -1 | 1
): { year: number; month: number; monthKey: string } {
  let nextMonth = month + delta;
  let nextYear = year;
  if (nextMonth < 1) {
    nextMonth = 12;
    nextYear -= 1;
  } else if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return {
    year: nextYear,
    month: nextMonth,
    monthKey: formatYearMonthKey(nextYear, nextMonth),
  };
}

/**
 * Collects active overtime form statuses strictly by `form.overtime_date`
 * (ignoring soft-deleted forms and never using `created_at`).
 */
export function collectOvertimeFormStatusByDate(
  forms: OvertimeFormWithItems[]
): Map<string, OvertimeCalendarDateStatus> {
  const map = new Map<string, OvertimeCalendarDateStatus>();
  for (const form of forms || []) {
    if (form.deleted_at) continue;
    const primaryDate = (form.overtime_date || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primaryDate)) continue;
    const locked = isOvertimeFormLocked(form);
    const existing = map.get(primaryDate);
    if (locked || !existing) {
      map.set(primaryDate, locked ? 'locked' : 'open');
    }
  }
  return map;
}

export function collectOvertimeFormDatesSet(
  forms: OvertimeFormWithItems[]
): Set<string> {
  return new Set(collectOvertimeFormStatusByDate(forms).keys());
}

export function buildCalendarYearOptions(
  forms: OvertimeFormWithItems[],
  activeYear: number,
  currentYear: number
): number[] {
  const years = new Set<number>([
    currentYear - 1,
    currentYear,
    currentYear + 1,
    activeYear,
  ]);
  for (const form of forms || []) {
    if (form.deleted_at) continue;
    const primaryYear = Number((form.overtime_date || '').slice(0, 4));
    if (primaryYear >= 2020 && primaryYear <= 2100) {
      years.add(primaryYear);
    }
    if (Array.isArray(form.overtime_dates)) {
      for (const d of form.overtime_dates) {
        const y = Number((d || '').slice(0, 4));
        if (y >= 2020 && y <= 2100) {
          years.add(y);
        }
      }
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Builds a Monday-first (T2..CN) calendar grid for the given year & 1-based month.
 */
export function buildOvertimeMonthCalendarGrid(
  year: number,
  month: number,
  activeFormDatesOrStatus:
    | Set<string>
    | Map<string, OvertimeCalendarDateStatus>
): CalendarDayCell[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  // JS getDay(): 0 = Sun, 1 = Mon ... 6 = Sat -> Mon-based offset (0..6)
  const leadingOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthInfo = shiftYearMonth(year, month, -1);
  const daysInPrevMonth = new Date(
    prevMonthInfo.year,
    prevMonthInfo.month,
    0
  ).getDate();
  const nextMonthInfo = shiftYearMonth(year, month, 1);

  const resolveStatus = (isoDate: string): OvertimeCalendarDateStatus | null => {
    if (activeFormDatesOrStatus instanceof Map) {
      return activeFormDatesOrStatus.get(isoDate) ?? null;
    }
    return activeFormDatesOrStatus.has(isoDate) ? 'open' : null;
  };

  const totalCells = Math.ceil((leadingOffset + daysInMonth) / 7) * 7;
  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < totalCells; i += 1) {
    const colIndex = i % 7;
    const isSunday = colIndex === 6;

    let day = 1;
    let isoDate = '';
    let inCurrentMonth = true;

    if (i < leadingOffset) {
      day = daysInPrevMonth - leadingOffset + i + 1;
      isoDate = formatIsoDateKey(
        prevMonthInfo.year,
        prevMonthInfo.month,
        day
      );
      inCurrentMonth = false;
    } else if (i < leadingOffset + daysInMonth) {
      day = i - leadingOffset + 1;
      isoDate = formatIsoDateKey(year, month, day);
      inCurrentMonth = true;
    } else {
      day = i - (leadingOffset + daysInMonth) + 1;
      isoDate = formatIsoDateKey(
        nextMonthInfo.year,
        nextMonthInfo.month,
        day
      );
      inCurrentMonth = false;
    }

    const formStatus = resolveStatus(isoDate);
    cells.push({
      isoDate,
      day,
      inCurrentMonth,
      isSunday,
      hasOvertimeForm: formStatus !== null,
      formStatus,
      isLocked: formStatus === 'locked',
    });
  }

  return cells;
}
