import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Languages,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { formatNumberVN, getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  approveGlossaryEntry,
  createManualGlossaryEntry,
  deleteGlossaryEntry,
  formatGlossaryDateDDMMYYYY,
  loadOvertimeGlossary,
  OvertimeGlossaryEntry,
  readLocalOvertimeGlossary,
  suggestFactoryKoreanTranslation,
  updateGlossaryEntry,
} from '../../utils/overtimeGlossaryService';

export interface GlossaryManagerModalProps {
  isActive?: boolean;
  onShowToast?: (message: string) => void;
  onGlossaryUpdated?: () => void;
}

type GlossaryStatusFilter = 'all' | 'pending' | 'verified';

export const GlossaryManagerModal: React.FC<GlossaryManagerModalProps> = ({
  isActive = true,
  onShowToast,
  onGlossaryUpdated,
}) => {
  const [entries, setEntries] = useState<OvertimeGlossaryEntry[]>(() =>
    readLocalOvertimeGlossary()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<GlossaryStatusFilter>('all');
  const [draftViById, setDraftViById] = useState<Record<string, string>>({});
  const [draftKrById, setDraftKrById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newReasonVi, setNewReasonVi] = useState<string>('');
  const [newReasonKr, setNewReasonKr] = useState<string>('');
  const [isAddingManual, setIsAddingManual] = useState<boolean>(false);
  const [isTranslatingNew, setIsTranslatingNew] = useState<boolean>(false);

  const syncDraftsFromEntries = useCallback((list: OvertimeGlossaryEntry[]) => {
    setDraftViById((prev) => {
      const next: Record<string, string> = {};
      for (const item of list) {
        next[item.id] = prev[item.id] !== undefined ? prev[item.id] : item.reasonVi;
      }
      return next;
    });
    setDraftKrById((prev) => {
      const next: Record<string, string> = {};
      for (const item of list) {
        next[item.id] = prev[item.id] !== undefined ? prev[item.id] : item.reasonKr;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isActive) return;
    let active = true;
    const localInitial = readLocalOvertimeGlossary();
    setEntries(localInitial);

    const initialViDrafts: Record<string, string> = {};
    const initialKrDrafts: Record<string, string> = {};
    for (const item of localInitial) {
      initialViDrafts[item.id] = item.reasonVi;
      initialKrDrafts[item.id] = item.reasonKr;
    }
    setDraftViById(initialViDrafts);
    setDraftKrById(initialKrDrafts);
    setIsLoading(true);

    void loadOvertimeGlossary()
      .then((loaded) => {
        if (!active) return;
        setEntries(loaded);
        const refreshedViDrafts: Record<string, string> = {};
        const refreshedKrDrafts: Record<string, string> = {};
        for (const item of loaded) {
          refreshedViDrafts[item.id] = item.reasonVi;
          refreshedKrDrafts[item.id] = item.reasonKr;
        }
        setDraftViById(refreshedViDrafts);
        setDraftKrById(refreshedKrDrafts);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isActive]);

  const counts = useMemo(() => {
    const active = entries.filter((e) => !e.deletedAt);
    const pending = active.filter((e) => e.is_verified === false).length;
    const verified = active.length - pending;
    return {
      total: active.length,
      pending,
      verified,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entry.deletedAt) return false;
      const isPending = entry.is_verified === false;
      if (statusFilter === 'pending' && !isPending) return false;
      if (statusFilter === 'verified' && isPending) return false;
      if (!q) return true;
      return (
        entry.reasonVi.toLowerCase().includes(q) ||
        entry.reasonKr.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, statusFilter]);

  const handleSaveEntry = async (
    entry: OvertimeGlossaryEntry,
    forceSave: boolean = false
  ) => {
    const draftVi = (draftViById[entry.id] ?? entry.reasonVi).trim();
    const draftKr = (draftKrById[entry.id] ?? entry.reasonKr).trim();
    if (!draftVi || !draftKr) {
      onShowToast?.('Lý do (Tiếng Việt) và Bản dịch (Tiếng Hàn) không được để trống.');
      return;
    }
    if (
      !forceSave &&
      draftVi === entry.reasonVi.trim() &&
      draftKr === entry.reasonKr.trim()
    ) {
      return;
    }

    setSavingId(entry.id);
    try {
      const res = await updateGlossaryEntry(entry.id, draftVi, draftKr);
      setEntries(res.entries);
      if (res.updatedEntry) {
        const updated = res.updatedEntry;
        setDraftViById((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          next[updated.id] = updated.reasonVi;
          return next;
        });
        setDraftKrById((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          next[updated.id] = updated.reasonKr;
          return next;
        });
      } else {
        syncDraftsFromEntries(res.entries);
      }
      onGlossaryUpdated?.();
      onShowToast?.(`Đã cập nhật từ vựng "${draftVi}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const handleApprove = async (entry: OvertimeGlossaryEntry) => {
    if (entry.is_verified !== false) return;
    const draftVi = (draftViById[entry.id] ?? entry.reasonVi).trim();
    const draftKr = (draftKrById[entry.id] ?? entry.reasonKr).trim();
    if (!draftVi || !draftKr) {
      onShowToast?.('Lý do (Tiếng Việt) và Bản dịch (Tiếng Hàn) không được để trống.');
      return;
    }

    setApprovingId(entry.id);
    try {
      const editRes = await updateGlossaryEntry(entry.id, draftVi, draftKr);
      const targetId = editRes.updatedEntry?.id || entry.id;

      const res = await approveGlossaryEntry(targetId);
      setEntries(res.entries);
      if (res.updatedEntry) {
        const updated = res.updatedEntry;
        setDraftViById((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          next[updated.id] = updated.reasonVi;
          return next;
        });
        setDraftKrById((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          next[updated.id] = updated.reasonKr;
          return next;
        });
      }
      onGlossaryUpdated?.();
      onShowToast?.(`Đã duyệt thuật ngữ "${draftVi}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setApprovingId(null);
    }
  };

  const handleDelete = async (entry: OvertimeGlossaryEntry) => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn xóa từ vựng này khỏi từ điển không?'
      )
    ) {
      return;
    }

    setDeletingId(entry.id);
    try {
      const res = await deleteGlossaryEntry(entry.id);
      setEntries(res.entries);
      setDraftViById((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      setDraftKrById((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      onGlossaryUpdated?.();
      onShowToast?.(`Đã xóa từ vựng "${entry.reasonVi}" khỏi từ điển.`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSuggestNewKorean = async () => {
    const cleanVi = newReasonVi.trim();
    if (!cleanVi) {
      onShowToast?.('Vui lòng nhập lý do Tiếng Việt trước khi dịch nháp.');
      return;
    }

    setIsTranslatingNew(true);
    try {
      const { translation } = await suggestFactoryKoreanTranslation(
        cleanVi,
        entries
      );
      if (translation) {
        setNewReasonKr(translation);
      }
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsTranslatingNew(false);
    }
  };

  const handleAddManualEntry = async () => {
    const cleanVi = newReasonVi.trim();
    const cleanKr = newReasonKr.trim();
    if (!cleanVi || !cleanKr) {
      onShowToast?.(
        'Vui lòng nhập đầy đủ cả Lý do (Tiếng Việt) và Bản dịch (Tiếng Hàn).'
      );
      return;
    }

    setIsAddingManual(true);
    try {
      const res = await createManualGlossaryEntry(cleanVi, cleanKr);
      setEntries(res.entries);
      setDraftViById((prev) => ({
        ...prev,
        [res.createdEntry.id]: res.createdEntry.reasonVi,
      }));
      setDraftKrById((prev) => ({
        ...prev,
        [res.createdEntry.id]: res.createdEntry.reasonKr,
      }));
      setNewReasonVi('');
      setNewReasonKr('');
      if (statusFilter === 'pending') {
        setStatusFilter('all');
      }
      if (
        searchQuery.trim() &&
        !res.createdEntry.reasonVi
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase()) &&
        !res.createdEntry.reasonKr
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ) {
        setSearchQuery('');
      }
      onGlossaryUpdated?.();
      onShowToast?.(
        `Đã thêm từ vựng mới "${res.createdEntry.reasonVi}" vào từ điển.`
      );
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsAddingManual(false);
    }
  };

  return (
    <div className="w-full h-full flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-4 bg-white shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              Quản lý Từ điển Tăng ca (Việt - Hàn)
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 tabular-nums">
              <span>{formatNumberVN(counts.total)} thuật ngữ</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-medium">
                {formatNumberVN(counts.verified)} đã duyệt
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-700 font-medium">
                {formatNumberVN(counts.pending)} chờ duyệt
              </span>
            </div>
          </div>
        </div>

        <span className="hidden md:block text-[11px] text-slate-500 shrink-0">
          Sửa trực tiếp trên dòng, nhấn Enter hoặc nút Duyệt / Cập nhật để lưu.
        </span>
      </div>

        {/* Filter & Search Toolbar */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm lý do tiếng Việt hoặc tiếng Hàn..."
              aria-label="Tìm kiếm thuật ngữ từ điển"
              className="w-full h-8 pl-8 pr-7 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
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

          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'pending'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chờ duyệt ({formatNumberVN(counts.pending)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('verified')}
              className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'verified'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã duyệt ({formatNumberVN(counts.verified)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({formatNumberVN(counts.total)})
            </button>
          </div>
        </div>

        {/* Compact Quick-Add Manual Entry Bar */}
        <div className="px-4 py-2 border-b border-slate-200 bg-white shrink-0">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
            <input
              type="text"
              value={newReasonVi}
              disabled={isAddingManual}
              onChange={(e) => setNewReasonVi(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isAddingManual) {
                  e.preventDefault();
                  void handleAddManualEntry();
                }
              }}
              placeholder="Thêm lý do Tiếng Việt mới..."
              aria-label="Thêm lý do Tiếng Việt mới"
              className="flex-1 min-w-[180px] h-8 px-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
            />

            <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
              <input
                type="text"
                value={newReasonKr}
                disabled={isAddingManual}
                onChange={(e) => setNewReasonKr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAddingManual) {
                    e.preventDefault();
                    void handleAddManualEntry();
                  }
                }}
                placeholder="Bản dịch Tiếng Hàn..."
                aria-label="Bản dịch Tiếng Hàn mới"
                className="flex-1 min-w-0 h-8 px-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <button
                type="button"
                disabled={isTranslatingNew || isAddingManual}
                onClick={() => void handleSuggestNewKorean()}
                title="Dịch gợi ý tiếng Hàn bằng AI"
                aria-label="Dịch gợi ý tiếng Hàn"
                className="h-8 w-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-[#14539E] hover:text-[#14539E] inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {isTranslatingNew ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#14539E]" />
                ) : (
                  <Languages className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <button
              type="button"
              disabled={isAddingManual}
              onClick={() => void handleAddManualEntry()}
              className="h-8 px-3 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {isAddingManual ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Plus className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Thêm</span>
            </button>
          </div>
        </div>

        {/* High-Density Scrollable Table */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading && entries.length === 0 ? (
            <div className="p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
              <span>Đang tải danh sách từ điển...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-xs font-medium text-slate-600">
                Không tìm thấy thuật ngữ nào phù hợp với bộ lọc hiện tại.
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="text-xs font-semibold text-[#14539E] hover:underline cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                <tr>
                  <th className="px-2 py-2 w-11 text-center border-r border-slate-200/70">
                    STT
                  </th>
                  <th className="px-2.5 py-2 w-[28%] border-r border-slate-200/70">
                    Lý do (Tiếng Việt)
                  </th>
                  <th className="px-2.5 py-2 w-[32%] border-r border-slate-200/70">
                    Bản dịch (Tiếng Hàn)
                  </th>
                  <th className="px-2 py-2 w-24 text-center border-r border-slate-200/70 whitespace-nowrap">
                    Ngày thêm
                  </th>
                  <th className="px-2 py-2 w-20 text-center border-r border-slate-200/70 whitespace-nowrap">
                    Trạng thái
                  </th>
                  <th className="px-2 py-2 w-24 text-center whitespace-nowrap">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredEntries.map((entry, idx) => {
                  const isVerified = entry.is_verified !== false;
                  const draftViValue = draftViById[entry.id] ?? entry.reasonVi;
                  const draftKrValue = draftKrById[entry.id] ?? entry.reasonKr;
                  const isViDirty =
                    draftViValue.trim() !== entry.reasonVi.trim();
                  const isKrDirty =
                    draftKrValue.trim() !== entry.reasonKr.trim();
                  const isDirty = isViDirty || isKrDirty;
                  const canSave =
                    isDirty &&
                    Boolean(draftViValue.trim()) &&
                    Boolean(draftKrValue.trim());
                  const isSaving = savingId === entry.id;
                  const isApproving = approvingId === entry.id;
                  const isDeleting = deletingId === entry.id;
                  const isBusy = isSaving || isApproving || isDeleting;

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-blue-50/35 transition-colors"
                    >
                      <td className="px-2.5 py-1 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                        {formatNumberVN(idx + 1)}
                      </td>

                      <td className="px-2 py-1 border-r border-slate-100">
                        <input
                          type="text"
                          value={draftViValue}
                          disabled={isDeleting}
                          onChange={(e) =>
                            setDraftViById((prev) => ({
                              ...prev,
                              [entry.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canSave && !isBusy) {
                              e.preventDefault();
                              void handleSaveEntry(entry);
                            }
                          }}
                          aria-label={`Lý do tiếng Việt cho ${entry.reasonVi}`}
                          className={`w-full min-w-0 h-7 px-2 text-xs rounded border bg-white text-slate-800 font-medium focus:outline-none transition-colors ${
                            isViDirty
                              ? 'border-[#14539E] ring-1 ring-[#14539E]/20'
                              : 'border-slate-200 focus:border-[#14539E]'
                          }`}
                        />
                      </td>

                      <td className="px-2 py-1 border-r border-slate-100">
                        <input
                          type="text"
                          value={draftKrValue}
                          disabled={isDeleting}
                          onChange={(e) =>
                            setDraftKrById((prev) => ({
                              ...prev,
                              [entry.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canSave && !isBusy) {
                              e.preventDefault();
                              void handleSaveEntry(entry);
                            }
                          }}
                          aria-label={`Bản dịch tiếng Hàn cho ${entry.reasonVi}`}
                          className={`w-full min-w-0 h-7 px-2 text-xs rounded border bg-white text-slate-800 focus:outline-none transition-colors ${
                            isKrDirty
                              ? 'border-[#14539E] ring-1 ring-[#14539E]/20'
                              : 'border-slate-200 focus:border-[#14539E]'
                          }`}
                        />
                      </td>

                      <td className="px-2 py-1 text-center font-mono text-[11px] text-slate-600 tabular-nums border-r border-slate-100 whitespace-nowrap">
                        {formatGlossaryDateDDMMYYYY(
                          entry.created_at || entry.updatedAt
                        )}
                      </td>

                      <td className="px-2 py-1 text-center border-r border-slate-100 whitespace-nowrap">
                        {isVerified ? (
                          <span
                            title="Đã duyệt"
                            aria-label="Đã duyệt"
                            className="inline-flex items-center justify-center"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                          </span>
                        ) : (
                          <span
                            title="Chờ duyệt (AI)"
                            aria-label="Chờ duyệt (AI)"
                            className="inline-flex items-center justify-center"
                          >
                            <Clock className="w-4 h-4 text-[#f59e0b]" />
                          </span>
                        )}
                      </td>

                      <td className="px-2 py-1 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {isVerified ? (
                            <button
                              type="button"
                              disabled={
                                isBusy ||
                                !draftViValue.trim() ||
                                !draftKrValue.trim()
                              }
                              onClick={() => void handleSaveEntry(entry, true)}
                              title="Cập nhật thay đổi"
                              aria-label={`Cập nhật thuật ngữ ${entry.reasonVi}`}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors bg-[#14539E] hover:bg-[#0F3E77] text-white shadow-2xs cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
                            >
                              {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                isBusy ||
                                !draftViValue.trim() ||
                                !draftKrValue.trim()
                              }
                              onClick={() => void handleApprove(entry)}
                              title="Duyệt bản dịch"
                              aria-label={`Duyệt thuật ngữ ${entry.reasonVi}`}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
                            >
                              {isApproving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDelete(entry)}
                            title="Xóa từ vựng"
                            aria-label={`Xóa thuật ngữ ${entry.reasonVi}`}
                            className="w-7 h-7 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
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

export default GlossaryManagerModal;
