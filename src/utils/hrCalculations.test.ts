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
  parseAddressIntoParts,
  VN_34_PROVINCES,
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

test('VN_34_PROVINCES contains exact 34 post-merger provinces and composeAddressFromParts / parseAddressIntoParts round-trip cleanly', () => {
  assert.equal(VN_34_PROVINCES.length, 34);
  assert.ok(VN_34_PROVINCES.includes('Hà Nội'));
  assert.ok(VN_34_PROVINCES.includes('TP. Hồ Chí Minh'));
  assert.ok(VN_34_PROVINCES.includes('Phú Thọ'));
  assert.ok(VN_34_PROVINCES.includes('Huế'));

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

  // Also handles "Tỉnh Phú Thọ" prefix when splitting existing addresses
  const parsedWithPrefix = parseAddressIntoParts(
    'KCN Lương Sơn, Xã Hòa Sơn, Tỉnh Phú Thọ'
  );
  assert.deepEqual(parsedWithPrefix, {
    detail: 'KCN Lương Sơn',
    commune: 'Xã Hòa Sơn',
    province: 'Phú Thọ',
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
