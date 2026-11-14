import React, { useEffect, useRef, useState } from 'react';
import {
  Users,
  Calendar,
  Clock,
  ArrowUpRight,
  FileImage,
  CalendarPlus,
  UserPlus,
  BarChart3,
  AlertTriangle,
  Search,
  Settings,
  ClipboardList,
  ChevronRight,
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
import { formatDateVN, isDateInRange, LEAVE_TYPE_META } from '../utils/hrCalculations';

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
  onFilterMissingPaper?: () => void;
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
  onFilterMissingPaper,
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

  // Smart menu search state
  const [menuQuery, setMenuQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Column 3: Top Leave & Late state
  const [topMonthFilter, setTopMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [topTab, setTopTab] = useState<'leave' | 'late'>('leave');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    const weekNum = Math.ceil(
      ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    return `${dayName}, ${dd}/${mm}/${yyyy} · Tuần ${weekNum}`;
  };

  const hour = currentTime.getHours();
  const greeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const displayUserName =
    currentUser?.fullName?.trim() || currentUser?.username?.trim() || 'Quản trị viên';

  // Real-time today's YYYY-MM-DD
  const todayStr = `${currentTime.getFullYear()}-${String(
    currentTime.getMonth() + 1
  ).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

  // 1. Active employees & working today calculation
  const activeEmployeesCount = employees.filter(
    (e) => e.status === 'Đang làm việc' || e.status === 'Đang thử việc'
  ).length;

  // 2. Leave today records (Phép năm, Không lương, Chế độ)
  const leaveTodayRecords = records.filter(
    (r) =>
      r.type !== 'late_early' &&
      isDateInRange(todayStr, r.startDate, r.endDate || r.startDate)
  );
  const onLeaveTodayEmpCount = new Set(leaveTodayRecords.map((r) => r.employeeId)).size;
  const leaveTodayCount = leaveTodayRecords.length;
  const leaveTodayDays = Number(
    leaveTodayRecords.reduce((sum, r) => sum + r.amount, 0).toFixed(2)
  );

  const workingTodayCount = Math.max(0, activeEmployeesCount - onLeaveTodayEmpCount);
  const attendancePct =
    activeEmployeesCount > 0
      ? Math.round((workingTodayCount / activeEmployeesCount) * 100)
      : 100;

  // 3. Late today records (Đi muộn / Về sớm hôm nay)
  const lateTodayRecords = records.filter(
    (r) =>
      r.type === 'late_early' &&
      isDateInRange(todayStr, r.startDate, r.endDate || r.startDate)
  );
  const lateTodayCount = lateTodayRecords.length;
  const lateTodayHours = Number(
    lateTodayRecords.reduce((sum, r) => sum + r.amount, 0).toFixed(2)
  );

  // 4. Missing paper records ("Chưa có")
  const missingPaperRecords = records.filter(
    (r) => (r.paperStatus || (r.attachmentUrl ? 'Đã có' : 'Chưa có')) === 'Chưa có'
  );
  const missingPaperCount = missingPaperRecords.length;

  const handleOpenMissingPaper = () => {
    if (onFilterMissingPaper) {
      onFilterMissingPaper();
    } else {
      onNavigate('leave_logs');
    }
  };

  const normalizeText = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

  const menuActions = [
    {
      id: 'employees',
      title: 'Quản lý Nhân sự',
      subtitle: 'Danh sách hồ sơ, phòng ban & xuất nhập Excel',
      icon: Users,
      iconColor: 'text-emerald-600 bg-emerald-50',
      action: () => onNavigate('employees'),
    },
    {
      id: 'add_employee',
      title: 'Thêm nhân sự mới',
      subtitle: 'Mở biểu mẫu thêm hồ sơ nhân viên mới',
      icon: UserPlus,
      iconColor: 'text-teal-600 bg-teal-50',
      action: () => onOpenAddEmployee(),
    },
    {
      id: 'leave_logs',
      title: 'Nghỉ phép & Đi muộn',
      subtitle: 'Nhật ký chấm phép, đi muộn & chứng từ đính kèm',
      icon: ClipboardList,
      iconColor: 'text-blue-600 bg-blue-50',
      action: () => onNavigate('leave_logs'),
    },
    {
      id: 'add_leave',
      title: 'Ghi nhận Nghỉ / Đi muộn mới',
      subtitle: 'Tạo mới bản ghi phép năm, không lương, đi muộn',
      icon: CalendarPlus,
      iconColor: 'text-amber-600 bg-amber-50',
      action: () => onOpenAddLeave(),
    },
    {
      id: 'missing_paper',
      title: `Cần bổ sung giấy phép (${missingPaperCount})`,
      subtitle: 'Lọc các bản ghi có trạng thái giấy phép "Chưa có"',
      icon: AlertTriangle,
      iconColor: 'text-rose-600 bg-rose-50',
      action: () => handleOpenMissingPaper(),
    },
    {
      id: 'annual_report',
      title: 'Báo cáo tổng hợp',
      subtitle: 'Ma trận phép năm 12 tháng & theo dõi tồn phép',
      icon: BarChart3,
      iconColor: 'text-indigo-600 bg-indigo-50',
      action: () => onNavigate('annual_report'),
    },
    ...(currentUser?.role !== 'user'
      ? [
          {
            id: 'settings',
            title: 'Hệ thống / Cài đặt',
            subtitle: 'Quản lý đơn vị, bộ phận, tài khoản & sao lưu dữ liệu',
            icon: Settings,
            iconColor: 'text-slate-700 bg-slate-100',
            action: () => onNavigate('settings'),
          },
        ]
      : []),
  ];

  const filteredMenuActions = menuQuery.trim()
    ? menuActions.filter((item) => {
        const q = normalizeText(menuQuery.trim());
        return (
          normalizeText(item.title).includes(q) ||
          normalizeText(item.subtitle).includes(q)
        );
      })
    : menuActions;

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

  // Available Month/Year options for Column 3 Top Ranking filter
  const currentYear = currentTime.getFullYear();
  const monthOptions = Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const value = `${currentYear}-${String(m).padStart(2, '0')}`;
    return {
      value,
      label: `Tháng ${String(m).padStart(2, '0')}/${currentYear}`,
    };
  });

  // Compute Top Leave / Late Ranking for Column 3
  const topRankingList = React.useMemo(() => {
    const filtered = records.filter((r) => {
      const matchMonth =
        topMonthFilter === 'ALL_YEAR'
          ? r.startDate.startsWith(String(currentYear))
          : r.startDate.slice(0, 7) === topMonthFilter ||
            Boolean(r.endDate && r.endDate.slice(0, 7) === topMonthFilter);
      if (!matchMonth) return false;
      return topTab === 'leave' ? r.type !== 'late_early' : r.type === 'late_early';
    });

    const grouped = new Map<
      string,
      {
        employeeId: string;
        fullName: string;
        employeeCode: string;
        department: string;
        totalAmount: number;
        recordCount: number;
      }
    >();

    for (const r of filtered) {
      const emp = empMap.get(r.employeeId);
      const existing = grouped.get(r.employeeId);
      if (existing) {
        existing.totalAmount = Number((existing.totalAmount + r.amount).toFixed(2));
        existing.recordCount += 1;
      } else {
        grouped.set(r.employeeId, {
          employeeId: r.employeeId,
          fullName: emp?.fullName || 'Nhân sự',
          employeeCode: emp?.employeeCode || '---',
          department: emp?.department || 'Chưa phân bộ phận',
          totalAmount: Number(r.amount.toFixed(2)),
          recordCount: 1,
        });
      }
    }

    const list = Array.from(grouped.values());
    list.sort((a, b) => {
      if (topTab === 'leave') {
        return b.totalAmount - a.totalAmount || b.recordCount - a.recordCount;
      }
      return b.recordCount - a.recordCount || b.totalAmount - a.totalAmount;
    });
    return list;
  }, [records, topMonthFilter, topTab, currentYear, empMap]);

  return (
    <div className="lg:h-screen lg:max-h-screen lg:overflow-hidden flex flex-col justify-between p-3 gap-3">
      {/* 1. KHỐI HERO BANNER CHÀO MỪNG (shrink-0) */}
      <section aria-label="Hero Banner Chào mừng" className="shrink-0 relative z-30">
        <div className="rounded-2xl px-6 py-4 bg-gradient-to-r from-[#0F232E] to-[#163546] text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
          {/* Cụm Bên Trái: Thời gian & Lời chào + Ô tìm tính năng bên dưới */}
          <div className="min-w-0 w-full md:w-auto flex-1">
            <div className="text-xs text-teal-400 font-medium">
              {formatDateHeader(currentTime)}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mt-0.5 truncate">
              {greeting}, {displayUserName}! 👋
            </h1>

            {/* Ô tìm kiếm "Tìm tính năng trong menu" nằm ngay dưới Thời gian & Lời chào */}
            <div
              ref={searchContainerRef}
              className="relative w-full md:w-80 lg:w-96 mt-2.5"
            >
              <div className="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 focus-within:bg-white/20 border border-white/15 rounded-xl px-3.5 py-2 backdrop-blur transition-colors">
                <Search className="w-4 h-4 text-slate-300 shrink-0" />
                <input
                  type="text"
                  value={menuQuery}
                  onFocus={() => setIsMenuOpen(true)}
                  onClick={() => setIsMenuOpen(true)}
                  onChange={(e) => {
                    setMenuQuery(e.target.value);
                    setIsMenuOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsMenuOpen(false);
                    } else if (e.key === 'Enter' && filteredMenuActions.length > 0) {
                      filteredMenuActions[0].action();
                      setIsMenuOpen(false);
                      setMenuQuery('');
                    }
                  }}
                  placeholder="Tìm tính năng trong menu..."
                  className="w-full bg-transparent text-[16px] md:text-sm text-white placeholder-slate-300 outline-none"
                />
              </div>

              {/* Dropdown danh sách gợi ý tính năng */}
              {isMenuOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 max-h-72 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Truy cập nhanh tính năng
                  </div>
                  {filteredMenuActions.length === 0 ? (
                    <div className="px-3.5 py-3 text-xs text-slate-500 text-center">
                      Không tìm thấy tính năng phù hợp với &ldquo;{menuQuery}&rdquo;
                    </div>
                  ) : (
                    filteredMenuActions.map((item) => {
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            item.action();
                            setIsMenuOpen(false);
                            setMenuQuery('');
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-3 transition-colors cursor-pointer group"
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.iconColor}`}
                          >
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-[#0D9488] transition-colors truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {item.subtitle}
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#0D9488] shrink-0" />
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cụm Bên Phải: Đồng hồ số thời gian thực */}
          <div className="bg-white/10 border border-white/10 backdrop-blur px-4 py-2 rounded-xl text-center shrink-0">
            <div className="text-xl md:text-2xl font-bold text-teal-300 tracking-wider font-mono leading-tight">
              {formatTime(currentTime)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-300">
              GIỜ VIỆT NAM
            </div>
          </div>
        </div>
      </section>

      {/* 2. DẢI 4 THẺ CHỈ SỐ KPI NHỎ GỌN (shrink-0) */}
      <section aria-label="Chỉ số KPI nhân sự tổng quan" className="shrink-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Thẻ 1 — Tổng số nhân sự hôm nay */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-medium truncate">
                Tổng số nhân sự hôm nay
              </div>
              <div
                data-testid="kpi-total-employees"
                className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight leading-tight"
              >
                {workingTodayCount}/{activeEmployeesCount}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold truncate">
                {attendancePct}% có mặt
              </div>
            </div>
          </div>

          {/* Thẻ 2 — Nghỉ phép hôm nay */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-medium truncate">
                Nghỉ phép hôm nay
              </div>
              <div
                data-testid="kpi-leave-today"
                className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight leading-tight"
              >
                {leaveTodayCount}
              </div>
              <div className="text-[11px] text-blue-600 font-medium truncate">
                {leaveTodayCount === 0
                  ? 'Đủ mặt 100%'
                  : `Tổng ${leaveTodayDays} ngày nghỉ`}
              </div>
            </div>
          </div>

          {/* Thẻ 3 — Đi muộn hôm nay */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-medium truncate">
                Đi muộn hôm nay
              </div>
              <div
                data-testid="kpi-late-count"
                className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight leading-tight"
              >
                {lateTodayCount} lượt
              </div>
              <div className="text-[11px] text-amber-700 font-medium truncate">
                Tổng {lateTodayHours} giờ
              </div>
            </div>
          </div>

          {/* Thẻ 4 — Cần bổ sung giấy phép */}
          <button
            type="button"
            onClick={handleOpenMissingPaper}
            className="text-left bg-white hover:bg-rose-50/40 rounded-xl p-3 border border-slate-200/80 hover:border-rose-200 shadow-sm flex items-center gap-3 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-medium truncate">
                Cần bổ sung giấy phép
              </div>
              <div
                data-testid="kpi-missing-paper"
                className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight leading-tight"
              >
                {missingPaperCount}
              </div>
              <div className="text-[11px] text-rose-600 font-medium truncate">
                Trạng thái &quot;Chưa có&quot;
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* 3. BỐ CỤC 3 CỘT ĐỀU NHAU BÊN DƯỚI (flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch) */}
      <section
        aria-label="Biểu đồ thống kê, Ghi chép gần đây và Top Nghỉ phép Đi muộn"
        className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch"
      >
        {/* ================= CỘT 1 (BÊN TRÁI): XẾP CHỒNG 2 KHỐI BIỂU ĐỒ TRÊN - DƯỚI ================= */}
        <div className="flex flex-col gap-3 h-full min-h-0">
          {/* Khối trên: Phân bổ nhân sự theo Bộ phận */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  Phân bổ nhân sự theo Bộ phận
                </h2>
                <p className="text-[10px] text-slate-500 truncate">
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

            <div className="flex-1 min-h-0 flex items-center gap-3">
              {/* SVG Donut Chart nhỏ gọn bên trái */}
              <div className="relative w-24 h-24 xl:w-28 xl:h-28 shrink-0">
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
                  <span className="text-base xl:text-lg font-extrabold text-slate-900 font-mono leading-none">
                    {kpis.totalEmployees}
                  </span>
                  <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    Nhân sự
                  </span>
                </div>
              </div>

              {/* Danh sách đầy đủ cả 8 bộ phận bên phải */}
              <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
                {departmentDist.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between text-[11px] leading-tight py-0.5"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span
                        className="font-medium text-slate-700 truncate"
                        title={item.label}
                      >
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 font-mono tabular-nums pl-1.5">
                      <span className="font-bold text-slate-900">{item.count}</span>
                      <span className="text-slate-400 text-[10px]">
                        ({item.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Khối dưới: Thống kê loại hình nghỉ trong tháng */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  Thống kê loại hình nghỉ trong tháng
                </h2>
                <p className="text-[10px] text-slate-500 truncate">
                  Phép năm, Không lương, Chế độ &amp; Đi muộn
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenAddLeave}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] transition-colors cursor-pointer shrink-0"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>+ Ghi nhận</span>
              </button>
            </div>

            {/* Biểu đồ cột có đường lưới ngang đứt nét và trục Y tự động co giãn */}
            <div className="flex-1 min-h-[110px] lg:min-h-0 flex flex-col justify-end pt-1">
              <div className="flex-1 min-h-0 flex items-stretch gap-2">
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
                        <span className="text-[10px] font-mono font-bold text-slate-700 mb-0.5">
                          {item.count}
                        </span>
                        <div
                          className="w-full max-w-[36px] rounded-t-md transition-all duration-500 group-hover:opacity-90 shadow-xs"
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
              <div className="flex justify-around gap-1.5 pt-1.5 pl-6 pr-1 text-center shrink-0">
                {leaveTypeDist.map((item) => (
                  <div key={item.label} className="flex-1 min-w-0">
                    <div
                      className="text-[10px] font-bold text-slate-800 truncate leading-tight"
                      title={item.label}
                    >
                      {item.label}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono truncate leading-tight">
                      {item.subLabel}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ================= CỘT 2 (Ở GIỮA): NGHỈ PHÉP & ĐI MUỘN GẦN ĐÂY ================= */}
        <div className="h-full min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col">
          {/* Header của Cột 2 */}
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                Nghỉ phép &amp; Đi muộn Gần đây
              </h2>
              <p className="text-[11px] text-slate-500">
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

          {/* Bảng dữ liệu 4 cột bên trong Cột 2 (flex-1 min-h-0 overflow-y-auto) */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-lg border border-slate-200/80">
            {recentRecords.length === 0 ? (
              <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4 text-xs text-slate-400">
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
                  {recentRecords.map((rec) => {
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
                        <td className="py-1.5 px-2.5 whitespace-nowrap align-middle">
                          <div className="font-mono font-bold text-slate-800 text-[11px]">
                            {shortDate}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {rec.amount} {meta.unit}
                          </div>
                        </td>

                        {/* 2. NHÂN SỰ */}
                        <td className="py-1.5 px-2.5 align-middle max-w-[125px]">
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
                        <td className="py-1.5 px-2 whitespace-nowrap align-middle">
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
                        <td className="py-1.5 px-2.5 text-center whitespace-nowrap align-middle">
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

        {/* ================= CỘT 3 (BÊN PHẢI): TOP NGƯỜI NGHỈ VÀ ĐI MUỘN TRONG THÁNG ================= */}
        <div className="h-full min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col gap-3">
          {/* Header & Bộ lọc điều khiển (shrink-0 flex flex-col gap-2) */}
          <div className="shrink-0 flex flex-col gap-2">
            {/* Hàng trên: Tiêu đề + Dropdown chọn Tháng/Năm */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  Top Nghỉ phép &amp; Đi muộn
                </h2>
              </div>
              <select
                value={topMonthFilter}
                onChange={(e) => setTopMonthFilter(e.target.value)}
                aria-label="Chọn tháng thống kê Top Nghỉ phép và Đi muộn"
                className="text-[16px] sm:text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 outline-none focus:border-[#0D9488] transition-colors cursor-pointer shrink-0"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                <option value="ALL_YEAR">Cả năm {currentYear}</option>
              </select>
            </div>

            {/* Hàng dưới: Thanh chuyển đổi nhanh (Segmented Control / Tabs) */}
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setTopTab('leave')}
                className={`py-1.5 px-2.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  topTab === 'leave'
                    ? 'bg-white text-[#0F232E] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏖️ Nghỉ phép</span>
              </button>
              <button
                type="button"
                onClick={() => setTopTab('late')}
                className={`py-1.5 px-2.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  topTab === 'late'
                    ? 'bg-white text-[#0F232E] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>⏰ Đi muộn</span>
              </button>
            </div>
          </div>

          {/* Danh sách xếp hạng Top nhân sự (flex-1 min-h-0 overflow-y-auto) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-2">
            {topRankingList.length === 0 ? (
              <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                <div className="text-xs font-medium text-slate-400">
                  Không có nhân sự nào phát sinh trong tháng này
                </div>
              </div>
            ) : (
              topRankingList.map((item, idx) => {
                const rank = idx + 1;
                const rankBadgeClass =
                  rank === 1
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs'
                    : rank === 2
                      ? 'bg-slate-200 text-slate-800 border border-slate-300'
                      : rank === 3
                        ? 'bg-orange-100 text-orange-800 border border-orange-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200/80';

                return (
                  <div
                    key={item.employeeId}
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-slate-200/70 hover:border-slate-300 bg-slate-50/40 hover:bg-slate-50 transition-colors"
                  >
                    {/* Left: Rank Badge + Thông tin nhân sự */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg font-mono text-xs font-extrabold flex items-center justify-center shrink-0 ${rankBadgeClass}`}
                      >
                        #{rank}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-xs font-bold text-slate-900 truncate"
                          title={item.fullName}
                        >
                          {item.fullName}
                        </div>
                        <div
                          className="text-[10px] text-slate-500 font-mono truncate"
                          title={`${item.employeeCode} · ${item.department}`}
                        >
                          {item.employeeCode} · {item.department}
                        </div>
                      </div>
                    </div>

                    {/* Right: Chỉ số thống kê */}
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      {topTab === 'leave' ? (
                        <>
                          <div className="text-xs font-extrabold text-teal-700 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-md inline-block">
                            {item.totalAmount} ngày
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.recordCount} lượt
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-xs font-extrabold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-md inline-block">
                            {item.recordCount} lượt
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.totalAmount} giờ
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
