import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeOvertimeFormGroupStatus,
  buildOnLeaveEmployeeMapForDate,
  buildOvertimeFormItemsFromBlocks,
  buildPrintableDateGroupsFromItems,
  buildUpdatedOvertimeForm,
  calculateHoursBetween,
  computeOvertimeA4Density,
  DEFAULT_OVERTIME_DEPARTMENT,
  evaluateOvertimeDateConflict,
  filterEmployeesByQuery,
  filterOvertimeForms,
  formatOvertimeDepartmentHeaderLabel,
  formatOvertimeFormCodeDisplay,
  generateOvertimeFormCode,
  getLeaveTypeShortLabel,
  isLeaveRecordCoveringDate,
  isOvertimeFormLocked,
  isOvertimeTimeBold,
  OVERTIME_STANDARD_GROUPS,
  reconstructBlocksFromItems,
  reorderOvertimeBlocks,
  formatOvertimeGroupCompactLabel,
  resolveDefaultPrimaryOvertimeDate,
  resolveDepartmentLabel,
  resolveOvertimeMainDepartment,
  resolveRepresentativeOvertimeDate,
  shiftIsoDateDays,
  sortOvertimeBlocksByStandardOrder,
  sortParticipantsByReasonScope,
  type OvertimeBlockInput,
  type OvertimeFormWithItems,
  type OvertimeLeaveCheckEntry,
} from './overtimeFormsService';
import {
  computeExcelBlockRowHeight,
  computeExcelDensityConfig,
  OVERTIME_EXCEL_COLUMN_WIDTHS,
  overtimeExportService,
} from './overtimeExportService';
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

  it('computes 3-tier A4 vertical density classes cleanly without changing horizontal layout', () => {
    const small = computeOvertimeA4Density(8);
    assert.equal(small.tier, 'spacious');
    assert.equal(small.cellPaddingClass, 'py-2');
    assert.match(small.tableTextClass, /11\.5px/);
    assert.equal(small.signatureRowHeightClass, 'h-16');

    const medium = computeOvertimeA4Density(18);
    assert.equal(medium.tier, 'compact');
    assert.equal(medium.cellPaddingClass, 'py-1');
    assert.match(medium.tableTextClass, /10\.5px/);
    assert.equal(medium.signatureRowHeightClass, 'h-13');

    const dense = computeOvertimeA4Density(25);
    assert.equal(dense.tier, 'dense');
    assert.equal(dense.cellPaddingClass, 'py-\[2px\]');
    assert.match(dense.tableTextClass, /9\.5px/);
    assert.equal(dense.signatureRowHeightClass, 'h-11');
    assert.equal(dense.dateGroupMarginClass, 'mb-2');
  });

  it('builds Excel workbook with synchronized 7-column widths, wrapped reason heights, and A4 portrait pageSetup', async () => {
    const manyEmployees: Employee[] = Array.from({ length: 24 }, (_, idx) => ({
      ...sampleEmployees[0],
      id: `emp-${idx + 1}`,
      employeeCode: `NV${String(idx + 1).padStart(3, '0')}`,
      fullName: idx === 0 ? 'Nguyễn Hoàng Quang Huy' : `Nhân sự ${idx + 1}`,
    }));

    const { workbook } = await overtimeExportService.buildWorkbook({
      department: 'Bộ phận Kỹ thuật',
      overtimeDate: '2026-11-28',
      employees: manyEmployees,
      preserveBlockOrder: true,
      blocks: [
        {
          id: 'blk-1',
          overtimeDate: '2026-11-28',
          reasonVi: 'Xử lý sự cố trên line lắp ráp tự động rất dài để kiểm tra tự động xuống dòng\nThay bánh xe máy uốn chân pin S line',
          reasonKr: '라인 설비 이상 발생 항목 조치\n핀 벤딩기 휠 교체',
          startTime: '16:10',
          endTime: '20:10',
          selectedEmployeeIds: manyEmployees.slice(0, 2).map((e) => e.id),
        },
        {
          id: 'blk-2',
          overtimeDate: '2026-11-28',
          reasonVi: 'Trực sản xuất',
          reasonKr: '생산 당직',
          startTime: '16:10',
          endTime: '18:10',
          selectedEmployeeIds: manyEmployees.slice(2).map((e) => e.id),
        },
      ],
    });

    const sheet = workbook.getWorksheet('TV-PSGC2022');
    assert.ok(sheet);
    assert.equal(sheet.getColumn(1).width, OVERTIME_EXCEL_COLUMN_WIDTHS.no);
    assert.equal(sheet.getColumn(2).width, OVERTIME_EXCEL_COLUMN_WIDTHS.employeeName);
    const reasonCombinedWidth =
      (sheet.getColumn(3).width || 0) +
      (sheet.getColumn(4).width || 0) +
      (sheet.getColumn(5).width || 0);
    assert.equal(reasonCombinedWidth, 42);
    assert.equal(sheet.getColumn(6).width, 11);
    assert.equal(sheet.getColumn(7).width, 11);
    assert.equal(sheet.getColumn(8).width, 14);
    assert.equal(sheet.getColumn(9).width, 10);

    assert.equal(sheet.pageSetup.paperSize, 9);
    assert.equal(sheet.pageSetup.orientation, 'portrait');
    assert.equal(sheet.pageSetup.fitToPage, true);
    assert.equal(sheet.pageSetup.fitToWidth, 1);
    assert.equal(sheet.pageSetup.fitToHeight, 1);
    assert.equal(sheet.pageSetup.margins?.left, 0.35);
    assert.equal(sheet.pageSetup.margins?.right, 0.35);

    // Row 10 is first data row: reason wraps across multiple lines -> taller than dense base 17
    const firstDataRow = sheet.getRow(10);
    assert.equal(firstDataRow.getCell('B').value, 'Nguyễn Hoàng Quang Huy');
    assert.equal(firstDataRow.getCell('C').alignment?.wrapText, true);
    assert.ok((firstDataRow.height || 0) > computeExcelDensityConfig(24).baseRowHeight);

    // Row 12 is second block with 22 rows and short 2-line reason -> uses dense baseRowHeight 17
    const denseRow = sheet.getRow(12);
    assert.equal(denseRow.height, 17);

    // Over 35 rows sets fitToHeight = 0 for clean multi-page pagination
    assert.equal(computeExcelDensityConfig(36).fitToHeight, 0);
    assert.ok(
      computeExcelBlockRowHeight('Dòng 1\nDòng 2\nDòng 3\nDòng 4', 1, 10) >= 60
    );
  });

  it('analyzes fixed 9-item overtime group status with distinct prior dates, production duty, and normalized dept names', () => {
    assert.equal(OVERTIME_STANDARD_GROUPS.length, 9);
    assert.equal(shiftIsoDateDays('2026-11-30', -1), '2026-11-29');
    assert.equal(shiftIsoDateDays('2026-11-30', -2), '2026-11-28');

    const deptEmployees: Employee[] = [
      { ...sampleEmployees[0], id: 'e-bt', employeeCode: 'NV101', fullName: 'NV Bảo trì', department: 'Bảo trì' },
      { ...sampleEmployees[0], id: 'e-vp', employeeCode: 'NV102', fullName: 'NV Văn phòng', department: 'Văn Phòng' },
      { ...sampleEmployees[0], id: 'e-pe', employeeCode: 'NV103', fullName: 'NV PE', department: 'PE' },
      { ...sampleEmployees[0], id: 'e-truc', employeeCode: 'NV104', fullName: 'NV Trực', department: 'AUTO 1' },
    ];
    const empMap = new Map(deptEmployees.map((e) => [e.id, e]));

    const blocks: OvertimeBlockInput[] = [
      {
        id: 'b-d2',
        overtimeDate: '2026-11-28',
        reasonVi: 'Phát sinh xử lý line',
        reasonKr: '',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e-pe'],
        participants: [{ employeeId: 'e-pe', startTime: '16:10', endTime: '18:10' }],
      },
      {
        id: 'b-d1',
        overtimeDate: '2026-11-29',
        reasonVi: 'Phát sinh hôm qua',
        reasonKr: '',
        startTime: '16:10',
        endTime: '19:10',
        selectedEmployeeIds: ['e-pe'],
        participants: [{ employeeId: 'e-pe', startTime: '16:10', endTime: '19:10' }],
      },
      {
        id: 'b-prod',
        overtimeDate: '2026-11-30',
        reasonVi: 'Trực sản xuất',
        reasonKr: '생산 당직',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e-truc'],
        participants: [{ employeeId: 'e-truc', startTime: '16:10', endTime: '18:10' }],
      },
      {
        id: 'b-vp',
        overtimeDate: '2026-11-30',
        reasonVi: 'Kiểm kê cuối tháng',
        reasonKr: '',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e-vp'],
        participants: [{ employeeId: 'e-vp', startTime: '16:10', endTime: '18:10' }],
      },
    ];

    const status = analyzeOvertimeFormGroupStatus(blocks, '2026-11-30', empMap);
    assert.equal(status.prev_day.isRegistered, true);
    assert.equal(status.prev_day.count, 2);
    assert.equal(status.prev_day.badgeText, '2 ngày');

    assert.equal(status.production_duty.isRegistered, true);
    assert.equal(status.production_duty.count, 1);
    assert.equal(status.production_duty.badgeText, '1 người');

    // Normalized 'Văn Phòng' -> matches #9 'Văn phòng'
    assert.equal(status.van_phong.isRegistered, true);
    assert.equal(status.van_phong.count, 1);
    assert.equal(status.van_phong.badgeText, '1 người');

    // PE only worked on prior days -> current-day PE group stays unregistered
    assert.equal(status.pe.isRegistered, false);
    assert.equal(status.bao_tri.isRegistered, false);
  });

  it('auto-sorts overtime blocks according to standard 1 -> 9 priority with D-2 before D-1', () => {
    const deptEmployees: Employee[] = [
      { ...sampleEmployees[0], id: 'e-bt', employeeCode: 'NV101', fullName: 'NV Bảo trì', department: 'Bảo trì' },
      { ...sampleEmployees[0], id: 'e-vp', employeeCode: 'NV102', fullName: 'NV Văn phòng', department: 'Văn Phòng' },
      { ...sampleEmployees[0], id: 'e-pe', employeeCode: 'NV103', fullName: 'NV PE', department: 'PE' },
      { ...sampleEmployees[0], id: 'e-truc', employeeCode: 'NV104', fullName: 'NV Trực', department: 'AUTO 1' },
    ];
    const empMap = new Map(deptEmployees.map((e) => [e.id, e]));

    const unsorted: OvertimeBlockInput[] = [
      {
        id: 'vp',
        overtimeDate: '2026-11-30',
        reasonVi: 'Hỗ trợ văn phòng',
        reasonKr: '',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e-vp'],
        participants: [{ employeeId: 'e-vp', startTime: '16:10', endTime: '18:10' }],
      },
      {
        id: 'd1',
        overtimeDate: '2026-11-29',
        reasonVi: 'Phát sinh D-1',
        reasonKr: '',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e-pe'],
        participants: [{ employeeId: 'e-pe', startTime: '16:10', endTime: '18:10' }],
      },
      {
        id: 'bt',
        overtimeDate: '2026-11-30',
        reasonVi: 'Bảo dưỡng máy',
        reasonKr: '',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e-bt'],
        participants: [{ employeeId: 'e-bt', startTime: '16:10', endTime: '18:10' }],
      },
      {
        id: 'prod',
        overtimeDate: '2026-11-30',
        reasonVi: 'Trực sản xuất',
        reasonKr: '생산 당직',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e-truc'],
        participants: [{ employeeId: 'e-truc', startTime: '16:10', endTime: '18:10' }],
      },
      {
        id: 'd2',
        overtimeDate: '2026-11-28',
        reasonVi: 'Phát sinh D-2',
        reasonKr: '',
        startTime: '16:10',
        endTime: '18:10',
        selectedEmployeeIds: ['e-pe'],
        participants: [{ employeeId: 'e-pe', startTime: '16:10', endTime: '18:10' }],
      },
    ];

    const sorted = sortOvertimeBlocksByStandardOrder(unsorted, '2026-11-30', empMap);
    assert.deepEqual(
      sorted.map((b) => b.id),
      ['d2', 'd1', 'prod', 'bt', 'vp']
    );
  });

  it('pushes employees with individual custom reasons to block bottom with unmerged preview rows and Excel cells', async () => {
    const threeEmps: Employee[] = [
      { ...sampleEmployees[0], id: 'emp-a', employeeCode: 'NV001', fullName: 'Nguyễn Văn A' },
      { ...sampleEmployees[0], id: 'emp-b', employeeCode: 'NV002', fullName: 'Trần Thị B' },
      { ...sampleEmployees[0], id: 'emp-c', employeeCode: 'NV003', fullName: 'Lê Văn C' },
    ];

    // emp-a has a custom reason while emp-b and emp-c share the block reason
    const rawParticipants = [
      {
        employeeId: 'emp-a',
        startTime: '16:10',
        endTime: '20:10',
        reasonVi: 'Sửa jig riêng cho line 2',
        reasonKr: '라인 2 전용 지그 수리',
      },
      { employeeId: 'emp-b', startTime: '16:10', endTime: '18:10' },
      { employeeId: 'emp-c', startTime: '16:10', endTime: '18:10' },
    ];

    const sortedParticipants = sortParticipantsByReasonScope(
      rawParticipants,
      'Trực sản xuất',
      '생산 당직'
    );
    assert.deepEqual(
      sortedParticipants.map((p) => p.employeeId),
      ['emp-b', 'emp-c', 'emp-a']
    );

    const block: OvertimeBlockInput = {
      id: 'blk-mixed',
      overtimeDate: '2026-11-30',
      reasonVi: 'Trực sản xuất',
      reasonKr: '생산 당직',
      startTime: '16:10',
      endTime: '18:10',
      selectedEmployeeIds: sortedParticipants.map((p) => p.employeeId),
      participants: sortedParticipants,
    };

    const items = buildOvertimeFormItemsFromBlocks(
      'form-1',
      [block],
      threeEmps,
      '2026-11-30'
    );
    assert.equal(items.length, 3);
    assert.equal(items[0].employee_name, 'Trần Thị B');
    assert.equal(items[0].reason_vi, 'Trực sản xuất');
    assert.equal(items[1].employee_name, 'Lê Văn C');
    assert.equal(items[1].reason_vi, 'Trực sản xuất');
    assert.equal(items[2].employee_name, 'Nguyễn Văn A');
    assert.equal(items[2].reason_vi, 'Sửa jig riêng cho line 2');

    const reconstructed = reconstructBlocksFromItems(items);
    assert.equal(reconstructed.length, 1);
    assert.equal(reconstructed[0].reasonVi, 'Trực sản xuất');
    assert.equal(reconstructed[0].participants[2].reasonVi, 'Sửa jig riêng cho line 2');

    const printable = buildPrintableDateGroupsFromItems(items, {
      employees: threeEmps,
      shellOvertimeDate: '2026-11-30',
    });
    assert.equal(printable.length, 1);
    const rows = printable[0].blocks[0].rows;
    assert.equal(rows.length, 3);
    // Shared top rows merge rowSpan = 2
    assert.equal(rows[0].fullName, 'Trần Thị B');
    assert.equal(rows[0].isFirstInBlock, true);
    assert.equal(rows[0].rowSpan, 2);
    assert.equal(rows[1].fullName, 'Lê Văn C');
    assert.equal(rows[1].isFirstInBlock, false);
    assert.equal(rows[1].rowSpan, 2);
    // Custom bottom row gets unmerged rowSpan = 1
    assert.equal(rows[2].fullName, 'Nguyễn Văn A');
    assert.equal(rows[2].isFirstInBlock, true);
    assert.equal(rows[2].rowSpan, 1);
    assert.match(rows[2].combinedReason, /Sửa jig riêng cho line 2/);

    // Verify Excel workbook merges shared C10:E11 and keeps C12:E12 separate
    const { workbook } = await overtimeExportService.buildWorkbook({
      department: 'Bộ phận Kỹ thuật',
      overtimeDate: '2026-11-30',
      employees: threeEmps,
      blocks: [block],
    });
    const sheet = workbook.getWorksheet('TV-PSGC2022');
    assert.ok(sheet);
    assert.equal(sheet.getRow(10).getCell('B').value, 'Trần Thị B');
    assert.equal(sheet.getRow(11).getCell('B').value, 'Lê Văn C');
    assert.equal(sheet.getRow(12).getCell('B').value, 'Nguyễn Văn A');
    assert.equal(sheet.getRow(10).getCell('C').value, 'Trực sản xuất\n생산 당직');
    assert.equal(
      sheet.getRow(12).getCell('C').value,
      'Sửa jig riêng cho line 2\n라인 2 전용 지그 수리'
    );
    assert.equal(sheet.getRow(10).getCell('C').isMerged, true);
    assert.equal(sheet.getRow(11).getCell('C').master, sheet.getRow(10).getCell('C'));
    assert.notEqual(sheet.getRow(12).getCell('C').master, sheet.getRow(10).getCell('C'));
  });

  it('filters employees by accented/unaccented Vietnamese name or employeeCode without mutating list', () => {
    const list = [
      { id: '1', fullName: 'Nguyễn Đức Hưởng', employeeCode: '13091801' },
      { id: '2', fullName: 'Đoàn Văn Chiến', employeeCode: '13010601' },
      { id: '3', fullName: 'Nguyễn Mạnh Đạt', employeeCode: '24010002' },
    ];

    assert.equal(filterEmployeesByQuery(list, '').length, 3);
    assert.deepEqual(
      filterEmployeesByQuery(list, 'duc huong').map((e) => e.id),
      ['1']
    );
    assert.deepEqual(
      filterEmployeesByQuery(list, 'ĐỨC HƯỞNG').map((e) => e.id),
      ['1']
    );
    assert.deepEqual(
      filterEmployeesByQuery(list, 'doan').map((e) => e.id),
      ['2']
    );
    assert.deepEqual(
      filterEmployeesByQuery(list, '2401').map((e) => e.id),
      ['3']
    );
    assert.deepEqual(filterEmployeesByQuery(list, 'khongton'), []);
  });
});


