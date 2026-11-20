import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanFactoryKoreanTranslation,
  composeLocalFactorySuggestion,
  DEFAULT_OVERTIME_GLOSSARY,
  findExactGlossaryMatch,
  normalizeGlossaryKey,
  upsertGlossaryEntryInList,
  type OvertimeGlossaryEntry,
} from './overtimeGlossaryService';

describe('overtimeGlossaryService pure logic', () => {
  it('normalizes keys by trimming, collapsing spaces, and lowercasing', () => {
    assert.equal(normalizeGlossaryKey('  Trực   Sản   Xuất '), 'trực sản xuất');
    assert.equal(normalizeGlossaryKey(''), '');
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

  it('upserts new entries and updates existing normalized entries without duplication', () => {
    const initial: OvertimeGlossaryEntry[] = [
      {
        id: 'g1',
        reasonVi: 'Trực sản xuất',
        reasonKr: '생산 당직',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
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

    const updated = upsertGlossaryEntryInList(
      created.entries,
      'trực   sản xuất',
      '생산 라인 당직',
      '2026-11-20T11:00:00.000Z'
    );
    assert.equal(updated.isUpdate, true);
    assert.equal(updated.entries.length, 2);
    assert.equal(updated.entries[0].id, 'g1');
    assert.equal(updated.entries[0].reasonKr, '생산 라인 당직');
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
