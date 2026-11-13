import {
  CompanyUnit,
  DepartmentGroup,
  Employee,
  LeaveRecord,
  UserAccount,
} from '../types/hr';

export const INITIAL_COMPANY_UNITS: CompanyUnit[] = [
  {
    id: '64743e11-da67-4806-893f-3d039ad68946',
    name: 'Công ty Mặc định',
    code: 'HRPRO-HQ',
    shortName: 'HR',
    address: 'Việt Nam',
    phone: '024 3825 9999',
    defaultLeaveQuota: 12,
    isInitialized: true,
  },
];

export const INITIAL_USER_ACCOUNTS: UserAccount[] = [
  {
    id: 'ad681325-84f6-4e3b-97fb-c1e0d91e7a63',
    username: 'admin',
    password: 'admin123',
    fullName: 'Quản trị viên Hệ thống',
    role: 'admin',
    companyId: null,
    employeeCode: 'NV001',
    department: 'Phòng Hành chính - Nhân sự',
    createdAt: '2026-11-13',
  },
  {
    id: '6da397cf-c236-4859-9786-69ec772398a4',
    username: 'user',
    password: 'user123',
    fullName: 'Nhân viên Chấm công',
    role: 'user',
    companyId: null,
    employeeCode: 'NV002',
    department: 'Phòng Kỹ thuật & CNTT',
    createdAt: '2026-11-13',
  },
];

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Helper to generate crisp SVG Avatar Data URI
 */
export function createAvatarSvgDataUri(initials: string, bgColor: string, accentColor: string): string {
  const safeInitials = escapeXml(initials);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgColor}" />
        <stop offset="100%" stop-color="${accentColor}" />
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="60" fill="url(#g)" />
    <circle cx="60" cy="44" r="20" fill="rgba(255,255,255,0.22)" />
    <path d="M26 106 C26 82 94 82 94 106" fill="rgba(255,255,255,0.22)" />
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="700" font-size="38" letter-spacing="1">${safeInitials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Helper to generate realistic Vietnamese Leave Slip / Medical Certificate SVG Data URI
 * for immediate inspection in the Lightbox
 */
export function createLeaveSlipSvgDataUri(params: {
  docTitle: string;
  docNumber: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  leaveTypeLabel: string;
  dateRange: string;
  amountLabel: string;
  reason: string;
  signedDate: string;
  approver: string;
  stampText?: string;
}): string {
  const docTitle = escapeXml(params.docTitle);
  const docNumber = escapeXml(params.docNumber);
  const employeeName = escapeXml(params.employeeName);
  const employeeCode = escapeXml(params.employeeCode);
  const department = escapeXml(params.department);
  const leaveTypeLabel = escapeXml(params.leaveTypeLabel);
  const dateRange = escapeXml(params.dateRange);
  const amountLabel = escapeXml(params.amountLabel);
  const reason = escapeXml(params.reason);
  const signedDate = escapeXml(params.signedDate);
  const approver = escapeXml(params.approver);
  const stamp = escapeXml(params.stampText || 'ĐÃ PHÊ DUYỆT');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="920" viewBox="0 0 720 920">
    <rect width="720" height="920" fill="#F8FAFC" />
    <rect x="24" y="24" width="672" height="872" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
    
    <!-- Header -->
    <text x="56" y="70" fill="#0F232E" font-family="Arial, sans-serif" font-weight="700" font-size="13">CÔNG TY CỔ PHẦN CÔNG NGHỆ &amp; DỊCH VỤ HR PRO</text>
    <text x="56" y="92" fill="#475569" font-family="Arial, sans-serif" font-weight="600" font-size="12">PHÒNG HÀNH CHÍNH - NHÂN SỰ</text>
    <text x="56" y="112" fill="#64748B" font-family="monospace" font-size="11">Số chứng từ: ${docNumber}</text>

    <text x="520" y="70" text-anchor="middle" fill="#0F232E" font-family="Arial, sans-serif" font-weight="700" font-size="13">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</text>
    <text x="520" y="92" text-anchor="middle" fill="#1E293B" font-family="Arial, sans-serif" font-weight="600" font-size="12">Độc lập - Tự do - Hạnh phúc</text>
    <line x1="440" y1="102" x2="600" y2="102" stroke="#94A3B8" stroke-width="1" />

    <!-- Main Document Title -->
    <text x="360" y="175" text-anchor="middle" fill="#0F232E" font-family="Arial, sans-serif" font-weight="800" font-size="22">${docTitle}</text>
    <text x="360" y="202" text-anchor="middle" fill="#0D9488" font-family="Arial, sans-serif" font-weight="600" font-size="13">Kính gửi: Ban Giám đốc &amp; Phòng Hành chính - Nhân sự</text>

    <!-- Info Box -->
    <rect x="56" y="230" width="608" height="310" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />

    <text x="80" y="270" fill="#475569" font-family="Arial, sans-serif" font-size="14">Họ và tên nhân sự:</text>
    <text x="240" y="270" fill="#0F232E" font-family="Arial, sans-serif" font-weight="700" font-size="15">${employeeName}</text>

    <text x="80" y="310" fill="#475569" font-family="Arial, sans-serif" font-size="14">Mã số nhân viên:</text>
    <text x="240" y="310" fill="#0D9488" font-family="monospace" font-weight="700" font-size="14">${employeeCode}</text>

    <text x="80" y="350" fill="#475569" font-family="Arial, sans-serif" font-size="14">Nhóm / Bộ phận:</text>
    <text x="240" y="350" fill="#1E293B" font-family="Arial, sans-serif" font-weight="600" font-size="14">${department}</text>

    <text x="80" y="390" fill="#475569" font-family="Arial, sans-serif" font-size="14">Loại hình đăng ký:</text>
    <text x="240" y="390" fill="#0F232E" font-family="Arial, sans-serif" font-weight="700" font-size="14">${leaveTypeLabel}</text>

    <text x="80" y="430" fill="#475569" font-family="Arial, sans-serif" font-size="14">Thời gian áp dụng:</text>
    <text x="240" y="430" fill="#1E293B" font-family="monospace" font-weight="700" font-size="14">${dateRange}</text>

    <text x="80" y="470" fill="#475569" font-family="Arial, sans-serif" font-size="14">Tổng thời lượng:</text>
    <text x="240" y="470" fill="#DC2626" font-family="monospace" font-weight="700" font-size="15">${amountLabel}</text>

    <text x="80" y="510" fill="#475569" font-family="Arial, sans-serif" font-size="14">Lý do chi tiết:</text>
    <text x="240" y="510" fill="#334155" font-family="Arial, sans-serif" font-style="italic" font-size="13">${reason}</text>

    <!-- Commitment -->
    <text x="56" y="585" fill="#334155" font-family="Arial, sans-serif" font-size="13">Tôi đã bàn giao đầy đủ công việc cho đồng nghiệp trong thời gian vắng mặt và cam kết</text>
    <text x="56" y="607" fill="#334155" font-family="Arial, sans-serif" font-size="13">tuân thủ đúng nội quy chấm công của đơn vị. Xin trân trọng cảm ơn!</text>

    <!-- Signatures -->
    <text x="530" y="655" text-anchor="middle" fill="#475569" font-family="Arial, sans-serif" font-style="italic" font-size="12">${signedDate}</text>

    <text x="170" y="685" text-anchor="middle" fill="#0F232E" font-family="Arial, sans-serif" font-weight="700" font-size="13">NGƯỜI LÀM ĐƠN</text>
    <text x="170" y="705" text-anchor="middle" fill="#64748B" font-family="Arial, sans-serif" font-size="11">(Ký và ghi rõ họ tên)</text>
    <text x="170" y="765" text-anchor="middle" fill="#0D9488" font-family="Arial, sans-serif" font-style="italic" font-weight="600" font-size="16">${employeeName}</text>
    <text x="170" y="800" text-anchor="middle" fill="#0F232E" font-family="Arial, sans-serif" font-weight="700" font-size="13">${employeeName}</text>

    <text x="530" y="685" text-anchor="middle" fill="#0F232E" font-family="Arial, sans-serif" font-weight="700" font-size="13">XÁC NHẬN CỦA QUẢN LÝ</text>
    <text x="530" y="705" text-anchor="middle" fill="#64748B" font-family="Arial, sans-serif" font-size="11">(Ký duyệt &amp; đóng dấu)</text>

    <!-- Red Approval Stamp -->
    <g transform="translate(455, 722) rotate(-8)">
      <rect x="0" y="0" width="150" height="54" rx="6" fill="rgba(239,68,68,0.08)" stroke="#EF4444" stroke-width="2.5" stroke-dasharray="4,2" />
      <text x="75" y="24" text-anchor="middle" fill="#EF4444" font-family="Arial, sans-serif" font-weight="800" font-size="12">${stamp}</text>
      <text x="75" y="42" text-anchor="middle" fill="#DC2626" font-family="monospace" font-weight="700" font-size="10">HR PRO VERIFIED</text>
    </g>

    <text x="530" y="812" text-anchor="middle" fill="#0F232E" font-family="Arial, sans-serif" font-weight="700" font-size="13">${approver}</text>

    <!-- Footer -->
    <line x1="56" y1="848" x2="664" y2="848" stroke="#E2E8F0" stroke-width="1" />
    <text x="360" y="872" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="11">Hồ sơ lưu trữ điện tử trên hệ thống HR PRO • Mã chứng từ: ${docNumber}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_DEPARTMENT_GROUPS: DepartmentGroup[] = [
  {
    id: 'grp-1',
    name: 'Ban Giám đốc & Quản lý',
    code: 'BGD',
    color: '#0D9488',
    description: 'Điều hành chiến lược và phê duyệt nhân sự',
  },
  {
    id: 'grp-2',
    name: 'Phòng Kỹ thuật & CNTT',
    code: 'TECH',
    color: '#0284C7',
    description: 'Phát triển phần mềm, vận hành hệ thống và hạ tầng',
  },
  {
    id: 'grp-3',
    name: 'Phòng Hành chính - Nhân sự',
    code: 'HCNS',
    color: '#7C3AED',
    description: 'Tuyển dụng, C&B, chấm công và văn hóa doanh nghiệp',
  },
  {
    id: 'grp-4',
    name: 'Phòng Tài chính - Kế toán',
    code: 'TCKT',
    color: '#D97706',
    description: 'Kế toán tổng hợp, ngân sách và kiểm soát nội bộ',
  },
  {
    id: 'grp-5',
    name: 'Phòng Kinh doanh & CSKH',
    code: 'SALE',
    color: '#E11D48',
    description: 'Phát triển thị trường, tư vấn và chăm sóc khách hàng',
  },
];

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    employeeCode: 'NV001',
    fullName: 'Nguyễn Minh Quân',
    dob: '1988-04-15',
    gender: 'Nam',
    cccd: '001088014521',
    phone: '0903128456',
    address: 'Số 18 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
    department: 'Ban Giám đốc & Quản lý',
    position: 'Giám đốc Điều hành',
    joinDate: '2020-01-10',
    standardAnnualLeave: 14,
    status: 'Đang làm việc',
    avatarUrl: createAvatarSvgDataUri('MQ', '#0F232E', '#0D9488'),
  },
  {
    id: 'emp-2',
    employeeCode: 'NV002',
    fullName: 'Trần Thu Trang',
    dob: '1993-09-22',
    gender: 'Nữ',
    cccd: '001193028914',
    phone: '0987654321',
    address: 'Khu đô thị Cầu Giấy, Dịch Vọng, Hà Nội',
    department: 'Phòng Hành chính - Nhân sự',
    position: 'Trưởng phòng Nhân sự',
    joinDate: '2021-03-01',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: createAvatarSvgDataUri('TT', '#5B21B6', '#8B5CF6'),
  },
  {
    id: 'emp-3',
    employeeCode: 'NV003',
    fullName: 'Lê Hoàng Nam',
    dob: '1995-11-08',
    gender: 'Nam',
    cccd: '036095004812',
    phone: '0912456789',
    address: 'Số 102 Nguyễn Trãi, Thanh Xuân, Hà Nội',
    department: 'Phòng Kỹ thuật & CNTT',
    position: 'Kỹ sư Phần mềm Senior',
    joinDate: '2022-05-15',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: createAvatarSvgDataUri('HN', '#0369A1', '#0EA5E9'),
  },
  {
    id: 'emp-4',
    employeeCode: 'NV004',
    fullName: 'Phạm Ngọc Ánh',
    dob: '1996-02-19',
    gender: 'Nữ',
    cccd: '031196019283',
    phone: '0978123987',
    address: 'Tòa S2 Vinhomes Smart City, Nam Từ Liêm, Hà Nội',
    department: 'Phòng Tài chính - Kế toán',
    position: 'Kế toán Tổng hợp',
    joinDate: '2022-08-01',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: createAvatarSvgDataUri('NA', '#B45309', '#F59E0B'),
  },
  {
    id: 'emp-5',
    employeeCode: 'NV005',
    fullName: 'Vũ Đức Thịnh',
    dob: '1997-07-30',
    gender: 'Nam',
    cccd: '034097009182',
    phone: '0934882119',
    address: 'Số 45 Minh Khai, Hai Bà Trưng, Hà Nội',
    department: 'Phòng Kỹ thuật & CNTT',
    position: 'Chuyên viên Hệ thống & DevOps',
    joinDate: '2023-02-10',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: createAvatarSvgDataUri('ĐT', '#0F766E', '#14B8A6'),
  },
  {
    id: 'emp-6',
    employeeCode: 'NV006',
    fullName: 'Đặng Khánh Linh',
    dob: '1998-12-14',
    gender: 'Nữ',
    cccd: '001198033490',
    phone: '0965331209',
    address: 'Số 88 Hoàng Quốc Việt, Bắc Từ Liêm, Hà Nội',
    department: 'Phòng Kinh doanh & CSKH',
    position: 'Chuyên viên Kinh doanh B2B',
    joinDate: '2023-06-01',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: createAvatarSvgDataUri('KL', '#BE123C', '#F43F5E'),
  },
  {
    id: 'emp-7',
    employeeCode: 'NV007',
    fullName: 'Hoàng Gia Bảo',
    dob: '1999-05-03',
    gender: 'Nam',
    cccd: '040099011765',
    phone: '0945778901',
    address: 'Số 12 Giải Phóng, Đống Đa, Hà Nội',
    department: 'Phòng Kinh doanh & CSKH',
    position: 'Chuyên viên Tư vấn Khách hàng',
    joinDate: '2024-01-15',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: createAvatarSvgDataUri('GB', '#1D4ED8', '#3B82F6'),
  },
  {
    id: 'emp-8',
    employeeCode: 'NV008',
    fullName: 'Bùi Phương Thảo',
    dob: '2000-08-25',
    gender: 'Nữ',
    cccd: '001300055123',
    phone: '0918990234',
    address: 'Số 210 Nguyễn Văn Cừ, Long Biên, Hà Nội',
    department: 'Phòng Hành chính - Nhân sự',
    position: 'Chuyên viên C&B',
    joinDate: '2024-04-01',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: createAvatarSvgDataUri('PT', '#047857', '#10B981'),
  },
];

// Current reference date in the app environment: 2026-11-12
export const INITIAL_LEAVE_RECORDS: LeaveRecord[] = [
  // Employee 3 (Lê Hoàng Nam) - Used 11 days of annual leave across 2026 (only 1 day left -> Sắp hết phép!)
  {
    id: 'rec-101',
    employeeId: 'emp-3',
    type: 'annual_leave',
    startDate: '2026-01-22',
    endDate: '2026-01-23',
    amount: 2,
    reason: 'Về quê chuẩn bị Tết Nguyên Đán cùng gia đình',
    attachmentTitle: 'Đơn xin nghỉ phép năm - Lê Hoàng Nam (T1/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/01-012',
      employeeName: 'Lê Hoàng Nam',
      employeeCode: 'NV003',
      department: 'Phòng Kỹ thuật & CNTT',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '22/01/2026 - 23/01/2026',
      amountLabel: '02 Ngày',
      reason: 'Về quê chuẩn bị Tết Nguyên Đán cùng gia đình',
      signedDate: 'Hà Nội, ngày 18 tháng 01 năm 2026',
      approver: 'Nguyễn Minh Quân',
    }),
    createdAt: '2026-01-18',
    approvedBy: 'Nguyễn Minh Quân',
  },
  {
    id: 'rec-102',
    employeeId: 'emp-3',
    type: 'annual_leave',
    startDate: '2026-04-27',
    endDate: '2026-04-29',
    amount: 3,
    reason: 'Nghỉ phép kết hợp dịp lễ 30/4 - 1/5 đi du lịch Đà Nẵng',
    attachmentTitle: 'Đơn xin nghỉ phép năm - Lê Hoàng Nam (T4/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/04-045',
      employeeName: 'Lê Hoàng Nam',
      employeeCode: 'NV003',
      department: 'Phòng Kỹ thuật & CNTT',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '27/04/2026 - 29/04/2026',
      amountLabel: '03 Ngày',
      reason: 'Nghỉ phép kết hợp dịp lễ 30/4 - 1/5 đi du lịch Đà Nẵng',
      signedDate: 'Hà Nội, ngày 20 tháng 04 năm 2026',
      approver: 'Nguyễn Minh Quân',
    }),
    createdAt: '2026-04-20',
    approvedBy: 'Nguyễn Minh Quân',
  },
  {
    id: 'rec-103',
    employeeId: 'emp-3',
    type: 'annual_leave',
    startDate: '2026-07-13',
    endDate: '2026-07-16',
    amount: 4,
    reason: 'Giải quyết việc gia đình và sửa chữa nhà ở tại Nam Định',
    attachmentTitle: 'Đơn xin nghỉ phép năm - Lê Hoàng Nam (T7/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/07-088',
      employeeName: 'Lê Hoàng Nam',
      employeeCode: 'NV003',
      department: 'Phòng Kỹ thuật & CNTT',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '13/07/2026 - 16/07/2026',
      amountLabel: '04 Ngày',
      reason: 'Giải quyết việc gia đình và sửa chữa nhà ở tại Nam Định',
      signedDate: 'Hà Nội, ngày 10 tháng 07 năm 2026',
      approver: 'Nguyễn Minh Quân',
    }),
    createdAt: '2026-07-10',
    approvedBy: 'Nguyễn Minh Quân',
  },
  {
    id: 'rec-104',
    employeeId: 'emp-3',
    type: 'annual_leave',
    startDate: '2026-11-12',
    endDate: '2026-11-13',
    amount: 2,
    reason: 'Đưa người thân đi khám sức khỏe định kỳ tại BV Bạch Mai',
    attachmentTitle: 'Đơn xin nghỉ phép năm - Lê Hoàng Nam (12/11/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/11-142',
      employeeName: 'Lê Hoàng Nam',
      employeeCode: 'NV003',
      department: 'Phòng Kỹ thuật & CNTT',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '12/11/2026 - 13/11/2026',
      amountLabel: '02 Ngày',
      reason: 'Đưa người thân đi khám sức khỏe định kỳ tại BV Bạch Mai',
      signedDate: 'Hà Nội, ngày 11 tháng 11 năm 2026',
      approver: 'Trần Thu Trang',
    }),
    createdAt: '2026-11-11',
    approvedBy: 'Trần Thu Trang',
  },

  // Employee 6 (Đặng Khánh Linh) - Used 12/12 days (0 days left -> Hết phép năm!) + 1.5 days unpaid
  {
    id: 'rec-201',
    employeeId: 'emp-6',
    type: 'annual_leave',
    startDate: '2026-02-09',
    endDate: '2026-02-13',
    amount: 5,
    reason: 'Nghỉ phép du xuân đầu năm cùng gia đình',
    attachmentTitle: 'Đơn xin nghỉ phép - Đặng Khánh Linh (T2/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/02-019',
      employeeName: 'Đặng Khánh Linh',
      employeeCode: 'NV006',
      department: 'Phòng Kinh doanh & CSKH',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '09/02/2026 - 13/02/2026',
      amountLabel: '05 Ngày',
      reason: 'Nghỉ phép du xuân đầu năm cùng gia đình',
      signedDate: 'Hà Nội, ngày 05 tháng 02 năm 2026',
      approver: 'Trần Thu Trang',
    }),
    createdAt: '2026-02-05',
    approvedBy: 'Trần Thu Trang',
  },
  {
    id: 'rec-202',
    employeeId: 'emp-6',
    type: 'annual_leave',
    startDate: '2026-06-08',
    endDate: '2026-06-12',
    amount: 5,
    reason: 'Tham gia khóa học ngắn hạn và nghỉ hè cá nhân',
    attachmentTitle: 'Đơn xin nghỉ phép - Đặng Khánh Linh (T6/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/06-071',
      employeeName: 'Đặng Khánh Linh',
      employeeCode: 'NV006',
      department: 'Phòng Kinh doanh & CSKH',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '08/06/2026 - 12/06/2026',
      amountLabel: '05 Ngày',
      reason: 'Tham gia khóa học ngắn hạn và nghỉ hè cá nhân',
      signedDate: 'Hà Nội, ngày 03 tháng 06 năm 2026',
      approver: 'Trần Thu Trang',
    }),
    createdAt: '2026-06-03',
    approvedBy: 'Trần Thu Trang',
  },
  {
    id: 'rec-203',
    employeeId: 'emp-6',
    type: 'annual_leave',
    startDate: '2026-09-14',
    endDate: '2026-09-15',
    amount: 2,
    reason: 'Nghỉ phép chăm sóc con nhỏ bị sốt siêu vi',
    attachmentTitle: 'Đơn xin nghỉ phép - Đặng Khánh Linh (T9/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/09-108',
      employeeName: 'Đặng Khánh Linh',
      employeeCode: 'NV006',
      department: 'Phòng Kinh doanh & CSKH',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '14/09/2026 - 15/09/2026',
      amountLabel: '02 Ngày',
      reason: 'Nghỉ phép chăm sóc con nhỏ bị sốt siêu vi',
      signedDate: 'Hà Nội, ngày 13 tháng 09 năm 2026',
      approver: 'Trần Thu Trang',
    }),
    createdAt: '2026-09-13',
    approvedBy: 'Trần Thu Trang',
  },
  {
    id: 'rec-204',
    employeeId: 'emp-6',
    type: 'unpaid_leave',
    startDate: '2026-11-05',
    endDate: '2026-11-06',
    amount: 1.5,
    reason: 'Xin nghỉ không lương làm thủ tục sang tên sổ đỏ',
    attachmentTitle: 'Đơn xin nghỉ không lương - Đặng Khánh Linh (T11/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ KHÔNG HƯỞNG LƯƠNG',
      docNumber: 'KL-2026/11-135',
      employeeName: 'Đặng Khánh Linh',
      employeeCode: 'NV006',
      department: 'Phòng Kinh doanh & CSKH',
      leaveTypeLabel: 'Nghỉ việc riêng không hưởng lương',
      dateRange: '05/11/2026 - 06/11/2026',
      amountLabel: '1.5 Ngày',
      reason: 'Xin nghỉ không lương làm thủ tục sang tên sổ đỏ',
      signedDate: 'Hà Nội, ngày 03 tháng 11 năm 2026',
      approver: 'Trần Thu Trang',
    }),
    createdAt: '2026-11-03',
    approvedBy: 'Trần Thu Trang',
  },

  // Employee 4 (Phạm Ngọc Ánh) - Regime leave today (2026-11-12) + Annual leave in Mar & Aug
  {
    id: 'rec-301',
    employeeId: 'emp-4',
    type: 'annual_leave',
    startDate: '2026-03-16',
    endDate: '2026-03-18',
    amount: 3,
    reason: 'Nghỉ phép năm đi lễ đầu xuân tại Ninh Bình',
    attachmentTitle: 'Đơn xin nghỉ phép - Phạm Ngọc Ánh (T3/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/03-031',
      employeeName: 'Phạm Ngọc Ánh',
      employeeCode: 'NV004',
      department: 'Phòng Tài chính - Kế toán',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '16/03/2026 - 18/03/2026',
      amountLabel: '03 Ngày',
      reason: 'Nghỉ phép năm đi lễ đầu xuân tại Ninh Bình',
      signedDate: 'Hà Nội, ngày 12 tháng 03 năm 2026',
      approver: 'Nguyễn Minh Quân',
    }),
    createdAt: '2026-03-12',
    approvedBy: 'Nguyễn Minh Quân',
  },
  {
    id: 'rec-302',
    employeeId: 'emp-4',
    type: 'annual_leave',
    startDate: '2026-08-19',
    endDate: '2026-08-21',
    amount: 2.5,
    reason: 'Nghỉ phép đưa con nhập học năm học mới',
    attachmentTitle: 'Đơn xin nghỉ phép - Phạm Ngọc Ánh (T8/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/08-095',
      employeeName: 'Phạm Ngọc Ánh',
      employeeCode: 'NV004',
      department: 'Phòng Tài chính - Kế toán',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '19/08/2026 - 21/08/2026',
      amountLabel: '2.5 Ngày',
      reason: 'Nghỉ phép đưa con nhập học năm học mới',
      signedDate: 'Hà Nội, ngày 17 tháng 08 năm 2026',
      approver: 'Trần Thu Trang',
    }),
    createdAt: '2026-08-17',
    approvedBy: 'Trần Thu Trang',
  },
  {
    id: 'rec-303',
    employeeId: 'emp-4',
    type: 'regime_leave',
    regimeSubtype: 'Ốm đau / Viện phí',
    startDate: '2026-11-11',
    endDate: '2026-11-12',
    amount: 2,
    reason: 'Nghỉ ốm hưởng BHXH theo giấy chỉ định của Bệnh viện Đa khoa Hồng Ngọc',
    attachmentTitle: 'Giấy chứng nhận nghỉ ốm hưởng BHXH - Phạm Ngọc Ánh',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'GIẤY XÁC NHẬN NGHỈ ỐM & VIỆN PHÍ',
      docNumber: 'BHXH-2026/11-09',
      employeeName: 'Phạm Ngọc Ánh',
      employeeCode: 'NV004',
      department: 'Phòng Tài chính - Kế toán',
      leaveTypeLabel: 'Nghỉ chế độ (Ốm đau / Viện phí)',
      dateRange: '11/11/2026 - 12/11/2026',
      amountLabel: '02 Ngày (Hưởng chế độ BHXH)',
      reason: 'Viêm đường hô hấp cấp - Có giấy viện phí & xác nhận BV Hồng Ngọc',
      signedDate: 'Hà Nội, ngày 11 tháng 11 năm 2026',
      approver: 'Trần Thu Trang',
      stampText: 'ĐÃ ĐỐI CHIẾU Y TẾ',
    }),
    createdAt: '2026-11-11',
    approvedBy: 'Trần Thu Trang',
  },

  // Employee 5 (Vũ Đức Thịnh) - Used 10.5/12 days (1.5 days left -> Sắp hết phép!) + Late arrivals in Nov 2026
  {
    id: 'rec-401',
    employeeId: 'emp-5',
    type: 'annual_leave',
    startDate: '2026-05-04',
    endDate: '2026-05-08',
    amount: 5,
    reason: 'Nghỉ phép năm về thăm gia đình tại Thái Bình',
    attachmentTitle: 'Đơn xin nghỉ phép - Vũ Đức Thịnh (T5/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/05-052',
      employeeName: 'Vũ Đức Thịnh',
      employeeCode: 'NV005',
      department: 'Phòng Kỹ thuật & CNTT',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '04/05/2026 - 08/05/2026',
      amountLabel: '05 Ngày',
      reason: 'Nghỉ phép năm về thăm gia đình tại Thái Bình',
      signedDate: 'Hà Nội, ngày 28 tháng 04 năm 2026',
      approver: 'Nguyễn Minh Quân',
    }),
    createdAt: '2026-04-28',
    approvedBy: 'Nguyễn Minh Quân',
  },
  {
    id: 'rec-402',
    employeeId: 'emp-5',
    type: 'annual_leave',
    startDate: '2026-10-12',
    endDate: '2026-10-17',
    amount: 5.5,
    reason: 'Nghỉ phép chuẩn bị lễ cưới của em trai ruột',
    attachmentTitle: 'Đơn xin nghỉ phép - Vũ Đức Thịnh (T10/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/10-118',
      employeeName: 'Vũ Đức Thịnh',
      employeeCode: 'NV005',
      department: 'Phòng Kỹ thuật & CNTT',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '12/10/2026 - 17/10/2026',
      amountLabel: '5.5 Ngày',
      reason: 'Nghỉ phép chuẩn bị lễ cưới của em trai ruột',
      signedDate: 'Hà Nội, ngày 08 tháng 10 năm 2026',
      approver: 'Nguyễn Minh Quân',
    }),
    createdAt: '2026-10-08',
    approvedBy: 'Nguyễn Minh Quân',
  },
  {
    id: 'rec-403',
    employeeId: 'emp-5',
    type: 'late_early',
    startDate: '2026-11-03',
    endDate: '2026-11-03',
    amount: 1.5,
    reason: 'Đi muộn 1.5 giờ do hỏng xe trên cầu Vĩnh Tuy giờ cao điểm',
    attachmentTitle: 'Phiếu xác nhận đi muộn - Vũ Đức Thịnh (03/11/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'PHIẾU XÁC NHẬN ĐI MUỘN / VỀ SỚM',
      docNumber: 'DM-2026/11-004',
      employeeName: 'Vũ Đức Thịnh',
      employeeCode: 'NV005',
      department: 'Phòng Kỹ thuật & CNTT',
      leaveTypeLabel: 'Đi muộn / Về sớm (Ghi nhận số giờ)',
      dateRange: 'Ngày 03/11/2026 (08:00 - 09:30)',
      amountLabel: '1.5 Giờ',
      reason: 'Hỏng xe máy trên cầu Vĩnh Tuy vào giờ cao điểm buổi sáng',
      signedDate: 'Hà Nội, ngày 03 tháng 11 năm 2026',
      approver: 'Trần Thu Trang',
      stampText: 'ĐÃ GHI NHẬN CÔNG',
    }),
    createdAt: '2026-11-03',
    approvedBy: 'Trần Thu Trang',
  },

  // Employee 2 (Trần Thu Trang) - Annual leave in May & Nov
  {
    id: 'rec-501',
    employeeId: 'emp-2',
    type: 'annual_leave',
    startDate: '2026-05-18',
    endDate: '2026-05-19',
    amount: 2,
    reason: 'Nghỉ phép năm giải quyết công việc cá nhân',
    attachmentTitle: 'Đơn xin nghỉ phép - Trần Thu Trang (T5/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/05-060',
      employeeName: 'Trần Thu Trang',
      employeeCode: 'NV002',
      department: 'Phòng Hành chính - Nhân sự',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '18/05/2026 - 19/05/2026',
      amountLabel: '02 Ngày',
      reason: 'Nghỉ phép năm giải quyết công việc cá nhân',
      signedDate: 'Hà Nội, ngày 15 tháng 05 năm 2026',
      approver: 'Nguyễn Minh Quân',
    }),
    createdAt: '2026-05-15',
    approvedBy: 'Nguyễn Minh Quân',
  },
  {
    id: 'rec-502',
    employeeId: 'emp-2',
    type: 'annual_leave',
    startDate: '2026-11-09',
    endDate: '2026-11-09',
    amount: 1,
    reason: 'Nghỉ phép năm họp phụ huynh và làm căn cước cho con',
    attachmentTitle: 'Đơn xin nghỉ phép - Trần Thu Trang (09/11/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/11-138',
      employeeName: 'Trần Thu Trang',
      employeeCode: 'NV002',
      department: 'Phòng Hành chính - Nhân sự',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: 'Ngày 09/11/2026',
      amountLabel: '01 Ngày',
      reason: 'Họp phụ huynh và làm thủ tục hành chính cho con',
      signedDate: 'Hà Nội, ngày 07 tháng 11 năm 2026',
      approver: 'Nguyễn Minh Quân',
    }),
    createdAt: '2026-11-07',
    approvedBy: 'Nguyễn Minh Quân',
  },

  // Employee 7 (Hoàng Gia Bảo) - Late arrivals in Nov 2026 & Regime leave in Oct
  {
    id: 'rec-601',
    employeeId: 'emp-7',
    type: 'regime_leave',
    regimeSubtype: 'Hiếu / Hỷ',
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    amount: 3,
    reason: 'Nghỉ chế độ kết hôn theo quy định Bộ luật Lao động (3 ngày hưởng nguyên lương)',
    attachmentTitle: 'Đơn xin nghỉ chế độ kết hôn - Hoàng Gia Bảo',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN ĐĂNG KÝ NGHỈ CHẾ ĐỘ (HIẾU / HỶ)',
      docNumber: 'CD-2026/10-022',
      employeeName: 'Hoàng Gia Bảo',
      employeeCode: 'NV007',
      department: 'Phòng Kinh doanh & CSKH',
      leaveTypeLabel: 'Nghỉ chế độ (Kết hôn - Không trừ phép năm)',
      dateRange: '05/10/2026 - 07/10/2026',
      amountLabel: '03 Ngày',
      reason: 'Nghỉ chế độ kết hôn theo quy định Luật Lao động',
      signedDate: 'Hà Nội, ngày 01 tháng 10 năm 2026',
      approver: 'Trần Thu Trang',
    }),
    createdAt: '2026-10-01',
    approvedBy: 'Trần Thu Trang',
  },
  {
    id: 'rec-602',
    employeeId: 'emp-7',
    type: 'late_early',
    startDate: '2026-11-07',
    endDate: '2026-11-07',
    amount: 1,
    reason: 'Đi muộn 1 giờ do tắc đường mưa lớn khu vực Ngã Tư Sở',
    attachmentTitle: 'Phiếu xác nhận đi muộn - Hoàng Gia Bảo (07/11/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'PHIẾU XÁC NHẬN ĐI MUỘN / VỀ SỚM',
      docNumber: 'DM-2026/11-009',
      employeeName: 'Hoàng Gia Bảo',
      employeeCode: 'NV007',
      department: 'Phòng Kinh doanh & CSKH',
      leaveTypeLabel: 'Đi muộn / Về sớm (Ghi nhận số giờ)',
      dateRange: 'Ngày 07/11/2026 (08:00 - 09:00)',
      amountLabel: '1.0 Giờ',
      reason: 'Tắc đường cục bộ do mưa lớn tại nút giao Ngã Tư Sở',
      signedDate: 'Hà Nội, ngày 07 tháng 11 năm 2026',
      approver: 'Trần Thu Trang',
      stampText: 'ĐÃ GHI NHẬN CÔNG',
    }),
    createdAt: '2026-11-07',
    approvedBy: 'Trần Thu Trang',
  },
  {
    id: 'rec-603',
    employeeId: 'emp-7',
    type: 'late_early',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    amount: 2,
    reason: 'Xin về sớm 2 giờ giải quyết công việc tại ngân hàng',
    attachmentTitle: 'Phiếu xác nhận về sớm - Hoàng Gia Bảo (10/11/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'PHIẾU XÁC NHẬN ĐI MUỘN / VỀ SỚM',
      docNumber: 'DM-2026/11-014',
      employeeName: 'Hoàng Gia Bảo',
      employeeCode: 'NV007',
      department: 'Phòng Kinh doanh & CSKH',
      leaveTypeLabel: 'Đi muộn / Về sớm (Ghi nhận số giờ)',
      dateRange: 'Ngày 10/11/2026 (15:30 - 17:30)',
      amountLabel: '2.0 Giờ',
      reason: 'Về sớm giải quyết thủ tục giải ngân tại ngân hàng Vietcombank',
      signedDate: 'Hà Nội, ngày 10 tháng 11 năm 2026',
      approver: 'Trần Thu Trang',
      stampText: 'ĐÃ GHI NHẬN CÔNG',
    }),
    createdAt: '2026-11-10',
    approvedBy: 'Trần Thu Trang',
  },

  // Employee 8 (Bùi Phương Thảo) - Annual leave & Late in Nov
  {
    id: 'rec-701',
    employeeId: 'emp-8',
    type: 'annual_leave',
    startDate: '2026-07-22',
    endDate: '2026-07-24',
    amount: 3,
    reason: 'Nghỉ phép năm đi du lịch hè Phú Quốc',
    attachmentTitle: 'Đơn xin nghỉ phép - Bùi Phương Thảo (T7/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/07-091',
      employeeName: 'Bùi Phương Thảo',
      employeeCode: 'NV008',
      department: 'Phòng Hành chính - Nhân sự',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '22/07/2026 - 24/07/2026',
      amountLabel: '03 Ngày',
      reason: 'Nghỉ phép năm đi du lịch hè Phú Quốc',
      signedDate: 'Hà Nội, ngày 18 tháng 07 năm 2026',
      approver: 'Trần Thu Trang',
    }),
    createdAt: '2026-07-18',
    approvedBy: 'Trần Thu Trang',
  },
  {
    id: 'rec-702',
    employeeId: 'emp-8',
    type: 'late_early',
    startDate: '2026-11-12',
    endDate: '2026-11-12',
    amount: 0.5,
    reason: 'Đi muộn 0.5 giờ do đưa con đi tiêm chủng buổi sáng',
    attachmentTitle: 'Phiếu xác nhận đi muộn - Bùi Phương Thảo (12/11/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'PHIẾU XÁC NHẬN ĐI MUỘN / VỀ SỚM',
      docNumber: 'DM-2026/11-018',
      employeeName: 'Bùi Phương Thảo',
      employeeCode: 'NV008',
      department: 'Phòng Hành chính - Nhân sự',
      leaveTypeLabel: 'Đi muộn / Về sớm (Ghi nhận số giờ)',
      dateRange: 'Ngày 12/11/2026 (08:00 - 08:30)',
      amountLabel: '0.5 Giờ',
      reason: 'Đưa con đi tiêm chủng vắc-xin định kỳ buổi sáng',
      signedDate: 'Hà Nội, ngày 12 tháng 11 năm 2026',
      approver: 'Trần Thu Trang',
      stampText: 'ĐÃ GHI NHẬN CÔNG',
    }),
    createdAt: '2026-11-12',
    approvedBy: 'Trần Thu Trang',
  },

  // Employee 1 (Nguyễn Minh Quân) - Annual leave in Apr
  {
    id: 'rec-801',
    employeeId: 'emp-1',
    type: 'annual_leave',
    startDate: '2026-04-10',
    endDate: '2026-04-11',
    amount: 2,
    reason: 'Nghỉ phép năm giải quyết việc gia đình',
    attachmentTitle: 'Đơn xin nghỉ phép - Nguyễn Minh Quân (T4/2026)',
    attachmentUrl: createLeaveSlipSvgDataUri({
      docTitle: 'ĐƠN XIN NGHỈ PHÉP NĂM',
      docNumber: 'NP-2026/04-039',
      employeeName: 'Nguyễn Minh Quân',
      employeeCode: 'NV001',
      department: 'Ban Giám đốc & Quản lý',
      leaveTypeLabel: 'Nghỉ phép năm (Hưởng nguyên lương)',
      dateRange: '10/04/2026 - 11/04/2026',
      amountLabel: '02 Ngày',
      reason: 'Nghỉ phép năm giải quyết việc gia đình',
      signedDate: 'Hà Nội, ngày 08 tháng 04 năm 2026',
      approver: 'Hội đồng Quản trị',
    }),
    createdAt: '2026-04-08',
    approvedBy: 'Hội đồng Quản trị',
  },
];
