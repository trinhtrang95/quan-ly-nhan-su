import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRealtimeStRow,
  calculateCompletionDays,
  computeStOverviewMetrics,
  computeStReportComparison,
  isNewProductCompleted,
  mergeProductsWithStatus,
  normalizeStChangeRequestRow,
  normalizeStNewProductStatusRow,
  normalizeStProductRow,
  resolveOverviewPeriodRange,
  resolveReportPeriodRange,
  type StChangeRequest,
  type StCustomerQuote,
  type StNewProductStatus,
  type StProduct,
} from './stWorkLogic';
import { buildStReportWorkbook } from './stWorkExportService';

describe('stWorkLogic pure calculations', () => {
  it('enforces completion rule: completed only when has_process is true AND price_applied_at is present', () => {
    assert.equal(isNewProductCompleted(null), false);
    assert.equal(
      isNewProductCompleted({ has_process: false, price_applied_at: '2026-10-15' }),
      false
    );
    assert.equal(
      isNewProductCompleted({ has_process: true, price_applied_at: null }),
      false
    );
    assert.equal(
      isNewProductCompleted({ has_process: true, price_applied_at: '2026-10-15' }),
      true
    );
  });

  it('calculates completion days accurately between registration date and price_applied_at', () => {
    assert.equal(
      calculateCompletionDays('2026-10-01T08:30:00.000Z', '2026-10-11'),
      10
    );
    assert.equal(
      calculateCompletionDays('2026-10-10', '2026-10-10'),
      0
    );
    assert.equal(calculateCompletionDays('2026-10-15', '2026-10-10'), 0);
    assert.equal(calculateCompletionDays('2026-10-01', null), null);
  });

  it('resolves overview periods for last_month, this_month, and custom month/year', () => {
    const ref = new Date('2026-11-25T10:00:00+07:00');
    const lastMonth = resolveOverviewPeriodRange('last_month', 2026, 11, ref);
    assert.equal(lastMonth.currentStart, '2026-10-01');
    assert.equal(lastMonth.currentEnd, '2026-10-31');
    assert.equal(lastMonth.prevStart, '2026-09-01');
    assert.equal(lastMonth.prevEnd, '2026-09-30');
    assert.equal(lastMonth.currentLabel, 'Tháng 10/2026');

    const thisMonth = resolveOverviewPeriodRange('this_month', 2026, 11, ref);
    assert.equal(thisMonth.currentStart, '2026-11-01');
    assert.equal(thisMonth.currentEnd, '2026-11-30');
    assert.equal(thisMonth.prevStart, '2026-10-01');
    assert.equal(thisMonth.prevEnd, '2026-10-31');

    const janCustom = resolveOverviewPeriodRange('custom', 2026, 1, ref);
    assert.equal(janCustom.currentStart, '2026-01-01');
    assert.equal(janCustom.currentEnd, '2026-01-31');
    assert.equal(janCustom.prevStart, '2025-12-01');
    assert.equal(janCustom.prevEnd, '2025-12-31');
  });

  it('resolves report periods for single day, day range, month, and year', () => {
    const daySingle = resolveReportPeriodRange('day', {
      dayMode: 'single',
      singleDay: '2026-10-15',
      year: 2026,
      month: 10,
    });
    assert.equal(daySingle.currentStart, '2026-10-15');
    assert.equal(daySingle.currentEnd, '2026-10-15');
    assert.equal(daySingle.prevStart, '2026-10-14');
    assert.equal(daySingle.prevEnd, '2026-10-14');

    const dayRange = resolveReportPeriodRange('day', {
      dayMode: 'range',
      rangeStart: '2026-10-10',
      rangeEnd: '2026-10-12',
      year: 2026,
      month: 10,
    });
    assert.equal(dayRange.currentStart, '2026-10-10');
    assert.equal(dayRange.currentEnd, '2026-10-12');
    assert.equal(dayRange.prevStart, '2026-10-07');
    assert.equal(dayRange.prevEnd, '2026-10-09');

    const yearMode = resolveReportPeriodRange('year', {
      year: 2026,
      month: 10,
    });
    assert.equal(yearMode.currentStart, '2026-01-01');
    assert.equal(yearMode.currentEnd, '2026-12-31');
    assert.equal(yearMode.prevStart, '2025-01-01');
    assert.equal(yearMode.prevEnd, '2025-12-31');
  });

  it('computes overview KPIs, deltas, breakdowns, and comparison rows from real records', () => {
    const products: StProduct[] = [
      {
        id: 'p1',
        line_name: 'S Line',
        customer_short_name: 'SAMSUNG',
        product_name: 'Module A',
        product_code: 'ST-001',
        specification: '10x20mm',
        image_url: null,
        created_at: '2026-10-01T02:00:00.000Z',
        updated_at: '2026-10-11T02:00:00.000Z',
      },
      {
        id: 'p2',
        line_name: 'M Line',
        customer_short_name: 'LG',
        product_name: 'Module B',
        product_code: 'ST-002',
        specification: '15x30mm',
        image_url: null,
        created_at: '2026-10-05T02:00:00.000Z',
        updated_at: '2026-10-25T02:00:00.000Z',
      },
      {
        id: 'p3',
        line_name: 'C1 Line',
        customer_short_name: 'SAMSUNG',
        product_name: 'Module C',
        product_code: 'ST-003',
        specification: '20x40mm',
        image_url: null,
        created_at: '2026-10-10T02:00:00.000Z',
        updated_at: '2026-10-12T02:00:00.000Z',
      },
      {
        id: 'p4',
        line_name: 'E Line',
        customer_short_name: 'LG',
        product_name: 'Module D',
        product_code: 'ST-004',
        specification: '5x10mm',
        image_url: null,
        created_at: '2026-09-01T02:00:00.000Z',
        updated_at: '2026-09-15T02:00:00.000Z',
      },
    ];

    const statuses: StNewProductStatus[] = [
      {
        id: 's1',
        product_id: 'p1',
        has_process: true,
        process_created_at: '2026-10-05',
        has_unit_price: true,
        unit_price: 12000,
        currency: 'VND',
        price_created_at: '2026-10-09',
        price_applied_at: '2026-10-11',
        notes: null,
        updated_at: '2026-10-11T02:00:00.000Z',
      },
      {
        id: 's2',
        product_id: 'p2',
        has_process: true,
        process_created_at: '2026-10-08',
        has_unit_price: true,
        unit_price: 25000,
        currency: 'VND',
        price_created_at: '2026-10-20',
        price_applied_at: '2026-10-25',
        notes: null,
        updated_at: '2026-10-25T02:00:00.000Z',
      },
      {
        id: 's3',
        product_id: 'p3',
        has_process: true,
        process_created_at: '2026-10-12',
        has_unit_price: false,
        unit_price: null,
        currency: 'VND',
        price_created_at: null,
        price_applied_at: null,
        notes: 'Chờ đơn giá',
        updated_at: '2026-10-12T02:00:00.000Z',
      },
      {
        id: 's4',
        product_id: 'p4',
        has_process: true,
        process_created_at: '2026-09-05',
        has_unit_price: true,
        unit_price: 9000,
        currency: 'VND',
        price_created_at: '2026-09-10',
        price_applied_at: '2026-09-15',
        notes: null,
        updated_at: '2026-09-15T02:00:00.000Z',
      },
    ];

    const productsWithStatus = mergeProductsWithStatus(products, statuses);
    assert.equal(productsWithStatus[0].isCompleted, true);
    assert.equal(productsWithStatus[0].completionDays, 10);
    assert.equal(productsWithStatus[1].completionDays, 20);
    assert.equal(productsWithStatus[2].progressCategory, 'pending_price');

    const requests: StChangeRequest[] = [
      {
        id: 'r1',
        department: 'PE',
        content: 'Đổi kích thước lỗ',
        received_at: '2026-10-12',
        product_code: 'ST-001',
        specification: '10x20mm',
        status: 'Đã áp dụng',
        processed_at: '2026-10-14',
        applied_version: 'Rev.02',
        notes: null,
        created_at: '2026-10-12T03:00:00.000Z',
        updated_at: '2026-10-14T03:00:00.000Z',
      },
      {
        id: 'r2',
        department: 'IOT',
        content: 'Cập nhật cảm biến',
        received_at: '2026-10-18',
        product_code: 'ST-002',
        specification: '15x30mm',
        status: 'Đang xử lý',
        processed_at: null,
        applied_version: null,
        notes: null,
        created_at: '2026-10-18T03:00:00.000Z',
        updated_at: '2026-10-18T03:00:00.000Z',
      },
    ];

    const quotes: StCustomerQuote[] = [];
    const metrics = computeStOverviewMetrics({
      productsWithStatus,
      changeRequests: requests,
      quotes,
      departments: ['PE', 'IOT', 'ST'],
      currentStart: '2026-10-01',
      currentEnd: '2026-10-31',
      prevStart: '2026-09-01',
      prevEnd: '2026-09-30',
    });

    assert.equal(metrics.completedInPeriodCount, 2);
    assert.equal(metrics.completedInPrevPeriodCount, 1);
    assert.equal(metrics.completedDelta, 1);
    assert.equal(metrics.inProgressTotalCount, 1);
    assert.equal(metrics.pendingProcessCount, 0);
    assert.equal(metrics.pendingPriceCount, 1);
    assert.equal(metrics.avgCompletionDaysInPeriod, 15);
    assert.equal(metrics.requestsInPeriodCount, 2);
    assert.equal(metrics.quotesQuotedCount, 0);
    assert.equal(metrics.quotesRemainingCount, 0);

    const comparison = computeStReportComparison({
      productsWithStatus,
      changeRequests: requests,
      quotes,
      currentStart: '2026-10-01',
      currentEnd: '2026-10-31',
      prevStart: '2026-09-01',
      prevEnd: '2026-09-30',
    });
    const completedRow = comparison.find((r) => r.key === 'mass_production_completed');
    assert.ok(completedRow);
    assert.equal(completedRow.currentValue, 2);
    assert.equal(completedRow.previousValue, 1);
    assert.equal(completedRow.delta, 1);

    const periodRange = resolveOverviewPeriodRange('custom', 2026, 10);
    const workbook = buildStReportWorkbook({
      periodRange,
      comparisonRows: comparison,
      productsWithStatus,
      changeRequests: requests,
      customerQuotes: quotes,
    });
    assert.deepEqual(
      workbook.worksheets.map((ws) => ws.name),
      ['Tổng hợp', 'Mã hàng mới', 'Phiếu yêu cầu', 'Báo giá khách hàng']
    );
    for (const ws of workbook.worksheets) {
      assert.equal(ws.views[0].state, 'frozen');
      assert.equal(ws.views[0].ySplit, 3);
      assert.ok(ws.autoFilter);
      assert.ok((ws.getColumn(2).width || 0) >= 8);
    }
  });

  it('normalizes Supabase rows and applies Realtime INSERT/UPDATE/DELETE cleanly', () => {
    let products: StProduct[] = [];
    products = applyRealtimeStRow(
      products,
      {
        eventType: 'INSERT',
        newRow: {
          id: 'prod-1',
          line_name: 'S Line',
          customer_short_name: 'SAMSUNG',
          product_name: 'Bracket A',
          product_code: 'BRK-01',
          specification: 'SUS304 1.2T',
          image_url: null,
          created_at: '2026-11-25T01:00:00Z',
          updated_at: '2026-11-25T01:00:00Z',
        },
        oldRow: null,
      },
      normalizeStProductRow
    );
    assert.equal(products.length, 1);
    assert.equal(products[0].product_code, 'BRK-01');

    let statuses: StNewProductStatus[] = [];
    statuses = applyRealtimeStRow(
      statuses,
      {
        eventType: 'UPDATE',
        newRow: {
          id: 'st-1',
          product_id: 'prod-1',
          has_process: true,
          process_created_at: '2026-11-25',
          has_unit_price: true,
          unit_price: '15000',
          currency: 'VND',
          price_created_at: '2026-11-25',
          price_applied_at: '2026-11-25',
          notes: 'Done',
          updated_at: '2026-11-25T02:00:00Z',
        },
        oldRow: null,
      },
      normalizeStNewProductStatusRow
    );
    assert.equal(statuses[0].unit_price, 15000);
    assert.equal(isNewProductCompleted(statuses[0]), true);

    let reqs: StChangeRequest[] = [];
    reqs = applyRealtimeStRow(
      reqs,
      {
        eventType: 'INSERT',
        newRow: {
          id: 'cr-1',
          department: 'PE',
          content: 'Sửa bản vẽ',
          received_at: '2026-11-25',
          product_code: 'BRK-01',
          specification: 'SUS304 1.2T',
          status: 'Chờ duyệt',
        },
        oldRow: null,
      },
      normalizeStChangeRequestRow
    );
    assert.equal(reqs[0].status, 'Chờ duyệt');

    reqs = applyRealtimeStRow(
      reqs,
      { eventType: 'DELETE', newRow: null, oldRow: { id: 'cr-1' } },
      normalizeStChangeRequestRow
    );
    assert.equal(reqs.length, 0);
  });
});
