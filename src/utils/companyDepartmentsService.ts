import { CompanyDepartment } from '../types/hr';
import { getOvertimeSupabaseClient } from './overtimeFormsService';

export const COMPANY_DEPARTMENTS_STORAGE_KEY = 'hr_pro_company_departments_v1';
export const COMPANY_DEPARTMENTS_EVENT = 'hr-company-departments-changed';

export const DEFAULT_COMPANY_DEPARTMENTS: CompanyDepartment[] = [
  { id: 'cdept-kt', name: 'Kỹ thuật', code: 'KT', sortOrder: 1 },
  { id: 'cdept-sx', name: 'Sản xuất', code: 'SX', sortOrder: 2 },
  { id: 'cdept-qc', name: 'QC', code: 'QC', sortOrder: 3 },
  { id: 'cdept-pt', name: 'Phát triển', code: 'PT', sortOrder: 4 },
];

export function generateCompanyDepartmentCode(name: string): string {
  const clean = name.trim();
  if (!clean) return 'BP';
  const words = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) {
    return words[0].toUpperCase().slice(0, 5);
  }
  return words
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
}

export function sortCompanyDepartments(
  list: CompanyDepartment[]
): CompanyDepartment[] {
  return [...list].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, 'vi');
  });
}

export function normalizeCompanyDepartmentRow(
  row: Record<string, unknown>,
  fallbackIndex = 0
): CompanyDepartment {
  const name = String(row.name ?? '').trim();
  const rawCode = String(row.code ?? '').trim();
  const sortRaw = row.sort_order ?? row.sortOrder;
  const sortOrder =
    typeof sortRaw === 'number' && Number.isFinite(sortRaw)
      ? sortRaw
      : Number.isFinite(Number(sortRaw)) && sortRaw !== '' && sortRaw !== null
        ? Number(sortRaw)
        : fallbackIndex + 1;

  return {
    id: String(row.id ?? `cdept-${fallbackIndex + 1}`),
    name,
    code: rawCode ? rawCode.toUpperCase() : generateCompanyDepartmentCode(name),
    sortOrder,
    createdAt:
      typeof row.created_at === 'string'
        ? row.created_at
        : typeof row.createdAt === 'string'
          ? row.createdAt
          : undefined,
  };
}

export function mergeCompanyDepartmentOptions(
  companyDepartments: CompanyDepartment[],
  existingValues: (string | null | undefined)[] = []
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const dept of sortCompanyDepartments(companyDepartments)) {
    const clean = dept.name?.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }

  for (const val of existingValues) {
    const clean = val?.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }

  return result;
}

export function readLocalCompanyDepartments(): CompanyDepartment[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_COMPANY_DEPARTMENTS.map((d) => ({ ...d }));
  }
  try {
    const raw = window.localStorage.getItem(COMPANY_DEPARTMENTS_STORAGE_KEY);
    if (!raw) {
      writeLocalCompanyDepartments(DEFAULT_COMPANY_DEPARTMENTS);
      return DEFAULT_COMPANY_DEPARTMENTS.map((d) => ({ ...d }));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      writeLocalCompanyDepartments(DEFAULT_COMPANY_DEPARTMENTS);
      return DEFAULT_COMPANY_DEPARTMENTS.map((d) => ({ ...d }));
    }
    const normalized = parsed
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item, idx) => normalizeCompanyDepartmentRow(item, idx))
      .filter((d) => Boolean(d.name));
    if (normalized.length === 0) {
      writeLocalCompanyDepartments(DEFAULT_COMPANY_DEPARTMENTS);
      return DEFAULT_COMPANY_DEPARTMENTS.map((d) => ({ ...d }));
    }
    return sortCompanyDepartments(normalized);
  } catch {
    return DEFAULT_COMPANY_DEPARTMENTS.map((d) => ({ ...d }));
  }
}

export function writeLocalCompanyDepartments(
  list: CompanyDepartment[],
  emitEvent = true
): CompanyDepartment[] {
  const sorted = sortCompanyDepartments(list);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        COMPANY_DEPARTMENTS_STORAGE_KEY,
        JSON.stringify(sorted)
      );
      if (emitEvent) {
        window.dispatchEvent(
          new CustomEvent(COMPANY_DEPARTMENTS_EVENT, { detail: sorted })
        );
      }
    } catch {
      // Ignore storage quota errors silently
    }
  }
  return sorted;
}

async function querySupabaseCompanyDepartments(): Promise<CompanyDepartment[] | null> {
  try {
    const client = getOvertimeSupabaseClient();
    const { data, error } = await client
      .from('company_departments')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !Array.isArray(data)) {
      return null;
    }

    if (data.length === 0) {
      const seedPayload = DEFAULT_COMPANY_DEPARTMENTS.map((d) => ({
        name: d.name,
        code: d.code,
        sort_order: d.sortOrder,
      }));
      const { data: inserted, error: insertErr } = await client
        .from('company_departments')
        .insert(seedPayload)
        .select('*');
      if (!insertErr && Array.isArray(inserted) && inserted.length > 0) {
        const normalizedSeed = sortCompanyDepartments(
          inserted.map((r, i) => normalizeCompanyDepartmentRow(r as Record<string, unknown>, i))
        );
        return normalizedSeed;
      }
      return null;
    }

    return sortCompanyDepartments(
      data.map((r, i) => normalizeCompanyDepartmentRow(r as Record<string, unknown>, i))
    );
  } catch {
    return null;
  }
}

export async function fetchCompanyDepartments(): Promise<CompanyDepartment[]> {
  const remote = await querySupabaseCompanyDepartments();
  if (remote && remote.length > 0) {
    return writeLocalCompanyDepartments(remote, false);
  }
  return readLocalCompanyDepartments();
}

export async function createCompanyDepartment(input: {
  name: string;
  code?: string;
  sortOrder?: number;
}): Promise<CompanyDepartment> {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Tên Bộ phận không được để trống.');
  }
  const cleanCode =
    input.code?.trim().toUpperCase() || generateCompanyDepartmentCode(cleanName);
  const currentLocal = readLocalCompanyDepartments();
  const nextSortOrder =
    input.sortOrder ??
    currentLocal.reduce((max, item) => Math.max(max, item.sortOrder || 0), 0) + 1;

  try {
    const client = getOvertimeSupabaseClient();
    const { data, error } = await client
      .from('company_departments')
      .insert({
        name: cleanName,
        code: cleanCode,
        sort_order: nextSortOrder,
      })
      .select('*')
      .single();

    if (!error && data) {
      const created = normalizeCompanyDepartmentRow(
        data as Record<string, unknown>,
        currentLocal.length
      );
      const next = [...currentLocal.filter((d) => d.id !== created.id), created];
      writeLocalCompanyDepartments(next);
      return created;
    }
  } catch {
    // Fallback to local store when table does not exist yet
  }

  const createdLocal: CompanyDepartment = {
    id: `cdept-${Date.now()}`,
    name: cleanName,
    code: cleanCode,
    sortOrder: nextSortOrder,
    createdAt: new Date().toISOString(),
  };
  writeLocalCompanyDepartments([...currentLocal, createdLocal]);
  return createdLocal;
}

export async function updateCompanyDepartment(
  id: string,
  input: {
    name: string;
    code?: string;
    sortOrder?: number;
  }
): Promise<CompanyDepartment> {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Tên Bộ phận không được để trống.');
  }
  const cleanCode =
    input.code?.trim().toUpperCase() || generateCompanyDepartmentCode(cleanName);
  const currentLocal = readLocalCompanyDepartments();
  const existing = currentLocal.find((d) => d.id === id);
  const resolvedSort = input.sortOrder ?? existing?.sortOrder ?? currentLocal.length;

  try {
    const client = getOvertimeSupabaseClient();
    const { data, error } = await client
      .from('company_departments')
      .update({
        name: cleanName,
        code: cleanCode,
        sort_order: resolvedSort,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (!error && data) {
      const updated = normalizeCompanyDepartmentRow(
        data as Record<string, unknown>,
        resolvedSort - 1
      );
      const next = currentLocal.some((d) => d.id === id)
        ? currentLocal.map((d) => (d.id === id ? updated : d))
        : [...currentLocal, updated];
      writeLocalCompanyDepartments(next);
      return updated;
    }
  } catch {
    // Fallback to local store
  }

  const updatedLocal: CompanyDepartment = {
    id,
    name: cleanName,
    code: cleanCode,
    sortOrder: resolvedSort,
    createdAt: existing?.createdAt,
  };
  const next = currentLocal.some((d) => d.id === id)
    ? currentLocal.map((d) => (d.id === id ? updatedLocal : d))
    : [...currentLocal, updatedLocal];
  writeLocalCompanyDepartments(next);
  return updatedLocal;
}

export async function deleteCompanyDepartment(id: string): Promise<void> {
  const currentLocal = readLocalCompanyDepartments();
  try {
    const client = getOvertimeSupabaseClient();
    await client.from('company_departments').delete().eq('id', id);
  } catch {
    // Ignore if remote table is missing
  }
  writeLocalCompanyDepartments(currentLocal.filter((d) => d.id !== id));
}

export function subscribeToCompanyDepartmentsRealtime(
  onUpdate: (departments: CompanyDepartment[]) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleCustomEvent = (evt: Event) => {
    const detail = (evt as CustomEvent<CompanyDepartment[]>).detail;
    if (Array.isArray(detail)) {
      onUpdate(sortCompanyDepartments(detail));
    } else {
      onUpdate(readLocalCompanyDepartments());
    }
  };

  const handleStorageEvent = (evt: StorageEvent) => {
    if (evt.key === COMPANY_DEPARTMENTS_STORAGE_KEY) {
      onUpdate(readLocalCompanyDepartments());
    }
  };

  window.addEventListener(COMPANY_DEPARTMENTS_EVENT, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  const client = getOvertimeSupabaseClient();
  const channelName = `company-departments-rt-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'company_departments' },
      () => {
        void fetchCompanyDepartments().then((latest) => onUpdate(latest));
      }
    )
    .subscribe();

  return () => {
    window.removeEventListener(COMPANY_DEPARTMENTS_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    void client.removeChannel(channel);
  };
}
