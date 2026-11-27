import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Minus,
} from 'lucide-react';
import { CompanyDepartment, DepartmentGroup } from '../../types/hr';
import {
  DEFAULT_COMPANY_DEPARTMENTS,
  mergeCompanyDepartmentOptions,
} from '../../services/stWorkService';
import {
  computeStOverviewMetrics,
  formatNumberVN,
  formatStDateVN,
  getLocalYearMonth,
  resolveOverviewPeriodRange,
  ST_STATUS_BADGE_META,
  StChangeRequest,
  StCustomerQuote,
  StOverviewPeriodMode,
  StProductWithStatus,
  StWorkSubTab,
} from '../../utils/stWorkLogic';

export interface StOverviewTabProps {
  productsWithStatus: StProductWithStatus[];
  changeRequests: StChangeRequest[];
  customerQuotes: StCustomerQuote[];
  companyDepartments?: CompanyDepartment[];
  groups?: DepartmentGroup[];
  isLoading: boolean;
  onNavigateTab: (tab: StWorkSubTab) => void;
}

export const StOverviewTab: React.FC<StOverviewTabProps> = ({
  productsWithStatus,
  changeRequests,
  customerQuotes,
  companyDepartments = DEFAULT_COMPANY_DEPARTMENTS,
  isLoading,
  onNavigateTab,
}) => {
  const initialYM = useMemo(() => getLocalYearMonth(), []);
  const [periodMode, setPeriodMode] = useState<StOverviewPeriodMode>('last_month');
  const [customYear, setCustomYear] = useState<number>(initialYM.year);
  const [customMonth, setCustomMonth] = useState<number>(initialYM.month);

  const periodRange = useMemo(
    () => resolveOverviewPeriodRange(periodMode, customYear, customMonth),
    [periodMode, customYear, customMonth]
  );

  const departmentNames = useMemo(
    () =>
      mergeCompanyDepartmentOptions(
        companyDepartments,
        changeRequests.map((r) => r.department)
      ),
    [companyDepartments, changeRequests]
  );

  const metrics = useMemo(
    () =>
      computeStOverviewMetrics({
        productsWithStatus,
        changeRequests,
        quotes: customerQuotes,
        departments: departmentNames,
        currentStart: periodRange.currentStart,
        currentEnd: periodRange.currentEnd,
        prevStart: periodRange.prevStart,
        prevEnd: periodRange.prevEnd,
      }),
    [
      productsWithStatus,
      changeRequests,
      customerQuotes,
      departmentNames,
      periodRange,
    ]
  );

  const yearOptions = useMemo(() => {
    const start = Math.min(2024, initialYM.year - 2);
    const end = Math.max(2028, initialYM.year + 2);
    const arr: number[] = [];
    for (let y = start; y <= end; y++) arr.push(y);
    return arr;
  }, [initialYM.year]);

  return (
    <div className="space-y-4">
      {/* Header & Period Selector */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Tổng quan công việc ST
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            Kỳ xem: <span className="font-semibold text-slate-700">{periodRange.currentLabel}</span>
            {' · '}
            {formatStDateVN(periodRange.currentStart)} – {formatStDateVN(periodRange.currentEnd)}
            {' · '}
            So sánh với {periodRange.prevLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setPeriodMode('last_month')}
              className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                periodMode === 'last_month'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tháng vừa rồi
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('this_month')}
              className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                periodMode === 'this_month'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('custom')}
              className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                periodMode === 'custom'
                  ? 'bg-[#14539E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tùy chỉnh
            </button>
          </div>

          {periodMode === 'custom' && (
            <div className="inline-flex items-center gap-1.5">
              <select
                value={customMonth}
                onChange={(e) => setCustomMonth(Number(e.target.value))}
                aria-label="Chọn tháng xem tổng quan"
                className="h-8 px-2.5 text-xs font-mono font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m}>
                    Tháng {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <select
                value={customYear}
                onChange={(e) => setCustomYear(Number(e.target.value))}
                aria-label="Chọn năm xem tổng quan"
                className="h-8 px-2.5 text-xs font-mono font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 4 Main KPI Stat Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* KPI 1: Đơn giá mới hoàn thành */}
        <button
          type="button"
          onClick={() => onNavigateTab('new_products')}
          className="text-left bg-white border border-slate-200 hover:border-[#14539E]/50 rounded-xl p-4 transition-colors cursor-pointer flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Đơn giá mới hoàn thành
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
                {isLoading ? '—' : formatNumberVN(metrics.completedInPeriodCount)}
              </div>
            </div>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-mono tabular-nums">
              Tháng trước: {formatNumberVN(metrics.completedInPrevPeriodCount)}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-mono font-semibold tabular-nums ${
                metrics.completedDelta > 0
                  ? 'text-emerald-700'
                  : metrics.completedDelta < 0
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {metrics.completedDelta > 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : metrics.completedDelta < 0 ? (
                <ArrowDownRight className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              {metrics.completedDelta > 0
                ? `+${formatNumberVN(metrics.completedDelta)}`
                : formatNumberVN(metrics.completedDelta)}{' '}
              so với tháng trước
            </span>
          </div>
        </button>

        {/* KPI 2: Mã hàng đang làm */}
        <button
          type="button"
          onClick={() => onNavigateTab('new_products')}
          className="text-left bg-white border border-slate-200 hover:border-[#14539E]/50 rounded-xl p-4 transition-colors cursor-pointer flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Mã hàng đang làm
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
                {isLoading ? '—' : formatNumberVN(metrics.inProgressTotalCount)}
              </div>
            </div>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          <div className="pt-2.5 border-t border-slate-100 space-y-1.5 text-[11px]">
            {metrics.pendingStepCounts.map((step) => (
              <div
                key={step.stepKey}
                className="flex items-center justify-between gap-2 text-slate-600"
              >
                <span className="leading-snug">{step.waitingLabel}</span>
                <span
                  className={`font-mono font-bold tabular-nums shrink-0 ${
                    step.count > 0 ? 'text-amber-700' : 'text-slate-400'
                  }`}
                >
                  {formatNumberVN(step.count)}
                </span>
              </div>
            ))}
          </div>
        </button>

        {/* KPI 3: Thời gian xử lý trung bình (Ngày) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Thời gian xử lý trung bình (Ngày)
              </div>
              <div className="text-2xl font-bold text-[#14539E] font-mono tabular-nums mt-1.5">
                {isLoading
                  ? '—'
                  : metrics.avgCompletionDaysInPeriod !== null
                  ? `${formatNumberVN(metrics.avgCompletionDaysInPeriod)} ngày`
                  : '—'}
              </div>
            </div>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#14539E] flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>Lũy kế toàn bộ mã hoàn thành:</span>
            <span className="font-mono font-semibold text-slate-700 tabular-nums">
              {metrics.avgCompletionDaysAllCompleted !== null
                ? `${formatNumberVN(metrics.avgCompletionDaysAllCompleted)} ngày`
                : 'Chưa có dữ liệu'}
            </span>
          </div>
        </div>

        {/* KPI 4: Phiếu yêu cầu tiếp nhận trong kỳ + Báo giá khách hàng summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Phiếu yêu cầu tiếp nhận trong kỳ
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
                {isLoading ? '—' : formatNumberVN(metrics.requestsInPeriodCount)}
              </div>
            </div>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </span>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-mono tabular-nums">
              Tháng trước: {formatNumberVN(metrics.requestsInPrevPeriodCount)} phiếu
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('change_requests')}
              className="font-semibold text-[#14539E] hover:underline cursor-pointer"
            >
              Xem chi tiết
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Analytical Row: Tình hình xử lý Phiếu yêu cầu (Theo Bộ phận & Tình trạng) + Báo giá khách hàng */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Phân bổ theo Bộ phận YC */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">
              Phiếu yêu cầu theo Bộ phận YC ({periodRange.currentLabel})
            </h3>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {formatNumberVN(metrics.requestsInPeriodCount)} phiếu
            </span>
          </div>
          <div className="p-3 overflow-y-auto max-h-80 divide-y divide-slate-100">
            {metrics.requestsByDepartment.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Chưa có bộ phận hoặc phiếu yêu cầu nào trong kỳ.
              </div>
            ) : (
              metrics.requestsByDepartment.map((item) => (
                <div
                  key={item.department}
                  className="py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-medium text-slate-700 truncate">
                    {item.department}
                  </span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {formatNumberVN(item.count)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Phân bổ theo Tình trạng xử lý */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">
              Phiếu yêu cầu theo Tình trạng xử lý
            </h3>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              6 trạng thái
            </span>
          </div>
          <div className="p-3 space-y-2">
            {metrics.requestsByStatus.map((item) => {
              const badge = ST_STATUS_BADGE_META[item.status];
              return (
                <div
                  key={item.status}
                  className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-b-0"
                >
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                  >
                    {item.status}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                    {formatNumberVN(item.count)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thẻ tóm tắt Báo giá khách hàng */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">
                Báo giá khách hàng
              </h3>
              <FileSpreadsheet className="w-4 h-4 text-[#14539E]" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-slate-500">Đã báo giá / Còn lại</span>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                  <span className="text-emerald-700">
                    {formatNumberVN(metrics.quotesQuotedCount)}
                  </span>
                  <span className="text-slate-400 mx-1">/</span>
                  <span className="text-amber-700">
                    {formatNumberVN(metrics.quotesRemainingCount)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {metrics.quotesTotalCount === 0
                  ? 'Chưa có dữ liệu báo giá khách hàng trên bảng st_customer_quotes (tạm hiển thị 0 / 0).'
                  : `Tổng số ${formatNumberVN(
                      metrics.quotesTotalCount
                    )} hồ sơ báo giá đang theo dõi trên hệ thống.`}
              </p>
            </div>
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end">
            <button
              type="button"
              onClick={() => onNavigateTab('customer_quotes')}
              className="text-xs font-semibold text-[#14539E] hover:underline cursor-pointer"
            >
              Mở phân hệ Báo giá khách hàng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
