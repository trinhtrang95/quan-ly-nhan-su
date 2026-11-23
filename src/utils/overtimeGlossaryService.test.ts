import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  approveGlossaryEntryInList,
  cleanFactoryKoreanTranslation,
  composeLocalFactorySuggestion,
  DEFAULT_OVERTIME_GLOSSARY,
  deleteGlossaryEntryInList,
  findExactGlossaryMatch,
  formatGlossaryDateDDMMYYYY,
  isGlossaryEntryVerified,
  mapSupabaseGlossaryRowToEntry,
  normalizeGlossaryKey,
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
});
