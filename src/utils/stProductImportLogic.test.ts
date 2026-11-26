import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildSampleProductsExcelArrayBuffer,
  parseProductsSpreadsheetBuffer,
  ST_IMPORT_SAMPLE_HEADERS,
  ST_IMPORT_SAMPLE_ROWS,
  summarizeImportPreview,
  validateImportedProductRows,
} from './stProductImportLogic';
import { StCustomer, StLine, StProduct } from './stWorkLogic';

const mockLines: StLine[] = [
  { id: 'l1', name: 'S', description: null, sort_order: 1, created_at: '' },
  { id: 'l2', name: 'M', description: null, sort_order: 2, created_at: '' },
];

const mockCustomers: StCustomer[] = [
  { id: 'c1', short_name: 'POWERNET', full_name: 'Powernet', notes: null, created_at: '' },
  { id: 'c2', short_name: 'DONGYANG', full_name: 'Dongyang', notes: null, created_at: '' },
];

const mockExistingProducts: StProduct[] = [
  {
    id: 'p1',
    line_name: 'S',
    customer_short_name: 'POWERNET',
    product_name: 'L55S7_FVD_LED',
    product_code: '1421189-A70',
    specification: 'EED1412V',
    image_url: null,
    created_at: '2026-11-20T00:00:00.000Z',
    updated_at: '2026-11-20T00:00:00.000Z',
  },
];

test('buildSampleProductsExcelArrayBuffer generates 6 standard columns and 2 sample rows', () => {
  const buf = buildSampleProductsExcelArrayBuffer();
  const parsed = parseProductsSpreadsheetBuffer(buf, 'mau_danh_muc_san_pham.xlsx');
  assert.deepEqual(parsed.missingRequiredColumns, []);
  assert.equal(parsed.detectedColumns.length, ST_IMPORT_SAMPLE_HEADERS.length);
  assert.equal(parsed.rows.length, ST_IMPORT_SAMPLE_ROWS.length);
  assert.equal(parsed.rows[0].line_name, 'S');
  assert.equal(parsed.rows[0].customer_short_name, 'POWERNET');
  assert.equal(parsed.rows[0].product_code, '1421190-A01');
  assert.equal(parsed.rows[1].product_code, 'DY-2045-B02');
});

test('parseProductsSpreadsheetBuffer detects headers ignoring case, accents, and extra spaces', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['  line  ', ' KHÁCH HÀNG ', '  ma   hang * ', 'tên   hàng', 'QUY CACH', ' ghi chu '],
    [' s ', ' powernet ', ' NEW-001 ', '  Sản phẩm 1  ', '  SPEC-1 ', '  Ghi chú 1 '],
    [' U2 ', ' SAMSUNG ', ' 1421189-a70 ', '  Cập nhật tên ', '  NEW-SPEC ', ''],
    [' M ', ' DONGYANG ', '', ' Thiếu mã ', ' SPEC-3 ', ''],
    [' M ', ' DONGYANG ', ' NO-NAME-1 ', '', ' SPEC-4 ', ''],
    [' S ', ' POWERNET ', 'new-001', ' Trùng trong file ', ' SPEC-5 ', ''],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = parseProductsSpreadsheetBuffer(out, 'test.xlsx');
  assert.deepEqual(parsed.missingRequiredColumns, []);
  assert.equal(parsed.rows.length, 5);

  const preview = validateImportedProductRows(parsed.rows, {
    existingProducts: mockExistingProducts,
    lines: mockLines,
    customers: mockCustomers,
  });

  // Row 1: valid + normalized canonical Line 'S' and Customer 'POWERNET'
  assert.equal(preview[0].status, 'valid');
  assert.equal(preview[0].line_name, 'S');
  assert.equal(preview[0].customer_short_name, 'POWERNET');
  assert.equal(preview[0].product_code, 'NEW-001');

  // Row 2: duplicate against existing product (case-insensitive) + preserves new Line/Customer
  assert.equal(preview[1].status, 'duplicate');
  assert.equal(preview[1].line_name, 'U2');
  assert.equal(preview[1].customer_short_name, 'SAMSUNG');
  assert.equal(preview[1].existingProduct?.id, 'p1');

  // Row 3: error (missing product_code)
  assert.equal(preview[2].status, 'error');
  assert.ok(preview[2].errorReason?.includes('Mã hàng'));

  // Row 4: error (missing product_name)
  assert.equal(preview[3].status, 'error');
  assert.ok(preview[3].errorReason?.includes('Tên hàng'));

  // Row 5: error (intra-file duplicate)
  assert.equal(preview[4].status, 'error');
  assert.ok(preview[4].errorReason?.includes('dòng 2'));

  const skipSummary = summarizeImportPreview(preview, 'skip');
  assert.deepEqual(skipSummary, {
    total: 5,
    validCount: 1,
    duplicateCount: 1,
    errorCount: 3,
    willInsertCount: 1,
    willUpdateCount: 0,
    actionableCount: 1,
  });

  const overwriteSummary = summarizeImportPreview(preview, 'overwrite');
  assert.deepEqual(overwriteSummary, {
    total: 5,
    validCount: 1,
    duplicateCount: 1,
    errorCount: 3,
    willInsertCount: 1,
    willUpdateCount: 1,
    actionableCount: 2,
  });
});

test('parseProductsSpreadsheetBuffer parses UTF-8 CSV with BOM', () => {
  const csv =
    '\uFEFFLine,Khách hàng,Mã hàng,Tên hàng,Quy cách,Ghi chú\n' +
    'U1,SOLUM,CSV-900,Cuộn dây thử nghiệm,PQ3220,Nhập từ CSV\n';
  const buf = new TextEncoder().encode(csv).buffer;
  const parsed = parseProductsSpreadsheetBuffer(buf, 'import.csv');
  assert.deepEqual(parsed.missingRequiredColumns, []);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].line_name, 'U1');
  assert.equal(parsed.rows[0].product_name, 'Cuộn dây thử nghiệm');
  assert.equal(parsed.rows[0].notes, 'Nhập từ CSV');
});
