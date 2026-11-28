import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOnLeaveEmployeeMapForDate,
  buildOvertimeFormItemsFromBlocks,
  buildPrintableDateGroupsFromItems,
  buildUpdatedOvertimeForm,
  calculateHoursBetween,
  DEFAULT_OVERTIME_DEPARTMENT,
  evaluateOvertimeDateConflict,
  filterOvertimeForms,
  formatOvertimeDepartmentHeaderLabel,
  formatOvertimeFormCodeDisplay,
  generateOvertimeFormCode,
  getLeaveTypeShortLabel,
  isLeaveRecordCoveringDate,
  isOvertimeFormLocked,
  isOvertimeTimeBold,
  reconstructBlocksFromItems,
  reorderOvertimeBlocks,
  formatOvertimeGroupCompactLabel,
  resolveDefaultPrimaryOvertimeDate,
  resolveDepartmentLabel,
  resolveOvertimeMainDepartment,
  resolveRepresentativeOvertimeDate,
  type OvertimeBlockInput,
  type OvertimeFormWithItems,
  type OvertimeLeaveCheckEntry,
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

  it('generates canonical TC-YYYYMMDD form codes and preserves them on display while stripping soft-delete suffixes', () => {
    const code1 = generateOvertimeFormCode('2026-11-16', []);
    assert.equal(code1, 'TC-20261116');

    const code2 = generateOvertimeFormCode('2026-11-21', [code1]);
    assert.equal(code2, 'TC-20261121');

    assert.equal(formatOvertimeFormCodeDisplay('TC-20261116'), 'TC-20261116');
    assert.equal(
      formatOvertimeFormCodeDisplay('TC-20261116-DEL-1763600000000'),
      'TC-20261116'
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
    assert.equal(filterOvertimeForms(forms, '', '2026-11').length, 2);
    assert.equal(filterOvertimeForms(forms, '', '2026-10').length, 0);

    // isOvertimeFormLocked checks both is_locked boolean and 'Đã chốt' status
    assert.equal(isOvertimeFormLocked(null), false);
    assert.equal(isOvertimeFormLocked({ is_locked: false, status: 'Mới tạo' }), false);
    assert.equal(isOvertimeFormLocked({ is_locked: false, status: 'Đã lưu' }), false);
    assert.equal(isOvertimeFormLocked({ is_locked: true, status: 'Đã lưu' }), true);
    assert.equal(isOvertimeFormLocked({ is_locked: false, status: 'Đã chốt' }), true);
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
      form_code: 'TC-20261120',
      department: 'Kỹ Thuật',
      overtime_date: '2026-11-20',
      overtime_dates: ['2026-11-20'],
      total_blocks: 0,
      total_participants: 0,
      total_hours: 0,
      status: 'Mới tạo',
      created_at: '2026-11-20T08:00:00.000Z',
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
    assert.equal(updatedMulti.status, 'Đã lưu');
    assert.deepEqual(updatedMulti.overtime_dates, ['2026-11-19', '2026-11-20']);
    assert.equal(updatedMulti.items[0].overtime_date, '2026-11-19');
    assert.equal(updatedMulti.items[1].overtime_date, '2026-11-20');

    const emptiedShell = buildUpdatedOvertimeForm(updatedMulti, {
      department: 'Kỹ Thuật',
      overtimeDate: '2026-11-20',
      blocks: [],
      employees: sampleEmployees,
    });
    assert.equal(emptiedShell.overtime_date, '2026-11-20');
    assert.equal(emptiedShell.status, 'Mới tạo');
    assert.equal(emptiedShell.total_participants, 0);
    assert.equal(emptiedShell.total_hours, 0);

    // resolveDefaultPrimaryOvertimeDate picks today if present in block dates, else latest block date
    assert.equal(
      resolveDefaultPrimaryOvertimeDate(['2026-11-19', '2026-11-20'], '2026-11-20'),
      '2026-11-20'
    );
    assert.equal(
      resolveDefaultPrimaryOvertimeDate(['2026-11-18', '2026-11-19'], '2026-11-21'),
      '2026-11-19'
    );
  });

  it('blocks immediately when primaryOvertimeDate already has an active form, ignores soft-deleted/self, and allows earlier-day adjustment blocks when primary date is free', () => {
    const existingForms: OvertimeFormWithItems[] = [
      {
        id: 'existing-active',
        form_code: 'TC-20261119-AB12',
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
        form_code: 'TC-20261118-CD34',
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

    // Immediate primaryOvertimeDate conflict check even before blocks are added
    const immediatePrimaryBlocked = evaluateOvertimeDateConflict({
      blocks: [],
      selectedDepartment: 'Bảo trì',
      employees: sampleEmployees,
      existingForms,
      primaryOvertimeDate: '2026-11-19',
      todayIso: '2026-11-20',
    });
    assert.equal(immediatePrimaryBlocked.mode, 'representative_date_blocked');
    assert.equal(immediatePrimaryBlocked.isBlocked, true);
    assert.equal(immediatePrimaryBlocked.conflictingForms[0].id, 'existing-active');

    // Editing the same form excludes itself -> allowed
    const selfEdit = evaluateOvertimeDateConflict({
      blocks: singleDayConflictBlock,
      selectedDepartment: 'ST',
      employees: sampleEmployees,
      existingForms,
      editingFormId: 'existing-active',
      primaryOvertimeDate: '2026-11-19',
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
      primaryOvertimeDate: '2026-11-18',
      todayIso: '2026-11-20',
    });
    assert.equal(softDeletedDateEval.mode, 'none');
    assert.equal(softDeletedDateEval.isBlocked, false);

    // Recording an earlier date (2026-11-19) while primaryOvertimeDate is free (2026-11-20) -> ALLOWED with reminder
    const adjustmentAllowed = evaluateOvertimeDateConflict({
      blocks: singleDayConflictBlock,
      selectedDepartment: 'Kỹ Thuật',
      employees: sampleEmployees,
      existingForms,
      primaryOvertimeDate: '2026-11-20',
      todayIso: '2026-11-20',
    });
    assert.equal(adjustmentAllowed.mode, 'multi_day_reminder');
    assert.equal(adjustmentAllowed.isBlocked, false);
    assert.equal(adjustmentAllowed.representativeDate, '2026-11-20');
    assert.equal(adjustmentAllowed.conflicts[0].date, '2026-11-19');

    // Multi-day blocks when primaryOvertimeDate (2026-11-20) ALREADY has an active form -> BLOCKED
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
    const formsWithToday: OvertimeFormWithItems[] = [
      ...existingForms,
      {
        id: 'existing-today',
        form_code: 'TC-20261120-XY99',
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
      primaryOvertimeDate: '2026-11-20',
      todayIso: '2026-11-20',
    });
    assert.equal(caseBBlocked.mode, 'representative_date_blocked');
    assert.equal(caseBBlocked.isBlocked, true);
    assert.equal(caseBBlocked.conflictingForms[0].form_code, 'TC-20261120-XY99');
  });

  it('fixes main department to "Bộ phận Kỹ thuật" even when selecting sub-groups (IOT/ST/Bảo trì), while preserving explicitly configured other departments', () => {
    const knownSubGroups = ['IOT', 'ST', 'Bảo trì', 'PE', 'AUTO 1', 'JIG/AUTO 2'];

    // Default / aliases / sub-groups -> always "Bộ phận Kỹ thuật"
    assert.equal(
      resolveOvertimeMainDepartment('', knownSubGroups),
      DEFAULT_OVERTIME_DEPARTMENT
    );
    assert.equal(
      resolveOvertimeMainDepartment('ALL', knownSubGroups),
      DEFAULT_OVERTIME_DEPARTMENT
    );
    assert.equal(
      resolveOvertimeMainDepartment('Kỹ Thuật', knownSubGroups),
      DEFAULT_OVERTIME_DEPARTMENT
    );
    assert.equal(
      resolveOvertimeMainDepartment('Toàn bộ bộ phận', knownSubGroups),
      DEFAULT_OVERTIME_DEPARTMENT
    );
    assert.equal(
      resolveOvertimeMainDepartment('IOT', knownSubGroups),
      DEFAULT_OVERTIME_DEPARTMENT
    );
    assert.equal(
      resolveOvertimeMainDepartment('Bảo trì', knownSubGroups),
      DEFAULT_OVERTIME_DEPARTMENT
    );
    assert.equal(
      resolveOvertimeMainDepartment('ST', knownSubGroups),
      DEFAULT_OVERTIME_DEPARTMENT
    );

    // Explicitly configured separate department -> preserved
    assert.equal(
      resolveOvertimeMainDepartment('Sản Xuất', knownSubGroups),
      'Sản Xuất'
    );
    assert.equal(
      resolveOvertimeMainDepartment('Bộ phận Nhân sự', knownSubGroups),
      'Bộ phận Nhân sự'
    );

    // resolveDepartmentLabel never overwrites main department with employee sub-groups
    const iotEmployees: Employee[] = [
      { ...sampleEmployees[0], department: 'IOT' },
      { ...sampleEmployees[1], department: 'ST' },
    ];
    const blocks: OvertimeBlockInput[] = [
      {
        id: 'b-iot',
        overtimeDate: '2026-11-21',
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
      resolveDepartmentLabel('IOT', blocks, iotEmployees, knownSubGroups),
      'Bộ phận Kỹ thuật'
    );
    assert.equal(
      resolveDepartmentLabel('ALL', blocks, iotEmployees, knownSubGroups),
      'Bộ phận Kỹ thuật'
    );
    assert.equal(
      resolveDepartmentLabel('Sản Xuất', blocks, iotEmployees, knownSubGroups),
      'Sản Xuất'
    );

    // TV-PSGC2022 header label & Excel header formatting
    assert.equal(
      formatOvertimeDepartmentHeaderLabel('Bộ phận Kỹ thuật', knownSubGroups),
      'Bộ phận 부서: Kỹ Thuật 기술'
    );
    assert.equal(
      formatOvertimeDepartmentHeaderLabel('IOT', knownSubGroups),
      'Bộ phận 부서: Kỹ Thuật 기술'
    );
    assert.equal(
      formatOvertimeDepartmentHeaderLabel('ALL', knownSubGroups),
      'Bộ phận 부서: Kỹ Thuật 기술'
    );
    assert.equal(
      formatOvertimeDepartmentHeaderLabel('Sản Xuất', knownSubGroups),
      'Bộ phận / 부서: Sản Xuất'
    );
    assert.equal(
      formatOvertimeDepartmentHeaderLabel('Bộ phận Sản xuất', knownSubGroups),
      'Bộ phận Sản xuất / 부서'
    );
  });

  it('filters active leave records by date range, excludes late_early and soft-deleted rows, and matches by employee_id or employee_code', () => {
    const leaveEntries: OvertimeLeaveCheckEntry[] = [
      {
        id: 'lv-1',
        employeeId: 'emp-1',
        type: 'annual_leave',
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        amount: 3,
        reason: 'Nghỉ phép gia đình',
        createdAt: '2026-11-19',
        approvedBy: 'Admin',
        deletedAt: null,
        isDeleted: false,
      },
      {
        id: 'lv-2',
        employeeId: 'legacy-uuid-not-matching',
        employeeCode: 'nv002',
        type: 'regime_leave',
        regimeSubtype: 'Ốm đau / Viện phí',
        startDate: '2026-11-21',
        endDate: '',
        amount: 1,
        reason: 'Khám bệnh',
        createdAt: '2026-11-20',
        approvedBy: 'Admin',
        deletedAt: null,
      },
      {
        id: 'lv-late',
        employeeId: 'emp-2',
        type: 'late_early',
        startDate: '2026-11-20',
        endDate: '2026-11-20',
        amount: 1,
        reason: 'Đi muộn 1h',
        createdAt: '2026-11-20',
        approvedBy: 'Admin',
        deletedAt: null,
      },
      {
        id: 'lv-deleted',
        employeeId: 'emp-2',
        type: 'unpaid_leave',
        startDate: '2026-11-20',
        endDate: '2026-11-20',
        amount: 1,
        reason: 'Đã hủy đơn',
        createdAt: '2026-11-19',
        approvedBy: 'Admin',
        deletedAt: '2026-11-19T10:00:00.000Z',
      },
    ];

    assert.equal(isLeaveRecordCoveringDate(leaveEntries[0], '2026-11-19'), false);
    assert.equal(isLeaveRecordCoveringDate(leaveEntries[0], '2026-11-20'), true);
    assert.equal(isLeaveRecordCoveringDate(leaveEntries[0], '2026-11-21'), true);
    assert.equal(isLeaveRecordCoveringDate(leaveEntries[0], '2026-11-22'), true);
    assert.equal(isLeaveRecordCoveringDate(leaveEntries[0], '2026-11-23'), false);
    assert.equal(isLeaveRecordCoveringDate(leaveEntries[1], '2026-11-21'), true);
    assert.equal(isLeaveRecordCoveringDate(leaveEntries[2], '2026-11-20'), false);
    assert.equal(isLeaveRecordCoveringDate(leaveEntries[3], '2026-11-20'), false);

    // On 2026-11-20: emp-1 is on annual_leave; emp-2 only has late_early and soft-deleted unpaid_leave -> NOT blocked
    const mapNov20 = buildOnLeaveEmployeeMapForDate(
      '2026-11-20',
      leaveEntries,
      sampleEmployees
    );
    assert.equal(mapNov20.has('emp-1'), true);
    assert.equal(mapNov20.has('emp-2'), false);

    // On 2026-11-21: emp-1 is on annual_leave (middle of range); emp-2 is matched via employeeCode 'nv002' -> BOTH blocked
    const mapNov21 = buildOnLeaveEmployeeMapForDate(
      '2026-11-21',
      leaveEntries,
      sampleEmployees
    );
    assert.equal(mapNov21.has('emp-1'), true);
    assert.equal(mapNov21.has('emp-2'), true);
    assert.equal(
      getLeaveTypeShortLabel(mapNov21.get('emp-2')!),
      'Nghỉ Chế độ (Ốm đau / Viện phí)'
    );
  });

  it('reorders overtime blocks cleanly and preserves custom participant totalHours across round-trips', () => {
    const blocks: OvertimeBlockInput[] = [
      {
        id: 'b1',
        overtimeDate: '2026-11-28',
        reasonVi: 'Nhóm 1',
        reasonKr: '그룹 1',
        startTime: '16:10',
        endTime: '19:10',
        selectedEmployeeIds: ['emp-1'],
        participants: [
          { employeeId: 'emp-1', startTime: '16:10', endTime: '19:10', totalHours: 2.5 },
        ],
      },
      {
        id: 'b2',
        overtimeDate: '2026-11-28',
        reasonVi: 'Nhóm 2',
        reasonKr: '그룹 2',
        startTime: '16:10',
        endTime: '20:10',
        selectedEmployeeIds: ['emp-2'],
        participants: [
          { employeeId: 'emp-2', startTime: '16:10', endTime: '20:10', totalHours: 3.5 },
        ],
      },
    ];

    const movedDown = reorderOvertimeBlocks(blocks, 0, 'down');
    assert.deepEqual(movedDown.map((b) => b.id), ['b2', 'b1']);
    const movedUp = reorderOvertimeBlocks(movedDown, 1, 'up');
    assert.deepEqual(movedUp.map((b) => b.id), ['b1', 'b2']);
    // Out-of-bounds swaps are no-ops
    assert.deepEqual(reorderOvertimeBlocks(blocks, 0, 'up').map((b) => b.id), ['b1', 'b2']);
    assert.deepEqual(reorderOvertimeBlocks(blocks, 1, 'down').map((b) => b.id), ['b1', 'b2']);

    const items = buildOvertimeFormItemsFromBlocks('f-roundtrip', movedDown, sampleEmployees, '2026-11-28');
    assert.equal(items[0].block_order, 0);
    assert.equal(items[0].employee_id, 'emp-2');
    assert.equal(items[0].total_hours, 3.5);
    assert.equal(items[1].block_order, 1);
    assert.equal(items[1].employee_id, 'emp-1');
    assert.equal(items[1].total_hours, 2.5);

    const reconstructed = reconstructBlocksFromItems(items);
    assert.deepEqual(reconstructed.map((b) => b.id), ['b2', 'b1']);
    assert.equal(reconstructed[0].participants[0].totalHours, 3.5);
    assert.equal(reconstructed[1].participants[0].totalHours, 2.5);
  });

  it('formats compact 1-line group labels for normal, special (Trực sản xuất, Văn phòng, Phát sinh), and duplicate groups', () => {
    const empMap = new Map<string, Employee>([
      [
        'e1',
        {
          id: 'e1',
          employeeCode: 'NV01',
          fullName: 'Nguyễn Hoàng Long',
          dob: '',
          gender: 'Nam',
          cccd: '',
          phone: '',
          address: '',
          department: 'Bảo trì',
          position: 'NV',
          joinDate: '',
          status: 'Đang làm việc',
          standardAnnualLeave: 12,
          avatarUrl: '',
        },
      ],
      [
        'e2',
        {
          id: 'e2',
          employeeCode: 'NV02',
          fullName: 'Nguyễn Thành Công',
          dob: '',
          gender: 'Nam',
          cccd: '',
          phone: '',
          address: '',
          department: 'PE',
          position: 'NV',
          joinDate: '',
          status: 'Đang làm việc',
          standardAnnualLeave: 12,
          avatarUrl: '',
        },
      ],
      [
        'e3',
        {
          id: 'e3',
          employeeCode: 'NV03',
          fullName: 'Trần Văn Nam',
          dob: '',
          gender: 'Nam',
          cccd: '',
          phone: '',
          address: '',
          department: 'AUTO 1',
          position: 'NV',
          joinDate: '',
          status: 'Đang làm việc',
          standardAnnualLeave: 12,
          avatarUrl: '',
        },
      ],
      [
        'e4',
        {
          id: 'e4',
          employeeCode: 'NV04',
          fullName: 'Kiều Thị Minh Lý',
          dob: '',
          gender: 'Nữ',
          cccd: '',
          phone: '',
          address: '',
          department: 'Văn Phòng',
          position: 'NV',
          joinDate: '',
          status: 'Đang làm việc',
          standardAnnualLeave: 12,
          avatarUrl: '',
        },
      ],
      [
        'e5',
        {
          id: 'e5',
          employeeCode: 'NV05',
          fullName: 'Lê Văn A',
          dob: '',
          gender: 'Nam',
          cccd: '',
          phone: '',
          address: '',
          department: 'ST',
          position: 'NV',
          joinDate: '',
          status: 'Đang làm việc',
          standardAnnualLeave: 12,
          avatarUrl: '',
        },
      ],
    ]);

    const blocks: OvertimeBlockInput[] = [
      {
        id: 'g1',
        overtimeDate: '2026-11-28',
        reasonVi: 'Trực sản xuất',
        reasonKr: '',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e1', 'e2'],
        participants: [
          { employeeId: 'e1', startTime: '16:10', endTime: '18:10' },
          { employeeId: 'e2', startTime: '16:10', endTime: '18:10' },
        ],
      },
      {
        id: 'g2',
        overtimeDate: '2026-11-28',
        reasonVi: 'Lắp ráp máy',
        reasonKr: '',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e3'],
        participants: [{ employeeId: 'e3', startTime: '16:10', endTime: '18:10' }],
      },
      {
        id: 'g3',
        overtimeDate: '2026-11-28',
        reasonVi: 'Hiệu chuẩn',
        reasonKr: '',
        startTime: '16:10',
        endTime: '19:10',
        selectedEmployeeIds: ['e4'],
        participants: [{ employeeId: 'e4', startTime: '16:10', endTime: '19:10' }],
      },
      {
        id: 'g4',
        overtimeDate: '2026-11-27',
        reasonVi: 'Kiểm tra đơn hàng',
        reasonKr: '',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e5'],
        participants: [{ employeeId: 'e5', startTime: '16:10', endTime: '18:10' }],
      },
    ];

    assert.equal(
      formatOvertimeGroupCompactLabel({
        block: blocks[0],
        index: 0,
        formOvertimeDate: '2026-11-28',
        allBlocks: blocks,
        employeeMap: empMap,
      }),
      '#1 Trực sản xuất - Nguyễn Hoàng Long, Nguyễn Thành Công'
    );

    assert.equal(
      formatOvertimeGroupCompactLabel({
        block: blocks[1],
        index: 1,
        formOvertimeDate: '2026-11-28',
        allBlocks: blocks,
        employeeMap: empMap,
      }),
      '#2 AUTO 1'
    );

    assert.equal(
      formatOvertimeGroupCompactLabel({
        block: blocks[2],
        index: 2,
        formOvertimeDate: '2026-11-28',
        allBlocks: blocks,
        employeeMap: empMap,
      }),
      '#3 Văn Phòng - Kiều Thị Minh Lý'
    );

    assert.equal(
      formatOvertimeGroupCompactLabel({
        block: blocks[3],
        index: 3,
        formOvertimeDate: '2026-11-28',
        allBlocks: blocks,
        employeeMap: empMap,
      }),
      '#4 Phát sinh (27/11) - Lê Văn A'
    );
  });
});


