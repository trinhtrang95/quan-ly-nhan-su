export type Gender = 'Nam' | 'Nữ' | 'Khác' | '';

export type WorkStatus =
  | 'Đang làm việc'
  | 'Tạm nghỉ'
  | 'Đang thử việc'
  | 'Nghỉ thai sản'
  | 'Đã nghỉ việc';

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
  sortOrder?: number;
}

export interface PositionItem {
  id: string;
  companyId?: string | null;
  name: string;
  createdAt?: string;
  sortOrder?: number;
}

export interface Employee {
  id: string;
  companyId?: string | null;
  employeeCode: string; // Mã nhân viên (VD: NV001)
  fullName: string;     // Họ tên
  dob: string;          // Ngày tháng năm sinh (YYYY-MM-DD)
  gender: Gender;       // Giới tính
  cccd: string;         // Số CCCD
  cccdDate?: string;    // Ngày cấp CCCD (YYYY-MM-DD)
  phone: string;        // Số điện thoại
  familyInfo?: string;  // Thông tin người nhà / Liên hệ khẩn cấp
  address: string;      // Địa chỉ
  department: string;   // Nhóm/Bộ phận
  position?: string;    // Chức danh / Vị trí
  joinDate: string;     // Ngày vào làm (YYYY-MM-DD)
  join_date?: string;   // Đồng bộ tên cột join_date từ bảng employees trên Supabase
  standardAnnualLeave: number; // Tổng phép năm tiêu chuẩn (mặc định 12)
  carriedOverLeave?: number;   // Phép năm cũ dồn sang (nếu có)
  openingUsedLeave?: number;   // Số ngày phép đã nghỉ chốt đầu kỳ (đến 31/10)
  status: WorkStatus;
  avatarUrl: string;
}

export interface LeaveBalanceRecord {
  employeeCode: string; // Mã NV (Khóa chính để map dữ liệu)
  employeeId?: string;
  fullName?: string;
  join_date?: string;   // Ngày vào làm (YYYY-MM-DD)
  year: number;         // Năm áp dụng (VD: 2026)
  carried_over: number; // Tồn phép năm cũ (2025)
  used_leave: number;   // Đã nghỉ (đến 31/10)
  cutoffDate: string;   // Mặc định '2026-10-31'
  baselineNovRecordIds?: string[]; // ID các bản ghi tháng 11 tồn tại trước thời điểm chốt sổ (nếu có)
  updatedAt: string;
}

export type LeaveAccrualMode = 'upfront' | 'monthly';

export interface LeavePolicyConfig {
  accrualMode: LeaveAccrualMode; // 'upfront': Cấp 1 lần đầu năm | 'monthly': Tích lũy theo tháng
  allowCarryOver: boolean;       // Cho phép dồn phép năm cũ sang năm mới
}

export type LeaveApprovalStatus = 'Đã duyệt' | 'Chờ duyệt';

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
  paperStatus?: 'Chưa có' | 'Đã có'; // Hiện trạng giấy phép
  approvalStatus?: LeaveApprovalStatus; // Trạng thái duyệt đơn ('Đã duyệt' | 'Chờ duyệt')
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
  accruedLeaveDays: number;      // Phép tích lũy theo tháng làm việc hiện tại
  carriedOverLeaveDays: number;  // Phép năm cũ dồn sang
  totalAnnualUsed: number;       // Số đã nghỉ
  remainingAnnualLeave: number;  // = accruedLeaveDays + carriedOverLeaveDays - totalAnnualUsed
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
  positions?: PositionItem[];
  employees: Employee[];
  records: LeaveRecord[];
  accounts: UserAccount[];
}


