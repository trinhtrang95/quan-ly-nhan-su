import React, { useState } from 'react';
import {
  CalendarPlus,
  Search,
  FileSpreadsheet,
  FileImage,
  Trash2,
  Pencil,
  RotateCcw,
  Eye,
} from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
  LeaveRecord,
  LeaveRecordType,
} from '../types/hr';
import {
  filterLeaveRecords,
  formatDateVN,
  LEAVE_TYPE_META,
} from '../utils/hrCalculations';

interface LeaveLateLogViewProps {
  records: LeaveRecord[];
  employees: Employee[];
  groups: DepartmentGroup[];
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
  onOpenAddRecord,
  onOpenEditRecord,
  onDeleteRecord,
  onInspectAttachment,
  onExportExcel,
}) => {
  const [monthFilter, setMonthFilter] = useState<number>(0); // 0 = All months
  const [yearFilter, setYearFilter] = useState<number>(2026);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

  const filteredRecords = filterLeaveRecords(
    records,
    employees,
    monthFilter,
    yearFilter,
    typeFilter,
    departmentFilter,
    searchQuery
  );

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

  return (
    <div className="space-y-4">
      {/* Toolbar & Filters Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base md:text-lg font-bold text-slate-900">
                Ghi chép Nghỉ phép &amp; Đi muộn
              </h2>
              <span
                data-testid="leave-log-counter"
                className="text-xs font-mono tabular-nums font-bold text-[#0D9488] bg-teal-50 px-2.5 py-0.5 rounded-md"
              >
                {filteredRecords.length} bản ghi
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi ngày nghỉ phép năm, nghỉ không lương, nghỉ chế độ BHXH và giờ đi muộn kèm ảnh chụp giấy phép
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onExportExcel(filteredRecords)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel nhật ký</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddRecord}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>+ Ghi nhận Nghỉ / Đi muộn</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo Họ tên, Mã NV hoặc Lý do nghỉ..."
              aria-label="Tìm kiếm nhật ký nghỉ phép"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          {/* Month Filter */}
          <div className="lg:col-span-2">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(Number(e.target.value))}
              aria-label="Lọc theo Tháng"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-700 font-medium cursor-pointer"
            >
              <option value={0}>Tất cả 12 tháng</option>
              {Array.from({ length: 12 }, (_, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  Tháng {idx + 1} / {yearFilter}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="lg:col-span-2">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(Number(e.target.value))}
              aria-label="Lọc theo Năm"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-700 font-medium cursor-pointer"
            >
              <option value={2026}>Năm 2026</option>
              <option value={2025}>Năm 2025</option>
              <option value={2027}>Năm 2027</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="lg:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Lọc theo Loại ghi chép"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả loại ghi chép</option>
              <option value="annual_leave">Nghỉ phép năm</option>
              <option value="unpaid_leave">Nghỉ không lương</option>
              <option value="regime_leave">Nghỉ chế độ (BHXH/Hiếu hỷ)</option>
              <option value="late_early">Đi muộn / Về sớm</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="lg:col-span-2 flex items-center gap-2">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Lọc nhật ký theo Nhóm bộ phận"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả Nhóm</option>
              {groups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>

            {(monthFilter !== 0 ||
              typeFilter !== 'ALL' ||
              departmentFilter !== 'ALL' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setMonthFilter(0);
                  setTypeFilter('ALL');
                  setDepartmentFilter('ALL');
                  setSearchQuery('');
                }}
                aria-label="Đặt lại bộ lọc nhật ký"
                title="Đặt lại bộ lọc"
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Summary Strip */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-600">
          <span>
            Tổng phép năm đã ghi:{' '}
            <strong className="font-mono tabular-nums text-[#0F766E]">
              {sumAnnual} ngày
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Tổng nghỉ không lương:{' '}
            <strong className="font-mono tabular-nums text-amber-700">
              {sumUnpaid} ngày
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Tổng nghỉ chế độ:{' '}
            <strong className="font-mono tabular-nums text-sky-700">
              {sumRegime} ngày
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Tổng giờ đi muộn / về sớm:{' '}
            <strong className="font-mono tabular-nums text-red-600">
              {sumLateHours} giờ
            </strong>
          </span>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-[#0F232E] text-white text-xs font-semibold tracking-wider uppercase">
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3">Mã NV</th>
                <th className="py-3 px-3 sticky left-0 z-10 bg-[#0F232E] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                  Họ tên nhân sự
                </th>
                <th className="py-3 px-3">Nhóm / Bộ phận</th>
                <th className="py-3 px-3">Loại ghi chép</th>
                <th className="py-3 px-3">Thời gian áp dụng</th>
                <th className="py-3 px-3 text-right">Số lượng</th>
                <th className="py-3 px-3">Lý do / Ghi chú chi tiết</th>
                <th className="py-3 px-3 text-center">Ảnh giấy phép</th>
                <th className="py-3 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    Chưa có bản ghi nghỉ phép hoặc đi muộn nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const emp = empMap.get(rec.employeeId);
                  const meta = LEAVE_TYPE_META[rec.type as LeaveRecordType];
                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/90 transition-colors group"
                    >
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums font-bold text-[#0D9488] whitespace-nowrap">
                        {emp?.employeeCode || 'N/A'}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
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
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {emp?.department || '-'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div
                          className="font-bold"
                          style={{ color: meta.textColor }}
                        >
                          {meta.shortLabel}
                        </div>
                        {rec.regimeSubtype && (
                          <div className="text-[11px] text-slate-500">
                            {rec.regimeSubtype}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {rec.startDate === rec.endDate
                          ? formatDateVN(rec.startDate)
                          : `${formatDateVN(rec.startDate)} → ${formatDateVN(rec.endDate)}`}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        <span style={{ color: meta.textColor }}>
                          {rec.amount} {meta.unit}
                        </span>
                      </td>
                      <td
                        className="py-3 px-3 text-slate-600 max-w-[260px]"
                        title={rec.reason}
                      >
                        <div className="line-clamp-2">{rec.reason}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
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
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50/70 hover:bg-teal-100/80 text-[#0F766E] transition-colors cursor-pointer"
                          >
                            <img
                              src={rec.attachmentUrl}
                              alt="Thumbnail giấy phép"
                              referrerPolicy="no-referrer"
                              className="w-6 h-7 object-cover rounded-xs border border-slate-300 bg-white shrink-0"
                            />
                            <span className="text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              Xem đơn
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            Chưa đính kèm
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
