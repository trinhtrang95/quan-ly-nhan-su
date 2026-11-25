import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Clock,
  Coffee,
  Loader2,
  Save,
  Utensils,
} from 'lucide-react';
import { Employee } from '../../types/hr';
import { formatNumberVN } from '../../utils/errorAndSecurityService';
import {
  createDefaultAdminShift,
  DEFAULT_OVERTIME_SETTINGS,
  OvertimeSettings,
  resolveWorkShiftForDepartment,
  simulateAttendanceAndOvertime,
  SimulatorDayType,
  WEEKDAY_ORDER,
  WeekdayKey,
  WorkShift,
} from '../../utils/workScheduleLogic';

export interface OvertimeSettingsTabProps {
  settings: OvertimeSettings;
  shifts: WorkShift[];
  employees?: Employee[];
  isLoading: boolean;
  isSaving: boolean;
  onSaveSettings: (nextSettings: OvertimeSettings) => Promise<void>;
}

const ROUNDING_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Không làm tròn' },
  { value: 15, label: '15 phút' },
  { value: 30, label: '30 phút' },
  { value: 60, label: '60 phút' },
];

function sanitizeTimeValue(raw: string, fallback: string): string {
  const cleaned = raw.trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hh = Math.min(23, Math.max(0, Number(match[1])));
  const mm = Math.min(59, Math.max(0, Number(match[2])));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return fallback;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const OvertimeSettingsTab: React.FC<OvertimeSettingsTabProps> = ({
  settings,
  shifts,
  employees = [],
  isLoading,
  isSaving,
  onSaveSettings,
}) => {
  const [draft, setDraft] = useState<OvertimeSettings>(() => settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const effectiveShifts = useMemo<WorkShift[]>(
    () => (shifts && shifts.length > 0 ? shifts : [createDefaultAdminShift()]),
    [shifts]
  );

  const defaultShift = useMemo(
    () => effectiveShifts.find((s) => s.isDefault) || effectiveShifts[0],
    [effectiveShifts]
  );

  // Simulator state
  const [simEmployeeId, setSimEmployeeId] = useState<string>('__SAMPLE__');
  const [simShiftId, setSimShiftId] = useState<string>(() => defaultShift.id);
  const [simWeekday, setSimWeekday] = useState<WeekdayKey>('wed');
  const [simDayType, setSimDayType] = useState<SimulatorDayType>('workday');
  const [simCheckIn, setSimCheckIn] = useState<string>(
    () => defaultShift.startTime || '07:30'
  );
  const [simCheckOut, setSimCheckOut] = useState<string>('19:40');

  // Keep selected shift valid when shifts load from Supabase
  useEffect(() => {
    if (!effectiveShifts.some((s) => s.id === simShiftId)) {
      setSimShiftId(defaultShift.id);
      setSimCheckIn(defaultShift.startTime || '07:30');
    }
  }, [effectiveShifts, simShiftId, defaultShift]);

  const selectedSimShift = useMemo(
    () =>
      effectiveShifts.find((s) => s.id === simShiftId) || defaultShift,
    [effectiveShifts, simShiftId, defaultShift]
  );

  const handleSelectSimEmployee = (empId: string) => {
    setSimEmployeeId(empId);
    if (empId !== '__SAMPLE__') {
      const emp = employees.find((e) => e.id === empId);
      if (emp?.department) {
        const matched = resolveWorkShiftForDepartment(effectiveShifts, emp.department);
        setSimShiftId(matched.id);
        setSimCheckIn(matched.startTime || '07:30');
      }
    }
  };

  const handleSelectSimWeekday = (nextDay: WeekdayKey) => {
    setSimWeekday(nextDay);
    const mode = selectedSimShift.workingDays?.[nextDay] ?? 'off';
    if (mode === 'off' && simDayType === 'workday') {
      setSimDayType('weekend');
    } else if (mode !== 'off' && simDayType === 'weekend') {
      setSimDayType('workday');
    }
  };

  const handleSelectSimDayType = (nextType: SimulatorDayType) => {
    setSimDayType(nextType);
    if (nextType === 'weekend' && (selectedSimShift.workingDays?.[simWeekday] ?? 'off') !== 'off') {
      setSimWeekday('sun');
    } else if (nextType === 'workday' && (selectedSimShift.workingDays?.[simWeekday] ?? 'off') === 'off') {
      setSimWeekday('wed');
    }
  };

  const simResult = useMemo(
    () =>
      simulateAttendanceAndOvertime({
        shift: selectedSimShift,
        weekdayKey: simWeekday,
        dayType: simDayType,
        checkIn: simCheckIn,
        checkOut: simCheckOut,
        settings: draft,
      }),
    [selectedSimShift, simWeekday, simDayType, simCheckIn, simCheckOut, draft]
  );

  const handleApplyPreset = (preset: {
    weekday: WeekdayKey;
    dayType: SimulatorDayType;
    checkIn: string;
    checkOut: string;
  }) => {
    setSimWeekday(preset.weekday);
    setSimDayType(preset.dayType);
    setSimCheckIn(preset.checkIn);
    setSimCheckOut(preset.checkOut);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(draft);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex items-center justify-center gap-2.5 text-xs font-medium text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
        <span>Đang tải thiết lập làm thêm giờ từ Cloud...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-4">
      {/* KHỐI TRÊN: THIẾT LẬP QUY ĐỊNH LÀM THÊM GIỜ */}
      <form
        onSubmit={(e) => void handleSave(e)}
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Thiết lập quy định Làm thêm giờ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cấu hình hệ số lương tăng ca, ngưỡng làm tròn và quy tắc trừ giờ ăn ca áp dụng toàn nhà máy.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Lưu thiết lập</span>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 1. Tỷ lệ hưởng lương */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="ot-rate-weekday"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mức trả – ngày thường (%)
              </label>
              <div className="relative">
                <input
                  id="ot-rate-weekday"
                  type="number"
                  min={100}
                  max={500}
                  step={5}
                  value={draft.weekday_rate}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      weekday_rate: Math.max(100, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-full h-9 pl-3 pr-9 text-xs font-mono font-semibold text-slate-900 tabular-nums rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  %
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="ot-rate-weekend"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mức trả – ngày nghỉ hằng tuần (%)
              </label>
              <div className="relative">
                <input
                  id="ot-rate-weekend"
                  type="number"
                  min={100}
                  max={500}
                  step={5}
                  value={draft.weekend_rate}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      weekend_rate: Math.max(100, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-full h-9 pl-3 pr-9 text-xs font-mono font-semibold text-slate-900 tabular-nums rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  %
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="ot-rate-holiday"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mức trả – ngày lễ, tết, nghỉ có hưởng lương (%)
              </label>
              <div className="relative">
                <input
                  id="ot-rate-holiday"
                  type="number"
                  min={100}
                  max={600}
                  step={5}
                  value={draft.holiday_rate}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      holiday_rate: Math.max(100, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-full h-9 pl-3 pr-9 text-xs font-mono font-semibold text-slate-900 tabular-nums rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* 2. Ngưỡng thời gian & Làm tròn + Chế độ tính */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ot-min-minutes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Tính làm thêm khi ra sau giờ ra từ
                </label>
                <div className="relative">
                  <input
                    id="ot-min-minutes"
                    type="number"
                    min={0}
                    max={240}
                    step={5}
                    value={draft.min_ot_minutes}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        min_ot_minutes: Math.max(0, Math.round(Number(e.target.value) || 0)),
                      }))
                    }
                    className="w-full h-9 pl-3 pr-12 text-xs font-mono font-semibold text-slate-900 tabular-nums rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    phút
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ot-rounding-minutes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Làm tròn xuống theo
                </label>
                <select
                  id="ot-rounding-minutes"
                  value={draft.rounding_minutes}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      rounding_minutes: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full h-9 px-3 text-xs font-medium text-slate-800 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
                >
                  {ROUNDING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-2.5">
              <div className="text-xs font-semibold text-slate-700">
                Chế độ ghi nhận tăng ca
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <label className="inline-flex items-center gap-2 text-xs text-slate-800 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="ot-auto-approve"
                    checked={draft.auto_approve_ot === true}
                    onChange={() =>
                      setDraft((prev) => ({ ...prev, auto_approve_ot: true }))
                    }
                    className="w-4 h-4 text-[#14539E] border-slate-300 focus:ring-[#14539E]"
                  />
                  <span className="font-medium">Mặc định tính tăng ca</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-slate-800 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="ot-auto-approve"
                    checked={draft.auto_approve_ot === false}
                    onChange={() =>
                      setDraft((prev) => ({ ...prev, auto_approve_ot: false }))
                    }
                    className="w-4 h-4 text-[#14539E] border-slate-300 focus:ring-[#14539E]"
                  />
                  <span className="font-medium">
                    Không mặc định tính (chỉ tính khi quản lý xác nhận)
                  </span>
                </label>
              </div>

              <label className="inline-flex items-start gap-2 text-xs text-slate-700 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={draft.weekend_is_ot_only}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      weekend_is_ot_only: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E]"
                />
                <span>
                  Đi làm ngày nghỉ hằng tuần tính là làm thêm giờ (trả ít nhất{' '}
                  <strong className="font-mono">{draft.weekend_rate}%</strong>),
                  không tính ngày công
                </span>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* 3. Chế độ nghỉ ăn ca khi tăng ca (3 quy tắc nhà máy) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#14539E]" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  Chế độ nghỉ ăn ca khi tăng ca (Quy định nhà máy)
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    dinner_break_rule: { ...DEFAULT_OVERTIME_SETTINGS.dinner_break_rule },
                    sunday_lunch_rule: { ...DEFAULT_OVERTIME_SETTINGS.sunday_lunch_rule },
                  }))
                }
                className="text-[11px] font-semibold text-[#14539E] hover:underline cursor-pointer"
              >
                Khôi phục mặc định nhà máy
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Rule 1: Tăng ca liên tục đến 19:10 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    1. Tăng ca liên tục đến {draft.dinner_break_rule.continuous_cutoff_time}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    0p trừ
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Tăng ca liên tục đến{' '}
                  <strong className="font-mono text-slate-800">
                    {draft.dinner_break_rule.continuous_cutoff_time}
                  </strong>{' '}
                  (VD 16:10 – {draft.dinner_break_rule.continuous_cutoff_time}):{' '}
                  <strong className="text-slate-900">Không trừ giờ ăn tối.</strong>
                </p>
                <div className="pt-1 flex items-center justify-between gap-2 text-[11px]">
                  <label
                    htmlFor="ot-dinner-cutoff"
                    className="text-slate-600 font-medium"
                  >
                    Mốc kết thúc liên tục
                  </label>
                  <input
                    id="ot-dinner-cutoff"
                    type="text"
                    maxLength={5}
                    value={draft.dinner_break_rule.continuous_cutoff_time}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        dinner_break_rule: {
                          ...prev.dinner_break_rule,
                          continuous_cutoff_time: e.target.value,
                        },
                      }))
                    }
                    onBlur={() =>
                      setDraft((prev) => ({
                        ...prev,
                        dinner_break_rule: {
                          ...prev.dinner_break_rule,
                          continuous_cutoff_time: sanitizeTimeValue(
                            prev.dinner_break_rule.continuous_cutoff_time,
                            '19:10'
                          ),
                        },
                      }))
                    }
                    className="w-16 h-7 px-2 text-xs font-mono font-semibold text-center rounded border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                  />
                </div>
              </div>

              {/* Rule 2: Tăng ca từ 19:40 trở đi */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={draft.dinner_break_rule.enabled}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          dinner_break_rule: {
                            ...prev.dinner_break_rule,
                            enabled: e.target.checked,
                          },
                        }))
                      }
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E]"
                    />
                    <span>
                      2. Tăng ca từ {draft.dinner_break_rule.threshold_end_time} trở đi
                    </span>
                  </label>
                  <span className="text-[11px] font-mono font-semibold text-[#14539E] tabular-nums">
                    -{draft.dinner_break_rule.deduct_minutes}p
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Trừ{' '}
                  <strong className="font-mono text-slate-800">
                    {draft.dinner_break_rule.deduct_minutes} phút
                  </strong>{' '}
                  nghỉ ăn tối ({draft.dinner_break_rule.break_start} –{' '}
                  {draft.dinner_break_rule.break_end}).
                </p>
                <div className="pt-1 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between gap-1">
                    <label htmlFor="ot-dinner-threshold" className="text-slate-600">
                      Từ giờ
                    </label>
                    <input
                      id="ot-dinner-threshold"
                      type="text"
                      maxLength={5}
                      value={draft.dinner_break_rule.threshold_end_time}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          dinner_break_rule: {
                            ...prev.dinner_break_rule,
                            threshold_end_time: e.target.value,
                          },
                        }))
                      }
                      onBlur={() =>
                        setDraft((prev) => ({
                          ...prev,
                          dinner_break_rule: {
                            ...prev.dinner_break_rule,
                            threshold_end_time: sanitizeTimeValue(
                              prev.dinner_break_rule.threshold_end_time,
                              '19:40'
                            ),
                          },
                        }))
                      }
                      className="w-14 h-7 px-1 text-xs font-mono text-center rounded border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <label htmlFor="ot-dinner-minutes" className="text-slate-600">
                      Trừ (phút)
                    </label>
                    <input
                      id="ot-dinner-minutes"
                      type="number"
                      min={0}
                      max={120}
                      value={draft.dinner_break_rule.deduct_minutes}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          dinner_break_rule: {
                            ...prev.dinner_break_rule,
                            deduct_minutes: Math.max(
                              0,
                              Math.round(Number(e.target.value) || 0)
                            ),
                          },
                        }))
                      }
                      className="w-14 h-7 px-1 text-xs font-mono text-center rounded border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-1">
                    <span className="text-slate-600">Khung ăn tối</span>
                    <div className="inline-flex items-center gap-1">
                      <input
                        aria-label="Khung ăn tối từ"
                        type="text"
                        maxLength={5}
                        value={draft.dinner_break_rule.break_start}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            dinner_break_rule: {
                              ...prev.dinner_break_rule,
                              break_start: e.target.value,
                            },
                          }))
                        }
                        onBlur={() =>
                          setDraft((prev) => ({
                            ...prev,
                            dinner_break_rule: {
                              ...prev.dinner_break_rule,
                              break_start: sanitizeTimeValue(
                                prev.dinner_break_rule.break_start,
                                '18:10'
                              ),
                            },
                          }))
                        }
                        className="w-14 h-7 px-1 text-xs font-mono text-center rounded border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        aria-label="Khung ăn tối đến"
                        type="text"
                        maxLength={5}
                        value={draft.dinner_break_rule.break_end}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            dinner_break_rule: {
                              ...prev.dinner_break_rule,
                              break_end: e.target.value,
                            },
                          }))
                        }
                        onBlur={() =>
                          setDraft((prev) => ({
                            ...prev,
                            dinner_break_rule: {
                              ...prev.dinner_break_rule,
                              break_end: sanitizeTimeValue(
                                prev.dinner_break_rule.break_end,
                                '18:40'
                              ),
                            },
                          }))
                        }
                        className="w-14 h-7 px-1 text-xs font-mono text-center rounded border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rule 3: Tăng ca Chủ nhật / Ngày nghỉ hằng tuần */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={draft.sunday_lunch_rule.enabled}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          sunday_lunch_rule: {
                            ...prev.sunday_lunch_rule,
                            enabled: e.target.checked,
                          },
                        }))
                      }
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E]"
                    />
                    <span>3. Chủ nhật / Ngày nghỉ hằng tuần</span>
                  </label>
                  <span className="text-[11px] font-mono font-semibold text-[#14539E] tabular-nums">
                    -{draft.sunday_lunch_rule.deduct_minutes}p
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Trừ{' '}
                  <strong className="font-mono text-slate-800">
                    {draft.sunday_lunch_rule.deduct_minutes} phút
                  </strong>{' '}
                  nghỉ ăn trưa ({draft.sunday_lunch_rule.break_start} –{' '}
                  {draft.sunday_lunch_rule.break_end}) nếu làm qua trưa, và áp dụng
                  quy tắc ăn tối{' '}
                  <strong className="font-mono text-slate-800">
                    {draft.dinner_break_rule.deduct_minutes} phút
                  </strong>{' '}
                  nếu làm từ {draft.dinner_break_rule.threshold_end_time} trở đi.
                </p>
                <div className="pt-1 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-1">
                    <label htmlFor="ot-lunch-minutes" className="text-slate-600">
                      Trừ ăn trưa (phút)
                    </label>
                    <input
                      id="ot-lunch-minutes"
                      type="number"
                      min={0}
                      max={180}
                      value={draft.sunday_lunch_rule.deduct_minutes}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          sunday_lunch_rule: {
                            ...prev.sunday_lunch_rule,
                            deduct_minutes: Math.max(
                              0,
                              Math.round(Number(e.target.value) || 0)
                            ),
                          },
                        }))
                      }
                      className="w-16 h-7 px-1 text-xs font-mono text-center rounded border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-600">Khung ăn trưa</span>
                    <div className="inline-flex items-center gap-1">
                      <input
                        aria-label="Khung ăn trưa từ"
                        type="text"
                        maxLength={5}
                        value={draft.sunday_lunch_rule.break_start}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            sunday_lunch_rule: {
                              ...prev.sunday_lunch_rule,
                              break_start: e.target.value,
                            },
                          }))
                        }
                        onBlur={() =>
                          setDraft((prev) => ({
                            ...prev,
                            sunday_lunch_rule: {
                              ...prev.sunday_lunch_rule,
                              break_start: sanitizeTimeValue(
                                prev.sunday_lunch_rule.break_start,
                                '12:00'
                              ),
                            },
                          }))
                        }
                        className="w-14 h-7 px-1 text-xs font-mono text-center rounded border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        aria-label="Khung ăn trưa đến"
                        type="text"
                        maxLength={5}
                        value={draft.sunday_lunch_rule.break_end}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            sunday_lunch_rule: {
                              ...prev.sunday_lunch_rule,
                              break_end: e.target.value,
                            },
                          }))
                        }
                        onBlur={() =>
                          setDraft((prev) => ({
                            ...prev,
                            sunday_lunch_rule: {
                              ...prev.sunday_lunch_rule,
                              break_end: sanitizeTimeValue(
                                prev.sunday_lunch_rule.break_end,
                                '12:40'
                              ),
                            },
                          }))
                        }
                        className="w-14 h-7 px-1 text-xs font-mono text-center rounded border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* KHỐI DƯỚI: XEM THỬ CÁCH TÍNH */}
      <section
        aria-label="Xem thử cách tính làm thêm giờ"
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#14539E]" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Xem thử cách tính
              </h2>
              <p className="text-xs text-slate-500">
                Mô phỏng realtime công thức chấm công và giờ làm thêm theo thiết lập bên trên.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                handleApplyPreset({
                  weekday: 'wed',
                  dayType: 'workday',
                  checkIn: selectedSimShift.startTime || '07:30',
                  checkOut: '19:10',
                })
              }
              className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#14539E] hover:text-[#14539E] text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              Thử đến 19:10
            </button>
            <button
              type="button"
              onClick={() =>
                handleApplyPreset({
                  weekday: 'wed',
                  dayType: 'workday',
                  checkIn: selectedSimShift.startTime || '07:30',
                  checkOut: '19:40',
                })
              }
              className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#14539E] hover:text-[#14539E] text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              Thử đến 19:40
            </button>
            <button
              type="button"
              onClick={() =>
                handleApplyPreset({
                  weekday: 'sun',
                  dayType: 'weekend',
                  checkIn: selectedSimShift.startTime || '07:30',
                  checkOut: selectedSimShift.endTime || '16:10',
                })
              }
              className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#14539E] hover:text-[#14539E] text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              Thử CN qua trưa
            </button>
            <button
              type="button"
              onClick={() =>
                handleApplyPreset({
                  weekday: 'sun',
                  dayType: 'weekend',
                  checkIn: selectedSimShift.startTime || '07:30',
                  checkOut: '19:40',
                })
              }
              className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#14539E] hover:text-[#14539E] text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              Thử CN đến 19:40
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Thanh chọn thử nghiệm */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label
                htmlFor="ot-sim-employee"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Nhân sự
              </label>
              <select
                id="ot-sim-employee"
                value={simEmployeeId}
                onChange={(e) => handleSelectSimEmployee(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-medium text-slate-800 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                <option value="__SAMPLE__">Nhân sự mẫu</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode ? `${emp.employeeCode} – ` : ''}
                    {emp.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ot-sim-shift"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Ca làm việc
              </label>
              <select
                id="ot-sim-shift"
                value={selectedSimShift.id}
                onChange={(e) => {
                  const found = effectiveShifts.find((s) => s.id === e.target.value);
                  setSimShiftId(e.target.value);
                  if (found) {
                    setSimCheckIn(found.startTime);
                  }
                }}
                className="w-full h-9 px-2.5 text-xs font-medium text-slate-800 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {effectiveShifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.code} – {shift.name} ({shift.startTime}–{shift.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ot-sim-weekday"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Thứ
              </label>
              <select
                id="ot-sim-weekday"
                value={simWeekday}
                onChange={(e) => handleSelectSimWeekday(e.target.value as WeekdayKey)}
                className="w-full h-9 px-2.5 text-xs font-medium text-slate-800 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {WEEKDAY_ORDER.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.fullLabel} ({w.shortLabel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ot-sim-day-type"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Loại ngày
              </label>
              <select
                id="ot-sim-day-type"
                value={simDayType}
                onChange={(e) =>
                  handleSelectSimDayType(e.target.value as SimulatorDayType)
                }
                className="w-full h-9 px-2.5 text-xs font-medium text-slate-800 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                <option value="workday">Ngày làm việc</option>
                <option value="weekend">Ngày nghỉ hằng tuần / Chủ nhật</option>
                <option value="holiday">Ngày lễ, tết</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="ot-sim-checkin"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Giờ vào
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="ot-sim-checkin"
                  type="time"
                  value={simCheckIn}
                  onChange={(e) => setSimCheckIn(e.target.value)}
                  className="w-full h-9 pl-8 pr-2 text-xs font-mono font-semibold text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="ot-sim-checkout"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Giờ ra
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="ot-sim-checkout"
                  type="time"
                  value={simCheckOut}
                  onChange={(e) => setSimCheckOut(e.target.value)}
                  className="w-full h-9 pl-8 pr-2 text-xs font-mono font-semibold text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>
          </div>

          {/* 7 thẻ kết quả tự động tính realtime */}
          <div
            data-testid="ot-simulator-kpi-grid"
            className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5"
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">Ký hiệu</div>
              <div
                data-testid="ot-sim-symbol"
                className="text-lg font-bold text-[#14539E] font-mono mt-0.5 tabular-nums"
              >
                {simResult.symbol}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">Ngày công</div>
              <div
                data-testid="ot-sim-workdays"
                className="text-lg font-bold text-slate-900 font-mono mt-0.5 tabular-nums"
              >
                {formatNumberVN(simResult.workdays)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">
                Giờ làm trong ca
              </div>
              <div
                data-testid="ot-sim-inshift"
                className="text-lg font-bold text-slate-900 font-mono mt-0.5 tabular-nums"
              >
                {formatNumberVN(simResult.inShiftHours)} giờ
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">Đi muộn</div>
              <div
                data-testid="ot-sim-late"
                className={`text-lg font-bold font-mono mt-0.5 tabular-nums ${
                  simResult.lateMinutes > 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {formatNumberVN(simResult.lateMinutes)} phút
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">Về sớm</div>
              <div
                data-testid="ot-sim-early"
                className={`text-lg font-bold font-mono mt-0.5 tabular-nums ${
                  simResult.earlyLeaveMinutes > 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {formatNumberVN(simResult.earlyLeaveMinutes)} phút
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">
                Giờ làm đêm
              </div>
              <div
                data-testid="ot-sim-night"
                className="text-lg font-bold text-slate-900 font-mono mt-0.5 tabular-nums"
              >
                {formatNumberVN(simResult.nightHours)} giờ
              </div>
            </div>

            <div className="col-span-2 rounded-xl border border-[#14539E]/30 bg-blue-50/60 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#14539E]">
                  Làm thêm
                </span>
                {simResult.mealDeductionNote && (
                  <span className="text-[10px] font-medium text-slate-600 inline-flex items-center gap-1">
                    <Coffee className="w-3 h-3 text-[#14539E]" />
                    {simResult.mealDeductionNote}
                  </span>
                )}
              </div>
              <div
                data-testid="ot-sim-overtime"
                className="text-base sm:text-lg font-bold text-[#14539E] font-mono mt-0.5 tabular-nums"
              >
                {formatNumberVN(simResult.otHours)} giờ · ×{' '}
                {formatNumberVN(simResult.otRatePercent)}% ={' '}
                {formatNumberVN(simResult.convertedSalaryHours)} giờ lương
              </div>
              {simResult.requiresConfirmation && simResult.rawOtHours > 0 && (
                <div className="text-[10px] text-amber-800 font-medium mt-0.5">
                  Chờ quản lý xác nhận ({formatNumberVN(simResult.rawOtHours)} giờ dự kiến)
                </div>
              )}
            </div>
          </div>

          {/* Giải thích chi tiết (bullet points) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#14539E]" />
              <span>Chi tiết quy tắc tính đang áp dụng</span>
            </div>
            <ul
              data-testid="ot-sim-explanations"
              className="list-disc pl-5 space-y-1 text-xs text-slate-700 leading-relaxed"
            >
              {simResult.explanations.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OvertimeSettingsTab;
