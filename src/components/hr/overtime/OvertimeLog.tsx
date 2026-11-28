import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Printer,
  ShieldAlert,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
} from '../../../types/hr';
import {
  formatNumberVN,
  getFriendlyErrorMessage,
} from '../../../utils/errorAndSecurityService';
import {
  formatDateToFormStyle,
  overtimeExportService,
} from '../../../utils/overtimeExportService';
import {
  buildMergedEmployeesForExport,
  fetchOvertimeFormById,
  filterOvertimeForms,
  formatOvertimeFormCodeDisplay,
  formatOvertimeGroupCompactLabel,
  getLocalTodayIsoDate,
  isOvertimeFormLocked,
  OvertimeBlockInput,
  OvertimeFormWithItems,
  OvertimeGlossaryEntry,
  OvertimeLeaveCheckEntry,
  OvertimeSupabaseActionError,
  reconstructBlocksFromItems,
  reorderOvertimeBlocks,
  resolveOvertimeMainDepartment,
  SUPABASE_OVERTIME_REALTIME_AND_SOFT_DELETE_SQL,
  translateMultilineKorean,
} from '../../../services/hrService';
import {
  type CompanyHoliday,
  createDefaultAdminShift,
  type WorkShift,
} from '../../../utils/workScheduleLogic';
import {
  buildCalendarYearOptions,
  buildOvertimeMonthCalendarGrid,
  CALENDAR_WEEKDAY_HEADERS,
  collectOvertimeFormStatusByDate,
  formatYearMonthKey,
  parseYearMonthKey,
  shiftYearMonth,
} from '../../../utils/overtimeCalendarLogic';
import { OvertimeA4PreviewSheet } from './OvertimeA4PreviewSheet';
import { ManualOvertimeGroupModal } from './ManualOvertimeGroupModal';
import {
  ConfirmableOvertimeBlockPayload,
  ZaloScheduleScanModal,
} from './ZaloScheduleScanModal';
import { parseOvertimeScheduleImage } from '../../../services/overtimeImageService';

export interface OvertimeLogProps {
  forms: OvertimeFormWithItems[];
  employees: Employee[];
  groups?: DepartmentGroup[];
  leaveRecords?: OvertimeLeaveCheckEntry[];
  glossaryEntries?: OvertimeGlossaryEntry[];
  workShifts?: WorkShift[];
  companyHolidays?: CompanyHoliday[];
  isLoading: boolean;
  schemaNeedsMigration?: boolean;
  onRefresh: () => Promise<void> | void;
  onCreateOrOpenShell?: (overtimeDate: string) => Promise<void> | void;
  onAppendBlocksToDate?: (
    fallbackDate: string,
    payloads: ConfirmableOvertimeBlockPayload[]
  ) => Promise<OvertimeFormWithItems>;
  onUpdateFormBlocks?: (
    form: OvertimeFormWithItems,
    nextBlocks: OvertimeBlockInput[]
  ) => Promise<OvertimeFormWithItems>;
  onGlossaryEntriesUpdated?: (entries: OvertimeGlossaryEntry[]) => void;
  onLeaveRecordsRefreshed?: (records: OvertimeLeaveCheckEntry[]) => void;
  onEdit: (form: OvertimeFormWithItems) => void;
  onLockForm?: (form: OvertimeFormWithItems) => Promise<void>;
  onUnlockForm?: (form: OvertimeFormWithItems) => Promise<void>;
  onSoftDelete: (formIds: string[]) => Promise<void>;
  onSwitchToCreate?: () => void;
  onShowToast?: (message: string) => void;
}

export const OvertimeLog: React.FC<OvertimeLogProps> = ({
  forms,
  employees,
  groups = [],
  leaveRecords = [],
  glossaryEntries = [],
  workShifts,
  companyHolidays = [],
  isLoading,
  schemaNeedsMigration = false,
  onRefresh,
  onCreateOrOpenShell,
  onAppendBlocksToDate,
  onUpdateFormBlocks,
  onGlossaryEntriesUpdated,
  onLeaveRecordsRefreshed,
  onEdit,
  onLockForm,
  onUnlockForm,
  onSoftDelete,
  onSwitchToCreate,
  onShowToast,
}) => {
  const todayIsoDate = useMemo(() => getLocalTodayIsoDate(), []);
  const currentMonthKey = useMemo(() => todayIsoDate.slice(0, 7), [todayIsoDate]);
  const currentYear = useMemo(
    () => Number(todayIsoDate.slice(0, 4)),
    [todayIsoDate]
  );

  const [isCreatingShell, setIsCreatingShell] = useState<boolean>(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(
    () => getLocalTodayIsoDate()
  );
  const [selectedPreviewFormId, setSelectedPreviewFormId] = useState<
    string | null
  >(null);
  const [calendarYear, setCalendarYear] = useState<number>(() =>
    parseYearMonthKey(getLocalTodayIsoDate().slice(0, 7), getLocalTodayIsoDate())
      .year
  );
  const [calendarMonth, setCalendarMonth] = useState<number>(() =>
    parseYearMonthKey(getLocalTodayIsoDate().slice(0, 7), getLocalTodayIsoDate())
      .month
  );

  const [isManualGroupOpen, setIsManualGroupOpen] = useState<boolean>(false);
  const [isZaloScanOpen, setIsZaloScanOpen] = useState<boolean>(false);
  const [isReordering, setIsReordering] = useState<boolean>(false);

  const [viewingForm, setViewingForm] = useState<OvertimeFormWithItems | null>(
    null
  );
  const [loadingViewFormId, setLoadingViewFormId] = useState<string | null>(
    null
  );
  const [deletingForms, setDeletingForms] = useState<OvertimeFormWithItems[]>(
    []
  );
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [lockingForm, setLockingForm] = useState<OvertimeFormWithItems | null>(
    null
  );
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [unlockingForm, setUnlockingForm] =
    useState<OvertimeFormWithItems | null>(null);
  const [unlockKeywordInput, setUnlockKeywordInput] = useState<string>('');
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [exportingFormId, setExportingFormId] = useState<string | null>(null);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [sqlErrorContext, setSqlErrorContext] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);

  const effectiveWorkShifts = useMemo(
    () =>
      workShifts && workShifts.length > 0
        ? workShifts
        : [createDefaultAdminShift()],
    [workShifts]
  );

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  const knownSubGroups = useMemo(() => {
    const names = new Set<string>();
    groups.forEach((g) => {
      if (g.name?.trim()) names.add(g.name.trim());
    });
    employees.forEach((emp) => {
      if (emp.department?.trim()) names.add(emp.department.trim());
    });
    return Array.from(names);
  }, [groups, employees]);

  const getDisplayDepartment = (rawDepartment?: string | null) =>
    resolveOvertimeMainDepartment(rawDepartment, knownSubGroups);

  const activeMonthKey = useMemo(
    () => formatYearMonthKey(calendarYear, calendarMonth),
    [calendarYear, calendarMonth]
  );

  const formStatusByDate = useMemo(
    () => collectOvertimeFormStatusByDate(forms),
    [forms]
  );

  const calendarYearOptions = useMemo(
    () => buildCalendarYearOptions(forms, calendarYear, currentYear),
    [forms, calendarYear, currentYear]
  );

  const calendarGridCells = useMemo(
    () =>
      buildOvertimeMonthCalendarGrid(
        calendarYear,
        calendarMonth,
        formStatusByDate
      ),
    [calendarYear, calendarMonth, formStatusByDate]
  );

  const filteredForms = useMemo(
    () =>
      filterOvertimeForms(
        forms,
        '',
        selectedDateFilter || activeMonthKey,
        knownSubGroups
      ),
    [forms, selectedDateFilter, activeMonthKey, knownSubGroups]
  );

  // Phiếu đang hiển thị ở khung "Các nhóm tăng ca" & A4 Preview bên phải
  const activePreviewForm = useMemo<OvertimeFormWithItems | null>(() => {
    if (selectedDateFilter) {
      return (
        forms.find(
          (f) => !f.deleted_at && (f.overtime_date || '') === selectedDateFilter
        ) || null
      );
    }
    if (selectedPreviewFormId) {
      const matched = filteredForms.find((f) => f.id === selectedPreviewFormId);
      if (matched) return matched;
    }
    return filteredForms[0] || null;
  }, [forms, filteredForms, selectedDateFilter, selectedPreviewFormId]);

  const activeTargetDate = useMemo(() => {
    if (selectedDateFilter) return selectedDateFilter;
    if (activePreviewForm?.overtime_date) return activePreviewForm.overtime_date;
    return todayIsoDate;
  }, [selectedDateFilter, activePreviewForm, todayIsoDate]);

  const activeBlocks = useMemo(
    () =>
      activePreviewForm
        ? reconstructBlocksFromItems(activePreviewForm.items || [])
        : [],
    [activePreviewForm]
  );

  const fallbackNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of activePreviewForm?.items || []) {
      const id = item.employee_id?.trim();
      const name = item.employee_name?.trim();
      if (id && name && !map.has(id)) {
        map.set(id, name);
      }
    }
    return map;
  }, [activePreviewForm]);

  const isActiveFormLocked = Boolean(
    activePreviewForm && isOvertimeFormLocked(activePreviewForm)
  );

  // Giữ selectedPreviewFormId đồng bộ khi danh sách lọc thay đổi
  useEffect(() => {
    if (selectedDateFilter) {
      setSelectedPreviewFormId(activePreviewForm?.id || null);
      return;
    }
    if (
      selectedPreviewFormId &&
      !filteredForms.some((f) => f.id === selectedPreviewFormId)
    ) {
      setSelectedPreviewFormId(filteredForms[0]?.id || null);
    }
  }, [selectedDateFilter, filteredForms, activePreviewForm, selectedPreviewFormId]);

  const handleCalendarMonthSelect = (nextMonth: number) => {
    setCalendarMonth(nextMonth);
    setSelectedDateFilter(null);
  };

  const handleCalendarYearSelect = (nextYear: number) => {
    setCalendarYear(nextYear);
    setSelectedDateFilter(null);
  };

  const handleShiftCalendarMonth = (delta: -1 | 1) => {
    const shifted = shiftYearMonth(calendarYear, calendarMonth, delta);
    setCalendarYear(shifted.year);
    setCalendarMonth(shifted.month);
    setSelectedDateFilter(null);
  };

  const handleCalendarTodayClick = () => {
    const parsedToday = parseYearMonthKey(currentMonthKey, todayIsoDate);
    setCalendarYear(parsedToday.year);
    setCalendarMonth(parsedToday.month);
    setSelectedDateFilter(todayIsoDate);
  };

  const handleCalendarDayClick = (isoDate: string) => {
    setSelectedDateFilter(isoDate);
  };

  // Đồng bộ modal xem chi tiết khi danh sách phiếu được cập nhật trực tiếp trong phiên làm việc
  useEffect(() => {
    const activeForms = forms.filter((f) => !f.deleted_at);
    const activeById = new Map(activeForms.map((f) => [f.id, f]));
    if (viewingForm) {
      const updatedView = activeById.get(viewingForm.id);
      if (!updatedView) {
        setViewingForm(null);
        onShowToast?.('Phiếu đang xem vừa được xóa khỏi hệ thống.');
      } else if (updatedView !== viewingForm) {
        setViewingForm(updatedView);
      }
    }
  }, [forms, viewingForm, onShowToast]);

  const handleSupabaseError = (error: unknown) => {
    if (error instanceof OvertimeSupabaseActionError && error.needsSqlFix) {
      setSqlErrorContext(error.message);
      setIsSqlModalOpen(true);
      onShowToast?.(error.message);
    } else if (error instanceof OvertimeSupabaseActionError) {
      onShowToast?.(error.message);
    } else {
      onShowToast?.(getFriendlyErrorMessage(error));
    }
  };

  const handleCreateShellClick = async () => {
    if (isCreatingShell) return;
    if (!onCreateOrOpenShell) {
      onSwitchToCreate?.();
      return;
    }
    setIsCreatingShell(true);
    try {
      const targetOvertimeDate = selectedDateFilter || getLocalTodayIsoDate();
      await onCreateOrOpenShell(targetOvertimeDate);
      setSelectedDateFilter(targetOvertimeDate);
    } catch (error) {
      handleSupabaseError(error);
    } finally {
      setIsCreatingShell(false);
    }
  };

  const handleReorderBlock = async (index: number, direction: 'up' | 'down') => {
    if (!activePreviewForm || !onUpdateFormBlocks || isReordering) return;
    if (isOvertimeFormLocked(activePreviewForm)) return;

    const nextBlocks = reorderOvertimeBlocks(activeBlocks, index, direction);
    if (nextBlocks === activeBlocks) return;

    setIsReordering(true);
    try {
      await onUpdateFormBlocks(activePreviewForm, nextBlocks);
    } catch (error) {
      handleSupabaseError(error);
    } finally {
      setIsReordering(false);
    }
  };

  const handleConfirmManualGroup = async (
    payload: ConfirmableOvertimeBlockPayload
  ) => {
    if (!onAppendBlocksToDate) return;
    try {
      const updated = await onAppendBlocksToDate(activeTargetDate, [payload]);
      const targetDate = (updated.overtime_date || activeTargetDate).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        const parsed = parseYearMonthKey(targetDate.slice(0, 7), targetDate);
        setCalendarYear(parsed.year);
        setCalendarMonth(parsed.month);
        setSelectedDateFilter(targetDate);
      }
      setSelectedPreviewFormId(updated.id);
      setIsManualGroupOpen(false);
    } catch (error) {
      handleSupabaseError(error);
      throw error;
    }
  };

  const handleConfirmZaloBlocks = async (
    payloads: ConfirmableOvertimeBlockPayload[]
  ) => {
    if (!onAppendBlocksToDate || payloads.length === 0) return;
    try {
      // Nhóm các payloads theo ngày tăng ca (thường cùng ngày) để cập nhật sạch sẽ từng vỏ phiếu
      const byDate = new Map<string, ConfirmableOvertimeBlockPayload[]>();
      for (const p of payloads) {
        const d = (p.overtimeDate || activeTargetDate).trim() || activeTargetDate;
        const arr = byDate.get(d) || [];
        arr.push(p);
        byDate.set(d, arr);
      }

      let lastUpdated: OvertimeFormWithItems | null = null;
      for (const [dateKey, groupPayloads] of byDate.entries()) {
        lastUpdated = await onAppendBlocksToDate(dateKey, groupPayloads);
      }

      if (lastUpdated) {
        const targetDate = (lastUpdated.overtime_date || activeTargetDate).slice(
          0,
          10
        );
        if (/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
          const parsed = parseYearMonthKey(targetDate.slice(0, 7), targetDate);
          setCalendarYear(parsed.year);
          setCalendarMonth(parsed.month);
          setSelectedDateFilter(targetDate);
        }
        setSelectedPreviewFormId(lastUpdated.id);
      }
      setIsZaloScanOpen(false);
    } catch (error) {
      handleSupabaseError(error);
      throw error;
    }
  };

  const handleViewForm = async (form: OvertimeFormWithItems) => {
    setLoadingViewFormId(form.id);
    try {
      const freshForm = await fetchOvertimeFormById(form.id);
      if (!freshForm) {
        onShowToast?.(
          `Phiếu ${formatOvertimeFormCodeDisplay(form.form_code)} đã bị xóa trên hệ thống.`
        );
        await onRefresh();
        return;
      }
      setViewingForm(freshForm);
    } catch {
      setViewingForm(form);
    } finally {
      setLoadingViewFormId(null);
    }
  };

  const handleExportFormExcel = async (form: OvertimeFormWithItems) => {
    setExportingFormId(form.id);
    try {
      const freshForm = await fetchOvertimeFormById(form.id);
      if (!freshForm) {
        onShowToast?.(
          `Phiếu ${formatOvertimeFormCodeDisplay(form.form_code)} đã bị xóa, không thể xuất file.`
        );
        if (viewingForm?.id === form.id) {
          setViewingForm(null);
        }
        await onRefresh();
        return;
      }

      const blocks = reconstructBlocksFromItems(freshForm.items);
      if (blocks.length === 0) {
        onShowToast?.('Phiếu không có dữ liệu nhân sự để xuất Excel.');
        return;
      }
      const mainDepartment = getDisplayDepartment(freshForm.department);
      const mergedEmployees = buildMergedEmployeesForExport(
        freshForm.items,
        employees,
        mainDepartment
      );
      await overtimeExportService.exportExcel({
        department: mainDepartment,
        overtimeDate: freshForm.overtime_date,
        blocks,
        employees: mergedEmployees,
        knownSubGroups,
      });
      onShowToast?.(
        `Đã xuất file Excel cho phiếu ${formatOvertimeFormCodeDisplay(
          freshForm.form_code
        )}.`
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        onShowToast?.('Đã hủy chọn thư mục lưu file.');
      } else {
        onShowToast?.(getFriendlyErrorMessage(error));
      }
    } finally {
      setExportingFormId(null);
    }
  };

  const handleOpenDeleteModal = (targets: OvertimeFormWithItems[]) => {
    if (targets.length === 0) return;
    if (targets.some((f) => isOvertimeFormLocked(f))) {
      onShowToast?.(
        'Phiếu đã chốt nên không thể xóa. Vui lòng thực hiện mở khóa khẩn cấp trước nếu cần xóa.'
      );
      return;
    }
    setIsDeleteConfirmed(false);
    setDeletingForms(targets);
  };

  const handleOpenLockModal = (form: OvertimeFormWithItems) => {
    if (isOvertimeFormLocked(form)) return;
    setLockingForm(form);
  };

  const handleCloseLockModal = () => {
    if (isLocking) return;
    setLockingForm(null);
  };

  const handleConfirmLock = async () => {
    if (!lockingForm || !onLockForm) return;
    setIsLocking(true);
    try {
      await onLockForm(lockingForm);
      setLockingForm(null);
    } catch (error) {
      if (error instanceof OvertimeSupabaseActionError && error.needsSqlFix) {
        setLockingForm(null);
      }
      handleSupabaseError(error);
    } finally {
      setIsLocking(false);
    }
  };

  const handleOpenUnlockModal = (form: OvertimeFormWithItems) => {
    if (!isOvertimeFormLocked(form)) return;
    setUnlockKeywordInput('');
    setUnlockingForm(form);
  };

  const handleCloseUnlockModal = () => {
    if (isUnlocking) return;
    setUnlockingForm(null);
    setUnlockKeywordInput('');
  };

  const handleConfirmUnlock = async () => {
    if (!unlockingForm || !onUnlockForm) return;
    if (unlockKeywordInput.trim() !== 'MO KHOA') return;
    setIsUnlocking(true);
    try {
      await onUnlockForm(unlockingForm);
      setUnlockingForm(null);
      setUnlockKeywordInput('');
    } catch (error) {
      if (error instanceof OvertimeSupabaseActionError && error.needsSqlFix) {
        setUnlockingForm(null);
        setUnlockKeywordInput('');
      }
      handleSupabaseError(error);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) return;
    setDeletingForms([]);
    setIsDeleteConfirmed(false);
  };

  const handleConfirmDelete = async () => {
    if (deletingForms.length === 0 || !isDeleteConfirmed) return;
    setIsDeleting(true);
    try {
      const targetIds = deletingForms.map((f) => f.id);
      const targetIdSet = new Set(targetIds);
      const firstCode = formatOvertimeFormCodeDisplay(deletingForms[0].form_code);

      await onSoftDelete(targetIds);

      if (viewingForm && targetIdSet.has(viewingForm.id)) {
        setViewingForm(null);
      }
      setDeletingForms([]);
      setIsDeleteConfirmed(false);

      if (targetIds.length === 1) {
        onShowToast?.(`Đã xóa mềm phiếu tăng ca ${firstCode} khỏi nhật ký.`);
      } else {
        onShowToast?.(
          `Đã xóa mềm ${formatNumberVN(targetIds.length)} phiếu tăng ca khỏi nhật ký.`
        );
      }
    } catch (error) {
      if (error instanceof OvertimeSupabaseActionError && error.needsSqlFix) {
        setDeletingForms([]);
        setIsDeleteConfirmed(false);
      }
      handleSupabaseError(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(
        SUPABASE_OVERTIME_REALTIME_AND_SOFT_DELETE_SQL
      );
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = SUPABASE_OVERTIME_REALTIME_AND_SOFT_DELETE_SQL;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintForm = (form: OvertimeFormWithItems) => {
    if (activePreviewForm?.id === form.id) {
      window.print();
      return;
    }
    setSelectedPreviewFormId(form.id);
    window.setTimeout(() => {
      window.print();
    }, 80);
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col gap-2.5 lg:overflow-hidden print:h-auto print:overflow-visible">
      {/* Cảnh báo nhẹ khi DB Supabase chưa có cột deleted_at trên overtime_form_items */}
      {schemaNeedsMigration && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Bảng <code className="font-mono font-semibold">overtime_form_items</code>{' '}
              trên Supabase chưa có cột <code className="font-mono font-semibold">deleted_at</code>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSqlErrorContext(null);
              setIsSqlModalOpen(true);
            }}
            className="h-8 px-3 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Xem mã SQL chuẩn hóa</span>
          </button>
        </div>
      )}

      {/* Bố cục 2 cột vừa khít 1 màn hình desktop: Cột trái (Lịch thu gọn + Nhóm tăng ca) | Cột phải (Bảng tóm tắt + Xem trước A4 cuộn độc lập) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:overflow-hidden print:h-auto print:overflow-visible">
        {/* CỘT TRÁI */}
        <aside className="w-full lg:w-[350px] xl:w-[380px] shrink-0 lg:h-full min-h-0 flex flex-col gap-2.5 no-print">
          {/* Nửa trên: Lịch tháng thu gọn */}
          <div
            data-testid="overtime-log-calendar-card"
            aria-label="Lịch chọn ngày tăng ca"
            className="shrink-0 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xs space-y-1.5"
          >
            {/* Thanh điều hướng tháng + năm + Hôm nay + All */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => handleShiftCalendarMonth(-1)}
                  data-testid="calendar-prev-month-btn"
                  aria-label="Tháng trước"
                  title="Tháng trước"
                  className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <select
                  value={calendarMonth}
                  onChange={(e) =>
                    handleCalendarMonthSelect(Number(e.target.value))
                  }
                  aria-label="Chọn tháng trên lịch"
                  data-testid="calendar-month-select"
                  className="h-7 px-1.5 text-[11px] font-bold text-slate-800 rounded-lg border border-slate-200 bg-white focus:border-[#14539E] focus:outline-none cursor-pointer tabular-nums"
                >
                  {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                    <option key={m} value={m}>
                      Tháng {m}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleShiftCalendarMonth(1)}
                  data-testid="calendar-next-month-btn"
                  aria-label="Tháng sau"
                  title="Tháng sau"
                  className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <select
                  value={calendarYear}
                  onChange={(e) =>
                    handleCalendarYearSelect(Number(e.target.value))
                  }
                  aria-label="Chọn năm trên lịch"
                  data-testid="calendar-year-select"
                  className="h-7 px-1.5 text-[11px] font-bold text-slate-800 rounded-lg border border-slate-200 bg-white focus:border-[#14539E] focus:outline-none cursor-pointer tabular-nums"
                >
                  {calendarYearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleCalendarTodayClick}
                  data-testid="calendar-today-btn"
                  className="h-7 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#14539E] text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter(null)}
                  data-testid="calendar-show-all-month-btn"
                  aria-pressed={selectedDateFilter === null}
                  title="Xem tất cả phiếu trong tháng"
                  className={`h-7 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedDateFilter === null
                      ? 'bg-[#14539E] text-white border border-[#14539E]'
                      : 'border border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Tiêu đề 7 thứ trong tuần */}
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {CALENDAR_WEEKDAY_HEADERS.map((label) => {
                const isSundayHeader = label === 'CN';
                return (
                  <div
                    key={label}
                    className={`py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isSundayHeader
                        ? 'bg-slate-100/80 text-slate-500 rounded-md'
                        : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* Lưới các ngày siêu gọn (h-6) */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarGridCells.map((cell) => {
                if (!cell.inCurrentMonth) {
                  return (
                    <div
                      key={cell.isoDate}
                      aria-hidden="true"
                      className={`h-6 flex items-center justify-center text-[11px] tabular-nums select-none ${
                        cell.isSunday
                          ? 'bg-slate-100/50 text-slate-300 rounded-md'
                          : 'text-slate-300'
                      }`}
                    >
                      <span>{cell.day}</span>
                    </div>
                  );
                }

                const isSelected = selectedDateFilter === cell.isoDate;
                const isToday = cell.isoDate === todayIsoDate;

                let cellStyle =
                  'text-slate-700 hover:bg-slate-100 rounded-md';
                if (isSelected) {
                  cellStyle =
                    'bg-[#14539E] text-white font-bold shadow-xs rounded-md';
                } else if (cell.isSunday) {
                  cellStyle =
                    'bg-slate-100/80 text-slate-500 hover:bg-slate-200/70 rounded-md';
                }

                const todayRing =
                  !isSelected && isToday
                    ? 'ring-1 ring-inset ring-[#14539E]/60 text-[#14539E] font-bold'
                    : '';

                return (
                  <button
                    key={cell.isoDate}
                    type="button"
                    onClick={() => handleCalendarDayClick(cell.isoDate)}
                    data-testid={`calendar-day-${cell.isoDate}`}
                    aria-pressed={isSelected}
                    aria-label={`Ngày ${formatDateToFormStyle(cell.isoDate)}${
                      cell.formStatus === 'locked'
                        ? ', phiếu đã chốt'
                        : cell.formStatus === 'open'
                          ? ', đã có phiếu chưa chốt'
                          : ''
                    }`}
                    title={
                      cell.formStatus === 'locked'
                        ? `${formatDateToFormStyle(cell.isoDate)} • Phiếu đã chốt`
                        : cell.formStatus === 'open'
                          ? `${formatDateToFormStyle(cell.isoDate)} • Đã có phiếu (chưa chốt)`
                          : formatDateToFormStyle(cell.isoDate)
                    }
                    className={`h-6 flex flex-col items-center justify-center text-[11px] tabular-nums transition-colors cursor-pointer ${cellStyle} ${todayRing}`}
                  >
                    <span className="text-[10px] leading-none">{cell.day}</span>
                    {cell.formStatus === 'locked' ? (
                      <Lock
                        data-testid={`calendar-lock-${cell.isoDate}`}
                        className={`w-2 h-2 mt-0.5 ${
                          isSelected ? 'text-white' : 'text-[#14539E]'
                        }`}
                      />
                    ) : cell.formStatus === 'open' ? (
                      <span
                        data-testid={`calendar-dot-${cell.isoDate}`}
                        className={`w-1 h-1 rounded-full mt-0.5 ${
                          isSelected ? 'bg-white' : 'bg-[#14539E]'
                        }`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nửa dưới: Card "Nhóm tăng ca" siêu gọn (chỉ 1 dòng / nhóm) */}
          <div
            data-testid="overtime-day-groups-card"
            className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xs gap-2"
          >
            <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900">
                Nhóm tăng ca
              </h3>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={isActiveFormLocked || !onAppendBlocksToDate}
                  onClick={() => setIsManualGroupOpen(true)}
                  data-testid="open-manual-group-modal-btn"
                  title={
                    isActiveFormLocked
                      ? 'Phiếu đã chốt — khóa thêm nhóm'
                      : 'Thêm nhóm tăng ca thủ công'
                  }
                  aria-label="Thêm nhóm tăng ca thủ công"
                  className="h-7 w-7 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  disabled={isActiveFormLocked || !onAppendBlocksToDate}
                  onClick={() => setIsZaloScanOpen(true)}
                  data-testid="open-zalo-scan-modal-btn"
                  title={
                    isActiveFormLocked
                      ? 'Phiếu đã chốt — khóa quét ảnh Zalo'
                      : 'Quét ảnh lịch tăng ca từ Zalo (AI)'
                  }
                  aria-label="Quét ảnh lịch tăng ca từ Zalo (AI)"
                  className="h-7 w-7 rounded-lg border border-[#14539E]/35 bg-blue-50/70 hover:bg-[#14539E] text-[#14539E] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {activeBlocks.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-4 px-3 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60">
                <p className="text-xs font-medium text-slate-500">
                  Chưa có nhóm tăng ca ({formatDateToFormStyle(activeTargetDate)})
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
                {activeBlocks.map((block, idx) => {
                  const compactLabel = formatOvertimeGroupCompactLabel({
                    block,
                    index: idx,
                    formOvertimeDate:
                      activePreviewForm?.overtime_date || activeTargetDate,
                    allBlocks: activeBlocks,
                    employeeMap,
                    fallbackNamesById,
                  });
                  const canMoveUp =
                    !isActiveFormLocked && !isReordering && idx > 0;
                  const canMoveDown =
                    !isActiveFormLocked &&
                    !isReordering &&
                    idx < activeBlocks.length - 1;

                  return (
                    <div
                      key={block.id || `grp-${idx}`}
                      data-testid={`overtime-group-card-${idx}`}
                      title={compactLabel}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white py-1 px-2 text-xs flex items-center justify-between gap-2 transition-colors"
                    >
                      <span className="min-w-0 truncate font-medium text-slate-800">
                        {compactLabel}
                      </span>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={!canMoveUp}
                          onClick={() => void handleReorderBlock(idx, 'up')}
                          data-testid={`move-group-up-${idx}`}
                          title="Di chuyển nhóm lên trên"
                          aria-label={`Di chuyển nhóm #${idx + 1} lên`}
                          className="h-5 w-5 rounded border border-slate-200 bg-white hover:bg-blue-50 hover:border-[#14539E]/40 text-slate-600 hover:text-[#14539E] inline-flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          disabled={!canMoveDown}
                          onClick={() => void handleReorderBlock(idx, 'down')}
                          data-testid={`move-group-down-${idx}`}
                          title="Di chuyển nhóm xuống dưới"
                          aria-label={`Di chuyển nhóm #${idx + 1} xuống`}
                          className="h-5 w-5 rounded border border-slate-200 bg-white hover:bg-blue-50 hover:border-[#14539E]/40 text-slate-600 hover:text-[#14539E] inline-flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* CỘT PHẢI: Bảng tóm tắt cố định ở trên + duy nhất khung Xem trước A4 TV-PSGC2022 cuộn bên dưới */}
        <div className="flex-1 min-w-0 w-full lg:h-full min-h-0 flex flex-col gap-2.5 print:h-auto print:overflow-visible">
          {/* Bảng tóm tắt phiếu tăng ca */}
          <div className="shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs no-print">
            <div className="overflow-x-auto max-h-[190px] overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <th className="py-2 px-3 w-12 text-center">STT</th>
                    <th className="py-2 px-3 min-w-[130px]">Mã phiếu</th>
                    <th className="py-2 px-3 min-w-[115px]">Ngày tăng ca</th>
                    <th className="py-2 px-3 w-28 text-center">Trạng thái</th>
                    <th className="py-2 px-3 w-56 text-left">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {isLoading ? (
                    Array.from({ length: 2 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`} className="h-11 animate-pulse">
                        <td className="py-2 px-3 text-center">
                          <div className="h-3.5 w-6 bg-slate-200 rounded mx-auto" />
                        </td>
                        <td className="py-2 px-3">
                          <div className="h-3.5 w-28 bg-slate-200 rounded" />
                        </td>
                        <td className="py-2 px-3">
                          <div className="h-3.5 w-24 bg-slate-200 rounded" />
                        </td>
                        <td className="py-2 px-3">
                          <div className="h-5 w-20 bg-slate-200 rounded-full mx-auto" />
                        </td>
                        <td className="py-2 px-3">
                          <div className="h-7 w-48 bg-slate-200 rounded" />
                        </td>
                      </tr>
                    ))
                  ) : filteredForms.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-6 text-center">
                        <div className="max-w-md mx-auto flex flex-col items-center">
                          <FileText className="w-7 h-7 text-slate-300 mb-2" />
                          <p className="text-sm font-semibold text-slate-800">
                            {selectedDateFilter
                              ? `Chưa có phiếu tăng ca nào trong ngày ${formatDateToFormStyle(
                                  selectedDateFilter
                                )}`
                              : `Chưa có phiếu tăng ca nào trong Tháng ${String(
                                  calendarMonth
                                ).padStart(2, '0')}/${calendarYear}`}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Bấm <strong>+</strong> hoặc <strong>Camera</strong>{' '}
                            ở cột trái để thêm nhóm tăng ca ngay.
                          </p>
                          {(onCreateOrOpenShell || onSwitchToCreate) && (
                            <button
                              type="button"
                              disabled={isCreatingShell}
                              onClick={() => void handleCreateShellClick()}
                              data-testid="empty-state-create-shell-btn"
                              className="mt-3 h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              {isCreatingShell ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FilePlus2 className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {selectedDateFilter
                                  ? `Tạo vỏ phiếu ngày ${formatDateToFormStyle(
                                      selectedDateFilter
                                    )}`
                                  : 'Tạo vỏ phiếu ngày hôm nay'}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredForms.map((form, index) => {
                      const isExporting = exportingFormId === form.id;
                      const isViewingLoading = loadingViewFormId === form.id;
                      const isLocked = isOvertimeFormLocked(form);
                      const isNewShell =
                        !isLocked &&
                        (form.status === 'Mới tạo' ||
                          form.total_participants === 0);
                      const displayCode = formatOvertimeFormCodeDisplay(
                        form.form_code
                      );
                      const isSelectedRow = activePreviewForm?.id === form.id;

                      return (
                        <tr
                          key={form.id}
                          data-testid={`overtime-summary-row-${form.id}`}
                          onClick={() => setSelectedPreviewFormId(form.id)}
                          className={`transition-colors cursor-pointer ${
                            isSelectedRow
                              ? 'bg-blue-50/55'
                              : isLocked
                                ? 'bg-slate-50/40 hover:bg-blue-50/30'
                                : 'hover:bg-slate-50/90'
                          }`}
                        >
                          {/* 1. STT */}
                          <td className="py-2 px-3 text-center font-mono text-slate-500 tabular-nums">
                            {formatNumberVN(index + 1)}
                          </td>

                          {/* 2. Mã phiếu */}
                          <td className="py-2 px-3 font-mono font-semibold text-[#14539E] tabular-nums whitespace-nowrap">
                            {displayCode}
                          </td>

                          {/* 3. Ngày tăng ca */}
                          <td className="py-2 px-3 font-mono text-slate-800 font-semibold tabular-nums whitespace-nowrap">
                            {formatDateToFormStyle(form.overtime_date || '')}
                          </td>

                          {/* 4. Trạng thái */}
                          <td className="py-2 px-3 text-center">
                            {isLocked ? (
                              <span
                                data-testid={`form-status-locked-${form.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#14539E]/10 text-[#14539E] border border-[#14539E]/25 text-[11px] font-bold whitespace-nowrap"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Đã chốt</span>
                              </span>
                            ) : isNewShell ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14539E] whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#14539E]" />
                                Mới tạo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                {form.status || 'Đã lưu'}
                              </span>
                            )}
                          </td>

                          {/* 5. Thao tác: Xem -> Sửa -> Xuất Excel -> In -> Chốt/Mở khóa -> Xóa */}
                          <td
                            className="py-2 px-3 text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-start gap-1">
                              {/* 1) Xem phiếu */}
                              <button
                                type="button"
                                disabled={isViewingLoading}
                                onClick={() => void handleViewForm(form)}
                                className="h-7 w-7 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                                title="Xem phiếu"
                                aria-label={`Xem phiếu ${displayCode}`}
                              >
                                {isViewingLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* 2) Sửa phiếu */}
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => {
                                  if (!isLocked) onEdit(form);
                                }}
                                className="h-7 w-7 rounded-lg border border-[#14539E]/30 bg-blue-50/60 text-[#14539E] hover:bg-[#14539E] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                                title={
                                  isLocked
                                    ? 'Phiếu đã chốt — không thể sửa'
                                    : 'Sửa phiếu'
                                }
                                aria-label={
                                  isLocked
                                    ? `Phiếu ${displayCode} đã chốt, khóa chức năng sửa`
                                    : `Sửa phiếu ${displayCode}`
                                }
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {/* 3) Xuất Excel */}
                              <button
                                type="button"
                                disabled={
                                  isExporting || form.items.length === 0
                                }
                                onClick={() => void handleExportFormExcel(form)}
                                data-testid={`export-excel-btn-${form.id}`}
                                className="h-7 w-7 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                                title="Xuất Excel"
                                aria-label={`Xuất Excel phiếu ${displayCode}`}
                              >
                                {isExporting ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* 4) In phiếu */}
                              <button
                                type="button"
                                onClick={() => handlePrintForm(form)}
                                data-testid={`print-form-btn-${form.id}`}
                                className="h-7 w-7 rounded-lg border border-[#14539E]/30 bg-blue-50/50 text-[#14539E] hover:bg-[#14539E] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                                title="In phiếu"
                                aria-label={`In phiếu ${displayCode}`}
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* 5) Chốt / Mở khóa phiếu */}
                              {isLocked ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenUnlockModal(form)}
                                  data-testid={`unlock-form-btn-${form.id}`}
                                  className="h-7 w-7 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white hover:border-amber-600 inline-flex items-center justify-center transition-colors cursor-pointer"
                                  title="Mở khóa khẩn cấp"
                                  aria-label={`Mở khóa khẩn cấp phiếu ${displayCode}`}
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenLockModal(form)}
                                  data-testid={`lock-form-btn-${form.id}`}
                                  className="h-7 w-7 rounded-lg border border-[#14539E]/30 bg-white text-[#14539E] hover:bg-[#14539E] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                                  title="Chốt phiếu"
                                  aria-label={`Chốt phiếu ${displayCode}`}
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 6) Xóa mềm */}
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleOpenDeleteModal([form])}
                                data-testid={`delete-form-btn-${form.id}`}
                                className="h-7 w-7 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100 disabled:hover:border-slate-200 disabled:cursor-not-allowed"
                                title={
                                  isLocked
                                    ? 'Phiếu đã chốt — không thể xóa'
                                    : 'Xóa mềm phiếu'
                                }
                                aria-label={
                                  isLocked
                                    ? `Phiếu ${displayCode} đã chốt, khóa chức năng xóa`
                                    : `Xóa mềm phiếu ${displayCode}`
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Khung xem trước trực tiếp A4 chuẩn TV-PSGC2022 (duy nhất khung này cuộn dọc trên desktop) */}
          {activePreviewForm && (
            <div
              data-testid="overtime-inline-a4-scroll"
              className="bg-slate-100/80 p-4 flex-1 min-h-0 overflow-y-auto overflow-x-auto flex justify-center items-start rounded-2xl border border-slate-200 overtime-print-scroll print:overflow-visible print:border-0 print:bg-white print:p-0 print:block"
            >
              <OvertimeA4PreviewSheet
                form={activePreviewForm}
                knownSubGroups={knownSubGroups}
                variant="inline"
                isPrintableTarget={!viewingForm}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal Thêm nhóm tăng ca thủ công */}
      <ManualOvertimeGroupModal
        isOpen={isManualGroupOpen}
        onClose={() => setIsManualGroupOpen(false)}
        defaultDate={activeTargetDate}
        employees={employees}
        groups={groups}
        leaveRecords={leaveRecords}
        existingBlocks={activeBlocks}
        glossaryEntries={glossaryEntries}
        workShifts={effectiveWorkShifts}
        companyHolidays={companyHolidays}
        translateMultilineKorean={translateMultilineKorean}
        onGlossaryEntriesUpdated={onGlossaryEntriesUpdated}
        onLeaveRecordsRefreshed={onLeaveRecordsRefreshed}
        onConfirm={handleConfirmManualGroup}
      />

      {/* Modal Quét ảnh lịch tăng ca từ Zalo (AI) */}
      <ZaloScheduleScanModal
        isOpen={isZaloScanOpen}
        onClose={() => setIsZaloScanOpen(false)}
        employees={employees}
        glossaryEntries={glossaryEntries}
        leaveRecords={leaveRecords}
        existingPreviewBlocks={activeBlocks}
        defaultDate={activeTargetDate}
        translateMultilineKorean={translateMultilineKorean}
        onLeaveRecordsRefreshed={onLeaveRecordsRefreshed}
        onParseScheduleImage={parseOvertimeScheduleImage}
        onConfirmBlock={(payload) => handleConfirmZaloBlocks([payload])}
        onConfirmAllBlocks={handleConfirmZaloBlocks}
      />

      {/* Modal Xem tờ phiếu A4 chuẩn TV-PSGC2022 */}
      {viewingForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overtime-modal-title"
          className="overtime-print-modal-root fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 sm:p-5"
        >
          <div className="bg-slate-100 rounded-2xl border border-slate-300 shadow-2xl w-full max-w-[920px] max-h-[92vh] flex flex-col overflow-hidden overtime-print-container">
            <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
              <div className="min-w-0">
                <h2
                  id="overtime-modal-title"
                  className="text-sm font-bold text-slate-900 flex items-center gap-2"
                >
                  <span className="font-mono text-[#14539E]">
                    {formatOvertimeFormCodeDisplay(viewingForm.form_code)}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="truncate">
                    {getDisplayDepartment(viewingForm.department)}
                  </span>
                  {isOvertimeFormLocked(viewingForm) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#14539E]/10 text-[#14539E] border border-[#14539E]/25 text-[11px] font-bold shrink-0">
                      <Lock className="w-3 h-3" />
                      <span>Đã chốt</span>
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                  Biểu mẫu TV-PSGC2022 •{' '}
                  {formatNumberVN(viewingForm.total_participants)} lượt •{' '}
                  {formatNumberVN(viewingForm.total_hours)} giờ
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isOvertimeFormLocked(viewingForm)}
                  title={
                    isOvertimeFormLocked(viewingForm)
                      ? 'Phiếu đã chốt — không thể sửa'
                      : 'Sửa / Nhập chi tiết lượt tăng ca'
                  }
                  onClick={() => {
                    if (isOvertimeFormLocked(viewingForm)) return;
                    const target = viewingForm;
                    setViewingForm(null);
                    onEdit(target);
                  }}
                  className="h-9 px-3.5 rounded-lg border border-[#14539E] text-[#14539E] hover:bg-blue-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Sửa / Nhập chi tiết</span>
                </button>

                <button
                  type="button"
                  disabled={exportingFormId === viewingForm.id}
                  onClick={() => void handleExportFormExcel(viewingForm)}
                  className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {exportingFormId === viewingForm.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>Xuất Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingForm(null)}
                  aria-label="Đóng cửa sổ xem phiếu"
                  className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-100/80 p-4 flex-1 min-h-0 overflow-y-auto overflow-x-auto flex justify-center items-start overtime-print-scroll print:overflow-visible print:bg-white print:p-0 print:block">
              <OvertimeA4PreviewSheet
                form={viewingForm}
                knownSubGroups={knownSubGroups}
                variant="modal"
                isPrintableTarget={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Chốt phiếu tăng ca */}
      {lockingForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lock-overtime-title"
          data-testid="lock-overtime-modal"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 no-print"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-[#14539E] flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="lock-overtime-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    Chốt phiếu tăng ca
                  </h3>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                    Xác nhận chốt phiếu tăng ca ngày{' '}
                    <strong className="font-mono text-[#14539E]">
                      {formatDateToFormStyle(lockingForm.overtime_date)}
                    </strong>
                    ? Sau khi chốt sẽ khóa chức năng sửa và xóa phiếu này.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isLocking}
                onClick={handleCloseLockModal}
                aria-label="Đóng hộp thoại chốt phiếu"
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Mã phiếu:</span>
                <span className="font-mono font-bold text-[#14539E]">
                  {formatOvertimeFormCodeDisplay(lockingForm.form_code)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Quy mô ghi nhận:</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {formatNumberVN(lockingForm.total_participants)} lượt •{' '}
                  {formatNumberVN(lockingForm.total_hours)} giờ
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isLocking}
                onClick={handleCloseLockModal}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isLocking}
                onClick={() => void handleConfirmLock()}
                data-testid="confirm-lock-overtime-btn"
                className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLocking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                <span>Xác nhận chốt phiếu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mở khóa khẩn cấp (yêu cầu nhập đúng từ khóa MO KHOA) */}
      {unlockingForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unlock-overtime-title"
          data-testid="unlock-overtime-modal"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center p-4 no-print"
        >
          <div className="bg-white rounded-xl border border-amber-200 shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldAlert className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3
                    id="unlock-overtime-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    Mở khóa khẩn cấp phiếu tăng ca
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Thao tác này chỉ dành cho trường hợp cần điều chỉnh khẩn cấp
                    dữ liệu đã chốt.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isUnlocking}
                onClick={handleCloseUnlockModal}
                aria-label="Đóng hộp thoại mở khóa khẩn cấp"
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-900 space-y-1 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-red-800">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Cảnh báo tác động dữ liệu:</span>
              </div>
              <p>
                Sau khi mở khóa phiếu{' '}
                <strong className="font-mono">
                  {formatOvertimeFormCodeDisplay(unlockingForm.form_code)}
                </strong>{' '}
                (ngày{' '}
                <strong className="font-mono">
                  {formatDateToFormStyle(unlockingForm.overtime_date)}
                </strong>
                ), phiếu sẽ cho phép sửa/xóa lại và{' '}
                <strong>tạm thời bị loại khỏi báo cáo Giờ Tăng ca</strong> cho
                đến khi được chốt lại.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="unlock-keyword-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Nhập chính xác từ khóa{' '}
                <code className="font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                  MO KHOA
                </code>{' '}
                để xác nhận:
              </label>
              <input
                id="unlock-keyword-input"
                type="text"
                autoFocus
                value={unlockKeywordInput}
                onChange={(e) => setUnlockKeywordInput(e.target.value)}
                placeholder="Nhập MO KHOA..."
                data-testid="unlock-keyword-input"
                className="w-full h-9 px-3 text-xs font-mono font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isUnlocking}
                onClick={handleCloseUnlockModal}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={
                  isUnlocking || unlockKeywordInput.trim() !== 'MO KHOA'
                }
                onClick={() => void handleConfirmUnlock()}
                data-testid="confirm-unlock-overtime-btn"
                className="h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {isUnlocking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
                <span>Xác nhận mở khóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận xóa mềm */}
      {deletingForms.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-overtime-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 no-print"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3
                    id="delete-overtime-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    {deletingForms.length === 1
                      ? 'Xác nhận xóa phiếu tăng ca'
                      : `Xác nhận xóa ${formatNumberVN(deletingForms.length)} phiếu tăng ca`}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Hệ thống sẽ đánh dấu xóa mềm (
                    <code className="font-mono">deleted_at</code>) trên cả{' '}
                    <code className="font-mono">overtime_forms</code> và{' '}
                    <code className="font-mono">overtime_form_items</code>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleCloseDeleteModal}
                aria-label="Đóng hộp thoại xác nhận xóa"
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deletingForms.length === 1 && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Mã phiếu:</span>
                  <span className="font-mono font-bold text-[#14539E]">
                    {formatOvertimeFormCodeDisplay(deletingForms[0].form_code)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Ngày tăng ca:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatDateToFormStyle(deletingForms[0].overtime_date)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Quy mô:</span>
                  <span className="font-medium text-slate-700 tabular-nums">
                    {formatNumberVN(deletingForms[0].total_participants)} lượt •{' '}
                    {formatNumberVN(deletingForms[0].total_hours)} giờ
                  </span>
                </div>
              </div>
            )}

            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-red-200/80 bg-red-50/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDeleteConfirmed}
                onChange={(e) => setIsDeleteConfirmed(e.target.checked)}
                data-testid="confirm-delete-checkbox"
                className="mt-0.5 w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
              />
              <span className="text-xs text-slate-700 leading-snug">
                Tôi xác nhận muốn xóa phiếu tăng ca{' '}
                <strong className="font-mono text-slate-900">
                  {formatOvertimeFormCodeDisplay(deletingForms[0].form_code)}
                </strong>{' '}
                khỏi nhật ký.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleCloseDeleteModal}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Không, giữ lại
              </button>
              <button
                type="button"
                disabled={isDeleting || !isDeleteConfirmed}
                onClick={() => void handleConfirmDelete()}
                data-testid="confirm-delete-overtime-btn"
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mã SQL Chuẩn hóa Supabase */}
      {isSqlModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mã SQL chuẩn hóa xóa mềm Supabase"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center p-4 no-print"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Database className="w-5 h-5 text-[#14539E] shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Chuẩn hóa Supabase: Xóa mềm (deleted_at)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chạy đoạn SQL sau trong SQL Editor trên Supabase để mở quyền
                    cập nhật deleted_at
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                aria-label="Đóng hộp thoại SQL"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 min-h-0">
              {sqlErrorContext && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                  {sqlErrorContext}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Áp dụng cho{' '}
                  <code className="font-mono text-[#14539E]">
                    public.overtime_forms
                  </code>{' '}
                  &amp;{' '}
                  <code className="font-mono text-[#14539E]">
                    public.overtime_form_items
                  </code>
                  :
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopySql()}
                  className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {sqlCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã sao chép SQL!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép mã SQL</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-900 text-blue-200 font-mono text-xs overflow-x-auto leading-relaxed select-all border border-slate-800">
                <code>{SUPABASE_OVERTIME_REALTIME_AND_SOFT_DELETE_SQL}</code>
              </pre>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  setIsSqlModalOpen(false);
                  await onRefresh();
                }}
                className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold cursor-pointer"
              >
                Đã chạy SQL, tải lại dữ liệu
              </button>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OvertimeLog;
