import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Employee } from '../types/hr';
import {
  formatOvertimeDepartmentHeaderLabel,
} from './overtimeFormsService';

export interface OvertimeExportParticipant {
  employeeId: string;
  startTime: string;
  endTime: string;
}

export interface OvertimeExportTaskBlock {
  id: string;
  overtimeDate?: string;
  reasonVi: string;
  reasonKr: string;
  startTime: string;
  endTime: string;
  selectedEmployeeIds: string[];
  participants?: OvertimeExportParticipant[];
}

export interface OvertimeExportPayload {
  department: string;
  overtimeDate: string;
  blocks: OvertimeExportTaskBlock[];
  employees: Employee[];
  knownSubGroups?: string[];
}

const FONT_NAME = 'Times New Roman';

const THIN_BLACK_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const isTimeBold = (timeStr: string) => {
  if (!timeStr) return false;
  const cleanTime = timeStr.replace('h', ':');
  const [hours, minutes] = cleanTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return false;
  return hours * 60 + minutes >= 1210;
};

export function formatTimeToFormStyle(timeStr: string): string {
  if (!timeStr) return '';
  if (timeStr.includes('h')) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}h${parts[1]}`;
  }
  return timeStr;
}

export function formatDateToFormStyle(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function formatDepartmentHeaderLabel(
  department?: string,
  knownSubGroups: string[] = []
): string {
  return formatOvertimeDepartmentHeaderLabel(department, knownSubGroups);
}

export function buildCombinedReasonText(reasonVi: string, reasonKr: string): string {
  const viLines = (reasonVi || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const krLines = (reasonKr || '').split('\n').map((l) => l.trim()).filter(Boolean);

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

export class OvertimeExportService {
  async exportExcel(payload: OvertimeExportPayload): Promise<void> {
    const { department, overtimeDate, blocks, employees, knownSubGroups = [] } = payload;
    const empById = new Map<string, Employee>(employees.map((e) => [e.id, e]));
    const allKnownSubGroups = Array.from(
      new Set([
        ...knownSubGroups,
        ...employees.map((e) => (e.department || '').trim()).filter(Boolean),
      ])
    );

    const mapByDate = new Map<string, OvertimeExportTaskBlock[]>();
    const effectiveBlocks = blocks.length > 0 ? blocks : [
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
      if (!mapByDate.has(d)) mapByDate.set(d, []);
      mapByDate.get(d)!.push(b);
    }

    const sortedDates = Array.from(mapByDate.keys()).sort((a, b) => a.localeCompare(b));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Transon Viet nam Co., Ltd';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('TV-PSGC2022', {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: { left: 0.35, right: 0.35, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      },
      views: [{ showGridLines: true }],
    });

    worksheet.columns = [
      { key: 'colA', width: 6 },
      { key: 'colB', width: 20 },
      { key: 'colC', width: 28 },
      { key: 'colD', width: 5.5 },
      { key: 'colE', width: 10 },
      { key: 'colF', width: 10 },
      { key: 'colG', width: 10 },
      { key: 'colH', width: 9 },
      { key: 'colI', width: 9 },
    ];

    worksheet.mergeCells('A1:C1');
    const compCell = worksheet.getCell('A1');
    compCell.value = 'Transon Viet nam Co., Ltd';
    compCell.font = { name: FONT_NAME, size: 11, bold: false };
    compCell.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells('D1:I1');
    const formCodeCell = worksheet.getCell('D1');
    formCodeCell.value = 'Biểu mẫu số: TV-PSGC2022';
    formCodeCell.font = { name: FONT_NAME, size: 11, bold: false };
    formCodeCell.alignment = { vertical: 'middle', horizontal: 'right' };
    worksheet.getRow(1).height = 18;

    worksheet.getRow(2).height = 16;
    worksheet.getRow(3).height = 16;
    worksheet.getRow(4).height = 18;
    worksheet.getRow(5).height = 18;
    worksheet.getRow(6).height = 18;

    worksheet.mergeCells('D2:D6');
    const cellD2 = worksheet.getCell('D2');
    cellD2.value = '결\nxác\nnhận\n재';
    cellD2.font = { name: FONT_NAME, size: 10 };
    cellD2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cellD2.border = THIN_BLACK_BORDER;

    const signatureCols = ['E', 'F', 'G', 'H', 'I'];
    const krHeaders = ['작성', '검사', '검사', '검사', '승인'];
    const viHeaders = ['Người lập', 'Kiểm tra', 'Kiểm tra', 'Kiểm tra', 'Phê duyệt'];

    for (let c = 0; c < 5; c++) {
      const col = signatureCols[c];
      const cellKr = worksheet.getCell(`${col}2`);
      cellKr.value = krHeaders[c];
      cellKr.font = { name: FONT_NAME, size: 10 };
      cellKr.alignment = { vertical: 'middle', horizontal: 'center' };
      cellKr.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'dotted' } };

      const cellVi = worksheet.getCell(`${col}3`);
      cellVi.value = viHeaders[c];
      cellVi.font = { name: FONT_NAME, size: 10 };
      cellVi.alignment = { vertical: 'middle', horizontal: 'center' };
      cellVi.border = { top: { style: 'dotted' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };

      worksheet.mergeCells(`${col}4:${col}6`);
      const cellSign = worksheet.getCell(`${col}4`);
      cellSign.border = THIN_BLACK_BORDER;
    }

    worksheet.mergeCells('A2:C6');
    const titleCell = worksheet.getCell('A2');
    titleCell.value = 'PHIẾU ĐỀ NGHỊ LÀM THÊM\n잔업. 특근 신청서';
    titleCell.font = { name: FONT_NAME, size: 14, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    let currentRowIndex = 7;

    for (let dateIdx = 0; dateIdx < sortedDates.length; dateIdx += 1) {
      const curDate = sortedDates[dateIdx];
      const dateBlocks = mapByDate.get(curDate) || [];

      worksheet.getRow(currentRowIndex).height = dateIdx === 0 ? 20 : 24;
      worksheet.mergeCells(`A${currentRowIndex}:D${currentRowIndex}`);
      const deptCell = worksheet.getCell(`A${currentRowIndex}`);
      deptCell.value =
        dateIdx === 0
          ? formatDepartmentHeaderLabel(department, allKnownSubGroups)
          : '';
      deptCell.font = { name: FONT_NAME, size: 11, bold: false };
      deptCell.alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells(`E${currentRowIndex}:I${currentRowIndex}`);
      const dateCell = worksheet.getCell(`E${currentRowIndex}`);
      dateCell.value = formatDateToFormStyle(curDate);
      dateCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF000000' } };
      dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
      currentRowIndex += 1;

      const headerRowVi = worksheet.getRow(currentRowIndex);
      headerRowVi.height = 18;
      const headerRowKr = worksheet.getRow(currentRowIndex + 1);
      headerRowKr.height = 18;

      for (let colIdx = 1; colIdx <= 9; colIdx += 1) {
        headerRowVi.getCell(colIdx).border = THIN_BLACK_BORDER;
        headerRowKr.getCell(colIdx).border = THIN_BLACK_BORDER;
      }

      const mapHeader = (col: string, vi: string, kr: string) => {
        const cVi = headerRowVi.getCell(col);
        cVi.value = vi;
        cVi.font = { name: FONT_NAME, size: 10 };
        cVi.alignment = { vertical: 'middle', horizontal: 'center' };
        
        const cKr = headerRowKr.getCell(col);
        cKr.value = kr;
        cKr.font = { name: FONT_NAME, size: 10 };
        cKr.alignment = { vertical: 'middle', horizontal: 'center' };
      };

      mapHeader('A', 'No', '');
      mapHeader('B', 'Danh sách làm thêm', '명단');
      mapHeader('C', 'Lý do làm thêm', '잔업. 특근사유');
      mapHeader('F', 'Giờ bắt đầu', '시작');
      mapHeader('G', 'Giờ kết thúc', '종료');
      mapHeader('H', 'Tổng thời gian', '총 시간');
      mapHeader('I', 'Ký nhận', '싸인');

      worksheet.mergeCells(`C${currentRowIndex}:E${currentRowIndex}`);
      worksheet.mergeCells(`C${currentRowIndex + 1}:E${currentRowIndex + 1}`);
      currentRowIndex += 2;

      let sequentialNo = 1;

      for (const block of dateBlocks) {
        const participants: OvertimeExportParticipant[] =
          Array.isArray(block.participants) && block.participants.length > 0
            ? block.participants
            : block.selectedEmployeeIds.length > 0
            ? block.selectedEmployeeIds.map((id) => ({ employeeId: id, startTime: block.startTime, endTime: block.endTime }))
            : [{ employeeId: '__EMPTY__', startTime: block.startTime, endTime: block.endTime }];

        const startRow = currentRowIndex;
        const endRow = currentRowIndex + participants.length - 1;
        const combinedReason = buildCombinedReasonText(block.reasonVi, block.reasonKr);

        for (let i = 0; i < participants.length; i += 1) {
          const p = participants[i];
          const emp = empById.get(p.employeeId);
          const row = worksheet.getRow(currentRowIndex + i);
          row.height = 24;

          for (let colIdx = 1; colIdx <= 9; colIdx += 1) {
            row.getCell(colIdx).border = THIN_BLACK_BORDER;
          }

          const setCell = (col: string, val: string | number, bold = false, align: 'left' | 'center' = 'center', wrap = false) => {
            const cell = row.getCell(col);
            cell.value = val;
            cell.font = { name: FONT_NAME, size: 10, bold };
            cell.alignment = { vertical: 'middle', horizontal: align, wrapText: wrap };
          };

          setCell('A', sequentialNo);
          setCell('B', emp ? emp.fullName : '', false, 'left');
          setCell('C', combinedReason, false, 'left', true);
          setCell('F', formatTimeToFormStyle(p.startTime || block.startTime), isTimeBold(p.startTime || block.startTime));
          setCell('G', formatTimeToFormStyle(p.endTime || block.endTime), isTimeBold(p.endTime || block.endTime));
          setCell('H', '');
          setCell('I', '');

          sequentialNo += 1;
        }

        if (endRow >= startRow) {
          worksheet.mergeCells(`C${startRow}:E${endRow}`);
        }
        currentRowIndex = endRow + 1;
      }
    }

    const renderNote = (rowIdx: number, text: string) => {
      worksheet.mergeCells(`A${rowIdx}:I${rowIdx}`);
      const c = worksheet.getCell(`A${rowIdx}`);
      c.value = text;
      c.font = { name: FONT_NAME, size: 10 };
      c.alignment = { vertical: 'middle', horizontal: 'left' };
      worksheet.getRow(rowIdx).height = 17;
    };

    renderNote(currentRowIndex, 'Ghi chú 비고');
    renderNote(currentRowIndex + 1, '1) Nếu phát sinh dài hạn ghi rõ vào đây: từ năm 2022/........./............~ 2022/........./ ............');
    renderNote(currentRowIndex + 2, 'Phát sinh giờ ghi ở biểu trên/ 긴시간 발생할 경우 는 여기서 기록할것');

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dateSuffix = sortedDates.length > 1
      ? `${sortedDates[0].replace(/[^0-9-]/g, '')}_den_${sortedDates[sortedDates.length - 1].replace(/[^0-9-]/g, '')}`
      : (sortedDates[0] || '2026-11-16').replace(/[^0-9-]/g, '');
    
    const fileName = `Phieu_Tang_Ca_TV-PSGC2022_${dateSuffix}.xlsx`;

    // Nâng cấp: Mở cửa sổ chọn thư mục thông minh, tự nhớ vị trí cho lần sau
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Excel File',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        saveAs(blob, fileName);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        saveAs(blob, fileName);
      } else {
        throw error; // Ném lỗi ra để hiển thị thông báo "Đã hủy"
      }
    }
  }
}

export const overtimeExportService = new OvertimeExportService();