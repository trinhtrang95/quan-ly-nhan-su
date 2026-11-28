import {
  createClient,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js';
import { Employee, LeaveRecord, LeaveRecordType } from '../types/hr';
import {
  mapSupabaseRowToLeaveRecord,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  SupabaseLeaveLogRow,
} from './supabaseService';
import {
  calculateActualOvertimeHours,
  DEFAULT_OVERTIME_SETTINGS,
} from './workScheduleLogic';

function formatDateToFormStyleLocal(isoDate: string): string {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatTimeToFormStyleLocal(timeStr: string): string {
  if (!timeStr) return '';
  const cleaned = timeStr.trim();
  if (/^\d{1,2}h\d{2}$/i.test(cleaned)) {
    return cleaned.toLowerCase();
  }
  const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return cleaned;
  return `${match[1].padStart(2, '0')}h${match[2]}`;
}

function buildCombinedReasonTextLocal(reasonVi: string, reasonKr: string): string {
  const vi = (reasonVi || '').trim();
  const kr = (reasonKr || '').trim();
  if (vi && kr) return `${vi}\n${kr}`;
  return vi || kr;
}

export interface OvertimeParticipantInput {
  employeeId: string;
  startTime: string;
  endTime: string;
  totalHours?: number;
}

export interface OvertimeBlockInput {
  id: string;
  overtimeDate: string;
  reasonVi: string;
  reasonKr: string;
  startTime: string;
  endTime: string;
  selectedEmployeeIds: string[];
  participants: OvertimeParticipantInput[];
}

/**
 * Matches live Supabase `overtime_forms` columns plus derived UI fields.
 */
export interface OvertimeFormRecord {
  id: string;
  form_code: string;
  department: string;
  overtime_date: string;
  overtime_dates: string[];
  total_blocks: number;
  total_participants: number;
  total_hours: number;
  status: string;
  is_locked?: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at: string | null;
}

/**
 * Matches live Supabase `overtime_form_items` columns (`full_name`, `block_id`, etc.).
 */
export interface OvertimeFormItemRecord {
  id: string;
  form_id: string;
  overtime_date: string;
  block_order: number;
  item_order: number;
  block_id?: string | null;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  reason_vi: string;
  reason_kr: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  deleted_at: string | null;
}

export interface OvertimeFormWithItems extends OvertimeFormRecord {
  items: OvertimeFormItemRecord[];
}

export const DEFAULT_OVERTIME_DEPARTMENT = 'Bộ phận Kỹ thuật';

export interface SaveOvertimeFormInput {
  department: string;
  overtimeDate: string;
  blocks: OvertimeBlockInput[];
  employees: Employee[];
  knownSubGroups?: string[];
  createdBy?: string | null;
}

export interface PrintableOvertimeRow {
  no: number;
  fullName: string;
  employeeCode: string;
  isFirstInBlock: boolean;
  rowSpan: number;
  combinedReason: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
}

export interface PrintableOvertimeDateGroup {
  date: string;
  formattedDate: string;
  blocks: {
    blockId: string;
    rows: PrintableOvertimeRow[];
  }[];
}

interface SupabaseOvertimeFormRow {
  id: string;
  form_code: string;
  department: string | null;
  overtime_date: string | null;
  total_blocks: number | null;
  total_employees: number | null;
  total_hours: number | null;
  status: string | null;
  is_locked?: boolean | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at: string | null;
}

interface SupabaseOvertimeFormItemRow {
  id: string;
  form_id: string;
  overtime_date: string | null;
  block_order: number | null;
  item_order: number | null;
  block_id?: string | null;
  employee_id: string | null;
  employee_code: string | null;
  full_name: string | null;
  reason_vi: string | null;
  reason_kr: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at?: string;
  deleted_at?: string | null;
}

export const OVERTIME_FORMS_STORAGE_KEY = 'hr_pro_overtime_forms_v1';
export const OVERTIME_FORMS_DELETED_KEY = 'hr_pro_overtime_forms_deleted_v1';
export const OVERTIME_FORMS_UPDATED_KEY = 'hr_pro_overtime_forms_updated_v1';

export const SUPABASE_OVERTIME_REALTIME_AND_SOFT_DELETE_SQL = `-- 1. Bổ sung cột deleted_at và is_locked cho bảng overtime_forms / overtime_form_items
ALTER TABLE public.overtime_forms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.overtime_forms ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.overtime_form_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Chuẩn hóa RLS Policy (cho phép đọc/ghi/cập nhật deleted_at không bị chặn lỗi 42501)
ALTER TABLE public.overtime_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_form_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('overtime_forms', 'overtime_form_items')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "Allow public full access on overtime_forms"
  ON public.overtime_forms
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public full access on overtime_form_items"
  ON public.overtime_form_items
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 3. Bật Supabase Realtime (INSERT, UPDATE, DELETE) cho cả 2 bảng
ALTER TABLE public.overtime_forms REPLICA IDENTITY FULL;
ALTER TABLE public.overtime_form_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'overtime_forms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.overtime_forms;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'overtime_form_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.overtime_form_items;
  END IF;
END $$;`;

export class OvertimeSupabaseActionError extends Error {
  code?: string;
  needsSqlFix: boolean;

  constructor(message: string, code?: string, needsSqlFix = false) {
    super(message);
    this.name = 'OvertimeSupabaseActionError';
    this.code = code;
    this.needsSqlFix = needsSqlFix;
  }
}

let cachedSupabaseClient: SupabaseClient | null = null;

export function getOvertimeSupabaseClient(): SupabaseClient {
  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return cachedSupabaseClient;
}

/**
 * Safe Supabase REST client wrapper for the Overtime module.
 * Reuses the app's configured SUPABASE_URL & SUPABASE_ANON_KEY (from env vars or defaults).
 */
export const overtimeSupabase = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 7000)
      : null;

    try {
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
        signal: controller?.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Supabase REST (${res.status}): ${errText}`);
      }

      if (res.status === 204) {
        return undefined as unknown as T;
      }

      const text = await res.text();
      return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  },
};

/**
 * Pure helper: returns true when a time string (HH:mm or HHhMM) is >= 20:10 (1210 minutes).
 */
export function isOvertimeTimeBold(timeStr: string): boolean {
  if (!timeStr) return false;
  const cleanTime = timeStr.trim().replace('h', ':');
  const [hours, minutes] = cleanTime.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
  return hours * 60 + minutes >= 1210;
}

/**
 * Pure helper: calculates decimal hours between two 24h HH:mm timestamps.
 */
export function calculateHoursBetween(
  startTime: string,
  endTime: string
): number {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.replace('h', ':').split(':').map(Number);
  const [endH, endM] = endTime.replace('h', ':').split(':').map(Number);
  if (
    Number.isNaN(startH) ||
    Number.isNaN(startM) ||
    Number.isNaN(endH) ||
    Number.isNaN(endM)
  ) {
    return 0;
  }
  const diffMinutes = endH * 60 + endM - (startH * 60 + startM);
  if (diffMinutes <= 0) return 0;
  return Number((diffMinutes / 60).toFixed(2));
}

/**
 * Pure helper: generates canonical overtime form code `TC-YYYYMMDD`
 * (fixed per date, e.g. `TC-20261121`).
 */
export function generateOvertimeFormCode(
  dateStr: string,
  _existingCodes: string[] = []
): string {
  const digits = (dateStr || '').replace(/\D/g, '');
  const datePart = digits.length === 8 ? digits : '20261116';
  return `TC-${datePart}`;
}

/**
 * Pure helper: formats a stored form code for display (preserving canonical `TC-YYYYMMDD`
 * while stripping any internal `-DEL-<timestamp>` soft-delete suffix).
 */
export function formatOvertimeFormCodeDisplay(formCode: string): string {
  const clean = (formCode || '').trim();
  if (!clean) return '';
  return clean.replace(/-DEL-\d+$/i, '').toUpperCase();
}

/**
 * Pure helper: converts UI task blocks into relational `overtime_form_items` rows,
 * preserving block_order, item_order, per-employee start/end times, and bilingual reasons.
 */
export function buildOvertimeFormItemsFromBlocks(
  formId: string,
  blocks: OvertimeBlockInput[],
  employees: Employee[],
  fallbackDate: string
): OvertimeFormItemRecord[] {
  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));
  const items: OvertimeFormItemRecord[] = [];

  blocks.forEach((block, blockIndex) => {
    const blockDate = block.overtimeDate || fallbackDate;
    const participants: OvertimeParticipantInput[] =
      Array.isArray(block.participants) && block.participants.length > 0
        ? block.participants
        : block.selectedEmployeeIds.map((id) => ({
            employeeId: id,
            startTime: block.startTime || '16:10',
            endTime: block.endTime || '20:10',
          }));

    participants.forEach((participant, itemIndex) => {
      const emp = empMap.get(participant.employeeId);
      const startTime = participant.startTime || block.startTime || '16:10';
      const endTime = participant.endTime || block.endTime || '20:10';
      const totalHours =
        typeof participant.totalHours === 'number' &&
        Number.isFinite(participant.totalHours)
          ? Number(Math.max(0, participant.totalHours).toFixed(2))
          : calculateHoursBetween(startTime, endTime);

      items.push({
        id: `${formId}-b${blockIndex}-i${itemIndex}`,
        form_id: formId,
        overtime_date: blockDate,
        block_order: blockIndex,
        item_order: itemIndex,
        block_id: block.id || `block-${blockIndex}`,
        employee_id: participant.employeeId,
        employee_code: emp?.employeeCode || '',
        employee_name: emp?.fullName || 'Nhân sự',
        reason_vi: (block.reasonVi || '').trim(),
        reason_kr: (block.reasonKr || '').trim(),
        start_time: startTime,
        end_time: endTime,
        total_hours: totalHours,
        deleted_at: null,
      });
    });
  });

  return items;
}

/**
 * Pure helper: reconstructs `OvertimeBlockInput[]` from flat `overtime_form_items`
 * so the saved form can be re-exported directly to Excel via `overtimeExportService`.
 */
export function reconstructBlocksFromItems(
  items: OvertimeFormItemRecord[]
): OvertimeBlockInput[] {
  const activeItems = items
    .filter((item) => !item.deleted_at)
    .slice()
    .sort((a, b) => {
      if (a.block_order !== b.block_order) return a.block_order - b.block_order;
      return a.item_order - b.item_order;
    });

  const blockMap = new Map<string, OvertimeBlockInput>();
  const orderedKeys: string[] = [];

  for (const item of activeItems) {
    const key = `${item.block_order}::${item.overtime_date}`;
    let block = blockMap.get(key);
    if (!block) {
      block = {
        id: item.block_id || `block-${item.block_order}-${item.overtime_date}`,
        overtimeDate: item.overtime_date,
        reasonVi: item.reason_vi,
        reasonKr: item.reason_kr,
        startTime: item.start_time,
        endTime: item.end_time,
        selectedEmployeeIds: [],
        participants: [],
      };
      blockMap.set(key, block);
      orderedKeys.push(key);
    }

    block.selectedEmployeeIds.push(item.employee_id);
    block.participants.push({
      employeeId: item.employee_id,
      startTime: item.start_time,
      endTime: item.end_time,
      totalHours: item.total_hours,
    });
  }

  return orderedKeys.map((k) => blockMap.get(k)!);
}

/**
 * Pure helper: swaps an overtime block with its adjacent neighbor (`up` or `down`)
 * and returns a new array preserving immutability.
 */
export function reorderOvertimeBlocks<T>(
  blocks: T[],
  index: number,
  direction: 'up' | 'down'
): T[] {
  if (!Array.isArray(blocks) || index < 0 || index >= blocks.length) {
    return Array.isArray(blocks) ? [...blocks] : [];
  }
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= blocks.length) {
    return [...blocks];
  }
  const next = [...blocks];
  const temp = next[index];
  next[index] = next[targetIndex];
  next[targetIndex] = temp;
  return next;
}

function formatIsoToCompactDDMM(isoDate: string): string {
  const m = (isoDate || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}`;
}

export function resolveOvertimeGroupBaseLabel(
  block: OvertimeBlockInput,
  formOvertimeDate: string,
  employeeMap: Map<string, Employee>
): { baseName: string; isSpecial: boolean } {
  const blockDate = (block.overtimeDate || '').trim().slice(0, 10);
  const formDate = (formOvertimeDate || '').trim().slice(0, 10);
  if (blockDate && formDate && blockDate !== formDate) {
    return {
      baseName: `Phát sinh (${formatIsoToCompactDDMM(blockDate)})`,
      isSpecial: true,
    };
  }

  const reason = (block.reasonVi || '').trim();
  if (/trực\s*sản\s*xuất/i.test(reason)) {
    return { baseName: 'Trực sản xuất', isSpecial: true };
  }

  const depts: string[] = [];
  const seen = new Set<string>();
  for (const p of block.participants || []) {
    const dept = employeeMap.get(p.employeeId)?.department?.trim();
    if (dept && !seen.has(dept)) {
      seen.add(dept);
      depts.push(dept);
    }
  }

  const baseName =
    depts.length > 0 ? depts.join(', ') : DEFAULT_OVERTIME_DEPARTMENT;
  const isOffice = depts.some((d) => /văn\s*phòng/i.test(d));
  return { baseName, isSpecial: isOffice };
}

/**
 * Pure helper: formats a compact 1-line label for an overtime group card.
 * Default: `#STT Tên nhóm`.
 * For special groups (`Trực sản xuất`, `Văn phòng`, out-of-date `Phát sinh (DD/MM)`)
 * or duplicate group names in the same form: `#STT Tên nhóm - Tên người tăng ca`.
 */
export function formatOvertimeGroupCompactLabel(params: {
  block: OvertimeBlockInput;
  index: number;
  formOvertimeDate: string;
  allBlocks: OvertimeBlockInput[];
  employeeMap: Map<string, Employee>;
  fallbackNamesById?: Map<string, string>;
}): string {
  const {
    block,
    index,
    formOvertimeDate,
    allBlocks,
    employeeMap,
    fallbackNamesById,
  } = params;
  const { baseName, isSpecial } = resolveOvertimeGroupBaseLabel(
    block,
    formOvertimeDate,
    employeeMap
  );

  const normalizedBase = baseName.trim().toLowerCase();
  let sameNameCount = 0;
  for (const b of allBlocks || []) {
    const res = resolveOvertimeGroupBaseLabel(b, formOvertimeDate, employeeMap);
    if (res.baseName.trim().toLowerCase() === normalizedBase) {
      sameNameCount += 1;
    }
  }

  const shouldIncludeNames = isSpecial || sameNameCount > 1;
  if (!shouldIncludeNames) {
    return `#${index + 1} ${baseName}`;
  }

  const names: string[] = [];
  const seenIds = new Set<string>();
  for (const p of block.participants || []) {
    if (!p.employeeId || seenIds.has(p.employeeId)) continue;
    seenIds.add(p.employeeId);
    const fullName =
      employeeMap.get(p.employeeId)?.fullName?.trim() ||
      fallbackNamesById?.get(p.employeeId)?.trim();
    if (fullName) {
      names.push(fullName);
    }
  }

  if (names.length === 0) {
    return `#${index + 1} ${baseName}`;
  }

  return `#${index + 1} ${baseName} - ${names.join(', ')}`;
}

/**
 * Pure helper: builds employee lookup entries from stored items merged with current employees
 * so historical forms keep accurate names even if an employee was later edited or removed.
 */
export function buildMergedEmployeesForExport(
  items: OvertimeFormItemRecord[],
  employees: Employee[],
  fallbackDepartment: string
): Employee[] {
  const byId = new Map<string, Employee>(employees.map((e) => [e.id, e]));
  const extra: Employee[] = [];

  for (const item of items) {
    if (!byId.has(item.employee_id)) {
      const placeholder: Employee = {
        id: item.employee_id,
        employeeCode: item.employee_code || '',
        fullName: item.employee_name || 'Nhân sự',
        dob: '',
        gender: 'Nam',
        cccd: '',
        phone: '',
        address: '',
        department: fallbackDepartment || DEFAULT_OVERTIME_DEPARTMENT,
        position: 'Nhân viên',
        joinDate: '',
        avatarUrl: '',
        standardAnnualLeave: 12,
        status: 'Đang làm việc',
        companyId: '',
      };
      byId.set(item.employee_id, placeholder);
      extra.push(placeholder);
    }
  }

  return [...employees, ...extra];
}

/**
 * Pure helper: transforms saved `overtime_form_items` into multi-date printable A4 groups
 * matching the TV-PSGC2022 form structure (No resets to 1 per date, merged reason per block).
 */
export function buildPrintableDateGroupsFromItems(
  items: OvertimeFormItemRecord[]
): PrintableOvertimeDateGroup[] {
  const activeItems = items
    .filter((item) => !item.deleted_at)
    .slice()
    .sort((a, b) => {
      if (a.block_order !== b.block_order) return a.block_order - b.block_order;
      return a.item_order - b.item_order;
    });

  const blocksByDate = new Map<
    string,
    Map<number, OvertimeFormItemRecord[]>
  >();

  for (const item of activeItems) {
    const dateKey = item.overtime_date || '';
    if (!blocksByDate.has(dateKey)) {
      blocksByDate.set(dateKey, new Map());
    }
    const dateBlocks = blocksByDate.get(dateKey)!;
    if (!dateBlocks.has(item.block_order)) {
      dateBlocks.set(item.block_order, []);
    }
    dateBlocks.get(item.block_order)!.push(item);
  }

  const result: PrintableOvertimeDateGroup[] = [];

  blocksByDate.forEach((blockMap, dateKey) => {
    let runningNo = 1;
    const groupedBlocks: PrintableOvertimeDateGroup['blocks'] = [];

    blockMap.forEach((blockItems, blockOrder) => {
      const first = blockItems[0];
      const combinedReason = buildCombinedReasonTextLocal(
        first?.reason_vi || '',
        first?.reason_kr || ''
      );
      const rows: PrintableOvertimeRow[] = blockItems.map((item, idx) => ({
        no: runningNo++,
        fullName: item.employee_name || 'Nhân sự',
        employeeCode: item.employee_code || '',
        isFirstInBlock: idx === 0,
        rowSpan: blockItems.length,
        combinedReason,
        startTimeFormatted: formatTimeToFormStyleLocal(item.start_time),
        endTimeFormatted: formatTimeToFormStyleLocal(item.end_time),
      }));

      groupedBlocks.push({
        blockId: `${dateKey}-block-${blockOrder}`,
        rows,
      });
    });

    result.push({
      date: dateKey,
      formattedDate: formatDateToFormStyleLocal(dateKey),
      blocks: groupedBlocks,
    });
  });

  return result;
}

export type OvertimeA4DensityTier = 'spacious' | 'compact' | 'dense';

export interface OvertimeA4DensityProfile {
  tier: OvertimeA4DensityTier;
  cellPaddingClass: string;
  tableTextClass: string;
  signatureRowHeightClass: string;
  sheetSpaceClass: string;
  dateGroupMarginClass: string;
  footerClass: string;
  headerTitleBlockClass: string;
}

/**
 * Pure helper: computes A4 sheet vertical density classes based on total employee rows
 * so the 794px portrait sheet scales cleanly to fit 1 A4 page on print without shrinking horizontal margins.
 */
export function computeOvertimeA4Density(
  totalRows: number
): OvertimeA4DensityProfile {
  if (totalRows <= 12) {
    return {
      tier: 'spacious',
      cellPaddingClass: 'py-2',
      tableTextClass: 'text-[11.5px] leading-[1.35]',
      signatureRowHeightClass: 'h-16',
      sheetSpaceClass: 'space-y-3',
      dateGroupMarginClass: 'mb-3',
      footerClass: 'mt-2 text-[11px] space-y-0.5 leading-snug',
      headerTitleBlockClass: 'pt-2',
    };
  }
  if (totalRows <= 22) {
    return {
      tier: 'compact',
      cellPaddingClass: 'py-1',
      tableTextClass: 'text-[10.5px] leading-[1.25]',
      signatureRowHeightClass: 'h-13',
      sheetSpaceClass: 'space-y-2',
      dateGroupMarginClass: 'mb-2.5',
      footerClass: 'mt-1.5 text-[10.5px] space-y-0.5 leading-snug',
      headerTitleBlockClass: 'pt-1',
    };
  }
  return {
    tier: 'dense',
    cellPaddingClass: 'py-[2px]',
    tableTextClass: 'text-[9.5px] leading-[1.15]',
    signatureRowHeightClass: 'h-11',
    sheetSpaceClass: 'space-y-1.5',
    dateGroupMarginClass: 'mb-2',
    footerClass: 'mt-1 text-[10px] space-y-0 leading-tight',
    headerTitleBlockClass: 'pt-0.5',
  };
}

/**
 * Pure helper: normalizes Vietnamese text for accent-insensitive search.
 */
function normalizeSearchText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

/**
 * Pure helper: returns true when an overtime form is locked ("Đã chốt").
 */
export function isOvertimeFormLocked(
  form?: { is_locked?: boolean | null; status?: string | null } | null
): boolean {
  if (!form) return false;
  return form.is_locked === true || (form.status || '').trim() === 'Đã chốt';
}

/**
 * Pure helper: filters overtime form records by search query (form code or department)
 * and overtime date or month (`YYYY-MM` or `YYYY-MM-DD`), always excluding soft-deleted records.
 */
export function filterOvertimeForms(
  forms: OvertimeFormWithItems[],
  searchQuery: string,
  dateFilter: string,
  knownSubGroups: string[] = []
): OvertimeFormWithItems[] {
  const normalizedQuery = normalizeSearchText(searchQuery);
  const cleanDate = (dateFilter || '').trim();
  const isMonthFilter = /^\d{4}-\d{2}$/.test(cleanDate);

  return forms.filter((form) => {
    if (form.deleted_at) return false;

    if (cleanDate) {
      const primaryDate = (form.overtime_date || '').trim().slice(0, 10);
      const dates = (
        Array.isArray(form.overtime_dates) && form.overtime_dates.length > 0
          ? form.overtime_dates
          : [primaryDate]
      )
        .map((d) => (d || '').trim().slice(0, 10))
        .filter(Boolean);
      if (isMonthFilter) {
        const primaryMatches = primaryDate.startsWith(cleanDate);
        const anyItemMatches = dates.some((d) => d.startsWith(cleanDate));
        if (!primaryMatches && !anyItemMatches) {
          return false;
        }
      } else if (primaryDate !== cleanDate && !dates.includes(cleanDate)) {
        return false;
      }
    }

    if (normalizedQuery) {
      const codeNorm = normalizeSearchText(form.form_code);
      const displayCodeNorm = normalizeSearchText(
        formatOvertimeFormCodeDisplay(form.form_code)
      );
      const rawDeptNorm = normalizeSearchText(form.department);
      const mainDeptNorm = normalizeSearchText(
        resolveOvertimeMainDepartment(form.department, knownSubGroups)
      );
      if (
        !codeNorm.includes(normalizedQuery) &&
        !displayCodeNorm.includes(normalizedQuery) &&
        !rawDeptNorm.includes(normalizedQuery) &&
        !mainDeptNorm.includes(normalizedQuery)
      ) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Pure helper: formats ISO timestamp into DD/MM/YYYY HH:mm for display.
 */
export function formatCreatedAtVN(isoString: string): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function mapSupabaseItemRow(
  row: SupabaseOvertimeFormItemRow
): OvertimeFormItemRecord {
  const startTime = row.start_time || '16:10';
  const endTime = row.end_time || '20:10';
  const overtimeDate = row.overtime_date || '';
  const totalHours = calculateActualOvertimeHours(
    overtimeDate,
    startTime,
    endTime,
    false,
    DEFAULT_OVERTIME_SETTINGS
  ).netHours;
  return {
    id: row.id,
    form_id: row.form_id,
    overtime_date: overtimeDate,
    block_order: Number(row.block_order ?? 0),
    item_order: Number(row.item_order ?? 0),
    block_id: row.block_id || null,
    employee_id: row.employee_id || row.id,
    employee_code: row.employee_code || '',
    employee_name: row.full_name || 'Nhân sự',
    reason_vi: row.reason_vi || '',
    reason_kr: row.reason_kr || '',
    start_time: startTime,
    end_time: endTime,
    total_hours: totalHours,
    deleted_at: row.deleted_at ?? null,
  };
}

function createSampleOvertimeForms(): OvertimeFormWithItems[] {
  const form1Id = 'sample-ot-form-001';
  const form2Id = 'sample-ot-form-002';

  return [
    {
      id: form1Id,
      form_code: 'TC-20261116',
      department: DEFAULT_OVERTIME_DEPARTMENT,
      overtime_date: '2026-11-16',
      overtime_dates: ['2026-11-16', '2026-11-17'],
      total_blocks: 2,
      total_participants: 4,
      total_hours: 17.5,
      status: 'Đã lưu',
      created_at: '2026-11-16T08:30:00.000Z',
      deleted_at: null,
      items: [
        {
          id: `${form1Id}-b0-i0`,
          form_id: form1Id,
          overtime_date: '2026-11-16',
          block_order: 0,
          item_order: 0,
          employee_id: 'emp-sample-1',
          employee_code: 'NV001',
          employee_name: 'Nguyễn Văn An',
          reason_vi: 'Trực sản xuất & kiểm tra dây chuyền SMT',
          reason_kr: '생산 당직 및 SMT 라인 점검',
          start_time: '16:10',
          end_time: '20:10',
          total_hours: 4,
          deleted_at: null,
        },
        {
          id: `${form1Id}-b0-i1`,
          form_id: form1Id,
          overtime_date: '2026-11-16',
          block_order: 0,
          item_order: 1,
          employee_id: 'emp-sample-2',
          employee_code: 'NV002',
          employee_name: 'Trần Minh Đức',
          reason_vi: 'Trực sản xuất & kiểm tra dây chuyền SMT',
          reason_kr: '생산 당직 및 SMT 라인 점검',
          start_time: '16:10',
          end_time: '21:10',
          total_hours: 5,
          deleted_at: null,
        },
        {
          id: `${form1Id}-b1-i0`,
          form_id: form1Id,
          overtime_date: '2026-11-17',
          block_order: 1,
          item_order: 0,
          employee_id: 'emp-sample-3',
          employee_code: 'NV003',
          employee_name: 'Lê Hoàng Nam',
          reason_vi: 'Sửa máy ép khuôn số 03',
          reason_kr: '3호 금형 프레스 설비 수리',
          start_time: '16:10',
          end_time: '20:40',
          total_hours: 4.5,
          deleted_at: null,
        },
        {
          id: `${form1Id}-b1-i1`,
          form_id: form1Id,
          overtime_date: '2026-11-17',
          block_order: 1,
          item_order: 1,
          employee_id: 'emp-sample-4',
          employee_code: 'NV004',
          employee_name: 'Phạm Quốc Huy',
          reason_vi: 'Sửa máy ép khuôn số 03',
          reason_kr: '3호 금형 프레스 설비 수리',
          start_time: '16:10',
          end_time: '20:10',
          total_hours: 4,
          deleted_at: null,
        },
      ],
    },
    {
      id: form2Id,
      form_code: 'TC-20261114',
      department: 'Sản Xuất',
      overtime_date: '2026-11-14',
      overtime_dates: ['2026-11-14'],
      total_blocks: 1,
      total_participants: 2,
      total_hours: 7,
      status: 'Đã lưu',
      created_at: '2026-11-14T14:15:00.000Z',
      deleted_at: null,
      items: [
        {
          id: `${form2Id}-b0-i0`,
          form_id: form2Id,
          overtime_date: '2026-11-14',
          block_order: 0,
          item_order: 0,
          employee_id: 'emp-sample-5',
          employee_code: 'NV012',
          employee_name: 'Đỗ Thị Hương',
          reason_vi: 'Đóng gói hàng gấp xuất khẩu',
          reason_kr: '수출 긴급 물량 포장 작업',
          start_time: '16:10',
          end_time: '19:40',
          total_hours: 3.5,
          deleted_at: null,
        },
        {
          id: `${form2Id}-b0-i1`,
          form_id: form2Id,
          overtime_date: '2026-11-14',
          block_order: 0,
          item_order: 1,
          employee_id: 'emp-sample-6',
          employee_code: 'NV015',
          employee_name: 'Vũ Thị Mai',
          reason_vi: 'Đóng gói hàng gấp xuất khẩu',
          reason_kr: '수출 긴급 물량 포장 작업',
          start_time: '16:10',
          end_time: '19:40',
          total_hours: 3.5,
          deleted_at: null,
        },
      ],
    },
  ];
}

function readLocalForms(seedIfMissing: boolean): OvertimeFormWithItems[] {
  if (typeof window === 'undefined') {
    return seedIfMissing ? createSampleOvertimeForms() : [];
  }
  try {
    const raw = localStorage.getItem(OVERTIME_FORMS_STORAGE_KEY);
    if (!raw) {
      if (!seedIfMissing) return [];
      const seeded = createSampleOvertimeForms();
      localStorage.setItem(OVERTIME_FORMS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as OvertimeFormWithItems[];
    }
  } catch {
    // Ignore malformed localStorage
  }
  return seedIfMissing ? createSampleOvertimeForms() : [];
}

function writeLocalForms(forms: OvertimeFormWithItems[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OVERTIME_FORMS_STORAGE_KEY, JSON.stringify(forms));
  } catch {
    // Ignore quota errors
  }
}

function readDeletedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(OVERTIME_FORMS_DELETED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function markIdDeletedLocally(formId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const deleted = readDeletedIds();
    deleted.add(formId);
    localStorage.setItem(
      OVERTIME_FORMS_DELETED_KEY,
      JSON.stringify(Array.from(deleted))
    );
  } catch {
    // Ignore storage errors
  }
}

function readLocalUpdatedMap(): Record<string, OvertimeFormWithItems> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OVERTIME_FORMS_UPDATED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, OvertimeFormWithItems>)
      : {};
  } catch {
    return {};
  }
}

function saveLocalUpdatedForm(form: OvertimeFormWithItems): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readLocalUpdatedMap();
    current[form.id] = form;
    localStorage.setItem(OVERTIME_FORMS_UPDATED_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota errors
  }
}

function clearLocalUpdatedForm(formId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readLocalUpdatedMap();
    if (formId in current) {
      delete current[formId];
      localStorage.setItem(OVERTIME_FORMS_UPDATED_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Pure helper: returns local calendar date in YYYY-MM-DD format without UTC shift.
 */
export function getLocalTodayIsoDate(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Pure helper: extracts sorted unique non-empty ISO dates from committed task blocks.
 */
export function extractUniqueBlockDates(blocks: OvertimeBlockInput[]): string[] {
  const dateSet = new Set<string>();
  for (const block of blocks) {
    const clean = (block?.overtimeDate || '').trim();
    if (clean) dateSet.add(clean);
  }
  return Array.from(dateSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Pure helper: resolves the representative `overtime_date` for `overtime_forms`.
 * - Single unique date in blocks -> that exact date.
 * - Two or more unique dates in blocks -> today's date (`todayIso`, local YYYY-MM-DD).
 */
export function resolveRepresentativeOvertimeDate(
  blocks: OvertimeBlockInput[],
  fallbackDate?: string,
  todayIso?: string
): string {
  const uniqueDates = extractUniqueBlockDates(blocks);
  if (uniqueDates.length >= 2) {
    return todayIso || getLocalTodayIsoDate();
  }
  if (uniqueDates.length === 1) {
    return uniqueDates[0];
  }
  return (fallbackDate || '').trim() || todayIso || getLocalTodayIsoDate();
}

/**
 * Pure helper: normalizes department name for accent/case-insensitive equality.
 */
export function normalizeDepartmentKey(department: string): string {
  return normalizeSearchText(department || '');
}

/**
 * Pure helper: extracts actual active work dates recorded on an existing overtime form.
 * Uses non-deleted line items first so a multi-day form's representative date does not
 * falsely mark an unworked day as occupied.
 */
export function extractActiveFormWorkDates(
  form: OvertimeFormWithItems
): string[] {
  if (!form || form.deleted_at) return [];
  const activeItemDates = Array.isArray(form.items)
    ? form.items
        .filter((item) => item && !item.deleted_at && item.overtime_date)
        .map((item) => item.overtime_date.trim())
        .filter(Boolean)
    : [];

  if (activeItemDates.length > 0) {
    return Array.from(new Set(activeItemDates)).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  if (Array.isArray(form.overtime_dates) && form.overtime_dates.length > 0) {
    return Array.from(
      new Set(form.overtime_dates.map((d) => (d || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }

  return form.overtime_date?.trim() ? [form.overtime_date.trim()] : [];
}

const TECHNICAL_DEPARTMENT_ALIASES = new Set<string>([
  '',
  'all',
  'tat ca',
  'tat ca nhom',
  'tat ca bo phan',
  'toan bo bo phan',
  'ky thuat',
  'bo phan ky thuat',
  'phong ky thuat',
]);

/**
 * Pure helper: resolves the canonical main department for an overtime form.
 * - Defaults to "Bộ phận Kỹ thuật" (including when empty, 'ALL', 'Kỹ Thuật',
 *   'Toàn bộ bộ phận', or when a sub-group name under Bộ phận Kỹ thuật such as
 *   IOT / ST / Bảo trì / PE is passed).
 * - Preserves an explicitly configured distinct top-level department (e.g. 'Sản Xuất')
 *   if it is not one of the known sub-groups under Bộ phận Kỹ thuật.
 */
export function resolveOvertimeMainDepartment(
  configuredDepartment?: string | null,
  knownSubGroups: string[] = []
): string {
  const trimmed = (configuredDepartment || '').trim();
  const norm = normalizeSearchText(trimmed);

  if (TECHNICAL_DEPARTMENT_ALIASES.has(norm)) {
    return DEFAULT_OVERTIME_DEPARTMENT;
  }

  if (knownSubGroups.length > 0) {
    const normalizedSubGroups = new Set(
      knownSubGroups
        .map((g) => normalizeSearchText(g))
        .filter((g) => g.length > 0)
    );
    if (normalizedSubGroups.has(norm)) {
      return DEFAULT_OVERTIME_DEPARTMENT;
    }
  }

  return trimmed;
}

/**
 * Pure helper: resolves the main department label for an overtime form.
 * Selecting a sub-group or employees from a sub-group NEVER overwrites "Bộ phận Kỹ thuật".
 */
export function resolveDepartmentLabel(
  department: string,
  _blocks: OvertimeBlockInput[],
  employees: Employee[],
  knownSubGroups: string[] = []
): string {
  const subGroupNames = new Set<string>(knownSubGroups);
  for (const emp of employees || []) {
    if (emp?.department?.trim()) {
      subGroupNames.add(emp.department.trim());
    }
  }
  return resolveOvertimeMainDepartment(department, Array.from(subGroupNames));
}

/**
 * Pure helper: formats the bilingual TV-PSGC2022 department header line.
 * Always keeps "Bộ phận 부서: Kỹ Thuật 기술" for Bộ phận Kỹ thuật and its sub-groups,
 * while preserving explicitly configured distinct top-level departments.
 */
export function formatOvertimeDepartmentHeaderLabel(
  department?: string | null,
  knownSubGroups: string[] = []
): string {
  const mainDept = resolveOvertimeMainDepartment(department, knownSubGroups);
  if (mainDept === DEFAULT_OVERTIME_DEPARTMENT) {
    return 'Bộ phận 부서: Kỹ Thuật 기술';
  }
  if (/^bộ phận\b/i.test(mainDept)) {
    return `${mainDept} / 부서`;
  }
  return `Bộ phận / 부서: ${mainDept}`;
}

export interface OvertimeDateConflictMatch {
  date: string;
  forms: Array<{
    id: string;
    form_code: string;
    department: string;
    overtime_date: string;
  }>;
}

export type OvertimeDateConflictMode =
  | 'none'
  | 'single_day_blocked'
  | 'representative_date_blocked'
  | 'multi_day_reminder';

export interface OvertimeDateConflictEvaluation {
  mode: OvertimeDateConflictMode;
  isBlocked: boolean;
  uniqueDates: string[];
  representativeDate: string;
  resolvedDepartment: string;
  conflicts: OvertimeDateConflictMatch[];
  conflictingForms: OvertimeFormWithItems[];
}

export interface EvaluateOvertimeDateConflictParams {
  blocks: OvertimeBlockInput[];
  selectedDepartment: string;
  employees: Employee[];
  existingForms: OvertimeFormWithItems[];
  editingFormId?: string | null;
  primaryOvertimeDate?: string;
  fallbackDate?: string;
  todayIso?: string;
}

/**
 * Pure helper: picks the default primary date among unique block dates
 * (prefers today's ISO date if present in `uniqueDates`, otherwise the latest date).
 */
export function resolveDefaultPrimaryOvertimeDate(
  uniqueDates: string[],
  todayIso: string = getLocalTodayIsoDate()
): string {
  const cleanDates = (uniqueDates || [])
    .map((d) => (d || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  if (cleanDates.length === 0) return todayIso;
  if (cleanDates.includes(todayIso)) return todayIso;
  return cleanDates[cleanDates.length - 1];
}

/**
 * Pure helper: finds all active (non-soft-deleted, non-self) forms occupying `targetDate`
 * (either via representative `overtime_date` or active line-item dates), across ALL departments.
 */
export function findActiveFormsByDate(
  existingForms: OvertimeFormWithItems[],
  targetDate: string,
  editingFormId?: string | null
): OvertimeFormWithItems[] {
  const cleanTarget = (targetDate || '').trim();
  if (!cleanTarget) return [];
  return (existingForms || []).filter((form) => {
    if (!form || form.deleted_at) return false;
    if (editingFormId && form.id === editingFormId) return false;
    if ((form.overtime_date || '').trim() === cleanTarget) return true;
    return extractActiveFormWorkDates(form).includes(cleanTarget);
  });
}

/**
 * Pure helper: evaluates duplicate primary overtime dates against active `overtime_forms`
 * (`deleted_at is null`), while allowing earlier-day adjustment blocks when the primary
 * date of the new form is free.
 * - Excludes soft-deleted forms (`deleted_at != null`) and the currently edited form (`editingFormId`).
 * - If an active form already exists with `overtime_date === primaryDate`: BLOCKS save (`isBlocked: true`).
 * - Otherwise, if any included block date overlaps an earlier active form: ALLOWS save
 *   (`multi_day_reminder`, `isBlocked: false`) with a clear non-double-counting notice.
 */
export function evaluateOvertimeDateConflict({
  blocks,
  selectedDepartment,
  employees,
  existingForms,
  editingFormId = null,
  primaryOvertimeDate,
  fallbackDate,
  todayIso,
}: EvaluateOvertimeDateConflictParams): OvertimeDateConflictEvaluation {
  const uniqueDates = extractUniqueBlockDates(blocks);
  const explicitPrimary = (primaryOvertimeDate || '').trim();
  const representativeDate =
    explicitPrimary ||
    resolveRepresentativeOvertimeDate(blocks, fallbackDate, todayIso);
  const resolvedDepartment = resolveDepartmentLabel(
    selectedDepartment,
    blocks,
    employees
  );

  const activeForms = (existingForms || []).filter((form) => {
    if (!form || form.deleted_at) return false;
    if (editingFormId && form.id === editingFormId) return false;
    return true;
  });

  // Check if the chosen Primary Date (Ngày tăng ca chính của phiếu) already has an active form
  if (representativeDate) {
    const primaryDateForms = activeForms.filter(
      (form) => (form.overtime_date || '').trim() === representativeDate
    );
    if (primaryDateForms.length > 0) {
      return {
        mode: 'representative_date_blocked',
        isBlocked: true,
        uniqueDates,
        representativeDate,
        resolvedDepartment,
        conflicts: [
          {
            date: representativeDate,
            forms: primaryDateForms.map((f) => ({
              id: f.id,
              form_code: formatOvertimeFormCodeDisplay(f.form_code),
              department: f.department,
              overtime_date: f.overtime_date,
            })),
          },
        ],
        conflictingForms: primaryDateForms,
      };
    }
  }

  if (uniqueDates.length === 0) {
    return {
      mode: 'none',
      isBlocked: false,
      uniqueDates,
      representativeDate,
      resolvedDepartment,
      conflicts: [],
      conflictingForms: [],
    };
  }

  const conflicts: OvertimeDateConflictMatch[] = [];
  const conflictingFormMap = new Map<string, OvertimeFormWithItems>();

  for (const date of uniqueDates) {
    const matchedForms = activeForms.filter(
      (form) =>
        (form.overtime_date || '').trim() === date ||
        extractActiveFormWorkDates(form).includes(date)
    );
    if (matchedForms.length > 0) {
      conflicts.push({
        date,
        forms: matchedForms.map((f) => ({
          id: f.id,
          form_code: formatOvertimeFormCodeDisplay(f.form_code),
          department: f.department,
          overtime_date: f.overtime_date,
        })),
      });
      for (const f of matchedForms) {
        conflictingFormMap.set(f.id, f);
      }
    }
  }

  const conflictingForms = Array.from(conflictingFormMap.values());

  if (conflicts.length > 0) {
    return {
      mode: 'multi_day_reminder',
      isBlocked: false,
      uniqueDates,
      representativeDate,
      resolvedDepartment,
      conflicts,
      conflictingForms,
    };
  }

  return {
    mode: 'none',
    isBlocked: false,
    uniqueDates,
    representativeDate,
    resolvedDepartment,
    conflicts: [],
    conflictingForms: [],
  };
}

/**
 * Pure helper: produces an updated OvertimeFormWithItems preserving id, form_code, fixed shell overtime_date, and created_at.
 */
export function buildUpdatedOvertimeForm(
  existingForm: OvertimeFormWithItems,
  input: SaveOvertimeFormInput,
  _todayIso?: string
): OvertimeFormWithItems {
  const fixedShellDate =
    (existingForm.overtime_date || '').trim() ||
    (input.overtimeDate || '').trim() ||
    input.blocks[0]?.overtimeDate ||
    getLocalTodayIsoDate();
  const uniqueDates = extractUniqueBlockDates(input.blocks);
  const departmentLabel = resolveDepartmentLabel(
    input.department,
    input.blocks,
    input.employees,
    input.knownSubGroups
  );
  const items = buildOvertimeFormItemsFromBlocks(
    existingForm.id,
    input.blocks,
    input.employees,
    fixedShellDate
  );
  const totalHours = Number(
    items.reduce((sum, item) => sum + item.total_hours, 0).toFixed(2)
  );
  const nowIso = new Date().toISOString();

  return {
    ...existingForm,
    department: departmentLabel,
    overtime_date: fixedShellDate,
    overtime_dates: uniqueDates.length > 0 ? uniqueDates : [fixedShellDate],
    total_blocks: input.blocks.length,
    total_participants: items.length,
    total_hours: totalHours,
    status: items.length > 0 ? 'Đã lưu' : 'Mới tạo',
    updated_at: nowIso,
    items,
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clearStaleLocalOvertimeOverrides(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OVERTIME_FORMS_DELETED_KEY);
    localStorage.removeItem(OVERTIME_FORMS_UPDATED_KEY);
  } catch {
    // Ignore storage errors
  }
}

function hydrateOvertimeFormRow(
  f: SupabaseOvertimeFormRow,
  formItems: OvertimeFormItemRecord[]
): OvertimeFormWithItems {
  const activeItems = formItems.filter((item) => !item.deleted_at);
  const derivedDates = Array.from(
    new Set(activeItems.map((i) => i.overtime_date).filter(Boolean))
  );
  const computedHours = Number(
    activeItems.reduce((acc, item) => acc + item.total_hours, 0).toFixed(2)
  );
  const isLocked =
    Boolean(f.is_locked) || (f.status || '').trim() === 'Đã chốt';
  return {
    id: f.id,
    form_code: f.form_code,
    department: f.department || DEFAULT_OVERTIME_DEPARTMENT,
    overtime_date: f.overtime_date || derivedDates[0] || '',
    overtime_dates:
      derivedDates.length > 0
        ? derivedDates
        : f.overtime_date
          ? [f.overtime_date]
          : [],
    total_blocks: Number(f.total_blocks ?? 0),
    total_participants: Number(f.total_employees ?? activeItems.length),
    total_hours: Number(f.total_hours ?? computedHours),
    status: isLocked
      ? 'Đã chốt'
      : f.status || (activeItems.length > 0 ? 'Đã lưu' : 'Mới tạo'),
    is_locked: isLocked,
    created_by: f.created_by ?? null,
    created_at: f.created_at,
    updated_at: f.updated_at ?? null,
    deleted_at: f.deleted_at ?? null,
    items: activeItems,
  };
}

function isUndefinedColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === '42703' ||
    msg.includes('deleted_at') ||
    msg.includes('is_locked')
  );
}

/**
 * Fetches all non-deleted overtime forms with their active line items directly from Supabase
 * using `.is('deleted_at', null)` on both `overtime_forms` and `overtime_form_items`.
 */
export async function fetchOvertimeForms(): Promise<{
  forms: OvertimeFormWithItems[];
  source: 'supabase' | 'local';
  schemaNeedsMigration?: boolean;
}> {
  const client = getOvertimeSupabaseClient();
  let schemaNeedsMigration = false;

  try {
    const formsRes = await client
      .from('overtime_forms')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (formsRes.error) {
      throw formsRes.error;
    }

    let itemsRes = await client
      .from('overtime_form_items')
      .select('*')
      .is('deleted_at', null)
      .order('block_order', { ascending: true })
      .order('item_order', { ascending: true });

    if (itemsRes.error && isUndefinedColumnError(itemsRes.error)) {
      schemaNeedsMigration = true;
      itemsRes = await client
        .from('overtime_form_items')
        .select('*')
        .order('block_order', { ascending: true })
        .order('item_order', { ascending: true });
    }

    if (itemsRes.error) {
      throw itemsRes.error;
    }

    const formsRows = (formsRes.data || []) as SupabaseOvertimeFormRow[];
    const itemRows = (itemsRes.data || []) as SupabaseOvertimeFormItemRow[];

    const itemsByForm = new Map<string, OvertimeFormItemRecord[]>();
    for (const rawItem of itemRows) {
      if (rawItem.deleted_at) continue;
      const mapped = mapSupabaseItemRow(rawItem);
      if (mapped.deleted_at) continue;
      if (!itemsByForm.has(mapped.form_id)) {
        itemsByForm.set(mapped.form_id, []);
      }
      itemsByForm.get(mapped.form_id)!.push(mapped);
    }

    const hydrated: OvertimeFormWithItems[] = formsRows
      .filter((f) => !f.deleted_at)
      .map((f) => hydrateOvertimeFormRow(f, itemsByForm.get(f.id) || []));

    // Supabase is authoritative: clear legacy local delete/edit overrides so all users stay synced
    clearStaleLocalOvertimeOverrides();
    writeLocalForms(hydrated);
    return { forms: hydrated, source: 'supabase', schemaNeedsMigration };
  } catch {
    const localForms = readLocalForms(false)
      .filter((f) => !f.deleted_at)
      .map((f) => ({
        ...f,
        items: (f.items || []).filter((item) => !item.deleted_at),
      }))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return { forms: localForms, source: 'local', schemaNeedsMigration };
  }
}

/**
 * Fetches a single active overtime form and its active line items directly from Supabase
 * with `.is('deleted_at', null)` on both `overtime_forms` and `overtime_form_items`.
 * Returns `null` if the form has been soft-deleted or does not exist.
 */
export async function fetchOvertimeFormById(
  formId: string
): Promise<OvertimeFormWithItems | null> {
  const client = getOvertimeSupabaseClient();
  const cleanId = (formId || '').trim();
  if (!cleanId) return null;

  try {
    const formRes = await client
      .from('overtime_forms')
      .select('*')
      .eq('id', cleanId)
      .is('deleted_at', null)
      .maybeSingle();

    if (formRes.error) throw formRes.error;
    if (!formRes.data || (formRes.data as SupabaseOvertimeFormRow).deleted_at) {
      return null;
    }

    let itemsRes = await client
      .from('overtime_form_items')
      .select('*')
      .eq('form_id', cleanId)
      .is('deleted_at', null)
      .order('block_order', { ascending: true })
      .order('item_order', { ascending: true });

    if (itemsRes.error && isUndefinedColumnError(itemsRes.error)) {
      itemsRes = await client
        .from('overtime_form_items')
        .select('*')
        .eq('form_id', cleanId)
        .order('block_order', { ascending: true })
        .order('item_order', { ascending: true });
    }

    if (itemsRes.error) throw itemsRes.error;

    const mappedItems = ((itemsRes.data || []) as SupabaseOvertimeFormItemRow[])
      .filter((row) => !row.deleted_at)
      .map(mapSupabaseItemRow)
      .filter((item) => !item.deleted_at);

    return hydrateOvertimeFormRow(
      formRes.data as SupabaseOvertimeFormRow,
      mappedItems
    );
  } catch {
    const localMatch = readLocalForms(false).find(
      (f) => f.id === cleanId && !f.deleted_at
    );
    if (!localMatch) return null;
    return {
      ...localMatch,
      items: (localMatch.items || []).filter((item) => !item.deleted_at),
    };
  }
}

/**
 * Saves an overtime form header (`overtime_forms`) and its line items (`overtime_form_items`).
 * Matches the live Supabase schema and mirrors locally for offline resilience.
 */
export async function saveOvertimeFormToHistory(
  input: SaveOvertimeFormInput
): Promise<OvertimeFormWithItems> {
  const client = getOvertimeSupabaseClient();
  const existingLocal = readLocalForms(false);
  const explicitPrimaryDate = (input.overtimeDate || '').trim();
  const fallbackDate =
    explicitPrimaryDate || input.blocks[0]?.overtimeDate || getLocalTodayIsoDate();
  const uniqueDates = extractUniqueBlockDates(input.blocks);
  const representativeDate =
    explicitPrimaryDate ||
    resolveRepresentativeOvertimeDate(input.blocks, fallbackDate);
  const departmentLabel = resolveDepartmentLabel(
    input.department,
    input.blocks,
    input.employees,
    input.knownSubGroups
  );

  let activeFormCodes = existingLocal
    .filter((f) => !f.deleted_at)
    .map((f) => f.form_code);
  try {
    const activeCodesRes = await client
      .from('overtime_forms')
      .select('form_code');
    if (!activeCodesRes.error && Array.isArray(activeCodesRes.data)) {
      activeFormCodes = activeCodesRes.data
        .map((r) => String((r as { form_code?: string }).form_code || ''))
        .filter(Boolean);
    }
  } catch {
    // Fallback to local codes
  }

  const formId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ot-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const formCode = generateOvertimeFormCode(
    representativeDate,
    activeFormCodes
  );

  const items = buildOvertimeFormItemsFromBlocks(
    formId,
    input.blocks,
    input.employees,
    fallbackDate
  );

  const totalHours = Number(
    items.reduce((sum, item) => sum + item.total_hours, 0).toFixed(2)
  );
  const nowIso = new Date().toISOString();

  const newForm: OvertimeFormWithItems = {
    id: formId,
    form_code: formCode,
    department: departmentLabel,
    overtime_date: representativeDate,
    overtime_dates: uniqueDates.length > 0 ? uniqueDates : [representativeDate],
    total_blocks: input.blocks.length,
    total_participants: items.length,
    total_hours: totalHours,
    status: 'Đã lưu',
    created_by: input.createdBy ?? null,
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
    items,
  };

  try {
    let insertedForms: SupabaseOvertimeFormRow[] = [];
    let lastInsertError: { code?: string; message?: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const insertedRes = await client
        .from('overtime_forms')
        .insert({
          id: newForm.id,
          form_code: newForm.form_code,
          department: newForm.department,
          overtime_date: newForm.overtime_date,
          total_blocks: newForm.total_blocks,
          total_employees: newForm.total_participants,
          total_hours: newForm.total_hours,
          status: newForm.status,
          created_by: newForm.created_by,
        })
        .select('*');

      if (!insertedRes.error) {
        insertedForms = (insertedRes.data || []) as SupabaseOvertimeFormRow[];
        lastInsertError = null;
        break;
      }

      lastInsertError = insertedRes.error;
      if (insertedRes.error.code === '23505') {
        activeFormCodes = [...activeFormCodes, newForm.form_code];
        newForm.form_code = generateOvertimeFormCode(
          representativeDate,
          activeFormCodes
        );
        continue;
      }
      throw insertedRes.error;
    }

    if (lastInsertError) throw lastInsertError;

    const persistedFormId = insertedForms?.[0]?.id || newForm.id;
    newForm.id = persistedFormId;
    if (insertedForms?.[0]?.created_at) {
      newForm.created_at = insertedForms[0].created_at;
    }

    if (items.length > 0) {
      const insertedItemsRes = await client
        .from('overtime_form_items')
        .insert(
          items.map((item) => ({
            form_id: persistedFormId,
            overtime_date: item.overtime_date,
            block_order: item.block_order,
            item_order: item.item_order,
            block_id: item.block_id || `block-${item.block_order}`,
            employee_id: UUID_REGEX.test(item.employee_id)
              ? item.employee_id
              : null,
            employee_code: item.employee_code,
            full_name: item.employee_name,
            reason_vi: item.reason_vi,
            reason_kr: item.reason_kr,
            start_time: item.start_time,
            end_time: item.end_time,
          }))
        )
        .select('*');

      if (!insertedItemsRes.error && insertedItemsRes.data?.length) {
        newForm.items = (
          insertedItemsRes.data as SupabaseOvertimeFormItemRow[]
        ).map(mapSupabaseItemRow);
      }
    }
  } catch {
    // Graceful fallback: local persistence below ensures uninterrupted UX
  }

  const updatedLocal = [
    newForm,
    ...existingLocal.filter((f) => f.id !== newForm.id),
  ];
  writeLocalForms(updatedLocal);

  return newForm;
}

export type CreateOrOpenShellAction =
  | 'created_new'
  | 'opened_existing'
  | 'restored_deleted';

export interface CreateOrOpenOvertimeShellResult {
  form: OvertimeFormWithItems;
  action: CreateOrOpenShellAction;
}

/**
 * Creates or opens an overtime form shell (`TC-YYYYMMDD`) for a selected date.
 * 1. If an active (`deleted_at is null`) form already exists for `overtimeDate` or `TC-YYYYMMDD`,
 *    does NOT create a duplicate — fetches and returns it with `action: 'opened_existing'`.
 * 2. If a soft-deleted (`deleted_at != null`) record with `form_code = TC-YYYYMMDD` exists,
 *    restores/resets it (`deleted_at = null`, clears old items, zeroes totals) with `action: 'restored_deleted'`.
 * 3. Otherwise inserts a brand-new empty shell row (`total_employees = 0`, `total_hours = 0`)
 *    with `action: 'created_new'`.
 */
export async function createOrOpenOvertimeShell(
  overtimeDate: string,
  options?: {
    department?: string;
    knownSubGroups?: string[];
    createdBy?: string | null;
  }
): Promise<CreateOrOpenOvertimeShellResult> {
  const client = getOvertimeSupabaseClient();
  const cleanDate = (overtimeDate || '').trim() || getLocalTodayIsoDate();
  const canonicalCode = generateOvertimeFormCode(cleanDate);
  const departmentLabel = resolveOvertimeMainDepartment(
    options?.department || DEFAULT_OVERTIME_DEPARTMENT,
    options?.knownSubGroups || []
  );
  const nowIso = new Date().toISOString();

  const upsertLocalShell = (shell: OvertimeFormWithItems) => {
    clearLocalUpdatedForm(shell.id);
    const localForms = readLocalForms(false).filter((f) => f.id !== shell.id);
    writeLocalForms([shell, ...localForms]);
  };

  const restoreDeletedRow = async (
    deletedRow: SupabaseOvertimeFormRow
  ): Promise<OvertimeFormWithItems> => {
    // Clear old items for the restored shell (hard-delete first, fallback to soft-delete)
    const hardDeleteItems = await client
      .from('overtime_form_items')
      .delete()
      .eq('form_id', deletedRow.id);

    if (hardDeleteItems.error) {
      await client
        .from('overtime_form_items')
        .update({ deleted_at: nowIso })
        .eq('form_id', deletedRow.id)
        .is('deleted_at', null);
    }

    const baseRestorePayload = {
      form_code: canonicalCode,
      department: departmentLabel,
      overtime_date: cleanDate,
      total_blocks: 0,
      total_employees: 0,
      total_hours: 0,
      status: 'Mới tạo',
      deleted_at: null,
      updated_at: nowIso,
    };

    let restoreRes = await client
      .from('overtime_forms')
      .update({ ...baseRestorePayload, is_locked: false })
      .eq('id', deletedRow.id)
      .select('*')
      .single();

    if (restoreRes.error && isUndefinedColumnError(restoreRes.error)) {
      restoreRes = await client
        .from('overtime_forms')
        .update(baseRestorePayload)
        .eq('id', deletedRow.id)
        .select('*')
        .single();
    }

    if (restoreRes.error) {
      const code = restoreRes.error.code;
      const isRls =
        code === '42501' ||
        restoreRes.error.message.toLowerCase().includes('row-level security');
      if (isRls) {
        throw new OvertimeSupabaseActionError(
          'Supabase RLS đang chặn khôi phục vỏ phiếu trên bảng overtime_forms (lỗi 42501). Vui lòng chạy mã SQL chuẩn hóa trên Supabase.',
          code,
          true
        );
      }
      throw restoreRes.error;
    }

    const hydrated = hydrateOvertimeFormRow(
      restoreRes.data as SupabaseOvertimeFormRow,
      []
    );
    upsertLocalShell(hydrated);
    return hydrated;
  };

  try {
    // 1. Check active (`deleted_at is null`) forms for this date or canonical code
    const activeRes = await client
      .from('overtime_forms')
      .select('*')
      .is('deleted_at', null)
      .or(`overtime_date.eq.${cleanDate},form_code.eq.${canonicalCode}`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeRes.error) {
      throw activeRes.error;
    }

    const existingActiveRow = (activeRes.data || [])[0] as
      | SupabaseOvertimeFormRow
      | undefined;

    if (existingActiveRow) {
      const fullForm =
        (await fetchOvertimeFormById(existingActiveRow.id)) ||
        hydrateOvertimeFormRow(existingActiveRow, []);
      upsertLocalShell(fullForm);
      return { form: fullForm, action: 'opened_existing' };
    }

    // 2. Check for soft-deleted record holding canonical `TC-YYYYMMDD`
    const deletedByCodeRes = await client
      .from('overtime_forms')
      .select('*')
      .eq('form_code', canonicalCode)
      .not('deleted_at', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!deletedByCodeRes.error && deletedByCodeRes.data?.length) {
      const restored = await restoreDeletedRow(
        deletedByCodeRes.data[0] as SupabaseOvertimeFormRow
      );
      return { form: restored, action: 'restored_deleted' };
    }

    // 3. Insert fresh empty shell (`TC-YYYYMMDD`)
    const formId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ot-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const insertRes = await client
      .from('overtime_forms')
      .insert({
        id: formId,
        form_code: canonicalCode,
        department: departmentLabel,
        overtime_date: cleanDate,
        total_blocks: 0,
        total_employees: 0,
        total_hours: 0,
        status: 'Mới tạo',
        created_by: options?.createdBy ?? null,
      })
      .select('*')
      .single();

    if (insertRes.error) {
      // Handle race condition or unique constraint collision on `form_code`
      if (insertRes.error.code === '23505') {
        const collisionRes = await client
          .from('overtime_forms')
          .select('*')
          .eq('form_code', canonicalCode)
          .limit(1);
        const collidedRow = (collisionRes.data || [])[0] as
          | SupabaseOvertimeFormRow
          | undefined;
        if (collidedRow) {
          if (collidedRow.deleted_at) {
            const restored = await restoreDeletedRow(collidedRow);
            return { form: restored, action: 'restored_deleted' };
          }
          const fullForm =
            (await fetchOvertimeFormById(collidedRow.id)) ||
            hydrateOvertimeFormRow(collidedRow, []);
          upsertLocalShell(fullForm);
          return { form: fullForm, action: 'opened_existing' };
        }
      }

      const code = insertRes.error.code;
      const isRls =
        code === '42501' ||
        insertRes.error.message.toLowerCase().includes('row-level security');
      if (isRls) {
        throw new OvertimeSupabaseActionError(
          'Supabase RLS đang chặn tạo vỏ phiếu mới trên bảng overtime_forms (lỗi 42501). Vui lòng chạy mã SQL chuẩn hóa trên Supabase.',
          code,
          true
        );
      }
      throw insertRes.error;
    }

    const created = hydrateOvertimeFormRow(
      insertRes.data as SupabaseOvertimeFormRow,
      []
    );
    upsertLocalShell(created);
    return { form: created, action: 'created_new' };
  } catch (err) {
    if (err instanceof OvertimeSupabaseActionError) {
      throw err;
    }

    // Offline / local fallback
    const localForms = readLocalForms(false);
    const localActive = localForms.find(
      (f) =>
        !f.deleted_at &&
        ((f.overtime_date || '').trim() === cleanDate ||
          formatOvertimeFormCodeDisplay(f.form_code) === canonicalCode)
    );
    if (localActive) {
      return { form: localActive, action: 'opened_existing' };
    }

    const fallbackId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ot-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localShell: OvertimeFormWithItems = {
      id: fallbackId,
      form_code: canonicalCode,
      department: departmentLabel,
      overtime_date: cleanDate,
      overtime_dates: [cleanDate],
      total_blocks: 0,
      total_participants: 0,
      total_hours: 0,
      status: 'Mới tạo',
      created_by: options?.createdBy ?? null,
      created_at: nowIso,
      updated_at: nowIso,
      deleted_at: null,
      items: [],
    };
    upsertLocalShell(localShell);
    return { form: localShell, action: 'created_new' };
  }
}

/**
 * Updates an existing overtime form header and replaces its active items in Supabase
 * (soft-deleting previous active items when `deleted_at` column is present).
 */
export async function updateOvertimeFormInHistory(
  existingForm: OvertimeFormWithItems,
  input: SaveOvertimeFormInput
): Promise<OvertimeFormWithItems> {
  if (isOvertimeFormLocked(existingForm)) {
    throw new OvertimeSupabaseActionError(
      'Phiếu tăng ca đã chốt, không thể chỉnh sửa hoặc lưu lại. Vui lòng thực hiện mở khóa khẩn cấp nếu cần cập nhật.',
      'FORM_LOCKED'
    );
  }

  const client = getOvertimeSupabaseClient();
  const updatedForm = buildUpdatedOvertimeForm(existingForm, input);
  const nowIso = updatedForm.updated_at || new Date().toISOString();

  let syncedToSupabase = false;
  try {
    // Kiểm tra lại trạng thái chốt mới nhất trên Supabase trước khi ghi đè
    const latestCheckRes = await client
      .from('overtime_forms')
      .select('*')
      .eq('id', existingForm.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (
      !latestCheckRes.error &&
      latestCheckRes.data &&
      isOvertimeFormLocked(latestCheckRes.data as SupabaseOvertimeFormRow)
    ) {
      throw new OvertimeSupabaseActionError(
        'Phiếu tăng ca đã được chốt trên hệ thống, không thể lưu thay đổi.',
        'FORM_LOCKED'
      );
    }

    const updateFormRes = await client
      .from('overtime_forms')
      .update({
        department: updatedForm.department,
        overtime_date: updatedForm.overtime_date,
        total_blocks: updatedForm.total_blocks,
        total_employees: updatedForm.total_participants,
        total_hours: updatedForm.total_hours,
        status: updatedForm.status,
        updated_at: nowIso,
      })
      .eq('id', existingForm.id)
      .is('deleted_at', null);

    if (updateFormRes.error) throw updateFormRes.error;

    const softDeleteItemsRes = await client
      .from('overtime_form_items')
      .update({ deleted_at: nowIso })
      .eq('form_id', existingForm.id)
      .is('deleted_at', null);

    if (softDeleteItemsRes.error) {
      if (isUndefinedColumnError(softDeleteItemsRes.error)) {
        const legacyDeleteRes = await client
          .from('overtime_form_items')
          .delete()
          .eq('form_id', existingForm.id);
        if (legacyDeleteRes.error) throw legacyDeleteRes.error;
      } else {
        throw softDeleteItemsRes.error;
      }
    }

    if (updatedForm.items.length > 0) {
      const insertedItemsRes = await client
        .from('overtime_form_items')
        .insert(
          updatedForm.items.map((item) => ({
            form_id: existingForm.id,
            overtime_date: item.overtime_date,
            block_order: item.block_order,
            item_order: item.item_order,
            block_id: item.block_id || `block-${item.block_order}`,
            employee_id: UUID_REGEX.test(item.employee_id)
              ? item.employee_id
              : null,
            employee_code: item.employee_code,
            full_name: item.employee_name,
            reason_vi: item.reason_vi,
            reason_kr: item.reason_kr,
            start_time: item.start_time,
            end_time: item.end_time,
          }))
        )
        .select('*');

      if (insertedItemsRes.error) throw insertedItemsRes.error;
      if (insertedItemsRes.data && insertedItemsRes.data.length > 0) {
        updatedForm.items = (
          insertedItemsRes.data as SupabaseOvertimeFormItemRow[]
        ).map(mapSupabaseItemRow);
      }
    }
    syncedToSupabase = true;
  } catch (err) {
    if (err instanceof OvertimeSupabaseActionError) {
      throw err;
    }
    // Graceful fallback: local override ensures edits persist across reloads
  }

  if (syncedToSupabase) {
    clearLocalUpdatedForm(existingForm.id);
  } else {
    saveLocalUpdatedForm(updatedForm);
  }

  const localForms = readLocalForms(false);
  const existsLocally = localForms.some((f) => f.id === updatedForm.id);
  const nextLocal = existsLocally
    ? localForms.map((f) => (f.id === updatedForm.id ? updatedForm : f))
    : [updatedForm, ...localForms];
  writeLocalForms(nextLocal);

  return updatedForm;
}

/**
 * Locks an overtime form ("Chốt phiếu"): sets `is_locked = true` and `status = 'Đã chốt'`
 * in Supabase (`overtime_forms`), gracefully falling back to `status = 'Đã chốt'` if `is_locked`
 * column has not yet been migrated.
 */
export async function lockOvertimeForm(
  formId: string
): Promise<OvertimeFormWithItems> {
  const cleanId = (formId || '').trim();
  if (!cleanId) {
    throw new OvertimeSupabaseActionError('Không xác định được phiếu cần chốt.');
  }

  const client = getOvertimeSupabaseClient();
  const nowIso = new Date().toISOString();

  let updateRes = await client
    .from('overtime_forms')
    .update({
      is_locked: true,
      status: 'Đã chốt',
      updated_at: nowIso,
    })
    .eq('id', cleanId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (updateRes.error && isUndefinedColumnError(updateRes.error)) {
    updateRes = await client
      .from('overtime_forms')
      .update({
        status: 'Đã chốt',
        updated_at: nowIso,
      })
      .eq('id', cleanId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
  }

  if (updateRes.error) {
    const code = updateRes.error.code;
    const isRls =
      code === '42501' ||
      updateRes.error.message.toLowerCase().includes('row-level security');
    throw new OvertimeSupabaseActionError(
      isRls
        ? 'Supabase RLS đang chặn thao tác chốt phiếu trên bảng overtime_forms (lỗi 42501). Vui lòng chạy mã SQL chuẩn hóa trên Supabase.'
        : `Không thể chốt phiếu trên Supabase: ${updateRes.error.message}`,
      code,
      isRls
    );
  }

  if (!updateRes.data) {
    const stillExists = await client
      .from('overtime_forms')
      .select('id')
      .eq('id', cleanId)
      .is('deleted_at', null)
      .maybeSingle();
    if (stillExists.data) {
      throw new OvertimeSupabaseActionError(
        'Supabase không cho phép cập nhật trạng thái chốt phiếu (RLS policy). Vui lòng chạy mã SQL chuẩn hóa trên Supabase.',
        '42501',
        true
      );
    }
    throw new OvertimeSupabaseActionError(
      'Phiếu tăng ca không còn tồn tại hoặc đã bị xóa.'
    );
  }

  const freshForm =
    (await fetchOvertimeFormById(cleanId)) ||
    hydrateOvertimeFormRow(updateRes.data as SupabaseOvertimeFormRow, []);
  const lockedForm: OvertimeFormWithItems = {
    ...freshForm,
    is_locked: true,
    status: 'Đã chốt',
  };

  clearLocalUpdatedForm(cleanId);
  const localForms = readLocalForms(false);
  const nextLocal = localForms.some((f) => f.id === cleanId)
    ? localForms.map((f) => (f.id === cleanId ? lockedForm : f))
    : [lockedForm, ...localForms];
  writeLocalForms(nextLocal);

  return lockedForm;
}

/**
 * Emergency unlock for a locked overtime form ("Mở khóa khẩn cấp"):
 * clears `is_locked = false` and restores status to `'Đã lưu'` (when form has items)
 * or `'Mới tạo'` (when empty).
 */
export async function unlockOvertimeForm(
  form: OvertimeFormWithItems
): Promise<OvertimeFormWithItems> {
  const cleanId = (form?.id || '').trim();
  if (!cleanId) {
    throw new OvertimeSupabaseActionError('Không xác định được phiếu cần mở khóa.');
  }

  const client = getOvertimeSupabaseClient();
  const nowIso = new Date().toISOString();
  const freshBefore = await fetchOvertimeFormById(cleanId);
  const activeItems = freshBefore?.items ?? form.items ?? [];
  const restoredStatus = activeItems.length > 0 ? 'Đã lưu' : 'Mới tạo';

  let updateRes = await client
    .from('overtime_forms')
    .update({
      is_locked: false,
      status: restoredStatus,
      updated_at: nowIso,
    })
    .eq('id', cleanId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (updateRes.error && isUndefinedColumnError(updateRes.error)) {
    updateRes = await client
      .from('overtime_forms')
      .update({
        status: restoredStatus,
        updated_at: nowIso,
      })
      .eq('id', cleanId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
  }

  if (updateRes.error) {
    const code = updateRes.error.code;
    const isRls =
      code === '42501' ||
      updateRes.error.message.toLowerCase().includes('row-level security');
    throw new OvertimeSupabaseActionError(
      isRls
        ? 'Supabase RLS đang chặn mở khóa phiếu trên bảng overtime_forms (lỗi 42501). Vui lòng chạy mã SQL chuẩn hóa trên Supabase.'
        : `Không thể mở khóa phiếu trên Supabase: ${updateRes.error.message}`,
      code,
      isRls
    );
  }

  if (!updateRes.data) {
    const stillExists = await client
      .from('overtime_forms')
      .select('id')
      .eq('id', cleanId)
      .is('deleted_at', null)
      .maybeSingle();
    if (stillExists.data) {
      throw new OvertimeSupabaseActionError(
        'Supabase không cho phép mở khóa phiếu (RLS policy). Vui lòng chạy mã SQL chuẩn hóa trên Supabase.',
        '42501',
        true
      );
    }
    throw new OvertimeSupabaseActionError(
      'Phiếu tăng ca không còn tồn tại hoặc đã bị xóa.'
    );
  }

  const hydrated = hydrateOvertimeFormRow(
    {
      ...(updateRes.data as SupabaseOvertimeFormRow),
      is_locked: false,
      status: restoredStatus,
    },
    activeItems
  );

  clearLocalUpdatedForm(cleanId);
  const localForms = readLocalForms(false);
  const nextLocal = localForms.some((f) => f.id === cleanId)
    ? localForms.map((f) => (f.id === cleanId ? hydrated : f))
    : [hydrated, ...localForms];
  writeLocalForms(nextLocal);

  return hydrated;
}

export interface SoftDeleteOvertimeResult {
  deletedIds: string[];
  deletedAt: string;
  itemsSchemaMissing: boolean;
}

/**
 * Soft-deletes one or multiple overtime forms by setting `deleted_at = new Date().toISOString()`
 * on BOTH `overtime_forms` and related `overtime_form_items` rows (never hard-deleting).
 * Rejects soft-deletion of locked ("Đã chốt") forms.
 * Throws `OvertimeSupabaseActionError` if Supabase RLS/permissions reject the update so
 * callers never hide unsaved deletions only in local state.
 */
export async function softDeleteOvertimeForms(
  formIds: string[]
): Promise<SoftDeleteOvertimeResult> {
  const cleanIds = Array.from(
    new Set((formIds || []).map((id) => (id || '').trim()).filter(Boolean))
  );
  const deletedAt = new Date().toISOString();

  if (cleanIds.length === 0) {
    return { deletedIds: [], deletedAt, itemsSchemaMissing: false };
  }

  const client = getOvertimeSupabaseClient();
  let itemsSchemaMissing = false;

  // 0. Chặn xóa phiếu đã chốt trên Supabase
  const lockCheckRes = await client
    .from('overtime_forms')
    .select('*')
    .in('id', cleanIds)
    .is('deleted_at', null);

  if (!lockCheckRes.error && Array.isArray(lockCheckRes.data)) {
    const lockedTargets = (lockCheckRes.data as SupabaseOvertimeFormRow[]).filter(
      (row) => isOvertimeFormLocked(row)
    );
    if (lockedTargets.length > 0) {
      throw new OvertimeSupabaseActionError(
        'Phiếu tăng ca đã chốt nên không thể xóa. Vui lòng thực hiện mở khóa khẩn cấp trước nếu cần xóa.',
        'FORM_LOCKED'
      );
    }
  }

  // 1. Soft-delete child records in overtime_form_items first
  const itemsUpdateRes = await client
    .from('overtime_form_items')
    .update({ deleted_at: deletedAt })
    .in('form_id', cleanIds)
    .is('deleted_at', null);

  if (itemsUpdateRes.error) {
    if (isUndefinedColumnError(itemsUpdateRes.error)) {
      itemsSchemaMissing = true;
    } else {
      const code = itemsUpdateRes.error.code;
      const isRls =
        code === '42501' ||
        itemsUpdateRes.error.message.toLowerCase().includes('row-level security');
      throw new OvertimeSupabaseActionError(
        isRls
          ? 'Supabase RLS đang chặn cập nhật deleted_at trên bảng overtime_form_items. Vui lòng chạy mã SQL chuẩn hóa trên Supabase.'
          : `Không thể xóa mềm chi tiết phiếu trên Supabase: ${itemsUpdateRes.error.message}`,
        code,
        isRls
      );
    }
  }

  // 2. Soft-delete parent records in overtime_forms
  const formsUpdateRes = await client
    .from('overtime_forms')
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .in('id', cleanIds)
    .is('deleted_at', null)
    .select('id, deleted_at');

  if (formsUpdateRes.error) {
    const code = formsUpdateRes.error.code;
    const isRls =
      code === '42501' ||
      formsUpdateRes.error.message.toLowerCase().includes('row-level security');
    throw new OvertimeSupabaseActionError(
      isRls
        ? 'Supabase RLS đang chặn cập nhật deleted_at trên bảng overtime_forms (lỗi 42501). Vui lòng chạy mã SQL chuẩn hóa quyền UPDATE/Realtime trên Supabase.'
        : `Không thể xóa mềm phiếu trên Supabase: ${formsUpdateRes.error.message}`,
      code,
      isRls
    );
  }

  const updatedRows = (formsUpdateRes.data || []) as Array<{
    id: string;
    deleted_at: string | null;
  }>;
  if (updatedRows.length === 0) {
    // Verify whether rows are still active in Supabase (meaning RLS silently blocked update)
    const remainingRes = await client
      .from('overtime_forms')
      .select('id')
      .in('id', cleanIds)
      .is('deleted_at', null);
    if (!remainingRes.error && (remainingRes.data || []).length > 0) {
      throw new OvertimeSupabaseActionError(
        'Supabase không cho phép cập nhật deleted_at trên overtime_forms (RLS policy). Vui lòng chạy mã SQL chuẩn hóa trên Supabase.',
        '42501',
        true
      );
    }
  }

  for (const id of cleanIds) {
    clearLocalUpdatedForm(id);
  }
  const cleanSet = new Set(cleanIds);
  const localForms = readLocalForms(false).filter((form) => !cleanSet.has(form.id));
  writeLocalForms(localForms);

  return {
    deletedIds: cleanIds,
    deletedAt,
    itemsSchemaMissing,
  };
}

/**
 * Convenience wrapper to soft-delete a single overtime form (`overtime_forms` + `overtime_form_items`).
 */
export async function softDeleteOvertimeForm(
  formId: string
): Promise<SoftDeleteOvertimeResult> {
  return softDeleteOvertimeForms([formId]);
}

export interface OvertimeRealtimeChangeEvent {
  table: 'overtime_forms' | 'overtime_form_items';
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>;
}

/**
 * Subscribes to Supabase Realtime `postgres_changes` (INSERT, UPDATE, DELETE)
 * on both `overtime_forms` and `overtime_form_items` so all connected users/tabs
 * automatically sync whenever a form is created, updated, or soft-deleted.
 */
export function subscribeToOvertimeRealtime(
  onChange: (event: OvertimeRealtimeChangeEvent) => void,
  onStatusChange?: (status: string) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const client = getOvertimeSupabaseClient();
  const channelName = `overtime-realtime-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'overtime_forms' },
      (payload) => onChange({ table: 'overtime_forms', eventType: 'INSERT', payload })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'overtime_forms' },
      (payload) => onChange({ table: 'overtime_forms', eventType: 'UPDATE', payload })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'overtime_forms' },
      (payload) => onChange({ table: 'overtime_forms', eventType: 'DELETE', payload })
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'overtime_form_items' },
      (payload) =>
        onChange({ table: 'overtime_form_items', eventType: 'INSERT', payload })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'overtime_form_items' },
      (payload) =>
        onChange({ table: 'overtime_form_items', eventType: 'UPDATE', payload })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'overtime_form_items' },
      (payload) =>
        onChange({ table: 'overtime_form_items', eventType: 'DELETE', payload })
    )
    .subscribe((status) => {
      onStatusChange?.(status);
    });

  return () => {
    void client.removeChannel(channel);
  };
}

export interface OvertimeLeaveCheckEntry extends LeaveRecord {
  employeeCode?: string;
  deletedAt?: string | null;
  isDeleted?: boolean;
}

function normalizeIsoDateOnly(value?: string | null): string {
  const clean = (value || '').trim();
  if (!clean) return '';
  const match = clean.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : clean.slice(0, 10);
}

const OVERTIME_LEAVE_TYPE_LABELS: Record<LeaveRecordType, string> = {
  annual_leave: 'Nghỉ Phép năm',
  unpaid_leave: 'Nghỉ Không lương',
  regime_leave: 'Nghỉ Chế độ',
  late_early: 'Đi muộn / Về sớm',
};

/**
 * Pure helper: returns a concise Vietnamese label for a leave record type.
 */
export function getLeaveTypeShortLabel(
  record: Pick<OvertimeLeaveCheckEntry, 'type' | 'regimeSubtype'>
): string {
  const baseLabel = OVERTIME_LEAVE_TYPE_LABELS[record.type] || 'Đang nghỉ';
  if (record.type === 'regime_leave' && record.regimeSubtype) {
    return `${baseLabel} (${record.regimeSubtype})`;
  }
  return baseLabel;
}

/**
 * Pure helper: returns true when an active (non-deleted), non-late/early leave record
 * covers `workDate` (`startDate <= workDate <= endDate`, using `startDate` when `endDate` is missing).
 */
export function isLeaveRecordCoveringDate(
  record: Pick<
    OvertimeLeaveCheckEntry,
    'type' | 'startDate' | 'endDate' | 'deletedAt' | 'isDeleted'
  >,
  workDate: string
): boolean {
  const targetDate = normalizeIsoDateOnly(workDate);
  if (!targetDate || !record) return false;
  if (record.deletedAt || record.isDeleted) return false;
  if (record.type === 'late_early') return false;

  const startDate = normalizeIsoDateOnly(record.startDate);
  if (!startDate) return false;
  const rawEndDate = normalizeIsoDateOnly(record.endDate);
  const endDate = rawEndDate && rawEndDate >= startDate ? rawEndDate : startDate;

  return targetDate >= startDate && targetDate <= endDate;
}

/**
 * Pure helper: builds a map of `employee.id -> OvertimeLeaveCheckEntry` for all employees
 * who have an active leave record covering `workDate`.
 * Matches employees by either `employee_id` or normalized `employee_code`.
 */
export function buildOnLeaveEmployeeMapForDate(
  workDate: string,
  leaveRecords: OvertimeLeaveCheckEntry[],
  employees: Employee[]
): Map<string, OvertimeLeaveCheckEntry> {
  const result = new Map<string, OvertimeLeaveCheckEntry>();
  const targetDate = normalizeIsoDateOnly(workDate);
  if (!targetDate || !Array.isArray(leaveRecords) || !Array.isArray(employees)) {
    return result;
  }

  const empById = new Map<string, Employee>();
  const employeesByCode = new Map<string, Employee[]>();
  for (const emp of employees) {
    if (!emp?.id) continue;
    empById.set(emp.id, emp);
    const codeKey = (emp.employeeCode || '').trim().toUpperCase();
    if (codeKey) {
      const list = employeesByCode.get(codeKey) || [];
      list.push(emp);
      employeesByCode.set(codeKey, list);
    }
  }

  for (const rec of leaveRecords) {
    if (!isLeaveRecordCoveringDate(rec, targetDate)) continue;

    const matchedIds = new Set<string>();
    const recEmpId = (rec.employeeId || '').trim();
    if (recEmpId && empById.has(recEmpId)) {
      matchedIds.add(recEmpId);
      const matchedCode = (empById.get(recEmpId)?.employeeCode || '')
        .trim()
        .toUpperCase();
      if (matchedCode && employeesByCode.has(matchedCode)) {
        for (const sameCodeEmp of employeesByCode.get(matchedCode)!) {
          matchedIds.add(sameCodeEmp.id);
        }
      }
    }

    const recCode = (rec.employeeCode || '').trim().toUpperCase();
    if (recCode && employeesByCode.has(recCode)) {
      for (const sameCodeEmp of employeesByCode.get(recCode)!) {
        matchedIds.add(sameCodeEmp.id);
      }
    }

    for (const empId of matchedIds) {
      if (!result.has(empId)) {
        result.set(empId, rec);
      }
    }
  }

  return result;
}

interface SupabaseLeaveLogQueryRow extends SupabaseLeaveLogRow {
  employee_code?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean | null;
}

/**
 * Fetches all active (`deleted_at is null` and `is_deleted !== true`) leave records
 * directly from Supabase `leave_logs` for cross-checking against overtime scheduling.
 * Gracefully falls back when `deleted_at` column is absent on legacy schemas.
 */
export async function fetchActiveLeaveRecordsForOvertimeCheck(
  employees: Employee[] = []
): Promise<{
  records: OvertimeLeaveCheckEntry[];
  source: 'supabase' | 'error';
}> {
  const client = getOvertimeSupabaseClient();
  const empMap = new Map<string, Employee>(
    (employees || []).map((e) => [e.id, e])
  );

  try {
    let queryRes = await client
      .from('leave_logs')
      .select('*')
      .is('deleted_at', null);

    if (queryRes.error && isUndefinedColumnError(queryRes.error)) {
      queryRes = await client.from('leave_logs').select('*');
    }

    if (queryRes.error) {
      throw queryRes.error;
    }

    const rawRows = (queryRes.data || []) as SupabaseLeaveLogQueryRow[];
    const activeRows = rawRows.filter(
      (row) => !row.deleted_at && row.is_deleted !== true
    );

    const records: OvertimeLeaveCheckEntry[] = activeRows.map((row) => {
      const mapped = mapSupabaseRowToLeaveRecord(row, empMap);
      const emp = empMap.get(mapped.employeeId);
      return {
        ...mapped,
        employeeCode: row.employee_code || emp?.employeeCode || undefined,
        deletedAt: row.deleted_at ?? null,
        isDeleted: Boolean(row.is_deleted),
      };
    });

    return { records, source: 'supabase' };
  } catch {
    return { records: [], source: 'error' };
  }
}

/**
 * Subscribes to Supabase Realtime changes on `leave_logs` so overtime editors
 * immediately reflect newly created or deleted leave requests.
 */
export function subscribeToLeaveLogsRealtime(onChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const client = getOvertimeSupabaseClient();
  const channelName = `overtime-leave-logs-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leave_logs' },
      () => onChange()
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

