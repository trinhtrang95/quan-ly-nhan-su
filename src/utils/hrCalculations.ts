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
    label: 'Đi muộn / Về sớm',
    shortLabel: 'Đi muộn',
    unit: 'giờ',
    color: '#EF4444',
    bgLight: '#FEF2F2',
    textColor: '#DC2626',
  },
};

/**
 * Formats YYYY-MM-DD to DD/MM/YYYY for Vietnamese display
 */
export function formatDateVN(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
    countsMap.set(emp.department, (countsMap.get(emp.department) || 0) + 1);
  }

  const result: DistributionItem[] = [];
  const palette = ['#0D9488', '#0284C7', '#7C3AED', '#D97706', '#E11D48', '#10B981'];

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

  // Any remaining custom department names
  let extraIdx = groups.length;
  countsMap.forEach((count, deptName) => {
    result.push({
      label: deptName,
      count,
      percentage: Math.round((count / total) * 100),
      color: palette[extraIdx % palette.length],
      subLabel: `${count} nhân sự`,
    });
    extraIdx++;
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

  const types: LeaveRecordType[] = [
    'annual_leave',
    'unpaid_leave',
    'regime_leave',
    'late_early',
  ];

  const totalRecords = filtered.length || 1;

  return types.map((t) => {
    const matching = filtered.filter((r) => r.type === t);
    const count = matching.length;
    const totalAmount = matching.reduce((acc, item) => Number((acc + item.amount).toFixed(2)), 0);
    const meta = LEAVE_TYPE_META[t];
    return {
      label: meta.label,
      count,
      percentage: filtered.length === 0 ? 0 : Math.round((count / totalRecords) * 100),
      color: meta.color,
      subLabel: `${count} lượt (${totalAmount} ${meta.unit})`,
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
    if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) {
      return false;
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
      emp.cccd.toLowerCase().includes(q) ||
      emp.phone.toLowerCase().includes(q) ||
      emp.address.toLowerCase().includes(q)
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
