import {
  DashboardKPIs,
  DepartmentGroup,
  DistributionItem,
  Employee,
  EmployeeAnnualMatrixRow,
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

const DEPARTMENT_PRIORITY_ORDER: string[] = [
  'quản lý chung',
  'jig/auto 2',
  'me',
  'auto 1',
  'pe',
  'st',
  'document',
  'iot',
];

function getDepartmentPriorityRank(department?: string | null): number {
  const clean = (department || '').trim().toLowerCase();
  if (!clean || clean === '-' || clean === '—') {
    return 999; // Chưa phân nhóm xếp ở cuối cùng
  }
  const idx = DEPARTMENT_PRIORITY_ORDER.indexOf(clean);
  if (idx !== -1) {
    return idx;
  }
  return 100; // Các nhóm mới phát sinh xếp tiếp ngay sau 8 nhóm chuẩn
}

function getPositionPriorityRank(position?: string | null): number {
  const clean = (position || '').trim().toLowerCase();
  if (!clean || clean === '-' || clean === '—') return 99;
  if (clean.includes('trưởng bộ phận')) return 1;
  if (clean.includes('trưởng nhóm') || clean.includes('phó bộ phận')) return 2;
  if (clean.includes('nhân viên')) return 3;
  return 4;
}

export function compareEmployeesByDefaultPriority(
  a: Employee,
  b: Employee
): number {
  // Tầng 1: Thứ tự ưu tiên Nhóm / Bộ phận
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

  // Tầng 2: Thứ tự ưu tiên Chức vụ trong cùng 1 Nhóm (Trưởng bộ phận > Trưởng nhóm > Nhân viên)
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

/**
 * Builds the 12-month Annual Matrix Report rows for a given year and optional department filter
 */
export function calculateAnnualMatrixReport(
  employees: Employee[],
  records: LeaveRecord[],
  year: number,
  departmentFilter: string = 'ALL'
): EmployeeAnnualMatrixRow[] {
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

    const remainingAnnualLeave = Number(
      (employee.standardAnnualLeave - totalAnnualUsed).toFixed(2)
    );

    return {
      employee,
      months,
      totalAnnualUsed,
      remainingAnnualLeave,
      totalUnpaidDays,
      totalRegimeDays,
      totalLateHours,
      totalLateCount,
    };
  });
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
