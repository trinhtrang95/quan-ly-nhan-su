import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarCheck2,
  ChevronDown,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { formatNumberVN } from '../../utils/errorAndSecurityService';
import {
  buildMonthCalendarDays,
  CalendarDayCategory,
  CompanyHoliday,
  formatIsoToDDMM,
  formatIsoToDDMMYYYY,
  getLunarHolidayAnchorsForYear,
  getMondayFirstMonthOffset,
  getVietnameseWeekdayName,
  HOLIDAY_TYPE_LABELS,
  HolidayGenerationPlan,
  HolidayType,
  NationalDayPlanOption,
  TetPlanOption,
  WorkShift,
} from '../../utils/workScheduleLogic';

export interface CompanyHolidaysTabProps {
  year: number;
  availableYears: number[];
  onChangeYear: (year: number) => void;
  defaultShift: WorkShift;
  holidays: CompanyHoliday[];
  plan: HolidayGenerationPlan;
  isLoading: boolean;
  isSaving: boolean;
  onChangePlan: (nextPlan: HolidayGenerationPlan) => void;
  onRegenerateByPlan: (plan: HolidayGenerationPlan) => Promise<void>;
  onAddManualHoliday: (input: {
    year: number;
    holidayDate: string;
    name: string;
    holidayType: HolidayType;
  }) => Promise<void>;
  onDeleteHoliday: (holiday: CompanyHoliday) => Promise<void>;
}

const MONTH_NAMES_VI = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const CALENDAR_DAY_STYLE: Record<CalendarDayCategory, string> = {
  holiday: 'bg-[#6D28D9] text-white font-bold',
  compensatory_swap: 'bg-[#DDD6FE] text-[#5B21B6] font-bold',
  makeup_work: 'bg-[#92400E] text-white font-bold',
  weekly_off: 'bg-slate-200/80 text-slate-500 font-medium',
  morning_work: 'bg-[#FEF3C7] text-[#92400E] font-semibold',
  working: 'text-slate-700 hover:bg-slate-100',
};

const LIST_BADGE_STYLE: Record<HolidayType, string> = {
  holiday: 'bg-[#6D28D9]/10 text-[#6D28D9] border-[#6D28D9]/25',
  compensatory: 'bg-[#DDD6FE]/70 text-[#5B21B6] border-[#C4B5FD]',
  swap_off: 'bg-[#DDD6FE]/70 text-[#5B21B6] border-[#C4B5FD]',
  makeup_work: 'bg-[#92400E]/10 text-[#92400E] border-[#92400E]/25',
  morning_work: 'bg-[#FEF3C7] text-[#92400E] border-amber-300',
};

export const CompanyHolidaysTab: React.FC<CompanyHolidaysTabProps> = ({
  year,
  availableYears,
  onChangeYear,
  defaultShift,
  holidays,
  plan,
  isLoading,
  isSaving,
  onChangePlan,
  onRegenerateByPlan,
  onAddManualHoliday,
  onDeleteHoliday,
}) => {
  const [manualDate, setManualDate] = useState<string>(() => `${year}-05-02`);
  const [manualType, setManualType] = useState<HolidayType>('swap_off');
  const [manualNote, setManualNote] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Sync manualDate year prefix whenever user switches selected year
  React.useEffect(() => {
    setManualDate((prev) => {
      if (prev && prev.startsWith(`${year}-`)) return prev;
      return `${year}-01-01`;
    });
    setManualError(null);
  }, [year]);

  const lunarAnchors = useMemo(
    () => getLunarHolidayAnchorsForYear(year),
    [year]
  );

  const sortedYearHolidays = useMemo(
    () =>
      holidays
        .filter((h) => h.year === year)
        .slice()
        .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate)),
    [holidays, year]
  );

  const monthsGrid = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      return {
        month,
        name: MONTH_NAMES_VI[idx],
        offset: getMondayFirstMonthOffset(year, month),
        days: buildMonthCalendarDays(year, month, defaultShift, sortedYearHolidays),
      };
    });
  }, [year, defaultShift, sortedYearHolidays]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDate) {
      setManualError('Vui lòng chọn ngày.');
      return;
    }
    const cleanNote =
      manualNote.trim() || HOLIDAY_TYPE_LABELS[manualType] || 'Ngày điều chỉnh';
    const pickedYear = Number(manualDate.slice(0, 4)) || year;

    setManualError(null);
    await onAddManualHoliday({
      year: pickedYear,
      holidayDate: manualDate,
      name: cleanNote,
      holidayType: manualType,
    });
    setManualNote('');
  };

  return (
    <div className="space-y-4">
      {/* Header + Year Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Lịch nghỉ lễ, tết &amp; ngày làm việc đặc biệt năm {year}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động tính ngày nghỉ bù theo Ca mặc định ({defaultShift.code} –{' '}
            {defaultShift.name}) theo Điều 112 khoản 3 Bộ luật Lao động.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label
            htmlFor="holiday-year-select"
            className="text-xs font-semibold text-slate-700 whitespace-nowrap"
          >
            Năm áp dụng:
          </label>
          <div className="relative">
            <select
              id="holiday-year-select"
              value={year}
              onChange={(e) => onChangeYear(Number(e.target.value))}
              className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-[#14539E] focus:outline-none focus:border-[#14539E] cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#14539E] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Top Two-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Top-Left Block: Phương án nghỉ trong năm */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-[#14539E] shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Phương án nghỉ trong năm {year}
              </h3>
            </div>

            {/* Lunar Anchor Dates */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2">
                <div className="text-[11px] text-slate-500 font-medium">
                  Mùng 1 Tết Âm lịch
                </div>
                <div
                  data-testid="lunar-tet-anchor"
                  className="text-xs font-bold text-slate-900 font-mono tabular-nums mt-0.5"
                >
                  {formatIsoToDDMMYYYY(lunarAnchors.tetFirstDayIso)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {getVietnameseWeekdayName(lunarAnchors.tetFirstDayIso)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2">
                <div className="text-[11px] text-slate-500 font-medium">
                  Giỗ Tổ 10/3 Âm lịch
                </div>
                <div
                  data-testid="lunar-hungkings-anchor"
                  className="text-xs font-bold text-slate-900 font-mono tabular-nums mt-0.5"
                >
                  {formatIsoToDDMMYYYY(lunarAnchors.hungKingsIso)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {getVietnameseWeekdayName(lunarAnchors.hungKingsIso)}
                </div>
              </div>
            </div>

            {/* Tet Plan Options */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-800">
                Phương án Tết Nguyên đán (5 ngày)
              </div>
              <div className="space-y-1.5">
                {(
                  [
                    {
                      value: '1+4',
                      label: '1 ngày trước Tết + 4 ngày đầu năm',
                    },
                    {
                      value: '2+3',
                      label: '2 ngày trước Tết + 3 ngày đầu năm',
                    },
                    {
                      value: '3+2',
                      label: '3 ngày trước Tết + 2 ngày đầu năm',
                    },
                  ] as Array<{ value: TetPlanOption; label: string }>
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      plan.tetPlan === opt.value
                        ? 'bg-blue-50/70 border-[#14539E]/40 text-[#14539E] font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`tet-plan-${year}`}
                      value={opt.value}
                      checked={plan.tetPlan === opt.value}
                      onChange={() =>
                        onChangePlan({ ...plan, tetPlan: opt.value })
                      }
                      className="text-[#14539E] focus:ring-[#14539E]"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* National Day Plan Options */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-800">
                Phương án Quốc khánh (2 ngày)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: '09-01_09-02', label: '1/9 và 2/9' },
                    { value: '09-02_09-03', label: '2/9 và 3/9' },
                  ] as Array<{ value: NationalDayPlanOption; label: string }>
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      plan.nationalDayPlan === opt.value
                        ? 'bg-blue-50/70 border-[#14539E]/40 text-[#14539E] font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`national-day-plan-${year}`}
                      value={opt.value}
                      checked={plan.nationalDayPlan === opt.value}
                      onChange={() =>
                        onChangePlan({ ...plan, nationalDayPlan: opt.value })
                      }
                      className="text-[#14539E] focus:ring-[#14539E]"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Optional 24/11 Checkbox */}
            <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100/70">
              <input
                type="checkbox"
                checked={plan.includeCultureDay}
                onChange={(e) =>
                  onChangePlan({
                    ...plan,
                    includeCultureDay: e.target.checked,
                  })
                }
                className="w-3.5 h-3.5 rounded border-slate-300 text-[#14539E] focus:ring-[#14539E]"
              />
              <span>Cho nghỉ Ngày Văn hóa Việt Nam 24/11</span>
            </label>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onRegenerateByPlan(plan)}
            className="w-full h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>Tạo lại lịch theo phương án</span>
          </button>
        </section>

        {/* Top-Right Block: Danh sách ngày trong năm */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="w-4 h-4 text-[#14539E]" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Danh sách ngày trong năm {year}
              </h3>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums">
              {formatNumberVN(sortedYearHolidays.length)} ngày
            </span>
          </div>

          {/* Scrollable Holiday List */}
          <div className="flex-1 min-h-[260px] max-h-[340px] overflow-y-auto divide-y divide-slate-100">
            {isLoading && sortedYearHolidays.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Đang tải lịch nghỉ lễ năm {year}...
              </div>
            ) : sortedYearHolidays.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">
                  Chưa có ngày nghỉ lễ nào được tạo cho năm {year}
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Chọn phương án nghỉ ở cột bên trái và bấm{' '}
                  <strong>Tạo lại lịch theo phương án</strong> để tự động khởi tạo
                  lịch nghỉ chuẩn.
                </p>
              </div>
            ) : (
              sortedYearHolidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-24 shrink-0">
                      <div className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                        {formatIsoToDDMM(holiday.holidayDate)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {getVietnameseWeekdayName(holiday.holidayDate)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {holiday.name}
                      </div>
                      {holiday.isManual && (
                        <span className="text-[10px] text-slate-400">
                          Thêm thủ công
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${
                        LIST_BADGE_STYLE[holiday.holidayType]
                      }`}
                    >
                      {HOLIDAY_TYPE_LABELS[holiday.holidayType]}
                    </span>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void onDeleteHoliday(holiday)}
                      aria-label={`Xóa ngày ${formatIsoToDDMMYYYY(
                        holiday.holidayDate
                      )} - ${holiday.name}`}
                      title="Xóa ngày này"
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-45"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Manual Add Bar */}
          <form
            onSubmit={handleManualSubmit}
            className="p-3 border-t border-slate-200 bg-slate-50/80 space-y-2 shrink-0"
          >
            {manualError && (
              <div className="text-[11px] font-medium text-red-600">
                {manualError}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                min="2020-01-01"
                max="2035-12-31"
                aria-label="Chọn ngày thêm thủ công"
                className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-[#14539E] shrink-0"
              />
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value as HolidayType)}
                aria-label="Loại ngày thêm thủ công"
                className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#14539E] cursor-pointer shrink-0"
              >
                <option value="swap_off">Nghỉ hoán đổi</option>
                <option value="makeup_work">Làm bù</option>
                <option value="holiday">Nghỉ lễ, tết</option>
                <option value="morning_work">Làm buổi sáng</option>
              </select>
              <input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Ghi chú tên ngày nghỉ / làm bù..."
                aria-label="Ghi chú ngày thêm thủ công"
                className="flex-1 min-w-[150px] h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#14539E]"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="h-8 px-3 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm ngày</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Bottom Block: 12-Month Calendar Grid + Legend */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
              Lịch cả năm {year} (12 tháng)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hiển thị theo Ca mặc định: <strong>{defaultShift.code}</strong> –{' '}
              {defaultShift.name}
            </p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#6D28D9]" />
              <span>Lễ, tết</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#DDD6FE] border border-[#C4B5FD]" />
              <span>Nghỉ bù / hoán đổi</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#92400E]" />
              <span>Làm bù</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300" />
              <span>Nghỉ hằng tuần</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#FEF3C7] border border-amber-300" />
              <span>Làm buổi sáng</span>
            </span>
          </div>
        </div>

        {/* 12 Months Grid (6 months per row on desktop) */}
        <div
          data-testid="annual-12month-calendar"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3"
        >
          {monthsGrid.map((monthObj) => (
            <div
              key={monthObj.month}
              className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-2.5"
            >
              <div className="text-xs font-bold text-[#14539E] mb-2 text-center">
                {monthObj.name}
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400 mb-1">
                <span>T2</span>
                <span>T3</span>
                <span>T4</span>
                <span>T5</span>
                <span>T6</span>
                <span>T7</span>
                <span>CN</span>
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-center">
                {Array.from({ length: monthObj.offset }).map((_, i) => (
                  <span key={`empty-${i}`} className="h-6" />
                ))}
                {monthObj.days.map((dayInfo) => {
                  const titleText = dayInfo.label
                    ? `${formatIsoToDDMMYYYY(dayInfo.isoDate)}: ${dayInfo.label}`
                    : formatIsoToDDMMYYYY(dayInfo.isoDate);
                  return (
                    <span
                      key={dayInfo.isoDate}
                      title={titleText}
                      className={`h-6 rounded flex items-center justify-center text-[11px] font-mono tabular-nums select-none ${
                        CALENDAR_DAY_STYLE[dayInfo.category]
                      }`}
                    >
                      {dayInfo.dayOfMonth}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
