import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  X,
  Eye,
  CalendarPlus,
  Info,
} from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
  EmployeeAnnualMatrixRow,
  LeaveRecord,
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
    <div className="space-y-4">
      {/* Top Control Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-900">
              Báo cáo &amp; Thống kê Tồn phép Năm ({reportYear})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bấm vào bất kỳ ô tháng nào của nhân viên để xem chi tiết ngày nghỉ và ảnh chụp giấy phép trong tháng đó
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                onExportMatrixExcel(matrixRows, reportYear, viewMode)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onExportMatrixPDF(matrixRows, reportYear, viewMode)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-600" />
              <span>Xuất PDF (Khổ ngang A4)</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="matrix-year-select"
              className="block text-[11px] font-semibold text-slate-500 mb-1"
            >
              Năm báo cáo
            </label>
            <select
              id="matrix-year-select"
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] cursor-pointer"
            >
              <option value={2026}>Năm 2026</option>
              <option value={2025}>Năm 2025</option>
              <option value={2027}>Năm 2027</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="matrix-dept-select"
              className="block text-[11px] font-semibold text-slate-500 mb-1"
            >
              Nhóm / Bộ phận
            </label>
            <select
              id="matrix-dept-select"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] cursor-pointer"
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
              className="block text-[11px] font-semibold text-slate-500 mb-1"
            >
              Chế độ xem ma trận
            </label>
            <select
              id="matrix-mode-select"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as MatrixViewMode)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-800 cursor-pointer"
            >
              <option value="all">Tổng hợp tất cả (Phép + Không lương + Đi muộn)</option>
              <option value="annual_leave">Thống kê Phép năm</option>
              <option value="unpaid_leave">Thống kê Nghỉ không lương</option>
              <option value="late_early">Thống kê Giờ đi muộn</option>
            </select>
          </div>
        </div>

        {/* Legend Strip */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <strong className="font-mono text-[#0D9488]">Số lớn:</strong> Ngày nghỉ phép năm
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <strong className="font-mono text-amber-600">KL:</strong> Nghỉ không lương (ngày)
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <strong className="font-mono text-sky-600">CĐ:</strong> Nghỉ chế độ BHXH
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <strong className="font-mono text-red-600">M:</strong> Giờ đi muộn / về sớm
            </span>
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Click vào ô tháng bất kỳ để mở Popup chi tiết &amp; chứng từ</span>
          </div>
        </div>
      </div>

      {/* 12-Month Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1060px]">
            <thead>
              <tr className="bg-[#0F232E] text-white text-[11px] font-semibold tracking-wider uppercase">
                <th className="py-3 px-1.5 w-9 text-center border-r border-slate-700/60">
                  STT
                </th>
                <th className="py-3 px-2 w-16 border-r border-slate-700/60">
                  Mã NV
                </th>
                <th className="py-3 px-2.5 min-w-[140px] sticky left-0 z-20 bg-[#0F232E] border-r border-slate-700/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.35)]">
                  Họ tên
                </th>
                <th className="py-3 px-2 min-w-[130px] border-r border-slate-700/60">
                  Nhóm / Bộ phận
                </th>
                <th className="py-3 px-1.5 w-16 text-center border-r border-slate-700/60 bg-[#163C45]">
                  Tổng phép
                </th>

                {/* 12 Month Columns */}
                {Array.from({ length: 12 }, (_, idx) => (
                  <th
                    key={idx + 1}
                    className="py-3 px-1 w-11 text-center border-r border-slate-700/50 font-mono"
                  >
                    T{idx + 1}
                  </th>
                ))}

                {/* Right Summary Columns */}
                <th className="py-3 px-1.5 w-16 text-center border-r border-slate-700/60 bg-[#163C45] text-[#2DD4BF]">
                  Đã nghỉ
                </th>
                <th className="py-3 px-1.5 w-18 text-center border-r border-slate-700/60 bg-[#163C45] text-amber-300">
                  Tồn phép
                </th>
                <th className="py-3 px-1.5 w-18 text-center border-r border-slate-700/60">
                  K.Lương
                </th>
                <th className="py-3 px-1.5 w-20 text-center">
                  Đi muộn
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/80 text-xs">
              {matrixRows.map((row, idx) => {
                const isExhausted = row.remainingAnnualLeave <= 0;
                const isLowLeave =
                  row.remainingAnnualLeave > 0 && row.remainingAnnualLeave <= 2;

                return (
                  <tr
                    key={row.employee.id}
                    className="hover:bg-slate-50/90 transition-colors group"
                  >
                    <td className="py-2.5 px-2.5 text-center font-mono tabular-nums text-slate-500 border-r border-slate-100">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-2.5 font-mono tabular-nums font-bold text-[#0D9488] border-r border-slate-100 whitespace-nowrap">
                      {row.employee.employeeCode}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      {row.employee.fullName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100 truncate max-w-[160px]">
                      {row.employee.department}
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-mono tabular-nums font-bold text-slate-800 bg-slate-50/70 border-r border-slate-200/70">
                      {row.employee.standardAnnualLeave}
                    </td>

                    {/* 12 Month Interactive Cells */}
                    {Array.from({ length: 12 }, (_, mIdx) => {
                      const m = mIdx + 1;
                      const cell = row.months[m];
                      const hasAnyRecord = cell.records.length > 0;

                      let primaryText = '';
                      const subNotes: { text: string; colorClass: string }[] = [];

                      if (viewMode === 'annual_leave') {
                        if (cell.annualLeaveDays > 0) {
                          primaryText = `${cell.annualLeaveDays}`;
                        }
                      } else if (viewMode === 'unpaid_leave') {
                        if (cell.unpaidLeaveDays > 0) {
                          primaryText = `${cell.unpaidLeaveDays}`;
                        }
                      } else if (viewMode === 'late_early') {
                        if (cell.lateHours > 0) {
                          primaryText = `${cell.lateHours}h`;
                        }
                      } else {
                        // 'all' mode
                        if (cell.annualLeaveDays > 0) {
                          primaryText = `${cell.annualLeaveDays}`;
                        }
                        if (cell.unpaidLeaveDays > 0) {
                          subNotes.push({
                            text: `${cell.unpaidLeaveDays}KL`,
                            colorClass: 'text-amber-600',
                          });
                        }
                        if (cell.regimeLeaveDays > 0) {
                          subNotes.push({
                            text: `${cell.regimeLeaveDays}CĐ`,
                            colorClass: 'text-sky-600',
                          });
                        }
                        if (cell.lateHours > 0) {
                          subNotes.push({
                            text: `${cell.lateHours}hM`,
                            colorClass: 'text-red-500',
                          });
                        }
                      }

                      return (
                        <td
                          key={m}
                          className="p-0 border-r border-slate-100 align-middle text-center"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCell({
                                employee: row.employee,
                                month: m,
                              })
                            }
                            aria-label={`Chi tiết Tháng ${m} của ${row.employee.fullName}`}
                            className={`w-full min-h-[46px] py-1.5 px-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                              hasAnyRecord
                                ? 'bg-teal-50/35 hover:bg-teal-100/70'
                                : 'hover:bg-slate-100/70'
                            }`}
                          >
                            {primaryText ? (
                              <span className="font-mono tabular-nums font-bold text-slate-900 text-xs leading-tight">
                                {primaryText}
                              </span>
                            ) : (
                              <span className="font-mono text-slate-300 text-xs leading-tight">
                                -
                              </span>
                            )}

                            {subNotes.length > 0 && (
                              <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5">
                                {subNotes.map((sn, i) => (
                                  <span
                                    key={i}
                                    className={`text-[10px] font-mono tabular-nums font-semibold leading-none ${sn.colorClass}`}
                                  >
                                    {sn.text}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Right Summary Columns */}
                    <td
                      data-testid={`matrix-used-${row.employee.employeeCode}`}
                      className="py-2.5 px-2.5 text-center font-mono tabular-nums font-bold text-[#0F766E] bg-teal-50/40 border-r border-slate-200/70"
                    >
                      {row.totalAnnualUsed}
                    </td>

                    <td
                      data-testid={`matrix-remain-${row.employee.employeeCode}`}
                      className={`py-2.5 px-2.5 text-center font-mono tabular-nums font-extrabold border-r border-slate-200/70 ${
                        isExhausted
                          ? 'bg-[#FEF2F2] text-[#EF4444]'
                          : isLowLeave
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50/50 text-emerald-700'
                      }`}
                    >
                      {row.remainingAnnualLeave}
                      {isExhausted && (
                        <div className="text-[10px] font-sans font-semibold text-[#EF4444]">
                          Hết phép
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-2.5 text-center font-mono tabular-nums font-semibold text-amber-700 bg-amber-50/30 border-r border-slate-200/70">
                      {row.totalUnpaidDays > 0 ? `${row.totalUnpaidDays} ngày` : '0'}
                    </td>

                    <td className="py-2.5 px-2.5 text-center font-mono tabular-nums font-semibold text-red-600 bg-rose-50/30">
                      {row.totalLateHours > 0
                        ? `${row.totalLateHours}h (${row.totalLateCount})`
                        : '0h'}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer Summary */}
            <tfoot>
              <tr className="bg-slate-100 font-bold text-xs text-slate-900 border-t-2 border-slate-300">
                <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider">
                  Tổng cộng toàn đơn vị ({matrixRows.length} nhân sự):
                </td>
                <td className="py-3 px-2.5 text-center font-mono tabular-nums">
                  {grandTotalStandard}
                </td>
                {Array.from({ length: 12 }, (_, mIdx) => {
                  const m = mIdx + 1;
                  const mSum = matrixRows.reduce(
                    (acc, r) => Number((acc + r.months[m].annualLeaveDays).toFixed(2)),
                    0
                  );
                  return (
                    <td
                      key={m}
                      className="py-3 px-1.5 text-center font-mono tabular-nums text-slate-700"
                    >
                      {mSum > 0 ? mSum : '-'}
                    </td>
                  );
                })}
                <td className="py-3 px-2.5 text-center font-mono tabular-nums text-[#0F766E]">
                  {grandTotalUsed}
                </td>
                <td className="py-3 px-2.5 text-center font-mono tabular-nums text-emerald-700">
                  {grandTotalRemaining}
                </td>
                <td className="py-3 px-2.5 text-center font-mono tabular-nums text-amber-700">
                  {grandTotalUnpaid} ngày
                </td>
                <td className="py-3 px-2.5 text-center font-mono tabular-nums text-red-600">
                  {grandTotalLateHours} giờ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Month Cell Detail Popup Modal */}
      {selectedCell && popupRow && popupMonthData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="month-popup-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-xl overflow-hidden">
            <div className="bg-[#0F232E] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={selectedCell.employee.avatarUrl}
                  alt={selectedCell.employee.fullName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border border-teal-400"
                />
                <div>
                  <h3 id="month-popup-title" className="text-sm font-bold">
                    Chi tiết Tháng {selectedCell.month}/{reportYear} —{' '}
                    {selectedCell.employee.fullName}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Mã NV: {selectedCell.employee.employeeCode} ·{' '}
                    {selectedCell.employee.department}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                aria-label="Đóng chi tiết tháng"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Month Summary Strip */}
              <div className="grid grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 rounded-lg bg-teal-50/70 border border-teal-200/60">
                  <div className="text-[11px] text-slate-500">Nghỉ phép năm</div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-[#0F766E] mt-0.5">
                    {popupMonthData.annualLeaveDays} ngày
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/60">
                  <div className="text-[11px] text-slate-500">Không lương</div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-amber-700 mt-0.5">
                    {popupMonthData.unpaidLeaveDays} ngày
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-sky-50/70 border border-sky-200/60">
                  <div className="text-[11px] text-slate-500">Nghỉ chế độ</div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-sky-700 mt-0.5">
                    {popupMonthData.regimeLeaveDays} ngày
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200/60">
                  <div className="text-[11px] text-slate-500">Giờ đi muộn</div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-red-600 mt-0.5">
                    {popupMonthData.lateHours} giờ
                  </div>
                </div>
              </div>

              {/* Records list in this month */}
              {popupMonthData.records.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs text-slate-500">
                    Nhân sự không có phát sinh nghỉ phép hoặc đi muộn trong Tháng{' '}
                    {selectedCell.month}/{reportYear}.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-800">
                    Danh sách đợt nghỉ &amp; ảnh chụp giấy phép ({popupMonthData.records.length})
                  </div>
                  {popupMonthData.records.map((rec) => {
                    const meta = LEAVE_TYPE_META[rec.type];
                    return (
                      <div
                        key={rec.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-bold"
                              style={{ color: meta.textColor }}
                            >
                              {meta.label}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="text-xs font-mono font-bold text-slate-900">
                              {rec.amount} {meta.unit}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-slate-600">
                            Thời gian:{' '}
                            {rec.startDate === rec.endDate
                              ? formatDateVN(rec.startDate)
                              : `${formatDateVN(rec.startDate)} → ${formatDateVN(rec.endDate)}`}
                          </div>
                          <div className="text-xs text-slate-700">{rec.reason}</div>
                        </div>

                        {rec.attachmentUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              onInspectAttachment(
                                rec.attachmentUrl!,
                                rec.attachmentTitle ||
                                  `Giấy phép - ${selectedCell.employee.fullName}`
                              )
                            }
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-teal-200 hover:bg-teal-50 text-[#0F766E] text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                          >
                            <img
                              src={rec.attachmentUrl}
                              alt="Ảnh giấy phép"
                              referrerPolicy="no-referrer"
                              className="w-7 h-8 object-cover rounded-xs border border-slate-300"
                            />
                            <span className="inline-flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              Xem giấy phép
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer with Quick Add button for this employee/month */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const empId = selectedCell.employee.id;
                    const m = selectedCell.month;
                    setSelectedCell(null);
                    onQuickAddForEmployeeMonth(empId, m, reportYear);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>
                    + Thêm ghi chép Tháng {selectedCell.month} cho{' '}
                    {selectedCell.employee.fullName}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
