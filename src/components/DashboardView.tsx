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
    <div className="space-y-5">
      {/* 1. Compact 4 KPI Stat Cards Grid */}
      <section aria-label="Chỉ số KPI nhân sự tổng quan">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* KPI 1: Tổng số nhân sự */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
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
            <div className="my-2">
              <div
                data-testid="kpi-total-employees"
                className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight"
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
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">
                {kpis.totalEmployees > 0
                  ? `${Math.round((kpis.activeEmployees / kpis.totalEmployees) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="my-2">
              <div
                data-testid="kpi-active-employees"
                className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight"
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
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <CalendarOff className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                12/11/2026
              </span>
            </div>
            <div className="my-2">
              <div
                data-testid="kpi-leave-today"
                className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight"
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
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <ClockAlert className="w-4 h-4" />
              </div>
              <span className="text-xs font-mono tabular-nums text-amber-700 font-semibold">
                {kpis.lateHoursInMonth}h
              </span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              <span
                data-testid="kpi-late-count"
                className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight"
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

      {/* 2. Compact Visual Charts Section (max-h-[260px]) */}
      <section
        aria-label="Biểu đồ trực quan nhân sự và loại hình nghỉ"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Chart 1: Phân bổ nhân sự theo Nhóm/Bộ phận */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col justify-between max-h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900">
                Phân bổ nhân sự theo Nhóm / Bộ phận
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tỷ trọng nhân sự tại {departmentDist.length} phòng ban
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('employees')}
              className="text-[11px] font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors cursor-pointer"
            >
              Quản lý bộ phận
            </button>
          </div>

          <div className="flex items-center gap-4 py-1">
            {/* SVG Donut Chart (Compact w-32 h-32) */}
            <div className="relative w-32 h-32 shrink-0">
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
                <span className="text-xl font-extrabold text-slate-900 font-mono">
                  {kpis.totalEmployees}
                </span>
                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                  Nhân sự
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 w-full flex flex-col justify-center gap-1.5 max-h-32 overflow-y-auto pr-1">
              {departmentDist.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-slate-700 truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
                    <span className="font-bold text-slate-900">{item.count}</span>
                    <span className="text-slate-400">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2: Thống kê loại hình nghỉ trong tháng */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col justify-between max-h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900">
                Thống kê loại hình nghỉ trong tháng (Tháng 11/2026)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                So sánh phép năm, không lương, chế độ &amp; đi muộn
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAddLeave}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors cursor-pointer"
            >
              <CalendarPlus className="w-3 h-3" />
              <span>Ghi nhận</span>
            </button>
          </div>

          {/* Bar Chart with Grid Lines (Compact h-28) */}
          <div className="pt-1 pb-1">
            <div className="relative h-28 flex items-end justify-around gap-3 px-2 border-b border-slate-200">
              {/* Background horizontal dashed grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-1">
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
                    <span className="text-[10px] font-mono font-bold text-slate-700 mb-1">
                      {item.count}
                    </span>
                    <div
                      className="w-full max-w-[40px] rounded-t-lg transition-all duration-500 group-hover:opacity-90 shadow-xs"
                      style={{
                        height: `${Math.max(heightPct, 8)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Bar Chart Labels */}
            <div className="flex justify-around gap-2 pt-1.5 px-1 text-center">
              {leaveTypeDist.map((item) => (
                <div key={item.label} className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-slate-800 truncate" title={item.label}>
                    {item.label}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                    {item.subLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Bottom Row: Recent Leave Records occupying Full Width with max-h-[420px] and sticky header */}
      <section className="w-full col-span-full bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col min-h-[420px]">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Ghi chép Nghỉ phép &amp; Đi muộn Gần đây
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hiển thị danh sách bản ghi mới nhất (Hỗ trợ cuộn dọc và ghim tiêu đề)
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

        <div className="overflow-x-auto overflow-y-auto max-h-[420px] flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#0F232E] text-white text-xs font-semibold tracking-wider uppercase z-10">
              <tr>
                <th className="py-2.5 px-4 bg-[#0F232E]">Nhân sự</th>
                <th className="py-2.5 px-3 bg-[#0F232E]">Loại giấy phép</th>
                <th className="py-2.5 px-3 bg-[#0F232E]">Thời gian</th>
                <th className="py-2.5 px-3 text-right bg-[#0F232E]">Số lượng</th>
                <th className="py-2.5 px-4 text-center bg-[#0F232E]">Giấy phép</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recentRecords.slice(0, 15).map((rec) => {
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

