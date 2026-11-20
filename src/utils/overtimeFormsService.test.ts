import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOvertimeFormItemsFromBlocks,
  buildPrintableDateGroupsFromItems,
  calculateHoursBetween,
  filterOvertimeForms,
  generateOvertimeFormCode,
  isOvertimeTimeBold,
  reconstructBlocksFromItems,
  type OvertimeBlockInput,
  type OvertimeFormWithItems,
} from './overtimeFormsService';
import type { Employee } from '../types/hr';

const sampleEmployees: Employee[] = [
  {
    id: 'emp-1',
    employeeCode: 'NV001',
    fullName: 'Nguyễn Văn A',
    dob: '1992-01-01',
    gender: 'Nam',
    cccd: '012345678901',
    phone: '0901234567',
    address: 'Hà Nội',
    department: 'Kỹ Thuật',
    position: 'Nhân viên',
    joinDate: '2022-01-01',
    avatarUrl: '',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    companyId: 'c1',
  },
  {
    id: 'emp-2',
    employeeCode: 'NV002',
    fullName: 'Trần Thị B',
    dob: '1994-05-10',
    gender: 'Nữ',
    cccd: '012345678902',
    phone: '0901234568',
    address: 'Hà Nội',
    department: 'Kỹ Thuật',
    position: 'Nhân viên',
    joinDate: '2022-01-01',
    avatarUrl: '',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    companyId: 'c1',
  },
];

describe('overtimeFormsService pure logic', () => {
  it('bolds times at or after 20:10 (1210 minutes)', () => {
    assert.equal(isOvertimeTimeBold('20:10'), true);
    assert.equal(isOvertimeTimeBold('20h10'), true);
    assert.equal(isOvertimeTimeBold('21:30'), true);
    assert.equal(isOvertimeTimeBold('20:09'), false);
    assert.equal(isOvertimeTimeBold('16h10'), false);
    assert.equal(isOvertimeTimeBold(''), false);
  });

  it('calculates overtime duration in decimal hours accurately', () => {
    assert.equal(calculateHoursBetween('16:10', '20:10'), 4);
    assert.equal(calculateHoursBetween('16:10', '21:40'), 5.5);
    assert.equal(calculateHoursBetween('20:10', '16:10'), 0);
    assert.equal(calculateHoursBetween('', '20:10'), 0);
  });

  it('generates sequential form codes per date', () => {
    assert.equal(generateOvertimeFormCode('2026-11-16', []), 'TC-20261116-001');
    assert.equal(
      generateOvertimeFormCode('2026-11-16', [
        'TC-20261116-001',
        'TC-20261116-003',
        'TC-20261115-009',
      ]),
      'TC-20261116-004'
    );
  });

  it('builds form items and reconstructs multi-date blocks with custom times intact', () => {
    const blocks: OvertimeBlockInput[] = [
      {
        id: 'b1',
        overtimeDate: '2026-11-16',
        reasonVi: 'Trực sản xuất',
        reasonKr: '생산 당직',
        startTime: '16:10',
        endTime: '20:10',
        selectedEmployeeIds: ['emp-1', 'emp-2'],
        participants: [
          { employeeId: 'emp-1', startTime: '16:10', endTime: '20:10' },
          { employeeId: 'emp-2', startTime: '16:10', endTime: '21:10' },
        ],
      },
      {
        id: 'b2',
        overtimeDate: '2026-11-17',
        reasonVi: 'Sửa máy',
        reasonKr: '설비 수리',
        startTime: '17:00',
        endTime: '20:30',
        selectedEmployeeIds: ['emp-1'],
        participants: [
          { employeeId: 'emp-1', startTime: '17:00', endTime: '20:30' },
        ],
      },
    ];

    const items = buildOvertimeFormItemsFromBlocks(
      'form-1',
      blocks,
      sampleEmployees,
      '2026-11-16'
    );

    assert.equal(items.length, 3);
    assert.equal(items[0].block_order, 0);
    assert.equal(items[0].item_order, 0);
    assert.equal(items[0].employee_name, 'Nguyễn Văn A');
    assert.equal(items[1].end_time, '21:10');
    assert.equal(items[1].total_hours, 5);
    assert.equal(items[2].overtime_date, '2026-11-17');

    const reconstructed = reconstructBlocksFromItems(items);
    assert.equal(reconstructed.length, 2);
    assert.equal(reconstructed[0].participants.length, 2);
    assert.equal(reconstructed[0].participants[1].endTime, '21:10');
    assert.equal(reconstructed[1].overtimeDate, '2026-11-17');

    const printable = buildPrintableDateGroupsFromItems(items);
    assert.equal(printable.length, 2);
    assert.equal(printable[0].formattedDate, '16/11/2026');
    assert.equal(printable[0].blocks[0].rows[0].no, 1);
    assert.equal(printable[0].blocks[0].rows[0].rowSpan, 2);
    assert.equal(printable[0].blocks[0].rows[1].isFirstInBlock, false);
    assert.equal(printable[0].blocks[0].rows[1].endTimeFormatted, '21h10');
    assert.equal(printable[1].formattedDate, '17/11/2026');
    assert.equal(printable[1].blocks[0].rows[0].no, 1);
  });

  it('filters forms by search query, overtime date, and excludes soft-deleted forms', () => {
    const forms: OvertimeFormWithItems[] = [
      {
        id: 'f1',
        form_code: 'TC-20261116-001',
        department: 'Kỹ Thuật',
        overtime_date: '2026-11-16',
        overtime_dates: ['2026-11-16', '2026-11-17'],
        total_blocks: 2,
        total_participants: 4,
        total_hours: 16,
        status: 'Đã lưu',
        created_at: '2026-11-16T08:00:00.000Z',
        deleted_at: null,
        items: [],
      },
      {
        id: 'f2',
        form_code: 'TC-20261115-001',
        department: 'Sản Xuất',
        overtime_date: '2026-11-15',
        overtime_dates: ['2026-11-15'],
        total_blocks: 1,
        total_participants: 2,
        total_hours: 8,
        status: 'Đã lưu',
        created_at: '2026-11-15T08:00:00.000Z',
        deleted_at: null,
        items: [],
      },
      {
        id: 'f3',
        form_code: 'TC-20261116-002',
        department: 'Kỹ Thuật',
        overtime_date: '2026-11-16',
        overtime_dates: ['2026-11-16'],
        total_blocks: 1,
        total_participants: 1,
        total_hours: 4,
        status: 'Đã lưu',
        created_at: '2026-11-16T09:00:00.000Z',
        deleted_at: '2026-11-16T10:00:00.000Z',
        items: [],
      },
    ];

    assert.equal(filterOvertimeForms(forms, '', '').length, 2);
    assert.equal(filterOvertimeForms(forms, 'ky thuat', '').length, 1);
    assert.equal(filterOvertimeForms(forms, 'TC-20261115', '')[0].id, 'f2');
    assert.equal(filterOvertimeForms(forms, '', '2026-11-17')[0].id, 'f1');
    assert.equal(filterOvertimeForms(forms, 'san xuat', '2026-11-16').length, 0);
  });
});
