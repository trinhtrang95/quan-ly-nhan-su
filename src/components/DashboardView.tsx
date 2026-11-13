import React from 'react';
import {
  Users,
  UserCheck,
  CalendarOff,
  ClockAlert,
  ArrowUpRight,
  FileImage,
  CalendarPlus,
} from 'lucide-react';
import {
  ActiveModule,
  DashboardKPIs,
  DistributionItem,
  Employee,
  EmployeeAnnualMatrixRow,
  LeaveRecord,
} from '../types/hr';
import { formatDateVN, LEAVE_TYPE_META } from '../utils/hrCalculations';

interface DashboardViewProps {
  kpis: DashboardKPIs;
  departmentDist: DistributionItem[];
  leaveTypeDist: DistributionItem[];
  employees: Employee[];
  recentRecords: LeaveRecord[];
  matrixRows: EmployeeAnnualMatrixRow[];
  onNavigate: (mod: ActiveModule) => void;
  onOpenAddLeave: () => void;
  onInspectAttachment: (url: string, title: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  kpis,
  departmentDist,
  leaveTypeDist,
  employees,
  recentRecords,
  onNavigate,
  onOpenAddLeave,
  onInspectAttachment,
}) => {
  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

  // Prepare SVG Donut slices for Department Distribution
  let cumulativePercent = 0;
  const donutSlices = departmentDist.map((item) => {
    const pct = item.percentage;
    const dashArray = `${Math.max(pct, 0.5)} ${100 - Math.max(pct, 0.5)}`;
    const dashOffset = -cumulativePercent;
    cumulativePercent += pct;
    return {
      ...item,
      dashArray,
      dashOffset,
    };
  });

  // Max value for bar chart scaling (minimum scale 5 so 0 values have headroom)
  const maxLeaveCount = Math.max(...leaveTypeDist.map((d) => d.count), 5);

  return (
    <div className="space-y-6">
      {/* 1. 4 KPI Stat Cards Grid (Removed low leave card, even 4-column layout) */}
      <section aria-label="Chỉ số KPI nhân sự tổng quan">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Tổng số nhân sự */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => onNavigate('employees')}
                aria-label="Xem danh sách tổng số nhân sự"
                className="text-xs font-medium text-slate-400 hover:text-[#0D9488] inline-flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <span>Chi tiết</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div
                data-testid="kpi-total-employees"
                className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight"
              >
                {kpis.totalEmployees}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700">Tổng số nhân sự</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Toàn bộ hồ sơ trên hệ thống
              </div>
            </div>
          </div>

          {/* KPI 2: Đang làm việc */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">
                {kpis.totalEmployees > 0
                  ? `${Math.round((kpis.activeEmployees / kpis.totalEmployees) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="my-3">
              <div
                data-testid="kpi-active-employees"
                className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight"
              >
                {kpis.activeEmployees}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700">Đang làm việc</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Nhân sự chính thức &amp; thử việc
              </div>
            </div>
          </div>

          {/* KPI 3: Nghỉ phép hôm nay */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <CalendarOff className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                12/11/2026
              </span>
            </div>
            <div className="my-3">
              <div
                data-testid="kpi-leave-today"
                className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight"
              >
                {kpis.onLeaveToday}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700">Nghỉ phép hôm nay</div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={kpis.onLeaveTodayNames.join(', ')}>
                {kpis.onLeaveTodayNames.length > 0
                  ? kpis.onLeaveTodayNames.join(', ')
                  : 'Không có nhân sự nghỉ hôm nay'}
              </div>
            </div>
          </div>

          {/* KPI 4: Lượt đi muộn trong tháng */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <ClockAlert className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono tabular-nums text-amber-700 font-semibold">
                {kpis.lateHoursInMonth} giờ
              </span>
            </div>
            <div className="my-3 flex items-baseline gap-2">
              <span
                data-testid="kpi-late-count"
                className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight"
              >
                {kpis.lateCountInMonth}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                lượt ({kpis.lateHoursInMonth}h)
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700">
                Lượt đi muộn trong tháng
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Tổng cộng {kpis.lateHoursInMonth} giờ đi muộn / về sớm
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Visual Charts Section (Pie/Doughnut Chart & Bar Chart) */}
      <section
        aria-label="Biểu đồ trực quan nhân sự và loại hình nghỉ"
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        {/* Chart 1: Phân bổ nhân sự theo Nhóm/Bộ phận (SVG Donut Chart + Legend) */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Phân bổ nhân sự theo Nhóm / Bộ phận
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tỷ trọng nhân sự đang làm việc tại {departmentDist.length} phòng ban
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('employees')}
              className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors cursor-pointer"
            >
              Quản lý bộ phận
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
            {/* SVG Donut Chart */}
            <div className="relative w-40 h-40 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                {donutSlices.map((slice, idx) => (
                  <circle
                    key={idx}
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth="4.5"
                    strokeDasharray={slice.dashArray}
                    strokeDashoffset={slice.dashOffset}
                    className="transition-all duration-500 hover:opacity-90"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-extrabold text-slate-900 font-mono">
                  {kpis.totalEmployees}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Nhân sự
                </span>
              </div>
            </div>

            {/* Legend (Flex col justify-center gap-2) */}
            <div className="flex-1 w-full flex flex-col justify-center gap-2">
              {departmentDist.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-slate-700 truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                    <span className="font-bold text-slate-900">{item.count}</span>
                    <span className="text-slate-400">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2: Thống kê loại hình nghỉ trong tháng (SVG Bar Chart with background grid lines) */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Thống kê loại hình nghỉ trong tháng (Tháng 11/2026)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                So sánh lượt nghỉ phép năm, không lương, chế độ và đi muộn
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAddLeave}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Ghi nhận mới</span>
            </button>
          </div>

          {/* Bar Chart with Grid Lines */}
          <div className="pt-4 pb-2">
            <div className="relative h-40 flex items-end justify-around gap-4 px-3 border-b border-slate-200">
              {/* Background horizontal dashed grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-1">
                <div className="w-full border-b border-slate-100 border-dashed" />
                <div className="w-full border-b border-slate-100 border-dashed" />
                <div className="w-full border-b border-slate-100 border-dashed" />
                <div className="w-full border-b border-slate-100 border-dashed" />
              </div>

              {leaveTypeDist.map((item) => {
                const heightPct = Math.round((item.count / maxLeaveCount) * 100);
                return (
                  <div
                    key={item.label}
                    className="flex-1 flex flex-col items-center h-full justify-end group z-10"
                  >
                    <span className="text-[11px] font-mono font-bold text-slate-700 mb-1">
                      {item.count}
                    </span>
                    <div
                      className="w-full max-w-[48px] rounded-t-lg transition-all duration-500 group-hover:opacity-90 shadow-xs"
                      style={{
                        height: `${Math.max(heightPct, 6)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Bar Chart Labels */}
            <div className="flex justify-around gap-3 pt-2 px-1 text-center">
              {leaveTypeDist.map((item) => (
                <div key={item.label} className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-slate-800 truncate" title={item.label}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {item.subLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Bottom Row: Recent Leave Records occupying Full Width (w-full col-span-full) */}
      <section className="w-full col-span-full bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Ghi chép Nghỉ phép &amp; Đi muộn Gần đây
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bấm vào ảnh chứng từ để đối chiếu giấy xin phép / viện phí
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('leave_logs')}
            className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
          >
            Xem toàn bộ ({recentRecords.length})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0F232E] text-white text-xs font-semibold tracking-wider uppercase">
                <th className="py-2.5 px-4">Nhân sự</th>
                <th className="py-2.5 px-3">Loại giấy phép</th>
                <th className="py-2.5 px-3">Thời gian</th>
                <th className="py-2.5 px-3 text-right">Số lượng</th>
                <th className="py-2.5 px-4 text-center">Giấy phép</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recentRecords.slice(0, 5).map((rec) => {
                const emp = empMap.get(rec.employeeId);
                const meta = LEAVE_TYPE_META[rec.type];
                return (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {emp?.fullName || 'N/A'}
                      <span className="ml-1.5 text-[11px] font-mono text-slate-400 font-normal">
                        {emp?.employeeCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className="font-semibold"
                        style={{ color: meta.textColor }}
                      >
                        {rec.type === 'late_early' ? 'Đi muộn' : meta.shortLabel}
                      </span>
                      {rec.regimeSubtype && (
                        <span className="text-slate-400 ml-1">
                          · {rec.regimeSubtype}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateVN(rec.startDate)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-800 whitespace-nowrap">
                      {rec.amount} {meta.unit}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {rec.attachmentUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            onInspectAttachment(
                              rec.attachmentUrl!,
                              rec.attachmentTitle || `Chứng từ - ${emp?.fullName}`
                            )
                          }
                          aria-label={`Xem giấy phép của ${emp?.fullName}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#0D9488] bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer"
                        >
                          <FileImage className="w-3.5 h-3.5" />
                          <span>Xem ảnh</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

