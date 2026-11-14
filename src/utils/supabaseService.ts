import {
  CompanyUnit,
  DepartmentGroup,
  Employee,
  Gender,
  HRBackupPayload,
  LeaveRecord,
  LeaveRecordType,
  PositionItem,
  RegimeSubtype,
  UserAccount,
  UserRole,
  WorkStatus,
} from '../types/hr';
import {
  createAvatarSvgDataUri,
  INITIAL_COMPANY_UNITS,
  INITIAL_EMPLOYEES,
  INITIAL_LEAVE_RECORDS,
  INITIAL_POSITIONS,
  INITIAL_USER_ACCOUNTS,
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

const DEPT_PALETTE = [
  '#0D9488',
  '#0284C7',
  '#7C3AED',
  '#D97706',
  '#E11D48',
  '#16A34A',
];

export const SUPABASE_LEAVE_LOGS_SQL = `-- 1. Tạo bảng leave_logs (nếu chưa tồn tại)
CREATE TABLE IF NOT EXISTS public.leave_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'annual_leave',
  start_date TEXT NOT NULL,
  end_date TEXT,
  duration NUMERIC NOT NULL DEFAULT 1,
  reason TEXT DEFAULT '',
  proof_image_url TEXT,
  paper_status TEXT DEFAULT 'Chưa có',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bổ sung đầy đủ các cột còn thiếu vào bảng leave_logs hiện có
ALTER TABLE public.leave_logs ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.leave_logs ADD COLUMN IF NOT EXISTS leave_type TEXT DEFAULT 'annual_leave';
ALTER TABLE public.leave_logs ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE public.leave_logs ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE public.leave_logs ADD COLUMN IF NOT EXISTS duration NUMERIC DEFAULT 1;
ALTER TABLE public.leave_logs ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '';
ALTER TABLE public.leave_logs ADD COLUMN IF NOT EXISTS proof_image_url TEXT;
ALTER TABLE public.leave_logs ADD COLUMN IF NOT EXISTS paper_status TEXT DEFAULT 'Chưa có';
ALTER TABLE public.leave_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3. Mở quyền truy cập (Row Level Security Policy) cho phép đọc/ghi dữ liệu
ALTER TABLE public.leave_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leave_logs' AND policyname = 'Allow public full access on leave_logs'
  ) THEN
    CREATE POLICY "Allow public full access on leave_logs"
      ON public.leave_logs
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- 4. Làm mới bộ nhớ đệm Schema của Supabase API (PostgREST)
NOTIFY pgrst, 'reload schema';`;

export interface SupabaseCompanyRow {
  id: string;
  code: string;
  name: string;
  logo_url?: string | null;
  address: string | null;
  phone: string | null;
  default_leave_quota: number | null;
  is_initialized: boolean | null;
  created_at?: string;
}

export interface SupabaseDepartmentRow {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  created_at?: string;
}

export interface SupabasePositionRow {
  id: string;
  company_id: string | null;
  name: string;
  created_at?: string;
}

export interface SupabaseAppUserRow {
  id: string;
  username: string;
  password: string;
  full_name: string;
  role: string;
  company_id: string | null;
  created_at?: string;
}

export interface SupabaseEmployeeRow {
  id: string;
  employee_code: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  cccd: string | null;
  cccd_date?: string | null;
  phone: string | null;
  address: string | null;
  department: string | null;
  position?: string | null;
  join_date?: string | null;
  avatar_url: string | null;
  annual_leave_quota: number | null;
  status: string | null;
  company_id?: string | null;
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
  paper_status?: string | null;
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
    cache: 'no-store',
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
 * Maps a Supabase `companies` row to `CompanyUnit`
 */
export function mapSupabaseRowToCompany(row: SupabaseCompanyRow): CompanyUnit {
  const code = row.code || 'UNIT';
  const shortName = 'TS';
  return {
    id: String(row.id),
    code,
    name: row.name || 'Đơn vị Mặc định',
    shortName,
    logoUrl: row.logo_url || undefined,
    address: row.address || '',
    phone: row.phone || '',
    defaultLeaveQuota:
      row.default_leave_quota !== null && row.default_leave_quota !== undefined
        ? Number(row.default_leave_quota)
        : 12,
    isInitialized: Boolean(row.is_initialized),
  };
}

/**
 * Maps a Supabase `departments` row to `DepartmentGroup`
 */
export function mapSupabaseRowToDepartment(
  row: SupabaseDepartmentRow,
  index: number = 0
): DepartmentGroup {
  const rawDesc = row.description || '';
  let code = '';
  let color = DEPT_PALETTE[index % DEPT_PALETTE.length];
  let description = rawDesc;

  if (rawDesc.includes('|')) {
    const parts = rawDesc.split('|');
    code = parts[0] || '';
    if (parts[1] && parts[1].startsWith('#')) {
      color = parts[1];
    }
    description = parts.slice(2).join('|') || '';
  }

  if (!code) {
    const words = (row.name || 'PB')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    code =
      words.length >= 2
        ? words
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 5)
        : (row.name || 'PB').slice(0, 4).toUpperCase();
  }

  return {
    id: String(row.id),
    companyId: row.company_id || null,
    name: row.name,
    code,
    color,
    description,
  };
}

/**
 * Maps a Supabase `positions` row to `PositionItem`
 */
export function mapSupabaseRowToPosition(row: SupabasePositionRow): PositionItem {
  return {
    id: String(row.id),
    companyId: row.company_id || null,
    name: row.name || 'Nhân viên',
    createdAt: row.created_at,
  };
}

/**
 * Maps a Supabase `app_users` row to `UserAccount`
 */
export function mapSupabaseRowToAppUser(row: SupabaseAppUserRow): UserAccount {
  return {
    id: String(row.id),
    username: row.username,
    password: row.password || '',
    fullName: row.full_name || row.username,
    role: row.role === 'admin' ? 'admin' : 'user',
    companyId: row.company_id || null,
    employeeCode: row.username.toUpperCase(),
    department: row.role === 'admin' ? 'Quản trị Hệ thống' : 'Nhân viên Chấm công',
    createdAt: row.created_at ? row.created_at.slice(0, 10) : '2026-11-13',
  };
}

const FAMILY_META_PREFIX = ' <!--FAMILY:';
const FAMILY_META_SUFFIX = '-->';

export function packPhoneWithFamilyInfo(
  phone?: string | null,
  familyInfo?: string | null
): string | null {
  const cleanPhone = (phone || '').trim();
  const cleanFamily = (familyInfo || '').trim();
  if (!cleanPhone && !cleanFamily) return null;
  if (!cleanFamily) return cleanPhone;
  return `${cleanPhone}${FAMILY_META_PREFIX}${cleanFamily}${FAMILY_META_SUFFIX}`;
}

export function unpackPhoneWithFamilyInfo(rawPhone?: string | null): {
  phone: string;
  familyInfo: string;
} {
  if (!rawPhone) return { phone: '', familyInfo: '' };
  const idx = rawPhone.indexOf(FAMILY_META_PREFIX);
  if (idx === -1) {
    return { phone: rawPhone.trim(), familyInfo: '' };
  }
  const phone = rawPhone.slice(0, idx).trim();
  const familyInfo = rawPhone
    .slice(
      idx + FAMILY_META_PREFIX.length,
      rawPhone.endsWith(FAMILY_META_SUFFIX)
        ? rawPhone.length - FAMILY_META_SUFFIX.length
        : undefined
    )
    .trim();
  return { phone, familyInfo };
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

  const { phone, familyInfo } = unpackPhoneWithFamilyInfo(row.phone);

  return {
    id: String(row.id),
    companyId: row.company_id || null,
    employeeCode: row.employee_code || 'NV000',
    fullName,
    dob: row.dob || '',
    gender: (row.gender as Gender) || '',
    cccd: row.cccd || '',
    cccdDate: row.cccd_date || '',
    phone,
    familyInfo,
    address: row.address || '',
    department: row.department || '',
    position: row.position || '',
    joinDate: row.join_date || '',
    standardAnnualLeave:
      row.annual_leave_quota !== null && row.annual_leave_quota !== undefined
        ? Number(row.annual_leave_quota)
        : 12,
    status: (row.status as WorkStatus) || 'Đang làm việc',
    avatarUrl:
      row.avatar_url || createAvatarSvgDataUri(initials, '#0F232E', '#0D9488'),
  };
}

const FALLBACK_META_PREFIX = ' <!--HR_META:';
const FALLBACK_META_SUFFIX = '-->';

interface FallbackLeaveMeta {
  paperStatus?: 'Chưa có' | 'Đã có';
  attachmentUrl?: string;
  endDate?: string;
}

function packReasonWithFallbackMeta(
  cleanReason: string,
  meta: FallbackLeaveMeta
): string {
  const payload: FallbackLeaveMeta = {};
  if (meta.paperStatus) payload.paperStatus = meta.paperStatus;
  if (meta.attachmentUrl) payload.attachmentUrl = meta.attachmentUrl;
  if (meta.endDate) payload.endDate = meta.endDate;
  if (Object.keys(payload).length === 0) return cleanReason;
  return `${cleanReason}${FALLBACK_META_PREFIX}${JSON.stringify(payload)}${FALLBACK_META_SUFFIX}`;
}

function unpackReasonWithFallbackMeta(rawReason?: string | null): {
  cleanReason: string;
  meta: FallbackLeaveMeta;
} {
  if (!rawReason) return { cleanReason: '', meta: {} };
  const idx = rawReason.indexOf(FALLBACK_META_PREFIX);
  if (idx === -1) {
    return { cleanReason: rawReason, meta: {} };
  }
  const cleanReason = rawReason.slice(0, idx);
  const jsonPart = rawReason.slice(
    idx + FALLBACK_META_PREFIX.length,
    rawReason.endsWith(FALLBACK_META_SUFFIX)
      ? rawReason.length - FALLBACK_META_SUFFIX.length
      : undefined
  );
  try {
    const parsed = JSON.parse(jsonPart) as FallbackLeaveMeta;
    return { cleanReason, meta: parsed || {} };
  } catch {
    return { cleanReason: rawReason, meta: {} };
  }
}

/**
 * Encodes `type`, optional `regimeSubtype`, and optional `paperStatus` into `leave_type` column
 */
export function encodeLeaveTypeForDb(
  type: LeaveRecordType,
  regimeSubtype?: RegimeSubtype,
  paperStatus?: 'Chưa có' | 'Đã có'
): string {
  const sub = type === 'regime_leave' && regimeSubtype ? regimeSubtype : '';
  if (paperStatus) {
    return `${type}|${sub}|${paperStatus}`;
  }
  if (sub) {
    return `${type}|${sub}`;
  }
  return type;
}

/**
 * Decodes `leave_type` column from Supabase into `{ type, regimeSubtype, encodedPaperStatus }`
 */
export function decodeLeaveTypeFromDb(rawType: string): {
  type: LeaveRecordType;
  regimeSubtype?: RegimeSubtype;
  encodedPaperStatus?: 'Chưa có' | 'Đã có';
} {
  if (!rawType) return { type: 'annual_leave' };
  const parts = rawType.split('|');
  const baseType = parts[0];
  const subPart = parts[1] as RegimeSubtype | undefined;
  const statusPart = parts[2] as 'Chưa có' | 'Đã có' | undefined;
  const encodedPaperStatus =
    statusPart === 'Đã có' || statusPart === 'Chưa có' ? statusPart : undefined;

  if (
    baseType === 'annual_leave' ||
    baseType === 'unpaid_leave' ||
    baseType === 'regime_leave' ||
    baseType === 'late_early'
  ) {
    return {
      type: baseType,
      regimeSubtype:
        baseType === 'regime_leave'
          ? subPart || 'Ốm đau / Viện phí'
          : undefined,
      encodedPaperStatus,
    };
  }
  const lower = rawType.toLowerCase();
  if (lower.includes('muộn') || lower.includes('sớm') || lower.includes('late')) {
    return { type: 'late_early', encodedPaperStatus };
  }
  if (lower.includes('không lương') || lower.includes('unpaid')) {
    return { type: 'unpaid_leave', encodedPaperStatus };
  }
  if (lower.includes('chế độ') || lower.includes('ốm') || lower.includes('thai sản')) {
    return {
      type: 'regime_leave',
      regimeSubtype: 'Ốm đau / Viện phí',
      encodedPaperStatus,
    };
  }
  return { type: 'annual_leave', encodedPaperStatus };
}

/**
 * Maps a Supabase `leave_logs` row to our frontend `LeaveRecord` model
 */
export function mapSupabaseRowToLeaveRecord(
  row: SupabaseLeaveLogRow,
  empMap?: Map<string, Employee>
): LeaveRecord {
  const { type, regimeSubtype, encodedPaperStatus } = decodeLeaveTypeFromDb(
    row.leave_type
  );
  const { cleanReason, meta: reasonMeta } = unpackReasonWithFallbackMeta(
    row.reason
  );
  const emp = empMap?.get(String(row.employee_id));
  const meta = LEAVE_TYPE_META[type];
  const resolvedAttachmentUrl =
    row.proof_image_url || reasonMeta.attachmentUrl || undefined;
  const resolvedStartDate = row.start_date;
  const resolvedEndDate =
    row.end_date || reasonMeta.endDate || row.start_date;
  const resolvedPaperStatus: 'Chưa có' | 'Đã có' =
    (row.paper_status as 'Chưa có' | 'Đã có') ||
    encodedPaperStatus ||
    reasonMeta.paperStatus ||
    (resolvedAttachmentUrl ? 'Đã có' : 'Chưa có');

  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    type,
    regimeSubtype,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    amount: Number(row.duration || 0),
    reason: cleanReason,
    attachmentUrl: resolvedAttachmentUrl,
    attachmentTitle: resolvedAttachmentUrl
      ? `${meta.shortLabel} - ${emp ? emp.fullName : ''} (${formatDateVN(resolvedStartDate)})`
      : undefined,
    paperStatus: resolvedPaperStatus,
    createdAt: row.created_at ? row.created_at.slice(0, 10) : resolvedStartDate,
    approvedBy: 'Quản trị viên',
  };
}

/**
 * Authenticates a user directly against the `app_users` table on Supabase
 */
export async function authenticateAppUserInSupabase(
  usernameInput: string,
  passwordInput: string
): Promise<UserAccount | null> {
  const cleanUser = usernameInput.trim();
  if (!cleanUser) return null;

  const rows = await supabaseRestFetch<SupabaseAppUserRow[]>(
    `app_users?select=*&username=ilike.${encodeURIComponent(cleanUser)}`
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const matched = rows.find((r) => r.password === passwordInput);
  if (!matched) {
    return null;
  }

  return mapSupabaseRowToAppUser(matched);
}

/**
 * Compresses an image File on the client browser using HTML5 Canvas:
 * - Resizes width to at most `maxWidth` (default 1000px) while preserving aspect ratio
 * - Encodes as `image/jpeg` at `quality` (default 0.7), reducing 3-5MB photos to ~70KB-120KB
 */
export async function compressImageClientSide(
  file: File,
  maxWidth: number = 1000,
  quality: number = 0.7
): Promise<{
  compressedFile: File;
  dataUrl: string;
  compressedSizeKB: number;
  originalSizeKB: number;
}> {
  const originalSizeKB = Math.max(1, Math.round(file.size / 1024));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = () => {
      const srcDataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        try {
          let targetWidth = img.naturalWidth || img.width || maxWidth;
          let targetHeight = img.naturalHeight || img.height || maxWidth;

          if (targetWidth > maxWidth) {
            targetHeight = Math.max(
              1,
              Math.round((targetHeight * maxWidth) / targetWidth)
            );
            targetWidth = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D context not available');
          }

          // Fill white background so transparent PNGs render cleanly in JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                const approxBytes = Math.round(
                  ((compressedDataUrl.length -
                    'data:image/jpeg;base64,'.length) *
                    3) /
                    4
                );
                const fallbackSizeKB = Math.max(
                  1,
                  Math.round(approxBytes / 1024)
                );
                resolve({
                  compressedFile: file,
                  dataUrl: compressedDataUrl,
                  compressedSizeKB: fallbackSizeKB,
                  originalSizeKB,
                });
                return;
              }

              const baseName =
                file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') ||
                'giay_phep';
              const compressedFile = new File([blob], `${baseName}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              const compressedSizeKB = Math.max(1, Math.round(blob.size / 1024));

              resolve({
                compressedFile,
                dataUrl: compressedDataUrl,
                compressedSizeKB,
                originalSizeKB,
              });
            },
            'image/jpeg',
            quality
          );
        } catch (err) {
          reject(err);
        }
      };
      img.src = srcDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Deletes an uploaded image from Supabase Storage bucket `hr-images` if the URL points to the bucket
 */
export async function deleteImageFromHrBucket(publicUrl?: string): Promise<void> {
  if (!publicUrl) return;
  const marker = `/storage/v1/object/public/${HR_IMAGES_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const objectPath = publicUrl.slice(idx + marker.length);
  if (!objectPath) return;

  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${HR_IMAGES_BUCKET}/${objectPath}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
  } catch {
    // Ignore storage delete errors
  }
}

/**
 * Uploads an image File (avatar, leave proof photo, or company logo) to Supabase Storage bucket `hr-images`
 * using pure fetch and returns its Public URL. Automatically compresses the image via HTML5 Canvas first.
 * Falls back to the compressed Data URI if storage upload fails.
 */
export async function uploadImageToHrBucket(
  file: File,
  folder: 'avatars' | 'proofs' | 'logos',
  alreadyCompressed: boolean = false,
  precomputedDataUrl: string = ''
): Promise<string> {
  const maxWidth = folder === 'proofs' ? 1000 : 600;
  const quality = 0.7;

  let targetFile = file;
  let fallbackDataUrl = precomputedDataUrl;

  if (!alreadyCompressed) {
    try {
      const compressed = await compressImageClientSide(file, maxWidth, quality);
      targetFile = compressed.compressedFile;
      fallbackDataUrl = compressed.dataUrl;
    } catch {
      // If compression fails on an unusual format, proceed with original file
    }
  }

  try {
    const ext = (targetFile.name.split('.').pop() || 'jpg').replace(
      /[^a-zA-Z0-9]/g,
      ''
    );
    const safeName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${HR_IMAGES_BUCKET}/${safeName}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': targetFile.type || 'image/jpeg',
        'x-upsert': 'true',
      },
      body: targetFile,
    });

    if (!res.ok) {
      throw new Error(`Storage upload failed (${res.status})`);
    }

    return `${SUPABASE_URL}/storage/v1/object/public/${HR_IMAGES_BUCKET}/${safeName}`;
  } catch (err) {
    console.warn('Fallback to compressed Data URI for image upload:', err);
  }

  if (fallbackDataUrl) {
    return fallbackDataUrl;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(targetFile);
  });
}

let initPromise: Promise<{
  companies: CompanyUnit[];
  departments: DepartmentGroup[];
  positions: PositionItem[];
  accounts: UserAccount[];
  employees: Employee[];
  records: LeaveRecord[];
  isInitialized: boolean;
  connected: boolean;
}> | null = null;

/**
 * Helper to seed INITIAL_EMPLOYEES and INITIAL_LEAVE_RECORDS into Supabase
 */
export async function seedInitialDataToSupabase(
  companyId?: string | null
): Promise<{
  employees: Employee[];
  records: LeaveRecord[];
}> {
  const seedEmpPayloads = INITIAL_EMPLOYEES.map((emp) => ({
    employee_code: emp.employeeCode,
    full_name: emp.fullName,
    dob: emp.dob || null,
    gender: emp.gender || null,
    cccd: emp.cccd || null,
    cccd_date: emp.cccdDate || null,
    phone: emp.phone || null,
    address: emp.address || null,
    department: emp.department || null,
    position: emp.position || null,
    join_date: emp.joinDate || null,
    avatar_url: emp.avatarUrl || null,
    annual_leave_quota: emp.standardAnnualLeave,
    status: emp.status,
    company_id: companyId || null,
  }));

  const insertedEmps = await supabaseRestFetch<SupabaseEmployeeRow[]>(
    'employees?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(seedEmpPayloads),
    }
  );

  const sortedEmpRows = (insertedEmps || []).sort((a, b) =>
    (a.employee_code || '').localeCompare(b.employee_code || '')
  );

  const employees = sortedEmpRows.map(mapSupabaseRowToEmployee);
  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

  const codeToSupabaseId = new Map<string, string>();
  for (const e of employees) {
    codeToSupabaseId.set(e.employeeCode, e.id);
  }

  let finalLogRows: SupabaseLeaveLogRow[] = [];
  if (employees.length > 0) {
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

  const records = finalLogRows.map((row) =>
    mapSupabaseRowToLeaveRecord(row, empMap)
  );

  return { employees, records };
}

/**
 * Loads `companies`, `departments`, `positions`, `app_users`, `employees`, and `leave_logs` from Supabase.
 * Strictly treats Supabase as the Single Source of Truth.
 */
export async function loadOrSeedSupabaseData(
  _localInitializedFlag: boolean = true
): Promise<{
  companies: CompanyUnit[];
  departments: DepartmentGroup[];
  positions: PositionItem[];
  accounts: UserAccount[];
  employees: Employee[];
  records: LeaveRecord[];
  isInitialized: boolean;
  connected: boolean;
}> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const [compRows, deptRows, posRows, userRows, empRows, logRows] =
        await Promise.all([
          supabaseRestFetch<SupabaseCompanyRow[]>(
            'companies?select=*&order=created_at.asc'
          ).catch(() => [] as SupabaseCompanyRow[]),
          supabaseRestFetch<SupabaseDepartmentRow[]>(
            'departments?select=*&order=created_at.asc'
          ).catch(() => [] as SupabaseDepartmentRow[]),
          supabaseRestFetch<SupabasePositionRow[]>(
            'positions?select=*&order=created_at.asc'
          ).catch(() => [] as SupabasePositionRow[]),
          supabaseRestFetch<SupabaseAppUserRow[]>(
            'app_users?select=*&order=created_at.asc'
          ).catch(() => [] as SupabaseAppUserRow[]),
          supabaseRestFetch<SupabaseEmployeeRow[]>(
            'employees?select=*&order=employee_code.asc'
          ),
          supabaseRestFetch<SupabaseLeaveLogRow[]>(
            'leave_logs?select=*&order=start_date.desc'
          ).catch(() =>
            supabaseRestFetch<SupabaseLeaveLogRow[]>('leave_logs?select=*').catch(
              () => [] as SupabaseLeaveLogRow[]
            )
          ),
        ]);

      // 1. Companies & is_initialized check
      let companies = (compRows || []).map(mapSupabaseRowToCompany);
      if (companies.length === 0) {
        const createdComp = await createCompanyInSupabase({
          code: 'HRPRO-HQ',
          name: 'Công ty Mặc định',
          shortName: 'HR',
          address: 'Việt Nam',
          phone: '',
          defaultLeaveQuota: 12,
          isInitialized: true,
        }).catch(() => INITIAL_COMPANY_UNITS[0]);
        companies = [createdComp];
      }

      // Ensure all companies have is_initialized = true on Supabase if not yet set
      if (!companies.some((c) => c.isInitialized === true)) {
        await supabaseRestFetch<void>('companies?id=not.is.null', {
          method: 'PATCH',
          body: JSON.stringify({ is_initialized: true }),
        }).catch(() => {});
        companies = companies.map((c) => ({ ...c, isInitialized: true }));
      }

      // 2. Accounts (`app_users`)
      const accounts =
        userRows && userRows.length > 0
          ? userRows.map(mapSupabaseRowToAppUser)
          : INITIAL_USER_ACCOUNTS;

      // 3. Employees & Leave Logs — Strictly use Supabase as Single Source of Truth
      const employees = (empRows || []).map(mapSupabaseRowToEmployee);
      const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));
      const records = (logRows || []).map((row) =>
        mapSupabaseRowToLeaveRecord(row, empMap)
      );

      // 4. Departments (`departments`)
      const departments = (deptRows || []).map((r, i) =>
        mapSupabaseRowToDepartment(r, i)
      );

      // 5. Positions (`positions` table, seeded with 4 default positions if empty)
      let positions: PositionItem[] = [];
      if (posRows && posRows.length > 0) {
        positions = posRows.map(mapSupabaseRowToPosition);
      } else {
        try {
          const seedPosPayloads = INITIAL_POSITIONS.map((p) => ({
            company_id: companies[0]?.id || null,
            name: p.name,
          }));
          const insertedPos = await supabaseRestFetch<SupabasePositionRow[]>(
            'positions?select=*',
            {
              method: 'POST',
              headers: { Prefer: 'return=representation' },
              body: JSON.stringify(seedPosPayloads),
            }
          );
          positions =
            insertedPos && insertedPos.length > 0
              ? insertedPos.map(mapSupabaseRowToPosition)
              : INITIAL_POSITIONS;
        } catch {
          positions = INITIAL_POSITIONS;
        }
      }

      return {
        companies,
        departments,
        positions,
        accounts,
        employees,
        records,
        isInitialized: true,
        connected: true,
      };
    } catch (error) {
      console.error('Supabase sync error:', error);
      return {
        companies: INITIAL_COMPANY_UNITS,
        departments: [],
        positions: INITIAL_POSITIONS,
        accounts: INITIAL_USER_ACCOUNTS,
        employees: [],
        records: [],
        isInitialized: true,
        connected: false,
      };
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/* ============================================================================
   COMPANIES CRUD (`companies` table)
============================================================================ */
export async function createCompanyInSupabase(
  unit: Omit<CompanyUnit, 'id'>
): Promise<CompanyUnit> {
  const payload = {
    code: unit.code || `UNIT-${Date.now().toString().slice(-4)}`,
    name: unit.name,
    logo_url: unit.logoUrl || null,
    address: unit.address || null,
    phone: unit.phone || null,
    default_leave_quota: unit.defaultLeaveQuota ?? 12,
    is_initialized: true,
  };

  const rows = await supabaseRestFetch<SupabaseCompanyRow[]>(
    'companies?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([payload]),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to create company in Supabase');
  }

  return mapSupabaseRowToCompany(rows[0]);
}

export async function updateCompanyInSupabase(
  id: string,
  updates: Partial<Omit<CompanyUnit, 'id'>>
): Promise<CompanyUnit> {
  const payload: Record<string, unknown> = {};
  if (updates.code !== undefined) payload.code = updates.code;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl || null;
  if (updates.address !== undefined) payload.address = updates.address;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.defaultLeaveQuota !== undefined) {
    payload.default_leave_quota = updates.defaultLeaveQuota;
  }
  if (updates.isInitialized !== undefined) {
    payload.is_initialized = updates.isInitialized;
  }

  const rows = await supabaseRestFetch<SupabaseCompanyRow[]>(
    `companies?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to update company in Supabase');
  }

  return mapSupabaseRowToCompany(rows[0]);
}

export async function deleteCompanyFromSupabase(id: string): Promise<void> {
  await supabaseRestFetch<void>(`companies?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/* ============================================================================
   DEPARTMENTS CRUD (`departments` table)
============================================================================ */
export async function createDepartmentInSupabase(
  grp: Omit<DepartmentGroup, 'id'>,
  companyId?: string | null
): Promise<DepartmentGroup> {
  const payload = {
    company_id: grp.companyId || companyId || null,
    name: grp.name,
    description: `${grp.code || ''}|${grp.color || '#0D9488'}|${grp.description || ''}`,
  };

  const rows = await supabaseRestFetch<SupabaseDepartmentRow[]>(
    'departments?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([payload]),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to create department in Supabase');
  }

  return mapSupabaseRowToDepartment(rows[0], 0);
}

export async function updateDepartmentInSupabase(
  id: string,
  grp: Omit<DepartmentGroup, 'id'>,
  companyId?: string | null
): Promise<DepartmentGroup> {
  const payload = {
    company_id: grp.companyId || companyId || null,
    name: grp.name,
    description: `${grp.code || ''}|${grp.color || '#0D9488'}|${grp.description || ''}`,
  };

  const rows = await supabaseRestFetch<SupabaseDepartmentRow[]>(
    `departments?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to update department in Supabase');
  }

  return mapSupabaseRowToDepartment(rows[0], 0);
}

export async function deleteDepartmentFromSupabase(id: string): Promise<void> {
  await supabaseRestFetch<void>(`departments?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/* ============================================================================
   POSITIONS CRUD (`positions` table)
============================================================================ */
export async function createPositionInSupabase(
  pos: Omit<PositionItem, 'id'>,
  companyId?: string | null
): Promise<PositionItem> {
  const payload = {
    company_id: pos.companyId || companyId || null,
    name: pos.name,
  };

  const rows = await supabaseRestFetch<SupabasePositionRow[]>(
    'positions?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([payload]),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to create position in Supabase');
  }

  return mapSupabaseRowToPosition(rows[0]);
}

export async function updatePositionInSupabase(
  id: string,
  name: string,
  companyId?: string | null
): Promise<PositionItem> {
  const payload: Record<string, unknown> = { name };
  if (companyId !== undefined) {
    payload.company_id = companyId;
  }

  const rows = await supabaseRestFetch<SupabasePositionRow[]>(
    `positions?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to update position in Supabase');
  }

  return mapSupabaseRowToPosition(rows[0]);
}

export async function deletePositionFromSupabase(id: string): Promise<void> {
  await supabaseRestFetch<void>(`positions?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/* ============================================================================
   APP USERS CRUD (`app_users` table)
============================================================================ */
export async function createAppUserInSupabase(
  acc: Omit<UserAccount, 'id' | 'createdAt'>,
  companyId?: string | null
): Promise<UserAccount> {
  const payload = {
    username: acc.username,
    password: acc.password,
    full_name: acc.fullName,
    role: acc.role,
    company_id: acc.companyId || companyId || null,
  };

  const rows = await supabaseRestFetch<SupabaseAppUserRow[]>(
    'app_users?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([payload]),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to create app_user in Supabase');
  }

  return mapSupabaseRowToAppUser(rows[0]);
}

export async function updateAppUserRoleInSupabase(
  id: string,
  role: UserRole
): Promise<UserAccount> {
  const rows = await supabaseRestFetch<SupabaseAppUserRow[]>(
    `app_users?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ role }),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to update app_user role in Supabase');
  }

  return mapSupabaseRowToAppUser(rows[0]);
}

export async function deleteAppUserFromSupabase(id: string): Promise<void> {
  await supabaseRestFetch<void>(`app_users?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/* ============================================================================
   DATA RESET & DEMO RESTORE
============================================================================ */
/**
 * Deletes ALL employees and leave_logs from Supabase and ensures companies.is_initialized = true
 */
export async function clearAllDataInSupabase(): Promise<void> {
  await supabaseRestFetch<void>('leave_logs?id=not.is.null', {
    method: 'DELETE',
  }).catch(() => {});

  await supabaseRestFetch<void>('employees?id=not.is.null', {
    method: 'DELETE',
  });

  await supabaseRestFetch<void>('companies?id=not.is.null', {
    method: 'PATCH',
    body: JSON.stringify({ is_initialized: true }),
  }).catch(() => {});
}

/**
 * Restores data from a parsed HRBackupPayload (.json) into Supabase
 */
export async function restoreFromBackupInSupabase(
  backup: HRBackupPayload,
  fallbackCompanyId?: string | null
): Promise<{
  companies: CompanyUnit[];
  departments: DepartmentGroup[];
  positions: PositionItem[];
  employees: Employee[];
  records: LeaveRecord[];
  accounts: UserAccount[];
}> {
  await clearAllDataInSupabase().catch(() => {});

  // 1. Sync companies if provided
  let finalCompanies: CompanyUnit[] = Array.isArray(backup.companies)
    ? backup.companies
    : [];
  try {
    const existingComps = await supabaseRestFetch<SupabaseCompanyRow[]>(
      'companies?select=*'
    );
    const existingIds = new Set((existingComps || []).map((c) => String(c.id)));
    for (const comp of finalCompanies) {
      if (existingIds.has(comp.id)) {
        await updateCompanyInSupabase(comp.id, comp).catch(() => {});
      } else {
        await createCompanyInSupabase(comp).catch(() => {});
      }
    }
    const refreshedComps = await supabaseRestFetch<SupabaseCompanyRow[]>(
      'companies?select=*&order=created_at.asc'
    );
    if (refreshedComps && refreshedComps.length > 0) {
      finalCompanies = refreshedComps.map(mapSupabaseRowToCompany);
    }
  } catch {
    // Keep backup companies in local state
  }

  const targetCompId =
    finalCompanies[0]?.id || fallbackCompanyId || null;

  // 2. Sync departments if provided
  let finalDepartments: DepartmentGroup[] = Array.isArray(backup.departments)
    ? backup.departments
    : [];
  try {
    if (finalDepartments.length > 0) {
      await supabaseRestFetch<void>('departments?id=not.is.null', {
        method: 'DELETE',
      }).catch(() => {});

      const deptPayloads = finalDepartments.map((g) => ({
        company_id: g.companyId || targetCompId,
        name: g.name,
        description: `${g.code || ''}|${g.color || '#0D9488'}|${g.description || ''}`,
      }));
      const insertedDepts = await supabaseRestFetch<SupabaseDepartmentRow[]>(
        'departments?select=*',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(deptPayloads),
        }
      );
      if (insertedDepts) {
        finalDepartments = insertedDepts.map((r, i) =>
          mapSupabaseRowToDepartment(r, i)
        );
      }
    }
  } catch {
    // Keep backup departments in local state
  }

  // 2b. Sync positions if provided
  let finalPositions: PositionItem[] =
    Array.isArray(backup.positions) && backup.positions.length > 0
      ? backup.positions
      : INITIAL_POSITIONS;
  try {
    if (Array.isArray(backup.positions) && backup.positions.length > 0) {
      await supabaseRestFetch<void>('positions?id=not.is.null', {
        method: 'DELETE',
      }).catch(() => {});
      const posPayloads = backup.positions.map((p) => ({
        company_id: p.companyId || targetCompId,
        name: p.name,
      }));
      const insertedPos = await supabaseRestFetch<SupabasePositionRow[]>(
        'positions?select=*',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(posPayloads),
        }
      );
      if (insertedPos && insertedPos.length > 0) {
        finalPositions = insertedPos.map(mapSupabaseRowToPosition);
      }
    }
  } catch {
    // Keep finalPositions
  }

  // 3. Insert employees and map old IDs / codes to new Supabase IDs
  const backupEmployees = Array.isArray(backup.employees)
    ? backup.employees
    : [];
  let finalEmployees: Employee[] = backupEmployees;
  const oldEmpIdToCode = new Map<string, string>();
  for (const e of backupEmployees) {
    oldEmpIdToCode.set(e.id, e.employeeCode);
  }

  try {
    if (backupEmployees.length > 0) {
      const empPayloads = backupEmployees.map((emp) => ({
        employee_code: emp.employeeCode,
        full_name: emp.fullName,
        dob: emp.dob || null,
        gender: emp.gender || null,
        cccd: emp.cccd || null,
        cccd_date: emp.cccdDate || null,
        phone: packPhoneWithFamilyInfo(emp.phone, emp.familyInfo),
        address: emp.address || null,
        department: emp.department || null,
        position: emp.position || null,
        join_date: emp.joinDate || null,
        avatar_url: emp.avatarUrl || null,
        annual_leave_quota: emp.standardAnnualLeave,
        status: emp.status,
        company_id: emp.companyId || targetCompId,
      }));

      const insertedEmps = await supabaseRestFetch<SupabaseEmployeeRow[]>(
        'employees?select=*',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(empPayloads),
        }
      );
      if (insertedEmps) {
        finalEmployees = insertedEmps.map(mapSupabaseRowToEmployee);
      }
    } else {
      finalEmployees = [];
    }
  } catch {
    // Keep backupEmployees
  }

  const codeToNewEmpId = new Map<string, string>();
  const empMap = new Map<string, Employee>();
  for (const e of finalEmployees) {
    codeToNewEmpId.set(e.employeeCode, e.id);
    empMap.set(e.id, e);
  }

  // 4. Insert leave_logs
  const backupRecords = Array.isArray(backup.records) ? backup.records : [];
  let finalRecords: LeaveRecord[] = backupRecords;
  try {
    if (backupRecords.length > 0 && finalEmployees.length > 0) {
      const insertedList: LeaveRecord[] = [];
      for (const rec of backupRecords) {
        const code = oldEmpIdToCode.get(rec.employeeId);
        const mappedEmpId =
          (code && codeToNewEmpId.get(code)) ||
          (empMap.has(rec.employeeId) ? rec.employeeId : finalEmployees[0].id);
        try {
          const created = await createLeaveLogInSupabase(
            {
              ...rec,
              employeeId: mappedEmpId,
            },
            empMap
          );
          insertedList.push(created);
        } catch {
          // Keep original record if single insert fails
          insertedList.push({ ...rec, employeeId: mappedEmpId });
        }
      }
      finalRecords = insertedList;
    } else {
      finalRecords = [];
    }
  } catch {
    // Keep backupRecords
  }

  // 5. Sync app_users if provided
  let finalAccounts: UserAccount[] = Array.isArray(backup.accounts)
    ? backup.accounts
    : INITIAL_USER_ACCOUNTS;
  try {
    const existingUsers = await supabaseRestFetch<SupabaseAppUserRow[]>(
      'app_users?select=*'
    );
    const existingUsernames = new Set(
      (existingUsers || []).map((u) => u.username.toLowerCase())
    );
    for (const acc of finalAccounts) {
      if (!existingUsernames.has(acc.username.toLowerCase())) {
        await createAppUserInSupabase(acc, targetCompId).catch(() => {});
      }
    }
    const refreshedUsers = await supabaseRestFetch<SupabaseAppUserRow[]>(
      'app_users?select=*&order=created_at.asc'
    );
    if (refreshedUsers && refreshedUsers.length > 0) {
      finalAccounts = refreshedUsers.map(mapSupabaseRowToAppUser);
    }
  } catch {
    // Keep finalAccounts
  }

  return {
    companies: finalCompanies,
    departments: finalDepartments,
    positions: finalPositions,
    employees: finalEmployees,
    records: finalRecords,
    accounts: finalAccounts,
  };
}

/* ============================================================================
   EMPLOYEES & LEAVE LOGS CRUD
============================================================================ */
/**
 * Inserts a new employee into Supabase `employees`
 */
export async function createEmployeeInSupabase(
  empData: Omit<Employee, 'id'>
): Promise<Employee> {
  const payload = {
    employee_code: empData.employeeCode,
    full_name: empData.fullName,
    dob: empData.dob || null,
    gender: empData.gender || null,
    cccd: empData.cccd || null,
    cccd_date: empData.cccdDate || null,
    phone: packPhoneWithFamilyInfo(empData.phone, empData.familyInfo),
    address: empData.address || null,
    department: empData.department || null,
    position: empData.position || null,
    join_date: empData.joinDate || null,
    avatar_url: empData.avatarUrl || null,
    annual_leave_quota: empData.standardAnnualLeave,
    status: empData.status,
    company_id: empData.companyId || null,
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
    dob: empData.dob || null,
    gender: empData.gender || null,
    cccd: empData.cccd || null,
    cccd_date: empData.cccdDate || null,
    phone: packPhoneWithFamilyInfo(empData.phone, empData.familyInfo),
    address: empData.address || null,
    department: empData.department || null,
    position: empData.position || null,
    join_date: empData.joinDate || null,
    avatar_url: empData.avatarUrl || null,
    annual_leave_quota: empData.standardAnnualLeave,
    status: empData.status,
    company_id: empData.companyId || null,
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
  const payload: Record<string, unknown> = {
    employee_code: empData.employeeCode,
    full_name: empData.fullName,
    dob: empData.dob || null,
    gender: empData.gender || null,
    cccd: empData.cccd || null,
    cccd_date: empData.cccdDate || null,
    phone: packPhoneWithFamilyInfo(empData.phone, empData.familyInfo),
    address: empData.address || null,
    department: empData.department || null,
    position: empData.position || null,
    join_date: empData.joinDate || null,
    avatar_url: empData.avatarUrl || null,
    annual_leave_quota: empData.standardAnnualLeave,
    status: empData.status,
  };
  if (empData.companyId !== undefined) {
    payload.company_id = empData.companyId;
  }

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
 * Inserts a new leave/late record into Supabase `leave_logs` with smart column fallback
 */
export async function createLeaveLogInSupabase(
  recData: Omit<LeaveRecord, 'id'>,
  empMap?: Map<string, Employee>
): Promise<LeaveRecord> {
  const resolvedPaperStatus: 'Chưa có' | 'Đã có' =
    recData.paperStatus || (recData.attachmentUrl ? 'Đã có' : 'Chưa có');
  const encodedType = encodeLeaveTypeForDb(
    recData.type,
    recData.regimeSubtype,
    resolvedPaperStatus
  );
  const safeEndDate = recData.endDate || recData.startDate;

  // Attempt 1: Full schema (including `paper_status` column)
  const fullPayload = {
    employee_id: recData.employeeId,
    leave_type: encodedType,
    start_date: recData.startDate,
    end_date: safeEndDate,
    duration: Number(recData.amount || 0),
    reason: recData.reason || '',
    proof_image_url: recData.attachmentUrl || null,
    paper_status: resolvedPaperStatus,
  };

  try {
    const rows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
      'leave_logs?select=*',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([fullPayload]),
      }
    );
    if (rows && rows.length > 0) {
      return mapSupabaseRowToLeaveRecord(rows[0], empMap);
    }
  } catch (err1) {
    console.warn(
      'createLeaveLogInSupabase Attempt 1 (with paper_status) failed, retrying fallback without paper_status column:',
      err1
    );
  }

  // Attempt 2: Standard 7-column schema (without `paper_status` column; paperStatus is preserved in `leave_type` & `reason`)
  const packedReason = packReasonWithFallbackMeta(recData.reason || '', {
    paperStatus: resolvedPaperStatus,
  });
  const standardPayload = {
    employee_id: recData.employeeId,
    leave_type: encodedType,
    start_date: recData.startDate,
    end_date: safeEndDate,
    duration: Number(recData.amount || 0),
    reason: packedReason,
    proof_image_url: recData.attachmentUrl || null,
  };

  try {
    const rows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
      'leave_logs?select=*',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([standardPayload]),
      }
    );
    if (rows && rows.length > 0) {
      return mapSupabaseRowToLeaveRecord(rows[0], empMap);
    }
  } catch (err2) {
    console.warn(
      'createLeaveLogInSupabase Attempt 2 failed, retrying minimal schema with JSON metadata in reason:',
      err2
    );
  }

  // Attempt 3: Minimal core schema (packs end_date, proof_image_url, paperStatus into `reason`)
  const fullPackedReason = packReasonWithFallbackMeta(recData.reason || '', {
    paperStatus: resolvedPaperStatus,
    attachmentUrl: recData.attachmentUrl,
    endDate: safeEndDate,
  });
  const minimalPayload = {
    employee_id: recData.employeeId,
    leave_type: encodedType,
    start_date: recData.startDate,
    duration: Number(recData.amount || 0),
    reason: fullPackedReason,
  };

  const rows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
    'leave_logs?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([minimalPayload]),
    }
  );

  if (!rows || rows.length === 0) {
    throw new Error('Failed to insert leave log into Supabase');
  }

  return mapSupabaseRowToLeaveRecord(rows[0], empMap);
}

/**
 * Updates an existing leave/late record in Supabase `leave_logs` with smart column fallback.
 * If the record ID is a local temporary ID (`rec-...`) or not yet in Supabase, inserts it as a new row.
 */
export async function updateLeaveLogInSupabase(
  id: string,
  recData: Omit<LeaveRecord, 'id'>,
  empMap?: Map<string, Employee>
): Promise<LeaveRecord> {
  if (!id || id.startsWith('rec-')) {
    return createLeaveLogInSupabase(recData, empMap);
  }

  const resolvedPaperStatus: 'Chưa có' | 'Đã có' =
    recData.paperStatus || (recData.attachmentUrl ? 'Đã có' : 'Chưa có');
  const encodedType = encodeLeaveTypeForDb(
    recData.type,
    recData.regimeSubtype,
    resolvedPaperStatus
  );
  const safeEndDate = recData.endDate || recData.startDate;

  // Attempt 1: Full schema (including `paper_status`)
  const fullPayload = {
    employee_id: recData.employeeId,
    leave_type: encodedType,
    start_date: recData.startDate,
    end_date: safeEndDate,
    duration: Number(recData.amount || 0),
    reason: recData.reason || '',
    proof_image_url: recData.attachmentUrl || null,
    paper_status: resolvedPaperStatus,
  };

  try {
    const rows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
      `leave_logs?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(fullPayload),
      }
    );
    if (rows && rows.length > 0) {
      return mapSupabaseRowToLeaveRecord(rows[0], empMap);
    }
  } catch (err1) {
    console.warn(
      'updateLeaveLogInSupabase Attempt 1 (with paper_status) failed, retrying fallback without paper_status column:',
      err1
    );
  }

  // Attempt 2: Standard 7-column schema (without `paper_status`)
  const packedReason = packReasonWithFallbackMeta(recData.reason || '', {
    paperStatus: resolvedPaperStatus,
  });
  const standardPayload = {
    employee_id: recData.employeeId,
    leave_type: encodedType,
    start_date: recData.startDate,
    end_date: safeEndDate,
    duration: Number(recData.amount || 0),
    reason: packedReason,
    proof_image_url: recData.attachmentUrl || null,
  };

  try {
    const rows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
      `leave_logs?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(standardPayload),
      }
    );
    if (rows && rows.length > 0) {
      return mapSupabaseRowToLeaveRecord(rows[0], empMap);
    }
  } catch (err2) {
    console.warn(
      'updateLeaveLogInSupabase Attempt 2 failed, retrying minimal schema:',
      err2
    );
  }

  // Attempt 3: Minimal core schema or fallback to insert if row was missing on cloud
  const fullPackedReason = packReasonWithFallbackMeta(recData.reason || '', {
    paperStatus: resolvedPaperStatus,
    attachmentUrl: recData.attachmentUrl,
    endDate: safeEndDate,
  });
  const minimalPayload = {
    employee_id: recData.employeeId,
    leave_type: encodedType,
    start_date: recData.startDate,
    duration: Number(recData.amount || 0),
    reason: fullPackedReason,
  };

  try {
    const rows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
      `leave_logs?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(minimalPayload),
      }
    );
    if (rows && rows.length > 0) {
      return mapSupabaseRowToLeaveRecord(rows[0], empMap);
    }
  } catch {
    // Fall through to createLeaveLogInSupabase
  }

  return createLeaveLogInSupabase(recData, empMap);
}

/**
  * Deletes a leave/late record from Supabase `leave_logs`
  */
export async function deleteLeaveLogFromSupabase(
  id: string,
  rec?: Pick<LeaveRecord, 'employeeId' | 'startDate' | 'amount'>
): Promise<void> {
  if (id && !id.startsWith('rec-')) {
    await supabaseRestFetch<void>(
      `leave_logs?id=eq.${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    return;
  }
  if (rec && rec.employeeId && rec.startDate) {
    await supabaseRestFetch<void>(
      `leave_logs?employee_id=eq.${encodeURIComponent(rec.employeeId)}&start_date=eq.${encodeURIComponent(rec.startDate)}`,
      { method: 'DELETE' }
    );
  }
}

/**
 * Pushes all local leave/late records (from localStorage / memory) to Supabase `leave_logs`,
 * avoiding duplicates and returning the complete, synchronized list of records from Supabase.
 */
export async function syncLocalLeaveLogsToSupabase(
  localRecords: LeaveRecord[],
  employees: Employee[]
): Promise<{
  syncedCount: number;
  records: LeaveRecord[];
}> {
  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));
  const existingRows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
    'leave_logs?select=*&order=start_date.desc'
  ).catch(() =>
    supabaseRestFetch<SupabaseLeaveLogRow[]>('leave_logs?select=*').catch(
      () => [] as SupabaseLeaveLogRow[]
    )
  );

  const existingIds = new Set((existingRows || []).map((r) => String(r.id)));
  const existingSignatures = new Set(
    (existingRows || []).map((r) => {
      const { type } = decodeLeaveTypeFromDb(r.leave_type);
      return `${r.employee_id}|${type}|${r.start_date}|${Number(r.duration || 0)}`;
    })
  );

  let syncedCount = 0;

  for (const rec of localRecords) {
    // Ensure employeeId exists in current employees list
    const validEmpId = empMap.has(rec.employeeId)
      ? rec.employeeId
      : employees[0]?.id;
    if (!validEmpId) continue;

    const sig = `${validEmpId}|${rec.type}|${rec.startDate}|${Number(rec.amount || 0)}`;
    const isAlreadyOnCloud =
      (!rec.id.startsWith('rec-') && existingIds.has(rec.id)) ||
      existingSignatures.has(sig);

    if (!isAlreadyOnCloud) {
      await createLeaveLogInSupabase(
        {
          ...rec,
          employeeId: validEmpId,
        },
        empMap
      );
      existingSignatures.add(sig);
      syncedCount += 1;
    } else if (!rec.id.startsWith('rec-') && existingIds.has(rec.id)) {
      await updateLeaveLogInSupabase(
        rec.id,
        {
          ...rec,
          employeeId: validEmpId,
        },
        empMap
      ).catch(() => {});
    }
  }

  const finalRows = await supabaseRestFetch<SupabaseLeaveLogRow[]>(
    'leave_logs?select=*&order=start_date.desc'
  ).catch(() =>
    supabaseRestFetch<SupabaseLeaveLogRow[]>('leave_logs?select=*').catch(
      () => [] as SupabaseLeaveLogRow[]
    )
  );

  const finalRecords = (finalRows || []).map((row) =>
    mapSupabaseRowToLeaveRecord(row, empMap)
  );

  return {
    syncedCount,
    records: finalRecords,
  };
}

