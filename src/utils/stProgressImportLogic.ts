import * as XLSX from 'xlsx';
import {
  computeStagesProgress,
  formatStDateVN,
  getLocalIsoDateToday,
  isNewProductCompleted,
  ST_PRODUCTION_STAGES,
  StNewProductStatus,
  StProductWithStatus,
  StStageKey,
} from './stWorkLogic';
import {
  normalizeCellText,
  normalizeImportHeaderKey,
} from './stProductImportLogic';

export const ST_PROGRESS_IMPORT_HEADERS = [
  'Mã hàng',
  'Ngày tạo QT (dd/mm/yyyy)',
  'WIN',
  'CUT',
  'SOL',
  'ASS',
  'IMP',
  'SOL2',
  'FIN',
  'Ngày áp dụng (dd/mm/yyyy)',
] as const;

type ProgressColumnKey =
  | 'product_code'
  | 'process_erp_date'
  | 'win'
  | 'cut'
  | 'sol'
  | 'ass'
  | 'imp'
  | 'sol2'
  | 'fin'
  | 'st_date';

const PROGRESS_HEADER_ALIAS_MAP: Record<string, ProgressColumnKey> = {
  mahang: 'product_code',
  masanpham: 'product_code',
  masp: 'product_code',
  productcode: 'product_code',
  code: 'product_code',

  ngaytaoqt: 'process_erp_date',
  ngaytaoqtddmmyyyy: 'process_erp_date',
  ngaytaoquytrinh: 'process_erp_date',
  ngayquytrinh: 'process_erp_date',
  quytrinherp: 'process_erp_date',
  ngayqterp: 'process_erp_date',
  processerpdate: 'process_erp_date',

  win: 'win',
  winding: 'win',
  winwinding: 'win',

  cut: 'cut',
  cutting: 'cut',
  cutcutting: 'cut',

  sol: 'sol',
  solder: 'sol',
  solsolder: 'sol',
  sol1: 'sol',

  ass: 'ass',
  assembly: 'ass',
  assassembly: 'ass',

  imp: 'imp',
  impregnation: 'imp',
  impimpregnation: 'imp',

  sol2: 'sol2',
  solder2: 'sol2',
  sol2solder2: 'sol2',

  fin: 'fin',
  final: 'fin',
  finalcheck: 'fin',
  finfinalcheck: 'fin',

  ngayapdung: 'st_date',
  ngayapdungddmmyyyy: 'st_date',
  ngayapdungst: 'st_date',
  ngayst: 'st_date',
  stdate: 'st_date',
};

export function mapProgressHeaderToColumn(
  rawHeader: unknown
): ProgressColumnKey | null {
  const key = normalizeImportHeaderKey(rawHeader);
  if (!key) return null;
  return PROGRESS_HEADER_ALIAS_MAP[key] || null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() + 1 === month &&
    dt.getUTCDate() === day
  );
}

function excelSerialToYmd(serial: number): { y: number; m: number; d: number } | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial >= 100000) return null;
  const wholeDays = Math.floor(serial);
  // Excel epoch 1899-12-30 (accounts for 1900 leap-year bug for serials > 59)
  const adjustedDays = wholeDays > 59 ? wholeDays - 25569 : wholeDays - 25568;
  const dt = new Date(adjustedDays * 86400000);
  if (Number.isNaN(dt.getTime())) return null;
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

/**
 * Parses Excel serial number, dd/mm/yyyy, dd-mm-yyyy, or yyyy-mm-dd into YYYY-MM-DD.
 * Returns:
 *  - `{ iso: null, invalid: false }` when cell is empty/dash
 *  - `{ iso: 'YYYY-MM-DD', invalid: false }` when valid date
 *  - `{ iso: null, invalid: true }` when non-empty unparseable text
 */
export function parseSpreadsheetDateCell(raw: unknown): {
  iso: string | null;
  invalid: boolean;
} {
  if (raw === null || raw === undefined) {
    return { iso: null, invalid: false };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = raw.getMonth() + 1;
    const d = raw.getDate();
    if (isValidCalendarDate(y, m, d)) {
      return { iso: `${y}-${pad2(m)}-${pad2(d)}`, invalid: false };
    }
    return { iso: null, invalid: true };
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 1000 && raw < 100000) {
      const parsed = excelSerialToYmd(raw);
      if (parsed && isValidCalendarDate(parsed.y, parsed.m, parsed.d)) {
        return {
          iso: `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`,
          invalid: false,
        };
      }
    }
    return { iso: null, invalid: true };
  }

  const text = normalizeCellText(raw);
  if (!text || text === '—' || text === '-') {
    return { iso: null, invalid: false };
  }

  // Numeric Excel serial passed as string (e.g. "46351")
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    const parsed = excelSerialToYmd(serial);
    if (parsed && isValidCalendarDate(parsed.y, parsed.m, parsed.d)) {
      return {
        iso: `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`,
        invalid: false,
      };
    }
  }

  // ISO yyyy-mm-dd or yyyy/mm/dd
  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      return { iso: `${y}-${pad2(m)}-${pad2(d)}`, invalid: false };
    }
    return { iso: null, invalid: true };
  }

  // Vietnamese dd/mm/yyyy or dd-mm-yyyy (also supports 2-digit year)
  const dmyMatch = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    let y = Number(dmyMatch[3]);
    if (y < 100) y += 2000;
    if (isValidCalendarDate(y, m, d)) {
      return { iso: `${y}-${pad2(m)}-${pad2(d)}`, invalid: false };
    }
    return { iso: null, invalid: true };
  }

  return { iso: null, invalid: true };
}

const FALSY_STAGE_TOKENS = new Set([
  '',
  '-',
  '—',
  '0',
  'false',
  'no',
  'n',
  'chua',
  'chưa',
  'chua xong',
  'chưa xong',
]);

const TRUTHY_STAGE_TOKENS = new Set([
  'x',
  'v',
  '✓',
  '✔',
  '1',
  'true',
  'yes',
  'y',
  'ok',
  'co',
  'có',
  'done',
  'hoan thanh',
  'hoàn thành',
]);

export function parseStageCellValue(
  raw: unknown,
  fallbackIsoDate: string = getLocalIsoDateToday()
): { done: boolean; date: string | null; invalid: boolean } {
  if (raw === null || raw === undefined) {
    return { done: false, date: null, invalid: false };
  }

  if (typeof raw === 'boolean') {
    return raw
      ? { done: true, date: fallbackIsoDate, invalid: false }
      : { done: false, date: null, invalid: false };
  }

  if (raw instanceof Date) {
    const parsed = parseSpreadsheetDateCell(raw);
    return parsed.iso
      ? { done: true, date: parsed.iso, invalid: false }
      : { done: false, date: null, invalid: true };
  }

  if (typeof raw === 'number') {
    if (raw === 0) return { done: false, date: null, invalid: false };
    if (raw === 1) return { done: true, date: fallbackIsoDate, invalid: false };
    const parsed = parseSpreadsheetDateCell(raw);
    if (parsed.iso) return { done: true, date: parsed.iso, invalid: false };
    return { done: false, date: null, invalid: true };
  }

  const text = normalizeCellText(raw);
  const lower = text.toLowerCase();
  if (FALSY_STAGE_TOKENS.has(lower)) {
    return { done: false, date: null, invalid: false };
  }
  if (TRUTHY_STAGE_TOKENS.has(lower)) {
    return { done: true, date: fallbackIsoDate, invalid: false };
  }

  const parsedDate = parseSpreadsheetDateCell(text);
  if (parsedDate.iso) {
    return { done: true, date: parsedDate.iso, invalid: false };
  }

  return { done: false, date: null, invalid: true };
}

export interface RawImportedProgressRow {
  rowNumber: number;
  product_code: string;
  process_erp_raw: unknown;
  st_date_raw: unknown;
  stages_raw: Record<StStageKey, unknown>;
}

export interface ParsedProgressWorkbookResult {
  rows: RawImportedProgressRow[];
  detectedColumns: string[];
  missingRequiredColumns: string[];
}

export interface StProgressImportPreviewRow {
  rowNumber: number;
  product_code: string;
  matchedItem: StProductWithStatus | null;
  has_process_erp: boolean;
  process_erp_date: string | null;
  stages: Record<StStageKey, { done: boolean; date: string | null }>;
  stagePercentage: number;
  stageCompletedCount: number;
  has_st: boolean;
  st_date: string | null;
  willBeCompleted: boolean;
  status: 'valid' | 'error';
  errorReason: string | null;
}

export function buildSampleProgressExcelArrayBuffer(
  productsWithStatus: StProductWithStatus[] = []
): ArrayBuffer {
  const formatStageExport = (
    done: boolean | undefined,
    date: string | null | undefined
  ): string => {
    if (!done) return '';
    const formatted = formatStDateVN(date);
    return formatted !== '—' ? formatted : 'x';
  };

  const dataRows: string[][] =
    productsWithStatus.length > 0
      ? productsWithStatus.map((item) => {
          const st = item.status;
          const erpStr = st?.has_process_erp
            ? formatStDateVN(st.process_erp_date)
            : '';
          const stStr = st?.has_st ? formatStDateVN(st.st_date) : '';
          return [
            item.product.product_code,
            erpStr !== '—' ? erpStr : '',
            formatStageExport(st?.has_stage_win, st?.stage_win_date),
            formatStageExport(st?.has_stage_cut, st?.stage_cut_date),
            formatStageExport(st?.has_stage_sol, st?.stage_sol_date),
            formatStageExport(st?.has_stage_ass, st?.stage_ass_date),
            formatStageExport(st?.has_stage_imp, st?.stage_imp_date),
            formatStageExport(st?.has_stage_sol2, st?.stage_sol2_date),
            formatStageExport(st?.has_stage_fin, st?.stage_fin_date),
            stStr !== '—' ? stStr : '',
          ];
        })
      : [
          [
            '1421189-A70',
            '23/11/2026',
            '24/11/2026',
            '24/11/2026',
            '25/11/2026',
            'x',
            '',
            '',
            '',
            '',
          ],
          [
            '20007921',
            '20/11/2026',
            '21/11/2026',
            '21/11/2026',
            '22/11/2026',
            '22/11/2026',
            '23/11/2026',
            '24/11/2026',
            '25/11/2026',
            '26/11/2026',
          ],
        ];

  const sheetData: string[][] = [
    [...ST_PROGRESS_IMPORT_HEADERS],
    ...dataRows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 24 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 24 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'TienDoDonGiaMoi');
  const out = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  }) as ArrayBuffer | Uint8Array;
  const view = out instanceof Uint8Array ? out : new Uint8Array(out);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}

function findProgressHeaderRow(matrix: unknown[][]): {
  headerRowIndex: number;
  columnMap: Partial<Record<ProgressColumnKey, number>>;
  detectedColumns: string[];
} {
  let bestIdx = 0;
  let bestScore = -1;
  let bestMap: Partial<Record<ProgressColumnKey, number>> = {};
  let bestDetected: string[] = [];

  const scanLimit = Math.min(matrix.length, 6);
  for (let i = 0; i < scanLimit; i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] : [];
    const currentMap: Partial<Record<ProgressColumnKey, number>> = {};
    const detected: string[] = [];
    let score = 0;

    row.forEach((cell, colIdx) => {
      const canonical = mapProgressHeaderToColumn(cell);
      if (canonical && currentMap[canonical] === undefined) {
        currentMap[canonical] = colIdx;
        detected.push(normalizeCellText(cell));
        score += canonical === 'product_code' ? 4 : 1;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestMap = currentMap;
      bestDetected = detected;
    }
  }

  return {
    headerRowIndex: bestIdx,
    columnMap: bestMap,
    detectedColumns: bestDetected,
  };
}

export function parseProgressSpreadsheetBuffer(
  buffer: ArrayBuffer,
  fileName: string = ''
): ParsedProgressWorkbookResult {
  const lowerName = fileName.trim().toLowerCase();
  let workbook: XLSX.WorkBook;

  if (lowerName.endsWith('.csv')) {
    const decoder = new TextDecoder('utf-8');
    const csvText = decoder.decode(new Uint8Array(buffer)).replace(/^\uFEFF/, '');
    workbook = XLSX.read(csvText, { type: 'string', raw: true });
  } else {
    workbook = XLSX.read(buffer, { type: 'array', codepage: 65001, raw: true });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      rows: [],
      detectedColumns: [],
      missingRequiredColumns: ['Mã hàng'],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  });

  if (!Array.isArray(matrix) || matrix.length === 0) {
    return {
      rows: [],
      detectedColumns: [],
      missingRequiredColumns: ['Mã hàng'],
    };
  }

  const { headerRowIndex, columnMap, detectedColumns } =
    findProgressHeaderRow(matrix);

  const missingRequiredColumns: string[] = [];
  if (columnMap.product_code === undefined) {
    missingRequiredColumns.push('Mã hàng');
  }

  const readRaw = (row: unknown[], key: ProgressColumnKey): unknown => {
    const colIdx = columnMap[key];
    return colIdx === undefined ? '' : row[colIdx];
  };

  const rows: RawImportedProgressRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const rowArr = Array.isArray(matrix[r]) ? matrix[r] : [];
    const product_code = normalizeCellText(readRaw(rowArr, 'product_code'));
    const process_erp_raw = readRaw(rowArr, 'process_erp_date');
    const st_date_raw = readRaw(rowArr, 'st_date');
    const stages_raw: Record<StStageKey, unknown> = {
      win: readRaw(rowArr, 'win'),
      cut: readRaw(rowArr, 'cut'),
      sol: readRaw(rowArr, 'sol'),
      ass: readRaw(rowArr, 'ass'),
      imp: readRaw(rowArr, 'imp'),
      sol2: readRaw(rowArr, 'sol2'),
      fin: readRaw(rowArr, 'fin'),
    };

    const hasAnyValue = Boolean(
      product_code ||
        normalizeCellText(process_erp_raw) ||
        normalizeCellText(st_date_raw) ||
        Object.values(stages_raw).some((v) => normalizeCellText(v))
    );
    if (!hasAnyValue) continue;

    rows.push({
      rowNumber: r + 1,
      product_code,
      process_erp_raw,
      st_date_raw,
      stages_raw,
    });
  }

  return {
    rows,
    detectedColumns,
    missingRequiredColumns,
  };
}

export function validateImportedProgressRows(
  rawRows: RawImportedProgressRow[],
  productsWithStatus: StProductWithStatus[],
  referenceTodayIso: string = getLocalIsoDateToday()
): StProgressImportPreviewRow[] {
  const itemByCode = new Map<string, StProductWithStatus>();
  for (const item of productsWithStatus) {
    const codeKey = item.product.product_code.trim().toLowerCase();
    if (codeKey && !itemByCode.has(codeKey)) {
      itemByCode.set(codeKey, item);
    }
  }

  const seenInFile = new Map<string, number>();

  return rawRows.map((row) => {
    const emptyStages: Record<StStageKey, { done: boolean; date: string | null }> = {
      win: { done: false, date: null },
      cut: { done: false, date: null },
      sol: { done: false, date: null },
      ass: { done: false, date: null },
      imp: { done: false, date: null },
      sol2: { done: false, date: null },
      fin: { done: false, date: null },
    };

    if (!row.product_code) {
      return {
        rowNumber: row.rowNumber,
        product_code: '',
        matchedItem: null,
        has_process_erp: false,
        process_erp_date: null,
        stages: emptyStages,
        stagePercentage: 0,
        stageCompletedCount: 0,
        has_st: false,
        st_date: null,
        willBeCompleted: false,
        status: 'error',
        errorReason: 'Thiếu Mã hàng',
      };
    }

    const codeKey = row.product_code.toLowerCase();
    const prevRow = seenInFile.get(codeKey);
    if (prevRow !== undefined) {
      return {
        rowNumber: row.rowNumber,
        product_code: row.product_code,
        matchedItem: null,
        has_process_erp: false,
        process_erp_date: null,
        stages: emptyStages,
        stagePercentage: 0,
        stageCompletedCount: 0,
        has_st: false,
        st_date: null,
        willBeCompleted: false,
        status: 'error',
        errorReason: `Trùng Mã hàng với dòng ${prevRow} trong cùng file`,
      };
    }
    seenInFile.set(codeKey, row.rowNumber);

    const matchedItem = itemByCode.get(codeKey) || null;
    if (!matchedItem) {
      return {
        rowNumber: row.rowNumber,
        product_code: row.product_code,
        matchedItem: null,
        has_process_erp: false,
        process_erp_date: null,
        stages: emptyStages,
        stagePercentage: 0,
        stageCompletedCount: 0,
        has_st: false,
        st_date: null,
        willBeCompleted: false,
        status: 'error',
        errorReason: 'Mã hàng chưa có trong Danh mục sản phẩm (st_products)',
      };
    }

    const errors: string[] = [];
    const parsedErp = parseSpreadsheetDateCell(row.process_erp_raw);
    if (parsedErp.invalid) {
      errors.push('Ngày tạo QT không đúng định dạng dd/mm/yyyy');
    }

    const parsedSt = parseSpreadsheetDateCell(row.st_date_raw);
    if (parsedSt.invalid) {
      errors.push('Ngày áp dụng không đúng định dạng dd/mm/yyyy');
    }

    const stages: Record<StStageKey, { done: boolean; date: string | null }> = {
      ...emptyStages,
    };
    const invalidStages: string[] = [];
    for (const stage of ST_PRODUCTION_STAGES) {
      const parsedStage = parseStageCellValue(
        row.stages_raw[stage.key],
        referenceTodayIso
      );
      if (parsedStage.invalid) {
        invalidStages.push(stage.code);
      } else {
        stages[stage.key] = {
          done: parsedStage.done,
          date: parsedStage.date,
        };
      }
    }
    if (invalidStages.length > 0) {
      errors.push(
        `Giá trị công đoạn không hợp lệ (${invalidStages.join(', ')})`
      );
    }

    const statusShape: Partial<StNewProductStatus> = {
      has_process_erp: Boolean(parsedErp.iso),
      process_erp_date: parsedErp.iso,
      has_stage_win: stages.win.done,
      stage_win_date: stages.win.date,
      has_stage_cut: stages.cut.done,
      stage_cut_date: stages.cut.date,
      has_stage_sol: stages.sol.done,
      stage_sol_date: stages.sol.date,
      has_stage_ass: stages.ass.done,
      stage_ass_date: stages.ass.date,
      has_stage_imp: stages.imp.done,
      stage_imp_date: stages.imp.date,
      has_stage_sol2: stages.sol2.done,
      stage_sol2_date: stages.sol2.date,
      has_stage_fin: stages.fin.done,
      stage_fin_date: stages.fin.date,
      has_st: Boolean(parsedSt.iso),
      st_date: parsedSt.iso,
    };

    const progress = computeStagesProgress(statusShape);
    const willBeCompleted = isNewProductCompleted(statusShape);

    if (errors.length > 0) {
      return {
        rowNumber: row.rowNumber,
        product_code: matchedItem.product.product_code,
        matchedItem,
        has_process_erp: Boolean(parsedErp.iso),
        process_erp_date: parsedErp.iso,
        stages,
        stagePercentage: progress.percentage,
        stageCompletedCount: progress.completedCount,
        has_st: Boolean(parsedSt.iso),
        st_date: parsedSt.iso,
        willBeCompleted,
        status: 'error',
        errorReason: errors.join('; '),
      };
    }

    return {
      rowNumber: row.rowNumber,
      product_code: matchedItem.product.product_code,
      matchedItem,
      has_process_erp: Boolean(parsedErp.iso),
      process_erp_date: parsedErp.iso,
      stages,
      stagePercentage: progress.percentage,
      stageCompletedCount: progress.completedCount,
      has_st: Boolean(parsedSt.iso),
      st_date: parsedSt.iso,
      willBeCompleted,
      status: 'valid',
      errorReason: null,
    };
  });
}
