import React, { useState, useRef, useEffect } from 'react';
import {
  CalendarPlus,
  Search,
  FileSpreadsheet,
  FileText,
  Trash2,
  Pencil,
  RotateCcw,
  Eye,
  Printer,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
  LeaveRecord,
  LeaveRecordType,
} from '../types/hr';
import {
  formatDateVN,
  LEAVE_TYPE_META,
} from '../utils/hrCalculations';

interface LeaveLateLogViewProps {
  records: LeaveRecord[];
  employees: Employee[];
  groups: DepartmentGroup[];
  isAdmin?: boolean;
  onOpenAddRecord: () => void;
  onOpenEditRecord: (rec: LeaveRecord) => void;
  onDeleteRecord: (rec: LeaveRecord) => void;
  onInspectAttachment: (url: string, title: string) => void;
  onExportExcel: (filteredRecords: LeaveRecord[]) => void;
}

export const LeaveLateLogView: React.FC<LeaveLateLogViewProps> = ({
  records,
  employees,
  groups,
  isAdmin = true,
  onOpenAddRecord,
  onOpenEditRecord,
  onDeleteRecord,
  onInspectAttachment,
  onExportExcel,
}) => {
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(e.target as Node)
      ) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

  const filteredRecords = records
    .filter((rec) => {
      const emp = empMap.get(rec.employeeId);
      if (!emp) return false;

      if (startDateFilter && rec.startDate < startDateFilter) return false;
      if (endDateFilter && rec.startDate > endDateFilter) return false;
      if (typeFilter !== 'ALL' && rec.type !== typeFilter) return false;
      if (departmentFilter !== 'ALL' && emp.department !== departmentFilter)
        return false;

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchCode = emp.employeeCode.toLowerCase().includes(q);
        const matchReason = rec.reason.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchReason) return false;
      }
      return true;
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  // Quick summary metrics for the currently filtered records
  const sumAnnual = filteredRecords
    .filter((r) => r.type === 'annual_leave')
    .reduce((acc, r) => Number((acc + r.amount).toFixed(2)), 0);
  const sumUnpaid = filteredRecords
    .filter((r) => r.type === 'unpaid_leave')
    .reduce((acc, r) => Number((acc + r.amount).toFixed(2)), 0);
  const sumRegime = filteredRecords
    .filter((r) => r.type === 'regime_leave')
    .reduce((acc, r) => Number((acc + r.amount).toFixed(2)), 0);
  const sumLateHours = filteredRecords
    .filter((r) => r.type === 'late_early')
    .reduce((acc, r) => Number((acc + r.amount).toFixed(2)), 0);

  const handleTriggerPrint = () => {
    window.print();
  };

  const handleDownloadPrintableHtml = () => {
    const contentEl = document.getElementById('leave-pdf-printable-sheet');
    if (!contentEl) return;

    const pageCss = `@page { size: A4 portrait; margin: 20mm 15mm 20mm 20mm; }
       body { font-family: "Times New Roman", Times, serif; font-size: 13pt; color: #000000; margin: 0; }
       h2 { font-family: "Times New Roman", Times, serif; font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase; margin: 0 0 16px 0; }
       table { width: 100%; border-collapse: collapse; font-family: "Times New Roman", Times, serif; font-size: 12pt; }
       th { font-weight: bold; padding: 10px 8px; border: 1px solid #000000; text-align: center; background-color: #f8fafc; }
       td { padding: 10px 8px; border: 1px solid #000000; }
       .text-center { text-align: center; }
       .text-left { text-align: left; }`;

    const docTitle = 'Bang_Thong_Ke_Nghi_Phep_Va_Di_Muon_A4';

    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>
    ${pageCss}
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
    <div className="space-y-3">
      {/* Toolbar & Filters Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 md:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base md:text-lg font-extrabold text-slate-900">
              Ghi chép Nghỉ phép &amp; Đi muộn
            </h2>
            {/* Compact Summary Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              <span className="px-2 py-0.5 rounded bg-teal-50 text-[#0F766E] border border-teal-200 font-mono">
                {filteredRecords.length} bản ghi
              </span>
              <span className="px-2 py-0.5 rounded bg-teal-50/70 text-[#0D9488] border border-teal-200/60 font-mono">
                Phép: {sumAnnual}d
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                K.Lương: {sumUnpaid}d
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-mono">
                Chế độ: {sumRegime}d
              </span>
              <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-mono">
                Đi muộn: {sumLateHours}h
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Nút + Ghi nhận mới đặt lên vị trí ưu tiên đầu tiên */}
            <button
              type="button"
              onClick={onOpenAddRecord}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>+ Ghi nhận mới</span>
            </button>

            {/* 2. Dropdown Xuất Excel / PDF ▾ */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                type="button"
                onClick={() => setIsExportDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>Xuất Excel / PDF</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 text-xs font-medium text-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      onExportExcel(filteredRecords);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-[#0D9488] flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Xuất Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setIsPdfModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-[#0D9488] flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Xuất PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Optimized Filter Controls (Grid: search, from, to, type, dept) */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
          {/* Search */}
          <div className="relative">
            <label
              htmlFor="search-leave-input"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Tìm kiếm nhân sự / lý do:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-leave-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Họ tên, Mã NV, Lý do..."
                aria-label="Tìm kiếm nhật ký nghỉ phép"
                className="w-full pl-8 pr-3 py-1.5 text-[16px] sm:text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488]"
              />
            </div>
          </div>

          {/* Từ ngày */}
          <div>
            <label
              htmlFor="start-date-filter"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Từ ngày:
            </label>
            <input
              id="start-date-filter"
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              aria-label="Từ ngày"
              className="w-full px-2.5 py-1.5 text-[16px] sm:text-xs font-mono rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          {/* Đến ngày */}
          <div>
            <label
              htmlFor="end-date-filter"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Đến ngày:
            </label>
            <input
              id="end-date-filter"
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              aria-label="Đến ngày"
              className="w-full px-2.5 py-1.5 text-[16px] sm:text-xs font-mono rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label
              htmlFor="type-filter-select"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Loại giấy phép:
            </label>
            <select
              id="type-filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Lọc theo Loại giấy phép"
              className="w-full px-2.5 py-1.5 text-[16px] sm:text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả loại giấy phép</option>
              <option value="annual_leave">Nghỉ phép năm</option>
              <option value="unpaid_leave">Nghỉ không lương</option>
              <option value="regime_leave">Nghỉ chế độ (BHXH)</option>
              <option value="late_early">Đi muộn</option>
            </select>
          </div>

          {/* Department Filter & Reset */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <label
                htmlFor="dept-filter-select"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Bộ phận:
              </label>
              <select
                id="dept-filter-select"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                aria-label="Lọc nhật ký theo Nhóm bộ phận"
                className="w-full px-2.5 py-1.5 text-[16px] sm:text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-700 font-medium cursor-pointer"
              >
                <option value="ALL">Tất cả Nhóm</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {(startDateFilter ||
              endDateFilter ||
              typeFilter !== 'ALL' ||
              departmentFilter !== 'ALL' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setTypeFilter('ALL');
                  setDepartmentFilter('ALL');
                  setSearchQuery('');
                }}
                aria-label="Đặt lại bộ lọc nhật ký"
                title="Đặt lại bộ lọc"
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer self-end mb-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History Log Table with Sticky Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="max-h-[calc(100vh-210px)] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[1020px]">
            <thead className="sticky top-0 z-20 bg-[#0F232E] text-white text-xs font-semibold tracking-wider uppercase">
              <tr>
                <th className="py-3 px-3 w-12 text-center bg-[#0F232E]">STT</th>
                <th className="py-3 px-3 bg-[#0F232E]">Mã NV</th>
                <th className="py-3 px-3 sticky left-0 z-30 bg-[#0F232E] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                  Họ tên nhân sự
                </th>
                <th className="py-3 px-3 bg-[#0F232E]">Nhóm / Bộ phận</th>
                <th className="py-3 px-3 bg-[#0F232E]">Loại giấy phép</th>
                <th className="py-3 px-3 bg-[#0F232E]">Thời gian áp dụng</th>
                <th className="py-3 px-3 text-right bg-[#0F232E]">Số lượng</th>
                <th className="py-3 px-3 bg-[#0F232E]">Lý do / Ghi chú chi tiết</th>
                <th className="py-3 px-3 text-center bg-[#0F232E]">Hiện trạng giấy phép</th>
                <th className="py-3 px-3 text-center bg-[#0F232E]">Ảnh giấy phép</th>
                <th className="py-3 px-3 text-center bg-[#0F232E]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    Chưa có bản ghi nghỉ phép hoặc đi muộn nào phù hợp với khoảng thời gian và bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const emp = empMap.get(rec.employeeId);
                  const meta = LEAVE_TYPE_META[rec.type as LeaveRecordType];
                  const paperStat = rec.paperStatus || (rec.attachmentUrl ? 'Đã có' : 'Chưa có');

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/90 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-[#0D9488] whitespace-nowrap">
                        {emp?.employeeCode || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center gap-2.5">
                          {emp && (
                            <img
                              src={emp.avatarUrl}
                              alt={emp.fullName}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
                            />
                          )}
                          <span>{emp?.fullName || 'Nhân sự đã xóa'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {emp?.department || '-'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div
                          className="font-bold"
                          style={{ color: meta.textColor }}
                        >
                          {rec.type === 'late_early' ? 'Đi muộn' : meta.shortLabel}
                        </div>
                        {rec.regimeSubtype && (
                          <div className="text-[11px] text-slate-500">
                            {rec.regimeSubtype}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {rec.startDate === rec.endDate
                          ? formatDateVN(rec.startDate)
                          : `${formatDateVN(rec.startDate)} → ${formatDateVN(rec.endDate)}`}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        <span style={{ color: meta.textColor }}>
                          {rec.amount} {meta.unit}
                        </span>
                      </td>
                      <td
                        className="py-2.5 px-3 text-slate-600 max-w-[240px]"
                        title={rec.reason}
                      >
                        <div className="line-clamp-2">{rec.reason}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {paperStat === 'Đã có' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã có
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200">
                            <AlertCircle className="w-3 h-3 text-red-500" />
                            Chưa có
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {rec.attachmentUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              onInspectAttachment(
                                rec.attachmentUrl!,
                                rec.attachmentTitle ||
                                  `Ảnh giấy phép - ${emp?.fullName} (${formatDateVN(rec.startDate)})`
                              )
                            }
                            aria-label={`Phóng to ảnh giấy phép của ${emp?.fullName}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-teal-200 bg-teal-50/70 hover:bg-teal-100/80 text-[#0F766E] transition-colors cursor-pointer"
                          >
                            <img
                              src={rec.attachmentUrl}
                              alt="Thumbnail giấy phép"
                              referrerPolicy="no-referrer"
                              className="w-5 h-6 object-cover rounded-xs border border-slate-300 bg-white shrink-0"
                            />
                            <span className="text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              Xem ảnh
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            Chưa có ảnh
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isAdmin ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenEditRecord(rec)}
                              aria-label={`Sửa bản ghi của ${emp?.fullName}`}
                              title="Chỉnh sửa"
                              className="p-1.5 rounded-md text-slate-600 hover:text-[#0D9488] hover:bg-teal-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRecord(rec)}
                              aria-label={`Xóa bản ghi của ${emp?.fullName}`}
                              title="Xóa bản ghi"
                              className="p-1.5 rounded-md text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Đã lưu</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          PDF EXPORT PREVIEW MODAL (A4 Portrait - Exactly 5 Columns)
          Title: "BẢNG THỐNG KÊ NGHỈ PHÉP & ĐI MUỘN" (No Subtitle, No Signatures)
      ===================================================================== */}
      {isPdfModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-pdf-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <style>
            {`@media print {
               @page { size: A4 portrait; margin: 20mm 15mm 20mm 20mm; }
               body { font-family: "Times New Roman", Times, serif !important; }
               .no-print { display: none !important; }
            }`}
          </style>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden my-auto">
            {/* Modal Action Bar (hidden when printing) */}
            <div className="no-print bg-[#0F232E] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 id="leave-pdf-modal-title" className="text-sm font-bold">
                  Xem trước Bản in PDF — BẢNG THỐNG KÊ NGHỈ PHÉP &amp; ĐI MUỘN
                </h3>
                <p className="text-xs text-slate-300">
                  Khổ dọc A4 (5 cột chuẩn: STT, NGÀY/THÁNG, HỌ VÀ TÊN, LOẠI GIẤY PHÉP, KÝ/NHẬN)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In ngay / Lưu PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPrintableHtml}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải bản in A4</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  aria-label="Đóng xem trước bản in"
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Sheet (A4 Portrait - 5 columns) */}
            <div
              id="leave-pdf-printable-sheet"
              className="max-h-[78vh] overflow-y-auto bg-white text-black p-8"
              style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
              {/* Title: BẢNG THỐNG KÊ NGHỈ PHÉP & ĐI MUỘN */}
              <div className="text-center mb-6">
                <h2 className="text-[14pt] font-bold text-black uppercase tracking-wide">
                  BẢNG THỐNG KÊ NGHỈ PHÉP &amp; ĐI MUỘN
                </h2>
              </div>

              <table
                className="w-full border-collapse border border-black text-[12pt] text-black"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                <thead>
                  <tr className="font-bold bg-slate-50">
                    <th style={{ width: '8%' }} className="py-2.5 px-2 border border-black text-center">
                      STT
                    </th>
                    <th style={{ width: '22%' }} className="py-2.5 px-2 border border-black text-center">
                      NGÀY/THÁNG
                    </th>
                    <th style={{ width: '32%' }} className="py-2.5 px-3 border border-black text-left">
                      HỌ VÀ TÊN
                    </th>
                    <th style={{ width: '23%' }} className="py-2.5 px-2 border border-black text-center">
                      LOẠI GIẤY PHÉP
                    </th>
                    <th style={{ width: '15%' }} className="py-2.5 px-2 border border-black text-center">
                      KÝ/NHẬN
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 border border-black text-center italic text-slate-500">
                        Không có bản ghi nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec, idx) => {
                      const emp = empMap.get(rec.employeeId);
                      const meta = LEAVE_TYPE_META[rec.type as LeaveRecordType];
                      const dateStr =
                        rec.startDate === rec.endDate
                          ? formatDateVN(rec.startDate)
                          : `${formatDateVN(rec.startDate)} - ${formatDateVN(rec.endDate)}`;
                      const leaveTypeName =
                        rec.type === 'late_early'
                          ? `Đi muộn (${rec.amount}h)`
                          : `${meta.label} (${rec.amount}${meta.unit})`;

                      return (
                        <tr key={rec.id}>
                          <td style={{ padding: '10px 6px' }} className="border border-black text-center font-mono">
                            {idx + 1}
                          </td>
                          <td style={{ padding: '10px 6px' }} className="border border-black text-center font-mono">
                            {dateStr}
                          </td>
                          <td style={{ padding: '10px 10px' }} className="border border-black text-left font-semibold">
                            {emp?.fullName || 'Nhân sự đã xóa'}
                            {emp?.employeeCode && <span className="font-normal text-slate-600 text-[11pt]"> ({emp.employeeCode})</span>}
                          </td>
                          <td style={{ padding: '10px 8px' }} className="border border-black text-center">
                            {leaveTypeName}
                          </td>
                          <td style={{ padding: '10px 8px' }} className="border border-black text-center">
                            {/* KÝ/NHẬN để trống hoàn toàn dòng kẻ thoáng để ký tay */}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* No signatures, no extra dates or record counts */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
