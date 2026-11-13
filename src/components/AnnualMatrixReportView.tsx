import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileText,
  X,
  Eye,
  CalendarPlus,
  Info,
  ChevronDown,
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
  formatDateVN,
  LEAVE_TYPE_META,
} from '../utils/hrCalculations';

interface AnnualMatrixReportViewProps {
  employees: Employee[];
  records: LeaveRecord[];
  groups: DepartmentGroup[];
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

export const AnnualMatrixReportView: React.FC<AnnualMatrixReportViewProps> = ({
  employees,
  records,
  groups,
  onExportMatrixExcel,
  onExportMatrixPDF,
  onInspectAttachment,
  onQuickAddForEmployeeMonth,
}) => {
  const [reportYear, setReportYear] = useState<number>(2026);
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<MatrixViewMode>('all');
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

  // State for Month Cell Detail Popup
  const [selectedCell, setSelectedCell] = useState<{
    employee: Employee;
    month: number;
  } | null>(null);

  const matrixRows = calculateAnnualMatrixReport(
    employees,
    records,
    reportYear,
    departmentFilter
  );

  // Totals across all displayed employees
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
    ? matrixRows.find((r) => r.employee.id === selectedCell.employee.id)
    : null;
  const popupMonthData =
    popupRow && selectedCell ? popupRow.months[selectedCell.month] : null;

  return (
    <div className="space-y-3">
      {/* Top Control Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 md:p-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base md:text-lg font-extrabold text-slate-900">
              Báo cáo tổng hợp ({reportYear})
            </h2>
          </div>

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
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 text-xs font-medium text-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsExportDropdownOpen(false);
                    onExportMatrixExcel(matrixRows, reportYear, viewMode);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-[#0D9488] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Xuất Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExportDropdownOpen(false);
                    onExportMatrixPDF(matrixRows, reportYear, viewMode);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-[#0D9488] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Xuất PDF (Khổ ngang A4)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters Row */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label
              htmlFor="matrix-year-select"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Năm báo cáo:
            </label>
            <select
              id="matrix-year-select"
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-[16px] sm:text-xs font-mono font-semibold rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] cursor-pointer"
            >
              <option value={2026}>Năm 2026</option>
              <option value={2025}>Năm 2025</option>
              <option value={2027}>Năm 2027</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="matrix-dept-select"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Nhóm / Bộ phận:
            </label>
            <select
              id="matrix-dept-select"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-[16px] sm:text-xs font-medium rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] cursor-pointer"
            >
              <option value="ALL">Tất cả Nhóm / Bộ phận ({groups.length})</option>
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
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Chế độ xem ma trận:
            </label>
            <select
              id="matrix-mode-select"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as MatrixViewMode)}
              className="w-full px-2.5 py-1.5 text-[16px] sm:text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-800 cursor-pointer"
            >
              <option value="all">Tổng hợp tất cả (Phép + K.Lương + Đi muộn)</option>
              <option value="annual_leave">Thống kê Phép năm</option>
              <option value="unpaid_leave">Thống kê Nghỉ không lương</option>
              <option value="late_early">Thống kê Giờ đi muộn</option>
            </select>
          </div>
        </div>

        {/* Legend Strip */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <strong className="font-mono text-[#0D9488]">Số lớn:</strong> Phép năm
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <strong className="font-mono text-amber-600">KL:</strong> Không lương
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <strong className="font-mono text-sky-600">CĐ:</strong> Chế độ BHXH
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <strong className="font-mono text-red-600">M:</strong> Đi muộn
            </span>
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Click ô tháng để xem chi tiết &amp; chứng từ</span>
          </div>
        </div>
      </div>

      {/* 12-Month Matrix Table with Sticky Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="max-h-[calc(100vh-210px)] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1060px]">
              <thead className="sticky top-0 z-20 bg-[#0F232E] text-white text-[11px] font-semibold tracking-wider uppercase">
                <tr>
                  <th className="py-3 px-1.5 w-9 text-center border-r border-slate-700/60 bg-[#0F232E]">
                    STT
                  </th>
                  <th className="py-3 px-2 w-16 border-r border-slate-700/60 bg-[#0F232E]">
                    Mã NV
                  </th>
                  <th className="py-3 px-2.5 min-w-[140px] sticky left-0 z-30 bg-[#0F232E] border-r border-slate-700/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.35)]">
                    Họ tên
                  </th>
                  <th className="py-3 px-2 min-w-[130px] border-r border-slate-700/60 bg-[#0F232E]">
                    Nhóm / Bộ phận
                  </th>
                  <th className="py-3 px-1.5 w-16 text-center border-r border-slate-700/60 bg-[#163C45]">
                    Tổng phép
                  </th>

                  {/* 12 Month Columns */}
                  {Array.from({ length: 12 }, (_, idx) => (
                    <th
                      key={idx + 1}
                      className="py-3 px-1 w-11 text-center border-r border-slate-700/50 font-mono bg-[#0F232E]"
                    >
                      T{idx + 1}
                    </th>
                  ))}

                  {/* Right Summary Columns */}
                  <th className="py-3 px-1.5 w-14 text-center border-r border-slate-700/50 bg-[#163C45]">
                    Đã nghỉ
                  </th>
                  <th className="py-3 px-1.5 w-14 text-center border-r border-slate-700/50 bg-[#0D9488]">
                    Tồn phép
                  </th>
                  <th className="py-3 px-1.5 w-14 text-center border-r border-slate-700/50 bg-amber-800">
                    K.Lương
                  </th>
                  <th className="py-3 px-1.5 w-14 text-center bg-rose-900">
                    Đi muộn
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {matrixRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={19}
                      className="py-12 text-center text-slate-500 italic"
                    >
                      Không có dữ liệu nhân sự phù hợp với bộ phận đã chọn.
                    </td>
                  </tr>
                ) : (
                  matrixRows.map((row, idx) => {
                    const emp = row.employee;
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-slate-50/90 transition-colors"
                      >
                        <td className="py-2.5 px-1.5 text-center font-mono tabular-nums text-slate-500 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-2 font-mono tabular-nums font-bold text-[#0D9488] border-r border-slate-200 whitespace-nowrap">
                          {emp.employeeCode}
                        </td>
                        <td className="py-2.5 px-2.5 font-bold text-slate-900 sticky left-0 z-10 bg-white border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <img
                              src={emp.avatarUrl}
                              alt={emp.fullName}
                              referrerPolicy="no-referrer"
                              className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200"
                            />
                            <span>{emp.fullName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                          {emp.department || '-'}
                        </td>
                        <td className="py-2.5 px-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-200 bg-teal-50/30">
                          {emp.standardAnnualLeave}
                        </td>

                        {/* 12 Month Cells */}
                        {Array.from({ length: 12 }, (_, mIdx) => {
                          const mNum = mIdx + 1;
                          const cell = row.months[mNum];
                          const hasActivity =
                            cell.annualLeaveDays > 0 ||
                            cell.unpaidLeaveDays > 0 ||
                            cell.regimeLeaveDays > 0 ||
                            cell.lateHours > 0;

                          return (
                            <td
                              key={mNum}
                              onClick={() =>
                                setSelectedCell({ employee: emp, month: mNum })
                              }
                              className={`py-2 px-0.5 text-center font-mono border-r border-slate-200 cursor-pointer transition-colors ${
                                hasActivity
                                  ? 'bg-teal-50/60 hover:bg-teal-100/70 text-[#0F766E] font-bold'
                                  : 'hover:bg-slate-100 text-slate-400'
                              }`}
                              title={`Xem chi tiết tháng ${mNum}/${reportYear} của ${emp.fullName}`}
                            >
                              <div className="flex flex-col items-center justify-center leading-tight py-0.5">
                                {viewMode === 'all' ? (
                                  <>
                                    <span className="text-xs">
                                      {cell.annualLeaveDays > 0
                                        ? cell.annualLeaveDays
                                        : '-'}
                                    </span>
                                    <div className="flex items-center gap-0.5 text-[9px] text-slate-500 scale-90">
                                      {cell.unpaidLeaveDays > 0 && (
                                        <span className="text-amber-600 font-bold">
                                          {cell.unpaidLeaveDays}kl
                                        </span>
                                      )}
                                      {cell.lateHours > 0 && (
                                        <span className="text-red-600 font-bold">
                                          {cell.lateHours}m
                                        </span>
                                      )}
                                    </div>
                                  </>
                                ) : viewMode === 'annual_leave' ? (
                                  <span>
                                    {cell.annualLeaveDays > 0
                                      ? cell.annualLeaveDays
                                      : '-'}
                                  </span>
                                ) : viewMode === 'unpaid_leave' ? (
                                  <span className="text-amber-700">
                                    {cell.unpaidLeaveDays > 0
                                      ? cell.unpaidLeaveDays
                                      : '-'}
                                  </span>
                                ) : (
                                  <span className="text-red-600">
                                    {cell.lateHours > 0 ? `${cell.lateHours}h` : '-'}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Right Summary Totals */}
                        <td className="py-2.5 px-1.5 text-center font-mono font-bold text-[#0D9488] border-r border-slate-200 bg-teal-50/20">
                          {row.totalAnnualUsed}
                        </td>
                        <td className="py-2.5 px-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-200 bg-emerald-50/40">
                          {row.remainingAnnualLeave}
                        </td>
                        <td className="py-2.5 px-1.5 text-center font-mono text-amber-700 border-r border-slate-200">
                          {row.totalUnpaidDays > 0 ? row.totalUnpaidDays : '-'}
                        </td>
                        <td className="py-2.5 px-1.5 text-center font-mono text-red-600">
                          {row.totalLateHours > 0 ? `${row.totalLateHours}h` : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Grand Total Footer */}
              {matrixRows.length > 0 && (
                <tfoot className="bg-[#0F232E] text-white text-xs font-mono font-bold">
                  <tr>
                    <td
                      colSpan={4}
                      className="py-3 px-3 text-right uppercase tracking-wider border-r border-slate-700"
                    >
                      Tổng cộng toàn đơn vị ({matrixRows.length} nhân sự):
                    </td>
                    <td className="py-3 px-1.5 text-center border-r border-slate-700">
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
                          className="py-3 px-1 text-center border-r border-slate-700/60"
                        >
                          {mUsed > 0 ? mUsed : ''}
                        </td>
                      );
                    })}
                    <td className="py-3 px-1.5 text-center border-r border-slate-700">
                      {grandTotalUsed}d
                    </td>
                    <td className="py-3 px-1.5 text-center border-r border-slate-700 text-[#2DD4BF]">
                      {grandTotalRemaining}d
                    </td>
                    <td className="py-3 px-1.5 text-center border-r border-slate-700 text-amber-300">
                      {grandTotalUnpaid}d
                    </td>
                    <td className="py-3 px-1.5 text-center text-red-300">
                      {grandTotalLateHours}h
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

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
            <div className="bg-[#0F232E] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3
                  id="cell-detail-modal-title"
                  className="text-sm sm:text-base font-bold"
                >
                  Chi tiết Chấm công Tháng {selectedCell.month}/{reportYear}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {popupRow.employee.fullName} ({popupRow.employee.employeeCode}) —{' '}
                  {popupRow.employee.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                aria-label="Đóng cửa sổ chi tiết"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-center">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Phép năm
                  </div>
                  <div className="text-base font-extrabold text-[#0D9488] font-mono mt-1">
                    {popupMonthData.annualLeaveDays} ngày
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Không lương
                  </div>
                  <div className="text-base font-extrabold text-amber-700 font-mono mt-1">
                    {popupMonthData.unpaidLeaveDays} ngày
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-center">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Chế độ
                  </div>
                  <div className="text-base font-extrabold text-sky-700 font-mono mt-1">
                    {popupMonthData.regimeLeaveDays} ngày
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Đi muộn
                  </div>
                  <div className="text-base font-extrabold text-red-600 font-mono mt-1">
                    {popupMonthData.lateHours} giờ
                  </div>
                </div>
              </div>

              {/* Records List in this Month */}
              <div>
                <div className="text-xs font-bold text-slate-800 mb-2">
                  Danh sách giấy phép / ghi chép trong tháng ({popupMonthData.records.length}):
                </div>
                {popupMonthData.records.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 italic">
                    Chưa có ghi nhận nghỉ phép hoặc đi muộn nào trong Tháng {selectedCell.month}/{reportYear}.
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-[#0F766E] text-xs font-semibold transition-colors shrink-0 cursor-pointer"
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
                  setSelectedCell(null);
                  onQuickAddForEmployeeMonth(empId, m, reportYear);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <CalendarPlus className="w-4 h-4" />
                <span>+ Thêm ghi chép Tháng {selectedCell.month} cho nhân sự này</span>
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
    </div>
  );
};
