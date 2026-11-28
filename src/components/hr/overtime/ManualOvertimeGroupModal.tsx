import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileEdit,
  Info,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
} from '../../../types/hr';
import {
  buildOnLeaveEmployeeMapForDate,
  fetchActiveLeaveRecordsForOvertimeCheck,
  filterAndSortGlossaryForCombobox,
  findExactGlossaryMatch,
  getLeaveTypeShortLabel,
  getLocalTodayIsoDate,
  normalizeOvertimeGroupKey,
  normalizeTargetGroups,
  OvertimeBlockInput,
  OvertimeGlossaryEntry,
  OvertimeLeaveCheckEntry,
  shiftIsoDateDays,
  upsertOvertimeGlossaryEntry,
} from '../../../services/hrService';
import {
  type CompanyHoliday,
  evaluateOvertimeDaySchedule,
  normalize24hTime,
  sanitize24hTimeInput,
  type WorkShift,
} from '../../../utils/workScheduleLogic';
import {
  ConfirmableOvertimeBlockPayload,
  OvertimeModalPresetContext,
} from './ZaloScheduleScanModal';

export interface ManualOvertimeGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  employees: Employee[];
  groups: DepartmentGroup[];
  leaveRecords: OvertimeLeaveCheckEntry[];
  existingBlocks: OvertimeBlockInput[];
  glossaryEntries: OvertimeGlossaryEntry[];
  workShifts: WorkShift[];
  companyHolidays: CompanyHoliday[];
  presetContext?: OvertimeModalPresetContext | null;
  onSwitchMode?: (mode: 'manual' | 'ai_scan') => void;
  translateMultilineKorean: (
    reasonVi: string,
    glossaryEntries: OvertimeGlossaryEntry[]
  ) => Promise<string>;
  onGlossaryEntriesUpdated?: (entries: OvertimeGlossaryEntry[]) => void;
  onLeaveRecordsRefreshed?: (records: OvertimeLeaveCheckEntry[]) => void;
  onConfirm: (payload: ConfirmableOvertimeBlockPayload) => Promise<void>;
  onConfirmMultiple?: (payloads: ConfirmableOvertimeBlockPayload[]) => Promise<void>;
}

const QUICK_END_PRESETS = ['18:10', '19:10', '20:10', '20:40'] as const;

function formatIsoToDDMMYYYY(isoDate: string): string {
  const m = (isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatIsoToDDMM(isoDate: string): string {
  const m = (isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}`;
}

export const ManualOvertimeGroupModal: React.FC<ManualOvertimeGroupModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  employees,
  groups,
  leaveRecords,
  existingBlocks,
  glossaryEntries,
  workShifts,
  companyHolidays,
  presetContext = null,
  onSwitchMode,
  translateMultilineKorean,
  onGlossaryEntriesUpdated,
  onLeaveRecordsRefreshed,
  onConfirm,
  onConfirmMultiple,
}) => {
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const reasonDropdownRef = useRef<HTMLDivElement | null>(null);

  const [overtimeDate, setOvertimeDate] = useState(
    defaultDate || getLocalTodayIsoDate()
  );
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [isEmployeeListOpen, setIsEmployeeListOpen] = useState(false);

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [customTimes, setCustomTimes] = useState<
    Record<string, { startTime: string; endTime: string }>
  >({});
  const [editingTimeEmpId, setEditingTimeEmpId] = useState<string | null>(null);
  const [customReasons, setCustomReasons] = useState<
    Record<string, { reasonVi: string; reasonKr: string }>
  >({});
  const [editingReasonEmpId, setEditingReasonEmpId] = useState<string | null>(
    null
  );
  const [translatingCustomEmpId, setTranslatingCustomEmpId] = useState<
    string | null
  >(null);
  const [includeTwoConsecutivePrevDays, setIncludeTwoConsecutivePrevDays] =
    useState(false);

  const [startTime, setStartTime] = useState('16:10');
  const [endTime, setEndTime] = useState('18:10');
  const [isStartManuallyEdited, setIsStartManuallyEdited] = useState(false);
  const [isEndManuallyEdited, setIsEndManuallyEdited] = useState(false);

  const [reasonVi, setReasonVi] = useState('');
  const [reasonKr, setReasonKr] = useState('');
  const [isKrManuallyEdited, setIsKrManuallyEdited] = useState(false);
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    groups.forEach((g) => {
      if (g.name?.trim()) names.add(g.name.trim());
    });
    employees.forEach((emp) => {
      if (emp.department?.trim()) names.add(emp.department.trim());
    });
    return Array.from(names);
  }, [groups, employees]);

  const baseShellDate = defaultDate || getLocalTodayIsoDate();
  const prevDayD1 = useMemo(
    () => shiftIsoDateDays(baseShellDate, -1),
    [baseShellDate]
  );
  const prevDayD2 = useMemo(
    () => shiftIsoDateDays(baseShellDate, -2),
    [baseShellDate]
  );
  const isPrevDayMode = presetContext?.presetType === 'prev_day';

  const dayEvaluation = useMemo(() => {
    const empDepts = selectedEmployeeIds
      .map((id) => employeeMap.get(id)?.department?.trim() || '')
      .filter(Boolean);
    return evaluateOvertimeDaySchedule({
      isoDate: overtimeDate || getLocalTodayIsoDate(),
      holidays: companyHolidays,
      shifts: workShifts,
      departmentName: selectedGroupFilter,
      employeeDepartments: empDepts,
    });
  }, [
    overtimeDate,
    companyHolidays,
    workShifts,
    selectedGroupFilter,
    selectedEmployeeIds,
    employeeMap,
  ]);

  // Reset form each time modal opens (applying clicked-group preset context)
  useEffect(() => {
    if (!isOpen) return;
    const baseDate = defaultDate || getLocalTodayIsoDate();
    let targetDate = baseDate;
    let initialGroup = 'ALL';
    let initialReasonVi = '';
    let initialReasonKr = '';

    if (presetContext?.presetType === 'prev_day') {
      targetDate = shiftIsoDateDays(baseDate, -1);
    } else if (presetContext?.presetType === 'production_duty') {
      initialReasonVi = 'Trực sản xuất';
      initialReasonKr = '생산 당직';
    } else if (
      presetContext?.presetType === 'group' &&
      presetContext.targetGroupName
    ) {
      const targetKey = normalizeOvertimeGroupKey(
        presetContext.targetGroupName
      );
      const matchedOpt = departmentOptions.find(
        (opt) => normalizeOvertimeGroupKey(opt) === targetKey
      );
      initialGroup = matchedOpt || 'ALL';
    }

    const initialEval = evaluateOvertimeDaySchedule({
      isoDate: targetDate,
      holidays: companyHolidays,
      shifts: workShifts,
      departmentName: initialGroup,
      employeeDepartments: [],
    });

    setOvertimeDate(targetDate);
    setSelectedGroupFilter(initialGroup);
    setIncludeTwoConsecutivePrevDays(false);
    setEmployeeQuery('');
    setIsEmployeeListOpen(false);
    setSelectedEmployeeIds([]);
    setCustomTimes({});
    setEditingTimeEmpId(null);
    setCustomReasons({});
    setEditingReasonEmpId(null);
    setTranslatingCustomEmpId(null);
    setStartTime(initialEval.suggestedStartTime || '16:10');
    setEndTime(initialEval.suggestedDefaultEndTime || '18:10');
    setIsStartManuallyEdited(false);
    setIsEndManuallyEdited(false);
    setReasonVi(initialReasonVi);
    setReasonKr(initialReasonKr);
    setIsKrManuallyEdited(false);
    setIsReasonDropdownOpen(false);
    setIsTranslating(false);
    setIsConfirming(false);
    setErrorMessage(null);
  }, [isOpen, defaultDate, presetContext, departmentOptions, companyHolidays, workShifts]);

  // Sync suggested start/end when schedule shifts and user hasn't manually overridden
  useEffect(() => {
    if (!isOpen) return;
    if (!isStartManuallyEdited && dayEvaluation.suggestedStartTime) {
      setStartTime(dayEvaluation.suggestedStartTime);
    }
    if (!isEndManuallyEdited && dayEvaluation.suggestedDefaultEndTime) {
      setEndTime(dayEvaluation.suggestedDefaultEndTime);
    }
  }, [
    isOpen,
    dayEvaluation.suggestedStartTime,
    dayEvaluation.suggestedDefaultEndTime,
    isStartManuallyEdited,
    isEndManuallyEdited,
  ]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsEmployeeListOpen(false);
      }
      if (
        reasonDropdownRef.current &&
        !reasonDropdownRef.current.contains(e.target as Node)
      ) {
        setIsReasonDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const getAlreadyRecordedIdsForDate = (isoDate: string) => {
    const set = new Set<string>();
    for (const block of existingBlocks || []) {
      if ((block.overtimeDate || '') === isoDate) {
        for (const p of block.participants || []) {
          if (p.employeeId) set.add(p.employeeId);
        }
        for (const id of block.selectedEmployeeIds || []) {
          if (id) set.add(id);
        }
      }
    }
    return set;
  };

  const alreadyRecordedIds = useMemo(() => {
    if (isPrevDayMode && includeTwoConsecutivePrevDays) {
      const s1 = getAlreadyRecordedIdsForDate(prevDayD1);
      const s2 = getAlreadyRecordedIdsForDate(prevDayD2);
      const both = new Set<string>();
      for (const id of s1) {
        if (s2.has(id)) both.add(id);
      }
      return both;
    }
    return getAlreadyRecordedIdsForDate(overtimeDate);
  }, [
    existingBlocks,
    overtimeDate,
    isPrevDayMode,
    includeTwoConsecutivePrevDays,
    prevDayD1,
    prevDayD2,
  ]);

  const onLeaveMap = useMemo(() => {
    if (isPrevDayMode && includeTwoConsecutivePrevDays) {
      const m1 = buildOnLeaveEmployeeMapForDate(prevDayD1, leaveRecords, employees);
      const m2 = buildOnLeaveEmployeeMapForDate(prevDayD2, leaveRecords, employees);
      const both = new Map<string, (typeof leaveRecords)[number]>();
      for (const [id, rec] of m1.entries()) {
        if (m2.has(id)) both.set(id, rec);
      }
      return both;
    }
    return buildOnLeaveEmployeeMapForDate(overtimeDate, leaveRecords, employees);
  }, [
    overtimeDate,
    leaveRecords,
    employees,
    isPrevDayMode,
    includeTwoConsecutivePrevDays,
    prevDayD1,
    prevDayD2,
  ]);

  // Drop selected employees who have an active leave or were already recorded on date change
  useEffect(() => {
    if (!isOpen) return;
    setSelectedEmployeeIds((prev) => {
      const next = prev.filter(
        (id) => !onLeaveMap.has(id) && !alreadyRecordedIds.has(id)
      );
      return next.length === prev.length ? prev : next;
    });
  }, [isOpen, onLeaveMap, alreadyRecordedIds]);

  const filteredEmployees = useMemo(() => {
    const available = employees.filter((e) => !alreadyRecordedIds.has(e.id));
    const normGroup = selectedGroupFilter.trim();
    const byGroup =
      !normGroup || normGroup === 'ALL'
        ? available
        : available.filter((e) => (e.department || '').trim() === normGroup);
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return byGroup;
    return byGroup.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    );
  }, [employees, alreadyRecordedIds, selectedGroupFilter, employeeQuery]);

  const selectableFilteredEmployees = useMemo(
    () => filteredEmployees.filter((e) => !onLeaveMap.has(e.id)),
    [filteredEmployees, onLeaveMap]
  );

  const selectedGroupsForCombobox = useMemo(() => {
    const fromSelected = normalizeTargetGroups(
      selectedEmployeeIds.map((id) => employeeMap.get(id)?.department || '')
    );
    if (fromSelected.length > 0) return fromSelected;
    if (selectedGroupFilter && selectedGroupFilter !== 'ALL') {
      return [selectedGroupFilter];
    }
    return [];
  }, [selectedEmployeeIds, employeeMap, selectedGroupFilter]);

  const filteredGlossary = useMemo(
    () =>
      filterAndSortGlossaryForCombobox({
        entries: glossaryEntries,
        selectedGroupFilter,
        selectedEmployeeDepartments: selectedGroupsForCombobox,
        searchText: reasonVi,
      }),
    [glossaryEntries, selectedGroupFilter, selectedGroupsForCombobox, reasonVi]
  );

  // Auto-translate reasonVi -> reasonKr
  useEffect(() => {
    if (!isOpen || isKrManuallyEdited) {
      setIsTranslating(false);
      return;
    }
    const cleanVi = reasonVi.trim();
    if (!cleanVi) {
      setIsTranslating(false);
      setReasonKr('');
      return;
    }
    const exact = findExactGlossaryMatch(glossaryEntries, cleanVi);
    if (exact) {
      setIsTranslating(false);
      setReasonKr(exact.reasonKr);
      return;
    }

    let cancelled = false;
    setIsTranslating(true);
    const timer = window.setTimeout(async () => {
      try {
        const translated = await translateMultilineKorean(
          reasonVi,
          glossaryEntries
        );
        if (!cancelled) setReasonKr(translated);
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, reasonVi, isKrManuallyEdited, glossaryEntries, translateMultilineKorean]);

  const handleToggleEmployee = (empId: string) => {
    if (onLeaveMap.has(empId) || alreadyRecordedIds.has(empId)) return;
    setSelectedEmployeeIds((prev) => {
      const exists = prev.includes(empId);
      if (exists) {
        setCustomTimes((ct) => {
          if (!ct[empId]) return ct;
          const next = { ...ct };
          delete next[empId];
          return next;
        });
        setCustomReasons((cr) => {
          if (!cr[empId]) return cr;
          const next = { ...cr };
          delete next[empId];
          return next;
        });
        if (editingTimeEmpId === empId) setEditingTimeEmpId(null);
        if (editingReasonEmpId === empId) setEditingReasonEmpId(null);
        return prev.filter((id) => id !== empId);
      }
      return [...prev, empId];
    });
  };

  const handleUpdateCustomReason = (
    empId: string,
    field: 'reasonVi' | 'reasonKr',
    value: string
  ) => {
    setCustomReasons((prev) => {
      const curr = prev[empId] || { reasonVi: '', reasonKr: '' };
      return {
        ...prev,
        [empId]: { ...curr, [field]: value },
      };
    });
  };

  const handleClearCustomReason = (empId: string) => {
    setCustomReasons((prev) => {
      if (!prev[empId]) return prev;
      const next = { ...prev };
      delete next[empId];
      return next;
    });
    if (editingReasonEmpId === empId) {
      setEditingReasonEmpId(null);
    }
  };

  const handleTranslateCustomReason = async (empId: string) => {
    const customVi = (customReasons[empId]?.reasonVi || '').trim();
    if (!customVi) return;
    setTranslatingCustomEmpId(empId);
    try {
      const translated = await translateMultilineKorean(
        customVi,
        glossaryEntries
      );
      setCustomReasons((prev) => ({
        ...prev,
        [empId]: {
          reasonVi: prev[empId]?.reasonVi || customVi,
          reasonKr: translated,
        },
      }));
    } finally {
      setTranslatingCustomEmpId((prev) => (prev === empId ? null : prev));
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = selectableFilteredEmployees.map((e) => e.id);
    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedEmployeeIds.includes(id));
    if (allSelected) {
      setSelectedEmployeeIds((prev) =>
        prev.filter((id) => !filteredIds.includes(id))
      );
    } else {
      setSelectedEmployeeIds((prev) =>
        Array.from(new Set([...prev, ...filteredIds]))
      );
    }
  };

  const handleRetranslate = async () => {
    if (!reasonVi.trim()) return;
    setIsTranslating(true);
    try {
      const translated = await translateMultilineKorean(
        reasonVi,
        glossaryEntries
      );
      setReasonKr(translated);
      setIsKrManuallyEdited(false);
    } finally {
      setIsTranslating(false);
    }
  };

  const buildPayloadForDate = async (
    targetIsoDate: string,
    candidateEmployeeIds: string[],
    normStart: string,
    normEnd: string,
    cleanVi: string,
    finalKr: string,
    normalizedCustomReasons: Record<
      string,
      { reasonVi: string; reasonKr: string }
    >
  ): Promise<ConfirmableOvertimeBlockPayload> => {
    const normalizedCustomTimes: Record<
      string,
      { startTime: string; endTime: string }
    > = {};
    const filteredCustomReasons: Record<
      string,
      { reasonVi: string; reasonKr: string }
    > = {};

    for (const empId of candidateEmployeeIds) {
      const c = customTimes[empId];
      if (c) {
        const pStart = normalize24hTime(c.startTime, normStart);
        const pEnd = normalize24hTime(c.endTime, normEnd);
        if (pStart !== normStart || pEnd !== normEnd) {
          normalizedCustomTimes[empId] = { startTime: pStart, endTime: pEnd };
        }
      }
      if (normalizedCustomReasons[empId]) {
        filteredCustomReasons[empId] = normalizedCustomReasons[empId];
      }
    }

    return {
      overtimeDate: targetIsoDate,
      startTime: normStart,
      endTime: normEnd,
      reasonVi: cleanVi,
      reasonKr: finalKr,
      selectedEmployeeIds: [...candidateEmployeeIds],
      customTimes: normalizedCustomTimes,
      customReasons: filteredCustomReasons,
    };
  };

  const handleSubmit = async () => {
    if (isConfirming) return;
    setErrorMessage(null);

    if (selectedEmployeeIds.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 nhân sự tham gia nhóm.');
      return;
    }
    if (!reasonVi.trim()) {
      setErrorMessage('Vui lòng nhập Lý do tăng ca (Tiếng Việt).');
      return;
    }

    setIsConfirming(true);
    try {
      const latestCheck = await fetchActiveLeaveRecordsForOvertimeCheck(
        employees
      ).catch(() => null);
      const activeLeaves =
        latestCheck && latestCheck.source === 'supabase'
          ? latestCheck.records
          : leaveRecords;
      if (latestCheck && latestCheck.source === 'supabase') {
        onLeaveRecordsRefreshed?.(latestCheck.records);
      }

      const normStart = normalize24hTime(
        startTime,
        dayEvaluation.suggestedStartTime || '16:10'
      );
      const normEnd = normalize24hTime(
        endTime,
        dayEvaluation.suggestedDefaultEndTime || '18:10'
      );
      const cleanVi = reasonVi.trim();
      const finalKr = reasonKr.trim()
        ? reasonKr.trim()
        : await translateMultilineKorean(cleanVi, glossaryEntries);

      if (cleanVi && finalKr) {
        const existingMatch = findExactGlossaryMatch(glossaryEntries, cleanVi);
        if (!existingMatch) {
          const depts = normalizeTargetGroups(
            selectedEmployeeIds.map(
              (id) => employeeMap.get(id)?.department || ''
            )
          );
          void upsertOvertimeGlossaryEntry(cleanVi, finalKr, {
            isVerified: false,
            targetGroups: depts,
          }).then(({ entries }) => onGlossaryEntriesUpdated?.(entries));
        } else if (finalKr !== existingMatch.reasonKr.trim()) {
          void upsertOvertimeGlossaryEntry(cleanVi, finalKr).then(
            ({ entries }) => onGlossaryEntriesUpdated?.(entries)
          );
        }
      }

      const normalizedCustomReasons: Record<
        string,
        { reasonVi: string; reasonKr: string }
      > = {};
      for (const empId of selectedEmployeeIds) {
        const r = customReasons[empId];
        if (!r) continue;
        const rVi = (r.reasonVi || '').trim();
        let rKr = (r.reasonKr || '').trim();
        if (rVi && !rKr) {
          rKr = (await translateMultilineKorean(rVi, glossaryEntries)).trim();
        }
        if ((rVi || rKr) && (rVi !== cleanVi || (rKr && rKr !== finalKr))) {
          normalizedCustomReasons[empId] = {
            reasonVi: rVi || cleanVi,
            reasonKr: rKr,
          };
        }
      }

      if (isPrevDayMode && includeTwoConsecutivePrevDays) {
        const targetDates = [prevDayD2, prevDayD1]; // D-2 trước, D-1 sau (theo thứ tự thời gian)
        const payloadsToSave: ConfirmableOvertimeBlockPayload[] = [];
        for (const d of targetDates) {
          const leaveForDay = buildOnLeaveEmployeeMapForDate(
            d,
            activeLeaves,
            employees
          );
          const dupForDay = getAlreadyRecordedIdsForDate(d);
          const validForDay = selectedEmployeeIds.filter(
            (id) => !leaveForDay.has(id) && !dupForDay.has(id)
          );
          if (validForDay.length > 0) {
            payloadsToSave.push(
              await buildPayloadForDate(
                d,
                validForDay,
                normStart,
                normEnd,
                cleanVi,
                finalKr,
                normalizedCustomReasons
              )
            );
          }
        }
        if (payloadsToSave.length === 0) {
          setErrorMessage(
            `Tất cả nhân sự đã chọn đều đang nghỉ hoặc đã có lịch trong cả 2 ngày ${formatIsoToDDMM(
              prevDayD2
            )} & ${formatIsoToDDMM(prevDayD1)}.`
          );
          return;
        }
        if (onConfirmMultiple) {
          await onConfirmMultiple(payloadsToSave);
        } else {
          for (const p of payloadsToSave) {
            await onConfirm(p);
          }
        }
        return;
      }

      const resolvedDate = overtimeDate || defaultDate || getLocalTodayIsoDate();
      const freshLeaveMap = buildOnLeaveEmployeeMapForDate(
        resolvedDate,
        activeLeaves,
        employees
      );
      const conflictIds = selectedEmployeeIds.filter((id) =>
        freshLeaveMap.has(id)
      );
      if (conflictIds.length > 0) {
        const conflictSet = new Set(conflictIds);
        setSelectedEmployeeIds((prev) =>
          prev.filter((id) => !conflictSet.has(id))
        );
        const names = conflictIds
          .slice(0, 3)
          .map((id) => employeeMap.get(id)?.fullName || id)
          .join(', ');
        setErrorMessage(
          `Không thể ghi nhận: ${names}${
            conflictIds.length > 3 ? ` và ${conflictIds.length - 3} người khác` : ''
          } đang có đơn nghỉ ngày ${formatIsoToDDMMYYYY(resolvedDate)}.`
        );
        return;
      }

      const singlePayload = await buildPayloadForDate(
        resolvedDate,
        selectedEmployeeIds,
        normStart,
        normEnd,
        cleanVi,
        finalKr,
        normalizedCustomReasons
      );
      await onConfirm(singlePayload);
    } catch (err) {
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'Không thể ghi nhận nhóm tăng ca.'
      );
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirming) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-ot-group-modal-title"
        data-testid="manual-overtime-group-modal"
        className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-[#14539E] flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </span>
            <div className="min-w-0">
              <h3
                id="manual-ot-group-modal-title"
                className="text-sm font-bold text-slate-900 truncate"
              >
                {presetContext?.label
                  ? `Đăng ký nhóm: ${presetContext.label}`
                  : 'Thêm nhóm tăng ca thủ công'}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {isPrevDayMode && includeTwoConsecutivePrevDays ? (
                  <>
                    Ghi nhận phát sinh cả 2 ngày{' '}
                    <strong className="font-mono text-[#14539E]">
                      {formatIsoToDDMM(prevDayD2)} &amp; {formatIsoToDDMM(prevDayD1)}
                    </strong>{' '}
                    vào phiếu{' '}
                    <strong className="font-mono text-slate-700">
                      {formatIsoToDDMMYYYY(baseShellDate)}
                    </strong>
                  </>
                ) : isPrevDayMode ? (
                  <>
                    Ghi nhận phát sinh ngày{' '}
                    <strong className="font-mono text-[#14539E]">
                      {formatIsoToDDMM(overtimeDate)}
                    </strong>{' '}
                    vào phiếu{' '}
                    <strong className="font-mono text-slate-700">
                      {formatIsoToDDMMYYYY(baseShellDate)}
                    </strong>
                  </>
                ) : (
                  <>
                    Chọn nhân sự, thời gian và lý do để ghi nhận trực tiếp vào phiếu ngày{' '}
                    <strong className="font-mono text-[#14539E]">
                      {formatIsoToDDMMYYYY(overtimeDate)}
                    </strong>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSwitchMode && (
              <div
                role="tablist"
                aria-label="Chuyển chế độ đăng ký tăng ca"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 gap-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={true}
                  data-testid="modal-switch-manual-btn"
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#14539E] text-white cursor-pointer whitespace-nowrap"
                >
                  Nhập thủ công
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={false}
                  data-testid="modal-switch-ai-btn"
                  onClick={() => onSwitchMode('ai_scan')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 hover:text-[#14539E] hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  Quét ảnh Zalo AI
                </button>
              </div>
            )}
            <button
              type="button"
              aria-label="Đóng cửa sổ thêm nhóm thủ công"
              disabled={isConfirming}
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {dayEvaluation.bannerTone !== 'none' && (
            <div
              role="status"
              className={`rounded-xl border px-3 py-2 text-[11px] flex items-start gap-2 ${
                dayEvaluation.bannerTone === 'holiday'
                  ? 'border-purple-300 bg-purple-50 text-purple-900'
                  : dayEvaluation.bannerTone === 'compensatory'
                    ? 'border-violet-300 bg-violet-50 text-violet-900'
                    : dayEvaluation.bannerTone === 'weekly_off'
                      ? 'border-orange-200 bg-orange-50 text-orange-900'
                      : 'border-blue-200 bg-blue-50/80 text-[#14539E]'
              }`}
            >
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="font-semibold leading-snug">
                {dayEvaluation.bannerText}
              </span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              data-testid="manual-group-modal-error"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Bộ phận / Nhóm & Ngày */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="manual-group-dept-select"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Lọc bộ phận / nhóm nhân sự
              </label>
              <select
                id="manual-group-dept-select"
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="w-full h-8 px-2.5 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                <option value="ALL">Tất cả nhóm</option>
                {departmentOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="manual-group-date-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Ngày tăng ca
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="manual-group-date-input"
                  type="date"
                  disabled={isPrevDayMode && includeTwoConsecutivePrevDays}
                  value={overtimeDate}
                  onChange={(e) => setOvertimeDate(e.target.value)}
                  className="w-full h-8 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Thanh chọn nhanh ngày phát sinh hôm trước (D-1 / D-2 / cả 2 ngày) */}
          {isPrevDayMode && (
            <div
              data-testid="manual-prev-day-bar"
              className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-700">Chọn nhanh ngày trước:</span>
                <button
                  type="button"
                  data-testid="manual-prev-d1-btn"
                  onClick={() => {
                    setIncludeTwoConsecutivePrevDays(false);
                    setOvertimeDate(prevDayD1);
                  }}
                  className={`px-2 py-0.5 rounded-md font-mono font-semibold border cursor-pointer transition-colors ${
                    !includeTwoConsecutivePrevDays && overtimeDate === prevDayD1
                      ? 'bg-[#14539E] text-white border-[#14539E]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-[#14539E]'
                  }`}
                >
                  Hôm qua ({formatIsoToDDMM(prevDayD1)})
                </button>
                <button
                  type="button"
                  data-testid="manual-prev-d2-btn"
                  onClick={() => {
                    setIncludeTwoConsecutivePrevDays(false);
                    setOvertimeDate(prevDayD2);
                  }}
                  className={`px-2 py-0.5 rounded-md font-mono font-semibold border cursor-pointer transition-colors ${
                    !includeTwoConsecutivePrevDays && overtimeDate === prevDayD2
                      ? 'bg-[#14539E] text-white border-[#14539E]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-[#14539E]'
                  }`}
                >
                  2 ngày trước ({formatIsoToDDMM(prevDayD2)})
                </button>
              </div>

              <label className="inline-flex items-center gap-1.5 font-semibold text-[#14539E] cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="manual-prev-two-days-checkbox"
                  checked={includeTwoConsecutivePrevDays}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIncludeTwoConsecutivePrevDays(checked);
                    if (checked) setOvertimeDate(prevDayD1);
                  }}
                  className="w-3.5 h-3.5 rounded border-blue-300 text-[#14539E] focus:ring-[#14539E] cursor-pointer"
                />
                <span>
                  Ghi nhận cả 2 ngày liên tiếp ({formatIsoToDDMM(prevDayD2)} &amp; {formatIsoToDDMM(prevDayD1)})
                </span>
              </label>
            </div>
          )}

          {/* Chọn nhân sự */}
          <div className="space-y-2" ref={pickerRef}>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="manual-group-emp-search"
                className="text-[11px] font-semibold text-slate-600"
              >
                Nhân sự ({selectedEmployeeIds.length} đã chọn)
                {onLeaveMap.size > 0 && (
                  <span className="text-rose-600 font-normal ml-1.5">
                    ({onLeaveMap.size} đang nghỉ)
                  </span>
                )}
              </label>
              {selectedEmployeeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployeeIds([]);
                    setCustomTimes({});
                    setEditingTimeEmpId(null);
                    setCustomReasons({});
                    setEditingReasonEmpId(null);
                  }}
                  className="text-[11px] font-medium text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  Bỏ chọn hết
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="manual-group-emp-search"
                data-testid="manual-group-emp-search"
                type="text"
                value={employeeQuery}
                onFocus={() => setIsEmployeeListOpen(true)}
                onClick={() => setIsEmployeeListOpen(true)}
                onChange={(e) => {
                  setEmployeeQuery(e.target.value);
                  if (!isEmployeeListOpen) setIsEmployeeListOpen(true);
                }}
                placeholder="Bấm để chọn hoặc tìm mã, tên nhân sự..."
                className="w-full h-8 pl-8 pr-12 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
              />
              <button
                type="button"
                aria-label="Mở danh sách nhân sự"
                onClick={() => setIsEmployeeListOpen((prev) => !prev)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#14539E] cursor-pointer"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    isEmployeeListOpen ? 'rotate-180 text-[#14539E]' : ''
                  }`}
                />
              </button>

              {isEmployeeListOpen && (
                <div
                  data-testid="manual-group-emp-dropdown"
                  className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
                >
                  <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      {selectableFilteredEmployees.length} nhân sự khả dụng
                    </span>
                    <button
                      type="button"
                      disabled={selectableFilteredEmployees.length === 0}
                      onClick={handleSelectAllFiltered}
                      className="font-semibold text-[#14539E] hover:underline cursor-pointer disabled:opacity-40"
                    >
                      {selectableFilteredEmployees.length > 0 &&
                      selectableFilteredEmployees.every((e) =>
                        selectedEmployeeIds.includes(e.id)
                      )
                        ? 'Bỏ chọn tất cả'
                        : 'Chọn tất cả'}
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1.5 space-y-1">
                    {filteredEmployees.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        Không có nhân sự khả dụng phù hợp.
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const leave = onLeaveMap.get(emp.id);
                        const isLeave = Boolean(leave);
                        const isSelected =
                          !isLeave && selectedEmployeeIds.includes(emp.id);
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            disabled={isLeave}
                            data-testid={`manual-emp-option-${emp.employeeCode || emp.id}`}
                            onClick={() => handleToggleEmployee(emp.id)}
                            className={`w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                              isLeave
                                ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-blue-50 text-slate-900 font-semibold cursor-pointer'
                                  : 'hover:bg-slate-100 text-slate-700 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                                  isSelected
                                    ? 'bg-[#14539E] border-[#14539E] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && (
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                )}
                              </span>
                              <span className="truncate">{emp.fullName}</span>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                ({emp.employeeCode})
                              </span>
                            </div>
                            {leave ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                {getLeaveTypeShortLabel(leave)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {emp.department}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="px-2.5 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      Đã chọn:{' '}
                      <strong className="text-[#14539E]">
                        {selectedEmployeeIds.length}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEmployeeListOpen(false)}
                      className="px-2.5 py-0.5 rounded bg-[#14539E] text-white font-semibold cursor-pointer"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedEmployeeIds.length > 0 && (
              <div className="space-y-2 pt-0.5">
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {selectedEmployeeIds.map((empId) => {
                    const emp = employeeMap.get(empId);
                    if (!emp) return null;
                    const empStart = customTimes[empId]?.startTime || startTime;
                    const empEnd = customTimes[empId]?.endTime || endTime;
                    const isCustom = Boolean(customTimes[empId]);
                    const isEditing = editingTimeEmpId === empId;
                    const customReasonEntry = customReasons[empId];
                    const hasCustomReason = Boolean(
                      customReasonEntry &&
                        ((customReasonEntry.reasonVi || '').trim() ||
                          (customReasonEntry.reasonKr || '').trim())
                    );
                    const isEditingReason = editingReasonEmpId === empId;

                    return (
                      <div
                        key={empId}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] ${
                          isCustom || hasCustomReason
                            ? 'bg-amber-50 border-amber-300 text-slate-800'
                            : 'bg-blue-50/75 border-blue-200 text-slate-800'
                        }`}
                      >
                        <span className="font-medium truncate max-w-[140px]">
                          {emp.fullName}
                        </span>
                        {isEditing ? (
                          <div className="flex items-center gap-0.5 bg-white px-1 py-0.5 rounded border border-[#14539E]">
                            <input
                              type="text"
                              maxLength={5}
                              value={empStart}
                              onChange={(e) =>
                                setCustomTimes((prev) => ({
                                  ...prev,
                                  [empId]: {
                                    startTime: sanitize24hTimeInput(e.target.value),
                                    endTime: prev[empId]?.endTime || endTime,
                                  },
                                }))
                              }
                              onBlur={() =>
                                setCustomTimes((prev) => ({
                                  ...prev,
                                  [empId]: {
                                    startTime: normalize24hTime(empStart, startTime),
                                    endTime: prev[empId]?.endTime || endTime,
                                  },
                                }))
                              }
                              className="w-10 h-4 text-[10px] font-mono text-center border border-slate-200 rounded"
                            />
                            <span className="text-[10px] text-slate-400">-</span>
                            <input
                              type="text"
                              maxLength={5}
                              value={empEnd}
                              onChange={(e) =>
                                setCustomTimes((prev) => ({
                                  ...prev,
                                  [empId]: {
                                    startTime: prev[empId]?.startTime || startTime,
                                    endTime: sanitize24hTimeInput(e.target.value),
                                  },
                                }))
                              }
                              onBlur={() =>
                                setCustomTimes((prev) => ({
                                  ...prev,
                                  [empId]: {
                                    startTime: prev[empId]?.startTime || startTime,
                                    endTime: normalize24hTime(empEnd, endTime),
                                  },
                                }))
                              }
                              className="w-10 h-4 text-[10px] font-mono text-center border border-slate-200 rounded"
                            />
                            <button
                              type="button"
                              onClick={() => setEditingTimeEmpId(null)}
                              className="p-0.5 text-emerald-600 cursor-pointer"
                            >
                              <Check className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingTimeEmpId(empId)}
                            className="text-[10px] font-mono px-1 py-0.5 rounded border border-slate-200 bg-white text-slate-600 hover:border-[#14539E] cursor-pointer"
                          >
                            {empStart}-{empEnd}
                          </button>
                        )}
                        <button
                          type="button"
                          title="Thêm lý do tăng ca riêng cho người này"
                          aria-label={`Thêm lý do tăng ca riêng cho ${emp.fullName}`}
                          data-testid={`manual-custom-reason-btn-${emp.employeeCode || emp.id}`}
                          onClick={() =>
                            setEditingReasonEmpId((prev) =>
                              prev === empId ? null : empId
                            )
                          }
                          className={`p-0.5 rounded border cursor-pointer transition-colors ${
                            hasCustomReason || isEditingReason
                              ? 'border-amber-400 bg-amber-100 text-amber-800'
                              : 'border-transparent text-slate-400 hover:text-[#14539E] hover:bg-white'
                          }`}
                        >
                          <FileEdit className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Bỏ chọn ${emp.fullName}`}
                          onClick={() => handleToggleEmployee(empId)}
                          className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {editingReasonEmpId &&
                  employeeMap.get(editingReasonEmpId) &&
                  selectedEmployeeIds.includes(editingReasonEmpId) && (() => {
                    const targetEmp = employeeMap.get(editingReasonEmpId)!;
                    const entry = customReasons[editingReasonEmpId] || {
                      reasonVi: '',
                      reasonKr: '',
                    };
                    const hasEntry = Boolean(
                      entry.reasonVi.trim() || entry.reasonKr.trim()
                    );
                    return (
                      <div
                        data-testid="manual-custom-reason-editor"
                        className="rounded-xl border border-amber-300 bg-amber-50/70 p-2.5 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-amber-900">
                            Lý do tăng ca riêng — {targetEmp.fullName}{' '}
                            <span className="font-normal text-amber-700">
                              (tự động đẩy xuống cuối nhóm &amp; tách ô riêng)
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={translatingCustomEmpId === editingReasonEmpId}
                              onClick={() =>
                                void handleTranslateCustomReason(editingReasonEmpId)
                              }
                              className="text-[10px] font-semibold text-[#14539E] hover:underline inline-flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                            >
                              {translatingCustomEmpId === editingReasonEmpId ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-2.5 h-2.5" />
                              )}
                              <span>Dịch gợi ý</span>
                            </button>
                            {hasEntry && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleClearCustomReason(editingReasonEmpId)
                                }
                                className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
                              >
                                Xóa lý do riêng
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingReasonEmpId(null)}
                              className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Thu gọn
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            data-testid="manual-custom-reason-vi-input"
                            value={entry.reasonVi}
                            onChange={(e) =>
                              handleUpdateCustomReason(
                                editingReasonEmpId,
                                'reasonVi',
                                e.target.value
                              )
                            }
                            placeholder="Lý do riêng (Tiếng Việt)..."
                            className="w-full h-7 px-2 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:border-[#14539E]"
                          />
                          <input
                            type="text"
                            data-testid="manual-custom-reason-kr-input"
                            value={entry.reasonKr}
                            onChange={(e) =>
                              handleUpdateCustomReason(
                                editingReasonEmpId,
                                'reasonKr',
                                e.target.value
                              )
                            }
                            placeholder="Lý do riêng (Tiếng Hàn)..."
                            className="w-full h-7 px-2 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:border-[#14539E]"
                          />
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}
          </div>

          {/* Giờ bắt đầu & Giờ kết thúc (24h HH:mm + quick presets) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="manual-group-start-time"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Giờ bắt đầu (chung)
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="manual-group-start-time"
                  data-testid="manual-group-start-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={startTime}
                  onChange={(e) => {
                    setIsStartManuallyEdited(true);
                    setStartTime(sanitize24hTimeInput(e.target.value));
                  }}
                  onBlur={() =>
                    setStartTime((prev) =>
                      normalize24hTime(
                        prev,
                        dayEvaluation.suggestedStartTime || '16:10'
                      )
                    )
                  }
                  className="w-full h-8 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="manual-group-end-time"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Giờ kết thúc (chung)
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="manual-group-end-time"
                  data-testid="manual-group-end-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={endTime}
                  onChange={(e) => {
                    setIsEndManuallyEdited(true);
                    setEndTime(sanitize24hTimeInput(e.target.value));
                  }}
                  onBlur={() =>
                    setEndTime((prev) =>
                      normalize24hTime(
                        prev,
                        dayEvaluation.suggestedDefaultEndTime || '18:10'
                      )
                    )
                  }
                  className="w-full h-8 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {QUICK_END_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setIsEndManuallyEdited(true);
                      setEndTime(t);
                    }}
                    className={`px-2 py-0.5 text-[10px] font-mono font-medium rounded border transition-colors cursor-pointer ${
                      endTime === t
                        ? 'bg-[#14539E] text-white border-[#14539E]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-[#14539E]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lý do (Tiếng Việt & Tiếng Hàn) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div ref={reasonDropdownRef} className="relative">
              <div className="flex items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="manual-group-reason-vi"
                  className="text-[11px] font-semibold text-slate-600"
                >
                  Lý do (Tiếng Việt)
                </label>
                {isTranslating && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#14539E]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Đang dịch...</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <textarea
                  id="manual-group-reason-vi"
                  data-testid="manual-group-reason-vi"
                  rows={3}
                  value={reasonVi}
                  onFocus={() => setIsReasonDropdownOpen(true)}
                  onChange={(e) => {
                    setReasonVi(e.target.value);
                    if (!isReasonDropdownOpen) setIsReasonDropdownOpen(true);
                  }}
                  placeholder="Chọn từ điển hoặc nhập lý do tăng ca..."
                  className="w-full pl-2.5 pr-7 py-1.5 text-xs leading-snug text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] resize-y"
                />
                <button
                  type="button"
                  onClick={() => setIsReasonDropdownOpen((prev) => !prev)}
                  className="absolute right-1.5 top-1.5 p-1 text-slate-400 hover:text-[#14539E] cursor-pointer"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      isReasonDropdownOpen ? 'rotate-180 text-[#14539E]' : ''
                    }`}
                  />
                </button>
                {isReasonDropdownOpen && filteredGlossary.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-lg border border-slate-200 bg-white shadow-xl max-h-44 overflow-y-auto p-1 space-y-0.5">
                    {filteredGlossary.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setReasonVi(item.reasonVi);
                          setReasonKr(item.reasonKr);
                          setIsKrManuallyEdited(false);
                          setIsReasonDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-md text-[11px] hover:bg-blue-50 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="line-clamp-2 text-slate-700 font-medium">
                          {item.reasonVi}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="manual-group-reason-kr"
                  className="text-[11px] font-semibold text-slate-600"
                >
                  Lý do (Tiếng Hàn)
                </label>
                <button
                  type="button"
                  onClick={() => void handleRetranslate()}
                  className="text-[10px] font-medium text-[#14539E] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Dịch gợi ý</span>
                </button>
              </div>
              <textarea
                id="manual-group-reason-kr"
                data-testid="manual-group-reason-kr"
                rows={3}
                value={reasonKr}
                onChange={(e) => {
                  setReasonKr(e.target.value);
                  setIsKrManuallyEdited(true);
                }}
                placeholder="생산 당직 (Tự động gợi ý từ từ điển)..."
                className="w-full px-2.5 py-1.5 text-xs leading-snug text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] resize-y"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500">
            Đã chọn{' '}
            <strong className="text-[#14539E]">
              {selectedEmployeeIds.length}
            </strong>{' '}
            nhân sự
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isConfirming}
              onClick={onClose}
              className="h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={isConfirming}
              data-testid="confirm-manual-overtime-group-btn"
              onClick={() => void handleSubmit()}
              className="h-9 px-4 rounded-xl bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isConfirming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>
                {isPrevDayMode && includeTwoConsecutivePrevDays
                  ? 'Ghi nhận 2 ngày liên tiếp'
                  : 'Xác nhận & Ghi nhận nhóm'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualOvertimeGroupModal;
