import {
  DepartmentGroup,
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
function escapeHtml(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Helper to return "-" when a string value is empty, null, undefined, or "-"
 */
function displayOrDash(val?: string | null): string {
  if (!val) return '-';
  const trimmed = val.trim();
  return !trimmed || trimmed === '-' || trimmed === '—' ? '-' : trimmed;
}

/**
 * Normalizes a date string (YYYY-MM-DD or DD/MM/YYYY) into YYYY-MM-DD.
 * Returns fallback (default '') when empty or invalid.
 */
export function normalizeDateInput(raw: string | undefined, fallback = ''): string {
  const s = (raw || '').trim();
  if (!s || s === '-' || s === '—') return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const isoFlex = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoFlex) {
    return `${isoFlex[1]}-${isoFlex[2].padStart(2, '0')}-${isoFlex[3].padStart(2, '0')}`;
  }
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
 * Full 12 Columns: STT, Mã nhân viên, Họ tên, Ngày sinh, Giới tính, Địa chỉ, Số CCCD, Ngày cấp CCCD, Nhóm / Bộ phận, Chức danh, Ngày vào, Trạng thái
 */
export function exportEmployeesToExcel(
  employees: Employee[],
  registeredGroups?: DepartmentGroup[]
): void {
  const validGroupSet = registeredGroups
    ? new Set(registeredGroups.map((g) => g.name))
    : null;

  const rowsHtml = employees
    .map((emp, idx) => {
      const dobDisplay = emp.dob ? formatDateVN(emp.dob) : '-';
      const genderDisplay = displayOrDash(emp.gender);
      const addressDisplay = displayOrDash(emp.address);
      const cccdDisplay = displayOrDash(emp.cccd);
      const cccdDateDisplay = emp.cccdDate ? formatDateVN(emp.cccdDate) : '-';
      const rawDept =
        validGroupSet && emp.department && !validGroupSet.has(emp.department)
          ? ''
          : emp.department;
      const deptDisplay = displayOrDash(rawDept);
      const posDisplay = displayOrDash(emp.position);
      const joinDateDisplay = emp.joinDate ? formatDateVN(emp.joinDate) : '-';
      const statusDisplay = displayOrDash(emp.status || 'Đang làm việc');

      return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="text-align:center;font-weight:bold;color:#0D9488;">${escapeHtml(displayOrDash(emp.employeeCode))}</td>
        <td style="font-weight:bold;">${escapeHtml(displayOrDash(emp.fullName))}</td>
        <td style="text-align:center;">${escapeHtml(dobDisplay)}</td>
        <td style="text-align:center;">${escapeHtml(genderDisplay)}</td>
        <td style="text-align:${addressDisplay === '-' ? 'center' : 'left'};">${escapeHtml(addressDisplay)}</td>
        <td style="mso-number-format:'\\@';text-align:center;">${escapeHtml(cccdDisplay)}</td>
        <td style="text-align:center;">${escapeHtml(cccdDateDisplay)}</td>
        <td style="text-align:${deptDisplay === '-' ? 'center' : 'left'};">${escapeHtml(deptDisplay)}</td>
        <td style="text-align:${posDisplay === '-' ? 'center' : 'left'};">${escapeHtml(posDisplay)}</td>
        <td style="text-align:center;">${escapeHtml(joinDateDisplay)}</td>
        <td style="text-align:center;">${escapeHtml(statusDisplay)}</td>
      </tr>`;
    })
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
            <th colspan="12" style="background-color:#FFFFFF;color:#0F232E;font-size:14pt;font-weight:bold;text-align:center;padding:12px;border:none;">
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
            <th>Chức danh</th>
            <th>Ngày vào</th>
            <th>Trạng thái</th>
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
 * Exact synchronized columns: STT, Mã nhân viên, Họ tên, Ngày sinh, Giới tính, Địa chỉ, Số CCCD, Ngày cấp CCCD, Nhóm / Bộ phận, Chức danh, Ngày vào, Trạng thái
 */
export function downloadEmployeeTemplateExcel(
  registeredGroups?: DepartmentGroup[]
): void {
  const sampleDept = registeredGroups?.[0]?.name || '';
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
    'Chức danh',
    'Ngày vào',
    'Trạng thái',
  ];
  const sampleRows = [
    [
      '1',
      'NV001',
      'Trịnh Quốc Khánh',
      '1996-03-21',
      'Nam',
      'Khu Công Nghiệp Lương Sơn, Xã Lương Sơn, Phú Thọ',
      '001096012345',
      '2021-05-10',
      sampleDept,
      'Trưởng nhóm',
      '2023-02-15',
      'Đang làm việc',
    ],
    [
      '2',
      'NV002',
      'Lương Thị Mai Hương',
      '',
      'Nữ',
      '',
      '',
      '',
      sampleDept,
      'Nhân viên',
      '2024-06-01',
      'Đang làm việc',
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

export interface ExcelImportValidationResult {
  employees: Employee[];
  duplicateCodes: string[];
  missingRequiredRows: number[];
}

function cleanCsvCell(raw: string | undefined): string {
  const s = (raw || '').replace(/^"|"$/g, '').trim();
  if (s === '-' || s === '—') return '';
  return s;
}

/**
 * Pure parser for CSV/Excel text into validated Employee records.
 * - Requires ONLY Mã nhân viên and Họ tên. All other fields are optional (stored as '' if blank).
 * - Checks for duplicate Mã nhân viên against existingEmployees and within the file itself.
 * - Validates Nhóm / Bộ phận against registeredGroups (if not in registeredGroups, sets department to '').
 */
export function parseEmployeesFromCsvText(
  text: string,
  existingEmployees: Employee[] = [],
  registeredGroups: DepartmentGroup[] = [],
  defaultAnnualLeaveQuota: number = 12
): ExcelImportValidationResult {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return { employees: [], duplicateCodes: [], missingRequiredRows: [] };
  }

  const headerCols = lines[0]
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((c) => c.replace(/^"|"$/g, '').trim().toLowerCase());

  const hasSttColumn =
    headerCols[0] === 'stt' || headerCols[0] === 'số thứ tự';
  const offset = hasSttColumn ? 1 : 0;

  const findColIdx = (keywords: string[], fallbackIdx: number): number => {
    const found = headerCols.findIndex((h) =>
      keywords.some((kw) => h.includes(kw))
    );
    return found !== -1 ? found : fallbackIdx;
  };

  const codeIdx = findColIdx(['mã nhân viên', 'ma nhan vien', 'mã nv'], offset + 0);
  const nameIdx = findColIdx(['họ tên', 'họ và tên', 'ho ten'], offset + 1);
  const dobIdx = findColIdx(['ngày sinh', 'ngay sinh'], offset + 2);
  const genderIdx = findColIdx(['giới tính', 'gioi tinh'], offset + 3);
  const addressIdx = findColIdx(['địa chỉ', 'dia chi'], offset + 4);
  const cccdIdx = headerCols.findIndex(
    (h) => (h.includes('cccd') || h.includes('cmnd')) && !h.includes('ngày') && !h.includes('ngay')
  );
  const resolvedCccdIdx = cccdIdx !== -1 ? cccdIdx : offset + 5;
  const cccdDateIdx = findColIdx(['ngày cấp', 'ngay cap'], offset + 6);
  const deptIdx = findColIdx(['nhóm', 'bộ phận', 'phòng ban', 'bo phan'], offset + 7);
  const posIdx = findColIdx(['chức danh', 'vị trí', 'chuc danh', 'vi tri'], offset + 8);
  const joinDateIdx = findColIdx(['ngày vào', 'ngay vao', 'join_date'], offset + 9);
  const statusIdx = findColIdx(['trạng thái', 'trang thai', 'status'], offset + 10);

  const existingCodeSet = new Set(
    existingEmployees.map((e) => e.employeeCode.trim().toUpperCase())
  );
  const seenInFileCodeSet = new Set<string>();
  const duplicateCodeSet = new Set<string>();
  const missingRequiredRows: number[] = [];

  const parsed: Employee[] = [];
  const colors = [
    ['#0F232E', '#0D9488'],
    ['#0369A1', '#0EA5E9'],
    ['#5B21B6', '#8B5CF6'],
    ['#B45309', '#F59E0B'],
    ['#BE123C', '#F43F5E'],
  ];

  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (rawCols.every((c) => cleanCsvCell(c) === '')) continue;

    const code = cleanCsvCell(rawCols[codeIdx]).toUpperCase();
    const fullName = cleanCsvCell(rawCols[nameIdx]);

    if (!code || !fullName) {
      missingRequiredRows.push(i + 1);
      continue;
    }

    if (existingCodeSet.has(code) || seenInFileCodeSet.has(code)) {
      duplicateCodeSet.add(code);
      continue;
    }
    seenInFileCodeSet.add(code);

    const dob = normalizeDateInput(cleanCsvCell(rawCols[dobIdx]), '');
    const rawGender = cleanCsvCell(rawCols[genderIdx]).toLowerCase();
    const gender: Gender = !rawGender
      ? ''
      : rawGender.includes('nữ') || rawGender.includes('nu')
      ? 'Nữ'
      : rawGender.includes('khác') || rawGender.includes('khac')
      ? 'Khác'
      : rawGender.includes('nam')
      ? 'Nam'
      : '';

    const address = cleanCsvCell(rawCols[addressIdx]);
    const cccd = cleanCsvCell(rawCols[resolvedCccdIdx]);
    const cccdDate = normalizeDateInput(cleanCsvCell(rawCols[cccdDateIdx]), '');

    const rawDept = cleanCsvCell(rawCols[deptIdx]);
    const matchedGroup = rawDept
      ? registeredGroups.find(
          (g) => g.name.trim().toLowerCase() === rawDept.toLowerCase()
        )
      : undefined;
    const department = matchedGroup ? matchedGroup.name : '';

    // Support both [Nhóm, Chức danh, Ngày vào] and [Nhóm, Ngày vào, Chức danh]
    let rawJoinDate = cleanCsvCell(rawCols[joinDateIdx]);
    let rawPosition = cleanCsvCell(rawCols[posIdx]);
    if (
      !normalizeDateInput(rawJoinDate, '') &&
      normalizeDateInput(rawPosition, '')
    ) {
      const temp = rawJoinDate;
      rawJoinDate = rawPosition;
      rawPosition = temp;
    }
    const joinDate = normalizeDateInput(rawJoinDate, '');
    const position = rawPosition;

    const rawStatus = cleanCsvCell(rawCols[statusIdx]).toLowerCase();
    const status: WorkStatus = rawStatus.includes('đã nghỉ')
      ? 'Đã nghỉ việc'
      : rawStatus.includes('tạm nghỉ')
      ? 'Tạm nghỉ'
      : rawStatus.includes('thai sản')
      ? 'Nghỉ thai sản'
      : rawStatus.includes('thử việc')
      ? 'Đang thử việc'
      : 'Đang làm việc';

    const nameParts = fullName.split(' ').filter(Boolean);
    const initials =
      nameParts.length >= 2
        ? `${nameParts[nameParts.length - 2][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        : fullName.slice(0, 2).toUpperCase();
    const [bg, accent] = colors[(existingEmployees.length + i) % colors.length];

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
      joinDate,
      standardAnnualLeave: defaultAnnualLeaveQuota,
      status,
      avatarUrl: createAvatarSvgDataUri(initials, bg, accent),
    });
  }

  return {
    employees: parsed,
    duplicateCodes: Array.from(duplicateCodeSet),
    missingRequiredRows,
  };
}

/**
 * Parses an uploaded CSV/Excel text file into validated Employee records
 */
export async function parseEmployeesFromUploadedFile(
  file: File,
  existingEmployees: Employee[],
  registeredGroups: DepartmentGroup[] = [],
  defaultAnnualLeaveQuota: number = 12
): Promise<ExcelImportValidationResult> {
  const text = await file.text();
  return parseEmployeesFromCsvText(
    text,
    existingEmployees,
    registeredGroups,
    defaultAnnualLeaveQuota
  );
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
