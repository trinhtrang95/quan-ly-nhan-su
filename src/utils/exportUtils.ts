import {
  Employee,
  EmployeeAnnualMatrixRow,
  Gender,
  LeaveRecord,
  MatrixViewMode,
  WorkStatus,
} from '../types/hr';
import { createAvatarSvgDataUri } from '../data/mockData';
import { formatDateVN, LEAVE_TYPE_META } from './hrCalculations';

/**
 * Triggers a browser file download from a Blob
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Escapes HTML special characters for SpreadsheetML / HTML table export
 */
function escapeHtml(val: string | number | undefined): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Exports Employee Directory to an Excel-compatible file (.xls with UTF-8 BOM & styling)
 */
export function exportEmployeesToExcel(employees: Employee[]): void {
  const rowsHtml = employees
    .map(
      (emp, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="font-weight:bold;color:#0D9488;">${escapeHtml(emp.employeeCode)}</td>
        <td style="font-weight:bold;">${escapeHtml(emp.fullName)}</td>
        <td style="text-align:center;">${escapeHtml(formatDateVN(emp.dob))}</td>
        <td style="text-align:center;">${escapeHtml(emp.gender)}</td>
        <td style="mso-number-format:'\\@';">${escapeHtml(emp.cccd)}</td>
        <td style="mso-number-format:'\\@';">${escapeHtml(emp.phone)}</td>
        <td>${escapeHtml(emp.address)}</td>
        <td>${escapeHtml(emp.department)}</td>
        <td style="text-align:center;font-weight:bold;">${emp.standardAnnualLeave}</td>
        <td style="text-align:center;">${escapeHtml(emp.status)}</td>
      </tr>`
    )
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8" />
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
        th { background-color: #0F232E; color: #FFFFFF; font-weight: bold; padding: 8px 12px; border: 1px solid #334155; }
        td { padding: 6px 10px; border: 1px solid #CBD5E1; }
      </style>
    </head>
    <body>
      <h2>HR PRO - DANH SÁCH HỒ SƠ NHÂN SỰ</h2>
      <p>Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} | Tổng số: ${employees.length} nhân sự</p>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>MÃ NV</th>
            <th>HỌ VÀ TÊN</th>
            <th>NGÀY SINH</th>
            <th>GIỚI TÍNH</th>
            <th>SỐ CCCD</th>
            <th>SỐ ĐIỆN THOẠI</th>
            <th>ĐỊA CHỈ THƯỜNG TRÚ</th>
            <th>NHÓM / BỘ PHẬN</th>
            <th>TỔNG PHÉP NĂM</th>
            <th>TRẠNG THÁI</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerBlobDownload(blob, `HR_PRO_Danh_Sach_Nhan_Su_${new Date().toISOString().slice(0, 10)}.xls`);
}

/**
 * Downloads a clean CSV/Excel template file that users can fill and import back
 */
export function downloadEmployeeTemplateExcel(): void {
  const headers = [
    'MaNV',
    'HoTen',
    'NgaySinh(YYYY-MM-DD)',
    'GioiTinh(Nam/Nu)',
    'SoCCCD',
    'SoDienThoai',
    'DiaChi',
    'NhomBoPhan',
    'TongPhepNam',
  ];
  const sampleRows = [
    [
      'NV009',
      'Trịnh Quốc Khánh',
      '1996-03-21',
      'Nam',
      '001096012345',
      '0904112233',
      'Số 15 Thái Hà, Đống Đa, Hà Nội',
      'Phòng Kỹ thuật & CNTT',
      '12',
    ],
    [
      'NV010',
      'Lương Thị Mai Hương',
      '1998-10-12',
      'Nữ',
      '001198067890',
      '0988776655',
      'KĐT Times City, Hai Bà Trưng, Hà Nội',
      'Phòng Tài chính - Kế toán',
      '12',
    ],
  ];

  const csvContent = [
    headers.join(','),
    ...sampleRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerBlobDownload(blob, 'HR_PRO_File_Mau_Nhap_Nhan_Su.csv');
}

/**
 * Parses an uploaded CSV/Excel text file into new Employee records
 */
export async function parseEmployeesFromUploadedFile(
  file: File,
  existingCount: number
): Promise<Employee[]> {
  const text = await file.text();
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const parsed: Employee[] = [];
  const colors = [
    ['#0F232E', '#0D9488'],
    ['#0369A1', '#0EA5E9'],
    ['#5B21B6', '#8B5CF6'],
    ['#B45309', '#F59E0B'],
    ['#BE123C', '#F43F5E'],
  ];

  for (let i = 1; i < lines.length; i++) {
    // Split CSV respecting quotes
    const cols = lines[i]
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((c) => c.replace(/^"|"$/g, '').trim());

    if (cols.length < 2 || !cols[1]) continue;

    const code = cols[0] || `NV${String(existingCount + parsed.length + 1).padStart(3, '0')}`;
    const fullName = cols[1];
    const dob = cols[2] && /^\d{4}-\d{2}-\d{2}$/.test(cols[2]) ? cols[2] : '1995-01-01';
    const rawGender = cols[3] || 'Nam';
    const gender: Gender =
      rawGender.toLowerCase().includes('nữ') || rawGender.toLowerCase().includes('nu')
        ? 'Nữ'
        : 'Nam';
    const cccd = cols[4] || '001095000000';
    const phone = cols[5] || '0900000000';
    const address = cols[6] || 'Hà Nội';
    const department = cols[7] || 'Phòng Kỹ thuật & CNTT';
    const standardAnnualLeave = Number(cols[8]) > 0 ? Number(cols[8]) : 12;

    const nameParts = fullName.split(' ').filter(Boolean);
    const initials =
      nameParts.length >= 2
        ? `${nameParts[nameParts.length - 2][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        : fullName.slice(0, 2).toUpperCase();
    const [bg, accent] = colors[(existingCount + i) % colors.length];

    parsed.push({
      id: `emp-imp-${Date.now()}-${i}`,
      employeeCode: code,
      fullName,
      dob,
      gender,
      cccd,
      phone,
      address,
      department,
      position: 'Chuyên viên',
      joinDate: new Date().toISOString().slice(0, 10),
      standardAnnualLeave,
      status: 'Đang làm việc' as WorkStatus,
      avatarUrl: createAvatarSvgDataUri(initials, bg, accent),
    });
  }

  return parsed;
}

/**
 * Exports the 12-Month Annual Matrix Report to an Excel file (.xls)
 */
export function exportAnnualMatrixToExcel(
  rows: EmployeeAnnualMatrixRow[],
  year: number,
  viewMode: MatrixViewMode
): void {
  const modeTitleMap: Record<MatrixViewMode, string> = {
    all: 'TỔNG HỢP TẤT CẢ (PHÉP NĂM, KHÔNG LƯƠNG, GIỜ ĐI MUỘN)',
    annual_leave: 'THỐNG KÊ NGHỈ PHÉP NĂM',
    unpaid_leave: 'THỐNG KÊ NGHỈ KHÔNG LƯƠNG',
    late_early: 'THỐNG KÊ GIỜ ĐI MUỘN / VỀ SỚM',
  };

  const monthHeaders = Array.from({ length: 12 }, (_, idx) => `<th>THÁNG ${idx + 1}</th>`).join('');

  const bodyRows = rows
    .map((row, idx) => {
      const monthCells = Array.from({ length: 12 }, (_, mIdx) => {
        const m = mIdx + 1;
        const cell = row.months[m];
        if (!cell) return '<td>-</td>';

        if (viewMode === 'annual_leave') {
          return `<td style="text-align:center;">${cell.annualLeaveDays > 0 ? cell.annualLeaveDays : '-'}</td>`;
        }
        if (viewMode === 'unpaid_leave') {
          return `<td style="text-align:center;">${cell.unpaidLeaveDays > 0 ? cell.unpaidLeaveDays : '-'}</td>`;
        }
        if (viewMode === 'late_early') {
          return `<td style="text-align:center;">${cell.lateHours > 0 ? `${cell.lateHours}h` : '-'}</td>`;
        }

        const parts: string[] = [];
        if (cell.annualLeaveDays > 0) parts.push(`${cell.annualLeaveDays}P`);
        if (cell.unpaidLeaveDays > 0) parts.push(`${cell.unpaidLeaveDays}KL`);
        if (cell.regimeLeaveDays > 0) parts.push(`${cell.regimeLeaveDays}CĐ`);
        if (cell.lateHours > 0) parts.push(`${cell.lateHours}hM`);
        return `<td style="text-align:center;">${parts.length > 0 ? parts.join(' | ') : '-'}</td>`;
      }).join('');

      const remainStyle =
        row.remainingAnnualLeave <= 0
          ? 'background-color:#FEF2F2;color:#DC2626;font-weight:bold;text-align:center;'
          : row.remainingAnnualLeave <= 2
          ? 'background-color:#FFFBEB;color:#D97706;font-weight:bold;text-align:center;'
          : 'background-color:#F0FDFA;color:#0F766E;font-weight:bold;text-align:center;';

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td style="font-weight:bold;color:#0D9488;">${escapeHtml(row.employee.employeeCode)}</td>
          <td style="font-weight:bold;">${escapeHtml(row.employee.fullName)}</td>
          <td>${escapeHtml(row.employee.department)}</td>
          <td style="text-align:center;font-weight:bold;">${row.employee.standardAnnualLeave}</td>
          ${monthCells}
          <td style="text-align:center;font-weight:bold;background-color:#F8FAFC;">${row.totalAnnualUsed}</td>
          <td style="${remainStyle}">${row.remainingAnnualLeave}</td>
          <td style="text-align:center;background-color:#FFFBEB;">${row.totalUnpaidDays}</td>
          <td style="text-align:center;background-color:#FEF2F2;">${row.totalLateHours}h (${row.totalLateCount} lần)</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8" />
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
        th { background-color: #0F232E; color: #FFFFFF; font-weight: bold; padding: 8px; border: 1px solid #334155; }
        td { padding: 6px 8px; border: 1px solid #CBD5E1; }
      </style>
    </head>
    <body>
      <h2>HR PRO - BÁO CÁO MA TRẬN TỒN PHÉP &amp; CHẤM CÔNG NĂM ${year}</h2>
      <p>Chế độ báo cáo: <b>${modeTitleMap[viewMode]}</b> | Ngày kết xuất: ${new Date().toLocaleDateString('vi-VN')}</p>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>MÃ NV</th>
            <th>HỌ VÀ TÊN</th>
            <th>NHÓM / BỘ PHẬN</th>
            <th>TỔNG PHÉP NĂM</th>
            ${monthHeaders}
            <th>ĐÃ NGHỈ PHÉP</th>
            <th>TỒN PHÉP CÒN LẠI</th>
            <th>TỔNG KHÔNG LƯƠNG</th>
            <th>TỔNG GIỜ ĐI MUỘN</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerBlobDownload(blob, `HR_PRO_Bao_Cao_Ton_Phep_Nam_${year}.xls`);
}

/**
 * Exports Leave & Late records history to Excel
 */
export function exportLeaveRecordsToExcel(
  records: LeaveRecord[],
  employees: Employee[]
): void {
  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));
  const rowsHtml = records
    .map((rec, idx) => {
      const emp = empMap.get(rec.employeeId);
      const meta = LEAVE_TYPE_META[rec.type];
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td style="font-weight:bold;">${escapeHtml(emp?.employeeCode || '')}</td>
          <td style="font-weight:bold;">${escapeHtml(emp?.fullName || '')}</td>
          <td>${escapeHtml(emp?.department || '')}</td>
          <td>${escapeHtml(meta.label)}${rec.regimeSubtype ? ` (${escapeHtml(rec.regimeSubtype)})` : ''}</td>
          <td style="text-align:center;">${escapeHtml(formatDateVN(rec.startDate))}</td>
          <td style="text-align:center;">${escapeHtml(formatDateVN(rec.endDate))}</td>
          <td style="text-align:center;font-weight:bold;">${rec.amount} ${meta.unit}</td>
          <td>${escapeHtml(rec.reason)}</td>
          <td>${escapeHtml(rec.approvedBy)}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8" />
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
        th { background-color: #0F232E; color: #FFFFFF; font-weight: bold; padding: 8px; border: 1px solid #334155; }
        td { padding: 6px 8px; border: 1px solid #CBD5E1; }
      </style>
    </head>
    <body>
      <h2>HR PRO - NHẬT KÝ GHI CHÉP NGHỈ PHÉP &amp; ĐI MUỘN</h2>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>MÃ NV</th>
            <th>HỌ VÀ TÊN</th>
            <th>NHÓM / BỘ PHẬN</th>
            <th>LOẠI GHI CHÉP</th>
            <th>TỪ NGÀY</th>
            <th>ĐẾN NGÀY</th>
            <th>SỐ LƯỢNG</th>
            <th>LÝ DO CHI TIẾT</th>
            <th>NGƯỜI DUYỆT</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerBlobDownload(blob, `HR_PRO_Nhat_Ky_Nghi_Phep_Di_Muon_${new Date().toISOString().slice(0, 10)}.xls`);
}
