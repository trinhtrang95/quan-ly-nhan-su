import type { Employee } from '../types/hr';
import { normalize24hTime } from './workScheduleLogic';

export interface AiEmployeePromptEntry {
  id: string;
  code: string;
  name: string;
  dept: string;
}

export interface AiParsedOvertimeParticipant {
  employeeId: string;
  rawName: string;
  startTime: string;
  endTime: string;
}

export interface AiParsedOvertimeBlock {
  id: string;
  overtimeDate: string;
  reasonVi: string;
  reasonKr: string;
  startTime: string;
  endTime: string;
  matchedParticipants: AiParsedOvertimeParticipant[];
  unmatchedNames: string[];
}

export interface AiOvertimeParseResponse {
  blocks: AiParsedOvertimeBlock[];
}

export interface AiLeaveConflictInfo {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  leaveLabel: string;
}

export interface AiBlockConflictEvaluation {
  availableParticipants: AiParsedOvertimeParticipant[];
  onLeaveConflicts: AiLeaveConflictInfo[];
}

export interface AiFormDraftFill {
  overtimeDate: string;
  startTime: string;
  endTime: string;
  reasonVi: string;
  reasonKr: string;
  selectedEmployeeIds: string[];
  customTimes: Record<string, { startTime: string; endTime: string }>;
  skippedOnLeave: AiLeaveConflictInfo[];
}

export interface AiConvertedTaskBlock {
  id: string;
  overtimeDate: string;
  reasonVi: string;
  reasonKr: string;
  startTime: string;
  endTime: string;
  selectedEmployeeIds: string[];
  participants: {
    employeeId: string;
    startTime: string;
    endTime: string;
    totalHours?: number;
  }[];
  isTranslating?: boolean;
}

export function stripVietnameseAccents(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function serializeEmployeesForAiPrompt(
  employees: Employee[]
): AiEmployeePromptEntry[] {
  return employees.map((emp) => ({
    id: emp.id,
    code: (emp.employeeCode || '').trim(),
    name: (emp.fullName || '').trim(),
    dept: (emp.department || '').trim(),
  }));
}

export function buildOvertimeImageParsePrompt(params: {
  employees: AiEmployeePromptEntry[];
  defaultDate: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  glossarySamples?: { reasonVi: string; reasonKr: string }[];
}): string {
  const {
    employees,
    defaultDate,
    defaultStartTime = '16:10',
    defaultEndTime = '18:10',
    glossarySamples = [],
  } = params;

  const glossaryHint =
    glossarySamples.length > 0
      ? `\nREFERENCE GLOSSARY (prefer matching style if relevant):\n${JSON.stringify(
          glossarySamples.slice(0, 30)
        )}`
      : '';

  return `You are an HR assistant extracting overtime schedules from an image (such as a Zalo chat screenshot, Excel table photo, or handwritten/typed overtime list) for a manufacturing factory in Vietnam with Korean management.

TARGET OUTPUT: Return valid JSON matching the schema with a "blocks" array.

RULES:
1. Group people who share the SAME overtimeDate and SAME reason into ONE block (even if some individuals leave at different endTime). Split into separate blocks when dates or reasons differ.
2. Date (overtimeDate): Format strictly as "YYYY-MM-DD". If the image shows DD/MM without year, infer the year from defaultDate (${defaultDate}). If no date is shown, use "${defaultDate}".
3. Times (startTime, endTime): Format strictly as 24-hour "HH:mm" (e.g., "16:10", "18:10", "20:10", "20:40", "08:00").
   - Set block-level startTime/endTime to the most common start/end time in that block (fallback "${defaultStartTime}" - "${defaultEndTime}").
   - Set each participant's startTime/endTime accurately (if an image writes "16:10-20:40" or "tới 20h40" for specific people, preserve their individual time).
4. Reason:
   - "reasonVi": Concise, clear Vietnamese overtime work reason extracted from the image (default "Trực sản xuất" only if completely missing).
   - "reasonKr": Accurate Korean factory translation of reasonVi (e.g., "생산 당직", "생산 지원", "설비 점검", "긴급 출하 대응").
5. Employee matching:
   - Match every person listed in the image against the EMPLOYEES list below using full name (tolerant of missing Vietnamese accents, typos, Zalo display names, or reversed/shortened names when unambiguous) or employee code.
   - Put matched people in "matchedParticipants" with the EXACT "employeeId" ("id" field from EMPLOYEES) and "rawName" (the name text seen in the image).
   - If a name in the image CANNOT be matched with reasonable confidence to any employee in EMPLOYEES, do NOT guess; put that raw name string into "unmatchedNames".
   - Never duplicate the same employeeId within the same block.

EMPLOYEES (${employees.length}):
${JSON.stringify(employees)}${glossaryHint}`;
}

export function normalizeAiOvertimeDate(
  rawDate: string | undefined,
  fallbackDate: string
): string {
  const safeFallback = /^\d{4}-\d{2}-\d{2}$/.test((fallbackDate || '').trim())
    ? fallbackDate.trim()
    : new Date().toISOString().slice(0, 10);

  const raw = (rawDate || '').trim();
  if (!raw) return safeFallback;

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    let year = Number(safeFallback.slice(0, 4));
    if (dmyMatch[3]) {
      const parsedYear = Number(dmyMatch[3]);
      year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return safeFallback;
}

function parseRawJsonPayload(rawInput: unknown): Record<string, unknown> {
  if (rawInput && typeof rawInput === 'object') {
    return rawInput as Record<string, unknown>;
  }
  if (typeof rawInput !== 'string') {
    return { blocks: [] };
  }
  const trimmed = rawInput
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!trimmed) {
    return { blocks: [] };
  }
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return { blocks: parsed };
  }
  if (parsed && typeof parsed === 'object') {
    return parsed as Record<string, unknown>;
  }
  return { blocks: [] };
}

export function normalizeAiOvertimeParseResponse(params: {
  rawInput: unknown;
  employees: Employee[];
  fallbackDate: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}): AiOvertimeParseResponse {
  const {
    rawInput,
    employees,
    fallbackDate,
    defaultStartTime = '16:10',
    defaultEndTime = '18:10',
  } = params;

  const parsedObj = parseRawJsonPayload(rawInput);
  const rawBlocks = Array.isArray(parsedObj.blocks) ? parsedObj.blocks : [];

  const empById = new Map<string, Employee>();
  const empByCode = new Map<string, Employee>();
  const empByNormalizedName = new Map<string, Employee | 'AMBIGUOUS'>();

  for (const emp of employees) {
    empById.set(emp.id, emp);
    const normCode = (emp.employeeCode || '').trim().toLowerCase();
    if (normCode) {
      empByCode.set(normCode, emp);
    }
    const normName = stripVietnameseAccents(emp.fullName || '');
    if (normName) {
      empByNormalizedName.set(
        normName,
        empByNormalizedName.has(normName) ? 'AMBIGUOUS' : emp
      );
    }
  }

  const resolveEmployee = (
    rawId: unknown,
    rawName: unknown
  ): Employee | undefined => {
    const idStr = typeof rawId === 'string' ? rawId.trim() : '';
    if (idStr && empById.has(idStr)) {
      return empById.get(idStr);
    }
    if (idStr && empByCode.has(idStr.toLowerCase())) {
      return empByCode.get(idStr.toLowerCase());
    }
    const nameStr = typeof rawName === 'string' ? rawName.trim() : '';
    if (nameStr) {
      const byCode = empByCode.get(nameStr.toLowerCase());
      if (byCode) return byCode;
      const byName = empByNormalizedName.get(stripVietnameseAccents(nameStr));
      if (byName && byName !== 'AMBIGUOUS') {
        return byName;
      }
    }
    return undefined;
  };

  const normalizedBlocks: AiParsedOvertimeBlock[] = [];

  rawBlocks.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const rawBlock = item as Record<string, unknown>;

    const overtimeDate = normalizeAiOvertimeDate(
      typeof rawBlock.overtimeDate === 'string' ? rawBlock.overtimeDate : undefined,
      fallbackDate
    );
    const blockStart = normalize24hTime(
      typeof rawBlock.startTime === 'string' ? rawBlock.startTime : defaultStartTime,
      defaultStartTime
    );
    const blockEnd = normalize24hTime(
      typeof rawBlock.endTime === 'string' ? rawBlock.endTime : defaultEndTime,
      defaultEndTime
    );
    const reasonVi =
      typeof rawBlock.reasonVi === 'string' && rawBlock.reasonVi.trim()
        ? rawBlock.reasonVi.trim()
        : 'Trực sản xuất';
    const reasonKr =
      typeof rawBlock.reasonKr === 'string' ? rawBlock.reasonKr.trim() : '';

    const rawParticipants = Array.isArray(rawBlock.matchedParticipants)
      ? rawBlock.matchedParticipants
      : [];
    const seenIds = new Set<string>();
    const matchedParticipants: AiParsedOvertimeParticipant[] = [];
    const unmatchedSet = new Set<string>();

    if (Array.isArray(rawBlock.unmatchedNames)) {
      for (const name of rawBlock.unmatchedNames) {
        if (typeof name === 'string' && name.trim()) {
          unmatchedSet.add(name.trim());
        }
      }
    }

    for (const p of rawParticipants) {
      if (!p || typeof p !== 'object') continue;
      const rawP = p as Record<string, unknown>;
      const rawName =
        typeof rawP.rawName === 'string' ? rawP.rawName.trim() : '';
      const resolved = resolveEmployee(rawP.employeeId, rawName);

      if (!resolved) {
        const fallbackLabel =
          rawName ||
          (typeof rawP.employeeId === 'string' ? rawP.employeeId.trim() : '');
        if (fallbackLabel) {
          unmatchedSet.add(fallbackLabel);
        }
        continue;
      }

      if (seenIds.has(resolved.id)) continue;
      seenIds.add(resolved.id);

      const pStart = normalize24hTime(
        typeof rawP.startTime === 'string' ? rawP.startTime : blockStart,
        blockStart
      );
      const pEnd = normalize24hTime(
        typeof rawP.endTime === 'string' ? rawP.endTime : blockEnd,
        blockEnd
      );

      matchedParticipants.push({
        employeeId: resolved.id,
        rawName: rawName || resolved.fullName,
        startTime: pStart,
        endTime: pEnd,
      });
    }

    if (
      matchedParticipants.length === 0 &&
      unmatchedSet.size === 0 &&
      !rawBlock.reasonVi
    ) {
      return;
    }

    normalizedBlocks.push({
      id: `ai-block-${Date.now()}-${index + 1}`,
      overtimeDate,
      reasonVi,
      reasonKr,
      startTime: blockStart,
      endTime: blockEnd,
      matchedParticipants,
      unmatchedNames: Array.from(unmatchedSet),
    });
  });

  return { blocks: normalizedBlocks };
}

export function evaluateAiBlockLeaveConflicts(params: {
  block: AiParsedOvertimeBlock;
  employeeMap: Map<string, Employee>;
  onLeaveMap: Map<string, { label?: string; type?: string }>;
  alreadyRecordedIds?: Set<string>;
}): AiBlockConflictEvaluation {
  const { block, employeeMap, onLeaveMap, alreadyRecordedIds } = params;
  const availableParticipants: AiParsedOvertimeParticipant[] = [];
  const onLeaveConflicts: AiLeaveConflictInfo[] = [];

  for (const participant of block.matchedParticipants) {
    if (alreadyRecordedIds?.has(participant.employeeId)) {
      continue;
    }
    const leaveInfo = onLeaveMap.get(participant.employeeId);
    if (leaveInfo) {
      const emp = employeeMap.get(participant.employeeId);
      onLeaveConflicts.push({
        employeeId: participant.employeeId,
        fullName: emp?.fullName || participant.rawName,
        employeeCode: emp?.employeeCode || '',
        leaveLabel: leaveInfo.label || 'Đang nghỉ',
      });
      continue;
    }
    availableParticipants.push(participant);
  }

  return { availableParticipants, onLeaveConflicts };
}

export function convertAiBlockToFormDraft(params: {
  block: AiParsedOvertimeBlock;
  employeeMap: Map<string, Employee>;
  onLeaveMap: Map<string, { label?: string; type?: string }>;
}): AiFormDraftFill {
  const { block, employeeMap, onLeaveMap } = params;
  const { availableParticipants, onLeaveConflicts } =
    evaluateAiBlockLeaveConflicts({
      block,
      employeeMap,
      onLeaveMap,
    });

  const customTimes: Record<string, { startTime: string; endTime: string }> = {};
  for (const p of availableParticipants) {
    if (p.startTime !== block.startTime || p.endTime !== block.endTime) {
      customTimes[p.employeeId] = {
        startTime: p.startTime,
        endTime: p.endTime,
      };
    }
  }

  return {
    overtimeDate: block.overtimeDate,
    startTime: block.startTime,
    endTime: block.endTime,
    reasonVi: block.reasonVi,
    reasonKr: block.reasonKr,
    selectedEmployeeIds: availableParticipants.map((p) => p.employeeId),
    customTimes,
    skippedOnLeave: onLeaveConflicts,
  };
}

export function convertAiBlockToTaskBlock(params: {
  block: AiParsedOvertimeBlock;
  employeeMap: Map<string, Employee>;
  onLeaveMap: Map<string, { label?: string; type?: string }>;
  alreadyRecordedIds?: Set<string>;
  calculateNetHours: (
    isoDate: string,
    employeeId: string,
    startTime: string,
    endTime: string
  ) => number;
}): {
  taskBlock: AiConvertedTaskBlock | null;
  skippedOnLeave: AiLeaveConflictInfo[];
} {
  const {
    block,
    employeeMap,
    onLeaveMap,
    alreadyRecordedIds,
    calculateNetHours,
  } = params;

  const { availableParticipants, onLeaveConflicts } =
    evaluateAiBlockLeaveConflicts({
      block,
      employeeMap,
      onLeaveMap,
      alreadyRecordedIds,
    });

  if (availableParticipants.length === 0) {
    return {
      taskBlock: null,
      skippedOnLeave: onLeaveConflicts,
    };
  }

  const taskBlock: AiConvertedTaskBlock = {
    id: `ot-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    overtimeDate: block.overtimeDate,
    reasonVi: block.reasonVi,
    reasonKr: block.reasonKr,
    startTime: block.startTime,
    endTime: block.endTime,
    selectedEmployeeIds: availableParticipants.map((p) => p.employeeId),
    participants: availableParticipants.map((p) => ({
      employeeId: p.employeeId,
      startTime: p.startTime,
      endTime: p.endTime,
      totalHours: calculateNetHours(
        block.overtimeDate,
        p.employeeId,
        p.startTime,
        p.endTime
      ),
    })),
    isTranslating: false,
  };

  return {
    taskBlock,
    skippedOnLeave: onLeaveConflicts,
  };
}
