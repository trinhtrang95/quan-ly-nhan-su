import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOvertimeFormItemsFromBlocks,
  buildPrintableDateGroupsFromItems,
  buildUpdatedOvertimeForm,
  calculateHoursBetween,
  evaluateOvertimeDateConflict,
  filterOvertimeForms,
  formatOvertimeFormCodeDisplay,
  generateOvertimeFormCode,
  isOvertimeTimeBold,
  reconstructBlocksFromItems,
  resolveRepresentativeOvertimeDate,
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

  it('generates canonical TC-YYYYMMDD form codes without -001/-002 suffix and strips legacy suffixes on display', () => {
    assert.equal(generateOvertimeFormCode('2026-11-16', []), 'TC-20261116');
    assert.equal(
      generateOvertimeFormCode('2026-11-16', ['TC-20261116-001', 'TC-20261116-003']),
      'TC-20261116'
    );
    assert.equal(formatOvertimeFormCodeDisplay('TC-20261116-009'), 'TC-20261116');
    assert.equal(formatOvertimeFormCodeDisplay('TC-20261116'), 'TC-20261116');
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

  it('builds an updated overtime form preserving id, form_code, and created_at while recalculating totals', () => {
    const existing: OvertimeFormWithItems = {
      id: 'form-edit-1',
      form_code: 'TC-20261116-005',
      department: 'Kỹ Thuật',
      overtime_date: '2026-11-16',
      overtime_dates: ['2026-11-16'],
      total_blocks: 1,
      total_participants: 1,
      total_hours: 4,
      status: 'Đã lưu',
      created_at: '2026-11-16T08:00:00.000Z',
      deleted_at: null,
      items: [],
    };

    const updated = buildUpdatedOvertimeForm(existing, {
      department: 'Sản Xuất',
      overtimeDate: '2026-11-16',
      employees: sampleEmployees,
      blocks: [
        {
          id: 'b-edit-1',
          overtimeDate: '2026-11-16',
          reasonVi: 'Bảo dưỡng máy',
          reasonKr: '정기 보수',
          startTime: '16:10',
          endTime: '20:40',
          selectedEmployeeIds: ['emp-1', 'emp-2'],
          participants: [
            { employeeId: 'emp-1', startTime: '16:10', endTime: '20:40' },
            { employeeId: 'emp-2', startTime: '16:10', endTime: '21:10' },
          ],
        },
      ],
    });

    assert.equal(updated.id, 'form-edit-1');
    assert.equal(updated.form_code, 'TC-20261116-005');
    assert.equal(updated.created_at, '2026-11-16T08:00:00.000Z');
    assert.equal(updated.department, 'Sản Xuất');
    assert.equal(updated.total_participants, 2);
    assert.equal(updated.total_hours, 9.5);
    assert.equal(updated.items.length, 2);
    assert.equal(updated.items[0].reason_vi, 'Bảo dưỡng máy');
    assert.equal(updated.items[1].end_time, '21:10');
    assert.ok(updated.updated_at);
  });

  it('resolves representative overtime_date: exact date for 1-day form, today for >= 2-day form while preserving item dates', () => {
    const singleDayBlocks: OvertimeBlockInput[] = [
      {
        id: 'b-single',
        overtimeDate: '2026-11-19',
        reasonVi: 'Trực sản xuất',
        reasonKr: '생산 당직',
        startTime: '16:10',
        endTime: '20:10',
        selectedEmployeeIds: ['emp-1'],
        participants: [
          { employeeId: 'emp-1', startTime: '16:10', endTime: '20:10' },
        ],
      },
    ];
    assert.equal(
      resolveRepresentativeOvertimeDate(singleDayBlocks, '2026-11-19', '2026-11-20'),
      '2026-11-19'
    );

    const multiDayBlocks: OvertimeBlockInput[] = [
      ...singleDayBlocks,
      {
        id: 'b-day2',
        overtimeDate: '2026-11-20',
        reasonVi: 'Hỗ trợ sản xuất gấp',
        reasonKr: '긴급 생산 지원',
        startTime: '16:10',
        endTime: '20:10',
        selectedEmployeeIds: ['emp-2'],
        participants: [
          { employeeId: 'emp-2', startTime: '16:10', endTime: '20:10' },
        ],
      },
    ];
    assert.equal(
      resolveRepresentativeOvertimeDate(multiDayBlocks, '2026-11-19', '2026-11-20'),
      '2026-11-20'
    );

    const existing: OvertimeFormWithItems = {
      id: 'form-multi-edit',
      form_code: 'TC-20261119-001',
      department: 'Kỹ Thuật',
      overtime_date: '2026-11-19',
      overtime_dates: ['2026-11-19'],
      total_blocks: 1,
      total_participants: 1,
      total_hours: 4,
      status: 'Đã lưu',
      created_at: '2026-11-19T08:00:00.000Z',
      deleted_at: null,
      items: [],
    };
    const updatedMulti = buildUpdatedOvertimeForm(
      existing,
      {
        department: 'Kỹ Thuật',
        overtimeDate: '2026-11-19',
        blocks: multiDayBlocks,
        employees: sampleEmployees,
      },
      '2026-11-20'
    );
    assert.equal(updatedMulti.overtime_date, '2026-11-20');
    assert.deepEqual(updatedMulti.overtime_dates, ['2026-11-19', '2026-11-20']);
    assert.equal(updatedMulti.items[0].overtime_date, '2026-11-19');
    assert.equal(updatedMulti.items[1].overtime_date, '2026-11-20');
  });

  it('enforces global 1-form-per-day duplicate blocking (regardless of department), ignores soft-deleted/self, allows multi-day when today is free, and blocks multi-day if today already has a form', () => {
    const existingForms: OvertimeFormWithItems[] = [
      {
        id: 'existing-active',
        form_code: 'TC-20261119',
        department: 'ST',
        overtime_date: '2026-11-19',
        overtime_dates: ['2026-11-19'],
        total_blocks: 1,
        total_participants: 1,
        total_hours: 4,
        status: 'Đã lưu',
        created_at: '2026-11-19T08:00:00.000Z',
        deleted_at: null,
        items: [
          {
            id: 'i1',
            form_id: 'existing-active',
            overtime_date: '2026-11-19',
            block_order: 0,
            item_order: 0,
            employee_id: 'emp-1',
            employee_code: 'NV001',
            employee_name: 'Nguyễn Văn A',
            reason_vi: 'Trực sản xuất',
            reason_kr: '생산 당직',
            start_time: '16:10',
            end_time: '20:10',
            total_hours: 4,
            deleted_at: null,
          },
        ],
      },
      {
        id: 'existing-deleted',
        form_code: 'TC-20261118',
        department: 'Kỹ Thuật',
        overtime_date: '2026-11-18',
        overtime_dates: ['2026-11-18'],
        total_blocks: 1,
        total_participants: 1,
        total_hours: 4,
        status: 'Đã lưu',
        created_at: '2026-11-18T08:00:00.000Z',
        deleted_at: '2026-11-18T12:00:00.000Z',
        items: [],
      },
    ];

    const singleDayConflictBlock: OvertimeBlockInput[] = [
      {
        id: 'b1',
        overtimeDate: '2026-11-19',
        reasonVi: 'Trực sản xuất',
        reasonKr: '생산 당직',
        startTime: '16:10',
        endTime: '20:10',
        selectedEmployeeIds: ['emp-1'],
        participants: [
          { employeeId: 'emp-1', startTime: '16:10', endTime: '20:10' },
        ],
      },
    ];

    // Case A: 1 unique date matching active form EVEN WITH A DIFFERENT DEPARTMENT (Bảo trì vs ST) -> BLOCKED globally
    const caseADiffDept = evaluateOvertimeDateConflict({
      blocks: singleDayConflictBlock,
      selectedDepartment: 'Bảo trì',
      employees: sampleEmployees,
      existingForms,
      todayIso: '2026-11-20',
    });
    assert.equal(caseADiffDept.mode, 'single_day_blocked');
    assert.equal(caseADiffDept.isBlocked, true);
    assert.equal(caseADiffDept.representativeDate, '2026-11-19');
    assert.equal(caseADiffDept.conflictingForms[0].form_code, 'TC-20261119');

    // Editing the same form excludes itself -> allowed
    const selfEdit = evaluateOvertimeDateConflict({
      blocks: singleDayConflictBlock,
      selectedDepartment: 'ST',
      employees: sampleEmployees,
      existingForms,
      editingFormId: 'existing-active',
      todayIso: '2026-11-20',
    });
    assert.equal(selfEdit.mode, 'none');
    assert.equal(selfEdit.isBlocked, false);

    // Soft-deleted date -> allowed
    const softDeletedDateEval = evaluateOvertimeDateConflict({
      blocks: [{ ...singleDayConflictBlock[0], overtimeDate: '2026-11-18' }],
      selectedDepartment: 'Kỹ Thuật',
      employees: sampleEmployees,
      existingForms,
      todayIso: '2026-11-20',
    });
    assert.equal(softDeletedDateEval.mode, 'none');
    assert.equal(softDeletedDateEval.isBlocked, false);

    // Case B1: >= 2 unique dates overlapping yesterday (2026-11-19) while today (2026-11-20) has NO form -> ALLOWED with reminder
    const multiDayAdjustment: OvertimeBlockInput[] = [
      ...singleDayConflictBlock,
      {
        id: 'b2',
        overtimeDate: '2026-11-20',
        reasonVi: 'Phát sinh giờ',
        reasonKr: '추가 잔업',
        startTime: '16:10',
        endTime: '20:10',
        selectedEmployeeIds: ['emp-1'],
        participants: [
          { employeeId: 'emp-1', startTime: '16:10', endTime: '20:10' },
        ],
      },
    ];
    const caseBAllowed = evaluateOvertimeDateConflict({
      blocks: multiDayAdjustment,
      selectedDepartment: 'Bảo trì',
      employees: sampleEmployees,
      existingForms,
      todayIso: '2026-11-20',
    });
    assert.equal(caseBAllowed.mode, 'multi_day_reminder');
    assert.equal(caseBAllowed.isBlocked, false);
    assert.equal(caseBAllowed.representativeDate, '2026-11-20');
    assert.equal(caseBAllowed.conflicts.length, 1);
    assert.equal(caseBAllowed.conflicts[0].date, '2026-11-19');

    // Case B2: >= 2 unique dates when today (2026-11-20) ALREADY has an active form -> BLOCKED (1 form per day)
    const formsWithToday: OvertimeFormWithItems[] = [
      ...existingForms,
      {
        id: 'existing-today',
        form_code: 'TC-20261120',
        department: 'Kỹ Thuật',
        overtime_date: '2026-11-20',
        overtime_dates: ['2026-11-20'],
        total_blocks: 1,
        total_participants: 1,
        total_hours: 4,
        status: 'Đã lưu',
        created_at: '2026-11-20T08:00:00.000Z',
        deleted_at: null,
        items: [],
      },
    ];
    const caseBBlocked = evaluateOvertimeDateConflict({
      blocks: multiDayAdjustment,
      selectedDepartment: 'Bảo trì',
      employees: sampleEmployees,
      existingForms: formsWithToday,
      todayIso: '2026-11-20',
    });
    assert.equal(caseBBlocked.mode, 'representative_date_blocked');
    assert.equal(caseBBlocked.isBlocked, true);
    assert.equal(caseBBlocked.conflictingForms[0].form_code, 'TC-20261120');
  });
});
