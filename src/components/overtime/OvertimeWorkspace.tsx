import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ClipboardList,
  FilePlus2,
  Loader2,
  Pencil,
  Plus,
} from 'lucide-react';
import { DepartmentGroup, Employee, LeaveRecord } from '../../types/hr';
import {
  formatNumberVN,
  getFriendlyErrorMessage,
} from '../../utils/errorAndSecurityService';
import { formatDateToFormStyle } from '../../utils/overtimeExportService';
import {
  createOrOpenOvertimeShell,
  DEFAULT_OVERTIME_DEPARTMENT,
  fetchActiveLeaveRecordsForOvertimeCheck,
  fetchOvertimeFormById,
  fetchOvertimeForms,
  formatOvertimeFormCodeDisplay,
  generateOvertimeFormCode,
  getLocalTodayIsoDate,
  OvertimeFormWithItems,
  OvertimeLeaveCheckEntry,
  resolveOvertimeMainDepartment,
  softDeleteOvertimeForms,
  subscribeToLeaveLogsRealtime,
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
  leaveRecords?: LeaveRecord[];
  initialTab?: OvertimeTabId;
  onShowToast?: (message: string) => void;
}

export const OvertimeWorkspace: React.FC<OvertimeWorkspaceProps> = ({
  employees,
  groups,
  leaveRecords: propLeaveRecords = [],
  initialTab = 'log',
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<OvertimeTabId>(initialTab);
  const [forms, setForms] = useState<OvertimeFormWithItems[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState<boolean>(true);
  const [schemaNeedsMigration, setSchemaNeedsMigration] = useState<boolean>(false);
  const [editingForm, setEditingForm] = useState<OvertimeFormWithItems | null>(
    null
  );
  const [quickShellDate, setQuickShellDate] = useState<string>(() =>
    getLocalTodayIsoDate()
  );
  const [isQuickCreating, setIsQuickCreating] = useState<boolean>(false);
  const [supabaseLeaveRecords, setSupabaseLeaveRecords] = useState<
    OvertimeLeaveCheckEntry[] | null
  >(null);
  const realtimeReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadLeaveRecords = useCallback(async () => {
    const res = await fetchActiveLeaveRecordsForOvertimeCheck(employees);
    if (res.source === 'supabase') {
      setSupabaseLeaveRecords(res.records);
    }
  }, [employees]);

  const effectiveLeaveRecords = useMemo<OvertimeLeaveCheckEntry[]>(() => {
    if (supabaseLeaveRecords !== null) {
      return supabaseLeaveRecords;
    }
    return propLeaveRecords;
  }, [supabaseLeaveRecords, propLeaveRecords]);

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
    void loadLeaveRecords();
  }, [loadForms, loadLeaveRecords, propLeaveRecords]);

  // Đăng ký Supabase Realtime (postgres_changes: INSERT, UPDATE, DELETE) cho cả phiếu tăng ca & đơn nghỉ
  useEffect(() => {
    const scheduleSilentReload = () => {
      if (realtimeReloadTimerRef.current) {
        clearTimeout(realtimeReloadTimerRef.current);
      }
      realtimeReloadTimerRef.current = setTimeout(() => {
        void loadForms({ silent: true });
      }, 250);
    };

    const scheduleLeaveReload = () => {
      if (leaveReloadTimerRef.current) {
        clearTimeout(leaveReloadTimerRef.current);
      }
      leaveReloadTimerRef.current = setTimeout(() => {
        void loadLeaveRecords();
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

    const unsubscribeLeaves = subscribeToLeaveLogsRealtime(scheduleLeaveReload);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadForms({ silent: true });
        void loadLeaveRecords();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      if (realtimeReloadTimerRef.current) {
        clearTimeout(realtimeReloadTimerRef.current);
      }
      if (leaveReloadTimerRef.current) {
        clearTimeout(leaveReloadTimerRef.current);
      }
      unsubscribe();
      unsubscribeLeaves();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [loadForms, loadLeaveRecords]);

  const handleCreateOrOpenShell = async (overtimeDate: string) => {
    const res = await createOrOpenOvertimeShell(overtimeDate, {
      department: DEFAULT_OVERTIME_DEPARTMENT,
      knownSubGroups,
    });

    await loadForms({ silent: true });

    const displayCode = formatOvertimeFormCodeDisplay(res.form.form_code);
    const displayDate = formatDateToFormStyle(res.form.overtime_date);

    if (res.action === 'created_new') {
      onShowToast?.(
        `Đã tạo vỏ phiếu mới ${displayCode} (Ngày ${displayDate}). Vui lòng thêm chi tiết lượt tăng ca.`
      );
    } else if (res.action === 'opened_existing') {
      onShowToast?.(
        `Ngày ${displayDate} đã tồn tại phiếu ${displayCode} — đã mở trực tiếp để chỉnh sửa.`
      );
    } else {
      onShowToast?.(
        `Đã khôi phục vỏ phiếu ${displayCode} (Ngày ${displayDate}) để nhập chi tiết.`
      );
    }

    setEditingForm(res.form);
    setActiveTab('create');
  };

  const handleStartEditForm = async (form: OvertimeFormWithItems) => {
    try {
      const freshForm = await fetchOvertimeFormById(form.id);
      if (!freshForm) {
        onShowToast?.(
          `Phiếu ${formatOvertimeFormCodeDisplay(
            form.form_code
          )} vừa bị xóa khỏi hệ thống.`
        );
        await loadForms({ silent: true });
        return;
      }
      setEditingForm(freshForm);
      setActiveTab('create');
    } catch {
      setEditingForm(form);
      setActiveTab('create');
    }
  };

  const handleSaveForm = async (payload: CreateOvertimeFormPayload) => {
    if (!editingForm) {
      throw new Error(
        'Vui lòng tạo hoặc chọn một vỏ phiếu từ Nhật ký trước khi lưu chi tiết.'
      );
    }

    const mainDepartment = resolveOvertimeMainDepartment(
      payload.department || editingForm.department,
      knownSubGroups
    );

    // Luôn cập nhật trực tiếp vào vỏ phiếu đang mở (giữ cố định Mã phiếu TC-YYYYMMDD & Ngày phiếu)
    const updated = await updateOvertimeFormInHistory(editingForm, {
      department: mainDepartment,
      overtimeDate: editingForm.overtime_date,
      blocks: payload.blocks,
      employees,
      knownSubGroups,
    });

    await loadForms({ silent: true });
    setEditingForm(null);
    onShowToast?.(
      `Đã cập nhật phiếu ${formatOvertimeFormCodeDisplay(
        updated.form_code
      )} (${formatNumberVN(updated.total_participants)} lượt • ${formatNumberVN(
        updated.total_hours
      )} giờ).`
    );
    setActiveTab('log');
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
            aria-selected={activeTab === 'log'}
            onClick={() => {
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
                ? `Biên tập: ${formatOvertimeFormCodeDisplay(
                    editingForm.form_code
                  )} (${formatDateToFormStyle(editingForm.overtime_date)})`
                : 'Biên tập chi tiết phiếu'}
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
      {activeTab === 'log' ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <OvertimeLog
            forms={forms}
            employees={employees}
            groups={groups}
            isLoading={isLoadingForms}
            schemaNeedsMigration={schemaNeedsMigration}
            onRefresh={() => loadForms({ silent: false })}
            onCreateOrOpenShell={handleCreateOrOpenShell}
            onEdit={(form) => void handleStartEditForm(form)}
            onSoftDelete={handleSoftDeleteForms}
            onShowToast={onShowToast}
          />
        </div>
      ) : editingForm ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden">
          <CreateOvertimeForm
            key={editingForm.id}
            employees={employees}
            groups={groups}
            leaveRecords={effectiveLeaveRecords}
            existingForms={forms}
            isCheckingExistingForms={isLoadingForms}
            editingForm={editingForm}
            onOpenExistingForm={(form) => void handleStartEditForm(form)}
            onCancelEdit={handleCancelEdit}
            onSaveOnly={handleSaveForm}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-md w-full text-center space-y-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-[#14539E] flex items-center justify-center mx-auto">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Chưa chọn vỏ phiếu tăng ca để biên tập
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Chọn <strong>Ngày phiếu</strong> để tạo vỏ phiếu mới (hoặc mở
                phiếu đã có của ngày đó) với mã chuẩn{' '}
                <strong className="font-mono text-[#14539E]">
                  {generateOvertimeFormCode(quickShellDate)}
                </strong>
                .
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <div className="relative flex-1 max-w-[180px]">
                <Calendar className="w-3.5 h-3.5 text-[#14539E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={quickShellDate}
                  onChange={(e) => setQuickShellDate(e.target.value)}
                  aria-label="Chọn ngày phiếu để tạo hoặc mở"
                  className="w-full h-9 pl-8 pr-2.5 text-xs font-mono font-semibold text-slate-800 rounded-lg border border-slate-300 bg-white focus:border-[#14539E] focus:outline-none cursor-pointer"
                />
              </div>
              <button
                type="button"
                disabled={isQuickCreating}
                onClick={async () => {
                  setIsQuickCreating(true);
                  try {
                    await handleCreateOrOpenShell(quickShellDate);
                  } catch (err) {
                    onShowToast?.(getFriendlyErrorMessage(err));
                  } finally {
                    setIsQuickCreating(false);
                  }
                }}
                className="h-9 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isQuickCreating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Tạo / Mở phiếu</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('log')}
                className="text-xs font-semibold text-[#14539E] hover:underline cursor-pointer"
              >
                Quay lại Nhật ký phiếu tăng ca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OvertimeWorkspace;
