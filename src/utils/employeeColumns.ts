import { Employee } from '../types/hr';
import { EmployeeSortField, formatDateVN } from './hrCalculations';
import { formatCommuneProvinceAddress } from './vnAddressData';

export type EmployeeColumnId =
  // CÔNG VIỆC
  | 'department'
  | 'position'
  | 'jobTitle'
  | 'joinDate'
  | 'attendanceCode'
  | 'laborType'
  | 'contractType'
  | 'status'
  | 'resignDate'
  | 'resignReason'
  // CÁ NHÂN
  | 'gender'
  | 'dob'
  | 'age'
  | 'cccd'
  | 'cccdDate'
  | 'ethnicity'
  | 'hometown'
  | 'address'
  | 'education'
  | 'maritalStatus'
  // LIÊN HỆ
  | 'phone'
  | 'companyEmail'
  // GIA ĐÌNH, NGƯỜI THÂN
  | 'dependentsCount'
  | 'childrenUnder6Count'
  | 'emergencyContactName'
  | 'emergencyContactRelation'
  | 'emergencyContactPhone'
  // BẢO HIỂM, NGÂN HÀNG
  | 'bhxhNumber'
  | 'bankName'
  | 'bankAccount'
  // THEO DÕI
  | 'dossierStatus'
  | 'dossierArchive'
  | 'employeeAccount'
  | 'pendingTasks';

export type ColumnGroupKey =
  | 'WORK'
  | 'PERSONAL'
  | 'CONTACT'
  | 'FAMILY'
  | 'INSURANCE_BANK'
  | 'TRACKING';

export interface EmployeeColumnDef {
  id: EmployeeColumnId;
  label: string;
  tableHeaderLabel: string;
  group: ColumnGroupKey;
  sortField?: EmployeeSortField;
  align?: 'left' | 'center' | 'right';
  /** Whether this column contains longer text and can expand to fill horizontal table space */
  isExpandable?: boolean;
  minWidthClass?: string;
}

export interface EmployeeColumnGroupDef {
  key: ColumnGroupKey;
  title: string;
  columns: EmployeeColumnDef[];
}

export const DEFAULT_VISIBLE_EMPLOYEE_COLUMNS: EmployeeColumnId[] = [
  'department',
  'position',
  'address',
  'joinDate',
  'status',
];

export const ALL_EMPLOYEE_COLUMNS: EmployeeColumnDef[] = [
  // 1. CÔNG VIỆC
  {
    id: 'department',
    label: 'Phòng ban',
    tableHeaderLabel: 'Nhóm / Bộ phận',
    group: 'WORK',
    sortField: 'department',
    align: 'left',
    isExpandable: true,
    minWidthClass: 'min-w-[130px]',
  },
  {
    id: 'position',
    label: 'Chức vụ',
    tableHeaderLabel: 'Chức vụ',
    group: 'WORK',
    sortField: 'position',
    align: 'left',
    isExpandable: false,
    minWidthClass: 'min-w-[115px]',
  },
  {
    id: 'jobTitle',
    label: 'Chức danh',
    tableHeaderLabel: 'Chức danh',
    group: 'WORK',
    sortField: 'position',
    align: 'left',
    isExpandable: true,
    minWidthClass: 'min-w-[120px]',
  },
  {
    id: 'joinDate',
    label: 'Ngày vào làm, thâm niên',
    tableHeaderLabel: 'Ngày vào',
    group: 'WORK',
    sortField: 'joinDate',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[110px]',
  },
  {
    id: 'attendanceCode',
    label: 'Mã chấm công',
    tableHeaderLabel: 'Mã chấm công',
    group: 'WORK',
    sortField: 'employeeCode',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[105px]',
  },
  {
    id: 'laborType',
    label: 'Loại lao động',
    tableHeaderLabel: 'Loại lao động',
    group: 'WORK',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[115px]',
  },
  {
    id: 'contractType',
    label: 'Hợp đồng hiện tại',
    tableHeaderLabel: 'Hợp đồng hiện tại',
    group: 'WORK',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[130px]',
  },
  {
    id: 'status',
    label: 'Trạng thái',
    tableHeaderLabel: 'Trạng thái',
    group: 'WORK',
    sortField: 'status',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[120px]',
  },
  {
    id: 'resignDate',
    label: 'Ngày nghỉ việc',
    tableHeaderLabel: 'Ngày nghỉ việc',
    group: 'WORK',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[110px]',
  },
  {
    id: 'resignReason',
    label: 'Lý do nghỉ việc',
    tableHeaderLabel: 'Lý do nghỉ việc',
    group: 'WORK',
    align: 'left',
    isExpandable: true,
    minWidthClass: 'min-w-[140px]',
  },

  // 2. CÁ NHÂN
  {
    id: 'gender',
    label: 'Giới tính',
    tableHeaderLabel: 'Giới tính',
    group: 'PERSONAL',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[85px]',
  },
  {
    id: 'dob',
    label: 'Ngày sinh',
    tableHeaderLabel: 'Ngày sinh',
    group: 'PERSONAL',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[100px]',
  },
  {
    id: 'age',
    label: 'Tuổi',
    tableHeaderLabel: 'Tuổi',
    group: 'PERSONAL',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[70px]',
  },
  {
    id: 'cccd',
    label: 'Số CCCD / MST',
    tableHeaderLabel: 'Số CCCD / MST',
    group: 'PERSONAL',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[125px]',
  },
  {
    id: 'cccdDate',
    label: 'Ngày cấp CCCD',
    tableHeaderLabel: 'Ngày cấp CCCD',
    group: 'PERSONAL',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[115px]',
  },
  {
    id: 'ethnicity',
    label: 'Dân tộc',
    tableHeaderLabel: 'Dân tộc',
    group: 'PERSONAL',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[85px]',
  },
  {
    id: 'hometown',
    label: 'Quê quán',
    tableHeaderLabel: 'Quê quán',
    group: 'PERSONAL',
    align: 'left',
    isExpandable: true,
    minWidthClass: 'min-w-[140px]',
  },
  {
    id: 'address',
    label: 'Địa chỉ thường trú',
    tableHeaderLabel: 'Địa chỉ',
    group: 'PERSONAL',
    sortField: 'address',
    align: 'left',
    isExpandable: true,
    minWidthClass: 'min-w-[160px]',
  },
  {
    id: 'education',
    label: 'Trình độ',
    tableHeaderLabel: 'Trình độ',
    group: 'PERSONAL',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[105px]',
  },
  {
    id: 'maritalStatus',
    label: 'Tình trạng hôn nhân',
    tableHeaderLabel: 'Hôn nhân',
    group: 'PERSONAL',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[110px]',
  },

  // 3. LIÊN HỆ
  {
    id: 'phone',
    label: 'Điện thoại',
    tableHeaderLabel: 'Điện thoại',
    group: 'CONTACT',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[110px]',
  },
  {
    id: 'companyEmail',
    label: 'Email công ty',
    tableHeaderLabel: 'Email công ty',
    group: 'CONTACT',
    align: 'left',
    isExpandable: true,
    minWidthClass: 'min-w-[160px]',
  },

  // 4. GIA ĐÌNH, NGƯỜI THÂN
  {
    id: 'dependentsCount',
    label: 'Số người phụ thuộc',
    tableHeaderLabel: 'Người phụ thuộc',
    group: 'FAMILY',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[115px]',
  },
  {
    id: 'childrenUnder6Count',
    label: 'Số con <= 6 tuổi',
    tableHeaderLabel: 'Số con <= 6T',
    group: 'FAMILY',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[105px]',
  },
  {
    id: 'emergencyContactName',
    label: 'Người thân liên hệ',
    tableHeaderLabel: 'Người thân liên hệ',
    group: 'FAMILY',
    align: 'left',
    isExpandable: true,
    minWidthClass: 'min-w-[145px]',
  },
  {
    id: 'emergencyContactRelation',
    label: 'Quan hệ',
    tableHeaderLabel: 'Quan hệ',
    group: 'FAMILY',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[95px]',
  },
  {
    id: 'emergencyContactPhone',
    label: 'SĐT người thân',
    tableHeaderLabel: 'SĐT người thân',
    group: 'FAMILY',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[115px]',
  },

  // 5. BẢO HIỂM, NGÂN HÀNG
  {
    id: 'bhxhNumber',
    label: 'Số sổ BHXH',
    tableHeaderLabel: 'Số sổ BHXH',
    group: 'INSURANCE_BANK',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[115px]',
  },
  {
    id: 'bankName',
    label: 'Ngân hàng',
    tableHeaderLabel: 'Ngân hàng',
    group: 'INSURANCE_BANK',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[110px]',
  },
  {
    id: 'bankAccount',
    label: 'Số tài khoản',
    tableHeaderLabel: 'Số tài khoản',
    group: 'INSURANCE_BANK',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[125px]',
  },

  // 6. THEO DÕI
  {
    id: 'dossierStatus',
    label: 'Hồ sơ (đủ / thiếu)',
    tableHeaderLabel: 'Hồ sơ',
    group: 'TRACKING',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[110px]',
  },
  {
    id: 'dossierArchive',
    label: 'Kho hồ sơ',
    tableHeaderLabel: 'Kho hồ sơ',
    group: 'TRACKING',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[105px]',
  },
  {
    id: 'employeeAccount',
    label: 'Tài khoản nhân viên',
    tableHeaderLabel: 'Tài khoản NV',
    group: 'TRACKING',
    align: 'center',
    isExpandable: false,
    minWidthClass: 'min-w-[115px]',
  },
  {
    id: 'pendingTasks',
    label: 'Việc cần xử lý',
    tableHeaderLabel: 'Việc cần xử lý',
    group: 'TRACKING',
    align: 'left',
    isExpandable: true,
    minWidthClass: 'min-w-[140px]',
  },
];

export const EMPLOYEE_COLUMN_GROUPS: EmployeeColumnGroupDef[] = [
  {
    key: 'WORK',
    title: 'CÔNG VIỆC',
    columns: ALL_EMPLOYEE_COLUMNS.filter((c) => c.group === 'WORK'),
  },
  {
    key: 'PERSONAL',
    title: 'CÁ NHÂN',
    columns: ALL_EMPLOYEE_COLUMNS.filter((c) => c.group === 'PERSONAL'),
  },
  {
    key: 'CONTACT',
    title: 'LIÊN HỆ',
    columns: ALL_EMPLOYEE_COLUMNS.filter((c) => c.group === 'CONTACT'),
  },
  {
    key: 'FAMILY',
    title: 'GIA ĐÌNH, NGƯỜI THÂN',
    columns: ALL_EMPLOYEE_COLUMNS.filter((c) => c.group === 'FAMILY'),
  },
  {
    key: 'INSURANCE_BANK',
    title: 'BẢO HIỂM, NGÂN HÀNG',
    columns: ALL_EMPLOYEE_COLUMNS.filter((c) => c.group === 'INSURANCE_BANK'),
  },
  {
    key: 'TRACKING',
    title: 'THEO DÕI',
    columns: ALL_EMPLOYEE_COLUMNS.filter((c) => c.group === 'TRACKING'),
  },
];

const VALID_COLUMN_ID_SET = new Set<string>(
  ALL_EMPLOYEE_COLUMNS.map((c) => c.id)
);

export function getStorageKeyForVisibleColumns(username?: string): string {
  const safeUser = (username || 'default').trim().toLowerCase() || 'default';
  return `hr_pro_emp_visible_cols_v1_${safeUser}`;
}

export function loadVisibleEmployeeColumns(
  username?: string
): EmployeeColumnId[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_VISIBLE_EMPLOYEE_COLUMNS];
  }
  try {
    const key = getStorageKeyForVisibleColumns(username);
    const raw = localStorage.getItem(key);
    if (!raw) return [...DEFAULT_VISIBLE_EMPLOYEE_COLUMNS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_EMPLOYEE_COLUMNS];
    const valid = parsed.filter((id): id is EmployeeColumnId =>
      VALID_COLUMN_ID_SET.has(String(id))
    );
    // Keep columns ordered according to ALL_EMPLOYEE_COLUMNS or user's valid list
    return valid;
  } catch {
    return [...DEFAULT_VISIBLE_EMPLOYEE_COLUMNS];
  }
}

export function saveVisibleEmployeeColumns(
  columns: EmployeeColumnId[],
  username?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKeyForVisibleColumns(username);
    localStorage.setItem(key, JSON.stringify(columns));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Calculates age from YYYY-MM-DD birth date string
 */
export function calculateAgeFromDob(dob?: string, refYear = 2026): string {
  if (!dob) return '-';
  const match = dob.trim().match(/^(\d{4})/);
  if (!match) return '-';
  const birthYear = parseInt(match[1], 10);
  if (isNaN(birthYear) || birthYear < 1930 || birthYear > refYear) return '-';
  return `${refYear - birthYear} tuổi`;
}

/**
 * Calculates seniority label from YYYY-MM-DD join date
 */
export function calculateSeniorityLabel(
  joinDate?: string,
  refYear = 2026,
  refMonth = 11
): string {
  if (!joinDate) return '';
  const parts = joinDate.trim().split('-');
  if (parts.length < 2) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m)) return '';
  const totalMonths = (refYear - y) * 12 + (refMonth - m);
  if (totalMonths <= 0) return 'Mới vào';
  const years = Math.floor(totalMonths / 12);
  const remMonths = totalMonths % 12;
  if (years > 0 && remMonths > 0) return `${years} năm ${remMonths} tháng`;
  if (years > 0) return `${years} năm`;
  return `${remMonths} tháng`;
}

/**
 * Parses `familyInfo` (e.g., "Vợ: Nguyễn Thị Lan - 0987654321" or "Bố: Trần Văn A (0912345678)")
 */
export function parseFamilyInfoParts(familyInfo?: string): {
  name: string;
  relation: string;
  phone: string;
} {
  const raw = (familyInfo || '').trim();
  if (!raw || raw === '-') {
    return { name: '-', relation: '-', phone: '-' };
  }
  const phoneMatch = raw.match(/(0\d{8,10})/);
  const phone = phoneMatch ? phoneMatch[1] : '-';

  let withoutPhone = raw
    .replace(/(0\d{8,10})/g, '')
    .replace(/[-–—()]/g, ' ')
    .trim();

  const colonIdx = withoutPhone.indexOf(':');
  if (colonIdx !== -1) {
    const rel = withoutPhone.slice(0, colonIdx).trim();
    const name = withoutPhone.slice(colonIdx + 1).trim();
    return {
      relation: rel || '-',
      name: name || raw,
      phone,
    };
  }

  return {
    name: withoutPhone || raw,
    relation: '-',
    phone,
  };
}

/**
 * Evaluates whether an employee's core dossier has sufficient information
 */
export function evaluateDossierCompleteness(emp: Employee): {
  isComplete: boolean;
  label: string;
  missingFields: string[];
} {
  const missing: string[] = [];
  if (!emp.cccd?.trim()) missing.push('CCCD');
  if (!emp.dob?.trim()) missing.push('Ngày sinh');
  if (!emp.address?.trim()) missing.push('Địa chỉ');
  if (!emp.joinDate?.trim()) missing.push('Ngày vào');

  if (missing.length === 0) {
    return { isComplete: true, label: 'Đủ hồ sơ', missingFields: [] };
  }
  return {
    isComplete: false,
    label: `Thiếu (${missing.join(', ')})`,
    missingFields: missing,
  };
}

/**
 * Returns formatted text value for any EmployeeColumnId (used for both Table cell rendering and Excel/PDF export)
 */
export function getEmployeeColumnTextValue(
  emp: Employee,
  colId: EmployeeColumnId,
  options?: { fullAddressForExport?: boolean }
): string {
  switch (colId) {
    case 'department':
      return (emp.department || '').trim() || '-';
    case 'position':
      return (emp.position || '').trim() || '-';
    case 'jobTitle':
      return (emp.position || '').trim() || '-';
    case 'joinDate': {
      if (!emp.joinDate) return '-';
      const dateStr = formatDateVN(emp.joinDate);
      const seniority = calculateSeniorityLabel(emp.joinDate);
      return options?.fullAddressForExport && seniority
        ? `${dateStr} (${seniority})`
        : dateStr;
    }
    case 'attendanceCode':
      return (emp.employeeCode || '').trim() || '-';
    case 'laborType':
      return emp.status === 'Đang thử việc' ? 'Thử việc' : 'Chính thức';
    case 'contractType':
      return emp.status === 'Đang thử việc'
        ? 'HĐ Thử việc'
        : emp.status === 'Đã nghỉ việc'
        ? 'Đã thanh lý'
        : 'HĐ Lao động';
    case 'status':
      return (emp.status || 'Đang làm việc').trim() || '-';
    case 'resignDate':
      return '-';
    case 'resignReason':
      return emp.status === 'Đã nghỉ việc' ? 'Theo nguyện vọng cá nhân' : '-';
    case 'gender':
      return (emp.gender || '').trim() || '-';
    case 'dob':
      return emp.dob ? formatDateVN(emp.dob) : '-';
    case 'age':
      return calculateAgeFromDob(emp.dob);
    case 'cccd':
      return (emp.cccd || '').trim() || '-';
    case 'cccdDate':
      return emp.cccdDate ? formatDateVN(emp.cccdDate) : '-';
    case 'ethnicity':
      return 'Kinh';
    case 'hometown':
      return formatCommuneProvinceAddress(emp.address) || '-';
    case 'address':
      if (options?.fullAddressForExport) {
        return (emp.address || '').trim() || '-';
      }
      return formatCommuneProvinceAddress(emp.address) || '-';
    case 'education':
      return '-';
    case 'maritalStatus':
      return '-';
    case 'phone':
      return (emp.phone || '').trim() || '-';
    case 'companyEmail':
      return '-';
    case 'dependentsCount':
      return '0';
    case 'childrenUnder6Count':
      return '0';
    case 'emergencyContactName':
      return parseFamilyInfoParts(emp.familyInfo).name;
    case 'emergencyContactRelation':
      return parseFamilyInfoParts(emp.familyInfo).relation;
    case 'emergencyContactPhone':
      return parseFamilyInfoParts(emp.familyInfo).phone;
    case 'bhxhNumber':
      return (emp.cccd || '').trim() || '-';
    case 'bankName':
      return '-';
    case 'bankAccount':
      return '-';
    case 'dossierStatus':
      return evaluateDossierCompleteness(emp).label;
    case 'dossierArchive':
      return emp.department ? `Tủ HS - ${emp.department}` : '-';
    case 'employeeAccount':
      return emp.employeeCode ? emp.employeeCode.toLowerCase() : '-';
    case 'pendingTasks': {
      const check = evaluateDossierCompleteness(emp);
      return check.isComplete
        ? '-'
        : `Bổ sung ${check.missingFields.join(', ')}`;
    }
    default:
      return '-';
  }
}
