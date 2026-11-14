import React from 'react';
import { X, Printer, Download } from 'lucide-react';
import {
  Employee,
  EmployeeAnnualMatrixRow,
  MatrixViewMode,
} from '../types/hr';
import { formatDateVN } from '../utils/hrCalculations';

export type ReportPrintType = 'employees' | 'employees_sign' | 'annual_matrix';

interface PrintReportModalProps {
  isOpen: boolean;
  reportType: ReportPrintType;
  employees: Employee[];
  matrixRows: EmployeeAnnualMatrixRow[];
  year: number;
  viewMode: MatrixViewMode;
  onClose: () => void;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  reportType,
  employees,
  matrixRows,
  year,
  viewMode,
  onClose,
}) => {
  if (!isOpen) return null;

  const isSignList = reportType === 'employees_sign';
  const isFullEmployeeList = reportType === 'employees';
  const isCompactSignList = isSignList && employees.length < 50;

  const handleTriggerPrint = () => {
    window.print();
  };

  const handleDownloadPrintableHtml = () => {
    const contentEl = document.getElementById('printable-a4-sheet');
    if (!contentEl) return;

    const pageCss = isSignList
      ? isCompactSignList
        ? `@page { size: A4 portrait; margin: 8mm 10mm; }
           body { font-family: "Times New Roman", Times, serif; font-size: 10pt; line-height: 1.15; color: #000000; margin: 0; }
           h2 { font-family: "Times New Roman", Times, serif; font-size: 12pt; font-weight: bold; text-align: center; text-transform: uppercase; margin: 0 0 6px 0; }
           table { width: 100%; border-collapse: collapse; font-family: "Times New Roman", Times, serif; font-size: 10pt; line-height: 1.15; }
           th { font-weight: bold; padding: 4px 6px; border: 1px solid #000000; text-align: center; }
           td { padding: 3px 6px; border: 1px solid #000000; }
           .text-center { text-align: center; }
           .text-left { text-align: left; }`
        : `@page { size: A4 portrait; margin: 12mm 12mm 12mm 20mm; }
           body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.25; color: #000000; margin: 0; }
           h2 { font-family: "Times New Roman", Times, serif; font-size: 13pt; font-weight: bold; text-align: center; text-transform: uppercase; margin: 0 0 10px 0; }
           table { width: 100%; border-collapse: collapse; font-family: "Times New Roman", Times, serif; font-size: 11pt; }
           th { font-weight: bold; padding: 6px; border: 1px solid #000000; text-align: center; }
           td { padding: 5px 6px; border: 1px solid #000000; }
           .text-center { text-align: center; }
           .text-left { text-align: left; }`
      : `@page { size: A4 landscape; margin: 12mm; }
         body { font-family: "Times New Roman", Arial, sans-serif; color: #0F232E; margin: 12px; }
         h2 { font-size: 15pt; font-weight: bold; text-align: center; text-transform: uppercase; margin: 0 0 14px 0; }
         table { width: 100%; border-collapse: collapse; font-size: 11pt; margin-top: 10px; }
         th { background-color: #0F232E; color: #FFFFFF; padding: 7px 6px; border: 1px solid #334155; text-align: center; }
         td { padding: 6px; border: 1px solid #CBD5E1; text-align: center; }
         .text-left { text-align: left; }`;

    const docTitle = isSignList
      ? 'Danh_Sach_Ky_Nhan_Nhan_Vien_Phong_Ky_Thuat_A4'
      : isFullEmployeeList
      ? 'Danh_Sach_Nhan_Vien_Phong_Ky_Thuat_A4'
      : `Bao_Cao_Ton_Phep_Nam_${year}_A4_Landscape`;

    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>
    ${pageCss}
  </style>
</head>
<body>
  ${contentEl.innerHTML}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

    const blob = new Blob(['\uFEFF' + fullHtml], {
      type: 'text/html;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      {/* Dynamic @page rule for direct browser print */}
      <style>
        {isSignList
          ? isCompactSignList
            ? `@media print {
                 @page { size: A4 portrait; margin: 8mm 10mm; }
                 body { font-family: "Times New Roman", Times, serif !important; margin: 0 !important; }
                 #printable-a4-sheet { padding: 0 !important; max-height: none !important; overflow: visible !important; }
               }`
            : `@media print {
                 @page { size: A4 portrait; margin: 12mm 12mm 12mm 20mm; }
                 body { font-family: "Times New Roman", Times, serif !important; }
                 #printable-a4-sheet { padding: 0 !important; max-height: none !important; overflow: visible !important; }
               }`
          : `@media print {
               @page { size: A4 landscape; margin: 12mm; }
             }`}
      </style>

      <div
        className={`bg-white rounded-xl border border-slate-200 shadow-2xl w-full ${
          isSignList ? 'max-w-4xl' : 'max-w-6xl'
        } overflow-hidden my-auto`}
      >
        {/* Top Action Bar (hidden when printing) */}
        <div className="no-print bg-[#0F232E] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="print-modal-title" className="text-sm font-bold">
              {isSignList
                ? 'Xem trước Bản in PDF — Danh sách Ký nhận Nhân viên (Khổ dọc A4)'
                : isFullEmployeeList
                ? 'Xem trước Bản in PDF — DANH SÁCH NHÂN VIÊN PHÒNG KỸ THUẬT'
                : `Xem trước Bản in PDF — Ma trận Tồn phép Năm ${year} (Khổ ngang A4)`}
            </h3>
            <p className="text-xs text-slate-300">
              {isSignList
                ? isCompactSignList
                  ? `Đã tối ưu tự động vừa khít 100% trong 1 trang A4 duy nhất (${employees.length} nhân sự)`
                  : 'Chuẩn A4 dọc, sẵn sàng in hoặc lưu tệp PDF'
                : 'Sẵn sàng in trực tiếp hoặc lưu thành tệp PDF'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In ngay / Lưu PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPrintableHtml}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải bản in A4</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng xem trước bản in"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div
          id="printable-a4-sheet"
          className={`max-h-[80vh] overflow-y-auto bg-white text-slate-900 ${
            isSignList
              ? isCompactSignList
                ? 'py-[8mm] px-[10mm] font-serif text-[10pt] leading-[1.15]'
                : 'py-[12mm] pr-[12mm] pl-[20mm] font-serif text-[11pt] leading-[1.25]'
              : 'p-6 md:p-8'
          }`}
          style={
            isSignList
              ? { fontFamily: '"Times New Roman", Times, serif' }
              : undefined
          }
        >
          {/* Single Centered Title — No National Motto, No Company Header, No Signatures */}
          <div className={`text-center ${isCompactSignList ? 'mb-1.5' : 'mb-5'}`}>
            <h2
              data-testid="pdf-report-main-title"
              className={
                isSignList
                  ? isCompactSignList
                    ? 'text-[12pt] font-bold text-black uppercase tracking-wide m-0'
                    : 'text-[13pt] font-bold text-black uppercase tracking-wide'
                  : 'text-lg font-extrabold text-[#0F232E] uppercase tracking-wide'
              }
            >
              {reportType === 'annual_matrix'
                ? `BÁO CÁO TỔNG HỢP TỒN PHÉP NĂM & CHẤM CÔNG NĂM ${year}`
                : 'DANH SÁCH NHÂN VIÊN PHÒNG KỸ THUẬT'}
            </h2>
            {reportType === 'annual_matrix' && (
              <p className="text-xs text-slate-600 mt-1">
                {`Chế độ kết xuất: ${
                  viewMode === 'all'
                    ? 'Tổng hợp tất cả'
                    : viewMode === 'annual_leave'
                    ? 'Thống kê Phép năm'
                    : viewMode === 'unpaid_leave'
                    ? 'Thống kê Nghỉ không lương'
                    : 'Thống kê Giờ đi muộn'
                } | Tổng số: ${matrixRows.length} nhân sự`}
              </p>
            )}
          </div>

          {/* CASE 1: XUẤT PDF DANH SÁCH (KÝ NHẬN - TỐI ƯU GỌN TRÊN 1 TRANG A4 KHI < 50 NHÂN SỰ) */}
          {isSignList && (
            <div className="overflow-x-auto">
              <table
                data-testid="pdf-sign-list-table"
                className={`w-full border-collapse border border-black text-black ${
                  isCompactSignList ? 'text-[10pt] leading-[1.15]' : 'text-[11pt] leading-[1.25]'
                }`}
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                <thead>
                  <tr className="font-bold">
                    <th
                      style={{
                        width: '10%',
                        padding: isCompactSignList ? '4px 6px' : '6px',
                      }}
                      className="border border-black text-center"
                    >
                      STT
                    </th>
                    <th
                      style={{
                        width: '22%',
                        padding: isCompactSignList ? '4px 6px' : '6px',
                      }}
                      className="border border-black text-center"
                    >
                      Mã nhân viên
                    </th>
                    <th
                      style={{
                        width: '43%',
                        padding: isCompactSignList ? '4px 8px' : '6px 8px',
                      }}
                      className="border border-black text-left"
                    >
                      Họ tên
                    </th>
                    <th
                      style={{
                        width: '25%',
                        padding: isCompactSignList ? '4px 6px' : '6px',
                      }}
                      className="border border-black text-center"
                    >
                      Ký/Nhận
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => (
                    <tr key={emp.id}>
                      <td
                        style={{
                          padding: isCompactSignList ? '3px 6px' : '5px 6px',
                        }}
                        className="border border-black text-center"
                      >
                        {idx + 1}
                      </td>
                      <td
                        style={{
                          padding: isCompactSignList ? '3px 6px' : '5px 6px',
                        }}
                        className="border border-black text-center font-semibold"
                      >
                        {emp.employeeCode}
                      </td>
                      <td
                        style={{
                          padding: isCompactSignList ? '3px 8px' : '5px 8px',
                        }}
                        className="border border-black text-left"
                      >
                        {emp.fullName}
                      </td>
                      <td
                        style={{
                          padding: isCompactSignList ? '3px 6px' : '5px 6px',
                        }}
                        className="border border-black text-center"
                      >
                        {/* Cột Ký/Nhận để trống hoàn toàn cho nhân viên ký tay */}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CASE 2: XUẤT PDF BẢNG ĐẦY ĐỦ THÔNG TIN (12 CỘT ĐẦY ĐỦ 100%) */}
          {isFullEmployeeList && (
            <div className="overflow-x-auto">
              <table
                data-testid="pdf-full-employees-table"
                className="w-full text-left border-collapse text-xs border border-slate-300"
              >
                <thead>
                  <tr className="bg-[#0F232E] text-white text-[11px] font-bold">
                    <th className="p-2 border border-slate-600 text-center">
                      STT
                    </th>
                    <th className="p-2 border border-slate-600 text-center">
                      Mã nhân viên
                    </th>
                    <th className="p-2 border border-slate-600">Họ tên</th>
                    <th className="p-2 border border-slate-600 text-center">
                      Ngày sinh
                    </th>
                    <th className="p-2 border border-slate-600 text-center">
                      Giới tính
                    </th>
                    <th className="p-2 border border-slate-600">Địa chỉ</th>
                    <th className="p-2 border border-slate-600 text-center">
                      Số CCCD
                    </th>
                    <th className="p-2 border border-slate-600 text-center">
                      Ngày cấp CCCD
                    </th>
                    <th className="p-2 border border-slate-600">
                      Nhóm / Bộ phận
                    </th>
                    <th className="p-2 border border-slate-600">
                      Chức danh
                    </th>
                    <th className="p-2 border border-slate-600 text-center">
                      Ngày vào
                    </th>
                    <th className="p-2 border border-slate-600 text-center">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => {
                    const dobStr = emp.dob ? formatDateVN(emp.dob) : '-';
                    const genderStr = (emp.gender || '').trim() || '-';
                    const addrStr = (emp.address || '').trim() || '-';
                    const cccdStr = (emp.cccd || '').trim() || '-';
                    const cccdDateStr = emp.cccdDate
                      ? formatDateVN(emp.cccdDate)
                      : '-';
                    const deptStr = (emp.department || '').trim() || '-';
                    const posStr = (emp.position || '').trim() || '-';
                    const joinDateStr = emp.joinDate
                      ? formatDateVN(emp.joinDate)
                      : '-';
                    const statusStr = (emp.status || '').trim() || '-';

                    return (
                      <tr key={emp.id} className="border-b border-slate-200">
                        <td className="p-2 border border-slate-300 text-center font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-mono font-bold">
                          {emp.employeeCode || '-'}
                        </td>
                        <td className="p-2 border border-slate-300 font-semibold">
                          {emp.fullName || '-'}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-mono">
                          {dobStr}
                        </td>
                        <td className="p-2 border border-slate-300 text-center">
                          {genderStr}
                        </td>
                        <td
                          className={`p-2 border border-slate-300 ${
                            addrStr === '-' ? 'text-center text-slate-400' : ''
                          }`}
                        >
                          {addrStr}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-mono">
                          {cccdStr}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-mono">
                          {cccdDateStr}
                        </td>
                        <td
                          className={`p-2 border border-slate-300 ${
                            deptStr === '-' ? 'text-center text-slate-400' : ''
                          }`}
                        >
                          {deptStr}
                        </td>
                        <td
                          className={`p-2 border border-slate-300 ${
                            posStr === '-' ? 'text-center text-slate-400' : ''
                          }`}
                        >
                          {posStr}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-mono">
                          {joinDateStr}
                        </td>
                        <td className="p-2 border border-slate-300 text-center">
                          {statusStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* CASE 3: BÁO CÁO MA TRẬN TỒN PHÉP NĂM */}
          {reportType === 'annual_matrix' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] border border-slate-300">
                <thead>
                  <tr className="bg-[#0F232E] text-white uppercase">
                    <th className="p-1.5 border border-slate-600 text-center">
                      STT
                    </th>
                    <th className="p-1.5 border border-slate-600">Mã NV</th>
                    <th className="p-1.5 border border-slate-600">Họ tên</th>
                    <th className="p-1.5 border border-slate-600">Bộ phận</th>
                    <th className="p-1.5 border border-slate-600 text-center">
                      Tổng phép
                    </th>
                    {Array.from({ length: 12 }, (_, idx) => (
                      <th
                        key={idx + 1}
                        className="p-1.5 border border-slate-600 text-center font-mono"
                      >
                        T{idx + 1}
                      </th>
                    ))}
                    <th className="p-1.5 border border-slate-600 text-center">
                      Đã nghỉ
                    </th>
                    <th className="p-1.5 border border-slate-600 text-center">
                      Tồn phép
                    </th>
                    <th className="p-1.5 border border-slate-600 text-center">
                      K.Lương
                    </th>
                    <th className="p-1.5 border border-slate-600 text-center">
                      Đi muộn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row, idx) => (
                    <tr
                      key={row.employee.id}
                      className="border-b border-slate-200"
                    >
                      <td className="p-1.5 border border-slate-300 text-center font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-1.5 border border-slate-300 font-mono font-bold">
                        {row.employee.employeeCode}
                      </td>
                      <td className="p-1.5 border border-slate-300 font-semibold">
                        {row.employee.fullName}
                      </td>
                      <td className="p-1.5 border border-slate-300">
                        {row.employee.department}
                      </td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono font-bold">
                        {row.employee.standardAnnualLeave}
                      </td>
                      {Array.from({ length: 12 }, (_, mIdx) => {
                        const cell = row.months[mIdx + 1];
                        return (
                          <td
                            key={mIdx + 1}
                            className="p-1.5 border border-slate-300 text-center font-mono"
                          >
                            {cell.annualLeaveDays > 0
                              ? cell.annualLeaveDays
                              : '-'}
                          </td>
                        );
                      })}
                      <td className="p-1.5 border border-slate-300 text-center font-mono font-bold">
                        {row.totalAnnualUsed}
                      </td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono font-bold">
                        {row.remainingAnnualLeave}
                      </td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono">
                        {row.totalUnpaidDays}
                      </td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono">
                        {row.totalLateHours}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

