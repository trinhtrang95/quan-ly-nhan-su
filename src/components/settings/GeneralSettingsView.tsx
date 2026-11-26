import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Database,
  Tag,
  Timer,
  X,
} from 'lucide-react';
import { DepartmentGroup, Employee } from '../../types/hr';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  CompanyHoliday,
  createDefaultAdminShift,
  DEFAULT_OVERTIME_SETTINGS,
  generateCompanyHolidaysForYear,
  HolidayGenerationPlan,
  HolidayType,
  OvertimeSettings,
  WorkShift,
} from '../../utils/workScheduleLogic';
import {
  addManualCompanyHoliday,
  applyRealtimeHolidayPayload,
  applyRealtimeWorkShiftPayload,
  deleteCompanyHoliday,
  deleteWorkShift,
  fetchCompanyHolidays,
  fetchOvertimeSettings,
  fetchWorkShifts,
  loadHolidayPlanForYear,
  mapSupabaseRowToOvertimeSettings,
  replaceGeneratedCompanyHolidays,
  saveHolidayPlanForYear,
  saveOvertimeSettings,
  saveWorkShift,
  setDefaultWorkShift,
  subscribeToCompanyHolidaysRealtime,
  subscribeToOvertimeSettingsRealtime,
  subscribeToWorkShiftsRealtime,
  SUPABASE_GENERAL_SETTINGS_SQL,
} from '../../services/settingsService';
import { CompanyHolidaysTab } from './CompanyHolidaysTab';
import { OvertimeSettingsTab } from './OvertimeSettingsTab';
import { WorkShiftsTab } from './WorkShiftsTab';
import { AttendanceSymbolsTab } from './AttendanceSymbolsTab';
import { useAttendanceSymbols } from '../../contexts/AttendanceSymbolsContext';

export type GeneralSettingsSubTab = 'shifts' | 'holidays' | 'overtime' | 'symbols';

export interface GeneralSettingsViewProps {
  groups: DepartmentGroup[];
  employees?: Employee[];
  activeCompanyId?: string | null;
  onShowToast?: (message: string) => void;
}

export const GeneralSettingsView: React.FC<GeneralSettingsViewProps> = ({
  groups,
  employees = [],
  activeCompanyId = null,
  onShowToast,
}) => {
  const currentYear = new Date().getFullYear();
  const [activeSubTab, setActiveSubTab] =
    useState<GeneralSettingsSubTab>('shifts');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState<boolean>(true);
  const [isSavingShift, setIsSavingShift] = useState<boolean>(false);

  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState<boolean>(true);
  const [isSavingHoliday, setIsSavingHoliday] = useState<boolean>(false);

  const [overtimeSettings, setOvertimeSettings] = useState<OvertimeSettings>(
    () => ({ ...DEFAULT_OVERTIME_SETTINGS })
  );
  const [isLoadingOvertimeSettings, setIsLoadingOvertimeSettings] =
    useState<boolean>(true);
  const [isSavingOvertimeSettings, setIsSavingOvertimeSettings] =
    useState<boolean>(false);

  const [plan, setPlan] = useState<HolidayGenerationPlan>(() =>
    loadHolidayPlanForYear(currentYear, activeCompanyId)
  );

  const {
    symbols,
    isLoading: isLoadingSymbols,
    isSaving: isSavingSymbols,
    schemaNeedsMigration: symbolsSchemaNeedsMigration,
    refreshSymbols,
    saveSymbol,
    removeSymbol,
  } = useAttendanceSymbols();

  const [schemaNeedsMigration, setSchemaNeedsMigration] =
    useState<boolean>(false);
  const effectiveSchemaNeedsMigration =
    schemaNeedsMigration || symbolsSchemaNeedsMigration;
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);

  const availableYears = useMemo(() => {
    const start = Math.min(2025, currentYear - 1);
    const end = Math.max(2030, currentYear + 3);
    const arr: number[] = [];
    for (let y = start; y <= end; y++) {
      arr.push(y);
    }
    return arr;
  }, [currentYear]);

  const loadShifts = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoadingShifts(true);
      try {
        const res = await fetchWorkShifts(activeCompanyId);
        setShifts(res.shifts);
        if (res.schemaNeedsMigration) {
          setSchemaNeedsMigration(true);
        }
      } finally {
        if (!silent) setIsLoadingShifts(false);
      }
    },
    [activeCompanyId]
  );

  const loadHolidays = useCallback(
    async (yearToLoad: number, silent = false) => {
      if (!silent) setIsLoadingHolidays(true);
      try {
        const res = await fetchCompanyHolidays(yearToLoad, activeCompanyId);
        setHolidays(res.holidays);
        if (res.schemaNeedsMigration) {
          setSchemaNeedsMigration(true);
        }
      } finally {
        if (!silent) setIsLoadingHolidays(false);
      }
    },
    [activeCompanyId]
  );

  // Sync holiday plan state whenever selectedYear or company changes
  useEffect(() => {
    setPlan(loadHolidayPlanForYear(selectedYear, activeCompanyId));
  }, [selectedYear, activeCompanyId]);

  // Initial load + Supabase Realtime subscription for work_shifts
  useEffect(() => {
    void loadShifts(false);

    const unsubscribe = subscribeToWorkShiftsRealtime((event) => {
      setShifts((prev) =>
        applyRealtimeWorkShiftPayload(prev, event, activeCompanyId)
      );
    });

    return () => {
      unsubscribe();
    };
  }, [loadShifts, activeCompanyId]);

  // Load holidays for selectedYear + Supabase Realtime subscription for company_holidays
  useEffect(() => {
    void loadHolidays(selectedYear, false);

    const unsubscribe = subscribeToCompanyHolidaysRealtime((event) => {
      setHolidays((prev) =>
        applyRealtimeHolidayPayload(prev, event, selectedYear, activeCompanyId)
      );
    });

    return () => {
      unsubscribe();
    };
  }, [loadHolidays, selectedYear, activeCompanyId]);

  const loadOvertimeSettings = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingOvertimeSettings(true);
    try {
      const res = await fetchOvertimeSettings();
      setOvertimeSettings(res.settings);
      if (res.schemaNeedsMigration) {
        setSchemaNeedsMigration(true);
      }
    } finally {
      if (!silent) setIsLoadingOvertimeSettings(false);
    }
  }, []);

  useEffect(() => {
    void loadOvertimeSettings(false);

    const unsubscribe = subscribeToOvertimeSettingsRealtime((event) => {
      if (event.eventType !== 'DELETE' && event.newRow) {
        const rowId =
          typeof event.newRow.id === 'string' ? event.newRow.id : 'default';
        if (rowId === 'default') {
          setOvertimeSettings(mapSupabaseRowToOvertimeSettings(event.newRow));
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadOvertimeSettings]);

  const defaultShift = useMemo(
    () =>
      shifts.find((s) => s.isDefault) ||
      shifts[0] ||
      createDefaultAdminShift(activeCompanyId),
    [shifts, activeCompanyId]
  );

  const handleSaveShift = async (
    shiftData: Omit<WorkShift, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    setIsSavingShift(true);
    try {
      const res = await saveWorkShift(shiftData, shifts, activeCompanyId);
      setShifts(res.shifts);
      if (res.schemaNeedsMigration) {
        setSchemaNeedsMigration(true);
      }
      onShowToast?.(
        res.source === 'supabase'
          ? `Đã lưu ca "${res.savedShift.code} - ${res.savedShift.name}" lên Cloud.`
          : `Đã lưu ca "${res.savedShift.code} - ${res.savedShift.name}" (chế độ cục bộ).`
      );
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleSetDefaultShift = async (shiftId: string) => {
    setIsSavingShift(true);
    try {
      const res = await setDefaultWorkShift(shiftId, shifts, activeCompanyId);
      setShifts(res.shifts);
      if (res.schemaNeedsMigration) {
        setSchemaNeedsMigration(true);
      }
      const chosen = res.shifts.find((s) => s.id === shiftId);
      onShowToast?.(
        `Đã đặt "${chosen?.code || ''} - ${chosen?.name || ''}" làm Ca mặc định toàn công ty.`
      );
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    setIsSavingShift(true);
    try {
      const target = shifts.find((s) => s.id === shiftId);
      const res = await deleteWorkShift(shiftId, shifts, activeCompanyId);
      setShifts(res.shifts);
      if (res.schemaNeedsMigration) {
        setSchemaNeedsMigration(true);
      }
      onShowToast?.(`Đã xóa ca làm việc "${target?.code || ''}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleChangePlan = (nextPlan: HolidayGenerationPlan) => {
    setPlan(nextPlan);
    saveHolidayPlanForYear(nextPlan, activeCompanyId);
  };

  const handleRegenerateByPlan = async (targetPlan: HolidayGenerationPlan) => {
    setIsSavingHoliday(true);
    try {
      saveHolidayPlanForYear(targetPlan, activeCompanyId);
      const generated = generateCompanyHolidaysForYear(
        targetPlan,
        defaultShift,
        holidays,
        activeCompanyId
      );
      const res = await replaceGeneratedCompanyHolidays(
        targetPlan.year,
        generated,
        activeCompanyId
      );
      setHolidays(res.holidays);
      if (res.schemaNeedsMigration) {
        setSchemaNeedsMigration(true);
      }
      const compCount = res.holidays.filter(
        (h) => h.holidayType === 'compensatory'
      ).length;
      onShowToast?.(
        `Đã tạo lịch nghỉ lễ năm ${targetPlan.year} (${res.holidays.length} ngày, gồm ${compCount} ngày nghỉ bù theo ca mặc định ${defaultShift.code}).`
      );
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleAddManualHoliday = async (input: {
    year: number;
    holidayDate: string;
    name: string;
    holidayType: HolidayType;
  }) => {
    setIsSavingHoliday(true);
    try {
      const res = await addManualCompanyHoliday(
        input,
        holidays,
        activeCompanyId
      );
      if (input.year === selectedYear) {
        setHolidays(res.holidays);
      } else {
        setSelectedYear(input.year);
      }
      if (res.schemaNeedsMigration) {
        setSchemaNeedsMigration(true);
      }
      onShowToast?.(`Đã thêm ngày "${input.name}" vào lịch năm ${input.year}.`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (holiday: CompanyHoliday) => {
    setIsSavingHoliday(true);
    try {
      const res = await deleteCompanyHoliday(
        holiday.id,
        selectedYear,
        holidays,
        activeCompanyId
      );
      setHolidays(res.holidays);
      if (res.schemaNeedsMigration) {
        setSchemaNeedsMigration(true);
      }
      onShowToast?.(`Đã xóa "${holiday.name}" khỏi lịch năm ${selectedYear}.`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleSaveOvertimeSettings = async (nextSettings: OvertimeSettings) => {
    setIsSavingOvertimeSettings(true);
    try {
      const res = await saveOvertimeSettings(nextSettings);
      setOvertimeSettings(res.settings);
      if (res.schemaNeedsMigration) {
        setSchemaNeedsMigration(true);
      }
      onShowToast?.(
        res.source === 'supabase'
          ? 'Đã lưu thiết lập làm thêm giờ lên Cloud.'
          : 'Đã lưu thiết lập làm thêm giờ (chế độ cục bộ).'
      );
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingOvertimeSettings(false);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_GENERAL_SETTINGS_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    } catch {
      onShowToast?.('Không thể sao chép tự động. Vui lòng chọn và copy đoạn SQL.');
    }
  };

  const tabBaseClass =
    'h-9 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-2 border transition-all cursor-pointer whitespace-nowrap shrink-0';
  const tabActiveClass = 'bg-[#14539E] text-white border-[#14539E] shadow-xs';
  const tabInactiveClass =
    'bg-white text-slate-700 border-slate-300 hover:border-[#14539E] hover:text-[#14539E]';

  return (
    <div className="flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-slate-50">
      {/* Top Sub-tabs Navigation Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div
          role="tablist"
          aria-label="Thiết lập chung nhân sự"
          className="inline-flex flex-wrap items-center gap-2 min-w-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'shifts'}
            onClick={() => setActiveSubTab('shifts')}
            className={`${tabBaseClass} ${
              activeSubTab === 'shifts' ? tabActiveClass : tabInactiveClass
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Ca làm việc</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'holidays'}
            onClick={() => setActiveSubTab('holidays')}
            className={`${tabBaseClass} ${
              activeSubTab === 'holidays' ? tabActiveClass : tabInactiveClass
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span>Lịch nghỉ lễ, tết</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'overtime'}
            onClick={() => setActiveSubTab('overtime')}
            className={`${tabBaseClass} ${
              activeSubTab === 'overtime' ? tabActiveClass : tabInactiveClass
            }`}
          >
            <Timer className="w-3.5 h-3.5 shrink-0" />
            <span>Làm thêm giờ</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'symbols'}
            onClick={() => setActiveSubTab('symbols')}
            className={`${tabBaseClass} ${
              activeSubTab === 'symbols' ? tabActiveClass : tabInactiveClass
            }`}
          >
            <Tag className="w-3.5 h-3.5 shrink-0" />
            <span>Ký hiệu công</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {effectiveSchemaNeedsMigration && (
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              className="h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Cài đặt bảng Supabase</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional Schema Notice Banner */}
      {effectiveSchemaNeedsMigration && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Bảng thiết lập (<code className="font-mono font-bold">work_shifts</code> /{' '}
              <code className="font-mono font-bold">company_holidays</code> /{' '}
              <code className="font-mono font-bold">attendance_symbols</code>) chưa
              được tạo trên Supabase (dữ liệu đang lưu tạm trên trình duyệt).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsSqlModalOpen(true)}
            className="text-xs font-bold text-[#14539E] hover:underline cursor-pointer"
          >
            Xem mã SQL khởi tạo
          </button>
        </div>
      )}

      {/* Main Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {activeSubTab === 'shifts' ? (
          <WorkShiftsTab
            shifts={shifts}
            groups={groups}
            isLoading={isLoadingShifts}
            isSaving={isSavingShift}
            onSaveShift={handleSaveShift}
            onSetDefaultShift={handleSetDefaultShift}
            onDeleteShift={handleDeleteShift}
          />
        ) : activeSubTab === 'holidays' ? (
          <CompanyHolidaysTab
            year={selectedYear}
            availableYears={availableYears}
            onChangeYear={setSelectedYear}
            defaultShift={defaultShift}
            holidays={holidays}
            plan={plan}
            isLoading={isLoadingHolidays}
            isSaving={isSavingHoliday}
            onChangePlan={handleChangePlan}
            onRegenerateByPlan={handleRegenerateByPlan}
            onAddManualHoliday={handleAddManualHoliday}
            onDeleteHoliday={handleDeleteHoliday}
          />
        ) : activeSubTab === 'overtime' ? (
          <OvertimeSettingsTab
            settings={overtimeSettings}
            shifts={shifts}
            employees={employees}
            isLoading={isLoadingOvertimeSettings}
            isSaving={isSavingOvertimeSettings}
            onSaveSettings={handleSaveOvertimeSettings}
          />
        ) : (
          <AttendanceSymbolsTab
            symbols={symbols}
            isLoading={isLoadingSymbols}
            isSaving={isSavingSymbols}
            onSaveSymbol={async (input) => {
              try {
                const res = await saveSymbol(input);
                onShowToast?.(
                  res.source === 'supabase'
                    ? `Đã lưu ký hiệu "${res.savedSymbol.code} - ${res.savedSymbol.name}" lên Cloud.`
                    : `Đã lưu ký hiệu "${res.savedSymbol.code} - ${res.savedSymbol.name}" (chế độ cục bộ).`
                );
              } catch (err) {
                onShowToast?.(getFriendlyErrorMessage(err));
              }
            }}
            onDeleteSymbol={async (symbolId) => {
              try {
                const target = symbols.find((s) => s.id === symbolId);
                await removeSymbol(symbolId);
                onShowToast?.(`Đã xóa ký hiệu "${target?.code || ''}".`);
              } catch (err) {
                onShowToast?.(getFriendlyErrorMessage(err));
              }
            }}
          />
        )}
      </div>

      {/* SQL Migration Modal */}
      {isSqlModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="general-settings-sql-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3
                id="general-settings-sql-title"
                className="text-sm font-bold text-slate-900"
              >
                Mã SQL khởi tạo bảng work_shifts &amp; company_holidays + Realtime
              </h3>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                aria-label="Đóng hộp thoại SQL"
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Sao chép đoạn SQL dưới đây và chạy trong{' '}
                <strong>Supabase SQL Editor</strong> để đồng bộ trực tiếp Ca làm
                việc và Lịch nghỉ lễ, tết cùng Supabase Realtime:
              </p>
              <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
                {SUPABASE_GENERAL_SETTINGS_SQL}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleCopySql()}
                className="h-9 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {sqlCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép SQL</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsSqlModalOpen(false);
                  setSchemaNeedsMigration(false);
                  await Promise.all([
                    loadShifts(false),
                    loadHolidays(selectedYear, false),
                    loadOvertimeSettings(false),
                    refreshSymbols(false),
                  ]);
                }}
                className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Kiểm tra lại kết nối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralSettingsView;
