import { Employee } from '../types/hr';
import {
  buildOnLeaveEmployeeMapForDate,
  findExactGlossaryMatch,
  OvertimeGlossaryEntry,
  OvertimeLeaveCheckEntry,
} from '../services/hrService';

export interface ScannedScheduleParticipant {
  employeeId?: string;
  rawName: string;
  startTime?: string;
  endTime?: string;
}

export interface ScannedScheduleBlock {
  overtimeDate?: string;
  reasonVi: string;
  reasonKr: string;
  startTime: string;
  endTime: string;
  matchedParticipants: ScannedScheduleParticipant[];
  unmatchedNames: string[];
}

export interface PreparedScannedOvertimeBlock {
  overtimeDate: string;
  reasonVi: string;
  reasonKr: string;
  usedGlossary: boolean;
  startTime: string;
  endTime: string;
  selectedEmployeeIds: string[];
  customTimes: Record<string, { startTime: string; endTime: string }>;
  unmatchedNames: string[];
  excludedOnLeaveNames: string[];
  excludedAlreadyRecordedNames: string[];
  skippedRegularShiftCount: number;
}

/**
 * Normalizes scanned time strings such as "16h10", "16H10", "16.10", "8h", "20:40" -> "HH:MM".
 */
export function normalizeScannedTimeTo24h(
  raw?: string | null,
  fallback = ''
): string {
  const cleaned = (raw || '').trim();
  if (!cleaned) return fallback;

  // Accept formats like 16h10, 16:10, 16.10, 8h, 08h00
  const match = cleaned.match(/^(\d{1,2})\s*[hH:.]\s*(\d{1,2})?$/);
  if (!match) return fallback;

  const hours = Number(match[1]);
  const minutes = match[2] !== undefined ? Number(match[2]) : 0;

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Normalizes scanned dates ("2026-11-27", "27/11/2026", "27-11", "27.11.2026") -> "YYYY-MM-DD".
 */
export function normalizeScannedIsoDate(
  raw?: string | null,
  fallbackDate = ''
): string {
  const cleaned = (raw || '').trim();
  if (!cleaned) return fallbackDate;

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  const dmyFull = cleaned.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmyFull) {
    const day = Number(dmyFull[1]);
    const month = Number(dmyFull[2]);
    let year = Number(dmyFull[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dmOnly = cleaned.match(/^(\d{1,2})[/.-](\d{1,2})$/);
  if (dmOnly) {
    const fallbackYearMatch = fallbackDate.match(/^(\d{4})-/);
    const year = fallbackYearMatch
      ? Number(fallbackYearMatch[1])
      : new Date().getFullYear();
    const day = Number(dmOnly[1]);
    const month = Number(dmOnly[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return fallbackDate;
}

export function normalizePersonLookupKey(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Identifies non-overtime shift markers or leave annotations in Zalo/Excel schedule cells.
 */
export function isIgnoredNonOvertimeStatus(text?: string | null): boolean {
  const normalized = normalizePersonLookupKey(text || '');
  if (!normalized) return false;

  if (
    normalized === 'full time' ||
    normalized === 'fulltime' ||
    normalized === 'nghi pn' ||
    normalized === 'nghi phep' ||
    normalized === 'nghi' ||
    normalized === 'off' ||
    normalized.includes('nghi phep') ||
    normalized.includes('nghi pn')
  ) {
    return true;
  }

  // Regular shift 07:30 - 16:10 (with h or : separator)
  const strippedSpaces = normalized.replace(/\s+/g, '');
  if (
    /^(0?7[h:.]30)[-~–](16[h:.]10)$/.test(strippedSpaces) ||
    strippedSpaces === 'fulltime'
  ) {
    return true;
  }

  return false;
}

function isRegularShiftPair(startTime: string, endTime: string): boolean {
  return startTime === '07:30' && endTime === '16:10';
}

export function findEmployeeMatchForScannedParticipant(
  rawName: string,
  employeeIdHint: string | undefined,
  employees: Employee[]
): Employee | null {
  const cleanId = (employeeIdHint || '').trim();
  const cleanRaw = (rawName || '').trim();

  if (cleanId) {
    const byId = employees.find((emp) => emp.id === cleanId);
    if (byId) {
      return byId;
    }
  }

  if (!cleanRaw) return null;

  const lowerRaw = cleanRaw.toLowerCase().replace(/\s+/g, ' ');
  const exactCaseInsensitive = employees.find(
    (emp) => emp.fullName.trim().toLowerCase().replace(/\s+/g, ' ') === lowerRaw
  );
  if (exactCaseInsensitive) return exactCaseInsensitive;

  const normalizedTarget = normalizePersonLookupKey(cleanRaw);
  const accentInsensitiveMatches = employees.filter(
    (emp) => normalizePersonLookupKey(emp.fullName) === normalizedTarget
  );
  if (accentInsensitiveMatches.length === 1) {
    return accentInsensitiveMatches[0];
  }

  // Match by employee code if included in rawName
  const upperCode = cleanRaw.toUpperCase();
  const byCode = employees.find(
    (emp) => (emp.employeeCode || '').trim().toUpperCase() === upperCode
  );
  if (byCode) return byCode;

  return null;
}

function alignMultilineBullets(reasonVi: string, reasonKr: string): string {
  const cleanKr = (reasonKr || '').trim();
  if (!cleanKr || cleanKr.includes('\n')) return cleanKr;

  const viLines = reasonVi
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (viLines.length <= 1) return cleanKr;

  const splitParts = cleanKr
    .split(/\s+(?=[-•*]\s+\S)/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (splitParts.length === viLines.length) {
    return splitParts.join('\n');
  }
  return cleanKr;
}

export function prepareScannedOvertimeBlock(params: {
  block: ScannedScheduleBlock;
  employees: Employee[];
  glossaryEntries: OvertimeGlossaryEntry[];
  leaveRecords: OvertimeLeaveCheckEntry[];
  alreadyRecordedIdsByDate?: (isoDate: string) => Set<string>;
  defaultDate: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}): PreparedScannedOvertimeBlock | null {
  const {
    block,
    employees,
    glossaryEntries,
    leaveRecords,
    alreadyRecordedIdsByDate,
    defaultDate,
    defaultStartTime = '16:10',
    defaultEndTime = '18:10',
  } = params;

  const cleanReasonVi = (block.reasonVi || '').trim();
  if (isIgnoredNonOvertimeStatus(cleanReasonVi)) {
    return null;
  }

  const resolvedDate = normalizeScannedIsoDate(block.overtimeDate, defaultDate);
  let skippedRegularShiftCount = 0;

  const matchedRawList: Array<{
    emp: Employee;
    startTime: string;
    endTime: string;
  }> = [];
  const unmatchedSet = new Set<string>();

  for (const rawName of block.unmatchedNames || []) {
    const trimmed = (rawName || '').trim();
    if (!trimmed || isIgnoredNonOvertimeStatus(trimmed)) continue;
    const rescued = findEmployeeMatchForScannedParticipant(trimmed, undefined, employees);
    if (rescued) {
      matchedRawList.push({
        emp: rescued,
        startTime: normalizeScannedTimeTo24h(block.startTime, defaultStartTime),
        endTime: normalizeScannedTimeTo24h(block.endTime, defaultEndTime),
      });
    } else {
      unmatchedSet.add(trimmed);
    }
  }

  for (const p of block.matchedParticipants || []) {
    const rawName = (p.rawName || '').trim();
    if (isIgnoredNonOvertimeStatus(rawName)) {
      skippedRegularShiftCount += 1;
      continue;
    }
    const pStart = normalizeScannedTimeTo24h(p.startTime, '');
    const pEnd = normalizeScannedTimeTo24h(p.endTime, '');
    if (pStart && pEnd && isRegularShiftPair(pStart, pEnd)) {
      skippedRegularShiftCount += 1;
      continue;
    }

    const matchedEmp = findEmployeeMatchForScannedParticipant(
      rawName,
      p.employeeId,
      employees
    );
    if (!matchedEmp) {
      if (rawName) unmatchedSet.add(rawName);
      continue;
    }
    matchedRawList.push({
      emp: matchedEmp,
      startTime: pStart,
      endTime: pEnd,
    });
  }

  // Deduplicate matched employees keeping first appearance
  const dedupedMatched: typeof matchedRawList = [];
  const seenEmpIds = new Set<string>();
  for (const item of matchedRawList) {
    if (seenEmpIds.has(item.emp.id)) continue;
    seenEmpIds.add(item.emp.id);
    dedupedMatched.push(item);
  }

  // Determine common startTime / endTime for the block
  const rawBlockStart = normalizeScannedTimeTo24h(block.startTime, '');
  const rawBlockEnd = normalizeScannedTimeTo24h(block.endTime, '');

  const timePairCounts = new Map<string, { start: string; end: string; count: number }>();
  for (const item of dedupedMatched) {
    if (item.startTime && item.endTime) {
      const key = `${item.startTime}|${item.endTime}`;
      const existing = timePairCounts.get(key);
      if (existing) existing.count += 1;
      else timePairCounts.set(key, { start: item.startTime, end: item.endTime, count: 1 });
    }
  }
  const mostFrequentPair = Array.from(timePairCounts.values()).sort(
    (a, b) => b.count - a.count
  )[0];

  const resolvedCommonStart =
    rawBlockStart && !isRegularShiftPair(rawBlockStart, rawBlockEnd)
      ? rawBlockStart
      : mostFrequentPair?.start || defaultStartTime;
  const resolvedCommonEnd =
    rawBlockEnd && !isRegularShiftPair(rawBlockStart, rawBlockEnd)
      ? rawBlockEnd
      : mostFrequentPair?.end || defaultEndTime;

  if (
    isRegularShiftPair(resolvedCommonStart, resolvedCommonEnd) &&
    dedupedMatched.length === 0
  ) {
    return null;
  }

  // Exclude employees who have active leave or are already scheduled on resolvedDate
  const onLeaveMap = buildOnLeaveEmployeeMapForDate(
    resolvedDate,
    leaveRecords,
    employees
  );
  const alreadyRecordedIds = alreadyRecordedIdsByDate
    ? alreadyRecordedIdsByDate(resolvedDate)
    : new Set<string>();

  const selectedEmployeeIds: string[] = [];
  const customTimes: Record<string, { startTime: string; endTime: string }> = {};
  const excludedOnLeaveNames: string[] = [];
  const excludedAlreadyRecordedNames: string[] = [];

  for (const item of dedupedMatched) {
    if (onLeaveMap.has(item.emp.id)) {
      excludedOnLeaveNames.push(item.emp.fullName);
      continue;
    }
    if (alreadyRecordedIds.has(item.emp.id)) {
      excludedAlreadyRecordedNames.push(item.emp.fullName);
      continue;
    }
    selectedEmployeeIds.push(item.emp.id);
    const pStart = item.startTime || resolvedCommonStart;
    const pEnd = item.endTime || resolvedCommonEnd;
    if (pStart !== resolvedCommonStart || pEnd !== resolvedCommonEnd) {
      customTimes[item.emp.id] = {
        startTime: pStart,
        endTime: pEnd,
      };
    }
  }

  const unmatchedNames = Array.from(unmatchedSet);

  if (
    selectedEmployeeIds.length === 0 &&
    unmatchedNames.length === 0 &&
    excludedOnLeaveNames.length === 0 &&
    excludedAlreadyRecordedNames.length === 0
  ) {
    return null;
  }

  // Prioritize exact glossary match over AI translation
  const exactGlossary = findExactGlossaryMatch(glossaryEntries, cleanReasonVi);
  const resolvedReasonKr = exactGlossary
    ? exactGlossary.reasonKr
    : alignMultilineBullets(cleanReasonVi, block.reasonKr || '');

  return {
    overtimeDate: resolvedDate,
    reasonVi: cleanReasonVi,
    reasonKr: resolvedReasonKr,
    usedGlossary: Boolean(exactGlossary),
    startTime: resolvedCommonStart,
    endTime: resolvedCommonEnd,
    selectedEmployeeIds,
    customTimes,
    unmatchedNames,
    excludedOnLeaveNames,
    excludedAlreadyRecordedNames,
    skippedRegularShiftCount,
  };
}

export function prepareAllScannedOvertimeBlocks(params: {
  blocks: ScannedScheduleBlock[];
  employees: Employee[];
  glossaryEntries: OvertimeGlossaryEntry[];
  leaveRecords: OvertimeLeaveCheckEntry[];
  alreadyRecordedIdsByDate?: (isoDate: string) => Set<string>;
  defaultDate: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}): PreparedScannedOvertimeBlock[] {
  const results: PreparedScannedOvertimeBlock[] = [];
  for (const block of params.blocks || []) {
    const prepared = prepareScannedOvertimeBlock({
      block,
      employees: params.employees,
      glossaryEntries: params.glossaryEntries,
      leaveRecords: params.leaveRecords,
      alreadyRecordedIdsByDate: params.alreadyRecordedIdsByDate,
      defaultDate: params.defaultDate,
      defaultStartTime: params.defaultStartTime,
      defaultEndTime: params.defaultEndTime,
    });
    if (prepared) {
      results.push(prepared);
    }
  }
  return results;
}
