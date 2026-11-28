import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
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
  Printer,
  ShieldAlert,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { DepartmentGroup, Employee } from '../../../types/hr';
import {
  formatNumberVN,
  getFriendlyErrorMessage,
} from '../../../utils/errorAndSecurityService';
import {
  formatDateToFormStyle,
  formatDepartmentHeaderLabel,
  overtimeExportService,
} from '../../../utils/overtimeExportService';
import {
  buildMergedEmployeesForExport,
  buildPrintableDateGroupsFromItems,
  fetchOvertimeFormById,
  filterOvertimeForms,
  formatOvertimeFormCodeDisplay,
  getLocalTodayIsoDate,
  isOvertimeFormLocked,
  isOvertimeTimeBold,
  OvertimeFormWithItems,
  OvertimeSupabaseActionError,
  reconstructBlocksFromItems,
  resolveOvertimeMainDepartment,
  SUPABASE_OVERTIME_REALTIME_AND_SOFT_DELETE_SQL,
} from '../../../services/hrService';
import {
  buildCalendarYearOptions,
  buildOvertimeMonthCalendarGrid,
  CALENDAR_WEEKDAY_HEADERS,
  collectOvertimeFormDatesSet,
  formatYearMonthKey,
  parseYearMonthKey,
  shiftYearMonth,
} from '../../../utils/overtimeCalendarLogic';

export interface OvertimeLogProps {
  forms: OvertimeFormWithItems[];
  employees: Employee[];
  groups?: DepartmentGroup[];
  isLoading: boolean;
  schemaNeedsMigration?: boolean;
  onRefresh: () => Promise<void> | void;
  onCreateOrOpenShell?: (overtimeDate: string) => Promise<void> | void;
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
  isLoading,
  schemaNeedsMigration = false,
  onRefresh,
  onCreateOrOpenShell,
  onEdit,
  onLockForm,
  onUnlockForm,
  onSoftDelete,
  onSwitchToCreate,
  onShowToast,
}) => {
  const todayIsoDate = useMemo(() => getLocalTodayIsoDate(), []);
  const currentMonthKey = useMemo(
    () => todayIsoDate.slice(0, 7),
    [todayIsoDate]
  );
  const currentYear = useMemo(
    () => Number(todayIsoDate.slice(0, 4)),
    [todayIsoDate]
  );
  const [isCreatingShell, setIsCreatingShell] = useState<boolean>(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(
    null
  );
  const [calendarYear, setCalendarYear] = useState<number>(() =>
    parseYearMonthKey(getLocalTodayIsoDate().slice(0, 7), getLocalTodayIsoDate()).year
  );
  const [calendarMonth, setCalendarMonth] = useState<number>(() =>
    parseYearMonthKey(getLocalTodayIsoDate().slice(0, 7), getLocalTodayIsoDate()).month
  );
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

  const activeFormDatesSet = useMemo(
    () => collectOvertimeFormDatesSet(forms),
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
        activeFormDatesSet
      ),
    [calendarYear, calendarMonth, activeFormDatesSet]
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
    if (selectedDateFilter === isoDate) {
      setSelectedDateFilter(null);
      return;
    }
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
    } catch (error) {
      if (error instanceof OvertimeSupabaseActionError && error.needsSqlFix) {
        setSqlErrorContext(error.message);
        setIsSqlModalOpen(true);
        onShowToast?.(error.message);
      } else if (error instanceof OvertimeSupabaseActionError) {
        onShowToast?.(error.message);
      } else {
        onShowToast?.(getFriendlyErrorMessage(error));
      }
    } finally {
      setIsCreatingShell(false);
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
        setSqlErrorContext(error.message);
        setIsSqlModalOpen(true);
        onShowToast?.(error.message);
      } else if (error instanceof OvertimeSupabaseActionError) {
        onShowToast?.(error.message);
      } else {
        onShowToast?.(getFriendlyErrorMessage(error));
      }
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
        setSqlErrorContext(error.message);
        setIsSqlModalOpen(true);
        onShowToast?.(error.message);
      } else if (error instanceof OvertimeSupabaseActionError) {
        onShowToast?.(error.message);
      } else {
        onShowToast?.(getFriendlyErrorMessage(error));
      }
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
        setSqlErrorContext(error.message);
        setIsSqlModalOpen(true);
        onShowToast?.(error.message);
      } else if (error instanceof OvertimeSupabaseActionError) {
        onShowToast?.(error.message);
      } else {
        onShowToast?.(getFriendlyErrorMessage(error));
      }
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

  const handlePrintModal = () => {
    window.print();
  };

  const modalPrintableGroups = useMemo(() => {
    if (!viewingForm) return [];
    return buildPrintableDateGroupsFromItems(viewingForm.items);
  }, [viewingForm]);

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* Cảnh báo nhẹ khi DB Supabase chưa có cột deleted_at trên overtime_form_items */}
      {schemaNeedsMigration && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Bảng <code className="font-mono font-semibold">overtime_form_items</code>{' '}
              trên Supabase chưa có cột <code className="font-mono font-semibold">deleted_at</code>{' '}
              hoặc chưa bật Realtime đồng bộ giữa các user.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSqlErrorContext(null);
              setIsSqlModalOpen(true);
            }}
            className="h-8 px-3 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Xem mã SQL chuẩn hóa</span>
          </button>
        </div>
      )}

      {/* Bố cục 2 khối ngang: Khối 1 Lịch tháng bên trái | Khối 2 Thanh công cụ + Bảng nhật ký bên phải */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* KHỐI 1: Lịch tháng trực quan */}
        <aside
          data-testid="overtime-log-calendar-card"
          aria-label="Lịch chọn ngày tăng ca"
          className="w-full lg:w-[340px] xl:w-[380px] shrink-0 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs no-print space-y-3"
        >
          {/* Tiêu đề lịch: < Tháng > + Năm + Hôm nay */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => handleShiftCalendarMonth(-1)}
                data-testid="calendar-prev-month-btn"
                aria-label="Tháng trước"
                title="Tháng trước"
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={calendarMonth}
                onChange={(e) =>
                  handleCalendarMonthSelect(Number(e.target.value))
                }
                aria-label="Chọn tháng trên lịch"
                data-testid="calendar-month-select"
                className="h-8 px-2 text-xs font-bold text-slate-800 rounded-lg border border-slate-200 bg-white focus:border-[#14539E] focus:outline-none cursor-pointer tabular-nums"
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
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <select
                value={calendarYear}
                onChange={(e) =>
                  handleCalendarYearSelect(Number(e.target.value))
                }
                aria-label="Chọn năm trên lịch"
                data-testid="calendar-year-select"
                className="h-8 px-2 text-xs font-bold text-slate-800 rounded-lg border border-slate-200 bg-white focus:border-[#14539E] focus:outline-none cursor-pointer tabular-nums"
              >
                {calendarYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleCalendarTodayClick}
              data-testid="calendar-today-btn"
              className="h-8 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#14539E] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Hôm nay
            </button>
          </div>

          {/* Tiêu đề 7 thứ trong tuần: T2 -> CN */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {CALENDAR_WEEKDAY_HEADERS.map((label) => {
              const isSundayHeader = label === 'CN';
              return (
                <div
                  key={label}
                  className={`py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                    isSundayHeader
                      ? 'bg-slate-100/80 text-slate-500 rounded-lg'
                      : 'text-slate-500'
                  }`}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {/* Lưới các ngày trong tháng */}
          <div className="grid grid-cols-7 gap-1">
            {calendarGridCells.map((cell) => {
              if (!cell.inCurrentMonth) {
                return (
                  <div
                    key={cell.isoDate}
                    aria-hidden="true"
                    className={`h-10 flex flex-col items-center justify-center text-xs tabular-nums select-none ${
                      cell.isSunday
                        ? 'bg-slate-100/50 text-slate-300 rounded-lg'
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
                'text-slate-700 hover:bg-slate-100 rounded-lg';
              if (isSelected) {
                cellStyle =
                  'bg-[#14539E] text-white font-bold shadow-xs rounded-lg';
              } else if (cell.isSunday) {
                cellStyle =
                  'bg-slate-100/80 text-slate-500 hover:bg-slate-200/70 rounded-lg';
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
                    cell.hasOvertimeForm ? ', đã có phiếu tăng ca' : ''
                  }`}
                  title={
                    cell.hasOvertimeForm
                      ? `${formatDateToFormStyle(cell.isoDate)} • Đã có phiếu tăng ca`
                      : formatDateToFormStyle(cell.isoDate)
                  }
                  className={`h-10 flex flex-col items-center justify-center text-xs tabular-nums transition-colors cursor-pointer ${cellStyle} ${todayRing}`}
                >
                  <span className="leading-none">{cell.day}</span>
                  <span className="h-1.5 mt-1 flex items-center justify-center">
                    {cell.hasOvertimeForm && (
                      <span
                        data-testid={`calendar-dot-${cell.isoDate}`}
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-[#14539E]'
                        }`}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Chú thích & Nút xem tất cả ngày trong tháng */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#14539E] inline-block" />
                <span>Ngày đã có phiếu tăng ca</span>
              </span>
              <span className="tabular-nums font-medium text-slate-600">
                Tháng {String(calendarMonth).padStart(2, '0')}/{calendarYear}
              </span>
            </div>

            {selectedDateFilter && (
              <button
                type="button"
                onClick={() => setSelectedDateFilter(null)}
                data-testid="calendar-show-all-month-btn"
                className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                Xem tất cả ngày trong tháng
              </button>
            )}
          </div>
        </aside>

        {/* KHỐI 2: Thanh trạng thái lọc + nút icon Tạo phiếu mới & Bảng nhật ký */}
        <div className="flex-1 min-w-0 w-full space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-2xs no-print">
            {/* Cụm bên trái: Trạng thái lọc theo ngày hoặc tổng quan tháng đang xem trên lịch */}
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {selectedDateFilter ? (
                <>
                  <div
                    data-testid="overtime-log-date-filter-badge"
                    className="h-8 pl-2.5 pr-1.5 rounded-lg bg-blue-50 border border-[#14539E]/30 text-[#14539E] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums"
                  >
                    <span>
                      Đang lọc ngày: {formatDateToFormStyle(selectedDateFilter)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDateFilter(null)}
                      data-testid="clear-date-filter-badge-btn"
                      aria-label="Bỏ lọc theo ngày"
                      title="Bỏ lọc ngày"
                      className="p-0.5 rounded hover:bg-[#14539E]/15 text-[#14539E] cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter(null)}
                    data-testid="overtime-log-clear-filter-btn"
                    className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Xóa lọc
                  </button>
                </>
              ) : (
                <div
                  data-testid="overtime-log-month-summary"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 tabular-nums"
                >
                  <Calendar className="w-4 h-4 text-[#14539E] shrink-0" />
                  <span>
                    Nhật ký Tháng {String(calendarMonth).padStart(2, '0')}/
                    {calendarYear}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-[#14539E]">
                    {formatNumberVN(filteredForms.length)} phiếu
                  </span>
                </div>
              )}
            </div>

            {/* Cụm bên phải: Nút icon-only Tạo phiếu tăng ca mới */}
            <button
              type="button"
              disabled={isCreatingShell}
              onClick={() => void handleCreateShellClick()}
              data-testid="create-overtime-shell-icon-btn"
              title={
                selectedDateFilter
                  ? `Tạo phiếu tăng ca mới (${formatDateToFormStyle(selectedDateFilter)})`
                  : 'Tạo phiếu tăng ca mới'
              }
              aria-label="Tạo phiếu tăng ca mới"
              className="h-9 w-9 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white inline-flex items-center justify-center shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isCreatingShell ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FilePlus2 className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <th className="py-3 px-3 w-14 text-center">STT</th>
                    <th className="py-3 px-3.5 min-w-[160px]">Mã phiếu</th>
                    <th className="py-3 px-3.5 min-w-[175px]">Ngày tăng ca</th>
                    <th className="py-3 px-3.5 w-36 text-center">Trạng thái</th>
                    <th className="py-3 px-3.5 w-52 text-left">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`} className="h-14 animate-pulse">
                        <td className="py-3 px-3 text-center">
                          <div className="h-3.5 w-6 bg-slate-200 rounded mx-auto" />
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="h-3.5 w-28 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="h-3.5 w-24 bg-slate-200 rounded" />
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="h-5 w-20 bg-slate-200 rounded-full mx-auto" />
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="h-8 w-44 bg-slate-200 rounded ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : filteredForms.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-14 px-6 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <FileText className="w-9 h-9 text-slate-300 mb-3" />
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
                            {selectedDateFilter
                              ? 'Bấm lại vào ngày đang chọn để xem cả tháng hoặc bấm nút Tạo phiếu mới để lập phiếu cho ngày này.'
                              : 'Chọn ngày trên lịch bên trái hoặc bấm nút Tạo phiếu mới để lập phiếu cho ngày hôm nay.'}
                          </p>
                          {(onCreateOrOpenShell || onSwitchToCreate) && (
                            <button
                              type="button"
                              disabled={isCreatingShell}
                              onClick={() => void handleCreateShellClick()}
                              title="Tạo phiếu tăng ca mới"
                              aria-label="Tạo phiếu tăng ca mới cho ngày đang chọn"
                              className="mt-4 h-9 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isCreatingShell ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FilePlus2 className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {selectedDateFilter
                                  ? `Tạo phiếu ngày ${formatDateToFormStyle(
                                      selectedDateFilter
                                    )}`
                                  : 'Tạo phiếu ngày hôm nay'}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                filteredForms.map((form, index) => {
                  const datesList =
                    Array.isArray(form.overtime_dates) &&
                    form.overtime_dates.length > 0
                      ? form.overtime_dates
                      : [form.overtime_date].filter(Boolean);
                  const isExporting = exportingFormId === form.id;
                  const isViewingLoading = loadingViewFormId === form.id;
                  const isLocked = isOvertimeFormLocked(form);
                  const isNewShell =
                    !isLocked &&
                    (form.status === 'Mới tạo' || form.total_participants === 0);
                  const displayCode = formatOvertimeFormCodeDisplay(form.form_code);

                  return (
                    <tr
                      key={form.id}
                      className={`transition-colors ${
                        isLocked
                          ? 'bg-slate-50/40 hover:bg-blue-50/30'
                          : 'hover:bg-slate-50/90'
                      }`}
                    >
                      {/* 1. STT */}
                      <td className="py-3 px-3 text-center font-mono text-slate-500 tabular-nums">
                        {formatNumberVN(index + 1)}
                      </td>

                      {/* 2. Mã phiếu */}
                      <td className="py-3 px-3.5 font-mono font-semibold text-[#14539E] tabular-nums whitespace-nowrap">
                        {displayCode}
                      </td>

                      {/* 3. Ngày tăng ca */}
                      <td className="py-3 px-3.5">
                        <div className="font-mono text-slate-800 font-semibold tabular-nums">
                          {formatDateToFormStyle(
                            form.overtime_date || datesList[0] || ''
                          )}
                        </div>
                        {datesList.length >= 2 && (
                          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums font-mono">
                            Gồm:{' '}
                            {datesList
                              .slice(0, 2)
                              .map((d) => formatDateToFormStyle(d))
                              .join(', ')}
                            {datesList.length > 2
                              ? ` (+${formatNumberVN(datesList.length - 2)})`
                              : ''}
                          </div>
                        )}
                      </td>

                      {/* 4. Trạng thái */}
                      <td className="py-3 px-3.5 text-center">
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

                      {/* 5. Thao tác (Icon-only kèm tooltip) */}
                      {/* 5. Thao tác: Xem -> Sửa -> Xóa -> Chốt */}
                      <td className="py-3 px-3.5 text-left">
                        <div className="inline-flex items-center justify-start gap-1.5">
                          {/* 1. Xem phiếu */}
                          <button
                            type="button"
                            disabled={isViewingLoading}
                            onClick={() => void handleViewForm(form)}
                            className="h-8 w-8 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                            title="Xem phiếu"
                            aria-label={`Xem phiếu ${displayCode}`}
                          >
                            {isViewingLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* 2. Sửa phiếu */}
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              if (!isLocked) onEdit(form);
                            }}
                            className="h-8 w-8 rounded-lg border border-[#14539E]/30 bg-blue-50/60 text-[#14539E] hover:bg-[#14539E] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                            title={
                              isLocked
                                ? 'Phiếu đã chốt — không thể sửa'
                                : 'Sửa / Nhập chi tiết'
                            }
                            aria-label={
                              isLocked
                                ? `Phiếu ${displayCode} đã chốt, khóa chức năng sửa`
                                : `Sửa / Nhập chi tiết phiếu ${displayCode}`
                            }
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* 3. Xóa mềm */}
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleOpenDeleteModal([form])}
                            className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100 disabled:hover:border-slate-200 disabled:cursor-not-allowed"
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

                          {/* 4. Chốt / Mở khóa phiếu */}
                          {isLocked ? (
                            <button
                              type="button"
                              onClick={() => handleOpenUnlockModal(form)}
                              data-testid={`unlock-form-btn-${form.id}`}
                              className="h-8 w-8 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white hover:border-amber-600 inline-flex items-center justify-center transition-colors cursor-pointer"
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
                              className="h-8 w-8 rounded-lg border border-[#14539E]/30 bg-white text-[#14539E] hover:bg-[#14539E] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                              title="Chốt phiếu"
                              aria-label={`Chốt phiếu ${displayCode}`}
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )}
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
        </div>
      </div>

      {/* Modal Xem tờ phiếu A4 chuẩn TV-PSGC2022 */}
      {viewingForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overtime-modal-title"
          className="overtime-print-modal-root fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 sm:p-5"
        >
          <div className="bg-slate-100 rounded-2xl border border-slate-300 shadow-2xl w-full max-w-[900px] max-h-[92vh] flex flex-col overflow-hidden overtime-print-container">
            {/* Modal Header */}
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
                  onClick={handlePrintModal}
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

            {/* A4 Sheet Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center overtime-print-scroll">
              <div
                style={{
                  fontFamily: "'Times New Roman', 'Malgun Gothic', Arial, sans-serif",
                }}
                className="overtime-print-sheet bg-white shadow-xl p-5 sm:p-6 w-full max-w-[794px] min-h-[1123px] mx-auto text-black rounded-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Header top */}
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>Transon Viet nam Co., Ltd</span>
                    <span className="pr-12">Biểu mẫu số: TV-PSGC2022</span>
                  </div>

                  {/* Title + 6-column signature block */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="pt-2">
                      <div className="text-lg font-bold leading-snug">
                        PHIẾU ĐỀ NGHỊ LÀM THÊM
                      </div>
                      <div className="text-base font-bold leading-snug">
                        잔업. 특근 신청서
                      </div>
                    </div>
                    <table className="border-collapse border border-black text-[11px] text-center">
                      <thead>
                        <tr>
                          <th className="border border-black px-2 py-0.5 font-normal">
                            결
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            작성
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            검사
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            검사
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            검사
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            승인
                          </th>
                        </tr>
                        <tr>
                          <th className="border border-black px-2 py-0.5 font-normal">
                            xác
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            Người lập
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            Kiểm tra
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            Kiểm tra
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            Kiểm tra
                          </th>
                          <th className="border border-black px-3 py-0.5 font-normal">
                            Phê duyệt
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="h-14">
                          <td className="border border-black px-2 align-bottom pb-1 text-[10px]">
                            <div>nhận</div>
                            <div className="border-t border-black mt-0.5 pt-0.5">
                              재
                            </div>
                          </td>
                          <td className="border border-black w-16" />
                          <td className="border border-black w-16" />
                          <td className="border border-black w-16" />
                          <td className="border border-black w-16" />
                          <td className="border border-black w-16" />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Multi-date 7-column TV-PSGC2022 Table */}
                  <table className="w-full border-collapse text-[11px]">
                    <tbody>
                      {modalPrintableGroups.map((dateGroup, dateIdx) => (
                        <React.Fragment key={dateGroup.date}>
                          <tr className={dateIdx === 0 ? 'h-7' : 'h-8'}>
                            <td
                              colSpan={4}
                              className={`border-0 bg-transparent text-left align-middle text-xs font-bold text-black ${
                                dateIdx === 0 ? 'pb-1' : 'pt-2 pb-1'
                              }`}
                            >
                              {formatDepartmentHeaderLabel(
                                getDisplayDepartment(viewingForm.department),
                                knownSubGroups
                              )}
                            </td>
                            <td
                              colSpan={3}
                              className={`border-0 bg-transparent text-center align-middle text-xs font-bold text-black ${
                                dateIdx === 0 ? 'pb-1' : 'pt-2 pb-1'
                              }`}
                            >
                              {dateGroup.formattedDate}
                            </td>
                          </tr>
                          <tr className="text-center font-normal">
                            <th className="border border-black px-1.5 py-0.5 w-8 min-w-[32px] font-normal">
                              No
                            </th>
                            <th className="border border-black px-2 py-0.5 w-40 min-w-[145px] font-normal">
                              Danh sách làm thêm
                            </th>
                            <th className="border border-black px-2.5 py-0.5 min-w-[220px] font-normal">
                              Lý do làm thêm
                            </th>
                            <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">
                              Giờ bắt đầu
                            </th>
                            <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">
                              Giờ kết thúc
                            </th>
                            <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">
                              Tổng thời gian
                            </th>
                            <th className="border border-black px-1.5 py-0.5 w-14 min-w-[50px] font-normal">
                              Ký nhận
                            </th>
                          </tr>
                          <tr className="text-center font-normal">
                            <th className="border border-black px-1.5 py-0.5 font-normal" />
                            <th className="border border-black px-2 py-0.5 font-normal">
                              명단
                            </th>
                            <th className="border border-black px-2.5 py-0.5 font-normal">
                              잔업. 특근사유
                            </th>
                            <th className="border border-black px-1.5 py-0.5 font-normal">
                              시작
                            </th>
                            <th className="border border-black px-1.5 py-0.5 font-normal">
                              종료
                            </th>
                            <th className="border border-black px-1.5 py-0.5 font-normal">
                              총 시간
                            </th>
                            <th className="border border-black px-1.5 py-0.5 font-normal">
                              싸인
                            </th>
                          </tr>
                          {dateGroup.blocks.map((block) =>
                            block.rows.map((row) => (
                              <tr
                                key={`${block.blockId}-${row.no}`}
                                className="h-7 min-h-[26px]"
                              >
                                <td className="border border-black px-1.5 py-0.5 text-center font-normal">
                                  {row.no}
                                </td>
                                <td className="border border-black px-2 py-0.5 text-left font-normal">
                                  {row.fullName}
                                </td>
                                {row.isFirstInBlock && (
                                  <td
                                    rowSpan={row.rowSpan}
                                    className="border border-black px-2.5 py-1 text-left align-middle whitespace-pre-line font-normal leading-snug"
                                  >
                                    {row.combinedReason}
                                  </td>
                                )}
                                <td
                                  className={`border border-black px-1.5 py-0.5 text-center align-middle ${
                                    isOvertimeTimeBold(row.startTimeFormatted)
                                      ? 'font-bold'
                                      : 'font-normal'
                                  }`}
                                >
                                  {row.startTimeFormatted}
                                </td>
                                <td
                                  className={`border border-black px-1.5 py-0.5 text-center align-middle ${
                                    isOvertimeTimeBold(row.endTimeFormatted)
                                      ? 'font-bold'
                                      : 'font-normal'
                                  }`}
                                >
                                  {row.endTimeFormatted}
                                </td>
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

                {/* Notes Footer */}
                <div className="mt-2 text-[11px] space-y-0.5 leading-snug">
                  <div>Ghi chú 비고</div>
                  <div>
                    1) Nếu phát sinh dài hạn ghi rõ vào đây: từ năm
                    2022/........./............~ 2022/........./ ............
                  </div>
                  <div>
                    Phát sinh giờ ghi ở biểu trên/ 긴시간 발생할 경우 는 여기서
                    기록할것
                  </div>
                </div>
              </div>
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
                    Thao tác này chỉ dành cho trường hợp cần điều chỉnh khẩn cấp dữ liệu đã chốt.
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
                ), phiếu sẽ cho phép sửa/xóa lại và <strong>tạm thời bị loại khỏi báo cáo Giờ Tăng ca</strong> cho đến khi được chốt lại.
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
                disabled={isUnlocking || unlockKeywordInput.trim() !== 'MO KHOA'}
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

      {/* In-app Soft Delete Confirmation Modal */}
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
                    Hệ thống sẽ đánh dấu xóa mềm (<code className="font-mono">deleted_at</code>)
                    trên cả <code className="font-mono">overtime_forms</code> và{' '}
                    <code className="font-mono">overtime_form_items</code> để đồng bộ cho toàn bộ người dùng.
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

            {/* Thông tin tóm tắt phiếu sắp xóa */}
            {deletingForms.length === 1 ? (
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
            ) : (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs space-y-1.5 max-h-36 overflow-y-auto">
                <div className="font-semibold text-slate-700">
                  Danh sách {formatNumberVN(deletingForms.length)} phiếu sẽ xóa mềm:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {deletingForms.map((f) => (
                    <span
                      key={f.id}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px] font-semibold text-[#14539E]"
                    >
                      {formatOvertimeFormCodeDisplay(f.form_code)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lớp bảo vệ xác nhận bắt buộc trước khi xóa */}
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-red-200/80 bg-red-50/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDeleteConfirmed}
                onChange={(e) => setIsDeleteConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
              />
              <span className="text-xs text-slate-700 leading-snug">
                {deletingForms.length === 1 ? (
                  <>
                    Tôi xác nhận muốn xóa phiếu tăng ca{' '}
                    <strong className="font-mono text-slate-900">
                      {formatOvertimeFormCodeDisplay(deletingForms[0].form_code)}
                    </strong>{' '}
                    khỏi nhật ký.
                  </>
                ) : (
                  <>
                    Tôi xác nhận muốn xóa{' '}
                    <strong className="text-slate-900">
                      {formatNumberVN(deletingForms.length)} phiếu tăng ca
                    </strong>{' '}
                    đã chọn khỏi nhật ký.
                  </>
                )}
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
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mã SQL Chuẩn hóa RLS Xóa mềm & Realtime trên Supabase */}
      {isSqlModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mã SQL chuẩn hóa xóa mềm và Realtime Supabase"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center p-4 no-print"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Database className="w-5 h-5 text-[#14539E] shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Chuẩn hóa Supabase: Xóa mềm (deleted_at) &amp; Realtime
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chạy đoạn SQL sau trong SQL Editor trên Supabase để mở quyền cập nhật deleted_at và đồng bộ Realtime
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
                  Áp dụng cho <code className="font-mono text-[#14539E]">public.overtime_forms</code> &amp;{' '}
                  <code className="font-mono text-[#14539E]">public.overtime_form_items</code>:
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
