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
 * Normalizes a date string (YYYY-MM-DD or DD/MM/YYYY) into YYYY-MM-DD
 */
function normalizeDateInput(raw: string | undefined, fallback = ''): string {
  const s = (raw || '').trim();
  if (!s) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmY = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmY) {
    const dd = dmY[1].padStart(2, '0');
    const mm = dmY[2].padStart(2, '0');
    const yyyy = dmY[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return fallback;
}

/**
 * Exports Employee Directory to an Excel-compatible file (.xls with UTF-8 BOM & styling)
 * Title: DANH SÁCH NHÂN VIÊN PHÒNG KỸ THUẬT
 * Columns: STT, Mã nhân viên, Họ tên, Ngày sinh, Giới tính, Địa chỉ, Số CCCD, Ngày cấp CCCD, Nhóm / Bộ phận, Chức danh/Vị trí
 */
export function exportEmployeesToExcel(employees: Employee[]): void {
  const rowsHtml = employees
    .map(
      (emp, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="text-align:center;font-weight:bold;color:#0D9488;">${escapeHtml(emp.employeeCode)}</td>
        <td style="font-weight:bold;">${escapeHtml(emp.fullName)}</td>
        <td style="text-align:center;">${escapeHtml(emp.dob ? formatDateVN(emp.dob) : '')}</td>
        <td style="text-align:center;">${escapeHtml(emp.gender)}</td>
        <td>${escapeHtml(emp.address)}</td>
        <td style="mso-number-format:'\\@';text-align:center;">${escapeHtml(emp.cccd)}</td>
        <td style="text-align:center;">${escapeHtml(emp.cccdDate ? formatDateVN(emp.cccdDate) : '')}</td>
        <td>${escapeHtml(emp.department)}</td>
        <td>${escapeHtml(emp.position || 'Nhân viên')}</td>
      </tr>`
    )
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8" />
      <style>
        table { border-collapse: collapse; font-family: Times New Roman, Arial, sans-serif; font-size: 11pt; }
        th { background-color: #0F232E; color: #FFFFFF; font-weight: bold; padding: 8px 12px; border: 1px solid #334155; }
        td { padding: 6px 10px; border: 1px solid #CBD5E1; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th colspan="10" style="background-color:#FFFFFF;color:#0F232E;font-size:14pt;font-weight:bold;text-align:center;padding:12px;border:none;">
              DANH SÁCH NHÂN VIÊN PHÒNG KỸ THUẬT
            </th>
          </tr>
          <tr>
            <th>STT</th>
            <th>Mã nhân viên</th>
            <th>Họ tên</th>
            <th>Ngày sinh</th>
            <th>Giới tính</th>
            <th>Địa chỉ</th>
            <th>Số CCCD</th>
            <th>Ngày cấp CCCD</th>
            <th>Nhóm / Bộ phận</th>
            <th>Chức danh/Vị trí</th>
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
  triggerBlobDownload(
    blob,
    `Danh_Sach_Nhan_Vien_Phong_Ky_Thuat_${new Date().toISOString().slice(0, 10)}.xls`
  );
}

/**
 * Downloads a clean CSV/Excel template file that users can fill and import back.
 * Synchronized columns: STT, Mã nhân viên, Họ tên, Ngày sinh, Giới tính, Địa chỉ, Số CCCD, Ngày cấp CCCD, Nhóm / Bộ phận, Chức danh/Vị trí
 */
export function downloadEmployeeTemplateExcel(): void {
  const headers = [
    'STT',
    'Mã nhân viên',
    'Họ tên',
    'Ngày sinh',
    'Giới tính',
    'Địa chỉ',
    'Số CCCD',
    'Ngày cấp CCCD',
    'Nhóm / Bộ phận',
    'Chức danh/Vị trí',
  ];
  const sampleRows = [
    [
      '1',
      'NV001',
      'Trịnh Quốc Khánh',
      '1996-03-21',
      'Nam',
      'Khu Công Nghiệp Lương Sơn, Xã Lương Sơn, Tỉnh Phú Thọ',
      '001096012345',
      '2021-05-10',
      'Phòng Kỹ thuật & CNTT',
      'Trưởng nhóm',
    ],
    [
      '2',
      'NV002',
      'Lương Thị Mai Hương',
      '1998-10-12',
      'Nữ',
      'Phường Tân Hòa, TP. Hòa Bình, Tỉnh Phú Thọ',
      '001198067890',
      '2022-08-15',
      'Phòng Kỹ thuật & CNTT',
      'Nhân viên',
    ],
  ];

  const csvContent = [
    headers.join(','),
    ...sampleRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerBlobDownload(blob, 'File_Mau_Nhap_Danh_Sach_Nhan_Vien.csv');
}

/**
 * Parses an uploaded CSV/Excel text file into new Employee records
 */
export async function parseEmployeesFromUploadedFile(
  file: File,
  existingCount: number,
  defaultAnnualLeaveQuota: number = 12
): Promise<Employee[]> {
  const text = await file.text();
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  // Detect if header starts with STT
  const headerCols = lines[0]
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((c) => c.replace(/^"|"$/g, '').trim().toLowerCase());
  const hasSttColumn =
    headerCols[0] === 'stt' || headerCols[0] === 'số thứ tự';

  const parsed: Employee[] = [];
  const colors = [
    ['#0F232E', '#0D9488'],
    ['#0369A1', '#0EA5E9'],
    ['#5B21B6', '#8B5CF6'],
    ['#B45309', '#F59E0B'],
    ['#BE123C', '#F43F5E'],
  ];

  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i]
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((c) => c.replace(/^"|"$/g, '').trim());

    const cols = hasSttColumn ? rawCols.slice(1) : rawCols;

    if (cols.length < 2 || !cols[1]) continue;

    // Expected order after STT:
    // [0] Mã nhân viên, [1] Họ tên, [2] Ngày sinh, [3] Giới tính, [4] Địa chỉ, [5] Số CCCD, [6] Ngày cấp CCCD, [7] Nhóm / Bộ phận, [8] Chức danh/Vị trí
    const code =
      cols[0] ||
      `NV${String(existingCount + parsed.length + 1).padStart(3, '0')}`;
    const fullName = cols[1];
    const dob = normalizeDateInput(cols[2], '1995-01-01');
    const rawGender = cols[3] || 'Nam';
    const gender: Gender =
      rawGender.toLowerCase().includes('nữ') ||
      rawGender.toLowerCase().includes('nu')
        ? 'Nữ'
        : rawGender.toLowerCase().includes('khác')
        ? 'Khác'
        : 'Nam';

    const address = cols[4] || '';
    const cccd = cols[5] || '';
    const cccdDate = normalizeDateInput(cols[6], '');
    const department = cols[7] || 'Phòng Kỹ thuật & CNTT';
    const position = cols[8] || 'Nhân viên';

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
      cccdDate,
      phone: '',
      address,
      department,
      position,
      joinDate: new Date().toISOString().slice(0, 10),
      standardAnnualLeave: defaultAnnualLeaveQuota,
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
