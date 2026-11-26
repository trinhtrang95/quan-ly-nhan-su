import * as XLSX from 'xlsx';
import { StCustomer, StLine, StProduct } from './stWorkLogic';

export const ST_IMPORT_SAMPLE_HEADERS = [
  'Line',
  'Khách hàng',
  'Mã hàng',
  'Tên hàng',
  'Quy cách',
  'Ghi chú',
] as const;

export const ST_IMPORT_SAMPLE_ROWS: readonly (readonly string[])[] = [
  ['S', 'POWERNET', '1421190-A01', 'L55S8_FVD_COIL', 'EED1412V', 'Mã hàng mới line S'],
  ['M', 'DONGYANG', 'DY-2045-B02', 'DY24_CHOKE_220UH', 'PQ2620', 'Ưu tiên kiểm tra spec'],
];

export type StImportDuplicateMode = 'skip' | 'overwrite';

export type StImportRowStatus = 'valid' | 'duplicate' | 'error';

export interface RawImportedProductRow {
  rowNumber: number;
  line_name: string;
  customer_short_name: string;
  product_code: string;
  product_name: string;
  specification: string;
  notes: string;
}

export interface ParsedProductWorkbookResult {
  rows: RawImportedProductRow[];
  detectedColumns: string[];
  missingRequiredColumns: string[];
}

export interface StProductImportPreviewRow extends RawImportedProductRow {
  status: StImportRowStatus;
  errorReason: string | null;
  existingProduct: StProduct | null;
}

export interface StProductImportSummary {
  total: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  willInsertCount: number;
  willUpdateCount: number;
  actionableCount: number;
}

type CanonicalColumnKey =
  | 'line_name'
  | 'customer_short_name'
  | 'product_code'
  | 'product_name'
  | 'specification'
  | 'notes';

export function stripVietnameseAccents(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function normalizeImportHeaderKey(raw: unknown): string {
  const str = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!str) return '';
  return stripVietnameseAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const HEADER_ALIAS_MAP: Record<string, CanonicalColumnKey> = {
  line: 'line_name',
  linename: 'line_name',
  chuyen: 'line_name',
  linesanxuat: 'line_name',

  khachhang: 'customer_short_name',
  kh: 'customer_short_name',
  customer: 'customer_short_name',
  customershortname: 'customer_short_name',
  tenkhachhang: 'customer_short_name',

  mahang: 'product_code',
  masanpham: 'product_code',
  masp: 'product_code',
  productcode: 'product_code',
  code: 'product_code',

  tenhang: 'product_name',
  tensanpham: 'product_name',
  tensp: 'product_name',
  productname: 'product_name',
  name: 'product_name',

  quycach: 'specification',
  spec: 'specification',
  specification: 'specification',
  quycachsanpham: 'specification',

  ghichu: 'notes',
  note: 'notes',
  notes: 'notes',
};

export function mapHeaderToCanonicalColumn(
  rawHeader: unknown
): CanonicalColumnKey | null {
  const key = normalizeImportHeaderKey(rawHeader);
  if (!key) return null;
  return HEADER_ALIAS_MAP[key] || null;
}

export function normalizeCellText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).replace(/\s+/g, ' ').trim();
}

export function normalizeCatalogToken(
  raw: unknown,
  canonicalValues: readonly string[]
): string {
  const cleaned = normalizeCellText(raw);
  if (!cleaned) return '';
  const lower = cleaned.toLowerCase();
  const matched = canonicalValues.find(
    (item) => item.trim().toLowerCase() === lower
  );
  return matched ? matched.trim() : cleaned;
}

export function buildSampleProductsExcelArrayBuffer(): ArrayBuffer {
  const sheetData: string[][] = [
    [...ST_IMPORT_SAMPLE_HEADERS],
    ...ST_IMPORT_SAMPLE_ROWS.map((r) => [...r]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 20 },
    { wch: 26 },
    { wch: 20 },
    { wch: 30 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DanhMucSanPham');
  const out = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  }) as ArrayBuffer | Uint8Array;
  const view = out instanceof Uint8Array ? out : new Uint8Array(out);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}

function findHeaderRowIndex(matrix: unknown[][]): {
  headerRowIndex: number;
  columnMap: Partial<Record<CanonicalColumnKey, number>>;
  detectedColumns: string[];
} {
  let bestIdx = 0;
  let bestScore = -1;
  let bestMap: Partial<Record<CanonicalColumnKey, number>> = {};
  let bestDetected: string[] = [];

  const scanLimit = Math.min(matrix.length, 6);
  for (let i = 0; i < scanLimit; i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] : [];
    const currentMap: Partial<Record<CanonicalColumnKey, number>> = {};
    const detected: string[] = [];
    let score = 0;

    row.forEach((cell, colIdx) => {
      const canonical = mapHeaderToCanonicalColumn(cell);
      if (canonical && currentMap[canonical] === undefined) {
        currentMap[canonical] = colIdx;
        detected.push(normalizeCellText(cell));
        score +=
          canonical === 'product_code' || canonical === 'product_name' ? 3 : 1;
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

export function parseProductsSpreadsheetBuffer(
  buffer: ArrayBuffer,
  fileName: string = ''
): ParsedProductWorkbookResult {
  const lowerName = fileName.trim().toLowerCase();
  let workbook: XLSX.WorkBook;

  if (lowerName.endsWith('.csv')) {
    const decoder = new TextDecoder('utf-8');
    const csvText = decoder.decode(new Uint8Array(buffer)).replace(/^\uFEFF/, '');
    workbook = XLSX.read(csvText, { type: 'string', raw: false });
  } else {
    workbook = XLSX.read(buffer, { type: 'array', codepage: 65001, raw: false });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      rows: [],
      detectedColumns: [],
      missingRequiredColumns: ['Mã hàng', 'Tên hàng'],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (!Array.isArray(matrix) || matrix.length === 0) {
    return {
      rows: [],
      detectedColumns: [],
      missingRequiredColumns: ['Mã hàng', 'Tên hàng'],
    };
  }

  const { headerRowIndex, columnMap, detectedColumns } =
    findHeaderRowIndex(matrix);

  const missingRequiredColumns: string[] = [];
  if (columnMap.product_code === undefined) {
    missingRequiredColumns.push('Mã hàng');
  }
  if (columnMap.product_name === undefined) {
    missingRequiredColumns.push('Tên hàng');
  }

  const readCell = (row: unknown[], key: CanonicalColumnKey): string => {
    const colIdx = columnMap[key];
    if (colIdx === undefined) return '';
    return normalizeCellText(row[colIdx]);
  };

  const rows: RawImportedProductRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const rowArr = Array.isArray(matrix[r]) ? matrix[r] : [];
    const line_name = readCell(rowArr, 'line_name');
    const customer_short_name = readCell(rowArr, 'customer_short_name');
    const product_code = readCell(rowArr, 'product_code');
    const product_name = readCell(rowArr, 'product_name');
    const specification = readCell(rowArr, 'specification');
    const notes = readCell(rowArr, 'notes');

    const hasAnyValue = Boolean(
      line_name ||
        customer_short_name ||
        product_code ||
        product_name ||
        specification ||
        notes
    );
    if (!hasAnyValue) continue;

    rows.push({
      rowNumber: r + 1,
      line_name,
      customer_short_name,
      product_code,
      product_name,
      specification,
      notes,
    });
  }

  return {
    rows,
    detectedColumns,
    missingRequiredColumns,
  };
}

export function validateImportedProductRows(
  rawRows: RawImportedProductRow[],
  context: {
    existingProducts: StProduct[];
    lines: StLine[];
    customers: StCustomer[];
  }
): StProductImportPreviewRow[] {
  const canonicalLines = context.lines.map((l) => l.name);
  const canonicalCustomers = context.customers.map((c) => c.short_name);

  const existingByCode = new Map<string, StProduct>();
  for (const p of context.existingProducts) {
    const codeKey = p.product_code.trim().toLowerCase();
    if (codeKey && !existingByCode.has(codeKey)) {
      existingByCode.set(codeKey, p);
    }
  }

  const seenInFile = new Map<string, number>();

  return rawRows.map((row) => {
    const line_name = normalizeCatalogToken(row.line_name, canonicalLines);
    const customer_short_name = normalizeCatalogToken(
      row.customer_short_name,
      canonicalCustomers
    );
    const product_code = normalizeCellText(row.product_code);
    const product_name = normalizeCellText(row.product_name);
    const specification = normalizeCellText(row.specification);
    const notes = normalizeCellText(row.notes);

    if (!product_code && !product_name) {
      return {
        ...row,
        line_name,
        customer_short_name,
        product_code,
        product_name,
        specification,
        notes,
        status: 'error',
        errorReason: 'Thiếu Mã hàng và Tên hàng',
        existingProduct: null,
      };
    }

    if (!product_code) {
      return {
        ...row,
        line_name,
        customer_short_name,
        product_code,
        product_name,
        specification,
        notes,
        status: 'error',
        errorReason: 'Thiếu Mã hàng (khóa chính)',
        existingProduct: null,
      };
    }

    if (!product_name) {
      return {
        ...row,
        line_name,
        customer_short_name,
        product_code,
        product_name,
        specification,
        notes,
        status: 'error',
        errorReason: 'Thiếu Tên hàng',
        existingProduct: null,
      };
    }

    const codeKey = product_code.toLowerCase();
    const firstRowNum = seenInFile.get(codeKey);
    if (firstRowNum !== undefined) {
      return {
        ...row,
        line_name,
        customer_short_name,
        product_code,
        product_name,
        specification,
        notes,
        status: 'error',
        errorReason: `Trùng Mã hàng với dòng ${firstRowNum} trong cùng file`,
        existingProduct: null,
      };
    }
    seenInFile.set(codeKey, row.rowNumber);

    const existing = existingByCode.get(codeKey) || null;
    if (existing) {
      return {
        ...row,
        line_name,
        customer_short_name,
        product_code,
        product_name,
        specification,
        notes,
        status: 'duplicate',
        errorReason: `Mã hàng "${existing.product_code}" đã tồn tại`,
        existingProduct: existing,
      };
    }

    return {
      ...row,
      line_name,
      customer_short_name,
      product_code,
      product_name,
      specification,
      notes,
      status: 'valid',
      errorReason: null,
      existingProduct: null,
    };
  });
}

export function summarizeImportPreview(
  rows: StProductImportPreviewRow[],
  duplicateMode: StImportDuplicateMode
): StProductImportSummary {
  let validCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const r of rows) {
    if (r.status === 'valid') validCount += 1;
    else if (r.status === 'duplicate') duplicateCount += 1;
    else errorCount += 1;
  }

  const willInsertCount = validCount;
  const willUpdateCount = duplicateMode === 'overwrite' ? duplicateCount : 0;

  return {
    total: rows.length,
    validCount,
    duplicateCount,
    errorCount,
    willInsertCount,
    willUpdateCount,
    actionableCount: willInsertCount + willUpdateCount,
  };
}
