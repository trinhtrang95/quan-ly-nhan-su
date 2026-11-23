import { overtimeSupabase } from './overtimeFormsService';

export interface OvertimeGlossaryEntry {
  id: string;
  reasonVi: string;
  reasonKr: string;
  updatedAt: string;
  deletedAt?: string | null;
  is_verified?: boolean;
  isVerified?: boolean;
}

export interface SupabaseGlossaryRow {
  id: string;
  reason_vi: string;
  reason_kr: string;
  updated_at?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  is_verified?: boolean | null;
}

export const OVERTIME_GLOSSARY_STORAGE_KEY = 'hr_pro_overtime_glossary_v1';

export const DEFAULT_OVERTIME_GLOSSARY: OvertimeGlossaryEntry[] = [
  {
    id: 'default-glossary-1',
    reasonVi: 'Trực sản xuất',
    reasonKr: '생산 당직',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
  {
    id: 'default-glossary-2',
    reasonVi: 'Hỗ trợ sản xuất gấp',
    reasonKr: '긴급 생산 지원',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
  {
    id: 'default-glossary-3',
    reasonVi: 'Bảo trì, sửa chữa thiết bị',
    reasonKr: '설비 점검 및 수리',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
  {
    id: 'default-glossary-4',
    reasonVi: 'Kiểm tra chất lượng hàng',
    reasonKr: '품질 검사',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
  {
    id: 'default-glossary-5',
    reasonVi: 'Sửa máy',
    reasonKr: '설비 수리',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
  {
    id: 'default-glossary-6',
    reasonVi: 'Đổi model',
    reasonKr: '모델 교체',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
  {
    id: 'default-glossary-7',
    reasonVi: 'Đóng gói hàng gấp',
    reasonKr: '긴급 포장 작업',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
  {
    id: 'default-glossary-8',
    reasonVi: 'Vệ sinh nhà xưởng',
    reasonKr: '공장 청소',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
  {
    id: 'default-glossary-9',
    reasonVi: 'Họp sản xuất',
    reasonKr: '생산 회의',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
  {
    id: 'default-glossary-10',
    reasonVi: 'Kiểm kê kho',
    reasonKr: '재고 실사',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    is_verified: true,
    isVerified: true,
  },
];

const FACTORY_PHRASE_FALLBACK: Array<[string, string]> = [
  ['trực sản xuất', '생산 당직'],
  ['hỗ trợ sản xuất gấp', '긴급 생산 지원'],
  ['bảo trì, sửa chữa thiết bị', '설비 점검 및 수리'],
  ['bảo trì thiết bị', '설비 보수'],
  ['bảo dưỡng máy', '설비 정기 보수'],
  ['bảo dưỡng', '정기 보수'],
  ['sửa chữa thiết bị', '설비 수리'],
  ['sửa máy', '설비 수리'],
  ['kiểm tra chất lượng hàng', '품질 검사'],
  ['kiểm tra chất lượng', '품질 검사'],
  ['kiểm tra hàng', '품질 검사'],
  ['kiểm tra', '점검'],
  ['đóng gói hàng gấp', '긴급 포장 작업'],
  ['đóng gói', '포장 작업'],
  ['hàng gấp', '긴급 생산'],
  ['xuất hàng', '출하 작업'],
  ['nhập kho', '입고 작업'],
  ['kiểm kê', '재고 실사'],
  ['đổi model', '모델 교체'],
  ['vệ sinh nhà xưởng', '공장 청소'],
  ['vệ sinh', '청소'],
  ['họp sản xuất', '생산 회의'],
  ['dây chuyền', '라인'],
  ['hỗ trợ', '지원'],
  ['sản xuất', '생산'],
];

/**
 * Pure helper: normalizes Vietnamese reason text for exact case/whitespace-insensitive matching.
 */
export function normalizeGlossaryKey(text: string): string {
  return (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Pure helper: finds an exact 100% match (ignoring case & extra spaces) in active glossary entries.
 */
export function findExactGlossaryMatch(
  entries: OvertimeGlossaryEntry[],
  reasonVi: string
): OvertimeGlossaryEntry | null {
  const targetKey = normalizeGlossaryKey(reasonVi);
  if (!targetKey) return null;
  for (const entry of entries) {
    if (entry.deletedAt) continue;
    if (normalizeGlossaryKey(entry.reasonVi) === targetKey) {
      return entry;
    }
  }
  return null;
}

export function isGlossaryEntryVerified(
  entry: Pick<OvertimeGlossaryEntry, 'is_verified' | 'isVerified'>
): boolean {
  if (entry.is_verified === false || entry.isVerified === false) {
    return false;
  }
  return true;
}

export function mapSupabaseGlossaryRowToEntry(
  row: SupabaseGlossaryRow
): OvertimeGlossaryEntry {
  const rawVerified =
    typeof row.is_verified === 'boolean' ? row.is_verified : undefined;
  return {
    id: row.id,
    reasonVi: (row.reason_vi || '').trim(),
    reasonKr: (row.reason_kr || '').trim(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    deletedAt: row.deleted_at ?? null,
    is_verified: rawVerified,
    isVerified: rawVerified !== false,
  };
}

/**
 * Pure helper: inserts or updates a (reasonVi, reasonKr) pair in an entries array,
 * deduplicating by normalized Vietnamese text and placing the latest entry at the top.
 * New entries default to `is_verified: false`; updates preserve the existing verification status.
 */
export function upsertGlossaryEntryInList(
  entries: OvertimeGlossaryEntry[],
  reasonVi: string,
  reasonKr: string,
  nowIso: string = new Date().toISOString()
): {
  entries: OvertimeGlossaryEntry[];
  savedEntry: OvertimeGlossaryEntry;
  isUpdate: boolean;
} {
  const cleanVi = (reasonVi || '').trim().replace(/\s+/g, ' ');
  const cleanKr = (reasonKr || '').trim().replace(/\s+/g, ' ');
  const targetKey = normalizeGlossaryKey(cleanVi);

  const existing = entries.find(
    (e) => !e.deletedAt && normalizeGlossaryKey(e.reasonVi) === targetKey
  );

  if (existing) {
    const preservedFlag =
      typeof existing.is_verified === 'boolean'
        ? existing.is_verified
        : typeof existing.isVerified === 'boolean'
        ? existing.isVerified
        : undefined;
    const updated: OvertimeGlossaryEntry = {
      ...existing,
      reasonVi: cleanVi,
      reasonKr: cleanKr,
      updatedAt: nowIso,
      deletedAt: null,
      is_verified: preservedFlag,
      isVerified: preservedFlag !== false,
    };
    const nextEntries = [
      updated,
      ...entries.filter((e) => e.id !== existing.id),
    ];
    return { entries: nextEntries, savedEntry: updated, isUpdate: true };
  }

  const created: OvertimeGlossaryEntry = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `glossary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reasonVi: cleanVi,
    reasonKr: cleanKr,
    updatedAt: nowIso,
    deletedAt: null,
    is_verified: false,
    isVerified: false,
  };

  return {
    entries: [created, ...entries],
    savedEntry: created,
    isUpdate: false,
  };
}

/**
 * Pure helper: updates the Korean translation of an entry by id in memory.
 */
export function updateGlossaryEntryKrInList(
  entries: OvertimeGlossaryEntry[],
  id: string,
  newReasonKr: string,
  nowIso: string = new Date().toISOString()
): {
  entries: OvertimeGlossaryEntry[];
  updatedEntry: OvertimeGlossaryEntry | null;
} {
  const cleanKr = (newReasonKr || '').trim().replace(/\s+/g, ' ');
  const target = entries.find((e) => e.id === id);
  if (!target || !cleanKr) {
    return { entries, updatedEntry: null };
  }
  const updatedEntry: OvertimeGlossaryEntry = {
    ...target,
    reasonKr: cleanKr,
    updatedAt: nowIso,
  };
  return {
    entries: entries.map((e) => (e.id === id ? updatedEntry : e)),
    updatedEntry,
  };
}

/**
 * Pure helper: marks an entry as verified (`is_verified: true`) by id in memory.
 */
export function approveGlossaryEntryInList(
  entries: OvertimeGlossaryEntry[],
  id: string,
  nowIso: string = new Date().toISOString()
): {
  entries: OvertimeGlossaryEntry[];
  updatedEntry: OvertimeGlossaryEntry | null;
} {
  const target = entries.find((e) => e.id === id);
  if (!target) {
    return { entries, updatedEntry: null };
  }
  const updatedEntry: OvertimeGlossaryEntry = {
    ...target,
    is_verified: true,
    isVerified: true,
    updatedAt: nowIso,
  };
  return {
    entries: entries.map((e) => (e.id === id ? updatedEntry : e)),
    updatedEntry,
  };
}

/**
 * Pure helper: normalizes machine-translated Korean into concise Korean factory overtime report style.
 */
export function cleanFactoryKoreanTranslation(rawKr: string): string {
  const cleaned = (rawKr || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.。!！]+$/, '')
    .replace(/(합니다|입니다|해요|하세요|하십시오|한다|됨)$/u, '')
    .trim();
  return cleaned || (rawKr || '').trim();
}

/**
 * Pure helper: Tier 1 exact lookup + Tier 2 offline factory-term composer fallback.
 */
export function composeLocalFactorySuggestion(
  reasonVi: string,
  entries: OvertimeGlossaryEntry[]
): string {
  const exact = findExactGlossaryMatch(entries, reasonVi);
  if (exact) return exact.reasonKr;

  const lower = normalizeGlossaryKey(reasonVi);
  if (!lower) return '';

  const matchedTerms: string[] = [];
  let remaining = lower;

  for (const [viTerm, krTerm] of FACTORY_PHRASE_FALLBACK) {
    if (remaining.includes(viTerm)) {
      if (!matchedTerms.includes(krTerm)) {
        matchedTerms.push(krTerm);
      }
      remaining = remaining.replace(viTerm, ' ').trim();
    }
  }

  if (matchedTerms.length > 0) {
    return matchedTerms.join(' · ');
  }

  return (reasonVi || '').trim();
}

function normalizeLocalGlossaryEntry(
  entry: OvertimeGlossaryEntry
): OvertimeGlossaryEntry {
  const resolvedFlag =
    typeof entry.is_verified === 'boolean'
      ? entry.is_verified
      : typeof entry.isVerified === 'boolean'
      ? entry.isVerified
      : entry.id?.startsWith('default-glossary-')
      ? true
      : undefined;

  return {
    ...entry,
    is_verified: resolvedFlag,
    isVerified: resolvedFlag !== false,
  };
}

/**
 * Reads glossary synchronously from localStorage (seeding defaults if empty).
 */
export function readLocalOvertimeGlossary(): OvertimeGlossaryEntry[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_OVERTIME_GLOSSARY];
  }
  try {
    const raw = localStorage.getItem(OVERTIME_GLOSSARY_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(
        OVERTIME_GLOSSARY_STORAGE_KEY,
        JSON.stringify(DEFAULT_OVERTIME_GLOSSARY)
      );
      return [...DEFAULT_OVERTIME_GLOSSARY];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as OvertimeGlossaryEntry[])
        .filter((e) => !e.deletedAt)
        .map(normalizeLocalGlossaryEntry);
    }
  } catch {
    // Fallback cleanly to defaults
  }
  return [...DEFAULT_OVERTIME_GLOSSARY];
}

function writeLocalOvertimeGlossary(entries: OvertimeGlossaryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      OVERTIME_GLOSSARY_STORAGE_KEY,
      JSON.stringify(entries)
    );
  } catch {
    // Ignore storage quota errors
  }
}

// Tracks whether the optional Supabase `overtime_glossary` table is available in this session
let remoteGlossaryAvailable: boolean | null = null;

/**
 * Loads glossary entries from localStorage and performs lightweight sync with Supabase
 * `overtime_glossary` (supporting soft-delete via `deleted_at`).
 * Silently falls back to localStorage if the table does not exist or network fails.
 */
export async function loadOvertimeGlossary(): Promise<OvertimeGlossaryEntry[]> {
  const localEntries = readLocalOvertimeGlossary();

  if (remoteGlossaryAvailable === false) {
    return localEntries;
  }

  try {
    const rows = await overtimeSupabase.request<SupabaseGlossaryRow[]>(
      'overtime_glossary?select=*&deleted_at=is.null&order=updated_at.desc'
    );
    remoteGlossaryAvailable = true;

    if (!Array.isArray(rows) || rows.length === 0) {
      return localEntries;
    }

    const mergedByKey = new Map<string, OvertimeGlossaryEntry>();
    for (const entry of localEntries) {
      mergedByKey.set(normalizeGlossaryKey(entry.reasonVi), entry);
    }

    for (const row of rows) {
      if (!row.reason_vi || !row.reason_kr || row.deleted_at) continue;
      const key = normalizeGlossaryKey(row.reason_vi);
      const remoteEntry = mapSupabaseGlossaryRowToEntry({
        ...row,
        deleted_at: null,
      });
      const existing = mergedByKey.get(key);
      if (
        !existing ||
        new Date(remoteEntry.updatedAt).getTime() >=
          new Date(existing.updatedAt).getTime()
      ) {
        mergedByKey.set(key, remoteEntry);
      }
    }

    const merged = Array.from(mergedByKey.values()).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    writeLocalOvertimeGlossary(merged);
    return merged;
  } catch {
    remoteGlossaryAvailable = false;
    return localEntries;
  }
}

/**
 * Saves or updates a (reasonVi, reasonKr) glossary pair to localStorage immediately
 * and syncs lightly to Supabase `overtime_glossary` when available.
 * New remote inserts explicitly include `is_verified: false`; existing rows preserve
 * their current `is_verified` status on update.
 */
export async function upsertOvertimeGlossaryEntry(
  reasonVi: string,
  reasonKr: string
): Promise<{
  entries: OvertimeGlossaryEntry[];
  savedEntry: OvertimeGlossaryEntry | null;
  isUpdate: boolean;
}> {
  const cleanVi = (reasonVi || '').trim();
  const cleanKr = (reasonKr || '').trim();
  if (!cleanVi || !cleanKr) {
    return {
      entries: readLocalOvertimeGlossary(),
      savedEntry: null,
      isUpdate: false,
    };
  }

  const current = readLocalOvertimeGlossary();
  const result = upsertGlossaryEntryInList(current, cleanVi, cleanKr);
  writeLocalOvertimeGlossary(result.entries);

  if (remoteGlossaryAvailable === true) {
    try {
      const normalizedVi = normalizeGlossaryKey(result.savedEntry.reasonVi);
      const existingRows = await overtimeSupabase.request<SupabaseGlossaryRow[]>(
        `overtime_glossary?reason_vi_normalized=eq.${encodeURIComponent(
          normalizedVi
        )}&select=*&limit=1`
      );
      const existingRemote = Array.isArray(existingRows)
        ? existingRows[0]
        : null;

      let persisted: SupabaseGlossaryRow | null = null;
      let resolvedIsUpdate = result.isUpdate;

      if (existingRemote?.id) {
        resolvedIsUpdate = !existingRemote.deleted_at;
        const patchedRows = await overtimeSupabase.request<SupabaseGlossaryRow[]>(
          `overtime_glossary?id=eq.${encodeURIComponent(
            existingRemote.id
          )}&select=*`,
          {
            method: 'PATCH',
            headers: {
              Prefer: 'return=representation',
            },
            body: JSON.stringify({
              reason_vi: result.savedEntry.reasonVi,
              reason_kr: result.savedEntry.reasonKr,
              updated_at: result.savedEntry.updatedAt,
              deleted_at: null,
            }),
          }
        );
        persisted = Array.isArray(patchedRows) ? patchedRows[0] : existingRemote;
      } else {
        const insertedRows = await overtimeSupabase.request<SupabaseGlossaryRow[]>(
          'overtime_glossary?select=*',
          {
            method: 'POST',
            headers: {
              Prefer: 'return=representation',
            },
            body: JSON.stringify({
              reason_vi: result.savedEntry.reasonVi,
              reason_vi_normalized: normalizedVi,
              reason_kr: result.savedEntry.reasonKr,
              updated_at: result.savedEntry.updatedAt,
              deleted_at: null,
              is_verified: false,
            }),
          }
        );
        persisted = Array.isArray(insertedRows) ? insertedRows[0] : null;
      }

      if (persisted?.id) {
        const persistedVerified =
          typeof persisted.is_verified === 'boolean'
            ? persisted.is_verified
            : undefined;
        const syncedEntry: OvertimeGlossaryEntry = {
          ...result.savedEntry,
          id: persisted.id,
          updatedAt: persisted.updated_at || result.savedEntry.updatedAt,
          is_verified: persistedVerified,
          isVerified: persistedVerified !== false,
        };
        const syncedEntries = result.entries.map((item) =>
          item.id === result.savedEntry.id ? syncedEntry : item
        );
        writeLocalOvertimeGlossary(syncedEntries);
        return {
          entries: syncedEntries,
          savedEntry: syncedEntry,
          isUpdate: resolvedIsUpdate,
        };
      }
    } catch {
      // Never interrupt UI on optional cloud glossary sync failure
    }
  }

  return result;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function syncGlossaryPatchToSupabase(
  entry: OvertimeGlossaryEntry,
  patchBody: Record<string, unknown>
): Promise<SupabaseGlossaryRow | null> {
  if (remoteGlossaryAvailable === false) return null;

  try {
    if (UUID_REGEX.test(entry.id)) {
      const patchedRows = await overtimeSupabase.request<SupabaseGlossaryRow[]>(
        `overtime_glossary?id=eq.${encodeURIComponent(entry.id)}&select=*`,
        {
          method: 'PATCH',
          headers: {
            Prefer: 'return=representation',
          },
          body: JSON.stringify(patchBody),
        }
      );
      remoteGlossaryAvailable = true;
      if (Array.isArray(patchedRows) && patchedRows[0]) {
        return patchedRows[0];
      }
    }

    const normalizedVi = normalizeGlossaryKey(entry.reasonVi);
    const existingRows = await overtimeSupabase.request<SupabaseGlossaryRow[]>(
      `overtime_glossary?reason_vi_normalized=eq.${encodeURIComponent(
        normalizedVi
      )}&select=*&limit=1`
    );
    remoteGlossaryAvailable = true;
    const existingRemote = Array.isArray(existingRows)
      ? existingRows[0]
      : null;

    if (existingRemote?.id) {
      const patchedRows = await overtimeSupabase.request<SupabaseGlossaryRow[]>(
        `overtime_glossary?id=eq.${encodeURIComponent(
          existingRemote.id
        )}&select=*`,
        {
          method: 'PATCH',
          headers: {
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            ...patchBody,
            deleted_at: null,
          }),
        }
      );
      return Array.isArray(patchedRows) && patchedRows[0]
        ? patchedRows[0]
        : existingRemote;
    }

    const insertedRows = await overtimeSupabase.request<SupabaseGlossaryRow[]>(
      'overtime_glossary?select=*',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          reason_vi: entry.reasonVi,
          reason_vi_normalized: normalizedVi,
          reason_kr: entry.reasonKr,
          updated_at: entry.updatedAt,
          deleted_at: null,
          is_verified: entry.is_verified !== false,
          ...patchBody,
        }),
      }
    );
    return Array.isArray(insertedRows) && insertedRows[0]
      ? insertedRows[0]
      : null;
  } catch {
    return null;
  }
}

/**
 * Updates the Korean translation (`reason_kr`) of an existing glossary entry in localStorage
 * and syncs to Supabase `overtime_glossary` without altering its verification flag.
 */
export async function updateGlossaryEntryKr(
  id: string,
  newReasonKr: string
): Promise<{
  entries: OvertimeGlossaryEntry[];
  updatedEntry: OvertimeGlossaryEntry | null;
}> {
  const cleanKr = (newReasonKr || '').trim().replace(/\s+/g, ' ');
  if (!cleanKr) {
    throw new Error('Bản dịch tiếng Hàn không được để trống.');
  }

  const nowIso = new Date().toISOString();
  const current = readLocalOvertimeGlossary();
  const result = updateGlossaryEntryKrInList(current, id, cleanKr, nowIso);
  if (!result.updatedEntry) {
    return result;
  }

  writeLocalOvertimeGlossary(result.entries);

  const persisted = await syncGlossaryPatchToSupabase(result.updatedEntry, {
    reason_kr: result.updatedEntry.reasonKr,
    updated_at: nowIso,
  });

  if (persisted?.id) {
    const syncedEntry = mapSupabaseGlossaryRowToEntry({
      ...persisted,
      deleted_at: null,
    });
    const syncedEntries = result.entries.map((item) =>
      item.id === id ? syncedEntry : item
    );
    writeLocalOvertimeGlossary(syncedEntries);
    return {
      entries: syncedEntries,
      updatedEntry: syncedEntry,
    };
  }

  return result;
}

/**
 * Approves a glossary entry by setting `is_verified = true` locally and on Supabase.
 */
export async function approveGlossaryEntry(id: string): Promise<{
  entries: OvertimeGlossaryEntry[];
  updatedEntry: OvertimeGlossaryEntry | null;
}> {
  const nowIso = new Date().toISOString();
  const current = readLocalOvertimeGlossary();
  const result = approveGlossaryEntryInList(current, id, nowIso);
  if (!result.updatedEntry) {
    return result;
  }

  writeLocalOvertimeGlossary(result.entries);

  const persisted = await syncGlossaryPatchToSupabase(result.updatedEntry, {
    is_verified: true,
    updated_at: nowIso,
  });

  if (persisted?.id) {
    const syncedEntry = mapSupabaseGlossaryRowToEntry({
      ...persisted,
      is_verified: true,
      deleted_at: null,
    });
    const syncedEntries = result.entries.map((item) =>
      item.id === id ? syncedEntry : item
    );
    writeLocalOvertimeGlossary(syncedEntries);
    return {
      entries: syncedEntries,
      updatedEntry: syncedEntry,
    };
  }

  return result;
}

/**
 * 3-tier translation suggestion:
 * - Tier 1: Exact match in internal glossary (instant, standard factory phrasing)
 * - Tier 2/3: Contextual concise factory overtime translation (Vietnamese -> Korean)
 *   with automatic offline fallback to built-in factory phrase dictionary.
 */
export async function suggestFactoryKoreanTranslation(
  reasonVi: string,
  entries: OvertimeGlossaryEntry[]
): Promise<{ translation: string; source: 'glossary' | 'contextual' }> {
  const cleanVi = (reasonVi || '').trim();
  if (!cleanVi) {
    return { translation: '', source: 'glossary' };
  }

  // Tier 1: Exact match in internal glossary
  const exact = findExactGlossaryMatch(entries, cleanVi);
  if (exact) {
    return { translation: exact.reasonKr, source: 'glossary' };
  }

  // Tier 3: Contextual translation for concise factory overtime reasons
  try {
    // Contextual hint wrapper helps MT pick manufacturing/overtime vocabulary, then strip the prefix cleanly
    const delimiter = ' | ';
    const contextualQuery = `Lý do làm thêm giờ nhà máy sản xuất${delimiter}${cleanVi}`;
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=ko&dt=t&q=${encodeURIComponent(
        contextualQuery
      )}`
    );
    if (response.ok) {
      const data = await response.json();
      const fullTranslated = Array.isArray(data?.[0])
        ? data[0]
            .map((item: [string]) => item?.[0] || '')
            .join('')
        : '';

      if (fullTranslated) {
        const pipeIdx = fullTranslated.indexOf('|');
        const extracted =
          pipeIdx !== -1
            ? fullTranslated.slice(pipeIdx + 1).trim()
            : fullTranslated.trim();
        const refined = cleanFactoryKoreanTranslation(extracted);
        if (refined) {
          return { translation: refined, source: 'contextual' };
        }
      }
    }
  } catch {
    // Fall back cleanly to direct translation or offline factory dictionary
  }

  // Direct fallback call if contextual delimiter failed
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=ko&dt=t&q=${encodeURIComponent(
        cleanVi
      )}`
    );
    if (response.ok) {
      const data = await response.json();
      const raw = Array.isArray(data?.[0])
        ? data[0].map((item: [string]) => item?.[0] || '').join('')
        : '';
      if (raw.trim()) {
        return {
          translation: cleanFactoryKoreanTranslation(raw),
          source: 'contextual',
        };
      }
    }
  } catch {
    // Fall through to offline factory dictionary composer
  }

  return {
    translation: composeLocalFactorySuggestion(cleanVi, entries),
    source: 'contextual',
  };
}
