import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Camera,
  Check,
  Clock,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import { Employee } from '../../../types/hr';
import {
  buildOnLeaveEmployeeMapForDate,
  fetchActiveLeaveRecordsForOvertimeCheck,
  findExactGlossaryMatch,
  getLocalTodayIsoDate,
  OvertimeGlossaryEntry,
  OvertimeLeaveCheckEntry,
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
import { OvertimeTaskBlock } from './CreateOvertimeForm';

export interface ModalOvertimeBlockDraft {
  id: string;
  overtimeDate: string;
  startTime: string;
  endTime: string;
  reasonVi: string;
  reasonKr: string;
  isKrManuallyEdited: boolean;
  selectedEmployeeIds: string[];
  customTimes: Record<string, { startTime: string; endTime: string }>;
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
}

export interface ZaloScheduleScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  glossaryEntries: OvertimeGlossaryEntry[];
  leaveRecords: OvertimeLeaveCheckEntry[];
  existingPreviewBlocks: OvertimeTaskBlock[];
  defaultDate: string;
  translateMultilineKorean: (
    reasonVi: string,
    glossaryEntries: OvertimeGlossaryEntry[]
  ) => Promise<string>;
  onLeaveRecordsRefreshed?: (records: OvertimeLeaveCheckEntry[]) => void;
  onParseScheduleImage?: typeof parseOvertimeScheduleImage;
  onConfirmBlock: (payload: ConfirmableOvertimeBlockPayload) => Promise<void>;
  onConfirmAllBlocks?: (payloads: ConfirmableOvertimeBlockPayload[]) => Promise<void>;
}

function createEmptyModalDraft(defaultDate: string): ModalOvertimeBlockDraft {
  return {
    id: `modal-block-${Date.now()}`,
    overtimeDate: defaultDate || getLocalTodayIsoDate(),
    startTime: '16:10',
    endTime: '18:10',
    reasonVi: '',
    reasonKr: '',
    isKrManuallyEdited: false,
    selectedEmployeeIds: [],
    customTimes: {},
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
    customTimes: { ...block.customTimes },
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
  translateMultilineKorean,
  onLeaveRecordsRefreshed,
  onParseScheduleImage,
  onConfirmBlock,
  onConfirmAllBlocks,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addPickerRef = useRef<HTMLDivElement | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [blocks, setBlocks] = useState<ModalOvertimeBlockDraft[]>(() => [
    createEmptyModalDraft(defaultDate),
  ]);
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [hasScannedResult, setHasScannedResult] = useState(false);

  const [empAddQuery, setEmpAddQuery] = useState('');
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

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
    setBlocks([createEmptyModalDraft(defaultDate)]);
    setActiveBlockIdx(0);
    setHasScannedResult(false);
    setEmpAddQuery('');
    setIsAddDropdownOpen(false);
  }, [isOpen, defaultDate]);

  useEffect(() => {
    if (!isAddDropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (addPickerRef.current && !addPickerRef.current.contains(e.target as Node)) {
        setIsAddDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isAddDropdownOpen]);

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

  const filteredAddEmployees = useMemo(() => {
    const q = empAddQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      if (!q) return true;
      return (
        emp.fullName.toLowerCase().includes(q) ||
        emp.employeeCode.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q)
      );
    });
  }, [employees, empAddQuery]);

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
      for (const id of prev.selectedEmployeeIds) {
        if (!validIds.includes(id)) delete nextCustom[id];
      }
      return {
        ...prev,
        overtimeDate: nextDate,
        selectedEmployeeIds: validIds,
        customTimes: nextCustom,
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
        return {
          ...prev,
          selectedEmployeeIds: prev.selectedEmployeeIds.filter((id) => id !== empId),
          customTimes: nextCustom,
        };
      }
      return {
        ...prev,
        selectedEmployeeIds: [...prev.selectedEmployeeIds, empId],
      };
    });
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
    for (const empId of draft.selectedEmployeeIds) {
      const c = draft.customTimes[empId];
      if (!c) continue;
      const pStart = normalize24hTime(c.startTime, normStart);
      const pEnd = normalize24hTime(c.endTime, normEnd);
      if (pStart !== normStart || pEnd !== normEnd) {
        normalizedCustomTimes[empId] = { startTime: pStart, endTime: pEnd };
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
        aria-labelledby="zalo-scan-modal-title"
        data-testid="zalo-scan-modal"
        className="max-w-3xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* HEADER */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-[#14539E] flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3
                id="zalo-scan-modal-title"
                className="text-sm font-bold text-slate-900 truncate"
              >
                Quét ảnh lịch tăng ca từ Zalo (AI)
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                Nhấn <kbd className="px-1 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Ctrl + V</kbd> để dán ảnh trực tiếp, kiểm tra và xác nhận ghi nhận vào phiếu
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng cửa sổ quét ảnh"
            disabled={isConfirming}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* CỘT TRÁI MODAL: DÁN / KÉO THẢ ẢNH + XEM TRƯỚC + CẢNH BÁO */}
            <div className="w-full md:w-[250px] shrink-0 space-y-2.5">
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
                        className="w-full max-h-48 object-contain mx-auto bg-white"
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
                    className="w-full py-6 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-[#14539E] cursor-pointer"
                  >
                    <span className="w-10 h-10 rounded-full bg-blue-50 text-[#14539E] flex items-center justify-center border border-blue-200">
                      <Upload className="w-5 h-5" />
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
                  className="rounded-xl border border-blue-200 bg-blue-50/90 px-3 py-2.5 text-xs text-[#14539E] font-semibold flex items-center gap-2"
                >
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>AI đang đọc ảnh & đối chiếu nhân sự...</span>
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

            {/* CỘT PHẢI MODAL: FORM KIỂM TRA & CHỈNH SỬA */}
            <div className="flex-1 min-w-0 space-y-3">
              {blocks.length > 1 && (
                <div
                  className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-200"
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

              {/* NGÀY & GIỜ CHUNG */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="zalo-modal-date"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Ngày làm thêm
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="zalo-modal-date"
                      data-testid="zalo-modal-date-input"
                      type="date"
                      value={activeBlock.overtimeDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="w-full h-8 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                    />
                  </div>
                </div>

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
                      className="w-full h-8 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
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
                      className="w-full h-8 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                    />
                  </div>
                </div>
              </div>

              {/* CHỌN NHANH GIỜ KẾT THÚC */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium text-slate-500 mr-1">
                  Chọn nhanh giờ kết thúc:
                </span>
                {(['18:10', '19:10', '20:10', '20:40'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      updateActiveBlock((prev) => ({ ...prev, endTime: t }))
                    }
                    className={`px-2 py-0.5 text-[10px] font-mono font-medium rounded border transition-colors cursor-pointer ${
                      activeBlock.endTime === t
                        ? 'bg-[#14539E] text-white border-[#14539E]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-[#14539E]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* LÝ DO VIỆT - HÀN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

              {/* DANH SÁCH NHÂN SỰ ĐÃ NHẬN DIỆN */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-700">
                    Nhân sự tham gia ({activeBlock.selectedEmployeeIds.length})
                  </span>
                  <div className="relative" ref={addPickerRef}>
                    <button
                      type="button"
                      data-testid="zalo-modal-add-emp-btn"
                      onClick={() => setIsAddDropdownOpen((prev) => !prev)}
                      className="h-7 px-2 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[#14539E] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Thêm / Chọn nhân sự</span>
                    </button>

                    {isAddDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 w-72 z-30 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-slate-100 bg-slate-50">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              autoFocus
                              value={empAddQuery}
                              onChange={(e) => setEmpAddQuery(e.target.value)}
                              placeholder="Tìm tên hoặc mã NV..."
                              className="w-full h-7 pl-7 pr-2 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                          {filteredAddEmployees.map((emp) => {
                            const isLeave = onLeaveMapForActiveDate.has(emp.id);
                            const isDup = alreadyRecordedForActiveDate.has(emp.id);
                            const disabled = isLeave || isDup;
                            const isChecked =
                              !disabled &&
                              activeBlock.selectedEmployeeIds.includes(emp.id);
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => handleToggleParticipant(emp.id)}
                                className={`w-full text-left px-2 py-1 rounded-md text-[11px] flex items-center justify-between gap-2 ${
                                  disabled
                                    ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                    : isChecked
                                      ? 'bg-blue-50 text-slate-900 font-semibold cursor-pointer'
                                      : 'hover:bg-slate-100 text-slate-700 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                      isChecked
                                        ? 'bg-[#14539E] border-[#14539E] text-white'
                                        : 'border-slate-300 bg-white'
                                    }`}
                                  >
                                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </span>
                                  <span className="truncate">{emp.fullName}</span>
                                </div>
                                {isLeave ? (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                    Đang nghỉ
                                  </span>
                                ) : isDup ? (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                    Đã có lịch
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    {emp.department}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  data-testid="zalo-modal-participants-list"
                  className="rounded-xl border border-slate-200 bg-slate-50/50 max-h-52 overflow-y-auto divide-y divide-slate-200/70"
                >
                  {activeBlock.selectedEmployeeIds.length === 0 ? (
                    <div className="py-5 text-center text-xs text-slate-400">
                      {hasScannedResult
                        ? 'Chưa có nhân sự nào được chọn trong nhóm này. Bấm "Thêm / Chọn nhân sự" để bổ sung.'
                        : 'Dán ảnh lịch tăng ca từ Zalo (Ctrl + V) hoặc bấm "Thêm / Chọn nhân sự".'}
                    </div>
                  ) : (
                    activeBlock.selectedEmployeeIds.map((empId, idx) => {
                      const emp = employeeMap.get(empId);
                      if (!emp) return null;
                      const isCustom = Boolean(activeBlock.customTimes[empId]);
                      const empStart =
                        activeBlock.customTimes[empId]?.startTime ?? activeBlock.startTime;
                      const empEnd =
                        activeBlock.customTimes[empId]?.endTime ?? activeBlock.endTime;

                      return (
                        <div
                          key={empId}
                          className={`px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs ${
                            isCustom ? 'bg-amber-50/70' : 'bg-white'
                          }`}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400 w-4 shrink-0">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate">
                                {emp.fullName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {emp.employeeCode} • {emp.department}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="text"
                              maxLength={5}
                              aria-label={`Giờ bắt đầu của ${emp.fullName}`}
                              value={empStart}
                              onChange={(e) =>
                                handleUpdateParticipantTime(
                                  empId,
                                  'startTime',
                                  e.target.value
                                )
                              }
                              onBlur={(e) =>
                                handleUpdateParticipantTime(
                                  empId,
                                  'startTime',
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-12 h-6 text-[11px] font-mono text-center rounded border focus:outline-none focus:border-[#14539E] ${
                                isCustom
                                  ? 'border-amber-400 bg-amber-50 font-bold text-amber-900'
                                  : 'border-slate-200 bg-white text-slate-700'
                              }`}
                            />
                            <span className="text-slate-400 text-[10px]">-</span>
                            <input
                              type="text"
                              maxLength={5}
                              aria-label={`Giờ kết thúc của ${emp.fullName}`}
                              value={empEnd}
                              onChange={(e) =>
                                handleUpdateParticipantTime(
                                  empId,
                                  'endTime',
                                  e.target.value
                                )
                              }
                              onBlur={(e) =>
                                handleUpdateParticipantTime(
                                  empId,
                                  'endTime',
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-12 h-6 text-[11px] font-mono text-center rounded border focus:outline-none focus:border-[#14539E] ${
                                isCustom
                                  ? 'border-amber-400 bg-amber-50 font-bold text-amber-900'
                                  : 'border-slate-200 bg-white text-slate-700'
                              }`}
                            />
                            <button
                              type="button"
                              aria-label={`Xóa ${emp.fullName} khỏi nhóm`}
                              onClick={() => handleToggleParticipant(empId)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer ml-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500">
            Đã chọn <strong className="text-[#14539E]">{activeBlock.selectedEmployeeIds.length}</strong> nhân sự
            {blocks.length > 1 ? ` • Nhóm ${activeBlockIdx + 1}/${blocks.length}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isConfirming}
              onClick={onClose}
              className="h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
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
              className="h-9 px-4 rounded-xl bg-[#14539E] hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isConfirming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>Xác nhận & Ghi nhận nhóm</span>
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
