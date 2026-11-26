import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Languages,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DepartmentGroup } from '../../../types/hr';
import { formatNumberVN, getFriendlyErrorMessage } from '../../../utils/errorAndSecurityService';
import {
  approveGlossaryEntry,
  areTargetGroupsEqual,
  createManualGlossaryEntry,
  deleteGlossaryEntry,
  fetchOvertimeGlossary,
  formatGlossaryDateDDMMYYYY,
  normalizeGlossaryKey,
  normalizeTargetGroups,
  OvertimeGlossaryEntry,
  suggestFactoryKoreanTranslation,
  updateGlossaryEntry,
} from '../../../services/hrService';

export interface GlossaryManagerModalProps {
  isActive?: boolean;
  groups?: DepartmentGroup[];
  entries?: OvertimeGlossaryEntry[];
  isLoading?: boolean;
  onEntriesUpdated?: (entries: OvertimeGlossaryEntry[]) => void;
  onRefreshGlossary?: () => Promise<void> | void;
  onShowToast?: (message: string) => void;
  onGlossaryUpdated?: () => void;
}

type GlossaryStatusFilter = 'all' | 'pending' | 'verified';

interface RowPopoverState {
  entryId: string;
  top: number;
  left: number;
  openUpward: boolean;
}

export const GlossaryManagerModal: React.FC<GlossaryManagerModalProps> = ({
  isActive = true,
  groups = [],
  entries: propEntries,
  isLoading: propIsLoading,
  onEntriesUpdated,
  onRefreshGlossary,
  onShowToast,
  onGlossaryUpdated,
}) => {
  const isControlled = propEntries !== undefined;
  const [internalEntries, setInternalEntries] = useState<OvertimeGlossaryEntry[]>([]);
  const [internalIsLoading, setInternalIsLoading] = useState<boolean>(false);
  const entries = isControlled ? propEntries : internalEntries;
  const isLoading = propIsLoading !== undefined ? propIsLoading : internalIsLoading;
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<GlossaryStatusFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  const [draftViById, setDraftViById] = useState<Record<string, string>>({});
  const [draftKrById, setDraftKrById] = useState<Record<string, string>>({});
  const [draftGroupsById, setDraftGroupsById] = useState<Record<string, string[]>>({});

  const [savingId, setSavingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newReasonVi, setNewReasonVi] = useState<string>('');
  const [newReasonKr, setNewReasonKr] = useState<string>('');
  const [newTargetGroups, setNewTargetGroups] = useState<string[]>([]);
  const [isNewGroupPopoverOpen, setIsNewGroupPopoverOpen] = useState<boolean>(false);
  const [isAddingManual, setIsAddingManual] = useState<boolean>(false);
  const [isTranslatingNew, setIsTranslatingNew] = useState<boolean>(false);

  const [rowPopover, setRowPopover] = useState<RowPopoverState | null>(null);

  const newGroupPopoverRef = useRef<HTMLDivElement | null>(null);
  const rowPopoverRef = useRef<HTMLDivElement | null>(null);
  const prevEntriesRef = useRef<OvertimeGlossaryEntry[]>([]);

  const applyEntriesUpdate = useCallback(
    (nextEntries: OvertimeGlossaryEntry[]) => {
      if (!isControlled) {
        setInternalEntries(nextEntries);
      }
      onEntriesUpdated?.(nextEntries);
    },
    [isControlled, onEntriesUpdated]
  );

  const groupOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ name: string; color: string }> = [];
    for (const g of groups) {
      const cleanName = (g.name || '').trim();
      if (!cleanName) continue;
      const key = cleanName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        name: cleanName,
        color: g.color || '#64748b',
      });
    }
    return list;
  }, [groups]);

  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of groupOptions) {
      map.set(opt.name.toLowerCase(), opt.color);
    }
    return map;
  }, [groupOptions]);

  const getGroupColor = useCallback(
    (groupName: string): string => {
      return groupColorMap.get((groupName || '').trim().toLowerCase()) || '#64748b';
    },
    [groupColorMap]
  );

  const syncDraftsFromEntries = useCallback(
    (list: OvertimeGlossaryEntry[], prevList: OvertimeGlossaryEntry[] = []) => {
      const prevById = new Map(prevList.map((item) => [item.id, item]));
      setDraftViById((prev) => {
        const next: Record<string, string> = {};
        for (const item of list) {
          const prevItem = prevById.get(item.id);
          const prevDraft = prev[item.id];
          const hasUnsavedEdit =
            prevDraft !== undefined &&
            prevItem !== undefined &&
            prevDraft.trim() !== prevItem.reasonVi.trim();
          next[item.id] = hasUnsavedEdit ? prevDraft : item.reasonVi;
        }
        return next;
      });
      setDraftKrById((prev) => {
        const next: Record<string, string> = {};
        for (const item of list) {
          const prevItem = prevById.get(item.id);
          const prevDraft = prev[item.id];
          const hasUnsavedEdit =
            prevDraft !== undefined &&
            prevItem !== undefined &&
            prevDraft.trim() !== prevItem.reasonKr.trim();
          next[item.id] = hasUnsavedEdit ? prevDraft : item.reasonKr;
        }
        return next;
      });
      setDraftGroupsById((prev) => {
        const next: Record<string, string[]> = {};
        for (const item of list) {
          const prevItem = prevById.get(item.id);
          const prevDraft = prev[item.id];
          const hasUnsavedEdit =
            prevDraft !== undefined &&
            prevItem !== undefined &&
            !areTargetGroupsEqual(prevDraft, prevItem.target_groups);
          next[item.id] = hasUnsavedEdit
            ? prevDraft
            : normalizeTargetGroups(item.target_groups);
        }
        return next;
      });
    },
    []
  );

  useEffect(() => {
    syncDraftsFromEntries(entries, prevEntriesRef.current);
    prevEntriesRef.current = entries;
  }, [entries, syncDraftsFromEntries]);

  useEffect(() => {
    if (!isActive || isControlled) return;
    let active = true;
    setInternalIsLoading(true);

    void fetchOvertimeGlossary()
      .then((loaded) => {
        if (!active) return;
        setInternalEntries(loaded);
      })
      .finally(() => {
        if (active) setInternalIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isActive, isControlled]);

  const prevIsActiveRef = useRef<boolean>(isActive);
  const onRefreshGlossaryRef = useRef(onRefreshGlossary);
  onRefreshGlossaryRef.current = onRefreshGlossary;

  useEffect(() => {
    const wasActive = prevIsActiveRef.current;
    prevIsActiveRef.current = isActive;
    if (!wasActive && isActive && isControlled && onRefreshGlossaryRef.current) {
      void onRefreshGlossaryRef.current();
    }
  }, [isActive, isControlled]);

  useEffect(() => {
    if (!isNewGroupPopoverOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (
        newGroupPopoverRef.current &&
        !newGroupPopoverRef.current.contains(event.target as Node)
      ) {
        setIsNewGroupPopoverOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNewGroupPopoverOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isNewGroupPopoverOpen]);

  useEffect(() => {
    if (!rowPopover) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (rowPopoverRef.current && rowPopoverRef.current.contains(target)) {
        return;
      }
      if (target?.closest('[data-glossary-row-group-trigger="true"]')) {
        return;
      }
      setRowPopover(null);
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRowPopover(null);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [rowPopover]);

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
    const deptFilterKey = normalizeGlossaryKey(departmentFilter);

    return entries.filter((entry) => {
      if (entry.deletedAt) return false;
      const isPending = entry.is_verified === false;
      if (statusFilter === 'pending' && !isPending) return false;
      if (statusFilter === 'verified' && isPending) return false;

      if (departmentFilter === 'SHARED') {
        if (normalizeTargetGroups(entry.target_groups).length > 0) return false;
      } else if (departmentFilter !== 'ALL') {
        const entryGroups = normalizeTargetGroups(entry.target_groups);
        const matchesDept = entryGroups.some(
          (g) => normalizeGlossaryKey(g) === deptFilterKey
        );
        if (!matchesDept) return false;
      }

      if (!q) return true;
      return (
        entry.reasonVi.toLowerCase().includes(q) ||
        entry.reasonKr.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, statusFilter, departmentFilter]);

  const toggleGroupSelection = (current: string[], groupName: string): string[] => {
    const targetKey = normalizeGlossaryKey(groupName);
    const exists = current.some((g) => normalizeGlossaryKey(g) === targetKey);
    if (exists) {
      return current.filter((g) => normalizeGlossaryKey(g) !== targetKey);
    }
    return normalizeTargetGroups([...current, groupName]);
  };

  const handleOpenRowGroupPopover = (
    event: React.MouseEvent<HTMLButtonElement>,
    entryId: string
  ) => {
    if (rowPopover?.entryId === entryId) {
      setRowPopover(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const popoverWidth = 248;
    const estimatedHeight = Math.min(280, 72 + Math.max(1, groupOptions.length) * 32);
    const openUpward =
      window.innerHeight - rect.bottom < estimatedHeight + 16 &&
      rect.top > estimatedHeight + 16;

    setRowPopover({
      entryId,
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      left: Math.min(rect.left, Math.max(12, window.innerWidth - popoverWidth - 12)),
      openUpward,
    });
  };

  const handleSaveEntry = async (
    entry: OvertimeGlossaryEntry,
    forceSave: boolean = false
  ) => {
    const draftVi = (draftViById[entry.id] ?? entry.reasonVi).trim();
    const draftKr = (draftKrById[entry.id] ?? entry.reasonKr).trim();
    const draftGroups =
      draftGroupsById[entry.id] ?? normalizeTargetGroups(entry.target_groups);

    if (!draftVi || !draftKr) {
      onShowToast?.('Lý do (Tiếng Việt) và Bản dịch (Tiếng Hàn) không được để trống.');
      return;
    }

    const isTextUnchanged =
      draftVi === entry.reasonVi.trim() && draftKr === entry.reasonKr.trim();
    const isGroupsUnchanged = areTargetGroupsEqual(draftGroups, entry.target_groups);

    if (!forceSave && isTextUnchanged && isGroupsUnchanged) {
      return;
    }

    setSavingId(entry.id);
    try {
      const res = await updateGlossaryEntry(entry.id, draftVi, draftKr, draftGroups);
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
        setDraftGroupsById((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          next[updated.id] = normalizeTargetGroups(updated.target_groups);
          return next;
        });
      }
      applyEntriesUpdate(res.entries);
      setRowPopover((prev) => (prev?.entryId === entry.id ? null : prev));
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
    const draftGroups =
      draftGroupsById[entry.id] ?? normalizeTargetGroups(entry.target_groups);

    if (!draftVi || !draftKr) {
      onShowToast?.('Lý do (Tiếng Việt) và Bản dịch (Tiếng Hàn) không được để trống.');
      return;
    }

    setApprovingId(entry.id);
    try {
      const editRes = await updateGlossaryEntry(
        entry.id,
        draftVi,
        draftKr,
        draftGroups
      );
      const targetId = editRes.updatedEntry?.id || entry.id;

      const res = await approveGlossaryEntry(targetId);
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
        setDraftGroupsById((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          next[updated.id] = normalizeTargetGroups(updated.target_groups);
          return next;
        });
      }
      applyEntriesUpdate(res.entries);
      setRowPopover((prev) => (prev?.entryId === entry.id ? null : prev));
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
      setDraftGroupsById((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      applyEntriesUpdate(res.entries);
      setRowPopover((prev) => (prev?.entryId === entry.id ? null : prev));
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
      const res = await createManualGlossaryEntry(
        cleanVi,
        cleanKr,
        newTargetGroups
      );
      setDraftViById((prev) => ({
        ...prev,
        [res.createdEntry.id]: res.createdEntry.reasonVi,
      }));
      setDraftKrById((prev) => ({
        ...prev,
        [res.createdEntry.id]: res.createdEntry.reasonKr,
      }));
      setDraftGroupsById((prev) => ({
        ...prev,
        [res.createdEntry.id]: normalizeTargetGroups(
          res.createdEntry.target_groups
        ),
      }));
      applyEntriesUpdate(res.entries);
      setNewReasonVi('');
      setNewReasonKr('');
      setNewTargetGroups([]);
      setIsNewGroupPopoverOpen(false);
      if (statusFilter === 'pending') {
        setStatusFilter('all');
      }
      const createdGroups = normalizeTargetGroups(res.createdEntry.target_groups);
      if (
        departmentFilter === 'SHARED' &&
        createdGroups.length > 0
      ) {
        setDepartmentFilter('ALL');
      } else if (
        departmentFilter !== 'ALL' &&
        departmentFilter !== 'SHARED' &&
        !createdGroups.some(
          (g) => normalizeGlossaryKey(g) === normalizeGlossaryKey(departmentFilter)
        )
      ) {
        setDepartmentFilter('ALL');
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

  const activeRowPopoverEntry = useMemo(
    () =>
      rowPopover
        ? entries.find((item) => item.id === rowPopover.entryId) || null
        : null,
    [rowPopover, entries]
  );

  const activeRowPopoverDraftGroups = useMemo(() => {
    if (!activeRowPopoverEntry) return [];
    return (
      draftGroupsById[activeRowPopoverEntry.id] ??
      normalizeTargetGroups(activeRowPopoverEntry.target_groups)
    );
  }, [activeRowPopoverEntry, draftGroupsById]);

  const activeRowPopoverExtraGroups = useMemo(() => {
    const known = new Set(groupOptions.map((g) => g.name.toLowerCase()));
    return activeRowPopoverDraftGroups.filter(
      (name) => !known.has(name.toLowerCase())
    );
  }, [groupOptions, activeRowPopoverDraftGroups]);

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
          Sửa trực tiếp trên dòng, chọn nhóm áp dụng và nhấn Duyệt / Cập nhật để lưu.
        </span>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
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

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Lọc từ điển theo phòng ban"
            className="h-8 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer max-w-[210px]"
          >
            <option value="ALL">Phòng ban: Tất cả</option>
            <option value="SHARED">Dùng chung</option>
            {groupOptions.map((grp) => (
              <option key={grp.name} value={grp.name}>
                {grp.name}
              </option>
            ))}
          </select>
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
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
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

          {/* Multi-select Target Department Popover Button */}
          <div ref={newGroupPopoverRef} className="relative shrink-0">
            <button
              type="button"
              disabled={isAddingManual}
              onClick={() => setIsNewGroupPopoverOpen((prev) => !prev)}
              aria-expanded={isNewGroupPopoverOpen}
              aria-label="Chọn phòng ban áp dụng cho từ mới"
              className={`h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-45 ${
                newTargetGroups.length > 0
                  ? 'bg-blue-50/70 border-[#14539E]/40 text-[#14539E]'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-[#14539E]'
              }`}
            >
              {newTargetGroups.length === 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  <span>Dùng chung</span>
                </>
              ) : newTargetGroups.length === 1 ? (
                <>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getGroupColor(newTargetGroups[0]) }}
                  />
                  <span className="max-w-[120px] truncate">{newTargetGroups[0]}</span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center -space-x-1">
                    {newTargetGroups.slice(0, 3).map((grp) => (
                      <span
                        key={grp}
                        className="w-2 h-2 rounded-full ring-1 ring-white"
                        style={{ backgroundColor: getGroupColor(grp) }}
                      />
                    ))}
                  </span>
                  <span>{formatNumberVN(newTargetGroups.length)} nhóm</span>
                </>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  isNewGroupPopoverOpen ? 'rotate-180 text-[#14539E]' : ''
                }`}
              />
            </button>

            {isNewGroupPopoverOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-60 rounded-xl border border-slate-200 bg-white shadow-xl py-1.5">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Phạm vi phòng ban
                </div>
                <button
                  type="button"
                  onClick={() => setNewTargetGroups([])}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2 text-slate-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                    <span>Dùng chung (Tất cả)</span>
                  </span>
                  {newTargetGroups.length === 0 && (
                    <Check className="w-3.5 h-3.5 text-[#14539E] shrink-0" />
                  )}
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-52 overflow-y-auto">
                  {groupOptions.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-400">
                      Chưa có danh sách phòng ban.
                    </div>
                  ) : (
                    groupOptions.map((grp) => {
                      const checked = newTargetGroups.some(
                        (selected) =>
                          normalizeGlossaryKey(selected) ===
                          normalizeGlossaryKey(grp.name)
                      );
                      return (
                        <label
                          key={grp.name}
                          className="w-full px-3 py-1.5 text-xs hover:bg-blue-50/50 flex items-center justify-between gap-2 cursor-pointer select-none"
                        >
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setNewTargetGroups((prev) =>
                                  toggleGroupSelection(prev, grp.name)
                                )
                              }
                              className="w-3.5 h-3.5 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E] shrink-0"
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: grp.color }}
                            />
                            <span className="text-slate-700 truncate">{grp.name}</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
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
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        onScroll={() => {
          if (rowPopover) setRowPopover(null);
        }}
      >
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
            {(searchQuery || statusFilter !== 'all' || departmentFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setDepartmentFilter('ALL');
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
                <th className="px-2.5 py-2 w-[23%] border-r border-slate-200/70">
                  Lý do (Tiếng Việt)
                </th>
                <th className="px-2.5 py-2 w-[25%] border-r border-slate-200/70">
                  Bản dịch (Tiếng Hàn)
                </th>
                <th className="px-2.5 py-2 w-[22%] border-r border-slate-200/70 whitespace-nowrap">
                  Nhóm / Bộ phận
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
                const draftGroups =
                  draftGroupsById[entry.id] ??
                  normalizeTargetGroups(entry.target_groups);

                const isViDirty = draftViValue.trim() !== entry.reasonVi.trim();
                const isKrDirty = draftKrValue.trim() !== entry.reasonKr.trim();
                const isGroupsDirty = !areTargetGroupsEqual(
                  draftGroups,
                  entry.target_groups
                );
                const isDirty = isViDirty || isKrDirty || isGroupsDirty;
                const canSave =
                  isDirty &&
                  Boolean(draftViValue.trim()) &&
                  Boolean(draftKrValue.trim());

                const isSaving = savingId === entry.id;
                const isApproving = approvingId === entry.id;
                const isDeleting = deletingId === entry.id;
                const isBusy = isSaving || isApproving || isDeleting;
                const isRowPopoverOpen = rowPopover?.entryId === entry.id;

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

                    <td className="px-2 py-1 border-r border-slate-100">
                      <button
                        type="button"
                        data-glossary-row-group-trigger="true"
                        disabled={isDeleting}
                        onClick={(e) => handleOpenRowGroupPopover(e, entry.id)}
                        title="Bấm để chọn phòng ban áp dụng"
                        aria-expanded={isRowPopoverOpen}
                        aria-label={`Chọn nhóm áp dụng cho ${entry.reasonVi}`}
                        className={`w-full min-h-[28px] px-1.5 py-0.5 rounded border text-left flex items-center justify-between gap-1.5 transition-colors cursor-pointer disabled:opacity-45 ${
                          isGroupsDirty || isRowPopoverOpen
                            ? 'bg-blue-50/40 border-[#14539E] ring-1 ring-[#14539E]/20'
                            : 'bg-white border-slate-200 hover:border-[#14539E]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-1 min-w-0">
                          {draftGroups.length === 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                              Dùng chung
                            </span>
                          ) : (
                            draftGroups.map((groupName) => (
                              <span
                                key={groupName}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-medium max-w-[125px]"
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: getGroupColor(groupName),
                                  }}
                                />
                                <span className="truncate">{groupName}</span>
                              </span>
                            ))
                          )}
                        </div>
                        <ChevronDown
                          className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${
                            isRowPopoverOpen ? 'rotate-180 text-[#14539E]' : ''
                          }`}
                        />
                      </button>
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

      {/* Floating Fixed Popover for Row Department Assignment */}
      {rowPopover && activeRowPopoverEntry && (
        <div
          ref={rowPopoverRef}
          style={{
            top: `${rowPopover.top}px`,
            left: `${rowPopover.left}px`,
          }}
          className={`fixed z-50 w-[248px] rounded-xl border border-slate-200 bg-white shadow-xl py-1.5 ${
            rowPopover.openUpward ? '-translate-y-full' : ''
          }`}
        >
          <div className="px-3 py-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Chọn nhóm áp dụng
            </span>
            <button
              type="button"
              onClick={() => setRowPopover(null)}
              aria-label="Đóng chọn nhóm"
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setDraftGroupsById((prev) => ({
                ...prev,
                [activeRowPopoverEntry.id]: [],
              }))
            }
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 text-slate-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
              <span>Dùng chung (Xóa chọn riêng)</span>
            </span>
            {activeRowPopoverDraftGroups.length === 0 && (
              <Check className="w-3.5 h-3.5 text-[#14539E] shrink-0" />
            )}
          </button>

          <div className="my-1 border-t border-slate-100" />

          <div className="max-h-52 overflow-y-auto">
            {groupOptions.map((grp) => {
              const checked = activeRowPopoverDraftGroups.some(
                (name) =>
                  normalizeGlossaryKey(name) === normalizeGlossaryKey(grp.name)
              );
              return (
                <label
                  key={grp.name}
                  className="w-full px-3 py-1.5 text-xs hover:bg-blue-50/50 flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDraftGroupsById((prev) => ({
                        ...prev,
                        [activeRowPopoverEntry.id]: toggleGroupSelection(
                          prev[activeRowPopoverEntry.id] ??
                            normalizeTargetGroups(activeRowPopoverEntry.target_groups),
                          grp.name
                        ),
                      }))
                    }
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E] shrink-0"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: grp.color }}
                  />
                  <span className="text-slate-700 truncate">{grp.name}</span>
                </label>
              );
            })}

            {activeRowPopoverExtraGroups.map((extraName) => (
              <label
                key={extraName}
                className="w-full px-3 py-1.5 text-xs hover:bg-blue-50/50 flex items-center gap-2 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() =>
                    setDraftGroupsById((prev) => ({
                      ...prev,
                      [activeRowPopoverEntry.id]: toggleGroupSelection(
                        prev[activeRowPopoverEntry.id] ??
                          normalizeTargetGroups(activeRowPopoverEntry.target_groups),
                        extraName
                      ),
                    }))
                  }
                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E] shrink-0"
                />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                <span className="text-slate-700 truncate">{extraName}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlossaryManagerModal;
