import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Employee } from '../types/hr';

export interface OvertimeExportTaskBlock {
  id: string;
  overtimeDate?: string;
  reasonVi: string;
  reasonKr: string;
  startTime: string;
  endTime: string;
  selectedEmployeeIds: string[];
}

export interface OvertimeExportPayload {
  department: string;
  overtimeDate: string;
  blocks: OvertimeExportTaskBlock[];
  employees: Employee[];
}

const FONT_NAME = 'Times New Roman';

const THIN_BLACK_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

/**
 * Chuyển đổi giờ định dạng "16:10" sang chuẩn biểu mẫu TV-PSGC2022 "16h10"
 */
export function formatTimeToFormStyle(timeStr: string): string {
  if (!timeStr) return '';
  if (timeStr.includes('h')) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}h${parts[1]}`;
  }
  return timeStr;
}

/**
 * Chuyển đổi ngày định dạng YYYY-MM-DD sang DD/MM/YYYY
 */
export function formatDateToFormStyle(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Định dạng nhãn Bộ phận song ngữ Việt - Hàn chuẩn biểu mẫu TV-PSGC2022
 */
export function formatDepartmentHeaderLabel(department: string): string {
  if (!department || department === 'ALL' || department.toLowerCase().includes('kỹ thuật')) {
    return 'Bộ phận 부서: Kỹ Thuật 기술';
  }
  return `Bộ phận 부서: ${department} 기술`;
}

/**
 * Ghép nội dung Lý do (VN\nKR) chuẩn cho ô gộp Cột 3
 */
export function buildCombinedReasonText(reasonVi: string, reasonKr: string): string {
  const viLines = (reasonVi || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const krLines = (reasonKr || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (viLines.length === 0 && krLines.length === 0) return '';
  if (viLines.length > 1 && viLines.length === krLines.length) {
    const interleaved: string[] = [];
    for (let i = 0; i < viLines.length; i += 1) {
      interleaved.push(viLines[i]);
      interleaved.push(`  ${krLines[i]}`);
    }
    return interleaved.join('\n');
  }

  return [viLines.join('\n'), krLines.join('\n')].filter(Boolean).join('\n');
}

/**
 * Lớp Dịch vụ Xuất Excel Phiếu Đề Nghị Làm Thêm (TV-PSGC2022)
 * Tuân thủ nguyên tắc OOP & Single Responsibility Principle.
 * Hỗ trợ gộp nhiều ngày làm thêm vào cùng một phiếu, lặp lại tiêu đề bảng và reset No theo từng ngày.
 */
export class OvertimeExportService {
  async exportExcel(payload: OvertimeExportPayload): Promise<void> {
    const { department, overtimeDate, blocks, employees } = payload;
    const empById = new Map<string, Employee>(employees.map((e) => [e.id, e]));

    // Gom các block theo từng overtimeDate và sắp xếp tăng dần
    const mapByDate = new Map<string, OvertimeExportTaskBlock[]>();
    const effectiveBlocks =
      blocks.length > 0
        ? blocks
        : [
            {
              id: 'empty-block',
              overtimeDate: overtimeDate || '2026-11-16',
              reasonVi: '',
              reasonKr: '',
              startTime: '16:10',
              endTime: '20:10',
              selectedEmployeeIds: [],
            },
          ];

    for (const b of effectiveBlocks) {
      const d = b.overtimeDate || overtimeDate || '2026-11-16';
      if (!mapByDate.has(d)) {
        mapByDate.set(d, []);
      }
      mapByDate.get(d)!.push(b);
    }

    const sortedDates = Array.from(mapByDate.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Transon Viet nam Co., Ltd';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('TV-PSGC2022', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.35,
          right: 0.35,
          top: 0.4,
          bottom: 0.4,
          header: 0.2,
          footer: 0.2,
        },
      },
      views: [{ showGridLines: true }],
    });

    // Thiết lập độ rộng 7 cột chuẩn biểu mẫu TV-PSGC2022
    worksheet.columns = [
      { key: 'no', width: 6 }, // Cột 1 (A): No
      { key: 'fullName', width: 25 }, // Cột 2 (B): Danh sách làm thêm / 명단
      { key: 'reason', width: 38 }, // Cột 3 (C): Lý do làm thêm / 잔업. 특근사유
      { key: 'startTime', width: 12 }, // Cột 4 (D): Giờ bắt đầu / 시작
      { key: 'endTime', width: 12 }, // Cột 5 (E): Giờ kết thúc / 종료
      { key: 'totalTime', width: 13 }, // Cột 6 (F): Tổng thời gian / 총 시간
      { key: 'signature', width: 13 }, // Cột 7 (G): Ký nhận / 싸인
    ];

    // =========================================================================
    // 1. VẼ HEADER: DÒNG TRÊN CÙNG, TIÊU ĐỀ LỚN & BẢNG CHỮ KÝ GÓC PHẢI
    // =========================================================================

    // Dòng 1: "Transon Viet nam Co., Ltd" (trái) và "Biểu mẫu số: TV-PSGC2022" (phải)
    worksheet.mergeCells('A1:C1');
    const compCell = worksheet.getCell('A1');
    compCell.value = 'Transon Viet nam Co., Ltd';
    compCell.font = { name: FONT_NAME, size: 11, bold: false };
    compCell.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells('D1:G1');
    const formCodeCell = worksheet.getCell('D1');
    formCodeCell.value = 'Biểu mẫu số: TV-PSGC2022';
    formCodeCell.font = { name: FONT_NAME, size: 11, bold: false };
    formCodeCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 18;

    // Góc phải (D2:G6) vẽ bảng chữ ký (Người lập, Kiểm tra, Phê duyệt)
    const approvalHeadersRow2: Array<{ col: string; text: string }> = [
      { col: 'D', text: '결 / xác' },
      { col: 'E', text: '작성' },
      { col: 'F', text: '검사' },
      { col: 'G', text: '승인' },
    ];
    const approvalHeadersRow3: Array<{ col: string; text: string }> = [
      { col: 'D', text: '재 / nhận' },
      { col: 'E', text: 'Người lập' },
      { col: 'F', text: 'Kiểm tra' },
      { col: 'G', text: 'Phê duyệt' },
    ];

    worksheet.getRow(2).height = 16;
    worksheet.getRow(3).height = 16;
    worksheet.getRow(4).height = 18;
    worksheet.getRow(5).height = 18;
    worksheet.getRow(6).height = 18;

    for (const item of approvalHeadersRow2) {
      const cell = worksheet.getCell(`${item.col}2`);
      cell.value = item.text;
      cell.font = { name: FONT_NAME, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BLACK_BORDER;
    }

    for (const item of approvalHeadersRow3) {
      const cell = worksheet.getCell(`${item.col}3`);
      cell.value = item.text;
      cell.font = { name: FONT_NAME, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BLACK_BORDER;
    }

    // Gộp ô trống ký nhận từ dòng 4 đến dòng 6 cho các cột D, E, F, G
    for (const colLetter of ['D', 'E', 'F', 'G']) {
      worksheet.mergeCells(`${colLetter}4:${colLetter}6`);
      for (let r = 4; r <= 6; r += 1) {
        const c = worksheet.getCell(`${colLetter}${r}`);
        c.border = THIN_BLACK_BORDER;
      }
    }

    // Tiêu đề lớn bên trái (A3:C5): "PHIẾU ĐỀ NGHỊ LÀM THÊM \n 잔업. 특근 신청서"
    worksheet.mergeCells('A3:C5');
    const titleCell = worksheet.getCell('A3');
    titleCell.value = 'PHIẾU ĐỀ NGHỊ LÀM THÊM\n잔업. 특근 신청서';
    titleCell.font = { name: FONT_NAME, size: 14, bold: true };
    titleCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    };

    // Header 7 cột chuẩn của bảng
    const tableHeadersVi = [
      'No',
      'Danh sách làm thêm',
      'Lý do làm thêm',
      'Giờ bắt đầu',
      'Giờ kết thúc',
      'Tổng thời gian',
      'Ký nhận',
    ];
    const tableHeadersKr = [
      '',
      '명단',
      '잔업. 특근사유',
      '시작',
      '종료',
      '총 시간',
      '싸인',
    ];

    let currentRowIndex = 7;

    // =========================================================================
    // 2. VẼ DỮ LIỆU TỪNG NGÀY: NGÀY 1 & CÁC NGÀY TIẾP THEO (TỰ ĐỘNG CHÈN PHÂN CÁCH)
    // =========================================================================
    for (let dateIdx = 0; dateIdx < sortedDates.length; dateIdx += 1) {
      const curDate = sortedDates[dateIdx];
      const dateBlocks = mapByDate.get(curDate) || [];

      if (dateIdx === 0) {
        // Dòng Bộ phận (trái) và Ngày làm thêm (phải) cho ngày đầu tiên
        worksheet.getRow(currentRowIndex).height = 20;
        worksheet.mergeCells(`A${currentRowIndex}:C${currentRowIndex}`);
        const deptCell = worksheet.getCell(`A${currentRowIndex}`);
        deptCell.value = formatDepartmentHeaderLabel(department);
        deptCell.font = { name: FONT_NAME, size: 11, bold: false };
        deptCell.alignment = { vertical: 'middle', horizontal: 'left' };

        worksheet.mergeCells(`D${currentRowIndex}:G${currentRowIndex}`);
        const dateCell = worksheet.getCell(`D${currentRowIndex}`);
        dateCell.value = formatDateToFormStyle(curDate);
        dateCell.font = { name: FONT_NAME, size: 11, bold: true };
        dateCell.alignment = { vertical: 'middle', horizontal: 'right' };
        currentRowIndex += 1;
      } else {
        // Với các ngày tiếp theo: Tự động chèn 1 hàng phân cách hiển thị ngày [DD/MM/YYYY] căn phải
        worksheet.getRow(currentRowIndex).height = 22;
        worksheet.mergeCells(`D${currentRowIndex}:G${currentRowIndex}`);
        const subDateCell = worksheet.getCell(`D${currentRowIndex}`);
        subDateCell.value = formatDateToFormStyle(curDate);
        subDateCell.font = { name: FONT_NAME, size: 11, bold: true };
        subDateCell.alignment = { vertical: 'middle', horizontal: 'right' };
        currentRowIndex += 1;
      }

      // Ngay bên dưới lặp lại 2 dòng tiêu đề cột của bảng
      const headerRowVi = worksheet.getRow(currentRowIndex);
      headerRowVi.height = 18;
      const headerRowKr = worksheet.getRow(currentRowIndex + 1);
      headerRowKr.height = 18;

      for (let colIdx = 1; colIdx <= 7; colIdx += 1) {
        const cellVi = headerRowVi.getCell(colIdx);
        cellVi.value = tableHeadersVi[colIdx - 1];
        cellVi.font = { name: FONT_NAME, size: 10, bold: false };
        cellVi.alignment = { vertical: 'middle', horizontal: 'center' };
        cellVi.border = THIN_BLACK_BORDER;

        const cellKr = headerRowKr.getCell(colIdx);
        cellKr.value = tableHeadersKr[colIdx - 1];
        cellKr.font = { name: FONT_NAME, size: 10, bold: false };
        cellKr.alignment = { vertical: 'middle', horizontal: 'center' };
        cellKr.border = THIN_BLACK_BORDER;
      }
      currentRowIndex += 2;

      // Reset cột No đếm lại từ 1 cho ngày mới
      let sequentialNo = 1;

      for (const block of dateBlocks) {
        const participantIds =
          block.selectedEmployeeIds.length > 0
            ? block.selectedEmployeeIds
            : ['__EMPTY_PARTICIPANT__'];

        const startRow = currentRowIndex;
        const endRow = currentRowIndex + participantIds.length - 1;

        const combinedReason = buildCombinedReasonText(
          block.reasonVi,
          block.reasonKr
        );
        const formattedStart = formatTimeToFormStyle(block.startTime);
        const formattedEnd = formatTimeToFormStyle(block.endTime);

        for (let i = 0; i < participantIds.length; i += 1) {
          const empId = participantIds[i];
          const emp = empById.get(empId);
          const rowNumber = currentRowIndex + i;
          const row = worksheet.getRow(rowNumber);
          row.height = 24;

          // Cột (1): No (đếm lại từ 1 theo ngày)
          const cellNo = row.getCell(1);
          cellNo.value = sequentialNo;
          cellNo.font = { name: FONT_NAME, size: 10 };
          cellNo.alignment = { vertical: 'middle', horizontal: 'center' };

          // Cột (2): Danh sách làm thêm (Họ và tên nhân viên)
          const cellName = row.getCell(2);
          cellName.value = emp ? emp.fullName : '';
          cellName.font = { name: FONT_NAME, size: 10 };
          cellName.alignment = { vertical: 'middle', horizontal: 'left' };

          // Cột (3): Lý do làm thêm (sẽ được gộp ô nếu block có từ 2 người trở lên)
          const cellReason = row.getCell(3);
          cellReason.value = combinedReason;
          cellReason.font = { name: FONT_NAME, size: 10 };
          cellReason.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true,
          };

          // Cột (4): Giờ bắt đầu - HIỂN THỊ TRÊN TỪNG DÒNG NHÂN VIÊN
          const cellStart = row.getCell(4);
          cellStart.value = formattedStart;
          cellStart.font = { name: FONT_NAME, size: 10, bold: true };
          cellStart.alignment = { vertical: 'middle', horizontal: 'center' };

          // Cột (5): Giờ kết thúc - HIỂN THỊ TRÊN TỪNG DÒNG NHÂN VIÊN
          const cellEnd = row.getCell(5);
          cellEnd.value = formattedEnd;
          cellEnd.font = { name: FONT_NAME, size: 10, bold: true };
          cellEnd.alignment = { vertical: 'middle', horizontal: 'center' };

          // Cột (6): Tổng thời gian - Từng dòng nhân viên
          const cellTotal = row.getCell(6);
          cellTotal.value = '';
          cellTotal.font = { name: FONT_NAME, size: 10 };
          cellTotal.alignment = { vertical: 'middle', horizontal: 'center' };

          // Cột (7): Ký nhận - Từng dòng nhân viên
          const cellSign = row.getCell(7);
          cellSign.value = '';
          cellSign.font = { name: FONT_NAME, size: 10 };
          cellSign.alignment = { vertical: 'middle', horizontal: 'center' };

          // Kẻ khung viền đen nét liền toàn bộ 7 cột trên dòng này
          for (let colIdx = 1; colIdx <= 7; colIdx += 1) {
            row.getCell(colIdx).border = THIN_BLACK_BORDER;
          }

          sequentialNo += 1;
        }

        // Cột Lý do làm thêm gộp ô (rowSpan) theo số nhân sự của nhóm đó (Cột 3)
        // Các cột Giờ bắt đầu (4) và Giờ kết thúc (5) hiển thị trên từng dòng nhân viên, không gộp
        if (endRow > startRow) {
          worksheet.mergeCells(startRow, 3, endRow, 3);
          for (let r = startRow; r <= endRow; r += 1) {
            worksheet.getRow(r).getCell(3).border = THIN_BLACK_BORDER;
          }
        }

        currentRowIndex = endRow + 1;
      }
    }

    // =========================================================================
    // 3. VẼ FOOTER: GHI CHÚ DÀI BẰNG TIẾNG VIỆT VÀ TIẾNG HÀN DƯỚI CÙNG
    // =========================================================================
    const noteRow1Idx = currentRowIndex;
    const noteRow2Idx = currentRowIndex + 1;
    const noteRow3Idx = currentRowIndex + 2;

    worksheet.mergeCells(`A${noteRow1Idx}:G${noteRow1Idx}`);
    const noteCell1 = worksheet.getCell(`A${noteRow1Idx}`);
    noteCell1.value = 'Ghi chú 비고';
    noteCell1.font = { name: FONT_NAME, size: 10 };
    noteCell1.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(noteRow1Idx).height = 17;

    worksheet.mergeCells(`A${noteRow2Idx}:G${noteRow2Idx}`);
    const noteCell2 = worksheet.getCell(`A${noteRow2Idx}`);
    noteCell2.value =
      '1) Nếu phát sinh dài hạn ghi rõ vào đây: từ năm 2022/........./............~ 2022/........./ ............';
    noteCell2.font = { name: FONT_NAME, size: 10 };
    noteCell2.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(noteRow2Idx).height = 17;

    worksheet.mergeCells(`A${noteRow3Idx}:G${noteRow3Idx}`);
    const noteCell3 = worksheet.getCell(`A${noteRow3Idx}`);
    noteCell3.value =
      'Phát sinh giờ ghi ở biểu trên/ 긴시간 발생할 경우 는 여기서 기록할것';
    noteCell3.font = { name: FONT_NAME, size: 10 };
    noteCell3.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(noteRow3Idx).height = 17;

    // Xuất buffer và tải xuống bằng file-saver
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const dateSuffix =
      sortedDates.length > 1
        ? `${sortedDates[0].replace(/[^0-9-]/g, '')}_den_${sortedDates[sortedDates.length - 1].replace(/[^0-9-]/g, '')}`
        : (sortedDates[0] || '2026-11-16').replace(/[^0-9-]/g, '');
    saveAs(blob, `Phieu_Tang_Ca_TV-PSGC2022_${dateSuffix}.xlsx`);
  }
}

export const overtimeExportService = new OvertimeExportService();
