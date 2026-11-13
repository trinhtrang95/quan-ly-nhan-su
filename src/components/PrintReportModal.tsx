import React from 'react';
import { X, Printer, Download } from 'lucide-react';
import {
  Employee,
  EmployeeAnnualMatrixRow,
  MatrixViewMode,
} from '../types/hr';
import { formatDateVN } from '../utils/hrCalculations';

interface PrintReportModalProps {
  isOpen: boolean;
  reportType: 'employees' | 'annual_matrix';
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

  const handleTriggerPrint = () => {
    window.print();
  };

  const handleDownloadPrintableHtml = () => {
    const contentEl = document.getElementById('printable-a4-sheet');
    if (!contentEl) return;

    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${
    reportType === 'employees'
      ? 'Bao_Cao_Danh_Sach_Nhan_Su_A4'
      : `Bao_Cao_Ton_Phep_Nam_${year}_A4_Landscape`
  }</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; color: #0F232E; margin: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
    th { background-color: #0F232E; color: #FFFFFF; padding: 6px; border: 1px solid #334155; text-transform: uppercase; }
    td { padding: 5px 6px; border: 1px solid #CBD5E1; text-align: center; }
    .text-left { text-align: left; }
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
    a.download =
      reportType === 'employees'
        ? `HR_PRO_Bao_Cao_PDF_Danh_Sach_Nhan_Su.html`
        : `HR_PRO_Bao_Cao_PDF_Ton_Phep_Nam_${year}_A4.html`;
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-6xl overflow-hidden my-auto">
        {/* Top Action Bar (hidden when printing) */}
        <div className="no-print bg-[#0F232E] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="print-modal-title" className="text-sm font-bold">
              {reportType === 'employees'
                ? 'Xem trước Bản in PDF — Danh sách Hồ sơ Nhân sự (Khổ ngang A4)'
                : `Xem trước Bản in PDF — Ma trận Tồn phép Năm ${year} (Khổ ngang A4)`}
            </h3>
            <p className="text-xs text-slate-300">
              Định dạng chuẩn khổ ngang A4 sẵn sàng in hoặc lưu thành tệp PDF
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

        {/* Printable A4 Landscape Sheet */}
        <div
          id="printable-a4-sheet"
          className="p-6 md:p-8 max-h-[80vh] overflow-y-auto bg-white text-slate-900"
        >
          {/* Official Vietnamese Enterprise Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-slate-800">
            <div>
              <div className="text-xs font-bold uppercase text-slate-800">
                CÔNG TY CỔ PHẦN CÔNG NGHỆ &amp; DỊCH VỤ HR PRO
              </div>
              <div className="text-xs text-slate-600">
                PHÒNG HÀNH CHÍNH - NHÂN SỰ
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                Ngày xuất báo cáo: {new Date().toLocaleDateString('vi-VN')}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs font-bold uppercase text-slate-800">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </div>
              <div className="text-xs font-semibold text-slate-700">
                Độc lập - Tự do - Hạnh phúc
              </div>
            </div>
          </div>

          <div className="text-center my-5">
            <h2 className="text-lg font-extrabold text-[#0F232E] uppercase">
              {reportType === 'employees'
                ? 'BÁO CÁO DANH SÁCH TRÍCH NGANG HỒ SƠ NHÂN SỰ'
                : `BÁO CÁO TỔNG HỢP TỒN PHÉP NĂM & CHẤM CÔNG NĂM ${year}`}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {reportType === 'employees'
                ? `Tổng số nhân sự trong danh sách: ${employees.length} nhân sự`
                : `Chế độ kết xuất: ${
                    viewMode === 'all'
                      ? 'Tổng hợp tất cả'
                      : viewMode === 'annual_leave'
                      ? 'Thống kê Phép năm'
                      : viewMode === 'unpaid_leave'
                      ? 'Thống kê Nghỉ không lương'
                      : 'Thống kê Giờ đi muộn'
                  } | Tổng số: ${matrixRows.length} nhân sự`}
            </p>
          </div>

          {reportType === 'employees' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-[#0F232E] text-white uppercase text-[11px]">
                    <th className="p-2 border border-slate-600 text-center">STT</th>
                    <th className="p-2 border border-slate-600">Mã NV</th>
                    <th className="p-2 border border-slate-600">Họ và tên</th>
                    <th className="p-2 border border-slate-600 text-center">Ngày sinh</th>
                    <th className="p-2 border border-slate-600 text-center">Giới tính</th>
                    <th className="p-2 border border-slate-600">Số CCCD</th>
                    <th className="p-2 border border-slate-600">Số điện thoại</th>
                    <th className="p-2 border border-slate-600">Địa chỉ</th>
                    <th className="p-2 border border-slate-600">Nhóm / Bộ phận</th>
                    <th className="p-2 border border-slate-600 text-center">Phép năm</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => (
                    <tr key={emp.id} className="border-b border-slate-200">
                      <td className="p-2 border border-slate-300 text-center font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono font-bold">
                        {emp.employeeCode}
                      </td>
                      <td className="p-2 border border-slate-300 font-semibold">
                        {emp.fullName}
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-mono">
                        {formatDateVN(emp.dob)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        {emp.gender}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono">
                        {emp.cccd}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono">
                        {emp.phone}
                      </td>
                      <td className="p-2 border border-slate-300">{emp.address}</td>
                      <td className="p-2 border border-slate-300">
                        {emp.department}
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-bold">
                        {emp.standardAnnualLeave}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] border border-slate-300">
                <thead>
                  <tr className="bg-[#0F232E] text-white uppercase">
                    <th className="p-1.5 border border-slate-600 text-center">STT</th>
                    <th className="p-1.5 border border-slate-600">Mã NV</th>
                    <th className="p-1.5 border border-slate-600">Họ tên</th>
                    <th className="p-1.5 border border-slate-600">Bộ phận</th>
                    <th className="p-1.5 border border-slate-600 text-center">Tổng phép</th>
                    {Array.from({ length: 12 }, (_, idx) => (
                      <th
                        key={idx + 1}
                        className="p-1.5 border border-slate-600 text-center font-mono"
                      >
                        T{idx + 1}
                      </th>
                    ))}
                    <th className="p-1.5 border border-slate-600 text-center">Đã nghỉ</th>
                    <th className="p-1.5 border border-slate-600 text-center">Tồn phép</th>
                    <th className="p-1.5 border border-slate-600 text-center">K.Lương</th>
                    <th className="p-1.5 border border-slate-600 text-center">Đi muộn</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row, idx) => (
                    <tr key={row.employee.id} className="border-b border-slate-200">
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
                            {cell.annualLeaveDays > 0 ? cell.annualLeaveDays : '-'}
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

          {/* Signatures Block */}
          <div className="mt-8 grid grid-cols-3 text-center text-xs">
            <div>
              <div className="font-bold text-slate-800">NGƯỜI LẬP BIỂU</div>
              <div className="text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
              <div className="mt-14 font-semibold text-slate-800">Bùi Phương Thảo</div>
            </div>
            <div>
              <div className="font-bold text-slate-800">TRƯỞNG PHÒNG HC-NS</div>
              <div className="text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
              <div className="mt-14 font-semibold text-slate-800">Trần Thu Trang</div>
            </div>
            <div>
              <div className="font-bold text-slate-800">GIÁM ĐỐC PHÊ DUYỆT</div>
              <div className="text-[11px] text-slate-500">(Ký, đóng dấu)</div>
              <div className="mt-14 font-semibold text-slate-800">Nguyễn Minh Quân</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
