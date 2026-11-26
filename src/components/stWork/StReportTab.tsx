import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  FileSpreadsheet,
  Loader2,
  Minus,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import { exportStWorkReportExcel } from '../../utils/stWorkExportService';
import {
  computeStReportComparison,
  formatNumberVN,
  formatStDateVN,
  getLocalIsoDateToday,
  getLocalYearMonth,
  getPreviousYearMonth,
  resolveReportPeriodRange,
  StChangeRequest,
  StCustomerQuote,
  StProductWithStatus,
  StReportPeriodMode,
} from '../../utils/stWorkLogic';

export interface StReportTabProps {
  productsWithStatus: StProductWithStatus[];
  changeRequests: StChangeRequest[];
  customerQuotes: StCustomerQuote[];
  onShowToast?: (message: string) => void;
}

export const StReportTab: React.FC<StReportTabProps> = ({
  productsWithStatus,
  changeRequests,
  customerQuotes,
  onShowToast,
}) => {
  const nowYM = useMemo(() => getLocalYearMonth(), []);
  const lastMonthYM = useMemo(
    () => getPreviousYearMonth(nowYM.year, nowYM.month),
    [nowYM]
  );
  const todayIso = useMemo(() => getLocalIsoDateToday(), []);

  // Default to Monthly report -> "Tháng vừa rồi"
  const [periodMode, setPeriodMode] = useState<StReportPeriodMode>('month');
  const [dayMode, setDayMode] = useState<'single' | 'range'>('single');
  const [singleDay, setSingleDay] = useState<string>(todayIso);
  const [rangeStart, setRangeStart] = useState<string>(todayIso);
  const [rangeEnd, setRangeEnd] = useState<string>(todayIso);
  const [selectedMonth, setSelectedMonth] = useState<number>(lastMonthYM.month);
  const [selectedYear, setSelectedYear] = useState<number>(lastMonthYM.year);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const periodRange = useMemo(
    () =>
      resolveReportPeriodRange(periodMode, {
        dayMode,
        singleDay,
        rangeStart,
        rangeEnd,
        year: selectedYear,
        month: selectedMonth,
      }),
    [periodMode, dayMode, singleDay, rangeStart, rangeEnd, selectedYear, selectedMonth]
  );

  const comparisonRows = useMemo(
    () =>
      computeStReportComparison({
        productsWithStatus,
        changeRequests,
        quotes: customerQuotes,
        currentStart: periodRange.currentStart,
        currentEnd: periodRange.currentEnd,
        prevStart: periodRange.prevStart,
        prevEnd: periodRange.prevEnd,
      }),
    [productsWithStatus, changeRequests, customerQuotes, periodRange]
  );

  const liveProductBreakdown = useMemo(() => {
    const completed = productsWithStatus.filter((p) => p.isCompleted).length;
    const waitingProcessErp = productsWithStatus.filter(
      (p) => !p.isCompleted && p.currentWaitingStep === 'process_erp'
    ).length;
    const waitingStages = productsWithStatus.filter(
      (p) => !p.isCompleted && p.currentWaitingStep === 'stages'
    ).length;
    const waitingSt = productsWithStatus.filter(
      (p) => !p.isCompleted && p.currentWaitingStep === 'st'
    ).length;
    return {
      total: productsWithStatus.length,
      completed,
      inProgress: waitingProcessErp + waitingStages + waitingSt,
      waitingProcessErp,
      waitingStages,
      waitingSt,
    };
  }, [productsWithStatus]);

  const yearOptions = useMemo(() => {
    const start = Math.min(2024, nowYM.year - 2);
    const end = Math.max(2028, nowYM.year + 2);
    const arr: number[] = [];
    for (let y = start; y <= end; y++) arr.push(y);
    return arr;
  }, [nowYM.year]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const filename = await exportStWorkReportExcel({
        periodRange,
        comparisonRows,
        productsWithStatus,
        changeRequests,
        customerQuotes,
      });
      onShowToast?.(`Đã xuất báo cáo Excel 4 sheet: ${filename}`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  };

  const isLastMonthSelected =
    periodMode === 'month' &&
    selectedMonth === lastMonthYM.month &&
    selectedYear === lastMonthYM.year;

  const isThisMonthSelected =
    periodMode === 'month' &&
    selectedMonth === nowYM.month &&
    selectedYear === nowYM.year;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3.5 overflow-auto">
      {/* Period Selector & Export Header */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 3 Period Mode Buttons */}
          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setPeriodMode('day')}
              className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                periodMode === 'day'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Báo cáo Ngày
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('month')}
              className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                periodMode === 'month'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Báo cáo Tháng
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('year')}
              className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                periodMode === 'year'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Báo cáo Năm
            </button>
          </div>

          {/* Period Sub-Controls */}
          {periodMode === 'day' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-0.5 bg-white border border-slate-300 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDayMode('single')}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium cursor-pointer ${
                    dayMode === 'single'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1 ngày
                </button>
                <button
                  type="button"
                  onClick={() => setDayMode('range')}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium cursor-pointer ${
                    dayMode === 'range'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Khoảng ngày
                </button>
              </div>

              {dayMode === 'single' ? (
                <input
                  type="date"
                  value={singleDay}
                  onChange={(e) => setSingleDay(e.target.value)}
                  aria-label="Chọn ngày báo cáo"
                  className="h-8 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    aria-label="Từ ngày"
                    className="h-8 px-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                  <span className="text-xs text-slate-400">–</span>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    aria-label="Đến ngày"
                    className="h-8 px-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>
              )}
            </div>
          )}

          {periodMode === 'month' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth(lastMonthYM.month);
                  setSelectedYear(lastMonthYM.year);
                }}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  isLastMonthSelected
                    ? 'bg-blue-50 text-[#14539E] border-[#14539E]/40'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-[#14539E]'
                }`}
              >
                Tháng vừa rồi
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth(nowYM.month);
                  setSelectedYear(nowYM.year);
                }}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  isThisMonthSelected
                    ? 'bg-blue-50 text-[#14539E] border-[#14539E]/40'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-[#14539E]'
                }`}
              >
                Tháng này
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                aria-label="Chọn tháng báo cáo"
                className="h-8 min-w-[112px] px-2.5 pr-6 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m}>
                    Tháng {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                aria-label="Chọn năm báo cáo"
                className="h-8 px-2.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodMode === 'year' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Chọn năm báo cáo"
              className="h-8 px-3 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          disabled={isExporting}
          onClick={() => void handleExportExcel()}
          className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" />
          )}
          <span>Xuất Excel (.xlsx)</span>
        </button>
      </div>

      {/* Period Banner */}
      <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Calendar className="w-4 h-4 text-[#14539E] shrink-0" />
          <span>
            Kỳ báo cáo:{' '}
            <strong className="text-[#14539E]">{periodRange.currentLabel}</strong>{' '}
            <span className="font-mono text-slate-500 tabular-nums">
              ({formatStDateVN(periodRange.currentStart)} –{' '}
              {formatStDateVN(periodRange.currentEnd)})
            </span>
          </span>
        </div>
        <div className="text-slate-600 font-mono text-[11px] tabular-nums">
          So sánh với: <strong>{periodRange.prevLabel}</strong> (
          {formatStDateVN(periodRange.prevStart)} –{' '}
          {formatStDateVN(periodRange.prevEnd)})
        </div>
      </div>

      {/* Live New-Product Pipeline Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-600">
            Hoàn thành
          </span>
          <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
            {formatNumberVN(liveProductBreakdown.completed)}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-600">
            Tổng đang làm
          </span>
          <span className="font-mono text-sm font-bold text-amber-700 tabular-nums">
            {formatNumberVN(liveProductBreakdown.inProgress)}
          </span>
        </div>
        <div className="bg-white border border-amber-200/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">
            Chưa tạo QT ERP
          </span>
          <span className="font-mono text-sm font-bold text-amber-700 tabular-nums">
            {formatNumberVN(liveProductBreakdown.waitingProcessErp)}
          </span>
        </div>
        <div className="bg-white border border-amber-200/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">
            Đang làm CĐ (WIN–FIN)
          </span>
          <span className="font-mono text-sm font-bold text-amber-700 tabular-nums">
            {formatNumberVN(liveProductBreakdown.waitingStages)}
          </span>
        </div>
        <div className="bg-white border border-amber-200/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">
            Chờ ST / Ngày áp dụng
          </span>
          <span className="font-mono text-sm font-bold text-amber-700 tabular-nums">
            {formatNumberVN(liveProductBreakdown.waitingSt)}
          </span>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Bảng tổng hợp &amp; so sánh chỉ tiêu ({periodRange.currentLabel} vs{' '}
            {periodRange.prevLabel})
          </h3>
          <span className="text-[11px] text-slate-500">
            File Excel gồm 4 sheet: Tổng hợp · Đơn giá mới · Phiếu yêu cầu · Báo giá khách hàng
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-2.5 py-2.5 w-12 text-center border-r border-slate-200/70">
                  STT
                </th>
                <th className="px-3 py-2.5 w-[28%] border-r border-slate-200/70">
                  Hạng mục
                </th>
                <th className="px-3 py-2.5 w-28 text-right border-r border-slate-200/70">
                  Kỳ này
                </th>
                <th className="px-3 py-2.5 w-28 text-right border-r border-slate-200/70">
                  Kỳ trước
                </th>
                <th className="px-3 py-2.5 w-28 text-right border-r border-slate-200/70">
                  Chênh lệch
                </th>
                <th className="px-3 py-2.5 w-24 text-center border-r border-slate-200/70">
                  Đơn vị
                </th>
                <th className="px-3 py-2.5">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {comparisonRows.map((row, idx) => {
                const isTimeMetric = row.key === 'avg_completion_days';
                const deltaColor =
                  row.delta === 0
                    ? 'text-slate-500'
                    : isTimeMetric
                    ? row.delta < 0
                      ? 'text-emerald-700'
                      : 'text-rose-600'
                    : row.delta > 0
                    ? 'text-emerald-700'
                    : 'text-rose-600';

                return (
                  <tr
                    key={row.key}
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-2.5 py-2.5 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                      {formatNumberVN(idx + 1)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 border-r border-slate-100">
                      {row.label}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[#14539E] tabular-nums border-r border-slate-100">
                      {formatNumberVN(row.currentValue)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums border-r border-slate-100">
                      {formatNumberVN(row.previousValue)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono font-bold tabular-nums border-r border-slate-100 ${deltaColor}`}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        {row.delta > 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : row.delta < 0 ? (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                        {row.delta > 0
                          ? `+${formatNumberVN(row.delta)}`
                          : formatNumberVN(row.delta)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600 border-r border-slate-100">
                      {row.unit}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{row.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
