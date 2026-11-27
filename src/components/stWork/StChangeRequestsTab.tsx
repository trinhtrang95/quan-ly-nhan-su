import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { CompanyDepartment, DepartmentGroup } from '../../types/hr';
import {
  computeChangeRequestStatusCounts,
  extractAvailableYearsFromChangeRequests,
  filterChangeRequestsList,
  formatNumberVN,
  formatStDateVN,
  sortChangeRequestsList,
  ST_CHANGE_REQUEST_PROCESS_STAGES,
  ST_CHANGE_REQUEST_SORT_OPTIONS,
  ST_STATUS_BADGE_META,
  StChangeRequest,
  StChangeRequestSortMode,
  StChangeRequestStatus,
  StProduct,
} from '../../utils/stWorkLogic';
import {
  DEFAULT_COMPANY_DEPARTMENTS,
  deleteStChangeRequest,
  mergeCompanyDepartmentOptions,
  mergeGroupOptions,
} from '../../services/stWorkService';
import { StChangeRequestCreateModal } from './StChangeRequestCreateModal';
import { StChangeRequestImportModal } from './StChangeRequestImportModal';
import {
  formatStChangeRequestError,
  StChangeRequestEditModal,
  StChangeRequestStatusModal,
} from './StChangeRequestModals';

export interface StChangeRequestsTabProps {
  changeRequests: StChangeRequest[];
  products: StProduct[];
  companyDepartments?: CompanyDepartment[];
  groups?: DepartmentGroup[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

type ChangeRequestStatusFilter = 'ALL' | StChangeRequestStatus;

export const StChangeRequestsTab: React.FC<StChangeRequestsTabProps> = ({
  changeRequests,
  products,
  companyDepartments = DEFAULT_COMPANY_DEPARTMENTS,
  groups = [],
  isLoading,
  onRefresh,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>(() =>
    new Date().getFullYear().toString()
  );
  const [monthFilter, setMonthFilter] = useState<string>(() =>
    (new Date().getMonth() + 1).toString()
  );
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] =
    useState<ChangeRequestStatusFilter>('ALL');
  const [sortMode, setSortMode] =
    useState<StChangeRequestSortMode>('received_desc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [statusModalTarget, setStatusModalTarget] =
    useState<StChangeRequest | null>(null);
  const [editModalTarget, setEditModalTarget] =
    useState<StChangeRequest | null>(null);

  // Row delete confirmation & error banner
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>('');

  useEffect(() => {
    if (!isSortMenuOpen) return;
    const handlePointerDown = (ev: MouseEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(ev.target as Node)
      ) {
        setIsSortMenuOpen(false);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setIsSortMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSortMenuOpen]);

  const currentYearNum = new Date().getFullYear();

  const availableYears = useMemo(
    () => extractAvailableYearsFromChangeRequests(changeRequests, currentYearNum),
    [changeRequests, currentYearNum]
  );

  const departmentOptions = useMemo(
    () =>
      mergeCompanyDepartmentOptions(
        companyDepartments,
        changeRequests.map((r) => r.department)
      ),
    [companyDepartments, changeRequests]
  );

  const groupOptions = useMemo(
    () => mergeGroupOptions(groups, changeRequests),
    [groups, changeRequests]
  );

  // Pre-status filtered list drives the 4 dynamic counter tabs
  const preStatusFilteredRequests = useMemo(
    () =>
      filterChangeRequestsList(changeRequests, {
        searchQuery,
        yearFilter,
        monthFilter,
        deptFilter,
        stageFilter,
        statusFilter: 'ALL',
      }),
    [changeRequests, searchQuery, yearFilter, monthFilter, deptFilter, stageFilter]
  );

  const statusCounts = useMemo(
    () => computeChangeRequestStatusCounts(preStatusFilteredRequests),
    [preStatusFilteredRequests]
  );

  const filteredAndSortedRequests = useMemo(() => {
    const filtered =
      statusFilter === 'ALL'
        ? preStatusFilteredRequests
        : preStatusFilteredRequests.filter((r) => r.status === statusFilter);
    return sortChangeRequestsList(filtered, sortMode);
  }, [preStatusFilteredRequests, statusFilter, sortMode]);

  const activeSortOption = useMemo(
    () =>
      ST_CHANGE_REQUEST_SORT_OPTIONS.find((opt) => opt.value === sortMode) ||
      ST_CHANGE_REQUEST_SORT_OPTIONS[0],
    [sortMode]
  );

  const handleDeleteRow = async (req: StChangeRequest) => {
    setDeletingId(req.id);
    setActionError('');
    try {
      await deleteStChangeRequest(req.id);
      await onRefresh();
      setConfirmDeleteId(null);
      onShowToast?.('Đã xóa hạng mục phiếu yêu cầu.');
    } catch (err) {
      const msg = formatStChangeRequestError(err);
      setActionError(msg);
      onShowToast?.(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setYearFilter('ALL');
    setMonthFilter('ALL');
    setDeptFilter('ALL');
    setStageFilter('ALL');
    setStatusFilter('ALL');
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    yearFilter !== 'ALL' ||
    monthFilter !== 'ALL' ||
    deptFilter !== 'ALL' ||
    stageFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl font-sans">
      {/* Unified Single Horizontal Toolbar */}
      <div
        data-testid="st-change-requests-toolbar"
        className="px-2.5 py-2 border-b border-slate-200 bg-slate-50/70 rounded-t-xl flex items-center gap-1 flex-nowrap overflow-x-auto xl:overflow-visible shrink-0"
      >
        {/* 1. Search Input */}
        <div className="relative flex-1 min-w-[116px] max-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            data-testid="st-cr-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã phiếu, mã hàng, quy cách, nội dung..."
            aria-label="Tìm kiếm phiếu yêu cầu"
            className="w-full h-9 pl-7 pr-6 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2. Năm */}
        <select
          data-testid="st-cr-year-filter"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          aria-label="Lọc theo Năm"
          className="h-9 px-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer shrink-0"
        >
          <option value="ALL">Tất cả Năm</option>
          {availableYears.map((yr) => (
            <option key={yr} value={String(yr)}>
              Năm {yr}
            </option>
          ))}
        </select>

        {/* 3. Tháng */}
        <select
          data-testid="st-cr-month-filter"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          aria-label="Lọc theo Tháng"
          className="h-9 px-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer shrink-0"
        >
          <option value="ALL">Tất cả Tháng</option>
          {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
            <option key={m} value={String(m)}>
              Tháng {m}
            </option>
          ))}
        </select>

        {/* 4. Bộ phận YC */}
        <select
          data-testid="st-cr-dept-filter"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          aria-label="Lọc theo Bộ phận yêu cầu"
          className="h-9 px-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer shrink-0"
        >
          <option value="ALL">Tất cả Bộ phận</option>
          {departmentOptions.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        {/* 5. Công đoạn */}
        <select
          data-testid="st-cr-stage-filter"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          aria-label="Lọc theo Công đoạn"
          className="h-9 px-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer shrink-0"
        >
          <option value="ALL">Tất cả Công đoạn</option>
          {ST_CHANGE_REQUEST_PROCESS_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>

        {/* 6. Status Counter Tabs */}
        <div className="h-9 inline-flex items-center gap-0.5 p-0.5 bg-white border border-slate-300 rounded-lg shrink-0">
          <button
            type="button"
            data-testid="st-cr-status-tab-all"
            onClick={() => setStatusFilter('ALL')}
            className={`h-full px-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-[#14539E] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({formatNumberVN(statusCounts.total)})
          </button>
          <button
            type="button"
            data-testid="st-cr-status-tab-checking"
            onClick={() => setStatusFilter('Đang kiểm tra')}
            className={`h-full px-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'Đang kiểm tra'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang kiểm tra ({formatNumberVN(statusCounts.checking)})
          </button>
          <button
            type="button"
            data-testid="st-cr-status-tab-changed"
            onClick={() => setStatusFilter('Đã thay đổi')}
            className={`h-full px-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'Đã thay đổi'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã thay đổi ({formatNumberVN(statusCounts.changed)})
          </button>
          <button
            type="button"
            data-testid="st-cr-status-tab-unchanged"
            onClick={() => setStatusFilter('Không thay đổi')}
            className={`h-full px-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'Không thay đổi'
                ? 'bg-slate-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Không thay đổi ({formatNumberVN(statusCounts.unchanged)})
          </button>
        </div>

        {/* 7. Icon-only Sắp xếp theo */}
        <div className="relative shrink-0" ref={sortMenuRef}>
          <button
            type="button"
            data-testid="st-cr-sort-btn"
            onClick={() => setIsSortMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isSortMenuOpen}
            aria-label="Sắp xếp theo"
            title={`Sắp xếp theo (${activeSortOption.label})`}
            className={`w-9 h-9 rounded-lg border text-xs font-medium inline-flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
              isSortMenuOpen
                ? 'border-[#14539E] bg-blue-50 text-[#14539E]'
                : 'border-slate-300 bg-white hover:border-[#14539E] text-slate-700 hover:text-[#14539E]'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          {isSortMenuOpen && (
            <div
              role="menu"
              data-testid="st-cr-sort-menu"
              className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-30"
            >
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sắp xếp phiếu yêu cầu
              </div>
              {ST_CHANGE_REQUEST_SORT_OPTIONS.map((opt) => {
                const active = sortMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    data-testid={`st-cr-sort-option-${opt.value}`}
                    onClick={() => {
                      setSortMode(opt.value);
                      setIsSortMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      active
                        ? 'bg-blue-50/80 text-[#14539E] font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 8. + Thêm phiếu (far right) */}
        <button
          type="button"
          data-testid="st-cr-add-btn"
          onClick={() => setIsCreateModalOpen(true)}
          className="ml-auto h-9 px-2.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm phiếu</span>
        </button>
      </div>

      {/* Action error banner (never swallow Supabase errors) */}
      {actionError && (
        <div
          role="alert"
          className="mx-3 mt-2.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError('')}
            aria-label="Đóng thông báo lỗi"
            className="text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Read-Only 12-Column Sticky Table */}
      <div
        data-testid="st-cr-table-wrapper"
        className="flex-1 min-h-0 overflow-auto rounded-b-xl"
      >
        {isLoading && changeRequests.length === 0 ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
            <span>Đang tải nhật ký phiếu yêu cầu...</span>
          </div>
        ) : changeRequests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ClipboardList className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600">
              Chưa có phiếu yêu cầu thay đổi nào. Hãy tạo phiếu mới hoặc nhập từ
              file Excel.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-9 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-medium cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm phiếu</span>
              </button>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer inline-flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nhập từ file</span>
              </button>
            </div>
          </div>
        ) : filteredAndSortedRequests.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <p className="text-xs text-slate-500">
              Không có phiếu yêu cầu nào khớp bộ lọc hiện tại.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-[#14539E] cursor-pointer"
              >
                Hiển thị tất cả ({formatNumberVN(changeRequests.length)} hạng mục)
              </button>
            )}
          </div>
        ) : (
          <table
            data-testid="st-cr-table"
            className="w-full min-w-[980px] border-collapse text-left"
          >
            <thead className="sticky top-0 z-10 bg-slate-100 text-[9.5px] font-bold text-slate-600 uppercase tracking-tight leading-[1.15] shadow-[0_1px_0_0_rgba(203,213,225,1)]">
              <tr>
                <th className="px-1 py-2 w-8 text-center border-r border-b border-slate-200 whitespace-nowrap">
                  STT
                </th>
                <th className="px-1.5 py-2 w-[78px] text-center border-r border-b border-slate-200 whitespace-nowrap">
                  NGÀY NHẬN <br />YC
                </th>
                <th className="px-1.5 py-2 w-[78px] border-r border-b border-slate-200 whitespace-nowrap">
                  BỘ PHẬN <br />YC
                </th>
                <th className="px-1.5 py-2 w-[96px] border-r border-b border-slate-200 whitespace-nowrap">
                  MÃ HÀNG
                </th>
                <th className="px-1.5 py-2 w-[88px] border-r border-b border-slate-200 whitespace-nowrap">
                  QUY CÁCH
                </th>
                <th className="px-1.5 py-2 w-[84px] border-r border-b border-slate-200 whitespace-nowrap">
                  CÔNG ĐOẠN
                </th>
                <th className="px-2 py-2 min-w-[170px] border-r border-b border-slate-200">
                  NỘI DUNG YÊU CẦU <br />THAY ĐỔI
                </th>
                <th className="px-1.5 py-2 w-[104px] text-center border-r border-b border-slate-200 whitespace-nowrap">
                  TÌNH TRẠNG
                </th>
                <th className="px-1.5 py-2 w-[92px] text-center border-r border-b border-slate-200">
                  NGÀY ÁP DỤNG <br />ĐƠN GIÁ THAY ĐỔI
                </th>
                <th className="px-1.5 py-2 w-[68px] text-center border-r border-b border-slate-200">
                  PHIÊN BẢN <br />ÁP DỤNG
                </th>
                <th className="px-1.5 py-2 w-[110px] border-r border-b border-slate-200 whitespace-nowrap">
                  GHI CHÚ
                </th>
                <th className="px-1 py-2 w-[82px] text-center border-b border-slate-200 whitespace-nowrap">
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredAndSortedRequests.map((req, idx) => {
                const badge = ST_STATUS_BADGE_META[req.status];
                const isAllModel =
                  req.product_code.trim().toUpperCase() === 'ALL MODEL';
                const isConfirmingDelete = confirmDeleteId === req.id;
                const isDeleting = deletingId === req.id;
                const codeTooltip = `Mã phiếu: ${
                  req.request_code || 'Chưa gắn mã'
                } · Nhóm xử lý: ${req.assigned_group || 'ST'}`;

                return (
                  <tr
                    key={req.id}
                    data-testid={`st-cr-row-${req.id}`}
                    className="hover:bg-[#F3F8FF] transition-colors"
                  >
                    {/* 1. STT */}
                    <td className="px-1.5 py-2 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                      {formatNumberVN(idx + 1)}
                    </td>

                    {/* 2. NGÀY NHẬN YC */}
                    <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap border-r border-slate-100">
                      {formatStDateVN(req.received_at)}
                    </td>

                    {/* 3. BỘ PHẬN YC */}
                    <td
                      title={req.department || undefined}
                      className="px-2 py-2 font-semibold text-slate-800 whitespace-nowrap border-r border-slate-100"
                    >
                      {req.department || '—'}
                    </td>

                    {/* 4. MÃ HÀNG */}
                    <td
                      title={codeTooltip}
                      className="px-2 py-2 font-mono text-[11px] font-bold border-r border-slate-100 whitespace-nowrap"
                    >
                      {isAllModel ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-[#14539E] border border-blue-200 text-[10px] font-bold">
                          ALL MODEL
                        </span>
                      ) : req.product_code ? (
                        <span className="text-[#14539E]">{req.product_code}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>

                    {/* 5. QUY CÁCH */}
                    <td
                      title={req.specification || undefined}
                      className="px-2 py-2 text-[11px] text-slate-700 max-w-[120px] truncate border-r border-slate-100"
                    >
                      {req.specification || '—'}
                    </td>

                    {/* 6. CÔNG ĐOẠN */}
                    <td className="px-2 py-2 text-[11px] font-medium text-slate-700 whitespace-nowrap border-r border-slate-100">
                      {req.process_stage || (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* 7. NỘI DUNG YÊU CẦU THAY ĐỔI */}
                    <td
                      title={req.content}
                      className="px-2.5 py-2 text-slate-900 leading-snug border-r border-slate-100"
                    >
                      {req.content}
                    </td>

                    {/* 8. TÌNH TRẠNG (clickable badge -> Status Mini Modal) */}
                    <td className="px-2 py-2 text-center whitespace-nowrap border-r border-slate-100">
                      <button
                        type="button"
                        data-testid={`st-cr-row-status-btn-${req.id}`}
                        onClick={() => setStatusModalTarget(req)}
                        title="Bấm để cập nhật tình trạng xử lý"
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-all hover:shadow-xs ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                      >
                        {req.status}
                      </button>
                    </td>

                    {/* 9. NGÀY ÁP DỤNG ĐƠN GIÁ THAY ĐỔI */}
                    <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap border-r border-slate-100">
                      {req.processed_at ? formatStDateVN(req.processed_at) : '—'}
                    </td>

                    {/* 10. PHIÊN BẢN ÁP DỤNG */}
                    <td className="px-2 py-2 text-center font-mono text-[11px] font-semibold text-slate-700 whitespace-nowrap border-r border-slate-100">
                      {req.applied_version || (
                        <span className="text-slate-300 font-normal">—</span>
                      )}
                    </td>

                    {/* 11. GHI CHÚ */}
                    <td
                      title={req.notes || undefined}
                      className="px-2 py-2 text-[11px] text-slate-600 max-w-[160px] truncate border-r border-slate-100"
                    >
                      {req.notes || <span className="text-slate-300">—</span>}
                    </td>

                    {/* 12. THAO TÁC */}
                    <td className="px-1.5 py-2 text-center align-middle whitespace-nowrap">
                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isDeleting}
                            data-testid={`st-cr-confirm-delete-${req.id}`}
                            onClick={() => void handleDeleteRow(req)}
                            className="h-6 px-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? '...' : 'Xóa'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-6 px-1.5 rounded border border-slate-300 bg-white text-slate-600 text-[10px] cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1">
                          <button
                            type="button"
                            data-testid={`st-cr-action-status-${req.id}`}
                            onClick={() => setStatusModalTarget(req)}
                            title="Cập nhật tình trạng xử lý"
                            aria-label="Cập nhật tình trạng xử lý"
                            className="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-600 hover:border-[#14539E] hover:text-[#14539E] hover:bg-blue-50/50 inline-flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-testid={`st-cr-action-edit-${req.id}`}
                            onClick={() => setEditModalTarget(req)}
                            title="Chỉnh sửa hạng mục"
                            aria-label="Chỉnh sửa hạng mục"
                            className="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-600 hover:border-[#14539E] hover:text-[#14539E] hover:bg-blue-50/50 inline-flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            data-testid={`st-cr-action-delete-${req.id}`}
                            onClick={() => setConfirmDeleteId(req.id)}
                            title="Xóa hạng mục"
                            aria-label="Xóa hạng mục"
                            className="w-6 h-6 rounded-md border border-rose-200 bg-white text-rose-500 hover:bg-rose-50 inline-flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Multi-Item Change Request Modal */}
      <StChangeRequestCreateModal
        isOpen={isCreateModalOpen}
        products={products}
        existingRequests={changeRequests}
        departmentOptions={departmentOptions}
        groupOptions={groupOptions}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={onRefresh}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onShowToast={onShowToast}
      />

      {/* Import from Excel Modal */}
      <StChangeRequestImportModal
        isOpen={isImportModalOpen}
        products={products}
        existingRequests={changeRequests}
        defaultDepartment={departmentOptions[0] || 'Sản xuất'}
        defaultAssignedGroup={groupOptions.includes('ST') ? 'ST' : groupOptions[0] || 'ST'}
        onClose={() => setIsImportModalOpen(false)}
        onImported={onRefresh}
        onShowToast={onShowToast}
      />

      {/* Mini Status Update Modal */}
      <StChangeRequestStatusModal
        request={statusModalTarget}
        groupOptions={groupOptions}
        onClose={() => setStatusModalTarget(null)}
        onSaved={onRefresh}
        onShowToast={onShowToast}
      />

      {/* Full Edit Row Modal */}
      <StChangeRequestEditModal
        request={editModalTarget}
        products={products}
        departmentOptions={departmentOptions}
        groupOptions={groupOptions}
        onClose={() => setEditModalTarget(null)}
        onSaved={onRefresh}
        onShowToast={onShowToast}
      />
    </div>
  );
};
