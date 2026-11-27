import test from 'node:test';
import assert from 'node:assert/strict';
import * as hrService from './hrService';
import * as settingsService from './settingsService';
import * as stWorkService from './stWorkService';
import { getSupabaseClient } from './supabaseClient';

test('services layer exposes HR, Settings, and ST Work CRUD & Realtime APIs', () => {
  assert.equal(typeof hrService.loadOrSeedSupabaseData, 'function');
  assert.equal(typeof hrService.createEmployeeInSupabase, 'function');
  assert.equal(typeof hrService.createLeaveLogInSupabase, 'function');
  assert.equal(typeof hrService.fetchOvertimeForms, 'function');
  assert.equal(typeof hrService.subscribeToOvertimeRealtime, 'function');
  assert.equal(typeof hrService.fetchOvertimeGlossary, 'function');
  assert.equal(typeof hrService.subscribeToOvertimeGlossaryRealtime, 'function');

  assert.equal(typeof settingsService.fetchWorkShifts, 'function');
  assert.equal(typeof settingsService.subscribeToWorkShiftsRealtime, 'function');
  assert.equal(typeof settingsService.fetchCompanyHolidays, 'function');
  assert.equal(typeof settingsService.subscribeToCompanyHolidaysRealtime, 'function');
  assert.equal(typeof settingsService.fetchOvertimeSettings, 'function');
  assert.equal(typeof settingsService.subscribeToOvertimeSettingsRealtime, 'function');
  assert.equal(typeof settingsService.fetchAttendanceSymbols, 'function');
  assert.equal(typeof settingsService.subscribeToAttendanceSymbolsRealtime, 'function');
  assert.equal(typeof settingsService.authenticateAppUserInSupabase, 'function');
  assert.equal(typeof settingsService.fetchCompanyDepartments, 'function');
  assert.equal(typeof settingsService.createCompanyDepartment, 'function');
  assert.equal(typeof settingsService.subscribeToCompanyDepartmentsRealtime, 'function');

  assert.equal(typeof stWorkService.fetchAllStWorkData, 'function');
  assert.equal(typeof stWorkService.fetchCompanyDepartments, 'function');
  assert.equal(typeof stWorkService.subscribeToCompanyDepartmentsRealtime, 'function');
  assert.equal(typeof stWorkService.createStLine, 'function');
  assert.equal(typeof stWorkService.createStCustomer, 'function');
  assert.equal(typeof stWorkService.createStProduct, 'function');
  assert.equal(typeof stWorkService.createStProductWithInitialStatus, 'function');
  assert.equal(typeof stWorkService.upsertStNewProductStatus, 'function');
  assert.equal(typeof stWorkService.createStChangeRequest, 'function');
  assert.equal(typeof stWorkService.batchCreateStChangeRequests, 'function');
  assert.equal(typeof stWorkService.subscribeToStWorkRealtime, 'function');
  assert.equal(typeof stWorkService.compressImageClientSide, 'function');
  assert.equal(typeof stWorkService.uploadImageToHrBucket, 'function');
  assert.equal(typeof stWorkService.deleteImageFromHrBucket, 'function');
  assert.ok(stWorkService.SUPABASE_ST_NEW_PRODUCT_STATUS_SQL.includes('has_signing'));
  assert.ok(stWorkService.SUPABASE_ST_NEW_PRODUCT_STATUS_SQL.includes('signing_date'));
});

test('all domain services share the exact same Supabase client singleton', () => {
  const baseClient = getSupabaseClient();
  assert.equal(hrService.getSupabaseClient(), baseClient);
  assert.equal(settingsService.getSupabaseClient(), baseClient);
  assert.equal(stWorkService.getSupabaseClient(), baseClient);
});

test('upsertStNewProductStatus sends actual Supabase columns, preserves price_applied_at, and surfaces errors', async (t) => {
  const originalRequest = stWorkService.overtimeSupabase.request;
  const capturedCalls: Array<{ path: string; method: string; body: Record<string, unknown> | null }> = [];

  t.after(() => {
    stWorkService.overtimeSupabase.request = originalRequest;
  });

  stWorkService.overtimeSupabase.request = (async <T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const parsedBody =
      typeof options.body === 'string'
        ? (JSON.parse(options.body) as Record<string, unknown>)
        : null;
    capturedCalls.push({
      path,
      method: options.method || 'GET',
      body: parsedBody,
    });

    if (options.method === 'PATCH' && parsedBody) {
      return [
        {
          id: 'status-row-1',
          ...parsedBody,
        },
      ] as unknown as T;
    }
    return [] as unknown as T;
  }) as typeof originalRequest;

  const saved = await stWorkService.upsertStNewProductStatus({
    id: 'status-row-1',
    product_id: 'prod-101',
    has_process_erp: true,
    process_erp_date: '2026-11-26',
    has_stage_win: true,
    stage_win_date: '2026-11-26',
    has_stage_cut: true,
    stage_cut_date: '2026-11-27',
    has_signing: true,
    signing_date: '2026-11-27',
    has_st: true,
    st_date: '2026-11-27',
    notes: 'Ghi chú test',
  });

  assert.equal(capturedCalls.length, 1);
  assert.equal(capturedCalls[0].method, 'PATCH');
  assert.ok(capturedCalls[0].path.includes('st_new_product_status?id=eq.status-row-1'));

  const sent = capturedCalls[0].body!;
  assert.equal(sent.has_process, true);
  assert.equal(sent.process_created_at, '2026-11-26');
  assert.equal(sent.has_signing, true);
  assert.equal(sent.signing_date, '2026-11-27');
  assert.equal(sent.has_unit_price, true);
  assert.equal(sent.price_applied_at, '2026-11-27');
  assert.ok(typeof sent.notes === 'string' && sent.notes.includes('[ST_STEPS_JSON:'));
  assert.equal('has_process_erp' in sent, false);
  assert.equal('has_stage_win' in sent, false);

  assert.equal(saved.has_signing, true);
  assert.equal(saved.signing_date, '2026-11-27');
  assert.equal(saved.has_stage_win, true);
  assert.equal(saved.has_stage_cut, true);
  assert.equal(saved.has_st, true);
  assert.equal(saved.st_date, '2026-11-27');
  assert.equal(saved.notes, 'Ghi chú test');

  // Verify errors are thrown rather than swallowed
  stWorkService.overtimeSupabase.request = (async () => {
    throw new Error('Supabase REST (403): RLS policy violation 42501');
  }) as typeof originalRequest;

  await assert.rejects(
    () =>
      stWorkService.upsertStNewProductStatus({
        id: 'status-row-1',
        product_id: 'prod-101',
        has_process_erp: true,
        process_erp_date: '2026-11-26',
        has_signing: true,
        signing_date: '2026-11-27',
        has_st: false,
        st_date: null,
        notes: null,
      }),
    /42501/
  );
});

test('batchCreateStChangeRequests sends request_code, assigned_group, process_stage and normalizes rows', async (t) => {
  const originalRequest = stWorkService.overtimeSupabase.request;
  let capturedBody: unknown = null;

  t.after(() => {
    stWorkService.overtimeSupabase.request = originalRequest;
  });

  stWorkService.overtimeSupabase.request = (async <T>(
    _path: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const parsed =
      typeof options.body === 'string' ? JSON.parse(options.body) : null;
    capturedBody = parsed;
    return (Array.isArray(parsed) ? parsed : []).map((row, i) => ({
      id: `cr-mock-${i + 1}`,
      ...row,
    })) as unknown as T;
  }) as typeof originalRequest;

  const created = await stWorkService.batchCreateStChangeRequests([
    {
      request_code: 'YC-20261127-01',
      department: 'Sản xuất',
      assigned_group: 'ST',
      process_stage: 'WINDING',
      content: 'Cập nhật ST quấn dây',
      received_at: '2026-11-27',
      product_code: 'ALL MODEL',
      specification: 'Rotor line',
      status: 'Đang kiểm tra',
    },
    {
      request_code: 'YC-20261127-01',
      department: 'Sản xuất',
      assigned_group: 'ST',
      process_stage: 'SOLDER',
      content: 'Cập nhật ST hàn',
      received_at: '2026-11-27',
      product_code: '49013-029',
      specification: 'EE4716',
      status: 'Đã thay đổi',
      processed_at: '2026-11-27',
      applied_version: 'A22',
    },
  ]);

  assert.ok(Array.isArray(capturedBody));
  assert.equal((capturedBody as unknown[]).length, 2);
  assert.equal(created.length, 2);
  assert.equal(created[0].request_code, 'YC-20261127-01');
  assert.equal(created[0].assigned_group, 'ST');
  assert.equal(created[0].process_stage, 'WINDING');
  assert.equal(created[1].status, 'Đã thay đổi');
  assert.equal(created[1].applied_version, 'A22');
});
