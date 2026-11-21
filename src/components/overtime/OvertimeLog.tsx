import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Plus,
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
  filterOvertimeForms,
  formatCreatedAtVN,
  formatOvertimeFormCodeDisplay,
  isOvertimeTimeBold,
  OvertimeFormWithItems,
  reconstructBlocksFromItems,
  resolveOvertimeMainDepartment,
} from '../../utils/overtimeFormsService';

export interface OvertimeLogProps {
  forms: OvertimeFormWithItems[];
  employees: Employee[];
  groups?: DepartmentGroup[];
  isLoading: boolean;
  onRefresh: () => Promise<void> | void;
  onEdit: (form: OvertimeFormWithItems) => void;
  onSoftDelete: (formId: string) => Promise<void>;
  onSwitchToCreate?: () => void;
  onShowToast?: (message: string) => void;
}

export const OvertimeLog: React.FC<OvertimeLogProps> = ({
  forms,
  employees,
  groups = [],
  isLoading,
  onRefresh,
  onEdit,
  onSoftDelete,
  onSwitchToCreate,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [viewingForm, setViewingForm] = useState<OvertimeFormWithItems | null>(
    null
  );
  const [deletingForm, setDeletingForm] =
    useState<OvertimeFormWithItems | null>(null);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [exportingFormId, setExportingFormId] = useState<string | null>(null);

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

  const hasActiveFilters = Boolean(searchQuery.trim() || dateFilter.trim());

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportFormExcel = async (form: OvertimeFormWithItems) => {
    setExportingFormId(form.id);
    try {
      const blocks = reconstructBlocksFromItems(form.items);
      if (blocks.length === 0) {
        onShowToast?.('Phiếu không có dữ liệu nhân sự để xuất Excel.');
        return;
      }
      const mainDepartment = getDisplayDepartment(form.department);
      const mergedEmployees = buildMergedEmployeesForExport(
        form.items,
        employees,
        mainDepartment
      );
      await overtimeExportService.exportExcel({
        department: mainDepartment,
        overtimeDate: form.overtime_date,
        blocks,
        employees: mergedEmployees,
        knownSubGroups,
      });
      onShowToast?.(
        `Đã xuất file Excel cho phiếu ${formatOvertimeFormCodeDisplay(
          form.form_code
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

  const handleOpenDeleteModal = (form: OvertimeFormWithItems) => {
    setIsDeleteConfirmed(false);
    setDeletingForm(form);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) return;
    setDeletingForm(null);
    setIsDeleteConfirmed(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingForm || !isDeleteConfirmed) return;
    setIsDeleting(true);
    try {
      const code = formatOvertimeFormCodeDisplay(deletingForm.form_code);
      const targetId = deletingForm.id;
      await onSoftDelete(targetId);
      if (viewingForm?.id === targetId) {
        setViewingForm(null);
      }
      setDeletingForm(null);
      setIsDeleteConfirmed(false);
      onShowToast?.(`Đã xóa phiếu tăng ca ${code} khỏi nhật ký.`);
    } catch (error) {
      onShowToast?.(getFriendlyErrorMessage(error));
    } finally {
      setIsDeleting(false);
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

        <div className="flex items-center gap-3 justify-between md:justify-end">
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

      {/* 7-Column Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="py-3 px-3.5 w-14 text-center">STT</th>
                <th className="py-3 px-3.5 min-w-[180px]">
                  Mã phiếu / Ngày tạo
                </th>
                <th className="py-3 px-3.5 min-w-[155px]">Ngày tăng ca</th>
                <th className="py-3 px-3.5 min-w-[150px]">Bộ phận</th>
                <th className="py-3 px-3.5 min-w-[140px] text-right">
                  Số lượng
                </th>
                <th className="py-3 px-3.5 w-32 text-center">Trạng thái</th>
                <th className="py-3 px-3.5 w-60 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="h-14 animate-pulse">
                    <td className="py-3 px-3.5 text-center">
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
                  <td colSpan={7} className="py-14 px-6 text-center">
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
                          : 'Phiếu tăng ca sau khi nhấn "Lưu" ở tab Tạo phiếu tăng ca sẽ xuất hiện tại đây.'}
                      </p>
                      {!hasActiveFilters && onSwitchToCreate && (
                        <button
                          type="button"
                          onClick={onSwitchToCreate}
                          className="mt-4 h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tạo phiếu tăng ca đầu tiên</span>
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

                  return (
                    <tr
                      key={form.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      {/* 1. STT */}
                      <td className="py-3 px-3.5 text-center font-mono text-slate-500 tabular-nums">
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
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          {form.status || 'Đã lưu'}
                        </span>
                      </td>

                      {/* 7. Thao tác */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingForm(form)}
                            className="h-8 px-2.5 rounded-lg border border-[#14539E]/30 text-[#14539E] hover:bg-[#14539E] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            title="Xem tờ phiếu A4 chuẩn TV-PSGC2022"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem phiếu</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEdit(form)}
                            className="h-8 w-8 rounded-lg border border-slate-200 text-[#14539E] hover:bg-blue-50 hover:border-[#14539E]/40 inline-flex items-center justify-center transition-colors cursor-pointer"
                            title="Sửa phiếu"
                            aria-label={`Sửa phiếu ${form.form_code}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={isExporting}
                            onClick={() => handleExportFormExcel(form)}
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
                            onClick={() => handleOpenDeleteModal(form)}
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
                  <span>Sửa phiếu</span>
                </button>

                <button
                  type="button"
                  disabled={exportingFormId === viewingForm.id}
                  onClick={() => handleExportFormExcel(viewingForm)}
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
                className="overtime-print-sheet bg-white shadow-xl p-6 sm:p-8 w-full max-w-[794px] min-h-[1123px] mx-auto text-black rounded-sm space-y-4 flex flex-col"
              >
                {/* Header top */}
                <div className="flex items-center justify-between text-xs mb-2">
                  <span>Transon Viet nam Co., Ltd</span>
                  <span className="pr-12">Biểu mẫu số: TV-PSGC2022</span>
                </div>

                {/* Title + 6-column signature block */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="pt-3">
                    <div className="text-lg font-bold leading-snug">
                      PHIẾU ĐỀ NGHỊ LÀM THÊM
                    </div>
                    <div className="text-base font-bold leading-snug">
                      잔업. 특근 신청서
                    </div>
                    <div className="text-[11px] mt-1 font-normal text-black">
                      Ngày phiếu / 작성일:{' '}
                      <span className="font-bold">
                        {formatDateToFormStyle(viewingForm.overtime_date)}
                      </span>
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
                        <tr className={dateIdx === 0 ? 'h-7' : 'h-9'}>
                          <td
                            colSpan={4}
                            className={`border-0 bg-transparent text-left align-middle text-xs font-bold text-black ${
                              dateIdx === 0 ? 'pb-1.5' : 'pt-3 pb-1.5'
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
                              dateIdx === 0 ? 'pb-1.5' : 'pt-3 pb-1.5'
                            }`}
                          >
                            {dateGroup.formattedDate}
                          </td>
                        </tr>
                        <tr className="text-center font-normal">
                          <th className="border border-black px-1.5 py-1 w-8 font-normal">
                            No
                          </th>
                          <th className="border border-black px-2 py-1 w-44 font-normal">
                            Danh sách làm thêm
                          </th>
                          <th className="border border-black px-2 py-1 font-normal">
                            Lý do làm thêm
                          </th>
                          <th className="border border-black px-2 py-1 w-20 font-normal">
                            Giờ bắt đầu
                          </th>
                          <th className="border border-black px-2 py-1 w-20 font-normal">
                            Giờ kết thúc
                          </th>
                          <th className="border border-black px-2 py-1 w-24 font-normal">
                            Tổng thời gian
                          </th>
                          <th className="border border-black px-2 py-1 w-20 font-normal">
                            Ký nhận
                          </th>
                        </tr>
                        <tr className="text-center font-normal">
                          <th className="border border-black px-1.5 py-1 font-normal" />
                          <th className="border border-black px-2 py-1 font-normal">
                            명단
                          </th>
                          <th className="border border-black px-2 py-1 font-normal">
                            잔업. 특근사유
                          </th>
                          <th className="border border-black px-2 py-1 font-normal">
                            시작
                          </th>
                          <th className="border border-black px-2 py-1 font-normal">
                            종료
                          </th>
                          <th className="border border-black px-2 py-1 font-normal">
                            총 시간
                          </th>
                          <th className="border border-black px-2 py-1 font-normal">
                            싸인
                          </th>
                        </tr>
                        {dateGroup.blocks.map((block) =>
                          block.rows.map((row) => (
                            <tr
                              key={`${block.blockId}-${row.no}`}
                              className="h-7"
                            >
                              <td className="border border-black px-1.5 py-1 text-center font-normal">
                                {row.no}
                              </td>
                              <td className="border border-black px-2 py-1 text-left font-normal">
                                {row.fullName}
                              </td>
                              {row.isFirstInBlock && (
                                <td
                                  rowSpan={row.rowSpan}
                                  className="border border-black px-2.5 py-1.5 text-left align-middle whitespace-pre-line font-normal"
                                >
                                  {row.combinedReason}
                                </td>
                              )}
                              <td
                                className={`border border-black px-2 py-1 text-center align-middle ${
                                  isOvertimeTimeBold(row.startTimeFormatted)
                                    ? 'font-bold'
                                    : 'font-normal'
                                }`}
                              >
                                {row.startTimeFormatted}
                              </td>
                              <td
                                className={`border border-black px-2 py-1 text-center align-middle ${
                                  isOvertimeTimeBold(row.endTimeFormatted)
                                    ? 'font-bold'
                                    : 'font-normal'
                                }`}
                              >
                                {row.endTimeFormatted}
                              </td>
                              <td className="border border-black px-2 py-1 text-center align-middle" />
                              <td className="border border-black px-2 py-1 text-center align-middle" />
                            </tr>
                          ))
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>

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

      {/* In-app Soft Delete Confirmation Modal with Extra Protection Layer */}
      {deletingForm && (
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
                    Xác nhận xóa phiếu tăng ca
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Bạn có chắc chắn muốn xóa phiếu này khỏi nhật ký không? Phiếu
                    sẽ được đánh dấu xóa mềm và ẩn khỏi danh sách tra cứu.
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
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Mã phiếu:</span>
                <span className="font-mono font-bold text-[#14539E]">
                  {formatOvertimeFormCodeDisplay(deletingForm.form_code)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Bộ phận:</span>
                <span className="font-semibold text-slate-800">
                  {getDisplayDepartment(deletingForm.department)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Quy mô:</span>
                <span className="font-medium text-slate-700 tabular-nums">
                  {formatNumberVN(deletingForm.total_participants)} lượt •{' '}
                  {formatNumberVN(deletingForm.total_hours)} giờ
                </span>
              </div>
            </div>

            {/* Lớp bảo vệ xác nhận bắt buộc trước khi xóa */}
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-red-200/80 bg-red-50/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDeleteConfirmed}
                onChange={(e) => setIsDeleteConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
              />
              <span className="text-xs text-slate-700 leading-snug">
                Tôi xác nhận muốn xóa phiếu tăng ca{' '}
                <strong className="font-mono text-slate-900">
                  {formatOvertimeFormCodeDisplay(deletingForm.form_code)}
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
                onClick={handleConfirmDelete}
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OvertimeLog;
