import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  ClipboardList,
  FilePlus2,
  Loader2,
  Pencil,
  Plus,
} from 'lucide-react';
import { DepartmentGroup, Employee, LeaveRecord } from '../../../types/hr';
import {
  formatNumberVN,
  getFriendlyErrorMessage,
} from '../../../utils/errorAndSecurityService';
import { formatDateToFormStyle } from '../../../utils/overtimeExportService';
import {
  applyRealtimeGlossaryPayload,
  createOrOpenOvertimeShell,
  DEFAULT_OVERTIME_DEPARTMENT,
  fetchActiveLeaveRecordsForOvertimeCheck,
  fetchOvertimeFormById,
  fetchOvertimeForms,
  fetchOvertimeGlossary,
  formatOvertimeFormCodeDisplay,
  generateOvertimeFormCode,
  getLocalTodayIsoDate,
  isOvertimeFormLocked,
  lockOvertimeForm,
  normalizeTargetGroups,
  OvertimeBlockInput,
  OvertimeFormWithItems,
  OvertimeGlossaryEntry,
  OvertimeLeaveCheckEntry,
  OvertimeParticipantInput,
  OvertimeSupabaseActionError,
  reconstructBlocksFromItems,
  resolveOvertimeMainDepartment,
  softDeleteOvertimeForms,
  subscribeToOvertimeGlossaryRealtime,
  unlockOvertimeForm,
  updateOvertimeFormInHistory,
} from '../../../services/hrService';
import {
  calculateActualOvertimeHours,
  CompanyHoliday,
  createDefaultAdminShift,
  DEFAULT_OVERTIME_SETTINGS,
  evaluateOvertimeDaySchedule,
  getWeekdayKeyFromIsoDate,
  normalize24hTime,
  OvertimeSettings,
  WorkShift,
} from '../../../utils/workScheduleLogic';
import {
  applyRealtimeHolidayPayload,
  applyRealtimeWorkShiftPayload,
  fetchAllCompanyHolidays,
  fetchOvertimeSettings,
  fetchWorkShifts,
  mapSupabaseRowToOvertimeSettings,
  subscribeToCompanyHolidaysRealtime,
  subscribeToOvertimeSettingsRealtime,
  subscribeToWorkShiftsRealtime,
  SupabaseOvertimeSettingsRow,
} from '../../../services/settingsService';
import {
  CreateOvertimeForm,
  CreateOvertimeFormPayload,
} from './CreateOvertimeForm';
import { GlossaryManagerModal } from './GlossaryManagerModal';
import { OvertimeLog } from './OvertimeLog';
import { ConfirmableOvertimeBlockPayload } from './ZaloScheduleScanModal';

export type OvertimeTabId = 'create' | 'log' | 'glossary';

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
  const [glossaryEntries, setGlossaryEntries] = useState<OvertimeGlossaryEntry[]>([]);
  const [isLoadingGlossary, setIsLoadingGlossary] = useState<boolean>(true);
  const [supabaseLeaveRecords, setSupabaseLeaveRecords] = useState<
    OvertimeLeaveCheckEntry[] | null
  >(null);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>(() => [
    createDefaultAdminShift(),
  ]);
  const [companyHolidays, setCompanyHolidays] = useState<CompanyHoliday[]>([]);
  const [overtimeSettings, setOvertimeSettings] = useState<OvertimeSettings>(
    () => ({ ...DEFAULT_OVERTIME_SETTINGS })
  );

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  const loadScheduleData = useCallback(async () => {
    const [shiftsRes, holidaysRes, otSettingsRes] = await Promise.all([
      fetchWorkShifts(),
      fetchAllCompanyHolidays(),
      fetchOvertimeSettings(),
    ]);
    if (shiftsRes.shifts.length > 0) {
      setWorkShifts(shiftsRes.shifts);
    }
    setCompanyHolidays(holidaysRes.holidays);
    setOvertimeSettings(otSettingsRes.settings);
  }, []);

  const loadGlossary = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setIsLoadingGlossary(true);
    }
    try {
      const loaded = await fetchOvertimeGlossary();
      setGlossaryEntries(loaded);
    } finally {
      if (!silent) {
        setIsLoadingGlossary(false);
      }
    }
  }, []);

  const handleRefreshGlossary = useCallback(
    () => loadGlossary({ silent: true }),
    [loadGlossary]
  );

  const handleSelectTab = (nextTab: OvertimeTabId) => {
    setActiveTab(nextTab);
    if (nextTab === 'create' || nextTab === 'glossary') {
      void loadGlossary({ silent: glossaryEntries.length > 0 });
    }
  };

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
    void loadGlossary();
    void loadScheduleData();

    let refreshTimer: number | null = null;
    const unsubscribeGlossaryRealtime = subscribeToOvertimeGlossaryRealtime(
      (event) => {
        setGlossaryEntries((prev) => applyRealtimeGlossaryPayload(prev, event));
        if (refreshTimer !== null) {
          window.clearTimeout(refreshTimer);
        }
        refreshTimer = window.setTimeout(() => {
          refreshTimer = null;
          void loadGlossary({ silent: true });
        }, 250);
      }
    );

    const unsubscribeWorkShiftsRealtime = subscribeToWorkShiftsRealtime(
      (event) => {
        setWorkShifts((prev) => applyRealtimeWorkShiftPayload(prev, event));
      }
    );

    const unsubscribeHolidaysRealtime = subscribeToCompanyHolidaysRealtime(
      (event) => {
        setCompanyHolidays((prev) => applyRealtimeHolidayPayload(prev, event));
      }
    );

    const unsubscribeOvertimeSettingsRealtime = subscribeToOvertimeSettingsRealtime(
      (event) => {
        if (event.eventType === 'DELETE') {
          setOvertimeSettings({ ...DEFAULT_OVERTIME_SETTINGS });
        } else if (event.newRow) {
          setOvertimeSettings(
            mapSupabaseRowToOvertimeSettings(
              event.newRow as Partial<SupabaseOvertimeSettingsRow>
            )
          );
        }
      }
    );

    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      unsubscribeGlossaryRealtime();
      unsubscribeWorkShiftsRealtime();
      unsubscribeHolidaysRealtime();
      unsubscribeOvertimeSettingsRealtime();
    };
  }, [loadForms, loadLeaveRecords, loadGlossary, loadScheduleData]);

  const upsertFormInState = useCallback((nextForm: OvertimeFormWithItems) => {
    setForms((prev) => {
      const exists = prev.some((f) => f.id === nextForm.id);
      if (exists) {
        return prev.map((f) => (f.id === nextForm.id ? nextForm : f));
      }
      return [nextForm, ...prev];
    });
    setEditingForm((prev) => (prev && prev.id === nextForm.id ? nextForm : prev));
  }, []);

  const handleCreateOrOpenShell = async (
    overtimeDate: string,
    options?: { openInEditor?: boolean }
  ) => {
    const res = await createOrOpenOvertimeShell(overtimeDate, {
      department: DEFAULT_OVERTIME_DEPARTMENT,
      knownSubGroups,
    });

    upsertFormInState(res.form);

    const displayCode = formatOvertimeFormCodeDisplay(res.form.form_code);
    const displayDate = formatDateToFormStyle(res.form.overtime_date);

    if (res.action === 'created_new') {
      onShowToast?.(
        `Đã tạo vỏ phiếu mới ${displayCode} (Ngày ${displayDate}).`
      );
    } else if (res.action === 'opened_existing') {
      if (isOvertimeFormLocked(res.form)) {
        onShowToast?.(
          `Phiếu ${displayCode} (Ngày ${displayDate}) đã được chốt.`
        );
      } else {
        onShowToast?.(
          `Ngày ${displayDate} đã có phiếu ${displayCode} — đã mở trực tiếp.`
        );
      }
    } else {
      onShowToast?.(
        `Đã khôi phục vỏ phiếu ${displayCode} (Ngày ${displayDate}).`
      );
    }

    if (options?.openInEditor) {
      setEditingForm(res.form);
      handleSelectTab('create');
    }
  };

  const computeNetHoursForEmployee = useCallback(
    (isoDate: string, empId: string, startTime: string, endTime: string) => {
      const empDept = (employeeMap.get(empId)?.department || '').trim();
      const evalRes = evaluateOvertimeDaySchedule({
        isoDate,
        holidays: companyHolidays,
        shifts: workShifts,
        departmentName: empDept || 'ALL',
        employeeDepartments: empDept ? [empDept] : [],
      });
      const isWeekendOrHoliday =
        evalRes.dayKind === 'weekly_off' ||
        evalRes.dayKind === 'holiday' ||
        evalRes.dayKind === 'compensatory_off' ||
        (Boolean(isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) &&
          getWeekdayKeyFromIsoDate(isoDate) === 'sun');

      return calculateActualOvertimeHours(
        isoDate,
        startTime,
        endTime,
        isWeekendOrHoliday,
        overtimeSettings
      ).netHours;
    },
    [employeeMap, companyHolidays, workShifts, overtimeSettings]
  );

  const handleAppendBlocksToDate = async (
    fallbackDate: string,
    payloads: ConfirmableOvertimeBlockPayload[]
  ): Promise<OvertimeFormWithItems> => {
    if (!payloads || payloads.length === 0) {
      throw new Error('Không có nhóm tăng ca nào để ghi nhận.');
    }

    const targetDate =
      (payloads[0]?.overtimeDate || fallbackDate || '').trim() ||
      getLocalTodayIsoDate();

    // Tìm vỏ phiếu đang hoạt động của ngày đó hoặc tự động tạo/khôi phục vỏ phiếu TC-YYYYMMDD
    let targetForm = forms.find(
      (f) => !f.deleted_at && (f.overtime_date || '').trim() === targetDate
    );

    if (!targetForm) {
      const shellRes = await createOrOpenOvertimeShell(targetDate, {
        department: DEFAULT_OVERTIME_DEPARTMENT,
        knownSubGroups,
      });
      targetForm = shellRes.form;
      upsertFormInState(targetForm);
    }

    if (isOvertimeFormLocked(targetForm)) {
      throw new OvertimeSupabaseActionError(
        `Phiếu ${formatOvertimeFormCodeDisplay(
          targetForm.form_code
        )} đã chốt, không thể thêm nhóm tăng ca mới.`
      );
    }

    const existingBlocks = reconstructBlocksFromItems(targetForm.items || []);

    const newBlocks: OvertimeBlockInput[] = payloads.map((payload, idx) => {
      const resolvedBlockDate =
        (payload.overtimeDate || targetDate).trim() || targetDate;
      const normStart = normalize24hTime(payload.startTime, '16:10');
      const normEnd = normalize24hTime(payload.endTime, '18:10');
      const participants: OvertimeParticipantInput[] =
        payload.selectedEmployeeIds.map((empId) => {
          const custom = payload.customTimes[empId];
          const pStart = custom?.startTime
            ? normalize24hTime(custom.startTime, normStart)
            : normStart;
          const pEnd = custom?.endTime
            ? normalize24hTime(custom.endTime, normEnd)
            : normEnd;
          return {
            employeeId: empId,
            startTime: pStart,
            endTime: pEnd,
            totalHours: computeNetHoursForEmployee(
              resolvedBlockDate,
              empId,
              pStart,
              pEnd
            ),
          };
        });

      return {
        id: `ot-block-${Date.now()}-${idx}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        overtimeDate: resolvedBlockDate,
        reasonVi: payload.reasonVi.trim(),
        reasonKr: payload.reasonKr.trim(),
        startTime: normStart,
        endTime: normEnd,
        selectedEmployeeIds: [...payload.selectedEmployeeIds],
        participants,
      };
    });

    const combinedBlocks = [...existingBlocks, ...newBlocks];
    const mainDepartment = resolveOvertimeMainDepartment(
      targetForm.department,
      knownSubGroups
    );

    const updatedForm = await updateOvertimeFormInHistory(targetForm, {
      department: mainDepartment,
      overtimeDate: targetForm.overtime_date,
      blocks: combinedBlocks,
      employees,
      knownSubGroups,
    });

    upsertFormInState(updatedForm);
    onShowToast?.(
      newBlocks.length > 1
        ? `Đã ghi nhận ${newBlocks.length} nhóm tăng ca vào phiếu ${formatOvertimeFormCodeDisplay(
            updatedForm.form_code
          )}.`
        : `Đã ghi nhận nhóm tăng ca vào phiếu ${formatOvertimeFormCodeDisplay(
            updatedForm.form_code
          )}.`
    );

    return updatedForm;
  };

  const handleUpdateFormBlocks = async (
    form: OvertimeFormWithItems,
    nextBlocks: OvertimeBlockInput[]
  ): Promise<OvertimeFormWithItems> => {
    if (isOvertimeFormLocked(form)) {
      throw new OvertimeSupabaseActionError(
        'Phiếu đã chốt, không thể thay đổi thứ tự hoặc nội dung nhóm.'
      );
    }

    const mainDepartment = resolveOvertimeMainDepartment(
      form.department,
      knownSubGroups
    );
    const updatedForm = await updateOvertimeFormInHistory(form, {
      department: mainDepartment,
      overtimeDate: form.overtime_date,
      blocks: nextBlocks,
      employees,
      knownSubGroups,
    });

    upsertFormInState(updatedForm);
    return updatedForm;
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
      if (isOvertimeFormLocked(freshForm)) {
        onShowToast?.(
          `Phiếu ${formatOvertimeFormCodeDisplay(
            freshForm.form_code
          )} đã chốt nên không thể sửa. Vui lòng mở khóa khẩn cấp nếu cần cập nhật.`
        );
        await loadForms({ silent: true });
        return;
      }
      setEditingForm(freshForm);
      handleSelectTab('create');
    } catch {
      if (isOvertimeFormLocked(form)) {
        onShowToast?.(
          `Phiếu ${formatOvertimeFormCodeDisplay(
            form.form_code
          )} đã chốt nên không thể sửa.`
        );
        return;
      }
      setEditingForm(form);
      handleSelectTab('create');
    }
  };

  const handleSaveForm = async (payload: CreateOvertimeFormPayload, isAutoSave?: boolean) => {
    if (!editingForm) {
      throw new Error(
        'Vui lòng tạo hoặc chọn một vỏ phiếu từ Nhật ký trước khi lưu chi tiết.'
      );
    }
    if (isOvertimeFormLocked(editingForm)) {
      throw new Error(
        'Phiếu tăng ca đã chốt, không thể chỉnh sửa hoặc lưu lại.'
      );
    }

    const mainDepartment = resolveOvertimeMainDepartment(
      payload.department || editingForm.department,
      knownSubGroups
    );

    const updated = await updateOvertimeFormInHistory(editingForm, {
      department: mainDepartment,
      overtimeDate: editingForm.overtime_date,
      blocks: payload.blocks,
      employees,
      knownSubGroups,
    });

    upsertFormInState(updated);

    onShowToast?.(
      `Đã cập nhật phiếu ${formatOvertimeFormCodeDisplay(
        updated.form_code
      )} (${formatNumberVN(updated.total_participants)} lượt • ${formatNumberVN(
        updated.total_hours
      )} giờ).`
    );

    if (!isAutoSave) {
      setEditingForm(null);
      setActiveTab('log');
    }
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
    setForms((prev) => prev.filter((f) => !deletedSet.has(f.id)));
  };

  const handleLockForm = async (form: OvertimeFormWithItems) => {
    const locked = await lockOvertimeForm(form.id);
    upsertFormInState(locked);
    onShowToast?.(
      `Đã chốt phiếu ${formatOvertimeFormCodeDisplay(
        locked.form_code
      )} (Ngày ${formatDateToFormStyle(
        locked.overtime_date
      )}). Dữ liệu đã được khóa và cập nhật vào báo cáo Giờ Tăng ca.`
    );
  };

  const handleUnlockForm = async (form: OvertimeFormWithItems) => {
    const unlocked = await unlockOvertimeForm(form);
    upsertFormInState(unlocked);
    onShowToast?.(
      `Đã mở khóa khẩn cấp phiếu ${formatOvertimeFormCodeDisplay(
        unlocked.form_code
      )}. Phiếu tạm thời không tính vào báo cáo Giờ Tăng ca cho đến khi chốt lại.`
    );
  };

  const activeFormsCount = forms.filter((f) => !f.deleted_at).length;
  const tabBaseClass =
    'h-9 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-2 border transition-all cursor-pointer whitespace-nowrap shrink-0';
  const tabActiveClass = 'bg-[#14539E] text-white border-[#14539E] shadow-xs';
  const tabInactiveClass =
    'bg-white text-slate-700 border-slate-300 hover:border-[#14539E] hover:text-[#14539E]';

  return (
    <div className="flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-slate-50">
      {/* 3-Tab Navigation Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0 no-print">
        <div
          role="tablist"
          aria-label="Phân hệ Tăng ca"
          className="inline-flex flex-wrap items-center gap-2 min-w-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'log'}
            onClick={() => handleSelectTab('log')}
            className={`${tabBaseClass} ${
              activeTab === 'log' ? tabActiveClass : tabInactiveClass
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
            onClick={() => handleSelectTab('create')}
            className={`${tabBaseClass} ${
              activeTab === 'create' ? tabActiveClass : tabInactiveClass
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

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'glossary'}
            onClick={() => handleSelectTab('glossary')}
            className={`${tabBaseClass} ${
              activeTab === 'glossary' ? tabActiveClass : tabInactiveClass
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Quản lý từ điển (Việt - Hàn)</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 shrink-0 whitespace-nowrap pr-1">
          Biểu mẫu chuẩn:{' '}
          <span className="font-mono font-semibold text-slate-700">
            TV-PSGC2022
          </span>
        </div>
      </div>

      {/* Tab 1: Nhật ký phiếu tăng ca */}
      {activeTab === 'log' && (
        <div className="flex-1 min-h-0 h-full overflow-y-auto lg:overflow-hidden p-3 flex flex-col print:h-auto print:overflow-visible print:p-0">
          <OvertimeLog
            forms={forms}
            employees={employees}
            groups={groups}
            leaveRecords={effectiveLeaveRecords}
            glossaryEntries={glossaryEntries}
            workShifts={workShifts}
            companyHolidays={companyHolidays}
            isLoading={isLoadingForms}
            schemaNeedsMigration={schemaNeedsMigration}
            onRefresh={() => loadForms({ silent: false })}
            onCreateOrOpenShell={(dateStr) =>
              handleCreateOrOpenShell(dateStr, { openInEditor: false })
            }
            onAppendBlocksToDate={handleAppendBlocksToDate}
            onUpdateFormBlocks={handleUpdateFormBlocks}
            onGlossaryEntriesUpdated={setGlossaryEntries}
            onLeaveRecordsRefreshed={setSupabaseLeaveRecords}
            onEdit={(form) => void handleStartEditForm(form)}
            onLockForm={handleLockForm}
            onUnlockForm={handleUnlockForm}
            onSoftDelete={handleSoftDeleteForms}
            onShowToast={onShowToast}
          />
        </div>
      )}

      {/* Tab 2: Biên tập chi tiết phiếu (giữ mount để không mất dữ liệu đang biên tập khi chuyển sang Quản lý từ điển) */}
      {editingForm ? (
        <div
          className={
            activeTab === 'create'
              ? 'flex-1 min-h-0 flex flex-col overflow-y-auto xl:overflow-hidden'
              : 'hidden'
          }
        >
          <CreateOvertimeForm
            key={editingForm.id}
            employees={employees}
            groups={groups}
            leaveRecords={effectiveLeaveRecords}
            existingForms={forms}
            isCheckingExistingForms={isLoadingForms}
            editingForm={editingForm}
            glossaryEntries={glossaryEntries}
            workShifts={workShifts}
            companyHolidays={companyHolidays}
            overtimeSettings={overtimeSettings}
            onGlossaryEntriesUpdated={setGlossaryEntries}
            onOpenExistingForm={(form) => void handleStartEditForm(form)}
            onCancelEdit={handleCancelEdit}
            onSaveOnly={handleSaveForm}
            isActiveForPrint={activeTab === 'create'}
          />
        </div>
      ) : (
        activeTab === 'create' && (
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
                      await handleCreateOrOpenShell(quickShellDate, {
                        openInEditor: true,
                      });
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
                  onClick={() => handleSelectTab('log')}
                  className="text-xs font-semibold text-[#14539E] hover:underline cursor-pointer"
                >
                  Quay lại Nhật ký phiếu tăng ca
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Tab 3: Quản lý từ điển (Việt - Hàn) toàn màn hình */}
      {activeTab === 'glossary' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-4">
          <GlossaryManagerModal
            isActive={activeTab === 'glossary'}
            groups={groups}
            entries={glossaryEntries}
            isLoading={isLoadingGlossary}
            onEntriesUpdated={setGlossaryEntries}
            onRefreshGlossary={handleRefreshGlossary}
            onShowToast={onShowToast}
          />
        </div>
      )}
    </div>
  );
};

export default OvertimeWorkspace;