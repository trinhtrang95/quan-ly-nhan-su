import { getOvertimeSupabaseClient, overtimeSupabase } from './overtimeFormsService';
import {
  normalizeTargetGroups,
  serializeTargetGroupsForSupabase,
} from './overtimeGlossaryService';
import {
  calculateShiftMetrics,
  CompanyHoliday,
  createDefaultAdminShift,
  DayOverridesMap,
  DEFAULT_OVERTIME_SETTINGS,
  DEFAULT_WORKING_DAYS,
  DinnerBreakRule,
  HolidayGenerationPlan,
  HolidayType,
  NationalDayPlanOption,
  OvertimeSettings,
  SundayLunchRule,
  TetPlanOption,
  WEEKDAY_ORDER,
  WeekdayKey,
  WeekdayWorkMode,
  WorkingDaysMap,
  WorkShift,
} from './workScheduleLogic';

const WORK_SHIFTS_STORAGE_KEY = 'hr_pro_work_shifts_v1';
const COMPANY_HOLIDAYS_STORAGE_KEY = 'hr_pro_company_holidays_v1';
const HOLIDAY_PLAN_STORAGE_KEY = 'hr_pro_holiday_plans_v1';
const OVERTIME_SETTINGS_STORAGE_KEY = 'hr_pro_overtime_settings_v1';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SUPABASE_GENERAL_SETTINGS_SQL = `-- 1. Tạo bảng Ca làm việc (work_shifts)
CREATE TABLE IF NOT EXISTS public.work_shifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  break_start TEXT NULL DEFAULT '12:00',
  break_end TEXT NULL DEFAULT '13:00',
  weekly_schedule JSONB NOT NULL DEFAULT '{"workingDays":{"mon":"full_day","tue":"full_day","wed":"full_day","thu":"full_day","fri":"full_day","sat":"off","sun":"off"},"dayOverrides":{}}'::jsonb,
  early_minutes INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#14539E',
  rate_percent NUMERIC NOT NULL DEFAULT 100,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  target_groups TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tạo bảng Lịch nghỉ lễ, tết (company_holidays)
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  holiday_date TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'holiday',
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_holidays_year ON public.company_holidays(year, holiday_date);

-- 3. Mở quyền truy cập RLS cho bảng work_shifts và company_holidays
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('work_shifts', 'company_holidays')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "Allow public full access on work_shifts"
  ON public.work_shifts
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public full access on company_holidays"
  ON public.company_holidays
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 4. Bật Supabase Realtime cho work_shifts và company_holidays
ALTER TABLE public.work_shifts REPLICA IDENTITY FULL;
ALTER TABLE public.company_holidays REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'work_shifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_shifts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'company_holidays'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_holidays;
  END IF;
END $$;

-- 5. Tạo bảng Thiết lập làm thêm giờ (overtime_settings)
CREATE TABLE IF NOT EXISTS public.overtime_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  weekday_rate NUMERIC NOT NULL DEFAULT 150,
  weekend_rate NUMERIC NOT NULL DEFAULT 200,
  holiday_rate NUMERIC NOT NULL DEFAULT 300,
  min_ot_minutes INTEGER NOT NULL DEFAULT 60,
  rounding_minutes INTEGER NOT NULL DEFAULT 30,
  auto_approve_ot BOOLEAN NOT NULL DEFAULT TRUE,
  weekend_is_ot_only BOOLEAN NOT NULL DEFAULT TRUE,
  dinner_break_rule JSONB NOT NULL DEFAULT '{"enabled":true,"break_start":"18:10","break_end":"18:40","deduct_minutes":30,"threshold_end_time":"19:40","continuous_cutoff_time":"19:10"}'::jsonb,
  sunday_lunch_rule JSONB NOT NULL DEFAULT '{"enabled":true,"break_start":"12:00","break_end":"12:40","deduct_minutes":40}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.overtime_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'overtime_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.overtime_settings', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow public full access on overtime_settings"
  ON public.overtime_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.overtime_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'overtime_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.overtime_settings;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';`;

export interface SupabaseWorkShiftRow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  weekly_schedule?: unknown;
  early_minutes?: number | null;
  color?: string | null;
  rate_percent?: number | null;
  is_default?: boolean | null;
  target_groups?: string[] | string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SupabaseCompanyHolidayRow {
  id: string;
  year: number;
  holiday_date: string;
  title: string;
  type: string;
  is_custom?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function isMissingTableOrSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('42P01') ||
    msg.includes('PGRST205') ||
    msg.includes('does not exist') ||
    msg.includes('Could not find the table') ||
    msg.includes('42501')
  );
}

function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

function parseWeeklySchedule(raw: unknown): {
  workingDays: WorkingDaysMap;
  dayOverrides: DayOverridesMap;
} {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw, {});
  const validModes = new Set<WeekdayWorkMode>([
    'full_day',
    'morning',
    'biweekly',
    'off',
  ]);

  const workingDays: WorkingDaysMap = { ...DEFAULT_WORKING_DAYS };
  const dayOverrides: DayOverridesMap = {};

  if (!parsed || typeof parsed !== 'object') {
    return { workingDays, dayOverrides };
  }

  // Shape A: { workingDays: { mon: 'full_day', ... }, dayOverrides: { ... } }
  const daysSource =
    (parsed.workingDays as Record<string, unknown> | undefined) ||
    (parsed.days as Record<string, unknown> | undefined) ||
    parsed;

  for (const { key } of WEEKDAY_ORDER) {
    const val = daysSource?.[key];
    if (typeof val === 'string' && validModes.has(val as WeekdayWorkMode)) {
      workingDays[key] = val as WeekdayWorkMode;
    } else if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const mode = obj.mode;
      if (typeof mode === 'string' && validModes.has(mode as WeekdayWorkMode)) {
        workingDays[key] = mode as WeekdayWorkMode;
      }
      const st = typeof obj.startTime === 'string' ? obj.startTime.trim() : '';
      const et = typeof obj.endTime === 'string' ? obj.endTime.trim() : '';
      const bs = typeof obj.breakStart === 'string' ? obj.breakStart.trim() : '';
      const be = typeof obj.breakEnd === 'string' ? obj.breakEnd.trim() : '';
      if (st || et || bs || be) {
        dayOverrides[key as WeekdayKey] = {
          ...(st ? { startTime: st } : {}),
          ...(et ? { endTime: et } : {}),
          ...(bs ? { breakStart: bs } : {}),
          ...(be ? { breakEnd: be } : {}),
        };
      }
    }
  }

  const overridesSource =
    (parsed.dayOverrides as Record<string, unknown> | undefined) ||
    (parsed.overrides as Record<string, unknown> | undefined);

  if (overridesSource && typeof overridesSource === 'object') {
    for (const { key } of WEEKDAY_ORDER) {
      const item = overridesSource[key];
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const startTime =
          typeof rec.startTime === 'string' ? rec.startTime.trim() : '';
        const endTime =
          typeof rec.endTime === 'string' ? rec.endTime.trim() : '';
        const breakStart =
          typeof rec.breakStart === 'string' ? rec.breakStart.trim() : '';
        const breakEnd =
          typeof rec.breakEnd === 'string' ? rec.breakEnd.trim() : '';
        if (startTime || endTime || breakStart || breakEnd) {
          dayOverrides[key as WeekdayKey] = {
            ...(startTime ? { startTime } : {}),
            ...(endTime ? { endTime } : {}),
            ...(breakStart ? { breakStart } : {}),
            ...(breakEnd ? { breakEnd } : {}),
          };
        }
      }
    }
  }

  return { workingDays, dayOverrides };
}

export function mapSupabaseRowToWorkShift(row: SupabaseWorkShiftRow): WorkShift {
  const { workingDays, dayOverrides } = parseWeeklySchedule(row.weekly_schedule);
  const startTime = (row.start_time || '08:00').trim().slice(0, 5);
  const endTime = (row.end_time || '17:00').trim().slice(0, 5);
  const breakStart = (row.break_start ?? '').trim().slice(0, 5);
  const breakEnd = (row.break_end ?? '').trim().slice(0, 5);

  const metrics = calculateShiftMetrics({
    startTime,
    endTime,
    breakStart,
    breakEnd,
    workingDays,
    dayOverrides,
  });

  const code = (row.id || '').trim().toUpperCase();

  return {
    id: row.id,
    companyId: null,
    code,
    name: (row.name || '').trim(),
    startTime,
    endTime,
    breakStart,
    breakEnd,
    workingDays,
    dayOverrides,
    earlyMinutes: Number(row.early_minutes ?? 0),
    color: (row.color || '#14539E').trim(),
    hourlyRatePercent: Number(row.rate_percent ?? 100),
    standardDailyHours: metrics.standardDailyHours,
    weeklyHours: metrics.weeklyHours,
    isDefault: Boolean(row.is_default),
    departmentNames: normalizeTargetGroups(row.target_groups),
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

function normalizeHolidayType(raw?: string | null): HolidayType {
  if (raw === 'compensatory_off') {
    return 'compensatory';
  }
  const valid = new Set<HolidayType>([
    'holiday',
    'compensatory',
    'swap_off',
    'makeup_work',
    'morning_work',
  ]);
  if (raw && valid.has(raw as HolidayType)) {
    return raw as HolidayType;
  }
  return 'holiday';
}

export function mapSupabaseRowToCompanyHoliday(
  row: SupabaseCompanyHolidayRow
): CompanyHoliday {
  return {
    id: row.id,
    companyId: null,
    year: Number(row.year),
    holidayDate: (row.holiday_date || '').trim(),
    name: (row.title || '').trim(),
    holidayType: normalizeHolidayType(row.type),
    isManual: Boolean(row.is_custom),
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

function readLocalShifts(companyId?: string | null): WorkShift[] {
  if (typeof window === 'undefined') {
    return [createDefaultAdminShift(companyId)];
  }
  try {
    const raw = localStorage.getItem(WORK_SHIFTS_STORAGE_KEY);
    if (!raw) {
      const seeded = [createDefaultAdminShift(companyId)];
      localStorage.setItem(WORK_SHIFTS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as WorkShift[];
    }
  } catch {
    // Ignore storage error
  }
  return [createDefaultAdminShift(companyId)];
}

function writeLocalShifts(shifts: WorkShift[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORK_SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
  } catch {
    // Ignore quota errors
  }
}

function readLocalHolidays(year: number): CompanyHoliday[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPANY_HOLIDAYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as CompanyHoliday[])
      .filter((h) => h.year === year)
      .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
  } catch {
    return [];
  }
}

function writeLocalHolidays(year: number, holidays: CompanyHoliday[]): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(COMPANY_HOLIDAYS_STORAGE_KEY);
    const existing: CompanyHoliday[] = raw ? JSON.parse(raw) : [];
    const kept = existing.filter((h) => h.year !== year);
    localStorage.setItem(
      COMPANY_HOLIDAYS_STORAGE_KEY,
      JSON.stringify([...kept, ...holidays])
    );
  } catch {
    // Ignore quota errors
  }
}

export function loadHolidayPlanForYear(
  year: number,
  companyId?: string | null
): HolidayGenerationPlan {
  const fallback: HolidayGenerationPlan = {
    year,
    tetPlan: '1+4',
    nationalDayPlan: '09-01_09-02',
    includeCultureDay: false,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(HOLIDAY_PLAN_STORAGE_KEY);
    if (!raw) return fallback;
    const map = JSON.parse(raw) as Record<string, Partial<HolidayGenerationPlan>>;
    const key = `${companyId || 'default'}::${year}`;
    const saved = map[key];
    if (!saved) return fallback;
    return {
      year,
      tetPlan: (saved.tetPlan as TetPlanOption) || '1+4',
      nationalDayPlan:
        (saved.nationalDayPlan as NationalDayPlanOption) || '09-01_09-02',
      includeCultureDay: Boolean(saved.includeCultureDay),
    };
  } catch {
    return fallback;
  }
}

export function saveHolidayPlanForYear(
  plan: HolidayGenerationPlan,
  companyId?: string | null
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(HOLIDAY_PLAN_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, HolidayGenerationPlan>) : {};
    const key = `${companyId || 'default'}::${plan.year}`;
    map[key] = plan;
    localStorage.setItem(HOLIDAY_PLAN_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
}

function sortShifts(shifts: WorkShift[]): WorkShift[] {
  return [...shifts].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return (a.code || '').localeCompare(b.code || '', 'vi', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

function toSupabaseShiftPayload(
  shift: Omit<WorkShift, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
) {
  const normalizedCode = shift.code.trim().toUpperCase();
  return {
    id: normalizedCode,
    name: shift.name.trim(),
    start_time: shift.startTime,
    end_time: shift.endTime,
    break_start: shift.breakStart || null,
    break_end: shift.breakEnd || null,
    weekly_schedule: {
      workingDays: shift.workingDays,
      dayOverrides: shift.dayOverrides || {},
    },
    early_minutes: Math.max(0, Math.round(Number(shift.earlyMinutes || 0))),
    color: shift.color || '#14539E',
    rate_percent: Number(shift.hourlyRatePercent ?? 100),
    is_default: Boolean(shift.isDefault),
    target_groups: shift.isDefault
      ? null
      : serializeTargetGroupsForSupabase(shift.departmentNames || []),
    updated_at: new Date().toISOString(),
  };
}

// ============================================================================
// Work Shifts CRUD + Realtime
// ============================================================================

export async function fetchWorkShifts(companyId?: string | null): Promise<{
  shifts: WorkShift[];
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  try {
    const rows = await overtimeSupabase.request<SupabaseWorkShiftRow[]>(
      'work_shifts?select=*&order=is_default.desc,created_at.asc'
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      // Seed default Ca hành chính (HC) into Supabase
      const defaultShift = createDefaultAdminShift(companyId);
      const inserted = await overtimeSupabase.request<SupabaseWorkShiftRow[]>(
        'work_shifts?select=*',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(toSupabaseShiftPayload(defaultShift)),
        }
      );
      const mapped = sortShifts(
        (Array.isArray(inserted) ? inserted : []).map(mapSupabaseRowToWorkShift)
      );
      const resultShifts = mapped.length > 0 ? mapped : [defaultShift];
      writeLocalShifts(resultShifts);
      return {
        shifts: resultShifts,
        source: 'supabase',
        schemaNeedsMigration: false,
      };
    }

    const mapped = sortShifts(rows.map(mapSupabaseRowToWorkShift));
    writeLocalShifts(mapped);
    return {
      shifts: mapped,
      source: 'supabase',
      schemaNeedsMigration: false,
    };
  } catch (err) {
    return {
      shifts: sortShifts(readLocalShifts(companyId)),
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export async function saveWorkShift(
  shiftInput: Omit<WorkShift, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  existingShifts: WorkShift[],
  companyId?: string | null
): Promise<{
  shifts: WorkShift[];
  savedShift: WorkShift;
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  const metrics = calculateShiftMetrics(shiftInput);
  const normalizedCode = shiftInput.code.trim().toUpperCase();
  const normalizedName = shiftInput.name.trim();
  const normalizedDeptNames = shiftInput.isDefault
    ? []
    : shiftInput.departmentNames || [];

  const payload = toSupabaseShiftPayload({
    ...shiftInput,
    code: normalizedCode,
    name: normalizedName,
    departmentNames: normalizedDeptNames,
    standardDailyHours: metrics.standardDailyHours,
    weeklyHours: metrics.weeklyHours,
  });

  try {
    let persisted: SupabaseWorkShiftRow | null = null;
    const oldId = (shiftInput.id || '').trim().toUpperCase();

    if (oldId && existingShifts.some((s) => s.id.toUpperCase() === oldId)) {
      if (oldId === normalizedCode) {
        const rows = await overtimeSupabase.request<SupabaseWorkShiftRow[]>(
          `work_shifts?id=eq.${encodeURIComponent(oldId)}&select=*`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload),
          }
        );
        persisted = Array.isArray(rows) ? rows[0] : null;
      } else {
        // Code changed -> insert/upsert new code & delete old code row
        const rows = await overtimeSupabase.request<SupabaseWorkShiftRow[]>(
          'work_shifts?on_conflict=id&select=*',
          {
            method: 'POST',
            headers: {
              Prefer: 'return=representation,resolution=merge-duplicates',
            },
            body: JSON.stringify(payload),
          }
        );
        persisted = Array.isArray(rows) ? rows[0] : null;
        await overtimeSupabase.request(
          `work_shifts?id=eq.${encodeURIComponent(oldId)}`,
          { method: 'DELETE' }
        );
      }
    } else {
      const rows = await overtimeSupabase.request<SupabaseWorkShiftRow[]>(
        'work_shifts?on_conflict=id&select=*',
        {
          method: 'POST',
          headers: {
            Prefer: 'return=representation,resolution=merge-duplicates',
          },
          body: JSON.stringify(payload),
        }
      );
      persisted = Array.isArray(rows) ? rows[0] : null;
    }

    const fresh = await fetchWorkShifts(companyId);
    const savedShift = persisted
      ? mapSupabaseRowToWorkShift(persisted)
      : fresh.shifts.find((s) => s.code === normalizedCode) ||
        fresh.shifts[0] ||
        createDefaultAdminShift(companyId);

    return {
      shifts: fresh.shifts,
      savedShift,
      source: fresh.source,
      schemaNeedsMigration: fresh.schemaNeedsMigration,
    };
  } catch (err) {
    const nowIso = new Date().toISOString();
    const oldId = (shiftInput.id || '').trim().toUpperCase();
    const localSaved: WorkShift = {
      ...shiftInput,
      id: normalizedCode,
      companyId: companyId ?? shiftInput.companyId ?? null,
      code: normalizedCode,
      name: normalizedName,
      departmentNames: normalizedDeptNames,
      standardDailyHours: metrics.standardDailyHours,
      weeklyHours: metrics.weeklyHours,
      updatedAt: nowIso,
      createdAt: nowIso,
    };
    const nextList = sortShifts([
      localSaved,
      ...existingShifts.filter(
        (s) => s.id.toUpperCase() !== oldId && s.id.toUpperCase() !== normalizedCode
      ),
    ]);
    writeLocalShifts(nextList);
    return {
      shifts: nextList,
      savedShift: localSaved,
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export async function setDefaultWorkShift(
  targetShiftId: string,
  existingShifts: WorkShift[],
  companyId?: string | null
): Promise<{
  shifts: WorkShift[];
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  try {
    // 1. Demote other default shifts
    for (const shift of existingShifts) {
      if (shift.id !== targetShiftId && shift.isDefault) {
        await overtimeSupabase.request(
          `work_shifts?id=eq.${encodeURIComponent(shift.id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              is_default: false,
              updated_at: new Date().toISOString(),
            }),
          }
        );
      }
    }

    // 2. Promote target shift
    await overtimeSupabase.request(
      `work_shifts?id=eq.${encodeURIComponent(targetShiftId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          is_default: true,
          target_groups: null,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return await fetchWorkShifts(companyId);
  } catch (err) {
    const nextList = sortShifts(
      existingShifts.map((s) => ({
        ...s,
        isDefault: s.id === targetShiftId,
        departmentNames: s.id === targetShiftId ? [] : s.departmentNames,
      }))
    );
    writeLocalShifts(nextList);
    return {
      shifts: nextList,
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export async function deleteWorkShift(
  shiftId: string,
  existingShifts: WorkShift[],
  companyId?: string | null
): Promise<{
  shifts: WorkShift[];
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  try {
    await overtimeSupabase.request(
      `work_shifts?id=eq.${encodeURIComponent(shiftId)}`,
      {
        method: 'DELETE',
      }
    );
    return await fetchWorkShifts(companyId);
  } catch (err) {
    const nextList = sortShifts(existingShifts.filter((s) => s.id !== shiftId));
    writeLocalShifts(nextList);
    return {
      shifts: nextList,
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export interface WorkShiftsRealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRow: Record<string, unknown> | null;
  oldRow: Record<string, unknown> | null;
}

export function applyRealtimeWorkShiftPayload(
  current: WorkShift[],
  event: WorkShiftsRealtimeEvent,
  _companyId?: string | null
): WorkShift[] {
  if (event.eventType === 'DELETE') {
    const oldId =
      event.oldRow && typeof event.oldRow.id === 'string' ? event.oldRow.id : '';
    if (!oldId) return current;
    return current.filter((item) => item.id !== oldId);
  }
  if (!event.newRow) return current;
  const mapped = mapSupabaseRowToWorkShift(
    event.newRow as unknown as SupabaseWorkShiftRow
  );
  if (!mapped.id) return current;
  return sortShifts([mapped, ...current.filter((item) => item.id !== mapped.id)]);
}

export function subscribeToWorkShiftsRealtime(
  onChange: (event: WorkShiftsRealtimeEvent) => void,
  onStatusChange?: (status: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const client = getOvertimeSupabaseClient();
  const channelName = `work-shifts-realtime-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'work_shifts' },
      (payload) =>
        onChange({
          eventType: 'INSERT',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'work_shifts' },
      (payload) =>
        onChange({
          eventType: 'UPDATE',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'work_shifts' },
      (payload) =>
        onChange({
          eventType: 'DELETE',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .subscribe((status) => {
      onStatusChange?.(status);
    });

  return () => {
    void client.removeChannel(channel);
  };
}

// ============================================================================
// Company Holidays CRUD + Realtime
// ============================================================================

export async function fetchCompanyHolidays(
  year: number,
  _companyId?: string | null
): Promise<{
  holidays: CompanyHoliday[];
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  try {
    const rows = await overtimeSupabase.request<SupabaseCompanyHolidayRow[]>(
      `company_holidays?year=eq.${year}&select=*&order=holiday_date.asc`
    );

    const mapped = (Array.isArray(rows) ? rows : [])
      .map(mapSupabaseRowToCompanyHoliday)
      .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));

    writeLocalHolidays(year, mapped);
    return {
      holidays: mapped,
      source: 'supabase',
      schemaNeedsMigration: false,
    };
  } catch (err) {
    return {
      holidays: readLocalHolidays(year),
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export async function fetchAllCompanyHolidays(): Promise<{
  holidays: CompanyHoliday[];
  source: 'supabase' | 'local';
}> {
  try {
    const rows = await overtimeSupabase.request<SupabaseCompanyHolidayRow[]>(
      'company_holidays?select=*&order=holiday_date.asc'
    );

    const mapped = (Array.isArray(rows) ? rows : [])
      .map(mapSupabaseRowToCompanyHoliday)
      .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(COMPANY_HOLIDAYS_STORAGE_KEY, JSON.stringify(mapped));
      } catch {
        // Ignore storage error
      }
    }

    return {
      holidays: mapped,
      source: 'supabase',
    };
  } catch {
    if (typeof window === 'undefined') {
      return { holidays: [], source: 'local' };
    }
    try {
      const raw = localStorage.getItem(COMPANY_HOLIDAYS_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as CompanyHoliday[]) : [];
      return {
        holidays: Array.isArray(parsed)
          ? parsed.sort((a, b) => a.holidayDate.localeCompare(b.holidayDate))
          : [],
        source: 'local',
      };
    } catch {
      return { holidays: [], source: 'local' };
    }
  }
}

export async function replaceGeneratedCompanyHolidays(
  year: number,
  nextCombinedList: CompanyHoliday[],
  companyId?: string | null
): Promise<{
  holidays: CompanyHoliday[];
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  const autoEntries = nextCombinedList.filter((h) => !h.isManual);
  const nowIso = new Date().toISOString();

  try {
    // Delete only auto-generated rows for that year (never wipe is_custom=true!)
    await overtimeSupabase.request(
      `company_holidays?year=eq.${year}&is_custom=eq.false`,
      {
        method: 'DELETE',
      }
    );

    if (autoEntries.length > 0) {
      const insertBody = autoEntries.map((item) => ({
        year: item.year,
        holiday_date: item.holidayDate,
        title: item.name,
        type: item.holidayType,
        is_custom: false,
        updated_at: nowIso,
      }));
      await overtimeSupabase.request('company_holidays', {
        method: 'POST',
        body: JSON.stringify(insertBody),
      });
    }

    return await fetchCompanyHolidays(year, companyId);
  } catch (err) {
    writeLocalHolidays(year, nextCombinedList);
    return {
      holidays: nextCombinedList,
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export async function addManualCompanyHoliday(
  input: {
    year: number;
    holidayDate: string;
    name: string;
    holidayType: HolidayType;
  },
  existingHolidays: CompanyHoliday[],
  companyId?: string | null
): Promise<{
  holidays: CompanyHoliday[];
  created: CompanyHoliday;
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  const nowIso = new Date().toISOString();
  const cleanName = input.name.trim();
  try {
    const inserted = await overtimeSupabase.request<SupabaseCompanyHolidayRow[]>(
      'company_holidays?select=*',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          year: input.year,
          holiday_date: input.holidayDate,
          title: cleanName,
          type: input.holidayType,
          is_custom: true,
          updated_at: nowIso,
        }),
      }
    );
    const createdRow = Array.isArray(inserted) ? inserted[0] : null;
    const fresh = await fetchCompanyHolidays(input.year, companyId);
    const created = createdRow
      ? mapSupabaseRowToCompanyHoliday(createdRow)
      : fresh.holidays.find(
          (h) => h.holidayDate === input.holidayDate && h.name === cleanName
        ) || {
          id: `manual-${Date.now()}`,
          companyId: companyId ?? null,
          year: input.year,
          holidayDate: input.holidayDate,
          name: cleanName,
          holidayType: input.holidayType,
          isManual: true,
        };
    return {
      holidays: fresh.holidays,
      created,
      source: fresh.source,
      schemaNeedsMigration: fresh.schemaNeedsMigration,
    };
  } catch (err) {
    const created: CompanyHoliday = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      companyId: companyId ?? null,
      year: input.year,
      holidayDate: input.holidayDate,
      name: cleanName,
      holidayType: input.holidayType,
      isManual: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const nextList = [...existingHolidays, created].sort((a, b) =>
      a.holidayDate.localeCompare(b.holidayDate)
    );
    writeLocalHolidays(input.year, nextList);
    return {
      holidays: nextList,
      created,
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export async function deleteCompanyHoliday(
  holidayId: string,
  year: number,
  existingHolidays: CompanyHoliday[],
  companyId?: string | null
): Promise<{
  holidays: CompanyHoliday[];
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  try {
    if (UUID_REGEX.test(holidayId)) {
      await overtimeSupabase.request(
        `company_holidays?id=eq.${encodeURIComponent(holidayId)}`,
        {
          method: 'DELETE',
        }
      );
    }
    return await fetchCompanyHolidays(year, companyId);
  } catch (err) {
    const nextList = existingHolidays.filter((h) => h.id !== holidayId);
    writeLocalHolidays(year, nextList);
    return {
      holidays: nextList,
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export interface CompanyHolidaysRealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRow: Record<string, unknown> | null;
  oldRow: Record<string, unknown> | null;
}

export function applyRealtimeHolidayPayload(
  current: CompanyHoliday[],
  event: CompanyHolidaysRealtimeEvent,
  year?: number,
  _companyId?: string | null
): CompanyHoliday[] {
  if (event.eventType === 'DELETE') {
    const oldId =
      event.oldRow && typeof event.oldRow.id === 'string' ? event.oldRow.id : '';
    if (!oldId) return current;
    return current.filter((item) => item.id !== oldId);
  }
  if (!event.newRow) return current;
  const mapped = mapSupabaseRowToCompanyHoliday(
    event.newRow as unknown as SupabaseCompanyHolidayRow
  );
  if (!mapped.id) return current;
  if (typeof year === 'number' && mapped.year !== year) {
    return current.filter((item) => item.id !== mapped.id);
  }
  return [...current.filter((item) => item.id !== mapped.id), mapped].sort(
    (a, b) => a.holidayDate.localeCompare(b.holidayDate)
  );
}

export function subscribeToCompanyHolidaysRealtime(
  onChange: (event: CompanyHolidaysRealtimeEvent) => void,
  onStatusChange?: (status: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const client = getOvertimeSupabaseClient();
  const channelName = `company-holidays-realtime-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'company_holidays' },
      (payload) =>
        onChange({
          eventType: 'INSERT',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'company_holidays' },
      (payload) =>
        onChange({
          eventType: 'UPDATE',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'company_holidays' },
      (payload) =>
        onChange({
          eventType: 'DELETE',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .subscribe((status) => {
      onStatusChange?.(status);
    });

  return () => {
    void client.removeChannel(channel);
  };
}

// ============================================================================
// Overtime Settings CRUD + Realtime (`overtime_settings`)
// ============================================================================

export interface SupabaseOvertimeSettingsRow {
  id: string;
  weekday_rate?: number | null;
  weekend_rate?: number | null;
  holiday_rate?: number | null;
  min_ot_minutes?: number | null;
  rounding_minutes?: number | null;
  auto_approve_ot?: boolean | null;
  weekend_is_ot_only?: boolean | null;
  dinner_break_rule?: unknown;
  sunday_lunch_rule?: unknown;
  updated_at?: string | null;
}

function normalizeDinnerBreakRule(raw: unknown): DinnerBreakRule {
  const parsed = parseJsonSafe<Partial<DinnerBreakRule>>(raw, {});
  const defaults = DEFAULT_OVERTIME_SETTINGS.dinner_break_rule;
  return {
    enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : defaults.enabled,
    break_start:
      typeof parsed.break_start === 'string' && parsed.break_start.trim()
        ? parsed.break_start.trim().slice(0, 5)
        : defaults.break_start,
    break_end:
      typeof parsed.break_end === 'string' && parsed.break_end.trim()
        ? parsed.break_end.trim().slice(0, 5)
        : defaults.break_end,
    deduct_minutes:
      parsed.deduct_minutes !== undefined && Number.isFinite(Number(parsed.deduct_minutes))
        ? Math.max(0, Math.round(Number(parsed.deduct_minutes)))
        : defaults.deduct_minutes,
    threshold_end_time:
      typeof parsed.threshold_end_time === 'string' && parsed.threshold_end_time.trim()
        ? parsed.threshold_end_time.trim().slice(0, 5)
        : defaults.threshold_end_time,
    continuous_cutoff_time:
      typeof parsed.continuous_cutoff_time === 'string' &&
      parsed.continuous_cutoff_time.trim()
        ? parsed.continuous_cutoff_time.trim().slice(0, 5)
        : defaults.continuous_cutoff_time,
  };
}

function normalizeSundayLunchRule(raw: unknown): SundayLunchRule {
  const parsed = parseJsonSafe<Partial<SundayLunchRule>>(raw, {});
  const defaults = DEFAULT_OVERTIME_SETTINGS.sunday_lunch_rule;
  return {
    enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : defaults.enabled,
    break_start:
      typeof parsed.break_start === 'string' && parsed.break_start.trim()
        ? parsed.break_start.trim().slice(0, 5)
        : defaults.break_start,
    break_end:
      typeof parsed.break_end === 'string' && parsed.break_end.trim()
        ? parsed.break_end.trim().slice(0, 5)
        : defaults.break_end,
    deduct_minutes:
      parsed.deduct_minutes !== undefined && Number.isFinite(Number(parsed.deduct_minutes))
        ? Math.max(0, Math.round(Number(parsed.deduct_minutes)))
        : defaults.deduct_minutes,
  };
}

export function mapSupabaseRowToOvertimeSettings(
  row?: Partial<SupabaseOvertimeSettingsRow> | null
): OvertimeSettings {
  if (!row) return { ...DEFAULT_OVERTIME_SETTINGS };
  return {
    id: (row.id || 'default').trim() || 'default',
    weekday_rate: Number(row.weekday_rate ?? DEFAULT_OVERTIME_SETTINGS.weekday_rate),
    weekend_rate: Number(row.weekend_rate ?? DEFAULT_OVERTIME_SETTINGS.weekend_rate),
    holiday_rate: Number(row.holiday_rate ?? DEFAULT_OVERTIME_SETTINGS.holiday_rate),
    min_ot_minutes: Math.max(
      0,
      Math.round(Number(row.min_ot_minutes ?? DEFAULT_OVERTIME_SETTINGS.min_ot_minutes))
    ),
    rounding_minutes: Math.max(
      0,
      Math.round(
        Number(row.rounding_minutes ?? DEFAULT_OVERTIME_SETTINGS.rounding_minutes)
      )
    ),
    auto_approve_ot:
      row.auto_approve_ot !== undefined && row.auto_approve_ot !== null
        ? Boolean(row.auto_approve_ot)
        : DEFAULT_OVERTIME_SETTINGS.auto_approve_ot,
    weekend_is_ot_only:
      row.weekend_is_ot_only !== undefined && row.weekend_is_ot_only !== null
        ? Boolean(row.weekend_is_ot_only)
        : DEFAULT_OVERTIME_SETTINGS.weekend_is_ot_only,
    dinner_break_rule: normalizeDinnerBreakRule(row.dinner_break_rule),
    sunday_lunch_rule: normalizeSundayLunchRule(row.sunday_lunch_rule),
    updated_at: row.updated_at || undefined,
  };
}

function readLocalOvertimeSettings(): OvertimeSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_OVERTIME_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(OVERTIME_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OVERTIME_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SupabaseOvertimeSettingsRow>;
    return mapSupabaseRowToOvertimeSettings(parsed);
  } catch {
    return { ...DEFAULT_OVERTIME_SETTINGS };
  }
}

function writeLocalOvertimeSettings(settings: OvertimeSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OVERTIME_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota error
  }
}

function toSupabaseOvertimeSettingsPayload(settings: OvertimeSettings) {
  return {
    id: (settings.id || 'default').trim() || 'default',
    weekday_rate: Number(settings.weekday_rate ?? 150),
    weekend_rate: Number(settings.weekend_rate ?? 200),
    holiday_rate: Number(settings.holiday_rate ?? 300),
    min_ot_minutes: Math.max(0, Math.round(Number(settings.min_ot_minutes ?? 60))),
    rounding_minutes: Math.max(0, Math.round(Number(settings.rounding_minutes ?? 30))),
    auto_approve_ot: Boolean(settings.auto_approve_ot),
    weekend_is_ot_only: Boolean(settings.weekend_is_ot_only),
    dinner_break_rule: settings.dinner_break_rule,
    sunday_lunch_rule: settings.sunday_lunch_rule,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchOvertimeSettings(): Promise<{
  settings: OvertimeSettings;
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  try {
    const rows = await overtimeSupabase.request<SupabaseOvertimeSettingsRow[]>(
      'overtime_settings?id=eq.default&select=*&limit=1'
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const mapped = mapSupabaseRowToOvertimeSettings(rows[0]);
      writeLocalOvertimeSettings(mapped);
      return {
        settings: mapped,
        source: 'supabase',
        schemaNeedsMigration: false,
      };
    }

    // Seed default row if table exists but empty
    const seededPayload = toSupabaseOvertimeSettingsPayload(DEFAULT_OVERTIME_SETTINGS);
    const inserted = await overtimeSupabase.request<SupabaseOvertimeSettingsRow[]>(
      'overtime_settings?on_conflict=id&select=*',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(seededPayload),
      }
    );
    const mapped = mapSupabaseRowToOvertimeSettings(
      Array.isArray(inserted) && inserted[0] ? inserted[0] : seededPayload
    );
    writeLocalOvertimeSettings(mapped);
    return {
      settings: mapped,
      source: 'supabase',
      schemaNeedsMigration: false,
    };
  } catch (err) {
    return {
      settings: readLocalOvertimeSettings(),
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export async function saveOvertimeSettings(
  settings: OvertimeSettings
): Promise<{
  settings: OvertimeSettings;
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  const normalized: OvertimeSettings = mapSupabaseRowToOvertimeSettings(
    toSupabaseOvertimeSettingsPayload(settings)
  );
  const payload = toSupabaseOvertimeSettingsPayload(normalized);

  try {
    const rows = await overtimeSupabase.request<SupabaseOvertimeSettingsRow[]>(
      'overtime_settings?on_conflict=id&select=*',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      }
    );
    const saved = mapSupabaseRowToOvertimeSettings(
      Array.isArray(rows) && rows[0] ? rows[0] : payload
    );
    writeLocalOvertimeSettings(saved);
    return {
      settings: saved,
      source: 'supabase',
      schemaNeedsMigration: false,
    };
  } catch (err) {
    writeLocalOvertimeSettings(normalized);
    return {
      settings: normalized,
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export interface OvertimeSettingsRealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRow: Record<string, unknown> | null;
  oldRow: Record<string, unknown> | null;
}

export function subscribeToOvertimeSettingsRealtime(
  onChange: (event: OvertimeSettingsRealtimeEvent) => void,
  onStatusChange?: (status: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const client = getOvertimeSupabaseClient();
  const channelName = `overtime-settings-realtime-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'overtime_settings' },
      (payload) =>
        onChange({
          eventType: 'INSERT',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'overtime_settings' },
      (payload) =>
        onChange({
          eventType: 'UPDATE',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'overtime_settings' },
      (payload) =>
        onChange({
          eventType: 'DELETE',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .subscribe((status) => {
      onStatusChange?.(status);
    });

  return () => {
    void client.removeChannel(channel);
  };
}

