import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CalendarHeart,
  Camera,
  Check,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Info,
  Save,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';  
import { DepartmentGroup, Employee, LeaveRecord } from '../../../types/hr';
import { INITIAL_DEPARTMENT_GROUPS, INITIAL_EMPLOYEES } from '../../../data/mockData';
import {
  formatNumberVN,
  getFriendlyErrorMessage,
} from '../../../utils/errorAndSecurityService';
import {
  buildOnLeaveEmployeeMapForDate,
  DEFAULT_OVERTIME_DEPARTMENT,
  evaluateOvertimeDateConflict,
  fetchActiveLeaveRecordsForOvertimeCheck,
  fetchOvertimeGlossary,
  filterAndSortGlossaryForCombobox,
  findExactGlossaryMatch,
  formatOvertimeFormCodeDisplay,
  generateOvertimeFormCode,
  getLeaveTypeShortLabel,
  getLocalTodayIsoDate,
  isOvertimeFormLocked,
  normalizeTargetGroups,
  OvertimeFormWithItems,
  OvertimeGlossaryEntry,
  OvertimeLeaveCheckEntry,
  reconstructBlocksFromItems,
  resolveOvertimeMainDepartment,
  suggestFactoryKoreanTranslation,
  upsertOvertimeGlossaryEntry,
} from '../../../services/hrService';
import {
  buildCombinedReasonText,
  formatDateToFormStyle,
  formatDepartmentHeaderLabel,
  formatTimeToFormStyle,
  overtimeExportService,
} from '../../../utils/overtimeExportService';
import {
  calculateActualOvertimeHours,
  type CompanyHoliday,
  createDefaultAdminShift,
  DEFAULT_OVERTIME_SETTINGS,
  evaluateOvertimeDaySchedule,
  getWeekdayKeyFromIsoDate,
  normalize24hTime,
  type OvertimeDayEvaluation,
  type OvertimeSettings,
  sanitize24hTimeInput,
  type WorkShift,
} from '../../../utils/workScheduleLogic';
import {
  ConfirmableOvertimeBlockPayload,
  ZaloScheduleScanModal,
} from './ZaloScheduleScanModal';
import { parseOvertimeScheduleImage } from '../../../services/overtimeImageService';

export interface OvertimeParticipant {
  employeeId: string;
  startTime: string;
  endTime: string;
  totalHours?: number;
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
  leaveRecords?: LeaveRecord[];
  existingForms?: OvertimeFormWithItems[];
  isCheckingExistingForms?: boolean;
  initialDepartment?: string;
  initialDate?: string;
  editingForm?: OvertimeFormWithItems | null;
  glossaryRefreshKey?: number;
  glossaryEntries?: OvertimeGlossaryEntry[];
  workShifts?: WorkShift[];
  companyHolidays?: CompanyHoliday[];
  overtimeSettings?: OvertimeSettings;
  onGlossaryEntriesUpdated?: (entries: OvertimeGlossaryEntry[]) => void;
  onOpenExistingForm?: (form: OvertimeFormWithItems) => void;
  onCancelEdit?: () => void;
  onSaveOnly?: (payload: CreateOvertimeFormPayload, isAutoSave?: boolean) => Promise<void> | void;
}

class OvertimeFormService {
  static createEmptyBlock(defaultDate = getLocalTodayIsoDate()): OvertimeTaskBlock {
    return {
      id: `ot-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      overtimeDate: defaultDate,
      reasonVi: '',
      reasonKr: '',
      startTime: '16:10',
      endTime: '18:10',
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
    return sanitize24hTimeInput(raw);
  }

  static normalize24hTime(raw: string, fallback: string): string {
    return normalize24hTime(raw, fallback);
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

const DRAFT_STORAGE_KEY = 'ot_form_draft_v1';

async function translateMultilineKorean(
  reasonVi: string,
  glossaryEntries: OvertimeGlossaryEntry[]
): Promise<string> {
  const lines = reasonVi.split(/\r?\n/);
  const translatedLines = await Promise.all(
    lines.map(async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      const exact = findExactGlossaryMatch(glossaryEntries, trimmed);
      if (exact) return exact.reasonKr;
      const { translation } = await suggestFactoryKoreanTranslation(
        trimmed,
        glossaryEntries
      );
      return translation.replace(/\s*\n\s*/g, ' ').trim();
    })
  );
  return translatedLines.join('\n');
}

export const CreateOvertimeForm: React.FC<CreateOvertimeFormProps> = ({
  employees = INITIAL_EMPLOYEES,
  groups = INITIAL_DEPARTMENT_GROUPS,
  leaveRecords: propLeaveRecords = [],
  existingForms = [],
  isCheckingExistingForms = false,
  initialDepartment = DEFAULT_OVERTIME_DEPARTMENT,
  initialDate = getLocalTodayIsoDate(),
  editingForm = null,
  glossaryRefreshKey = 0,
  glossaryEntries: propGlossaryEntries,
  workShifts: propWorkShifts,
  companyHolidays = [],
  overtimeSettings = DEFAULT_OVERTIME_SETTINGS,
  onGlossaryEntriesUpdated,
  onOpenExistingForm,
  onCancelEdit,
  onSaveOnly,
}) => {

  const shellOvertimeDate = useMemo(
    () => editingForm?.overtime_date || initialDate || getLocalTodayIsoDate(),
    [editingForm?.overtime_date, initialDate]
  );
  const shellFormCode = useMemo(
    () =>
      editingForm
        ? formatOvertimeFormCodeDisplay(editingForm.form_code)
        : generateOvertimeFormCode(shellOvertimeDate),
    [editingForm, shellOvertimeDate]
  );
  const isLockedForm = useMemo(
    () => isOvertimeFormLocked(editingForm),
    [editingForm]
  );

  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [blockOvertimeDate, setBlockOvertimeDate] = useState<string>(() =>
    editingForm?.overtime_date || initialDate || getLocalTodayIsoDate()
  );
  const [previewData, setPreviewData] = useState<OvertimeTaskBlock[]>(() => {
    if (editingForm) {
      return reconstructBlocksFromItems(editingForm.items).map((b) => ({
        ...b,
        isTranslating: false,
      }));
    }
    return [];
  });
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const [currentStartTime, setCurrentStartTime] = useState<string>('17:00');
  const [currentEndTime, setCurrentEndTime] = useState<string>('19:00');
  const [isStartTimeManuallyEdited, setIsStartTimeManuallyEdited] = useState<boolean>(false);
  const [isEndTimeManuallyEdited, setIsEndTimeManuallyEdited] = useState<boolean>(false);
  const [currentSelectedEmployeeIds, setCurrentSelectedEmployeeIds] = useState<string[]>([]);
  const [customTimes, setCustomTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [editingTimeEmpId, setEditingTimeEmpId] = useState<string | null>(null);
  const [isAiScanModalOpen, setIsAiScanModalOpen] = useState<boolean>(false);
  
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState<boolean>(false);
  const employeePickerRef = useRef<HTMLDivElement | null>(null);
  
  const [currentReasonVi, setCurrentReasonVi] = useState<string>(() =>
    editingForm && editingForm.items.length > 0 ? '' : 'Trực sản xuất'
  );
  const [currentReasonKr, setCurrentReasonKr] = useState<string>(() =>
    editingForm && editingForm.items.length > 0 ? '' : '생산 당직'
  );
  const [isReasonKrManuallyEdited, setIsReasonKrManuallyEdited] = useState<boolean>(false);
  const isGlossaryControlled = propGlossaryEntries !== undefined;
  const [internalGlossaryEntries, setInternalGlossaryEntries] = useState<OvertimeGlossaryEntry[]>([]);
  const glossaryEntries = isGlossaryControlled
    ? propGlossaryEntries
    : internalGlossaryEntries;
  const updateGlossaryState = (nextEntries: OvertimeGlossaryEntry[]) => {
    if (!isGlossaryControlled) {
      setInternalGlossaryEntries(nextEntries);
    }
    onGlossaryEntriesUpdated?.(nextEntries);
  };
  const [isAutoTranslating, setIsAutoTranslating] = useState<boolean>(false);
  const isInitialReasonMountRef = useRef<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCommittingBlock, setIsCommittingBlock] = useState<boolean>(false);
  
  const [liveLeaveRecords, setLiveLeaveRecords] = useState<OvertimeLeaveCheckEntry[] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // MỚI: State cho Combobox Lý do
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState<boolean>(false);
  const reasonDropdownRef = useRef<HTMLDivElement | null>(null);

  // MỚI: Đóng Combobox Lý do khi click ra ngoài
  useEffect(() => {
    if (!isReasonDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        reasonDropdownRef.current &&
        !reasonDropdownRef.current.contains(event.target as Node)
      ) {
        setIsReasonDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isReasonDropdownOpen]);

  const selectedEmployeeDepartments = useMemo(() => {
    const depts: string[] = [];
    for (const empId of currentSelectedEmployeeIds) {
      const dept = (employees.find((e) => e.id === empId)?.department || '').trim();
      if (dept) depts.push(dept);
    }
    return normalizeTargetGroups(depts);
  }, [currentSelectedEmployeeIds, employees]);

  const effectiveWorkShifts = useMemo<WorkShift[]>(
    () =>
      propWorkShifts && propWorkShifts.length > 0
        ? propWorkShifts
        : [createDefaultAdminShift()],
    [propWorkShifts]
  );

  const dayEvaluation = useMemo(
    () =>
      evaluateOvertimeDaySchedule({
        isoDate: blockOvertimeDate || shellOvertimeDate || getLocalTodayIsoDate(),
        holidays: companyHolidays,
        shifts: effectiveWorkShifts,
        departmentName: selectedGroupFilter,
        employeeDepartments: selectedEmployeeDepartments,
      }),
    [
      blockOvertimeDate,
      shellOvertimeDate,
      companyHolidays,
      effectiveWorkShifts,
      selectedGroupFilter,
      selectedEmployeeDepartments,
    ]
  );

  useEffect(() => {
    if (!editingBlockId && !isStartTimeManuallyEdited) {
      setCurrentStartTime(dayEvaluation.suggestedStartTime);
    }
  }, [editingBlockId, isStartTimeManuallyEdited, dayEvaluation.suggestedStartTime]);

  useEffect(() => {
    if (!editingBlockId && !isEndTimeManuallyEdited) {
      setCurrentEndTime(dayEvaluation.suggestedDefaultEndTime);
    }
  }, [editingBlockId, isEndTimeManuallyEdited, dayEvaluation.suggestedDefaultEndTime]);

  const isSundayOrWeekendSchedule = (
    evalResult: OvertimeDayEvaluation,
    isoDate: string
  ): boolean =>
    evalResult.dayKind === 'weekly_off' ||
    evalResult.dayKind === 'holiday' ||
    evalResult.dayKind === 'compensatory_off' ||
    (Boolean(isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) &&
      getWeekdayKeyFromIsoDate(isoDate) === 'sun');

  // MỚI: Chỉ hiển thị các lý do Đã duyệt, ưu tiên theo Nhóm/Phòng ban đang chọn hoặc nhân sự đang tick
  const filteredGlossary = useMemo(
    () =>
      filterAndSortGlossaryForCombobox({
        entries: glossaryEntries,
        selectedGroupFilter,
        selectedEmployeeDepartments,
        searchText: currentReasonVi,
      }),
    [
      glossaryEntries,
      selectedGroupFilter,
      selectedEmployeeDepartments,
      currentReasonVi,
    ]
  );


  useEffect(() => {
    if (isGlossaryControlled) return;
    let active = true;
    void fetchOvertimeGlossary().then((loaded) => {
      if (active) setInternalGlossaryEntries(loaded);
    });
    return () => {
      active = false;
    };
  }, [isGlossaryControlled, glossaryRefreshKey]);

  useEffect(() => {
    let active = true;
    void fetchActiveLeaveRecordsForOvertimeCheck(employees).then((res) => {
      if (active && res.source === 'supabase') {
        setLiveLeaveRecords(res.records);
      }
    });
    return () => {
      active = false;
    };
  }, [blockOvertimeDate, employees, propLeaveRecords]);

  useEffect(() => {
    if (editingForm) {
      const reconstructed = reconstructBlocksFromItems(editingForm.items).map((b) => ({
        ...b,
        isTranslating: false,
      }));
      const formDate = editingForm.overtime_date || initialDate || getLocalTodayIsoDate();
      setSelectedGroupFilter('ALL');
      setBlockOvertimeDate(formDate);
      setPreviewData(reconstructed);
      setEditingBlockId(null);
      setIsStartTimeManuallyEdited(false);
      setIsEndTimeManuallyEdited(false);
      setCurrentSelectedEmployeeIds([]);
      setCustomTimes({});
      setEditingTimeEmpId(null);
      setEmployeeSearchQuery('');
      setIsEmployeeDropdownOpen(false);
      isInitialReasonMountRef.current = true;
      if (reconstructed.length === 0) {
        setCurrentReasonVi('Trực sản xuất');
        setCurrentReasonKr('생산 당직');
      } else {
        setCurrentReasonVi('');
        setCurrentReasonKr('');
      }
      setIsReasonKrManuallyEdited(false);
    }
  }, [editingForm, initialDate]);

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

  useEffect(() => {
    if (editingForm) {
      localStorage.removeItem(`${DRAFT_STORAGE_KEY}_preview`);
    }
  }, [editingForm]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleConfirmAiModalPayloads = async (
    payloads: ConfirmableOvertimeBlockPayload[]
  ) => {
    if (isLockedForm) {
      throw new Error('Phiếu tăng ca đã chốt, không thể thêm nhóm mới.');
    }

    const latestLeaveCheck = await fetchActiveLeaveRecordsForOvertimeCheck(employees).catch(() => null);
    const recordsToCheck =
      latestLeaveCheck && latestLeaveCheck.source === 'supabase'
        ? latestLeaveCheck.records
        : effectiveLeaveRecords;
    if (latestLeaveCheck && latestLeaveCheck.source === 'supabase') {
      setLiveLeaveRecords(latestLeaveCheck.records);
    }

    const newBlocks: OvertimeTaskBlock[] = [];
    const skippedOnLeaveAll: string[] = [];

    for (let i = 0; i < payloads.length; i += 1) {
      const payload = payloads[i];
      const resolvedDate =
        payload.overtimeDate || shellOvertimeDate || getLocalTodayIsoDate();
      const latestOnLeaveMap = buildOnLeaveEmployeeMapForDate(
        resolvedDate,
        recordsToCheck,
        employees
      );

      const validEmployeeIds: string[] = [];
      for (const empId of payload.selectedEmployeeIds) {
        if (latestOnLeaveMap.has(empId)) {
          skippedOnLeaveAll.push(employeeMap.get(empId)?.fullName || empId);
        } else {
          validEmployeeIds.push(empId);
        }
      }

      if (validEmployeeIds.length === 0) {
        throw new Error(
          `Tất cả nhân sự trong nhóm "${payload.reasonVi}" đều đang có đơn nghỉ ngày ${formatDateToFormStyle(
            resolvedDate
          )}.`
        );
      }

      const normalizedStart = OvertimeFormService.normalize24hTime(
        payload.startTime,
        '16:10'
      );
      const normalizedEnd = OvertimeFormService.normalize24hTime(
        payload.endTime,
        '18:10'
      );
      const cleanReasonVi = payload.reasonVi.trim();
      const finalReasonKr = payload.reasonKr.trim()
        ? payload.reasonKr.trim()
        : await translateMultilineKorean(cleanReasonVi, glossaryEntries);

      if (cleanReasonVi && finalReasonKr) {
        const existingGlossary = findExactGlossaryMatch(
          glossaryEntries,
          cleanReasonVi
        );
        if (!existingGlossary) {
          const blockDepartments = normalizeTargetGroups(
            validEmployeeIds.map((id) => employeeMap.get(id)?.department || '')
          );
          void upsertOvertimeGlossaryEntry(cleanReasonVi, finalReasonKr, {
            isVerified: false,
            targetGroups: blockDepartments,
          }).then(({ entries }) => updateGlossaryState(entries));
        } else if (finalReasonKr !== existingGlossary.reasonKr.trim()) {
          void upsertOvertimeGlossaryEntry(cleanReasonVi, finalReasonKr).then(
            ({ entries }) => updateGlossaryState(entries)
          );
        }
      }

      const participants: OvertimeParticipant[] = validEmployeeIds.map((empId) => {
        const custom = payload.customTimes[empId];
        const pStart = custom?.startTime
          ? OvertimeFormService.normalize24hTime(custom.startTime, normalizedStart)
          : normalizedStart;
        const pEnd = custom?.endTime
          ? OvertimeFormService.normalize24hTime(custom.endTime, normalizedEnd)
          : normalizedEnd;
        const netRes = getNetHoursForParticipant(resolvedDate, empId, pStart, pEnd);
        return {
          employeeId: empId,
          startTime: pStart,
          endTime: pEnd,
          totalHours: netRes.netHours,
        };
      });

      newBlocks.push({
        id: `ot-block-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        overtimeDate: resolvedDate,
        reasonVi: cleanReasonVi,
        reasonKr: finalReasonKr,
        startTime: normalizedStart,
        endTime: normalizedEnd,
        selectedEmployeeIds: validEmployeeIds,
        participants,
        isTranslating: false,
      });
    }

    const updatedBlocks = [...previewData, ...newBlocks];
    setPreviewData(updatedBlocks);

    if (onSaveOnly) {
      await onSaveOnly(
        {
          department: formDepartment,
          overtimeDate: shellOvertimeDate,
          blocks: updatedBlocks,
        },
        true
      );
    }

    setIsAiScanModalOpen(false);
    const leaveSuffix =
      skippedOnLeaveAll.length > 0
        ? ` (đã bỏ qua ${skippedOnLeaveAll.length} người đang nghỉ)`
        : '';
    showToast(
      newBlocks.length > 1
        ? `Đã ghi nhận và tự động lưu ${newBlocks.length} nhóm tăng ca từ ảnh Zalo thành công!${leaveSuffix}`
        : `Đã ghi nhận và tự động lưu nhóm tăng ca từ ảnh Zalo thành công!${leaveSuffix}`
    );
  };

  const employeeMap = useMemo(() => new Map<string, Employee>(employees.map((e) => [e.id, e])), [employees]);

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    groups.forEach((g) => { if (g.name?.trim()) names.add(g.name.trim()); });
    employees.forEach((emp) => { if (emp.department?.trim()) names.add(emp.department.trim()); });
    return Array.from(names);
  }, [groups, employees]);

  const formDepartment = useMemo(
    () =>
      resolveOvertimeMainDepartment(
        editingForm ? editingForm.department : initialDepartment,
        departmentOptions
      ),
    [editingForm, initialDepartment, departmentOptions]
  );

  const alreadyRecordedIdsForCurrentDate = useMemo(() => {
    const set = new Set<string>();
    for (const block of previewData) {
      if (editingBlockId && block.id === editingBlockId) continue;
      if ((block.overtimeDate || '') === blockOvertimeDate) {
        if (Array.isArray(block.participants)) {
          for (const p of block.participants) if (p.employeeId) set.add(p.employeeId);
        }
        if (Array.isArray(block.selectedEmployeeIds)) {
          for (const id of block.selectedEmployeeIds) if (id) set.add(id);
        }
      }
    }
    return set;
  }, [previewData, blockOvertimeDate, editingBlockId]);

  const effectiveLeaveRecords = useMemo<OvertimeLeaveCheckEntry[]>(
    () => (liveLeaveRecords !== null ? liveLeaveRecords : propLeaveRecords),
    [liveLeaveRecords, propLeaveRecords]
  );

  const onLeaveMapForCurrentDate = useMemo(
    () =>
      buildOnLeaveEmployeeMapForDate(
        blockOvertimeDate,
        effectiveLeaveRecords,
        employees
      ),
    [blockOvertimeDate, effectiveLeaveRecords, employees]
  );

  const filteredEmployeesForInput = useMemo(() => {
    const available = employees.filter((emp) => !alreadyRecordedIdsForCurrentDate.has(emp.id));
    const normalizedGroup = (selectedGroupFilter || '').trim();
    const byGroup = !normalizedGroup || normalizedGroup === 'ALL'
      ? available
      : available.filter((emp) => (emp.department || '').trim() === normalizedGroup);
    const query = employeeSearchQuery.trim().toLowerCase();
    if (!query) return byGroup;
    return byGroup.filter(
      (emp) => emp.fullName.toLowerCase().includes(query) ||
               emp.employeeCode.toLowerCase().includes(query) ||
               emp.department.toLowerCase().includes(query)
    );
  }, [employees, selectedGroupFilter, employeeSearchQuery, alreadyRecordedIdsForCurrentDate]);

  const selectableFilteredEmployees = useMemo(
    () =>
      filteredEmployeesForInput.filter(
        (emp) => !onLeaveMapForCurrentDate.has(emp.id)
      ),
    [filteredEmployeesForInput, onLeaveMapForCurrentDate]
  );

  const onLeaveCountInFiltered =
    filteredEmployeesForInput.length - selectableFilteredEmployees.length;

  useEffect(() => {
    setCurrentSelectedEmployeeIds((prev) => {
      const valid = prev.filter((id) => !alreadyRecordedIdsForCurrentDate.has(id));
      return valid.length === prev.length ? prev : valid;
    });
  }, [alreadyRecordedIdsForCurrentDate]);

  useEffect(() => {
    if (onLeaveMapForCurrentDate.size === 0 || currentSelectedEmployeeIds.length === 0) {
      return;
    }
    const conflictingSelectedIds = currentSelectedEmployeeIds.filter((id) =>
      onLeaveMapForCurrentDate.has(id)
    );
    if (conflictingSelectedIds.length === 0) {
      return;
    }
    const conflictSet = new Set(conflictingSelectedIds);
    setCurrentSelectedEmployeeIds((prev) =>
      prev.filter((id) => !conflictSet.has(id))
    );
    setCustomTimes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of conflictingSelectedIds) {
        if (id in next) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setEditingTimeEmpId((prev) => (prev && conflictSet.has(prev) ? null : prev));
    showToast(
      `Đã tự động bỏ chọn ${conflictingSelectedIds.length} nhân sự do có đơn nghỉ ngày ${formatDateToFormStyle(
        blockOvertimeDate
      )}.`
    );
  }, [onLeaveMapForCurrentDate, blockOvertimeDate, currentSelectedEmployeeIds]);

  const getNetHoursForParticipant = (
    isoDate: string,
    empId: string,
    startTime: string,
    endTime: string
  ) => {
    const resolvedDate = isoDate || shellOvertimeDate || getLocalTodayIsoDate();
    const empDept = (employeeMap.get(empId)?.department || '').trim();
    const evalForEmp = evaluateOvertimeDaySchedule({
      isoDate: resolvedDate,
      holidays: companyHolidays,
      shifts: effectiveWorkShifts,
      departmentName: empDept || selectedGroupFilter,
      employeeDepartments: empDept ? [empDept] : [],
    });
    return calculateActualOvertimeHours(
      resolvedDate,
      startTime,
      endTime,
      isSundayOrWeekendSchedule(evalForEmp, resolvedDate),
      overtimeSettings
    );
  };

  const summaryStats = useMemo(() => {
    let totalParticipants = 0;
    let totalHours = 0;
    const dateSet = new Set<string>();
    const deductionNoteSet = new Set<string>();
    for (const block of previewData) {
      if (block.overtimeDate) dateSet.add(block.overtimeDate);
      const parts: OvertimeParticipant[] =
        Array.isArray(block.participants) && block.participants.length > 0
          ? block.participants
          : block.selectedEmployeeIds.map((id) => ({
              employeeId: id,
              startTime: block.startTime,
              endTime: block.endTime,
            }));
      totalParticipants += parts.length;
      for (const p of parts) {
        const netResult = getNetHoursForParticipant(
          block.overtimeDate || shellOvertimeDate,
          p.employeeId,
          p.startTime || block.startTime,
          p.endTime || block.endTime
        );
        if (netResult.noteText) {
          deductionNoteSet.add(netResult.noteText);
        }
        totalHours += netResult.netHours;
      }
    }
    return {
      blockCount: previewData.length,
      totalParticipants,
      totalHours: Number(totalHours.toFixed(2)),
      datesCount: dateSet.size || (previewData.length > 0 ? 1 : 0),
      deductionNotes: Array.from(deductionNoteSet),
    };
  }, [
    previewData,
    employeeMap,
    companyHolidays,
    effectiveWorkShifts,
    selectedGroupFilter,
    overtimeSettings,
    shellOvertimeDate,
  ]);

  const todayIso = getLocalTodayIsoDate();

  const dateConflictEval = useMemo(
    () =>
      evaluateOvertimeDateConflict({
        blocks: previewData,
        selectedDepartment: formDepartment,
        employees,
        existingForms,
        editingFormId: editingForm?.id ?? null,
        primaryOvertimeDate: shellOvertimeDate,
        fallbackDate: shellOvertimeDate,
        todayIso,
      }),
    [
      previewData,
      formDepartment,
      employees,
      existingForms,
      editingForm?.id,
      shellOvertimeDate,
      todayIso,
    ]
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
      const translation = await translateMultilineKorean(
        currentReasonVi,
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
    updateGlossaryState(entries);
    showToast(
      isUpdate
        ? `Đã cập nhật mẫu "${cleanVi}" trong từ điển.`
        : `Đã lưu mẫu "${cleanVi}" vào từ điển.`
    );
  };

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

    const exactMatch = findExactGlossaryMatch(glossaryEntries, cleanVi);
    if (exactMatch) {
      setIsAutoTranslating(false);
      setCurrentReasonKr(exactMatch.reasonKr);
      return;
    }

    let isCancelled = false;
    setIsAutoTranslating(true);
    const debounceTimer = window.setTimeout(async () => {
      const translation = await translateMultilineKorean(
        currentReasonVi,
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
    if (onLeaveMapForCurrentDate.has(empId)) {
      return;
    }
    setCurrentSelectedEmployeeIds((prev) => prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]);
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = selectableFilteredEmployees.map((e) => e.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => currentSelectedEmployeeIds.includes(id));
    if (allSelected) {
      setCurrentSelectedEmployeeIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setCurrentSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleRemovePreviewBlock = (index: number) => {
    if (isLockedForm) {
      showToast('Phiếu đã chốt, không thể xóa nhóm công việc.');
      return;
    }
    const removed = previewData[index];
    if (removed && editingBlockId === removed.id) {
      setEditingBlockId(null);
    }
    setPreviewData((prev) => prev.filter((_, idx) => idx !== index));
    showToast('Đã xóa nhóm công việc khỏi bản xem trước.');
  };

  const handleEditPreviewBlock = (index: number) => {
    if (isLockedForm) {
      showToast('Phiếu đã chốt, không thể chỉnh sửa nhóm công việc.');
      return;
    }
    const block = previewData[index];
    if (!block) return;
    setEditingBlockId(block.id);
    setIsStartTimeManuallyEdited(true);
    setIsEndTimeManuallyEdited(true);
    setBlockOvertimeDate(block.overtimeDate || shellOvertimeDate || getLocalTodayIsoDate());
    setCurrentStartTime(block.startTime || dayEvaluation.suggestedStartTime || '17:00');
    setCurrentEndTime(block.endTime || dayEvaluation.suggestedDefaultEndTime || '19:00');
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
    setIsStartTimeManuallyEdited(false);
    setIsEndTimeManuallyEdited(false);
    setBlockOvertimeDate(shellOvertimeDate || getLocalTodayIsoDate());
    setCurrentSelectedEmployeeIds([]);
    setCustomTimes({});
    setEditingTimeEmpId(null);
    setCurrentReasonVi('');
    setCurrentReasonKr('');
    setIsReasonKrManuallyEdited(false);
  };

  const handleCommitBlock = async () => {
    if (isLockedForm) {
      showToast('Phiếu tăng ca đã chốt, không thể thêm hoặc cập nhật chi tiết.');
      return;
    }
    if (currentSelectedEmployeeIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một nhân sự tham gia nhóm công việc này.');
      return;
    }
    if (!currentReasonVi.trim()) {
      showToast('Vui lòng nhập lý do tăng ca (Tiếng Việt).');
      return;
    }

    const resolvedBlockDate = blockOvertimeDate || shellOvertimeDate || getLocalTodayIsoDate();

    setIsCommittingBlock(true);
    try {
      const latestLeaveCheck = await fetchActiveLeaveRecordsForOvertimeCheck(employees);
      const recordsToCheck =
        latestLeaveCheck.source === 'supabase'
          ? latestLeaveCheck.records
          : effectiveLeaveRecords;
      if (latestLeaveCheck.source === 'supabase') {
        setLiveLeaveRecords(latestLeaveCheck.records);
      }

      const latestOnLeaveMap = buildOnLeaveEmployeeMapForDate(
        resolvedBlockDate,
        recordsToCheck,
        employees
      );
      const conflictingIds = currentSelectedEmployeeIds.filter((id) =>
        latestOnLeaveMap.has(id)
      );
      if (conflictingIds.length > 0) {
        const conflictSet = new Set(conflictingIds);
        setCurrentSelectedEmployeeIds((prev) =>
          prev.filter((id) => !conflictSet.has(id))
        );
        setCustomTimes((prev) => {
          const next = { ...prev };
          for (const id of conflictingIds) delete next[id];
          return next;
        });
        setEditingTimeEmpId((prev) =>
          prev && conflictSet.has(prev) ? null : prev
        );
        const conflictNames = conflictingIds
          .slice(0, 3)
          .map((id) => employeeMap.get(id)?.fullName || id)
          .join(', ');
        const extraSuffix =
          conflictingIds.length > 3
            ? ` và ${conflictingIds.length - 3} người khác`
            : '';
        showToast(
          `Không thể ghi nhận: ${conflictNames}${extraSuffix} đang có đơn nghỉ ngày ${formatDateToFormStyle(
            resolvedBlockDate
          )}. Đã tự động bỏ chọn.`
        );
        return;
      }

      const normalizedStart = OvertimeFormService.normalize24hTime(
        currentStartTime,
        dayEvaluation.suggestedStartTime || '17:00'
      );
      const normalizedEnd = OvertimeFormService.normalize24hTime(
        currentEndTime,
        dayEvaluation.suggestedDefaultEndTime || '19:00'
      );
      setCurrentStartTime(normalizedStart);
      setCurrentEndTime(normalizedEnd);

      const cleanReasonVi = currentReasonVi.trim();
      const finalReasonKr = currentReasonKr.trim()
        ? currentReasonKr.trim()
        : await translateMultilineKorean(currentReasonVi, glossaryEntries);

      if (cleanReasonVi && finalReasonKr.trim()) {
        const existingGlossaryMatch = findExactGlossaryMatch(
          glossaryEntries,
          cleanReasonVi
        );
        if (!existingGlossaryMatch) {
          const blockDepartments = normalizeTargetGroups(
            currentSelectedEmployeeIds.map(
              (empId) => employeeMap.get(empId)?.department || ''
            )
          );
          void upsertOvertimeGlossaryEntry(cleanReasonVi, finalReasonKr.trim(), {
            isVerified: false,
            targetGroups: blockDepartments,
          }).then(({ entries }) => updateGlossaryState(entries));
        } else if (finalReasonKr.trim() !== existingGlossaryMatch.reasonKr.trim()) {
          void upsertOvertimeGlossaryEntry(
            cleanReasonVi,
            finalReasonKr.trim()
          ).then(({ entries }) => updateGlossaryState(entries));
        }
      }

      const participants: OvertimeParticipant[] = currentSelectedEmployeeIds.map((empId) => {
        const custom = customTimes[empId];
        const pStart = custom?.startTime
          ? OvertimeFormService.normalize24hTime(custom.startTime, normalizedStart)
          : normalizedStart;
        const pEnd = custom?.endTime
          ? OvertimeFormService.normalize24hTime(custom.endTime, normalizedEnd)
          : normalizedEnd;
        const netResult = getNetHoursForParticipant(
          resolvedBlockDate,
          empId,
          pStart,
          pEnd
        );
        return {
          employeeId: empId,
          startTime: pStart,
          endTime: pEnd,
          totalHours: netResult.netHours,
        };
      });

      const newBlock: OvertimeTaskBlock = {
        id: editingBlockId || `ot-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        overtimeDate: resolvedBlockDate,
        reasonVi: cleanReasonVi,
        reasonKr: finalReasonKr.trim(),
        startTime: normalizedStart,
        endTime: normalizedEnd,
        selectedEmployeeIds: [...currentSelectedEmployeeIds],
        participants,
        isTranslating: false,
      };

      // Tự động cập nhật mảng và GỌI LƯU NGAY LẬP TỨC
      let updatedBlocks: OvertimeTaskBlock[] = [];
      if (editingBlockId) {
        updatedBlocks = previewData.map((b) => (b.id === editingBlockId ? newBlock : b));
        setPreviewData(updatedBlocks);
        setEditingBlockId(null);
      } else {
        updatedBlocks = [...previewData, newBlock];
        setPreviewData(updatedBlocks);
      }

      if (onSaveOnly) {
        try {
          await onSaveOnly({
            department: formDepartment,
            overtimeDate: shellOvertimeDate,
            blocks: updatedBlocks,
          }, true); // Truyền cờ true cho Tự động lưu
          showToast(`Đã ghi nhận và tự động lưu Phiếu Tăng Ca thành công!`);
        } catch (error) {
          showToast(`Lỗi khi lưu tự động: ${getFriendlyErrorMessage(error)}`);
        }
      } else {
        showToast(editingBlockId ? `Đã cập nhật nhóm xem trước!` : `Đã ghi nhận nhóm vào danh sách xem trước!`);
      }

      // Reset Form sau khi Ghi nhận
      setBlockOvertimeDate(shellOvertimeDate || getLocalTodayIsoDate());
      setIsStartTimeManuallyEdited(false);
      setIsEndTimeManuallyEdited(false);
      setCurrentReasonVi('');
      setCurrentReasonKr('');
      setIsReasonKrManuallyEdited(false);
      setCurrentSelectedEmployeeIds([]);
      setCustomTimes({});
      setEditingTimeEmpId(null);
      setEmployeeSearchQuery('');
      setIsEmployeeDropdownOpen(false);
    } finally {
      setIsCommittingBlock(false);
    }
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

  const canSaveShell =
    !isLockedForm &&
    (previewData.length > 0 || Boolean(editingForm && editingForm.items.length > 0));

  const handleSaveOnly = async () => {
    if (isLockedForm) {
      showToast('Phiếu tăng ca đã chốt, không thể lưu thay đổi.');
      return;
    }
    if (!canSaveShell) {
      showToast('Vui lòng ghi nhận ít nhất một nhóm công việc trước khi Lưu.');
      return;
    }
    setIsSubmitting(true);
    try {
      const blocksWithComputedHours: OvertimeTaskBlock[] = previewData.map((block) => {
        const blockDate = block.overtimeDate || shellOvertimeDate;
        const baseParticipants: OvertimeParticipant[] =
          Array.isArray(block.participants) && block.participants.length > 0
            ? block.participants
            : block.selectedEmployeeIds.map((id) => ({
                employeeId: id,
                startTime: block.startTime,
                endTime: block.endTime,
              }));
        const computedParticipants = baseParticipants.map((p) => {
          const pStart = p.startTime || block.startTime;
          const pEnd = p.endTime || block.endTime;
          const actualRes = getNetHoursForParticipant(
            blockDate,
            p.employeeId,
            pStart,
            pEnd
          );
          return {
            ...p,
            startTime: pStart,
            endTime: pEnd,
            totalHours: actualRes.netHours,
          };
        });
        return {
          ...block,
          participants: computedParticipants,
        };
      });

      await onSaveOnly?.({
        department: formDepartment,
        overtimeDate: shellOvertimeDate,
        blocks: blocksWithComputedHours,
      }, false); // Cờ false cho Lưu bằng tay (để chuyển trang)
      setEditingBlockId(null);
      if (!onSaveOnly) {
        showToast('Đã lưu cập nhật phiếu tăng ca thành công!');
      }
    } catch (error) {
      showToast(getFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcelOnly = async () => {
    if (previewData.length === 0) {
      showToast('Vui lòng ghi nhận ít nhất một nhóm công việc trước khi xuất Excel.');
      return;
    }
    setIsSubmitting(true);
    try {
      await overtimeExportService.exportExcel({
        department: formDepartment,
        overtimeDate: shellOvertimeDate,
        blocks: previewData,
        employees,
        knownSubGroups: departmentOptions,
      });
      showToast('Đã tạo và tải file Excel thành công!');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        showToast('Đã hủy chọn thư mục.'); 
      } else {
        showToast(getFriendlyErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const printableDateGroups = useMemo((): PrintableDateGroup[] => {
    const activeDraftDate = blockOvertimeDate || shellOvertimeDate || getLocalTodayIsoDate();
    if (previewData.length === 0) {
      const draftParticipants: OvertimeParticipant[] = currentSelectedEmployeeIds.length > 0
          ? currentSelectedEmployeeIds.map((id) => ({
              employeeId: id,
              startTime: customTimes[id]?.startTime ? OvertimeFormService.normalize24hTime(customTimes[id].startTime, currentStartTime) : currentStartTime,
              endTime: customTimes[id]?.endTime ? OvertimeFormService.normalize24hTime(customTimes[id].endTime, currentEndTime) : currentEndTime,
            }))
          : [{ employeeId: '__EMPTY_PARTICIPANT__', startTime: currentStartTime || '16:10', endTime: currentEndTime || '18:10' }];

      const combinedReason = buildCombinedReasonText(currentReasonVi || 'Trực sản xuất', currentReasonKr || '생산 당직');
      return [{
          date: activeDraftDate,
          formattedDate: formatDateToFormStyle(activeDraftDate),
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
      const d = block.overtimeDate || activeDraftDate;
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
  }, [previewData, employeeMap, blockOvertimeDate, shellOvertimeDate, currentSelectedEmployeeIds, customTimes, currentReasonVi, currentReasonKr, currentStartTime, currentEndTime]);

  return (
    <div className="flex flex-col lg:flex-row w-full lg:h-full flex-1 min-h-0 lg:overflow-hidden p-3 sm:p-4 gap-4 bg-slate-50 text-slate-800">
      
      {/* CỘT TRÁI (1/3) */}
      <div className="w-full lg:w-1/3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:h-full min-h-0 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-slate-50/50">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#14539E] truncate font-mono">
              {shellFormCode} • {formatDateToFormStyle(shellOvertimeDate)}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isLockedForm}
              onClick={() => setIsAiScanModalOpen(true)}
              title="Quét ảnh lịch tăng ca từ Zalo"
              aria-label="Quét ảnh lịch tăng ca từ Zalo"
              data-testid="open-zalo-scan-modal-btn"
              className="h-7 w-7 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 hover:border-[#14539E] text-[#14539E] inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            {onCancelEdit ? (
              <button
                type="button"
                onClick={onCancelEdit}
                className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Quay lại Nhật ký</span>
              </button>
            ) : (
              <span
                data-testid="overtime-main-department-label"
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#14539E] border border-blue-200 shrink-0 whitespace-nowrap"
              >
                {formDepartment}
              </span>
            )}
          </div>
        </div>

        {/* VÙNG CUỘN CHÍNH CỦA CỘT TRÁI */}
        <div className="p-3 sm:p-3.5 space-y-2.5 overflow-y-auto flex-1 min-h-0">

          {isLockedForm && (
            <div
              role="status"
              data-testid="overtime-form-locked-banner"
              className="rounded-xl border border-[#14539E]/25 bg-blue-50/90 px-3 py-2 text-[11px] text-[#14539E] flex items-start gap-2"
            >
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-bold">Phiếu đã chốt:</span> Đã khóa chức năng sửa và lưu. Để chỉnh sửa lại, vui lòng sử dụng{' '}
                <strong>Mở khóa khẩn cấp</strong> tại tab Nhật ký.
              </div>
            </div>
          )}

          {dayEvaluation.bannerTone !== 'none' && (
            <div
              role="status"
              data-testid="overtime-day-schedule-banner"
              data-day-kind={dayEvaluation.dayKind}
              className={`rounded-xl border px-3 py-2 text-[11px] flex items-start gap-2 ${
                dayEvaluation.bannerTone === 'holiday'
                  ? 'border-purple-300 bg-gradient-to-r from-purple-50 to-rose-50 text-purple-900 shadow-2xs'
                  : dayEvaluation.bannerTone === 'compensatory'
                    ? 'border-violet-300 bg-violet-50 text-violet-900'
                    : dayEvaluation.bannerTone === 'weekly_off'
                      ? 'border-orange-200 bg-orange-50 text-orange-900'
                      : dayEvaluation.bannerTone === 'morning'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-blue-200 bg-blue-50/80 text-[#14539E]'
              }`}
            >
              {dayEvaluation.bannerTone === 'holiday' ? (
                <CalendarHeart className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
              ) : dayEvaluation.bannerTone === 'compensatory' ? (
                <Sparkles className="w-3.5 h-3.5 text-violet-700 shrink-0 mt-0.5" />
              ) : dayEvaluation.bannerTone === 'weekly_off' ? (
                <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              )}
              <div className="leading-snug font-semibold">
                {dayEvaluation.bannerText}
              </div>
            </div>
          )}

          {/* HÀNG 1: LỌC NHÓM & NGÀY LÀM THÊM */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="overtime-department-select"
                className="block text-[11px] font-semibold text-slate-600 mb-0.5"
              >
                Lọc nhóm nhân sự
              </label>
              <select
                id="overtime-department-select"
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="w-full h-8 px-2.5 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                <option value="ALL">Tất cả nhóm</option>
                {departmentOptions.map((groupName) => (
                  <option key={groupName} value={groupName}>
                    {groupName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="overtime-block-date"
                className="block text-[11px] font-semibold text-slate-600 mb-0.5"
              >
                Ngày làm thêm
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="overtime-block-date"
                  type="date"
                  value={blockOvertimeDate}
                  onChange={(e) => setBlockOvertimeDate(e.target.value)}
                  className="w-full h-8 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
                />
              </div>
            </div>
          </div>
          
          {blockOvertimeDate && shellOvertimeDate && blockOvertimeDate !== shellOvertimeDate && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1 flex items-center justify-between gap-2">
              <span>
                Đang ghi nhận phát sinh ngày <strong className="font-mono">{formatDateToFormStyle(blockOvertimeDate)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setBlockOvertimeDate(shellOvertimeDate)}
                className="text-[10px] font-semibold text-[#14539E] hover:underline shrink-0 cursor-pointer"
              >
                Về ngày phiếu
              </button>
            </div>
          )}

          {/* HÀNG 2: CHỌN NHÂN SỰ */}
          <div className="space-y-2 mt-3" ref={employeePickerRef}>
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
                {onLeaveMapForCurrentDate.size > 0 && (
                  <span className="text-rose-600 font-normal ml-1">
                    ({onLeaveMapForCurrentDate.size} đang nghỉ)
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
                className={`w-full h-8 pl-8 pr-14 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border bg-white focus:outline-none transition-colors ${
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
                    className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEmployeeDropdownOpen((prev) => !prev)}
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
                  <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500 truncate">
                      {selectedGroupFilter && selectedGroupFilter !== 'ALL' ? (
                        <>
                          Nhóm <strong className="text-slate-700">{selectedGroupFilter}</strong> • {selectableFilteredEmployees.length} khả dụng
                        </>
                      ) : (
                        <>Tất cả nhóm ({formDepartment}) • {selectableFilteredEmployees.length} khả dụng</>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={selectableFilteredEmployees.length === 0}
                      onClick={handleSelectAllFiltered}
                      className="font-semibold text-[#14539E] hover:underline cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {selectableFilteredEmployees.length > 0 &&
                      selectableFilteredEmployees.every((e) =>
                        currentSelectedEmployeeIds.includes(e.id)
                      )
                        ? 'Bỏ chọn tất cả'
                        : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto p-1.5 space-y-1">
                    {filteredEmployeesForInput.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-400">
                        Không tìm thấy nhân sự phù hợp.
                      </div>
                    ) : (
                      filteredEmployeesForInput.map((emp) => {
                        const leaveConflict = onLeaveMapForCurrentDate.get(emp.id);
                        const isOnLeave = Boolean(leaveConflict);
                        const isSelected = !isOnLeave && currentSelectedEmployeeIds.includes(emp.id);

                        return (
                          <button
                            key={emp.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            disabled={isOnLeave}
                            onClick={() => handleToggleEmployee(emp.id)}
                            className={`w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors select-none ${
                              isOnLeave
                                ? 'bg-slate-50/90 border border-slate-200/70 text-slate-400 cursor-not-allowed opacity-80'
                                : isSelected
                                  ? 'bg-blue-50/90 border border-blue-200 text-slate-900 font-semibold cursor-pointer'
                                  : 'bg-white border border-transparent text-slate-700 hover:bg-slate-100 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-white shrink-0 ${
                                  isOnLeave
                                    ? 'border-slate-200 bg-slate-100'
                                    : isSelected
                                      ? 'bg-[#14539E] border-[#14539E]'
                                      : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </span>
                              <div className="min-w-0 flex-1 truncate">
                                <span className={isOnLeave ? 'line-through decoration-slate-300' : ''}>
                                  {emp.fullName}
                                </span>
                                <span className="text-slate-400 text-[10px] font-mono ml-1">
                                  ({emp.employeeCode})
                                </span>
                              </div>
                            </div>
                            {isOnLeave && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold shrink-0">
                                  Đang nghỉ
                                </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

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

            {currentSelectedEmployeeIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-0.5">
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

                      {isEditingThis ? (
                        <div className="flex items-center gap-0.5 bg-white px-1 py-0.5 rounded border border-[#14539E]">
                          <input
                            type="text"
                            maxLength={5}
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
                          >
                            <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                          </button>
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

          {/* HÀNG 3: GIỜ BẮT ĐẦU / KẾT THÚC */}
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="overtime-start-time-input"
                  className="block text-[11px] font-semibold text-slate-600 mb-0.5"
                >
                  Giờ bắt đầu (chung)
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="overtime-start-time-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={currentStartTime}
                    onChange={(e) => {
                      setIsStartTimeManuallyEdited(true);
                      setCurrentStartTime(
                        OvertimeFormService.sanitize24hTimeInput(e.target.value)
                      );
                    }}
                    onBlur={() =>
                      setCurrentStartTime((prev) =>
                        OvertimeFormService.normalize24hTime(
                          prev,
                          dayEvaluation.suggestedStartTime || '17:00'
                        )
                      )
                    }
                    className="w-full h-8 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="overtime-end-time-input"
                  className="block text-[11px] font-semibold text-slate-600 mb-0.5"
                >
                  Giờ kết thúc (chung)
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="overtime-end-time-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={currentEndTime}
                    onChange={(e) => {
                      setIsEndTimeManuallyEdited(true);
                      setCurrentEndTime(
                        OvertimeFormService.sanitize24hTimeInput(e.target.value)
                      );
                    }}
                    onBlur={() =>
                      setCurrentEndTime((prev) =>
                        OvertimeFormService.normalize24hTime(
                          prev,
                          dayEvaluation.suggestedDefaultEndTime || '19:00'
                        )
                      )
                    }
                    className="w-full h-8 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {(['18:10', '19:10', '20:10'] as const).map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        setIsEndTimeManuallyEdited(true);
                        setCurrentEndTime(time);
                      }}
                      className={`px-2 py-0.5 text-[10px] font-mono font-medium rounded border transition-colors cursor-pointer ${
                        currentEndTime === time
                          ? 'bg-[#14539E] text-white border-[#14539E]'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-[#14539E] hover:border-blue-200'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* HÀNG 4: LÝ DO TĂNG CA (VIỆT - HÀN) DẠNG COMBOBOX */}
          <div className="space-y-2 mt-3">
            <div ref={reasonDropdownRef} className="relative">
              <div className="flex items-center justify-between gap-2 mb-1">
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
              
              <div className="relative">
                <textarea
                  id="overtime-reason-vi"
                  rows={2}
                  value={currentReasonVi}
                  onFocus={() => setIsReasonDropdownOpen(true)}
                  onChange={(e) => {
                    setCurrentReasonVi(e.target.value);
                    if (!isReasonDropdownOpen) setIsReasonDropdownOpen(true);
                  }}
                  placeholder="Bấm để chọn mẫu hoặc tự nhập mới..."
                  className="whitespace-pre-wrap w-full min-h-[44px] pl-2.5 pr-8 py-1.5 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E]/20 transition-all resize-y"
                />
                <button
                  type="button"
                  onClick={() => setIsReasonDropdownOpen((prev) => !prev)}
                  className="absolute right-1.5 top-1.5 p-1 text-slate-400 hover:text-[#14539E] rounded cursor-pointer transition-transform"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isReasonDropdownOpen ? 'rotate-180 text-[#14539E]' : ''
                    }`}
                  />
                </button>
                
                {isReasonDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-lg border border-slate-200 bg-white shadow-xl max-h-48 overflow-y-auto">
                    {filteredGlossary.length === 0 ? (
                      <div className="p-2.5 text-center text-[11px] text-slate-500">
                        Chưa có mẫu đã duyệt nào khớp. Hệ thống sẽ tự lưu mẫu mới (chờ duyệt) khi bạn bấm Ghi nhận.
                      </div>
                    ) : (
                      <div className="p-1.5 space-y-0.5">
                        {filteredGlossary.map((item) => {
                          const itemGroups = normalizeTargetGroups(item.target_groups);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setCurrentReasonVi(item.reasonVi);
                                setCurrentReasonKr(item.reasonKr);
                                setIsReasonKrManuallyEdited(false);
                                setIsReasonDropdownOpen(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-md text-[11px] hover:bg-blue-50 transition-colors cursor-pointer flex items-start justify-between gap-2 group"
                            >
                              <span className="break-words line-clamp-2 text-slate-700 group-hover:text-[#14539E] font-medium">
                                {item.reasonVi}
                              </span>

                              <span className="shrink-0 mt-0.5 inline-flex items-center gap-1">
                                {itemGroups.length > 0 && (
                                  <span
                                    title={`Nhóm: ${itemGroups.join(', ')}`}
                                    className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[9px] font-semibold text-[#14539E] max-w-[110px] truncate"
                                  >
                                    {itemGroups.join(', ')}
                                  </span>
                                )}
                                <span
                                  title="Đã được duyệt"
                                  className="inline-flex"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="overtime-reason-kr"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Lý do (Tiếng Hàn)
              </label>
              <textarea
                id="overtime-reason-kr"
                rows={2}
                value={currentReasonKr}
                onChange={(e) => {
                  setCurrentReasonKr(e.target.value);
                  setIsReasonKrManuallyEdited(true);
                }}
                placeholder="생산 당직 (Tự động dịch/gợi ý hoặc nhập trực tiếp)..."
                className="whitespace-pre-wrap w-full min-h-[44px] px-2.5 py-1.5 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E]/20 transition-all resize-y"
              />
            </div>
          </div>

          {/* HÀNG 5: NÚT GHI NHẬN & DANH SÁCH ĐÃ GHI NHẬN (Đã dời vào trong) */}
          <div className="mt-4 pt-3 border-t border-slate-200 space-y-2 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isLockedForm || isCommittingBlock}
                onClick={handleCommitBlock}
                className="flex-1 h-9 rounded-xl bg-[#14539E] hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCommittingBlock ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingBlockId ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>{editingBlockId ? 'Cập nhật nhóm' : 'Ghi nhận'}</span>
              </button>
              {editingBlockId && (
                <button
                  type="button"
                  onClick={handleCancelBlockEdit}
                  className="h-9 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Hủy
                </button>
              )}
            </div>

            {previewData.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between gap-2">
                  <span className="truncate">Các nhóm đã ghi nhận ({previewData.length}):</span>
                  <span className="text-[10px] font-normal text-slate-500 shrink-0 whitespace-nowrap tabular-nums">{summaryStats.datesCount} ngày • {summaryStats.totalParticipants} lượt</span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {previewData.map((b, idx) => {
                    const blockDate = b.overtimeDate || shellOvertimeDate || getLocalTodayIsoDate();
                    const blockDepts = normalizeTargetGroups(
                      b.selectedEmployeeIds.map(
                        (id) => employeeMap.get(id)?.department || ''
                      )
                    );
                    const blockEval = evaluateOvertimeDaySchedule({
                      isoDate: blockDate,
                      holidays: companyHolidays,
                      shifts: effectiveWorkShifts,
                      departmentName: blockDepts[0] || selectedGroupFilter,
                      employeeDepartments: blockDepts,
                    });
                    const blockCalc = calculateActualOvertimeHours(
                      blockDate,
                      b.startTime,
                      b.endTime,
                      isSundayOrWeekendSchedule(blockEval, blockDate),
                      overtimeSettings
                    );
                    return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs shadow-2xs transition-colors ${
                        editingBlockId === b.id
                          ? 'bg-blue-50/80 border-[#14539E]'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                          <span className="font-bold text-[#14539E] shrink-0">#{idx + 1}</span>
                          <span className="font-bold text-slate-800 font-mono text-[11px] shrink-0">[{formatDateToFormStyle(b.overtimeDate)}]</span>
                          <span className="text-slate-800 font-medium line-clamp-2 break-words leading-snug">{b.reasonVi || 'Không có lý do'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate tabular-nums">
                          {b.selectedEmployeeIds.length} nhân sự
                          {(() => {
                            const groupNames = Array.from(
                              new Set(
                                b.selectedEmployeeIds
                                  .map((id) => employeeMap.get(id)?.department?.trim())
                                  .filter((name): name is string => Boolean(name))
                              )
                            );
                            return groupNames.length > 0 ? ` • ${groupNames.join(', ')}` : '';
                          })()}
                          {' • '}
                          {b.startTime}-{b.endTime} ({formatNumberVN(blockCalc.netHours)}g)
                        </div>
                        {blockCalc.noteText && (
                          <div className="text-[10px] text-amber-700 font-medium mt-0.5 truncate">
                            {blockCalc.noteText}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" disabled={isLockedForm} onClick={() => handleEditPreviewBlock(idx)} className="p-1 rounded text-[#14539E] hover:bg-blue-50 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed" title="Sửa nhóm"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" disabled={isLockedForm || idx === 0} onClick={() => handleMoveBlock(idx, 'up')} className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed" title="Lên"><ChevronUp className="w-4 h-4" /></button>
                        <button type="button" disabled={isLockedForm || idx === previewData.length - 1} onClick={() => handleMoveBlock(idx, 'down')} className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed" title="Xuống"><ChevronDown className="w-4 h-4" /></button>
                        <button type="button" disabled={isLockedForm} onClick={() => handleRemovePreviewBlock(idx)} className="p-1 rounded text-red-500 hover:bg-red-50 cursor-pointer ml-0.5 disabled:opacity-35 disabled:cursor-not-allowed" title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CỘT PHẢI (2/3) - A4 PREVIEW */}
      <div className="w-full lg:w-2/3 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner flex flex-col lg:h-full min-h-0 overflow-hidden relative">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col items-center justify-start">
          <div style={{ fontFamily: "'Times New Roman', 'Malgun Gothic', Arial, sans-serif" }} className="bg-white shadow-2xl p-5 sm:p-6 w-full max-w-[794px] min-h-[1123px] shrink-0 mx-auto text-black rounded-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Transon Viet nam Co., Ltd</span><span className="pr-12">Biểu mẫu số: TV-PSGC2022</span>
              </div>

              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="pt-2">
                  <div className="text-lg font-bold leading-snug">PHIẾU ĐỀ NGHỊ LÀM THÊM</div>
                  <div className="text-base font-bold leading-snug">잔업. 특근 신청서</div>
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
                      <tr className={dateIdx === 0 ? 'h-7' : 'h-8'}>
                        <td
                          colSpan={3}
                          data-testid={dateIdx === 0 ? 'tv-psgc-department-header' : undefined}
                          className={`border-0 bg-transparent text-left align-middle text-xs font-bold text-black ${dateIdx === 0 ? 'pb-1' : 'pt-2 pb-1'}`}
                        >
                          {formatDepartmentHeaderLabel(formDepartment, departmentOptions)}
                        </td>
                        <td colSpan={4} className={`border-0 bg-transparent text-center align-middle text-xs font-bold text-black ${dateIdx === 0 ? 'pb-1' : 'pt-2 pb-1'}`}>
                          {dateGroup.formattedDate}
                        </td>
                      </tr>
                      <tr className="text-center font-normal">
                        <th className="border border-black px-1.5 py-0.5 w-8 min-w-[32px] font-normal">No</th>
                        <th className="border border-black px-2 py-0.5 w-40 min-w-[145px] font-normal">Danh sách làm thêm</th>
                        <th className="border border-black px-2.5 py-0.5 min-w-[220px] font-normal">Lý do làm thêm</th>
                        <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">Giờ bắt đầu</th>
                        <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">Giờ kết thúc</th>
                        <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">Tổng thời gian</th>
                        <th className="border border-black px-1.5 py-0.5 w-14 min-w-[50px] font-normal">Ký nhận</th>
                      </tr>
                      <tr className="text-center font-normal">
                        <th className="border border-black px-1.5 py-0.5 font-normal" />
                        <th className="border border-black px-2 py-0.5 font-normal">명단</th>
                        <th className="border border-black px-2.5 py-0.5 font-normal">잔업. 특근사유</th>
                        <th className="border border-black px-1.5 py-0.5 font-normal">시작</th>
                        <th className="border border-black px-1.5 py-0.5 font-normal">종료</th>
                        <th className="border border-black px-1.5 py-0.5 font-normal">총 시간</th>
                        <th className="border border-black px-1.5 py-0.5 font-normal">싸인</th>
                      </tr>
                      {dateGroup.blocks.map((group) =>
                        group.rows.map((row) => (
                          <tr key={`${group.blockId}-${row.no}`} className="h-7 min-h-[26px]">
                            <td className="border border-black px-1.5 py-0.5 text-center font-normal">{row.no}</td>
                            <td className="border border-black px-2 py-0.5 text-left font-normal">{row.fullName}</td>
                            {row.isFirstInBlock && <td rowSpan={row.rowSpan} className="border border-black px-2.5 py-1 text-left align-middle whitespace-pre-line font-normal leading-snug">{row.combinedReason}</td>}
                            <td className={`border border-black px-1.5 py-0.5 text-center align-middle ${isTimeBold(row.startTimeFormatted) ? 'font-bold' : 'font-normal'}`}>{row.startTimeFormatted}</td>
                            <td className={`border border-black px-1.5 py-0.5 text-center align-middle ${isTimeBold(row.endTimeFormatted) ? 'font-bold' : 'font-normal'}`}>{row.endTimeFormatted}</td>
                            <td className="border border-black px-1.5 py-0.5 text-center align-middle" />
                            <td className="border border-black px-1.5 py-0.5 text-center align-middle" />
                          </tr>
                        ))
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-[11px] space-y-0.5 leading-snug shrink-0">
              <div>Ghi chú 비고</div>
              <div>1) Nếu phát sinh dài hạn ghi rõ vào đây: từ năm 2022/........./............~ 2022/........./ ............</div>
              <div>Phát sinh giờ ghi ở biểu trên/ 긴시간 발생할 경우 는 여기서 기록할것</div>
            </div>
          </div>
        </div>

        {dateConflictEval.mode === 'multi_day_reminder' && (
          <div
            role="status"
            data-testid="overtime-multiday-reminder-banner"
            className="shrink-0 bg-amber-50 border-t border-amber-200 px-4 sm:px-5 py-2 flex items-start gap-2.5"
          >
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold">
                Ghi nhận phát sinh ngày trước (cho phép lưu):
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
              đã có phiếu trước đó. Phiếu{' '}
              <strong className="font-mono text-[#14539E]">{shellFormCode}</strong>{' '}
              (Ngày{' '}
              <strong className="font-mono">
                {formatDateToFormStyle(shellOvertimeDate)}
              </strong>
              ) vẫn lưu bình thường; báo cáo Giờ Tăng ca sẽ ưu tiên lấy số giờ của phiếu cập nhật sau cùng cho từng (nhân sự + ngày), không cộng đúp.
            </div>
          </div>
        )}

        {/* CÁC NÚT FOOTER (LƯU CẬP NHẬT VÀO VỎ PHIẾU & XUẤT EXCEL) */}
        <div className="py-3 px-4 sm:px-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="text-xs text-slate-500 min-w-0">
            <div className="truncate tabular-nums">
              <strong className="font-mono text-[#14539E]">{shellFormCode}</strong> •{' '}
              Ngày phiếu:{' '}
              <strong className="font-mono text-slate-700">
                {formatDateToFormStyle(shellOvertimeDate)}
              </strong>{' '}
              • Tổng số nhóm:{' '}
              <strong className="font-mono text-slate-700">{formatNumberVN(summaryStats.blockCount)}</strong> ({formatNumberVN(summaryStats.totalParticipants)} lượt • {summaryStats.datesCount} ngày • <strong className="font-mono text-[#14539E]">{formatNumberVN(summaryStats.totalHours)} giờ</strong>)
            </div>
            {summaryStats.deductionNotes.length > 0 && (
              <div
                data-testid="overtime-footer-deduction-note"
                className="text-[10px] font-medium text-amber-700 truncate mt-0.5"
              >
                {summaryStats.deductionNotes.join(' • ')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            
            <button
              type="button"
              disabled={isCheckingExistingForms || isSubmitting || !canSaveShell}
              onClick={handleSaveOnly}
              className="h-9 px-4 sm:px-5 rounded-lg border border-[#14539E] bg-[#14539E] text-white hover:bg-[#0F3E77] text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Lưu</span>
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

      <ZaloScheduleScanModal
        isOpen={isAiScanModalOpen}
        onClose={() => setIsAiScanModalOpen(false)}
        employees={employees}
        glossaryEntries={glossaryEntries}
        leaveRecords={effectiveLeaveRecords}
        existingPreviewBlocks={previewData}
        defaultDate={blockOvertimeDate || shellOvertimeDate || getLocalTodayIsoDate()}
        translateMultilineKorean={translateMultilineKorean}
        onLeaveRecordsRefreshed={(records) => setLiveLeaveRecords(records)}
        onParseScheduleImage={parseOvertimeScheduleImage}
        onConfirmBlock={(payload) => handleConfirmAiModalPayloads([payload])}
        onConfirmAllBlocks={(payloads) => handleConfirmAiModalPayloads(payloads)}
      />

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