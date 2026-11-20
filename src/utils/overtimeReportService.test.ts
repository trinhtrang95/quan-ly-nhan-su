import test from 'node:test';
import assert from 'node:assert/strict';
import { Employee } from '../types/hr';
import { OvertimeFormWithItems } from './overtimeFormsService';
import {
  calculateMonthlyOvertimeReport,
  formatOvertimeHoursVN,
  getDaysInMonth,
} from './overtimeReportService';

const SAMPLE_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    employeeCode: '13010601',
    fullName: 'Đoàn Văn Chiến',
    dob: '1990-01-01',
    gender: 'Nam',
    cccd: '012345678901',
    phone: '0901234561',
    address: 'Hà Nội',
    department: 'JIG/AUTO 2',
    position: 'Kỹ thuật viên',
    joinDate: '2020-01-01',
    avatarUrl: '',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
  },
  {
    id: 'emp-2',
    employeeCode: '13071501',
    fullName: 'Lê Hữu Trọng',
    dob: '1991-02-02',
    gender: 'Nam',
    cccd: '012345678902',
    phone: '0901234562',
    address: 'Hà Nội',
    department: 'PE',
    position: 'Kỹ thuật viên',
    joinDate: '2021-01-01',
    avatarUrl: '',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
  },
  {
    id: 'emp-3',
    employeeCode: '15050401',
    fullName: 'Bùi Văn Thoại',
    dob: '1992-03-03',
    gender: 'Nam',
    cccd: '012345678903',
    phone: '0901234563',
    address: 'Hà Nội',
    department: 'IOT',
    position: 'Kỹ sư',
    joinDate: '2022-01-01',
    avatarUrl: '',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
  },
];

const SAMPLE_FORMS: OvertimeFormWithItems[] = [
  {
    id: 'form-1',
    form_code: 'OT-20261116-001',
    department: 'ALL',
    overtime_date: '2026-11-16',
    overtime_dates: ['2026-11-16'],
    total_blocks: 1,
    total_participants: 2,
    total_hours: 7.5,
    status: 'saved',
    created_at: '2026-11-16T08:00:00Z',
    deleted_at: null,
    items: [
      {
        id: 'item-1',
        form_id: 'form-1',
        overtime_date: '2026-11-16',
        block_order: 1,
        item_order: 1,
        employee_id: 'emp-1',
        employee_code: '13010601',
        employee_name: 'Đoàn Văn Chiến',
        reason_vi: 'Trực sản xuất',
        reason_kr: '생산 당직',
        start_time: '16:10',
        end_time: '20:10',
        total_hours: 4,
        deleted_at: null,
      },
      {
        id: 'item-2',
        form_id: 'form-1',
        overtime_date: '2026-11-16',
        block_order: 1,
        item_order: 2,
        employee_id: 'emp-2',
        employee_code: '13071501',
        employee_name: 'Lê Hữu Trọng',
        reason_vi: 'Trực sản xuất',
        reason_kr: '생산 당직',
        start_time: '16:30',
        end_time: '20:00',
        total_hours: 3.5,
        deleted_at: null,
      },
    ],
  },
  {
    // Second form on the SAME DAY for emp-1 -> should accumulate (4 + 2 = 6 on day 16)
    id: 'form-2',
    form_code: 'OT-20261116-002',
    department: 'JIG/AUTO 2',
    overtime_date: '2026-11-16',
    overtime_dates: ['2026-11-16', '2026-11-20'],
    total_blocks: 2,
    total_participants: 2,
    total_hours: 4.5,
    status: 'saved',
    created_at: '2026-11-16T09:00:00Z',
    deleted_at: null,
    items: [
      {
        id: 'item-3',
        form_id: 'form-2',
        overtime_date: '2026-11-16',
        block_order: 1,
        item_order: 1,
        employee_id: 'emp-1',
        employee_code: '13010601',
        employee_name: 'Đoàn Văn Chiến',
        reason_vi: 'Hỗ trợ sản xuất gấp',
        reason_kr: '긴급 생산 지원',
        start_time: '20:10',
        end_time: '22:10',
        total_hours: 2,
        deleted_at: null,
      },
      {
        id: 'item-4',
        form_id: 'form-2',
        overtime_date: '2026-11-20',
        block_order: 2,
        item_order: 1,
        employee_id: 'emp-3',
        employee_code: '15050401',
        employee_name: 'Bùi Văn Thoại',
        reason_vi: 'Bảo trì',
        reason_kr: '설비 점검',
        start_time: '17:00',
        end_time: '19:30',
        total_hours: 2.5,
        deleted_at: null,
      },
      {
        // Soft-deleted item -> MUST be ignored
        id: 'item-deleted',
        form_id: 'form-2',
        overtime_date: '2026-11-20',
        block_order: 2,
        item_order: 2,
        employee_id: 'emp-3',
        employee_code: '15050401',
        employee_name: 'Bùi Văn Thoại',
        reason_vi: 'Đã xóa',
        reason_kr: '',
        start_time: '17:00',
        end_time: '21:00',
        total_hours: 4,
        deleted_at: '2026-11-20T10:00:00Z',
      },
    ],
  },
  {
    // Soft-deleted form -> MUST be completely ignored
    id: 'form-deleted',
    form_code: 'OT-20261118-001',
    department: 'PE',
    overtime_date: '2026-11-18',
    overtime_dates: ['2026-11-18'],
    total_blocks: 1,
    total_participants: 1,
    total_hours: 8,
    status: 'saved',
    created_at: '2026-11-18T08:00:00Z',
    deleted_at: '2026-11-18T12:00:00Z',
    items: [
      {
        id: 'item-5',
        form_id: 'form-deleted',
        overtime_date: '2026-11-18',
        block_order: 1,
        item_order: 1,
        employee_id: 'emp-2',
        employee_code: '13071501',
        employee_name: 'Lê Hữu Trọng',
        reason_vi: 'Đã hủy',
        reason_kr: '',
        start_time: '08:00',
        end_time: '16:00',
        total_hours: 8,
        deleted_at: null,
      },
    ],
  },
];

test('overtimeReportService pure logic', async (t) => {
  await t.test('returns exact number of days in month including leap years', () => {
    assert.equal(getDaysInMonth(2026, 2), 28);
    assert.equal(getDaysInMonth(2024, 2), 29);
    assert.equal(getDaysInMonth(2026, 11), 30);
    assert.equal(getDaysInMonth(2026, 12), 31);
  });

  await t.test('accumulates multiple turns on same day and excludes soft-deleted forms/items', () => {
    const report = calculateMonthlyOvertimeReport({
      employees: SAMPLE_EMPLOYEES,
      forms: SAMPLE_FORMS,
      year: 2026,
      month: 11,
    });

    assert.equal(report.daysInMonth, 30);
    assert.equal(report.rows.length, 3);
    assert.equal(report.activeMemberCount, 3);

    const emp1 = report.rows.find((r) => r.employeeId === 'emp-1')!;
    const emp2 = report.rows.find((r) => r.employeeId === 'emp-2')!;
    const emp3 = report.rows.find((r) => r.employeeId === 'emp-3')!;

    assert.equal(emp1.dailyHours[16], 6); // 4 + 2 accumulated on day 16
    assert.equal(emp1.totalHours, 6);

    assert.equal(emp2.dailyHours[16], 3.5);
    assert.equal(emp2.dailyHours[18], undefined); // soft-deleted form excluded
    assert.equal(emp2.totalHours, 3.5);

    assert.equal(emp3.dailyHours[20], 2.5); // soft-deleted item (4h) excluded
    assert.equal(emp3.totalHours, 2.5);

    assert.equal(report.dailyTotals[16], 9.5);
    assert.equal(report.dailyTotals[18], 0);
    assert.equal(report.dailyTotals[20], 2.5);
    assert.equal(report.grandTotalHours, 12);
  });

  await t.test('filters by department and recalculates row STT and footer totals', () => {
    const report = calculateMonthlyOvertimeReport({
      employees: SAMPLE_EMPLOYEES,
      forms: SAMPLE_FORMS,
      year: 2026,
      month: 11,
      departmentFilter: 'IOT',
    });

    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0].stt, 1);
    assert.equal(report.rows[0].employeeCode, '15050401');
    assert.equal(report.dailyTotals[16], 0);
    assert.equal(report.dailyTotals[20], 2.5);
    assert.equal(report.grandTotalHours, 2.5);
  });

  await t.test('formats overtime hours in Vietnamese style', () => {
    assert.equal(formatOvertimeHoursVN(0), '');
    assert.equal(formatOvertimeHoursVN(0, true), '0');
    assert.equal(formatOvertimeHoursVN(4), '4');
    assert.equal(formatOvertimeHoursVN(3.5), '3,5');
    assert.equal(formatOvertimeHoursVN(12.25), '12,25');
  });
});
