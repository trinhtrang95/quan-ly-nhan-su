import { Employee } from '../types/hr';
import {
  calculateHoursBetween,
  isOvertimeFormLocked,
  OvertimeFormWithItems,
} from './overtimeFormsService';
import { compareEmployeesByDefaultPriority } from './hrCalculations';

export interface OvertimeMonthlyMemberRow {
  stt: number;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string;
  totalHours: number;
  dailyHours: Record<number, number>;
}

export interface OvertimeMonthlyReportResult {
  year: number;
  month: number;
  daysInMonth: number;
  rows: OvertimeMonthlyMemberRow[];
  dailyTotals: Record<number, number>;
  grandTotalHours: number;
  activeMemberCount: number;
}

export interface CalculateMonthlyOvertimeParams {
  employees: Employee[];
  forms: OvertimeFormWithItems[];
  year: number;
  month: number; // 1..12
  departmentFilter?: string; // 'ALL' or department name
  searchQuery?: string;
}

function roundHours(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Returns the exact number of calendar days in a given year and 1-based month (28, 29, 30, or 31).
 */
export function getDaysInMonth(year: number, month: number): number {
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return 30;
  }
  return new Date(year, month, 0).getDate();
}

/**
 * Formats decimal overtime hours in Vietnamese numeric style (e.g. 4 -> "4", 3.5 -> "3,5", 12.25 -> "12,25").
 */
export function formatOvertimeHoursVN(hours: number, showZero = false): string {
  const rounded = roundHours(hours || 0);
  if (rounded === 0) return showZero ? '0' : '';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Parses an ISO date string (YYYY-MM-DD...) into numeric { year, month, day } without timezone drift.
 */
export function parseIsoDateParts(
  isoDate?: string | null
): { year: number; month: number; day: number } | null {
  if (!isoDate) return null;
  const match = String(isoDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Resolves the effective timestamp (ms) of an overtime form using the latest between updated_at and created_at.
 */
export function getFormEffectiveTimestamp(form: OvertimeFormWithItems): number {
  const updatedMs = form.updated_at ? Date.parse(form.updated_at) : Number.NaN;
  const createdMs = form.created_at ? Date.parse(form.created_at) : Number.NaN;
  const validUpdated = Number.isFinite(updatedMs) ? updatedMs : 0;
  const validCreated = Number.isFinite(createdMs) ? createdMs : 0;
  return Math.max(validUpdated, validCreated);
}

/**
 * Pure aggregation engine for the Monthly Overtime Hours Report ("Giờ Tăng ca").
 * - Aggregates ONLY locked (`is_locked === true || status === 'Đã chốt'`) `overtime_forms` + `overtime_form_items`
 * - Strictly excludes unlocked (`Mới tạo` / `Đã lưu`) and soft-deleted forms/items (`deleted_at != null`)
 * - Sums multiple shifts/turns for the same employee on the same day within the same form
 * - When an employee appears on the same day in multiple locked forms (e.g. an earlier form and
 *   a later multi-day adjustment form), prioritizes the latest form by `updated_at` / `created_at`
 *   to avoid double-counting revised hours.
 * - Computes per-member totals, per-day totals, and grand total
 */
export function calculateMonthlyOvertimeReport({
  employees,
  forms,
  year,
  month,
  departmentFilter = 'ALL',
  searchQuery = '',
}: CalculateMonthlyOvertimeParams): OvertimeMonthlyReportResult {
  const daysInMonth = getDaysInMonth(year, month);

  const employeeById = new Map<string, Employee>();
  const employeeByCode = new Map<string, Employee>();
  for (const emp of employees) {
    employeeById.set(emp.id, emp);
    if (emp.employeeCode?.trim()) {
      employeeByCode.set(emp.employeeCode.trim().toUpperCase(), emp);
    }
  }

  // Accumulator keyed by resolved member key (employee.id or synthetic code/name key)
  interface MemberBucket {
    employeeId: string;
    employeeCode: string;
    fullName: string;
    department: string;
    dailyHours: Record<number, number>;
    totalHours: number;
  }

  interface FormDayCandidate {
    hours: number;
    timestamp: number;
    isMultiDay: boolean;
    order: number;
  }

  const buckets = new Map<string, MemberBucket>();
  // Tracks the winning (latest) form record per (bucketKey -> day)
  const winningFormByMemberDay = new Map<string, Map<number, FormDayCandidate>>();

  // Seed buckets with all current employees so everyone in the selected group is visible
  const sortedEmployees = [...employees].sort(compareEmployeesByDefaultPriority);
  for (const emp of sortedEmployees) {
    buckets.set(emp.id, {
      employeeId: emp.id,
      employeeCode: emp.employeeCode || '',
      fullName: emp.fullName || '',
      department: (emp.department || '').trim(),
      dailyHours: {},
      totalHours: 0,
    });
  }

  // Aggregate active & locked ("Đã chốt") overtime forms and active items
  forms.forEach((form, formIndex) => {
    if (!form || form.deleted_at || !isOvertimeFormLocked(form)) return;
    const formItems = Array.isArray(form.items) ? form.items : [];
    const activeFormDates = new Set<string>();
    for (const item of formItems) {
      if (!item || item.deleted_at) continue;
      const d = (item.overtime_date || form.overtime_date || '').trim();
      if (d) activeFormDates.add(d);
    }
    const isMultiDay =
      activeFormDates.size >= 2 ||
      (Array.isArray(form.overtime_dates) && form.overtime_dates.length >= 2);
    const formTimestamp = getFormEffectiveTimestamp(form);

    // Step 1: Sum turns within THIS form per (bucketKey, day)
    const perFormMemberDay = new Map<string, Map<number, number>>();

    for (const item of formItems) {
      if (!item || item.deleted_at) continue;

      const parsedDate = parseIsoDateParts(item.overtime_date || form.overtime_date);
      if (!parsedDate) continue;
      if (parsedDate.year !== year || parsedDate.month !== month) continue;
      if (parsedDate.day < 1 || parsedDate.day > daysInMonth) continue;

      const itemHours =
        typeof item.total_hours === 'number' &&
        Number.isFinite(item.total_hours) &&
        item.total_hours > 0
          ? roundHours(item.total_hours)
          : calculateHoursBetween(item.start_time, item.end_time);

      if (itemHours <= 0) continue;

      const normalizedCode = (item.employee_code || '').trim().toUpperCase();
      const matchedEmp =
        (item.employee_id ? employeeById.get(item.employee_id) : undefined) ||
        (normalizedCode ? employeeByCode.get(normalizedCode) : undefined);

      const bucketKey = matchedEmp
        ? matchedEmp.id
        : item.employee_id ||
          (normalizedCode
            ? `code:${normalizedCode}`
            : `name:${(item.employee_name || '').trim().toLowerCase()}`);

      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = {
          employeeId: matchedEmp?.id || item.employee_id || bucketKey,
          employeeCode: matchedEmp?.employeeCode || item.employee_code || '',
          fullName: matchedEmp?.fullName || item.employee_name || 'Chưa rõ tên',
          department: (matchedEmp?.department || form.department || '').trim(),
          dailyHours: {},
          totalHours: 0,
        };
        buckets.set(bucketKey, bucket);
      }

      if (!perFormMemberDay.has(bucketKey)) {
        perFormMemberDay.set(bucketKey, new Map());
      }
      const dayMap = perFormMemberDay.get(bucketKey)!;
      dayMap.set(
        parsedDate.day,
        roundHours((dayMap.get(parsedDate.day) || 0) + itemHours)
      );
    }

    // Step 2: Reconcile against previously seen forms — latest updated_at/created_at wins per (member, day)
    perFormMemberDay.forEach((dayMap, bucketKey) => {
      if (!winningFormByMemberDay.has(bucketKey)) {
        winningFormByMemberDay.set(bucketKey, new Map());
      }
      const memberWinners = winningFormByMemberDay.get(bucketKey)!;

      dayMap.forEach((hoursForDay, day) => {
        const existing = memberWinners.get(day);
        const shouldReplace =
          !existing ||
          formTimestamp > existing.timestamp ||
          (formTimestamp === existing.timestamp &&
            ((isMultiDay && !existing.isMultiDay) ||
              (isMultiDay === existing.isMultiDay && formIndex > existing.order)));

        if (shouldReplace) {
          memberWinners.set(day, {
            hours: hoursForDay,
            timestamp: formTimestamp,
            isMultiDay,
            order: formIndex,
          });
        }
      });
    });
  });

  // Step 3: Materialize winning daily hours and per-member totals into buckets
  winningFormByMemberDay.forEach((memberWinners, bucketKey) => {
    const bucket = buckets.get(bucketKey);
    if (!bucket) return;
    let memberTotal = 0;
    memberWinners.forEach((winner, day) => {
      bucket.dailyHours[day] = roundHours(winner.hours);
      memberTotal = roundHours(memberTotal + winner.hours);
    });
    bucket.totalHours = memberTotal;
  });

  const normalizedDept = (departmentFilter || 'ALL').trim();
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  const filteredBuckets = Array.from(buckets.values()).filter((b) => {
    if (normalizedDept && normalizedDept !== 'ALL') {
      if ((b.department || '').trim().toLowerCase() !== normalizedDept.toLowerCase()) {
        return false;
      }
    }
    if (normalizedQuery) {
      const matchesName = b.fullName.toLowerCase().includes(normalizedQuery);
      const matchesCode = b.employeeCode.toLowerCase().includes(normalizedQuery);
      const matchesDept = b.department.toLowerCase().includes(normalizedQuery);
      if (!matchesName && !matchesCode && !matchesDept) return false;
    }
    return true;
  });

  const dailyTotals: Record<number, number> = {};
  for (let d = 1; d <= daysInMonth; d += 1) {
    dailyTotals[d] = 0;
  }

  let grandTotalHours = 0;
  let activeMemberCount = 0;

  const rows: OvertimeMonthlyMemberRow[] = filteredBuckets.map((bucket, idx) => {
    if (bucket.totalHours > 0) activeMemberCount += 1;
    grandTotalHours = roundHours(grandTotalHours + bucket.totalHours);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const h = bucket.dailyHours[d] || 0;
      if (h > 0) {
        dailyTotals[d] = roundHours(dailyTotals[d] + h);
      }
    }
    return {
      stt: idx + 1,
      employeeId: bucket.employeeId,
      employeeCode: bucket.employeeCode,
      fullName: bucket.fullName,
      department: bucket.department,
      totalHours: roundHours(bucket.totalHours),
      dailyHours: bucket.dailyHours,
    };
  });

  return {
    year,
    month,
    daysInMonth,
    rows,
    dailyTotals,
    grandTotalHours,
    activeMemberCount,
  };
}
