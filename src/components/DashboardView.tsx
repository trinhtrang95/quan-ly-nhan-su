import React from 'react';
import {
  Users,
  UserCheck,
  CalendarOff,
  ClockAlert,
  AlertTriangle,
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
  matrixRows,
  onNavigate,
  onOpenAddLeave,
  onInspectAttachment,
}) => {
  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));
  const lowLeaveList = matrixRows.filter((r) => r.remainingAnnualLeave <= 2);

  return (
    <div className="space-y-6">
      {/* 5 KPI Stat Cards Grid */}
      <section aria-label="Chỉ số KPI nhân sự tổng quan">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

          {/* KPI 4: Lượt đi muộn trong tháng (kèm tổng số giờ) */}
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

          {/* KPI 5: Nhân sự sắp hết phép năm */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => onNavigate('annual_report')}
                aria-label="Xem báo cáo nhân sự sắp hết phép năm"
                className="text-xs font-medium text-slate-400 hover:text-rose-600 inline-flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <span>Kiểm tra</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div
                data-testid="kpi-low-leave"
                className="text-3xl font-extrabold text-rose-600 font-mono tabular-nums tracking-tight"
              >
                {kpis.lowLeaveEmployeesCount}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700">
                Nhân sự sắp hết phép năm
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                Tồn phép năm còn lại &le; 2.0 ngày
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2 Horizontal Progress Chart Cards */}
      <section
        aria-label="Biểu đồ phân bổ nhân sự và thống kê nghỉ phép"
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        {/* Card 1: Phân bổ nhân sự theo Nhóm/Bộ phận */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Phân bổ nhân sự theo Nhóm/Bộ phận
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

          <div className="space-y-3.5">
            {departmentDist.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
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
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(item.percentage, item.count > 0 ? 6 : 0)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Thống kê loại hình nghỉ trong tháng */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Thống kê loại hình nghỉ trong tháng (Tháng 11/2026)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tổng hợp lượt nghỉ phép năm, không lương, chế độ và đi muộn
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

          <div className="space-y-3.5">
            {leaveTypeDist.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-slate-700 truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                    <span className="font-bold text-slate-900">{item.subLabel}</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(item.percentage, item.count > 0 ? 8 : 0)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Quick Action & Alert Tables */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Cảnh báo tồn phép năm thấp */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Cảnh báo Nhân sự Sắp hết Phép năm
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các nhân sự có quỹ phép năm 2026 còn lại từ 2 ngày trở xuống
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('annual_report')}
              className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
            >
              Xem ma trận
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {lowLeaveList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Tất cả nhân sự đều còn trên 2 ngày phép tiêu chuẩn.
              </div>
            ) : (
              lowLeaveList.map((row) => (
                <div
                  key={row.employee.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={row.employee.avatarUrl}
                      alt={row.employee.fullName}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {row.employee.fullName}{' '}
                        <span className="font-mono text-slate-400 font-normal">
                          ({row.employee.employeeCode})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {row.employee.department}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <div
                      className={`text-xs font-bold ${
                        row.remainingAnnualLeave <= 0
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}
                    >
                      Còn {row.remainingAnnualLeave} / {row.employee.standardAnnualLeave} ngày
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Đã nghỉ: {row.totalAnnualUsed} ngày
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lịch sử ghi chép gần đây */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Ghi chép Nghỉ phép &amp; Đi muộn Gần đây
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bấm vào biểu tượng chứng từ để đối chiếu ảnh chụp giấy xin phép / viện phí
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
                  <th className="py-2.5 px-3">Loại ghi chép</th>
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
                          {meta.shortLabel}
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
      </section>
    </div>
  );
};
