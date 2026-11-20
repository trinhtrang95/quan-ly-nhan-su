import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Info,
  Save,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';  
import { DepartmentGroup, Employee } from '../../types/hr';
import { INITIAL_DEPARTMENT_GROUPS, INITIAL_EMPLOYEES } from '../../data/mockData';
import {
  formatNumberVN,
  getFriendlyErrorMessage,
} from '../../utils/errorAndSecurityService';
import {
  evaluateOvertimeDateConflict,
  findActiveFormsByDate,
  formatOvertimeFormCodeDisplay,
  getLocalTodayIsoDate,
  OvertimeFormWithItems,
  reconstructBlocksFromItems,
} from '../../utils/overtimeFormsService';
import {
  findExactGlossaryMatch,
  loadOvertimeGlossary,
  OvertimeGlossaryEntry,
  readLocalOvertimeGlossary,
  suggestFactoryKoreanTranslation,
  upsertOvertimeGlossaryEntry,
} from '../../utils/overtimeGlossaryService';
import {
  buildCombinedReasonText,
  formatDateToFormStyle,
  formatDepartmentHeaderLabel,
  formatTimeToFormStyle,
  overtimeExportService,
} from '../../utils/overtimeExportService';

export interface OvertimeParticipant {
  employeeId: string;
  startTime: string;
  endTime: string;
}

export interface OvertimeTaskBlock {
  id: string;
  overtimeDate: string;
  reasonVi: string;
  reasonKr: string;
  startTime: string;
  endTime: string;
  selectedEmployeeIds: string[];
  participants: OvertimeParticipant[];
  isTranslating?: boolean;
}

export interface CreateOvertimeFormPayload {
  department: string;
  overtimeDate: string;
  blocks: OvertimeTaskBlock[];
}

export interface CreateOvertimeFormProps {
  employees?: Employee[];
  groups?: DepartmentGroup[];
  existingForms?: OvertimeFormWithItems[];
  isCheckingExistingForms?: boolean;
  initialDepartment?: string;
  initialDate?: string;
  editingForm?: OvertimeFormWithItems | null;
  onOpenExistingForm?: (form: OvertimeFormWithItems) => void;
  onCancelEdit?: () => void;
  onSaveOnly?: (payload: CreateOvertimeFormPayload) => Promise<void> | void;
}

class OvertimeFormService {
  static createEmptyBlock(defaultDate = '2026-11-16'): OvertimeTaskBlock {
    return {
      id: `ot-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      overtimeDate: defaultDate,
      reasonVi: '',
      reasonKr: '',
      startTime: '16:10',
      endTime: '20:10',
      selectedEmployeeIds: [],
      participants: [],
      isTranslating: false,
    };
  }

  static calculateDurationHours(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (Number.isNaN(startH) || Number.isNaN(startM) || Number.isNaN(endH) || Number.isNaN(endM)) {
      return 0;
    }
    const diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMinutes <= 0) return 0;
    return Number((diffMinutes / 60).toFixed(2));
  }

  static sanitize24hTimeInput(raw: string): string {
    const cleaned = raw.replace(/[^\d:]/g, '');
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx !== -1) {
      const before = cleaned.slice(0, colonIdx).slice(0, 2);
      const after = cleaned.slice(colonIdx + 1).replace(/:/g, '').slice(0, 2);
      return `${before}:${after}`;
    }
    const digitsOnly = cleaned.slice(0, 4);
    if (digitsOnly.length >= 3) {
      return `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2)}`;
    }
    return digitsOnly;
  }

  static normalize24hTime(raw: string, fallback: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    const match = trimmed.match(/^(\d{1,2}):?(\d{0,2})$/);
    if (!match) return fallback;
    const rawHours = parseInt(match[1], 10);
    const rawMinutes = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
    if (Number.isNaN(rawHours) || Number.isNaN(rawMinutes)) return fallback;
    const clampedHours = Math.min(23, Math.max(0, rawHours));
    const clampedMinutes = Math.min(59, Math.max(0, rawMinutes));
    return `${String(clampedHours).padStart(2, '0')}:${String(clampedMinutes).padStart(2, '0')}`;
  }
}

interface PrintableRow {
  no: number;
  fullName: string;
  isFirstInBlock: boolean;
  rowSpan: number;
  combinedReason: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
}

interface PrintableDateGroup {
  date: string;
  formattedDate: string;
  blocks: {
    blockId: string;
    rows: PrintableRow[];
  }[];
}

// Khóa lưu trữ để chống mất dữ liệu khi đổi tab
const DRAFT_STORAGE_KEY = 'ot_form_draft_v1';

export const CreateOvertimeForm: React.FC<CreateOvertimeFormProps> = ({
  employees = INITIAL_EMPLOYEES,
  groups = INITIAL_DEPARTMENT_GROUPS,
  existingForms = [],
  isCheckingExistingForms = false,
  initialDepartment = 'ALL',
  initialDate = getLocalTodayIsoDate(),
  editingForm = null,
  onOpenExistingForm,
  onCancelEdit,
  onSaveOnly,
}) => {

  // Auto-load state từ LocalStorage (hoặc từ phiếu đang chỉnh sửa)
  const [selectedDepartment, setSelectedDepartment] = useState<string>(() => {
    if (editingForm) return editingForm.department || initialDepartment;
    return localStorage.getItem(`${DRAFT_STORAGE_KEY}_dept`) || initialDepartment;
  });
  const [overtimeDate, setOvertimeDate] = useState<string>(() => {
    if (editingForm) return editingForm.overtime_date || initialDate;
    return localStorage.getItem(`${DRAFT_STORAGE_KEY}_date`) || initialDate;
  });
  const [previewData, setPreviewData] = useState<OvertimeTaskBlock[]>(() => {
    if (editingForm) {
      return reconstructBlocksFromItems(editingForm.items).map((b) => ({
        ...b,
        isTranslating: false,
      }));
    }
    const saved = localStorage.getItem(`${DRAFT_STORAGE_KEY}_preview`);
    return saved ? JSON.parse(saved) : [];
  });
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const [currentStartTime, setCurrentStartTime] = useState<string>('16:10');
  const [currentEndTime, setCurrentEndTime] = useState<string>('20:10');
  const [currentSelectedEmployeeIds, setCurrentSelectedEmployeeIds] = useState<string[]>([]);
  const [customTimes, setCustomTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [editingTimeEmpId, setEditingTimeEmpId] = useState<string | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState<boolean>(false);
  const employeePickerRef = useRef<HTMLDivElement | null>(null);
  const [currentReasonVi, setCurrentReasonVi] = useState<string>('Trực sản xuất');
  const [currentReasonKr, setCurrentReasonKr] = useState<string>('생산 당직');
  const [isReasonKrManuallyEdited, setIsReasonKrManuallyEdited] = useState<boolean>(false);
  const [glossaryEntries, setGlossaryEntries] = useState<OvertimeGlossaryEntry[]>(() =>
    readLocalOvertimeGlossary()
  );
  const [isAutoTranslating, setIsAutoTranslating] = useState<boolean>(false);
  const isInitialReasonMountRef = useRef<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Nạp & đồng bộ nhẹ từ điển nội bộ (localStorage + Supabase overtime_glossary nếu có)
  useEffect(() => {
    let active = true;
    void loadOvertimeGlossary().then((loaded) => {
      if (active) setGlossaryEntries(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  // Đồng bộ dữ liệu khi chuyển sang/thoát khỏi chế độ chỉnh sửa phiếu
  useEffect(() => {
    if (editingForm) {
      const reconstructed = reconstructBlocksFromItems(editingForm.items).map((b) => ({
        ...b,
        isTranslating: false,
      }));
      const matchedDept = groups.some((g) => g.name === editingForm.department)
        ? editingForm.department
        : 'ALL';
      setSelectedDepartment(matchedDept);
      setOvertimeDate(editingForm.overtime_date || initialDate);
      setPreviewData(reconstructed);
      setEditingBlockId(null);
      setCurrentSelectedEmployeeIds([]);
      setCustomTimes({});
      setEditingTimeEmpId(null);
      setEmployeeSearchQuery('');
      setIsEmployeeDropdownOpen(false);
      setCurrentReasonVi('');
      setCurrentReasonKr('');
      setIsReasonKrManuallyEdited(false);
    }
  }, [editingForm, groups, initialDate]);

  // Tự động đóng danh sách nhân sự sổ xuống khi bấm ra ngoài vùng tìm kiếm
  useEffect(() => {
    if (!isEmployeeDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        employeePickerRef.current &&
        !employeePickerRef.current.contains(event.target as Node)
      ) {
        setIsEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEmployeeDropdownOpen]);

  // Auto-save vào LocalStorage chỉ khi đang tạo phiếu mới (tránh ghi đè nháp khi sửa phiếu cũ)
  useEffect(() => {
    if (editingForm) return;
    localStorage.setItem(`${DRAFT_STORAGE_KEY}_dept`, selectedDepartment);
    localStorage.setItem(`${DRAFT_STORAGE_KEY}_date`, overtimeDate);
    localStorage.setItem(`${DRAFT_STORAGE_KEY}_preview`, JSON.stringify(previewData));
  }, [selectedDepartment, overtimeDate, previewData, editingForm]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const employeeMap = useMemo(() => new Map<string, Employee>(employees.map((e) => [e.id, e])), [employees]);

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    groups.forEach((g) => { if (g.name?.trim()) names.add(g.name.trim()); });
    employees.forEach((emp) => { if (emp.department?.trim()) names.add(emp.department.trim()); });
    return Array.from(names);
  }, [groups, employees]);

  const alreadyRecordedIdsForCurrentDate = useMemo(() => {
    const set = new Set<string>();
    for (const block of previewData) {
      if (editingBlockId && block.id === editingBlockId) continue;
      if ((block.overtimeDate || '') === overtimeDate) {
        if (Array.isArray(block.participants)) {
          for (const p of block.participants) if (p.employeeId) set.add(p.employeeId);
        }
        if (Array.isArray(block.selectedEmployeeIds)) {
          for (const id of block.selectedEmployeeIds) if (id) set.add(id);
        }
      }
    }
    return set;
  }, [previewData, overtimeDate, editingBlockId]);

  const filteredEmployeesForInput = useMemo(() => {
    const available = employees.filter((emp) => !alreadyRecordedIdsForCurrentDate.has(emp.id));
    const normalizedDept = (selectedDepartment || '').trim();
    const byDepartment = !normalizedDept || normalizedDept === 'ALL'
      ? available
      : available.filter((emp) => (emp.department || '').trim() === normalizedDept);
    const query = employeeSearchQuery.trim().toLowerCase();
    if (!query) return byDepartment;
    return byDepartment.filter(
      (emp) => emp.fullName.toLowerCase().includes(query) ||
               emp.employeeCode.toLowerCase().includes(query) ||
               emp.department.toLowerCase().includes(query)
    );
  }, [employees, selectedDepartment, employeeSearchQuery, alreadyRecordedIdsForCurrentDate]);

  useEffect(() => {
    setCurrentSelectedEmployeeIds((prev) => {
      const valid = prev.filter((id) => !alreadyRecordedIdsForCurrentDate.has(id));
      return valid.length === prev.length ? prev : valid;
    });
  }, [alreadyRecordedIdsForCurrentDate]);

  const summaryStats = useMemo(() => {
    let totalParticipants = 0;
    let totalHours = 0;
    const dateSet = new Set<string>();
    for (const block of previewData) {
      if (block.overtimeDate) dateSet.add(block.overtimeDate);
      const parts = Array.isArray(block.participants) && block.participants.length > 0
          ? block.participants
          : block.selectedEmployeeIds.map((id) => ({ employeeId: id, startTime: block.startTime, endTime: block.endTime }));
      totalParticipants += parts.length;
      for (const p of parts) {
        totalHours += OvertimeFormService.calculateDurationHours(p.startTime || block.startTime, p.endTime || block.endTime);
      }
    }
    return {
      blockCount: previewData.length,
      totalParticipants,
      totalHours: Number(totalHours.toFixed(2)),
      datesCount: dateSet.size || (previewData.length > 0 ? 1 : 0),
    };
  }, [previewData]);

  // Kiểm tra trùng ngày tăng ca & xác định ngày đại diện của phiếu (1 ngày vs >= 2 ngày)
  const dateConflictEval = useMemo(
    () =>
      evaluateOvertimeDateConflict({
        blocks: previewData,
        selectedDepartment,
        employees,
        existingForms,
        editingFormId: editingForm?.id ?? null,
        fallbackDate: overtimeDate,
      }),
    [
      previewData,
      selectedDepartment,
      employees,
      existingForms,
      editingForm?.id,
      overtimeDate,
    ]
  );

  const representativeOvertimeDate = dateConflictEval.representativeDate;

  // Cảnh báo sớm ngay khi chọn ngày làm thêm đã có phiếu trong Nhật ký
  const selectedDateExistingForms = useMemo(
    () => findActiveFormsByDate(existingForms, overtimeDate, editingForm?.id ?? null),
    [existingForms, overtimeDate, editingForm?.id]
  );

  const uniqueConflictCodes = useMemo(
    () =>
      Array.from(
        new Set(
          dateConflictEval.conflictingForms.map((f) =>
            formatOvertimeFormCodeDisplay(f.form_code)
          )
        )
      ),
    [dateConflictEval.conflictingForms]
  );

  const handleSelectGlossaryTemplate = (entryId: string) => {
    if (!entryId) return;
    const found = glossaryEntries.find((item) => item.id === entryId);
    if (!found) return;
    setCurrentReasonVi(found.reasonVi);
    setCurrentReasonKr(found.reasonKr);
    setIsReasonKrManuallyEdited(false);
    setIsAutoTranslating(false);
  };

  const handleSuggestTranslation = async () => {
    const cleanVi = currentReasonVi.trim();
    if (!cleanVi) {
      showToast('Vui lòng nhập lý do (Tiếng Việt) trước khi bấm Dịch gợi ý.');
      return;
    }
    setIsAutoTranslating(true);
    try {
      const { translation } = await suggestFactoryKoreanTranslation(
        cleanVi,
        glossaryEntries
      );
      setCurrentReasonKr(translation);
      setIsReasonKrManuallyEdited(false);
    } finally {
      setIsAutoTranslating(false);
    }
  };

  const handleSaveGlossaryTemplate = async () => {
    const cleanVi = currentReasonVi.trim();
    const cleanKr = currentReasonKr.trim();
    if (!cleanVi || !cleanKr) {
      showToast('Vui lòng nhập đầy đủ cả Lý do (Tiếng Việt) và Lý do (Tiếng Hàn) để lưu mẫu.');
      return;
    }
    const { entries, isUpdate } = await upsertOvertimeGlossaryEntry(cleanVi, cleanKr);
    setGlossaryEntries(entries);
    showToast(
      isUpdate
        ? `Đã cập nhật mẫu "${cleanVi}" trong từ điển.`
        : `Đã lưu mẫu "${cleanVi}" vào từ điển.`
    );
  };

  // Tầng 1 (khớp 100% từ điển tức thì) + Tầng 3 (gợi ý dịch ngữ cảnh debounce 500ms)
  // Tuyệt đối không ghi đè nếu người dùng đã tự sửa tay ô Tiếng Hàn
  useEffect(() => {
    if (isInitialReasonMountRef.current) {
      isInitialReasonMountRef.current = false;
      return;
    }
    if (isReasonKrManuallyEdited) {
      setIsAutoTranslating(false);
      return;
    }
    const cleanVi = currentReasonVi.trim();
    if (!cleanVi) {
      setIsAutoTranslating(false);
      setCurrentReasonKr('');
      return;
    }

    // Tầng 1: Khớp 100% từ điển nội bộ -> điền ngay lập tức
    const exactMatch = findExactGlossaryMatch(glossaryEntries, cleanVi);
    if (exactMatch) {
      setIsAutoTranslating(false);
      setCurrentReasonKr(exactMatch.reasonKr);
      return;
    }

    // Tầng 3: Dịch gợi ý tự động theo ngữ cảnh nhà máy (debounce 500ms)
    let isCancelled = false;
    setIsAutoTranslating(true);
    const debounceTimer = window.setTimeout(async () => {
      const { translation } = await suggestFactoryKoreanTranslation(
        cleanVi,
        glossaryEntries
      );
      if (!isCancelled) {
        setCurrentReasonKr(translation);
        setIsAutoTranslating(false);
      }
    }, 500);
    return () => {
      isCancelled = true;
      window.clearTimeout(debounceTimer);
    };
  }, [currentReasonVi, glossaryEntries, isReasonKrManuallyEdited]);

  const handleToggleEmployee = (empId: string) => {
    setCurrentSelectedEmployeeIds((prev) => prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]);
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredEmployeesForInput.map((e) => e.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => currentSelectedEmployeeIds.includes(id));
    if (allSelected) {
      setCurrentSelectedEmployeeIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setCurrentSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleRemovePreviewBlock = (index: number) => {
    const removed = previewData[index];
    if (removed && editingBlockId === removed.id) {
      setEditingBlockId(null);
    }
    setPreviewData((prev) => prev.filter((_, idx) => idx !== index));
    showToast('Đã xóa nhóm công việc khỏi bản xem trước.');
  };

  const handleEditPreviewBlock = (index: number) => {
    const block = previewData[index];
    if (!block) return;
    setEditingBlockId(block.id);
    setOvertimeDate(block.overtimeDate || initialDate);
    setCurrentStartTime(block.startTime || '16:10');
    setCurrentEndTime(block.endTime || '20:10');
    setCurrentSelectedEmployeeIds([...block.selectedEmployeeIds]);
    const nextCustom: Record<string, { startTime: string; endTime: string }> = {};
    for (const p of block.participants || []) {
      if (p.startTime !== block.startTime || p.endTime !== block.endTime) {
        nextCustom[p.employeeId] = { startTime: p.startTime, endTime: p.endTime };
      }
    }
    setCustomTimes(nextCustom);
    setEditingTimeEmpId(null);
    isInitialReasonMountRef.current = true;
    setCurrentReasonVi(block.reasonVi || '');
    setCurrentReasonKr(block.reasonKr || '');
    setIsReasonKrManuallyEdited(false);
    showToast(`Đang chỉnh sửa nhóm #${index + 1} [${formatDateToFormStyle(block.overtimeDate)}]`);
  };

  const handleCancelBlockEdit = () => {
    setEditingBlockId(null);
    setCurrentSelectedEmployeeIds([]);
    setCustomTimes({});
    setEditingTimeEmpId(null);
    setCurrentReasonVi('');
    setCurrentReasonKr('');
    setIsReasonKrManuallyEdited(false);
  };

  const handleCommitBlock = async () => {
    if (currentSelectedEmployeeIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một nhân sự tham gia nhóm công việc này.');
      return;
    }
    if (!currentReasonVi.trim()) {
      showToast('Vui lòng nhập lý do tăng ca (Tiếng Việt).');
      return;
    }

    const normalizedStart = OvertimeFormService.normalize24hTime(currentStartTime, '16:10');
    const normalizedEnd = OvertimeFormService.normalize24hTime(currentEndTime, '20:10');
    setCurrentStartTime(normalizedStart);
    setCurrentEndTime(normalizedEnd);

    const cleanReasonVi = currentReasonVi.trim();
    const finalReasonKr = currentReasonKr.trim()
      ? currentReasonKr.trim()
      : (await suggestFactoryKoreanTranslation(cleanReasonVi, glossaryEntries)).translation;

    // Tự động học/cập nhật cặp (reasonVi, reasonKr) vào từ điển nội bộ khi ghi nhận
    if (cleanReasonVi && finalReasonKr.trim()) {
      void upsertOvertimeGlossaryEntry(cleanReasonVi, finalReasonKr.trim()).then(
        ({ entries }) => setGlossaryEntries(entries)
      );
    }

    const participants: OvertimeParticipant[] = currentSelectedEmployeeIds.map((empId) => {
      const custom = customTimes[empId];
      return {
        employeeId: empId,
        startTime: custom?.startTime ? OvertimeFormService.normalize24hTime(custom.startTime, normalizedStart) : normalizedStart,
        endTime: custom?.endTime ? OvertimeFormService.normalize24hTime(custom.endTime, normalizedEnd) : normalizedEnd,
      };
    });

    const newBlock: OvertimeTaskBlock = {
      id: editingBlockId || `ot-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      overtimeDate: overtimeDate || '2026-11-16',
      reasonVi: cleanReasonVi,
      reasonKr: finalReasonKr.trim(),
      startTime: normalizedStart,
      endTime: normalizedEnd,
      selectedEmployeeIds: [...currentSelectedEmployeeIds],
      participants,
      isTranslating: false,
    };

    if (editingBlockId) {
      setPreviewData((prev) =>
        prev.map((b) => (b.id === editingBlockId ? newBlock : b))
      );
      setEditingBlockId(null);
      showToast(`Đã cập nhật nhóm [${formatDateToFormStyle(newBlock.overtimeDate)}]!`);
    } else {
      setPreviewData((prev) => [...prev, newBlock]);
      showToast(`Đã ghi nhận nhóm [${formatDateToFormStyle(newBlock.overtimeDate)}] vào danh sách xem trước!`);
    }

    setCurrentReasonVi('');
    setCurrentReasonKr('');
    setIsReasonKrManuallyEdited(false);
    setCurrentSelectedEmployeeIds([]);
    setCustomTimes({});
    setEditingTimeEmpId(null);
    setEmployeeSearchQuery('');
    setIsEmployeeDropdownOpen(false);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    setPreviewData((prev) => {
      const newData = [...prev];
      if (direction === 'up' && index > 0) {
        const temp = newData[index];
        newData[index] = newData[index - 1];
        newData[index - 1] = temp;
      } else if (direction === 'down' && index < newData.length - 1) {
        const temp = newData[index];
        newData[index] = newData[index + 1];
        newData[index + 1] = temp;
      }
      return newData;
    });
  };

  const isTimeBold = (timeStr: string) => {
    if (!timeStr) return false;
    const cleanTime = timeStr.replace('h', ':');
    const [hours, minutes] = cleanTime.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return false;
    return (hours * 60 + minutes) >= 1210;
  };

  // NÚT 1: LƯU / CẬP NHẬT PHIẾU
  const handleSaveOnly = async () => {
    if (previewData.length === 0) {
      showToast('Vui lòng ghi nhận ít nhất một nhóm công việc trước khi Lưu.');
      return;
    }
    if (isCheckingExistingForms) {
      showToast('Đang tải dữ liệu Nhật ký để kiểm tra trùng ngày, vui lòng thử lại sau giây lát.');
      return;
    }
    if (dateConflictEval.isBlocked) {
      const codes = uniqueConflictCodes.join(', ');
      const targetDateFormatted = formatDateToFormStyle(
        dateConflictEval.mode === 'representative_date_blocked'
          ? dateConflictEval.representativeDate
          : dateConflictEval.uniqueDates[0]
      );
      showToast(
        `Không thể lưu: ngày ${targetDateFormatted} đã có phiếu (${codes}). Mỗi ngày chỉ được tạo 1 phiếu — vui lòng mở lại phiếu cũ để sửa.`
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await onSaveOnly?.({
        department: selectedDepartment,
        overtimeDate: representativeOvertimeDate,
        blocks: previewData,
      });
      if (!editingForm) {
        setPreviewData([]);
        localStorage.removeItem(`${DRAFT_STORAGE_KEY}_preview`);
      }
      setEditingBlockId(null);
      if (!onSaveOnly) {
        showToast('Đã lưu phiếu tăng ca thành công!');
      }
    } catch (error) {
      showToast(getFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // NÚT 2: XUẤT EXCEL (Sinh file Excel thuần túy)
  const handleExportExcelOnly = async () => {
    if (previewData.length === 0) {
      showToast('Vui lòng ghi nhận ít nhất một nhóm công việc trước khi xuất Excel.');
      return;
    }
    setIsSubmitting(true);
    try {
      await overtimeExportService.exportExcel({
        department: selectedDepartment,
        overtimeDate: representativeOvertimeDate,
        blocks: previewData,
        employees,
      });
      showToast('Đã tạo và tải file Excel thành công!');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        showToast('Đã hủy chọn thư mục.'); // Bắt lỗi người dùng bấm Cancel khi chọn thư mục
      } else {
        showToast(getFriendlyErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const printableDateGroups = useMemo((): PrintableDateGroup[] => {
    if (previewData.length === 0) {
      const draftParticipants: OvertimeParticipant[] = currentSelectedEmployeeIds.length > 0
          ? currentSelectedEmployeeIds.map((id) => ({
              employeeId: id,
              startTime: customTimes[id]?.startTime ? OvertimeFormService.normalize24hTime(customTimes[id].startTime, currentStartTime) : currentStartTime,
              endTime: customTimes[id]?.endTime ? OvertimeFormService.normalize24hTime(customTimes[id].endTime, currentEndTime) : currentEndTime,
            }))
          : [{ employeeId: '__EMPTY_PARTICIPANT__', startTime: currentStartTime || '16:10', endTime: currentEndTime || '20:10' }];

      const combinedReason = buildCombinedReasonText(currentReasonVi || 'Trực sản xuất', currentReasonKr || '생산 당직');
      return [{
          date: overtimeDate,
          formattedDate: formatDateToFormStyle(overtimeDate),
          blocks: [{
              blockId: 'draft-block',
              rows: draftParticipants.map((p, idx) => {
                const emp = employeeMap.get(p.employeeId);
                return {
                  no: idx + 1,
                  fullName: emp ? emp.fullName : '(Chưa chọn nhân sự)',
                  isFirstInBlock: idx === 0,
                  rowSpan: draftParticipants.length,
                  combinedReason,
                  startTimeFormatted: formatTimeToFormStyle(p.startTime),
                  endTimeFormatted: formatTimeToFormStyle(p.endTime),
                };
              }),
            }],
        }];
    }

    const mapByDate = new Map<string, OvertimeTaskBlock[]>();
    for (const block of previewData) {
      const d = block.overtimeDate || overtimeDate;
      if (!mapByDate.has(d)) mapByDate.set(d, []);
      mapByDate.get(d)!.push(block);
    }
    const sortedDates = Array.from(mapByDate.keys()).sort((a, b) => a.localeCompare(b));

    return sortedDates.map((date) => {
      const blocksForDate = mapByDate.get(date)!;
      let runningNo = 1;
      const processedBlocks = blocksForDate.map((block) => {
        const participants: OvertimeParticipant[] = Array.isArray(block.participants) && block.participants.length > 0
            ? block.participants
            : block.selectedEmployeeIds.length > 0
            ? block.selectedEmployeeIds.map((id) => ({ employeeId: id, startTime: block.startTime, endTime: block.endTime }))
            : [{ employeeId: '__EMPTY_PARTICIPANT__', startTime: block.startTime, endTime: block.endTime }];
        const combinedReason = buildCombinedReasonText(block.reasonVi, block.reasonKr);
        const rows: PrintableRow[] = participants.map((p, idxInBlock) => {
          const emp = employeeMap.get(p.employeeId);
          const no = runningNo;
          runningNo += 1;
          return {
            no,
            fullName: emp ? emp.fullName : '(Chưa chọn nhân sự)',
            isFirstInBlock: idxInBlock === 0,
            rowSpan: participants.length,
            combinedReason,
            startTimeFormatted: formatTimeToFormStyle(p.startTime || block.startTime),
            endTimeFormatted: formatTimeToFormStyle(p.endTime || block.endTime),
          };
        });
        return { blockId: block.id, rows };
      });
      return { date, formattedDate: formatDateToFormStyle(date), blocks: processedBlocks };
    });
  }, [previewData, employeeMap, overtimeDate, currentSelectedEmployeeIds, customTimes, currentReasonVi, currentReasonKr, currentStartTime, currentEndTime]);

  return (
    <div className="flex flex-col lg:flex-row w-full lg:h-full flex-1 min-h-0 lg:overflow-hidden p-3 sm:p-4 gap-4 bg-slate-50 text-slate-800">
      {/* CỘT TRÁI (1/3) */}
      <div className="w-full lg:w-1/3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:h-full min-h-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-slate-50/50">
          <h2 className="text-base font-bold text-[#14539E] truncate">
            {editingForm
              ? `Sửa phiếu ${formatOvertimeFormCodeDisplay(editingForm.form_code)}`
              : 'Tạo phiếu tăng ca'}
          </h2>
          {editingForm && onCancelEdit ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <X className="w-3 h-3" />
              <span>Hủy sửa</span>
            </button>
          ) : (
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#14539E] border border-blue-200 shrink-0 whitespace-nowrap">
              TV-PSGC2022
            </span>
          )}
        </div>

        <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* HÀNG 1 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="overtime-department-select"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Bộ phận / Nhóm
              </label>
              <select
                id="overtime-department-select"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                <option value="ALL">Tất cả bộ phận</option>
                {departmentOptions.map((deptName) => (
                  <option key={deptName} value={deptName}>
                    {deptName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngày làm thêm</label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={overtimeDate}
                  onChange={(e) => setOvertimeDate(e.target.value)}
                  className={`w-full h-9 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border bg-white focus:outline-none cursor-pointer ${
                    selectedDateExistingForms.length > 0
                      ? 'border-amber-400 focus:border-red-500'
                      : 'border-slate-200 focus:border-[#14539E]'
                  }`}
                />
              </div>
            </div>
          </div>

          {selectedDateExistingForms.length > 0 && (
            <div
              data-testid="overtime-date-input-notice"
              className="rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-1.5 text-[11px] text-amber-900 flex items-start justify-between gap-2 leading-snug"
            >
              <div className="flex items-start gap-1.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Ngày{' '}
                  <strong className="font-mono">
                    {formatDateToFormStyle(overtimeDate)}
                  </strong>{' '}
                  đã có phiếu{' '}
                  <strong className="font-mono">
                    {formatOvertimeFormCodeDisplay(
                      selectedDateExistingForms[0].form_code
                    )}
                  </strong>
                  . Phiếu 1 ngày sẽ bị chặn lưu (chỉ lưu được nếu sửa phiếu cũ hoặc
                  gộp ≥ 2 ngày).
                </span>
              </div>
              {onOpenExistingForm && (
                <button
                  type="button"
                  onClick={() => onOpenExistingForm(selectedDateExistingForms[0])}
                  className="text-[10px] font-semibold text-[#14539E] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sửa phiếu cũ
                </button>
              )}
            </div>
          )}

          {/* HÀNG 2 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Giờ bắt đầu (chung)</label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  list="overtime-24h-slots"
                  placeholder="16:10"
                  value={currentStartTime}
                  onChange={(e) => setCurrentStartTime(OvertimeFormService.sanitize24hTimeInput(e.target.value))}
                  onBlur={() => setCurrentStartTime((prev) => OvertimeFormService.normalize24hTime(prev, '16:10'))}
                  className="w-full h-9 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Giờ kết thúc (chung)</label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  list="overtime-24h-slots"
                  placeholder="20:10"
                  value={currentEndTime}
                  onChange={(e) => setCurrentEndTime(OvertimeFormService.sanitize24hTimeInput(e.target.value))}
                  onBlur={() => setCurrentEndTime((prev) => OvertimeFormService.normalize24hTime(prev, '20:10'))}
                  className="w-full h-9 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>
            <datalist id="overtime-24h-slots">
              <option value="07:00" /><option value="08:00" /><option value="12:00" /><option value="16:10" /><option value="17:00" />
              <option value="18:30" /><option value="20:00" /><option value="20:10" /><option value="20:30" /><option value="21:30" />
            </datalist>
          </div>

          {/* HÀNG 3: CHỌN NHÂN SỰ (SEARCHABLE MULTI-SELECT POPOVER) */}
          <div className="space-y-2" ref={employeePickerRef}>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="overtime-employee-search"
                className="text-[11px] font-semibold text-slate-600"
              >
                Nhân sự ({currentSelectedEmployeeIds.length} chọn)
                {alreadyRecordedIdsForCurrentDate.size > 0 && (
                  <span className="text-slate-400 font-normal ml-1">
                    ({alreadyRecordedIdsForCurrentDate.size} đã lên lịch)
                  </span>
                )}
              </label>
              {currentSelectedEmployeeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentSelectedEmployeeIds([]);
                    setCustomTimes({});
                    setEditingTimeEmpId(null);
                  }}
                  className="text-[11px] font-medium text-slate-500 hover:text-red-600 cursor-pointer transition-colors"
                >
                  Bỏ chọn hết
                </button>
              )}
            </div>

            {/* Ô tìm kiếm duy nhất + Popover danh sách sổ xuống */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="overtime-employee-search"
                type="text"
                role="combobox"
                aria-expanded={isEmployeeDropdownOpen}
                aria-controls="overtime-employee-popover"
                aria-autocomplete="list"
                value={employeeSearchQuery}
                onFocus={() => setIsEmployeeDropdownOpen(true)}
                onClick={() => setIsEmployeeDropdownOpen(true)}
                onChange={(e) => {
                  setEmployeeSearchQuery(e.target.value);
                  if (!isEmployeeDropdownOpen) setIsEmployeeDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsEmployeeDropdownOpen(false);
                  }
                }}
                placeholder="Bấm để chọn hoặc tìm mã, tên nhân sự..."
                className={`w-full h-9 pl-8 pr-14 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border bg-white focus:outline-none transition-colors ${
                  isEmployeeDropdownOpen
                    ? 'border-[#14539E] ring-1 ring-[#14539E]/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {employeeSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setEmployeeSearchQuery('')}
                    aria-label="Xóa từ khóa tìm kiếm nhân sự"
                    className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEmployeeDropdownOpen((prev) => !prev)}
                  aria-label={isEmployeeDropdownOpen ? 'Đóng danh sách nhân sự' : 'Mở danh sách nhân sự'}
                  className="p-1 text-slate-400 hover:text-[#14539E] rounded cursor-pointer transition-transform"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isEmployeeDropdownOpen ? 'rotate-180 text-[#14539E]' : ''
                    }`}
                  />
                </button>
              </div>

              {isEmployeeDropdownOpen && (
                <div
                  id="overtime-employee-popover"
                  role="listbox"
                  aria-multiselectable="true"
                  className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
                >
                  {/* Thanh đầu danh sách sổ xuống */}
                  <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500 truncate">
                      {selectedDepartment && selectedDepartment !== 'ALL' ? (
                        <>
                          Nhóm <strong className="text-slate-700">{selectedDepartment}</strong> • {filteredEmployeesForInput.length} người
                        </>
                      ) : (
                        <>Tất cả bộ phận • {filteredEmployeesForInput.length} người</>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={filteredEmployeesForInput.length === 0}
                      onClick={handleSelectAllFiltered}
                      className="font-semibold text-[#14539E] hover:underline cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {filteredEmployeesForInput.length > 0 &&
                      filteredEmployeesForInput.every((e) =>
                        currentSelectedEmployeeIds.includes(e.id)
                      )
                        ? 'Bỏ chọn tất cả'
                        : 'Chọn tất cả'}
                    </button>
                  </div>

                  {/* Danh sách nhân sự cuộn bên trong popover */}
                  <div className="max-h-48 overflow-y-auto p-1.5 space-y-1">
                    {filteredEmployeesForInput.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-400">
                        Không tìm thấy nhân sự phù hợp.
                      </div>
                    ) : (
                      filteredEmployeesForInput.map((emp) => {
                        const isSelected = currentSelectedEmployeeIds.includes(emp.id);
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleToggleEmployee(emp.id)}
                            className={`w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors select-none ${
                              isSelected
                                ? 'bg-blue-50/90 border border-blue-200 text-slate-900 font-semibold'
                                : 'bg-white border border-transparent text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span
                                aria-hidden="true"
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-white shrink-0 ${
                                  isSelected
                                    ? 'bg-[#14539E] border-[#14539E]'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </span>
                              <div className="min-w-0 flex-1 truncate">
                                <span>{emp.fullName}</span>
                                <span className="text-slate-400 text-[10px] font-mono ml-1">
                                  ({emp.employeeCode})
                                </span>
                              </div>
                            </div>
                            {(!selectedDepartment || selectedDepartment === 'ALL') && emp.department && (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 max-w-[90px] truncate">
                                {emp.department}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Chân popover */}
                  <div className="px-2.5 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      Đã tích chọn: <strong className="text-[#14539E]">{currentSelectedEmployeeIds.length}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEmployeeDropdownOpen(false)}
                      className="px-2 py-0.5 rounded bg-[#14539E] text-white font-semibold hover:bg-[#10427f] cursor-pointer transition-colors"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Danh sách thẻ nhân sự đã tích chọn gọn bên dưới ô tìm kiếm */}
            {currentSelectedEmployeeIds.length > 0 && (
              <div
                data-testid="selected-employee-chips"
                className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-0.5"
              >
                {currentSelectedEmployeeIds.map((empId) => {
                  const emp = employeeMap.get(empId);
                  if (!emp) return null;
                  const empStartTime = customTimes[emp.id]?.startTime || currentStartTime;
                  const empEndTime = customTimes[emp.id]?.endTime || currentEndTime;
                  const isCustomized = !!customTimes[emp.id];
                  const isEditingThis = editingTimeEmpId === emp.id;

                  return (
                    <div
                      key={emp.id}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] max-w-full transition-colors ${
                        isCustomized
                          ? 'bg-amber-50/90 border-amber-300 text-slate-800'
                          : 'bg-blue-50/75 border-blue-200 text-slate-800'
                      }`}
                    >
                      <span className="font-medium truncate max-w-[135px]" title={`${emp.fullName} (${emp.employeeCode})`}>
                        {emp.fullName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        ({emp.employeeCode})
                      </span>

                      {isEditingThis ? (
                        <div className="flex items-center gap-0.5 bg-white px-1 py-0.5 rounded border border-[#14539E]">
                          <input
                            type="text"
                            maxLength={5}
                            aria-label={`Giờ bắt đầu của ${emp.fullName}`}
                            value={empStartTime}
                            onChange={(e) =>
                              setCustomTimes((prev) => ({
                                ...prev,
                                [emp.id]: {
                                  startTime: OvertimeFormService.sanitize24hTimeInput(e.target.value),
                                  endTime: prev[emp.id]?.endTime || currentEndTime,
                                },
                              }))
                            }
                            onBlur={() =>
                              setCustomTimes((prev) => ({
                                ...prev,
                                [emp.id]: {
                                  startTime: OvertimeFormService.normalize24hTime(empStartTime, currentStartTime),
                                  endTime: prev[emp.id]?.endTime || currentEndTime,
                                },
                              }))
                            }
                            className="w-10 h-4 text-[10px] font-mono text-center border border-slate-200 rounded px-0.5 focus:outline-none focus:border-[#14539E]"
                            placeholder="16:10"
                          />
                          <span className="text-[10px] text-slate-400">-</span>
                          <input
                            type="text"
                            maxLength={5}
                            aria-label={`Giờ kết thúc của ${emp.fullName}`}
                            value={empEndTime}
                            onChange={(e) =>
                              setCustomTimes((prev) => ({
                                ...prev,
                                [emp.id]: {
                                  startTime: prev[emp.id]?.startTime || currentStartTime,
                                  endTime: OvertimeFormService.sanitize24hTimeInput(e.target.value),
                                },
                              }))
                            }
                            onBlur={() =>
                              setCustomTimes((prev) => ({
                                ...prev,
                                [emp.id]: {
                                  startTime: prev[emp.id]?.startTime || currentStartTime,
                                  endTime: OvertimeFormService.normalize24hTime(empEndTime, currentEndTime),
                                },
                              }))
                            }
                            className="w-10 h-4 text-[10px] font-mono text-center border border-slate-200 rounded px-0.5 focus:outline-none focus:border-[#14539E]"
                            placeholder="20:10"
                          />
                          <button
                            type="button"
                            onClick={() => setEditingTimeEmpId(null)}
                            className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Xong"
                            aria-label={`Lưu giờ riêng của ${emp.fullName}`}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                          </button>
                          {isCustomized && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomTimes((prev) => {
                                  const next = { ...prev };
                                  delete next[emp.id];
                                  return next;
                                });
                                setEditingTimeEmpId(null);
                              }}
                              className="p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                              title="Khôi phục giờ chung"
                              aria-label={`Khôi phục giờ chung cho ${emp.fullName}`}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingTimeEmpId(emp.id)}
                          className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded border transition-colors cursor-pointer shrink-0 ${
                            isCustomized
                              ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                              : 'bg-white/80 text-slate-500 border-slate-200 hover:border-[#14539E] hover:text-[#14539E]'
                          }`}
                          title="Bấm để sửa giờ tăng ca riêng"
                          aria-label={`Sửa giờ riêng cho ${emp.fullName}`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{empStartTime}-{empEndTime}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          handleToggleEmployee(emp.id);
                          setCustomTimes((prev) => {
                            if (!prev[emp.id]) return prev;
                            const next = { ...prev };
                            delete next[emp.id];
                            return next;
                          });
                          if (editingTimeEmpId === emp.id) setEditingTimeEmpId(null);
                        }}
                        aria-label={`Bỏ chọn ${emp.fullName}`}
                        title={`Bỏ chọn ${emp.fullName}`}
                        className="p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer shrink-0 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* HÀNG 4: TỪ ĐIỂN MẪU & LÝ DO VIỆT - HÀN */}
          <div className="space-y-2">
            <div>
              <label
                htmlFor="overtime-glossary-select"
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 mb-1"
              >
                <BookOpen className="w-3 h-3 text-[#14539E]" />
                <span>Mẫu lý do đã lưu ({glossaryEntries.length})</span>
              </label>
              <select
                id="overtime-glossary-select"
                value=""
                onChange={(e) => handleSelectGlossaryTemplate(e.target.value)}
                aria-label="Mẫu lý do đã lưu"
                className="w-full h-8 px-2 text-xs font-medium text-slate-700 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-slate-300 focus:outline-none focus:border-[#14539E] focus:bg-white cursor-pointer"
              >
                <option value="">-- Chọn nhanh mẫu câu Việt - Hàn --</option>
                {glossaryEntries.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.reasonVi} — {item.reasonKr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="overtime-reason-vi"
                className="block text-[11px] font-semibold text-slate-600"
              >
                Lý do (Tiếng Việt)
              </label>
              {isAutoTranslating && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#14539E]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Đang dịch...</span>
                </span>
              )}
            </div>
            <textarea
              id="overtime-reason-vi"
              rows={2}
              value={currentReasonVi}
              onChange={(e) => setCurrentReasonVi(e.target.value)}
              placeholder="VD: Trực sản xuất, hỗ trợ sản xuất gấp..."
              className="w-full p-2 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E]/20 transition-all"
            />

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <label
                htmlFor="overtime-reason-kr"
                className="block text-[11px] font-semibold text-slate-600 truncate"
              >
                Lý do (Tiếng Hàn)
              </label>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isAutoTranslating || !currentReasonVi.trim()}
                  onClick={handleSuggestTranslation}
                  className="h-6 px-2 rounded-md border border-[#14539E]/30 bg-blue-50/70 hover:bg-[#14539E] hover:text-white text-[#14539E] text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                  title="Dịch gợi ý theo ngữ cảnh làm thêm giờ nhà máy"
                >
                  {isAutoTranslating ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-2.5 h-2.5" />
                  )}
                  <span>Dịch gợi ý</span>
                </button>
                <button
                  type="button"
                  disabled={!currentReasonVi.trim() || !currentReasonKr.trim()}
                  onClick={handleSaveGlossaryTemplate}
                  className="h-6 px-2 rounded-md border border-slate-200 bg-white hover:border-[#14539E] hover:text-[#14539E] text-slate-600 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                  title="Lưu cặp Việt - Hàn hiện tại vào từ điển nội bộ"
                >
                  <BookmarkPlus className="w-2.5 h-2.5" />
                  <span>+ Lưu mẫu</span>
                </button>
              </div>
            </div>
            <textarea
              id="overtime-reason-kr"
              rows={2}
              value={currentReasonKr}
              onChange={(e) => {
                setCurrentReasonKr(e.target.value);
                setIsReasonKrManuallyEdited(true);
              }}
              placeholder="생산 당직 (Tự động điền từ từ điển hoặc bấm Dịch gợi ý)..."
              className="w-full p-2 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E]/20 transition-all"
            />
          </div>

        </div>

        {/* ĐÁY CỘT TRÁI CỐ ĐỊNH: NÚT GHI NHẬN & DANH SÁCH NHÓM ĐÃ GHI NHẬN */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
          {/* HÀNG 5 */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCommitBlock} className="flex-1 h-10 rounded-xl bg-[#14539E] hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] whitespace-nowrap">
              {editingBlockId ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Plus className="w-4 h-4 stroke-[2.5]" />}
              <span>{editingBlockId ? 'Cập nhật nhóm' : 'Ghi nhận'}</span>
            </button>
            {editingBlockId && (
              <button
                type="button"
                onClick={handleCancelBlockEdit}
                className="h-10 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                Hủy
              </button>
            )}
          </div>

          {/* HÀNG 6 */}
          {previewData.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between gap-2">
                <span className="truncate">Các nhóm đã ghi nhận ({previewData.length}):</span>
                <span className="text-[10px] font-normal text-slate-500 shrink-0 whitespace-nowrap tabular-nums">{summaryStats.datesCount} ngày • {summaryStats.totalParticipants} lượt</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {previewData.map((b, idx) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs shadow-2xs transition-colors ${
                      editingBlockId === b.id
                        ? 'bg-blue-50/80 border-[#14539E]'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#14539E]">#{idx + 1}</span>
                        <span className="font-bold text-slate-800 font-mono text-[11px]">[{formatDateToFormStyle(b.overtimeDate)}]</span>
                        <span className="text-slate-800 font-medium truncate">{b.reasonVi || 'Không có lý do'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{b.selectedEmployeeIds.length} nhân sự • {b.startTime}-{b.endTime}</div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => handleEditPreviewBlock(idx)} className="p-1 rounded text-[#14539E] hover:bg-blue-50 cursor-pointer" title="Sửa nhóm"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => handleMoveBlock(idx, 'up')} disabled={idx === 0} className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer" title="Lên"><ChevronUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => handleMoveBlock(idx, 'down')} disabled={idx === previewData.length - 1} className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer" title="Xuống"><ChevronDown className="w-4 h-4" /></button>
                      <button type="button" onClick={() => handleRemovePreviewBlock(idx)} className="p-1 rounded text-red-500 hover:bg-red-50 cursor-pointer ml-0.5" title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CỘT PHẢI (2/3) - A4 PREVIEW */}
      <div className="w-full lg:w-2/3 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner flex flex-col lg:h-full min-h-0 overflow-hidden relative">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-start">
          <div style={{ fontFamily: "'Times New Roman', 'Malgun Gothic', Arial, sans-serif" }} className="bg-white shadow-2xl p-6 sm:p-8 w-full max-w-[794px] min-h-[1123px] shrink-0 mx-auto text-black rounded-sm space-y-4 flex flex-col">
            <div className="flex items-center justify-between text-xs mb-2">
              <span>Transon Viet nam Co., Ltd</span><span className="pr-12">Biểu mẫu số: TV-PSGC2022</span>
            </div>

            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="pt-3">
                <div className="text-lg font-bold leading-snug">PHIẾU ĐỀ NGHỊ LÀM THÊM</div>
                <div className="text-base font-bold leading-snug">잔업. 특근 신청서</div>
                <div
                  data-testid="tv-psgc-header-date"
                  className="text-[11px] mt-1 font-normal text-black"
                >
                  Ngày phiếu / 작성일:{' '}
                  <span className="font-bold">
                    {formatDateToFormStyle(representativeOvertimeDate)}
                  </span>
                </div>
              </div>
              <table className="border-collapse border border-black text-[11px] text-center">
                <thead>
                  <tr>
                    <th className="border border-black px-2 py-0.5 font-normal">결</th>
                    <th className="border border-black px-3 py-0.5 font-normal">작성</th>
                    <th className="border border-black px-3 py-0.5 font-normal">검사</th>
                    <th className="border border-black px-3 py-0.5 font-normal">검사</th>
                    <th className="border border-black px-3 py-0.5 font-normal">검사</th>
                    <th className="border border-black px-3 py-0.5 font-normal">승인</th>
                  </tr>
                  <tr>
                    <th className="border border-black px-2 py-0.5 font-normal">xác</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Người lập</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Kiểm tra</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Kiểm tra</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Kiểm tra</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Phê duyệt</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-14">
                    <td className="border border-black px-2 align-bottom pb-1 text-[10px]"><div>nhận</div><div className="border-t border-black mt-0.5 pt-0.5">재</div></td>
                    <td className="border border-black w-16" /><td className="border border-black w-16" /><td className="border border-black w-16" /><td className="border border-black w-16" /><td className="border border-black w-16" />
                  </tr>
                </tbody>
              </table>
            </div>

            <table className="w-full border-collapse text-[11px]">
              <tbody>
                {printableDateGroups.map((dateGroup, dateIdx) => (
                  <React.Fragment key={dateGroup.date}>
                    <tr className={dateIdx === 0 ? 'h-7' : 'h-9'}>
                      <td colSpan={4} className={`border-0 bg-transparent text-left align-middle text-xs font-bold text-black ${dateIdx === 0 ? 'pb-1.5' : 'pt-3 pb-1.5'}`}>
                        {dateIdx === 0 ? formatDepartmentHeaderLabel(selectedDepartment) : ''}
                      </td>
                      <td colSpan={3} className={`border-0 bg-transparent text-center align-middle text-xs font-bold text-black ${dateIdx === 0 ? 'pb-1.5' : 'pt-3 pb-1.5'}`}>
                        {dateGroup.formattedDate}
                      </td>
                    </tr>
                    <tr className="text-center font-normal">
                      <th className="border border-black px-1.5 py-1 w-8 font-normal">No</th>
                      <th className="border border-black px-2 py-1 w-44 font-normal">Danh sách làm thêm</th>
                      <th className="border border-black px-2 py-1 font-normal">Lý do làm thêm</th>
                      <th className="border border-black px-2 py-1 w-20 font-normal">Giờ bắt đầu</th>
                      <th className="border border-black px-2 py-1 w-20 font-normal">Giờ kết thúc</th>
                      <th className="border border-black px-2 py-1 w-24 font-normal">Tổng thời gian</th>
                      <th className="border border-black px-2 py-1 w-20 font-normal">Ký nhận</th>
                    </tr>
                    <tr className="text-center font-normal">
                      <th className="border border-black px-1.5 py-1 font-normal" />
                      <th className="border border-black px-2 py-1 font-normal">명단</th>
                      <th className="border border-black px-2 py-1 font-normal">잔업. 특근사유</th>
                      <th className="border border-black px-2 py-1 font-normal">시작</th>
                      <th className="border border-black px-2 py-1 font-normal">종료</th>
                      <th className="border border-black px-2 py-1 font-normal">총 시간</th>
                      <th className="border border-black px-2 py-1 font-normal">싸인</th>
                    </tr>
                    {dateGroup.blocks.map((group) =>
                      group.rows.map((row) => (
                        <tr key={`${group.blockId}-${row.no}`} className="h-7">
                          <td className="border border-black px-1.5 py-1 text-center font-normal">{row.no}</td>
                          <td className="border border-black px-2 py-1 text-left font-normal">{row.fullName}</td>
                          {row.isFirstInBlock && <td rowSpan={row.rowSpan} className="border border-black px-2.5 py-1.5 text-left align-middle whitespace-pre-line font-normal">{row.combinedReason}</td>}
                          <td className={`border border-black px-2 py-1 text-center align-middle ${isTimeBold(row.startTimeFormatted) ? 'font-bold' : 'font-normal'}`}>{row.startTimeFormatted}</td>
                          <td className={`border border-black px-2 py-1 text-center align-middle ${isTimeBold(row.endTimeFormatted) ? 'font-bold' : 'font-normal'}`}>{row.endTimeFormatted}</td>
                          <td className="border border-black px-2 py-1 text-center align-middle" />
                          <td className="border border-black px-2 py-1 text-center align-middle" />
                        </tr>
                      ))
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] space-y-0.5 leading-snug">
              <div>Ghi chú 비고</div>
              <div>1) Nếu phát sinh dài hạn ghi rõ vào đây: từ năm 2022/........./............~ 2022/........./ ............</div>
              <div>Phát sinh giờ ghi ở biểu trên/ 긴시간 발생할 경우 는 여기서 기록할것</div>
            </div>
          </div>
        </div>

        {/* CẢNH BÁO / NHẮC NHỞ TRÙNG NGÀY & QUY TẮC NGÀY ĐẠI DIỆN */}
        {(dateConflictEval.mode === 'single_day_blocked' ||
          dateConflictEval.mode === 'representative_date_blocked') && (
          <div
            role="alert"
            data-testid="overtime-duplicate-block-banner"
            className="shrink-0 bg-red-50 border-t border-red-200 px-4 sm:px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-900 leading-relaxed">
                {dateConflictEval.mode === 'single_day_blocked' ? (
                  <>
                    <span className="font-bold">
                      Ngày {formatDateToFormStyle(dateConflictEval.uniqueDates[0])} đã
                      tồn tại trong Nhật ký
                    </span>{' '}
                    — mã phiếu:{' '}
                    <span className="font-mono font-bold text-red-700">
                      {uniqueConflictCodes.join(', ')}
                    </span>
                    . Mỗi ngày chỉ được tạo 1 phiếu — vui lòng mở lại phiếu cũ để chỉnh
                    sửa, hoặc ghi nhận thêm ngày tăng ca khác (từ 2 ngày trở lên) nếu
                    cần lập phiếu điều chỉnh phát sinh giờ.
                  </>
                ) : (
                  <>
                    <span className="font-bold">
                      Ngày lập phiếu hôm nay (
                      {formatDateToFormStyle(representativeOvertimeDate)}) đã có phiếu
                    </span>{' '}
                    — mã phiếu:{' '}
                    <span className="font-mono font-bold text-red-700">
                      {uniqueConflictCodes.join(', ')}
                    </span>
                    . Mỗi ngày chỉ được tạo 1 phiếu — vui lòng mở lại phiếu hôm nay để
                    bổ sung/điều chỉnh trực tiếp.
                  </>
                )}
              </div>
            </div>
            {onOpenExistingForm && dateConflictEval.conflictingForms[0] && (
              <button
                type="button"
                onClick={() =>
                  onOpenExistingForm(dateConflictEval.conflictingForms[0])
                }
                className="h-8 px-3 rounded-lg border border-red-300 bg-white hover:bg-red-100 text-red-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                <Pencil className="w-3 h-3" />
                <span>Mở phiếu cũ để sửa</span>
              </button>
            )}
          </div>
        )}

        {dateConflictEval.mode === 'multi_day_reminder' && (
          <div
            role="status"
            data-testid="overtime-multiday-reminder-banner"
            className="shrink-0 bg-amber-50 border-t border-amber-200 px-4 sm:px-5 py-2 flex items-start gap-2.5"
          >
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold">
                Phiếu gộp {formatNumberVN(dateConflictEval.uniqueDates.length)} ngày (cho phép lưu):
              </span>{' '}
              Ngày{' '}
              <span className="font-mono font-semibold">
                {dateConflictEval.conflicts
                  .map(
                    (c) =>
                      `${formatDateToFormStyle(c.date)} (${Array.from(
                        new Set(c.forms.map((f) => f.form_code))
                      ).join(', ')})`
                  )
                  .join('; ')}
              </span>{' '}
              đã có phiếu trước đó. Ngày đại diện của phiếu tự động gán là hôm nay (
              <strong className="font-mono">
                {formatDateToFormStyle(representativeOvertimeDate)}
              </strong>
              ); báo cáo Giờ Tăng ca sẽ ưu tiên giờ của phiếu mới nhất cho ngày trùng để tránh cộng đúp.
            </div>
          </div>
        )}

        {dateConflictEval.mode === 'none' &&
          dateConflictEval.uniqueDates.length >= 2 && (
            <div
              data-testid="overtime-multiday-date-info"
              className="shrink-0 bg-blue-50/70 border-t border-blue-200/80 px-4 sm:px-5 py-2 flex items-center gap-2 text-xs text-[#14539E]"
            >
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>
                Phiếu gồm{' '}
                <strong>{formatNumberVN(dateConflictEval.uniqueDates.length)} ngày</strong>: ngày
                đại diện của phiếu tự động ghi nhận hôm nay (
                <strong className="font-mono">
                  {formatDateToFormStyle(representativeOvertimeDate)}
                </strong>
                ), từng nhóm vẫn giữ nguyên ngày tăng ca thực tế.
              </span>
            </div>
          )}

        {/* CÁC NÚT FOOTER ĐÃ ĐƯỢC CẬP NHẬT (LƯU & XUẤT EXCEL RIÊNG BIỆT) */}
        <div className="py-3 px-4 sm:px-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="text-xs text-slate-500 min-w-0 truncate">
            Biểu mẫu: <strong className="font-mono text-slate-700">TV-PSGC2022</strong> • Ngày phiếu:{' '}
            <strong className="font-mono text-[#14539E]">
              {formatDateToFormStyle(representativeOvertimeDate)}
            </strong>{' '}
            • Tổng số nhóm:{' '}
            <strong className="font-mono text-slate-700">{formatNumberVN(summaryStats.blockCount)}</strong> ({formatNumberVN(summaryStats.totalParticipants)} lượt • {summaryStats.datesCount} ngày)
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            
            <button
              type="button"
              disabled={
                isCheckingExistingForms ||
                isSubmitting ||
                previewData.length === 0 ||
                dateConflictEval.isBlocked
              }
              onClick={handleSaveOnly}
              title={
                dateConflictEval.isBlocked
                  ? 'Bị chặn do trùng ngày tăng ca (mỗi ngày chỉ được tạo 1 phiếu)'
                  : undefined
              }
              className="h-9 px-4 sm:px-5 rounded-lg border border-[#14539E] bg-[#14539E] text-white hover:bg-[#0F3E77] text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{editingForm ? 'Cập nhật phiếu' : 'Lưu'}</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting || previewData.length === 0}
              onClick={handleExportExcelOnly}
              className="h-9 px-4 sm:px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-white" />}
              <span>Xuất Excel</span>
            </button>

          </div>
        </div>
      </div>

      {toastMessage && (
        <div role="status" className="fixed top-16 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs font-medium max-w-md animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
};

export default CreateOvertimeForm;