import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboardKPIs,
  formatDateVN,
  parseComparableDate,
  sortEmployees,
} from './hrCalculations';
import { parseEmployeesFromCsvText } from './exportUtils';
import {
  composeAddressFromParts,
  DEFAULT_COMMUNES_BY_PROVINCE,
  parseAddressIntoParts,
  VN_28_PROVINCES,
  VN_34_PROVINCES,
  VN_6_CENTRAL_CITIES,
} from './vnAddressData';
import {
  INITIAL_EMPLOYEES,
  INITIAL_LEAVE_RECORDS,
} from '../data/mockData';
import { Employee } from '../types/hr';

test('formatDateVN converts YYYY-MM-DD and DD/MM/YYYY into DD/MM/YYYY accurately', () => {
  assert.equal(formatDateVN('2026-11-12'), '12/11/2026');
  assert.equal(formatDateVN('1995-04-05'), '05/04/1995');
  assert.equal(formatDateVN('5/4/1995'), '05/04/1995');
  assert.equal(formatDateVN(''), '');
  assert.equal(formatDateVN('-'), '');
});

test('VN_34_PROVINCES contains exact 6 central cities + 28 provinces = 34 unique post-merger units and round-trips addresses cleanly', () => {
  assert.equal(VN_6_CENTRAL_CITIES.length, 6);
  assert.deepEqual(VN_6_CENTRAL_CITIES, [
    'Hà Nội',
    'TP. Hồ Chí Minh',
    'Hải Phòng',
    'Đà Nẵng',
    'Cần Thơ',
    'Huế',
  ]);
  assert.equal(VN_28_PROVINCES.length, 28);
  assert.equal(VN_34_PROVINCES.length, 34);
  assert.equal(new Set(VN_34_PROVINCES).size, 34);

  // Every single one of the 34 provinces/cities has commune suggestions configured
  for (const prov of VN_34_PROVINCES) {
    assert.ok(
      Array.isArray(DEFAULT_COMMUNES_BY_PROVINCE[prov]) &&
        DEFAULT_COMMUNES_BY_PROVINCE[prov].length > 0,
      `Missing communes for ${prov}`
    );
  }

  const composed = composeAddressFromParts(
    'Thôn Đồng Tiến',
    'Xã Lương Sơn',
    'Phú Thọ'
  );
  assert.equal(composed, 'Thôn Đồng Tiến, Xã Lương Sơn, Phú Thọ');

  const parsed = parseAddressIntoParts(composed);
  assert.deepEqual(parsed, {
    detail: 'Thôn Đồng Tiến',
    commune: 'Xã Lương Sơn',
    province: 'Phú Thọ',
  });

  // Also handles "Tỉnh Phú Thọ" or merged province "Tỉnh Hòa Bình" prefix when splitting existing addresses
  const parsedWithPrefix = parseAddressIntoParts(
    'KCN Lương Sơn, Xã Hòa Sơn, Tỉnh Phú Thọ'
  );
  assert.deepEqual(parsedWithPrefix, {
    detail: 'KCN Lương Sơn',
    commune: 'Xã Hòa Sơn',
    province: 'Phú Thọ',
  });

  const parsedMergedAlias = parseAddressIntoParts(
    'Xóm 2, Xã Lương Sơn, Tỉnh Hòa Bình'
  );
  assert.deepEqual(parsedMergedAlias, {
    detail: 'Xóm 2',
    commune: 'Xã Lương Sơn',
    province: 'Hòa Bình',
  });

  // Empty or "-" address returns empty parts
  assert.deepEqual(parseAddressIntoParts('-'), {
    detail: '',
    commune: '',
    province: '',
  });
});

test('sortEmployees sorts by department, status, and joinDate and pushes empty "-" values to bottom', () => {
  assert.ok(
    (parseComparableDate('2022-05-10') || 0) <
      (parseComparableDate('15/08/2023') || 0)
  );

  const sample: Employee[] = [
    {
      ...INITIAL_EMPLOYEES[0],
      id: '1',
      employeeCode: 'NV001',
      fullName: 'An',
      department: '',
      joinDate: '',
      status: 'Tạm nghỉ',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: '2',
      employeeCode: 'NV002',
      fullName: 'Bình',
      department: 'Tổ Cơ khí',
      joinDate: '15/08/2024',
      status: 'Đang làm việc',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: '3',
      employeeCode: 'NV003',
      fullName: 'Cường',
      department: 'Ban Giám đốc',
      joinDate: '2021-03-01',
      status: 'Đã nghỉ việc',
    },
  ];

  const deptAsc = sortEmployees(sample, 'department', 'asc');
  assert.deepEqual(
    deptAsc.map((e) => e.employeeCode),
    ['NV003', 'NV002', 'NV001']
  );

  const joinAsc = sortEmployees(sample, 'joinDate', 'asc');
  assert.deepEqual(
    joinAsc.map((e) => e.employeeCode),
    ['NV003', 'NV002', 'NV001']
  );

  const statusAsc = sortEmployees(sample, 'status', 'asc');
  assert.equal(statusAsc.length, 3);

  const prioritySample: Employee[] = [
    {
      ...INITIAL_EMPLOYEES[0],
      id: 'p1',
      employeeCode: 'NV010',
      fullName: 'Nhân viên ME',
      department: 'ME',
      position: 'Nhân viên',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: 'p2',
      employeeCode: 'NV009',
      fullName: 'Phó nhóm ME',
      department: 'ME',
      position: 'Phó nhóm',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: 'p3',
      employeeCode: 'NV008',
      fullName: 'Trưởng nhóm ME',
      department: 'ME',
      position: 'Trưởng nhóm',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: 'p4',
      employeeCode: 'NV007',
      fullName: 'Trưởng bộ phận ME',
      department: 'ME',
      position: 'Trưởng bộ phận',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: 'p5',
      employeeCode: 'NV002',
      fullName: 'Nhân viên JIG 2',
      department: 'JIG/AUTO 2',
      position: 'Nhân viên',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: 'p6',
      employeeCode: 'NV001',
      fullName: 'Quản lý chung',
      department: 'Quản lý chung',
      position: 'Trưởng bộ phận',
    },
  ];

  const defaultSorted = sortEmployees(prioritySample, null, null);
  assert.deepEqual(
    defaultSorted.map((e) => e.id),
    ['p6', 'p5', 'p4', 'p3', 'p2', 'p1']
  );
});

test('parseEmployeesFromCsvText supports full 12-column template and enforces unique employeeCode and registered groups', () => {
  const registeredGroups = [
    { id: 'g1', name: 'Phòng Kỹ thuật & CNTT', code: 'KT', color: '#0D9488' },
  ];

  const csvValid = [
    'STT,Mã nhân viên,Họ tên,Ngày sinh,Giới tính,Địa chỉ,Số CCCD,Ngày cấp CCCD,Nhóm / Bộ phận,Chức danh,Ngày vào,Trạng thái',
    '1,NV101,Nguyễn Văn A,,,"Thôn 1, Xã Lương Sơn, Phú Thọ",,,Phòng Kỹ thuật & CNTT,Trưởng nhóm,2024-02-10,Đang làm việc',
    '2,NV102,Trần Thị B,,,,,,Nhóm Chưa Đăng Ký,,,Tạm nghỉ',
  ].join('\n');

  const res1 = parseEmployeesFromCsvText(csvValid, [], registeredGroups, 12);
  assert.equal(res1.duplicateCodes.length, 0);
  assert.equal(res1.employees.length, 2);
  assert.equal(res1.employees[0].department, 'Phòng Kỹ thuật & CNTT');
  assert.equal(res1.employees[0].position, 'Trưởng nhóm');
  assert.equal(res1.employees[0].joinDate, '2024-02-10');
  assert.equal(res1.employees[0].address, 'Thôn 1, Xã Lương Sơn, Phú Thọ');
  assert.equal(res1.employees[0].status, 'Đang làm việc');

  // NV102 has unregistered group -> automatically cleared to ""
  assert.equal(res1.employees[1].department, '');
  assert.equal(res1.employees[1].status, 'Tạm nghỉ');

  // Duplicate check against existingEmployees
  const resDup = parseEmployeesFromCsvText(
    csvValid,
    [res1.employees[0]],
    registeredGroups,
    12
  );
  assert.deepEqual(resDup.duplicateCodes, ['NV101']);
});

test('calculateDashboardKPIs computes accurate KPI metrics from seed data', () => {
  const kpis = calculateDashboardKPIs(
    INITIAL_EMPLOYEES,
    INITIAL_LEAVE_RECORDS,
    '2026-11-12',
    11,
    2026
  );

  assert.equal(kpis.totalEmployees, 8);
  assert.equal(kpis.activeEmployees, 8);
  assert.equal(kpis.onLeaveToday, 2);
  assert.equal(kpis.lateCountInMonth, 4);
  assert.equal(kpis.lateHoursInMonth, 5);
  assert.equal(kpis.lowLeaveEmployeesCount, 3);
});

test('Supabase row mapping preserves empty optional fields without fake defaults', async () => {
  const { mapSupabaseRowToEmployee } = await import('./supabaseService');

  const emp = mapSupabaseRowToEmployee({
    id: 'uuid-123',
    employee_code: 'NV099',
    full_name: 'Đỗ Hoàng Sơn',
    dob: null,
    gender: null,
    cccd: null,
    cccd_date: null,
    phone: null,
    address: null,
    department: null,
    position: null,
    join_date: '2025-01-15',
    avatar_url: null,
    annual_leave_quota: 14,
    status: 'Đang làm việc',
  });

  assert.equal(emp.id, 'uuid-123');
  assert.equal(emp.employeeCode, 'NV099');
  assert.equal(emp.dob, '');
  assert.equal(emp.gender, '');
  assert.equal(emp.department, '');
  assert.equal(emp.position, '');
  assert.equal(emp.joinDate, '2025-01-15');
});

test('employeeColumns catalog defines all 6 groups and extracts accurate values for table and Excel export', async () => {
  const {
    EMPLOYEE_COLUMN_GROUPS,
    DEFAULT_VISIBLE_EMPLOYEE_COLUMNS,
    getEmployeeColumnTextValue,
    parseFamilyInfoParts,
  } = await import('./employeeColumns');

  assert.equal(EMPLOYEE_COLUMN_GROUPS.length, 6);
  assert.deepEqual(DEFAULT_VISIBLE_EMPLOYEE_COLUMNS, [
    'department',
    'position',
    'address',
    'joinDate',
    'status',
  ]);

  const parsedFam = parseFamilyInfoParts('Vợ: Nguyễn Thị Lan - 0987654321');
  assert.equal(parsedFam.relation, 'Vợ');
  assert.equal(parsedFam.name, 'Nguyễn Thị Lan');
  assert.equal(parsedFam.phone, '0987654321');

  const sampleEmp: Employee = {
    ...INITIAL_EMPLOYEES[0],
    dob: '1996-05-10',
    joinDate: '2023-11-01',
    familyInfo: 'Vợ: Nguyễn Thị Lan - 0987654321',
  };
  assert.equal(getEmployeeColumnTextValue(sampleEmp, 'age'), '30 tuổi');
  assert.equal(
    getEmployeeColumnTextValue(sampleEmp, 'emergencyContactName'),
    'Nguyễn Thị Lan'
  );
  assert.equal(
    getEmployeeColumnTextValue(sampleEmp, 'emergencyContactRelation'),
    'Vợ'
  );
  assert.equal(
    getEmployeeColumnTextValue(sampleEmp, 'emergencyContactPhone'),
    '0987654321'
  );
});

test('calculateMonthlyAttendanceMatrix generates accurate 30/31 day columns, today highlight, short group codes, and standardized PN/CĐ/KL/ĐM badges', async () => {
  const {
    calculateMonthlyAttendanceMatrix,
    formatLateDurationBadge,
    getShortGroupCode,
  } = await import('./hrCalculations');

  assert.equal(formatLateDurationBadge(0.5), '30p');
  assert.equal(formatLateDurationBadge(0.25), '15p');
  assert.equal(formatLateDurationBadge(1.5), '1.5h');
  assert.equal(formatLateDurationBadge(2), '2h');

  assert.equal(getShortGroupCode('PE'), 'PE');
  assert.equal(getShortGroupCode('ST'), 'ST');
  assert.equal(getShortGroupCode('Quản lý chung'), 'QLC');
  assert.equal(getShortGroupCode('JIG/AUTO 2'), 'JIG 2');
  assert.equal(getShortGroupCode('DOCUMENT'), 'DOC');

  const report = calculateMonthlyAttendanceMatrix(
    INITIAL_EMPLOYEES,
    INITIAL_LEAVE_RECORDS,
    2026,
    11,
    'ALL',
    '',
    '2026-11-15'
  );

  assert.equal(report.year, 2026);
  assert.equal(report.month, 11);
  assert.equal(report.daysInMonth, 30);
  assert.equal(report.dayColumns.length, 30);
  assert.equal(report.dayColumns[14].dayLabel, '15');
  assert.equal(report.dayColumns[14].isToday, true);
  assert.equal(report.rows.length, INITIAL_EMPLOYEES.length);

  // Verify standardized badge codes are strictly in ['PN', 'CĐ', 'KL', 'ĐM']
  const allBadges = report.rows.flatMap((r) =>
    Object.values(r.dayBadges).flat()
  );
  assert.ok(allBadges.length > 0);
  for (const b of allBadges) {
    assert.ok(['PN', 'CĐ', 'KL', 'ĐM'].includes(b.code));
    assert.ok(b.durationText.length > 0);
  }
});

test('calculateLeaveAccrualBreakdown accurately computes [Phép tích lũy] + [Phép năm cũ dồn sang] - [Đã nghỉ]', async () => {
  const { calculateLeaveAccrualBreakdown } = await import('./hrCalculations');

  const emp: Employee = {
    ...INITIAL_EMPLOYEES[0],
    id: 'emp-accrual-1',
    joinDate: '2024-01-01',
    standardAnnualLeave: 12,
    carriedOverLeave: 2,
  };

  // Monthly accrual up to November (month 11) with carryover enabled:
  // Accrued = 11, Carryover = 2, Used = 3 -> Remaining = 11 + 2 - 3 = 10
  const monthlyWithCarry = calculateLeaveAccrualBreakdown(
    emp,
    [
      {
        id: 'rec-1',
        employeeId: 'emp-accrual-1',
        type: 'annual_leave',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        amount: 3,
        reason: 'Nghỉ phép năm',
        createdAt: '2026-05-01',
        approvedBy: 'Admin',
      },
    ],
    2026,
    11,
    { accrualMode: 'monthly', allowCarryOver: true }
  );

  assert.equal(monthlyWithCarry.accruedLeaveDays, 11);
  assert.equal(monthlyWithCarry.carriedOverLeaveDays, 2);
  assert.equal(monthlyWithCarry.usedAnnualLeaveDays, 3);
  assert.equal(monthlyWithCarry.remainingAnnualLeave, 10);

  // Upfront accrual without carryover:
  // Accrued = 12, Carryover = 0, Used = 3 -> Remaining = 12 + 0 - 3 = 9
  const upfrontNoCarry = calculateLeaveAccrualBreakdown(
    emp,
    [
      {
        id: 'rec-1',
        employeeId: 'emp-accrual-1',
        type: 'annual_leave',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        amount: 3,
        reason: 'Nghỉ phép năm',
        createdAt: '2026-05-01',
        approvedBy: 'Admin',
      },
    ],
    2026,
    11,
    { accrualMode: 'upfront', allowCarryOver: false }
  );

  assert.equal(upfrontNoCarry.accruedLeaveDays, 12);
  assert.equal(upfrontNoCarry.carriedOverLeaveDays, 0);
  assert.equal(upfrontNoCarry.usedAnnualLeaveDays, 3);
  assert.equal(upfrontNoCarry.remainingAnnualLeave, 9);
});

test('Go-Live Tháng 11/2026: Chốt số dư phép đầu kỳ (Tồn 2025 = 2, Đã nghỉ đến 31/10 = 5) hoàn thiện phương trình 11 + 2 = 13, Còn lại = 13 - 5 = 8 và cộng dồn đơn mới từ tháng 11', async () => {
  const {
    calculateLeaveAccrualBreakdown,
    saveLeaveBalancesBatch,
    clearLeaveBalancesStorage,
  } = await import('./hrCalculations');
  const { parseOpeningLeaveBalanceText } = await import('./exportUtils');

  clearLeaveBalancesStorage();

  const csvTemplateContent = [
    'Mã NV,Họ và tên,Tồn phép năm cũ (2025),Đã nghỉ (đến 31/10)',
    'NV001,Trịnh Quốc Khánh,2,5',
    'NV002,Lương Thị Mai Hương,1.5,4',
  ].join('\n');

  const parsed = parseOpeningLeaveBalanceText(
    csvTemplateContent,
    INITIAL_EMPLOYEES
  );
  assert.equal(parsed.matchedRows.length, 2);
  assert.equal(parsed.matchedRows[0].employeeCode, 'NV001');
  assert.equal(parsed.matchedRows[0].carried_over, 2);
  assert.equal(parsed.matchedRows[0].used_leave, 5);

  // Overwrite balances in leave_balances without creating any fake leave_logs
  const balancesMap = saveLeaveBalancesBatch(
    parsed.matchedRows.map((r) => ({
      employeeCode: r.employeeCode,
      employeeId: r.employee.id,
      fullName: r.fullName,
      carried_over: r.carried_over,
      used_leave: r.used_leave,
      cutoffDate: '2026-10-31',
    })),
    INITIAL_LEAVE_RECORDS,
    2026
  );

  // Verify November (month 11) equation for NV001:
  // Tích lũy năm nay = 11, Tồn năm trước = 2, Tổng quỹ phép = 13, Đã nghỉ = 5, Còn lại = 8
  const nv001Breakdown = calculateLeaveAccrualBreakdown(
    INITIAL_EMPLOYEES[0],
    INITIAL_LEAVE_RECORDS,
    2026,
    11,
    { accrualMode: 'monthly', allowCarryOver: true },
    12,
    balancesMap
  );

  assert.equal(nv001Breakdown.accruedLeaveDays, 11);
  assert.equal(nv001Breakdown.carriedOverLeaveDays, 2);
  assert.equal(nv001Breakdown.totalLeaveFund, 13);
  assert.equal(nv001Breakdown.usedAnnualLeaveDays, 5);
  assert.equal(nv001Breakdown.remainingAnnualLeave, 8);

  // Now simulate a new leave record arising in November 2026 (after the 31/10 cutoff)
  const recordsWithNewNovLeave = [
    ...INITIAL_LEAVE_RECORDS,
    {
      id: 'rec-new-nov-2026',
      employeeId: INITIAL_EMPLOYEES[0].id,
      type: 'annual_leave' as const,
      startDate: '2026-11-20',
      endDate: '2026-11-21',
      amount: 2,
      reason: 'Nghỉ phép phát sinh mới tháng 11',
      createdAt: '2026-11-20',
      approvedBy: 'HR',
    },
  ];

  const afterNewNovLeave = calculateLeaveAccrualBreakdown(
    INITIAL_EMPLOYEES[0],
    recordsWithNewNovLeave,
    2026,
    11,
    { accrualMode: 'monthly', allowCarryOver: true },
    12,
    balancesMap
  );

  assert.equal(afterNewNovLeave.usedAnnualLeaveDays, 7); // 5 + 2
  assert.equal(afterNewNovLeave.remainingAnnualLeave, 6); // 13 - 7

  clearLeaveBalancesStorage();
});

test('Kịch bản kiểm thử (Acceptance Criteria): Nguyễn Thị Mai (Tồn năm trước = 0, Tích lũy = 1 -> Tổng = 1). Tạo đơn nghỉ 1 ngày trong tháng 11 -> Đã nghỉ = 1, Còn lại = 0. Form Đơn nghỉ nhận giá trị Còn lại = 0', async () => {
  const { calculateLeaveAccrualBreakdown } = await import('./hrCalculations');

  const maiEmp: Employee = {
    ...INITIAL_EMPLOYEES[1],
    id: 'emp-mai-test',
    employeeCode: 'NV999',
    fullName: 'Nguyễn Thị Mai',
    joinDate: '2026-01-01',
    standardAnnualLeave: 12,
    carriedOverLeave: 0,
  };

  // Up to month 1 with upfront quota 1 (or monthly with quota=12 in month 1: 12/12 * 1 = 1)
  const breakdownBefore = calculateLeaveAccrualBreakdown(
    maiEmp,
    [],
    2026,
    1,
    { accrualMode: 'monthly', allowCarryOver: false },
    12
  );

  assert.equal(breakdownBefore.carriedOverLeaveDays, 0);
  assert.equal(breakdownBefore.accruedLeaveDays, 1);
  assert.equal(breakdownBefore.totalLeaveFund, 1);
  assert.equal(breakdownBefore.usedAnnualLeaveDays, 0);
  assert.equal(breakdownBefore.remainingAnnualLeave, 1);

  // Thao tác 1: HR tạo 1 đơn nghỉ phép năm (Số ngày = 1) cho Mai vào tháng 11
  const recordsWithMaiLeave = [
    {
      id: 'rec-mai-1',
      employeeId: 'emp-mai-test',
      type: 'annual_leave' as const,
      startDate: '2026-11-15',
      endDate: '2026-11-15',
      amount: 1,
      reason: 'Nghỉ phép năm',
      createdAt: '2026-11-15',
      approvedBy: 'Admin',
    },
  ];

  // Kết quả mong đợi 1 (Quỹ phép năm) ở tháng 11: Tổng = 1 (Tích lũy 11 tháng cho định mức 12 là 11? Ah, nếu nhân viên mới join tháng 1 thì tích lũy đến tháng 11 là 11. Nhưng theo kịch bản kiểm thử của user: "Tổng quỹ phép = 1, Đã nghỉ = 1 -> Còn lại = 0").
  // Để Tổng quỹ phép = 1, ta có thể test với nhân sự join tháng 11 (joinDate: '2026-11-01'), thì tích lũy đến tháng 11 là (12/12) * 1 = 1 ngày!
  const maiJoinNov: Employee = {
    ...maiEmp,
    joinDate: '2026-11-01',
  };

  const breakdownAfter = calculateLeaveAccrualBreakdown(
    maiJoinNov,
    recordsWithMaiLeave,
    2026,
    11,
    { accrualMode: 'monthly', allowCarryOver: true },
    12
  );

  assert.equal(breakdownAfter.carriedOverLeaveDays, 0);
  assert.equal(breakdownAfter.accruedLeaveDays, 1); // 12/12 * 1 tháng = 1
  assert.equal(breakdownAfter.totalLeaveFund, 1); // 1 + 0 = 1
  assert.equal(breakdownAfter.usedAnnualLeaveDays, 1); // Đã nghỉ = 1
  assert.equal(breakdownAfter.remainingAnnualLeave, 0); // 1 - 1 = 0
});

test('Kiểm thử Nguyễn Thị Mai: Chốt số đầu kỳ đã nghỉ 10 ngày (đến 31/10) + 1 ngày nghỉ ngày 16/11 -> Tổng đã nghỉ = 11', async () => {
  const {
    calculateLeaveAccrualBreakdown,
    saveLeaveBalancesBatch,
    clearLeaveBalancesStorage,
  } = await import('./hrCalculations');

  clearLeaveBalancesStorage();

  const maiEmp: Employee = {
    ...INITIAL_EMPLOYEES[1],
    id: 'emp-mai-10',
    employeeCode: 'NV888',
    fullName: 'Nguyễn Thị Mai',
    joinDate: '2026-01-01',
    standardAnnualLeave: 12,
  };

  const balancesMap = saveLeaveBalancesBatch(
    [
      {
        employeeCode: 'NV888',
        employeeId: 'emp-mai-10',
        fullName: 'Nguyễn Thị Mai',
        carried_over: 2,
        used_leave: 10,
        cutoffDate: '2026-10-31',
      },
    ],
    [],
    2026
  );

  const novRecords = [
    {
      id: 'rec-mai-nov-16',
      employeeId: 'emp-mai-10',
      type: 'annual_leave' as const,
      startDate: '2026-11-16',
      endDate: '2026-11-16',
      amount: 1,
      reason: 'Nghỉ phép ngày 16/11',
      createdAt: '2026-11-16',
      approvedBy: 'HR',
    },
  ];

  const breakdown = calculateLeaveAccrualBreakdown(
    maiEmp,
    novRecords,
    2026,
    11,
    { accrualMode: 'monthly', allowCarryOver: true },
    12,
    balancesMap
  );

  assert.equal(breakdown.usedAnnualLeaveDays, 11); // 10 (chốt đến 31/10) + 1 (ngày 16/11) = 11
  assert.equal(breakdown.accruedLeaveDays, 11); // Tích lũy tháng 11 cho định mức 12 = 11
  assert.equal(breakdown.carriedOverLeaveDays, 2); // Tồn cũ = 2
  assert.equal(breakdown.totalLeaveFund, 13); // 11 + 2 = 13
  assert.equal(breakdown.remainingAnnualLeave, 2); // 13 - 11 = 2

  clearLeaveBalancesStorage();
});

