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
  parseComparableDate,
  sortEmployees,
} from './hrCalculations';
import { parseEmployeesFromCsvText } from './exportUtils';
import {
  INITIAL_DEPARTMENT_GROUPS,
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

test('sortEmployees sorts by department (A-Z and Z-A) and pushes empty "-" departments to bottom', () => {
  const sample: Employee[] = [
    {
      ...INITIAL_EMPLOYEES[0],
      id: '1',
      employeeCode: 'NV001',
      fullName: 'An',
      department: '',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: '2',
      employeeCode: 'NV002',
      fullName: 'Bình',
      department: 'Tổ Cơ khí',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: '3',
      employeeCode: 'NV003',
      fullName: 'Cường',
      department: 'Ban Giám đốc',
    },
  ];

  const asc = sortEmployees(sample, 'department', 'asc');
  assert.deepEqual(
    asc.map((e) => e.employeeCode),
    ['NV003', 'NV002', 'NV001']
  );

  const desc = sortEmployees(sample, 'department', 'desc');
  assert.deepEqual(
    desc.map((e) => e.employeeCode),
    ['NV002', 'NV003', 'NV001']
  );
});

test('sortEmployees sorts by joinDate supporting both YYYY-MM-DD and DD/MM/YYYY and pushes empty dates to bottom', () => {
  assert.ok(
    (parseComparableDate('2022-05-10') || 0) <
      (parseComparableDate('15/08/2023') || 0)
  );

  const sample: Employee[] = [
    {
      ...INITIAL_EMPLOYEES[0],
      id: '1',
      employeeCode: 'NV001',
      joinDate: '',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: '2',
      employeeCode: 'NV002',
      joinDate: '15/08/2024',
    },
    {
      ...INITIAL_EMPLOYEES[0],
      id: '3',
      employeeCode: 'NV003',
      joinDate: '2021-03-01',
    },
  ];

  const asc = sortEmployees(sample, 'joinDate', 'asc');
  assert.deepEqual(
    asc.map((e) => e.employeeCode),
    ['NV003', 'NV002', 'NV001']
  );

  const desc = sortEmployees(sample, 'joinDate', 'desc');
  assert.deepEqual(
    desc.map((e) => e.employeeCode),
    ['NV002', 'NV003', 'NV001']
  );
});

test('parseEmployeesFromCsvText enforces unique employeeCode, optional fields, and registered department groups', () => {
  const registeredGroups = [
    { id: 'g1', name: 'Phòng Kỹ thuật & CNTT', code: 'KT', color: '#0D9488' },
  ];

  const csvValid = [
    'STT,Mã nhân viên,Họ tên,Ngày sinh,Giới tính,Địa chỉ,Số CCCD,Ngày cấp CCCD,Nhóm / Bộ phận,Ngày vào,Chức danh/Vị trí',
    '1,NV101,Nguyễn Văn A,,,,,,Phòng Kỹ thuật & CNTT,2024-02-10,Trưởng nhóm',
    '2,NV102,Trần Thị B,,,,,,Nhóm Chưa Đăng Ký,,',
  ].join('\n');

  const res1 = parseEmployeesFromCsvText(csvValid, [], registeredGroups, 12);
  assert.equal(res1.duplicateCodes.length, 0);
  assert.equal(res1.employees.length, 2);
  // NV101 has registered group & joinDate, empty optional fields are ""
  assert.equal(res1.employees[0].department, 'Phòng Kỹ thuật & CNTT');
  assert.equal(res1.employees[0].joinDate, '2024-02-10');
  assert.equal(res1.employees[0].dob, '');
  assert.equal(res1.employees[0].gender, '');
  assert.equal(res1.employees[0].cccd, '');
  // NV102 has unregistered group -> automatically cleared to ""
  assert.equal(res1.employees[1].department, '');
  assert.equal(res1.employees[1].joinDate, '');
  assert.equal(res1.employees[1].position, '');

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

