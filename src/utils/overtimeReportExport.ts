import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  formatOvertimeHoursVN,
  OvertimeMonthlyReportResult,
} from './overtimeReportService';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF14539E' } },
  left: { style: 'thin', color: { argb: 'FF3B73B8' } },
  bottom: { style: 'medium', color: { argb: 'FF0F3D75' } },
  right: { style: 'thin', color: { argb: 'FF3B73B8' } },
};

/**
 * Exports the Monthly Overtime Hours Report ("Giờ Tăng ca") to a formatted A4-landscape .xlsx file.
 * Column order: STT | Mã NV | Họ tên | Nhóm | Tổng | 1 | 2 | ... | daysInMonth
 */
export async function exportMonthlyOvertimeReportToExcel(
  report: OvertimeMonthlyReportResult,
  departmentLabel: string
): Promise<void> {
  const { year, month, daysInMonth, rows, dailyTotals, grandTotalHours } = report;
  const monthStr = String(month).padStart(2, '0');
  const totalCols = 5 + daysInMonth;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HR Pro';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`TangCa_T${monthStr}_${year}`, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ state: 'frozen', xSplit: 5, ySplit: 4 }],
  });

  // Title Row
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `BẢNG THỐNG KÊ GIỜ TĂNG CA THÁNG ${monthStr}/${year}`;
  titleCell.font = {
    name: 'Arial',
    size: 14,
    bold: true,
    color: { argb: 'FF14539E' },
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;

  // Subtitle Row
  sheet.mergeCells(2, 1, 2, totalCols);
  const subCell = sheet.getCell(2, 1);
  subCell.value = `Bộ phận / Nhóm: ${departmentLabel}   •   Số nhân sự: ${rows.length}   •   Tổng giờ tăng ca: ${formatOvertimeHoursVN(grandTotalHours, true)} giờ`;
  subCell.font = {
    name: 'Arial',
    size: 10,
    italic: true,
    color: { argb: 'FF475569' },
  };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  sheet.getRow(3).height = 6;

  // Header Row (Row 4)
  const headers: (string | number)[] = ['STT', 'Mã NV', 'Họ tên', 'Nhóm', 'Tổng'];
  for (let d = 1; d <= daysInMonth; d += 1) {
    headers.push(d);
  }
  const headerRow = sheet.getRow(4);
  headerRow.height = 24;
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: idx === 4 ? 'FF0F3D75' : 'FF14539E' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = HEADER_BORDER;
  });

  // Column widths
  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 13;
  sheet.getColumn(3).width = 24;
  sheet.getColumn(4).width = 15;
  sheet.getColumn(5).width = 9;
  for (let d = 1; d <= daysInMonth; d += 1) {
    sheet.getColumn(5 + d).width = 5.2;
  }

  // Data Rows
  rows.forEach((row, idx) => {
    const excelRow = sheet.getRow(5 + idx);
    excelRow.height = 20;
    const isEven = idx % 2 === 1;

    const baseValues: (string | number)[] = [
      row.stt,
      row.employeeCode,
      row.fullName,
      row.department,
      row.totalHours > 0 ? row.totalHours : '',
    ];

    baseValues.forEach((val, cIdx) => {
      const cell = excelRow.getCell(cIdx + 1);
      cell.value = val;
      cell.font = {
        name: 'Arial',
        size: 9.5,
        bold: cIdx === 4 && row.totalHours > 0,
        color: { argb: cIdx === 4 && row.totalHours > 0 ? 'FF14539E' : 'FF1E293B' },
      };
      cell.alignment = {
        horizontal: cIdx === 2 || cIdx === 3 ? 'left' : 'center',
        vertical: 'middle',
      };
      if (cIdx === 4) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: row.totalHours > 0 ? 'FFEFF6FF' : isEven ? 'FFF8FAFC' : 'FFFFFFFF' },
        };
        if (typeof val === 'number') {
          cell.numFmt = '0.##';
        }
      } else if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
      cell.border = THIN_BORDER;
    });

    for (let d = 1; d <= daysInMonth; d += 1) {
      const h = row.dailyHours[d] || 0;
      const cell = excelRow.getCell(5 + d);
      cell.value = h > 0 ? h : '';
      if (h > 0) {
        cell.numFmt = '0.##';
      }
      cell.font = {
        name: 'Arial',
        size: 9.5,
        bold: h > 0,
        color: { argb: h > 0 ? 'FF14539E' : 'FF94A3B8' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
      cell.border = THIN_BORDER;
    }
  });

  // Footer Summary Row
  const footerRowIdx = 5 + rows.length;
  const footerRow = sheet.getRow(footerRowIdx);
  footerRow.height = 24;
  sheet.mergeCells(footerRowIdx, 1, footerRowIdx, 4);

  const totalLabelCell = footerRow.getCell(1);
  totalLabelCell.value = 'TỔNG CỘNG (GIỜ)';
  totalLabelCell.font = {
    name: 'Arial',
    size: 10,
    bold: true,
    color: { argb: 'FF14539E' },
  };
  totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

  for (let c = 1; c <= 4; c += 1) {
    const cell = footerRow.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0ECFA' },
    };
    cell.border = THIN_BORDER;
  }

  const grandCell = footerRow.getCell(5);
  grandCell.value = grandTotalHours;
  grandCell.numFmt = '0.##';
  grandCell.font = {
    name: 'Arial',
    size: 10,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  grandCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF14539E' },
  };
  grandCell.alignment = { horizontal: 'center', vertical: 'middle' };
  grandCell.border = THIN_BORDER;

  for (let d = 1; d <= daysInMonth; d += 1) {
    const daySum = dailyTotals[d] || 0;
    const cell = footerRow.getCell(5 + d);
    cell.value = daySum > 0 ? daySum : '';
    if (daySum > 0) {
      cell.numFmt = '0.##';
    }
    cell.font = {
      name: 'Arial',
      size: 9.5,
      bold: true,
      color: { argb: daySum > 0 ? 'FF14539E' : 'FF94A3B8' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0ECFA' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN_BORDER;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `Thong_Ke_Gio_Tang_Ca_Thang_${monthStr}_${year}.xlsx`);
}
