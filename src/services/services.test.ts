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
  assert.equal(typeof stWorkService.subscribeToStWorkRealtime, 'function');
  assert.equal(typeof stWorkService.compressImageClientSide, 'function');
  assert.equal(typeof stWorkService.uploadImageToHrBucket, 'function');
  assert.equal(typeof stWorkService.deleteImageFromHrBucket, 'function');
});

test('all domain services share the exact same Supabase client singleton', () => {
  const baseClient = getSupabaseClient();
  assert.equal(hrService.getSupabaseClient(), baseClient);
  assert.equal(settingsService.getSupabaseClient(), baseClient);
  assert.equal(stWorkService.getSupabaseClient(), baseClient);
});
