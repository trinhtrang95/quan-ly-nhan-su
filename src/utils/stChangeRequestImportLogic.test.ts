import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildSampleChangeRequestExcelArrayBuffer,
  mapChangeRequestImportHeader,
  parseChangeRequestSpreadsheetBuffer,
  validateImportedChangeRequestRows,
} from './stChangeRequestImportLogic';
import type { StChangeRequest, StProduct } from './stWorkLogic';

describe('stChangeRequestImportLogic', () => {
  it('maps Excel log column aliases accurately', () => {
    assert.equal(mapChangeRequestImportHeader('NGÀY NHẬN YC'), 'received_at');
    assert.equal(mapChangeRequestImportHeader('BỘ PHẬN YC'), 'department');
    assert.equal(mapChangeRequestImportHeader('MÃ HÀNG'), 'product_code');
    assert.equal(mapChangeRequestImportHeader('QUY CÁCH'), 'specification');
    assert.equal(mapChangeRequestImportHeader('CÔNG ĐOẠN'), 'process_stage');
    assert.equal(
      mapChangeRequestImportHeader('NỘI DUNG YÊU CẦU THAY ĐỔI'),
      'content'
    );
    assert.equal(mapChangeRequestImportHeader('TÌNH TRẠNG'), 'status');
    assert.equal(
      mapChangeRequestImportHeader('NGÀY ÁP DỤNG ĐƠN GIÁ THAY ĐỔI'),
      'processed_at'
    );
    assert.equal(
      mapChangeRequestImportHeader('PHIÊN BẢN ÁP DỤNG'),
      'applied_version'
    );
    assert.equal(mapChangeRequestImportHeader('GHI CHÚ'), 'notes');
  });

  it('builds valid sample workbook and parses rows while skipping top title banners', () => {
    const sampleBuffer = buildSampleChangeRequestExcelArrayBuffer();
    const parsedSample = parseChangeRequestSpreadsheetBuffer(sampleBuffer);
    assert.deepEqual(parsedSample.missingRequiredColumns, []);
    assert.equal(parsedSample.rows.length, 2);
    assert.equal(parsedSample.rows[0].department, 'Sản xuất');
    assert.equal(parsedSample.rows[0].product_code, '3324250105AD-HCM');
    assert.equal(parsedSample.rows[1].product_code, 'ALL MODEL');

    // Create a realistic Excel file with 2 banner rows above the table header
    const wb = XLSX.utils.book_new();
    const sheetRows = [
      ['NHẬT KÝ PHIẾU YÊU CẦU THAY ĐỔI QUY TRÌNH, ST 2026'],
      ['Bộ phận Kỹ thuật - Nhóm ST'],
      [
        'STT',
        'NGÀY NHẬN YC',
        'BỘ PHẬN YC',
        'MÃ HÀNG',
        'QUY CÁCH',
        'CÔNG ĐOẠN',
        'NỘI DUNG YÊU CẦU THAY ĐỔI',
        'TÌNH TRẠNG',
        'NGÀY ÁP DỤNG ĐƠN GIÁ THAY ĐỔI',
        'PHIÊN BẢN ÁP DỤNG',
        'GHI CHÚ',
      ],
      [
        1,
        '20/11/2026',
        'Sản xuất',
        '49013-029',
        '',
        'win',
        'Cập nhật thao tác quấn dây',
        'Đã thay đổi',
        '22/11/2026',
        'A22',
        'Đã đồng bộ ERP',
      ],
      [
        2,
        '20/11/2026',
        'QC',
        'ALL MODEL',
        'Rotor line',
        'FIN',
        'Kiểm tra lại tiêu chuẩn cuối',
        'Đang kiểm tra',
        '',
        '',
        '',
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Nhat ky');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const parsedBanner = parseChangeRequestSpreadsheetBuffer(buf);
    assert.deepEqual(parsedBanner.missingRequiredColumns, []);
    assert.equal(parsedBanner.rows.length, 2);
    assert.equal(parsedBanner.rows[0].rowNumber, 4);

    const catalog: StProduct[] = [
      {
        id: 'p1',
        line_name: 'Line 1',
        customer_short_name: 'CUST',
        product_name: 'SP 49013-029',
        product_code: '49013-029',
        specification: 'EE4716-AUTO',
        image_url: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];
    const existing: StChangeRequest[] = [
      {
        id: 'ex-1',
        request_code: 'YC-20261120-01',
        department: 'Sản xuất',
        assigned_group: 'ST',
        process_stage: 'WINDING',
        content: 'Phiếu cũ cùng ngày',
        received_at: '2026-11-20',
        product_code: 'X',
        specification: 'Y',
        status: 'Đang kiểm tra',
        processed_at: null,
        applied_version: null,
        notes: null,
        created_at: '2026-11-20T00:00:00Z',
        updated_at: '2026-11-20T00:00:00Z',
      },
    ];

    const validated = validateImportedChangeRequestRows(
      parsedBanner.rows,
      catalog,
      existing,
      'Sản xuất',
      'ST'
    );
    assert.equal(validated.length, 2);
    assert.equal(validated[0].isValid, true);
    assert.equal(validated[0].received_at, '2026-11-20');
    assert.equal(validated[0].specification, 'EE4716-AUTO');
    assert.equal(validated[0].process_stage, 'WINDING');
    assert.equal(validated[0].status, 'Đã thay đổi');
    assert.equal(validated[0].processed_at, '2026-11-22');
    assert.equal(validated[0].applied_version, 'A22');
    assert.equal(validated[0].request_code, 'YC-20261120-02');

    assert.equal(validated[1].isValid, true);
    assert.equal(validated[1].process_stage, 'FINAL CHECK');
    assert.equal(validated[1].request_code, 'YC-20261120-03');
  });
});
