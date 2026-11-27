import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  buildSingleStageInitialState,
  buildSingleStageStatusPayload,
  calculateCompletionDays,
  computeNewProductStatusCounts,
  computeStagesProgress,
  extractAvailableYearsFromNewProducts,
  filterNewProductsList,
  formatNumberVN,
  formatStageBadgeTooltip,
  formatStDateVN,
  getLocalIsoDateToday,
  getPendingWorkflowStep,
  isNewProductCompleted,
  sortNewProductsList,
  ST_NEW_PRODUCT_SORT_OPTIONS,
  ST_PRODUCTION_STAGES,
  StCustomer,
  StLine,
  StNewProductSortMode,
  StNewProductStatus,
  StProduct,
  StProductionStageMeta,
  StProductWithStatus,
  StStageBoolField,
  StStageDateField,
  StWorkflowBoolField,
  StWorkflowDateField,
} from '../../utils/stWorkLogic';
import { upsertStNewProductStatus } from '../../services/stWorkService';
import { StNewProductProgressImportModal } from './StNewProductProgressImportModal';
import { StNewProductQuickCreateModal } from './StNewProductQuickCreateModal';

export interface StNewProductsTabProps {
  lines: StLine[];
  customers: StCustomer[];
  productsWithStatus: StProductWithStatus[];
  isLoading: boolean;
  onStatusUpdated: (saved: StNewProductStatus) => void;
  onProductAndStatusCreated?: (
    product: StProduct,
    status: StNewProductStatus
  ) => void;
  onRefresh: () => Promise<void>;
  onNavigateToCatalog?: () => void;
  onShowToast?: (message: string) => void;
}

type StatusFilterMode = 'all' | 'completed' | 'in_progress';

interface ModalProgressState {
  has_process_erp: boolean;
  process_erp_date: string;
  has_stage_win: boolean;
  stage_win_date: string;
  has_stage_cut: boolean;
  stage_cut_date: string;
  has_stage_sol: boolean;
  stage_sol_date: string;
  has_stage_ass: boolean;
  stage_ass_date: string;
  has_stage_imp: boolean;
  stage_imp_date: string;
  has_stage_sol2: boolean;
  stage_sol2_date: string;
  has_stage_fin: boolean;
  stage_fin_date: string;
  has_st: boolean;
  st_date: string;
}

function toModalProgressState(
  status: StNewProductStatus | null
): ModalProgressState {
  return {
    has_process_erp: Boolean(status?.has_process_erp),
    process_erp_date: status?.process_erp_date || '',
    has_stage_win: Boolean(status?.has_stage_win),
    stage_win_date: status?.stage_win_date || '',
    has_stage_cut: Boolean(status?.has_stage_cut),
    stage_cut_date: status?.stage_cut_date || '',
    has_stage_sol: Boolean(status?.has_stage_sol),
    stage_sol_date: status?.stage_sol_date || '',
    has_stage_ass: Boolean(status?.has_stage_ass),
    stage_ass_date: status?.stage_ass_date || '',
    has_stage_imp: Boolean(status?.has_stage_imp),
    stage_imp_date: status?.stage_imp_date || '',
    has_stage_sol2: Boolean(status?.has_stage_sol2),
    stage_sol2_date: status?.stage_sol2_date || '',
    has_stage_fin: Boolean(status?.has_stage_fin),
    stage_fin_date: status?.stage_fin_date || '',
    has_st: Boolean(status?.has_st),
    st_date: status?.st_date || '',
  };
}

export const StNewProductsTab: React.FC<StNewProductsTabProps> = ({
  lines,
  customers,
  productsWithStatus,
  isLoading,
  onStatusUpdated,
  onProductAndStatusCreated,
  onRefresh,
  onNavigateToCatalog,
  onShowToast,
}) => {
  // Filter, Search & Sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>(() =>
    new Date().getFullYear().toString()
  );
  const [monthFilter, setMonthFilter] = useState<string>(() =>
    (new Date().getMonth() + 1).toString()
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>('all');
  const [sortMode, setSortMode] =
    useState<StNewProductSortMode>('process_erp_desc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  // Modal A: Compact Mini Progress Modal (st_new_product_status)
  const [progressModalItem, setProgressModalItem] =
    useState<StProductWithStatus | null>(null);
  const [miniState, setMiniState] = useState<ModalProgressState>(() =>
    toModalProgressState(null)
  );
  const [miniNotes, setMiniNotes] = useState<string>('');
  const [isSavingMini, setIsSavingMini] = useState<boolean>(false);

  // Modal B: Full Product Detail Modal (opened by clicking Mã hàng link)
  const [detailModalItem, setDetailModalItem] =
    useState<StProductWithStatus | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Modal C: Import Progress from Excel/CSV
  const [isProgressImportOpen, setIsProgressImportOpen] =
    useState<boolean>(false);

  // Modal D: 2-in-1 Quick Create Product + Initial Status
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState<boolean>(false);

  // Modal E: Single-Stage Mini Modal (triggered by clicking WIN..FIN badge)
  const [singleStageTarget, setSingleStageTarget] = useState<{
    item: StProductWithStatus;
    stage: StProductionStageMeta;
  } | null>(null);
  const [singleStageDone, setSingleStageDone] = useState<boolean>(false);
  const [singleStageDate, setSingleStageDate] = useState<string>('');
  const [isSavingSingleStage, setIsSavingSingleStage] = useState<boolean>(false);

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

  const lineNames = useMemo(() => {
    const set = new Set<string>(lines.map((l) => l.name));
    productsWithStatus.forEach((p) => {
      if (p.product.line_name) set.add(p.product.line_name);
    });
    return Array.from(set);
  }, [lines, productsWithStatus]);

  const customerNames = useMemo(() => {
    const set = new Set<string>(customers.map((c) => c.short_name));
    productsWithStatus.forEach((p) => {
      if (p.product.customer_short_name) {
        set.add(p.product.customer_short_name);
      }
    });
    return Array.from(set);
  }, [customers, productsWithStatus]);

  const currentYearNum = new Date().getFullYear();

  const availableYears = useMemo(
    () => extractAvailableYearsFromNewProducts(productsWithStatus, currentYearNum),
    [productsWithStatus, currentYearNum]
  );

  const existingProductCodes = useMemo(
    () =>
      new Set(
        productsWithStatus.map((item) =>
          item.product.product_code.trim().toLowerCase()
        )
      ),
    [productsWithStatus]
  );

  const preStatusFilteredItems = useMemo(
    () =>
      filterNewProductsList(productsWithStatus, {
        searchQuery,
        lineFilter,
        customerFilter,
        yearFilter,
        monthFilter,
        statusFilter: 'all',
      }),
    [productsWithStatus, searchQuery, lineFilter, customerFilter, yearFilter, monthFilter]
  );

  const summaryCounts = useMemo(
    () => computeNewProductStatusCounts(preStatusFilteredItems),
    [preStatusFilteredItems]
  );

  const filteredItems = useMemo(() => {
    const statusMatched =
      statusFilter === 'all'
        ? preStatusFilteredItems
        : preStatusFilteredItems.filter((item) =>
            statusFilter === 'completed' ? item.isCompleted : !item.isCompleted
          );
    return sortNewProductsList(statusMatched, sortMode);
  }, [preStatusFilteredItems, statusFilter, sortMode]);

  // Live preview inside Mini Progress Modal
  const miniLivePreview = useMemo(() => {
    const stageProgress = computeStagesProgress(miniState);
    const completed = isNewProductCompleted(miniState);
    const pendingStep = getPendingWorkflowStep(miniState);
    return {
      stageProgress,
      isCompleted: completed,
      pendingStep,
      waitingLabel: pendingStep ? pendingStep.waitingLabel : 'Hoàn thành',
    };
  }, [miniState]);

  const handleOpenProgressModal = (item: StProductWithStatus) => {
    setProgressModalItem(item);
    setMiniState(toModalProgressState(item.status));
    setMiniNotes(item.status?.notes || '');
  };

  const handleCloseProgressModal = () => {
    if (isSavingMini) return;
    setProgressModalItem(null);
  };

  const handleToggleMiniField = (
    boolField: StWorkflowBoolField | StStageBoolField,
    dateField: StWorkflowDateField | StStageDateField,
    checked: boolean
  ) => {
    setMiniState((prev) => ({
      ...prev,
      [boolField]: checked,
      [dateField]: checked ? prev[dateField] || getLocalIsoDateToday() : '',
    }));
  };

  const handleChangeMiniDate = (
    boolField: StWorkflowBoolField | StStageBoolField,
    dateField: StWorkflowDateField | StStageDateField,
    dateVal: string
  ) => {
    setMiniState((prev) => ({
      ...prev,
      [dateField]: dateVal,
      ...(dateVal ? { [boolField]: true } : {}),
    }));
  };

  const handleSaveMiniProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressModalItem) return;

    const pid = progressModalItem.product.id;
    setIsSavingMini(true);
    try {
      const savedStatus = await upsertStNewProductStatus({
        id: progressModalItem.status?.id || null,
        product_id: pid,
        has_process_erp: miniState.has_process_erp,
        process_erp_date: miniState.process_erp_date || null,
        has_stage_win: miniState.has_stage_win,
        stage_win_date: miniState.stage_win_date || null,
        has_stage_cut: miniState.has_stage_cut,
        stage_cut_date: miniState.stage_cut_date || null,
        has_stage_sol: miniState.has_stage_sol,
        stage_sol_date: miniState.stage_sol_date || null,
        has_stage_ass: miniState.has_stage_ass,
        stage_ass_date: miniState.stage_ass_date || null,
        has_stage_imp: miniState.has_stage_imp,
        stage_imp_date: miniState.stage_imp_date || null,
        has_stage_sol2: miniState.has_stage_sol2,
        stage_sol2_date: miniState.stage_sol2_date || null,
        has_stage_fin: miniState.has_stage_fin,
        stage_fin_date: miniState.stage_fin_date || null,
        has_st: miniState.has_st,
        st_date: miniState.st_date || null,
        unit_price: progressModalItem.status?.unit_price ?? null,
        currency: progressModalItem.status?.currency || 'VND',
        notes: miniNotes.trim() || null,
      });

      onStatusUpdated(savedStatus);
      await onRefresh();
      onShowToast?.(
        `Đã cập nhật tiến độ đơn giá mới cho mã "${progressModalItem.product.product_code}".`
      );
      setProgressModalItem(null);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingMini(false);
    }
  };

  const handleOpenSingleStageModal = (
    item: StProductWithStatus,
    stage: StProductionStageMeta
  ) => {
    const initial = buildSingleStageInitialState(item.status, stage);
    setSingleStageTarget({ item, stage });
    setSingleStageDone(initial.done);
    setSingleStageDate(initial.date);
  };

  const handleCloseSingleStageModal = () => {
    if (isSavingSingleStage) return;
    setSingleStageTarget(null);
  };

  const handleSaveSingleStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStageTarget || isSavingSingleStage) return;

    const { item, stage } = singleStageTarget;
    setIsSavingSingleStage(true);
    try {
      const payload = buildSingleStageStatusPayload(
        item,
        stage,
        singleStageDone,
        singleStageDate
      );
      const savedStatus = await upsertStNewProductStatus(payload);
      onStatusUpdated(savedStatus);
      await onRefresh();
      onShowToast?.(
        singleStageDone
          ? `Đã cập nhật hoàn thành công đoạn ${stage.code} cho mã "${item.product.product_code}".`
          : `Đã đặt lại trạng thái chưa hoàn thành công đoạn ${stage.code} cho mã "${item.product.product_code}".`
      );
      setSingleStageTarget(null);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingSingleStage(false);
    }
  };

  const activeSortOption = useMemo(
    () =>
      ST_NEW_PRODUCT_SORT_OPTIONS.find((opt) => opt.value === sortMode) ||
      ST_NEW_PRODUCT_SORT_OPTIONS[0],
    [sortMode]
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl font-sans">
      {/* Unified Single Horizontal Toolbar: Search -> Năm -> Tháng -> Line -> Khách hàng -> Hiện trạng -> Sort Icon -> + Thêm mã hàng mới */}
      <div className="px-2.5 py-2 border-b border-slate-200 bg-slate-50/70 rounded-t-xl flex items-center gap-1.5 flex-nowrap overflow-x-auto xl:overflow-visible shrink-0">
        {/* 1. Search Input */}
        <div className="relative w-44 xl:w-48 2xl:w-56 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã hàng, quy cách..."
            aria-label="Tìm kiếm đơn giá mới"
            className="w-full h-9 pl-8 pr-7 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2. Năm */}
        <select
          data-testid="st-new-products-year-filter"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          aria-label="Lọc theo Năm"
          className="h-9 px-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer shrink-0"
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
          data-testid="st-new-products-month-filter"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          aria-label="Lọc theo Tháng"
          className="h-9 px-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer shrink-0"
        >
          <option value="ALL">Tất cả Tháng</option>
          {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
            <option key={m} value={String(m)}>
              Tháng {m}
            </option>
          ))}
        </select>

        {/* 4. Line */}
        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          aria-label="Lọc theo Line"
          className="h-9 px-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer max-w-[104px] shrink-0"
        >
          <option value="ALL">Tất cả Line</option>
          {lineNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {/* 5. Khách hàng */}
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          aria-label="Lọc theo Khách hàng"
          className="h-9 px-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer min-w-[96px] max-w-[114px] shrink-0"
        >
          <option value="ALL">Tất cả KH</option>
          {customerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {/* 6. Hiện trạng */}
        <div className="h-9 inline-flex items-center gap-0.5 p-0.5 bg-white border border-slate-300 rounded-lg shrink-0">
          <button
            type="button"
            data-testid="st-status-filter-all"
            onClick={() => setStatusFilter('all')}
            className={`h-full px-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-[#14539E] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({formatNumberVN(summaryCounts.total)})
          </button>
          <button
            type="button"
            data-testid="st-status-filter-completed"
            onClick={() => setStatusFilter('completed')}
            className={`h-full px-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hoàn thành ({formatNumberVN(summaryCounts.completed)})
          </button>
          <button
            type="button"
            data-testid="st-status-filter-in_progress"
            onClick={() => setStatusFilter('in_progress')}
            className={`h-full px-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'in_progress'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang làm ({formatNumberVN(summaryCounts.inProgress)})
          </button>
        </div>

        {/* 7. Icon-only Sắp xếp theo */}
        <div className="relative shrink-0" ref={sortMenuRef}>
          <button
            type="button"
            data-testid="st-new-products-sort-btn"
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
              data-testid="st-new-products-sort-menu"
              className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-30"
            >
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sắp xếp danh sách
              </div>
              {ST_NEW_PRODUCT_SORT_OPTIONS.map((opt) => {
                const active = sortMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    data-testid={`st-sort-option-${opt.value}`}
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

        {/* 8. + Thêm mã hàng mới (far right) */}
        <button
          type="button"
          data-testid="st-new-products-add-btn"
          onClick={() => setIsQuickCreateOpen(true)}
          className="ml-auto h-9 px-3 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm mã hàng mới</span>
        </button>
      </div>

      {/* 3. Read-Only 12-Column Table (`st_new_product_status` joined with `st_products`) */}
      <div
        data-testid="st-new-products-table-wrapper"
        className="flex-1 min-h-0 overflow-auto rounded-b-xl"
      >
        {isLoading && productsWithStatus.length === 0 ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
            <span>Đang tải tiến độ đơn giá mới...</span>
          </div>
        ) : productsWithStatus.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <PackageOpen className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600">
              Chưa có sản phẩm nào để theo dõi. Vui lòng thêm sản phẩm mới hoặc
              mở tab <strong>Danh mục sản phẩm</strong>.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsQuickCreateOpen(true)}
                className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm mã hàng mới</span>
              </button>
              {onNavigateToCatalog && (
                <button
                  type="button"
                  onClick={onNavigateToCatalog}
                  className="h-8 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Mở Danh mục sản phẩm
                </button>
              )}
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Không có mã hàng nào khớp bộ lọc hiện tại.
          </div>
        ) : (
          <table
            data-testid="st-new-products-table"
            className="w-full border-collapse text-left"
          >
            <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-tight shadow-[0_1px_0_0_rgba(203,213,225,1)]">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-100 px-1 py-2.5 w-[34px] min-w-[34px] text-center border-r border-b border-slate-200 whitespace-nowrap">
                  STT
                </th>
                <th className="sticky left-[34px] z-20 bg-slate-100 px-1.5 py-2.5 w-[46px] min-w-[46px] border-r border-b border-slate-200 whitespace-nowrap">
                  LINE
                </th>
                <th className="sticky left-[80px] z-20 bg-slate-100 px-1.5 py-2.5 min-w-[82px] border-r border-b border-slate-200 whitespace-nowrap">
                  MÃ HÀNG
                </th>
                <th className="px-1.5 py-2.5 w-[64px] max-w-[68px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  QUY CÁCH
                </th>
                <th className="px-1 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  QUY TRÌNH ERP
                </th>
                <th className="px-1 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  NGÀY TẠO QT
                </th>
                <th className="px-1 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  CÔNG ĐOẠN
                </th>
                <th className="px-1 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  ST
                </th>
                <th className="px-1 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  NGÀY ÁP DỤNG
                </th>
                <th className="px-1 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  TỶ LỆ %
                </th>
                <th className="px-1 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  HIỆN TRẠNG
                </th>
                <th className="px-1 py-2.5 w-[48px] text-center border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredItems.map((item, rowIdx) => {
                const p = item.product;
                const st = item.status;
                const hasProcessErp = Boolean(st?.has_process_erp);
                const hasSt = Boolean(st?.has_st);
                const { percentage, allCompleted, nextPendingStageKey } =
                  item.stageProgress;
                const isWaitingSt = hasProcessErp && allCompleted && !hasSt;
                const stickyCellBg = item.isCompleted
                  ? 'bg-[#F4FBF7] group-hover:bg-[#EAF7F0]'
                  : 'bg-white group-hover:bg-[#F3F8FF]';

                return (
                  <tr
                    key={p.id}
                    className={`group transition-colors ${
                      item.isCompleted
                        ? 'bg-[#F4FBF7] hover:bg-[#EAF7F0]'
                        : 'bg-white hover:bg-[#F3F8FF]'
                    }`}
                  >
                    {/* 1. STT */}
                    <td
                      className={`sticky left-0 z-[5] px-1 py-2 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-200/80 transition-colors ${stickyCellBg}`}
                    >
                      {rowIdx + 1}
                    </td>

                    {/* 2. LINE (từ st_products) */}
                    <td
                      title={p.line_name || undefined}
                      className={`sticky left-[34px] z-[5] px-1.5 py-2 font-semibold text-slate-700 max-w-[46px] truncate border-r border-slate-200/80 transition-colors ${stickyCellBg}`}
                    >
                      {p.line_name || '—'}
                    </td>

                    {/* 3. Mã hàng (từ st_products, link xanh đậm -> Full Product Detail Modal) */}
                    <td
                      className={`sticky left-[80px] z-[5] px-1.5 py-2 border-r border-slate-200/80 transition-colors ${stickyCellBg}`}
                    >
                      <button
                        type="button"
                        data-testid={`st-product-code-btn-${p.product_code}`}
                        onClick={() => setDetailModalItem(item)}
                        title="Bấm để xem chi tiết thông tin sản phẩm"
                        className="font-mono text-[11.5px] font-bold text-[#14539E] hover:underline cursor-pointer text-left whitespace-nowrap"
                      >
                        {p.product_code}
                      </button>
                    </td>

                    {/* 4. Quy cách (từ st_products) */}
                    <td
                      title={p.specification || undefined}
                      className="px-1.5 py-2 border-r border-slate-100 text-[11.5px] text-slate-600 max-w-[68px] truncate"
                    >
                      {p.specification || '—'}
                    </td>

                    {/* 5. QUY TRÌNH ERP (Icon-only) */}
                    <td className="px-1 py-2 border-r border-slate-100 text-center align-middle">
                      {hasProcessErp ? (
                        <span
                          title="Đã có Quy trình ERP"
                          aria-label="Quy trình ERP: Đã có"
                          className="inline-flex items-center justify-center"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </span>
                      ) : (
                        <span
                          title="Đang chờ Quy trình ERP"
                          aria-label="Quy trình ERP: Đang chờ"
                          className="inline-flex items-center justify-center"
                        >
                          <Clock className="w-4 h-4 text-amber-500" />
                        </span>
                      )}
                    </td>

                    {/* 6. NGÀY TẠO QT */}
                    <td className="px-1 py-2 border-r border-slate-100 text-center font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                      {formatStDateVN(st?.process_erp_date)}
                    </td>

                    {/* 7. Công đoạn (WIN -> CUT -> SOL -> ASS -> IMP -> SOL2 -> FIN) */}
                    <td className="px-1 py-2 border-r border-slate-100 align-middle">
                      <div className="flex items-center justify-center gap-0.5 flex-nowrap">
                        {ST_PRODUCTION_STAGES.map((stage, idx) => {
                          const done = Boolean(st?.[stage.boolField]);
                          const doneDate = st?.[stage.dateField] || null;
                          const isCurrentNext =
                            hasProcessErp &&
                            !done &&
                            nextPendingStageKey === stage.key;

                          const badgeClass = done
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400'
                            : isCurrentNext
                            ? 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100 hover:border-amber-500'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-600';

                          const tooltipText = formatStageBadgeTooltip(
                            stage,
                            done,
                            doneDate,
                            isCurrentNext
                          );

                          return (
                            <React.Fragment key={stage.key}>
                              <button
                                type="button"
                                data-testid={`st-stage-btn-${p.product_code}-${stage.key}`}
                                onClick={() => handleOpenSingleStageModal(item, stage)}
                                title={tooltipText}
                                aria-label={`${p.product_code}: ${tooltipText}`}
                                className={`inline-flex items-center justify-center px-1 py-0.5 rounded border font-mono text-[9px] font-semibold leading-none whitespace-nowrap select-none cursor-pointer transition-all hover:-translate-y-px hover:shadow-xs focus:outline-none focus:ring-1 focus:ring-[#14539E] ${badgeClass}`}
                              >
                                {stage.code}
                              </button>
                              {idx < ST_PRODUCTION_STAGES.length - 1 && (
                                <span
                                  aria-hidden="true"
                                  className="text-[8px] text-slate-300 select-none leading-none"
                                >
                                  →
                                </span>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </td>

                    {/* 8. ST (Icon-only) */}
                    <td className="px-1 py-2 border-r border-slate-100 text-center align-middle">
                      {hasSt ? (
                        <span
                          title="Đã hoàn thành ST"
                          aria-label="ST: Đã hoàn thành"
                          className="inline-flex items-center justify-center"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </span>
                      ) : isWaitingSt ? (
                        <span
                          title="Đã xong QT & 7 công đoạn – đang chờ ST"
                          aria-label="ST: Đang chờ"
                          className="inline-flex items-center justify-center"
                        >
                          <Clock className="w-4 h-4 text-amber-500" />
                        </span>
                      ) : (
                        <span
                          aria-label="ST: Chưa tới lượt"
                          className="text-slate-300 font-medium select-none"
                        >
                          —
                        </span>
                      )}
                    </td>

                    {/* 9. Ngày áp dụng */}
                    <td className="px-1 py-2 border-r border-slate-100 text-center font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                      {formatStDateVN(st?.st_date)}
                    </td>

                    {/* 10. Tỷ lệ % (10 mốc × 10% = 100%) */}
                    <td
                      title={`Tạo mã: 10% · QT ERP: ${
                        hasProcessErp ? '+10%' : '0%'
                      } · Công đoạn: ${item.stageProgress.completedCount}/7 (+${
                        item.stageProgress.completedCount * 10
                      }%) · ST: ${
                        hasSt && st?.st_date ? '+10%' : '0%'
                      } = ${percentage}%`}
                      className="px-1 py-2 border-r border-slate-100 align-middle whitespace-nowrap"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-5 h-1.5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${
                              percentage === 100
                                ? 'bg-emerald-600'
                                : percentage > 0
                                ? 'bg-[#14539E]'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span
                          data-testid={`st-row-percent-${p.product_code}`}
                          className={`font-mono text-[10.5px] font-bold tabular-nums w-[30px] text-right ${
                            percentage === 100
                              ? 'text-emerald-700'
                              : percentage > 0
                              ? 'text-[#14539E]'
                              : 'text-slate-400'
                          }`}
                        >
                          {percentage}%
                        </span>
                      </div>
                    </td>

                    {/* 11. Hiện trạng (Auto Badge: Hoàn thành / Đang làm) */}
                    <td className="px-1 py-2 border-r border-slate-100 text-center align-middle whitespace-nowrap">
                      {item.isCompleted ? (
                        <span
                          data-testid={`st-row-status-${p.product_code}`}
                          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] font-semibold whitespace-nowrap"
                        >
                          Hoàn thành
                        </span>
                      ) : (
                        <span
                          data-testid={`st-row-status-${p.product_code}`}
                          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10.5px] font-semibold whitespace-nowrap"
                        >
                          Đang làm
                        </span>
                      )}
                    </td>

                    {/* 12. Thao tác (Icon-only Cập nhật tiến độ, NO delete button) */}
                    <td className="px-1 py-2 text-center align-middle">
                      <button
                        type="button"
                        data-testid={`st-product-progress-btn-${p.product_code}`}
                        onClick={() => handleOpenProgressModal(item)}
                        title={`Cập nhật tiến độ ${p.product_code}`}
                        aria-label={`Cập nhật tiến độ ${p.product_code}`}
                        className="w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:border-[#14539E] hover:text-[#14539E] hover:bg-blue-50/50 inline-flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL A: Compact Mini Progress Modal (st_new_product_status) */}
      {progressModalItem && (() => {
        const mp = progressModalItem.product;
        const pct = miniLivePreview.stageProgress.percentage;
        const doneStages = miniLivePreview.stageProgress.completedCount;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Cập nhật tiến độ mã hàng ${mp.product_code}`}
            onClick={handleCloseProgressModal}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          >
            <form
              data-testid="st-mini-progress-modal"
              onSubmit={handleSaveMiniProgress}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2 bg-slate-50/80 shrink-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#14539E]">
                      {mp.product_code}
                    </span>
                    {miniLivePreview.isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        Hoàn thành
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                        <Clock className="w-3 h-3" />
                        {miniLivePreview.waitingLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">
                    {mp.product_name}
                    {mp.specification ? ` · ${mp.specification}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseProgressModal}
                  aria-label="Đóng cửa sổ cập nhật tiến độ"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
                {/* Tổng quan tiến độ 10 mốc × 10% */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="font-bold text-slate-800">
                      Tỷ lệ hoàn thành:
                    </span>
                    <span className="text-slate-500">
                      Tạo mã 10% + QT ERP {miniState.has_process_erp ? '10%' : '0%'} + {doneStages}/7 CĐ ({doneStages * 10}%) + ST{' '}
                      {miniState.has_st && miniState.st_date ? '10%' : '0%'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          pct === 100
                            ? 'bg-emerald-600'
                            : pct > 0
                            ? 'bg-[#14539E]'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span
                      data-testid="st-mini-percent-label"
                      className={`font-mono text-xs font-bold tabular-nums ${
                        pct === 100
                          ? 'text-emerald-700'
                          : pct > 0
                          ? 'text-[#14539E]'
                          : 'text-slate-500'
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* 1. Quy trình ERP */}
                <div
                  className={`rounded-lg border px-3 py-2.5 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                    miniState.has_process_erp
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-amber-50/50 border-amber-200'
                  }`}
                >
                  <label className="inline-flex items-center gap-2.5 font-bold text-slate-900 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      data-testid="st-mini-check-process_erp"
                      checked={miniState.has_process_erp}
                      onChange={(e) =>
                        handleToggleMiniField(
                          'has_process_erp',
                          'process_erp_date',
                          e.target.checked
                        )
                      }
                      className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                    />
                    <span>1. Quy trình ERP</span>
                  </label>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                      Ngày tạo QT:
                    </span>
                    <input
                      type="date"
                      data-testid="st-mini-date-process_erp"
                      value={miniState.process_erp_date}
                      onChange={(e) =>
                        handleChangeMiniDate(
                          'has_process_erp',
                          'process_erp_date',
                          e.target.value
                        )
                      }
                      aria-label="Ngày tạo QT"
                      className="h-8 w-36 px-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                    />
                  </div>
                </div>

                {/* 2. Danh sách 7 công đoạn */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">
                      2. Danh sách 7 công đoạn ({doneStages}/7)
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-slate-500 tabular-nums">
                      +{doneStages * 10}% / 70%
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {ST_PRODUCTION_STAGES.map((stage) => {
                      const checked = Boolean(miniState[stage.boolField]);
                      const dateVal = miniState[stage.dateField] || '';
                      return (
                        <div
                          key={stage.key}
                          className={`rounded-lg border px-3 py-2 flex flex-wrap items-center justify-between gap-2 transition-colors ${
                            checked
                              ? 'bg-emerald-50/60 border-emerald-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <label className="inline-flex items-center gap-2.5 font-semibold text-slate-800 cursor-pointer min-w-0 flex-1">
                            <input
                              type="checkbox"
                              data-testid={`st-mini-stage-check-${stage.key}`}
                              checked={checked}
                              onChange={(e) =>
                                handleToggleMiniField(
                                  stage.boolField,
                                  stage.dateField,
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                            />
                            <span className="font-mono text-[11px] font-bold text-[#14539E]">
                              {stage.code}
                            </span>
                            <span className="text-slate-600 truncate">
                              – {stage.name}
                            </span>
                          </label>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-slate-500 whitespace-nowrap">
                              Ngày hoàn thành:
                            </span>
                            <input
                              type="date"
                              data-testid={`st-mini-stage-date-${stage.key}`}
                              value={dateVal}
                              onChange={(e) =>
                                handleChangeMiniDate(
                                  stage.boolField,
                                  stage.dateField,
                                  e.target.value
                                )
                              }
                              aria-label={`Ngày hoàn thành ${stage.fullLabel}`}
                              className="h-7 w-36 px-2 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#14539E]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. ST */}
                <div
                  className={`rounded-lg border px-3 py-2.5 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                    miniState.has_st && miniState.st_date
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : miniState.has_process_erp &&
                        miniLivePreview.stageProgress.allCompleted
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-slate-50/60 border-slate-200'
                  }`}
                >
                  <label className="inline-flex items-center gap-2.5 font-bold text-slate-900 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      data-testid="st-mini-check-st"
                      checked={miniState.has_st}
                      onChange={(e) =>
                        handleToggleMiniField(
                          'has_st',
                          'st_date',
                          e.target.checked
                        )
                      }
                      className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                    />
                    <span>3. ST (Áp dụng sản xuất)</span>
                  </label>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                      Ngày áp dụng:
                    </span>
                    <input
                      type="date"
                      data-testid="st-mini-date-st"
                      value={miniState.st_date}
                      onChange={(e) =>
                        handleChangeMiniDate(
                          'has_st',
                          'st_date',
                          e.target.value
                        )
                      }
                      aria-label="Ngày áp dụng"
                      className="h-8 w-36 px-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                    />
                  </div>
                </div>

                {/* Ghi chú */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ghi chú
                  </label>
                  <textarea
                    rows={2}
                    data-testid="st-mini-notes"
                    value={miniNotes}
                    onChange={(e) => setMiniNotes(e.target.value)}
                    placeholder="Nhập ghi chú xử lý..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseProgressModal}
                  className="h-8 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingMini}
                  data-testid="st-mini-save-btn"
                  className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingMini ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu tiến độ</span>
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* MODAL E: Single-Stage Mini Modal (WIN / CUT / SOL / ASS / IMP / SOL2 / FIN) */}
      {singleStageTarget && (() => {
        const { item, stage } = singleStageTarget;
        const sp = item.product;
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Cập nhật công đoạn ${stage.fullLabel} cho ${sp.product_code}`}
            onClick={handleCloseSingleStageModal}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          >
            <form
              data-testid="st-single-stage-modal"
              onSubmit={handleSaveSingleStage}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/80">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-[#14539E]">
                      {sp.product_code}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[#14539E] font-mono text-[11px] font-bold">
                      {stage.fullLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {sp.product_name}
                    {sp.specification ? ` · ${sp.specification}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSavingSingleStage}
                  onClick={handleCloseSingleStageModal}
                  aria-label="Đóng cửa sổ cập nhật công đoạn"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3 text-xs">
                <label
                  className={`rounded-lg border px-3 py-2.5 flex items-center gap-2.5 font-semibold cursor-pointer transition-colors ${
                    singleStageDone
                      ? 'bg-emerald-50/60 border-emerald-200 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    data-testid="st-single-stage-check"
                    checked={singleStageDone}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSingleStageDone(checked);
                      setSingleStageDate((prev) =>
                        checked ? prev || getLocalIsoDateToday() : ''
                      );
                    }}
                    className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                  />
                  <span>Đã hoàn thành công đoạn này</span>
                </label>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                      htmlFor="st-single-stage-date-input"
                      className="font-semibold text-slate-700"
                    >
                      Ngày hoàn thành
                    </label>
                    <span
                      data-testid="st-single-stage-date-vn"
                      className="font-mono text-[11px] font-medium text-slate-500"
                    >
                      {singleStageDate ? formatStDateVN(singleStageDate) : '—'}
                    </span>
                  </div>
                  <input
                    id="st-single-stage-date-input"
                    type="date"
                    lang="vi"
                    data-testid="st-single-stage-date"
                    value={singleStageDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSingleStageDate(val);
                      if (val) setSingleStageDone(true);
                    }}
                    className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingSingleStage}
                  onClick={handleCloseSingleStageModal}
                  className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingSingleStage}
                  data-testid="st-single-stage-save-btn"
                  className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSingleStage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu</span>
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* MODAL B: Full Product Detail Modal (opened by clicking Mã hàng link) */}
      {detailModalItem && (() => {
        const dp = detailModalItem.product;
        const st = detailModalItem.status;
        const imgBroken = Boolean(brokenImages[dp.id]);
        const completionDays = detailModalItem.isCompleted
          ? calculateCompletionDays(dp.created_at, st?.st_date)
          : null;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Chi tiết mã hàng ${dp.product_code}`}
            onClick={() => setDetailModalItem(null)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          >
            <div
              data-testid="st-full-detail-modal"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/80 shrink-0">
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="font-mono text-base font-bold text-[#14539E]">
                    {dp.product_code}
                  </span>
                  {detailModalItem.isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      Hoàn thành
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                      <Clock className="w-3 h-3" />
                      {detailModalItem.waitingLabel}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailModalItem(null)}
                  aria-label="Đóng cửa sổ chi tiết"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Product Info (from st_products) */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4">
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      {dp.image_url && !imgBroken ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              url: dp.image_url || '',
                              title: `${dp.product_code} - ${dp.product_name}`,
                            })
                          }
                          title="Phóng to hình ảnh"
                          className="relative w-full h-44 bg-white flex items-center justify-center cursor-pointer group overflow-hidden"
                        >
                          <img
                            src={dp.image_url}
                            alt={dp.product_name}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenImages((prev) => ({
                                ...prev,
                                [dp.id]: true,
                              }))
                            }
                            className="w-full h-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                          <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-slate-900/75 text-white text-[10px] font-medium inline-flex items-center gap-1">
                            <Maximize2 className="w-3 h-3" />
                            Phóng to
                          </span>
                        </button>
                      ) : (
                        <div className="w-full h-44 flex flex-col items-center justify-center gap-1.5 text-slate-400 p-3 bg-slate-50">
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                          <span className="text-[11px]">Chưa có hình ảnh</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-8 grid grid-cols-2 gap-3 content-start">
                    <div>
                      <div className="text-[11px] text-slate-500">Mã hàng</div>
                      <div className="font-mono font-bold text-[#14539E] text-sm mt-0.5">
                        {dp.product_code}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Tên hàng</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {dp.product_name}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Line sản xuất
                      </div>
                      <div className="font-medium text-slate-800 mt-0.5">
                        {dp.line_name || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Khách hàng
                      </div>
                      <div className="font-medium text-slate-800 mt-0.5">
                        {dp.customer_short_name || '—'}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] text-slate-500">Quy cách</div>
                      <div className="font-medium text-slate-800 mt-0.5">
                        {dp.specification || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Ngày đăng ký
                      </div>
                      <div className="font-mono font-semibold text-slate-800 mt-0.5 tabular-nums">
                        {formatStDateVN(dp.created_at)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Số ngày hoàn thành
                      </div>
                      <div
                        className={`font-mono font-bold mt-0.5 tabular-nums ${
                          completionDays !== null
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {completionDays !== null
                          ? `${formatNumberVN(completionDays)} ngày`
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Summary */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold uppercase tracking-wide text-slate-700">
                      Tiến độ thực hiện đơn giá mới
                    </h4>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            detailModalItem.stageProgress.percentage === 100
                              ? 'bg-emerald-600'
                              : 'bg-[#14539E]'
                          }`}
                          style={{
                            width: `${detailModalItem.stageProgress.percentage}%`,
                          }}
                        />
                      </div>
                      <span
                        data-testid="st-detail-percent-label"
                        className={`font-mono font-bold tabular-nums ${
                          detailModalItem.stageProgress.percentage === 100
                            ? 'text-emerald-700'
                            : 'text-[#14539E]'
                        }`}
                      >
                        {detailModalItem.stageProgress.percentage}% (
                        {detailModalItem.stageProgress.completedCount}/7 công đoạn)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">
                        Quy trình ERP
                      </span>
                      <span className="font-mono text-slate-900">
                        {st?.has_process_erp
                          ? `Đã có (${formatStDateVN(st.process_erp_date)})`
                          : 'Đang chờ'}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">
                        ST (Ngày áp dụng)
                      </span>
                      <span className="font-mono text-slate-900">
                        {st?.has_st
                          ? `Hoàn thành (${formatStDateVN(st.st_date)})`
                          : 'Đang chờ'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ST_PRODUCTION_STAGES.map((stage) => {
                      const done = Boolean(st?.[stage.boolField]);
                      const dateVal = st?.[stage.dateField];
                      return (
                        <div
                          key={stage.key}
                          className={`rounded-lg border px-2.5 py-2 ${
                            done
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="font-mono font-bold text-[11px] text-slate-800">
                            {stage.fullLabel}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {done ? formatStDateVN(dateVal) : 'Chưa xong'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {st?.notes && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-700">
                      <span className="font-semibold">Ghi chú: </span>
                      {st.notes}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target = detailModalItem;
                    setDetailModalItem(null);
                    handleOpenProgressModal(target);
                  }}
                  className="h-8 px-3.5 rounded-lg border border-[#14539E]/30 bg-blue-50 text-[#14539E] hover:bg-blue-100/70 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Cập nhật tiến độ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModalItem(null)}
                  className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Fullscreen Image Zoom Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.title}
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-900 truncate">
                {previewImage.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                aria-label="Đóng xem ảnh"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-900/5 flex items-center justify-center flex-1 min-h-0 overflow-auto">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                referrerPolicy="no-referrer"
                className="max-h-[80vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
      {/* MODAL C: Nhập tiến độ từ file Excel/CSV */}
      <StNewProductProgressImportModal
        isOpen={isProgressImportOpen}
        productsWithStatus={productsWithStatus}
        onClose={() => setIsProgressImportOpen(false)}
        onImported={onRefresh}
        onShowToast={onShowToast}
      />

      {/* MODAL D: Thêm mã hàng mới (2-trong-1: st_products + st_new_product_status) */}
      <StNewProductQuickCreateModal
        isOpen={isQuickCreateOpen}
        lines={lines}
        customers={customers}
        existingProductCodes={existingProductCodes}
        onClose={() => setIsQuickCreateOpen(false)}
        onCreated={(product, status) => {
          onProductAndStatusCreated?.(product, status);
        }}
        onRefresh={onRefresh}
        onOpenImport={() => setIsProgressImportOpen(true)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
