import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMonthlyEffectiveWorkdays,
  DEFAULT_ATTENDANCE_SYMBOLS,
  getLeaveCategorySymbols,
  getSymbolBadgeClasses,
  inferSystemKeyFromCode,
  mapSymbolToLeaveRecordType,
  normalizeSymbolCode,
  normalizeSymbolColor,
  resolveSimulatorSymbolDisplay,
  resolveSymbolForLeaveRecord,
  validateAttendanceSymbolInput,
  AttendanceSymbol,
} from './attendanceSymbolsLogic';
import { mapSupabaseRowToAttendanceSymbol } from './attendanceSymbolsService';
import { LeaveRecord } from '../types/hr';

test('normalizeSymbolCode trims, strips spaces, and converts to uppercase', () => {
  assert.equal(normalizeSymbolCode('  pn '), 'PN');
  assert.equal(normalizeSymbolCode('cđ'), 'CĐ');
  assert.equal(normalizeSymbolCode('x / 2'), 'X/2');
});

test('validateAttendanceSymbolInput rejects blank, invalid numbers, and duplicate codes', () => {
  const dupErr = validateAttendanceSymbolInput(
    {
      code: 'pn',
      name: 'Phép trùng',
      workdayValue: 1,
      salaryPercent: 100,
    },
    DEFAULT_ATTENDANCE_SYMBOLS
  );
  assert.ok(dupErr && dupErr.includes('PN'));

  const okEditSameId = validateAttendanceSymbolInput(
    {
      id: 'sym-leave-annual',
      code: 'PN',
      name: 'Phép năm cập nhật',
      workdayValue: 1,
      salaryPercent: 100,
    },
    DEFAULT_ATTENDANCE_SYMBOLS
  );
  assert.equal(okEditSameId, null);

  const okNew = validateAttendanceSymbolInput(
    {
      code: 'ro',
      name: 'Nghỉ việc riêng',
      workdayValue: 1,
      salaryPercent: 100,
    },
    DEFAULT_ATTENDANCE_SYMBOLS
  );
  assert.equal(okNew, null);
});

test('getLeaveCategorySymbols includes custom leave symbols and maps LeaveRecordType cleanly', () => {
  const customSymbols: AttendanceSymbol[] = [
    ...DEFAULT_ATTENDANCE_SYMBOLS,
    {
      id: 'sym-custom-marriage',
      code: 'NC',
      name: 'Nghỉ cưới',
      category: 'leave',
      workdayValue: 1,
      salaryPercent: 100,
      color: 'purple',
      note: 'Nghỉ hưởng nguyên lương theo luật',
      isSystem: false,
      systemKey: null,
      sortOrder: 11,
    },
  ];

  const leaveOpts = getLeaveCategorySymbols(customSymbols);
  assert.ok(leaveOpts.some((s) => s.code === 'PN'));
  assert.ok(leaveOpts.some((s) => s.code === 'NB'));
  assert.ok(leaveOpts.some((s) => s.code === 'NC'));

  const customSym = leaveOpts.find((s) => s.code === 'NC')!;
  assert.equal(mapSymbolToLeaveRecordType(customSym), 'regime_leave');
  assert.equal(
    mapSymbolToLeaveRecordType(leaveOpts.find((s) => s.code === 'PN')!),
    'annual_leave'
  );
  assert.equal(
    mapSymbolToLeaveRecordType(leaveOpts.find((s) => s.code === 'KL')!),
    'unpaid_leave'
  );
});

test('resolveSymbolForLeaveRecord honors custom symbolCode and falls back to type systemKey', () => {
  const customSymbols = DEFAULT_ATTENDANCE_SYMBOLS.map((s) =>
    s.systemKey === 'LEAVE_ANNUAL'
      ? { ...s, color: 'purple' as const, name: 'Phép năm (Đã sửa)' }
      : s
  );

  const legacyRecord: Pick<LeaveRecord, 'type' | 'symbolCode'> = {
    type: 'annual_leave',
  };
  const resolvedLegacy = resolveSymbolForLeaveRecord(customSymbols, legacyRecord);
  assert.equal(resolvedLegacy.code, 'PN');
  assert.equal(resolvedLegacy.color, 'purple');
  assert.equal(getSymbolBadgeClasses(resolvedLegacy), 'bg-purple-100 text-purple-700');

  const customNbRecord: Pick<LeaveRecord, 'type' | 'symbolCode'> = {
    type: 'regime_leave',
    symbolCode: 'NB',
  };
  const resolvedCustom = resolveSymbolForLeaveRecord(customSymbols, customNbRecord);
  assert.equal(resolvedCustom.code, 'NB');
  assert.equal(resolvedCustom.name, 'Nghỉ bù');
});

test('resolveSimulatorSymbolDisplay binds Overtime Simulator KPI card to configured symbols', () => {
  const customized = DEFAULT_ATTENDANCE_SYMBOLS.map((s) =>
    s.systemKey === 'WORK_FULL'
      ? { ...s, code: 'CĐủ', color: 'blue' as const, name: 'Công chuẩn' }
      : s
  );

  const res = resolveSimulatorSymbolDisplay(customized, {
    symbol: 'X',
    workdays: 1,
    lateMinutes: 15,
  });
  assert.equal(res.displayCode, 'CĐủ');
  assert.equal(res.displayName, 'Công chuẩn');
  assert.ok(res.badgeClass.includes('bg-blue-100'));
  assert.equal(res.lateViolationSymbol?.code, 'ĐM');
});

test('calculateMonthlyEffectiveWorkdays applies configured workday conversion factors', () => {
  // November 2026 has 21 weekdays (Mon-Fri): 2..6 (5), 9..13 (5), 16..20 (5), 23..27 (5), 30 (1) = 21 weekdays
  const unpaidRec: LeaveRecord = {
    id: 'r1',
    employeeId: 'e1',
    type: 'unpaid_leave',
    symbolCode: 'KL',
    startDate: '2026-11-02',
    endDate: '2026-11-02',
    amount: 1,
    reason: 'Việc riêng',
    createdAt: '2026-11-01',
    approvedBy: 'Admin',
  };
  const halfAnnualRec: LeaveRecord = {
    id: 'r2',
    employeeId: 'e1',
    type: 'annual_leave',
    symbolCode: 'PN',
    startDate: '2026-11-03',
    endDate: '2026-11-03',
    amount: 0.5,
    reason: 'Nghỉ nửa ngày',
    createdAt: '2026-11-01',
    approvedBy: 'Admin',
  };

  // Default: X=1.0, KL=0.0, PN=1.0 -> 21 - 1 (KL) + 0 (PN=1.0) = 20 workdays
  const resDefault = calculateMonthlyEffectiveWorkdays({
    year: 2026,
    month: 11,
    dayRecordsMap: {
      2: [unpaidRec],
      3: [halfAnnualRec],
    },
    symbols: DEFAULT_ATTENDANCE_SYMBOLS,
  });
  assert.equal(resDefault.standardWorkingDays, 21);
  assert.equal(resDefault.effectiveWorkdays, 20);

  // If admin updates PN workdayValue to 0.5 (or 0), effectiveWorkdays updates dynamically
  const adjustedSymbols = DEFAULT_ATTENDANCE_SYMBOLS.map((s) =>
    s.code === 'PN' ? { ...s, workdayValue: 0 } : s
  );
  const resAdjusted = calculateMonthlyEffectiveWorkdays({
    year: 2026,
    month: 11,
    dayRecordsMap: {
      2: [unpaidRec],
      3: [halfAnnualRec],
    },
    symbols: adjustedSymbols,
  });
  // Day 3 has 0.5 PN (now 0) + 0.5 working (1.0) = 0.5 -> total = 19.5
  assert.equal(resAdjusted.effectiveWorkdays, 19.5);
});

test('normalizeSymbolColor and mapSupabaseRowToAttendanceSymbol handle live Supabase columns without id', () => {
  assert.equal(normalizeSymbolColor('sky'), 'blue');
  assert.equal(normalizeSymbolColor('indigo'), 'purple');
  assert.equal(normalizeSymbolColor('orange'), 'amber');
  assert.equal(normalizeSymbolColor('red'), 'rose');
  assert.equal(inferSystemKeyFromCode('KL'), 'LEAVE_UNPAID');

  const mappedUnpaid = mapSupabaseRowToAttendanceSymbol({
    code: 'KL',
    name: 'Không lương',
    description: 'Nghỉ việc riêng không hưởng lương',
    work_value: 0,
    paid_ratio: 0,
    color_theme: 'amber',
    category: 'leave',
    is_system: true,
    sort_order: 6,
  });
  assert.equal(mappedUnpaid.id, 'KL');
  assert.equal(mappedUnpaid.workdayValue, 0);
  assert.equal(mappedUnpaid.salaryPercent, 0);
  assert.equal(mappedUnpaid.color, 'amber');
  assert.equal(mappedUnpaid.systemKey, 'LEAVE_UNPAID');
  assert.equal(mappedUnpaid.note, 'Nghỉ việc riêng không hưởng lương');

  const mappedHalf = mapSupabaseRowToAttendanceSymbol({
    code: 'X/2',
    name: 'Làm nửa ngày',
    description: 'Đi làm nửa ca',
    work_value: 0.5,
    paid_ratio: 100,
    color_theme: 'sky',
    category: 'work',
    is_system: true,
    sort_order: 2,
  });
  assert.equal(mappedHalf.id, 'X/2');
  assert.equal(mappedHalf.color, 'blue');
  assert.equal(mappedHalf.workdayValue, 0.5);
});

