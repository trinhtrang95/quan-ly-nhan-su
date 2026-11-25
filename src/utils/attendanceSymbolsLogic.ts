import { LeaveRecord, LeaveRecordType } from '../types/hr';

export type AttendanceSymbolCategory =
  | 'work'
  | 'leave'
  | 'overtime'
  | 'violation';

export type AttendanceSymbolColor =
  | 'emerald'
  | 'blue'
  | 'amber'
  | 'rose'
  | 'purple'
  | 'slate';

export interface AttendanceSymbol {
  id: string;
  code: string;
  name: string;
  category: AttendanceSymbolCategory;
  workdayValue: number;
  salaryPercent: number;
  color: AttendanceSymbolColor;
  note: string;
  isSystem: boolean;
  systemKey?: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export const ATTENDANCE_SYMBOL_CATEGORY_META: Record<
  AttendanceSymbolCategory,
  { label: string; shortLabel: string; description: string }
> = {
  work: {
    label: 'Làm việc',
    shortLabel: 'Làm việc',
    description: 'Ngày công đi làm trực tiếp hoặc công tác',
  },
  leave: {
    label: 'Nghỉ phép / Chế độ',
    shortLabel: 'Nghỉ phép',
    description: 'Hiển thị tự động trên Đơn xin nghỉ phép & Báo cáo',
  },
  overtime: {
    label: 'Tăng ca',
    shortLabel: 'Tăng ca',
    description: 'Làm thêm giờ ngày nghỉ hằng tuần hoặc Lễ/Tết',
  },
  violation: {
    label: 'Vi phạm chấm công',
    shortLabel: 'Vi phạm',
    description: 'Đi muộn, về sớm hoặc vi phạm giờ giấc',
  },
};

export const ATTENDANCE_SYMBOL_COLOR_PALETTE: Record<
  AttendanceSymbolColor,
  {
    key: AttendanceSymbolColor;
    label: string;
    badgeClass: string;
    borderBadgeClass: string;
    textClass: string;
    bgLightHex: string;
    textHex: string;
    swatchBgClass: string;
  }
> = {
  emerald: {
    key: 'emerald',
    label: 'Xanh lá',
    badgeClass: 'bg-green-100 text-green-700',
    borderBadgeClass: 'bg-green-100 text-green-700 border-green-200',
    textClass: 'text-green-700',
    bgLightHex: '#DCFCE7',
    textHex: '#15803D',
    swatchBgClass: 'bg-green-500',
  },
  blue: {
    key: 'blue',
    label: 'Xanh dương',
    badgeClass: 'bg-blue-100 text-blue-700',
    borderBadgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    textClass: 'text-blue-700',
    bgLightHex: '#DBEAFE',
    textHex: '#1D4ED8',
    swatchBgClass: 'bg-blue-500',
  },
  amber: {
    key: 'amber',
    label: 'Cam nhạt',
    badgeClass: 'bg-orange-100 text-orange-700',
    borderBadgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    textClass: 'text-orange-700',
    bgLightHex: '#FFEDD5',
    textHex: '#C2410C',
    swatchBgClass: 'bg-orange-500',
  },
  rose: {
    key: 'rose',
    label: 'Đỏ nhạt',
    badgeClass: 'bg-red-100 text-red-700',
    borderBadgeClass: 'bg-red-100 text-red-700 border-red-200',
    textClass: 'text-red-700',
    bgLightHex: '#FEE2E2',
    textHex: '#B91C1C',
    swatchBgClass: 'bg-red-500',
  },
  purple: {
    key: 'purple',
    label: 'Tím nhạt',
    badgeClass: 'bg-purple-100 text-purple-700',
    borderBadgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
    textClass: 'text-purple-700',
    bgLightHex: '#F3E8FF',
    textHex: '#7E22CE',
    swatchBgClass: 'bg-purple-500',
  },
  slate: {
    key: 'slate',
    label: 'Xám nhạt',
    badgeClass: 'bg-slate-100 text-slate-700',
    borderBadgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    textClass: 'text-slate-700',
    bgLightHex: '#F1F5F9',
    textHex: '#334155',
    swatchBgClass: 'bg-slate-500',
  },
};

export const ATTENDANCE_SYMBOL_COLORS: AttendanceSymbolColor[] = [
  'emerald',
  'blue',
  'amber',
  'rose',
  'purple',
  'slate',
];

export const DEFAULT_ATTENDANCE_SYMBOLS: AttendanceSymbol[] = [
  {
    id: 'sym-work-full',
    code: 'X',
    name: 'Công đủ ngày',
    category: 'work',
    workdayValue: 1,
    salaryPercent: 100,
    color: 'emerald',
    note: 'Đi làm đủ giờ tiêu chuẩn trong ca',
    isSystem: true,
    systemKey: 'WORK_FULL',
    sortOrder: 1,
  },
  {
    id: 'sym-work-half',
    code: 'X/2',
    name: 'Nửa ngày công',
    category: 'work',
    workdayValue: 0.5,
    salaryPercent: 100,
    color: 'blue',
    note: 'Làm ca sáng hoặc nửa ngày công',
    isSystem: true,
    systemKey: 'WORK_HALF',
    sortOrder: 2,
  },
  {
    id: 'sym-work-trip',
    code: 'CT',
    name: 'Công tác',
    category: 'work',
    workdayValue: 1,
    salaryPercent: 100,
    color: 'purple',
    note: 'Công tác ngoài nhà máy vẫn tính đủ công',
    isSystem: false,
    systemKey: null,
    sortOrder: 3,
  },
  {
    id: 'sym-leave-annual',
    code: 'PN',
    name: 'Phép năm',
    category: 'leave',
    workdayValue: 1,
    salaryPercent: 100,
    color: 'emerald',
    note: 'Trừ vào quỹ phép năm, hưởng 100% lương',
    isSystem: true,
    systemKey: 'LEAVE_ANNUAL',
    sortOrder: 4,
  },
  {
    id: 'sym-leave-regime',
    code: 'CĐ',
    name: 'Chế độ',
    category: 'leave',
    workdayValue: 1,
    salaryPercent: 100,
    color: 'blue',
    note: 'Nghỉ chế độ (Ốm đau, Thai sản, Hiếu/Hỷ)',
    isSystem: true,
    systemKey: 'LEAVE_REGIME',
    sortOrder: 5,
  },
  {
    id: 'sym-leave-unpaid',
    code: 'KL',
    name: 'Không lương',
    category: 'leave',
    workdayValue: 0,
    salaryPercent: 0,
    color: 'amber',
    note: 'Nghỉ không hưởng lương, không tính ngày công',
    isSystem: true,
    systemKey: 'LEAVE_UNPAID',
    sortOrder: 6,
  },
  {
    id: 'sym-leave-comp',
    code: 'NB',
    name: 'Nghỉ bù',
    category: 'leave',
    workdayValue: 1,
    salaryPercent: 100,
    color: 'purple',
    note: 'Nghỉ bù ngày lễ hoặc giờ tăng ca quy đổi',
    isSystem: false,
    systemKey: null,
    sortOrder: 7,
  },
  {
    id: 'sym-ot-weekend',
    code: 'TC',
    name: 'Tăng ca',
    category: 'overtime',
    workdayValue: 0,
    salaryPercent: 200,
    color: 'blue',
    note: 'Làm thêm ngày nghỉ hằng tuần / ngoài ca',
    isSystem: true,
    systemKey: 'OT_WEEKEND',
    sortOrder: 8,
  },
  {
    id: 'sym-ot-holiday',
    code: 'L',
    name: 'Nghỉ Lễ/Tết',
    category: 'overtime',
    workdayValue: 0,
    salaryPercent: 300,
    color: 'purple',
    note: 'Làm việc ngày Lễ, Tết (hưởng đơn giá Lễ/Tết)',
    isSystem: true,
    systemKey: 'OT_HOLIDAY',
    sortOrder: 9,
  },
  {
    id: 'sym-violation-late',
    code: 'ĐM',
    name: 'Đi muộn',
    category: 'violation',
    workdayValue: 0,
    salaryPercent: 100,
    color: 'rose',
    note: 'Hover/chạm xem giờ',
    isSystem: true,
    systemKey: 'VIOLATION_LATE',
    sortOrder: 10,
  },
];

export function normalizeSymbolCode(raw: string): string {
  return (raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidSymbolCategory(
  value: unknown
): value is AttendanceSymbolCategory {
  return (
    value === 'work' ||
    value === 'leave' ||
    value === 'overtime' ||
    value === 'violation'
  );
}

export function normalizeSymbolColor(value: unknown): AttendanceSymbolColor {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'emerald' || raw === 'green' || raw === 'teal') {
    return 'emerald';
  }
  if (raw === 'blue' || raw === 'sky' || raw === 'cyan') {
    return 'blue';
  }
  if (raw === 'amber' || raw === 'orange' || raw === 'yellow') {
    return 'amber';
  }
  if (raw === 'rose' || raw === 'red') {
    return 'rose';
  }
  if (raw === 'purple' || raw === 'indigo' || raw === 'violet') {
    return 'purple';
  }
  if (raw === 'slate' || raw === 'gray' || raw === 'zinc') {
    return 'slate';
  }
  return 'slate';
}

export function inferSystemKeyFromCode(code?: string | null): string | null {
  const norm = normalizeSymbolCode(code || '');
  switch (norm) {
    case 'X':
      return 'WORK_FULL';
    case 'X/2':
      return 'WORK_HALF';
    case 'PN':
      return 'LEAVE_ANNUAL';
    case 'CĐ':
      return 'LEAVE_REGIME';
    case 'KL':
      return 'LEAVE_UNPAID';
    case 'TC':
      return 'OT_WEEKEND';
    case 'L':
      return 'OT_HOLIDAY';
    case 'ĐM':
      return 'VIOLATION_LATE';
    default:
      return null;
  }
}

export function isValidSymbolColor(
  value: unknown
): value is AttendanceSymbolColor {
  return (
    value === 'emerald' ||
    value === 'blue' ||
    value === 'amber' ||
    value === 'rose' ||
    value === 'purple' ||
    value === 'slate'
  );
}

export function getSymbolColorToken(color?: string | null) {
  return ATTENDANCE_SYMBOL_COLOR_PALETTE[normalizeSymbolColor(color)];
}

export function getSymbolBadgeClasses(
  symbol?: Pick<AttendanceSymbol, 'color'> | null,
  withBorder = false
): string {
  const token = getSymbolColorToken(symbol?.color);
  return withBorder ? token.borderBadgeClass : token.badgeClass;
}

export function sortAttendanceSymbols(
  symbols: AttendanceSymbol[]
): AttendanceSymbol[] {
  return [...symbols].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return a.code.localeCompare(b.code, 'vi');
  });
}

export function resolveSymbolByCode(
  symbols: AttendanceSymbol[],
  code?: string | null
): AttendanceSymbol | undefined {
  const norm = normalizeSymbolCode(code || '');
  if (!norm) return undefined;
  const list = symbols.length > 0 ? symbols : DEFAULT_ATTENDANCE_SYMBOLS;
  return (
    list.find((s) => normalizeSymbolCode(s.code) === norm) ||
    DEFAULT_ATTENDANCE_SYMBOLS.find((s) => normalizeSymbolCode(s.code) === norm)
  );
}

export function resolveSymbolForSystemKey(
  symbols: AttendanceSymbol[],
  systemKey: string,
  fallbackCode?: string
): AttendanceSymbol | undefined {
  const list = symbols.length > 0 ? symbols : DEFAULT_ATTENDANCE_SYMBOLS;
  return (
    list.find((s) => s.systemKey === systemKey) ||
    (fallbackCode ? resolveSymbolByCode(list, fallbackCode) : undefined) ||
    DEFAULT_ATTENDANCE_SYMBOLS.find((s) => s.systemKey === systemKey)
  );
}

export function validateAttendanceSymbolInput(
  candidate: {
    id?: string;
    code: string;
    name: string;
    workdayValue: number;
    salaryPercent: number;
  },
  existingSymbols: AttendanceSymbol[]
): string | null {
  const normCode = normalizeSymbolCode(candidate.code);
  if (!normCode) {
    return 'Vui lòng nhập Mã ký hiệu công (VD: PN, CT, NB).';
  }
  if (normCode.length > 10) {
    return 'Mã ký hiệu tối đa 10 ký tự.';
  }
  if (!candidate.name.trim()) {
    return 'Vui lòng nhập Tên ký hiệu.';
  }
  if (!Number.isFinite(candidate.workdayValue) || candidate.workdayValue < 0 || candidate.workdayValue > 5) {
    return 'Quy đổi ngày công phải từ 0 đến 5.';
  }
  if (!Number.isFinite(candidate.salaryPercent) || candidate.salaryPercent < 0 || candidate.salaryPercent > 1000) {
    return 'Tỷ lệ hưởng lương (%) phải từ 0 đến 1000.';
  }

  const duplicate = existingSymbols.find(
    (s) =>
      normalizeSymbolCode(s.code) === normCode &&
      (!candidate.id || s.id !== candidate.id)
  );
  if (duplicate) {
    return `Ký hiệu "${normCode}" đã tồn tại (${duplicate.name}). Vui lòng chọn mã khác.`;
  }

  return null;
}

/**
 * Returns leave-category symbols (`Nghỉ phép / Chế độ`) for dynamic dropdowns/selectors
 * in LeaveRecordModal and BulkLeaveRecordModal.
 */
export function getLeaveCategorySymbols(
  symbols: AttendanceSymbol[]
): AttendanceSymbol[] {
  const list = symbols.length > 0 ? symbols : DEFAULT_ATTENDANCE_SYMBOLS;
  const leaveList = sortAttendanceSymbols(
    list.filter((s) => s.category === 'leave')
  );
  return leaveList.length > 0
    ? leaveList
    : DEFAULT_ATTENDANCE_SYMBOLS.filter((s) => s.category === 'leave');
}

/**
 * Maps any leave-category symbol back to a core LeaveRecordType so annual leave quota,
 * unpaid days, and regime leave aggregates continue working cleanly.
 */
export function mapSymbolToLeaveRecordType(
  symbol: Pick<AttendanceSymbol, 'code' | 'category' | 'systemKey' | 'salaryPercent'>
): LeaveRecordType {
  const code = normalizeSymbolCode(symbol.code);
  if (symbol.systemKey === 'LEAVE_ANNUAL' || code === 'PN') {
    return 'annual_leave';
  }
  if (symbol.systemKey === 'LEAVE_UNPAID' || code === 'KL') {
    return 'unpaid_leave';
  }
  if (symbol.systemKey === 'VIOLATION_LATE' || symbol.category === 'violation' || code === 'ĐM') {
    return 'late_early';
  }
  if (symbol.systemKey === 'LEAVE_REGIME' || code === 'CĐ') {
    return 'regime_leave';
  }
  if (Number(symbol.salaryPercent ?? 0) <= 0) {
    return 'unpaid_leave';
  }
  return 'regime_leave';
}

/**
 * Resolves the active AttendanceSymbol for a LeaveRecord (honoring custom `symbolCode` first,
 * then falling back to systemKey mapping for legacy records).
 */
export function resolveSymbolForLeaveRecord(
  symbols: AttendanceSymbol[],
  record: Pick<LeaveRecord, 'type' | 'symbolCode'>
): AttendanceSymbol {
  const list = symbols.length > 0 ? symbols : DEFAULT_ATTENDANCE_SYMBOLS;

  if (record.symbolCode) {
    const byCode = resolveSymbolByCode(list, record.symbolCode);
    if (byCode) return byCode;
  }

  const keyByType: Record<LeaveRecordType, { systemKey: string; fallbackCode: string }> = {
    annual_leave: { systemKey: 'LEAVE_ANNUAL', fallbackCode: 'PN' },
    regime_leave: { systemKey: 'LEAVE_REGIME', fallbackCode: 'CĐ' },
    unpaid_leave: { systemKey: 'LEAVE_UNPAID', fallbackCode: 'KL' },
    late_early: { systemKey: 'VIOLATION_LATE', fallbackCode: 'ĐM' },
  };

  const target = keyByType[record.type] || keyByType.annual_leave;
  return (
    resolveSymbolForSystemKey(list, target.systemKey, target.fallbackCode) ||
    DEFAULT_ATTENDANCE_SYMBOLS[3]
  );
}

/**
 * Resolves the primary symbol + optional late violation badge for the Overtime Settings Simulator.
 */
export function resolveSimulatorSymbolDisplay(
  symbols: AttendanceSymbol[],
  simResult: { symbol: string; workdays: number; lateMinutes: number }
): {
  primarySymbol: AttendanceSymbol | null;
  displayCode: string;
  displayName: string;
  badgeClass: string;
  lateViolationSymbol: AttendanceSymbol | null;
} {
  const list = symbols.length > 0 ? symbols : DEFAULT_ATTENDANCE_SYMBOLS;
  const code = normalizeSymbolCode(simResult.symbol);

  let resolved: AttendanceSymbol | undefined;
  if (code === 'L') {
    resolved = resolveSymbolForSystemKey(list, 'OT_HOLIDAY', 'L');
  } else if (code === 'TC') {
    resolved = resolveSymbolForSystemKey(list, 'OT_WEEKEND', 'TC');
  } else if (code === 'X/2') {
    resolved = resolveSymbolForSystemKey(list, 'WORK_HALF', 'X/2');
  } else if (code === 'X') {
    resolved = resolveSymbolForSystemKey(list, 'WORK_FULL', 'X');
  } else if (code && code !== '-') {
    resolved = resolveSymbolByCode(list, code);
  }

  const lateViolationSymbol =
    simResult.lateMinutes > 0
      ? resolveSymbolForSystemKey(list, 'VIOLATION_LATE', 'ĐM') || null
      : null;

  if (!resolved) {
    return {
      primarySymbol: null,
      displayCode: simResult.symbol || '-',
      displayName: 'Không có công',
      badgeClass: 'bg-slate-100 text-slate-600',
      lateViolationSymbol,
    };
  }

  return {
    primarySymbol: resolved,
    displayCode: resolved.code,
    displayName: resolved.name,
    badgeClass: getSymbolBadgeClasses(resolved, true),
    lateViolationSymbol,
  };
}

/**
 * Computes effective monthly workday total using configured `workdayValue` factors
 * from `attendance_symbols` across Mon–Sat (excluding Sundays) for the given month:
 * - Unrecorded working days use `WORK_FULL.workdayValue` (default 1.0).
 * - Recorded leave days apply the symbol's `workdayValue` (blending partial days like 0.5).
 */
export function calculateMonthlyEffectiveWorkdays(params: {
  year: number;
  month: number; // 1..12
  dayRecordsMap: Record<number, LeaveRecord[]>;
  symbols: AttendanceSymbol[];
}): {
  effectiveWorkdays: number;
  standardWorkingDays: number;
} {
  const { year, month, dayRecordsMap, symbols } = params;
  const list = symbols.length > 0 ? symbols : DEFAULT_ATTENDANCE_SYMBOLS;
  const fullWorkSymbol = resolveSymbolForSystemKey(list, 'WORK_FULL', 'X');
  const fullWorkVal = Number(fullWorkSymbol?.workdayValue ?? 1);

  const daysInMonth = new Date(year, month, 0).getDate();
  let standardWorkingDays = 0;
  let effectiveWorkdays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(year, month - 1, day);
    const dow = dt.getDay();
    // Mon–Fri = standard working days (matching default HC shift T2-T6)
    if (dow === 0 || dow === 6) {
      continue;
    }

    standardWorkingDays += fullWorkVal;
    const recsForDay = (dayRecordsMap[day] || []).filter(
      (r) => r.type !== 'late_early'
    );

    if (recsForDay.length === 0) {
      effectiveWorkdays += fullWorkVal;
      continue;
    }

    // Apply the symbol's workday conversion factor for the day's leave record
    const rec = recsForDay[0];
    const sym = resolveSymbolForLeaveRecord(list, rec);
    const symVal = Number(sym.workdayValue ?? 0);
    const dayFraction =
      rec.amount > 0 && rec.amount < 1 ? Math.min(1, rec.amount) : 1;

    const dayContribution =
      dayFraction * symVal + (1 - dayFraction) * fullWorkVal;
    effectiveWorkdays += dayContribution;
  }

  return {
    effectiveWorkdays: Number(effectiveWorkdays.toFixed(2)),
    standardWorkingDays: Number(standardWorkingDays.toFixed(2)),
  };
}
