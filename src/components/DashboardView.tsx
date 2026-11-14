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
} from 'lucide-react';
import {
  ActiveModule,
  DashboardKPIs,
  DistributionItem,
  Employee,
  EmployeeAnnualMatrixRow,
  LeaveRecord,
  UserAccount,
} from '../types/hr';
import { formatDateVN, LEAVE_TYPE_META } from '../utils/hrCalculations';

interface DashboardViewProps {
  currentUser: UserAccount | null;
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
  currentUser,
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
  const displayUserName =
    currentUser?.fullName?.trim() || currentUser?.username?.trim() || 'Quản trị viên';

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

  // Max value for bar chart scaling & clean Y-axis ticks
  const rawMaxLeave = Math.max(...leaveTypeDist.map((d) => d.count), 0);
  const yAxisMax = Math.max(Math.ceil(rawMaxLeave / 4) * 4, 8);
  const yTicks = [
    yAxisMax,
    Math.round(yAxisMax * 0.75),
    Math.round(yAxisMax * 0.5),
    Math.round(yAxisMax * 0.25),
    0,
  ];

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
                {greeting}, {displayUserName}! 👋
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

      {/* 3. BỐ CỤC 3 KHỐI (3 CỘT ĐỀU NHAU KÉO DÀI CHẠM ĐÁY TRANG) */}
      <section
        aria-label="Biểu đồ thống kê và Ghi chép gần đây"
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch min-h-[420px]"
      >
        {/* KHỐI 1 (CỘT 1): Biểu đồ Thống kê loại hình nghỉ trong tháng */}
        <div className="h-full bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Thống kê loại hình nghỉ trong tháng
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tháng 11/2026 (Phép năm, Không lương, Chế độ, Đi muộn)
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAddLeave}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors cursor-pointer shrink-0"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Ghi nhận</span>
            </button>
          </div>

          {/* Bar Chart with Y-Axis ticks and horizontal grid lines */}
          <div className="flex-1 flex flex-col justify-end pt-4 pb-1">
            <div className="flex items-stretch gap-2 h-60">
              {/* Y-Axis Labels */}
              <div className="flex flex-col justify-between text-[10px] font-mono text-slate-400 text-right pr-1 select-none">
                {yTicks.map((tick, idx) => (
                  <span key={idx} className="leading-none">
                    {tick}
                  </span>
                ))}
              </div>

              {/* Plot Area */}
              <div className="relative flex-1 flex items-end justify-around gap-3 px-2 border-b border-l border-slate-200">
                {/* Horizontal Dashed Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="w-full border-b border-slate-100 border-dashed" />
                  <div className="w-full border-b border-slate-100 border-dashed" />
                  <div className="w-full border-b border-slate-100 border-dashed" />
                  <div className="w-full border-b border-slate-100 border-dashed" />
                  <div className="w-full" />
                </div>

                {leaveTypeDist.map((item) => {
                  const heightPct = Math.round((item.count / yAxisMax) * 100);
                  return (
                    <div
                      key={item.label}
                      className="flex-1 flex flex-col items-center h-full justify-end group z-10"
                    >
                      <span className="text-[11px] font-mono font-bold text-slate-700 mb-1">
                        {item.count}
                      </span>
                      <div
                        className="w-full max-w-[44px] rounded-t-lg transition-all duration-500 group-hover:opacity-90 shadow-xs"
                        style={{
                          height: `${Math.max(heightPct, item.count > 0 ? 10 : 4)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-around gap-2 pt-3 pl-7 pr-1 text-center">
              {leaveTypeDist.map((item) => (
                <div key={item.label} className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-slate-800 truncate" title={item.label}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                    {item.subLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KHỐI 2 (CỘT 2): Biểu đồ Phân bổ nhân sự theo Bộ phận */}
        <div className="h-full bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Phân bổ nhân sự theo Bộ phận
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tỷ trọng nhân sự tại {departmentDist.length} bộ phận
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('employees')}
              className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors cursor-pointer shrink-0"
            >
              Chi tiết
            </button>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 py-2">
            {/* SVG Donut Chart */}
            <div className="relative w-36 h-36 shrink-0">
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

            {/* Full 8 Departments Legend */}
            <div className="flex-1 w-full flex flex-col justify-center gap-2">
              {departmentDist.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-slate-700 truncate" title={item.label}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums pl-2">
                    <span className="font-bold text-slate-900">{item.count}</span>
                    <span className="text-slate-400 text-[11px]">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KHỐI 3 (CỘT 3): Bảng Nghỉ phép & Đi muộn Gần đây */}
        <div className="h-full bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col">
          {/* Header của Khối 3 */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Nghỉ phép &amp; Đi muộn Gần đây
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tổng số {recentRecords.length} bản ghi phát sinh
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('leave_logs')}
              className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer inline-flex items-center gap-0.5 shrink-0"
            >
              <span>Xem toàn bộ ({recentRecords.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bảng dữ liệu 4 cột bên trong Khối 3 */}
          <div className="flex-1 overflow-y-auto overflow-x-auto max-h-[340px] rounded-lg border border-slate-200/80">
            {recentRecords.length === 0 ? (
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center p-4 text-xs text-slate-400">
                Chưa có bản ghi nghỉ phép hoặc đi muộn nào.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#0F232E] text-white text-[10px] font-semibold tracking-wider uppercase z-10">
                  <tr>
                    <th className="py-2 px-2.5 bg-[#0F232E]">Thời gian</th>
                    <th className="py-2 px-2.5 bg-[#0F232E]">Nhân sự</th>
                    <th className="py-2 px-2 bg-[#0F232E]">Loại giấy phép</th>
                    <th className="py-2 px-2.5 text-center bg-[#0F232E]">Giấy phép</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recentRecords.slice(0, 12).map((rec) => {
                    const emp = empMap.get(rec.employeeId);
                    const meta = LEAVE_TYPE_META[rec.type];
                    const hasPaper =
                      rec.paperStatus === 'Đã có' ||
                      (!rec.paperStatus && Boolean(rec.attachmentUrl));
                    const shortDate = formatDateVN(rec.startDate).slice(0, 5);

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/90 transition-colors"
                      >
                        {/* 1. THỜI GIAN */}
                        <td className="py-2 px-2.5 whitespace-nowrap align-middle">
                          <div className="font-mono font-bold text-slate-800 text-[11px]">
                            {shortDate}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {rec.amount} {meta.unit}
                          </div>
                        </td>

                        {/* 2. NHÂN SỰ */}
                        <td className="py-2 px-2.5 align-middle max-w-[130px]">
                          <div
                            className="font-semibold text-slate-900 truncate text-[11px]"
                            title={emp?.fullName || 'N/A'}
                          >
                            {emp?.fullName || 'N/A'}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate font-mono">
                            {emp?.employeeCode}
                            {emp?.department ? ` · ${emp.department}` : ''}
                          </div>
                        </td>

                        {/* 3. LOẠI GIẤY PHÉP */}
                        <td className="py-2 px-2 whitespace-nowrap align-middle">
                          <span
                            className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold"
                            style={{
                              backgroundColor: meta.bgLight,
                              color: meta.textColor,
                            }}
                          >
                            {rec.type === 'annual_leave'
                              ? 'Nghỉ phép năm'
                              : rec.type === 'unpaid_leave'
                                ? 'Nghỉ không lương'
                                : rec.type === 'regime_leave'
                                  ? 'Nghỉ chế độ'
                                  : 'Đi muộn'}
                          </span>
                        </td>

                        {/* 4. GIẤY PHÉP */}
                        <td className="py-2 px-2.5 text-center whitespace-nowrap align-middle">
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
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                                hasPaper
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                              }`}
                            >
                              <FileImage className="w-3 h-3" />
                              <span>{hasPaper ? 'Đã có' : 'Chưa có'}</span>
                            </button>
                          ) : (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                hasPaper
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-600 border border-red-200'
                              }`}
                            >
                              {hasPaper ? 'Đã có' : 'Chưa có'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
