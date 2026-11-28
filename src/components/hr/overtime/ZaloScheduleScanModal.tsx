import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  FileEdit,
  Loader2,
  Search,
  Sparkles,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import { Employee } from '../../../types/hr';
import {
  buildOnLeaveEmployeeMapForDate,
  fetchActiveLeaveRecordsForOvertimeCheck,
  findExactGlossaryMatch,
  getLeaveTypeShortLabel,
  getLocalTodayIsoDate,
  normalizeOvertimeGroupKey,
  OvertimeGlossaryEntry,
  OvertimeLeaveCheckEntry,
  shiftIsoDateDays,
} from '../../../services/hrService';
import {
  parseOvertimeScheduleImage,
  readImageFileForOvertimeScan,
} from '../../../services/overtimeImageService';
import {
  prepareAllScannedOvertimeBlocks,
  PreparedScannedOvertimeBlock,
} from '../../../utils/overtimeImageImportLogic';
import {
  normalize24hTime,
  sanitize24hTimeInput,
} from '../../../utils/workScheduleLogic';
import { filterEmployeesByQuery } from '../../../utils/overtimeFormsService';
import { OvertimeTaskBlock } from './CreateOvertimeForm';

export interface OvertimeModalPresetContext {
  presetType: 'prev_day' | 'production_duty' | 'group' | 'custom';
  targetGroupName?: string;
  label?: string;
}

export interface ModalOvertimeBlockDraft {
  id: string;
  overtimeDate: string;
  startTime: string;
  endTime: string;
  reasonVi: string;
  reasonKr: string;
  isKrManuallyEdited: boolean;
  selectedEmployeeIds: string[];
  aiDetectedEmployeeIds: string[];
  customTimes: Record<string, { startTime: string; endTime: string }>;
  customReasons: Record<string, { reasonVi: string; reasonKr: string }>;
  unmatchedNames: string[];
  excludedOnLeaveNames: string[];
  excludedAlreadyRecordedNames: string[];
}

export interface ConfirmableOvertimeBlockPayload {
  overtimeDate: string;
  startTime: string;
  endTime: string;
  reasonVi: string;
  reasonKr: string;
  selectedEmployeeIds: string[];
  customTimes: Record<string, { startTime: string; endTime: string }>;
  customReasons?: Record<string, { reasonVi: string; reasonKr: string }>;
}

export interface ZaloScheduleScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  glossaryEntries: OvertimeGlossaryEntry[];
  leaveRecords: OvertimeLeaveCheckEntry[];
  existingPreviewBlocks: OvertimeTaskBlock[];
  defaultDate: string;
  presetContext?: OvertimeModalPresetContext | null;
  translateMultilineKorean: (
    reasonVi: string,
    glossaryEntries: OvertimeGlossaryEntry[]
  ) => Promise<string>;
  onLeaveRecordsRefreshed?: (records: OvertimeLeaveCheckEntry[]) => void;
  onParseScheduleImage?: typeof parseOvertimeScheduleImage;
  onConfirmBlock: (payload: ConfirmableOvertimeBlockPayload) => Promise<void>;
  onConfirmAllBlocks?: (payloads: ConfirmableOvertimeBlockPayload[]) => Promise<void>;
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

function createEmptyModalDraft(
  defaultDate: string,
  presetContext?: OvertimeModalPresetContext | null
): ModalOvertimeBlockDraft {
  const baseDate = defaultDate || getLocalTodayIsoDate();
  const initialDate =
    presetContext?.presetType === 'prev_day'
      ? shiftIsoDateDays(baseDate, -1)
      : baseDate;
  const isProdDuty = presetContext?.presetType === 'production_duty';

  return {
    id: `modal-block-${Date.now()}`,
    overtimeDate: initialDate,
    startTime: '16:10',
    endTime: '18:10',
    reasonVi: isProdDuty ? 'Trực sản xuất' : '',
    reasonKr: isProdDuty ? '생산 당직' : '',
    isKrManuallyEdited: false,
    selectedEmployeeIds: [],
    aiDetectedEmployeeIds: [],
    customTimes: {},
    customReasons: {},
    unmatchedNames: [],
    excludedOnLeaveNames: [],
    excludedAlreadyRecordedNames: [],
  };
}

function mapPreparedToModalDraft(
  block: PreparedScannedOvertimeBlock,
  idx: number
): ModalOvertimeBlockDraft {
  return {
    id: `modal-block-${Date.now()}-${idx}`,
    overtimeDate: block.overtimeDate,
    startTime: block.startTime,
    endTime: block.endTime,
    reasonVi: block.reasonVi,
    reasonKr: block.reasonKr,
    isKrManuallyEdited: !block.usedGlossary && Boolean(block.reasonKr.trim()),
    selectedEmployeeIds: [...block.selectedEmployeeIds],
    aiDetectedEmployeeIds: [...block.selectedEmployeeIds],
    customTimes: { ...block.customTimes },
    customReasons: {},
    unmatchedNames: [...block.unmatchedNames],
    excludedOnLeaveNames: [...block.excludedOnLeaveNames],
    excludedAlreadyRecordedNames: [...block.excludedAlreadyRecordedNames],
  };
}

export const ZaloScheduleScanModal: React.FC<ZaloScheduleScanModalProps> = ({
  isOpen,
  onClose,
  employees,
  glossaryEntries,
  leaveRecords,
  existingPreviewBlocks,
  defaultDate,
  presetContext = null,
  translateMultilineKorean,
  onLeaveRecordsRefreshed,
  onParseScheduleImage,
  onConfirmBlock,
  onConfirmAllBlocks,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [blocks, setBlocks] = useState<ModalOvertimeBlockDraft[]>(() => [
    createEmptyModalDraft(defaultDate, presetContext),
  ]);
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [hasScannedResult, setHasScannedResult] = useState(false);

  const [editingTimeEmpId, setEditingTimeEmpId] = useState<string | null>(null);
  const [editingReasonEmpId, setEditingReasonEmpId] = useState<string | null>(null);
  const [translatingCustomEmpId, setTranslatingCustomEmpId] = useState<string | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

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

  // Reset modal state cleanly every time it opens
  useEffect(() => {
    if (!isOpen) return;
    setIsDragOver(false);
    setIsScanning(false);
    setIsConfirming(false);
    setIsTranslating(false);
    setPreviewImageUrl(null);
    setIsImageZoomed(false);
    setErrorMessage(null);
    setBlocks([createEmptyModalDraft(defaultDate, presetContext)]);
    setActiveBlockIdx(0);
    setHasScannedResult(false);
    setEditingTimeEmpId(null);
    setEditingReasonEmpId(null);
    setTranslatingCustomEmpId(null);
    setEmployeeSearchQuery('');
  }, [isOpen, defaultDate, presetContext]);

  useEffect(() => {
    setEmployeeSearchQuery('');
  }, [activeBlockIdx]);

  const activeBlock = blocks[activeBlockIdx] || blocks[0];

  const getAlreadyRecordedIdsForDate = (isoDate: string): Set<string> => {
    const set = new Set<string>();
    for (const b of existingPreviewBlocks) {
      if ((b.overtimeDate || '') === isoDate) {
        for (const p of b.participants || []) {
          if (p.employeeId) set.add(p.employeeId);
        }
        for (const id of b.selectedEmployeeIds || []) {
          if (id) set.add(id);
        }
      }
    }
    return set;
  };

  const onLeaveMapForActiveDate = useMemo(
    () =>
      buildOnLeaveEmployeeMapForDate(
        activeBlock?.overtimeDate || defaultDate,
        leaveRecords,
        employees
      ),
    [activeBlock?.overtimeDate, defaultDate, leaveRecords, employees]
  );

  const alreadyRecordedForActiveDate = useMemo(() => {
    const set = new Set<string>();
    const targetDate = activeBlock?.overtimeDate || defaultDate;
    for (const b of existingPreviewBlocks) {
      if ((b.overtimeDate || '') === targetDate) {
        for (const p of b.participants || []) {
          if (p.employeeId) set.add(p.employeeId);
        }
        for (const id of b.selectedEmployeeIds || []) {
          if (id) set.add(id);
        }
      }
    }
    return set;
  }, [existingPreviewBlocks, activeBlock?.overtimeDate, defaultDate]);

  // Employees visible in the multi-column grid:
  // - If preset is a specific group, show all group members + any AI-detected employees
  // - Otherwise show all company employees
  // - AI-detected employees are pinned to the top without shifting when user manually clicks cards
  const gridEmployees = useMemo(() => {
    const targetGroupKey =
      presetContext?.presetType === 'group' && presetContext.targetGroupName
        ? normalizeOvertimeGroupKey(presetContext.targetGroupName)
        : '';

    const aiSet = new Set(activeBlock?.aiDetectedEmployeeIds || []);
    const selectedSet = new Set(activeBlock?.selectedEmployeeIds || []);

    const scoped = targetGroupKey
      ? employees.filter(
          (emp) =>
            normalizeOvertimeGroupKey(emp.department) === targetGroupKey ||
            aiSet.has(emp.id) ||
            selectedSet.has(emp.id)
        )
      : employees;

    if (aiSet.size === 0) return scoped;

    const aiOrder = new Map<string, number>();
    (activeBlock?.aiDetectedEmployeeIds || []).forEach((id, idx) =>
      aiOrder.set(id, idx)
    );

    const detected: Employee[] = [];
    const others: Employee[] = [];
    for (const emp of scoped) {
      if (aiSet.has(emp.id)) {
        detected.push(emp);
      } else {
        others.push(emp);
      }
    }
    detected.sort((a, b) => (aiOrder.get(a.id) ?? 0) - (aiOrder.get(b.id) ?? 0));
    return [...detected, ...others];
  }, [
    employees,
    presetContext?.presetType,
    presetContext?.targetGroupName,
    activeBlock?.aiDetectedEmployeeIds,
    activeBlock?.selectedEmployeeIds,
  ]);

  const selectableGridEmployees = useMemo(
    () =>
      gridEmployees.filter(
        (e) =>
          !onLeaveMapForActiveDate.has(e.id) &&
          !alreadyRecordedForActiveDate.has(e.id)
      ),
    [gridEmployees, onLeaveMapForActiveDate, alreadyRecordedForActiveDate]
  );

  const displayedEmployees = useMemo(
    () => filterEmployeesByQuery(gridEmployees, employeeSearchQuery),
    [gridEmployees, employeeSearchQuery]
  );

  const selectableDisplayedEmployees = useMemo(
    () =>
      displayedEmployees.filter(
        (e) =>
          !onLeaveMapForActiveDate.has(e.id) &&
          !alreadyRecordedForActiveDate.has(e.id)
      ),
    [displayedEmployees, onLeaveMapForActiveDate, alreadyRecordedForActiveDate]
  );

  const updateActiveBlock = (
    updater: (prev: ModalOvertimeBlockDraft) => ModalOvertimeBlockDraft
  ) => {
    setBlocks((prev) =>
      prev.map((item, idx) => (idx === activeBlockIdx ? updater(item) : item))
    );
  };

  // Auto-translate Tiếng Việt -> Tiếng Hàn inside Modal when user edits reasonVi
  useEffect(() => {
    if (!isOpen || !activeBlock) return;
    if (activeBlock.isKrManuallyEdited) {
      setIsTranslating(false);
      return;
    }
    const cleanVi = activeBlock.reasonVi.trim();
    if (!cleanVi) {
      setIsTranslating(false);
      return;
    }
    const exact = findExactGlossaryMatch(glossaryEntries, cleanVi);
    if (exact) {
      setIsTranslating(false);
      if (activeBlock.reasonKr !== exact.reasonKr) {
        const blockId = activeBlock.id;
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, reasonKr: exact.reasonKr } : b))
        );
      }
      return;
    }

    let cancelled = false;
    const blockId = activeBlock.id;
    const sourceVi = activeBlock.reasonVi;
    setIsTranslating(true);
    const timer = window.setTimeout(async () => {
      try {
        const translated = await translateMultilineKorean(sourceVi, glossaryEntries);
        if (!cancelled) {
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === blockId && !b.isKrManuallyEdited && b.reasonVi === sourceVi
                ? { ...b, reasonKr: translated }
                : b
            )
          );
        }
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isOpen,
    activeBlock?.id,
    activeBlock?.reasonVi,
    activeBlock?.isKrManuallyEdited,
    glossaryEntries,
    translateMultilineKorean,
  ]);

  const handleProcessImageFile = async (file: File | Blob) => {
    if (isScanning) return;
    setErrorMessage(null);

    let readResult;
    try {
      readResult = await readImageFileForOvertimeScan(file);
    } catch (readErr) {
      setErrorMessage(
        readErr instanceof Error && readErr.message
          ? readErr.message
          : 'Không thể đọc tệp hình ảnh.'
      );
      return;
    }

    setPreviewImageUrl(readResult.previewDataUrl);
    setIsScanning(true);

    try {
      const targetDate = activeBlock?.overtimeDate || defaultDate || getLocalTodayIsoDate();
      const analyzeImage = onParseScheduleImage || parseOvertimeScheduleImage;
      const [parsedResult, leaveCheck] = await Promise.all([
        analyzeImage({
          imageBase64: readResult.imageBase64,
          mimeType: readResult.mimeType,
          employees,
          defaultDate: targetDate,
        }),
        fetchActiveLeaveRecordsForOvertimeCheck(employees).catch(() => null),
      ]);

      const latestLeaves =
        leaveCheck && leaveCheck.source === 'supabase' ? leaveCheck.records : leaveRecords;
      if (leaveCheck && leaveCheck.source === 'supabase') {
        onLeaveRecordsRefreshed?.(leaveCheck.records);
      }

      const prepared = prepareAllScannedOvertimeBlocks({
        blocks: parsedResult.blocks,
        employees,
        glossaryEntries,
        leaveRecords: latestLeaves,
        alreadyRecordedIdsByDate: getAlreadyRecordedIdsForDate,
        defaultDate: targetDate,
        defaultStartTime: '16:10',
        defaultEndTime: '18:10',
      });

      if (prepared.length === 0) {
        setErrorMessage(
          'Không trích xuất được nhóm tăng ca hợp lệ nào từ ảnh (hoặc các nhân sự đều thuộc ca hành chính / đang nghỉ).'
        );
        return;
      }

      setBlocks(prepared.map(mapPreparedToModalDraft));
      setActiveBlockIdx(0);
      setHasScannedResult(true);
      setEditingTimeEmpId(null);
      setEditingReasonEmpId(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'Không thể phân tích ảnh lịch tăng ca.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const processImageRef = useRef(handleProcessImageFile);
  processImageRef.current = handleProcessImageFile;

  // Listen to paste ONLY while Modal is open
  useEffect(() => {
    if (!isOpen) return;

    const onModalPaste = (event: ClipboardEvent) => {
      if (isScanning) return;
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      let imageFile: File | null = null;
      const items = Array.from(clipboardData.items || []);
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            imageFile = f;
            break;
          }
        }
      }

      if (!imageFile && clipboardData.files) {
        imageFile =
          Array.from(clipboardData.files).find((f) => f.type.startsWith('image/')) || null;
      }

      if (!imageFile) return;
      event.preventDefault();
      void processImageRef.current(imageFile);
    };

    window.addEventListener('paste', onModalPaste);
    return () => window.removeEventListener('paste', onModalPaste);
  }, [isOpen, isScanning]);

  const handleDateChange = (nextDate: string) => {
    const nextLeaveMap = buildOnLeaveEmployeeMapForDate(
      nextDate,
      leaveRecords,
      employees
    );
    const nextAlreadyIds = getAlreadyRecordedIdsForDate(nextDate);

    updateActiveBlock((prev) => {
      const validIds: string[] = [];
      const newExcludedLeave: string[] = [];
      const newExcludedDup: string[] = [];
      for (const id of prev.selectedEmployeeIds) {
        const empName = employeeMap.get(id)?.fullName || id;
        if (nextLeaveMap.has(id)) {
          newExcludedLeave.push(empName);
        } else if (nextAlreadyIds.has(id)) {
          newExcludedDup.push(empName);
        } else {
          validIds.push(id);
        }
      }
      const nextCustom = { ...prev.customTimes };
      const nextCustomReasons = { ...prev.customReasons };
      for (const id of prev.selectedEmployeeIds) {
        if (!validIds.includes(id)) {
          delete nextCustom[id];
          delete nextCustomReasons[id];
        }
      }
      return {
        ...prev,
        overtimeDate: nextDate,
        selectedEmployeeIds: validIds,
        customTimes: nextCustom,
        customReasons: nextCustomReasons,
        excludedOnLeaveNames: newExcludedLeave.length > 0 ? newExcludedLeave : prev.excludedOnLeaveNames,
        excludedAlreadyRecordedNames: newExcludedDup.length > 0 ? newExcludedDup : prev.excludedAlreadyRecordedNames,
      };
    });
  };

  const handleToggleParticipant = (empId: string) => {
    if (onLeaveMapForActiveDate.has(empId) || alreadyRecordedForActiveDate.has(empId)) {
      return;
    }
    updateActiveBlock((prev) => {
      const exists = prev.selectedEmployeeIds.includes(empId);
      if (exists) {
        const nextCustom = { ...prev.customTimes };
        delete nextCustom[empId];
        const nextCustomReasons = { ...prev.customReasons };
        delete nextCustomReasons[empId];
        if (editingTimeEmpId === empId) setEditingTimeEmpId(null);
        if (editingReasonEmpId === empId) setEditingReasonEmpId(null);
        return {
          ...prev,
          selectedEmployeeIds: prev.selectedEmployeeIds.filter((id) => id !== empId),
          customTimes: nextCustom,
          customReasons: nextCustomReasons,
        };
      }
      return {
        ...prev,
        selectedEmployeeIds: [...prev.selectedEmployeeIds, empId],
      };
    });
  };

  const areAllSelectableSelected =
    Boolean(activeBlock) &&
    selectableDisplayedEmployees.length > 0 &&
    selectableDisplayedEmployees.every((e) =>
      activeBlock.selectedEmployeeIds.includes(e.id)
    );

  const handleSelectAllGrid = () => {
    const visibleIds = selectableDisplayedEmployees.map((e) => e.id);
    if (areAllSelectableSelected) {
      updateActiveBlock((prev) => ({
        ...prev,
        selectedEmployeeIds: prev.selectedEmployeeIds.filter(
          (id) => !visibleIds.includes(id)
        ),
      }));
    } else {
      updateActiveBlock((prev) => ({
        ...prev,
        selectedEmployeeIds: Array.from(
          new Set([...prev.selectedEmployeeIds, ...visibleIds])
        ),
      }));
    }
  };

  const handleClearAllGrid = () => {
    setEditingTimeEmpId(null);
    setEditingReasonEmpId(null);
    updateActiveBlock((prev) => ({
      ...prev,
      selectedEmployeeIds: [],
      customTimes: {},
      customReasons: {},
    }));
  };

  const handleUpdateParticipantCustomReason = (
    empId: string,
    field: 'reasonVi' | 'reasonKr',
    value: string
  ) => {
    updateActiveBlock((prev) => {
      const existing = prev.customReasons[empId] || {
        reasonVi: '',
        reasonKr: '',
      };
      const nextEntry = {
        ...existing,
        [field]: value,
      };
      const nextMap = { ...prev.customReasons };
      nextMap[empId] = nextEntry;
      return { ...prev, customReasons: nextMap };
    });
  };

  const handleClearParticipantCustomReason = (empId: string) => {
    updateActiveBlock((prev) => {
      const nextMap = { ...prev.customReasons };
      delete nextMap[empId];
      return { ...prev, customReasons: nextMap };
    });
    if (editingReasonEmpId === empId) {
      setEditingReasonEmpId(null);
    }
  };

  const handleTranslateParticipantCustomReason = async (empId: string) => {
    const customVi = (activeBlock?.customReasons[empId]?.reasonVi || '').trim();
    if (!customVi) return;
    setTranslatingCustomEmpId(empId);
    try {
      const translated = await translateMultilineKorean(customVi, glossaryEntries);
      updateActiveBlock((prev) => ({
        ...prev,
        customReasons: {
          ...prev.customReasons,
          [empId]: {
            reasonVi: prev.customReasons[empId]?.reasonVi || customVi,
            reasonKr: translated,
          },
        },
      }));
    } finally {
      setTranslatingCustomEmpId((prev) => (prev === empId ? null : prev));
    }
  };

  const handleUpdateParticipantTime = (
    empId: string,
    field: 'startTime' | 'endTime',
    value: string,
    shouldNormalize = false
  ) => {
    updateActiveBlock((prev) => {
      const currentStart = prev.customTimes[empId]?.startTime ?? prev.startTime;
      const currentEnd = prev.customTimes[empId]?.endTime ?? prev.endTime;
      const rawNextStart =
        field === 'startTime'
          ? shouldNormalize
            ? normalize24hTime(value, prev.startTime)
            : sanitize24hTimeInput(value)
          : currentStart;
      const rawNextEnd =
        field === 'endTime'
          ? shouldNormalize
            ? normalize24hTime(value, prev.endTime)
            : sanitize24hTimeInput(value)
          : currentEnd;

      const nextCustom = { ...prev.customTimes };
      if (rawNextStart === prev.startTime && rawNextEnd === prev.endTime) {
        delete nextCustom[empId];
      } else {
        nextCustom[empId] = { startTime: rawNextStart, endTime: rawNextEnd };
      }
      return { ...prev, customTimes: nextCustom };
    });
  };

  const handleRetranslateKr = async () => {
    if (!activeBlock || !activeBlock.reasonVi.trim()) return;
    setIsTranslating(true);
    try {
      const translated = await translateMultilineKorean(
        activeBlock.reasonVi,
        glossaryEntries
      );
      updateActiveBlock((prev) => ({
        ...prev,
        reasonKr: translated,
        isKrManuallyEdited: false,
      }));
    } finally {
      setIsTranslating(false);
    }
  };

  const validateAndBuildPayload = async (
    draft: ModalOvertimeBlockDraft
  ): Promise<ConfirmableOvertimeBlockPayload | null> => {
    if (draft.selectedEmployeeIds.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 nhân sự trước khi ghi nhận.');
      return null;
    }
    if (!draft.reasonVi.trim()) {
      setErrorMessage('Vui lòng nhập Lý do (Tiếng Việt) trước khi ghi nhận.');
      return null;
    }
    const normStart = normalize24hTime(draft.startTime, '16:10');
    const normEnd = normalize24hTime(draft.endTime, '18:10');
    const cleanReasonVi = draft.reasonVi.trim();
    const finalKr = draft.reasonKr.trim()
      ? draft.reasonKr.trim()
      : await translateMultilineKorean(cleanReasonVi, glossaryEntries);

    const normalizedCustomTimes: Record<string, { startTime: string; endTime: string }> = {};
    const normalizedCustomReasons: Record<string, { reasonVi: string; reasonKr: string }> = {};
    for (const empId of draft.selectedEmployeeIds) {
      const c = draft.customTimes[empId];
      if (c) {
        const pStart = normalize24hTime(c.startTime, normStart);
        const pEnd = normalize24hTime(c.endTime, normEnd);
        if (pStart !== normStart || pEnd !== normEnd) {
          normalizedCustomTimes[empId] = { startTime: pStart, endTime: pEnd };
        }
      }

      const r = draft.customReasons[empId];
      if (r) {
        const rVi = (r.reasonVi || '').trim();
        let rKr = (r.reasonKr || '').trim();
        if (rVi && !rKr) {
          rKr = (await translateMultilineKorean(rVi, glossaryEntries)).trim();
        }
        if ((rVi || rKr) && (rVi !== cleanReasonVi || (rKr && rKr !== finalKr))) {
          normalizedCustomReasons[empId] = {
            reasonVi: rVi || cleanReasonVi,
            reasonKr: rKr,
          };
        }
      }
    }

    return {
      overtimeDate: draft.overtimeDate || defaultDate || getLocalTodayIsoDate(),
      startTime: normStart,
      endTime: normEnd,
      reasonVi: cleanReasonVi,
      reasonKr: finalKr,
      selectedEmployeeIds: [...draft.selectedEmployeeIds],
      customTimes: normalizedCustomTimes,
      customReasons: normalizedCustomReasons,
    };
  };

  const handleConfirmSingle = async () => {
    if (!activeBlock || isConfirming) return;
    setErrorMessage(null);
    setIsConfirming(true);
    try {
      const payload = await validateAndBuildPayload(activeBlock);
      if (!payload) return;
      await onConfirmBlock(payload);
    } catch (err) {
      setErrorMessage(
        err instanceof Error && err.message ? err.message : 'Lỗi khi ghi nhận nhóm tăng ca.'
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleConfirmAll = async () => {
    if (!onConfirmAllBlocks || isConfirming) return;
    setErrorMessage(null);
    setIsConfirming(true);
    try {
      const payloads: ConfirmableOvertimeBlockPayload[] = [];
      for (const b of blocks) {
        const p = await validateAndBuildPayload(b);
        if (!p) return;
        payloads.push(p);
      }
      await onConfirmAllBlocks(payloads);
    } catch (err) {
      setErrorMessage(
        err instanceof Error && err.message ? err.message : 'Lỗi khi ghi nhận các nhóm tăng ca.'
      );
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen || !activeBlock) return null;

  const leaveCount = gridEmployees.filter((e) =>
    onLeaveMapForActiveDate.has(e.id)
  ).length;
  const dupCount = gridEmployees.filter(
    (e) =>
      !onLeaveMapForActiveDate.has(e.id) &&
      alreadyRecordedForActiveDate.has(e.id)
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[1px] flex items-center justify-center p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirming) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zalo-scan-modal-title"
        data-testid="zalo-scan-modal"
        className="max-w-5xl w-[95vw] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* HEADER */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2.5 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-[#14539E] flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3
                id="zalo-scan-modal-title"
                className="text-sm font-bold text-slate-900 truncate"
              >
                {presetContext?.label
                  ? `Quét ảnh Zalo AI: ${presetContext.label} • Ngày ${formatIsoToDDMMYYYY(
                      baseShellDate
                    )}`
                  : `Quét ảnh lịch tăng ca từ Zalo (AI) • Ngày ${formatIsoToDDMMYYYY(
                      baseShellDate
                    )}`}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {isPrevDayMode ? (
                  <>
                    Dán ảnh{' '}
                    <kbd className="px-1 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">
                      Ctrl + V
                    </kbd>{' '}
                    để ghi nhận phát sinh ngày{' '}
                    <strong className="font-mono text-[#14539E]">
                      {formatIsoToDDMMYYYY(activeBlock.overtimeDate)}
                    </strong>{' '}
                    vào phiếu{' '}
                    <strong className="font-mono text-slate-700">
                      {formatIsoToDDMMYYYY(baseShellDate)}
                    </strong>
                  </>
                ) : (
                  <>
                    Nhấn{' '}
                    <kbd className="px-1 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">
                      Ctrl + V
                    </kbd>{' '}
                    để dán ảnh trực tiếp, kiểm tra và xác nhận ghi nhận vào phiếu ngày{' '}
                    <strong className="font-mono text-[#14539E]">
                      {formatIsoToDDMMYYYY(activeBlock.overtimeDate)}
                    </strong>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Đóng cửa sổ quét ảnh"
            disabled={isConfirming}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer transition-colors disabled:opacity-40 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY: BỐ CỤC 2 CỘT (TRÁI 5/12 ẢNH + GIỜ + LÝ DO | PHẢI 7/12 LIST DỌC KHÔNG CUỘN) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* KHỐI TRÁI (5/12): NGÀY PHÁT SINH (NẾU CÓ) + DÁN ẢNH ZALO + GIỜ CHUNG + LÝ DO */}
            <div className="lg:col-span-5 space-y-3.5">
              {isPrevDayMode && (
                <div
                  data-testid="zalo-prev-day-bar"
                  className="flex flex-wrap items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-2.5 py-2 text-[11px]"
                >
                  {[
                    { label: 'Hôm qua', tag: 'D-1', date: prevDayD1 },
                    { label: 'Hôm kia', tag: 'D-2', date: prevDayD2 },
                  ].map((opt) => (
                    <button
                      key={opt.tag}
                      type="button"
                      data-testid={`zalo-prev-${opt.tag.toLowerCase()}-btn`}
                      onClick={() => handleDateChange(opt.date)}
                      className={`px-2.5 py-1 rounded-lg font-mono font-semibold border cursor-pointer transition-colors ${
                        activeBlock.overtimeDate === opt.date
                          ? 'bg-[#14539E] text-white border-[#14539E]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#14539E]'
                      }`}
                    >
                      {opt.label} ({formatIsoToDDMM(opt.date)})
                    </button>
                  ))}
                </div>
              )}

              {/* VÙNG DÁN ẢNH ZALO + CẢNH BÁO */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  data-testid="zalo-modal-file-input"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleProcessImageFile(file);
                    e.target.value = '';
                  }}
                />

                <div
                  data-testid="zalo-modal-dropzone"
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isScanning) setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (isScanning) return;
                    const f = Array.from(e.dataTransfer.files || []).find((file) =>
                      file.type.startsWith('image/')
                    );
                    if (f) void handleProcessImageFile(f);
                  }}
                  className={`rounded-xl border-2 border-dashed p-3 text-center transition-colors ${
                    isDragOver
                      ? 'border-[#14539E] bg-blue-50/80'
                      : 'border-slate-300 bg-slate-50/70 hover:border-[#14539E]/50'
                  }`}
                >
                  {previewImageUrl ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setIsImageZoomed(true)}
                        className="relative group block w-full rounded-lg overflow-hidden border border-slate-200 bg-white cursor-zoom-in"
                        title="Bấm để phóng to ảnh"
                      >
                        <img
                          src={previewImageUrl}
                          alt="Ảnh lịch tăng ca Zalo"
                          className="w-full max-h-40 object-contain mx-auto bg-white"
                        />
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[10px] inline-flex items-center gap-1 opacity-90 group-hover:opacity-100">
                          <ZoomIn className="w-3 h-3" />
                          <span>Phóng to</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={isScanning}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Dán Ctrl+V hoặc chọn ảnh khác</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 flex flex-col items-center justify-center gap-1.5 text-slate-600 hover:text-[#14539E] cursor-pointer"
                    >
                      <span className="w-9 h-9 rounded-full bg-blue-50 text-[#14539E] flex items-center justify-center border border-blue-200">
                        <Upload className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        Dán ảnh (Ctrl + V) tại đây
                      </span>
                      <span className="text-[11px] text-slate-500 leading-snug">
                        Hoặc kéo thả / bấm để chọn file ảnh chụp Zalo
                      </span>
                    </button>
                  )}
                </div>

                {isScanning && (
                  <div
                    role="status"
                    data-testid="zalo-modal-scanning-status"
                    className="rounded-xl border border-blue-200 bg-blue-50/90 px-3 py-2 text-xs text-[#14539E] font-semibold flex items-center gap-2"
                  >
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>AI đang đọc ảnh &amp; đối chiếu nhân sự...</span>
                  </div>
                )}

                {errorMessage && (
                  <div
                    role="alert"
                    data-testid="zalo-modal-error"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="break-words leading-snug">{errorMessage}</span>
                  </div>
                )}

                {activeBlock.excludedOnLeaveNames.length > 0 && (
                  <div
                    data-testid="zalo-modal-onleave-warning"
                    className="rounded-xl border border-rose-200 bg-rose-50/80 px-2.5 py-2 text-[11px] text-rose-800 space-y-0.5"
                  >
                    <div className="font-bold">
                      Đã bỏ qua {activeBlock.excludedOnLeaveNames.length} người đang nghỉ:
                    </div>
                    <div className="leading-snug">
                      {activeBlock.excludedOnLeaveNames.join(', ')}
                    </div>
                  </div>
                )}

                {activeBlock.excludedAlreadyRecordedNames.length > 0 && (
                  <div
                    data-testid="zalo-modal-duplicate-warning"
                    className="rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-[11px] text-amber-900 space-y-0.5"
                  >
                    <div className="font-bold">
                      Đã có lịch trong phiếu ({activeBlock.excludedAlreadyRecordedNames.length}):
                    </div>
                    <div className="leading-snug">
                      {activeBlock.excludedAlreadyRecordedNames.join(', ')}
                    </div>
                  </div>
                )}

                {activeBlock.unmatchedNames.length > 0 && (
                  <div
                    data-testid="zalo-modal-unmatched-warning"
                    className="rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-[11px] text-amber-900 space-y-0.5"
                  >
                    <div className="font-bold">
                      Chưa khớp tên trong DS ({activeBlock.unmatchedNames.length}):
                    </div>
                    <div className="leading-snug">
                      {activeBlock.unmatchedNames.join(', ')}
                    </div>
                  </div>
                )}
              </div>

              {blocks.length > 1 && (
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="tablist"
                  aria-label="Các nhóm tăng ca nhận diện từ ảnh"
                >
                  {blocks.map((b, idx) => (
                    <button
                      key={b.id}
                      type="button"
                      role="tab"
                      aria-selected={idx === activeBlockIdx}
                      data-testid={`zalo-modal-group-tab-${idx}`}
                      onClick={() => setActiveBlockIdx(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        idx === activeBlockIdx
                          ? 'bg-[#14539E] text-white border-[#14539E]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Nhóm #{idx + 1} ({b.selectedEmployeeIds.length} người)
                    </button>
                  ))}
                </div>
              )}

              {/* GIỜ BẮT ĐẦU & GIỜ KẾT THÚC (CHUNG) */}
              <div className="space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="zalo-modal-start"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Giờ bắt đầu (chung)
                    </label>
                    <div className="relative">
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="zalo-modal-start"
                        type="text"
                        maxLength={5}
                        value={activeBlock.startTime}
                        onChange={(e) =>
                          updateActiveBlock((prev) => ({
                            ...prev,
                            startTime: sanitize24hTimeInput(e.target.value),
                          }))
                        }
                        onBlur={() =>
                          updateActiveBlock((prev) => ({
                            ...prev,
                            startTime: normalize24hTime(prev.startTime, '16:10'),
                          }))
                        }
                        className="w-full h-9 pl-8 pr-2.5 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="zalo-modal-end"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Giờ kết thúc (chung)
                    </label>
                    <div className="relative">
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="zalo-modal-end"
                        type="text"
                        maxLength={5}
                        value={activeBlock.endTime}
                        onChange={(e) =>
                          updateActiveBlock((prev) => ({
                            ...prev,
                            endTime: sanitize24hTimeInput(e.target.value),
                          }))
                        }
                        onBlur={() =>
                          updateActiveBlock((prev) => ({
                            ...prev,
                            endTime: normalize24hTime(prev.endTime, '18:10'),
                          }))
                        }
                        className="w-full h-9 pl-8 pr-2.5 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                    Chọn nhanh giờ ra:
                  </span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {QUICK_END_PRESETS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          updateActiveBlock((prev) => ({ ...prev, endTime: t }))
                        }
                        className={`h-7 px-2.5 text-[11px] font-mono font-semibold rounded-lg border transition-colors cursor-pointer ${
                          activeBlock.endTime === t
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

              {/* LÝ DO VIỆT - HÀN XẾP DỌC */}
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                      htmlFor="zalo-modal-reason-vi"
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
                  <textarea
                    id="zalo-modal-reason-vi"
                    data-testid="zalo-modal-reason-vi"
                    rows={3}
                    value={activeBlock.reasonVi}
                    onChange={(e) =>
                      updateActiveBlock((prev) => ({
                        ...prev,
                        reasonVi: e.target.value,
                      }))
                    }
                    placeholder="Nội dung lý do tăng ca (hỗ trợ nhiều dòng)..."
                    className="w-full px-2.5 py-1.5 text-xs leading-snug text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] resize-y"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                      htmlFor="zalo-modal-reason-kr"
                      className="text-[11px] font-semibold text-slate-600"
                    >
                      Lý do (Tiếng Hàn)
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleRetranslateKr()}
                      className="text-[10px] font-medium text-[#14539E] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Dịch gợi ý</span>
                    </button>
                  </div>
                  <textarea
                    id="zalo-modal-reason-kr"
                    data-testid="zalo-modal-reason-kr"
                    rows={3}
                    value={activeBlock.reasonKr}
                    onChange={(e) =>
                      updateActiveBlock((prev) => ({
                        ...prev,
                        reasonKr: e.target.value,
                        isKrManuallyEdited: true,
                      }))
                    }
                    placeholder="Bản dịch tiếng Hàn..."
                    className="w-full px-2.5 py-1.5 text-xs leading-snug text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] resize-y"
                  />
                </div>
              </div>
            </div>

            {/* KHỐI PHẢI (7/12): DANH SÁCH NHÂN SỰ DẠNG LIST DỌC 1 CỘT (MỞ TOÀN BỘ KHÔNG CUỘN) */}
            <div className="lg:col-span-7 space-y-2.5 overflow-visible">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-800">
                    Nhân sự tham gia ({activeBlock.selectedEmployeeIds.length}/
                    {selectableGridEmployees.length} đã chọn)
                  </span>
                  {hasScannedResult && activeBlock.aiDetectedEmployeeIds.length > 0 && (
                    <span className="text-[11px] text-[#14539E] font-medium">
                      • AI khớp {activeBlock.aiDetectedEmployeeIds.length} người
                    </span>
                  )}
                  {leaveCount > 0 && (
                    <span className="text-[11px] text-rose-600 font-medium">
                      • {leaveCount} đang nghỉ
                    </span>
                  )}
                  {dupCount > 0 && (
                    <span className="text-[11px] text-amber-700 font-medium">
                      • {dupCount} đã có lịch
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      data-testid="zalo-emp-search-input"
                      aria-label="Tìm kiếm nhân sự theo tên hoặc mã nhân viên"
                      placeholder="Tìm tên hoặc mã NV..."
                      className="w-44 sm:w-52 h-8 pl-7 pr-6 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                    />
                    {employeeSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setEmployeeSearchQuery('')}
                        data-testid="zalo-emp-search-clear-btn"
                        aria-label="Xóa từ khóa tìm kiếm"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={selectableDisplayedEmployees.length === 0}
                    onClick={handleSelectAllGrid}
                    data-testid="zalo-select-all-btn"
                    className="h-8 px-2.5 rounded-lg border border-[#14539E]/30 bg-blue-50/70 hover:bg-blue-100 text-[#14539E] text-[11px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {areAllSelectableSelected ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                  </button>
                  {!employeeSearchQuery.trim() &&
                    activeBlock.selectedEmployeeIds.length > 0 &&
                    !areAllSelectableSelected && (
                      <button
                        type="button"
                        onClick={handleClearAllGrid}
                        data-testid="zalo-clear-all-btn"
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                      >
                        Bỏ chọn hết
                      </button>
                    )}
                </div>
              </div>

              {gridEmployees.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                  Không có nhân sự nào thuộc nhóm này.
                </div>
              ) : displayedEmployees.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 space-y-1.5">
                  <div>
                    Không tìm thấy nhân sự phù hợp với &ldquo;
                    <strong className="text-slate-700">{employeeSearchQuery.trim()}</strong>
                    &rdquo;.
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmployeeSearchQuery('')}
                    className="text-[11px] font-semibold text-[#14539E] hover:underline cursor-pointer"
                  >
                    Xóa từ khóa tìm kiếm
                  </button>
                </div>
              ) : (
                <div
                  data-testid="zalo-modal-participants-list"
                  className="flex flex-col gap-1.5 overflow-visible"
                >
                  {displayedEmployees.map((emp) => {
                    const leave = onLeaveMapForActiveDate.get(emp.id);
                    const isLeave = Boolean(leave);
                    const isDup = !isLeave && alreadyRecordedForActiveDate.has(emp.id);
                    const isDisabled = isLeave || isDup;
                    const isSelected =
                      !isDisabled && activeBlock.selectedEmployeeIds.includes(emp.id);
                    const isAiDetected = activeBlock.aiDetectedEmployeeIds.includes(
                      emp.id
                    );

                    const isCustomTime = Boolean(activeBlock.customTimes[emp.id]);
                    const empStart =
                      activeBlock.customTimes[emp.id]?.startTime ??
                      activeBlock.startTime;
                    const empEnd =
                      activeBlock.customTimes[emp.id]?.endTime ?? activeBlock.endTime;
                    const isEditingTime = editingTimeEmpId === emp.id;

                    const customReasonEntry = activeBlock.customReasons[emp.id];
                    const hasCustomReason = Boolean(
                      customReasonEntry &&
                        ((customReasonEntry.reasonVi || '').trim() ||
                          (customReasonEntry.reasonKr || '').trim())
                    );
                    const isEditingReason = editingReasonEmpId === emp.id;
                    const entry = customReasonEntry || {
                      reasonVi: '',
                      reasonKr: '',
                    };

                    return (
                      <div
                        key={emp.id}
                        data-testid={`zalo-emp-card-${emp.employeeCode || emp.id}`}
                        data-selected={isSelected ? 'true' : 'false'}
                        className={`w-full rounded-lg border transition-colors ${
                          isDisabled
                            ? 'border-slate-200 bg-slate-50/90 opacity-60'
                            : isSelected
                              ? isCustomTime || hasCustomReason
                                ? 'border-amber-300 bg-amber-50/75 shadow-2xs'
                                : 'border-[#14539E] bg-blue-50/70 shadow-2xs'
                              : 'border-slate-200 bg-white hover:border-[#14539E]/55 hover:bg-blue-50/25'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between gap-2 px-3 py-2">
                          <button
                            type="button"
                            disabled={isDisabled}
                            data-testid={`zalo-emp-option-${emp.employeeCode || emp.id}`}
                            onClick={() => handleToggleParticipant(emp.id)}
                            className={`flex-1 min-w-0 text-left flex items-center gap-2.5 ${
                              isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                isSelected
                                  ? 'bg-[#14539E] border-[#14539E] text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              )}
                            </span>
                            <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span
                                className={`text-xs truncate ${
                                  isSelected
                                    ? 'font-bold text-slate-900'
                                    : 'font-semibold text-slate-700'
                                }`}
                              >
                                {emp.fullName}
                              </span>
                              {isAiDetected && (
                                <span className="text-[9px] px-1 rounded bg-blue-100 text-[#14539E] font-bold shrink-0">
                                  AI
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                {emp.employeeCode}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium shrink-0">
                                {emp.department}
                              </span>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isLeave ? (
                              <span
                                title={getLeaveTypeShortLabel(leave!)}
                                className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold whitespace-nowrap"
                              >
                                Đang nghỉ
                              </span>
                            ) : isDup ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold whitespace-nowrap">
                                Đã có lịch
                              </span>
                            ) : isSelected ? (
                              <>
                                {isEditingTime ? (
                                  <div className="flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded-md border border-[#14539E]">
                                    <input
                                      type="text"
                                      maxLength={5}
                                      aria-label={`Giờ bắt đầu của ${emp.fullName}`}
                                      value={empStart}
                                      onChange={(e) =>
                                        handleUpdateParticipantTime(
                                          emp.id,
                                          'startTime',
                                          e.target.value
                                        )
                                      }
                                      onBlur={(e) =>
                                        handleUpdateParticipantTime(
                                          emp.id,
                                          'startTime',
                                          e.target.value,
                                          true
                                        )
                                      }
                                      className="w-11 h-5 text-[10px] font-mono text-center border border-slate-200 rounded"
                                    />
                                    <span className="text-[10px] text-slate-400">
                                      -
                                    </span>
                                    <input
                                      type="text"
                                      maxLength={5}
                                      aria-label={`Giờ kết thúc của ${emp.fullName}`}
                                      value={empEnd}
                                      onChange={(e) =>
                                        handleUpdateParticipantTime(
                                          emp.id,
                                          'endTime',
                                          e.target.value
                                        )
                                      }
                                      onBlur={(e) =>
                                        handleUpdateParticipantTime(
                                          emp.id,
                                          'endTime',
                                          e.target.value,
                                          true
                                        )
                                      }
                                      className="w-11 h-5 text-[10px] font-mono text-center border border-slate-200 rounded"
                                    />
                                    <button
                                      type="button"
                                      aria-label="Xong chỉnh giờ riêng"
                                      onClick={() => setEditingTimeEmpId(null)}
                                      className="p-0.5 text-emerald-600 cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    title="Bấm để chỉnh giờ riêng cho người này"
                                    onClick={() => setEditingTimeEmpId(emp.id)}
                                    className={`text-[11px] font-mono px-2 py-0.5 rounded-md border cursor-pointer transition-colors whitespace-nowrap ${
                                      isCustomTime
                                        ? 'border-amber-400 bg-amber-100 text-amber-900 font-bold'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-[#14539E] hover:text-[#14539E]'
                                    }`}
                                  >
                                    {empStart} - {empEnd}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  title="Thêm lý do tăng ca riêng cho người này"
                                  aria-label={`Thêm lý do tăng ca riêng cho ${emp.fullName}`}
                                  data-testid={`zalo-custom-reason-btn-${emp.employeeCode || emp.id}`}
                                  onClick={() =>
                                    setEditingReasonEmpId((prev) =>
                                      prev === emp.id ? null : emp.id
                                    )
                                  }
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                                    hasCustomReason || isEditingReason
                                      ? 'border-amber-400 bg-amber-100 text-amber-800'
                                      : 'border-slate-200 bg-white text-slate-500 hover:text-[#14539E] hover:border-[#14539E]'
                                  }`}
                                >
                                  <FileEdit className="w-3 h-3" />
                                  {hasCustomReason && <span>Riêng</span>}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {isSelected && isEditingReason && (
                          <div
                            data-testid="zalo-custom-reason-editor"
                            className="px-3 pb-2.5 pt-2 border-t border-amber-200/80 bg-amber-50/55 space-y-1.5 rounded-b-lg"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-amber-900">
                                Lý do riêng (đẩy xuống cuối nhóm &amp; tách ô riêng)
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={translatingCustomEmpId === emp.id}
                                  onClick={() =>
                                    void handleTranslateParticipantCustomReason(
                                      emp.id
                                    )
                                  }
                                  className="text-[10px] font-semibold text-[#14539E] hover:underline inline-flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                                >
                                  {translatingCustomEmpId === emp.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3" />
                                  )}
                                  <span>Dịch gợi ý</span>
                                </button>
                                {hasCustomReason && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleClearParticipantCustomReason(emp.id)
                                    }
                                    className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                  >
                                    Xóa
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
                                data-testid={`zalo-custom-reason-vi-${emp.employeeCode || emp.id}`}
                                value={entry.reasonVi}
                                onChange={(e) =>
                                  handleUpdateParticipantCustomReason(
                                    emp.id,
                                    'reasonVi',
                                    e.target.value
                                  )
                                }
                                placeholder="Lý do riêng (Tiếng Việt)..."
                                className="w-full h-7 px-2 text-[11px] rounded-md border border-amber-300 bg-white focus:outline-none focus:border-[#14539E]"
                              />
                              <input
                                type="text"
                                data-testid={`zalo-custom-reason-kr-${emp.employeeCode || emp.id}`}
                                value={entry.reasonKr}
                                onChange={(e) =>
                                  handleUpdateParticipantCustomReason(
                                    emp.id,
                                    'reasonKr',
                                    e.target.value
                                  )
                                }
                                placeholder="Lý do riêng (Tiếng Hàn)..."
                                className="w-full h-7 px-2 text-[11px] rounded-md border border-amber-300 bg-white focus:outline-none focus:border-[#14539E]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-600">
            Đã chọn{' '}
            <strong className="text-[#14539E] tabular-nums">
              {activeBlock.selectedEmployeeIds.length}
            </strong>{' '}
            nhân sự
            {blocks.length > 1 ? ` • Nhóm ${activeBlockIdx + 1}/${blocks.length}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isConfirming}
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Đóng
            </button>

            {blocks.length > 1 && onConfirmAllBlocks && (
              <button
                type="button"
                disabled={isScanning || isConfirming}
                data-testid="confirm-all-zalo-scan-blocks-btn"
                onClick={() => void handleConfirmAll()}
                className="h-9 px-3.5 rounded-xl border border-[#14539E] bg-blue-50 hover:bg-blue-100 text-[#14539E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Ghi nhận tất cả ({blocks.length} nhóm)</span>
              </button>
            )}

            <button
              type="button"
              disabled={isScanning || isConfirming}
              data-testid="confirm-zalo-scan-block-btn"
              onClick={() => void handleConfirmSingle()}
              className="h-9 px-5 rounded-xl bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isConfirming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>Xác nhận &amp; Ghi nhận nhóm</span>
            </button>
          </div>
        </div>
      </div>

      {/* LIGHTBOX PHÓNG TO ẢNH */}
      {isImageZoomed && previewImageUrl && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setIsImageZoomed(false)}
        >
          <button
            type="button"
            aria-label="Đóng ảnh phóng to"
            onClick={() => setIsImageZoomed(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={previewImageUrl}
            alt="Ảnh lịch tăng ca phóng to"
            className="max-w-5xl max-h-[88vh] object-contain rounded-lg shadow-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default ZaloScheduleScanModal;
