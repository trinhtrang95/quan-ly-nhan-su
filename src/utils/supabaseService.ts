import {
  Employee,
  Gender,
  LeaveRecord,
  LeaveRecordType,
  RegimeSubtype,
  WorkStatus,
} from '../types/hr';
import {
  createAvatarSvgDataUri,
  INITIAL_EMPLOYEES,
  INITIAL_LEAVE_RECORDS,
} from '../data/mockData';
import { formatDateVN, LEAVE_TYPE_META } from './hrCalculations';

export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_SUPABASE_URL) ||
  'https://txhnuqhslalgrbritqtj.supabase.co';

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_3-67g0uGEgJ6OReOwxNnQQ_YjTz84eC';

export const HR_IMAGES_BUCKET = 'hr-images';

export interface SupabaseEmployeeRow {
  id: string;
  employee_code: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  cccd: string | null;
  phone: string | null;
  address: string | null;
  department: string | null;
  avatar_url: string | null;
  annual_leave_quota: number | null;
  status: string | null;
  created_at?: string;
}

export interface SupabaseLeaveLogRow {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string | null;
  duration: number;
  reason: string | null;
  proof_image_url: string | null;
  created_at?: string;
}

/**
 * Helper for Supabase PostgREST API calls using pure native fetch
 */
async function supabaseRestFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Supabase REST error (${res.status}): ${errText}`);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

/**
 * Maps a Supabase `employees` row to our frontend `Employee` model
 */
export function mapSupabaseRowToEmployee(row: SupabaseEmployeeRow): Employee {
  const fullName = row.full_name || 'Nhân sự';
  const parts = fullName.trim().split(' ').filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : fullName.slice(0, 2).toUpperCase();

  return {
    id: String(row.id),
    employeeCode: row.employee_code || 'NV000',
    fullName,
    dob: row.dob || '1995-01-01',
    gender: (row.gender as Gender) || 'Nam',
    cccd: row.cccd || '',
    phone: row.phone || '',
    address: row.address || '',
    department: row.department || 'Phòng Kỹ thuật & CNTT',
    position: 'Chuyên viên',
    joinDate: row.created_at ? row.created_at.slice(0, 10) : '2024-01-01',
    standardAnnualLeave:
      row.annual_leave_quota !== null && row.annual_leave_quota !== undefined
        ? Number(row.annual_leave_quota)
        : 12,
    status: (row.status as WorkStatus) || 'Đang làm việc',
    avatarUrl:
      row.avatar_url || createAvatarSvgDataUri(initials, '#0F232E', '#0D9488'),
  };
}

/**
 * Encodes `type` and optional `regimeSubtype` into `leave_type` column
 */
export function encodeLeaveTypeForDb(
  type: LeaveRecordType,
  regimeSubtype?: RegimeSubtype
): string {
  if (type === 'regime_leave' && regimeSubtype) {
    return `regime_leave|${regimeSubtype}`;
  }
  return type;
}

/**
 * Decodes `leave_type` column from Supabase into `{ type, regimeSubtype }`
 */
export function decodeLeaveTypeFromDb(rawType: string): {
  type: LeaveRecordType;
  regimeSubtype?: RegimeSubtype;
} {
  if (!rawType) return { type: 'annual_leave' };
  if (rawType.startsWith('regime_leave|')) {
    const sub = rawType.split('|')[1] as RegimeSubtype;
    return { type: 'regime_leave', regimeSubtype: sub || 'Ốm đau / Viện phí' };
  }
  if (
    rawType === 'annual_leave' ||
    rawType === 'unpaid_leave' ||
    rawType === 'regime_leave' ||
    rawType === 'late_early'
  ) {
    return {
      type: rawType,
      regimeSubtype: rawType === 'regime_leave' ? 'Ốm đau / Viện phí' : undefined,
    };
  }
  const lower = rawType.toLowerCase();
  if (lower.includes('muộn') || lower.includes('sớm') || lower.includes('late')) {
    return { type: 'late_early' };
  }
  if (lower.includes('không lương') || lower.includes('unpaid')) {
    return { type: 'unpaid_leave' };
  }
  if (lower.includes('chế độ') || lower.includes('ốm') || lower.includes('thai sản')) {
    return { type: 'regime_leave', regimeSubtype: 'Ốm đau / Viện phí' };
  }
  return { type: 'annual_leave' };
}

/**
 * Maps a Supabase `leave_logs` row to our frontend `LeaveRecord` model
 */
export function mapSupabaseRowToLeaveRecord(
  row: SupabaseLeaveLogRow,
  empMap?: Map<string, Employee>
): LeaveRecord {
  const { type, regimeSubtype } = decodeLeaveTypeFromDb(row.leave_type);
  const emp = empMap?.get(String(row.employee_id));
  const meta = LEAVE_TYPE_META[type];

  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    type,
    regimeSubtype,
    startDate: row.start_date,
    endDate: row.end_date || row.start_date,
    amount: Number(row.duration || 0),
    reason: row.reason || '',
    attachmentUrl: row.proof_image_url || undefined,
    attachmentTitle: row.proof_image_url
      ? `${meta.shortLabel} - ${emp ? emp.fullName : ''} (${formatDateVN(row.start_date)})`
      : undefined,
    createdAt: row.created_at ? row.created_at.slice(0, 10) : row.start_date,
    approvedBy: 'Trần Thu Trang',
  };
}

/**
 * Uploads an image File (avatar or leave proof photo) to Supabase Storage bucket `hr-images`
 * using pure fetch and returns its Public URL. Falls back to Data URI if storage upload fails.
 */
export async function uploadImageToHrBucket(
  file: File,
  folder: 'avatars' | 'proofs'
): Promise<string> {
  try {
    const ext = (file.name.split('.').pop() || 'png').replace(/[^a-zA-Z0-9]/g, '');
    const safeName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${HR_IMAGES_BUCKET}/${safeName}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': file.type || 'image/png',
        'x-upsert': 'true',
      },
      body: file,
    });

    if (!res.ok) {
      throw new Error(`Storage upload failed (${res.status})`);
    }

    return `${SUPABASE_URL}/storage/v1/object/public/${HR_IMAGES_BUCKET}/${safeName}`;
  } catch (err) {
    console.warn('Fallback to Data URI for image upload:', err);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

let initPromise: Promise<{
  employees: Employee[];
  records: LeaveRecord[];
  connected: boolean;
}> | null = null;

/**
 * Loads `employees` and `leave_logs` from Supabase via REST API.
 * If `employees` on Supabase is empty (0 rows), automatically seeds `INITIAL_EMPLOYEES`
 * and `INITIAL_LEAVE_RECORDS` into Supabase.
 */
export async function loadOrSeedSupabaseData(): Promise<{
  employees: Employee[];
  records: LeaveRecord[];
  connected: boolean;
}> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let finalEmpRows = await supabaseRestFetch<SupabaseEmployeeRow[]>(
        'employees?select=*&order=employee_code.asc'
      );

      // Auto-seed if `employees` table is empty (0 rows)
      if (!finalEmpRows || finalEmpRows.length === 0) {
        const seedEmpPayloads = INITIAL_EMPLOYEES.map((emp) => ({
          employee_code: emp.employeeCode,
          full_name: emp.fullName,
          dob: emp.dob,
          gender: emp.gender,
          cccd: emp.cccd,
          phone: emp.phone,
          address: emp.address,
          department: emp.department,
          avatar_url: emp.avatarUrl,
          annual_leave_quota: emp.standardAnnualLeave,
          status: emp.status,
        }));

        const insertedEmps = await supabaseRestFetch<SupabaseEmployeeRow[]>(
          'employees?select=*',
          {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(seedEmpPayloads),
          }
        );

        finalEmpRows = (insertedEmps || []).sort((a, b) =>
          (a.employee_code || '').localeCompare(b.employee_code || '')
        );
      }

      const employees = finalEmpRows.map(mapSupabaseRowToEmployee);
      const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

      const codeToSupabaseId = new Map<string, string>();
      for (const e of employees) {
        codeToSupabaseId.set(e.employeeCode, e.id);
      }

      let finalLogRows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
        'leave_logs?select=*&order=start_date.desc'
      );

      if ((!finalLogRows || finalLogRows.length === 0) && employees.length > 0) {
        const oldIdToCode = new Map<string, string>(
          INITIAL_EMPLOYEES.map((e) => [e.id, e.employeeCode])
        );

        const seedLogPayloads = INITIAL_LEAVE_RECORDS.map((rec) => {
          const code = oldIdToCode.get(rec.employeeId);
          const targetEmpId =
            (code && codeToSupabaseId.get(code)) || employees[0].id;
          return {
            employee_id: targetEmpId,
            leave_type: encodeLeaveTypeForDb(rec.type, rec.regimeSubtype),
            start_date: rec.startDate,
            end_date: rec.endDate,
            duration: rec.amount,
            reason: rec.reason,
            proof_image_url: rec.attachmentUrl || null,
          };
        });

        const insertedLogs = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
          'leave_logs?select=*',
          {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(seedLogPayloads),
          }
        );

        if (insertedLogs) {
          finalLogRows = insertedLogs;
        }
      }

      const records = (finalLogRows || []).map((row) =>
        mapSupabaseRowToLeaveRecord(row, empMap)
      );

      return {
        employees,
        records,
        connected: true,
      };
    } catch (error) {
      console.error('Supabase sync error, falling back to local data:', error);
      return {
        employees: INITIAL_EMPLOYEES,
        records: INITIAL_LEAVE_RECORDS,
        connected: false,
      };
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Inserts a new employee into Supabase `employees`
 */
export async function createEmployeeInSupabase(
  empData: Omit<Employee, 'id'>
): Promise<Employee> {
  const payload = {
    employee_code: empData.employeeCode,
    full_name: empData.fullName,
    dob: empData.dob,
    gender: empData.gender,
    cccd: empData.cccd,
    phone: empData.phone,
    address: empData.address,
    department: empData.department,
    avatar_url: empData.avatarUrl,
    annual_leave_quota: empData.standardAnnualLeave,
    status: empData.status,
  };

  const rows = await supabaseRestFetch<SupabaseEmployeeRow[]>(
    'employees?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([payload]),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to insert employee into Supabase');
  }

  return mapSupabaseRowToEmployee(rows[0]);
}

/**
 * Bulk inserts multiple employees into Supabase `employees`
 */
export async function bulkCreateEmployeesInSupabase(
  empList: Omit<Employee, 'id'>[]
): Promise<Employee[]> {
  const payloads = empList.map((empData) => ({
    employee_code: empData.employeeCode,
    full_name: empData.fullName,
    dob: empData.dob,
    gender: empData.gender,
    cccd: empData.cccd,
    phone: empData.phone,
    address: empData.address,
    department: empData.department,
    avatar_url: empData.avatarUrl,
    annual_leave_quota: empData.standardAnnualLeave,
    status: empData.status,
  }));

  const rows = await supabaseRestFetch<SupabaseEmployeeRow[]>(
    'employees?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payloads),
    }
  );

  return (rows || []).map(mapSupabaseRowToEmployee);
}

/**
 * Updates an existing employee in Supabase `employees`
 */
export async function updateEmployeeInSupabase(
  id: string,
  empData: Omit<Employee, 'id'>
): Promise<Employee> {
  const payload = {
    employee_code: empData.employeeCode,
    full_name: empData.fullName,
    dob: empData.dob,
    gender: empData.gender,
    cccd: empData.cccd,
    phone: empData.phone,
    address: empData.address,
    department: empData.department,
    avatar_url: empData.avatarUrl,
    annual_leave_quota: empData.standardAnnualLeave,
    status: empData.status,
  };

  const rows = await supabaseRestFetch<SupabaseEmployeeRow[]>(
    `employees?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to update employee in Supabase');
  }

  return mapSupabaseRowToEmployee(rows[0]);
}

/**
 * Deletes one or more employees (and their dependent leave_logs) from Supabase
 */
export async function deleteEmployeesFromSupabase(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const inClause = `(${ids.map((id) => `"${id}"`).join(',')})`;

  await supabaseRestFetch<void>(
    `leave_logs?employee_id=in.${encodeURIComponent(inClause)}`,
    { method: 'DELETE' }
  ).catch(() => {});

  await supabaseRestFetch<void>(
    `employees?id=in.${encodeURIComponent(inClause)}`,
    { method: 'DELETE' }
  );
}

/**
 * Inserts a new leave/late record into Supabase `leave_logs`
 */
export async function createLeaveLogInSupabase(
  recData: Omit<LeaveRecord, 'id'>,
  empMap?: Map<string, Employee>
): Promise<LeaveRecord> {
  const payload = {
    employee_id: recData.employeeId,
    leave_type: encodeLeaveTypeForDb(recData.type, recData.regimeSubtype),
    start_date: recData.startDate,
    end_date: recData.endDate,
    duration: recData.amount,
    reason: recData.reason,
    proof_image_url: recData.attachmentUrl || null,
  };

  const rows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
    'leave_logs?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([payload]),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to insert leave log into Supabase');
  }

  return mapSupabaseRowToLeaveRecord(rows[0], empMap);
}

/**
 * Updates an existing leave/late record in Supabase `leave_logs`
 */
export async function updateLeaveLogInSupabase(
  id: string,
  recData: Omit<LeaveRecord, 'id'>,
  empMap?: Map<string, Employee>
): Promise<LeaveRecord> {
  const payload = {
    employee_id: recData.employeeId,
    leave_type: encodeLeaveTypeForDb(recData.type, recData.regimeSubtype),
    start_date: recData.startDate,
    end_date: recData.endDate,
    duration: recData.amount,
    reason: recData.reason,
    proof_image_url: recData.attachmentUrl || null,
  };

  const rows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
    `leave_logs?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to update leave log in Supabase');
  }

  return mapSupabaseRowToLeaveRecord(rows[0], empMap);
}

/**
 * Deletes a leave/late record from Supabase `leave_logs`
 */
export async function deleteLeaveLogFromSupabase(id: string): Promise<void> {
  await supabaseRestFetch<void>(
    `leave_logs?id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}
