import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRealtimeStRow,
  buildSigningInitialState,
  buildSigningStatusPayload,
  buildSingleStageInitialState,
  buildSingleStageStatusPayload,
  calculateCompletionDays,
  computeNewProductStatusCounts,
  computeStagesProgress,
  computeStOverviewMetrics,
  computeStReportComparison,
  encodeStepsIntoNotes,
  extractAvailableYearsFromNewProducts,
  filterNewProductsList,
  formatStageBadgeTooltip,
  getNewProductWaitingLabel,
  getPendingWorkflowStep,
  getSigningDisplayState,
  hasEffectiveSigning,
  isNewProductCompleted,
  mergeProductsWithStatus,
  normalizeStChangeRequestRow,
  normalizeStNewProductStatusRow,
  normalizeStProductRow,
  resolveOverviewPeriodRange,
  resolveReportPeriodRange,
  sortNewProductsList,
  ST_PRODUCTION_STAGES,
  type StChangeRequest,
  type StCustomerQuote,
  type StNewProductStatus,
  type StProduct,
} from './stWorkLogic';
import { buildStReportWorkbook } from './stWorkExportService';

function buildFullCompletedStatus(
  overrides: Partial<StNewProductStatus> = {}
): StNewProductStatus {
  return {
    id: 'st-default',
    product_id: 'p-default',
    has_process_erp: true,
    process_erp_date: '2026-10-10',
    has_stage_win: true,
    stage_win_date: '2026-10-10',
    has_stage_cut: true,
    stage_cut_date: '2026-10-10',
    has_stage_sol: true,
    stage_sol_date: '2026-10-10',
    has_stage_ass: true,
    stage_ass_date: '2026-10-10',
    has_stage_imp: true,
    stage_imp_date: '2026-10-10',
    has_stage_sol2: true,
    stage_sol2_date: '2026-10-10',
    has_stage_fin: true,
    stage_fin_date: '2026-10-10',
    has_signing: true,
    signing_date: '2026-10-10',
    has_st: true,
    st_date: '2026-10-11',
    notes: null,
    updated_at: '2026-10-11T02:00:00.000Z',
    ...overrides,
  };
}

describe('stWorkLogic 7-stage & signing/ST workflow calculations (Quy trình ERP -> WIN..FIN -> Trình ký -> ST)', () => {
  it('computes 5-component x 100% progress percentages (ERP 10% + 7 stages 70% + Signing 10% + ST 10% = 100%)', () => {
    const empty = computeStagesProgress(null);
    assert.equal(empty.completedCount, 0);
    assert.equal(empty.totalCount, 7);
    assert.equal(empty.percentage, 0);
    assert.equal(empty.allCompleted, false);
    assert.equal(empty.nextPendingStageKey, 'win');

    const erpOnly = computeStagesProgress({
      has_process_erp: true,
      process_erp_date: '2026-10-10',
    });
    assert.equal(erpOnly.percentage, 10);

    const fourOfSeven = computeStagesProgress({
      has_stage_win: true,
      has_stage_cut: true,
      has_stage_sol: true,
      has_stage_ass: true,
      has_stage_imp: false,
      has_stage_sol2: false,
      has_stage_fin: false,
    });
    assert.equal(fourOfSeven.completedCount, 4);
    assert.equal(fourOfSeven.percentage, 40);
    assert.equal(fourOfSeven.allCompleted, false);
    assert.equal(fourOfSeven.nextPendingStageKey, 'imp');

    const waitingSigning = computeStagesProgress(
      buildFullCompletedStatus({
        has_signing: false,
        signing_date: null,
        has_st: false,
        st_date: null,
      })
    );
    assert.equal(waitingSigning.percentage, 80);

    const waitingStWithoutDate = computeStagesProgress(
      buildFullCompletedStatus({ has_st: true, st_date: null })
    );
    assert.equal(waitingStWithoutDate.percentage, 90);

    const legacyDoneWithoutExplicitSigning = buildFullCompletedStatus({
      has_signing: false,
      signing_date: null,
    });
    assert.equal(hasEffectiveSigning(legacyDoneWithoutExplicitSigning), true);
    assert.equal(computeStagesProgress(legacyDoneWithoutExplicitSigning).percentage, 100);

    const allMilestones = computeStagesProgress(buildFullCompletedStatus());
    assert.equal(allMilestones.completedCount, 7);
    assert.equal(allMilestones.percentage, 100);
    assert.equal(allMilestones.allCompleted, true);
    assert.equal(allMilestones.nextPendingStageKey, null);
  });

  it('enforces completion rule: Quy trình ERP + all 7 stages + effective signing + ST with st_date', () => {
    assert.equal(isNewProductCompleted(null), false);

    // Missing Quy trình ERP even if 7 stages + signing + ST are checked
    assert.equal(
      isNewProductCompleted(
        buildFullCompletedStatus({
          has_process_erp: false,
          process_erp_date: null,
        })
      ),
      false
    );

    // Missing 1 of 7 stages (FIN) even if Quy trình ERP + signing + ST are checked
    assert.equal(
      isNewProductCompleted(
        buildFullCompletedStatus({ has_stage_fin: false, stage_fin_date: null })
      ),
      false
    );

    // Missing ST or st_date
    assert.equal(
      isNewProductCompleted(
        buildFullCompletedStatus({ has_st: false, st_date: null })
      ),
      false
    );
    assert.equal(
      isNewProductCompleted(
        buildFullCompletedStatus({ has_st: true, st_date: null })
      ),
      false
    );

    // All conditions satisfied -> Hoàn thành
    assert.equal(isNewProductCompleted(buildFullCompletedStatus()), true);
  });

  it('identifies the exact waiting stage across process_erp, stages (WIN-FIN), signing, and st', () => {
    assert.equal(getPendingWorkflowStep(null)?.key, 'process_erp');
    assert.equal(getNewProductWaitingLabel(null), 'Chưa tạo Quy trình ERP');

    const step1Pending = buildFullCompletedStatus({
      has_process_erp: false,
      process_erp_date: null,
      has_stage_win: false,
      has_stage_cut: false,
      has_stage_sol: false,
      has_stage_ass: false,
      has_stage_imp: false,
      has_stage_sol2: false,
      has_stage_fin: false,
      has_signing: false,
      signing_date: null,
      has_st: false,
      st_date: null,
    });
    assert.equal(getPendingWorkflowStep(step1Pending)?.key, 'process_erp');
    assert.equal(
      getNewProductWaitingLabel(step1Pending),
      'Chưa tạo Quy trình ERP'
    );

    const step2Pending = buildFullCompletedStatus({
      has_process_erp: true,
      process_erp_date: '2026-10-10',
      has_stage_imp: false,
      has_stage_sol2: false,
      has_stage_fin: false,
      has_signing: false,
      signing_date: null,
      has_st: false,
      st_date: null,
    });
    assert.equal(getPendingWorkflowStep(step2Pending)?.key, 'stages');
    assert.equal(
      getNewProductWaitingLabel(step2Pending),
      'Đang thực hiện công đoạn (WIN–FIN)'
    );

    const step3SigningPending = buildFullCompletedStatus({
      has_signing: false,
      signing_date: null,
      has_st: false,
      st_date: null,
    });
    assert.equal(getPendingWorkflowStep(step3SigningPending)?.key, 'signing');
    assert.equal(
      getNewProductWaitingLabel(step3SigningPending),
      'Đã xong 7 công đoạn – chờ trình ký'
    );

    const step4StPending = buildFullCompletedStatus({
      has_signing: true,
      signing_date: '2026-10-10',
      has_st: false,
      st_date: null,
    });
    assert.equal(getPendingWorkflowStep(step4StPending)?.key, 'st');
    assert.equal(
      getNewProductWaitingLabel(step4StPending),
      'Đang trình ký – chờ ST'
    );

    const done = buildFullCompletedStatus();
    assert.equal(getPendingWorkflowStep(done), null);
    assert.equal(getNewProductWaitingLabel(done), 'Hoàn thành');
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

  it('computes overview KPIs with 4-bucket pending counts, comparison rows, and Excel Sheet 1/Sheet 2 structure', () => {
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
      {
        id: 'p6',
        line_name: 'S Line',
        customer_short_name: 'SAMSUNG',
        product_name: 'Module F',
        product_code: 'ST-006',
        specification: '12x18mm',
        image_url: null,
        created_at: '2026-10-19T02:00:00.000Z',
        updated_at: '2026-10-20T02:00:00.000Z',
      },
      {
        id: 'p7',
        line_name: 'S Line',
        customer_short_name: 'SAMSUNG',
        product_name: 'Module G',
        product_code: 'ST-007',
        specification: '14x22mm',
        image_url: null,
        created_at: '2026-10-21T02:00:00.000Z',
        updated_at: '2026-10-22T02:00:00.000Z',
      },
    ];

    const statuses: StNewProductStatus[] = [
      buildFullCompletedStatus({
        id: 's1',
        product_id: 'p1',
        process_erp_date: '2026-10-05',
        st_date: '2026-10-11',
      }),
      buildFullCompletedStatus({
        id: 's2',
        product_id: 'p2',
        process_erp_date: '2026-10-08',
        st_date: '2026-10-25',
      }),
      buildFullCompletedStatus({
        id: 's3',
        product_id: 'p3',
        has_process_erp: true,
        process_erp_date: '2026-10-12',
        has_signing: true,
        signing_date: '2026-10-13',
        has_st: false,
        st_date: null,
        notes: 'Chờ ST tính định mức',
      }),
      buildFullCompletedStatus({
        id: 's4',
        product_id: 'p4',
        process_erp_date: '2026-09-10',
        st_date: '2026-09-15',
      }),
      buildFullCompletedStatus({
        id: 's5',
        product_id: 'p5',
        has_process_erp: false,
        process_erp_date: null,
        has_stage_win: false,
        has_stage_cut: false,
        has_stage_sol: false,
        has_stage_ass: false,
        has_stage_imp: false,
        has_stage_sol2: false,
        has_stage_fin: false,
        has_signing: false,
        signing_date: null,
        has_st: false,
        st_date: null,
      }),
      buildFullCompletedStatus({
        id: 's6',
        product_id: 'p6',
        has_process_erp: true,
        process_erp_date: '2026-10-20',
        has_stage_win: true,
        has_stage_cut: true,
        has_stage_sol: true,
        has_stage_ass: false,
        has_stage_imp: false,
        has_stage_sol2: false,
        has_stage_fin: false,
        has_signing: false,
        signing_date: null,
        has_st: false,
        st_date: null,
      }),
      buildFullCompletedStatus({
        id: 's7',
        product_id: 'p7',
        has_process_erp: true,
        process_erp_date: '2026-10-21',
        has_signing: false,
        signing_date: null,
        has_st: false,
        st_date: null,
      }),
    ];

    const productsWithStatus = mergeProductsWithStatus(products, statuses);
    assert.equal(productsWithStatus[0].isCompleted, true);
    assert.equal(productsWithStatus[0].stageProgress.percentage, 100);
    assert.equal(productsWithStatus[0].completionDays, 10);
    assert.equal(productsWithStatus[1].completionDays, 20);
    assert.equal(productsWithStatus[2].currentWaitingStep, 'st');
    assert.equal(
      productsWithStatus[2].waitingLabel,
      'Đang trình ký – chờ ST'
    );
    assert.equal(productsWithStatus[4].currentWaitingStep, 'process_erp');
    assert.equal(
      productsWithStatus[4].waitingLabel,
      'Chưa tạo Quy trình ERP'
    );
    assert.equal(productsWithStatus[5].currentWaitingStep, 'stages');
    assert.equal(productsWithStatus[5].stageProgress.percentage, 40);
    assert.equal(productsWithStatus[6].currentWaitingStep, 'signing');
    assert.equal(
      productsWithStatus[6].waitingLabel,
      'Đã xong 7 công đoạn – chờ trình ký'
    );
    assert.equal(productsWithStatus[6].stageProgress.percentage, 80);

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
    assert.equal(metrics.inProgressTotalCount, 4);
    assert.equal(metrics.pendingStepCounts.length, 4);

    const stepCountByKey = new Map(
      metrics.pendingStepCounts.map((s) => [s.stepKey, s])
    );
    assert.equal(stepCountByKey.get('process_erp')?.count, 1);
    assert.equal(stepCountByKey.get('stages')?.count, 1);
    assert.equal(stepCountByKey.get('signing')?.count, 1);
    assert.equal(stepCountByKey.get('st')?.count, 1);

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
      ['Tổng hợp', 'Đơn giá mới', 'Phiếu yêu cầu', 'Báo giá khách hàng']
    );

    const summarySheet = workbook.getWorksheet('Tổng hợp');
    assert.ok(summarySheet);
    const summaryTextValues: string[] = [];
    summarySheet.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === 'string') summaryTextValues.push(c.value);
      });
    });
    assert.ok(summaryTextValues.includes('Chưa tạo Quy trình ERP'));
    assert.ok(summaryTextValues.includes('Đang thực hiện công đoạn (WIN–FIN)'));
    assert.ok(summaryTextValues.includes('Đã xong 7 công đoạn – chờ trình ký'));
    assert.ok(summaryTextValues.includes('Đang trình ký – chờ ST'));

    const productSheet = workbook.getWorksheet('Đơn giá mới');
    assert.ok(productSheet);
    assert.equal(productSheet.columnCount, 19);
    const headers = productSheet.getRow(3).values as unknown[];
    assert.equal(headers[8], 'Quy trình ERP');
    assert.equal(headers[9], 'Ngày tạo QT');
    assert.equal(headers[10], 'Công đoạn (WIN–FIN)');
    assert.equal(headers[11], 'Đang trình ký');
    assert.equal(headers[12], 'Ngày trình ký');
    assert.equal(headers[13], 'ST');
    assert.equal(headers[14], 'Ngày áp dụng');
    assert.equal(headers[15], 'Tỷ lệ %');
    assert.equal(headers[16], 'Hiện trạng');
  });

  it('normalizes native stage columns, hybrid signing notes, and [ST_STEPS_JSON] fallback cleanly', () => {
    const encodedNotes = encodeStepsIntoNotes('Đang chờ công đoạn IMP', {
      has_process_erp: true,
      process_erp_date: '2026-11-21',
      has_stage_win: true,
      stage_win_date: '2026-11-21',
      has_stage_cut: true,
      stage_cut_date: '2026-11-22',
      has_stage_sol: true,
      stage_sol_date: '2026-11-23',
      has_stage_ass: true,
      stage_ass_date: '2026-11-24',
      has_stage_imp: false,
      stage_imp_date: null,
      has_stage_sol2: false,
      stage_sol2_date: null,
      has_stage_fin: false,
      stage_fin_date: null,
      has_signing: false,
      signing_date: null,
      has_st: false,
      st_date: null,
    });
    const normalized = normalizeStNewProductStatusRow({
      id: 'st-fallback',
      product_id: 'prod-2',
      has_process: true,
      process_created_at: '2026-11-21',
      notes: encodedNotes,
      updated_at: '2026-11-24T02:00:00Z',
    });
    assert.equal(normalized.has_process_erp, true);
    assert.equal(normalized.process_erp_date, '2026-11-21');
    assert.equal(normalized.has_stage_win, true);
    assert.equal(normalized.stage_ass_date, '2026-11-24');
    assert.equal(normalized.has_stage_imp, false);
    assert.equal(normalized.has_signing, false);
    assert.equal(normalized.has_st, false);
    assert.equal(normalized.notes, 'Đang chờ công đoạn IMP');

    const progress = computeStagesProgress(normalized);
    assert.equal(progress.completedCount, 4);
    assert.equal(progress.percentage, 50);
    assert.equal(progress.nextPendingStageKey, 'imp');
    assert.equal(getPendingWorkflowStep(normalized)?.key, 'stages');

    // Hybrid case: native stage columns exist on row, but signing columns are stored in [ST_STEPS_JSON]
    const hybridNotes = encodeStepsIntoNotes('Ghi chú trình ký', {
      has_process_erp: true,
      process_erp_date: '2026-11-20',
      has_stage_win: true,
      has_stage_cut: true,
      has_stage_sol: true,
      has_stage_ass: true,
      has_stage_imp: true,
      has_stage_sol2: true,
      has_stage_fin: true,
      has_signing: true,
      signing_date: '2026-11-25',
      has_st: false,
      st_date: null,
    });
    const hybridNormalized = normalizeStNewProductStatusRow({
      id: 'st-hybrid',
      product_id: 'prod-3',
      has_process_erp: true,
      process_erp_date: '2026-11-20',
      has_stage_win: true,
      has_stage_cut: true,
      has_stage_sol: true,
      has_stage_ass: true,
      has_stage_imp: true,
      has_stage_sol2: true,
      has_stage_fin: true,
      has_st: false,
      st_date: null,
      notes: hybridNotes,
    });
    assert.equal(hybridNormalized.has_signing, true);
    assert.equal(hybridNormalized.signing_date, '2026-11-25');
    assert.equal(hybridNormalized.notes, 'Ghi chú trình ký');
    assert.equal(computeStagesProgress(hybridNormalized).percentage, 90);
    assert.equal(getPendingWorkflowStep(hybridNormalized)?.key, 'st');
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
          process_created_at: '2026-11-24',
          notes: encodeStepsIntoNotes('Done', {
            has_process_erp: true,
            process_erp_date: '2026-11-24',
            has_stage_win: true,
            has_stage_cut: true,
            has_stage_sol: true,
            has_stage_ass: true,
            has_stage_imp: true,
            has_stage_sol2: true,
            has_stage_fin: true,
            has_st: true,
            st_date: '2026-11-25',
          }),
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

  it('filters by Year/Month using process_erp_date with st_date fallback and sorts across all 6 modes', () => {
    const products: StProduct[] = [
      {
        id: 'pa',
        line_name: 'S Line',
        customer_short_name: 'LG',
        product_name: 'SP A',
        product_code: 'CODE-B',
        specification: 'S1',
        image_url: null,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'pb',
        line_name: 'M Line',
        customer_short_name: 'SAMSUNG',
        product_name: 'SP B',
        product_code: 'CODE-A',
        specification: 'S2',
        image_url: null,
        created_at: '2026-11-20T00:00:00Z',
        updated_at: '2026-11-20T00:00:00Z',
      },
      {
        id: 'pc',
        line_name: 'E Line',
        customer_short_name: 'LG',
        product_name: 'SP C',
        product_code: 'CODE-C',
        specification: 'S3',
        image_url: null,
        created_at: '2025-12-01T00:00:00Z',
        updated_at: '2025-12-01T00:00:00Z',
      },
    ];

    const statuses: StNewProductStatus[] = [
      // pa: no process_erp_date, fallback to st_date 2026-08-15, 90% (0 + 70 + 10 signing + 10 ST)
      buildFullCompletedStatus({
        id: 'sa',
        product_id: 'pa',
        has_process_erp: false,
        process_erp_date: null,
        st_date: '2026-08-15',
      }),
      // pb: process_erp_date 2026-11-20, 40% (10 ERP + WIN+CUT+SOL 30), no signing/ST
      buildFullCompletedStatus({
        id: 'sb',
        product_id: 'pb',
        has_process_erp: true,
        process_erp_date: '2026-11-20',
        has_stage_win: true,
        has_stage_cut: true,
        has_stage_sol: true,
        stage_sol_date: '2026-11-20',
        has_stage_ass: false,
        has_stage_imp: false,
        has_stage_sol2: false,
        has_stage_fin: false,
        has_signing: false,
        signing_date: null,
        has_st: false,
        st_date: null,
      }),
      // pc: process_erp_date 2025-12-10, 30% (10 ERP + 0 + 10 effective signing + 10 ST), st_date 2026-01-05
      buildFullCompletedStatus({
        id: 'sc',
        product_id: 'pc',
        has_process_erp: true,
        process_erp_date: '2025-12-10',
        has_stage_win: false,
        has_stage_cut: false,
        has_stage_sol: false,
        has_stage_ass: false,
        has_stage_imp: false,
        has_stage_sol2: false,
        has_stage_fin: false,
        has_signing: false,
        signing_date: null,
        has_st: true,
        st_date: '2026-01-05',
      }),
    ];

    const merged = mergeProductsWithStatus(products, statuses);

    assert.deepEqual(extractAvailableYearsFromNewProducts(merged), [2026, 2025]);
    assert.deepEqual(extractAvailableYearsFromNewProducts(merged, 2027), [
      2027,
      2026,
      2025,
    ]);

    const preStatus2026 = filterNewProductsList(merged, {
      yearFilter: '2026',
      monthFilter: 'ALL',
    });
    assert.deepEqual(computeNewProductStatusCounts(preStatus2026), {
      total: 2,
      completed: 0,
      inProgress: 2,
    });

    assert.deepEqual(
      filterNewProductsList(merged, { yearFilter: '2026', monthFilter: '8' }).map(
        (x) => x.product.product_code
      ),
      ['CODE-B']
    );
    assert.deepEqual(
      filterNewProductsList(merged, { yearFilter: '2025', monthFilter: 'ALL' }).map(
        (x) => x.product.product_code
      ),
      ['CODE-C']
    );

    assert.deepEqual(
      sortNewProductsList(merged, 'process_erp_desc').map(
        (x) => x.product.product_code
      ),
      ['CODE-A', 'CODE-C', 'CODE-B']
    );
    assert.deepEqual(
      sortNewProductsList(merged, 'process_erp_asc').map(
        (x) => x.product.product_code
      ),
      ['CODE-C', 'CODE-A', 'CODE-B']
    );
    assert.deepEqual(
      sortNewProductsList(merged, 'st_date_desc').map(
        (x) => x.product.product_code
      ),
      ['CODE-B', 'CODE-C', 'CODE-A']
    );
    assert.deepEqual(
      sortNewProductsList(merged, 'progress_desc').map(
        (x) => x.product.product_code
      ),
      ['CODE-B', 'CODE-A', 'CODE-C']
    );
    assert.deepEqual(
      sortNewProductsList(merged, 'progress_asc').map(
        (x) => x.product.product_code
      ),
      ['CODE-C', 'CODE-A', 'CODE-B']
    );
    assert.deepEqual(
      sortNewProductsList(merged, 'code_asc').map(
        (x) => x.product.product_code
      ),
      ['CODE-A', 'CODE-B', 'CODE-C']
    );
  });

  it('single-stage modal helpers pre-fill uncompleted stages, preserve sibling fields, and format tooltips', () => {
    const winStage = ST_PRODUCTION_STAGES[0];
    const solStage = ST_PRODUCTION_STAGES[2];

    assert.equal(
      formatStageBadgeTooltip(winStage, false, null, true),
      'WINDING (WIN) - Đang chờ'
    );
    assert.equal(
      formatStageBadgeTooltip(solStage, true, '2026-11-26', false),
      'SOLDER (SOL) - Hoàn thành: 26/11/2026'
    );

    const product: StProduct = {
      id: 'p-single',
      line_name: 'S',
      customer_short_name: 'KH',
      product_name: 'SP Single',
      product_code: 'ST-SINGLE',
      specification: 'SPEC-1',
      image_url: null,
      created_at: '2026-11-20T00:00:00Z',
      updated_at: '2026-11-20T00:00:00Z',
    };
    const partialStatus = buildFullCompletedStatus({
      id: 'st-single',
      product_id: 'p-single',
      has_process_erp: true,
      process_erp_date: '2026-11-20',
      has_stage_win: true,
      stage_win_date: '2026-11-21',
      has_stage_cut: false,
      stage_cut_date: null,
      has_stage_sol: false,
      stage_sol_date: null,
      has_stage_ass: false,
      stage_ass_date: null,
      has_stage_imp: false,
      stage_imp_date: null,
      has_stage_sol2: false,
      stage_sol2_date: null,
      has_stage_fin: false,
      stage_fin_date: null,
      has_signing: false,
      signing_date: null,
      has_st: false,
      st_date: null,
      notes: 'Giữ nguyên ghi chú',
    });

    const uncompletedInit = buildSingleStageInitialState(
      partialStatus,
      solStage,
      '2026-11-26'
    );
    assert.deepEqual(uncompletedInit, { done: true, date: '2026-11-26' });

    const completedInit = buildSingleStageInitialState(
      partialStatus,
      winStage,
      '2026-11-26'
    );
    assert.deepEqual(completedInit, { done: true, date: '2026-11-21' });

    const [item] = mergeProductsWithStatus([product], [partialStatus]);
    const saveSolPayload = buildSingleStageStatusPayload(
      item,
      solStage,
      true,
      '2026-11-26',
      '2026-11-26'
    );
    assert.equal(saveSolPayload.has_stage_win, true);
    assert.equal(saveSolPayload.stage_win_date, '2026-11-21');
    assert.equal(saveSolPayload.has_stage_sol, true);
    assert.equal(saveSolPayload.stage_sol_date, '2026-11-26');
    assert.equal(saveSolPayload.notes, 'Giữ nguyên ghi chú');
    assert.equal(
      computeStagesProgress({
        ...saveSolPayload,
        id: saveSolPayload.id || undefined,
      }).percentage,
      30
    );

    const clearWinPayload = buildSingleStageStatusPayload(
      item,
      winStage,
      false,
      '',
      '2026-11-26'
    );
    assert.equal(clearWinPayload.has_stage_win, false);
    assert.equal(clearWinPayload.stage_win_date, null);
  });

  it('signing display and mini-modal helpers handle done, waiting, pending, and preserve sibling fields', () => {
    assert.deepEqual(getSigningDisplayState(null, false), {
      state: 'pending',
      tooltip: 'Chưa tới bước trình ký (Bấm để cập nhật nhanh)',
    });
    assert.deepEqual(getSigningDisplayState(null, true), {
      state: 'waiting',
      tooltip: 'Chờ tạo file & trình ký',
    });
    assert.deepEqual(
      getSigningDisplayState(
        buildFullCompletedStatus({
          has_signing: true,
          signing_date: '2026-11-26',
          has_st: false,
          st_date: null,
        }),
        true
      ),
      {
        state: 'done',
        tooltip: 'Đã trình ký: 26/11/2026',
      }
    );
    assert.deepEqual(
      getSigningDisplayState(
        buildFullCompletedStatus({
          has_signing: false,
          signing_date: null,
          has_st: true,
          st_date: '2026-11-27',
        }),
        true
      ),
      {
        state: 'done',
        tooltip: 'Đã áp dụng ST (hoàn thành trình ký)',
      }
    );

    const product: StProduct = {
      id: 'p-sign',
      line_name: 'S',
      customer_short_name: 'KH',
      product_name: 'SP Signing',
      product_code: 'ST-SIGN',
      specification: 'SPEC-SIGN',
      image_url: null,
      created_at: '2026-11-20T00:00:00Z',
      updated_at: '2026-11-20T00:00:00Z',
    };
    const waitingSigningStatus = buildFullCompletedStatus({
      id: 'st-sign',
      product_id: 'p-sign',
      has_signing: false,
      signing_date: null,
      has_st: false,
      st_date: null,
      notes: 'Chờ ký duyệt',
    });

    assert.deepEqual(
      buildSigningInitialState(waitingSigningStatus, '2026-11-27'),
      { done: true, date: '2026-11-27' }
    );

    const [item] = mergeProductsWithStatus([product], [waitingSigningStatus]);
    const saveSigningPayload = buildSigningStatusPayload(
      item,
      true,
      '2026-11-27',
      '2026-11-27'
    );
    assert.equal(saveSigningPayload.has_signing, true);
    assert.equal(saveSigningPayload.signing_date, '2026-11-27');
    assert.equal(saveSigningPayload.has_stage_fin, true);
    assert.equal(saveSigningPayload.notes, 'Chờ ký duyệt');
    assert.equal(
      computeStagesProgress({
        ...saveSigningPayload,
        id: saveSigningPayload.id || undefined,
      }).percentage,
      90
    );

    const clearSigningPayload = buildSigningStatusPayload(
      item,
      false,
      '',
      '2026-11-27'
    );
    assert.equal(clearSigningPayload.has_signing, false);
    assert.equal(clearSigningPayload.signing_date, null);
  });
});


