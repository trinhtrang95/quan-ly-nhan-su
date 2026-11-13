import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAnnualMatrixReport,
  calculateDashboardKPIs,
  calculateDepartmentDistribution,
  calculateMonthlyLeaveTypeDistribution,
  filterEmployees,
  filterLeaveRecords,
  formatDateVN,
} from './hrCalculations';
import {
  INITIAL_DEPARTMENT_GROUPS,
  INITIAL_EMPLOYEES,
  INITIAL_LEAVE_RECORDS,
} from '../data/mockData';

test('formatDateVN converts YYYY-MM-DD into DD/MM/YYYY accurately', () => {
  assert.equal(formatDateVN('2026-11-12'), '12/11/2026');
  assert.equal(formatDateVN('1995-04-05'), '05/04/1995');
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
  // On 2026-11-12: emp-3 (annual_leave 12-13/11) and emp-4 (regime_leave 11-12/11) are on leave;
  // emp-8 has late_early on 2026-11-12 which does not count as absent on leave.
  assert.equal(kpis.onLeaveToday, 2);
  assert.equal(kpis.lateCountInMonth, 4);
  assert.equal(kpis.lateHoursInMonth, 5); // 1.5 + 1 + 2 + 0.5 = 5.0 hours
  // Low leave employees (<= 2 days left): emp-3 (1 day left), emp-5 (1.5 days left), emp-6 (0 days left)
  assert.equal(kpis.lowLeaveEmployeesCount, 3);
});

test('calculateAnnualMatrixReport deducts only annual_leave from standardAnnualLeave and tracks unpaid & late hours', () => {
  const rows = calculateAnnualMatrixReport(
    INITIAL_EMPLOYEES,
    INITIAL_LEAVE_RECORDS,
    2026,
    'ALL'
  );

  assert.equal(rows.length, 8);

  // Check emp-6 (Đặng Khánh Linh): 12 standard, used 5 (Feb) + 5 (Jun) + 2 (Sep) = 12 annual leave -> 0 remaining, plus 1.5 unpaid in Nov
  const emp6Row = rows.find((r) => r.employee.id === 'emp-6');
  assert.ok(emp6Row);
  assert.equal(emp6Row.totalAnnualUsed, 12);
  assert.equal(emp6Row.remainingAnnualLeave, 0);
  assert.equal(emp6Row.totalUnpaidDays, 1.5);
  assert.equal(emp6Row.months[2].annualLeaveDays, 5);
  assert.equal(emp6Row.months[6].annualLeaveDays, 5);
  assert.equal(emp6Row.months[9].annualLeaveDays, 2);
  assert.equal(emp6Row.months[11].unpaidLeaveDays, 1.5);

  // Check emp-5 (Vũ Đức Thịnh): 12 standard, used 5 (May) + 5.5 (Oct) = 10.5 annual -> 1.5 remaining, plus 1.5 late hours in Nov
  const emp5Row = rows.find((r) => r.employee.id === 'emp-5');
  assert.ok(emp5Row);
  assert.equal(emp5Row.totalAnnualUsed, 10.5);
  assert.equal(emp5Row.remainingAnnualLeave, 1.5);
  assert.equal(emp5Row.totalLateHours, 1.5);
});

test('filterEmployees and filterLeaveRecords filter accurately by query and department', () => {
  const techEmployees = filterEmployees(
    INITIAL_EMPLOYEES,
    '',
    'Phòng Kỹ thuật & CNTT',
    'ALL'
  );
  assert.equal(techEmployees.length, 2);

  const searchByCCCD = filterEmployees(
    INITIAL_EMPLOYEES,
    '036095004812',
    'ALL',
    'ALL'
  );
  assert.equal(searchByCCCD.length, 1);
  assert.equal(searchByCCCD[0].employeeCode, 'NV003');

  const novLateLogs = filterLeaveRecords(
    INITIAL_LEAVE_RECORDS,
    INITIAL_EMPLOYEES,
    11,
    2026,
    'late_early',
    'ALL',
    ''
  );
  assert.equal(novLateLogs.length, 4);
});

test('distributions compute valid percentages and counts', () => {
  const deptDist = calculateDepartmentDistribution(
    INITIAL_EMPLOYEES,
    INITIAL_DEPARTMENT_GROUPS
  );
  assert.equal(deptDist.length, 5);
  const totalDeptCount = deptDist.reduce((acc, d) => acc + d.count, 0);
  assert.equal(totalDeptCount, 8);

  const novTypeDist = calculateMonthlyLeaveTypeDistribution(
    INITIAL_LEAVE_RECORDS,
    11,
    2026
  );
  assert.equal(novTypeDist.length, 4);
});

test('Supabase row mapping and leave_type encoding/decoding preserve all fields', async () => {
  const {
    mapSupabaseRowToEmployee,
    encodeLeaveTypeForDb,
    decodeLeaveTypeFromDb,
    mapSupabaseRowToLeaveRecord,
  } = await import('./supabaseService');

  const emp = mapSupabaseRowToEmployee({
    id: 'uuid-123',
    employee_code: 'NV099',
    full_name: 'Đỗ Hoàng Sơn',
    dob: '1994-05-20',
    gender: 'Nam',
    cccd: '001094001122',
    phone: '0912345678',
    address: 'Hà Nội',
    department: 'Phòng Kỹ thuật & CNTT',
    avatar_url: 'https://example.com/avatar.png',
    annual_leave_quota: 14,
    status: 'Đang làm việc',
  });

  assert.equal(emp.id, 'uuid-123');
  assert.equal(emp.employeeCode, 'NV099');
  assert.equal(emp.standardAnnualLeave, 14);

  const encoded = encodeLeaveTypeForDb('regime_leave', 'Thai sản');
  assert.equal(encoded, 'regime_leave|Thai sản');
  const decoded = decodeLeaveTypeFromDb(encoded);
  assert.equal(decoded.type, 'regime_leave');
  assert.equal(decoded.regimeSubtype, 'Thai sản');

  const log = mapSupabaseRowToLeaveRecord({
    id: 'log-456',
    employee_id: 'uuid-123',
    leave_type: 'late_early',
    start_date: '2026-11-12',
    end_date: '2026-11-12',
    duration: 1.5,
    reason: 'Tắc đường',
    proof_image_url: 'https://example.com/proof.png',
  });

  assert.equal(log.type, 'late_early');
  assert.equal(log.amount, 1.5);
  assert.equal(log.attachmentUrl, 'https://example.com/proof.png');
});

