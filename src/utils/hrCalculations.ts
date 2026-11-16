import {
  DashboardKPIs,
  DepartmentGroup,
  DistributionItem,
  Employee,
  EmployeeAnnualMatrixRow,
  LeaveAccrualMode,
  LeaveBalanceRecord,
  LeavePolicyConfig,
  LeaveRecord,
  LeaveRecordType,
  MonthCellData,
} from '../types/hr';
import { formatCommuneProvinceAddress } from './vnAddressData';

export const LEAVE_TYPE_META: Record<
  LeaveRecordType,
  { label: string; shortLabel: string; unit: 'ngày' | 'giờ'; color: string; bgLight: string; textColor: string }
> = {
  annual_leave: {
    label: 'Nghỉ phép năm',
    shortLabel: 'Phép năm',
    unit: 'ngày',
    color: '#0D9488',
    bgLight: '#F0FDFA',
    textColor: '#0F766E',
  },
  unpaid_leave: {
    label: 'Nghỉ không lương',
    shortLabel: 'Không lương',
    unit: 'ngày',
    color: '#D97706',
    bgLight: '#FFFBEB',
    textColor: '#B45309',
  },
  regime_leave: {
    label: 'Nghỉ chế độ (Ốm/Thai sản/Hiếu hỷ)',
    shortLabel: 'Chế độ',
    unit: 'ngày',
    color: '#0284C7',
    bgLight: '#F0F9FF',
    textColor: '#0369A1',
  },
  late_early: {
    label: 'Đi muộn',
    shortLabel: 'Đi muộn',
    unit: 'giờ',
    color: '#EF4444',
    bgLight: '#FEF2F2',
    textColor: '#DC2626',
  },
};

/**
 * Formats YYYY-MM-DD or DD/MM/YYYY to DD/MM/YYYY for Vietnamese display
 */
export function formatDateVN(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed === '-' || trimmed === '—') return '';
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
  }
  return trimmed;
}

/**
 * Parses a date string (YYYY-MM-DD or DD/MM/YYYY) into a UTC timestamp for accurate sorting.
 * Returns null if the string is empty or invalid so empty dates can be pushed to the bottom.
 */
export function parseComparableDate(raw?: string | null): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s === '-' || s === '—') return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    return Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  }

  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : parsed;
}

export type EmployeeSortField =
  | 'employeeCode'
  | 'fullName'
  | 'dob'
  | 'gender'
  | 'cccdDate'
  | 'department'
  | 'position'
  | 'address'
  | 'joinDate'
  | 'status'
  | null;

export type SortDirection = 'asc' | 'desc' | null;

export const DEPARTMENT_PRIORITY_ORDER: string[] = [
  'quản lý chung',
  'jig/auto 2',
  'me',
  'auto 1',
  'pe',
  'st',
  'document',
  'iot',
];

export const POSITION_PRIORITY_ORDER: string[] = [
  'trưởng bộ phận',
  'trưởng nhóm',
  'phó nhóm',
  'nhân viên',
];

const DEPT_PRIORITY_STORAGE_KEY = 'hr_pro_dept_priority_order_v1';
const POS_PRIORITY_STORAGE_KEY = 'hr_pro_pos_priority_order_v1';

function normalizeDeptKey(val?: string | null): string {
  return (val || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
}

function normalizePosKey(val?: string | null): string {
  return (val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

let customDepartmentOrder: string[] | null = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(DEPT_PRIORITY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s) => normalizeDeptKey(String(s))).filter(Boolean);
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
})();

let customPositionOrder: string[] | null = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(POS_PRIORITY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s) => normalizePosKey(String(s))).filter(Boolean);
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
})();

export function setCustomDepartmentPriorityOrder(
  orderedNames: string[] | null
): void {
  if (!orderedNames || orderedNames.length === 0) {
    customDepartmentOrder = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(DEPT_PRIORITY_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
    return;
  }

  customDepartmentOrder = orderedNames
    .map((s) => normalizeDeptKey(s))
    .filter(Boolean);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        DEPT_PRIORITY_STORAGE_KEY,
        JSON.stringify(customDepartmentOrder)
      );
    }
  } catch {
    // Ignore
  }
}

export function setCustomPositionPriorityOrder(
  orderedNames: string[] | null
): void {
  if (!orderedNames || orderedNames.length === 0) {
    customPositionOrder = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(POS_PRIORITY_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
    return;
  }

  customPositionOrder = orderedNames
    .map((s) => normalizePosKey(s))
    .filter(Boolean);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        POS_PRIORITY_STORAGE_KEY,
        JSON.stringify(customPositionOrder)
      );
    }
  } catch {
    // Ignore
  }
}

export function getDepartmentPriorityRank(department?: string | null): number {
  const clean = normalizeDeptKey(department);
  if (!clean || clean === '-' || clean === '—') {
    return 999; // Chưa phân nhóm xếp ở cuối cùng
  }

  if (customDepartmentOrder && customDepartmentOrder.length > 0) {
    const customIdx = customDepartmentOrder.indexOf(clean);
    if (customIdx !== -1) {
      return customIdx;
    }
  }

  const idx = DEPARTMENT_PRIORITY_ORDER.indexOf(clean);
  if (idx !== -1) {
    return customDepartmentOrder && customDepartmentOrder.length > 0
      ? customDepartmentOrder.length + idx
      : idx;
  }
  return 100; // Các nhóm mới phát sinh xếp tiếp ngay sau các nhóm đã cấu hình
}

export function getPositionPriorityRank(position?: string | null): number {
  const clean = normalizePosKey(position);
  if (!clean || clean === '-' || clean === '—') return 99;

  if (customPositionOrder && customPositionOrder.length > 0) {
    const exactIdx = customPositionOrder.indexOf(clean);
    if (exactIdx !== -1) {
      return exactIdx + 1;
    }
    const partialIdx = customPositionOrder.findIndex(
      (p) => p && clean.includes(p)
    );
    if (partialIdx !== -1) {
      return partialIdx + 1;
    }
  }

  const offset =
    customPositionOrder && customPositionOrder.length > 0
      ? customPositionOrder.length
      : 0;
  if (clean.includes('trưởng bộ phận')) return offset + 1;
  if (clean.includes('trưởng nhóm')) return offset + 2;
  if (clean.includes('phó nhóm') || clean.includes('phó bộ phận'))
    return offset + 3;
  if (clean.includes('nhân viên')) return offset + 4;
  return offset + 5;
}

export function compareEmployeesByDefaultPriority(
  a: Employee,
  b: Employee
): number {
  // Tầng 1: Thứ tự ưu tiên Nhóm / Bộ phận
  // Quản lý chung > JIG/AUTO 2 > ME > AUTO 1 > PE > ST > DOCUMENT > IOT (hoặc theo thứ tự Kéo thả trong Cài đặt)
  const deptRankA = getDepartmentPriorityRank(a.department);
  const deptRankB = getDepartmentPriorityRank(b.department);
  if (deptRankA !== deptRankB) {
    return deptRankA - deptRankB;
  }

  // Nếu cả 2 cùng thuộc nhóm mới phát sinh (rank 100), xếp theo tên nhóm A-Z
  if (deptRankA === 100) {
    const deptCmp = (a.department || '').localeCompare(
      b.department || '',
      'vi',
      { sensitivity: 'base', numeric: true }
    );
    if (deptCmp !== 0) return deptCmp;
  }

  // Tầng 2: Thứ tự ưu tiên Chức vụ trong cùng 1 Nhóm
  // Trưởng bộ phận > Trưởng nhóm > Phó nhóm > Nhân viên
  const posRankA = getPositionPriorityRank(a.position);
  const posRankB = getPositionPriorityRank(b.position);
  if (posRankA !== posRankB) {
    return posRankA - posRankB;
  }

  // Tầng 3: Cùng chức vụ thì xếp theo Mã nhân viên tăng dần
  return (a.employeeCode || '').localeCompare(b.employeeCode || '', 'vi', {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Sorts employees by the specified column and direction.
 * When field or direction is null, sorts by the 2-tier default priority (Department > Position > EmployeeCode).
 * Empty values ("", null, undefined, "-") are ALWAYS pushed to the bottom of the list when sorting a specific column.
 */
export function sortEmployees(
  employees: Employee[],
  field: EmployeeSortField,
  direction: SortDirection
): Employee[] {
  if (!field || !direction) {
    return [...employees].sort(compareEmployeesByDefaultPriority);
  }

  const factor = direction === 'asc' ? 1 : -1;

  return [...employees].sort((a, b) => {
    if (field === 'joinDate' || field === 'dob' || field === 'cccdDate') {
      const tA = parseComparableDate(a[field]);
      const tB = parseComparableDate(b[field]);
      if (tA === null && tB === null) {
        return compareEmployeesByDefaultPriority(a, b);
      }
      if (tA === null) return 1; // Push empty to bottom
      if (tB === null) return -1; // Push empty to bottom
      if (tA !== tB) return (tA - tB) * factor;
      return compareEmployeesByDefaultPriority(a, b);
    }

    if (field === 'department') {
      const rankA = getDepartmentPriorityRank(a.department);
      const rankB = getDepartmentPriorityRank(b.department);
      if (rankA === 999 && rankB === 999) {
        return compareEmployeesByDefaultPriority(a, b);
      }
      if (rankA === 999) return 1; // Push empty to bottom
      if (rankB === 999) return -1; // Push empty to bottom
      if (rankA !== rankB) return (rankA - rankB) * factor;
      const cmpDept = (a.department || '').localeCompare(
        b.department || '',
        'vi',
        {
          numeric: true,
          sensitivity: 'base',
        }
      );
      if (cmpDept !== 0) return cmpDept * factor;
      return compareEmployeesByDefaultPriority(a, b);
    }

    if (field === 'position') {
      const rankA = getPositionPriorityRank(a.position);
      const rankB = getPositionPriorityRank(b.position);
      if (rankA === 99 && rankB === 99) {
        return compareEmployeesByDefaultPriority(a, b);
      }
      if (rankA === 99) return 1; // Push empty to bottom
      if (rankB === 99) return -1; // Push empty to bottom
      if (rankA !== rankB) return (rankA - rankB) * factor;
      const cmpPos = (a.position || '').localeCompare(b.position || '', 'vi', {
        numeric: true,
        sensitivity: 'base',
      });
      if (cmpPos !== 0) return cmpPos * factor;
      return compareEmployeesByDefaultPriority(a, b);
    }

    const rawA =
      field === 'address'
        ? formatCommuneProvinceAddress(a.address)
        : (a[field] || '').toString().trim();
    const rawB =
      field === 'address'
        ? formatCommuneProvinceAddress(b.address)
        : (b[field] || '').toString().trim();
    const emptyA = !rawA || rawA === '-' || rawA === '—';
    const emptyB = !rawB || rawB === '-' || rawB === '—';

    if (emptyA && emptyB) {
      return compareEmployeesByDefaultPriority(a, b);
    }
    if (emptyA) return 1; // Always push empty to bottom
    if (emptyB) return -1; // Always push empty to bottom

    const cmp = rawA.localeCompare(rawB, 'vi', {
      numeric: true,
      sensitivity: 'base',
    });
    if (cmp !== 0) return cmp * factor;

    return compareEmployeesByDefaultPriority(a, b);
  });
}

/**
 * Parses year and month (1..12) from YYYY-MM-DD
 */
export function getYearMonth(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split('-').map(Number);
  return { year: y || 2026, month: m || 1 };
}

/**
 * Checks if a date YYYY-MM-DD falls within [startDate, endDate] inclusive
 */
export function isDateInRange(targetDate: string, startDate: string, endDate: string): boolean {
  return targetDate >= startDate && targetDate <= endDate;
}

const LEAVE_POLICY_STORAGE_KEY = 'hr_pro_leave_policy_v1';
const LEAVE_BALANCES_STORAGE_KEY = 'hr_pro_leave_balances_v1';

// In-memory fallback so unit tests in Node (without window.localStorage) work seamlessly
let inMemoryLeaveBalances: Record<string, LeaveBalanceRecord> = {};

export function loadLeaveBalancesMap(
  year: number = 2026
): Record<string, LeaveBalanceRecord> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LEAVE_BALANCES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, LeaveBalanceRecord>;
        if (parsed && typeof parsed === 'object') {
          inMemoryLeaveBalances = parsed;
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }

  const result: Record<string, LeaveBalanceRecord> = {};
  for (const [k, v] of Object.entries(inMemoryLeaveBalances)) {
    if (v && v.year === year && v.employeeCode) {
      result[v.employeeCode.trim().toUpperCase()] = v;
    } else if (k.startsWith(`${year}_`) && v) {
      result[k.slice(`${year}_`.length).toUpperCase()] = v;
    }
  }
  return result;
}

export function saveLeaveBalancesBatch(
  entries: Array<{
    employeeCode: string;
    employeeId?: string;
    fullName: string;
    carried_over: number;
    used_leave: number;
    cutoffDate?: string;
  }>,
  existingRecords: LeaveRecord[] = [],
  year: number = 2026
): Record<string, LeaveBalanceRecord> {
  const currentAll: Record<string, LeaveBalanceRecord> = {
    ...inMemoryLeaveBalances,
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LEAVE_BALANCES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.assign(currentAll, parsed);
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }

  const nowIso = new Date().toISOString();

  for (const item of entries) {
    const code = item.employeeCode.trim().toUpperCase();
    if (!code) continue;
    const cutoffDate = item.cutoffDate || `${year}-10-31`;

    // Snapshot any pre-existing annual_leave records after cutoffDate at the moment of import
    // so that immediately after import, "Đã nghỉ" equals the exact imported `used_leave`,
    // and only newly created leave records after import are added on top.
    const baselineNovRecordIds = existingRecords
      .filter((r) => {
        if (r.type !== 'annual_leave') return false;
        if (item.employeeId && r.employeeId !== item.employeeId) return false;
        return r.startDate > cutoffDate && getYearMonth(r.startDate).year === year;
      })
      .map((r) => r.id);

    const record: LeaveBalanceRecord = {
      employeeCode: code,
      employeeId: item.employeeId,
      fullName: item.fullName,
      year,
      carried_over: Number(Number(item.carried_over || 0).toFixed(2)),
      used_leave: Number(Number(item.used_leave || 0).toFixed(2)),
      cutoffDate,
      baselineNovRecordIds,
      updatedAt: nowIso,
    };

    currentAll[`${year}_${code}`] = record;
  }

  inMemoryLeaveBalances = currentAll;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        LEAVE_BALANCES_STORAGE_KEY,
        JSON.stringify(currentAll)
      );
    }
  } catch {
    // Ignore storage write errors
  }

  // Ensure monthly accrual + allowCarryOver is active for Go-Live mid/late year equation
  saveLeavePolicyConfig({
    accrualMode: 'monthly',
    allowCarryOver: true,
  });

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hr-leave-balances-change', {
          detail: loadLeaveBalancesMap(year),
        })
      );
    }
  } catch {
    // Ignore event errors
  }

  return loadLeaveBalancesMap(year);
}

export function clearLeaveBalancesStorage(): void {
  inMemoryLeaveBalances = {};
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LEAVE_BALANCES_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent('hr-leave-balances-change', { detail: {} })
      );
    }
  } catch {
    // Ignore errors
  }
}

function matchesEmployee(rId?: string | null, emp?: Employee): boolean {
  if (!rId || !emp) return false;
  const a = rId.trim();
  const id = (emp.id || '').trim();
  const code = (emp.employeeCode || '').trim();
  return a === id || a.toUpperCase() === code.toUpperCase();
}

function isAfterCutoff(startDateStr?: string | null, cutoffDateStr?: string | null): boolean {
  if (!startDateStr || !cutoffDateStr) return false;
  const t1 = parseComparableDate(startDateStr);
  const t2 = parseComparableDate(cutoffDateStr);
  if (t1 !== null && t2 !== null) {
    return t1 > t2;
  }
  return startDateStr > cutoffDateStr;
}

/**
 * Quét và đồng bộ hồi tố (Retroactive Data Sync):
 * Tính TỔNG số ngày nghỉ phép năm (annual_leave) đã tồn tại từ cơ sở dữ liệu
 * cộng với số chốt đầu kỳ (đến 31/10) để cho ra số [Đã nghỉ] chính xác tuyệt đối.
 */
export function performRetroactiveLeaveScanAndSync(
  employees: Employee[],
  records: LeaveRecord[],
  year: number = 2026
): Record<string, number> {
  const map = loadLeaveBalancesMap(year);
  const result: Record<string, number> = {};

  for (const emp of employees) {
    const code = (emp.employeeCode || '').trim().toUpperCase();
    if (!code) continue;

    const balanceRec = map[code];
    const baseUsed = balanceRec
      ? balanceRec.used_leave
      : typeof emp.openingUsedLeave === 'number'
      ? emp.openingUsedLeave
      : 0;

    const cutoffDate = balanceRec?.cutoffDate || `${year}-10-31`;
    const baselineIds = new Set(balanceRec?.baselineNovRecordIds || []);

    const postCutoffUsed = records
      .filter((r) => {
        if (!matchesEmployee(r.employeeId, emp) || r.type !== 'annual_leave') return false;
        if (baselineIds.has(r.id)) return false;
        const { year: rYear } = getYearMonth(r.startDate);
        return rYear === year && isAfterCutoff(r.startDate, cutoffDate);
      })
      .reduce((sum, r) => Number((sum + r.amount).toFixed(2)), 0);

    const totalUsed = Number((baseUsed + postCutoffUsed).toFixed(2));
    result[code] = totalUsed;
  }

  return result;
}

export function loadLeavePolicyConfig(): LeavePolicyConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LEAVE_POLICY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const accrualMode: LeaveAccrualMode =
          parsed?.accrualMode === 'monthly' ? 'monthly' : 'upfront';
        const allowCarryOver =
          typeof parsed?.allowCarryOver === 'boolean'
            ? parsed.allowCarryOver
            : true;
        return { accrualMode, allowCarryOver };
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    accrualMode: 'monthly',
    allowCarryOver: true,
  };
}

export function saveLeavePolicyConfig(config: LeavePolicyConfig): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        LEAVE_POLICY_STORAGE_KEY,
        JSON.stringify(config)
      );
      window.dispatchEvent(
        new CustomEvent('hr-leave-policy-change', { detail: config })
      );
    }
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Calculates Leave Accrual & Carryover breakdown for an employee:
 * Tổng quỹ phép = [Tích lũy năm nay] + [Tồn năm trước]
 * Còn lại = [Tổng quỹ phép] - [Đã nghỉ (Chốt đầu kỳ đến 31/10 + phát sinh mới từ tháng 11 trở đi)]
 */
export function calculateLeaveAccrualBreakdown(
  employee: Employee,
  records: LeaveRecord[],
  year: number,
  upToMonth: number = 12,
  policyOverride?: LeavePolicyConfig,
  defaultQuotaFallback: number = 12,
  balancesMapOverride?: Record<string, LeaveBalanceRecord>
): {
  annualQuota: number;
  accruedLeaveDays: number;
  carriedOverLeaveDays: number;
  totalLeaveFund: number;
  usedAnnualLeaveDays: number;
  remainingAnnualLeave: number;
  hasOpeningBalance?: boolean;
} {
  const policy = policyOverride || loadLeavePolicyConfig();
  const clampedMonth = Math.max(1, Math.min(12, upToMonth || 12));
  const balancesMap = balancesMapOverride || loadLeaveBalancesMap(year);
  const empCodeKey = (employee.employeeCode || '').trim().toUpperCase();
  const balanceRec = empCodeKey ? balancesMap[empCodeKey] : undefined;
  const hasOpeningBalance =
    Boolean(balanceRec) || typeof employee.openingUsedLeave === 'number';

  const quota = hasOpeningBalance
    ? defaultQuotaFallback || 12
    : typeof employee.standardAnnualLeave === 'number' &&
        employee.standardAnnualLeave > 0
      ? employee.standardAnnualLeave
      : defaultQuotaFallback;

  // 1. Tính Phép tích lũy năm nay theo tháng hiện tại (hoặc Cấp 1 lần đầu năm)
  let accruedLeaveDays = quota;
  if (hasOpeningBalance || policy.accrualMode === 'monthly') {
    if (hasOpeningBalance) {
      // Khi chốt số dư đầu kỳ ở tháng hiện tại (VD: tháng 11), hệ thống tự đếm theo tháng hiện tại (11 ngày cho định mức 12)
      accruedLeaveDays = Number(((quota / 12) * clampedMonth).toFixed(2));
    } else {
      let workingMonthsInYear = clampedMonth;
      if (
        employee.joinDate &&
        employee.joinDate.trim() &&
        employee.joinDate.trim() !== '-'
      ) {
        const { year: joinYear, month: joinMonth } = getYearMonth(
          employee.joinDate
        );
        if (joinYear > year) {
          workingMonthsInYear = 0;
        } else if (joinYear === year) {
          workingMonthsInYear = Math.max(0, clampedMonth - joinMonth + 1);
        } else {
          workingMonthsInYear = clampedMonth;
        }
      }
      accruedLeaveDays = Number(
        ((quota / 12) * workingMonthsInYear).toFixed(2)
      );
    }
  }

  // 2. Tính Phép năm cũ dồn sang (Tồn năm trước - carried_over)
  let carriedOverLeaveDays = 0;
  if (balanceRec) {
    carriedOverLeaveDays = policy.allowCarryOver
      ? Number(balanceRec.carried_over.toFixed(2))
      : 0;
  } else if (policy.allowCarryOver) {
    if (
      typeof employee.carriedOverLeave === 'number' &&
      !Number.isNaN(employee.carriedOverLeave)
    ) {
      carriedOverLeaveDays = Number(employee.carriedOverLeave.toFixed(2));
    } else {
      const prevYear = year - 1;
      const prevYearRecords = records.filter((r) => {
        if (!matchesEmployee(r.employeeId, employee) || r.type !== 'annual_leave') {
          return false;
        }
        return getYearMonth(r.startDate).year === prevYear;
      });
      if (prevYearRecords.length > 0) {
        const usedPrevYear = prevYearRecords.reduce(
          (sum, r) => Number((sum + r.amount).toFixed(2)),
          0
        );
        carriedOverLeaveDays = Math.max(
          0,
          Number((quota - usedPrevYear).toFixed(2))
        );
      }
    }
  }

  // 3. Tổng quỹ phép = [Tích lũy năm nay] + [Tồn năm trước]
  const totalLeaveFund = Number(
    (accruedLeaveDays + carriedOverLeaveDays).toFixed(2)
  );

  // 4. Tính Số đã nghỉ (used_leave)
  // - Nếu đã Chốt số dư đầu kỳ (đến 31/10): lấy số dư `used_leave` vừa import + các đơn nghỉ phép năm phát sinh MỚI từ tháng 11 trở đi
  // - Nếu chưa Chốt số dư đầu kỳ: cộng từ bảng `records` trong năm `year` tính đến `clampedMonth`
  let usedAnnualLeaveDays = 0;
  if (balanceRec || typeof employee.openingUsedLeave === 'number') {
    const baseUsed = balanceRec
      ? balanceRec.used_leave
      : Number(employee.openingUsedLeave || 0);
    const cutoffDate = balanceRec?.cutoffDate || `${year}-10-31`;
    const baselineIds = new Set(balanceRec?.baselineNovRecordIds || []);

    const postCutoffUsed = records
      .filter((r) => {
        if (!matchesEmployee(r.employeeId, employee) || r.type !== 'annual_leave') {
          return false;
        }
        if (baselineIds.has(r.id)) {
          return false;
        }
        const { year: rYear, month: rMonth } = getYearMonth(r.startDate);
        return (
          rYear === year &&
          rMonth <= clampedMonth &&
          isAfterCutoff(r.startDate, cutoffDate)
        );
      })
      .reduce((sum, r) => Number((sum + r.amount).toFixed(2)), 0);

    usedAnnualLeaveDays = Number((baseUsed + postCutoffUsed).toFixed(2));
  } else {
    usedAnnualLeaveDays = records
      .filter((r) => {
        if (!matchesEmployee(r.employeeId, employee) || r.type !== 'annual_leave') {
          return false;
        }
        const { year: rYear, month: rMonth } = getYearMonth(r.startDate);
        return rYear === year && rMonth <= clampedMonth;
      })
      .reduce((sum, r) => Number((sum + r.amount).toFixed(2)), 0);
  }

  // 5. Còn lại = [Tổng quỹ phép] - [Đã nghỉ]
  const remainingAnnualLeave = Number(
    (totalLeaveFund - usedAnnualLeaveDays).toFixed(2)
  );

  return {
    annualQuota: quota,
    accruedLeaveDays,
    carriedOverLeaveDays,
    totalLeaveFund,
    usedAnnualLeaveDays,
    remainingAnnualLeave,
    hasOpeningBalance,
  };
}

/**
 * Builds the 12-month Annual Matrix Report rows for a given year and optional department filter
 */
export function calculateAnnualMatrixReport(
  employees: Employee[],
  records: LeaveRecord[],
  year: number,
  departmentFilter: string = 'ALL',
  policyOverride?: LeavePolicyConfig,
  upToMonth: number = 12
): EmployeeAnnualMatrixRow[] {
  const policy = policyOverride || loadLeavePolicyConfig();
  const filteredEmployees =
    departmentFilter === 'ALL'
      ? employees
      : employees.filter((e) => e.department === departmentFilter);

  return filteredEmployees.map((employee) => {
    const months: Record<number, MonthCellData> = {};
    for (let m = 1; m <= 12; m++) {
      months[m] = {
        month: m,
        annualLeaveDays: 0,
        unpaidLeaveDays: 0,
        regimeLeaveDays: 0,
        lateHours: 0,
        lateCount: 0,
        records: [],
      };
    }

    let totalAnnualUsed = 0;
    let totalUnpaidDays = 0;
    let totalRegimeDays = 0;
    let totalLateHours = 0;
    let totalLateCount = 0;

    const empRecords = records.filter((r) => {
      if (r.employeeId !== employee.id) return false;
      const { year: rYear } = getYearMonth(r.startDate);
      return rYear === year;
    });

    for (const rec of empRecords) {
      const { month } = getYearMonth(rec.startDate);
      const cell = months[month];
      if (!cell) continue;

      cell.records.push(rec);

      if (rec.type === 'annual_leave') {
        cell.annualLeaveDays = Number((cell.annualLeaveDays + rec.amount).toFixed(2));
        totalAnnualUsed = Number((totalAnnualUsed + rec.amount).toFixed(2));
      } else if (rec.type === 'unpaid_leave') {
        cell.unpaidLeaveDays = Number((cell.unpaidLeaveDays + rec.amount).toFixed(2));
        totalUnpaidDays = Number((totalUnpaidDays + rec.amount).toFixed(2));
      } else if (rec.type === 'regime_leave') {
        cell.regimeLeaveDays = Number((cell.regimeLeaveDays + rec.amount).toFixed(2));
        totalRegimeDays = Number((totalRegimeDays + rec.amount).toFixed(2));
      } else if (rec.type === 'late_early') {
        cell.lateHours = Number((cell.lateHours + rec.amount).toFixed(2));
        cell.lateCount += 1;
        totalLateHours = Number((totalLateHours + rec.amount).toFixed(2));
        totalLateCount += 1;
      }
    }

    const breakdown = calculateLeaveAccrualBreakdown(
      employee,
      records,
      year,
      upToMonth,
      policy
    );

    return {
      employee,
      months,
      accruedLeaveDays: breakdown.accruedLeaveDays,
      carriedOverLeaveDays: breakdown.carriedOverLeaveDays,
      totalAnnualUsed: breakdown.usedAnnualLeaveDays,
      remainingAnnualLeave: breakdown.remainingAnnualLeave,
      totalUnpaidDays,
      totalRegimeDays,
      totalLateHours,
      totalLateCount,
    };
  });
}

export interface MonthlyDayColumnMeta {
  day: number; // 1..31
  dayLabel: string; // '01'..'31'
  dateStr: string; // 'YYYY-MM-DD'
  weekdayLabel: string; // 'CN', 'T2'..'T7'
  isSunday: boolean;
  isWeekend: boolean;
  isToday: boolean;
}

export interface MonthlyDayBadge {
  id: string;
  type: LeaveRecordType;
  code: 'PN' | 'CĐ' | 'KL' | 'ĐM'; // Standardized short badge code
  durationText: string; // e.g. '30p', '1.5h', '3h', '1 ngày', '0.5 ngày'
  tooltip: string;
  record: LeaveRecord;
}

export interface EmployeeMonthlyAttendanceRow {
  employee: Employee;
  accruedLeaveDays: number;      // Phép tích lũy theo tháng làm việc hiện tại
  carriedOverLeaveDays: number;  // Phép năm cũ dồn sang
  usedAnnualLeaveDays: number;   // Số đã nghỉ
  remainingAnnualLeave: number;  // = accruedLeaveDays + carriedOverLeaveDays - usedAnnualLeaveDays
  monthAnnualDays: number;
  monthRegimeDays: number;
  monthAnnualAndRegimeDays: number;
  monthAnnualAndRegimeCount: number;
  monthUnpaidDays: number;
  monthUnpaidCount: number;
  monthLateHours: number;
  monthLateCount: number;
  hasAnyActivityInMonth: boolean;
  monthRecords: LeaveRecord[];
  dayBadges: Record<number, MonthlyDayBadge[]>; // day 1..daysInMonth -> badges
}

export interface MonthlyAttendanceSummaryReport {
  year: number;
  month: number;
  daysInMonth: number;
  dayColumns: MonthlyDayColumnMeta[];
  rows: EmployeeMonthlyAttendanceRow[];
  kpi: {
    totalAnnualAndRegimeDays: number;
    totalAnnualAndRegimeCount: number;
    totalUnpaidDays: number;
    totalUnpaidCount: number;
    totalLateHours: number;
    totalLateCount: number;
    employeesWithActivityCount: number;
    totalEmployeesCount: number;
  };
}

/**
 * Formats late hours into a compact badge code (e.g. 0.5 -> '30p', 0.25 -> '15p', 1 -> '1h', 1.5 -> '1.5h')
 */
export function formatLateDurationBadge(hours: number): string {
  if (hours <= 0) return '0p';
  if (hours < 1) {
    return `${Math.round(hours * 60)}p`;
  }
  return `${Number(hours.toFixed(2))}h`;
}

/**
 * Returns a short group/department code (e.g. PE, ST, ME, IOT, DOC, JIG 2, AUTO 1, QLC)
 */
export function getShortGroupCode(
  department?: string | null,
  groups?: DepartmentGroup[]
): string {
  const raw = (department || '').trim();
  if (!raw || raw === '-' || raw === '—') return '-';

  if (groups && groups.length > 0) {
    const matched = groups.find(
      (g) => g.name.trim().toLowerCase() === raw.toLowerCase()
    );
    if (matched && matched.code && matched.code.trim()) {
      return matched.code.trim().toUpperCase();
    }
  }

  const lower = raw.toLowerCase();
  if (lower.includes('quản lý chung')) return 'QLC';
  if (lower.includes('document')) return 'DOC';
  if (lower.includes('jig/auto 2')) return 'JIG 2';
  if (lower.includes('auto 1')) return 'AUTO 1';
  if (raw.length <= 8) return raw.toUpperCase();

  // Extract uppercase acronym for longer department names
  const words = raw.split(/[\s/&,-]+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 6);
  }
  return raw.slice(0, 6).toUpperCase();
}

/**
 * Builds the Monthly Attendance & Leave Matrix Report for a given year, month (1..12),
 * department filter, and search query.
 */
export function calculateMonthlyAttendanceMatrix(
  employees: Employee[],
  records: LeaveRecord[],
  year: number,
  month: number,
  departmentFilter: string = 'ALL',
  searchQuery: string = '',
  todayDateStr?: string,
  policyOverride?: LeavePolicyConfig
): MonthlyAttendanceSummaryReport {
  const policy = policyOverride || loadLeavePolicyConfig();
  const resolvedToday =
    todayDateStr ||
    (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();

  const daysInMonth = new Date(year, month, 0).getDate();
  const weekdayMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const monthPadded = String(month).padStart(2, '0');

  const dayColumns: MonthlyDayColumnMeta[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayLabel = String(d).padStart(2, '0');
    const dateStr = `${year}-${monthPadded}-${dayLabel}`;
    const dt = new Date(year, month - 1, d);
    const dow = dt.getDay();
    dayColumns.push({
      day: d,
      dayLabel,
      dateStr,
      weekdayLabel: weekdayMap[dow],
      isSunday: dow === 0,
      isWeekend: dow === 0 || dow === 6,
      isToday: dateStr === resolvedToday,
    });
  }

  // Filter employees by department and searchQuery (Mã NV or Họ tên), then sort by default 2-tier priority
  const q = searchQuery.trim().toLowerCase();
  const filteredEmployees = sortEmployees(
    employees.filter((emp) => {
      if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) {
        return false;
      }
      if (!q) return true;
      return (
        emp.employeeCode.toLowerCase().includes(q) ||
        emp.fullName.toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q)
      );
    }),
    null,
    null
  );

  const monthStartStr = `${year}-${monthPadded}-01`;
  const monthEndStr = `${year}-${monthPadded}-${String(daysInMonth).padStart(2, '0')}`;

  let totalAnnualAndRegimeDays = 0;
  let totalAnnualAndRegimeCount = 0;
  let totalUnpaidDays = 0;
  let totalUnpaidCount = 0;
  let totalLateHours = 0;
  let totalLateCount = 0;
  let employeesWithActivityCount = 0;

  const rows: EmployeeMonthlyAttendanceRow[] = filteredEmployees.map((employee) => {
    const breakdown = calculateLeaveAccrualBreakdown(
      employee,
      records,
      year,
      policy.accrualMode === 'monthly' ? month : 12,
      policy
    );

    const dayBadges: Record<number, MonthlyDayBadge[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      dayBadges[d] = [];
    }

    // Find all records for this employee that overlap with this month
    const empMonthRecords = records.filter((rec) => {
      if (rec.employeeId !== employee.id) return false;
      const start = rec.startDate;
      const end = rec.endDate || rec.startDate;
      return start <= monthEndStr && end >= monthStartStr;
    });

    let monthAnnualDays = 0;
    let monthRegimeDays = 0;
    let monthAnnualAndRegimeCount = 0;
    let monthUnpaidDays = 0;
    let monthUnpaidCount = 0;
    let monthLateHours = 0;
    let monthLateCount = 0;

    for (const rec of empMonthRecords) {
      const { year: rYear, month: rMonth } = getYearMonth(rec.startDate);
      if (rYear === year && rMonth === month) {
        if (rec.type === 'annual_leave') {
          monthAnnualDays = Number((monthAnnualDays + rec.amount).toFixed(2));
          monthAnnualAndRegimeCount += 1;
        } else if (rec.type === 'regime_leave') {
          monthRegimeDays = Number((monthRegimeDays + rec.amount).toFixed(2));
          monthAnnualAndRegimeCount += 1;
        } else if (rec.type === 'unpaid_leave') {
          monthUnpaidDays = Number((monthUnpaidDays + rec.amount).toFixed(2));
          monthUnpaidCount += 1;
        } else if (rec.type === 'late_early') {
          monthLateHours = Number((monthLateHours + rec.amount).toFixed(2));
          monthLateCount += 1;
        }
      }

      // Populate daily badges for each day in the month covered by [rec.startDate, rec.endDate]
      const start = rec.startDate;
      const end = rec.endDate || rec.startDate;

      for (const col of dayColumns) {
        if (isDateInRange(col.dateStr, start, end)) {
          let code: 'PN' | 'CĐ' | 'KL' | 'ĐM' = 'PN';
          let durationText = `${rec.amount} ngày`;
          if (rec.type === 'annual_leave') {
            code = 'PN';
            durationText = `${rec.amount} ngày`;
          } else if (rec.type === 'regime_leave') {
            code = 'CĐ';
            durationText = `${rec.amount} ngày`;
          } else if (rec.type === 'unpaid_leave') {
            code = 'KL';
            durationText = `${rec.amount} ngày`;
          } else if (rec.type === 'late_early') {
            code = 'ĐM';
            durationText = formatLateDurationBadge(rec.amount);
          }

          const meta = LEAVE_TYPE_META[rec.type];
          dayBadges[col.day].push({
            id: `${rec.id}-${col.day}`,
            type: rec.type,
            code,
            durationText,
            tooltip:
              rec.type === 'late_early'
                ? `Đi muộn: ${durationText}${rec.reason ? ` — ${rec.reason}` : ''}`
                : `${meta.shortLabel}: ${rec.amount} ${meta.unit}${rec.reason ? ` — ${rec.reason}` : ''}`,
            record: rec,
          });
        }
      }
    }

    const monthAnnualAndRegimeDays = Number(
      (monthAnnualDays + monthRegimeDays).toFixed(2)
    );
    const hasAnyActivityInMonth =
      monthAnnualAndRegimeDays > 0 ||
      monthUnpaidDays > 0 ||
      monthLateHours > 0 ||
      empMonthRecords.length > 0;

    totalAnnualAndRegimeDays = Number(
      (totalAnnualAndRegimeDays + monthAnnualAndRegimeDays).toFixed(2)
    );
    totalAnnualAndRegimeCount += monthAnnualAndRegimeCount;
    totalUnpaidDays = Number((totalUnpaidDays + monthUnpaidDays).toFixed(2));
    totalUnpaidCount += monthUnpaidCount;
    totalLateHours = Number((totalLateHours + monthLateHours).toFixed(2));
    totalLateCount += monthLateCount;
    if (hasAnyActivityInMonth) {
      employeesWithActivityCount += 1;
    }

    return {
      employee,
      accruedLeaveDays: breakdown.accruedLeaveDays,
      carriedOverLeaveDays: breakdown.carriedOverLeaveDays,
      usedAnnualLeaveDays: breakdown.usedAnnualLeaveDays,
      remainingAnnualLeave: breakdown.remainingAnnualLeave,
      monthAnnualDays,
      monthRegimeDays,
      monthAnnualAndRegimeDays,
      monthAnnualAndRegimeCount,
      monthUnpaidDays,
      monthUnpaidCount,
      monthLateHours,
      monthLateCount,
      hasAnyActivityInMonth,
      monthRecords: empMonthRecords,
      dayBadges,
    };
  });

  return {
    year,
    month,
    daysInMonth,
    dayColumns,
    rows,
    kpi: {
      totalAnnualAndRegimeDays,
      totalAnnualAndRegimeCount,
      totalUnpaidDays,
      totalUnpaidCount,
      totalLateHours,
      totalLateCount,
      employeesWithActivityCount,
      totalEmployeesCount: filteredEmployees.length,
    },
  };
}

/**
 * Calculates the 5 KPI stat cards on the Dashboard
 * Low leave threshold: remaining annual leave <= 2 days
 */
export function calculateDashboardKPIs(
  employees: Employee[],
  records: LeaveRecord[],
  todayDateStr: string = '2026-11-12',
  currentMonth: number = 11,
  currentYear: number = 2026
): DashboardKPIs {
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(
    (e) => e.status === 'Đang làm việc' || e.status === 'Đang thử việc'
  ).length;

  // Employees on leave today (excluding late_early which is still working that day)
  const onLeaveTodayEmpIds = new Set<string>();
  for (const rec of records) {
    if (
      rec.type !== 'late_early' &&
      isDateInRange(todayDateStr, rec.startDate, rec.endDate)
    ) {
      onLeaveTodayEmpIds.add(rec.employeeId);
    }
  }
  const onLeaveTodayNames = employees
    .filter((e) => onLeaveTodayEmpIds.has(e.id))
    .map((e) => e.fullName);

  // Late count & total hours in currentMonth / currentYear
  let lateCountInMonth = 0;
  let lateHoursInMonth = 0;
  for (const rec of records) {
    if (rec.type === 'late_early') {
      const { year, month } = getYearMonth(rec.startDate);
      if (year === currentYear && month === currentMonth) {
        lateCountInMonth += 1;
        lateHoursInMonth = Number((lateHoursInMonth + rec.amount).toFixed(2));
      }
    }
  }

  // Employees with remaining annual leave <= 2 days in currentYear
  const matrixRows = calculateAnnualMatrixReport(employees, records, currentYear, 'ALL');
  const lowLeaveRows = matrixRows.filter((row) => row.remainingAnnualLeave <= 2);

  return {
    totalEmployees,
    activeEmployees,
    onLeaveToday: onLeaveTodayEmpIds.size,
    onLeaveTodayNames,
    lateCountInMonth,
    lateHoursInMonth,
    lowLeaveEmployeesCount: lowLeaveRows.length,
    lowLeaveEmployeeNames: lowLeaveRows.map(
      (r) => `${r.employee.fullName} (còn ${r.remainingAnnualLeave} ngày)`
    ),
  };
}

/**
 * Calculates horizontal bar distribution of employees by Department/Group
 */
export function calculateDepartmentDistribution(
  employees: Employee[],
  groups: DepartmentGroup[]
): DistributionItem[] {
  const total = employees.length || 1;
  const countsMap = new Map<string, number>();

  for (const emp of employees) {
    const key = (emp.department || '').trim();
    countsMap.set(key, (countsMap.get(key) || 0) + 1);
  }

  const result: DistributionItem[] = [];
  const palette = [
    '#0D9488',
    '#0284C7',
    '#7C3AED',
    '#D97706',
    '#E11D48',
    '#10B981',
    '#F59E0B',
    '#6366F1',
    '#EC4899',
    '#14B8A6',
  ];

  // Include all defined groups first
  groups.forEach((grp, idx) => {
    const count = countsMap.get(grp.name) || 0;
    countsMap.delete(grp.name);
    result.push({
      label: grp.name,
      count,
      percentage: Math.round((count / total) * 100),
      color: grp.color || palette[idx % palette.length],
      subLabel: `${count} nhân sự`,
    });
  });

  return result.sort((a, b) => b.count - a.count);
}

/**
 * Calculates horizontal bar distribution of leave & late types in a given month/year (or full year if month === 0)
 */
export function calculateMonthlyLeaveTypeDistribution(
  records: LeaveRecord[],
  month: number,
  year: number
): DistributionItem[] {
  const filtered = records.filter((r) => {
    const { year: rYear, month: rMonth } = getYearMonth(r.startDate);
    if (rYear !== year) return false;
    return month === 0 ? true : rMonth === month;
  });

  const types: { type: LeaveRecordType; displayLabel: string }[] = [
    { type: 'annual_leave', displayLabel: 'Nghỉ phép năm' },
    { type: 'unpaid_leave', displayLabel: 'Nghỉ không lương' },
    { type: 'regime_leave', displayLabel: 'Nghỉ chế độ' },
    { type: 'late_early', displayLabel: 'Đi muộn' },
  ];

  const totalRecords = filtered.length || 1;

  return types.map(({ type: t, displayLabel }) => {
    const matching = filtered.filter((r) => r.type === t);
    const count = matching.length;
    const totalAmount = matching.reduce((acc, item) => Number((acc + item.amount).toFixed(2)), 0);
    const meta = LEAVE_TYPE_META[t];
    return {
      label: displayLabel,
      count,
      percentage: filtered.length === 0 ? 0 : Math.round((count / totalRecords) * 100),
      color: meta.color,
      subLabel: t === 'late_early' ? `${count} lượt` : `${count} lượt (${totalAmount} ${meta.unit})`,
    };
  });
}

/**
 * Filters employees by search query, department, and gender/status
 */
export function filterEmployees(
  employees: Employee[],
  searchQuery: string,
  departmentFilter: string,
  genderOrStatusFilter: string
): Employee[] {
  const q = searchQuery.trim().toLowerCase();
  return employees.filter((emp) => {
    if (departmentFilter !== 'ALL') {
      if (departmentFilter === '__EMPTY__') {
        if ((emp.department || '').trim() !== '') return false;
      } else if (emp.department !== departmentFilter) {
        return false;
      }
    }
    if (genderOrStatusFilter !== 'ALL') {
      if (
        emp.gender !== genderOrStatusFilter &&
        emp.status !== genderOrStatusFilter
      ) {
        return false;
      }
    }
    if (!q) return true;
    return (
      emp.fullName.toLowerCase().includes(q) ||
      emp.employeeCode.toLowerCase().includes(q) ||
      (emp.cccd || '').toLowerCase().includes(q) ||
      (emp.cccdDate || '').toLowerCase().includes(q) ||
      (emp.joinDate || '').toLowerCase().includes(q) ||
      (emp.position || '').toLowerCase().includes(q) ||
      (emp.phone || '').toLowerCase().includes(q) ||
      (emp.address || '').toLowerCase().includes(q)
    );
  });
}

/**
 * Filters leave/late records by month, year, type, department, and search query
 */
export function filterLeaveRecords(
  records: LeaveRecord[],
  employees: Employee[],
  monthFilter: number, // 0 = All months
  yearFilter: number,
  typeFilter: string, // 'ALL' or LeaveRecordType
  departmentFilter: string, // 'ALL' or department name
  searchQuery: string
): LeaveRecord[] {
  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));
  const q = searchQuery.trim().toLowerCase();

  return records
    .filter((rec) => {
      const emp = empMap.get(rec.employeeId);
      if (!emp) return false;

      const { year, month } = getYearMonth(rec.startDate);
      if (year !== yearFilter) return false;
      if (monthFilter !== 0 && month !== monthFilter) return false;
      if (typeFilter !== 'ALL' && rec.type !== typeFilter) return false;
      if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) return false;

      if (!q) return true;
      return (
        emp.fullName.toLowerCase().includes(q) ||
        emp.employeeCode.toLowerCase().includes(q) ||
        rec.reason.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
