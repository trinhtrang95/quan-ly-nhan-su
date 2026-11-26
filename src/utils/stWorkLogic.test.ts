import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRealtimeStRow,
  calculateCompletionDays,
  computeStOverviewMetrics,
  computeStReportComparison,
  encodeStepsIntoNotes,
  getNewProductWaitingLabel,
  getPendingWorkflowStep,
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

function buildFullSixStepStatus(
  overrides: Partial<StNewProductStatus> = {}
): StNewProductStatus {
  return {
    id: 'st-default',
    product_id: 'p-default',
    has_quote: true,
    quote_date: '2026-10-02',
    has_bom_erp: true,
    bom_erp_date: '2026-10-04',
    has_spec_erp: true,
    spec_erp_date: '2026-10-06',
    has_khsx: true,
    khsx_date: '2026-10-08',
    has_process_erp: true,
    process_erp_date: '2026-10-10',
    has_st: true,
    st_date: '2026-10-11',
    notes: null,
    updated_at: '2026-10-11T02:00:00.000Z',
    ...overrides,
  };
}

describe('stWorkLogic 6-step sequential pipeline calculations', () => {
  it('enforces completion rule: completed only when ALL 6 steps AND st_date are present', () => {
    assert.equal(isNewProductCompleted(null), false);

    // Missing step 1 (quote) even if later steps are checked
    assert.equal(
      isNewProductCompleted(
        buildFullSixStepStatus({ has_quote: false, quote_date: null })
      ),
      false
    );

    // Missing step 4 (khsx)
    assert.equal(
      isNewProductCompleted(
        buildFullSixStepStatus({ has_khsx: false, khsx_date: null })
      ),
      false
    );

    // Missing step 6 (st) or st_date
    assert.equal(
      isNewProductCompleted(
        buildFullSixStepStatus({ has_st: false, st_date: null })
      ),
      false
    );
    assert.equal(
      isNewProductCompleted(
        buildFullSixStepStatus({ has_st: true, st_date: null })
      ),
      false
    );

    // All 6 steps + st_date present -> completed
    assert.equal(isNewProductCompleted(buildFullSixStepStatus()), true);
  });

  it('identifies the exact waiting step across all 6 sequential stages', () => {
    assert.equal(getPendingWorkflowStep(null)?.key, 'quote');
    assert.equal(getNewProductWaitingLabel(null), 'Chờ Báo giá');

    const step2 = buildFullSixStepStatus({
      has_bom_erp: false,
      bom_erp_date: null,
      has_spec_erp: false,
      has_khsx: false,
      has_process_erp: false,
      has_st: false,
      st_date: null,
    });
    assert.equal(getPendingWorkflowStep(step2)?.key, 'bom_erp');
    assert.equal(getNewProductWaitingLabel(step2), 'Chờ BOM ERP');

    const step3 = buildFullSixStepStatus({
      has_spec_erp: false,
      spec_erp_date: null,
      has_khsx: false,
      has_process_erp: false,
      has_st: false,
      st_date: null,
    });
    assert.equal(getPendingWorkflowStep(step3)?.key, 'spec_erp');
    assert.equal(getNewProductWaitingLabel(step3), 'Chờ SPEC ERP');

    const step4 = buildFullSixStepStatus({
      has_khsx: false,
      khsx_date: null,
      has_process_erp: false,
      has_st: false,
      st_date: null,
    });
    assert.equal(getPendingWorkflowStep(step4)?.key, 'khsx');
    assert.equal(getNewProductWaitingLabel(step4), 'Chờ KHSX');

    const step5 = buildFullSixStepStatus({
      has_process_erp: false,
      process_erp_date: null,
      has_st: false,
      st_date: null,
    });
    assert.equal(getPendingWorkflowStep(step5)?.key, 'process_erp');
    assert.equal(getNewProductWaitingLabel(step5), 'Chờ Quy trình ERP');

    const step6 = buildFullSixStepStatus({
      has_st: false,
      st_date: null,
    });
    assert.equal(getPendingWorkflowStep(step6)?.key, 'st');
    assert.equal(getNewProductWaitingLabel(step6), 'Chờ ST');

    const done = buildFullSixStepStatus();
    assert.equal(getPendingWorkflowStep(done), null);
    assert.equal(getNewProductWaitingLabel(done), 'Hoàn thành SX đại trà');
  });

  it('calculates completion days accurately between registration date and st_date', () => {
    assert.equal(
      calculateCompletionDays('2026-10-01T08:30:00.000Z', '2026-10-11'),
      10
    );
    assert.equal(calculateCompletionDays('2026-10-10', '2026-10-10'), 0);
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

  it('computes overview KPIs with 6 waiting-stage counts, comparison rows, and 16-col Excel Sheet 2', () => {
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
      {
        id: 'p5',
        line_name: 'S Line',
        customer_short_name: 'LG',
        product_name: 'Module E',
        product_code: 'ST-005',
        specification: '8x12mm',
        image_url: null,
        created_at: '2026-10-18T02:00:00.000Z',
        updated_at: '2026-10-18T02:00:00.000Z',
      },
    ];

    const statuses: StNewProductStatus[] = [
      buildFullSixStepStatus({
        id: 's1',
        product_id: 'p1',
        process_erp_date: '2026-10-05',
        st_date: '2026-10-11',
      }),
      buildFullSixStepStatus({
        id: 's2',
        product_id: 'p2',
        process_erp_date: '2026-10-08',
        st_date: '2026-10-25',
      }),
      buildFullSixStepStatus({
        id: 's3',
        product_id: 'p3',
        has_khsx: false,
        khsx_date: null,
        has_process_erp: false,
        process_erp_date: null,
        has_st: false,
        st_date: null,
        notes: 'Chờ KHSX phân bổ',
      }),
      buildFullSixStepStatus({
        id: 's4',
        product_id: 'p4',
        quote_date: '2026-09-02',
        bom_erp_date: '2026-09-04',
        spec_erp_date: '2026-09-06',
        khsx_date: '2026-09-08',
        process_erp_date: '2026-09-10',
        st_date: '2026-09-15',
      }),
      buildFullSixStepStatus({
        id: 's5',
        product_id: 'p5',
        has_quote: false,
        quote_date: null,
        has_bom_erp: false,
        bom_erp_date: null,
        has_spec_erp: false,
        spec_erp_date: null,
        has_khsx: false,
        khsx_date: null,
        has_process_erp: false,
        process_erp_date: null,
        has_st: false,
        st_date: null,
      }),
    ];

    const productsWithStatus = mergeProductsWithStatus(products, statuses);
    assert.equal(productsWithStatus[0].isCompleted, true);
    assert.equal(productsWithStatus[0].completionDays, 10);
    assert.equal(productsWithStatus[1].completionDays, 20);
    assert.equal(productsWithStatus[2].currentWaitingStep, 'khsx');
    assert.equal(productsWithStatus[2].waitingLabel, 'Chờ KHSX');
    assert.equal(productsWithStatus[4].currentWaitingStep, 'quote');
    assert.equal(productsWithStatus[4].waitingLabel, 'Chờ Báo giá');

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
    assert.equal(metrics.inProgressTotalCount, 2);

    const stepCountByKey = new Map(
      metrics.pendingStepCounts.map((s) => [s.stepKey, s.count])
    );
    assert.equal(stepCountByKey.get('quote'), 1);
    assert.equal(stepCountByKey.get('bom_erp'), 0);
    assert.equal(stepCountByKey.get('spec_erp'), 0);
    assert.equal(stepCountByKey.get('khsx'), 1);
    assert.equal(stepCountByKey.get('process_erp'), 0);
    assert.equal(stepCountByKey.get('st'), 0);

    assert.equal(metrics.avgCompletionDaysInPeriod, 15);
    assert.equal(metrics.requestsInPeriodCount, 2);

    const comparison = computeStReportComparison({
      productsWithStatus,
      changeRequests: requests,
      quotes,
      currentStart: '2026-10-01',
      currentEnd: '2026-10-31',
      prevStart: '2026-09-01',
      prevEnd: '2026-09-30',
    });
    const completedRow = comparison.find(
      (r) => r.key === 'mass_production_completed'
    );
    assert.ok(completedRow);
    assert.equal(completedRow.currentValue, 2);
    assert.equal(completedRow.previousValue, 1);
    assert.equal(completedRow.delta, 1);

    const procRow = comparison.find((r) => r.key === 'process_created');
    assert.ok(procRow);
    assert.equal(procRow.currentValue, 2);
    assert.equal(procRow.previousValue, 1);

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

    const productSheet = workbook.getWorksheet('Mã hàng mới');
    assert.ok(productSheet);
    assert.equal(productSheet.columnCount, 16);
    const headers = productSheet.getRow(3).values as unknown[];
    assert.equal(headers[7], 'Ngày đăng ký');
    assert.equal(headers[8], 'Báo giá');
    assert.equal(headers[13], 'ST');
    assert.equal(headers[15], 'Trạng thái hiện tại');

    for (const ws of workbook.worksheets) {
      assert.equal(ws.views[0].state, 'frozen');
      assert.equal(ws.views[0].ySplit, 3);
      assert.ok(ws.autoFilter);
      assert.ok((ws.getColumn(2).width || 0) >= 8);
    }
  });

  it('normalizes both native 6-step columns and [ST_STEPS_JSON] fallback in notes cleanly', () => {
    // 1. Native 6-step row
    const nativeNormalized = normalizeStNewProductStatusRow({
      id: 'st-native',
      product_id: 'prod-1',
      has_quote: true,
      quote_date: '2026-11-01',
      has_bom_erp: true,
      bom_erp_date: '2026-11-03',
      has_spec_erp: true,
      spec_erp_date: '2026-11-05',
      has_khsx: true,
      khsx_date: '2026-11-07',
      has_process_erp: true,
      process_erp_date: '2026-11-09',
      has_st: true,
      st_date: '2026-11-12',
      notes: 'Hoàn tất đúng hạn',
      updated_at: '2026-11-12T02:00:00Z',
    });
    assert.equal(isNewProductCompleted(nativeNormalized), true);
    assert.equal(nativeNormalized.st_date, '2026-11-12');
    assert.equal(nativeNormalized.notes, 'Hoàn tất đúng hạn');

    // 2. Fallback encoded steps inside notes (pre-ALTER TABLE Supabase schema)
    const encodedNotes = encodeStepsIntoNotes('Cần kiểm tra lại BOM', {
      has_quote: true,
      quote_date: '2026-11-20',
      has_bom_erp: true,
      bom_erp_date: '2026-11-21',
      has_spec_erp: false,
      spec_erp_date: null,
      has_khsx: false,
      khsx_date: null,
      has_process_erp: false,
      process_erp_date: null,
      has_st: false,
      st_date: null,
    });
    const fallbackNormalized = normalizeStNewProductStatusRow({
      id: 'st-fallback',
      product_id: 'prod-2',
      has_process: false,
      has_unit_price: true,
      notes: encodedNotes,
      updated_at: '2026-11-21T02:00:00Z',
    });
    assert.equal(fallbackNormalized.has_quote, true);
    assert.equal(fallbackNormalized.quote_date, '2026-11-20');
    assert.equal(fallbackNormalized.has_bom_erp, true);
    assert.equal(fallbackNormalized.bom_erp_date, '2026-11-21');
    assert.equal(fallbackNormalized.has_spec_erp, false);
    assert.equal(fallbackNormalized.notes, 'Cần kiểm tra lại BOM');
    assert.equal(getPendingWorkflowStep(fallbackNormalized)?.key, 'spec_erp');
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
          has_quote: true,
          quote_date: '2026-11-20',
          has_bom_erp: true,
          bom_erp_date: '2026-11-21',
          has_spec_erp: true,
          spec_erp_date: '2026-11-22',
          has_khsx: true,
          khsx_date: '2026-11-23',
          has_process_erp: true,
          process_erp_date: '2026-11-24',
          has_st: true,
          st_date: '2026-11-25',
          notes: 'Done',
          updated_at: '2026-11-25T02:00:00Z',
        },
        oldRow: null,
      },
      normalizeStNewProductStatusRow
    );
    assert.equal(statuses[0].st_date, '2026-11-25');
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
