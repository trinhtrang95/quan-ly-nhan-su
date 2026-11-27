import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildSampleProgressExcelArrayBuffer,
  parseProgressSpreadsheetBuffer,
  parseSpreadsheetDateCell,
  parseStageCellValue,
  ST_PROGRESS_IMPORT_HEADERS,
  validateImportedProgressRows,
} from './stProgressImportLogic';
import { mergeProductsWithStatus, StNewProductStatus, StProduct } from './stWorkLogic';

const mockProducts: StProduct[] = [
  {
    id: 'p1',
    line_name: 'S',
    customer_short_name: 'POWERNET',
    product_name: 'Prod 1',
    product_code: '1421189-A70',
    specification: 'EED1412V',
    image_url: null,
    created_at: '2026-01-05T00:00:00.000Z',
    updated_at: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'p2',
    line_name: 'U1',
    customer_short_name: 'FRIWO',
    product_name: 'Prod 2',
    product_code: '20007921',
    specification: 'EQ33.2',
    image_url: null,
    created_at: '2026-02-10T00:00:00.000Z',
    updated_at: '2026-02-10T00:00:00.000Z',
  },
];

const mockStatuses: StNewProductStatus[] = [
  {
    id: 's1',
    product_id: 'p1',
    has_process_erp: true,
    process_erp_date: '2026-11-23',
    has_stage_win: true,
    stage_win_date: '2026-11-24',
    has_st: false,
    st_date: null,
    notes: null,
    updated_at: '2026-11-24T00:00:00.000Z',
  },
];

const mockMerged = mergeProductsWithStatus(mockProducts, mockStatuses);

test('parseSpreadsheetDateCell parses dd/mm/yyyy, ISO yyyy-mm-dd, and Excel serial numbers cleanly', () => {
  assert.deepEqual(parseSpreadsheetDateCell('25/11/2026'), {
    iso: '2026-11-25',
    invalid: false,
  });
  assert.deepEqual(parseSpreadsheetDateCell('5-1-2026'), {
    iso: '2026-01-05',
    invalid: false,
  });
  assert.deepEqual(parseSpreadsheetDateCell('2026-11-26'), {
    iso: '2026-11-26',
    invalid: false,
  });
  // Excel serial 46351 => 2026-11-25
  assert.deepEqual(parseSpreadsheetDateCell(46351), {
    iso: '2026-11-25',
    invalid: false,
  });
  assert.deepEqual(parseSpreadsheetDateCell(''), {
    iso: null,
    invalid: false,
  });
  assert.deepEqual(parseSpreadsheetDateCell('31/02/2026'), {
    iso: null,
    invalid: true,
  });
});

test('parseStageCellValue supports dates, x/✓/1/có markers, and empty/dash states', () => {
  assert.deepEqual(parseStageCellValue('24/11/2026', '2026-11-26'), {
    done: true,
    date: '2026-11-24',
    invalid: false,
  });
  assert.deepEqual(parseStageCellValue('x', '2026-11-26'), {
    done: true,
    date: '2026-11-26',
    invalid: false,
  });
  assert.deepEqual(parseStageCellValue('✓', '2026-11-26'), {
    done: true,
    date: '2026-11-26',
    invalid: false,
  });
  assert.deepEqual(parseStageCellValue('', '2026-11-26'), {
    done: false,
    date: null,
    invalid: false,
  });
  assert.deepEqual(parseStageCellValue('invalid-val', '2026-11-26'), {
    done: false,
    date: null,
    invalid: true,
  });
});

test('buildSampleProgressExcelArrayBuffer exports existing codes with 10 columns and round-trips', () => {
  const buf = buildSampleProgressExcelArrayBuffer(mockMerged);
  const parsed = parseProgressSpreadsheetBuffer(buf, 'mau_tien_do.xlsx');
  assert.deepEqual(parsed.missingRequiredColumns, []);
  assert.equal(parsed.detectedColumns.length, ST_PROGRESS_IMPORT_HEADERS.length);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].product_code, '1421189-A70');
  assert.equal(parsed.rows[1].product_code, '20007921');
});

test('validateImportedProgressRows matches products, computes completion, and flags unknown/invalid rows', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [
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
    ],
    [
      '1421189-a70',
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
    ['20007921', '21/11/2026', 'x', 'x', '', '', '', '', '', ''],
    ['UNKNOWN-CODE', '21/11/2026', 'x', '', '', '', '', '', '', ''],
    ['20007921', '21/11/2026', 'x', '', '', '', '', '', '', ''],
    ['1421189-A70', 'bad-date', '', '', '', '', '', '', '', ''],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const parsed = parseProgressSpreadsheetBuffer(buf, 'progress.xlsx');

  const preview = validateImportedProgressRows(
    parsed.rows,
    mockMerged,
    '2026-11-26'
  );
  assert.equal(preview.length, 5);

  // Row 1: 100% + ST date -> Hoàn thành
  assert.equal(preview[0].status, 'valid');
  assert.equal(preview[0].product_code, '1421189-A70');
  assert.equal(preview[0].stagePercentage, 100);
  assert.equal(preview[0].willBeCompleted, true);
  assert.equal(preview[0].st_date, '2026-11-26');

  // Row 2: Product (10) + QT ERP (10) + 2 stages (20) = 40% -> Đang làm
  assert.equal(preview[1].status, 'valid');
  assert.equal(preview[1].stagePercentage, 40);
  assert.equal(preview[1].willBeCompleted, false);

  // Row 3: unknown product code -> error
  assert.equal(preview[2].status, 'error');
  assert.ok(preview[2].errorReason?.includes('Danh mục sản phẩm'));

  // Row 4: intra-file duplicate -> error
  assert.equal(preview[3].status, 'error');
  assert.ok(preview[3].errorReason?.includes('dòng 3'));

  // Row 5: intra-file duplicate OR bad date -> error
  assert.equal(preview[4].status, 'error');
});
