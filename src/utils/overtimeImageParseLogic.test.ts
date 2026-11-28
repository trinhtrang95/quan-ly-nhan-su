import test from 'node:test';
import assert from 'node:assert/strict';
import type { Employee } from '../types/hr';
import {
  buildOvertimeImageParsePrompt,
  convertAiBlockToFormDraft,
  convertAiBlockToTaskBlock,
  normalizeAiOvertimeDate,
  normalizeAiOvertimeParseResponse,
  serializeEmployeesForAiPrompt,
  stripVietnameseAccents,
} from './overtimeImageParseLogic';

const sampleEmployees: Employee[] = [
  {
    id: 'emp-1',
    employeeCode: 'TV001',
    fullName: 'Nguyễn Văn An',
    dob: '1995-01-01',
    gender: 'Nam',
    cccd: '001095000001',
    phone: '0900000001',
    address: 'Hà Nội',
    department: 'AUTO 1',
    position: 'Kỹ thuật viên',
    joinDate: '2023-01-10',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: '',
  },
  {
    id: 'emp-2',
    employeeCode: 'TV002',
    fullName: 'Trần Thị Bình',
    dob: '1996-02-02',
    gender: 'Nữ',
    cccd: '001096000002',
    phone: '0900000002',
    address: 'Hà Nội',
    department: 'PE',
    position: 'Nhân viên',
    joinDate: '2023-02-15',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: '',
  },
  {
    id: 'emp-3',
    employeeCode: 'TV003',
    fullName: 'Lê Minh Cường',
    dob: '1997-03-03',
    gender: 'Nam',
    cccd: '001097000003',
    phone: '0900000003',
    address: 'Hà Nội',
    department: 'JIG/AUTO 2',
    position: 'Kỹ thuật viên',
    joinDate: '2024-03-01',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: '',
  },
];

test('stripVietnameseAccents normalizes Vietnamese characters and đ/Đ', () => {
  assert.equal(stripVietnameseAccents('  Nguyễn   Đức  An '), 'nguyen duc an');
  assert.equal(stripVietnameseAccents('Đỗ Thị Mai'), 'do thi mai');
});

test('normalizeAiOvertimeDate handles ISO, DD/MM/YYYY, and DD/MM formats', () => {
  assert.equal(normalizeAiOvertimeDate('2026-11-27', '2026-11-20'), '2026-11-27');
  assert.equal(normalizeAiOvertimeDate('28/11/2026', '2026-11-20'), '2026-11-28');
  assert.equal(normalizeAiOvertimeDate('05/12', '2026-11-20'), '2026-12-05');
  assert.equal(normalizeAiOvertimeDate('invalid', '2026-11-20'), '2026-11-20');
});

test('serializeEmployeesForAiPrompt and buildOvertimeImageParsePrompt include compact employee metadata', () => {
  const serialized = serializeEmployeesForAiPrompt(sampleEmployees);
  assert.deepEqual(serialized[0], {
    id: 'emp-1',
    code: 'TV001',
    name: 'Nguyễn Văn An',
    dept: 'AUTO 1',
  });
  const prompt = buildOvertimeImageParsePrompt({
    employees: serialized,
    defaultDate: '2026-11-27',
    defaultStartTime: '16:10',
    defaultEndTime: '18:10',
    glossarySamples: [{ reasonVi: 'Trực sản xuất', reasonKr: '생산 당직' }],
  });
  assert.match(prompt, /TV001/);
  assert.match(prompt, /2026-11-27/);
  assert.match(prompt, /생산 당직/);
});

test('normalizeAiOvertimeParseResponse validates employeeIds, resolves code/name fallbacks, deduplicates, and moves unknown entries to unmatchedNames', () => {
  const rawJson = JSON.stringify({
    blocks: [
      {
        overtimeDate: '27/11/2026',
        reasonVi: 'Chạy hàng gấp cho khách hàng',
        reasonKr: '고객사 긴급 물량 생산',
        startTime: '16:10',
        endTime: '18:10',
        matchedParticipants: [
          {
            employeeId: 'emp-1',
            rawName: 'Nguyễn Văn An',
            startTime: '16:10',
            endTime: '18:10',
          },
          {
            employeeId: 'emp-1',
            rawName: 'An (trùng)',
            startTime: '16:10',
            endTime: '20:40',
          },
          {
            employeeId: 'UNKNOWN-999',
            rawName: 'Tran Thi Binh',
            startTime: '16:10',
            endTime: '20:40',
          },
          {
            employeeId: 'not-found-id',
            rawName: 'Người Ngoài Danh Sách',
            startTime: '16:10',
            endTime: '18:10',
          },
        ],
        unmatchedNames: ['Lê Văn X'],
      },
    ],
  });

  const normalized = normalizeAiOvertimeParseResponse({
    rawInput: `\`\`\`json\n${rawJson}\n\`\`\``,
    employees: sampleEmployees,
    fallbackDate: '2026-11-20',
  });

  assert.equal(normalized.blocks.length, 1);
  const block = normalized.blocks[0];
  assert.equal(block.overtimeDate, '2026-11-27');
  assert.equal(block.matchedParticipants.length, 2);
  assert.equal(block.matchedParticipants[0].employeeId, 'emp-1');
  assert.equal(block.matchedParticipants[1].employeeId, 'emp-2');
  assert.equal(block.matchedParticipants[1].endTime, '20:40');
  assert.deepEqual(block.unmatchedNames, ['Lê Văn X', 'Người Ngoài Danh Sách']);
});

test('convertAiBlockToFormDraft and convertAiBlockToTaskBlock skip on-leave employees and preserve custom times', () => {
  const employeeMap = new Map(sampleEmployees.map((e) => [e.id, e]));
  const onLeaveMap = new Map([
    ['emp-2', { label: 'Nghỉ phép năm', type: 'annual_leave' }],
  ]);

  const aiBlock = {
    id: 'ai-block-1',
    overtimeDate: '2026-11-27',
    reasonVi: 'Hỗ trợ chuyền lắp ráp',
    reasonKr: '조립 라인 지원',
    startTime: '16:10',
    endTime: '18:10',
    matchedParticipants: [
      {
        employeeId: 'emp-1',
        rawName: 'Nguyễn Văn An',
        startTime: '16:10',
        endTime: '18:10',
      },
      {
        employeeId: 'emp-2',
        rawName: 'Trần Thị Bình',
        startTime: '16:10',
        endTime: '20:40',
      },
      {
        employeeId: 'emp-3',
        rawName: 'Lê Minh Cường',
        startTime: '16:10',
        endTime: '20:40',
      },
    ],
    unmatchedNames: [],
  };

  const draft = convertAiBlockToFormDraft({
    block: aiBlock,
    employeeMap,
    onLeaveMap,
  });
  assert.deepEqual(draft.selectedEmployeeIds, ['emp-1', 'emp-3']);
  assert.deepEqual(draft.customTimes, {
    'emp-3': { startTime: '16:10', endTime: '20:40' },
  });
  assert.equal(draft.skippedOnLeave.length, 1);
  assert.equal(draft.skippedOnLeave[0].employeeId, 'emp-2');

  const taskResult = convertAiBlockToTaskBlock({
    block: aiBlock,
    employeeMap,
    onLeaveMap,
    calculateNetHours: (_d, empId, _s, e) => (empId === 'emp-3' && e === '20:40' ? 4 : 2),
  });
  assert.ok(taskResult.taskBlock);
  assert.deepEqual(taskResult.taskBlock.selectedEmployeeIds, ['emp-1', 'emp-3']);
  assert.equal(taskResult.taskBlock.participants[0].totalHours, 2);
  assert.equal(taskResult.taskBlock.participants[1].totalHours, 4);
  assert.equal(taskResult.skippedOnLeave.length, 1);
});
