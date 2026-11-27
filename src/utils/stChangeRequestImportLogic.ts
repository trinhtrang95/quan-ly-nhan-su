import * as XLSX from 'xlsx';
import {
  generateNextRequestCode,
  getLocalIsoDateToday,
  normalizeChangeRequestProcessStage,
  normalizeStChangeRequestStatus,
  StChangeRequest,
  StChangeRequestStatus,
  StProduct,
} from './stWorkLogic';
import {
  normalizeCellText,
  normalizeImportHeaderKey,
} from './stProductImportLogic';
import { parseSpreadsheetDateCell } from './stProgressImportLogic';

export const ST_CHANGE_REQUEST_IMPORT_HEADERS = [
  'MÃ PHIẾU',
  'NGÀY NHẬN YC',
  'BỘ PHẬN YC',
  'NHÓM XỬ LÝ',
  'MÃ HÀNG',
  'QUY CÁCH',
  'CÔNG ĐOẠN',
  'NỘI DUNG YÊU CẦU THAY ĐỔI',
  'TÌNH TRẠNG',
  'NGÀY ÁP DỤNG ĐƠN GIÁ THAY ĐỔI',
  'PHIÊN BẢN ÁP DỤNG',
  'GHI CHÚ',
] as const;

type ChangeRequestImportColKey =
  | 'request_code'
  | 'received_at'
  | 'department'
  | 'assigned_group'
  | 'product_code'
  | 'specification'
  | 'process_stage'
  | 'content'
  | 'status'
  | 'processed_at'
  | 'applied_version'
  | 'notes';

const HEADER_ALIAS_MAP: Record<string, ChangeRequestImportColKey> = {
  maphieu: 'request_code',
  sophieu: 'request_code',
  requestcode: 'request_code',

  ngaynhanyc: 'received_at',
  ngaynhanyeucau: 'received_at',
  ngaytiepnhan: 'received_at',
  receivedat: 'received_at',
  ngaynhan: 'received_at',

  bophanyc: 'department',
  bophanyeucau: 'department',
  bophan: 'department',
  department: 'department',

  nhomxuly: 'assigned_group',
  nhom: 'assigned_group',
  assignedgroup: 'assigned_group',

  mahang: 'product_code',
  masanpham: 'product_code',
  masp: 'product_code',
  productcode: 'product_code',
  model: 'product_code',

  quycach: 'specification',
  specification: 'specification',
  spec: 'specification',

  congdoan: 'process_stage',
  processstage: 'process_stage',
  stage: 'process_stage',

  noidungyeucauthaydoi: 'content',
  noidungyeucau: 'content',
  noidung: 'content',
  content: 'content',

  tinhtrang: 'status',
  tinhtrangxuly: 'status',
  trangthai: 'status',
  status: 'status',

  ngayapdungdongiathaydoi: 'processed_at',
  ngayapdungdongia: 'processed_at',
  ngayapdung: 'processed_at',
  ngayxuly: 'processed_at',
  processedat: 'processed_at',

  phienbanapdung: 'applied_version',
  phienban: 'applied_version',
  appliedversion: 'applied_version',
  version: 'applied_version',

  ghichu: 'notes',
  notes: 'notes',
  note: 'notes',
};

export function mapChangeRequestImportHeader(
  rawHeader: unknown
): ChangeRequestImportColKey | null {
  const key = normalizeImportHeaderKey(rawHeader);
  if (!key) return null;
  return HEADER_ALIAS_MAP[key] || null;
}

export interface RawImportedChangeRequestRow {
  rowNumber: number;
  request_code: string;
  received_at_raw: unknown;
  department: string;
  assigned_group: string;
  product_code: string;
  specification: string;
  process_stage: string;
  content: string;
  status_raw: string;
  processed_at_raw: unknown;
  applied_version: string;
  notes: string;
}

export interface ParsedChangeRequestSpreadsheetResult {
  sheetName: string;
  missingRequiredColumns: string[];
  rows: RawImportedChangeRequestRow[];
}

export function parseChangeRequestSpreadsheetBuffer(
  buffer: ArrayBuffer
): ParsedChangeRequestSpreadsheetResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0] || '';
  if (!firstSheetName) {
    return {
      sheetName: '',
      missingRequiredColumns: ['NỘI DUNG YÊU CẦU THAY ĐỔI'],
      rows: [],
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
      sheetName: firstSheetName,
      missingRequiredColumns: ['NỘI DUNG YÊU CẦU THAY ĐỔI'],
      rows: [],
    };
  }

  // Scan first 12 rows to locate the actual table header row (supports Excel files with banner rows)
  let headerRowIdx = 0;
  let bestMatchedCount = -1;
  let colMap = new Map<number, ChangeRequestImportColKey>();

  const scanLimit = Math.min(matrix.length, 12);
  for (let r = 0; r < scanLimit; r++) {
    const candidateRow = Array.isArray(matrix[r]) ? matrix[r] : [];
    const candidateMap = new Map<number, ChangeRequestImportColKey>();
    candidateRow.forEach((cell, colIdx) => {
      const mapped = mapChangeRequestImportHeader(cell);
      if (mapped && !Array.from(candidateMap.values()).includes(mapped)) {
        candidateMap.set(colIdx, mapped);
      }
    });
    if (candidateMap.size > bestMatchedCount) {
      bestMatchedCount = candidateMap.size;
      headerRowIdx = r;
      colMap = candidateMap;
    }
  }

  const mappedKeys = new Set(colMap.values());
  const missingRequiredColumns: string[] = [];
  if (!mappedKeys.has('content')) {
    missingRequiredColumns.push('NỘI DUNG YÊU CẦU THAY ĐỔI');
  }
  if (!mappedKeys.has('department')) {
    missingRequiredColumns.push('BỘ PHẬN YC');
  }

  if (missingRequiredColumns.length > 0) {
    return {
      sheetName: firstSheetName,
      missingRequiredColumns,
      rows: [],
    };
  }

  const rows: RawImportedChangeRequestRow[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const rawRow = Array.isArray(matrix[r]) ? matrix[r] : [];
    const draft: RawImportedChangeRequestRow = {
      rowNumber: r + 1,
      request_code: '',
      received_at_raw: '',
      department: '',
      assigned_group: '',
      product_code: '',
      specification: '',
      process_stage: '',
      content: '',
      status_raw: '',
      processed_at_raw: '',
      applied_version: '',
      notes: '',
    };

    let hasAnyValue = false;
    colMap.forEach((key, colIdx) => {
      const cell = rawRow[colIdx];
      const text = normalizeCellText(cell);
      if (text) hasAnyValue = true;
      switch (key) {
        case 'request_code':
          draft.request_code = text;
          break;
        case 'received_at':
          draft.received_at_raw = cell;
          break;
        case 'department':
          draft.department = text;
          break;
        case 'assigned_group':
          draft.assigned_group = text;
          break;
        case 'product_code':
          draft.product_code = text;
          break;
        case 'specification':
          draft.specification = text;
          break;
        case 'process_stage':
          draft.process_stage = text;
          break;
        case 'content':
          draft.content = text;
          break;
        case 'status':
          draft.status_raw = text;
          break;
        case 'processed_at':
          draft.processed_at_raw = cell;
          break;
        case 'applied_version':
          draft.applied_version = text;
          break;
        case 'notes':
          draft.notes = text;
          break;
      }
    });

    if (!hasAnyValue) continue;
    // Skip summary/total rows commonly placed at bottom of Excel logs
    const lowerDept = draft.department.toLowerCase();
    const lowerContent = draft.content.toLowerCase();
    if (
      (lowerDept === 'tổng cộng' || lowerDept === 'tổng') &&
      !draft.product_code
    ) {
      continue;
    }
    if (!draft.content && !draft.department && !draft.product_code) continue;
    if (lowerContent.startsWith('tổng cộng') && !draft.department) continue;

    rows.push(draft);
  }

  return {
    sheetName: firstSheetName,
    missingRequiredColumns: [],
    rows,
  };
}

export interface ValidatedImportedChangeRequestRow {
  rowNumber: number;
  request_code: string;
  received_at: string;
  department: string;
  assigned_group: string;
  product_code: string;
  specification: string;
  process_stage: string | null;
  content: string;
  status: StChangeRequestStatus;
  processed_at: string | null;
  applied_version: string | null;
  notes: string | null;
  isValid: boolean;
  errors: string[];
}

export function validateImportedChangeRequestRows(
  rawRows: RawImportedChangeRequestRow[],
  products: StProduct[],
  existingRequests: StChangeRequest[],
  defaultDepartment: string = 'Sản xuất',
  defaultAssignedGroup: string = 'ST',
  todayIso: string = getLocalIsoDateToday()
): ValidatedImportedChangeRequestRow[] {
  const productByCode = new Map<string, StProduct>();
  for (const p of products) {
    const key = p.product_code.trim().toLowerCase();
    if (key) productByCode.set(key, p);
  }

  // Track generated request codes per (received_at + department) for rows missing Mã phiếu
  const generatedCodeByGroupKey = new Map<string, string>();
  const syntheticExisting = [...existingRequests];

  return rawRows.map((row) => {
    const errors: string[] = [];

    const parsedReceived = parseSpreadsheetDateCell(row.received_at_raw);
    if (parsedReceived.invalid) {
      errors.push('Ngày nhận YC không hợp lệ');
    }
    const received_at = parsedReceived.iso || todayIso;

    const department = row.department.trim() || defaultDepartment.trim();
    if (!department) {
      errors.push('Thiếu Bộ phận YC');
    }

    const content = row.content.trim();
    if (!content) {
      errors.push('Thiếu Nội dung yêu cầu thay đổi');
    }

    const parsedProcessed = parseSpreadsheetDateCell(row.processed_at_raw);
    if (parsedProcessed.invalid) {
      errors.push('Ngày áp dụng đơn giá không hợp lệ');
    }
    const processed_at = parsedProcessed.iso || null;

    const cleanCode =
      row.product_code.trim() === '—' ? '' : row.product_code.trim();
    const matchedProd = cleanCode
      ? productByCode.get(cleanCode.toLowerCase())
      : undefined;
    const specification =
      (row.specification.trim() === '—' ? '' : row.specification.trim()) ||
      matchedProd?.specification ||
      '';

    const process_stage = normalizeChangeRequestProcessStage(row.process_stage);
    const status = normalizeStChangeRequestStatus(row.status_raw);
    const assigned_group =
      row.assigned_group.trim() || defaultAssignedGroup.trim() || 'ST';

    let request_code = row.request_code.trim();
    if (!request_code) {
      const groupKey = `${received_at}__${department.toLowerCase()}`;
      const existingGen = generatedCodeByGroupKey.get(groupKey);
      if (existingGen) {
        request_code = existingGen;
      } else {
        request_code = generateNextRequestCode(syntheticExisting, received_at);
        generatedCodeByGroupKey.set(groupKey, request_code);
        syntheticExisting.push({
          id: `tmp-${row.rowNumber}`,
          request_code,
          department,
          assigned_group,
          process_stage,
          content,
          received_at,
          product_code: cleanCode,
          specification,
          status,
          processed_at,
          applied_version: null,
          notes: null,
          created_at: '',
          updated_at: '',
        });
      }
    }

    return {
      rowNumber: row.rowNumber,
      request_code,
      received_at,
      department,
      assigned_group,
      product_code: cleanCode,
      specification,
      process_stage,
      content,
      status,
      processed_at,
      applied_version:
        row.applied_version.trim() && row.applied_version.trim() !== '—'
          ? row.applied_version.trim()
          : null,
      notes:
        row.notes.trim() && row.notes.trim() !== '—' ? row.notes.trim() : null,
      isValid: errors.length === 0,
      errors,
    };
  });
}

export function buildSampleChangeRequestExcelArrayBuffer(
  todayIso: string = getLocalIsoDateToday()
): ArrayBuffer {
  const [y, m, d] = todayIso.split('-');
  const todayVN = `${d}/${m}/${y}`;
  const compactDate = todayIso.replace(/-/g, '');
  const sampleCode = `YC-${compactDate}-01`;

  const aoa: unknown[][] = [
    [...ST_CHANGE_REQUEST_IMPORT_HEADERS],
    [
      sampleCode,
      todayVN,
      'Sản xuất',
      'ST',
      '3324250105AD-HCM',
      'EE4716',
      'ASSEMBLY',
      'Thay đổi thao tác lắp lõi và cập nhật ST công đoạn ASSEMBLY',
      'Đang kiểm tra',
      '',
      '',
      'Kiểm tra thực tế tại chuyền',
    ],
    [
      sampleCode,
      todayVN,
      'Sản xuất',
      'ST',
      'ALL MODEL',
      'Rotor line',
      'WINDING',
      'Điều chỉnh tốc độ máy quấn dây toàn bộ mã hàng Rotor line',
      'Đã thay đổi',
      todayVN,
      'A22',
      'Đã cập nhật đơn giá A22',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 15 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 44 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 26 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nhat ky Phieu YC');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as
    | ArrayBuffer
    | ArrayBufferView;
  if (out instanceof ArrayBuffer) {
    return out;
  }
  const copy = new Uint8Array(out.byteLength);
  copy.set(new Uint8Array(out.buffer, out.byteOffset, out.byteLength));
  return copy.buffer;
}
