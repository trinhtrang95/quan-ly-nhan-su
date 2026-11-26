import React, { useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  formatNumberVN,
  StCustomer,
  StLine,
  StProduct,
} from '../../utils/stWorkLogic';
import {
  buildSampleProductsExcelArrayBuffer,
  parseProductsSpreadsheetBuffer,
  RawImportedProductRow,
  ST_IMPORT_SAMPLE_HEADERS,
  StImportDuplicateMode,
  summarizeImportPreview,
  validateImportedProductRows,
} from '../../utils/stProductImportLogic';
import {
  batchImportStProducts,
  StProductBatchImportItem,
  StProductBatchUpdateItem,
} from '../../services/stWorkService';

export interface StProductImportModalProps {
  isOpen: boolean;
  lines: StLine[];
  customers: StCustomer[];
  existingProducts: StProduct[];
  onClose: () => void;
  onImported: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

const MAX_IMPORT_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export const StProductImportModal: React.FC<StProductImportModalProps> = ({
  isOpen,
  lines,
  customers,
  existingProducts,
  onClose,
  onImported,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSizeKb, setSelectedFileSizeKb] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string>('');
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawImportedProductRow[]>([]);
  const [duplicateMode, setDuplicateMode] =
    useState<StImportDuplicateMode>('skip');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const previewRows = useMemo(
    () =>
      validateImportedProductRows(rawRows, {
        existingProducts,
        lines,
        customers,
      }),
    [rawRows, existingProducts, lines, customers]
  );

  const summary = useMemo(
    () => summarizeImportPreview(previewRows, duplicateMode),
    [previewRows, duplicateMode]
  );

  if (!isOpen) return null;

  const resetFileState = () => {
    setSelectedFileName('');
    setSelectedFileSizeKb(0);
    setParseError('');
    setMissingColumns([]);
    setRawRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetFileState();
    setDuplicateMode('skip');
    onClose();
  };

  const handleDownloadSample = () => {
    try {
      const arrayBuffer = buildSampleProductsExcelArrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, 'Mau_Nhap_Danh_Muc_San_Pham_ST.xlsx');
      onShowToast?.('Đã tải file Excel mẫu (6 cột chuẩn kèm 2 dòng ví dụ).');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    }
  };

  const processSelectedFile = async (file: File) => {
    const lowerName = file.name.trim().toLowerCase();
    const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    );
    if (!hasAllowedExt) {
      setParseError(
        'Định dạng file không được hỗ trợ. Vui lòng chọn file .xlsx, .xls hoặc .csv.'
      );
      setRawRows([]);
      setMissingColumns([]);
      setSelectedFileName(file.name);
      setSelectedFileSizeKb(Math.max(1, Math.round(file.size / 1024)));
      return;
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setParseError('Dung lượng file vượt quá 15MB. Vui lòng chia nhỏ file.');
      setRawRows([]);
      return;
    }

    setIsParsingFile(true);
    setParseError('');
    setMissingColumns([]);
    setSelectedFileName(file.name);
    setSelectedFileSizeKb(Math.max(1, Math.round(file.size / 1024)));

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseProductsSpreadsheetBuffer(buffer, file.name);
      setMissingColumns(parsed.missingRequiredColumns);

      if (parsed.missingRequiredColumns.length > 0) {
        setRawRows([]);
        setParseError(
          `Không tìm thấy cột bắt buộc: ${parsed.missingRequiredColumns.join(
            ', '
          )}. Vui lòng kiểm tra lại dòng tiêu đề theo file mẫu.`
        );
      } else if (parsed.rows.length === 0) {
        setRawRows([]);
        setParseError(
          'File không có dòng dữ liệu nào bên dưới hàng tiêu đề.'
        );
      } else {
        setRawRows(parsed.rows);
      }
    } catch (err) {
      setRawRows([]);
      setParseError(
        `Không thể đọc file bảng tính: ${getFriendlyErrorMessage(err)}`
      );
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleConfirmImport = async () => {
    if (summary.actionableCount === 0 || isSubmitting) return;

    const rowsToInsert: StProductBatchImportItem[] = [];
    const rowsToUpdate: StProductBatchUpdateItem[] = [];

    for (const row of previewRows) {
      if (row.status === 'valid') {
        rowsToInsert.push({
          line_name: row.line_name,
          customer_short_name: row.customer_short_name,
          product_code: row.product_code,
          product_name: row.product_name,
          specification: row.specification,
          notes: row.notes,
        });
      } else if (
        row.status === 'duplicate' &&
        duplicateMode === 'overwrite' &&
        row.existingProduct
      ) {
        rowsToUpdate.push({
          existing_id: row.existingProduct.id,
          existing_image_url: row.existingProduct.image_url,
          existing_created_at: row.existingProduct.created_at,
          line_name: row.line_name,
          customer_short_name: row.customer_short_name,
          product_code: row.existingProduct.product_code,
          product_name: row.product_name,
          specification: row.specification,
          notes: row.notes,
        });
      }
    }

    if (rowsToInsert.length === 0 && rowsToUpdate.length === 0) return;

    setIsSubmitting(true);
    try {
      const result = await batchImportStProducts({
        rowsToInsert,
        rowsToUpdate,
      });
      await onImported();
      resetFileState();
      setDuplicateMode('skip');
      onClose();
      onShowToast?.(
        `Đã thêm mới ${formatNumberVN(
          result.insertedCount
        )} mã hàng, cập nhật ${formatNumberVN(result.updatedCount)} mã hàng.`
      );
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nhập danh mục sản phẩm từ file"
      onClick={handleClose}
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        data-testid="st-product-import-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">
                Nhập danh mục sản phẩm từ file
              </h3>
              <p className="text-[11px] text-slate-500">
                Hỗ trợ định dạng .xlsx, .xls, .csv — tự động kiểm tra trùng mã
                hàng trước khi lưu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng cửa sổ nhập file"
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1 min-h-0">
          {/* Phần 1: Tải file Excel mẫu */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-slate-800">
                1. File Excel mẫu chuẩn (6 cột)
              </div>
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                <span>Tiêu đề tự nhận diện:</span>
                {ST_IMPORT_SAMPLE_HEADERS.map((col) => (
                  <span
                    key={col}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-medium text-slate-700"
                  >
                    {col}
                    {(col === 'Mã hàng' || col === 'Tên hàng') && (
                      <span className="text-rose-500 ml-0.5">*</span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              data-testid="st-import-download-sample-btn"
              onClick={handleDownloadSample}
              className="h-8 px-3.5 rounded-lg border border-[#14539E]/30 bg-white hover:bg-[#14539E] text-[#14539E] hover:text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file Excel mẫu (.xlsx)</span>
            </button>
          </div>

          {/* Phần 2: Khu vực chọn / kéo thả file */}
          <div>
            <div className="font-bold text-slate-800 mb-1.5">
              2. Chọn hoặc kéo thả file (.xlsx, .xls, .csv)
            </div>
            <input
              ref={fileInputRef}
              type="file"
              data-testid="st-import-file-input"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void processSelectedFile(file);
              }}
            />

            <div
              role="button"
              tabIndex={0}
              data-testid="st-import-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
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
              className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
                isDraggingOver
                  ? 'border-[#14539E] bg-blue-50/70'
                  : selectedFileName && !parseError
                  ? 'border-emerald-300 bg-emerald-50/30 hover:border-emerald-400'
                  : 'border-slate-300 bg-slate-50/50 hover:border-[#14539E] hover:bg-blue-50/30'
              }`}
            >
              {isParsingFile ? (
                <div className="flex items-center justify-center gap-2 text-slate-600 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
                  <span>Đang đọc dữ liệu từ sheet đầu tiên...</span>
                </div>
              ) : selectedFileName ? (
                <div className="flex flex-wrap items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {selectedFileName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatNumberVN(selectedFileSizeKb)} KB · Đọc{' '}
                        {formatNumberVN(rawRows.length)} dòng dữ liệu
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700">
                      Chọn file khác
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetFileState();
                      }}
                      title="Xóa file đang chọn"
                      aria-label="Xóa file đang chọn"
                      className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-300 inline-flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 py-1">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-[#14539E] flex items-center justify-center mx-auto shadow-2xs">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="font-semibold text-slate-800">
                    Kéo thả file Excel / CSV vào đây hoặc{' '}
                    <span className="text-[#14539E] underline">
                      bấm để chọn file
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Đọc dữ liệu từ sheet đầu tiên (.xlsx, .xls, .csv) · Không
                    phân biệt chữ hoa/thường hay dấu cách thừa ở tiêu đề
                  </div>
                </div>
              )}
            </div>

            {parseError && (
              <div
                data-testid="st-import-parse-error"
                className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">{parseError}</div>
                  {missingColumns.length > 0 && (
                    <div className="text-[11px] text-rose-600 mt-0.5">
                      Cột thiếu: {missingColumns.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Phần 3: Bảng xem trước & Kiểm tra dữ liệu */}
          {previewRows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-800">
                  3. Bảng xem trước & Kiểm tra dữ liệu
                </div>

                {/* Summary Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold tabular-nums">
                    Tổng: {formatNumberVN(summary.total)}
                  </span>
                  <span
                    data-testid="st-import-count-valid"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold tabular-nums"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Hợp lệ: {formatNumberVN(summary.validCount)}
                  </span>
                  <span
                    data-testid="st-import-count-duplicate"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold tabular-nums"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Trùng mã hàng: {formatNumberVN(summary.duplicateCount)}
                  </span>
                  <span
                    data-testid="st-import-count-error"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold tabular-nums"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Lỗi dữ liệu: {formatNumberVN(summary.errorCount)}
                  </span>
                </div>
              </div>

              {/* Duplicate Handling Radio Toggle */}
              {summary.duplicateCount > 0 && (
                <div
                  data-testid="st-import-duplicate-options"
                  className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="text-amber-900 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Phát hiện {formatNumberVN(summary.duplicateCount)} mã hàng
                      đã tồn tại trong danh mục. Xử lý mã trùng:
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                      <input
                        type="radio"
                        name="stImportDuplicateMode"
                        value="skip"
                        data-testid="st-import-dup-skip"
                        checked={duplicateMode === 'skip'}
                        onChange={() => setDuplicateMode('skip')}
                        className="accent-[#14539E] cursor-pointer"
                      />
                      <span>Bỏ qua mã trùng</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                      <input
                        type="radio"
                        name="stImportDuplicateMode"
                        value="overwrite"
                        data-testid="st-import-dup-overwrite"
                        checked={duplicateMode === 'overwrite'}
                        onChange={() => setDuplicateMode('overwrite')}
                        className="accent-[#14539E] cursor-pointer"
                      />
                      <span>Cập nhật thông tin mới đè lên mã cũ</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-auto max-h-[300px]">
                <table
                  data-testid="st-import-preview-table"
                  className="w-full min-w-[780px] border-collapse text-left"
                >
                  <thead className="sticky top-0 z-10 bg-slate-100 text-[10.5px] font-bold text-slate-600 uppercase tracking-tight shadow-[0_1px_0_0_rgba(203,213,225,1)]">
                    <tr>
                      <th className="px-2 py-2 w-12 text-center border-r border-b border-slate-200">
                        DÒNG
                      </th>
                      <th className="px-2.5 py-2 w-20 border-r border-b border-slate-200">
                        LINE
                      </th>
                      <th className="px-2.5 py-2 w-28 border-r border-b border-slate-200">
                        KHÁCH HÀNG
                      </th>
                      <th className="px-2.5 py-2 w-32 border-r border-b border-slate-200">
                        MÃ HÀNG
                      </th>
                      <th className="px-2.5 py-2 min-w-[150px] border-r border-b border-slate-200">
                        TÊN HÀNG
                      </th>
                      <th className="px-2.5 py-2 w-28 border-r border-b border-slate-200">
                        QUY CÁCH
                      </th>
                      <th className="px-2.5 py-2 w-32 border-r border-b border-slate-200">
                        GHI CHÚ
                      </th>
                      <th className="px-2.5 py-2 min-w-[190px] border-b border-slate-200">
                        TRẠNG THÁI KIỂM TRA
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {previewRows.map((row) => {
                      const rowBg =
                        row.status === 'valid'
                          ? 'bg-emerald-50/35'
                          : row.status === 'duplicate'
                          ? 'bg-amber-50/45'
                          : 'bg-rose-50/55';

                      return (
                        <tr
                          key={`${row.rowNumber}-${row.product_code}`}
                          className={rowBg}
                        >
                          <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-500 border-r border-slate-200/70 tabular-nums">
                            {row.rowNumber}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200/70 font-medium text-slate-700 whitespace-nowrap">
                            {row.line_name || '—'}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200/70 font-medium text-slate-700 whitespace-nowrap">
                            {row.customer_short_name || '—'}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200/70 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {row.product_code || (
                              <span className="text-rose-500 italic font-sans font-normal">
                                (Trống)
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200/70 text-slate-800">
                            {row.product_name || (
                              <span className="text-rose-500 italic">
                                (Trống)
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200/70 text-slate-600">
                            {row.specification || '—'}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200/70 text-slate-600">
                            {row.notes || '—'}
                          </td>
                          <td className="px-2.5 py-2">
                            {row.status === 'valid' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Hợp lệ (Thêm mới)</span>
                              </span>
                            ) : row.status === 'duplicate' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/80 border border-amber-300 text-amber-800 text-[11px] font-semibold">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>
                                  Trùng mã hàng ·{' '}
                                  {duplicateMode === 'overwrite'
                                    ? 'Sẽ cập nhật đè'
                                    : 'Sẽ bỏ qua'}
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100/80 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span>{row.errorReason || 'Lỗi dữ liệu'}</span>
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

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-600">
            {previewRows.length > 0 ? (
              <span>
                Sẽ thêm mới{' '}
                <strong className="text-emerald-700">
                  {formatNumberVN(summary.willInsertCount)}
                </strong>{' '}
                mã · Cập nhật đè{' '}
                <strong className="text-amber-700">
                  {formatNumberVN(summary.willUpdateCount)}
                </strong>{' '}
                mã
              </span>
            ) : (
              <span>Vui lòng chọn file Excel/CSV để kiểm tra dữ liệu.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="h-8 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              data-testid="st-import-confirm-btn"
              disabled={isSubmitting || summary.actionableCount === 0}
              onClick={() => void handleConfirmImport()}
              className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>
                Xác nhận nhập
                {summary.actionableCount > 0
                  ? ` (${formatNumberVN(summary.actionableCount)})`
                  : ''}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
