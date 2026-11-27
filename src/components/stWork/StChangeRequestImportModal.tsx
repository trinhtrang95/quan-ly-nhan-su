import React, { useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  formatNumberVN,
  formatStDateVN,
  ST_STATUS_BADGE_META,
  StChangeRequest,
  StProduct,
} from '../../utils/stWorkLogic';
import {
  buildSampleChangeRequestExcelArrayBuffer,
  parseChangeRequestSpreadsheetBuffer,
  RawImportedChangeRequestRow,
  validateImportedChangeRequestRows,
} from '../../utils/stChangeRequestImportLogic';
import { batchCreateStChangeRequests } from '../../services/stWorkService';

export interface StChangeRequestImportModalProps {
  isOpen: boolean;
  products: StProduct[];
  existingRequests: StChangeRequest[];
  defaultDepartment?: string;
  defaultAssignedGroup?: string;
  onClose: () => void;
  onImported: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const MAX_IMPORT_FILE_BYTES = 15 * 1024 * 1024;

function formatImportError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return 'Không thể nhập dữ liệu từ file Excel. Vui lòng kiểm tra kết nối Supabase.';
}

export const StChangeRequestImportModal: React.FC<
  StChangeRequestImportModalProps
> = ({
  isOpen,
  products,
  existingRequests,
  defaultDepartment = 'Sản xuất',
  defaultAssignedGroup = 'ST',
  onClose,
  onImported,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileSizeKb, setSelectedFileSizeKb] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [rawRows, setRawRows] = useState<RawImportedChangeRequestRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewRows = useMemo(
    () =>
      validateImportedChangeRequestRows(
        rawRows,
        products,
        existingRequests,
        defaultDepartment,
        defaultAssignedGroup
      ),
    [
      rawRows,
      products,
      existingRequests,
      defaultDepartment,
      defaultAssignedGroup,
    ]
  );

  const summary = useMemo(() => {
    let validCount = 0;
    let errorCount = 0;
    for (const r of previewRows) {
      if (r.isValid) validCount += 1;
      else errorCount += 1;
    }
    return { total: previewRows.length, validCount, errorCount };
  }, [previewRows]);

  if (!isOpen) return null;

  const resetFileState = () => {
    setSelectedFileName('');
    setSelectedFileSizeKb(0);
    setParseError('');
    setSubmitError('');
    setRawRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetFileState();
    onClose();
  };

  const handleDownloadSample = () => {
    try {
      const buffer = buildSampleChangeRequestExcelArrayBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, 'Mau_Nhat_Ky_Phieu_Yeu_Cau_ST.xlsx');
      onShowToast?.('Đã tải file Excel mẫu Nhật ký Phiếu yêu cầu ST.');
    } catch (err) {
      onShowToast?.(formatImportError(err));
    }
  };

  const processSelectedFile = async (file: File) => {
    const lowerName = file.name.trim().toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      setParseError(
        'Định dạng file không được hỗ trợ. Vui lòng chọn file .xlsx, .xls hoặc .csv.'
      );
      setRawRows([]);
      setSelectedFileName(file.name);
      setSelectedFileSizeKb(Math.max(1, Math.round(file.size / 1024)));
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setParseError('Dung lượng file vượt quá 15MB.');
      setRawRows([]);
      return;
    }

    setIsParsingFile(true);
    setParseError('');
    setSubmitError('');
    setSelectedFileName(file.name);
    setSelectedFileSizeKb(Math.max(1, Math.round(file.size / 1024)));

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseChangeRequestSpreadsheetBuffer(buffer);
      if (parsed.missingRequiredColumns.length > 0) {
        setRawRows([]);
        setParseError(
          `Không tìm thấy cột bắt buộc: ${parsed.missingRequiredColumns.join(
            ', '
          )}. Vui lòng kiểm tra tiêu đề cột theo file mẫu.`
        );
      } else if (parsed.rows.length === 0) {
        setRawRows([]);
        setParseError('File không có dòng dữ liệu nào bên dưới hàng tiêu đề.');
      } else {
        setRawRows(parsed.rows);
      }
    } catch (err) {
      setRawRows([]);
      setParseError(formatImportError(err));
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleConfirmImport = async () => {
    const validRows = previewRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setSubmitError('Không có dòng hợp lệ để nhập vào hệ thống.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      await batchCreateStChangeRequests(
        validRows.map((r) => ({
          request_code: r.request_code,
          received_at: r.received_at,
          department: r.department,
          assigned_group: r.assigned_group,
          product_code: r.product_code,
          specification: r.specification,
          process_stage: r.process_stage,
          content: r.content,
          status: r.status,
          processed_at: r.processed_at,
          applied_version: r.applied_version,
          notes: r.notes,
        }))
      );
      await onImported();
      onShowToast?.(
        `Đã nhập thành công ${formatNumberVN(
          validRows.length
        )} hạng mục phiếu yêu cầu từ Excel.`
      );
      resetFileState();
      onClose();
    } catch (err) {
      const msg = formatImportError(err);
      setSubmitError(msg);
      onShowToast?.(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nhập phiếu yêu cầu từ file Excel"
      data-testid="st-change-request-import-modal"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                Nhập Nhật ký Phiếu yêu cầu từ Excel
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Khớp cấu trúc file Nhật ký Phiếu yêu cầu thay đổi quy trình, ST
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng cửa sổ nhập Excel"
            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-blue-50/60 border border-blue-200/70 text-xs">
            <div className="text-slate-700">
              Hỗ trợ các cột:{' '}
              <span className="font-semibold text-slate-900">
                NGÀY NHẬN YC · BỘ PHẬN YC · MÃ HÀNG · QUY CÁCH · CÔNG ĐOẠN · NỘI
                DUNG YÊU CẦU THAY ĐỔI · TÌNH TRẠNG · NGÀY ÁP DỤNG ĐƠN GIÁ · PHIÊN
                BẢN · GHI CHÚ
              </span>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="h-8 px-3 rounded-lg bg-white border border-[#14539E]/40 text-[#14539E] hover:bg-blue-50 font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file mẫu (.xlsx)</span>
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void processSelectedFile(file);
            }}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
              isDraggingOver
                ? 'border-[#14539E] bg-blue-50/50'
                : 'border-slate-300 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void processSelectedFile(file);
              }}
              className="hidden"
            />
            {isParsingFile ? (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-600 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
                <span>Đang đọc dữ liệu từ file Excel...</span>
              </div>
            ) : selectedFileName ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>{selectedFileName}</span>
                  <span className="text-slate-400 font-normal">
                    ({selectedFileSizeKb} KB)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                  >
                    Chọn file khác
                  </button>
                  <button
                    type="button"
                    onClick={resetFileState}
                    className="h-8 px-2.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-6 h-6 text-[#14539E] mx-auto" />
                <div className="text-xs text-slate-700 font-medium">
                  Kéo thả file Nhật ký Excel (.xlsx, .xls, .csv) vào đây hoặc
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold cursor-pointer"
                >
                  Chọn file từ máy tính
                </button>
              </div>
            )}
          </div>

          {parseError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-700">
                    Xem trước: {formatNumberVN(summary.total)} dòng
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Hợp lệ: {formatNumberVN(summary.validCount)}
                  </span>
                  {summary.errorCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Lỗi (sẽ bỏ qua): {formatNumberVN(summary.errorCount)}
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-auto max-h-64">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="px-2 py-1.5 w-10 text-center">Dòng</th>
                      <th className="px-2 py-1.5">Mã phiếu</th>
                      <th className="px-2 py-1.5">Ngày nhận</th>
                      <th className="px-2 py-1.5">Bộ phận</th>
                      <th className="px-2 py-1.5">Mã hàng</th>
                      <th className="px-2 py-1.5">Công đoạn</th>
                      <th className="px-2 py-1.5">Nội dung yêu cầu</th>
                      <th className="px-2 py-1.5">Tình trạng</th>
                      <th className="px-2 py-1.5">Kiểm tra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.slice(0, 100).map((row) => {
                      const badge = ST_STATUS_BADGE_META[row.status];
                      return (
                        <tr
                          key={row.rowNumber}
                          className={row.isValid ? '' : 'bg-rose-50/60'}
                        >
                          <td className="px-2 py-1.5 text-center font-mono text-slate-500">
                            {row.rowNumber}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-slate-700 whitespace-nowrap">
                            {row.request_code}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-slate-700 whitespace-nowrap">
                            {formatStDateVN(row.received_at)}
                          </td>
                          <td className="px-2 py-1.5 font-medium text-slate-800 whitespace-nowrap">
                            {row.department}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-[#14539E] whitespace-nowrap">
                            {row.product_code || '—'}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">
                            {row.process_stage || '—'}
                          </td>
                          <td className="px-2 py-1.5 text-slate-800 max-w-[240px] truncate">
                            {row.content || '—'}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded border text-[11px] font-semibold ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-[11px]">
                            {row.isValid ? (
                              <span className="text-emerald-700 font-semibold">
                                Hợp lệ
                              </span>
                            ) : (
                              <span className="text-rose-600 font-medium">
                                {row.errors.join(', ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting || summary.validCount === 0}
            onClick={() => void handleConfirmImport()}
            className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>
              Nhập {formatNumberVN(summary.validCount)} hạng mục hợp lệ
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
