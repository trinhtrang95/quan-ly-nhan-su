export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type WeekdayWorkMode = 'full_day' | 'morning' | 'biweekly' | 'off';

export interface DayTimeOverride {
  startTime?: string;
  endTime?: string;
  breakStart?: string;
  breakEnd?: string;
}

export type WorkingDaysMap = Record<WeekdayKey, WeekdayWorkMode>;
export type DayOverridesMap = Partial<Record<WeekdayKey, DayTimeOverride>>;

export interface WorkShift {
  id: string;
  companyId?: string | null;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  workingDays: WorkingDaysMap;
  dayOverrides: DayOverridesMap;
  earlyMinutes: number;
  color: string;
  hourlyRatePercent: number;
  standardDailyHours: number;
  weeklyHours: number;
  isDefault: boolean;
  departmentNames: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type HolidayType =
  | 'holiday'
  | 'compensatory'
  | 'swap_off'
  | 'makeup_work'
  | 'morning_work';

export interface CompanyHoliday {
  id: string;
  companyId?: string | null;
  year: number;
  holidayDate: string; // YYYY-MM-DD
  name: string;
  holidayType: HolidayType;
  isManual: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type TetPlanOption = '1+4' | '2+3' | '3+2';
export type NationalDayPlanOption = '09-01_09-02' | '09-02_09-03';

export interface HolidayGenerationPlan {
  year: number;
  tetPlan: TetPlanOption;
  nationalDayPlan: NationalDayPlanOption;
  includeCultureDay: boolean;
}

export type CalendarDayCategory =
  | 'holiday'
  | 'compensatory_swap'
  | 'makeup_work'
  | 'weekly_off'
  | 'morning_work'
  | 'working';

export interface CalendarDayInfo {
  isoDate: string;
  dayOfMonth: number;
  weekdayKey: WeekdayKey;
  category: CalendarDayCategory;
  label: string;
  holidays: CompanyHoliday[];
}

export const WEEKDAY_ORDER: Array<{
  key: WeekdayKey;
  shortLabel: string;
  fullLabel: string;
  jsDay: number; // 0 = Sun, 1 = Mon ... 6 = Sat
}> = [
  { key: 'mon', shortLabel: 'T2', fullLabel: 'Thứ Hai', jsDay: 1 },
  { key: 'tue', shortLabel: 'T3', fullLabel: 'Thứ Ba', jsDay: 2 },
  { key: 'wed', shortLabel: 'T4', fullLabel: 'Thứ Tư', jsDay: 3 },
  { key: 'thu', shortLabel: 'T5', fullLabel: 'Thứ Năm', jsDay: 4 },
  { key: 'fri', shortLabel: 'T6', fullLabel: 'Thứ Sáu', jsDay: 5 },
  { key: 'sat', shortLabel: 'T7', fullLabel: 'Thứ Bảy', jsDay: 6 },
  { key: 'sun', shortLabel: 'CN', fullLabel: 'Chủ Nhật', jsDay: 0 },
];

export const WEEKDAY_MODE_CYCLE: WeekdayWorkMode[] = [
  'full_day',
  'morning',
  'biweekly',
  'off',
];

export const WEEKDAY_MODE_LABELS: Record<WeekdayWorkMode, string> = {
  full_day: 'Cả ngày',
  morning: 'Buổi sáng',
  biweekly: 'Cách tuần',
  off: 'Nghỉ',
};

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  holiday: 'Nghỉ lễ, tết',
  compensatory: 'Nghỉ bù',
  swap_off: 'Nghỉ hoán đổi',
  makeup_work: 'Làm bù',
  morning_work: 'Làm buổi sáng',
};

export const SHIFT_COLOR_OPTIONS = [
  '#14539E',
  '#0D9488',
  '#2563EB',
  '#7C3AED',
  '#D97706',
  '#DC2626',
  '#059669',
  '#475569',
];

export const DEFAULT_WORKING_DAYS: WorkingDaysMap = {
  mon: 'full_day',
  tue: 'full_day',
  wed: 'full_day',
  thu: 'full_day',
  fri: 'full_day',
  sat: 'off',
  sun: 'off',
};

export function createDefaultAdminShift(companyId?: string | null): WorkShift {
  const shiftBase: Omit<WorkShift, 'standardDailyHours' | 'weeklyHours'> = {
    id: 'HC',
    companyId: companyId || null,
    code: 'HC',
    name: 'Ca hành chính',
    startTime: '08:00',
    endTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    workingDays: { ...DEFAULT_WORKING_DAYS },
    dayOverrides: {},
    earlyMinutes: 0,
    color: '#14539E',
    hourlyRatePercent: 100,
    isDefault: true,
    departmentNames: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const metrics = calculateShiftMetrics(shiftBase);
  return {
    ...shiftBase,
    ...metrics,
  };
}

/**
 * Cycles through the 4 weekday work modes:
 * Cả ngày -> Buổi sáng -> Cách tuần -> Nghỉ -> Cả ngày
 */
export function getNextWeekdayMode(current: WeekdayWorkMode): WeekdayWorkMode {
  const idx = WEEKDAY_MODE_CYCLE.indexOf(current);
  if (idx === -1) return 'full_day';
  return WEEKDAY_MODE_CYCLE[(idx + 1) % WEEKDAY_MODE_CYCLE.length];
}

export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
}

/**
 * Computes net working hours for a time range (supports overnight shifts where end <= start).
 */
export function calculateNetShiftHours(
  startTime?: string | null,
  endTime?: string | null,
  breakStart?: string | null,
  breakEnd?: string | null
): number {
  const s = parseTimeToMinutes(startTime);
  const e = parseTimeToMinutes(endTime);
  if (s === null || e === null) return 0;

  const spanMinutes = e > s ? e - s : 24 * 60 - s + e;
  if (spanMinutes <= 0) return 0;

  let breakMinutes = 0;
  const bs = parseTimeToMinutes(breakStart);
  const be = parseTimeToMinutes(breakEnd);
  if (bs !== null && be !== null) {
    const rawBreak = be > bs ? be - bs : 24 * 60 - bs + be;
    // Only subtract break if break duration is positive and smaller than total shift span
    if (rawBreak > 0 && rawBreak < spanMinutes) {
      // Check break falls inside shift window (normalized relative to s)
      const relBs = bs >= s ? bs - s : 24 * 60 - s + bs;
      const relBe = relBs + rawBreak;
      if (relBs >= 0 && relBe <= spanMinutes) {
        breakMinutes = rawBreak;
      }
    }
  }

  return Number(((spanMinutes - breakMinutes) / 60).toFixed(2));
}

/**
 * Computes standard daily hours (from general shift hours) and total weekly hours
 * (accounting for per-day overrides, morning-only days, and biweekly days).
 */
export function calculateShiftMetrics(shift: {
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  workingDays: WorkingDaysMap;
  dayOverrides?: DayOverridesMap;
}): {
  standardDailyHours: number;
  weeklyHours: number;
} {
  const standardDailyHours = calculateNetShiftHours(
    shift.startTime,
    shift.endTime,
    shift.breakStart,
    shift.breakEnd
  );

  let weeklyTotal = 0;

  for (const { key } of WEEKDAY_ORDER) {
    const mode = shift.workingDays?.[key] ?? 'off';
    if (mode === 'off') continue;

    const override = shift.dayOverrides?.[key];
    const hasCustomStartEnd =
      Boolean(override?.startTime?.trim()) && Boolean(override?.endTime?.trim());

    let dayHours: number;
    if (hasCustomStartEnd) {
      dayHours = calculateNetShiftHours(
        override?.startTime,
        override?.endTime,
        override?.breakStart !== undefined ? override.breakStart : shift.breakStart,
        override?.breakEnd !== undefined ? override.breakEnd : shift.breakEnd
      );
    } else if (
      override?.breakStart !== undefined ||
      override?.breakEnd !== undefined
    ) {
      dayHours = calculateNetShiftHours(
        shift.startTime,
        shift.endTime,
        override?.breakStart ?? shift.breakStart,
        override?.breakEnd ?? shift.breakEnd
      );
    } else if (mode === 'morning') {
      // If breakStart exists and falls inside the morning boundary, use start -> breakStart; otherwise 50% of standard daily hours
      const morningOnlyHours = calculateNetShiftHours(
        shift.startTime,
        shift.breakStart,
        null,
        null
      );
      dayHours =
        morningOnlyHours > 0 && morningOnlyHours < standardDailyHours
          ? morningOnlyHours
          : Number((standardDailyHours * 0.5).toFixed(2));
    } else {
      dayHours = standardDailyHours;
    }

    if (mode === 'biweekly') {
      weeklyTotal += dayHours * 0.5;
    } else {
      weeklyTotal += dayHours;
    }
  }

  return {
    standardDailyHours,
    weeklyHours: Number(weeklyTotal.toFixed(2)),
  };
}

// ============================================================================
// Vietnamese Lunar Calendar Calculation (Ho Ngoc Duc algorithm, UTC+7)
// ============================================================================

const PI = Math.PI;
const VN_TIMEZONE = 7;

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  if (jd < 2299161) {
    jd =
      dd +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      32083;
  }
  return jd;
}

function jdToDate(jd: number): { day: number; month: number; year: number } {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return { day, month, year };
}

function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 =
    2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr =
    306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) +
    0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 =
    C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 =
    C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 =
    C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 +
        0.000839 * T +
        0.0002261 * T2 -
        0.00000845 * T3 -
        0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

function getNewMoonDay(k: number, timeZone: number): number {
  return Math.floor(newMoon(k) + 0.5 + timeZone / 24);
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL =
    DL +
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - PI * 2 * Math.floor(L / (PI * 2));
  return L;
}

function getSunLongitude(dayNumber: number, timeZone: number): number {
  return Math.floor((sunLongitude(dayNumber - 0.5 - timeZone / 24) / PI) * 6);
}

function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/**
 * Converts a Vietnamese Lunar Date (day, month, year) to ISO Solar Date (YYYY-MM-DD).
 */
export function convertLunarToSolarIso(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  lunarLeap = 0
): string {
  let a11: number;
  let b11: number;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, VN_TIMEZONE);
    b11 = getLunarMonth11(lunarYear, VN_TIMEZONE);
  } else {
    a11 = getLunarMonth11(lunarYear, VN_TIMEZONE);
    b11 = getLunarMonth11(lunarYear + 1, VN_TIMEZONE);
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) {
    off += 12;
  }
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, VN_TIMEZONE);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) {
      leapMonth += 12;
    }
    if (lunarLeap !== 0 && lunarMonth !== leapMonth) {
      return '';
    } else if (lunarLeap !== 0 || off >= leapOff) {
      off += 1;
    }
  }
  const monthStart = getNewMoonDay(k + off, VN_TIMEZONE);
  const solar = jdToDate(monthStart + lunarDay - 1);
  return formatIsoDateParts(solar.year, solar.month, solar.day);
}

export function formatIsoDateParts(
  year: number,
  month: number,
  day: number
): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDaysToIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return formatIsoDateParts(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate()
  );
}

export function getWeekdayKeyFromIsoDate(isoDate: string): WeekdayKey {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const jsDay = dt.getUTCDay();
  const found = WEEKDAY_ORDER.find((item) => item.jsDay === jsDay);
  return found ? found.key : 'mon';
}

export function getVietnameseWeekdayName(isoDate: string): string {
  const key = getWeekdayKeyFromIsoDate(isoDate);
  return WEEKDAY_ORDER.find((w) => w.key === key)?.fullLabel || 'Thứ Hai';
}

export function formatIsoToDDMM(isoDate: string): string {
  const match = (isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}`;
}

export function formatIsoToDDMMYYYY(isoDate: string): string {
  const match = (isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function getLunarHolidayAnchorsForYear(year: number): {
  tetFirstDayIso: string;
  hungKingsIso: string;
} {
  return {
    tetFirstDayIso: convertLunarToSolarIso(1, 1, year, 0),
    hungKingsIso: convertLunarToSolarIso(10, 3, year, 0),
  };
}

/**
 * Determines whether a date is a weekly rest day on the given shift.
 */
export function isWeeklyRestDayOnShift(
  isoDate: string,
  shift: WorkShift
): boolean {
  const key = getWeekdayKeyFromIsoDate(isoDate);
  const mode = shift.workingDays?.[key] ?? 'off';
  return mode === 'off';
}

/**
 * Generates statutory Vietnamese holidays for a year according to the selected plan,
 * automatically adds compensatory days off (`Nghỉ bù`) per Labor Code Art. 112 Clause 3
 * when any statutory holiday falls on a weekly rest day of `defaultShift`,
 * and preserves all existing manual entries (`isManual === true`) for that year.
 */
export function generateCompanyHolidaysForYear(
  plan: HolidayGenerationPlan,
  defaultShift: WorkShift,
  existingHolidaysForYear: CompanyHoliday[],
  companyId?: string | null
): CompanyHoliday[] {
  const { year, tetPlan, nationalDayPlan, includeCultureDay } = plan;

  const manualEntries = existingHolidaysForYear.filter(
    (h) => h.year === year && h.isManual
  );

  const rawStatutory: Array<{
    holidayDate: string;
    name: string;
    holidayType: HolidayType;
  }> = [];

  // 1. Tết Dương lịch (01/01)
  rawStatutory.push({
    holidayDate: formatIsoDateParts(year, 1, 1),
    name: 'Tết Dương lịch',
    holidayType: 'holiday',
  });

  // 2. Tết Nguyên đán (5 ngày)
  const { tetFirstDayIso, hungKingsIso } = getLunarHolidayAnchorsForYear(year);
  const preTetDays = tetPlan === '3+2' ? 3 : tetPlan === '2+3' ? 2 : 1;
  const tetDayNamesFromOffset = (offset: number): string => {
    if (offset < 0) return `Nghỉ Tết Nguyên đán (${Math.abs(offset)} ngày trước Tết)`;
    if (offset === 0) return 'Mùng 1 Tết Nguyên đán';
    return `Mùng ${offset + 1} Tết Nguyên đán`;
  };
  for (let i = 0; i < 5; i++) {
    const offset = i - preTetDays;
    rawStatutory.push({
      holidayDate: addDaysToIsoDate(tetFirstDayIso, offset),
      name: tetDayNamesFromOffset(offset),
      holidayType: 'holiday',
    });
  }

  // 3. Giỗ Tổ Hùng Vương (10/3 Âm lịch)
  if (hungKingsIso && hungKingsIso.startsWith(String(year))) {
    rawStatutory.push({
      holidayDate: hungKingsIso,
      name: 'Giỗ Tổ Hùng Vương (10/3 ÂL)',
      holidayType: 'holiday',
    });
  }

  // 4. Ngày Chiến thắng 30/4 & Quốc tế Lao động 1/5
  rawStatutory.push({
    holidayDate: formatIsoDateParts(year, 4, 30),
    name: 'Ngày Giải phóng miền Nam (30/4)',
    holidayType: 'holiday',
  });
  rawStatutory.push({
    holidayDate: formatIsoDateParts(year, 5, 1),
    name: 'Ngày Quốc tế Lao động (1/5)',
    holidayType: 'holiday',
  });

  // 5. Ngày Quốc khánh (2 ngày)
  if (nationalDayPlan === '09-02_09-03') {
    rawStatutory.push({
      holidayDate: formatIsoDateParts(year, 9, 2),
      name: 'Ngày Quốc khánh (2/9)',
      holidayType: 'holiday',
    });
    rawStatutory.push({
      holidayDate: formatIsoDateParts(year, 9, 3),
      name: 'Nghỉ lễ Quốc khánh (3/9)',
      holidayType: 'holiday',
    });
  } else {
    rawStatutory.push({
      holidayDate: formatIsoDateParts(year, 9, 1),
      name: 'Nghỉ lễ Quốc khánh (1/9)',
      holidayType: 'holiday',
    });
    rawStatutory.push({
      holidayDate: formatIsoDateParts(year, 9, 2),
      name: 'Ngày Quốc khánh (2/9)',
      holidayType: 'holiday',
    });
  }

  // 6. Optional: Ngày Văn hóa Việt Nam 24/11
  if (includeCultureDay) {
    rawStatutory.push({
      holidayDate: formatIsoDateParts(year, 11, 24),
      name: 'Ngày Văn hóa Việt Nam (24/11)',
      holidayType: 'holiday',
    });
  }

  rawStatutory.sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));

  // Track occupied non-working dates (statutory holidays + manual off/holiday entries)
  const occupiedDates = new Set<string>(
    rawStatutory.map((item) => item.holidayDate)
  );
  for (const m of manualEntries) {
    if (m.holidayType !== 'makeup_work' && m.holidayType !== 'morning_work') {
      occupiedDates.add(m.holidayDate);
    }
  }

  const generatedEntries: CompanyHoliday[] = [];
  const makeAutoId = (date: string, kind: string, index: number) =>
    `auto-${year}-${date}-${kind}-${index}`;

  rawStatutory.forEach((item, idx) => {
    generatedEntries.push({
      id: makeAutoId(item.holidayDate, 'holiday', idx),
      companyId: companyId || null,
      year,
      holidayDate: item.holidayDate,
      name: item.name,
      holidayType: 'holiday',
      isManual: false,
    });
  });

  // Compute compensatory days off for each statutory holiday falling on Default Shift weekly rest day
  let compIdx = 0;
  for (const item of rawStatutory) {
    if (!isWeeklyRestDayOnShift(item.holidayDate, defaultShift)) {
      continue;
    }

    // Find next working day that is neither a weekly rest day nor already occupied by another holiday/comp day
    let candidate = addDaysToIsoDate(item.holidayDate, 1);
    let guard = 0;
    while (guard < 30) {
      const isWeeklyRest = isWeeklyRestDayOnShift(candidate, defaultShift);
      const hasManualMakeup = manualEntries.some(
        (m) => m.holidayDate === candidate && m.holidayType === 'makeup_work'
      );
      if ((!isWeeklyRest || hasManualMakeup) && !occupiedDates.has(candidate)) {
        break;
      }
      candidate = addDaysToIsoDate(candidate, 1);
      guard++;
    }

    occupiedDates.add(candidate);
    const compYear = Number(candidate.slice(0, 4)) || year;
    generatedEntries.push({
      id: makeAutoId(candidate, 'comp', compIdx++),
      companyId: companyId || null,
      year: compYear,
      holidayDate: candidate,
      name: `Nghỉ bù: ${item.name}`,
      holidayType: 'compensatory',
      isManual: false,
    });
  }

  const combined = [...generatedEntries, ...manualEntries];
  combined.sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
  return combined;
}

/**
 * ISO week parity helper for biweekly ('Cách tuần') weekday rendering on the 12-month calendar.
 */
function getIsoWeekNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Builds day metadata for a single month (1..12) of `year` combining `defaultShift` and `holidays`.
 */
export function buildMonthCalendarDays(
  year: number,
  month: number, // 1..12
  defaultShift: WorkShift,
  holidays: CompanyHoliday[]
): CalendarDayInfo[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const byDate = new Map<string, CompanyHoliday[]>();
  for (const h of holidays) {
    if (!h.holidayDate) continue;
    const list = byDate.get(h.holidayDate) || [];
    list.push(h);
    byDate.set(h.holidayDate, list);
  }

  const result: CalendarDayInfo[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const isoDate = formatIsoDateParts(year, month, day);
    const weekdayKey = getWeekdayKeyFromIsoDate(isoDate);
    const dayHolidays = byDate.get(isoDate) || [];
    const shiftMode = defaultShift.workingDays?.[weekdayKey] ?? 'off';

    let category: CalendarDayCategory = 'working';
    let label = '';

    // Priority: holiday > compensatory/swap_off > makeup_work > morning_work > shift weekly rules
    const holidayMatch = dayHolidays.find((h) => h.holidayType === 'holiday');
    const compOrSwapMatch = dayHolidays.find(
      (h) => h.holidayType === 'compensatory' || h.holidayType === 'swap_off'
    );
    const makeupMatch = dayHolidays.find((h) => h.holidayType === 'makeup_work');
    const morningMatch = dayHolidays.find(
      (h) => h.holidayType === 'morning_work'
    );

    if (holidayMatch) {
      category = 'holiday';
      label = holidayMatch.name;
    } else if (compOrSwapMatch) {
      category = 'compensatory_swap';
      label = compOrSwapMatch.name;
    } else if (makeupMatch) {
      category = 'makeup_work';
      label = makeupMatch.name;
    } else if (morningMatch) {
      category = 'morning_work';
      label = morningMatch.name;
    } else if (shiftMode === 'off') {
      category = 'weekly_off';
      label = 'Nghỉ hằng tuần';
    } else if (shiftMode === 'morning') {
      category = 'morning_work';
      label = 'Làm buổi sáng (theo ca mặc định)';
    } else if (shiftMode === 'biweekly') {
      const weekNum = getIsoWeekNumber(isoDate);
      if (weekNum % 2 === 0) {
        category = 'weekly_off';
        label = 'Nghỉ cách tuần (theo ca mặc định)';
      } else {
        category = 'working';
        label = 'Làm cách tuần (theo ca mặc định)';
      }
    }

    result.push({
      isoDate,
      dayOfMonth: day,
      weekdayKey,
      category,
      label,
      holidays: dayHolidays,
    });
  }

  return result;
}

/**
 * Returns leading empty offset (0..6) for Monday-first calendar grid of a given month.
 */
export function getMondayFirstMonthOffset(year: number, month: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

// ============================================================================
// Overtime Automation & Net Working Hours Helpers
// ============================================================================

export type OvertimeDayKind =
  | 'holiday'
  | 'compensatory_off'
  | 'makeup_work'
  | 'weekly_off'
  | 'morning_work'
  | 'working';

export type OvertimeDayBannerTone =
  | 'holiday'
  | 'compensatory'
  | 'makeup'
  | 'weekly_off'
  | 'morning'
  | 'none';

export interface EffectiveShiftDaySchedule {
  weekdayKey: WeekdayKey;
  rawMode: WeekdayWorkMode;
  effectiveMode: 'full_day' | 'morning' | 'off';
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  morningEndTime: string;
}

export interface OvertimeDayEvaluation {
  isoDate: string;
  shift: WorkShift;
  daySchedule: EffectiveShiftDaySchedule;
  dayKind: OvertimeDayKind;
  matchedHoliday: CompanyHoliday | null;
  bannerTone: OvertimeDayBannerTone;
  bannerText: string;
  suggestedStartTime: string;
  suggestedDefaultEndTime: string;
  quickEndSuggestions: string[];
}

export interface BreakWindowInput {
  startTime?: string | null;
  endTime?: string | null;
  label?: string;
}

export interface AppliedBreakDeduction {
  label: string;
  startTime: string;
  endTime: string;
  deductedMinutes: number;
}

export interface OvertimeNetHoursResult {
  rawHours: number;
  deductedBreakHours: number;
  netHours: number;
  appliedBreaks: AppliedBreakDeduction[];
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Resolves which WorkShift applies to the given department (or selected employees' departments),
 * preferring a shift whose `departmentNames` (`target_groups`) contains the department,
 * otherwise falling back to the shift marked `isDefault === true`.
 */
export function resolveWorkShiftForDepartment(
  shifts: WorkShift[],
  departmentName?: string | null,
  employeeDepartments: string[] = []
): WorkShift {
  const safeShifts = Array.isArray(shifts) && shifts.length > 0
    ? shifts
    : [createDefaultAdminShift()];

  const candidates: string[] = [];
  const cleanFilter = (departmentName || '').trim();
  if (cleanFilter && cleanFilter.toUpperCase() !== 'ALL') {
    candidates.push(cleanFilter.toLowerCase());
  }
  for (const dept of employeeDepartments) {
    const clean = (dept || '').trim().toLowerCase();
    if (clean && !candidates.includes(clean)) {
      candidates.push(clean);
    }
  }

  for (const candidate of candidates) {
    const dedicatedMatch = safeShifts.find(
      (s) =>
        !s.isDefault &&
        (s.departmentNames || []).some(
          (d) => d.trim().toLowerCase() === candidate
        )
    );
    if (dedicatedMatch) return dedicatedMatch;

    const anyMatch = safeShifts.find((s) =>
      (s.departmentNames || []).some((d) => d.trim().toLowerCase() === candidate)
    );
    if (anyMatch) return anyMatch;
  }

  return (
    safeShifts.find((s) => s.isDefault) ||
    safeShifts[0] ||
    createDefaultAdminShift()
  );
}

/**
 * Resolves the effective schedule for `isoDate` on a given shift,
 * prioritizing `dayOverrides` (`weekly_schedule`) over the shift's base times.
 */
export function getEffectiveShiftDaySchedule(
  shift: WorkShift,
  isoDate: string
): EffectiveShiftDaySchedule {
  const weekdayKey = getWeekdayKeyFromIsoDate(isoDate);
  const rawMode: WeekdayWorkMode = shift.workingDays?.[weekdayKey] ?? 'off';

  let effectiveMode: 'full_day' | 'morning' | 'off';
  if (rawMode === 'off') {
    effectiveMode = 'off';
  } else if (rawMode === 'morning') {
    effectiveMode = 'morning';
  } else if (rawMode === 'biweekly') {
    effectiveMode = getIsoWeekNumber(isoDate) % 2 === 0 ? 'off' : 'full_day';
  } else {
    effectiveMode = 'full_day';
  }

  const override = shift.dayOverrides?.[weekdayKey];
  const startTime = override?.startTime?.trim() || shift.startTime || '08:00';
  const endTime = override?.endTime?.trim() || shift.endTime || '17:00';
  const breakStart =
    override?.breakStart !== undefined
      ? override.breakStart.trim()
      : (shift.breakStart || '').trim();
  const breakEnd =
    override?.breakEnd !== undefined
      ? override.breakEnd.trim()
      : (shift.breakEnd || '').trim();

  let morningEndTime = breakStart || '12:00';
  if (effectiveMode === 'morning') {
    if (override?.endTime?.trim()) {
      morningEndTime = override.endTime.trim();
    } else if (breakStart) {
      morningEndTime = breakStart;
    } else {
      const sMin = parseTimeToMinutes(startTime);
      const eMin = parseTimeToMinutes(endTime);
      if (sMin !== null && eMin !== null && eMin > sMin) {
        morningEndTime = formatMinutesToHHMM(sMin + Math.floor((eMin - sMin) / 2));
      } else {
        morningEndTime = '12:00';
      }
    }
  }

  return {
    weekdayKey,
    rawMode,
    effectiveMode,
    startTime,
    endTime,
    breakStart,
    breakEnd,
    morningEndTime,
  };
}

function buildWorkdayQuickEndSuggestions(startTime: string): string[] {
  const startMin = parseTimeToMinutes(startTime);
  if (startMin === null) return ['19:00', '20:00', '21:00'];

  const offsets = [120, 180, 210];
  const results: string[] = [];
  for (const offset of offsets) {
    const target = startMin + offset;
    if (target < 24 * 60) {
      const formatted = formatMinutesToHHMM(target);
      if (!results.includes(formatted)) {
        results.push(formatted);
      }
    }
  }
  return results.length > 0 ? results : ['19:00', '20:00', '21:00'];
}

function buildMorningQuickEndSuggestions(morningEndTime: string, shiftEndTime: string): string[] {
  const startMin = parseTimeToMinutes(morningEndTime) ?? 12 * 60;
  const candidates = [shiftEndTime || '17:00', '19:00', '20:00'];
  const unique: string[] = [];
  for (const c of candidates) {
    const m = parseTimeToMinutes(c);
    if (m !== null && m > startMin && !unique.includes(c)) {
      unique.push(c);
    }
  }
  if (unique.length === 0) {
    return buildWorkdayQuickEndSuggestions(morningEndTime);
  }
  return unique;
}

/**
 * Classifies an overtime date against `company_holidays` and the resolved `WorkShift`,
 * returning banner metadata, auto-filled start time, and quick end-time suggestions.
 */
export function evaluateOvertimeDaySchedule(params: {
  isoDate: string;
  holidays: CompanyHoliday[];
  shifts: WorkShift[];
  departmentName?: string | null;
  employeeDepartments?: string[];
}): OvertimeDayEvaluation {
  const {
    isoDate,
    holidays,
    shifts,
    departmentName,
    employeeDepartments = [],
  } = params;

  const shift = resolveWorkShiftForDepartment(
    shifts,
    departmentName,
    employeeDepartments
  );
  const daySchedule = getEffectiveShiftDaySchedule(shift, isoDate);

  const dayHolidays = (holidays || []).filter(
    (h) => (h.holidayDate || '').trim() === isoDate
  );

  const holidayMatch = dayHolidays.find((h) => h.holidayType === 'holiday');
  const compMatch = dayHolidays.find(
    (h) =>
      h.holidayType === 'compensatory' ||
      h.holidayType === 'swap_off' ||
      (h.holidayType as string) === 'compensatory_off'
  );
  const makeupMatch = dayHolidays.find((h) => h.holidayType === 'makeup_work');
  const morningMatch = dayHolidays.find((h) => h.holidayType === 'morning_work');

  if (holidayMatch) {
    return {
      isoDate,
      shift,
      daySchedule,
      dayKind: 'holiday',
      matchedHoliday: holidayMatch,
      bannerTone: 'holiday',
      bannerText: `Ngày nghỉ lễ, tết: ${holidayMatch.name} (Áp dụng đơn giá tăng ca Lễ/Tết)`,
      suggestedStartTime: daySchedule.startTime,
      suggestedDefaultEndTime: daySchedule.endTime || '17:00',
      quickEndSuggestions: ['12:00', '17:00', '20:00'],
    };
  }

  if (compMatch) {
    return {
      isoDate,
      shift,
      daySchedule,
      dayKind: 'compensatory_off',
      matchedHoliday: compMatch,
      bannerTone: 'compensatory',
      bannerText: `Ngày nghỉ bù / hoán đổi: ${compMatch.name}`,
      suggestedStartTime: daySchedule.startTime,
      suggestedDefaultEndTime: daySchedule.endTime || '17:00',
      quickEndSuggestions: ['12:00', '17:00', '20:00'],
    };
  }

  if (makeupMatch) {
    const start = daySchedule.endTime;
    const quick = buildWorkdayQuickEndSuggestions(start);
    return {
      isoDate,
      shift,
      daySchedule,
      dayKind: 'makeup_work',
      matchedHoliday: makeupMatch,
      bannerTone: 'makeup',
      bannerText: makeupMatch.name
        ? `Ngày làm bù (${makeupMatch.name}) — xử lý theo lịch ngày làm việc bình thường`
        : 'Ngày làm bù',
      suggestedStartTime: start,
      suggestedDefaultEndTime: quick[0] || '19:00',
      quickEndSuggestions: quick,
    };
  }

  if (morningMatch) {
    const start = daySchedule.morningEndTime || daySchedule.breakStart || '12:00';
    const quick = buildMorningQuickEndSuggestions(start, daySchedule.endTime);
    return {
      isoDate,
      shift,
      daySchedule,
      dayKind: 'morning_work',
      matchedHoliday: morningMatch,
      bannerTone: 'morning',
      bannerText: `Ca làm buổi sáng (${morningMatch.name}) — Tăng ca tính từ giờ tan ca sáng`,
      suggestedStartTime: start,
      suggestedDefaultEndTime: daySchedule.endTime || quick[0] || '17:00',
      quickEndSuggestions: quick,
    };
  }

  if (daySchedule.effectiveMode === 'off') {
    return {
      isoDate,
      shift,
      daySchedule,
      dayKind: 'weekly_off',
      matchedHoliday: null,
      bannerTone: 'weekly_off',
      bannerText: `Ngày nghỉ hằng tuần theo Ca làm việc (${shift.code} – ${shift.name})`,
      suggestedStartTime: daySchedule.startTime,
      suggestedDefaultEndTime: daySchedule.endTime || '17:00',
      quickEndSuggestions: ['12:00', '17:00', '20:00'],
    };
  }

  if (daySchedule.effectiveMode === 'morning') {
    const start = daySchedule.morningEndTime || daySchedule.breakStart || '12:00';
    const quick = buildMorningQuickEndSuggestions(start, daySchedule.endTime);
    return {
      isoDate,
      shift,
      daySchedule,
      dayKind: 'morning_work',
      matchedHoliday: null,
      bannerTone: 'morning',
      bannerText: `Ca làm buổi sáng (Tăng ca tính từ giờ tan ca sáng ${start})`,
      suggestedStartTime: start,
      suggestedDefaultEndTime: daySchedule.endTime || quick[0] || '17:00',
      quickEndSuggestions: quick,
    };
  }

  const start = daySchedule.endTime;
  const quick = buildWorkdayQuickEndSuggestions(start);
  return {
    isoDate,
    shift,
    daySchedule,
    dayKind: 'working',
    matchedHoliday: null,
    bannerTone: 'none',
    bannerText: '',
    suggestedStartTime: start,
    suggestedDefaultEndTime: quick[0] || '19:00',
    quickEndSuggestions: quick,
  };
}

/**
 * Computes net overtime working hours between `startTime` and `endTime`,
 * subtracting any overlapping intervals from `breakWindows` (e.g., mid-shift break
 * `break_start - break_end` and optional overtime dinner break), without double-counting
 * overlapping break ranges.
 */
export function calculateOvertimeNetHours(params: {
  startTime: string;
  endTime: string;
  breakWindows?: BreakWindowInput[];
}): OvertimeNetHoursResult {
  const s = parseTimeToMinutes(params.startTime);
  const e = parseTimeToMinutes(params.endTime);
  if (s === null || e === null || e <= s) {
    return {
      rawHours: 0,
      deductedBreakHours: 0,
      netHours: 0,
      appliedBreaks: [],
    };
  }

  const rawMinutes = e - s;
  const overlaps: Array<{
    start: number;
    end: number;
    label: string;
    startTime: string;
    endTime: string;
  }> = [];

  for (const bw of params.breakWindows || []) {
    const bs = parseTimeToMinutes(bw.startTime);
    const be = parseTimeToMinutes(bw.endTime);
    if (bs === null || be === null || be <= bs) continue;

    const overlapStart = Math.max(s, bs);
    const overlapEnd = Math.min(e, be);
    if (overlapEnd > overlapStart) {
      overlaps.push({
        start: overlapStart,
        end: overlapEnd,
        label: bw.label || 'Nghỉ giữa ca',
        startTime: bw.startTime!.trim(),
        endTime: bw.endTime!.trim(),
      });
    }
  }

  if (overlaps.length === 0) {
    const rawHours = Number((rawMinutes / 60).toFixed(2));
    return {
      rawHours,
      deductedBreakHours: 0,
      netHours: rawHours,
      appliedBreaks: [],
    };
  }

  // Sort and merge overlapping break intervals so union minutes are never double-subtracted
  overlaps.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  const appliedBreaks: AppliedBreakDeduction[] = [];

  for (const item of overlaps) {
    if (merged.length === 0 || item.start >= merged[merged.length - 1].end) {
      merged.push({ start: item.start, end: item.end });
      appliedBreaks.push({
        label: item.label,
        startTime: item.startTime,
        endTime: item.endTime,
        deductedMinutes: item.end - item.start,
      });
    } else {
      const prev = merged[merged.length - 1];
      const extraMinutes = Math.max(0, item.end - prev.end);
      if (extraMinutes > 0) {
        prev.end = item.end;
        appliedBreaks.push({
          label: item.label,
          startTime: item.startTime,
          endTime: item.endTime,
          deductedMinutes: extraMinutes,
        });
      }
    }
  }

  const totalBreakMinutes = merged.reduce(
    (sum, interval) => sum + (interval.end - interval.start),
    0
  );
  const netMinutes = Math.max(0, rawMinutes - totalBreakMinutes);

  return {
    rawHours: Number((rawMinutes / 60).toFixed(2)),
    deductedBreakHours: Number((totalBreakMinutes / 60).toFixed(2)),
    netHours: Number((netMinutes / 60).toFixed(2)),
    appliedBreaks,
  };
}

