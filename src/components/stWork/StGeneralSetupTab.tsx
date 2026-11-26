import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Check,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  applyRealtimeStRow,
  formatNumberVN,
  normalizeStCustomerRow,
  normalizeStLineRow,
  StCustomer,
  StLine,
  StSetupSubTab,
} from '../../utils/stWorkLogic';
import {
  createStCustomer,
  createStLine,
  deleteStCustomer,
  deleteStLine,
  fetchStCustomers,
  fetchStLines,
  subscribeToStWorkRealtime,
  updateStCustomer,
  updateStLine,
} from '../../services/stWorkService';

export interface StGeneralSetupTabProps {
  forcedMode?: StSetupSubTab;
  lines?: StLine[];
  customers?: StCustomer[];
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

export const StGeneralSetupTab: React.FC<StGeneralSetupTabProps> = ({
  forcedMode,
  lines: externalLines,
  customers: externalCustomers,
  isLoading: externalLoading,
  onRefresh: externalRefresh,
  onShowToast,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<StSetupSubTab>(
    forcedMode || 'lines'
  );
  const setupSubTab = forcedMode || internalSubTab;

  const isControlled =
    externalLines !== undefined && externalCustomers !== undefined;

  const [internalLines, setInternalLines] = useState<StLine[]>([]);
  const [internalCustomers, setInternalCustomers] = useState<StCustomer[]>([]);
  const [internalLoading, setInternalLoading] = useState<boolean>(!isControlled);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const lines = isControlled ? externalLines! : internalLines;
  const customers = isControlled ? externalCustomers! : internalCustomers;
  const isLoading = isControlled ? Boolean(externalLoading) : internalLoading;

  const notify = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      if (onShowToast) {
        onShowToast(message);
      } else {
        setFeedback({ type, message });
      }
    },
    [onShowToast]
  );

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const loadStandaloneData = useCallback(async () => {
    if (isControlled) return;
    try {
      const [fetchedLines, fetchedCustomers] = await Promise.all([
        fetchStLines(),
        fetchStCustomers(),
      ]);
      setInternalLines(fetchedLines);
      setInternalCustomers(fetchedCustomers);
    } catch (err) {
      notify(getFriendlyErrorMessage(err), 'error');
    } finally {
      setInternalLoading(false);
    }
  }, [isControlled, notify]);

  useEffect(() => {
    if (isControlled) return;
    void loadStandaloneData();

    const unsubscribe = subscribeToStWorkRealtime((table, event) => {
      if (table === 'st_lines') {
        setInternalLines((prev) =>
          applyRealtimeStRow(
            prev,
            event,
            normalizeStLineRow,
            (a, b) => a.sort_order - b.sort_order
          )
        );
      } else if (table === 'st_customers') {
        setInternalCustomers((prev) =>
          applyRealtimeStRow(
            prev,
            event,
            normalizeStCustomerRow,
            (a, b) => a.short_name.localeCompare(b.short_name)
          )
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isControlled, loadStandaloneData]);

  const refreshData = async () => {
    if (externalRefresh) {
      await externalRefresh();
    } else {
      await loadStandaloneData();
    }
  };

  // ==========================================
  // Line state (`st_lines`)
  // ==========================================
  const [newLineName, setNewLineName] = useState<string>('');
  const [newLineDesc, setNewLineDesc] = useState<string>('');
  const [isAddingLine, setIsAddingLine] = useState<boolean>(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editLineName, setEditLineName] = useState<string>('');
  const [editLineDesc, setEditLineDesc] = useState<string>('');
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [confirmDeleteLineId, setConfirmDeleteLineId] = useState<string | null>(
    null
  );

  // ==========================================
  // Khách hàng state (`st_customers`)
  // ==========================================
  const [newCustShort, setNewCustShort] = useState<string>('');
  const [newCustFull, setNewCustFull] = useState<string>('');
  const [newCustNotes, setNewCustNotes] = useState<string>('');
  const [isAddingCust, setIsAddingCust] = useState<boolean>(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [editCustShort, setEditCustShort] = useState<string>('');
  const [editCustFull, setEditCustFull] = useState<string>('');
  const [editCustNotes, setEditCustNotes] = useState<string>('');
  const [savingCustId, setSavingCustId] = useState<string | null>(null);
  const [confirmDeleteCustId, setConfirmDeleteCustId] = useState<string | null>(
    null
  );

  // Line handlers
  const handleAddLine = async () => {
    if (!newLineName.trim()) {
      notify('Vui lòng nhập tên Line.', 'error');
      return;
    }
    setIsAddingLine(true);
    try {
      const nextSort =
        lines.reduce((max, l) => Math.max(max, l.sort_order || 0), 0) + 1;
      await createStLine({
        name: newLineName.trim(),
        description: newLineDesc.trim() || null,
        sort_order: nextSort,
      });
      await refreshData();
      setNewLineName('');
      setNewLineDesc('');
      notify('Đã thêm Line sản xuất mới.');
    } catch (err) {
      notify(getFriendlyErrorMessage(err), 'error');
    } finally {
      setIsAddingLine(false);
    }
  };

  const handleSaveLine = async (id: string) => {
    setSavingLineId(id);
    try {
      await updateStLine(id, {
        name: editLineName,
        description: editLineDesc || null,
      });
      await refreshData();
      setEditingLineId(null);
      notify('Đã cập nhật thông tin Line.');
    } catch (err) {
      notify(getFriendlyErrorMessage(err), 'error');
    } finally {
      setSavingLineId(null);
    }
  };

  const handleDeleteLine = async (id: string) => {
    setSavingLineId(id);
    try {
      await deleteStLine(id);
      await refreshData();
      setConfirmDeleteLineId(null);
      notify('Đã xóa Line.');
    } catch (err) {
      notify(getFriendlyErrorMessage(err), 'error');
    } finally {
      setSavingLineId(null);
    }
  };

  // Customer handlers
  const handleAddCustomer = async () => {
    if (!newCustShort.trim()) {
      notify('Vui lòng nhập Tên viết tắt của khách hàng.', 'error');
      return;
    }
    setIsAddingCust(true);
    try {
      await createStCustomer({
        short_name: newCustShort.trim(),
        full_name: newCustFull.trim() || newCustShort.trim(),
        notes: newCustNotes.trim() || null,
      });
      await refreshData();
      setNewCustShort('');
      setNewCustFull('');
      setNewCustNotes('');
      notify('Đã thêm khách hàng mới.');
    } catch (err) {
      notify(getFriendlyErrorMessage(err), 'error');
    } finally {
      setIsAddingCust(false);
    }
  };

  const handleSaveCustomer = async (id: string) => {
    setSavingCustId(id);
    try {
      await updateStCustomer(id, {
        short_name: editCustShort,
        full_name: editCustFull,
        notes: editCustNotes || null,
      });
      await refreshData();
      setEditingCustId(null);
      notify('Đã cập nhật thông tin khách hàng.');
    } catch (err) {
      notify(getFriendlyErrorMessage(err), 'error');
    } finally {
      setSavingCustId(null);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    setSavingCustId(id);
    try {
      await deleteStCustomer(id);
      await refreshData();
      setConfirmDeleteCustId(null);
      notify('Đã xóa khách hàng.');
    } catch (err) {
      notify(getFriendlyErrorMessage(err), 'error');
    } finally {
      setSavingCustId(null);
    }
  };

  const subBtnBase =
    'h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header or Inner Sub-tabs */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {forcedMode ? (
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-[#14539E] flex items-center justify-center shrink-0">
              {forcedMode === 'lines' ? (
                <Layers className="w-4 h-4" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {forcedMode === 'lines'
                  ? `Quản lý Line sản xuất ST (${formatNumberVN(lines.length)})`
                  : `Quản lý Khách hàng ST (${formatNumberVN(customers.length)})`}
              </h3>
              <p className="text-[11px] text-slate-500">
                {forcedMode === 'lines'
                  ? 'Dữ liệu đồng bộ trực tiếp với bảng st_lines và dropdown chọn Line tại Danh mục Mã hàng'
                  : 'Dữ liệu đồng bộ trực tiếp với bảng st_customers và dropdown chọn Khách hàng tại Danh mục Mã hàng'}
              </p>
            </div>
          </div>
        ) : (
          <div className="inline-flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setInternalSubTab('lines')}
              className={`${subBtnBase} ${
                setupSubTab === 'lines'
                  ? 'bg-[#14539E] text-white border-[#14539E]'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-[#14539E] hover:text-[#14539E]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Line sản xuất</span>
              <span className="font-mono text-[11px] opacity-80 tabular-nums">
                ({formatNumberVN(lines.length)})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setInternalSubTab('customers')}
              className={`${subBtnBase} ${
                setupSubTab === 'customers'
                  ? 'bg-[#14539E] text-white border-[#14539E]'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-[#14539E] hover:text-[#14539E]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Khách hàng</span>
              <span className="font-mono text-[11px] opacity-80 tabular-nums">
                ({formatNumberVN(customers.length)})
              </span>
            </button>
          </div>
        )}

        {feedback && (
          <div
            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
              feedback.type === 'error'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {feedback.message}
          </div>
        )}
      </div>

      {/* SECTION 1: LINE SẢN XUẤT (`st_lines`) */}
      {setupSubTab === 'lines' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="text"
                value={newLineName}
                onChange={(e) => setNewLineName(e.target.value)}
                placeholder="Tên Line mới (VD: S Line, U1 Line)..."
                aria-label="Tên Line mới"
                className="flex-1 min-w-[180px] h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <input
                type="text"
                value={newLineDesc}
                onChange={(e) => setNewLineDesc(e.target.value)}
                placeholder="Mô tả / Ghi chú (nếu có)..."
                aria-label="Mô tả Line mới"
                className="flex-1 min-w-[180px] h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <button
                type="button"
                disabled={isAddingLine}
                onClick={() => void handleAddLine()}
                className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isAddingLine ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Thêm Line</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {isLoading && lines.length === 0 ? (
              <div className="p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
                <span>Đang tải danh sách Line...</span>
              </div>
            ) : lines.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Chưa có Line sản xuất nào. Hãy thêm Line mới ở thanh phía trên.
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-2 py-2 w-12 text-center border-r border-slate-200/70">
                      STT
                    </th>
                    <th className="px-3 py-2 w-56 border-r border-slate-200/70">
                      Tên Line
                    </th>
                    <th className="px-3 py-2 border-r border-slate-200/70">
                      Mô tả
                    </th>
                    <th className="px-3 py-2 w-28 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {lines.map((line, idx) => {
                    const isEditing = editingLineId === line.id;
                    const isBusy = savingLineId === line.id;
                    return (
                      <tr key={line.id} className="hover:bg-blue-50/30">
                        <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                          {formatNumberVN(idx + 1)}
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-100 font-semibold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editLineName}
                              onChange={(e) => setEditLineName(e.target.value)}
                              aria-label="Sửa tên Line"
                              className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                            />
                          ) : (
                            line.name
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-100 text-slate-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editLineDesc}
                              onChange={(e) => setEditLineDesc(e.target.value)}
                              aria-label="Sửa mô tả Line"
                              className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                            />
                          ) : (
                            line.description || '—'
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleSaveLine(line.id)}
                                  aria-label={`Lưu Line ${line.name}`}
                                  className="w-7 h-7 rounded-md bg-emerald-600 text-white inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingLineId(null)}
                                  aria-label="Hủy sửa Line"
                                  className="w-7 h-7 rounded-md border border-slate-300 text-slate-600 inline-flex items-center justify-center cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : confirmDeleteLineId === line.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleDeleteLine(line.id)}
                                  className="h-7 px-2 rounded-md bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteLineId(null)}
                                  className="h-7 px-2 rounded-md border border-slate-300 text-slate-600 text-[11px] cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLineId(line.id);
                                    setEditLineName(line.name);
                                    setEditLineDesc(line.description || '');
                                    setConfirmDeleteLineId(null);
                                  }}
                                  aria-label={`Sửa Line ${line.name}`}
                                  className="w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:border-[#14539E] hover:text-[#14539E] inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteLineId(line.id)}
                                  aria-label={`Xóa Line ${line.name}`}
                                  className="w-7 h-7 rounded-md border border-red-200 text-red-500 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
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
      )}

      {/* SECTION 2: KHÁCH HÀNG (`st_customers`) */}
      {setupSubTab === 'customers' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="text"
                value={newCustShort}
                onChange={(e) => setNewCustShort(e.target.value)}
                placeholder="Tên viết tắt * (VD: SAMSUNG, LG)"
                aria-label="Tên viết tắt khách hàng"
                className="w-full lg:w-52 h-8 px-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <input
                type="text"
                value={newCustFull}
                onChange={(e) => setNewCustFull(e.target.value)}
                placeholder="Tên chi tiết đầy đủ..."
                aria-label="Tên chi tiết khách hàng"
                className="flex-1 min-w-[200px] h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <input
                type="text"
                value={newCustNotes}
                onChange={(e) => setNewCustNotes(e.target.value)}
                placeholder="Ghi chú..."
                aria-label="Ghi chú khách hàng"
                className="flex-1 min-w-[160px] h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <button
                type="button"
                disabled={isAddingCust}
                onClick={() => void handleAddCustomer()}
                className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isAddingCust ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Thêm KH</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {isLoading && customers.length === 0 ? (
              <div className="p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
                <span>Đang tải danh sách khách hàng...</span>
              </div>
            ) : customers.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Chưa có khách hàng nào. Hãy thêm khách hàng mới (VD: SAMSUNG, LG) ở thanh phía trên.
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-2 py-2 w-12 text-center border-r border-slate-200/70">
                      STT
                    </th>
                    <th className="px-3 py-2 w-44 border-r border-slate-200/70">
                      Tên viết tắt
                    </th>
                    <th className="px-3 py-2 w-[38%] border-r border-slate-200/70">
                      Tên chi tiết đầy đủ
                    </th>
                    <th className="px-3 py-2 border-r border-slate-200/70">
                      Ghi chú
                    </th>
                    <th className="px-3 py-2 w-28 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {customers.map((cust, idx) => {
                    const isEditing = editingCustId === cust.id;
                    const isBusy = savingCustId === cust.id;
                    return (
                      <tr key={cust.id} className="hover:bg-blue-50/30">
                        <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                          {formatNumberVN(idx + 1)}
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-100 font-bold text-[#14539E]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editCustShort}
                              onChange={(e) => setEditCustShort(e.target.value)}
                              aria-label="Sửa tên viết tắt khách hàng"
                              className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                            />
                          ) : (
                            cust.short_name
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-100 text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editCustFull}
                              onChange={(e) => setEditCustFull(e.target.value)}
                              aria-label="Sửa tên đầy đủ khách hàng"
                              className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                            />
                          ) : (
                            cust.full_name || '—'
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-100 text-slate-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editCustNotes}
                              onChange={(e) => setEditCustNotes(e.target.value)}
                              aria-label="Sửa ghi chú khách hàng"
                              className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                            />
                          ) : (
                            cust.notes || '—'
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleSaveCustomer(cust.id)}
                                  aria-label={`Lưu khách hàng ${cust.short_name}`}
                                  className="w-7 h-7 rounded-md bg-emerald-600 text-white inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCustId(null)}
                                  aria-label="Hủy sửa khách hàng"
                                  className="w-7 h-7 rounded-md border border-slate-300 text-slate-600 inline-flex items-center justify-center cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : confirmDeleteCustId === cust.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleDeleteCustomer(cust.id)
                                  }
                                  className="h-7 px-2 rounded-md bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCustId(null)}
                                  className="h-7 px-2 rounded-md border border-slate-300 text-slate-600 text-[11px] cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCustId(cust.id);
                                    setEditCustShort(cust.short_name);
                                    setEditCustFull(cust.full_name);
                                    setEditCustNotes(cust.notes || '');
                                    setConfirmDeleteCustId(null);
                                  }}
                                  aria-label={`Sửa khách hàng ${cust.short_name}`}
                                  className="w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:border-[#14539E] hover:text-[#14539E] inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCustId(cust.id)}
                                  aria-label={`Xóa khách hàng ${cust.short_name}`}
                                  className="w-7 h-7 rounded-md border border-red-200 text-red-500 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
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
      )}
    </div>
  );
};
