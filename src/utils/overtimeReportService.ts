import { Employee } from '../types/hr';
import {
  calculateHoursBetween,
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
 * Pure aggregation engine for the Monthly Overtime Hours Report ("Giờ Tăng ca").
 * - Aggregates saved `overtime_forms` + `overtime_form_items`
 * - Strictly excludes soft-deleted forms and items (`deleted_at != null`)
 * - Sums multiple shifts/turns for the same employee on the same calendar day
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

  const buckets = new Map<string, MemberBucket>();

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

  // Aggregate active (non-soft-deleted) overtime forms and items
  for (const form of forms) {
    if (!form || form.deleted_at) continue;
    const formItems = Array.isArray(form.items) ? form.items : [];

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
          (normalizedCode ? `code:${normalizedCode}` : `name:${(item.employee_name || '').trim().toLowerCase()}`);

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

      const prevDayHours = bucket.dailyHours[parsedDate.day] || 0;
      bucket.dailyHours[parsedDate.day] = roundHours(prevDayHours + itemHours);
      bucket.totalHours = roundHours(bucket.totalHours + itemHours);
    }
  }

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
