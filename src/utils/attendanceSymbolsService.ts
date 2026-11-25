import { getOvertimeSupabaseClient, overtimeSupabase } from './overtimeFormsService';
import {
  AttendanceSymbol,
  AttendanceSymbolCategory,
  AttendanceSymbolColor,
  DEFAULT_ATTENDANCE_SYMBOLS,
  inferSystemKeyFromCode,
  isValidSymbolCategory,
  normalizeSymbolCode,
  normalizeSymbolColor,
  sortAttendanceSymbols,
} from './attendanceSymbolsLogic';

const ATTENDANCE_SYMBOLS_STORAGE_KEY = 'hr_pro_attendance_symbols_v1';

export interface SupabaseAttendanceSymbolRow {
  id?: string | null;
  code: string;
  name: string;
  description?: string | null;
  note?: string | null;
  category: string;
  work_value?: number | null;
  workday_value?: number | null;
  paid_ratio?: number | null;
  salary_percent?: number | null;
  color_theme?: string | null;
  color?: string | null;
  is_system?: boolean | null;
  system_key?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type AttendanceSymbolUpsertInput = Omit<
  AttendanceSymbol,
  'id' | 'createdAt' | 'updatedAt'
> & {
  id?: string;
  originalCode?: string;
};

function isMissingTableOrSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('42P01') ||
    msg.includes('PGRST205') ||
    msg.includes('does not exist') ||
    msg.includes('Could not find the table') ||
    msg.includes('42501')
  );
}

export function mapSupabaseRowToAttendanceSymbol(
  row: SupabaseAttendanceSymbolRow
): AttendanceSymbol {
  const code = normalizeSymbolCode(row.code || '');
  const category: AttendanceSymbolCategory = isValidSymbolCategory(row.category)
    ? row.category
    : 'work';
  const color: AttendanceSymbolColor = normalizeSymbolColor(
    row.color_theme ?? row.color
  );

  const rawWorkValue = row.work_value ?? row.workday_value;
  const workdayValue =
    rawWorkValue !== null &&
    rawWorkValue !== undefined &&
    Number.isFinite(Number(rawWorkValue))
      ? Number(rawWorkValue)
      : 1;

  const rawPaidRatio = row.paid_ratio ?? row.salary_percent;
  const salaryPercent =
    rawPaidRatio !== null &&
    rawPaidRatio !== undefined &&
    Number.isFinite(Number(rawPaidRatio))
      ? Number(rawPaidRatio)
      : 100;

  const sortOrder =
    row.sort_order !== null &&
    row.sort_order !== undefined &&
    Number.isFinite(Number(row.sort_order))
      ? Number(row.sort_order)
      : 99;

  const rawId = row.id && String(row.id) !== 'undefined' ? String(row.id) : '';
  const id = rawId || code || `sym-${sortOrder}`;

  return {
    id,
    code,
    name: (row.name || '').trim(),
    category,
    workdayValue,
    salaryPercent,
    color,
    note: (row.description ?? row.note ?? '').trim(),
    isSystem: Boolean(row.is_system),
    systemKey: row.system_key || inferSystemKeyFromCode(code),
    sortOrder,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

function toSupabasePayload(symbol: AttendanceSymbol) {
  return {
    code: normalizeSymbolCode(symbol.code),
    name: symbol.name.trim(),
    description: (symbol.note || '').trim(),
    work_value: Number(symbol.workdayValue ?? 0),
    paid_ratio: Number(symbol.salaryPercent ?? 0),
    color_theme: normalizeSymbolColor(symbol.color),
    category: symbol.category,
    is_system: Boolean(symbol.isSystem),
    sort_order: Number.isFinite(Number(symbol.sortOrder))
      ? Number(symbol.sortOrder)
      : 99,
    updated_at: new Date().toISOString(),
  };
}

function sanitizeCachedSymbol(raw: AttendanceSymbol, index: number): AttendanceSymbol {
  const code = normalizeSymbolCode(raw.code || '');
  const id =
    raw.id && raw.id !== 'undefined'
      ? raw.id
      : code || `sym-${raw.sortOrder ?? index + 1}`;
  return {
    ...raw,
    id,
    code,
    category: isValidSymbolCategory(raw.category) ? raw.category : 'work',
    color: normalizeSymbolColor(raw.color),
    systemKey: raw.systemKey ?? inferSystemKeyFromCode(code),
  };
}

export function readLocalAttendanceSymbols(): AttendanceSymbol[] {
  if (typeof window === 'undefined') {
    return sortAttendanceSymbols(DEFAULT_ATTENDANCE_SYMBOLS);
  }
  try {
    const raw = localStorage.getItem(ATTENDANCE_SYMBOLS_STORAGE_KEY);
    if (!raw) {
      const seeded = sortAttendanceSymbols(DEFAULT_ATTENDANCE_SYMBOLS);
      localStorage.setItem(
        ATTENDANCE_SYMBOLS_STORAGE_KEY,
        JSON.stringify(seeded)
      );
      return seeded;
    }
    const parsed = JSON.parse(raw) as AttendanceSymbol[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized = sortAttendanceSymbols(
        parsed.map((item, idx) => sanitizeCachedSymbol(item, idx))
      );
      return sanitized;
    }
  } catch {
    // Ignore storage read errors
  }
  return sortAttendanceSymbols(DEFAULT_ATTENDANCE_SYMBOLS);
}

export function writeLocalAttendanceSymbols(symbols: AttendanceSymbol[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      ATTENDANCE_SYMBOLS_STORAGE_KEY,
      JSON.stringify(sortAttendanceSymbols(symbols))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchAttendanceSymbols(): Promise<{
  symbols: AttendanceSymbol[];
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  try {
    const rows = await overtimeSupabase.request<SupabaseAttendanceSymbolRow[]>(
      'attendance_symbols?select=*&order=sort_order.asc,created_at.asc'
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const mapped = sortAttendanceSymbols(
        rows.map(mapSupabaseRowToAttendanceSymbol)
      );
      writeLocalAttendanceSymbols(mapped);
      return {
        symbols: mapped,
        source: 'supabase',
        schemaNeedsMigration: false,
      };
    }

    // Seed defaults if table exists on Supabase but is currently empty
    const seedPayloads = DEFAULT_ATTENDANCE_SYMBOLS.map(toSupabasePayload);
    const inserted = await overtimeSupabase.request<
      SupabaseAttendanceSymbolRow[]
    >('attendance_symbols?on_conflict=code&select=*', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation,resolution=merge-duplicates',
      },
      body: JSON.stringify(seedPayloads),
    });

    const mapped = sortAttendanceSymbols(
      Array.isArray(inserted) && inserted.length > 0
        ? inserted.map(mapSupabaseRowToAttendanceSymbol)
        : DEFAULT_ATTENDANCE_SYMBOLS
    );
    writeLocalAttendanceSymbols(mapped);
    return {
      symbols: mapped,
      source: 'supabase',
      schemaNeedsMigration: false,
    };
  } catch (err) {
    return {
      symbols: readLocalAttendanceSymbols(),
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export async function upsertAttendanceSymbol(
  input: AttendanceSymbolUpsertInput,
  existingSymbols: AttendanceSymbol[]
): Promise<{
  savedSymbol: AttendanceSymbol;
  symbols: AttendanceSymbol[];
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  const maxOrder = existingSymbols.reduce(
    (max, item) => Math.max(max, item.sortOrder ?? 0),
    0
  );
  const normCode = normalizeSymbolCode(input.code);
  const origCode = input.originalCode
    ? normalizeSymbolCode(input.originalCode)
    : '';
  const symbol: AttendanceSymbol = {
    id: input.id && input.id !== 'undefined' ? input.id : normCode,
    code: normCode,
    name: input.name.trim(),
    category: input.category,
    workdayValue: Number(input.workdayValue ?? 0),
    salaryPercent: Number(input.salaryPercent ?? 0),
    color: normalizeSymbolColor(input.color),
    note: (input.note || '').trim(),
    isSystem: Boolean(input.isSystem),
    systemKey: input.systemKey ?? inferSystemKeyFromCode(normCode),
    sortOrder:
      input.sortOrder !== undefined ? Number(input.sortOrder) : maxOrder + 1,
    updatedAt: new Date().toISOString(),
  };

  const payload = toSupabasePayload(symbol);

  try {
    let rows: SupabaseAttendanceSymbolRow[];
    if (origCode && origCode !== normCode) {
      rows = await overtimeSupabase.request<SupabaseAttendanceSymbolRow[]>(
        `attendance_symbols?code=eq.${encodeURIComponent(origCode)}&select=*`,
        {
          method: 'PATCH',
          headers: {
            Prefer: 'return=representation',
          },
          body: JSON.stringify(payload),
        }
      );
    } else {
      rows = await overtimeSupabase.request<SupabaseAttendanceSymbolRow[]>(
        'attendance_symbols?on_conflict=code&select=*',
        {
          method: 'POST',
          headers: {
            Prefer: 'return=representation,resolution=merge-duplicates',
          },
          body: JSON.stringify(payload),
        }
      );
    }

    const saved =
      Array.isArray(rows) && rows[0]
        ? mapSupabaseRowToAttendanceSymbol(rows[0])
        : symbol;

    const nextList = sortAttendanceSymbols([
      saved,
      ...existingSymbols.filter(
        (s) =>
          s.id !== symbol.id &&
          s.id !== saved.id &&
          normalizeSymbolCode(s.code) !== origCode &&
          normalizeSymbolCode(s.code) !== saved.code
      ),
    ]);
    writeLocalAttendanceSymbols(nextList);

    return {
      savedSymbol: saved,
      symbols: nextList,
      source: 'supabase',
      schemaNeedsMigration: false,
    };
  } catch (err) {
    const nextList = sortAttendanceSymbols([
      symbol,
      ...existingSymbols.filter(
        (s) =>
          s.id !== symbol.id &&
          normalizeSymbolCode(s.code) !== origCode &&
          normalizeSymbolCode(s.code) !== symbol.code
      ),
    ]);
    writeLocalAttendanceSymbols(nextList);

    return {
      savedSymbol: symbol,
      symbols: nextList,
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export async function deleteAttendanceSymbol(
  symbolId: string,
  existingSymbols: AttendanceSymbol[]
): Promise<{
  symbols: AttendanceSymbol[];
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  const target = existingSymbols.find(
    (s) => s.id === symbolId || normalizeSymbolCode(s.code) === normalizeSymbolCode(symbolId)
  );
  if (target?.isSystem) {
    throw new Error('Không thể xóa ký hiệu cốt lõi của hệ thống.');
  }

  const targetCode = normalizeSymbolCode(target?.code || symbolId);

  try {
    await overtimeSupabase.request(
      `attendance_symbols?code=eq.${encodeURIComponent(targetCode)}`,
      {
        method: 'DELETE',
      }
    );
    const nextList = sortAttendanceSymbols(
      existingSymbols.filter(
        (s) => s.id !== symbolId && normalizeSymbolCode(s.code) !== targetCode
      )
    );
    writeLocalAttendanceSymbols(nextList);
    return {
      symbols: nextList,
      source: 'supabase',
      schemaNeedsMigration: false,
    };
  } catch (err) {
    const nextList = sortAttendanceSymbols(
      existingSymbols.filter(
        (s) => s.id !== symbolId && normalizeSymbolCode(s.code) !== targetCode
      )
    );
    writeLocalAttendanceSymbols(nextList);
    return {
      symbols: nextList,
      source: 'local',
      schemaNeedsMigration: isMissingTableOrSchemaError(err),
    };
  }
}

export interface AttendanceSymbolsRealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRow: Record<string, unknown> | null;
  oldRow: Record<string, unknown> | null;
}

export function applyRealtimeAttendanceSymbolPayload(
  current: AttendanceSymbol[],
  event: AttendanceSymbolsRealtimeEvent
): AttendanceSymbol[] {
  if (event.eventType === 'DELETE') {
    const oldId =
      event.oldRow && typeof event.oldRow.id === 'string'
        ? event.oldRow.id
        : '';
    const oldCode =
      event.oldRow && typeof event.oldRow.code === 'string'
        ? normalizeSymbolCode(event.oldRow.code)
        : '';
    if (!oldId && !oldCode) return current;
    const next = current.filter(
      (item) =>
        (!oldId || item.id !== oldId) &&
        (!oldCode || normalizeSymbolCode(item.code) !== oldCode)
    );
    writeLocalAttendanceSymbols(next);
    return next;
  }

  if (!event.newRow) return current;
  const mapped = mapSupabaseRowToAttendanceSymbol(
    event.newRow as unknown as SupabaseAttendanceSymbolRow
  );
  if (!mapped.code && !mapped.id) return current;
  const next = sortAttendanceSymbols([
    mapped,
    ...current.filter(
      (item) =>
        item.id !== mapped.id &&
        normalizeSymbolCode(item.code) !== normalizeSymbolCode(mapped.code)
    ),
  ]);
  writeLocalAttendanceSymbols(next);
  return next;
}

export function subscribeToAttendanceSymbolsRealtime(
  onChange: (event: AttendanceSymbolsRealtimeEvent) => void,
  onStatusChange?: (status: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const client = getOvertimeSupabaseClient();
  const channelName = `attendance-symbols-realtime-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'attendance_symbols' },
      (payload) =>
        onChange({
          eventType: 'INSERT',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'attendance_symbols' },
      (payload) =>
        onChange({
          eventType: 'UPDATE',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'attendance_symbols' },
      (payload) =>
        onChange({
          eventType: 'DELETE',
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        })
    )
    .subscribe((status) => {
      onStatusChange?.(status);
    });

  return () => {
    void client.removeChannel(channel);
  };
}
