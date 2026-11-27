import React, { useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import {
  AlertCircle,
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
  formatStDateVN,
  ST_PRODUCTION_STAGES,
  StProductWithStatus,
} from '../../utils/stWorkLogic';
import {
  buildSampleProgressExcelArrayBuffer,
  parseProgressSpreadsheetBuffer,
  RawImportedProgressRow,
  ST_PROGRESS_IMPORT_HEADERS,
  validateImportedProgressRows,
} from '../../utils/stProgressImportLogic';
import {
  batchUpsertStNewProductStatuses,
  UpsertStNewProductStatusInput,
} from '../../services/stWorkService';

export interface StNewProductProgressImportModalProps {
  isOpen: boolean;
  productsWithStatus: StProductWithStatus[];
  onClose: () => void;
  onImported: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

const MAX_IMPORT_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export const StNewProductProgressImportModal: React.FC<
  StNewProductProgressImportModalProps
> = ({ isOpen, productsWithStatus, onClose, onImported, onShowToast }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSizeKb, setSelectedFileSizeKb] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string>('');
  const [rawRows, setRawRows] = useState<RawImportedProgressRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const previewRows = useMemo(
    () => validateImportedProgressRows(rawRows, productsWithStatus),
    [rawRows, productsWithStatus]
  );

  const summary = useMemo(() => {
    let validCount = 0;
    let errorCount = 0;
    let completedCount = 0;
    for (const r of previewRows) {
      if (r.status === 'valid') {
        validCount += 1;
        if (r.willBeCompleted) completedCount += 1;
      } else {
        errorCount += 1;
      }
    }
    return {
      total: previewRows.length,
      validCount,
      errorCount,
      completedCount,
    };
  }, [previewRows]);

  if (!isOpen) return null;

  const resetFileState = () => {
    setSelectedFileName('');
    setSelectedFileSizeKb(0);
    setParseError('');
    setRawRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetFileState();
    onClose();
  };

  const handleDownloadSample = () => {
    try {
      const buffer = buildSampleProgressExcelArrayBuffer(productsWithStatus);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, 'Mau_Nhap_Tien_Do_Don_Gia_Moi_ST.xlsx');
      onShowToast?.(
        productsWithStatus.length > 0
          ? `Đã xuất file Excel mẫu gồm ${formatNumberVN(
              productsWithStatus.length
            )} mã hàng hiện có.`
          : 'Đã tải file Excel mẫu tiến độ Đơn giá mới.'
      );
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
    setSelectedFileName(file.name);
    setSelectedFileSizeKb(Math.max(1, Math.round(file.size / 1024)));

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseProgressSpreadsheetBuffer(buffer, file.name);
      if (parsed.missingRequiredColumns.length > 0) {
        setRawRows([]);
        setParseError(
          `Không tìm thấy cột bắt buộc: ${parsed.missingRequiredColumns.join(
            ', '
          )}. Vui lòng giữ nguyên tên cột theo file mẫu.`
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
    if (summary.validCount === 0 || isSubmitting) return;

    const payloads: UpsertStNewProductStatusInput[] = previewRows
      .filter((r) => r.status === 'valid' && r.matchedItem)
      .map((r) => {
        const matched = r.matchedItem!;
        const existingSt = matched.status;
        return {
          id: existingSt?.id || null,
          product_id: matched.product.id,
          has_process_erp: r.has_process_erp,
          process_erp_date: r.process_erp_date,
          has_stage_win: r.stages.win.done,
          stage_win_date: r.stages.win.date,
          has_stage_cut: r.stages.cut.done,
          stage_cut_date: r.stages.cut.date,
          has_stage_sol: r.stages.sol.done,
          stage_sol_date: r.stages.sol.date,
          has_stage_ass: r.stages.ass.done,
          stage_ass_date: r.stages.ass.date,
          has_stage_imp: r.stages.imp.done,
          stage_imp_date: r.stages.imp.date,
          has_stage_sol2: r.stages.sol2.done,
          stage_sol2_date: r.stages.sol2.date,
          has_stage_fin: r.stages.fin.done,
          stage_fin_date: r.stages.fin.date,
          has_st: r.has_st,
          st_date: r.st_date,
          unit_price: existingSt?.unit_price ?? null,
          currency: existingSt?.currency || 'VND',
          notes: existingSt?.notes ?? null,
        };
      });

    if (payloads.length === 0) return;

    setIsSubmitting(true);
    try {
      await batchUpsertStNewProductStatuses(payloads);
      await onImported();
      resetFileState();
      onClose();
      onShowToast?.(
        `Đã cập nhật tiến độ cho ${formatNumberVN(
          summary.validCount
        )} mã hàng${
          summary.completedCount > 0
            ? ` (${formatNumberVN(summary.completedCount)} mã đạt Hoàn thành)`
            : ''
        }.`
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
      aria-label="Nhập tiến độ Đơn giá mới từ file"
      onClick={handleClose}
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        data-testid="st-progress-import-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">
                Nhập tiến độ Đơn giá mới từ file
              </h3>
              <p className="text-[11px] text-slate-500">
                Cập nhật hàng loạt Ngày tạo QT, 7 công đoạn (WIN–FIN) và Ngày áp
                dụng ST theo từng mã hàng (.xlsx, .xls, .csv)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng cửa sổ nhập tiến độ"
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1 min-h-0">
          {/* Phần 1: Tải file Excel mẫu */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-slate-800">
                1. File Excel mẫu tiến độ (xuất sẵn danh sách mã hàng hiện có)
              </div>
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1">
                {ST_PROGRESS_IMPORT_HEADERS.map((col) => (
                  <span
                    key={col}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-medium text-slate-700"
                  >
                    {col}
                  </span>
                ))}
              </div>
              <div className="text-[11px] text-slate-500">
                Mẹo: Các cột WIN → FIN có thể nhập ngày hoàn thành (dd/mm/yyyy)
                hoặc đánh dấu <code className="font-mono font-bold">x</code>.
              </div>
            </div>

            <button
              type="button"
              data-testid="st-progress-download-sample-btn"
              onClick={handleDownloadSample}
              className="h-8 px-3.5 rounded-lg border border-[#14539E]/30 bg-white hover:bg-[#14539E] text-[#14539E] hover:text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file Excel mẫu (.xlsx)</span>
            </button>
          </div>

          {/* Phần 2: Chọn / Kéo thả file */}
          <div>
            <div className="font-bold text-slate-800 mb-1.5">
              2. Chọn hoặc kéo thả file tiến độ (.xlsx, .xls, .csv)
            </div>
            <input
              ref={fileInputRef}
              type="file"
              data-testid="st-progress-import-file-input"
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
              data-testid="st-progress-import-dropzone"
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
                  <span>Đang đọc và đối chiếu dữ liệu theo Mã hàng...</span>
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
                    Kéo thả file Excel / CSV tiến độ vào đây hoặc{' '}
                    <span className="text-[#14539E] underline">
                      bấm để chọn file
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Hỗ trợ .xlsx, .xls, .csv · Tự động đối chiếu Mã hàng với
                    Danh mục sản phẩm (st_products)
                  </div>
                </div>
              )}
            </div>

            {parseError && (
              <div
                data-testid="st-progress-import-error"
                className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{parseError}</span>
              </div>
            )}
          </div>

          {/* Phần 3: Bảng xem trước & Kiểm tra đối chiếu */}
          {previewRows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-800">
                  3. Bảng xem trước & Đối chiếu Mã hàng
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold tabular-nums">
                    Tổng: {formatNumberVN(summary.total)}
                  </span>
                  <span
                    data-testid="st-progress-import-valid-count"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold tabular-nums"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Hợp lệ: {formatNumberVN(summary.validCount)}
                  </span>
                  <span
                    data-testid="st-progress-import-error-count"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold tabular-nums"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Lỗi / Chưa có mã: {formatNumberVN(summary.errorCount)}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-auto max-h-[300px]">
                <table
                  data-testid="st-progress-import-preview-table"
                  className="w-full min-w-[820px] border-collapse text-left"
                >
                  <thead className="sticky top-0 z-10 bg-slate-100 text-[10.5px] font-bold text-slate-600 uppercase tracking-tight shadow-[0_1px_0_0_rgba(203,213,225,1)]">
                    <tr>
                      <th className="px-2 py-2 w-12 text-center border-r border-b border-slate-200 whitespace-nowrap">
                        DÒNG
                      </th>
                      <th className="px-2.5 py-2 border-r border-b border-slate-200 whitespace-nowrap">
                        MÃ HÀNG
                      </th>
                      <th className="px-2 py-2 text-center border-r border-b border-slate-200 whitespace-nowrap">
                        NGÀY TẠO QT
                      </th>
                      <th className="px-2 py-2 text-center border-r border-b border-slate-200 whitespace-nowrap">
                        7 CÔNG ĐOẠN
                      </th>
                      <th className="px-2 py-2 text-center border-r border-b border-slate-200 whitespace-nowrap">
                        NGÀY ÁP DỤNG
                      </th>
                      <th className="px-2 py-2 text-center border-r border-b border-slate-200 whitespace-nowrap">
                        TỶ LỆ %
                      </th>
                      <th className="px-2 py-2 text-center border-r border-b border-slate-200 whitespace-nowrap">
                        DỰ KIẾN
                      </th>
                      <th className="px-2.5 py-2 border-b border-slate-200 whitespace-nowrap">
                        KIỂM TRA
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {previewRows.map((row) => (
                      <tr
                        key={`${row.rowNumber}-${row.product_code}`}
                        className={
                          row.status === 'valid'
                            ? 'bg-emerald-50/35'
                            : 'bg-rose-50/55'
                        }
                      >
                        <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-500 border-r border-slate-200/70 tabular-nums">
                          {row.rowNumber}
                        </td>
                        <td className="px-2.5 py-2 border-r border-slate-200/70 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {row.product_code || (
                            <span className="text-rose-500 italic font-sans font-normal">
                              (Trống)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-700 border-r border-slate-200/70 whitespace-nowrap tabular-nums">
                          {row.has_process_erp
                            ? formatStDateVN(row.process_erp_date)
                            : '—'}
                        </td>
                        <td className="px-2 py-2 border-r border-slate-200/70">
                          <div className="flex items-center justify-center gap-0.5 flex-nowrap">
                            {ST_PRODUCTION_STAGES.map((stage) => {
                              const stg = row.stages[stage.key];
                              return (
                                <span
                                  key={stage.key}
                                  title={
                                    stg.done && stg.date
                                      ? `${stage.code}: ${formatStDateVN(stg.date)}`
                                      : `${stage.code}: Chưa xong`
                                  }
                                  className={`px-1 py-0.5 rounded border font-mono text-[10px] font-semibold leading-none ${
                                    stg.done
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                      : 'bg-slate-50 border-slate-200 text-slate-400'
                                  }`}
                                >
                                  {stage.code}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-700 border-r border-slate-200/70 whitespace-nowrap tabular-nums">
                          {row.has_st ? formatStDateVN(row.st_date) : '—'}
                        </td>
                        <td className="px-2 py-2 text-center font-mono font-bold text-[11px] border-r border-slate-200/70 tabular-nums">
                          {row.stagePercentage}%
                        </td>
                        <td className="px-2 py-2 text-center border-r border-slate-200/70 whitespace-nowrap">
                          {row.status === 'valid' ? (
                            row.willBeCompleted ? (
                              <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                                Hoàn thành
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                                Đang làm
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Hợp lệ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100/80 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{row.errorReason || 'Lỗi dữ liệu'}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-600">
            {previewRows.length > 0 ? (
              <span>
                Sẽ cập nhật{' '}
                <strong className="text-[#14539E]">
                  {formatNumberVN(summary.validCount)}
                </strong>{' '}
                mã hàng ({formatNumberVN(summary.completedCount)} mã đạt Hoàn
                thành)
              </span>
            ) : (
              <span>Vui lòng chọn file tiến độ để kiểm tra đối chiếu.</span>
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
              data-testid="st-progress-import-confirm-btn"
              disabled={isSubmitting || summary.validCount === 0}
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
                {summary.validCount > 0
                  ? ` (${formatNumberVN(summary.validCount)})`
                  : ''}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
