import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  Database,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DepartmentGroup, Employee } from '../../types/hr';
import {
  formatNumberVN,
  getFriendlyErrorMessage,
} from '../../utils/errorAndSecurityService';
import {
  formatDateToFormStyle,
  formatDepartmentHeaderLabel,
  overtimeExportService,
} from '../../utils/overtimeExportService';
import {
  buildMergedEmployeesForExport,
  buildPrintableDateGroupsFromItems,
  fetchOvertimeFormById,
  filterOvertimeForms,
  formatCreatedAtVN,
  formatOvertimeFormCodeDisplay,
  generateOvertimeFormCode,
  getLocalTodayIsoDate,
  isOvertimeTimeBold,
  OvertimeFormWithItems,
  OvertimeSupabaseActionError,
  reconstructBlocksFromItems,
  resolveOvertimeMainDepartment,
  SUPABASE_OVERTIME_REALTIME_AND_SOFT_DELETE_SQL,
} from '../../utils/overtimeFormsService';

export interface OvertimeLogProps {
  forms: OvertimeFormWithItems[];
  employees: Employee[];
  groups?: DepartmentGroup[];
  isLoading: boolean;
  schemaNeedsMigration?: boolean;
  onRefresh: () => Promise<void> | void;
  onCreateOrOpenShell?: (overtimeDate: string) => Promise<void> | void;
  onEdit: (form: OvertimeFormWithItems) => void;
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
  onSoftDelete,
  onSwitchToCreate,
  onShowToast,
}) => {
  const [createShellDate, setCreateShellDate] = useState<string>(() =>
    getLocalTodayIsoDate()
  );
  const [isCreatingShell, setIsCreatingShell] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [viewingForm, setViewingForm] = useState<OvertimeFormWithItems | null>(
    null
  );
  const [loadingViewFormId, setLoadingViewFormId] = useState<string | null>(
    null
  );
  const [deletingForms, setDeletingForms] = useState<OvertimeFormWithItems[]>(
    []
  );
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
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

  const filteredForms = useMemo(
    () => filterOvertimeForms(forms, searchQuery, dateFilter, knownSubGroups),
    [forms, searchQuery, dateFilter, knownSubGroups]
  );

  // Tự động đồng bộ selection và modal xem chi tiết khi danh sách thay đổi qua Realtime
  useEffect(() => {
    const activeIds = new Set(
      forms.filter((f) => !f.deleted_at).map((f) => f.id)
    );
    setSelectedFormIds((prev) => prev.filter((id) => activeIds.has(id)));
    if (viewingForm && !activeIds.has(viewingForm.id)) {
      setViewingForm(null);
      onShowToast?.('Phiếu đang xem vừa được xóa khỏi hệ thống.');
    }
  }, [forms, viewingForm, onShowToast]);

  const selectedSet = useMemo(
    () => new Set(selectedFormIds),
    [selectedFormIds]
  );

  const visibleSelectedCount = useMemo(
    () => filteredForms.filter((f) => selectedSet.has(f.id)).length,
    [filteredForms, selectedSet]
  );

  const isAllVisibleSelected =
    filteredForms.length > 0 && visibleSelectedCount === filteredForms.length;

  const hasActiveFilters = Boolean(searchQuery.trim() || dateFilter.trim());

  const handleToggleSelectAllVisible = () => {
    const visibleIds = filteredForms.map((f) => f.id);
    if (isAllVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedFormIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedFormIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelectOne = (formId: string) => {
    setSelectedFormIds((prev) =>
      prev.includes(formId)
        ? prev.filter((id) => id !== formId)
        : [...prev, formId]
    );
  };

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const targetShellCode = useMemo(
    () => generateOvertimeFormCode(createShellDate || getLocalTodayIsoDate()),
    [createShellDate]
  );

  const existingActiveShellForSelectedDate = useMemo(() => {
    const cleanDate = (createShellDate || '').trim();
    return forms.find(
      (f) =>
        !f.deleted_at &&
        ((f.overtime_date || '').trim() === cleanDate ||
          formatOvertimeFormCodeDisplay(f.form_code) === targetShellCode)
    );
  }, [forms, createShellDate, targetShellCode]);

  const handleCreateShellClick = async () => {
    if (isCreatingShell) return;
    if (!onCreateOrOpenShell) {
      onSwitchToCreate?.();
      return;
    }
    setIsCreatingShell(true);
    try {
      await onCreateOrOpenShell(createShellDate || getLocalTodayIsoDate());
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
    setIsDeleteConfirmed(false);
    setDeletingForms(targets);
  };

  const handleOpenBulkDeleteModal = () => {
    const targets = forms.filter((f) => !f.deleted_at && selectedSet.has(f.id));
    handleOpenDeleteModal(targets);
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
      setSelectedFormIds((prev) => prev.filter((id) => !targetIdSet.has(id)));
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

      {/* Thanh Tạo vỏ phiếu tăng ca mới theo ngày */}
      <div className="bg-white border border-blue-200/80 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs no-print">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <label
              htmlFor="overtime-shell-date-input"
              className="text-xs font-bold text-[#14539E] whitespace-nowrap"
            >
              Ngày phiếu:
            </label>
            <div className="relative w-40">
              <Calendar className="w-3.5 h-3.5 text-[#14539E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="overtime-shell-date-input"
                type="date"
                value={createShellDate}
                onChange={(e) => setCreateShellDate(e.target.value)}
                className="w-full h-9 pl-8 pr-2.5 text-xs font-mono font-semibold text-slate-800 rounded-lg border border-slate-300 bg-white focus:border-[#14539E] focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span>Mã phiếu:</span>
            <span className="font-mono font-bold text-[#14539E] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
              {targetShellCode}
            </span>
            {existingActiveShellForSelectedDate ? (
              <span className="text-[11px] font-medium text-amber-700">
                (Đã tồn tại — bấm nút để mở chỉnh sửa)
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                (Tạo vỏ phiếu trống cho ngày {formatDateToFormStyle(createShellDate)})
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={isCreatingShell}
          onClick={() => void handleCreateShellClick()}
          className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {isCreatingShell ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FilePlus2 className="w-3.5 h-3.5" />
          )}
          <span>+ Tạo phiếu tăng ca mới</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã phiếu hoặc bộ phận..."
              aria-label="Tìm mã phiếu hoặc bộ phận"
              className="w-full h-9 pl-9 pr-8 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#14539E] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative w-44">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Lọc theo ngày tăng ca"
              className="w-full h-9 pl-8 pr-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 font-mono focus:border-[#14539E] focus:outline-none"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDateFilter('');
              }}
              className="h-9 px-3 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Xóa lọc
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 justify-between md:justify-end">
          {selectedFormIds.length > 0 && (
            <button
              type="button"
              onClick={handleOpenBulkDeleteModal}
              className="h-9 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa đã chọn ({formatNumberVN(selectedFormIds.length)})</span>
            </button>
          )}

          <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
            Hiển thị{' '}
            <strong className="font-semibold text-slate-800">
              {formatNumberVN(filteredForms.length)}
            </strong>{' '}
            / {formatNumberVN(forms.filter((f) => !f.deleted_at).length)} phiếu
          </span>

          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isRefreshing || isLoading}
            className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#14539E] ${
                isRefreshing || isLoading ? 'animate-spin' : ''
              }`}
            />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="py-3 pl-3.5 pr-1.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    disabled={filteredForms.length === 0 || isLoading}
                    onChange={handleToggleSelectAllVisible}
                    aria-label="Chọn tất cả phiếu đang hiển thị"
                    className="w-4 h-4 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E] cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3.5 min-w-[180px]">
                  Mã phiếu / Ngày tạo
                </th>
                <th className="py-3 px-3.5 min-w-[155px]">Ngày tăng ca</th>
                <th className="py-3 px-3.5 min-w-[150px]">Bộ phận</th>
                <th className="py-3 px-3.5 min-w-[140px] text-right">
                  Số lượng
                </th>
                <th className="py-3 px-3.5 w-32 text-center">Trạng thái</th>
                <th className="py-3 px-3.5 w-80 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="h-14 animate-pulse">
                    <td className="py-3 pl-3.5 pr-1.5 text-center">
                      <div className="h-4 w-4 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-3.5 w-6 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="h-3.5 w-32 bg-slate-200 rounded mb-1.5" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="h-3.5 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="h-3.5 w-28 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="h-3.5 w-20 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="h-3.5 w-16 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="h-7 w-36 bg-slate-200 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredForms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 px-6 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <FileText className="w-9 h-9 text-slate-300 mb-3" />
                      <p className="text-sm font-semibold text-slate-800">
                        {hasActiveFilters
                          ? 'Không tìm thấy phiếu tăng ca phù hợp'
                          : 'Chưa có phiếu tăng ca nào được lưu'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {hasActiveFilters
                          ? 'Thử thay đổi từ khóa bộ phận, mã phiếu hoặc ngày tăng ca.'
                          : 'Chọn Ngày phiếu ở thanh trên và bấm "+ Tạo phiếu tăng ca mới" để tạo vỏ phiếu theo ngày.'}
                      </p>
                      {!hasActiveFilters && (onCreateOrOpenShell || onSwitchToCreate) && (
                        <button
                          type="button"
                          disabled={isCreatingShell}
                          onClick={() => void handleCreateShellClick()}
                          className="mt-4 h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isCreatingShell ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FilePlus2 className="w-3.5 h-3.5" />
                          )}
                          <span>+ Tạo phiếu tăng ca mới</span>
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
                  const isSelected = selectedSet.has(form.id);

                  return (
                    <tr
                      key={form.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/60 hover:bg-blue-50/90'
                          : 'hover:bg-slate-50/90'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 pl-3.5 pr-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(form.id)}
                          aria-label={`Chọn phiếu ${formatOvertimeFormCodeDisplay(
                            form.form_code
                          )}`}
                          className="w-4 h-4 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E] cursor-pointer"
                        />
                      </td>

                      {/* 1. STT */}
                      <td className="py-3 px-3 text-center font-mono text-slate-500 tabular-nums">
                        {formatNumberVN(index + 1)}
                      </td>

                      {/* 2. Mã phiếu / Ngày tạo */}
                      <td className="py-3 px-3.5">
                        <div className="font-mono font-semibold text-[#14539E] tabular-nums">
                          {formatOvertimeFormCodeDisplay(form.form_code)}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          Tạo: {formatCreatedAtVN(form.created_at)}
                        </div>
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

                      {/* 4. Bộ phận */}
                      <td className="py-3 px-3.5 font-medium text-slate-800">
                        {getDisplayDepartment(form.department)}
                      </td>

                      {/* 5. Số lượng */}
                      <td className="py-3 px-3.5 text-right tabular-nums">
                        <div className="font-semibold text-slate-800">
                          {formatNumberVN(form.total_participants)} lượt
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {formatNumberVN(form.total_blocks)} nhóm •{' '}
                          {formatNumberVN(form.total_hours)} giờ
                        </div>
                      </td>

                      {/* 6. Trạng thái */}
                      <td className="py-3 px-3.5 text-center">
                        {form.status === 'Mới tạo' ||
                        form.total_participants === 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14539E]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#14539E]" />
                            Mới tạo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            {form.status || 'Đã lưu'}
                          </span>
                        )}
                      </td>

                      {/* 7. Thao tác */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isViewingLoading}
                            onClick={() => void handleViewForm(form)}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                            title="Xem tờ phiếu A4 chuẩn TV-PSGC2022"
                          >
                            {isViewingLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            <span>Xem phiếu</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEdit(form)}
                            className="h-8 px-2.5 rounded-lg border border-[#14539E]/30 bg-blue-50/60 text-[#14539E] hover:bg-[#14539E] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            title="Sửa / Nhập chi tiết lượt tăng ca"
                            aria-label={`Sửa / Nhập chi tiết phiếu ${form.form_code}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Sửa / Nhập chi tiết</span>
                          </button>

                          <button
                            type="button"
                            disabled={isExporting}
                            onClick={() => void handleExportFormExcel(form)}
                            className="h-8 w-8 rounded-lg border border-slate-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                            title="Xuất lại file Excel"
                            aria-label={`Xuất Excel phiếu ${form.form_code}`}
                          >
                            {isExporting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal([form])}
                            className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 inline-flex items-center justify-center transition-colors cursor-pointer"
                            title="Xóa phiếu"
                            aria-label={`Xóa phiếu ${form.form_code}`}
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
                  onClick={() => {
                    const target = viewingForm;
                    setViewingForm(null);
                    onEdit(target);
                  }}
                  className="h-9 px-3.5 rounded-lg border border-[#14539E] text-[#14539E] hover:bg-blue-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
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
                              {dateIdx === 0
                                ? formatDepartmentHeaderLabel(
                                    getDisplayDepartment(viewingForm.department),
                                    knownSubGroups
                                  )
                                : ''}
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

      {/* In-app Soft Delete Confirmation Modal (hỗ trợ xóa 1 phiếu hoặc nhiều phiếu) */}
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
                  <span className="text-slate-500">Bộ phận:</span>
                  <span className="font-semibold text-slate-800">
                    {getDisplayDepartment(deletingForms[0].department)}
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
