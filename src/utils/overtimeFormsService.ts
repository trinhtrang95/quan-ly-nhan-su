import { Employee } from '../types/hr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseService';

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

export interface SaveOvertimeFormInput {
  department: string;
  overtimeDate: string;
  blocks: OvertimeBlockInput[];
  employees: Employee[];
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
}

export const OVERTIME_FORMS_STORAGE_KEY = 'hr_pro_overtime_forms_v1';
export const OVERTIME_FORMS_DELETED_KEY = 'hr_pro_overtime_forms_deleted_v1';
export const OVERTIME_FORMS_UPDATED_KEY = 'hr_pro_overtime_forms_updated_v1';

/**
 * Safe Supabase REST client wrapper for the Overtime module.
 * Reuses the app's configured SUPABASE_URL & SUPABASE_ANON_KEY (from env vars or defaults)
 * without requiring external SDK packages that could fail Vite bundling.
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
 * Pure helper: generates the canonical overtime form code `TC-YYYYMMDD`
 * (strictly 1 active form per calendar day, no -001/-002 sequence suffix).
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
 * Pure helper: formats a stored form code for display as `TC-YYYYMMDD`,
 * stripping any legacy `-001`, `-002` numeric sequence suffix.
 */
export function formatOvertimeFormCodeDisplay(formCode: string): string {
  const clean = (formCode || '').trim();
  if (!clean) return '';
  const match = clean.match(/^(TC-\d{8})(?:-\d+)?$/i);
  if (match) return match[1].toUpperCase();
  return clean;
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
      const totalHours = calculateHoursBetween(startTime, endTime);

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
    });
  }

  return orderedKeys.map((k) => blockMap.get(k)!);
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
        department: fallbackDepartment || 'Kỹ Thuật',
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
 * Pure helper: filters overtime form records by search query (form code or department)
 * and overtime date, always excluding soft-deleted records.
 */
export function filterOvertimeForms(
  forms: OvertimeFormWithItems[],
  searchQuery: string,
  dateFilter: string
): OvertimeFormWithItems[] {
  const normalizedQuery = normalizeSearchText(searchQuery);
  const cleanDate = (dateFilter || '').trim();

  return forms.filter((form) => {
    if (form.deleted_at) return false;

    if (cleanDate) {
      const dates =
        Array.isArray(form.overtime_dates) && form.overtime_dates.length > 0
          ? form.overtime_dates
          : [form.overtime_date];
      if (form.overtime_date !== cleanDate && !dates.includes(cleanDate)) {
        return false;
      }
    }

    if (normalizedQuery) {
      const codeNorm = normalizeSearchText(form.form_code);
      const deptNorm = normalizeSearchText(form.department);
      if (
        !codeNorm.includes(normalizedQuery) &&
        !deptNorm.includes(normalizedQuery)
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
  return {
    id: row.id,
    form_id: row.form_id,
    overtime_date: row.overtime_date || '',
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
    total_hours: calculateHoursBetween(startTime, endTime),
    deleted_at: null,
  };
}

function createSampleOvertimeForms(): OvertimeFormWithItems[] {
  const form1Id = 'sample-ot-form-001';
  const form2Id = 'sample-ot-form-002';

  return [
    {
      id: form1Id,
      form_code: 'TC-20261116',
      department: 'Kỹ Thuật',
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

/**
 * Pure helper: resolves a clean department display name from selection or employees.
 */
export function resolveDepartmentLabel(
  department: string,
  blocks: OvertimeBlockInput[],
  employees: Employee[]
): string {
  if (department && department !== 'ALL' && department.trim()) {
    return department.trim();
  }
  const empById = new Map(employees.map((e) => [e.id, e]));
  const matchedDepts = new Set<string>();
  for (const block of blocks) {
    const ids =
      block.participants?.length > 0
        ? block.participants.map((p) => p.employeeId)
        : block.selectedEmployeeIds;
    for (const id of ids) {
      const dept = empById.get(id)?.department?.trim();
      if (dept) matchedDepts.add(dept);
    }
  }
  return matchedDepts.size === 1 ? Array.from(matchedDepts)[0] : 'Kỹ Thuật';
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
  fallbackDate?: string;
  todayIso?: string;
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
 * Pure helper: evaluates duplicate overtime dates globally across ALL active forms
 * (1 calendar day can only have 1 active form in the system, regardless of department).
 * - Excludes soft-deleted forms (`deleted_at != null`) and the currently edited form (`editingFormId`).
 * - Case A (`uniqueDates.length === 1` with conflict): BLOCKS save (`isBlocked: true`).
 * - Case B (`uniqueDates.length >= 2`):
 *   + Representative date becomes today (`todayIso`).
 *   + If an active form already exists with representative date === `todayIso`: BLOCKS save
 *     (`representative_date_blocked`, `isBlocked: true`) so 1 day never has 2 forms.
 *   + Otherwise, if any included work date overlaps an earlier form: ALLOWS save
 *     (`multi_day_reminder`, `isBlocked: false`) with soft reminder.
 */
export function evaluateOvertimeDateConflict({
  blocks,
  selectedDepartment,
  employees,
  existingForms,
  editingFormId = null,
  fallbackDate,
  todayIso,
}: EvaluateOvertimeDateConflictParams): OvertimeDateConflictEvaluation {
  const uniqueDates = extractUniqueBlockDates(blocks);
  const representativeDate = resolveRepresentativeOvertimeDate(
    blocks,
    fallbackDate,
    todayIso
  );
  const resolvedDepartment = resolveDepartmentLabel(
    selectedDepartment,
    blocks,
    employees
  );

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

  const activeForms = (existingForms || []).filter((form) => {
    if (!form || form.deleted_at) return false;
    if (editingFormId && form.id === editingFormId) return false;
    return true;
  });

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

  // Case A: Single-day form -> block if that date already exists in ANY active form
  if (uniqueDates.length === 1) {
    if (conflicts.length > 0) {
      return {
        mode: 'single_day_blocked',
        isBlocked: true,
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

  // Case B: Multi-day form (>= 2 unique dates) -> representativeDate is today.
  // Block if today's representative form code / date already exists as an active form.
  const repCode = generateOvertimeFormCode(representativeDate);
  const repDateForms = activeForms.filter(
    (form) =>
      (form.overtime_date || '').trim() === representativeDate ||
      formatOvertimeFormCodeDisplay(form.form_code) === repCode
  );
  if (repDateForms.length > 0) {
    return {
      mode: 'representative_date_blocked',
      isBlocked: true,
      uniqueDates,
      representativeDate,
      resolvedDepartment,
      conflicts: [
        {
          date: representativeDate,
          forms: repDateForms.map((f) => ({
            id: f.id,
            form_code: formatOvertimeFormCodeDisplay(f.form_code),
            department: f.department,
            overtime_date: f.overtime_date,
          })),
        },
      ],
      conflictingForms: repDateForms,
    };
  }

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
 * Pure helper: produces an updated OvertimeFormWithItems preserving id, form_code, and created_at.
 */
export function buildUpdatedOvertimeForm(
  existingForm: OvertimeFormWithItems,
  input: SaveOvertimeFormInput,
  todayIso?: string
): OvertimeFormWithItems {
  const fallbackDate =
    input.blocks[0]?.overtimeDate ||
    input.overtimeDate ||
    existingForm.overtime_date ||
    getLocalTodayIsoDate();
  const uniqueDates = extractUniqueBlockDates(input.blocks);
  const representativeDate = resolveRepresentativeOvertimeDate(
    input.blocks,
    fallbackDate,
    todayIso
  );
  const departmentLabel = resolveDepartmentLabel(
    input.department,
    input.blocks,
    input.employees
  );
  const items = buildOvertimeFormItemsFromBlocks(
    existingForm.id,
    input.blocks,
    input.employees,
    fallbackDate
  );
  const totalHours = Number(
    items.reduce((sum, item) => sum + item.total_hours, 0).toFixed(2)
  );
  const nowIso = new Date().toISOString();

  return {
    ...existingForm,
    department: departmentLabel,
    overtime_date: representativeDate,
    overtime_dates: uniqueDates.length > 0 ? uniqueDates : [representativeDate],
    total_blocks: input.blocks.length,
    total_participants: items.length,
    total_hours: totalHours,
    updated_at: nowIso,
    items,
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetches all non-deleted overtime forms with their grouped line items.
 * Queries live Supabase `overtime_forms` + `overtime_form_items` first and
 * seamlessly falls back to localStorage + sample data on network/schema error.
 */
export async function fetchOvertimeForms(): Promise<{
  forms: OvertimeFormWithItems[];
  source: 'supabase' | 'local';
}> {
  try {
    const [formsRows, itemRows] = await Promise.all([
      overtimeSupabase.request<SupabaseOvertimeFormRow[]>(
        'overtime_forms?select=*&deleted_at=is.null&order=created_at.desc'
      ),
      overtimeSupabase.request<SupabaseOvertimeFormItemRow[]>(
        'overtime_form_items?select=*&order=block_order.asc,item_order.asc'
      ),
    ]);

    const itemsByForm = new Map<string, OvertimeFormItemRecord[]>();
    for (const rawItem of itemRows || []) {
      const mapped = mapSupabaseItemRow(rawItem);
      if (!itemsByForm.has(mapped.form_id)) {
        itemsByForm.set(mapped.form_id, []);
      }
      itemsByForm.get(mapped.form_id)!.push(mapped);
    }

    const deletedIds = readDeletedIds();
    const updatedMap = readLocalUpdatedMap();
    const hydrated: OvertimeFormWithItems[] = (formsRows || [])
      .filter((f) => !f.deleted_at && !deletedIds.has(f.id))
      .map((f) => {
        if (updatedMap[f.id]) {
          return updatedMap[f.id];
        }
        const formItems = itemsByForm.get(f.id) || [];
        const derivedDates = Array.from(
          new Set(formItems.map((i) => i.overtime_date).filter(Boolean))
        );
        const computedHours = Number(
          formItems.reduce((acc, item) => acc + item.total_hours, 0).toFixed(2)
        );
        return {
          id: f.id,
          form_code: f.form_code,
          department: f.department || 'Kỹ Thuật',
          overtime_date: f.overtime_date || derivedDates[0] || '',
          overtime_dates:
            derivedDates.length > 0
              ? derivedDates
              : f.overtime_date
                ? [f.overtime_date]
                : [],
          total_blocks: Number(f.total_blocks ?? 0),
          total_participants: Number(f.total_employees ?? formItems.length),
          total_hours: Number(f.total_hours ?? computedHours),
          status: f.status || 'Đã lưu',
          created_by: f.created_by ?? null,
          created_at: f.created_at,
          updated_at: f.updated_at ?? null,
          deleted_at: f.deleted_at,
          items: formItems,
        };
      });

    writeLocalForms(hydrated);
    return { forms: hydrated, source: 'supabase' };
  } catch {
    const deletedIds = readDeletedIds();
    const localForms = readLocalForms(true)
      .filter((f) => !f.deleted_at && !deletedIds.has(f.id))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return { forms: localForms, source: 'local' };
  }
}

/**
 * Saves an overtime form header (`overtime_forms`) and its line items (`overtime_form_items`).
 * Matches the live Supabase schema and mirrors locally for offline resilience.
 */
export async function saveOvertimeFormToHistory(
  input: SaveOvertimeFormInput
): Promise<OvertimeFormWithItems> {
  const existingLocal = readLocalForms(false);
  const fallbackDate =
    input.blocks[0]?.overtimeDate || input.overtimeDate || getLocalTodayIsoDate();
  const uniqueDates = extractUniqueBlockDates(input.blocks);
  const representativeDate = resolveRepresentativeOvertimeDate(
    input.blocks,
    fallbackDate
  );
  const departmentLabel = resolveDepartmentLabel(
    input.department,
    input.blocks,
    input.employees
  );

  const formId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ot-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const formCode = generateOvertimeFormCode(representativeDate);

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
    // Free canonical form_code if held by a previously soft-deleted row in Supabase
    try {
      await overtimeSupabase.request<void>(
        `overtime_forms?form_code=eq.${encodeURIComponent(
          newForm.form_code
        )}&deleted_at=not.is.null`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            form_code: `${newForm.form_code}-DEL-${Date.now()}`,
          }),
        }
      );
    } catch {
      // Non-fatal: proceed to insert
    }

    const insertedForms = await overtimeSupabase.request<
      SupabaseOvertimeFormRow[]
    >('overtime_forms?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: newForm.id,
        form_code: newForm.form_code,
        department: newForm.department,
        overtime_date: newForm.overtime_date,
        total_blocks: newForm.total_blocks,
        total_employees: newForm.total_participants,
        total_hours: newForm.total_hours,
        status: newForm.status,
        created_by: newForm.created_by,
      }),
    });

    const persistedFormId = insertedForms?.[0]?.id || newForm.id;
    newForm.id = persistedFormId;
    if (insertedForms?.[0]?.created_at) {
      newForm.created_at = insertedForms[0].created_at;
    }

    if (items.length > 0) {
      const insertedItems = await overtimeSupabase.request<
        SupabaseOvertimeFormItemRow[]
      >('overtime_form_items?select=*', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(
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
        ),
      });

      if (insertedItems && insertedItems.length > 0) {
        newForm.items = insertedItems.map(mapSupabaseItemRow);
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

/**
 * Updates an existing overtime form header and replaces its items in Supabase,
 * with durable local cache synchronization if offline or RLS-restricted.
 */
export async function updateOvertimeFormInHistory(
  existingForm: OvertimeFormWithItems,
  input: SaveOvertimeFormInput
): Promise<OvertimeFormWithItems> {
  const updatedForm = buildUpdatedOvertimeForm(existingForm, input);

  let syncedToSupabase = false;
  try {
    await overtimeSupabase.request<void>(
      `overtime_forms?id=eq.${encodeURIComponent(existingForm.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          department: updatedForm.department,
          overtime_date: updatedForm.overtime_date,
          total_blocks: updatedForm.total_blocks,
          total_employees: updatedForm.total_participants,
          total_hours: updatedForm.total_hours,
          updated_at: updatedForm.updated_at || new Date().toISOString(),
        }),
      }
    );

    await overtimeSupabase.request<void>(
      `overtime_form_items?form_id=eq.${encodeURIComponent(existingForm.id)}`,
      {
        method: 'DELETE',
      }
    );

    if (updatedForm.items.length > 0) {
      const insertedItems = await overtimeSupabase.request<
        SupabaseOvertimeFormItemRow[]
      >('overtime_form_items?select=*', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(
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
        ),
      });

      if (insertedItems && insertedItems.length > 0) {
        updatedForm.items = insertedItems.map(mapSupabaseItemRow);
      }
    }
    syncedToSupabase = true;
  } catch {
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
 * Soft-deletes an overtime form by setting `deleted_at = NOW()` on `overtime_forms`,
 * plus updating local cache so offline environments stay consistent.
 */
export async function softDeleteOvertimeForm(formId: string): Promise<void> {
  const deletedAt = new Date().toISOString();

  try {
    await overtimeSupabase.request<void>(
      `overtime_forms?id=eq.${encodeURIComponent(formId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ deleted_at: deletedAt }),
      }
    );
  } catch {
    // Fallback cleanly to local soft delete
  }

  markIdDeletedLocally(formId);
  clearLocalUpdatedForm(formId);
  const localForms = readLocalForms(false).map((form) =>
    form.id === formId
      ? {
          ...form,
          deleted_at: deletedAt,
          items: form.items.map((item) => ({ ...item, deleted_at: deletedAt })),
        }
      : form
  );
  writeLocalForms(localForms);
}
