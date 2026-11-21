import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, FilePlus2, Pencil } from 'lucide-react';
import { DepartmentGroup, Employee } from '../../types/hr';
import { formatNumberVN } from '../../utils/errorAndSecurityService';
import {
  evaluateOvertimeDateConflict,
  fetchOvertimeForms,
  formatOvertimeFormCodeDisplay,
  OvertimeFormWithItems,
  resolveOvertimeMainDepartment,
  saveOvertimeFormToHistory,
  softDeleteOvertimeForms,
  subscribeToOvertimeRealtime,
  updateOvertimeFormInHistory,
} from '../../utils/overtimeFormsService';
import {
  CreateOvertimeForm,
  CreateOvertimeFormPayload,
} from './CreateOvertimeForm';
import { OvertimeLog } from './OvertimeLog';

export type OvertimeTabId = 'create' | 'log';

export interface OvertimeWorkspaceProps {
  employees: Employee[];
  groups: DepartmentGroup[];
  initialTab?: OvertimeTabId;
  onShowToast?: (message: string) => void;
}

export const OvertimeWorkspace: React.FC<OvertimeWorkspaceProps> = ({
  employees,
  groups,
  initialTab = 'create',
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<OvertimeTabId>(initialTab);
  const [forms, setForms] = useState<OvertimeFormWithItems[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState<boolean>(true);
  const [schemaNeedsMigration, setSchemaNeedsMigration] = useState<boolean>(false);
  const [editingForm, setEditingForm] = useState<OvertimeFormWithItems | null>(
    null
  );
  const realtimeReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadForms = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setIsLoadingForms(true);
    }
    try {
      const res = await fetchOvertimeForms();
      setForms(res.forms);
      setSchemaNeedsMigration(Boolean(res.schemaNeedsMigration));
    } finally {
      if (!silent) {
        setIsLoadingForms(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  // Đăng ký Supabase Realtime (postgres_changes: INSERT, UPDATE, DELETE) cho cả 2 bảng
  useEffect(() => {
    const scheduleSilentReload = () => {
      if (realtimeReloadTimerRef.current) {
        clearTimeout(realtimeReloadTimerRef.current);
      }
      realtimeReloadTimerRef.current = setTimeout(() => {
        void loadForms({ silent: true });
      }, 250);
    };

    const unsubscribe = subscribeToOvertimeRealtime((event) => {
      if (event.table === 'overtime_forms') {
        if (event.eventType === 'UPDATE') {
          const updatedRow = event.payload.new as
            | { id?: string; deleted_at?: string | null }
            | undefined;
          if (updatedRow?.id && updatedRow.deleted_at) {
            setForms((prev) => prev.filter((f) => f.id !== updatedRow.id));
            setEditingForm((prev) =>
              prev && prev.id === updatedRow.id ? null : prev
            );
          }
        } else if (event.eventType === 'DELETE') {
          const oldRow = event.payload.old as { id?: string } | undefined;
          if (oldRow?.id) {
            setForms((prev) => prev.filter((f) => f.id !== oldRow.id));
            setEditingForm((prev) =>
              prev && prev.id === oldRow.id ? null : prev
            );
          }
        }
      }
      scheduleSilentReload();
    });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadForms({ silent: true });
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      if (realtimeReloadTimerRef.current) {
        clearTimeout(realtimeReloadTimerRef.current);
      }
      unsubscribe();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [loadForms]);

  const handleSaveForm = async (payload: CreateOvertimeFormPayload) => {
    // Re-sync with latest active forms before saving so stale state can never bypass duplicate blocking
    let latestForms = forms;
    try {
      const refreshed = await fetchOvertimeForms();
      latestForms = refreshed.forms;
      setForms(refreshed.forms);
    } catch {
      // Fallback to in-memory forms
    }

    const mainDepartment = resolveOvertimeMainDepartment(
      payload.department,
      knownSubGroups
    );

    const conflictEval = evaluateOvertimeDateConflict({
      blocks: payload.blocks,
      selectedDepartment: mainDepartment,
      employees,
      existingForms: latestForms,
      editingFormId: editingForm?.id ?? null,
      primaryOvertimeDate: payload.overtimeDate,
      fallbackDate: payload.overtimeDate,
    });

    if (conflictEval.isBlocked) {
      const codes = Array.from(
        new Set(
          conflictEval.conflictingForms.map((f) =>
            formatOvertimeFormCodeDisplay(f.form_code)
          )
        )
      ).join(', ');
      throw new Error(
        `Không thể lưu: Ngày tăng ca chính (${conflictEval.representativeDate}) đã tồn tại trong Nhật ký (${codes}). Vui lòng mở chỉnh sửa phiếu cũ hoặc chọn Ngày tăng ca chính khác.`
      );
    }

    const effectiveDate = conflictEval.representativeDate;

    if (editingForm) {
      const updated = await updateOvertimeFormInHistory(editingForm, {
        department: mainDepartment,
        overtimeDate: effectiveDate,
        blocks: payload.blocks,
        employees,
        knownSubGroups,
      });
      await loadForms({ silent: true });
      setEditingForm(null);
      onShowToast?.(
        `Đã cập nhật phiếu tăng ca ${formatOvertimeFormCodeDisplay(
          updated.form_code
        )} (${formatNumberVN(updated.total_participants)} lượt).`
      );
      setActiveTab('log');
      return;
    }

    const saved = await saveOvertimeFormToHistory({
      department: mainDepartment,
      overtimeDate: effectiveDate,
      blocks: payload.blocks,
      employees,
      knownSubGroups,
    });

    await loadForms({ silent: true });
    onShowToast?.(
      `Đã lưu phiếu tăng ca ${formatOvertimeFormCodeDisplay(
        saved.form_code
      )} (${formatNumberVN(saved.total_participants)} lượt) vào Nhật ký.`
    );
    setActiveTab('log');
  };

  const handleStartEditForm = (form: OvertimeFormWithItems) => {
    setEditingForm(form);
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    setEditingForm(null);
    setActiveTab('log');
  };

  const handleSoftDeleteForms = async (formIds: string[]) => {
    const result = await softDeleteOvertimeForms(formIds);
    if (result.itemsSchemaMissing) {
      setSchemaNeedsMigration(true);
    }
    const deletedSet = new Set(result.deletedIds);
    if (editingForm && deletedSet.has(editingForm.id)) {
      setEditingForm(null);
    }
    // Tải lại danh sách trực tiếp từ Supabase (.is('deleted_at', null)), không giữ state local cũ
    await loadForms({ silent: true });
  };

  const activeFormsCount = forms.filter((f) => !f.deleted_at).length;

  return (
    <div className="flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-slate-50">
      {/* 2-Tab Navigation Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0 no-print">
        <div
          role="tablist"
          aria-label="Phân hệ Tăng ca"
          className="inline-flex flex-wrap items-center gap-1 min-w-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            onClick={() => setActiveTab('create')}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'create'
                ? 'bg-[#14539E] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {editingForm ? (
              <Pencil className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {editingForm
                ? `Đang sửa: ${formatOvertimeFormCodeDisplay(
                    editingForm.form_code
                  )}`
                : 'Tạo phiếu tăng ca'}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'log'}
            onClick={() => {
              setEditingForm(null);
              setActiveTab('log');
              void loadForms({ silent: true });
            }}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'log'
                ? 'bg-[#14539E] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
            <span>Nhật ký phiếu tăng ca</span>
            <span
              className={`font-mono text-[11px] tabular-nums ${
                activeTab === 'log' ? 'text-blue-100' : 'text-slate-400'
              }`}
            >
              ({formatNumberVN(activeFormsCount)})
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 shrink-0 whitespace-nowrap pr-1">
          Biểu mẫu chuẩn:{' '}
          <span className="font-mono font-semibold text-slate-700">
            TV-PSGC2022
          </span>
        </div>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'create' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden">
          <CreateOvertimeForm
            key={editingForm ? `edit-${editingForm.id}` : 'create-new'}
            employees={employees}
            groups={groups}
            existingForms={forms}
            isCheckingExistingForms={isLoadingForms}
            editingForm={editingForm}
            onOpenExistingForm={handleStartEditForm}
            onCancelEdit={handleCancelEdit}
            onSaveOnly={handleSaveForm}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <OvertimeLog
            forms={forms}
            employees={employees}
            groups={groups}
            isLoading={isLoadingForms}
            schemaNeedsMigration={schemaNeedsMigration}
            onRefresh={() => loadForms({ silent: false })}
            onEdit={handleStartEditForm}
            onSoftDelete={handleSoftDeleteForms}
            onSwitchToCreate={() => {
              setEditingForm(null);
              setActiveTab('create');
            }}
            onShowToast={onShowToast}
          />
        </div>
      )}
    </div>
  );
};

export default OvertimeWorkspace;
