import ExcelJS from 'exceljs';
import {
  formatStDateVN,
  isDateInRange,
  isQuoteCompleted,
  StChangeRequest,
  StCustomerQuote,
  StProductWithStatus,
  StReportComparisonRow,
  StResolvedPeriodRange,
} from './stWorkLogic';

export interface StWorkExcelExportPayload {
  periodRange: StResolvedPeriodRange;
  comparisonRows: StReportComparisonRow[];
  productsWithStatus: StProductWithStatus[];
  changeRequests: StChangeRequest[];
  customerQuotes: StCustomerQuote[];
}

const FONT_NAME = 'Arial';
const BRAND_FILL_HEX = 'FF14539E';
const SUBHEADER_FILL_HEX = 'FFEFF6FF';
const TOTAL_FILL_HEX = 'FFF1F5F9';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

function styleTitleBanner(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  colCount: number
) {
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: FONT_NAME,
    size: 13,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_FILL_HEX },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(2, 1, 2, colCount);
  const subCell = sheet.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = {
    name: FONT_NAME,
    size: 10,
    italic: true,
    color: { argb: 'FF334155' },
  };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: SUBHEADER_FILL_HEX },
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 20;
}

function styleHeaderRow(
  sheet: ExcelJS.Worksheet,
  headerRowIndex: number,
  headers: string[]
) {
  const row = sheet.getRow(headerRowIndex);
  row.height = 24;
  headers.forEach((label, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = label;
    cell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_FILL_HEX },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = THIN_BORDER;
  });
}

function applyDataRowBorderAndFont(
  row: ExcelJS.Row,
  colCount: number,
  numericCols: number[] = []
) {
  row.height = 21;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF0F172A' } };
    cell.border = THIN_BORDER;
    cell.alignment = {
      vertical: 'middle',
      horizontal: numericCols.includes(c) ? 'right' : 'left',
      wrapText: true,
    };
  }
}

function styleTotalRow(
  row: ExcelJS.Row,
  colCount: number,
  numericCols: number[] = []
) {
  row.height = 23;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: 'FF14539E' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: TOTAL_FILL_HEX },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF14539E' } },
      bottom: { style: 'double', color: { argb: 'FF14539E' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: numericCols.includes(c) ? 'right' : 'left',
    };
  }
}

function extractCellDisplayLength(value: ExcelJS.CellValue): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'object') {
    if ('formula' in value) {
      return 14;
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join('').length;
    }
    return String(value).length;
  }
  const str = String(value);
  const lines = str.split(/\r?\n/);
  return lines.reduce((max, line) => Math.max(max, line.length), 0);
}

export function autoFitWorksheetColumns(
  sheet: ExcelJS.Worksheet,
  minWidth: number = 8,
  maxWidth: number = 48
): void {
  const colCount = sheet.columnCount;
  for (let colIdx = 1; colIdx <= colCount; colIdx++) {
    const col = sheet.getColumn(colIdx);
    let maxLen = typeof col.width === 'number' ? col.width - 3 : minWidth;
    for (let rowIdx = 3; rowIdx <= sheet.rowCount; rowIdx++) {
      const cellVal = sheet.getRow(rowIdx).getCell(colIdx).value;
      const len = extractCellDisplayLength(cellVal);
      if (len > maxLen) maxLen = len;
    }
    col.width = Math.min(maxWidth, Math.max(minWidth, maxLen + 4));
  }
}

export function buildStReportWorkbook(
  payload: StWorkExcelExportPayload
): ExcelJS.Workbook {
  const {
    periodRange,
    comparisonRows,
    productsWithStatus,
    changeRequests,
    customerQuotes,
  } = payload;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ST Work Management';
  workbook.created = new Date();

  const subtitle = `Kỳ báo cáo: ${periodRange.currentLabel} (${formatStDateVN(
    periodRange.currentStart
  )} – ${formatStDateVN(periodRange.currentEnd)}) | So sánh với: ${
    periodRange.prevLabel
  }`;

  // ==========================================
  // SHEET 1: Tổng hợp
  // ==========================================
  const summarySheet = workbook.addWorksheet('Tổng hợp', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  summarySheet.columns = [
    { key: 'stt', width: 7 },
    { key: 'metric', width: 38 },
    { key: 'current', width: 16 },
    { key: 'previous', width: 16 },
    { key: 'delta', width: 16 },
    { key: 'unit', width: 12 },
    { key: 'note', width: 44 },
  ];
  styleTitleBanner(
    summarySheet,
    'BÁO CÁO TỔNG HỢP CÔNG VIỆC ST',
    subtitle,
    7
  );
  styleHeaderRow(summarySheet, 3, [
    'STT',
    'Hạng mục',
    'Kỳ này',
    'Kỳ trước',
    'Chênh lệch',
    'Đơn vị',
    'Ghi chú',
  ]);

  let summaryRowIdx = 4;
  comparisonRows.forEach((row, index) => {
    const excelRow = summarySheet.getRow(summaryRowIdx);
    excelRow.getCell(1).value = index + 1;
    excelRow.getCell(2).value = row.label;
    excelRow.getCell(3).value = row.currentValue;
    excelRow.getCell(4).value = row.previousValue;
    excelRow.getCell(5).value = row.delta;
    excelRow.getCell(6).value = row.unit;
    excelRow.getCell(7).value = row.note;
    applyDataRowBorderAndFont(excelRow, 7, [1, 3, 4, 5]);
    excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    summaryRowIdx += 1;
  });

  const summaryLastDataRow = Math.max(3, summaryRowIdx - 1);
  summarySheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: summaryLastDataRow, column: 7 },
  };

  const summaryTotalRow = summarySheet.getRow(summaryRowIdx);
  summaryTotalRow.getCell(1).value = '';
  summaryTotalRow.getCell(2).value = `Tổng cộng (${comparisonRows.length} chỉ tiêu)`;
  summaryTotalRow.getCell(3).value =
    comparisonRows.length > 0 ? { formula: `SUM(C4:C${summaryLastDataRow})` } : 0;
  summaryTotalRow.getCell(4).value =
    comparisonRows.length > 0 ? { formula: `SUM(D4:D${summaryLastDataRow})` } : 0;
  summaryTotalRow.getCell(5).value =
    comparisonRows.length > 0 ? { formula: `SUM(E4:E${summaryLastDataRow})` } : 0;
  summaryTotalRow.getCell(6).value = '—';
  summaryTotalRow.getCell(7).value = 'Dòng tổng cộng tự động';
  styleTotalRow(summaryTotalRow, 7, [3, 4, 5]);

  // ==========================================
  // SHEET 2: Mã hàng mới
  // ==========================================
  const productsSheet = workbook.addWorksheet('Mã hàng mới', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  productsSheet.columns = [
    { key: 'stt', width: 7 },
    { key: 'line', width: 14 },
    { key: 'customer', width: 16 },
    { key: 'code', width: 20 },
    { key: 'name', width: 26 },
    { key: 'spec', width: 22 },
    { key: 'registered', width: 14 },
    { key: 'quote', width: 14 },
    { key: 'bomErp', width: 14 },
    { key: 'specErp', width: 14 },
    { key: 'khsx', width: 14 },
    { key: 'processErp', width: 15 },
    { key: 'st', width: 14 },
    { key: 'days', width: 17 },
    { key: 'status', width: 22 },
    { key: 'notes', width: 28 },
  ];
  styleTitleBanner(
    productsSheet,
    'CHI TIẾT THEO DÕI MÃ HÀNG MỚI (DẢI TUẦN TỰ 6 BƯỚC)',
    subtitle,
    16
  );
  styleHeaderRow(productsSheet, 3, [
    'STT',
    'Line',
    'Khách hàng',
    'Mã hàng',
    'Tên hàng',
    'Quy cách',
    'Ngày đăng ký',
    'Báo giá',
    'BOM ERP',
    'SPEC ERP',
    'KHSX',
    'Quy trình ERP',
    'ST',
    'Số ngày hoàn thành',
    'Trạng thái hiện tại',
    'Ghi chú',
  ]);

  const sortedProducts = [...productsWithStatus].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? -1 : 1;
    return (b.product.created_at || '').localeCompare(a.product.created_at || '');
  });

  const formatStepCell = (
    item: StProductWithStatus,
    boolKey:
      | 'has_quote'
      | 'has_bom_erp'
      | 'has_spec_erp'
      | 'has_khsx'
      | 'has_process_erp'
      | 'has_st',
    dateKey:
      | 'quote_date'
      | 'bom_erp_date'
      | 'spec_erp_date'
      | 'khsx_date'
      | 'process_erp_date'
      | 'st_date',
    stepKey: string
  ): string => {
    const st = item.status;
    if (st?.[boolKey]) {
      return st[dateKey] ? formatStDateVN(st[dateKey]) : 'Đã xong';
    }
    if (item.currentWaitingStep === stepKey) {
      return 'Đang chờ';
    }
    return '—';
  };

  let productRowIdx = 4;
  sortedProducts.forEach((item, index) => {
    const excelRow = productsSheet.getRow(productRowIdx);
    const st = item.status;

    excelRow.getCell(1).value = index + 1;
    excelRow.getCell(2).value = item.product.line_name;
    excelRow.getCell(3).value = item.product.customer_short_name;
    excelRow.getCell(4).value = item.product.product_code;
    excelRow.getCell(5).value = item.product.product_name;
    excelRow.getCell(6).value = item.product.specification || '';
    excelRow.getCell(7).value = formatStDateVN(item.product.created_at);
    excelRow.getCell(8).value = formatStepCell(item, 'has_quote', 'quote_date', 'quote');
    excelRow.getCell(9).value = formatStepCell(item, 'has_bom_erp', 'bom_erp_date', 'bom_erp');
    excelRow.getCell(10).value = formatStepCell(item, 'has_spec_erp', 'spec_erp_date', 'spec_erp');
    excelRow.getCell(11).value = formatStepCell(item, 'has_khsx', 'khsx_date', 'khsx');
    excelRow.getCell(12).value = formatStepCell(item, 'has_process_erp', 'process_erp_date', 'process_erp');
    excelRow.getCell(13).value = formatStepCell(item, 'has_st', 'st_date', 'st');
    excelRow.getCell(14).value =
      item.completionDays !== null ? item.completionDays : null;
    excelRow.getCell(15).value = item.waitingLabel;
    excelRow.getCell(16).value = st?.notes || '';

    applyDataRowBorderAndFont(excelRow, 16, [1, 14]);
    excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    for (let c = 8; c <= 13; c++) {
      excelRow.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
    }
    productRowIdx += 1;
  });

  const productLastDataRow = Math.max(3, productRowIdx - 1);
  productsSheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: productLastDataRow, column: 16 },
  };

  const completedTotal = sortedProducts.filter((p) => p.isCompleted).length;
  const inProgressTotal = sortedProducts.length - completedTotal;
  const productTotalRow = productsSheet.getRow(productRowIdx);
  productTotalRow.getCell(1).value = '';
  productTotalRow.getCell(2).value = 'Tổng cộng';
  productTotalRow.getCell(4).value = `${sortedProducts.length} mã`;
  productTotalRow.getCell(14).value =
    sortedProducts.length > 0
      ? { formula: `AVERAGE(N4:N${productLastDataRow})` }
      : 0;
  productTotalRow.getCell(15).value = `Hoàn thành: ${completedTotal} | Dở dang: ${inProgressTotal}`;
  styleTotalRow(productTotalRow, 16, [14]);

  // ==========================================
  // SHEET 3: Phiếu yêu cầu
  // ==========================================
  const requestsSheet = workbook.addWorksheet('Phiếu yêu cầu', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  requestsSheet.columns = [
    { key: 'stt', width: 7 },
    { key: 'dept', width: 20 },
    { key: 'content', width: 38 },
    { key: 'received', width: 15 },
    { key: 'code', width: 18 },
    { key: 'spec', width: 24 },
    { key: 'status', width: 16 },
    { key: 'processed', width: 15 },
    { key: 'version', width: 16 },
    { key: 'notes', width: 28 },
  ];
  styleTitleBanner(
    requestsSheet,
    'DANH SÁCH PHIẾU YÊU CẦU THAY ĐỔI',
    subtitle,
    10
  );
  styleHeaderRow(requestsSheet, 3, [
    'STT',
    'Bộ phận YC',
    'Nội dung yêu cầu',
    'Ngày tiếp nhận',
    'Mã hàng',
    'Quy cách',
    'Tình trạng xử lý',
    'Ngày xử lý',
    'Phiên bản áp dụng',
    'Ghi chú',
  ]);

  const requestsForExport = changeRequests.filter((req) =>
    isDateInRange(req.received_at, periodRange.currentStart, periodRange.currentEnd)
  );
  const rowsToWrite =
    requestsForExport.length > 0 ? requestsForExport : changeRequests;

  let reqRowIdx = 4;
  rowsToWrite.forEach((req, index) => {
    const excelRow = requestsSheet.getRow(reqRowIdx);
    excelRow.getCell(1).value = index + 1;
    excelRow.getCell(2).value = req.department;
    excelRow.getCell(3).value = req.content;
    excelRow.getCell(4).value = formatStDateVN(req.received_at);
    excelRow.getCell(5).value = req.product_code;
    excelRow.getCell(6).value = req.specification;
    excelRow.getCell(7).value = req.status;
    excelRow.getCell(8).value = formatStDateVN(req.processed_at);
    excelRow.getCell(9).value = req.applied_version || '';
    excelRow.getCell(10).value = req.notes || '';
    applyDataRowBorderAndFont(excelRow, 10, [1]);
    excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    reqRowIdx += 1;
  });

  const reqLastDataRow = Math.max(3, reqRowIdx - 1);
  requestsSheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: reqLastDataRow, column: 10 },
  };

  const reqTotalRow = requestsSheet.getRow(reqRowIdx);
  reqTotalRow.getCell(1).value = '';
  reqTotalRow.getCell(2).value = 'Tổng cộng';
  reqTotalRow.getCell(3).value = `${rowsToWrite.length} phiếu yêu cầu`;
  reqTotalRow.getCell(7).value = `Trong kỳ: ${requestsForExport.length}`;
  styleTotalRow(reqTotalRow, 10, []);

  // ==========================================
  // SHEET 4: Báo giá khách hàng
  // ==========================================
  const quotesSheet = workbook.addWorksheet('Báo giá khách hàng', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  quotesSheet.columns = [
    { key: 'stt', width: 7 },
    { key: 'quoteCode', width: 22 },
    { key: 'customer', width: 22 },
    { key: 'status', width: 20 },
    { key: 'quotedAt', width: 18 },
    { key: 'notes', width: 38 },
  ];
  styleTitleBanner(
    quotesSheet,
    'BÁO GIÁ KHÁCH HÀNG (ST)',
    subtitle,
    6
  );
  styleHeaderRow(quotesSheet, 3, [
    'STT',
    'Mã báo giá',
    'Khách hàng',
    'Trạng thái',
    'Ngày báo giá',
    'Ghi chú',
  ]);

  let quoteRowIdx = 4;
  customerQuotes.forEach((quote, index) => {
    const excelRow = quotesSheet.getRow(quoteRowIdx);
    excelRow.getCell(1).value = index + 1;
    excelRow.getCell(2).value = quote.quote_code || '—';
    excelRow.getCell(3).value = quote.customer_short_name || '—';
    excelRow.getCell(4).value = quote.status || 'Chờ báo giá';
    excelRow.getCell(5).value = formatStDateVN(quote.quoted_at);
    excelRow.getCell(6).value = quote.notes || '';
    applyDataRowBorderAndFont(excelRow, 6, [1]);
    excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    quoteRowIdx += 1;
  });

  const quoteLastDataRow = Math.max(3, quoteRowIdx - 1);
  quotesSheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: quoteLastDataRow, column: 6 },
  };

  const quotedCount = customerQuotes.filter(isQuoteCompleted).length;
  const quoteRemaining = Math.max(0, customerQuotes.length - quotedCount);
  const quoteTotalRow = quotesSheet.getRow(quoteRowIdx);
  quoteTotalRow.getCell(1).value = '';
  quoteTotalRow.getCell(2).value = 'Tổng cộng';
  quoteTotalRow.getCell(3).value = `${customerQuotes.length} hồ sơ`;
  quoteTotalRow.getCell(4).value = `Đã báo giá: ${quotedCount} | Còn lại: ${quoteRemaining}`;
  styleTotalRow(quoteTotalRow, 6, []);

  // Tự động căn độ rộng cột cho toàn bộ 4 sheet
  autoFitWorksheetColumns(summarySheet, 8, 52);
  autoFitWorksheetColumns(productsSheet, 8, 42);
  autoFitWorksheetColumns(requestsSheet, 8, 48);
  autoFitWorksheetColumns(quotesSheet, 8, 46);

  return workbook;
}

export async function exportStWorkReportExcel(
  payload: StWorkExcelExportPayload
): Promise<string> {
  const workbook = buildStReportWorkbook(payload);
  const buffer = await workbook.xlsx.writeBuffer();
  const safeLabel = payload.periodRange.currentLabel
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  const filename = `Bao_cao_cong_viec_ST_${safeLabel || 'export'}.xlsx`;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const mod = (await import('file-saver')) as {
    saveAs?: (data: Blob, name?: string) => void;
    default?: ((data: Blob, name?: string) => void) | { saveAs?: (data: Blob, name?: string) => void };
  };
  const saveFn =
    mod.saveAs ||
    (typeof mod.default === 'function' ? mod.default : mod.default?.saveAs);
  if (saveFn) {
    saveFn(blob, filename);
  } else {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }
  return filename;
}
