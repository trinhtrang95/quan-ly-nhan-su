import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  X,
  Eye,
  CalendarPlus,
  Info,
  ChevronDown,
  Search,
  Printer,
} from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
  EmployeeAnnualMatrixRow,
  LeavePolicyConfig,
  LeaveRecord,
  LeaveRecordType,
  MatrixViewMode,
} from '../types/hr';
import {
  calculateAnnualMatrixReport,
  calculateMonthlyAttendanceMatrix,
  formatDateVN,
  getShortGroupCode,
  LEAVE_TYPE_META,
  loadLeavePolicyConfig,
  MonthlyDayBadge,
} from '../utils/hrCalculations';
import { exportMonthlyAttendanceMatrixToExcel } from '../utils/exportUtils';
import { formatNumberVN } from '../utils/errorAndSecurityService';
import { ReportSubTab } from './Sidebar';

interface AnnualMatrixReportViewProps {
  employees: Employee[];
  records: LeaveRecord[];
  groups: DepartmentGroup[];
  activeSubTab?: ReportSubTab;
  onExportMatrixExcel: (
    rows: EmployeeAnnualMatrixRow[],
    year: number,
    viewMode: MatrixViewMode
  ) => void;
  onExportMatrixPDF: (
    rows: EmployeeAnnualMatrixRow[],
    year: number,
    viewMode: MatrixViewMode
  ) => void;
  onInspectAttachment: (url: string, title: string) => void;
  onQuickAddForEmployeeMonth: (
    employeeId: string,
    month: number,
    year: number
  ) => void;
}

const MONTH_DROPDOWN_OPTIONS: { value: string; label: string }[] = [
  { value: '2026-12', label: 'Tháng 12/2026' },
  { value: '2026-11', label: 'Tháng 11/2026' },
  { value: '2026-10', label: 'Tháng 10/2026' },
  { value: '2026-09', label: 'Tháng 09/2026' },
  { value: '2026-08', label: 'Tháng 08/2026' },
  { value: '2026-07', label: 'Tháng 07/2026' },
  { value: '2026-06', label: 'Tháng 06/2026' },
  { value: '2026-05', label: 'Tháng 05/2026' },
  { value: '2026-04', label: 'Tháng 04/2026' },
  { value: '2026-03', label: 'Tháng 03/2026' },
  { value: '2026-02', label: 'Tháng 02/2026' },
  { value: '2026-01', label: 'Tháng 01/2026' },
  { value: '2025-12', label: 'Tháng 12/2025' },
  { value: '2025-11', label: 'Tháng 11/2025' },
  { value: '2025-10', label: 'Tháng 10/2025' },
];

function getDefaultYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const candidate = `${y}-${m}`;
  if (MONTH_DROPDOWN_OPTIONS.some((opt) => opt.value === candidate)) {
    return candidate;
  }
  return '2026-11';
}

export const AnnualMatrixReportView: React.FC<AnnualMatrixReportViewProps> = ({
  employees,
  records,
  groups,
  activeSubTab = 'monthly_summary',
  onExportMatrixExcel,
  onExportMatrixPDF,
  onInspectAttachment,
  onQuickAddForEmployeeMonth,
}) => {
  // Monthly Summary filters
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(
    getDefaultYearMonth
  );
  const [monthlySearchQuery, setMonthlySearchQuery] = useState<string>('');
  const [monthlyDeptFilter, setMonthlyDeptFilter] = useState<string>('ALL');
  const [isMonthlyPrintOpen, setIsMonthlyPrintOpen] = useState<boolean>(false);

  // Interactive Popover state for clicked "ĐM" (Đi muộn) badge
  const [activeLateBadgeId, setActiveLateBadgeId] = useState<string | null>(
    null
  );

  // Interactive Popover state for clicked/hovered "Tồn phép" 3-line breakdown tooltip
  const [activeRemainingLeaveEmpId, setActiveRemainingLeaveEmpId] = useState<
    string | null
  >(null);

  // Sync with Leave Accrual Policy from System Settings
  const [leavePolicy, setLeavePolicy] = useState<LeavePolicyConfig>(() =>
    loadLeavePolicyConfig()
  );

  // Annual Matrix filters
  const [reportYear, setReportYear] = useState<number>(2026);
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<MatrixViewMode>('all');

  // Export dropdown state
  const [isExportDropdownOpen, setIsExportDropdownOpen] =
    useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePolicyChange = () => {
      setLeavePolicy(loadLeavePolicyConfig());
    };
    window.addEventListener('hr-leave-policy-change', handlePolicyChange);
    return () =>
      window.removeEventListener('hr-leave-policy-change', handlePolicyChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(e.target as Node)
      ) {
        setIsExportDropdownOpen(false);
      }
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('[data-late-badge="true"]')) {
        setActiveLateBadgeId(null);
      }
      if (target && !target.closest('[data-remaining-leave-cell="true"]')) {
        setActiveRemainingLeaveEmpId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse selectedYearMonth -> year & month
  const { parsedMonthYear, parsedMonthNum, formattedMonthTitle } =
    useMemo(() => {
      const parts = (selectedYearMonth || '2026-11').split('-');
      const y = Number(parts[0]) || 2026;
      const m = Number(parts[1]) || 11;
      const mPadded = String(m).padStart(2, '0');
      return {
        parsedMonthYear: y,
        parsedMonthNum: m,
        formattedMonthTitle: `Tháng ${mPadded}/${y}`,
      };
    }, [selectedYearMonth]);

  // Calculate Monthly Attendance Matrix Report
  const monthlyReport = useMemo(
    () =>
      calculateMonthlyAttendanceMatrix(
        employees,
        records,
        parsedMonthYear,
        parsedMonthNum,
        monthlyDeptFilter,
        monthlySearchQuery,
        undefined,
        leavePolicy
      ),
    [
      employees,
      records,
      parsedMonthYear,
      parsedMonthNum,
      monthlyDeptFilter,
      monthlySearchQuery,
      leavePolicy,
    ]
  );

  // State for Month Cell Detail Popup (shared by both views)
  const [selectedCell, setSelectedCell] = useState<{
    employee: Employee;
    month: number;
    year: number;
  } | null>(null);

  // Calculate Annual Matrix Report (12 months)
  const matrixRows = useMemo(
    () =>
      calculateAnnualMatrixReport(
        employees,
        records,
        reportYear,
        departmentFilter,
        leavePolicy
      ),
    [employees, records, reportYear, departmentFilter, leavePolicy]
  );

  const popupYearMatrixRows = useMemo(() => {
    if (!selectedCell) return [];
    if (selectedCell.year === reportYear && departmentFilter === 'ALL') {
      return matrixRows;
    }
    return calculateAnnualMatrixReport(
      employees,
      records,
      selectedCell.year,
      'ALL',
      leavePolicy
    );
  }, [
    selectedCell,
    reportYear,
    departmentFilter,
    matrixRows,
    employees,
    records,
    leavePolicy,
  ]);

  // Totals across all displayed employees in Annual Matrix
  const grandTotalStandard = matrixRows.reduce(
    (acc, r) => acc + r.employee.standardAnnualLeave,
    0
  );
  const grandTotalUsed = matrixRows.reduce(
    (acc, r) => Number((acc + r.totalAnnualUsed).toFixed(2)),
    0
  );
  const grandTotalRemaining = matrixRows.reduce(
    (acc, r) => Number((acc + r.remainingAnnualLeave).toFixed(2)),
    0
  );
  const grandTotalUnpaid = matrixRows.reduce(
    (acc, r) => Number((acc + r.totalUnpaidDays).toFixed(2)),
    0
  );
  const grandTotalLateHours = matrixRows.reduce(
    (acc, r) => Number((acc + r.totalLateHours).toFixed(2)),
    0
  );

  const popupRow = selectedCell
    ? popupYearMatrixRows.find(
        (r) => r.employee.id === selectedCell.employee.id
      )
    : null;
  const popupMonthData =
    popupRow && selectedCell ? popupRow.months[selectedCell.month] : null;

  // Render ultra-compact semantic badge:
  // PN: bg-green-100 text-green-700
  // CĐ: bg-blue-100 text-blue-700
  // KL: bg-orange-100 text-orange-700
  // ĐM: bg-red-100 text-red-700 (Hover/click hiện Tooltip xem số giờ/phút)
  const renderBadge = (badge: MonthlyDayBadge) => {
    if (badge.type === 'late_early') {
      const isOpen = activeLateBadgeId === badge.id;
      return (
        <div
          key={badge.id}
          data-late-badge="true"
          className="relative inline-flex items-center justify-center group/dm"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveLateBadgeId((prev) =>
                prev === badge.id ? null : badge.id
              );
            }}
            className="inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-mono font-bold leading-none bg-red-100 text-red-700 hover:bg-red-200/80 transition-colors cursor-pointer"
          >
            {badge.code}
          </button>

          {/* Interactive Tooltip / Popover báo chính xác số giờ/phút đi muộn (VD: 3h, 15p) khi click hoặc hover */}
          <div
            role="tooltip"
            onClick={(e) => e.stopPropagation()}
            className={`${
              isOpen
                ? 'opacity-100 visible translate-y-0'
                : 'opacity-0 invisible translate-y-1 group-hover/dm:opacity-100 group-hover/dm:visible group-hover/dm:translate-y-0'
            } pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 px-2.5 py-1.5 rounded-lg bg-white text-slate-800 text-[11px] font-sans font-medium whitespace-nowrap shadow-lg border border-slate-200 transition-all duration-150`}
          >
            <div className="flex items-center gap-1">
              <span className="text-red-600 font-semibold">Đi muộn:</span>
              <span className="font-mono font-bold text-slate-900">
                {badge.durationText}
              </span>
            </div>
            {badge.record.reason && (
              <div className="text-[10px] text-slate-500 font-normal max-w-[160px] truncate mt-0.5">
                {badge.record.reason}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Semantic Pastel Colors: PN (green-100/700), CĐ (blue-100/700), KL (orange-100/700)
    let badgeStyle = 'bg-green-100 text-green-700'; // PN (Phép năm)
    if (badge.type === 'regime_leave') {
      badgeStyle = 'bg-blue-100 text-blue-700'; // CĐ (Chế độ)
    } else if (badge.type === 'unpaid_leave') {
      badgeStyle = 'bg-orange-100 text-orange-700'; // KL (Không lương)
    }

    return (
      <span
        key={badge.id}
        title={badge.tooltip}
        className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap ${badgeStyle}`}
      >
        {badge.code}
      </span>
    );
  };

  const renderExportDropdown = () => (
    <div className="relative" ref={exportDropdownRef}>
      <button
        type="button"
        data-testid="report-export-dropdown-btn"
        onClick={() => setIsExportDropdownOpen((prev) => !prev)}
        className="h-8 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#14539E]/30"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
        <span>Xuất Excel / PDF</span>
        <ChevronDown className="w-3.5 h-3.5 text-blue-100" />
      </button>

      {isExportDropdownOpen && (
        <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-50 text-xs font-medium text-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsExportDropdownOpen(false);
              if (activeSubTab === 'monthly_summary') {
                exportMonthlyAttendanceMatrixToExcel(
                  monthlyReport,
                  groups
                );
              } else {
                onExportMatrixExcel(matrixRows, reportYear, viewMode);
              }
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-[#14539E] flex items-center gap-2.5 cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
            <span>
              {activeSubTab === 'monthly_summary'
                ? `Xuất Excel (${formattedMonthTitle})`
                : `Xuất Excel Năm ${reportYear} (.xlsx)`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsExportDropdownOpen(false);
              if (activeSubTab === 'monthly_summary') {
                setIsMonthlyPrintOpen(true);
              } else {
                onExportMatrixPDF(matrixRows, reportYear, viewMode);
              }
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-[#14539E] flex items-center gap-2.5 cursor-pointer transition-colors"
          >
            <FileText className="w-4 h-4 text-red-600 shrink-0" />
            <span>
              {activeSubTab === 'monthly_summary'
                ? `Xuất PDF / In (${formattedMonthTitle})`
                : `Xuất PDF Năm ${reportYear} (Khổ ngang A4)`}
            </span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-2.5 text-slate-800">
      {/* =====================================================================
          CHẾ ĐỘ 1: BÁO CÁO THÁNG (HIGH DENSITY - ZERO VISUAL NOISE)
      ===================================================================== */}
      {activeSubTab === 'monthly_summary' && (
        <>
          {/* THANH CÔNG CỤ TÌM KIẾM & LỌC (bg-white border-slate-200 shadow-sm) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-3.5 py-2.5 compact-toolbar">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-2.5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-end flex-1">
                {/* 1. Tháng áp dụng (Dropdown Select: Tháng 11/2026) */}
                <div>
                  <label
                    htmlFor="monthly-report-select"
                    className="block text-[11px] font-medium text-slate-500 mb-1"
                  >
                    Tháng áp dụng
                  </label>
                  <select
                    id="monthly-report-select"
                    value={selectedYearMonth}
                    onChange={(e) => setSelectedYearMonth(e.target.value)}
                    className="w-full h-8 px-2.5 py-1 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all cursor-pointer"
                  >
                    {MONTH_DROPDOWN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Tìm kiếm (Search Mã NV hoặc Họ tên) */}
                <div>
                  <label
                    htmlFor="monthly-report-search"
                    className="block text-[11px] font-medium text-slate-500 mb-1"
                  >
                    Tìm kiếm
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="monthly-report-search"
                      type="text"
                      value={monthlySearchQuery}
                      onChange={(e) => setMonthlySearchQuery(e.target.value)}
                      placeholder="Gõ Mã NV hoặc Họ tên..."
                      className="w-full h-8 pl-8 pr-7 py-1 text-xs font-medium text-slate-800 placeholder:text-slate-500 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all"
                    />
                    {monthlySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMonthlySearchQuery('')}
                        aria-label="Xóa từ khóa tìm kiếm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Nhóm / Bộ phận (Department Dropdown) */}
                <div>
                  <label
                    htmlFor="monthly-report-dept"
                    className="block text-[11px] font-medium text-slate-500 mb-1"
                  >
                    Nhóm / Bộ phận
                  </label>
                  <select
                    id="monthly-report-dept"
                    value={monthlyDeptFilter}
                    onChange={(e) => setMonthlyDeptFilter(e.target.value)}
                    className="w-full h-8 px-2.5 py-1 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all cursor-pointer"
                  >
                    <option value="ALL">Tất cả ({groups.length} nhóm)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.name}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end shrink-0">
                {renderExportDropdown()}
              </div>
            </div>
          </div>

          {/* DẢI CHÚ THÍCH THẺ MÀU (LEGEND) ĐẶT NGAY DƯỚI HÀNG BỘ LỌC, TRÊN ĐẦU BẢNG DỮ LIỆU */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5 text-[11px] text-slate-500">
            <span>
              Hiển thị <strong className="text-slate-800 font-mono">{monthlyReport.rows.length}</strong> nhân sự · Hover cột <strong className="text-slate-700">Tồn phép</strong> để xem giải trình chi tiết 3 dòng
            </span>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono font-bold text-[10px] leading-none">
                  PN
                </span>
                <span>Phép năm</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono font-bold text-[10px] leading-none">
                  CĐ
                </span>
                <span>Chế độ</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-mono font-bold text-[10px] leading-none">
                  KL
                </span>
                <span>Không lương</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono font-bold text-[10px] leading-none">
                  ĐM
                </span>
                <span>Đi muộn (Hover/chạm xem giờ)</span>
              </span>
            </div>
          </div>

          {/* BẢNG DỮ LIỆU MA TRẬN "BÁO CÁO THÁNG" (HIGH DENSITY - ZERO VISUAL NOISE)
              - Header Siêu Mềm: <th> cột ngày (01-31) dùng bg-slate-50, text-slate-500 (không in đậm), căn giữa
              - 5 cột cố định (Sticky Left):
                1. Nhân sự: w-56 (224px), left-0 (Dòng 1: font-medium text-slate-800 | Dòng 2: Mã NV • Nhóm text-xs text-slate-500)
                2. Tồn phép: w-14 (56px), left-[224px] (Hover hiện Tooltip 3 dòng: Phép tích lũy, Phép tồn chuyển sang, Số đã nghỉ)
                3. PN / CĐ: w-16 (64px), left-[280px]
                4. K.Lương: w-14 (56px), left-[344px]
                5. Đi muộn: w-15 (60px), left-[400px] + border-r border-slate-200 + shadow-[4px_0_12px_rgba(0,0,0,0.05)]
              - Cột ngày 01->31: w-8 (32px), px-1.5 py-1, border-slate-100, align-middle, ĐỂ KHOẢNG TRẮNG HOÀN TOÀN ở ngày đi làm bình thường (không có dấu '-')
          */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs compact-matrix-table">
                <thead className="sticky top-0 z-30 bg-slate-50 text-slate-500 select-none text-[11px] border-b border-slate-200">
                  <tr className="font-normal">
                    {/* CỘT 1 (STICKY left-0, w-56 = 224px): NHÂN SỰ */}
                    <th className="px-2.5 py-1.5 w-56 min-w-[224px] max-w-[224px] text-left font-normal bg-slate-50 text-slate-500 border-r border-slate-100 sticky left-0 z-40 align-middle">
                      Nhân sự
                    </th>

                    {/* CỘT 2 (STICKY left-[224px], w-14 = 56px): CÒN LẠI */}
                    <th
                      className="px-1.5 py-1.5 w-14 min-w-[56px] max-w-[56px] text-center font-normal bg-slate-50 text-slate-500 border-r border-slate-100 whitespace-nowrap sticky left-[224px] z-40 align-middle"
                      title="Còn lại = [Tổng quỹ phép] - [Đã nghỉ] (Hover để xem giải trình)"
                    >
                      Còn lại
                    </th>

                    {/* CỘT 3 (STICKY left-[280px], w-16 = 64px): PN / CĐ */}
                    <th
                      className="px-1.5 py-1.5 w-16 min-w-[64px] max-w-[64px] text-center font-normal bg-slate-50 text-slate-500 border-r border-slate-100 whitespace-nowrap sticky left-[280px] z-40 align-middle"
                      title="Tổng số ngày Nghỉ phép năm (PN) & Chế độ (CĐ) trong tháng"
                    >
                      PN/CĐ
                    </th>

                    {/* CỘT 4 (STICKY left-[344px], w-14 = 56px): K.LƯƠNG */}
                    <th
                      className="px-1.5 py-1.5 w-14 min-w-[56px] max-w-[56px] text-center font-normal bg-slate-50 text-slate-500 border-r border-slate-100 whitespace-nowrap sticky left-[344px] z-40 align-middle"
                      title="Tổng số ngày Nghỉ không lương (KL) trong tháng"
                    >
                      K.Lương
                    </th>

                    {/* CỘT 5 (STICKY left-[400px], w-15 = 60px + VIỀN PHẢI + ĐỔ BÓNG PHÂN CÁCH): ĐI MUỘN */}
                    <th
                      className="px-1.5 py-1.5 w-15 min-w-[60px] max-w-[60px] text-center font-normal bg-slate-50 text-slate-500 border-r border-slate-200 whitespace-nowrap sticky left-[400px] z-40 shadow-[4px_0_12px_rgba(0,0,0,0.05)] align-middle"
                      title="Tổng số giờ / số lần Đi muộn (ĐM) trong tháng"
                    >
                      Đi muộn
                    </th>

                    {/* CÁC CỘT NGÀY 01 -> 31 (HEADER SIÊU MỀM: bg-slate-50, text-slate-500 không in đậm, căn giữa) */}
                    {monthlyReport.dayColumns.map((col) => (
                      <th
                        key={col.day}
                        className={`px-1.5 py-1 w-8 min-w-[32px] max-w-[32px] text-center font-normal border-r border-slate-100 font-mono transition-colors align-middle ${
                          col.isToday
                            ? 'bg-blue-50/70 text-[#14539E]'
                            : 'bg-slate-50 text-slate-500'
                        }`}
                        title={`Ngày ${col.dayLabel}/${String(monthlyReport.month).padStart(2, '0')}/${monthlyReport.year} (${col.weekdayLabel})${col.isToday ? ' - HÔM NAY' : ''}`}
                      >
                        <div className="flex flex-col items-center justify-center leading-none gap-0.5">
                          <span className="text-[11px] font-normal">
                            {col.dayLabel}
                          </span>
                          <span className="text-[10px] font-sans font-normal text-slate-500">
                            {col.weekdayLabel}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-xs bg-white">
                  {monthlyReport.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + monthlyReport.daysInMonth}
                        className="py-8 text-center text-slate-500 italic bg-white align-middle"
                      >
                        Không tìm thấy nhân sự nào phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    monthlyReport.rows.map((row) => {
                      const emp = row.employee;
                      const shortGroup = getShortGroupCode(
                        emp.department,
                        groups
                      );
                      const isTooltipOpen =
                        activeRemainingLeaveEmpId === `monthly-${emp.id}`;

                      return (
                        <tr
                          key={emp.id}
                          className="group hover:bg-slate-50/90 transition-colors min-h-[36px]"
                        >
                          {/* CỘT 1 (STICKY left-0, w-56 = 224px): NHÂN SỰ
                              - Dòng 1 (Tên): Chữ đậm vừa (font-medium), màu text-slate-800
                              - Dòng 2 (Mã NV): Chữ nhỏ text-xs text-slate-500
                          */}
                          <td
                            onClick={() =>
                              setSelectedCell({
                                employee: emp,
                                month: parsedMonthNum,
                                year: parsedMonthYear,
                              })
                            }
                            className="px-2.5 py-1 w-56 min-w-[224px] max-w-[224px] bg-white group-hover:bg-slate-50 border-r border-slate-100 sticky left-0 z-20 cursor-pointer align-middle"
                            title={`Xem chi tiết chấm công ${formattedMonthTitle} của ${emp.fullName}`}
                          >
                            <div className="truncate text-xs font-medium text-slate-800 group-hover:text-[#14539E] hover:underline leading-tight">
                              {emp.fullName}
                            </div>
                            <div className="truncate text-xs text-slate-500 font-mono leading-tight mt-0.5">
                              {emp.employeeCode} • {shortGroup}
                            </div>
                          </td>

                          {/* CỘT 2 (STICKY left-[224px], w-14 = 56px): TỒN PHÉP
                              - Chỉ hiện 1 con số tổng
                              - Khi Hover hiển thị Tooltip phân rã chi tiết 3 dòng:
                                1. Phép tích lũy
                                2. Phép tồn chuyển sang
                                3. Số đã nghỉ
                          */}
                          <td
                            data-remaining-leave-cell="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRemainingLeaveEmpId((prev) =>
                                prev === `monthly-${emp.id}`
                                  ? null
                                  : `monthly-${emp.id}`
                              );
                            }}
                            className={`relative group/tonphep px-1.5 py-1 w-14 min-w-[56px] max-w-[56px] text-center font-mono font-semibold text-xs bg-white group-hover:bg-slate-50 border-r border-slate-100 sticky left-[224px] z-20 cursor-pointer align-middle ${
                              row.remainingAnnualLeave <= 0
                                ? 'text-red-700'
                                : row.remainingAnnualLeave <= 2
                                ? 'text-orange-700'
                                : 'text-slate-800'
                            }`}
                          >
                            <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">
                              {formatNumberVN(row.remainingAnnualLeave)}
                            </span>

                            {/* Tooltip phân rã chi tiết 3 dòng (Nền trắng tinh bg-white border-slate-200 shadow-lg) */}
                            <div
                              role="tooltip"
                              onClick={(e) => e.stopPropagation()}
                              className={`${
                                isTooltipOpen
                                  ? 'opacity-100 visible translate-y-0'
                                  : 'opacity-0 invisible translate-y-1 group-hover/tonphep:opacity-100 group-hover/tonphep:visible group-hover/tonphep:translate-y-0'
                              } pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 w-56 p-2.5 rounded-xl bg-white text-slate-800 text-[11px] font-sans text-left shadow-lg border border-slate-200 transition-all duration-150`}
                            >
                              <div className="font-semibold text-slate-800 pb-1.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                                <span>Chi tiết Tồn phép</span>
                                <span className="font-mono font-bold text-[#14539E]">
                                  {formatNumberVN(row.remainingAnnualLeave)} ngày
                                </span>
                              </div>
                              <div className="space-y-1 text-[11px]">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">
                                    Phép tích lũy:
                                  </span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {formatNumberVN(row.accruedLeaveDays)} ngày
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">
                                    Phép tồn chuyển sang:
                                  </span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {formatNumberVN(row.carriedOverLeaveDays)} ngày
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">
                                    Số đã nghỉ:
                                  </span>
                                  <span className="font-mono font-bold text-orange-700">
                                    {formatNumberVN(row.usedAnnualLeaveDays)} ngày
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* CỘT 3 (STICKY left-[280px], w-16 = 64px): PN/CĐ */}
                          <td
                            onClick={() =>
                              setSelectedCell({
                                employee: emp,
                                month: parsedMonthNum,
                                year: parsedMonthYear,
                              })
                            }
                            className="px-1.5 py-1 w-16 min-w-[64px] max-w-[64px] text-center font-mono text-xs bg-white group-hover:bg-slate-50 border-r border-slate-100 sticky left-[280px] z-20 cursor-pointer whitespace-nowrap align-middle"
                          >
                            {(row.monthAnnualDays > 0 ||
                              row.monthRegimeDays > 0) && (
                              <div className="inline-flex items-center justify-center gap-0.5 font-semibold">
                                {row.monthAnnualDays > 0 && (
                                  <span
                                    className="text-green-700"
                                    title={`Nghỉ phép năm: ${formatNumberVN(row.monthAnnualDays)} ngày`}
                                  >
                                    {formatNumberVN(row.monthAnnualDays)}
                                  </span>
                                )}
                                {row.monthAnnualDays > 0 &&
                                  row.monthRegimeDays > 0 && (
                                    <span className="text-slate-300">/</span>
                                  )}
                                {row.monthRegimeDays > 0 && (
                                  <span
                                    className="text-blue-700"
                                    title={`Nghỉ chế độ: ${formatNumberVN(row.monthRegimeDays)} ngày`}
                                  >
                                    {formatNumberVN(row.monthRegimeDays)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* CỘT 4 (STICKY left-[344px], w-14 = 56px): K.LƯƠNG */}
                          <td
                            onClick={() =>
                              setSelectedCell({
                                employee: emp,
                                month: parsedMonthNum,
                                year: parsedMonthYear,
                              })
                            }
                            className="px-1.5 py-1 w-14 min-w-[56px] max-w-[56px] text-center font-mono text-xs bg-white group-hover:bg-slate-50 border-r border-slate-100 sticky left-[344px] z-20 cursor-pointer align-middle"
                          >
                            {row.monthUnpaidDays > 0 && (
                              <span className="font-semibold text-orange-700">
                                {formatNumberVN(row.monthUnpaidDays)}
                              </span>
                            )}
                          </td>

                          {/* CỘT 5 (STICKY left-[400px], w-15 = 60px + border-r border-slate-200 + shadow-[4px_0_12px_rgba(0,0,0,0.05)]): ĐI MUỘN */}
                          <td
                            onClick={() =>
                              setSelectedCell({
                                employee: emp,
                                month: parsedMonthNum,
                                year: parsedMonthYear,
                              })
                            }
                            className="px-1.5 py-1 w-15 min-w-[60px] max-w-[60px] text-center font-mono text-xs bg-white group-hover:bg-slate-50 border-r border-slate-200 sticky left-[400px] z-20 shadow-[4px_0_12px_rgba(0,0,0,0.05)] cursor-pointer whitespace-nowrap align-middle"
                          >
                            {row.monthLateHours > 0 && (
                              <span className="font-semibold text-red-700">
                                {formatNumberVN(row.monthLateHours)}h
                              </span>
                            )}
                          </td>

                          {/* CÁC CỘT NGÀY 01 -> 31 (px-1.5 py-1, border-slate-100, align-middle, KHOẢNG TRẮNG HOÀN TOÀN Ở Ô BÌNH THƯỜNG) */}
                          {monthlyReport.dayColumns.map((col) => {
                            const badges = row.dayBadges[col.day] || [];
                            const hasBadges = badges.length > 0;

                            return (
                              <td
                                key={col.day}
                                onClick={() =>
                                  setSelectedCell({
                                    employee: emp,
                                    month: parsedMonthNum,
                                    year: parsedMonthYear,
                                  })
                                }
                                className={`px-1.5 py-1 w-8 min-w-[32px] max-w-[32px] text-center border-r border-slate-100 cursor-pointer transition-colors align-middle ${
                                  col.isToday
                                    ? 'bg-blue-50/30 hover:bg-blue-50/70'
                                    : 'bg-white hover:bg-slate-50'
                                }`}
                                title={
                                  hasBadges
                                    ? badges.map((b) => b.tooltip).join(' | ')
                                    : `Ngày ${col.dayLabel}/${String(parsedMonthNum).padStart(2, '0')}/${parsedMonthYear}`
                                }
                              >
                                {hasBadges ? (
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    {badges.map((b) => renderBadge(b))}
                                  </div>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          CHẾ ĐỘ 2: BÁO CÁO NĂM (12 THÁNG)
      ===================================================================== */}
      {activeSubTab === 'annual_matrix' && (
        <>
          {/* Bộ lọc Báo cáo năm */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
                <div>
                  <label
                    htmlFor="matrix-year-select"
                    className="block text-xs font-medium text-slate-500 mb-1"
                  >
                    Năm báo cáo:
                  </label>
                  <select
                    id="matrix-year-select"
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    className="w-full h-8 px-2.5 py-1 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 cursor-pointer"
                  >
                    <option value={2026}>Năm 2026</option>
                    <option value={2025}>Năm 2025</option>
                    <option value={2027}>Năm 2027</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="matrix-dept-select"
                    className="block text-xs font-medium text-slate-500 mb-1"
                  >
                    Nhóm / Bộ phận:
                  </label>
                  <select
                    id="matrix-dept-select"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full h-8 px-2.5 py-1 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 cursor-pointer"
                  >
                    <option value="ALL">
                      Tất cả Nhóm / Bộ phận ({groups.length})
                    </option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.name}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="matrix-mode-select"
                    className="block text-xs font-medium text-slate-500 mb-1"
                  >
                    Chế độ xem ma trận:
                  </label>
                  <select
                    id="matrix-mode-select"
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as MatrixViewMode)}
                    className="w-full h-8 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 text-slate-800 cursor-pointer"
                  >
                    <option value="all">
                      Tổng hợp tất cả (Phép + K.Lương + Đi muộn)
                    </option>
                    <option value="annual_leave">Thống kê Phép năm</option>
                    <option value="unpaid_leave">
                      Thống kê Nghỉ không lương
                    </option>
                    <option value="late_early">Thống kê Giờ đi muộn</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end shrink-0">
                {renderExportDropdown()}
              </div>
            </div>

            {/* Legend Strip */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono font-bold text-[10px]">
                    PN
                  </span>
                  <span>Phép năm</span>
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-mono font-bold text-[10px]">
                    KL
                  </span>
                  <span>Không lương</span>
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono font-bold text-[10px]">
                    CĐ
                  </span>
                  <span>Chế độ BHXH</span>
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono font-bold text-[10px]">
                    ĐM
                  </span>
                  <span>Đi muộn</span>
                </span>
              </div>
              <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5 text-[#14539E]" />
                <span>Click ô tháng để xem chi tiết &amp; chứng từ</span>
              </div>
            </div>
          </div>

          {/* 12-Month Matrix Table with Soft Header & Sticky "Nhân sự" Column */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500 text-xs font-normal border-b border-slate-200">
                  <tr>
                    <th className="px-2.5 py-1.5 w-56 min-w-[224px] max-w-[224px] sticky left-0 z-30 bg-slate-50 text-slate-500 font-normal border-r border-slate-100 align-middle">
                      Nhân sự
                    </th>
                    <th className="px-2 py-1.5 w-16 text-center font-normal border-r border-slate-200 bg-slate-50 text-slate-500 shadow-[4px_0_12px_rgba(0,0,0,0.05)] align-middle">
                      Tổng phép
                    </th>

                    {/* 12 Month Columns */}
                    {Array.from({ length: 12 }, (_, idx) => (
                      <th
                        key={idx + 1}
                        className="px-2 py-1.5 w-10 text-center font-normal border-r border-slate-100 font-mono bg-slate-50 text-slate-500 align-middle"
                      >
                        T{idx + 1}
                      </th>
                    ))}

                    {/* Right Summary Columns */}
                    <th className="px-2 py-1.5 w-14 text-center font-normal border-r border-slate-100 bg-slate-50 text-slate-500 align-middle">
                      Đã nghỉ
                    </th>
                    <th className="px-2 py-1.5 w-14 text-center font-normal border-r border-slate-100 bg-slate-50 text-slate-500 align-middle">
                      Tồn phép
                    </th>
                    <th className="px-2 py-1.5 w-14 text-center font-normal border-r border-slate-100 bg-slate-50 text-slate-500 align-middle">
                      K.Lương
                    </th>
                    <th className="px-2 py-1.5 w-14 text-center font-normal bg-slate-50 text-slate-500 align-middle">
                      Đi muộn
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs bg-white">
                  {matrixRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={18}
                        className="py-10 text-center text-slate-500 italic align-middle"
                      >
                        Không có dữ liệu nhân sự phù hợp với bộ phận đã chọn.
                      </td>
                    </tr>
                  ) : (
                    matrixRows.map((row) => {
                      const emp = row.employee;
                      const shortGroup = getShortGroupCode(
                        emp.department,
                        groups
                      );
                      const isAnnualTooltipOpen =
                        activeRemainingLeaveEmpId === `annual-${emp.id}`;

                      return (
                        <tr
                          key={emp.id}
                          className="group hover:bg-slate-50/90 transition-colors"
                        >
                          <td className="px-2.5 py-1.5 w-56 min-w-[224px] max-w-[224px] sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-100 align-middle">
                            <div className="truncate font-medium text-slate-800 group-hover:text-[#14539E] hover:underline leading-snug">
                              {emp.fullName}
                            </div>
                            <div className="truncate text-xs text-slate-500 font-mono leading-tight mt-0.5">
                              {emp.employeeCode} • {shortGroup}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center font-mono font-semibold text-slate-800 border-r border-slate-200 shadow-[4px_0_12px_rgba(0,0,0,0.05)] align-middle">
                            {formatNumberVN(emp.standardAnnualLeave)}
                          </td>

                          {/* 12 Month Cells (Zero Visual Noise - blank when 0) */}
                          {Array.from({ length: 12 }, (_, mIdx) => {
                            const mNum = mIdx + 1;
                            const cell = row.months[mNum];

                            return (
                              <td
                                key={mNum}
                                onClick={() =>
                                  setSelectedCell({
                                    employee: emp,
                                    month: mNum,
                                    year: reportYear,
                                  })
                                }
                                className="px-1.5 py-1 text-center font-mono border-r border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors align-middle"
                                title={`Xem chi tiết tháng ${mNum}/${reportYear} của ${emp.fullName}`}
                              >
                                <div className="flex flex-col items-center justify-center leading-tight">
                                  {viewMode === 'all' ? (
                                    <>
                                      {cell.annualLeaveDays > 0 && (
                                        <span className="text-green-700 font-bold">
                                          {formatNumberVN(cell.annualLeaveDays)}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-0.5 text-[10px]">
                                        {cell.unpaidLeaveDays > 0 && (
                                          <span className="text-orange-700 font-bold">
                                            {formatNumberVN(cell.unpaidLeaveDays)}KL
                                          </span>
                                        )}
                                        {cell.lateHours > 0 && (
                                          <span className="text-red-700 font-bold">
                                            {formatNumberVN(cell.lateHours)}h
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  ) : viewMode === 'annual_leave' ? (
                                    cell.annualLeaveDays > 0 ? (
                                      <span className="text-green-700 font-bold">
                                        {formatNumberVN(cell.annualLeaveDays)}
                                      </span>
                                    ) : null
                                  ) : viewMode === 'unpaid_leave' ? (
                                    cell.unpaidLeaveDays > 0 ? (
                                      <span className="text-orange-700 font-bold">
                                        {formatNumberVN(cell.unpaidLeaveDays)}
                                      </span>
                                    ) : null
                                  ) : cell.lateHours > 0 ? (
                                    <span className="text-red-700 font-bold">
                                      {formatNumberVN(cell.lateHours)}h
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            );
                          })}

                          {/* Right Summary Totals */}
                          <td className="px-1.5 py-1 text-center font-mono font-semibold text-green-700 border-r border-slate-100 align-middle">
                            {row.totalAnnualUsed > 0 ? formatNumberVN(row.totalAnnualUsed) : null}
                          </td>
                          <td
                            data-remaining-leave-cell="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRemainingLeaveEmpId((prev) =>
                                prev === `annual-${emp.id}`
                                  ? null
                                  : `annual-${emp.id}`
                              );
                            }}
                            className="relative group/tonphep px-1.5 py-1 text-center font-mono font-semibold text-slate-800 border-r border-slate-100 cursor-pointer align-middle"
                          >
                            <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">
                              {formatNumberVN(row.remainingAnnualLeave)}
                            </span>

                            {/* Tooltip phân rã chi tiết 3 dòng */}
                            <div
                              role="tooltip"
                              onClick={(e) => e.stopPropagation()}
                              className={`${
                                isAnnualTooltipOpen
                                  ? 'opacity-100 visible translate-y-0'
                                  : 'opacity-0 invisible translate-y-1 group-hover/tonphep:opacity-100 group-hover/tonphep:visible group-hover/tonphep:translate-y-0'
                              } pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 z-50 w-56 p-2.5 rounded-xl bg-white text-slate-800 text-[11px] font-sans text-left shadow-lg border border-slate-200 transition-all duration-150`}
                            >
                              <div className="font-semibold text-slate-800 pb-1.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                                <span>Chi tiết Tồn phép</span>
                                <span className="font-mono font-bold text-[#14539E]">
                                  {formatNumberVN(row.remainingAnnualLeave)} ngày
                                </span>
                              </div>
                              <div className="space-y-1 text-[11px]">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">
                                    Phép tích lũy:
                                  </span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {formatNumberVN(row.accruedLeaveDays)} ngày
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">
                                    Phép tồn chuyển sang:
                                  </span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {formatNumberVN(row.carriedOverLeaveDays)} ngày
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">
                                    Số đã nghỉ:
                                  </span>
                                  <span className="font-mono font-bold text-orange-700">
                                    {formatNumberVN(row.totalAnnualUsed)} ngày
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-1.5 py-1 text-center font-mono font-semibold text-orange-700 border-r border-slate-100 align-middle">
                            {row.totalUnpaidDays > 0 ? formatNumberVN(row.totalUnpaidDays) : null}
                          </td>
                          <td className="px-1.5 py-1 text-center font-mono font-semibold text-red-700 align-middle">
                            {row.totalLateHours > 0
                              ? `${formatNumberVN(row.totalLateHours)}h`
                              : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Grand Total Footer */}
                {matrixRows.length > 0 && (
                  <tfoot className="bg-slate-50 text-slate-800 border-t border-slate-200 text-xs font-mono font-semibold">
                    <tr>
                      <td className="px-2.5 py-2 text-right uppercase tracking-wider border-r border-slate-200 text-slate-600">
                        Tổng ({formatNumberVN(matrixRows.length)} NS):
                      </td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">
                        {formatNumberVN(grandTotalStandard)}d
                      </td>
                      {Array.from({ length: 12 }, (_, idx) => {
                        const mNum = idx + 1;
                        const mUsed = matrixRows.reduce(
                          (acc, r) =>
                            Number(
                              (acc + r.months[mNum].annualLeaveDays).toFixed(2)
                            ),
                          0
                        );
                        return (
                          <td
                            key={mNum}
                            className="px-1.5 py-2 text-center border-r border-slate-100"
                          >
                            {mUsed > 0 ? formatNumberVN(mUsed) : null}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center border-r border-slate-100 text-green-700">
                        {formatNumberVN(grandTotalUsed)}d
                      </td>
                      <td className="px-2 py-2 text-center border-r border-slate-100 text-[#14539E]">
                        {formatNumberVN(grandTotalRemaining)}d
                      </td>
                      <td className="px-2 py-2 text-center border-r border-slate-100 text-orange-700">
                        {formatNumberVN(grandTotalUnpaid)}d
                      </td>
                      <td className="px-2 py-2 text-center text-red-700">
                        {formatNumberVN(grandTotalLateHours)}h
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          MONTH CELL DETAIL POPUP MODAL (Nền trắng tinh bg-white border-slate-200)
      ===================================================================== */}
      {selectedCell && popupRow && popupMonthData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cell-detail-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden my-auto">
            {/* Modal Header (Nền trắng tinh bg-white border-b border-slate-200) */}
            <div className="bg-white text-slate-800 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3
                  id="cell-detail-modal-title"
                  className="text-sm sm:text-base font-bold text-slate-800"
                >
                  Chi tiết Chấm công Tháng {selectedCell.month}/
                  {selectedCell.year}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {popupRow.employee.fullName} ({popupRow.employee.employeeCode})
                  — {popupRow.employee.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                aria-label="Đóng cửa sổ chi tiết"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-green-100/70 border border-green-200 text-center">
                  <div className="text-[11px] font-medium text-slate-600">
                    Phép năm (PN)
                  </div>
                  <div className="text-base font-bold text-green-700 font-mono mt-1">
                    {popupMonthData.annualLeaveDays} ngày
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-100/70 border border-blue-200 text-center">
                  <div className="text-[11px] font-medium text-slate-600">
                    Chế độ (CĐ)
                  </div>
                  <div className="text-base font-bold text-blue-700 font-mono mt-1">
                    {popupMonthData.regimeLeaveDays} ngày
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-orange-100/70 border border-orange-200 text-center">
                  <div className="text-[11px] font-medium text-slate-600">
                    Không lương (KL)
                  </div>
                  <div className="text-base font-bold text-orange-700 font-mono mt-1">
                    {popupMonthData.unpaidLeaveDays} ngày
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-red-100/70 border border-red-200 text-center">
                  <div className="text-[11px] font-medium text-slate-600">
                    Đi muộn (ĐM)
                  </div>
                  <div className="text-base font-bold text-red-700 font-mono mt-1">
                    {popupMonthData.lateHours} giờ
                  </div>
                </div>
              </div>

              {/* Records List in this Month */}
              <div>
                <div className="text-xs font-bold text-slate-800 mb-2">
                  Danh sách giấy phép / ghi chép trong tháng (
                  {popupMonthData.records.length}):
                </div>
                {popupMonthData.records.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 italic">
                    Chưa có ghi nhận nghỉ phép hoặc đi muộn nào trong Tháng{' '}
                    {selectedCell.month}/{selectedCell.year}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {popupMonthData.records.map((rec) => {
                      const meta = LEAVE_TYPE_META[rec.type as LeaveRecordType];
                      return (
                        <div
                          key={rec.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-md"
                                style={{
                                  backgroundColor: meta.bgLight,
                                  color: meta.textColor,
                                }}
                              >
                                {meta.label}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-800">
                                {rec.amount} {meta.unit}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              Thời gian:{' '}
                              {rec.startDate === rec.endDate
                                ? formatDateVN(rec.startDate)
                                : `${formatDateVN(rec.startDate)} → ${formatDateVN(rec.endDate)}`}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Lý do: {rec.reason}
                            </div>
                          </div>

                          {rec.attachmentUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                onInspectAttachment(
                                  rec.attachmentUrl!,
                                  rec.attachmentTitle ||
                                    `Giấy phép - ${popupRow.employee.fullName}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#14539E] text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem chứng từ</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  const empId = selectedCell.employee.id;
                  const m = selectedCell.month;
                  const y = selectedCell.year;
                  setSelectedCell(null);
                  onQuickAddForEmployeeMonth(empId, m, y);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <CalendarPlus className="w-4 h-4" />
                <span>+ Tạo đơn nghỉ Tháng {selectedCell.month}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MONTHLY MATRIX PRINT / PDF PREVIEW MODAL (Khổ ngang A4 - Nền trắng tinh)
      ===================================================================== */}
      {isMonthlyPrintOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="In Bảng tổng hợp Nghỉ phép & Đi muộn"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="bg-white text-slate-800 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between shrink-0 print:hidden">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Xem trước bản in PDF (Khổ ngang A4) — Bảng tổng hợp Nghỉ phép &amp; Đi muộn {formattedMonthTitle}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Bấm &quot;In báo cáo / Lưu PDF&quot; và chọn khổ giấy Landscape (Ngang)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In báo cáo / Lưu PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMonthlyPrintOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-auto flex-1 bg-white">
              <div className="text-center mb-4">
                <h2 className="text-base font-extrabold text-slate-900 uppercase">
                  BẢNG TỔNG HỢP NGHỈ PHÉP &amp; ĐI MUỘN - {formattedMonthTitle}
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-medium">
                      <th className="border border-slate-300 px-2 py-1 text-left">Nhân sự</th>
                      <th className="border border-slate-300 px-1 py-1 text-center">Tồn phép</th>
                      <th className="border border-slate-300 px-1 py-1 text-center">PN/CĐ</th>
                      <th className="border border-slate-300 px-1 py-1 text-center">K.Lương</th>
                      <th className="border border-slate-300 px-1 py-1 text-center">Đi muộn</th>
                      {monthlyReport.dayColumns.map((col) => (
                        <th
                          key={col.day}
                          className="border border-slate-300 px-0.5 py-1 text-center font-mono font-normal"
                        >
                          <div>{col.dayLabel}</div>
                          <div className="text-[8px] font-normal text-slate-500">
                            {col.weekdayLabel}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReport.rows.map((row) => (
                      <tr key={row.employee.id}>
                        <td className="border border-slate-300 px-2 py-1 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {row.employee.fullName}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono">
                            {row.employee.employeeCode} •{' '}
                            {getShortGroupCode(row.employee.department, groups)}
                          </div>
                        </td>
                        <td className="border border-slate-300 px-1 py-1 text-center font-mono font-bold">
                          {row.remainingAnnualLeave}
                        </td>
                        <td className="border border-slate-300 px-1 py-1 text-center font-mono">
                          {row.monthAnnualAndRegimeDays || ''}
                        </td>
                        <td className="border border-slate-300 px-1 py-1 text-center font-mono">
                          {row.monthUnpaidDays || ''}
                        </td>
                        <td className="border border-slate-300 px-1 py-1 text-center font-mono">
                          {row.monthLateHours > 0
                            ? `${row.monthLateHours}h`
                            : ''}
                        </td>
                        {monthlyReport.dayColumns.map((col) => {
                          const badges = row.dayBadges[col.day] || [];
                          return (
                            <td
                              key={col.day}
                              className="border border-slate-300 px-0.5 py-1 text-center font-mono font-bold"
                            >
                              {badges.length > 0
                                ? badges.map((b) => b.code).join(' ')
                                : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
