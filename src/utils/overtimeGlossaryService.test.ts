import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  approveGlossaryEntryInList,
  areTargetGroupsEqual,
  cleanFactoryKoreanTranslation,
  composeLocalFactorySuggestion,
  createManualGlossaryEntryInList,
  DEFAULT_OVERTIME_GLOSSARY,
  deleteGlossaryEntryInList,
  filterAndSortGlossaryForCombobox,
  findExactGlossaryMatch,
  formatGlossaryDateDDMMYYYY,
  isGlossaryEntryVerified,
  mapSupabaseGlossaryRowToEntry,
  normalizeGlossaryKey,
  normalizeTargetGroups,
  serializeTargetGroupsForSupabase,
  updateGlossaryEntryInList,
  updateGlossaryEntryKrInList,
  upsertGlossaryEntryInList,
  type OvertimeGlossaryEntry,
} from './overtimeGlossaryService';

describe('overtimeGlossaryService pure logic', () => {
  it('normalizes keys by trimming, collapsing spaces, and lowercasing', () => {
    assert.equal(normalizeGlossaryKey('  Trực   Sản   Xuất '), 'trực sản xuất');
    assert.equal(normalizeGlossaryKey(''), '');
  });

  it('formats glossary created_at timestamps as DD/MM/YYYY', () => {
    assert.equal(formatGlossaryDateDDMMYYYY('2026-01-01T00:00:00.000Z'), '01/01/2026');
    assert.equal(formatGlossaryDateDDMMYYYY('2026-11-23T08:45:00.000Z'), '23/11/2026');
    assert.equal(formatGlossaryDateDDMMYYYY('2026-05-09'), '09/05/2026');
    assert.equal(formatGlossaryDateDDMMYYYY(undefined), '—');
  });

  it('marks built-in default glossary entries as verified', () => {
    assert.ok(DEFAULT_OVERTIME_GLOSSARY.length > 0);
    for (const entry of DEFAULT_OVERTIME_GLOSSARY) {
      assert.equal(entry.is_verified, true);
      assert.equal(entry.isVerified, true);
      assert.ok(entry.created_at);
    }
  });

  it('maps Supabase is_verified and created_at columns and treats legacy undefined/null as verified', () => {
    const verified = mapSupabaseGlossaryRowToEntry({
      id: 'row-1',
      reason_vi: '  Kiểm tra hàng  ',
      reason_kr: '  품질 검사  ',
      is_verified: true,
      created_at: '2026-10-15T04:00:00.000Z',
      updated_at: '2026-11-23T01:00:00.000Z',
    });
    assert.equal(verified.is_verified, true);
    assert.equal(verified.isVerified, true);
    assert.equal(verified.created_at, '2026-10-15T04:00:00.000Z');
    assert.equal(isGlossaryEntryVerified(verified), true);
    assert.equal(verified.reasonVi, 'Kiểm tra hàng');
    assert.equal(verified.reasonKr, '품질 검사');

    const pending = mapSupabaseGlossaryRowToEntry({
      id: 'row-2',
      reason_vi: 'Chạy thử chuyền mới',
      reason_kr: '신규 라인 시운전',
      is_verified: false,
      created_at: '2026-11-23T01:00:00.000Z',
    });
    assert.equal(pending.is_verified, false);
    assert.equal(pending.isVerified, false);
    assert.equal(pending.created_at, '2026-11-23T01:00:00.000Z');
    assert.equal(isGlossaryEntryVerified(pending), false);

    const legacyNull = mapSupabaseGlossaryRowToEntry({
      id: 'row-3',
      reason_vi: 'Hỗ trợ xuất hàng',
      reason_kr: '출하 지원',
      is_verified: null,
    });
    assert.equal(legacyNull.is_verified, undefined);
    assert.equal(legacyNull.isVerified, true);
    assert.equal(isGlossaryEntryVerified(legacyNull), true);
  });

  it('finds exact glossary matches regardless of casing or extra spaces and ignores soft-deleted rows', () => {
    const list: OvertimeGlossaryEntry[] = [
      ...DEFAULT_OVERTIME_GLOSSARY,
      {
        id: 'deleted-entry',
        reasonVi: 'Lý do đã xóa',
        reasonKr: '삭제됨',
        updatedAt: '2026-01-02T00:00:00.000Z',
        deletedAt: '2026-01-03T00:00:00.000Z',
      },
    ];

    const matched = findExactGlossaryMatch(list, '  HỖ TRỢ   SẢN XUẤT GẤP ');
    assert.ok(matched);
    assert.equal(matched?.reasonKr, '긴급 생산 지원');

    assert.equal(findExactGlossaryMatch(list, 'Lý do đã xóa'), null);
    assert.equal(findExactGlossaryMatch(list, 'Chưa có trong từ điển'), null);
  });

  it('sets is_verified=false on new insert and preserves existing verification status on update', () => {
    const initial: OvertimeGlossaryEntry[] = [
      {
        id: 'g1',
        reasonVi: 'Trực sản xuất',
        reasonKr: '생산 당직',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        is_verified: true,
        isVerified: true,
      },
    ];

    const created = upsertGlossaryEntryInList(
      initial,
      '  Chạy thử khuôn mới ',
      '신규 금형 시운전',
      '2026-11-20T10:00:00.000Z'
    );
    assert.equal(created.isUpdate, false);
    assert.equal(created.entries.length, 2);
    assert.equal(created.entries[0].reasonVi, 'Chạy thử khuôn mới');
    assert.equal(created.entries[0].is_verified, false);
    assert.equal(created.entries[0].isVerified, false);

    const updatedVerified = upsertGlossaryEntryInList(
      created.entries,
      'trực   sản xuất',
      '생산 라인 당직',
      '2026-11-20T11:00:00.000Z'
    );
    assert.equal(updatedVerified.isUpdate, true);
    assert.equal(updatedVerified.entries.length, 2);
    assert.equal(updatedVerified.entries[0].id, 'g1');
    assert.equal(updatedVerified.entries[0].reasonKr, '생산 라인 당직');
    assert.equal(updatedVerified.entries[0].is_verified, true);
    assert.equal(updatedVerified.entries[0].isVerified, true);

    const updatedPending = upsertGlossaryEntryInList(
      updatedVerified.entries,
      'chạy thử khuôn mới',
      '신규 금형 테스트',
      '2026-11-20T12:00:00.000Z'
    );
    assert.equal(updatedPending.isUpdate, true);
    assert.equal(updatedPending.entries[0].is_verified, false);
    assert.equal(updatedPending.entries[0].isVerified, false);
  });

  it('creates manual glossary entries with is_verified=true at the top and rejects empty or duplicate entries', () => {
    const res = createManualGlossaryEntryInList(
      DEFAULT_OVERTIME_GLOSSARY,
      '  Kiểm tra   linh kiện mới ',
      '  신규 부품 점검 ',
      '2026-11-23T09:00:00.000Z'
    );
    assert.equal(res.entries.length, DEFAULT_OVERTIME_GLOSSARY.length + 1);
    assert.equal(res.entries[0].id, res.createdEntry.id);
    assert.equal(res.createdEntry.reasonVi, 'Kiểm tra linh kiện mới');
    assert.equal(res.createdEntry.reasonKr, '신규 부품 점검');
    assert.equal(res.createdEntry.is_verified, true);
    assert.equal(res.createdEntry.isVerified, true);
    assert.equal(res.createdEntry.created_at, '2026-11-23T09:00:00.000Z');

    assert.throws(() =>
      createManualGlossaryEntryInList(res.entries, '  ', '테스트')
    );
    assert.throws(() =>
      createManualGlossaryEntryInList(res.entries, 'kiểm tra linh kiện mới', '테스트')
    );
  });

  it('updates both Vietnamese and Korean text without altering verification flag, approves, and deletes entries', () => {
    const initial: OvertimeGlossaryEntry[] = [
      {
        id: 'ai-1',
        reasonVi: 'Kiểm tra bo mach',
        reasonKr: '기판 검사',
        updatedAt: '2026-11-23T01:00:00.000Z',
        deletedAt: null,
        is_verified: false,
        isVerified: false,
      },
    ];

    const editedBoth = updateGlossaryEntryInList(
      initial,
      'ai-1',
      '  Kiểm tra   bo mạch ',
      '  PCB   회로 점검 ',
      '2026-11-23T02:00:00.000Z'
    );
    assert.ok(editedBoth.updatedEntry);
    assert.equal(editedBoth.updatedEntry?.reasonVi, 'Kiểm tra bo mạch');
    assert.equal(editedBoth.updatedEntry?.reasonKr, 'PCB 회로 점검');
    assert.equal(editedBoth.updatedEntry?.is_verified, false);
    assert.equal(editedBoth.updatedEntry?.isVerified, false);

    const editedKrOnly = updateGlossaryEntryKrInList(
      editedBoth.entries,
      'ai-1',
      'PCB 회로 최종 점검',
      '2026-11-23T02:30:00.000Z'
    );
    assert.equal(editedKrOnly.updatedEntry?.reasonVi, 'Kiểm tra bo mạch');
    assert.equal(editedKrOnly.updatedEntry?.reasonKr, 'PCB 회로 최종 점검');

    const approved = approveGlossaryEntryInList(
      editedKrOnly.entries,
      'ai-1',
      '2026-11-23T03:00:00.000Z'
    );
    assert.ok(approved.updatedEntry);
    assert.equal(approved.updatedEntry?.is_verified, true);
    assert.equal(approved.updatedEntry?.isVerified, true);

    const deleted = deleteGlossaryEntryInList(approved.entries, 'ai-1');
    assert.ok(deleted.deletedEntry);
    assert.equal(deleted.entries.length, 0);
  });

  it('cleans polite Korean sentence endings into concise factory style', () => {
    assert.equal(
      cleanFactoryKoreanTranslation('설비 점검 및 수리합니다.'),
      '설비 점검 및 수리'
    );
    assert.equal(
      cleanFactoryKoreanTranslation('긴급 물량 출하 작업입니다.'),
      '긴급 물량 출하 작업'
    );
  });

  it('composes local factory suggestions from exact glossary or built-in terms', () => {
    assert.equal(
      composeLocalFactorySuggestion('Kiểm tra chất lượng hàng', DEFAULT_OVERTIME_GLOSSARY),
      '품질 검사'
    );
    assert.equal(
      composeLocalFactorySuggestion('Sửa máy dây chuyền 2', DEFAULT_OVERTIME_GLOSSARY),
      '설비 수리 · 라인'
    );
  });

  it('normalizes, maps, creates, updates, and prioritizes glossary entries by target_groups', () => {
    assert.deepEqual(normalizeTargetGroups(['  ST ', 'IOT', 'st', '']), ['ST', 'IOT']);
    assert.equal(areTargetGroupsEqual(['ST', 'IOT'], ['iot', 'ST']), true);
    assert.equal(areTargetGroupsEqual(['ST'], []), false);

    const mapped = mapSupabaseGlossaryRowToEntry({
      id: 'grp-row',
      reason_vi: 'Cân chỉnh JIG',
      reason_kr: '지그 조정',
      target_groups: ['JIG/AUTO 2', 'AUTO 1'],
      is_verified: true,
    });
    assert.deepEqual(mapped.target_groups, ['JIG/AUTO 2', 'AUTO 1']);

    const mappedJsonString = mapSupabaseGlossaryRowToEntry({
      id: 'grp-json',
      reason_vi: 'Cân chỉnh cảm biến',
      reason_kr: '센서 조정',
      target_groups: '["IOT", "ST"]',
      is_verified: true,
    });
    assert.deepEqual(mappedJsonString.target_groups, ['IOT', 'ST']);

    const mappedPlainString = mapSupabaseGlossaryRowToEntry({
      id: 'grp-plain',
      reason_vi: 'Kiểm tra PLC',
      reason_kr: 'PLC 점검',
      target_groups: 'Bảo trì',
      is_verified: true,
    });
    assert.deepEqual(mappedPlainString.target_groups, ['Bảo trì']);

    const mappedEmptyString = mapSupabaseGlossaryRowToEntry({
      id: 'grp-empty',
      reason_vi: 'Trực chung',
      reason_kr: '공동 당직',
      target_groups: '   ',
      is_verified: true,
    });
    assert.deepEqual(mappedEmptyString.target_groups, []);

    const mappedNull = mapSupabaseGlossaryRowToEntry({
      id: 'grp-null',
      reason_vi: 'Trực xưởng',
      reason_kr: '공장 당직',
      target_groups: null,
      is_verified: true,
    });
    assert.deepEqual(mappedNull.target_groups, []);

    assert.equal(
      serializeTargetGroupsForSupabase(['IOT', 'ST']),
      '["IOT","ST"]'
    );
    assert.equal(serializeTargetGroupsForSupabase([]), null);
    assert.equal(serializeTargetGroupsForSupabase(null), null);

    const manualWithGroups = createManualGlossaryEntryInList(
      [],
      'Kiểm tra cảm biến IOT',
      'IOT 센서 점검',
      '2026-11-23T09:00:00.000Z',
      ['IOT', 'ST']
    );
    assert.deepEqual(manualWithGroups.createdEntry.target_groups, ['IOT', 'ST']);

    const updatedGroups = updateGlossaryEntryInList(
      manualWithGroups.entries,
      manualWithGroups.createdEntry.id,
      'Kiểm tra cảm biến IOT',
      'IOT 센서 점검',
      '2026-11-23T09:10:00.000Z',
      ['Bảo trì']
    );
    assert.deepEqual(updatedGroups.updatedEntry?.target_groups, ['Bảo trì']);

    const upsertedNew = upsertGlossaryEntryInList(
      [],
      'Thay đầu hàn mới',
      '신규 납땜 팁 교체',
      '2026-11-23T09:20:00.000Z',
      { isVerified: false, targetGroups: ['AUTO 1', 'Bảo trì'] }
    );
    assert.equal(upsertedNew.savedEntry.is_verified, false);
    assert.deepEqual(upsertedNew.savedEntry.target_groups, ['AUTO 1', 'Bảo trì']);

    const comboboxDataset: OvertimeGlossaryEntry[] = [
      {
        id: 'shared-1',
        reasonVi: 'Trực sản xuất',
        reasonKr: '생산 당직',
        target_groups: [],
        updatedAt: '2026-11-23T01:00:00.000Z',
        is_verified: true,
        isVerified: true,
      },
      {
        id: 'st-only',
        reasonVi: 'Kiểm tra máy ST',
        reasonKr: 'ST 설비 점검',
        target_groups: ['ST'],
        updatedAt: '2026-11-23T01:00:00.000Z',
        is_verified: true,
        isVerified: true,
      },
      {
        id: 'baotri-only',
        reasonVi: 'Bảo dưỡng máy nén khí',
        reasonKr: '공기압축기 보수',
        target_groups: ['Bảo trì'],
        updatedAt: '2026-11-23T01:00:00.000Z',
        is_verified: true,
        isVerified: true,
      },
      {
        id: 'pending-st',
        reasonVi: 'Lý do chờ duyệt ST',
        reasonKr: 'ST 미승인 사유',
        target_groups: ['ST'],
        updatedAt: '2026-11-23T01:00:00.000Z',
        is_verified: false,
        isVerified: false,
      },
    ];

    // ALL without selected employees -> returns all verified entries (excludes pending)
    const allVerified = filterAndSortGlossaryForCombobox({
      entries: comboboxDataset,
      selectedGroupFilter: 'ALL',
      selectedEmployeeDepartments: [],
    });
    assert.deepEqual(
      allVerified.map((e) => e.id),
      ['shared-1', 'st-only', 'baotri-only']
    );

    // Filter selectedGroupFilter = 'ST' -> prioritizes ST first, then shared, hides Bảo trì & pending
    const stFiltered = filterAndSortGlossaryForCombobox({
      entries: comboboxDataset,
      selectedGroupFilter: 'ST',
      selectedEmployeeDepartments: [],
    });
    assert.deepEqual(
      stFiltered.map((e) => e.id),
      ['st-only', 'shared-1']
    );

    // Filter ALL + selected employee from 'Bảo trì' -> prioritizes Bảo trì first, then shared, hides ST
    const empDetected = filterAndSortGlossaryForCombobox({
      entries: comboboxDataset,
      selectedGroupFilter: 'ALL',
      selectedEmployeeDepartments: ['Bảo trì'],
    });
    assert.deepEqual(
      empDetected.map((e) => e.id),
      ['baotri-only', 'shared-1']
    );
  });
});
