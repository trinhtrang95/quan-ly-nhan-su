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
  MonthlyDayBadge,
} from '../utils/hrCalculations';
import { exportMonthlyAttendanceMatrixToExcel } from '../utils/exportUtils';
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

  // Annual Matrix filters
  const [reportYear, setReportYear] = useState<number>(2026);
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<MatrixViewMode>('all');

  // Export dropdown state
  const [isExportDropdownOpen, setIsExportDropdownOpen] =
    useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement | null>(null);

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
        monthlySearchQuery
      ),
    [
      employees,
      records,
      parsedMonthYear,
      parsedMonthNum,
      monthlyDeptFilter,
      monthlySearchQuery,
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
        departmentFilter
      ),
    [employees, records, reportYear, departmentFilter]
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
      'ALL'
    );
  }, [
    selectedCell,
    reportYear,
    departmentFilter,
    matrixRows,
    employees,
    records,
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

  // Render ultra-compact badge:
  // PN (Xanh lá - emerald), CĐ (Xanh dương - blue), KL (Cam - amber), ĐM (Đỏ - red, interactive tooltip/popover)
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
            className="inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-mono font-bold leading-none border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
          >
            {badge.code}
          </button>

          {/* Interactive Tooltip / Popover báo chính xác số giờ đi muộn (VD: 3h, 15p) khi click hoặc hover */}
          <div
            role="tooltip"
            onClick={(e) => e.stopPropagation()}
            className={`${
              isOpen
                ? 'opacity-100 visible translate-y-0'
                : 'opacity-0 invisible translate-y-1 group-hover/dm:opacity-100 group-hover/dm:visible group-hover/dm:translate-y-0'
            } pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 px-2 py-1 rounded-md bg-slate-900 text-white text-[11px] font-sans font-semibold whitespace-nowrap shadow-xl border border-slate-700 transition-all duration-150`}
          >
            <div className="flex items-center gap-1">
              <span className="text-red-300 font-bold">Đi muộn:</span>
              <span className="font-mono font-extrabold text-amber-300">
                {badge.durationText}
              </span>
            </div>
            {badge.record.reason && (
              <div className="text-[10px] text-slate-300 font-normal max-w-[160px] truncate mt-0.5">
                {badge.record.reason}
              </div>
            )}
            <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      );
    }

    // Đồng bộ dải màu: PN (Xanh lá), CĐ (Xanh dương), KL (Cam)
    let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200'; // PN (Xanh lá)
    if (badge.type === 'regime_leave') {
      badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200'; // CĐ (Xanh dương)
    } else if (badge.type === 'unpaid_leave') {
      badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200'; // KL (Cam)
    }

    return (
      <span
        key={badge.id}
        title={badge.tooltip}
        className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-mono font-bold leading-none border whitespace-nowrap ${badgeStyle}`}
      >
        {badge.code}
      </span>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* =====================================================================
          TOP HEADER: TIÊU ĐỀ CHÍNH TRÊN CÙNG + NÚT XUẤT EXCEL / PDF
          (Đã gỡ bỏ dải chú thích khỏi Header và đưa xuống dưới hàng Bộ lọc)
      ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs px-3.5 py-2.5 compact-toolbar">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            {activeSubTab === 'monthly_summary' ? (
              <h2 className="text-sm md:text-base font-extrabold text-slate-900 tracking-tight">
                Bảng tổng hợp Nghỉ phép &amp; Đi muộn - {formattedMonthTitle}
              </h2>
            ) : (
              <h2 className="text-sm md:text-base font-extrabold text-slate-900 tracking-tight">
                Báo cáo tổng hợp ({reportYear})
              </h2>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nút thao tác Xuất Excel / PDF ở góc phải */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                type="button"
                onClick={() => setIsExportDropdownOpen((prev) => !prev)}
                className="h-8 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0B224B]" />
                <span>Xuất Excel / PDF</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 text-xs font-medium text-slate-700">
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
                    className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-[#0B224B] flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
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
                    className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-[#0B224B] flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>
                      {activeSubTab === 'monthly_summary'
                        ? `Xuất PDF / In (${formattedMonthTitle})`
                        : `Xuất PDF Năm ${reportYear} (Khổ ngang A4)`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          CHẾ ĐỘ 1: BÁO CÁO THÁNG (TỔNG HỢP NGHỈ PHÉP & ĐI MUỘN)
      ===================================================================== */}
      {activeSubTab === 'monthly_summary' && (
        <>
          {/* THANH CÔNG CỤ TÌM KIẾM & LỌC (3 TRƯỜNG TRÊN 1 HÀNG NGANG - CAO h-8) */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs px-3.5 py-2.5 compact-toolbar">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-end">
              {/* 1. Tháng áp dụng (Dropdown Select: Tháng 11/2026) */}
              <div>
                <label
                  htmlFor="monthly-report-select"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Tháng áp dụng
                </label>
                <select
                  id="monthly-report-select"
                  value={selectedYearMonth}
                  onChange={(e) => setSelectedYearMonth(e.target.value)}
                  className="w-full h-8 px-2.5 py-1 text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
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
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
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
                    className="w-full h-8 pl-8 pr-7 py-1 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Nhóm / Bộ phận
                </label>
                <select
                  id="monthly-report-dept"
                  value={monthlyDeptFilter}
                  onChange={(e) => setMonthlyDeptFilter(e.target.value)}
                  className="w-full h-8 px-2.5 py-1 text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
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
          </div>

          {/* DẢI CHÚ THÍCH THẺ MÀU (LEGEND) NẰM DƯỚI BỘ LỌC VÀ NGAY TRÊN BẢNG MA TRẬN */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5 text-[11px] text-slate-600">
            <span className="text-slate-500 font-medium">
              Hiển thị <strong className="text-slate-800 font-mono">{monthlyReport.rows.length}</strong> nhân sự · Cuộn ngang để xem chi tiết 31 ngày (5 cột đầu được cố định)
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <span className="inline-flex items-center gap-1">
                <span className="px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px] leading-none">
                  PN
                </span>
                <span>Phép năm</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold text-[10px] leading-none">
                  CĐ
                </span>
                <span>Chế độ</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono font-bold text-[10px] leading-none">
                  KL
                </span>
                <span>Không lương</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="px-1 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-mono font-bold text-[10px] leading-none">
                  ĐM
                </span>
                <span>Đi muộn (Chạm/hover xem giờ)</span>
              </span>
            </div>
          </div>

          {/* BẢNG DỮ LIỆU MA TRẬN SIÊU GỌN (COMPACT LAYOUT)
              - Cố định (Sticky) cả 5 cột đầu tiên:
                1. Nhân sự: left-0, w-[208px]
                2. Tồn phép: left-[208px], w-[56px]
                3. PN / CĐ: left-[264px], w-[64px]
                4. K.Lương: left-[328px], w-[56px]
                5. Đi muộn: left-[384px], w-[60px] + shadow-[4px_0_6px_rgba(0,0,0,0.05)] ở cạnh phải
              - Cột ngày 01->31 hẹp cố định w-8 (32px), căn giữa
          */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="max-h-[calc(100vh-195px)] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs compact-matrix-table">
                <thead className="sticky top-0 z-30 bg-[#0B224B] text-white select-none text-[11px]">
                  <tr className="font-semibold">
                    {/* CỘT 1 (STICKY left-0, 208px): NHÂN SỰ */}
                    <th className="px-2 py-1 w-[208px] min-w-[208px] max-w-[208px] bg-[#0B224B] border-r border-blue-900/70 sticky left-0 z-40">
                      Nhân sự
                    </th>

                    {/* CỘT 2 (STICKY left-[208px], 56px): TỒN PHÉP */}
                    <th
                      className="px-1.5 py-1 w-[56px] min-w-[56px] max-w-[56px] text-center bg-[#0B224B] border-r border-blue-900/70 whitespace-nowrap sticky left-[208px] z-40"
                      title="Số ngày phép năm còn tồn lại"
                    >
                      Tồn phép
                    </th>

                    {/* CỘT 3 (STICKY left-[264px], 64px): PN / CĐ */}
                    <th
                      className="px-1.5 py-1 w-[64px] min-w-[64px] max-w-[64px] text-center bg-[#0B224B] border-r border-blue-900/70 whitespace-nowrap sticky left-[264px] z-40"
                      title="Tổng số ngày Nghỉ phép năm (PN) & Chế độ (CĐ) trong tháng"
                    >
                      PN / CĐ
                    </th>

                    {/* CỘT 4 (STICKY left-[328px], 56px): K.LƯƠNG */}
                    <th
                      className="px-1.5 py-1 w-[56px] min-w-[56px] max-w-[56px] text-center bg-[#0B224B] border-r border-blue-900/70 whitespace-nowrap sticky left-[328px] z-40"
                      title="Tổng số ngày Nghỉ không lương (KL) trong tháng"
                    >
                      K.Lương
                    </th>

                    {/* CỘT 5 (STICKY left-[384px], 60px + ĐỔ BÓNG CẠNH PHẢI): ĐI MUỘN */}
                    <th
                      className="px-1.5 py-1 w-[60px] min-w-[60px] max-w-[60px] text-center bg-[#0B224B] border-r border-blue-800 whitespace-nowrap sticky left-[384px] z-40 shadow-[4px_0_6px_rgba(0,0,0,0.22)]"
                      title="Tổng số giờ / số lần Đi muộn (ĐM) trong tháng"
                    >
                      Đi muộn
                    </th>

                    {/* CÁC CỘT NGÀY 01 -> 31 (HẸP CỐ ĐỊNH w-8 = 32px, CĂN GIỮA) */}
                    {monthlyReport.dayColumns.map((col) => (
                      <th
                        key={col.day}
                        className={`px-1 py-1 w-8 min-w-[32px] max-w-[32px] text-center border-r border-blue-900/60 font-mono transition-colors ${
                          col.isToday
                            ? 'bg-amber-400 text-slate-950 font-extrabold'
                            : col.isSunday
                            ? 'bg-blue-950/90 text-rose-300'
                            : 'bg-[#0B224B] text-white'
                        }`}
                        title={`Ngày ${col.dayLabel}/${String(monthlyReport.month).padStart(2, '0')}/${monthlyReport.year} (${col.weekdayLabel})${col.isToday ? ' - HÔM NAY' : ''}`}
                      >
                        <div className="flex flex-col items-center justify-center leading-none gap-0.5">
                          <span className="text-[11px] font-bold">
                            {col.dayLabel}
                          </span>
                          <span
                            className={`text-[10px] font-sans font-medium ${
                              col.isToday
                                ? 'text-slate-900 font-bold'
                                : col.isSunday
                                ? 'text-rose-300'
                                : 'text-blue-200/80'
                            }`}
                          >
                            {col.weekdayLabel}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200/70 text-xs bg-white">
                  {monthlyReport.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + monthlyReport.daysInMonth}
                        className="py-8 text-center text-slate-500 italic bg-white"
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

                      return (
                        <tr
                          key={emp.id}
                          className="group hover:bg-slate-50/90 transition-colors min-h-[36px]"
                        >
                          {/* CỘT 1 (STICKY left-0, 208px): NHÂN SỰ */}
                          <td
                            onClick={() =>
                              setSelectedCell({
                                employee: emp,
                                month: parsedMonthNum,
                                year: parsedMonthYear,
                              })
                            }
                            className="px-2 py-1 w-[208px] min-w-[208px] max-w-[208px] bg-white group-hover:bg-slate-50 border-r border-slate-200 sticky left-0 z-20 cursor-pointer"
                            title={`Xem chi tiết chấm công ${formattedMonthTitle} của ${emp.fullName}`}
                          >
                            <div className="truncate text-xs font-semibold text-[#0B224B] group-hover:underline leading-tight">
                              {emp.fullName}
                            </div>
                            <div className="truncate text-[11px] text-slate-500 font-mono leading-tight mt-0.5">
                              {emp.employeeCode} • {shortGroup}
                            </div>
                          </td>

                          {/* CỘT 2 (STICKY left-[208px], 56px): TỒN PHÉP */}
                          <td
                            onClick={() =>
                              setSelectedCell({
                                employee: emp,
                                month: parsedMonthNum,
                                year: parsedMonthYear,
                              })
                            }
                            className={`px-1.5 py-1 w-[56px] min-w-[56px] max-w-[56px] text-center font-mono font-bold text-xs bg-white group-hover:bg-slate-50 border-r border-slate-200 sticky left-[208px] z-20 cursor-pointer ${
                              row.remainingAnnualLeave <= 0
                                ? 'text-red-600'
                                : row.remainingAnnualLeave <= 2
                                ? 'text-amber-600'
                                : 'text-slate-800'
                            }`}
                          >
                            {row.remainingAnnualLeave}
                          </td>

                          {/* CỘT 3 (STICKY left-[264px], 64px): PN / CĐ */}
                          <td
                            onClick={() =>
                              setSelectedCell({
                                employee: emp,
                                month: parsedMonthNum,
                                year: parsedMonthYear,
                              })
                            }
                            className="px-1.5 py-1 w-[64px] min-w-[64px] max-w-[64px] text-center font-mono text-xs bg-white group-hover:bg-slate-50 border-r border-slate-200 sticky left-[264px] z-20 cursor-pointer whitespace-nowrap"
                          >
                            {row.monthAnnualDays > 0 ||
                            row.monthRegimeDays > 0 ? (
                              <div className="inline-flex items-center justify-center gap-0.5 font-bold">
                                {row.monthAnnualDays > 0 && (
                                  <span
                                    className="text-emerald-600"
                                    title={`Nghỉ phép năm: ${row.monthAnnualDays} ngày`}
                                  >
                                    {row.monthAnnualDays}
                                  </span>
                                )}
                                {row.monthAnnualDays > 0 &&
                                  row.monthRegimeDays > 0 && (
                                    <span className="text-slate-300">/</span>
                                  )}
                                {row.monthRegimeDays > 0 && (
                                  <span
                                    className="text-blue-600"
                                    title={`Nghỉ chế độ: ${row.monthRegimeDays} ngày`}
                                  >
                                    {row.monthRegimeDays}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[11px]">-</span>
                            )}
                          </td>

                          {/* CỘT 4 (STICKY left-[328px], 56px): KHÔNG LƯƠNG */}
                          <td
                            onClick={() =>
                              setSelectedCell({
                                employee: emp,
                                month: parsedMonthNum,
                                year: parsedMonthYear,
                              })
                            }
                            className="px-1.5 py-1 w-[56px] min-w-[56px] max-w-[56px] text-center font-mono text-xs bg-white group-hover:bg-slate-50 border-r border-slate-200 sticky left-[328px] z-20 cursor-pointer"
                          >
                            {row.monthUnpaidDays > 0 ? (
                              <span className="font-bold text-amber-600">
                                {row.monthUnpaidDays}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[11px]">-</span>
                            )}
                          </td>

                          {/* CỘT 5 (STICKY left-[384px], 60px + ĐỔ BÓNG CẠNH PHẢI shadow-[4px_0_6px_rgba(0,0,0,0.05)]): ĐI MUỘN */}
                          <td
                            onClick={() =>
                              setSelectedCell({
                                employee: emp,
                                month: parsedMonthNum,
                                year: parsedMonthYear,
                              })
                            }
                            className="px-1.5 py-1 w-[60px] min-w-[60px] max-w-[60px] text-center font-mono text-xs bg-white group-hover:bg-slate-50 border-r border-slate-300 sticky left-[384px] z-20 shadow-[4px_0_6px_rgba(0,0,0,0.05)] cursor-pointer whitespace-nowrap"
                          >
                            {row.monthLateHours > 0 ? (
                              <span className="font-bold text-red-600">
                                {row.monthLateHours}h
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[11px]">-</span>
                            )}
                          </td>

                          {/* CÁC CỘT NGÀY 01 -> 31 (w-8 = 32px, px-1 py-1, CĂN GIỮA, CUỘN NGẦM DƯỚI 5 CỘT ĐẦU) */}
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
                                className={`px-1 py-1 w-8 min-w-[32px] max-w-[32px] text-center border-r border-slate-200/80 cursor-pointer transition-colors align-middle ${
                                  col.isToday
                                    ? 'bg-amber-50/60 hover:bg-amber-100/60'
                                    : col.isSunday
                                    ? 'bg-slate-50/40 hover:bg-slate-100/60'
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
                                ) : (
                                  <span className="text-slate-300 font-mono text-[11px] select-none">
                                    -
                                  </span>
                                )}
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
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="matrix-year-select"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Năm báo cáo:
                </label>
                <select
                  id="matrix-year-select"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value={2026}>Năm 2026</option>
                  <option value={2025}>Năm 2025</option>
                  <option value={2027}>Năm 2027</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="matrix-dept-select"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Nhóm / Bộ phận:
                </label>
                <select
                  id="matrix-dept-select"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
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
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Chế độ xem ma trận:
                </label>
                <select
                  id="matrix-mode-select"
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as MatrixViewMode)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-blue-600 text-slate-800 cursor-pointer"
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

            {/* Legend Strip */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <strong className="font-mono text-emerald-600">Số lớn:</strong>{' '}
                  Phép năm
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <strong className="font-mono text-amber-600">KL:</strong> Không
                  lương
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <strong className="font-mono text-blue-600">CĐ:</strong> Chế độ
                  BHXH
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <strong className="font-mono text-red-600">ĐM:</strong> Đi muộn
                </span>
              </div>
              <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>Click ô tháng để xem chi tiết &amp; chứng từ</span>
              </div>
            </div>
          </div>

          {/* 12-Month Matrix Table with Compact Merged "Nhân sự" Column */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-[#0B224B] text-white text-xs font-semibold">
                  <tr>
                    <th className="px-2.5 py-1.5 w-56 min-w-[224px] max-w-[224px] sticky left-0 z-30 bg-[#0B224B] border-r border-blue-900/70 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.35)]">
                      Nhân sự
                    </th>
                    <th className="px-2 py-1.5 w-16 text-center border-r border-blue-900/70 bg-[#0B224B]">
                      Tổng phép
                    </th>

                    {/* 12 Month Columns */}
                    {Array.from({ length: 12 }, (_, idx) => (
                      <th
                        key={idx + 1}
                        className="px-2 py-1.5 w-10 text-center border-r border-blue-900/60 font-mono bg-[#0B224B]"
                      >
                        T{idx + 1}
                      </th>
                    ))}

                    {/* Right Summary Columns */}
                    <th className="px-2 py-1.5 w-14 text-center border-r border-blue-900/60 bg-[#0B224B]">
                      Đã nghỉ
                    </th>
                    <th className="px-2 py-1.5 w-14 text-center border-r border-blue-900/60 bg-[#0B224B]">
                      Tồn phép
                    </th>
                    <th className="px-2 py-1.5 w-14 text-center border-r border-blue-900/60 bg-[#0B224B]">
                      K.Lương
                    </th>
                    <th className="px-2 py-1.5 w-14 text-center bg-[#0B224B]">
                      Đi muộn
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs bg-white">
                  {matrixRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={18}
                        className="py-10 text-center text-slate-500 italic"
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
                      return (
                        <tr
                          key={emp.id}
                          className="group hover:bg-slate-50/90 transition-colors"
                        >
                          <td className="px-2.5 py-1.5 w-56 min-w-[224px] max-w-[224px] sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                            <div className="truncate font-bold text-[#0B224B] group-hover:underline leading-snug">
                              {emp.fullName}
                            </div>
                            <div className="truncate text-xs text-slate-500 font-mono leading-tight mt-0.5">
                              {emp.employeeCode} • {shortGroup}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-800 border-r border-slate-200">
                            {emp.standardAnnualLeave}
                          </td>

                          {/* 12 Month Cells */}
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
                                className="px-1.5 py-1.5 text-center font-mono border-r border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                                title={`Xem chi tiết tháng ${mNum}/${reportYear} của ${emp.fullName}`}
                              >
                                <div className="flex flex-col items-center justify-center leading-tight">
                                  {viewMode === 'all' ? (
                                    <>
                                      <span
                                        className={
                                          cell.annualLeaveDays > 0
                                            ? 'text-emerald-600 font-bold'
                                            : 'text-slate-300'
                                        }
                                      >
                                        {cell.annualLeaveDays > 0
                                          ? cell.annualLeaveDays
                                          : '-'}
                                      </span>
                                      <div className="flex items-center gap-0.5 text-[10px]">
                                        {cell.unpaidLeaveDays > 0 && (
                                          <span className="text-amber-600 font-bold">
                                            {cell.unpaidLeaveDays}KL
                                          </span>
                                        )}
                                        {cell.lateHours > 0 && (
                                          <span className="text-red-600 font-bold">
                                            {cell.lateHours}h
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  ) : viewMode === 'annual_leave' ? (
                                    <span
                                      className={
                                        cell.annualLeaveDays > 0
                                          ? 'text-emerald-600 font-bold'
                                          : 'text-slate-300'
                                      }
                                    >
                                      {cell.annualLeaveDays > 0
                                        ? cell.annualLeaveDays
                                        : '-'}
                                    </span>
                                  ) : viewMode === 'unpaid_leave' ? (
                                    <span
                                      className={
                                        cell.unpaidLeaveDays > 0
                                          ? 'text-amber-600 font-bold'
                                          : 'text-slate-300'
                                      }
                                    >
                                      {cell.unpaidLeaveDays > 0
                                        ? cell.unpaidLeaveDays
                                        : '-'}
                                    </span>
                                  ) : (
                                    <span
                                      className={
                                        cell.lateHours > 0
                                          ? 'text-red-600 font-bold'
                                          : 'text-slate-300'
                                      }
                                    >
                                      {cell.lateHours > 0
                                        ? `${cell.lateHours}h`
                                        : '-'}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Right Summary Totals (Text color only, no heavy block backgrounds) */}
                          <td className="px-2 py-1.5 text-center font-mono font-bold text-emerald-600 border-r border-slate-200">
                            {row.totalAnnualUsed > 0 ? row.totalAnnualUsed : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-200">
                            {row.remainingAnnualLeave}
                          </td>
                          <td className="px-2 py-1.5 text-center font-mono font-bold text-amber-600 border-r border-slate-200">
                            {row.totalUnpaidDays > 0 ? row.totalUnpaidDays : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center font-mono font-bold text-red-600">
                            {row.totalLateHours > 0
                              ? `${row.totalLateHours}h`
                              : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Grand Total Footer */}
                {matrixRows.length > 0 && (
                  <tfoot className="bg-[#0B224B] text-white text-xs font-mono font-bold">
                    <tr>
                      <td className="px-2.5 py-2 text-right uppercase tracking-wider border-r border-blue-900">
                        Tổng ({matrixRows.length} NS):
                      </td>
                      <td className="px-2 py-2 text-center border-r border-blue-900">
                        {grandTotalStandard}d
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
                            className="px-1.5 py-2 text-center border-r border-blue-900/60"
                          >
                            {mUsed > 0 ? mUsed : '-'}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center border-r border-blue-900 text-emerald-300">
                        {grandTotalUsed}d
                      </td>
                      <td className="px-2 py-2 text-center border-r border-blue-900 text-sky-300">
                        {grandTotalRemaining}d
                      </td>
                      <td className="px-2 py-2 text-center border-r border-blue-900 text-amber-300">
                        {grandTotalUnpaid}d
                      </td>
                      <td className="px-2 py-2 text-center text-red-300">
                        {grandTotalLateHours}h
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
          MONTH CELL DETAIL POPUP MODAL (Quick View & Quick Add)
      ===================================================================== */}
      {selectedCell && popupRow && popupMonthData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cell-detail-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-[#0B224B] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3
                  id="cell-detail-modal-title"
                  className="text-sm sm:text-base font-bold"
                >
                  Chi tiết Chấm công Tháng {selectedCell.month}/
                  {selectedCell.year}
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  {popupRow.employee.fullName} ({popupRow.employee.employeeCode})
                  — {popupRow.employee.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                aria-label="Đóng cửa sổ chi tiết"
                className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Phép năm (PN)
                  </div>
                  <div className="text-base font-extrabold text-emerald-700 font-mono mt-1">
                    {popupMonthData.annualLeaveDays} ngày
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Chế độ (CĐ)
                  </div>
                  <div className="text-base font-extrabold text-blue-700 font-mono mt-1">
                    {popupMonthData.regimeLeaveDays} ngày
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Không lương (KL)
                  </div>
                  <div className="text-base font-extrabold text-amber-700 font-mono mt-1">
                    {popupMonthData.unpaidLeaveDays} ngày
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Đi muộn (ĐM)
                  </div>
                  <div className="text-base font-extrabold text-red-600 font-mono mt-1">
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
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
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
                            <div className="text-[11px] font-mono text-slate-600">
                              Thời gian:{' '}
                              {rec.startDate === rec.endDate
                                ? formatDateVN(rec.startDate)
                                : `${formatDateVN(rec.startDate)} → ${formatDateVN(rec.endDate)}`}
                            </div>
                            <div className="text-[11px] text-slate-600">
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#0B224B] text-xs font-semibold transition-colors shrink-0 cursor-pointer"
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
            <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => {
                  const empId = selectedCell.employee.id;
                  const m = selectedCell.month;
                  const y = selectedCell.year;
                  setSelectedCell(null);
                  onQuickAddForEmployeeMonth(empId, m, y);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B224B] hover:bg-blue-900 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <CalendarPlus className="w-4 h-4" />
                <span>
                  + Thêm ghi chép Tháng {selectedCell.month} cho nhân sự này
                </span>
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
          MONTHLY MATRIX PRINT / PDF PREVIEW MODAL (Khổ ngang A4)
      ===================================================================== */}
      {isMonthlyPrintOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="In Bảng tổng hợp Nghỉ phép & Đi muộn"
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="bg-[#0B224B] text-white px-5 py-3.5 flex items-center justify-between shrink-0 print:hidden">
              <div>
                <h3 className="text-sm font-bold">
                  Xem trước bản in PDF (Khổ ngang A4) — Bảng tổng hợp Nghỉ phép &amp; Đi muộn {formattedMonthTitle}
                </h3>
                <p className="text-[11px] text-blue-200 mt-0.5">
                  Bấm &quot;In báo cáo / Lưu PDF&quot; và chọn khổ giấy Landscape (Ngang)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-[#0B224B] hover:bg-blue-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In báo cáo / Lưu PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMonthlyPrintOpen(false)}
                  className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-900 transition-colors cursor-pointer"
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
                    <tr className="bg-slate-100 text-slate-900 font-bold">
                      <th className="border border-slate-300 px-2 py-1 text-left">Nhân sự</th>
                      <th className="border border-slate-300 px-1 py-1 text-center">Tồn phép</th>
                      <th className="border border-slate-300 px-1 py-1 text-center">PN/CĐ</th>
                      <th className="border border-slate-300 px-1 py-1 text-center">K.Lương</th>
                      <th className="border border-slate-300 px-1 py-1 text-center">Đi muộn</th>
                      {monthlyReport.dayColumns.map((col) => (
                        <th
                          key={col.day}
                          className="border border-slate-300 px-0.5 py-1 text-center font-mono"
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
                          {row.monthAnnualAndRegimeDays || '-'}
                        </td>
                        <td className="border border-slate-300 px-1 py-1 text-center font-mono">
                          {row.monthUnpaidDays || '-'}
                        </td>
                        <td className="border border-slate-300 px-1 py-1 text-center font-mono">
                          {row.monthLateHours > 0
                            ? `${row.monthLateHours}h`
                            : '-'}
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
                                : '-'}
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
