import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  PackageOpen,
  Pencil,
  Search,
  X,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  calculateCompletionDays,
  computeStagesProgress,
  formatNumberVN,
  formatStDateVN,
  getLocalIsoDateToday,
  getPendingWorkflowStep,
  isNewProductCompleted,
  ST_PRODUCTION_STAGES,
  StCustomer,
  StLine,
  StNewProductStatus,
  StProductWithStatus,
  StStageBoolField,
  StStageDateField,
  StWorkflowBoolField,
  StWorkflowDateField,
} from '../../utils/stWorkLogic';
import { upsertStNewProductStatus } from '../../services/stWorkService';

export interface StNewProductsTabProps {
  lines: StLine[];
  customers: StCustomer[];
  productsWithStatus: StProductWithStatus[];
  isLoading: boolean;
  onStatusUpdated: (saved: StNewProductStatus) => void;
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
  onRefresh,
  onNavigateToCatalog,
  onShowToast,
}) => {
  // Filter & Search state (left-to-right: Search -> Line -> Customer -> Status)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>('all');

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

  const summaryCounts = useMemo(() => {
    const total = productsWithStatus.length;
    const completed = productsWithStatus.filter((i) => i.isCompleted).length;
    const inProgress = total - completed;
    return { total, completed, inProgress };
  }, [productsWithStatus]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return productsWithStatus.filter((item) => {
      if (lineFilter !== 'ALL' && item.product.line_name !== lineFilter) {
        return false;
      }
      if (
        customerFilter !== 'ALL' &&
        item.product.customer_short_name !== customerFilter
      ) {
        return false;
      }
      if (statusFilter === 'completed' && !item.isCompleted) return false;
      if (statusFilter === 'in_progress' && item.isCompleted) return false;

      if (q) {
        const hit =
          item.product.product_code.toLowerCase().includes(q) ||
          item.product.product_name.toLowerCase().includes(q) ||
          item.product.specification.toLowerCase().includes(q) ||
          item.product.customer_short_name.toLowerCase().includes(q) ||
          item.product.line_name.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    productsWithStatus,
    lineFilter,
    customerFilter,
    statusFilter,
    searchQuery,
  ]);

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

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* 1. Filter Strip: Search -> Line -> Customer -> Status Pills */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative w-full sm:w-60 lg:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã hàng, tên hàng, quy cách..."
            aria-label="Tìm kiếm đơn giá mới"
            className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
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

        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          aria-label="Lọc theo Line"
          className="h-8 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
        >
          <option value="ALL">Tất cả Line</option>
          {lineNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          aria-label="Lọc theo Khách hàng"
          className="h-8 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
        >
          <option value="ALL">Tất cả Khách hàng</option>
          {customerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="inline-flex items-center gap-1 p-0.5 bg-white border border-slate-300 rounded-lg">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-[#14539E] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({formatNumberVN(summaryCounts.total)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hoàn thành ({formatNumberVN(summaryCounts.completed)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_progress')}
            className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'in_progress'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang làm ({formatNumberVN(summaryCounts.inProgress)})
          </button>
        </div>
      </div>

      {/* 2. Read-Only 10-Column Table (`st_new_product_status` joined with `st_products`) */}
      <div
        data-testid="st-new-products-table-wrapper"
        className="flex-1 min-h-0 overflow-auto"
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
              Chưa có sản phẩm nào để theo dõi. Vui lòng thêm sản phẩm ở tab{' '}
              <strong>Danh mục sản phẩm</strong>.
            </p>
            {onNavigateToCatalog && (
              <button
                type="button"
                onClick={onNavigateToCatalog}
                className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold cursor-pointer"
              >
                Mở Danh mục sản phẩm
              </button>
            )}
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
            <thead className="sticky top-0 z-10 bg-slate-100 text-[10.5px] font-bold text-slate-600 uppercase tracking-tight shadow-[0_1px_0_0_rgba(203,213,225,1)]">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-100 px-2.5 py-2.5 min-w-[96px] border-r border-b border-slate-200 whitespace-nowrap">
                  MÃ HÀNG
                </th>
                <th className="px-2 py-2.5 min-w-[90px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  QUY CÁCH
                </th>
                <th className="px-1.5 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  QUY TRÌNH ERP
                </th>
                <th className="px-1.5 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  NGÀY TẠO QT
                </th>
                <th className="px-2 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  CÔNG ĐOẠN
                </th>
                <th className="px-1.5 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  TỶ LỆ %
                </th>
                <th className="px-1.5 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  ST
                </th>
                <th className="px-1.5 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  NGÀY ÁP DỤNG
                </th>
                <th className="px-2 py-2.5 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  HIỆN TRẠNG
                </th>
                <th className="px-1.5 py-2.5 w-[64px] text-center border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredItems.map((item) => {
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
                    {/* 1. Mã hàng (từ st_products, link xanh đậm -> Full Product Detail Modal) */}
                    <td
                      className={`sticky left-0 z-[5] px-2.5 py-2.5 border-r border-slate-200/80 transition-colors ${stickyCellBg}`}
                    >
                      <button
                        type="button"
                        data-testid={`st-product-code-btn-${p.product_code}`}
                        onClick={() => setDetailModalItem(item)}
                        title="Bấm để xem chi tiết thông tin sản phẩm"
                        className="font-mono font-bold text-[#14539E] hover:underline cursor-pointer text-left whitespace-nowrap"
                      >
                        {p.product_code}
                      </button>
                    </td>

                    {/* 2. Quy cách (từ st_products) */}
                    <td className="px-2 py-2.5 border-r border-slate-100 text-slate-600">
                      {p.specification || '—'}
                    </td>

                    {/* 3. QUY TRÌNH ERP (Icon-only) */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-center align-middle">
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

                    {/* 4. NGÀY TẠO QT */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-center font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                      {formatStDateVN(st?.process_erp_date)}
                    </td>

                    {/* 5. Công đoạn (WIN -> CUT -> SOL -> ASS -> IMP -> SOL2 -> FIN) */}
                    <td className="px-1.5 py-2 border-r border-slate-100 align-middle">
                      <div className="flex items-center justify-center gap-0.5 flex-nowrap">
                        {ST_PRODUCTION_STAGES.map((stage, idx) => {
                          const done = Boolean(st?.[stage.boolField]);
                          const doneDate = st?.[stage.dateField] || null;
                          const isCurrentNext =
                            hasProcessErp &&
                            !done &&
                            nextPendingStageKey === stage.key;

                          const badgeClass = done
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : isCurrentNext
                            ? 'bg-amber-50 border-amber-400 text-amber-700'
                            : 'bg-slate-50 border-slate-200 text-slate-400';

                          const tooltipText = done
                            ? `${stage.fullLabel}: Hoàn thành${
                                doneDate ? ` (${formatStDateVN(doneDate)})` : ''
                              }`
                            : isCurrentNext
                            ? `${stage.fullLabel}: Đang thực hiện`
                            : `${stage.fullLabel}: Chưa thực hiện`;

                          return (
                            <React.Fragment key={stage.key}>
                              <span
                                title={tooltipText}
                                className={`inline-flex items-center justify-center px-1 py-0.5 rounded border font-mono text-[10px] font-semibold leading-none whitespace-nowrap select-none ${badgeClass}`}
                              >
                                {stage.code}
                              </span>
                              {idx < ST_PRODUCTION_STAGES.length - 1 && (
                                <span
                                  aria-hidden="true"
                                  className="text-[9px] text-slate-300 select-none leading-none"
                                >
                                  →
                                </span>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </td>

                    {/* 6. Tỷ lệ % */}
                    <td className="px-2 py-2 border-r border-slate-100 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-11 h-1.5 rounded-full bg-slate-200 overflow-hidden shrink-0">
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
                          className={`font-mono text-[11px] font-bold tabular-nums w-8 text-right ${
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

                    {/* 7. ST (Icon-only) */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-center align-middle">
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

                    {/* 8. Ngày áp dụng */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-center font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                      {formatStDateVN(st?.st_date)}
                    </td>

                    {/* 9. Hiện trạng (Auto Badge: Hoàn thành / Đang làm) */}
                    <td className="px-2 py-2.5 border-r border-slate-100 text-center align-middle whitespace-nowrap">
                      {item.isCompleted ? (
                        <span
                          data-testid={`st-row-status-${p.product_code}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold whitespace-nowrap"
                        >
                          Hoàn thành
                        </span>
                      ) : (
                        <span
                          data-testid={`st-row-status-${p.product_code}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold whitespace-nowrap"
                        >
                          Đang làm
                        </span>
                      )}
                    </td>

                    {/* 10. Thao tác (Icon-only Cập nhật tiến độ, NO delete button) */}
                    <td className="px-1.5 py-2 text-center align-middle">
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

                {/* 2. Danh sách 7 công đoạn + Live Tỷ lệ % */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">
                      2. Danh sách 7 công đoạn ({doneStages}/7)
                    </span>
                    <div className="flex items-center gap-2">
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
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold uppercase tracking-wide text-slate-700">
                      Tiến độ thực hiện đơn giá mới
                    </h4>
                    <span className="font-mono font-bold text-[#14539E]">
                      {detailModalItem.stageProgress.percentage}% (
                      {detailModalItem.stageProgress.completedCount}/7 công đoạn)
                    </span>
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
    </div>
  );
};
