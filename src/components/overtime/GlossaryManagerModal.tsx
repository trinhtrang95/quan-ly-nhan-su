import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { formatNumberVN, getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  approveGlossaryEntry,
  loadOvertimeGlossary,
  OvertimeGlossaryEntry,
  readLocalOvertimeGlossary,
  updateGlossaryEntryKr,
} from '../../utils/overtimeGlossaryService';

export interface GlossaryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (message: string) => void;
  onGlossaryUpdated?: () => void;
}

type GlossaryStatusFilter = 'all' | 'pending' | 'verified';

export const GlossaryManagerModal: React.FC<GlossaryManagerModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onGlossaryUpdated,
}) => {
  const [entries, setEntries] = useState<OvertimeGlossaryEntry[]>(() =>
    readLocalOvertimeGlossary()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<GlossaryStatusFilter>('all');
  const [draftKrById, setDraftKrById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const syncDraftsFromEntries = useCallback((list: OvertimeGlossaryEntry[]) => {
    setDraftKrById((prev) => {
      const next: Record<string, string> = {};
      for (const item of list) {
        next[item.id] = prev[item.id] !== undefined ? prev[item.id] : item.reasonKr;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const localInitial = readLocalOvertimeGlossary();
    setEntries(localInitial);
    const initialDrafts: Record<string, string> = {};
    for (const item of localInitial) {
      initialDrafts[item.id] = item.reasonKr;
    }
    setDraftKrById(initialDrafts);
    setIsLoading(true);

    void loadOvertimeGlossary()
      .then((loaded) => {
        if (!active) return;
        setEntries(loaded);
        const refreshedDrafts: Record<string, string> = {};
        for (const item of loaded) {
          refreshedDrafts[item.id] = item.reasonKr;
        }
        setDraftKrById(refreshedDrafts);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const handleSaveKr = async (entry: OvertimeGlossaryEntry) => {
    const draft = (draftKrById[entry.id] ?? entry.reasonKr).trim();
    if (!draft) {
      onShowToast?.('Bản dịch tiếng Hàn không được để trống.');
      return;
    }
    if (draft === entry.reasonKr.trim()) {
      return;
    }

    setSavingId(entry.id);
    try {
      const res = await updateGlossaryEntryKr(entry.id, draft);
      setEntries(res.entries);
      if (res.updatedEntry) {
        setDraftKrById((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          next[res.updatedEntry!.id] = res.updatedEntry!.reasonKr;
          return next;
        });
      } else {
        syncDraftsFromEntries(res.entries);
      }
      onGlossaryUpdated?.();
      onShowToast?.(`Đã lưu bản dịch tiếng Hàn cho "${entry.reasonVi}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const handleApprove = async (entry: OvertimeGlossaryEntry) => {
    if (entry.is_verified !== false) return;
    setApprovingId(entry.id);
    try {
      // Nếu người dùng vừa gõ sửa bản dịch mà chưa bấm icon Check, tự lưu luôn trước khi duyệt
      const draft = (draftKrById[entry.id] ?? entry.reasonKr).trim();
      let targetId = entry.id;
      if (draft && draft !== entry.reasonKr.trim()) {
        const krRes = await updateGlossaryEntryKr(entry.id, draft);
        if (krRes.updatedEntry) {
          targetId = krRes.updatedEntry.id;
        }
      }

      const res = await approveGlossaryEntry(targetId);
      setEntries(res.entries);
      if (res.updatedEntry) {
        setDraftKrById((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          next[res.updatedEntry!.id] = res.updatedEntry!.reasonKr;
          return next;
        });
      }
      onGlossaryUpdated?.();
      onShowToast?.(`Đã duyệt thuật ngữ "${entry.reasonVi}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setApprovingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-manager-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-4 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="glossary-manager-modal-title"
                className="text-sm font-bold text-slate-900 truncate"
              >
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

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng quản lý từ điển"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
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
              onClick={() => setStatusFilter('all')}
              className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({formatNumberVN(counts.total)})
            </button>
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
                  <th className="px-2.5 py-2 w-12 text-center border-r border-slate-200/70">
                    STT
                  </th>
                  <th className="px-3 py-2 w-[30%] border-r border-slate-200/70">
                    Lý do (Tiếng Việt)
                  </th>
                  <th className="px-3 py-2 w-[34%] border-r border-slate-200/70">
                    Bản dịch (Tiếng Hàn)
                  </th>
                  <th className="px-2.5 py-2 w-[18%] border-r border-slate-200/70">
                    Trạng thái
                  </th>
                  <th className="px-2.5 py-2 w-[12%] text-center">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredEntries.map((entry, idx) => {
                  const isVerified = entry.is_verified !== false;
                  const draftValue = draftKrById[entry.id] ?? entry.reasonKr;
                  const isDirty = draftValue.trim() !== entry.reasonKr.trim();
                  const isSaving = savingId === entry.id;
                  const isApproving = approvingId === entry.id;

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-blue-50/35 transition-colors"
                    >
                      <td className="px-2.5 py-1.5 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                        {formatNumberVN(idx + 1)}
                      </td>

                      <td className="px-3 py-1.5 text-slate-800 font-medium leading-snug border-r border-slate-100">
                        {entry.reasonVi}
                      </td>

                      <td className="px-2.5 py-1 border-r border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={draftValue}
                            onChange={(e) =>
                              setDraftKrById((prev) => ({
                                ...prev,
                                [entry.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isDirty && !isSaving) {
                                e.preventDefault();
                                void handleSaveKr(entry);
                              }
                            }}
                            aria-label={`Bản dịch tiếng Hàn cho ${entry.reasonVi}`}
                            className={`flex-1 min-w-0 h-7 px-2 text-xs rounded border bg-white text-slate-800 focus:outline-none transition-colors ${
                              isDirty
                                ? 'border-[#14539E] ring-1 ring-[#14539E]/20'
                                : 'border-slate-200 focus:border-[#14539E]'
                            }`}
                          />
                          <button
                            type="button"
                            disabled={!isDirty || isSaving || !draftValue.trim()}
                            onClick={() => void handleSaveKr(entry)}
                            title={
                              isDirty
                                ? 'Lưu thay đổi bản dịch'
                                : 'Chưa có thay đổi để lưu'
                            }
                            aria-label={`Lưu bản dịch cho ${entry.reasonVi}`}
                            className={`h-7 w-7 rounded border inline-flex items-center justify-center shrink-0 transition-colors ${
                              isDirty && draftValue.trim()
                                ? 'bg-[#14539E] border-[#14539E] text-white hover:bg-[#0F3E77] cursor-pointer'
                                : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-2.5 py-1.5 border-r border-slate-100 whitespace-nowrap">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>Đã duyệt</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>AI dịch (Chờ duyệt)</span>
                          </span>
                        )}
                      </td>

                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isVerified || isApproving}
                          onClick={() => void handleApprove(entry)}
                          aria-label={`Duyệt thuật ngữ ${entry.reasonVi}`}
                          className={`h-7 px-2.5 rounded-md text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                            isVerified
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer'
                          }`}
                        >
                          {isApproving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : null}
                          <span>Duyệt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-[11px] text-slate-500 shrink-0">
          <span>
            Sửa trực tiếp ở ô tiếng Hàn rồi nhấn icon Check (hoặc Enter) để lưu.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-3 rounded-md border border-slate-300 bg-white text-slate-700 hover:border-[#14539E] hover:text-[#14539E] font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlossaryManagerModal;
