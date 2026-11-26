import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Sparkles,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Employee, LeaveRecord } from '../../../types/hr';
import {
  downloadOpeningLeaveBalanceTemplate,
  OpeningBalanceImportRow,
  parseOpeningLeaveBalanceFile,
} from '../../../utils/exportUtils';
import { getYearMonth, parseComparableDate } from '../../../utils/hrCalculations';

interface OpeningBalanceImportModalProps {
  isOpen: boolean;
  employees: Employee[];
  records?: LeaveRecord[];
  defaultAnnualLeaveQuota?: number;
  currentMonth?: number;
  currentYear?: number;
  onClose: () => void;
  onConfirmImport: (rows: OpeningBalanceImportRow[]) => void;
}

export const OpeningBalanceImportModal: React.FC<
  OpeningBalanceImportModalProps
> = ({
  isOpen,
  employees,
  records = [],
  defaultAnnualLeaveQuota = 12,
  currentMonth = 11,
  currentYear = 2026,
  onClose,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<OpeningBalanceImportRow[]>([]);
  const [unmatchedCodes, setUnmatchedCodes] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const accruedThisYear = Number(
    ((defaultAnnualLeaveQuota / 12) * currentMonth).toFixed(2)
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setErrorMsg(null);

    try {
      const result = await parseOpeningLeaveBalanceFile(file, employees);
      setUnmatchedCodes(result.unmatchedCodes);

      if (result.matchedRows.length === 0) {
        setParsedRows([]);
        setErrorMsg(
          result.unmatchedCodes.length > 0
            ? `Không tìm thấy Mã NV trùng khớp trong hệ thống (Mã trong file: ${result.unmatchedCodes.join(', ')}).`
            : 'Không đọc được dòng dữ liệu hợp lệ. Vui lòng kiểm tra cấu trúc 4 cột của file mẫu (.csv/.xls).'
        );
      } else {
        setParsedRows(result.matchedRows);
      }
    } catch {
      setErrorMsg('Không thể đọc file. Vui lòng sử dụng file mẫu (.csv / .xls).');
    }

    e.target.value = '';
  };

  const handleLoadSamplePreview = () => {
    setErrorMsg(null);
    setUnmatchedCodes([]);
    setSelectedFileName('Mau_Chot_So_Du_Phep_Dau_Ky_2026.csv');
    const sampleRows: OpeningBalanceImportRow[] = employees.map((emp) => ({
      employee: emp,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      carried_over: 2,
      used_leave: 5,
    }));
    setParsedRows(sampleRows);
  };

  const handleRowValueChange = (
    empCode: string,
    field: 'carried_over' | 'used_leave',
    rawVal: string
  ) => {
    const num = Math.max(0, Number(rawVal.replace(',', '.')) || 0);
    setParsedRows((prev) =>
      prev.map((r) =>
        r.employeeCode === empCode
          ? { ...r, [field]: Number(num.toFixed(2)) }
          : r
      )
    );
  };

  const handleSubmit = () => {
    if (parsedRows.length === 0) {
      setErrorMsg('Vui lòng tải lên file Excel/CSV hoặc nạp dữ liệu trước khi xác nhận.');
      return;
    }
    onConfirmImport(parsedRows);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-balance-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal chuẩn màu thương hiệu #14539E */}
        <div className="bg-[#14539E] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-blue-100 shrink-0" />
            <div>
              <h2
                id="opening-balance-modal-title"
                className="text-sm sm:text-base font-bold tracking-tight"
              >
                Chốt số dư phép đầu kỳ (Go-Live Tháng {currentMonth}/{currentYear})
              </h2>
              <p className="text-[11px] text-blue-100">
                Khởi tạo nhanh số dư Tồn năm cũ &amp; Đã nghỉ đến 31/10 qua file Excel — Không cần nhập lại lịch sử đơn nghỉ cũ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
          {/* Khối hướng dẫn & Tải file mẫu */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#14539E]">
                <Info className="w-4 h-4 shrink-0" />
                <span>Cấu trúc File Excel Mẫu (4 cột tối giản):</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                1. <code className="font-mono font-semibold text-slate-800">Mã NV</code> (Khóa chính) &bull;{' '}
                2. <code className="font-mono font-semibold text-slate-800">Họ và tên</code> &bull;{' '}
                3. <code className="font-mono font-semibold text-slate-800">Tồn phép năm cũ (2025)</code> (VD: 2) &bull;{' '}
                4. <code className="font-mono font-semibold text-slate-800">Đã nghỉ (đến 31/10)</code> (VD: 5)
              </p>
              <p className="text-[11px] text-slate-500">
                * Hệ thống ghi đè trực tiếp vào bảng <code className="font-mono">leave_balances</code> ({currentYear}), tuyệt đối không sinh đơn nghỉ phép ảo. Từ tháng 11 trở đi, đơn nghỉ mới sẽ tự động cộng dồn tiếp vào cột Đã nghỉ.
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => downloadOpeningLeaveBalanceTemplate(employees)}
                data-testid="download-opening-balance-template-btn"
                className="h-8 px-3 rounded-lg bg-white hover:bg-slate-50 text-[#14539E] border border-[#14539E]/30 font-semibold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải file mẫu (Template)</span>
              </button>
            </div>
          </div>

          {/* Khu vực chọn file tải lên */}
          <div className="border-2 border-dashed border-slate-200 hover:border-[#14539E]/50 rounded-lg p-4 bg-slate-50/60 transition-colors flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">
                  Tải lên file chốt số dư đầu kỳ (.xlsx, .xls, .csv)
                </p>
                <p className="text-[11px] text-slate-500">
                  {selectedFileName
                    ? `Đã chọn: ${selectedFileName} (${parsedRows.length} nhân sự khớp mã)`
                    : 'Chỉ cần copy/paste từ file theo dõi cũ sang file mẫu rồi tải lên'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx,.txt"
                onChange={handleFileChange}
                data-testid="opening-balance-file-input"
                className="hidden"
              />
              <button
                type="button"
                onClick={handleLoadSamplePreview}
                data-testid="load-sample-opening-balance-btn"
                className="h-8 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Nạp nhanh số liệu mẫu Go-Live (Tồn 2025 = 2, Đã nghỉ đến 31/10 = 5)"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#14539E]" />
                <span>Nạp dữ liệu mẫu (Tồn=2, Đã nghỉ=5)</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid="select-opening-balance-file-btn"
                className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Chọn file từ máy</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {unmatchedCodes.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
              <strong>Lưu ý:</strong> Bỏ qua {unmatchedCodes.length} mã NV không tồn tại trong danh bạ:{' '}
              <code className="font-mono">{unmatchedCodes.join(', ')}</code>
            </div>
          )}

          {/* Bảng Xem trước (Preview) Phương trình Toán học Tháng 11 sau khi Import */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-xs">
                  Xem trước kết quả hoàn thiện phương trình Quỹ phép năm (Tháng {currentMonth}/{currentYear}):
                </h3>
                <span className="text-[11px] text-slate-500">
                  Có thể chỉnh sửa trực tiếp trên bảng trước khi bấm Xác nhận
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table
                    data-testid="opening-balance-preview-table"
                    className="w-full text-left border-collapse text-xs"
                  >
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold z-10">
                      <tr>
                        <th className="px-2 py-1.5 border-r border-slate-100">
                          Mã NV
                        </th>
                        <th className="px-2 py-1.5 border-r border-slate-100">
                          Họ và tên
                        </th>
                        <th className="px-2 py-1.5 border-r border-slate-100 text-right">
                          Tích lũy năm nay (T{currentMonth})
                        </th>
                        <th className="px-2 py-1.5 border-r border-slate-100 text-right bg-blue-50/60 text-[#14539E]">
                          Tồn phép năm cũ (2025)
                        </th>
                        <th className="px-2 py-1.5 border-r border-slate-100 text-right font-bold">
                          Tổng quỹ phép
                        </th>
                        <th className="px-2 py-1.5 border-r border-slate-100 text-right bg-blue-50/60 text-[#14539E]">
                          Đã nghỉ (đến 31/10)
                        </th>
                        <th className="px-2 py-1.5 border-r border-slate-100 text-right">
                          Phát sinh (từ 01/11)
                        </th>
                        <th className="px-2 py-1.5 border-r border-slate-100 text-right font-bold">
                          Tổng đã nghỉ
                        </th>
                        <th className="px-2 py-1.5 text-right font-bold text-[#14539E]">
                          Còn lại
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.map((row) => {
                        const cutoffTs = parseComparableDate(`${currentYear}-10-31`);
                        const postCutoffUsed = records
                          .filter((r) => {
                            if (r.type !== 'annual_leave') return false;
                            const matchEmp =
                              r.employeeId === row.employee.id ||
                              r.employeeId.trim().toUpperCase() ===
                                row.employeeCode.trim().toUpperCase();
                            if (!matchEmp) return false;
                            const { year: rYear, month: rMonth } = getYearMonth(
                              r.startDate
                            );
                            if (rYear !== currentYear) return false;
                            if (rMonth >= 11) return true;
                            const recTs = parseComparableDate(r.startDate);
                            return (
                              recTs !== null &&
                              cutoffTs !== null &&
                              recTs > cutoffTs
                            );
                          })
                          .reduce(
                            (sum, r) =>
                              Number((sum + Number(r.amount || 0)).toFixed(2)),
                            0
                          );
                        const totalFund = Number(
                          (accruedThisYear + row.carried_over).toFixed(2)
                        );
                        const totalUsed = Number(
                          (row.used_leave + postCutoffUsed).toFixed(2)
                        );
                        const remaining = Number(
                          (totalFund - totalUsed).toFixed(2)
                        );
                        return (
                          <tr
                            key={row.employeeCode}
                            className="hover:bg-slate-50/80"
                          >
                            <td className="px-2 py-1.5 border-r border-slate-100 font-mono font-semibold text-slate-700">
                              {row.employeeCode}
                            </td>
                            <td className="px-2 py-1.5 border-r border-slate-100 font-medium text-slate-800">
                              {row.fullName}
                            </td>
                            <td className="px-2 py-1.5 border-r border-slate-100 text-right font-mono text-slate-600">
                              {accruedThisYear}
                            </td>
                            <td className="px-2 py-1 border-r border-slate-100 text-right bg-blue-50/20">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={row.carried_over}
                                onChange={(e) =>
                                  handleRowValueChange(
                                    row.employeeCode,
                                    'carried_over',
                                    e.target.value
                                  )
                                }
                                aria-label={`Tồn phép năm cũ của ${row.employeeCode}`}
                                className="w-16 h-6 px-1.5 text-right font-mono font-semibold text-slate-800 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#14539E]"
                              />
                            </td>
                            <td className="px-2 py-1.5 border-r border-slate-100 text-right font-mono font-bold text-slate-800 bg-slate-50/60">
                              {totalFund}
                            </td>
                            <td className="px-2 py-1 border-r border-slate-100 text-right bg-blue-50/20">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={row.used_leave}
                                onChange={(e) =>
                                  handleRowValueChange(
                                    row.employeeCode,
                                    'used_leave',
                                    e.target.value
                                  )
                                }
                                aria-label={`Đã nghỉ đến 31/10 của ${row.employeeCode}`}
                                className="w-16 h-6 px-1.5 text-right font-mono font-semibold text-slate-800 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#14539E]"
                              />
                            </td>
                            <td className="px-2 py-1.5 border-r border-slate-100 text-right font-mono text-slate-600">
                              {postCutoffUsed > 0 ? `+${postCutoffUsed}` : '-'}
                            </td>
                            <td className="px-2 py-1.5 border-r border-slate-100 text-right font-mono font-bold text-slate-800 bg-slate-50/60">
                              {totalUsed === 0 ? '-' : totalUsed}
                            </td>
                            <td
                              className={`px-2 py-1.5 text-right font-mono font-bold ${
                                remaining >= 0
                                  ? 'text-[#14539E]'
                                  : 'text-red-600'
                              }`}
                            >
                              {remaining === 0 ? '-' : remaining}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Phương trình sau chốt sổ:{' '}
            <code className="font-mono text-slate-700 font-semibold">
              {accruedThisYear} (Tích lũy T{currentMonth}) + 2 (Tồn cũ) = {accruedThisYear + 2}
            </code>{' '}
            &rarr;{' '}
            <code className="font-mono text-[#14539E] font-bold">
              Còn lại = {accruedThisYear + 2} - 5 = {accruedThisYear + 2 - 5}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              data-testid="confirm-opening-balance-import-btn"
              className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ghi đè số dư đầu kỳ ({parsedRows.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
