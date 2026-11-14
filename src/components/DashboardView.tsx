import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  CalendarOff,
  ClockAlert,
  ArrowUpRight,
  FileImage,
  CalendarPlus,
  UserPlus,
  FileSpreadsheet,
  BarChart3,
  AlertTriangle,
  Clock,
  CheckCircle2,
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
  records: LeaveRecord[];
  recentRecords: LeaveRecord[];
  matrixRows: EmployeeAnnualMatrixRow[];
  onNavigate: (mod: ActiveModule) => void;
  onOpenAddLeave: () => void;
  onOpenAddEmployee: () => void;
  onInspectAttachment: (url: string, title: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  kpis,
  departmentDist,
  leaveTypeDist,
  employees,
  records,
  recentRecords,
  onNavigate,
  onOpenAddLeave,
  onOpenAddEmployee,
  onInspectAttachment,
}) => {
  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

  // Real-time clock and date header
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d: Date) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const formatDateHeader = (d: Date) => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const startOfYear = new Date(yyyy, 0, 1);
    const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${dayName}, ${dd}/${mm}/${yyyy} · Tuần ${weekNum}`;
  };

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  // Missing paper count & records
  const missingPaperRecords = records.filter(
    (r) => r.paperStatus === 'Chưa có' || !r.attachmentUrl
  );
  const missingPaperCount = missingPaperRecords.length;

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

  // Max value for bar chart scaling
  const maxLeaveCount = Math.max(...leaveTypeDist.map((d) => d.count), 5);

  return (
    <div className="space-y-5">
      {/* 1. KHỐI HERO BANNER CHÀO MỪNG & THAO TÁC NHANH */}
      <section aria-label="Hero Banner Chào mừng & Thao tác nhanh">
        <div className="rounded-2xl p-5 bg-gradient-to-r from-[#0F232E] to-[#163546] text-white shadow-md relative overflow-hidden">
          {/* Decorative glow background shapes */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
          <div className="absolute right-1/3 -bottom-20 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left: Greeting & Quick Info Badges */}
            <div className="space-y-2">
              <div className="text-xs font-mono text-teal-300 font-medium tracking-wide">
                {formatDateHeader(currentTime)}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {greeting}, Trần Thu Trang! 👋
              </h1>
              <p className="text-xs text-slate-300">
                Hệ thống Quản lý Nhân sự &amp; Chấm công — Vận hành đồng bộ, kiểm soát toàn diện
              </p>

              {/* 3 Quick Info Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="bg-white/10 rounded-full px-3 py-1 text-xs inline-flex items-center gap-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-teal-300" />
                  <span>{kpis.activeEmployees} / {kpis.totalEmployees} nhân sự có mặt</span>
                </span>
                <span className="bg-white/10 rounded-full px-3 py-1 text-xs inline-flex items-center gap-1.5 font-medium">
                  <CalendarOff className="w-3.5 h-3.5 text-sky-300" />
                  <span>{kpis.onLeaveToday} lượt nghỉ phép hôm nay</span>
                </span>
                <span className="bg-white/10 rounded-full px-3 py-1 text-xs inline-flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                  <span>{missingPaperCount} bản ghi giấy phép &quot;Chưa có&quot; cần bổ sung</span>
                </span>
              </div>
            </div>

            {/* Right: Digital Real-Time Clock */}
            <div className="self-start lg:self-center bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-xl border border-white/10 text-center shrink-0">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-wider text-teal-300">
                {formatTime(currentTime)}
              </div>
              <div className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest mt-0.5">
                Giờ Việt Nam
              </div>
            </div>
          </div>

          {/* Bottom: 5 Quick Action Pills (Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-5 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onOpenAddLeave}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white text-slate-900 hover:bg-teal-50 hover:text-teal-900 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4 text-[#0D9488]" />
              <span>Ghi nhận Nghỉ / Muộn</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddEmployee}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-teal-300" />
              <span>Thêm nhân sự mới</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('leave_logs')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <span>Giấy phép Chưa có ({missingPaperCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('annual_report')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-sky-300" />
              <span>Báo cáo tổng hợp</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('employees')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer col-span-2 sm:col-span-1"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Quản lý Nhân sự</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. DẢI 4 THẺ CHỈ SỐ KPI NHỎ GỌN (COMPACT KPI CARDS) */}
      <section aria-label="Chỉ số KPI nhân sự tổng quan">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: Tổng số nhân sự */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-medium truncate">Tổng số nhân sự</div>
              <div
                data-testid="kpi-total-employees"
                className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight"
              >
                {kpis.totalEmployees}
              </div>
              <div className="text-[11px] text-slate-400 truncate">Toàn bộ hồ sơ</div>
            </div>
          </div>

          {/* KPI 2: Đang làm việc */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-medium truncate">Đang làm việc</div>
              <div
                data-testid="kpi-active-employees"
                className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight"
              >
                {kpis.activeEmployees}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium truncate">
                {kpis.totalEmployees > 0
                  ? `${Math.round((kpis.activeEmployees / kpis.totalEmployees) * 100)}% hoạt động`
                  : '0%'}
              </div>
            </div>
          </div>

          {/* KPI 3: Nghỉ phép hôm nay */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <CalendarOff className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-medium truncate">Nghỉ phép hôm nay</div>
              <div
                data-testid="kpi-leave-today"
                className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight"
              >
                {kpis.onLeaveToday}
              </div>
              <div className="text-[11px] text-slate-400 truncate" title={kpis.onLeaveTodayNames.join(', ')}>
                {kpis.onLeaveTodayNames.length > 0 ? kpis.onLeaveTodayNames.join(', ') : 'Đủ mặt'}
              </div>
            </div>
          </div>

          {/* KPI 4: Đi muộn trong tháng */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <ClockAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-medium truncate">Đi muộn trong tháng</div>
              <div className="flex items-baseline gap-1">
                <span
                  data-testid="kpi-late-count"
                  className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight"
                >
                  {kpis.lateCountInMonth}
                </span>
                <span className="text-xs font-mono text-slate-500">lượt</span>
              </div>
              <div className="text-[11px] text-amber-700 font-medium truncate">
                Tổng {kpis.lateHoursInMonth} giờ
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. BỐ CỤC CHÍNH CHIA 3 CỘT (2 CỘT TRÁI - 1 CỘT PHẢI) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Left Column (2/3 width - lg:col-span-2 flex flex-col gap-4) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Top Row: 2 Charts side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chart 1: Thống kê loại hình nghỉ trong tháng (Bar Chart) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between h-[280px]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xs font-bold text-slate-900">
                    Thống kê loại hình nghỉ trong tháng
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tháng 11/2026 (Phép năm, Không lương, Chế độ, Đi muộn)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAddLeave}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Ghi nhận</span>
                </button>
              </div>

              {/* Bar Chart with Grid Lines */}
              <div className="pt-2 pb-1 flex-1 flex flex-col justify-end">
                <div className="relative h-36 flex items-end justify-around gap-3 px-2 border-b border-slate-200">
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
                          className="w-full max-w-[42px] rounded-t-lg transition-all duration-500 group-hover:opacity-90 shadow-xs"
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
                <div className="flex justify-around gap-2 pt-2 px-1 text-center">
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

            {/* Chart 2: Phân bổ nhân sự theo Nhóm / Bộ phận (Donut Chart + Legend) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between h-[280px]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xs font-bold text-slate-900">
                    Phân bổ nhân sự theo Bộ phận
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tỷ trọng tại {departmentDist.length} phòng ban
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('employees')}
                  className="text-[11px] font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors cursor-pointer"
                >
                  Chi tiết
                </button>
              </div>

              <div className="flex items-center gap-4 py-1 flex-1">
                {/* SVG Donut Chart */}
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
                <div className="flex-1 w-full flex flex-col justify-center gap-1.5 max-h-36 overflow-y-auto pr-1">
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
          </div>

          {/* Bottom Row: Recent Leave Records Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Ghi chép Nghỉ phép &amp; Đi muộn Gần đây
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các bản ghi mới nhất trong hệ thống
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('leave_logs')}
                className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Xem toàn bộ ({recentRecords.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
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
                  {recentRecords.slice(0, 8).map((rec) => {
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
          </div>
        </div>

        {/* Right Column (1/3 width - lg:col-span-1) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Card: Hôm nay & Cần xử lý */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col gap-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#0D9488]" />
                <span>Hôm nay của đơn vị</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Danh sách nhân sự nghỉ phép trong ngày
              </p>
            </div>

            <div className="space-y-2">
              {kpis.onLeaveToday > 0 ? (
                <div className="p-3 rounded-lg bg-sky-50/70 border border-sky-100 text-xs text-sky-900 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-sky-800">
                    <CalendarOff className="w-3.5 h-3.5" />
                    <span>{kpis.onLeaveToday} nhân sự đang nghỉ phép hôm nay:</span>
                  </div>
                  <div className="text-[11px] text-sky-700 font-medium pl-5">
                    {kpis.onLeaveTodayNames.join(', ')}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Hôm nay 100% nhân sự đi làm đầy đủ, không có lịch nghỉ phép.</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Cần bổ sung giấy phép</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bản ghi đang ở trạng thái &quot;Chưa có&quot;
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800">
                  {missingPaperCount}
                </span>
              </div>

              {missingPaperCount > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {missingPaperRecords.slice(0, 6).map((rec) => {
                    const emp = empMap.get(rec.employeeId);
                    const meta = LEAVE_TYPE_META[rec.type];
                    return (
                      <div
                        key={rec.id}
                        onClick={() => onNavigate('leave_logs')}
                        className="p-2.5 rounded-lg border border-amber-200/80 bg-amber-50/40 hover:bg-amber-50 transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {emp?.fullName || 'N/A'}
                            <span className="font-normal font-mono text-slate-500 ml-1">
                              ({emp?.employeeCode})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1.5">
                            <span className="font-medium" style={{ color: meta.textColor }}>
                              {meta.shortLabel}
                            </span>
                            <span>·</span>
                            <span className="font-mono">{formatDateVN(rec.startDate)}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 shrink-0">
                          Chưa có
                        </span>
                      </div>
                    );
                  })}
                  {missingPaperCount > 6 && (
                    <button
                      type="button"
                      onClick={() => onNavigate('leave_logs')}
                      className="w-full text-center text-xs font-semibold text-[#0D9488] hover:underline pt-1 cursor-pointer"
                    >
                      Xem thêm {missingPaperCount - 6} bản ghi khác...
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                  Tuyệt vời! Tất cả bản ghi đã đầy đủ giấy phép đính kèm.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
