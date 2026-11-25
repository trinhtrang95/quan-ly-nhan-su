import React, { useMemo, useState } from 'react';
import {
  Check,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import {
  ATTENDANCE_SYMBOL_CATEGORY_META,
  ATTENDANCE_SYMBOL_COLORS,
  ATTENDANCE_SYMBOL_COLOR_PALETTE,
  AttendanceSymbol,
  AttendanceSymbolCategory,
  AttendanceSymbolColor,
  getSymbolBadgeClasses,
  normalizeSymbolCode,
  validateAttendanceSymbolInput,
} from '../../utils/attendanceSymbolsLogic';

export interface AttendanceSymbolsTabProps {
  symbols: AttendanceSymbol[];
  isLoading: boolean;
  isSaving: boolean;
  onSaveSymbol: (
    input: Omit<AttendanceSymbol, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      originalCode?: string;
    }
  ) => Promise<void>;
  onDeleteSymbol: (symbolId: string) => Promise<void>;
}

interface NewSymbolFormState {
  code: string;
  name: string;
  category: AttendanceSymbolCategory;
  workdayValue: string;
  salaryPercent: string;
  color: AttendanceSymbolColor;
  note: string;
}

const INITIAL_NEW_SYMBOL: NewSymbolFormState = {
  code: '',
  name: '',
  category: 'leave',
  workdayValue: '1',
  salaryPercent: '100',
  color: 'purple',
  note: '',
};

const CATEGORY_FILTER_OPTIONS: Array<{
  id: 'ALL' | AttendanceSymbolCategory;
  label: string;
}> = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'work', label: 'Làm việc' },
  { id: 'leave', label: 'Nghỉ phép / Chế độ' },
  { id: 'overtime', label: 'Tăng ca' },
  { id: 'violation', label: 'Vi phạm chấm công' },
];

export const AttendanceSymbolsTab: React.FC<AttendanceSymbolsTabProps> = ({
  symbols,
  isLoading,
  isSaving,
  onSaveSymbol,
  onDeleteSymbol,
}) => {
  const [newForm, setNewForm] = useState<NewSymbolFormState>(INITIAL_NEW_SYMBOL);
  const [formError, setFormError] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<
    'ALL' | AttendanceSymbolCategory
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Draft edits keyed by symbol.id so high-density inline edits don't spam API per keystroke
  const [drafts, setDrafts] = useState<Record<string, AttendanceSymbol>>({});
  const [rowErrorById, setRowErrorById] = useState<Record<string, string>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  const filteredSymbols = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return symbols.filter((sym) => {
      if (categoryFilter !== 'ALL' && sym.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        sym.code.toLowerCase().includes(q) ||
        sym.name.toLowerCase().includes(q) ||
        (sym.note || '').toLowerCase().includes(q)
      );
    });
  }, [symbols, categoryFilter, searchQuery]);

  const leaveSymbolCount = useMemo(
    () => symbols.filter((s) => s.category === 'leave').length,
    [symbols]
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const workdayNum = Number(newForm.workdayValue);
    const salaryNum = Number(newForm.salaryPercent);

    const err = validateAttendanceSymbolInput(
      {
        code: newForm.code,
        name: newForm.name,
        workdayValue: workdayNum,
        salaryPercent: salaryNum,
      },
      symbols
    );
    if (err) {
      setFormError(err);
      return;
    }

    await onSaveSymbol({
      code: normalizeSymbolCode(newForm.code),
      name: newForm.name.trim(),
      category: newForm.category,
      workdayValue: Number(workdayNum.toFixed(2)),
      salaryPercent: Number(salaryNum.toFixed(0)),
      color: newForm.color,
      note: newForm.note.trim(),
      isSystem: false,
      systemKey: null,
      sortOrder: symbols.length + 1,
    });

    setNewForm(INITIAL_NEW_SYMBOL);
  };

  const getRowValue = (original: AttendanceSymbol): AttendanceSymbol => {
    return drafts[original.id] || original;
  };

  const isRowDirty = (original: AttendanceSymbol): boolean => {
    const d = drafts[original.id];
    if (!d) return false;
    return (
      normalizeSymbolCode(d.code) !== normalizeSymbolCode(original.code) ||
      d.name !== original.name ||
      d.category !== original.category ||
      Number(d.workdayValue) !== Number(original.workdayValue) ||
      Number(d.salaryPercent) !== Number(original.salaryPercent) ||
      d.color !== original.color ||
      (d.note || '') !== (original.note || '')
    );
  };

  const updateRowDraft = (
    original: AttendanceSymbol,
    patch: Partial<AttendanceSymbol>
  ) => {
    setRowErrorById((prev) => {
      if (!prev[original.id]) return prev;
      const next = { ...prev };
      delete next[original.id];
      return next;
    });

    setDrafts((prev) => ({
      ...prev,
      [original.id]: {
        ...(prev[original.id] || original),
        ...patch,
      },
    }));
  };

  const handleResetRowDraft = (symbolId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[symbolId];
      return next;
    });
    setRowErrorById((prev) => {
      const next = { ...prev };
      delete next[symbolId];
      return next;
    });
  };

  const handleSaveRow = async (original: AttendanceSymbol) => {
    const row = getRowValue(original);
    const err = validateAttendanceSymbolInput(
      {
        id: original.id,
        code: row.code,
        name: row.name,
        workdayValue: Number(row.workdayValue),
        salaryPercent: Number(row.salaryPercent),
      },
      symbols
    );

    if (err) {
      setRowErrorById((prev) => ({ ...prev, [original.id]: err }));
      return;
    }

    setSavingRowId(original.id);
    try {
      await onSaveSymbol({
        id: original.id,
        originalCode: original.code,
        code: normalizeSymbolCode(row.code),
        name: row.name.trim(),
        category: row.category,
        workdayValue: Number(Number(row.workdayValue).toFixed(2)),
        salaryPercent: Number(Number(row.salaryPercent).toFixed(0)),
        color: row.color,
        note: (row.note || '').trim(),
        isSystem: original.isSystem,
        systemKey: original.systemKey ?? null,
        sortOrder: original.sortOrder,
      });
      handleResetRowDraft(original.id);
    } finally {
      setSavingRowId(null);
    }
  };

  const newBadgePreviewClass = getSymbolBadgeClasses(
    { color: newForm.color },
    false
  );
  const newCodeDisplay = normalizeSymbolCode(newForm.code) || 'MÃ';

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* 1. Thanh dải xem trước trực quan (Legend Preview Bar) */}
      <section
        aria-label="Xem trước dải ký hiệu công"
        data-testid="symbols-legend-preview-bar"
        className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Xem trước dải chú thích trên Bảng chấm công
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
            <span>{symbols.length} ký hiệu</span>
            <span aria-hidden="true">·</span>
            <span>{leaveSymbolCount} loại nghỉ phép</span>
            <span aria-hidden="true">·</span>
            <span>Đồng bộ toàn hệ thống</span>
          </div>
        </div>

        <div className="pt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-700">
          {symbols.map((sym, idx) => {
            const effective = getRowValue(sym);
            const badgeCls = getSymbolBadgeClasses(effective, false);
            return (
              <React.Fragment key={sym.id}>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold leading-none ${badgeCls}`}
                  >
                    {normalizeSymbolCode(effective.code) || sym.code}
                  </span>
                  <span className="font-medium text-slate-800">
                    {effective.name || sym.name}
                  </span>
                  {effective.note &&
                  effective.note.toLowerCase().includes('hover') ? (
                    <span className="text-[11px] text-slate-400">
                      ({effective.note})
                    </span>
                  ) : null}
                </span>
                {idx < symbols.length - 1 && (
                  <span className="text-slate-300 select-none" aria-hidden="true">
                    ·
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* 2. Thanh thêm mới Ký hiệu công */}
      <section
        aria-label="Thêm ký hiệu công mới"
        className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Thêm ký hiệu công mới
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Các ký hiệu thuộc nhóm Nghỉ phép / Chế độ sẽ tự động hiển thị tại
              form tạo Đơn xin nghỉ phép và Báo cáo tháng.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-slate-600">
            <span>Xem trước nhãn:</span>
            <span
              data-testid="new-symbol-badge-preview"
              className={`inline-flex items-center justify-center px-2 py-0.5 rounded font-mono font-bold text-xs leading-tight ${newBadgePreviewClass}`}
            >
              {newCodeDisplay}
            </span>
          </div>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700"
          >
            {formError}
          </div>
        )}

        <form
          onSubmit={handleAddSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end"
        >
          <div className="lg:col-span-1">
            <label
              htmlFor="new-symbol-code"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Ký hiệu <span className="text-red-500">*</span>
            </label>
            <input
              id="new-symbol-code"
              type="text"
              maxLength={10}
              value={newForm.code}
              onChange={(e) => {
                setFormError('');
                setNewForm((prev) => ({
                  ...prev,
                  code: e.target.value.toUpperCase(),
                }));
              }}
              placeholder="VD: CT"
              className="w-full h-9 px-2.5 text-xs font-mono font-bold uppercase text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="new-symbol-name"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tên ký hiệu <span className="text-red-500">*</span>
            </label>
            <input
              id="new-symbol-name"
              type="text"
              maxLength={60}
              value={newForm.name}
              onChange={(e) => {
                setFormError('');
                setNewForm((prev) => ({ ...prev, name: e.target.value }));
              }}
              placeholder="VD: Nghỉ cưới, Công tác..."
              className="w-full h-9 px-2.5 text-xs font-medium text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="new-symbol-category"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Nhóm phân loại
            </label>
            <select
              id="new-symbol-category"
              value={newForm.category}
              onChange={(e) =>
                setNewForm((prev) => ({
                  ...prev,
                  category: e.target.value as AttendanceSymbolCategory,
                }))
              }
              className="w-full h-9 px-2 text-xs font-medium text-slate-800 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
            >
              {(['work', 'leave', 'overtime', 'violation'] as AttendanceSymbolCategory[]).map(
                (cat) => (
                  <option key={cat} value={cat}>
                    {ATTENDANCE_SYMBOL_CATEGORY_META[cat].label}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="lg:col-span-1">
            <label
              htmlFor="new-symbol-workday"
              className="block text-[11px] font-semibold text-slate-600 mb-1 whitespace-nowrap"
            >
              Quy đổi công
            </label>
            <input
              id="new-symbol-workday"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={newForm.workdayValue}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, workdayValue: e.target.value }))
              }
              className="w-full h-9 px-2 text-xs font-mono tabular-nums font-semibold text-right text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
            />
          </div>

          <div className="lg:col-span-1">
            <label
              htmlFor="new-symbol-salary"
              className="block text-[11px] font-semibold text-slate-600 mb-1 whitespace-nowrap"
            >
              Lương (%)
            </label>
            <input
              id="new-symbol-salary"
              type="number"
              min={0}
              max={1000}
              step={10}
              value={newForm.salaryPercent}
              onChange={(e) =>
                setNewForm((prev) => ({
                  ...prev,
                  salaryPercent: e.target.value,
                }))
              }
              className="w-full h-9 px-2 text-xs font-mono tabular-nums font-semibold text-right text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
            />
          </div>

          <div className="lg:col-span-2">
            <span className="block text-[11px] font-semibold text-slate-600 mb-1">
              Màu nhãn hiển thị
            </span>
            <div className="h-9 px-2 rounded-lg border border-slate-300 bg-slate-50/70 flex items-center justify-between gap-1">
              {ATTENDANCE_SYMBOL_COLORS.map((colorKey) => {
                const pal = ATTENDANCE_SYMBOL_COLOR_PALETTE[colorKey];
                const selected = newForm.color === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() =>
                      setNewForm((prev) => ({ ...prev, color: colorKey }))
                    }
                    aria-label={`Chọn màu ${pal.label}`}
                    title={pal.label}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center transition-transform cursor-pointer ${pal.borderBadgeClass} ${
                      selected
                        ? 'ring-2 ring-[#14539E] ring-offset-1 scale-105'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="new-symbol-note"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Ghi chú / Quy tắc hiển thị
            </label>
            <input
              id="new-symbol-note"
              type="text"
              maxLength={120}
              value={newForm.note}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="VD: Hover/chạm xem giờ"
              className="w-full h-9 px-2.5 text-xs text-slate-800 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
            />
          </div>

          <div className="lg:col-span-1 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              data-testid="add-symbol-submit-btn"
              className="w-full h-9 px-3 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Thêm</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. Bảng quản lý danh sách Ký hiệu công (High-density Table) */}
      <section
        aria-label="Danh sách ký hiệu công"
        className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs"
      >
        {/* Filter & Search Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-white">
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_FILTER_OPTIONS.map((opt) => {
              const active = categoryFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCategoryFilter(opt.id)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#14539E] text-white border-[#14539E]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#14539E] hover:text-[#14539E]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã hoặc tên ký hiệu..."
              aria-label="Tìm kiếm ký hiệu công"
              className="w-full h-8 pl-8 pr-3 text-xs text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E]"
            />
          </div>
        </div>

        {/* High-density Table */}
        <div className="overflow-x-auto">
          <table
            data-testid="attendance-symbols-table"
            className="w-full text-left border-collapse text-xs"
          >
            <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-36 whitespace-nowrap">Ký hiệu</th>
                <th className="py-2.5 px-2.5 min-w-[160px] whitespace-nowrap">
                  Tên ký hiệu
                </th>
                <th className="py-2.5 px-2.5 w-44 whitespace-nowrap">
                  Nhóm phân loại
                </th>
                <th className="py-2.5 px-2.5 w-28 text-right whitespace-nowrap">
                  Quy đổi công
                </th>
                <th className="py-2.5 px-2.5 w-28 text-right whitespace-nowrap">
                  Hưởng lương (%)
                </th>
                <th className="py-2.5 px-2.5 w-44 whitespace-nowrap">
                  Màu nhãn
                </th>
                <th className="py-2.5 px-2.5 min-w-[200px] whitespace-nowrap">
                  Ghi chú / Quy tắc hiển thị
                </th>
                <th className="py-2.5 px-3 w-28 text-center whitespace-nowrap">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading && symbols.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-slate-500 text-xs"
                  >
                    Đang tải danh sách ký hiệu công...
                  </td>
                </tr>
              ) : filteredSymbols.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-slate-500 text-xs"
                  >
                    Không tìm thấy ký hiệu công phù hợp.
                  </td>
                </tr>
              ) : (
                filteredSymbols.map((orig) => {
                  const row = getRowValue(orig);
                  const dirty = isRowDirty(orig);
                  const badgeCls = getSymbolBadgeClasses(row, false);
                  const rowErr = rowErrorById[orig.id];
                  const isRowSaving = savingRowId === orig.id;

                  return (
                    <tr
                      key={orig.id}
                      data-symbol-row={orig.code}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        dirty ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* 1. Ký hiệu (Badge + Input) */}
                      <td className="py-2 px-3 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center min-w-[34px] px-1.5 py-0.5 rounded text-[11px] font-mono font-bold leading-tight shrink-0 ${badgeCls}`}
                          >
                            {normalizeSymbolCode(row.code) || orig.code}
                          </span>
                          <input
                            type="text"
                            maxLength={10}
                            value={row.code}
                            aria-label={`Mã ký hiệu ${orig.name}`}
                            onChange={(e) =>
                              updateRowDraft(orig, {
                                code: e.target.value.toUpperCase(),
                              })
                            }
                            className="w-16 h-7 px-1.5 text-xs font-mono font-bold uppercase text-slate-900 rounded border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                          />
                        </div>
                        {rowErr && (
                          <div className="text-[10px] text-red-600 font-medium mt-1">
                            {rowErr}
                          </div>
                        )}
                      </td>

                      {/* 2. Tên ký hiệu */}
                      <td className="py-2 px-2.5 align-middle">
                        <input
                          type="text"
                          maxLength={60}
                          value={row.name}
                          aria-label={`Tên ký hiệu ${orig.code}`}
                          onChange={(e) =>
                            updateRowDraft(orig, { name: e.target.value })
                          }
                          className="w-full h-7 px-2 text-xs font-medium text-slate-900 rounded border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                        />
                      </td>

                      {/* 3. Nhóm phân loại */}
                      <td className="py-2 px-2.5 align-middle">
                        <select
                          value={row.category}
                          disabled={orig.isSystem}
                          aria-label={`Nhóm phân loại ${orig.code}`}
                          onChange={(e) =>
                            updateRowDraft(orig, {
                              category: e.target.value as AttendanceSymbolCategory,
                            })
                          }
                          className={`w-full h-7 px-2 text-xs font-medium rounded border border-slate-200 focus:outline-none focus:border-[#14539E] ${
                            orig.isSystem
                              ? 'bg-slate-50 text-slate-600 cursor-not-allowed'
                              : 'bg-white text-slate-800 cursor-pointer'
                          }`}
                        >
                          {(
                            [
                              'work',
                              'leave',
                              'overtime',
                              'violation',
                            ] as AttendanceSymbolCategory[]
                          ).map((cat) => (
                            <option key={cat} value={cat}>
                              {ATTENDANCE_SYMBOL_CATEGORY_META[cat].label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 4. Quy đổi ngày công */}
                      <td className="py-2 px-2.5 align-middle">
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={0.1}
                          value={row.workdayValue}
                          aria-label={`Quy đổi ngày công ${orig.code}`}
                          onChange={(e) =>
                            updateRowDraft(orig, {
                              workdayValue: Number(e.target.value),
                            })
                          }
                          className="w-full h-7 px-2 text-xs font-mono tabular-nums font-semibold text-right text-slate-900 rounded border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                        />
                      </td>

                      {/* 5. Tỷ lệ hưởng lương (%) */}
                      <td className="py-2 px-2.5 align-middle">
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min={0}
                            max={1000}
                            step={10}
                            value={row.salaryPercent}
                            aria-label={`Tỷ lệ hưởng lương ${orig.code}`}
                            onChange={(e) =>
                              updateRowDraft(orig, {
                                salaryPercent: Number(e.target.value),
                              })
                            }
                            className="w-full h-7 pl-2 pr-5 text-xs font-mono tabular-nums font-semibold text-right text-slate-900 rounded border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                          />
                          <span className="text-[11px] text-slate-400 font-mono absolute right-1.5 pointer-events-none">
                            %
                          </span>
                        </div>
                      </td>

                      {/* 6. Màu nhãn hiển thị */}
                      <td className="py-2 px-2.5 align-middle">
                        <div className="flex items-center gap-1">
                          {ATTENDANCE_SYMBOL_COLORS.map((colorKey) => {
                            const pal =
                              ATTENDANCE_SYMBOL_COLOR_PALETTE[colorKey];
                            const selected = row.color === colorKey;
                            return (
                              <button
                                key={colorKey}
                                type="button"
                                onClick={() =>
                                  updateRowDraft(orig, { color: colorKey })
                                }
                                title={pal.label}
                                aria-label={`Đổi màu ${orig.code} sang ${pal.label}`}
                                className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-transform ${pal.borderBadgeClass} ${
                                  selected
                                    ? 'ring-2 ring-[#14539E] ring-offset-1 scale-105'
                                    : 'opacity-70 hover:opacity-100'
                                }`}
                              >
                                {selected && <Check className="w-2.5 h-2.5" />}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* 7. Ghi chú / Quy tắc hiển thị */}
                      <td className="py-2 px-2.5 align-middle">
                        <input
                          type="text"
                          maxLength={120}
                          value={row.note}
                          aria-label={`Ghi chú ${orig.code}`}
                          onChange={(e) =>
                            updateRowDraft(orig, { note: e.target.value })
                          }
                          placeholder="Ghi chú hoặc quy tắc hiển thị..."
                          className="w-full h-7 px-2 text-xs text-slate-700 rounded border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                        />
                      </td>

                      {/* 8. Thao tác */}
                      <td className="py-2 px-3 align-middle text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1">
                          {dirty && (
                            <>
                              <button
                                type="button"
                                disabled={isRowSaving || isSaving}
                                onClick={() => void handleSaveRow(orig)}
                                title="Lưu thay đổi"
                                aria-label={`Lưu thay đổi ${orig.code}`}
                                className="h-7 px-2 rounded bg-[#14539E] hover:bg-[#0F3E77] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <Save className="w-3 h-3" />
                                <span>Lưu</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResetRowDraft(orig.id)}
                                title="Hoàn tác"
                                aria-label={`Hoàn tác ${orig.code}`}
                                className="p-1.5 rounded border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            </>
                          )}

                          {orig.isSystem ? (
                            <span
                              title="Ký hiệu cốt lõi của hệ thống (không thể xóa)"
                              className="p-1.5 rounded text-slate-300 inline-flex items-center justify-center cursor-not-allowed"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void onDeleteSymbol(orig.id)}
                              title="Xóa ký hiệu"
                              aria-label={`Xóa ký hiệu ${orig.code}`}
                              className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      </section>
    </div>
  );
};

export default AttendanceSymbolsTab;
