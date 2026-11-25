import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Info,
  Lock,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { DepartmentGroup } from '../../types/hr';
import { formatNumberVN } from '../../utils/errorAndSecurityService';
import {
  calculateShiftMetrics,
  DayOverridesMap,
  DEFAULT_WORKING_DAYS,
  getNextWeekdayMode,
  normalize24hTime,
  normalizeOptional24hTime,
  parseTimeToMinutes,
  sanitize24hTimeInput,
  SHIFT_COLOR_OPTIONS,
  WEEKDAY_MODE_LABELS,
  WEEKDAY_ORDER,
  WeekdayKey,
  WeekdayWorkMode,
  WorkingDaysMap,
  WorkShift,
} from '../../utils/workScheduleLogic';

export interface WorkShiftModalProps {
  isOpen: boolean;
  editingShift: WorkShift | null;
  existingShifts: WorkShift[];
  groups: DepartmentGroup[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (
    shiftData: Omit<WorkShift, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onSetDefault?: (shiftId: string) => Promise<void>;
  onDelete?: (shiftId: string) => Promise<void>;
}

const MODE_BUTTON_STYLES: Record<WeekdayWorkMode, string> = {
  full_day:
    'bg-[#14539E] text-white border-[#14539E] hover:bg-[#0F3E77] shadow-2xs',
  morning:
    'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100',
  biweekly:
    'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100',
  off: 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/70',
};

export const WorkShiftModal: React.FC<WorkShiftModalProps> = ({
  isOpen,
  editingShift,
  existingShifts,
  groups,
  isSaving,
  onClose,
  onSave,
  onSetDefault,
  onDelete,
}) => {
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [breakStart, setBreakStart] = useState<string>('12:00');
  const [breakEnd, setBreakEnd] = useState<string>('13:00');
  const [workingDays, setWorkingDays] = useState<WorkingDaysMap>({
    ...DEFAULT_WORKING_DAYS,
  });
  const [dayOverrides, setDayOverrides] = useState<DayOverridesMap>({});
  const [earlyMinutes, setEarlyMinutes] = useState<number>(0);
  const [color, setColor] = useState<string>('#14539E');
  const [hourlyRatePercent, setHourlyRatePercent] = useState<number>(100);
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [departmentNames, setDepartmentNames] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsConfirmingDelete(false);

    if (editingShift) {
      setCode(editingShift.code);
      setName(editingShift.name);
      setStartTime(normalize24hTime(editingShift.startTime || '08:00', '08:00'));
      setEndTime(normalize24hTime(editingShift.endTime || '17:00', '17:00'));
      setBreakStart(normalizeOptional24hTime(editingShift.breakStart || ''));
      setBreakEnd(normalizeOptional24hTime(editingShift.breakEnd || ''));
      setWorkingDays({ ...DEFAULT_WORKING_DAYS, ...editingShift.workingDays });
      const normalizedOverrides: DayOverridesMap = {};
      if (editingShift.dayOverrides) {
        for (const [k, ov] of Object.entries(editingShift.dayOverrides)) {
          if (!ov) continue;
          const st = normalizeOptional24hTime(ov.startTime || '');
          const et = normalizeOptional24hTime(ov.endTime || '');
          const bs = normalizeOptional24hTime(ov.breakStart || '');
          const be = normalizeOptional24hTime(ov.breakEnd || '');
          if (st || et || bs || be) {
            normalizedOverrides[k as WeekdayKey] = {
              ...(st ? { startTime: st } : {}),
              ...(et ? { endTime: et } : {}),
              ...(bs ? { breakStart: bs } : {}),
              ...(be ? { breakEnd: be } : {}),
            };
          }
        }
      }
      setDayOverrides(normalizedOverrides);
      setEarlyMinutes(editingShift.earlyMinutes ?? 0);
      setColor(editingShift.color || '#14539E');
      setHourlyRatePercent(editingShift.hourlyRatePercent ?? 100);
      setIsDefault(Boolean(editingShift.isDefault));
      setDepartmentNames([...(editingShift.departmentNames || [])]);
    } else {
      const nextNum = existingShifts.length + 1;
      setCode(`CA${nextNum}`);
      setName('');
      setStartTime('08:00');
      setEndTime('17:00');
      setBreakStart('12:00');
      setBreakEnd('13:00');
      setWorkingDays({ ...DEFAULT_WORKING_DAYS });
      setDayOverrides({});
      setEarlyMinutes(0);
      setColor(
        SHIFT_COLOR_OPTIONS[nextNum % SHIFT_COLOR_OPTIONS.length] || '#14539E'
      );
      setHourlyRatePercent(100);
      setIsDefault(existingShifts.length === 0);
      setDepartmentNames([]);
    }
  }, [isOpen, editingShift, existingShifts.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isSaving, onClose]);

  const liveMetrics = useMemo(
    () =>
      calculateShiftMetrics({
        startTime,
        endTime,
        breakStart,
        breakEnd,
        workingDays,
        dayOverrides,
      }),
    [startTime, endTime, breakStart, breakEnd, workingDays, dayOverrides]
  );

  const activeWeekdays = useMemo(
    () => WEEKDAY_ORDER.filter((d) => workingDays[d.key] !== 'off'),
    [workingDays]
  );

  const departmentOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: DepartmentGroup[] = [];
    for (const g of groups) {
      const clean = (g.name || '').trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(g);
    }
    return list;
  }, [groups]);

  if (!isOpen) return null;

  const handleCycleWeekday = (key: WeekdayKey) => {
    setWorkingDays((prev) => ({
      ...prev,
      [key]: getNextWeekdayMode(prev[key]),
    }));
  };

  const handleOverrideChange = (
    dayKey: WeekdayKey,
    field: 'startTime' | 'endTime' | 'breakStart' | 'breakEnd',
    value: string
  ) => {
    setDayOverrides((prev) => {
      const current = prev[dayKey] || {};
      const nextDay = { ...current, [field]: value };
      if (
        !nextDay.startTime &&
        !nextDay.endTime &&
        !nextDay.breakStart &&
        !nextDay.breakEnd
      ) {
        const clone = { ...prev };
        delete clone[dayKey];
        return clone;
      }
      return {
        ...prev,
        [dayKey]: nextDay,
      };
    });
  };

  const handleToggleDepartment = (deptName: string) => {
    const key = deptName.trim().toLowerCase();
    setDepartmentNames((prev) => {
      const exists = prev.some((d) => d.trim().toLowerCase() === key);
      if (exists) {
        return prev.filter((d) => d.trim().toLowerCase() !== key);
      }
      return [...prev, deptName.trim()];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      setErrorMsg('Vui lòng nhập Mã ca.');
      return;
    }
    if (!cleanName) {
      setErrorMsg('Vui lòng nhập Tên ca.');
      return;
    }
    const cleanStartTime = normalize24hTime(startTime, '');
    const cleanEndTime = normalize24hTime(endTime, '');
    const cleanBreakStart = normalizeOptional24hTime(breakStart);
    const cleanBreakEnd = normalizeOptional24hTime(breakEnd);

    if (
      parseTimeToMinutes(cleanStartTime) === null ||
      parseTimeToMinutes(cleanEndTime) === null
    ) {
      setErrorMsg('Vui lòng nhập đầy đủ Giờ vào và Giờ ra theo chuẩn 24 giờ (HH:mm).');
      return;
    }

    const cleanOverrides: DayOverridesMap = {};
    for (const [k, ov] of Object.entries(dayOverrides)) {
      if (!ov) continue;
      const st = normalizeOptional24hTime(ov.startTime || '');
      const et = normalizeOptional24hTime(ov.endTime || '');
      const bs = normalizeOptional24hTime(ov.breakStart || '');
      const be = normalizeOptional24hTime(ov.breakEnd || '');
      if (st || et || bs || be) {
        cleanOverrides[k as WeekdayKey] = {
          ...(st ? { startTime: st } : {}),
          ...(et ? { endTime: et } : {}),
          ...(bs ? { breakStart: bs } : {}),
          ...(be ? { breakEnd: be } : {}),
        };
      }
    }

    const dup = existingShifts.find(
      (s) =>
        s.id !== editingShift?.id &&
        s.code.trim().toUpperCase() === cleanCode
    );
    if (dup) {
      setErrorMsg(`Mã ca "${cleanCode}" đã tồn tại. Vui lòng chọn mã ca khác.`);
      return;
    }

    setErrorMsg(null);
    await onSave({
      id: editingShift?.id,
      companyId: editingShift?.companyId ?? null,
      code: cleanCode,
      name: cleanName,
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      breakStart: cleanBreakStart,
      breakEnd: cleanBreakEnd,
      workingDays,
      dayOverrides: cleanOverrides,
      earlyMinutes: Math.max(0, Math.round(Number(earlyMinutes || 0))),
      color: color || '#14539E',
      hourlyRatePercent: Math.max(0, Number(hourlyRatePercent || 100)),
      standardDailyHours: liveMetrics.standardDailyHours,
      weeklyHours: liveMetrics.weeklyHours,
      isDefault,
      departmentNames: isDefault ? [] : departmentNames,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-shift-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: color || '#14539E' }}
            >
              {code.trim().toUpperCase() || 'CA'}
            </span>
            <div className="min-w-0">
              <h3
                id="work-shift-modal-title"
                className="text-sm font-bold text-slate-900 truncate"
              >
                {editingShift ? 'Cập nhật Ca làm việc' : 'Thêm Ca làm việc mới'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Thiết lập khung giờ chuẩn, lịch làm việc trong tuần và phạm vi phòng ban
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {editingShift && !isDefault && onSetDefault && (
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  await onSetDefault(editingShift.id);
                  setIsDefault(true);
                  setDepartmentNames([]);
                }}
                className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Star className="w-3.5 h-3.5" />
                <span>Đặt làm ca mặc định</span>
              </button>
            )}
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              aria-label="Đóng cửa sổ"
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Body + Sticky Footer */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Row 1: Code, Name, Shift Times, Break Times */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-3">
              <label
                htmlFor="shift-code-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mã ca <span className="text-red-500">*</span>
              </label>
              <input
                id="shift-code-input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: HC"
                maxLength={12}
                required
                className="w-full h-9 px-3 text-xs font-mono font-bold uppercase text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            <div className="sm:col-span-9">
              <label
                htmlFor="shift-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Tên ca <span className="text-red-500">*</span>
              </label>
              <input
                id="shift-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Ca hành chính"
                required
                className="w-full h-9 px-3 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="shift-start-time"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Giờ vào <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="shift-start-time"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="08:00"
                  value={startTime}
                  onChange={(e) => setStartTime(sanitize24hTimeInput(e.target.value))}
                  onBlur={() => setStartTime((prev) => normalize24hTime(prev, '08:00'))}
                  required
                  className="w-full h-9 pl-8 pr-2.5 text-xs font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="shift-end-time"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Giờ ra <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="shift-end-time"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="17:00"
                  value={endTime}
                  onChange={(e) => setEndTime(sanitize24hTimeInput(e.target.value))}
                  onBlur={() => setEndTime((prev) => normalize24hTime(prev, '17:00'))}
                  required
                  className="w-full h-9 pl-8 pr-2.5 text-xs font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>

            <div className="sm:col-span-6">
              <span className="block text-xs font-semibold text-slate-700 mb-1">
                Nghỉ giữa ca (từ – đến)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="12:00"
                  value={breakStart}
                  onChange={(e) => setBreakStart(sanitize24hTimeInput(e.target.value))}
                  onBlur={() => setBreakStart((prev) => normalizeOptional24hTime(prev))}
                  aria-label="Nghỉ giữa ca từ"
                  className="w-full h-9 px-2.5 text-xs font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="13:00"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(sanitize24hTimeInput(e.target.value))}
                  onBlur={() => setBreakEnd((prev) => normalizeOptional24hTime(prev))}
                  aria-label="Nghỉ giữa ca đến"
                  className="w-full h-9 px-2.5 text-xs font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Working Days in Week (7 cycling buttons) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                Ngày làm việc trong tuần
              </span>
              <span className="text-[11px] text-slate-500">
                Bấm từng thứ để xoay vòng: Cả ngày → Buổi sáng → Cách tuần → Nghỉ
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {WEEKDAY_ORDER.map((day) => {
                const mode = workingDays[day.key];
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => handleCycleWeekday(day.key)}
                    aria-label={`${day.fullLabel}: ${WEEKDAY_MODE_LABELS[mode]}. Bấm để đổi trạng thái`}
                    className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${MODE_BUTTON_STYLES[mode]}`}
                  >
                    <span className="text-xs font-bold">{day.shortLabel}</span>
                    <span className="text-[10px] font-medium leading-tight">
                      {WEEKDAY_MODE_LABELS[mode]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Per-day overrides table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                Giờ khác theo ngày
              </span>
              <span className="text-[11px] text-slate-500">
                Để trống nếu theo giờ chung ({startTime || '--:--'} –{' '}
                {endTime || '--:--'})
              </span>
            </div>

            {activeWeekdays.length === 0 ? (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
                Chưa chọn ngày làm việc nào trong tuần.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Thứ</th>
                      <th className="py-2 px-2.5">Giờ vào</th>
                      <th className="py-2 px-2.5">Giờ ra</th>
                      <th className="py-2 px-2.5">Nghỉ từ</th>
                      <th className="py-2 px-2.5">Nghỉ đến</th>
                      <th className="py-2 px-2 text-center w-16">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeWeekdays.map((day) => {
                      const ov = dayOverrides[day.key] || {};
                      const hasOverride = Boolean(
                        ov.startTime || ov.endTime || ov.breakStart || ov.breakEnd
                      );
                      return (
                        <tr key={day.key} className="hover:bg-slate-50/70">
                          <td className="py-1.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                            <span>{day.shortLabel}</span>
                            <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                              ({WEEKDAY_MODE_LABELS[workingDays[day.key]]})
                            </span>
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={5}
                              placeholder={startTime || '08:00'}
                              value={ov.startTime || ''}
                              onChange={(e) =>
                                handleOverrideChange(
                                  day.key,
                                  'startTime',
                                  sanitize24hTimeInput(e.target.value)
                                )
                              }
                              onBlur={(e) =>
                                handleOverrideChange(
                                  day.key,
                                  'startTime',
                                  normalizeOptional24hTime(e.target.value)
                                )
                              }
                              aria-label={`Giờ vào riêng ${day.fullLabel}`}
                              className="w-20 h-7 px-2 text-xs font-mono text-center rounded border border-slate-200 bg-white focus:border-[#14539E] focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={5}
                              placeholder={endTime || '17:00'}
                              value={ov.endTime || ''}
                              onChange={(e) =>
                                handleOverrideChange(
                                  day.key,
                                  'endTime',
                                  sanitize24hTimeInput(e.target.value)
                                )
                              }
                              onBlur={(e) =>
                                handleOverrideChange(
                                  day.key,
                                  'endTime',
                                  normalizeOptional24hTime(e.target.value)
                                )
                              }
                              aria-label={`Giờ ra riêng ${day.fullLabel}`}
                              className="w-20 h-7 px-2 text-xs font-mono text-center rounded border border-slate-200 bg-white focus:border-[#14539E] focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={5}
                              placeholder={breakStart || '--:--'}
                              value={ov.breakStart || ''}
                              onChange={(e) =>
                                handleOverrideChange(
                                  day.key,
                                  'breakStart',
                                  sanitize24hTimeInput(e.target.value)
                                )
                              }
                              onBlur={(e) =>
                                handleOverrideChange(
                                  day.key,
                                  'breakStart',
                                  normalizeOptional24hTime(e.target.value)
                                )
                              }
                              aria-label={`Nghỉ từ riêng ${day.fullLabel}`}
                              className="w-20 h-7 px-2 text-xs font-mono text-center rounded border border-slate-200 bg-white focus:border-[#14539E] focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={5}
                              placeholder={breakEnd || '--:--'}
                              value={ov.breakEnd || ''}
                              onChange={(e) =>
                                handleOverrideChange(
                                  day.key,
                                  'breakEnd',
                                  sanitize24hTimeInput(e.target.value)
                                )
                              }
                              onBlur={(e) =>
                                handleOverrideChange(
                                  day.key,
                                  'breakEnd',
                                  normalizeOptional24hTime(e.target.value)
                                )
                              }
                              aria-label={`Nghỉ đến riêng ${day.fullLabel}`}
                              className="w-20 h-7 px-2 text-xs font-mono text-center rounded border border-slate-200 bg-white focus:border-[#14539E] focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {hasOverride ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setDayOverrides((prev) => {
                                    const next = { ...prev };
                                    delete next[day.key];
                                    return next;
                                  })
                                }
                                className="text-[11px] font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
                              >
                                Đặt lại
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Row 4: Additional parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label
                htmlFor="shift-early-minutes"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Yêu cầu có mặt sớm để chuẩn bị (phút)
              </label>
              <input
                id="shift-early-minutes"
                type="number"
                min={0}
                max={120}
                value={earlyMinutes}
                onChange={(e) => setEarlyMinutes(Number(e.target.value) || 0)}
                className="w-full h-9 px-3 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            <div>
              <label
                htmlFor="shift-rate-percent"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Đơn giá giờ ca này (% đơn giá cơ sở)
              </label>
              <input
                id="shift-rate-percent"
                type="number"
                min={0}
                max={500}
                step={5}
                value={hourlyRatePercent}
                onChange={(e) =>
                  setHourlyRatePercent(Number(e.target.value) || 0)
                }
                className="w-full h-9 px-3 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1">
                Màu trên Lịch xếp ca
              </span>
              <div className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  {SHIFT_COLOR_OPTIONS.slice(0, 6).map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      aria-label={`Chọn màu ${swatch}`}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                        color.toLowerCase() === swatch.toLowerCase()
                          ? 'ring-2 ring-offset-1 ring-slate-700 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: swatch }}
                    >
                      {color.toLowerCase() === swatch.toLowerCase() && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </button>
                  ))}
                </div>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="Chọn màu tùy chỉnh cho ca"
                  className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Realtime Summary Bar */}
          <div className="px-4 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#14539E]">
              <Clock className="w-4 h-4 shrink-0" />
              <span data-testid="shift-realtime-summary" className="tabular-nums">
                Giờ công chuẩn {formatNumberVN(liveMetrics.standardDailyHours)}{' '}
                giờ/ngày • Cả tuần {formatNumberVN(liveMetrics.weeklyHours)} giờ
              </span>
            </div>
            {earlyMinutes > 0 && (
              <span className="text-[11px] font-medium text-slate-600 tabular-nums">
                Chuẩn bị sớm {formatNumberVN(earlyMinutes)} phút
              </span>
            )}
          </div>

          {/* Scope / Applicable Departments */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-800">
              Phạm vi áp dụng
            </span>

            {isDefault ? (
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
                <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    Ca mặc định — Áp dụng toàn công ty
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Mọi phòng ban chưa gán ca làm việc riêng đều sử dụng ca này làm
                    lịch chuẩn và làm căn cứ tính ngày nghỉ hằng tuần trên Lịch nghỉ
                    lễ, tết.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Info className="w-3.5 h-3.5 text-[#14539E] shrink-0" />
                  <span>
                    Chọn các Phòng ban áp dụng riêng ca làm việc này (từ danh sách bộ
                    phận của hệ thống):
                  </span>
                </div>

                {departmentOptions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    Chưa có phòng ban nào được khai báo trong hệ thống.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {departmentOptions.map((grp) => {
                      const checked = departmentNames.some(
                        (d) =>
                          d.trim().toLowerCase() ===
                          grp.name.trim().toLowerCase()
                      );
                      return (
                        <label
                          key={grp.id}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors select-none ${
                            checked
                              ? 'bg-blue-50 border-[#14539E] text-[#14539E]'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleDepartment(grp.name)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E]"
                          />
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: grp.color || '#64748b' }}
                          />
                          <span>{grp.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          </div>

          {/* Sticky Footer Actions */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div>
              {editingShift && !isDefault && onDelete && (
                isConfirmingDelete ? (
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void onDelete(editingShift.id)}
                      className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      Xác nhận xóa ca
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setIsConfirmingDelete(false)}
                      className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsConfirmingDelete(true)}
                    className="h-9 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa ca</span>
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-9 px-5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isSaving
                  ? 'Đang lưu...'
                  : editingShift
                    ? 'Lưu thay đổi'
                    : 'Thêm ca làm việc'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
