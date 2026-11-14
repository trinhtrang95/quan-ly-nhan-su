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

