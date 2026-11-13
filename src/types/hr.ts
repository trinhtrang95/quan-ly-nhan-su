export type Gender = 'Nam' | 'Nữ' | 'Khác';

export type WorkStatus = 'Đang làm việc' | 'Đang thử việc' | 'Nghỉ thai sản' | 'Đã nghỉ việc';

export type LeaveRecordType =
  | 'annual_leave' // Nghỉ phép năm (trừ vào phép tồn)
  | 'unpaid_leave' // Nghỉ không lương
  | 'regime_leave' // Nghỉ chế độ (Ốm đau, Thai sản, Hiếu/Hỷ)
  | 'late_early';  // Đi muộn / Về sớm (tính theo giờ)

export type RegimeSubtype = 'Ốm đau / Viện phí' | 'Thai sản' | 'Hiếu / Hỷ' | 'Công tác / Khác';

export interface DepartmentGroup {
  id: string;
  companyId?: string | null;
  name: string;
  code: string;
  color: string;
  description?: string;
}

export interface Employee {
  id: string;
  companyId?: string | null;
  employeeCode: string; // Mã nhân viên (VD: NV001)
  fullName: string;     // Họ tên
  dob: string;          // Ngày tháng năm sinh (YYYY-MM-DD)
  gender: Gender;       // Giới tính
  cccd: string;         // Số CCCD
  phone: string;        // Số điện thoại
  address: string;      // Địa chỉ
  department: string;   // Nhóm/Bộ phận
  position?: string;    // Chức vụ
  joinDate: string;     // Ngày vào làm (YYYY-MM-DD)
  standardAnnualLeave: number; // Tổng phép năm tiêu chuẩn (mặc định 12)
  status: WorkStatus;
  avatarUrl: string;
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  type: LeaveRecordType;
  regimeSubtype?: RegimeSubtype;
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  amount: number;       // Số ngày nghỉ (VD: 1, 0.5) HOẶC Số giờ đi muộn (VD: 1.5)
  reason: string;       // Lý do / Ghi chú chi tiết
  attachmentUrl?: string; // Ảnh chụp giấy phép / viện phí (Data URI hoặc URL)
  attachmentTitle?: string;
  createdAt: string;
  approvedBy: string;
}

export interface DashboardKPIs {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveToday: number;
  onLeaveTodayNames: string[];
  lateCountInMonth: number;
  lateHoursInMonth: number;
  lowLeaveEmployeesCount: number;
  lowLeaveEmployeeNames: string[];
}

export interface DistributionItem {
  label: string;
  count: number;
  percentage: number;
  color: string;
  subLabel?: string;
}

export interface MonthCellData {
  month: number; // 1..12
  annualLeaveDays: number;
  unpaidLeaveDays: number;
  regimeLeaveDays: number;
  lateHours: number;
  lateCount: number;
  records: LeaveRecord[];
}

export interface EmployeeAnnualMatrixRow {
  employee: Employee;
  months: Record<number, MonthCellData>; // 1..12
  totalAnnualUsed: number;
  remainingAnnualLeave: number;
  totalUnpaidDays: number;
  totalRegimeDays: number;
  totalLateHours: number;
  totalLateCount: number;
}

export type MatrixViewMode = 'all' | 'annual_leave' | 'unpaid_leave' | 'late_early';

export type ActiveModule =
  | 'dashboard'
  | 'employees'
  | 'leave_logs'
  | 'annual_report'
  | 'settings';

export type UserRole = 'admin' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  companyId?: string | null;
  employeeCode?: string;
  department?: string;
  createdAt: string;
}

export interface CompanyUnit {
  id: string;
  name: string;
  code: string;
  shortName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  defaultLeaveQuota?: number;
  isInitialized?: boolean;
}

export interface HRBackupPayload {
  version: string;
  exportedAt: string;
  activeCompanyId?: string;
  defaultAnnualLeaveQuota?: number;
  companies: CompanyUnit[];
  departments: DepartmentGroup[];
  employees: Employee[];
  records: LeaveRecord[];
  accounts: UserAccount[];
}

