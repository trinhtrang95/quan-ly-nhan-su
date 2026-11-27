import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { DepartmentGroup, Employee } from '../../../types/hr';
import { formatNumberVN } from '../../../utils/errorAndSecurityService';
import {
  fetchOvertimeForms,
  getLocalTodayIsoDate,
  isOvertimeFormLocked,
  OvertimeFormWithItems,
} from '../../../services/hrService';
import {
  calculateMonthlyOvertimeReport,
  formatOvertimeHoursVN,
  parseIsoDateParts,
} from '../../../utils/overtimeReportService';
import { exportMonthlyOvertimeReportToExcel } from '../../../utils/overtimeReportExport';

export interface OvertimeHoursReportViewProps {
  employees: Employee[];
  groups: DepartmentGroup[];
  onShowToast?: (msg: string) => void;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, idx) => idx + 1);

function isWeekendDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

export const OvertimeHoursReportView: React.FC<OvertimeHoursReportViewProps> = ({
  employees,
  groups,
  onShowToast,
}) => {
  const initialDateParts = useMemo(() => {
    const today = getLocalTodayIsoDate();
    const [y, m] = today.split('-').map(Number);
    return {
      year: Number.isFinite(y) ? y : 2026,
      month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : 11,
    };
  }, []);

  const [selectedYear, setSelectedYear] = useState<number>(initialDateParts.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialDateParts.month);
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [forms, setForms] = useState<OvertimeFormWithItems[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const loadForms = useCallback(
    async (notify = false) => {
      setIsLoading(true);
      try {
        const res = await fetchOvertimeForms();
        setForms(res.forms);
        if (notify) {
          onShowToast?.(
            `Đã làm mới dữ liệu thống kê giờ tăng ca (${formatNumberVN(res.forms.length)} phiếu).`
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [onShowToast]
  );

  useEffect(() => {
    void loadForms(false);
  }, [loadForms]);

  const lockedFormsCount = useMemo(
    () => forms.filter((f) => !f.deleted_at && isOvertimeFormLocked(f)).length,
    [forms]
  );

  const yearOptions = useMemo(() => {
    const set = new Set<number>([2025, 2026, 2027, selectedYear]);
    for (const form of forms) {
      if (form.deleted_at) continue;
      const p = parseIsoDateParts(form.overtime_date);
      if (p) set.add(p.year);
      for (const item of form.items || []) {
        if (item.deleted_at) continue;
        const ip = parseIsoDateParts(item.overtime_date);
        if (ip) set.add(ip.year);
      }
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [forms, selectedYear]);

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    groups.forEach((g) => {
      if (g.name?.trim()) names.add(g.name.trim());
    });
    employees.forEach((emp) => {
      if (emp.department?.trim()) names.add(emp.department.trim());
    });
    return Array.from(names);
  }, [groups, employees]);

  const report = useMemo(
    () =>
      calculateMonthlyOvertimeReport({
        employees,
        forms,
        year: selectedYear,
        month: selectedMonth,
        departmentFilter,
        searchQuery,
      }),
    [employees, forms, selectedYear, selectedMonth, departmentFilter, searchQuery]
  );

  const dayColumns = useMemo(
    () => Array.from({ length: report.daysInMonth }, (_, i) => i + 1),
    [report.daysInMonth]
  );

  const activeDepartmentLabel =
    departmentFilter === 'ALL' ? 'Tất cả nhóm' : departmentFilter;
  const monthLabelStr = String(selectedMonth).padStart(2, '0');

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      await exportMonthlyOvertimeReportToExcel(report, activeDepartmentLabel);
      onShowToast?.(
        `Đã xuất tệp Excel Thống kê giờ tăng ca Tháng ${monthLabelStr}/${selectedYear}.`
      );
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadPrintableHtml = () => {
    const contentEl = document.getElementById('printable-overtime-hours-a4');
    if (!contentEl) return;

    const docTitle = `Thong_Ke_Gio_Tang_Ca_Thang_${monthLabelStr}_${selectedYear}_A4_Landscape`;
    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    body { font-family: "Times New Roman", Arial, sans-serif; color: #0F172A; margin: 0; font-size: 8.5pt; }
    h2 { font-size: 13pt; font-weight: bold; text-align: center; text-transform: uppercase; margin: 0 0 4px 0; color: #14539E; }
    p.meta { font-size: 8.5pt; text-align: center; color: #475569; margin: 0 0 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
    th, td { border: 1px solid #94A3B8; padding: 2px 2px; text-align: center; white-space: nowrap; }
    th { background-color: #14539E; color: #FFFFFF; font-weight: bold; }
    td.text-left { text-align: left; padding-left: 4px; padding-right: 4px; }
    tr.total-row td { background-color: #E0ECFA; color: #14539E; font-weight: bold; }
    td.col-total { background-color: #EFF6FF; color: #14539E; font-weight: bold; }
  </style>
</head>
<body>
  ${contentEl.innerHTML}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

    const blob = new Blob(['\uFEFF' + fullHtml], {
      type: 'text/html;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* Thanh bộ lọc & nút xuất báo cáo */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Chọn Tháng */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="ot-report-month-select"
                className="text-xs font-semibold text-slate-600 whitespace-nowrap"
              >
                Tháng
              </label>
              <select
                id="ot-report-month-select"
                data-testid="ot-report-month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-8 px-2.5 text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    Tháng {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            {/* Chọn Năm */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="ot-report-year-select"
                className="text-xs font-semibold text-slate-600 whitespace-nowrap"
              >
                Năm
              </label>
              <select
                id="ot-report-year-select"
                data-testid="ot-report-year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-8 px-2.5 text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc Nhóm */}
            <select
              id="ot-report-dept-select"
              data-testid="ot-report-dept-select"
              aria-label="Lọc theo Nhóm"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-8 px-2.5 text-xs font-medium text-slate-700 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer min-w-[165px]"
            >
              <option value="ALL">Tất cả Nhóm</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Ô tìm nhanh thành viên */}
            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã NV, họ tên..."
                aria-label="Tìm nhân sự trong bảng giờ tăng ca"
                className="w-full h-8 pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cụm nút hành động */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadForms(true)}
              disabled={isLoading}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={isExportingExcel || isLoading}
              data-testid="ot-report-export-excel-btn"
              className="h-8 px-3.5 rounded-lg bg-[#107C41] hover:bg-[#0D6534] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isExportingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              disabled={isLoading}
              data-testid="ot-report-export-pdf-btn"
              className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#10427F] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Xuất PDF</span>
            </button>
          </div>
        </div>

        {/* Thanh tóm tắt gọn số liệu tháng */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#14539E]" />
              <span>
                Nhân sự hiển thị:{' '}
                <strong className="text-slate-800">{formatNumberVN(report.rows.length)}</strong>
              </span>
            </span>
            <span>
              Có phát sinh tăng ca:{' '}
              <strong className="text-[#14539E]">
                {formatNumberVN(report.activeMemberCount)}
              </strong>{' '}
              người
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#14539E]" />
              <span>
                Tổng giờ tăng ca tháng {monthLabelStr}/{selectedYear}:{' '}
                <strong className="text-[#14539E]">
                  {formatOvertimeHoursVN(report.grandTotalHours, true)} giờ
                </strong>
              </span>
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Chỉ tổng hợp phiếu <strong className="text-[#14539E]">Đã chốt</strong> ({formatNumberVN(lockedFormsCount)} phiếu) • Số ngày trong tháng: {report.daysInMonth} ngày
          </span>
        </div>
      </div>

      {/* Bảng ma trận thống kê giờ tăng ca theo từng ngày trong tháng */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-6 h-6 text-[#14539E] animate-spin" />
            <span>Đang tổng hợp dữ liệu giờ tăng ca...</span>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[260px]">
            <table
              data-testid="overtime-hours-matrix-table"
              className="w-full border-collapse text-xs whitespace-nowrap"
            >
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#14539E] text-white">
                  <th className="sticky left-0 z-30 bg-[#14539E] border-r border-white/15 px-2 py-2.5 text-center font-semibold w-10 min-w-[40px]">
                    STT
                  </th>
                  <th className="sticky left-[40px] z-30 bg-[#14539E] border-r border-white/15 px-2.5 py-2.5 text-center font-semibold w-24 min-w-[92px]">
                    Mã NV
                  </th>
                  <th className="sticky left-[132px] z-30 bg-[#14539E] border-r border-white/15 px-3 py-2.5 text-left font-semibold min-w-[165px]">
                    Họ tên
                  </th>
                  <th className="sticky left-[297px] z-30 bg-[#14539E] border-r border-white/15 px-2.5 py-2.5 text-left font-semibold min-w-[108px]">
                    Nhóm
                  </th>
                  <th className="sticky left-[405px] z-30 bg-[#0F3D75] border-r border-white/25 px-2.5 py-2.5 text-center font-bold min-w-[64px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.2)]">
                    Tổng
                  </th>
                  {dayColumns.map((day) => {
                    const weekend = isWeekendDay(selectedYear, selectedMonth, day);
                    return (
                      <th
                        key={day}
                        className={`border-r border-white/15 px-1.5 py-2.5 text-center font-semibold min-w-[36px] ${
                          weekend ? 'bg-[#1D63B8]' : ''
                        }`}
                      >
                        {day}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5 + report.daysInMonth}
                      className="py-12 text-center text-slate-400 text-xs"
                    >
                      Không có nhân sự phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, idx) => {
                    const rowBg = idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white';
                    return (
                      <tr
                        key={row.employeeId}
                        className={`${rowBg} hover:bg-blue-50/40 transition-colors`}
                      >
                        <td
                          className={`sticky left-0 z-10 ${rowBg} border-r border-slate-200 px-2 py-2 text-center text-slate-500 font-mono`}
                        >
                          {row.stt}
                        </td>
                        <td
                          className={`sticky left-[40px] z-10 ${rowBg} border-r border-slate-200 px-2.5 py-2 text-center font-mono text-slate-600`}
                        >
                          {row.employeeCode || '—'}
                        </td>
                        <td
                          className={`sticky left-[132px] z-10 ${rowBg} border-r border-slate-200 px-3 py-2 font-medium text-slate-800`}
                        >
                          {row.fullName}
                        </td>
                        <td
                          className={`sticky left-[297px] z-10 ${rowBg} border-r border-slate-200 px-2.5 py-2 text-slate-600`}
                        >
                          {row.department || '—'}
                        </td>
                        <td
                          className={`sticky left-[405px] z-10 border-r border-slate-200 px-2.5 py-2 text-center font-bold shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)] ${
                            row.totalHours > 0
                              ? 'bg-blue-50 text-[#14539E]'
                              : `${rowBg} text-slate-300 font-normal`
                          }`}
                        >
                          {row.totalHours > 0 ? formatOvertimeHoursVN(row.totalHours) : '—'}
                        </td>
                        {dayColumns.map((day) => {
                          const hours = row.dailyHours[day] || 0;
                          const weekend = isWeekendDay(selectedYear, selectedMonth, day);
                          return (
                            <td
                              key={day}
                              className={`border-r border-slate-100 px-1 py-2 text-center tabular-nums ${
                                hours > 0
                                  ? 'bg-blue-50/50 text-[#14539E] font-semibold'
                                  : weekend
                                    ? 'bg-slate-50/90 text-slate-300'
                                    : 'text-slate-300'
                              }`}
                            >
                              {hours > 0 ? formatOvertimeHoursVN(hours) : '·'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Dòng tổng hợp cuối bảng cho từng ngày và tổng giờ chung */}
              <tfoot className="sticky bottom-0 z-20">
                <tr
                  data-testid="overtime-hours-footer-row"
                  className="bg-[#E8F1FC] border-t-2 border-[#14539E]/30 font-bold text-[#14539E] shadow-[0_-2px_6px_-2px_rgba(15,23,42,0.12)]"
                >
                  <td
                    colSpan={4}
                    className="sticky left-0 z-30 bg-[#E8F1FC] border-r border-[#14539E]/20 px-3 py-2.5 text-right uppercase tracking-wide text-[11px]"
                  >
                    Tổng cộng (giờ)
                  </td>
                  <td
                    data-testid="overtime-hours-grand-total"
                    className="sticky left-[405px] z-30 bg-[#14539E] text-white border-r border-white/20 px-2.5 py-2.5 text-center tabular-nums shadow-[2px_0_4px_-2px_rgba(0,0,0,0.2)]"
                  >
                    {formatOvertimeHoursVN(report.grandTotalHours, true)}
                  </td>
                  {dayColumns.map((day) => {
                    const daySum = report.dailyTotals[day] || 0;
                    return (
                      <td
                        key={day}
                        className={`border-r border-[#14539E]/15 px-1 py-2.5 text-center tabular-nums ${
                          daySum > 0 ? 'text-[#14539E]' : 'text-slate-400 font-normal'
                        }`}
                      >
                        {daySum > 0 ? formatOvertimeHoursVN(daySum) : '0'}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal Xem trước & In PDF khổ ngang A4 Landscape */}
      {isPrintModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ot-pdf-preview-title"
          data-testid="overtime-hours-pdf-modal"
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <style>
            {`@media print {
              @page { size: A4 landscape; margin: 8mm; }
              body * { visibility: hidden; }
              #printable-overtime-hours-a4, #printable-overtime-hours-a4 * { visibility: visible; }
              #printable-overtime-hours-a4 {
                position: fixed;
                inset: 0;
                width: 100%;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
              }
            }`}
          </style>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-[1220px] max-h-[92vh] flex flex-col overflow-hidden">
            {/* Thanh công cụ trên cùng */}
            <div className="no-print bg-[#14539E] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <h3 id="ot-pdf-preview-title" className="text-sm font-bold">
                  Xem trước bản in PDF — Thống kê Giờ Tăng ca Tháng {monthLabelStr}/{selectedYear} (A4 Ngang)
                </h3>
                <p className="text-[11px] text-blue-100 mt-0.5">
                  Nhóm: {activeDepartmentLabel} • {formatNumberVN(report.rows.length)} nhân sự • Tổng{' '}
                  {formatOvertimeHoursVN(report.grandTotalHours, true)} giờ
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPrintableHtml}
                  className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải bản in (.html)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3.5 rounded-lg bg-white text-[#14539E] hover:bg-blue-50 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In / Lưu PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  aria-label="Đóng cửa sổ xem trước PDF"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Khung giấy A4 Landscape cuộn xem trước */}
            <div className="flex-1 overflow-auto bg-slate-100 p-4 sm:p-6">
              <div
                id="printable-overtime-hours-a4"
                className="bg-white shadow-lg border border-slate-200 mx-auto p-3.5 w-full min-w-[1040px] max-w-[1123px]"
                style={{ fontFamily: '"Times New Roman", Arial, serif' }}
              >
                <div className="text-center mb-2.5">
                  <h2 className="text-base font-bold uppercase text-[#14539E] tracking-wide">
                    BẢNG THỐNG KÊ GIỜ TĂNG CA THÁNG {monthLabelStr}/{selectedYear}
                  </h2>
                  <p className="meta text-xs text-slate-600 mt-0.5">
                    Nhóm: <strong>{activeDepartmentLabel}</strong> &nbsp;|&nbsp; Tổng nhân sự:{' '}
                    <strong>{formatNumberVN(report.rows.length)}</strong> &nbsp;|&nbsp; Tổng giờ tăng ca:{' '}
                    <strong>{formatOvertimeHoursVN(report.grandTotalHours, true)} giờ</strong>
                  </p>
                </div>

                <table className="w-full table-fixed border-collapse text-[8.5px] leading-tight">
                  <thead>
                    <tr className="bg-[#14539E] text-white">
                      <th className="border border-slate-400 px-0.5 py-1 text-center w-[24px]">STT</th>
                      <th className="border border-slate-400 px-0.5 py-1 text-center w-[54px]">Mã NV</th>
                      <th className="border border-slate-400 px-1 py-1 text-left w-[124px]">Họ tên</th>
                      <th className="border border-slate-400 px-1 py-1 text-left w-[64px]">Nhóm</th>
                      <th className="border border-slate-400 px-0.5 py-1 text-center w-[32px] bg-[#0F3D75]">Tổng</th>
                      {dayColumns.map((day) => (
                        <th key={day} className="border border-slate-400 px-0 py-1 text-center">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.employeeId}>
                        <td className="border border-slate-300 px-0.5 py-1 text-center">{row.stt}</td>
                        <td className="border border-slate-300 px-0.5 py-1 text-center font-mono truncate">
                          {row.employeeCode}
                        </td>
                        <td className="text-left border border-slate-300 px-1 py-1 font-medium truncate">
                          {row.fullName}
                        </td>
                        <td className="text-left border border-slate-300 px-1 py-1 truncate">
                          {row.department}
                        </td>
                        <td className="col-total border border-slate-300 px-0.5 py-1 text-center font-bold bg-blue-50 text-[#14539E]">
                          {row.totalHours > 0 ? formatOvertimeHoursVN(row.totalHours) : ''}
                        </td>
                        {dayColumns.map((day) => {
                          const h = row.dailyHours[day] || 0;
                          return (
                            <td
                              key={day}
                              className={`border border-slate-300 px-0 py-1 text-center ${
                                h > 0 ? 'font-bold text-[#14539E]' : ''
                              }`}
                            >
                              {h > 0 ? formatOvertimeHoursVN(h) : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row bg-[#E0ECFA] font-bold text-[#14539E]">
                      <td colSpan={4} className="border border-slate-400 px-1.5 py-1 text-right uppercase">
                        Tổng cộng (giờ)
                      </td>
                      <td className="border border-slate-400 px-0.5 py-1 text-center bg-[#14539E] text-white">
                        {formatOvertimeHoursVN(report.grandTotalHours, true)}
                      </td>
                      {dayColumns.map((day) => {
                        const daySum = report.dailyTotals[day] || 0;
                        return (
                          <td key={day} className="border border-slate-400 px-0 py-1 text-center">
                            {daySum > 0 ? formatOvertimeHoursVN(daySum) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>

                <div className="mt-5 flex justify-between items-start text-[11px] text-slate-700 px-8">
                  <div className="text-center">
                    <div className="font-bold">Người lập biểu</div>
                    <div className="italic text-[10px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">Trưởng bộ phận</div>
                    <div className="italic text-[10px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
