import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  PackageOpen,
  Save,
  Search,
  X,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  calculateCompletionDays,
  formatNumberVN,
  formatStDateVN,
  getLocalIsoDateToday,
  StCustomer,
  StLine,
  StNewProductStatus,
  StProductWithStatus,
  StWorkSubTab,
} from '../../utils/stWorkLogic';
import { upsertStNewProductStatus } from '../../utils/stWorkSupabase';

export interface StNewProductsTabProps {
  lines: StLine[];
  customers: StCustomer[];
  productsWithStatus: StProductWithStatus[];
  isLoading: boolean;
  onStatusUpdated: (saved: StNewProductStatus) => void;
  onShowToast?: (message: string) => void;
  onNavigateTab: (tab: StWorkSubTab) => void;
}

interface ProductStatusDraft {
  has_process: boolean;
  process_created_at: string;
  has_unit_price: boolean;
  unit_price: string;
  price_created_at: string;
  price_applied_at: string;
  notes: string;
}

type StatusFilterMode = 'all' | 'completed' | 'in_progress';

function toDraft(status: StNewProductStatus | null): ProductStatusDraft {
  return {
    has_process: Boolean(status?.has_process),
    process_created_at: status?.process_created_at || '',
    has_unit_price: Boolean(status?.has_unit_price),
    unit_price:
      status?.unit_price !== null && status?.unit_price !== undefined
        ? String(status.unit_price)
        : '',
    price_created_at: status?.price_created_at || '',
    price_applied_at: status?.price_applied_at || '',
    notes: status?.notes || '',
  };
}

export const StNewProductsTab: React.FC<StNewProductsTabProps> = ({
  lines,
  customers,
  productsWithStatus,
  isLoading,
  onStatusUpdated,
  onShowToast,
  onNavigateTab,
}) => {
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [drafts, setDrafts] = useState<Record<string, ProductStatusDraft>>({});
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});

  // Sync incoming Supabase/Realtime updates for rows not currently being edited
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, ProductStatusDraft> = {};
      for (const item of productsWithStatus) {
        const pid = item.product.id;
        if (dirtyMap[pid] && prev[pid]) {
          next[pid] = prev[pid];
        } else {
          next[pid] = toDraft(item.status);
        }
      }
      return next;
    });
  }, [productsWithStatus, dirtyMap]);

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
          item.product.customer_short_name.toLowerCase().includes(q);
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

  const summaryCounts = useMemo(() => {
    const total = productsWithStatus.length;
    const completed = productsWithStatus.filter((i) => i.isCompleted).length;
    const inProgress = total - completed;
    return { total, completed, inProgress };
  }, [productsWithStatus]);

  const persistDraft = async (
    item: StProductWithStatus,
    overrideDraft?: ProductStatusDraft,
    toastLabel?: string
  ) => {
    const pid = item.product.id;
    const draft = overrideDraft || drafts[pid] || toDraft(item.status);

    const trimmedPrice = draft.unit_price.trim();
    const parsedPrice = trimmedPrice === '' ? null : Number(trimmedPrice);
    if (trimmedPrice !== '' && Number.isNaN(parsedPrice)) {
      onShowToast?.('Đơn giá phải là số hợp lệ.');
      return;
    }

    setSavingMap((prev) => ({ ...prev, [pid]: true }));
    try {
      const saved = await upsertStNewProductStatus({
        id: item.status?.id || null,
        product_id: pid,
        has_process: draft.has_process,
        process_created_at: draft.process_created_at || null,
        has_unit_price: draft.has_unit_price,
        unit_price: parsedPrice,
        currency: item.status?.currency || 'VND',
        price_created_at: draft.price_created_at || null,
        price_applied_at: draft.price_applied_at || null,
        notes: draft.notes.trim() || null,
      });
      setDirtyMap((prev) => {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      });
      setDrafts((prev) => ({ ...prev, [pid]: toDraft(saved) }));
      onStatusUpdated(saved);
      if (toastLabel) {
        onShowToast?.(toastLabel);
      }
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingMap((prev) => {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      });
    }
  };

  const handleToggleProcess = (item: StProductWithStatus, checked: boolean) => {
    const pid = item.product.id;
    const current = drafts[pid] || toDraft(item.status);
    const updated: ProductStatusDraft = {
      ...current,
      has_process: checked,
      process_created_at: checked
        ? current.process_created_at || getLocalIsoDateToday()
        : '',
    };
    setDrafts((prev) => ({ ...prev, [pid]: updated }));
    void persistDraft(
      item,
      updated,
      `Đã cập nhật quy trình mã hàng "${item.product.product_code}".`
    );
  };

  const handleToggleUnitPrice = (
    item: StProductWithStatus,
    checked: boolean
  ) => {
    const pid = item.product.id;
    const current = drafts[pid] || toDraft(item.status);
    const updated: ProductStatusDraft = {
      ...current,
      has_unit_price: checked,
      price_created_at: checked
        ? current.price_created_at || getLocalIsoDateToday()
        : '',
      unit_price: checked ? current.unit_price : '',
      price_applied_at: checked ? current.price_applied_at : '',
    };
    setDrafts((prev) => ({ ...prev, [pid]: updated }));
    void persistDraft(
      item,
      updated,
      `Đã cập nhật trạng thái đơn giá mã "${item.product.product_code}".`
    );
  };

  const handleDateChange = (
    item: StProductWithStatus,
    field: 'process_created_at' | 'price_created_at' | 'price_applied_at',
    value: string
  ) => {
    const pid = item.product.id;
    const current = drafts[pid] || toDraft(item.status);
    const updated: ProductStatusDraft = {
      ...current,
      [field]: value,
      ...(field === 'process_created_at' && value ? { has_process: true } : {}),
      ...((field === 'price_created_at' || field === 'price_applied_at') &&
      value
        ? { has_unit_price: true }
        : {}),
    };
    setDrafts((prev) => ({ ...prev, [pid]: updated }));
    void persistDraft(item, updated);
  };

  const handleTextDraftChange = (
    item: StProductWithStatus,
    field: 'unit_price' | 'notes',
    value: string
  ) => {
    const pid = item.product.id;
    const current = drafts[pid] || toDraft(item.status);
    const updated: ProductStatusDraft = {
      ...current,
      [field]: value,
      ...(field === 'unit_price' && value.trim() !== ''
        ? { has_unit_price: true }
        : {}),
    };
    setDrafts((prev) => ({ ...prev, [pid]: updated }));
    setDirtyMap((prev) => ({ ...prev, [pid]: true }));
  };

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

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Filter & KPI Strip */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
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
              Hoàn thành SX đại trà ({formatNumberVN(summaryCounts.completed)})
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
              Đang dở dang ({formatNumberVN(summaryCounts.inProgress)})
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã hàng, tên hàng, quy cách..."
            aria-label="Tìm kiếm mã hàng mới"
            className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main High-Density Inline Editable Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && productsWithStatus.length === 0 ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
            <span>Đang tải danh sách mã hàng mới...</span>
          </div>
        ) : productsWithStatus.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <PackageOpen className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600">
              Chưa có mã hàng nào được đăng ký. Thêm sản phẩm ở{' '}
              <button
                type="button"
                onClick={() => onNavigateTab('general_setup')}
                className="font-semibold text-[#14539E] hover:underline cursor-pointer"
              >
                Thiết lập chung → Danh mục sản phẩm
              </button>{' '}
              để tự động khởi tạo dòng theo dõi tại đây.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Không có mã hàng nào khớp bộ lọc hiện tại.
          </div>
        ) : (
          <table className="w-full min-w-[1060px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-1.5 py-2 w-9 text-center border-r border-slate-200/70">
                  STT
                </th>
                <th className="px-2 py-2 w-16 border-r border-slate-200/70">
                  Line
                </th>
                <th className="px-2 py-2 w-20 border-r border-slate-200/70">
                  Khách hàng
                </th>
                <th className="px-2 py-2 w-24 border-r border-slate-200/70">
                  Mã hàng
                </th>
                <th className="px-2 py-2 w-28 border-r border-slate-200/70">
                  Tên hàng
                </th>
                <th className="px-2 py-2 w-20 border-r border-slate-200/70">
                  Quy cách
                </th>
                <th className="px-2 py-2 w-36 border-r border-slate-200/70">
                  Quy trình
                </th>
                <th className="px-2 py-2 w-32 border-r border-slate-200/70">
                  Đơn giá
                </th>
                <th className="px-1.5 py-2 w-28 border-r border-slate-200/70">
                  Ngày tạo đơn giá
                </th>
                <th className="px-1.5 py-2 w-28 border-r border-slate-200/70">
                  Ngày áp dụng đơn giá
                </th>
                <th className="px-1.5 py-2 w-24 text-center border-r border-slate-200/70">
                  Số ngày hoàn thành
                </th>
                <th className="px-2 py-2 min-w-[130px]">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredItems.map((item, idx) => {
                const pid = item.product.id;
                const draft = drafts[pid] || toDraft(item.status);
                const isDirty = Boolean(dirtyMap[pid]);
                const isSaving = Boolean(savingMap[pid]);
                const liveCompleted = Boolean(
                  draft.has_process && draft.price_applied_at
                );
                const liveDays = liveCompleted
                  ? calculateCompletionDays(
                      item.product.created_at,
                      draft.price_applied_at
                    )
                  : null;

                return (
                  <tr
                    key={pid}
                    className={`transition-colors ${
                      liveCompleted
                        ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                        : 'hover:bg-blue-50/30'
                    }`}
                  >
                    <td className="px-2 py-1.5 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                      {formatNumberVN(idx + 1)}
                    </td>

                    <td className="px-2 py-1.5 border-r border-slate-100 font-semibold text-slate-700 whitespace-nowrap">
                      {item.product.line_name}
                    </td>

                    <td className="px-2 py-1.5 border-r border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                      {item.product.customer_short_name}
                    </td>

                    <td className="px-2 py-1.5 border-r border-slate-100">
                      <div className="font-mono font-semibold text-[#14539E]">
                        {item.product.product_code}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                        ĐK: {formatStDateVN(item.product.created_at)}
                      </div>
                    </td>

                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-900 font-medium">
                      {item.product.product_name}
                    </td>

                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-600">
                      {item.product.specification || '—'}
                    </td>

                    {/* Quy trình: Checkbox + Ngày tạo quy trình */}
                    <td className="px-2 py-1.5 border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={draft.has_process}
                          onChange={(e) =>
                            handleToggleProcess(item, e.target.checked)
                          }
                          aria-label={`Có quy trình cho ${item.product.product_code}`}
                          title="Tích nếu đã có quy trình"
                          className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                        />
                        <input
                          type="date"
                          value={draft.process_created_at}
                          onChange={(e) =>
                            handleDateChange(
                              item,
                              'process_created_at',
                              e.target.value
                            )
                          }
                          aria-label={`Ngày tạo quy trình ${item.product.product_code}`}
                          className="flex-1 min-w-0 h-7 px-1.5 text-[11px] font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#14539E]"
                        />
                      </div>
                    </td>

                    {/* Đơn giá: Checkbox + Numeric Unit Price */}
                    <td className="px-2 py-1.5 border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={draft.has_unit_price}
                          onChange={(e) =>
                            handleToggleUnitPrice(item, e.target.checked)
                          }
                          aria-label={`Có đơn giá cho ${item.product.product_code}`}
                          title="Tích nếu đã có đơn giá"
                          className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                        />
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={draft.unit_price}
                          onChange={(e) =>
                            handleTextDraftChange(
                              item,
                              'unit_price',
                              e.target.value
                            )
                          }
                          onBlur={() => {
                            if (isDirty) void persistDraft(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          placeholder="Đơn giá..."
                          aria-label={`Đơn giá ${item.product.product_code}`}
                          className="flex-1 min-w-0 h-7 px-1.5 text-xs font-mono text-right bg-white border border-slate-300 rounded focus:outline-none focus:border-[#14539E]"
                        />
                      </div>
                    </td>

                    {/* Ngày tạo đơn giá */}
                    <td className="px-2 py-1.5 border-r border-slate-100">
                      <input
                        type="date"
                        value={draft.price_created_at}
                        onChange={(e) =>
                          handleDateChange(
                            item,
                            'price_created_at',
                            e.target.value
                          )
                        }
                        aria-label={`Ngày tạo đơn giá ${item.product.product_code}`}
                        className="w-full h-7 px-1.5 text-[11px] font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#14539E]"
                      />
                    </td>

                    {/* Ngày áp dụng đơn giá */}
                    <td className="px-2 py-1.5 border-r border-slate-100">
                      <input
                        type="date"
                        value={draft.price_applied_at}
                        onChange={(e) =>
                          handleDateChange(
                            item,
                            'price_applied_at',
                            e.target.value
                          )
                        }
                        aria-label={`Ngày áp dụng đơn giá ${item.product.product_code}`}
                        className="w-full h-7 px-1.5 text-[11px] font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#14539E]"
                      />
                    </td>

                    {/* Số ngày hoàn thành + Trạng thái */}
                    <td className="px-2 py-1.5 border-r border-slate-100 text-center">
                      {liveCompleted ? (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="font-mono font-bold text-emerald-700 tabular-nums">
                            {liveDays !== null ? `${formatNumberVN(liveDays)} ngày` : '0 ngày'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold whitespace-nowrap">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            SX đại trà
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold whitespace-nowrap">
                          <Clock className="w-2.5 h-2.5" />
                          {draft.has_process ? 'Chờ đơn giá' : 'Đang dở dang'}
                        </span>
                      )}
                    </td>

                    {/* Ghi chú + Save action */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={draft.notes}
                          onChange={(e) =>
                            handleTextDraftChange(item, 'notes', e.target.value)
                          }
                          onBlur={() => {
                            if (isDirty) void persistDraft(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void persistDraft(
                                item,
                                undefined,
                                `Đã lưu ghi chú mã "${item.product.product_code}".`
                              );
                            }
                          }}
                          placeholder="Ghi chú..."
                          aria-label={`Ghi chú ${item.product.product_code}`}
                          className="flex-1 min-w-0 h-7 px-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#14539E]"
                        />
                        {isSaving ? (
                          <span
                            title="Đang lưu..."
                            className="w-7 h-7 rounded-md bg-blue-50 text-[#14539E] inline-flex items-center justify-center shrink-0"
                          >
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          </span>
                        ) : isDirty ? (
                          <button
                            type="button"
                            onClick={() =>
                              void persistDraft(
                                item,
                                undefined,
                                `Đã lưu cập nhật mã "${item.product.product_code}".`
                              )
                            }
                            aria-label={`Lưu trạng thái ${item.product.product_code}`}
                            title="Lưu thay đổi"
                            className="w-7 h-7 rounded-md bg-[#14539E] hover:bg-[#0F3E77] text-white inline-flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span
                            title="Đã đồng bộ"
                            className="w-7 h-7 rounded-md text-slate-300 inline-flex items-center justify-center shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
