import test from 'node:test';
import assert from 'node:assert/strict';
import { Employee } from '../types/hr';
import {
  OvertimeGlossaryEntry,
  OvertimeLeaveCheckEntry,
} from '../services/hrService';
import {
  isIgnoredNonOvertimeStatus,
  normalizeScannedIsoDate,
  normalizeScannedTimeTo24h,
  prepareAllScannedOvertimeBlocks,
  prepareScannedOvertimeBlock,
} from './overtimeImageImportLogic';

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    employeeCode: 'TS001',
    fullName: 'Nguyễn Văn An',
    dob: '1995-01-01',
    gender: 'Nam',
    cccd: '001095000001',
    phone: '0901000001',
    address: 'Hà Nội',
    department: 'AUTO 1',
    position: 'Kỹ thuật viên',
    joinDate: '2022-01-01',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: '',
  },
  {
    id: 'emp-2',
    employeeCode: 'TS002',
    fullName: 'Trần Thị Bình',
    dob: '1996-02-02',
    gender: 'Nữ',
    cccd: '001096000002',
    phone: '0901000002',
    address: 'Hà Nội',
    department: 'PE',
    position: 'Nhân viên',
    joinDate: '2022-03-01',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: '',
  },
  {
    id: 'emp-3',
    employeeCode: 'TS003',
    fullName: 'Lê Minh Cường',
    dob: '1997-03-03',
    gender: 'Nam',
    cccd: '001097000003',
    phone: '0901000003',
    address: 'Hà Nội',
    department: 'AUTO 1',
    position: 'Kỹ thuật viên',
    joinDate: '2023-05-01',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: '',
  },
];

const MOCK_GLOSSARY: OvertimeGlossaryEntry[] = [
  {
    id: 'gl-1',
    reasonVi: 'Hỗ trợ sản xuất gấp',
    reasonKr: '긴급 생산 지원 (Từ điển)',
    isVerified: true,
    target_groups: [],
    updatedAt: '2026-11-27T00:00:00.000Z',
  },
];

test('normalizeScannedTimeTo24h converts Vietnamese hour formats to HH:MM', () => {
  assert.equal(normalizeScannedTimeTo24h('16h10'), '16:10');
  assert.equal(normalizeScannedTimeTo24h('20H40'), '20:40');
  assert.equal(normalizeScannedTimeTo24h('8h'), '08:00');
  assert.equal(normalizeScannedTimeTo24h('18.10'), '18:10');
  assert.equal(normalizeScannedTimeTo24h('invalid', '17:00'), '17:00');
});

test('normalizeScannedIsoDate parses DD/MM/YYYY and DD-MM formats', () => {
  assert.equal(normalizeScannedIsoDate('27/11/2026', '2026-01-01'), '2026-11-27');
  assert.equal(normalizeScannedIsoDate('28-11', '2026-11-27'), '2026-11-28');
  assert.equal(normalizeScannedIsoDate('', '2026-11-27'), '2026-11-27');
});

test('isIgnoredNonOvertimeStatus catches Full time, Nghỉ PN, and 07:30-16:10', () => {
  assert.equal(isIgnoredNonOvertimeStatus('Full time'), true);
  assert.equal(isIgnoredNonOvertimeStatus('Nghỉ PN'), true);
  assert.equal(isIgnoredNonOvertimeStatus('Nghỉ phép'), true);
  assert.equal(isIgnoredNonOvertimeStatus('07:30 - 16:10'), true);
  assert.equal(isIgnoredNonOvertimeStatus('7h30-16h10'), true);
  assert.equal(isIgnoredNonOvertimeStatus('16:10 - 18:10'), false);
});

test('prepareScannedOvertimeBlock prioritizes glossary, matches case-insensitively, detects custom times, and excludes on-leave staff', () => {
  const leaveRecords: OvertimeLeaveCheckEntry[] = [
    {
      id: 'lv-1',
      employeeId: 'emp-3',
      employeeCode: 'TS003',
      type: 'annual_leave',
      startDate: '2026-11-27',
      endDate: '2026-11-27',
      amount: 1,
      reason: 'Nghỉ phép năm',
      approvalStatus: 'Đã duyệt',
      createdAt: '2026-11-26T08:00:00.000Z',
      approvedBy: 'Admin',
    },
  ];

  const prepared = prepareScannedOvertimeBlock({
    block: {
      overtimeDate: '27/11/2026',
      reasonVi: '  hỗ trợ sản xuất gấp ',
      reasonKr: 'AI dịch tạm',
      startTime: '16h10',
      endTime: '18h10',
      matchedParticipants: [
        { employeeId: '', rawName: 'nguyễn văn an', startTime: '16h10', endTime: '18h10' },
        { employeeId: 'emp-2', rawName: 'Trần Thị Bình', startTime: '16h10', endTime: '20h10' },
        { employeeId: 'emp-3', rawName: 'Lê Minh Cường', startTime: '16h10', endTime: '18h10' },
        { employeeId: '', rawName: 'Full time', startTime: '07:30', endTime: '16:10' },
      ],
      unmatchedNames: ['Phạm Văn Lạ'],
    },
    employees: MOCK_EMPLOYEES,
    glossaryEntries: MOCK_GLOSSARY,
    leaveRecords,
    defaultDate: '2026-11-26',
  });

  assert.ok(prepared);
  assert.equal(prepared.overtimeDate, '2026-11-27');
  assert.equal(prepared.reasonKr, '긴급 생산 지원 (Từ điển)');
  assert.equal(prepared.usedGlossary, true);
  assert.equal(prepared.startTime, '16:10');
  assert.equal(prepared.endTime, '18:10');
  assert.deepEqual(prepared.selectedEmployeeIds, ['emp-1', 'emp-2']);
  assert.deepEqual(prepared.customTimes, {
    'emp-2': { startTime: '16:10', endTime: '20:10' },
  });
  assert.deepEqual(prepared.excludedOnLeaveNames, ['Lê Minh Cường']);
  assert.deepEqual(prepared.unmatchedNames, ['Phạm Văn Lạ']);
});

test('prepareAllScannedOvertimeBlocks drops pure non-overtime blocks and keeps valid multi-blocks', () => {
  const blocks = prepareAllScannedOvertimeBlocks({
    blocks: [
      {
        overtimeDate: '2026-11-27',
        reasonVi: 'Nghỉ PN',
        reasonKr: '',
        startTime: '07:30',
        endTime: '16:10',
        matchedParticipants: [{ rawName: 'Nguyễn Văn An', startTime: '07:30', endTime: '16:10' }],
        unmatchedNames: [],
      },
      {
        overtimeDate: '2026-11-27',
        reasonVi: 'Sửa jig line A',
        reasonKr: 'A라인 지그 수리',
        startTime: '16:10',
        endTime: '18:10',
        matchedParticipants: [{ rawName: 'Nguyễn Văn An', startTime: '16:10', endTime: '18:10' }],
        unmatchedNames: [],
      },
      {
        overtimeDate: '2026-11-27',
        reasonVi: 'Bảo trì máy cuốn',
        reasonKr: '권선기 보전',
        startTime: '16:10',
        endTime: '20:10',
        matchedParticipants: [{ rawName: 'Trần Thị Bình', startTime: '16:10', endTime: '20:10' }],
        unmatchedNames: [],
      },
    ],
    employees: MOCK_EMPLOYEES,
    glossaryEntries: MOCK_GLOSSARY,
    leaveRecords: [],
    defaultDate: '2026-11-27',
  });

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].reasonVi, 'Sửa jig line A');
  assert.equal(blocks[0].reasonKr, 'A라인 지그 수리');
  assert.equal(blocks[0].usedGlossary, false);
  assert.equal(blocks[1].reasonVi, 'Bảo trì máy cuốn');
});

test('prepareScannedOvertimeBlock preserves multiline bullet reasons and excludes already-recorded employees', () => {
  const prepared = prepareScannedOvertimeBlock({
    block: {
      overtimeDate: '2026-11-28',
      reasonVi: '- Kiểm tra line 1\n- Sửa jig tự động',
      reasonKr: '- 1라인 점검\n- 자동 지그 수리',
      startTime: '16:10',
      endTime: '20:40',
      matchedParticipants: [
        { employeeId: 'emp-1', rawName: 'Nguyễn Văn An', startTime: '16:10', endTime: '20:40' },
        { employeeId: 'emp-2', rawName: 'Trần Thị Bình', startTime: '16:10', endTime: '20:40' },
      ],
      unmatchedNames: [],
    },
    employees: MOCK_EMPLOYEES,
    glossaryEntries: MOCK_GLOSSARY,
    leaveRecords: [],
    alreadyRecordedIdsByDate: (iso) => (iso === '2026-11-28' ? new Set(['emp-1']) : new Set()),
    defaultDate: '2026-11-28',
  });

  assert.ok(prepared);
  assert.equal(prepared.reasonVi, '- Kiểm tra line 1\n- Sửa jig tự động');
  assert.equal(prepared.reasonKr, '- 1라인 점검\n- 자동 지그 수리');
  assert.deepEqual(prepared.selectedEmployeeIds, ['emp-2']);
  assert.deepEqual(prepared.excludedAlreadyRecordedNames, ['Nguyễn Văn An']);
});

test('prepareScannedOvertimeBlock splits collapsed inline Korean bullets to match multiline reasonVi', () => {
  const prepared = prepareScannedOvertimeBlock({
    block: {
      overtimeDate: '2026-11-28',
      reasonVi: '- Bảo trì định kỳ line 3\n- Hiệu chỉnh cảm biến máy hàn',
      reasonKr: '- 3라인 정기 보전 - 용접기 센서 조정',
      startTime: '16:10',
      endTime: '18:10',
      matchedParticipants: [
        { employeeId: 'emp-1', rawName: 'Nguyễn Văn An', startTime: '16:10', endTime: '18:10' },
      ],
      unmatchedNames: [],
    },
    employees: MOCK_EMPLOYEES,
    glossaryEntries: MOCK_GLOSSARY,
    leaveRecords: [],
    defaultDate: '2026-11-28',
  });

  assert.ok(prepared);
  assert.equal(prepared.reasonKr, '- 3라인 정기 보전\n- 용접기 센서 조정');
});

