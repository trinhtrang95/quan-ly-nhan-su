import ExcelJS from 'exceljs';
import { Employee } from '../types/hr';
import {
  formatOvertimeDepartmentHeaderLabel,
  hasParticipantCustomReason,
  sortOvertimeBlocksByStandardOrder,
  sortParticipantsByReasonScope,
} from './overtimeFormsService';

export interface OvertimeExportParticipant {
  employeeId: string;
  startTime: string;
  endTime: string;
  reasonVi?: string;
  reasonKr?: string;
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
  preserveBlockOrder?: boolean;
}

export interface ExcelDensityConfig {
  baseRowHeight: number;
  lineHeight: number;
  verticalPadding: number;
  fontSize: number;
  signatureBodyRowHeight: number;
  headerRowHeight: number;
  noteRowHeight: number;
  fitToHeight: 0 | 1;
}

const FONT_NAME = 'Times New Roman';

/**
 * Exact 7-column TV-PSGC2022 Excel visual width proportions matching Web Preview & Print:
 * No(5), Danh sách làm thêm(26), Lý do làm thêm(C+D+E = 24+6+12 = 42), Giờ bắt đầu(11), Giờ kết thúc(11), Tổng thời gian(14), Ký nhận(10)
 */
export const OVERTIME_EXCEL_COLUMN_WIDTHS = {
  no: 5,
  employeeName: 26,
  reasonColC: 24,
  reasonColD: 6,
  reasonColE: 12,
  reasonTotal: 42,
  startTime: 11,
  endTime: 11,
  totalHours: 14,
  signature: 10,
} as const;

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

/**
 * Pure helper: computes Excel sheet vertical density & pageSetup fitToHeight
 * matching the 3-tier Web A4 Preview/Print density rules.
 */
export function computeExcelDensityConfig(totalRows: number): ExcelDensityConfig {
  const fitToHeight: 0 | 1 = totalRows <= 35 ? 1 : 0;

  if (totalRows <= 12) {
    return {
      baseRowHeight: 24,
      lineHeight: 15,
      verticalPadding: 6,
      fontSize: 10.5,
      signatureBodyRowHeight: 18,
      headerRowHeight: 18,
      noteRowHeight: 17,
      fitToHeight,
    };
  }
  if (totalRows <= 20) {
    return {
      baseRowHeight: 20,
      lineHeight: 13.5,
      verticalPadding: 5,
      fontSize: 10,
      signatureBodyRowHeight: 15,
      headerRowHeight: 17,
      noteRowHeight: 15,
      fitToHeight,
    };
  }
  return {
    baseRowHeight: 17,
    lineHeight: 12,
    verticalPadding: 4,
    fontSize: 9.5,
    signatureBodyRowHeight: 13,
    headerRowHeight: 16,
    noteRowHeight: 14,
    fitToHeight,
  };
}

/**
 * Pure helper: counts rendered lines of the combined reason text within the 42-char width column
 * and returns a per-participant Excel row.height that never clips wrapped reason lines.
 */
export function estimateReasonWrappedLineCount(
  combinedReason: string,
  charsPerLine = 36
): number {
  const raw = (combinedReason || '').trim();
  if (!raw) return 1;
  const lines = raw.split(/\r?\n/);
  let totalLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      totalLines += 1;
    } else {
      totalLines += Math.max(1, Math.ceil(trimmed.length / charsPerLine));
    }
  }
  return Math.max(1, totalLines);
}

export function computeExcelBlockRowHeight(
  combinedReason: string,
  participantCount: number,
  totalRows: number
): number {
  const density = computeExcelDensityConfig(totalRows);
  const safeCount = Math.max(1, participantCount);
  const wrappedLines = estimateReasonWrappedLineCount(combinedReason);
  const requiredReasonHeight =
    wrappedLines * density.lineHeight + density.verticalPadding;
  const perRowRequired = Math.ceil(requiredReasonHeight / safeCount);
  return Math.max(density.baseRowHeight, perRowRequired);
}

function resolveBlockParticipants(
  block: OvertimeExportTaskBlock
): OvertimeExportParticipant[] {
  if (Array.isArray(block.participants) && block.participants.length > 0) {
    return block.participants;
  }
  if (block.selectedEmployeeIds.length > 0) {
    return block.selectedEmployeeIds.map((id) => ({
      employeeId: id,
      startTime: block.startTime,
      endTime: block.endTime,
    }));
  }
  return [
    {
      employeeId: '__EMPTY__',
      startTime: block.startTime,
      endTime: block.endTime,
    },
  ];
}

export class OvertimeExportService {
  async buildWorkbook(
    payload: OvertimeExportPayload
  ): Promise<{ workbook: ExcelJS.Workbook; sortedDates: string[] }> {
    const {
      department,
      overtimeDate,
      blocks,
      employees,
      knownSubGroups = [],
      preserveBlockOrder = false,
    } = payload;
    const empById = new Map<string, Employee>(employees.map((e) => [e.id, e]));
    const allKnownSubGroups = Array.from(
      new Set([
        ...knownSubGroups,
        ...employees.map((e) => (e.department || '').trim()).filter(Boolean),
      ])
    );

    const mapByDate = new Map<string, OvertimeExportTaskBlock[]>();
    const rawEffectiveBlocks =
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

    const effectiveBlocks = preserveBlockOrder
      ? rawEffectiveBlocks
      : sortOvertimeBlocksByStandardOrder(
          rawEffectiveBlocks,
          overtimeDate || '',
          empById
        );

    let totalRows = 0;
    for (const b of effectiveBlocks) {
      const d = b.overtimeDate || overtimeDate || '2026-11-16';
      if (!mapByDate.has(d)) mapByDate.set(d, []);
      mapByDate.get(d)!.push(b);
      totalRows += resolveBlockParticipants(b).length;
    }

    const density = computeExcelDensityConfig(totalRows);
    const sortedDates = Array.from(mapByDate.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Transon Viet nam Co., Ltd';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('TV-PSGC2022', {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: density.fitToHeight,
        margins: {
          left: 0.35,
          right: 0.35,
          top: 0.35,
          bottom: 0.35,
          header: 0.15,
          footer: 0.15,
        },
      },
      views: [{ showGridLines: true }],
    });

    worksheet.columns = [
      { key: 'colA', width: OVERTIME_EXCEL_COLUMN_WIDTHS.no },
      { key: 'colB', width: OVERTIME_EXCEL_COLUMN_WIDTHS.employeeName },
      { key: 'colC', width: OVERTIME_EXCEL_COLUMN_WIDTHS.reasonColC },
      { key: 'colD', width: OVERTIME_EXCEL_COLUMN_WIDTHS.reasonColD },
      { key: 'colE', width: OVERTIME_EXCEL_COLUMN_WIDTHS.reasonColE },
      { key: 'colF', width: OVERTIME_EXCEL_COLUMN_WIDTHS.startTime },
      { key: 'colG', width: OVERTIME_EXCEL_COLUMN_WIDTHS.endTime },
      { key: 'colH', width: OVERTIME_EXCEL_COLUMN_WIDTHS.totalHours },
      { key: 'colI', width: OVERTIME_EXCEL_COLUMN_WIDTHS.signature },
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
    worksheet.getRow(1).height = 17;

    worksheet.getRow(2).height = 15;
    worksheet.getRow(3).height = 15;
    worksheet.getRow(4).height = density.signatureBodyRowHeight;
    worksheet.getRow(5).height = density.signatureBodyRowHeight;
    worksheet.getRow(6).height = density.signatureBodyRowHeight;

    worksheet.mergeCells('D2:D6');
    const cellD2 = worksheet.getCell('D2');
    cellD2.value = '결\nxác\nnhận\n재';
    cellD2.font = { name: FONT_NAME, size: 9.5 };
    cellD2.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cellD2.border = THIN_BLACK_BORDER;

    const signatureCols = ['E', 'F', 'G', 'H', 'I'];
    const krHeaders = ['작성', '검사', '검사', '검사', '승인'];
    const viHeaders = [
      'Người lập',
      'Kiểm tra',
      'Kiểm tra',
      'Kiểm tra',
      'Phê duyệt',
    ];

    for (let c = 0; c < 5; c++) {
      const col = signatureCols[c];
      const cellKr = worksheet.getCell(`${col}2`);
      cellKr.value = krHeaders[c];
      cellKr.font = { name: FONT_NAME, size: 9.5 };
      cellKr.alignment = { vertical: 'middle', horizontal: 'center' };
      cellKr.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'dotted' },
      };

      const cellVi = worksheet.getCell(`${col}3`);
      cellVi.value = viHeaders[c];
      cellVi.font = { name: FONT_NAME, size: 9.5 };
      cellVi.alignment = { vertical: 'middle', horizontal: 'center' };
      cellVi.border = {
        top: { style: 'dotted' },
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' },
      };

      worksheet.mergeCells(`${col}4:${col}6`);
      const cellSign = worksheet.getCell(`${col}4`);
      cellSign.border = THIN_BLACK_BORDER;
    }

    worksheet.mergeCells('A2:C6');
    const titleCell = worksheet.getCell('A2');
    titleCell.value = 'PHIẾU ĐỀ NGHỊ LÀM THÊM\n잔업. 특근 신청서';
    titleCell.font = { name: FONT_NAME, size: 14, bold: true };
    titleCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    };

    let currentRowIndex = 7;

    for (let dateIdx = 0; dateIdx < sortedDates.length; dateIdx += 1) {
      const curDate = sortedDates[dateIdx];
      const dateBlocks = mapByDate.get(curDate) || [];

      worksheet.getRow(currentRowIndex).height =
        dateIdx === 0 ? 19 : totalRows >= 23 ? 20 : 23;
      worksheet.mergeCells(`A${currentRowIndex}:F${currentRowIndex}`);
      const deptCell = worksheet.getCell(`A${currentRowIndex}`);
      deptCell.value = formatDepartmentHeaderLabel(
        department,
        allKnownSubGroups
      );
      deptCell.font = { name: FONT_NAME, size: 11, bold: true };
      deptCell.alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells(`G${currentRowIndex}:I${currentRowIndex}`);
      const dateCell = worksheet.getCell(`G${currentRowIndex}`);
      dateCell.value = formatDateToFormStyle(curDate);
      dateCell.font = {
        name: FONT_NAME,
        size: 11,
        bold: true,
        color: { argb: 'FF000000' },
      };
      dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
      currentRowIndex += 1;

      const headerRowVi = worksheet.getRow(currentRowIndex);
      headerRowVi.height = density.headerRowHeight;
      const headerRowKr = worksheet.getRow(currentRowIndex + 1);
      headerRowKr.height = density.headerRowHeight;

      for (let colIdx = 1; colIdx <= 9; colIdx += 1) {
        headerRowVi.getCell(colIdx).border = THIN_BLACK_BORDER;
        headerRowKr.getCell(colIdx).border = THIN_BLACK_BORDER;
      }

      const mapHeader = (col: string, vi: string, kr: string) => {
        const cVi = headerRowVi.getCell(col);
        cVi.value = vi;
        cVi.font = { name: FONT_NAME, size: 10 };
        cVi.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: false,
        };

        const cKr = headerRowKr.getCell(col);
        cKr.value = kr;
        cKr.font = { name: FONT_NAME, size: 10 };
        cKr.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: false,
        };
      };

      mapHeader('A', 'No', '');
      mapHeader('B', 'Danh sách làm thêm', '명단');
      mapHeader('C', 'Lý do làm thêm', '잔업. 특근사유');
      mapHeader('F', 'Giờ bắt đầu', '시작');
      mapHeader('G', 'Giờ kết thúc', '종료');
      mapHeader('H', 'Tổng thời gian', '총 시간');
      mapHeader('I', 'Ký nhận', '싸인');

      worksheet.mergeCells(`C${currentRowIndex}:E${currentRowIndex}`);
      worksheet.mergeCells(
        `C${currentRowIndex + 1}:E${currentRowIndex + 1}`
      );
      currentRowIndex += 2;

      let sequentialNo = 1;

      for (const block of dateBlocks) {
        const sortedParticipants = sortParticipantsByReasonScope(
          resolveBlockParticipants(block),
          block.reasonVi,
          block.reasonKr
        );
        const sharedCount = sortedParticipants.filter(
          (p) => !hasParticipantCustomReason(p, block.reasonVi, block.reasonKr)
        ).length;

        const startRow = currentRowIndex;
        const sharedEndRow = startRow + sharedCount - 1;
        const sharedCombinedReason = buildCombinedReasonText(
          block.reasonVi,
          block.reasonKr
        );
        const sharedRowHeight =
          sharedCount > 0
            ? computeExcelBlockRowHeight(
                sharedCombinedReason,
                sharedCount,
                totalRows
              )
            : density.baseRowHeight;

        for (let i = 0; i < sortedParticipants.length; i += 1) {
          const p = sortedParticipants[i];
          const isSharedRow = i < sharedCount;
          const rowCombinedReason = isSharedRow
            ? sharedCombinedReason
            : buildCombinedReasonText(
                p.reasonVi || block.reasonVi,
                p.reasonKr || block.reasonKr
              );
          const emp = empById.get(p.employeeId);
          const rowIndex = currentRowIndex + i;
          const row = worksheet.getRow(rowIndex);
          row.height = isSharedRow
            ? sharedRowHeight
            : computeExcelBlockRowHeight(rowCombinedReason, 1, totalRows);

          for (let colIdx = 1; colIdx <= 9; colIdx += 1) {
            row.getCell(colIdx).border = THIN_BLACK_BORDER;
          }

          const setCell = (
            col: string,
            val: string | number,
            bold = false,
            align: 'left' | 'center' = 'center',
            wrap = false
          ) => {
            const cell = row.getCell(col);
            cell.value = val;
            cell.font = { name: FONT_NAME, size: density.fontSize, bold };
            cell.alignment = {
              vertical: 'middle',
              horizontal: align,
              wrapText: wrap,
            };
          };

          setCell('A', sequentialNo);
          setCell('B', emp ? emp.fullName : '', false, 'left', false);
          setCell('C', rowCombinedReason, false, 'left', true);
          setCell(
            'F',
            formatTimeToFormStyle(p.startTime || block.startTime),
            isTimeBold(p.startTime || block.startTime)
          );
          setCell(
            'G',
            formatTimeToFormStyle(p.endTime || block.endTime),
            isTimeBold(p.endTime || block.endTime)
          );
          setCell('H', '');
          setCell('I', '');

          if (!isSharedRow) {
            worksheet.mergeCells(`C${rowIndex}:E${rowIndex}`);
          }

          sequentialNo += 1;
        }

        if (sharedCount > 0 && sharedEndRow >= startRow) {
          worksheet.mergeCells(`C${startRow}:E${sharedEndRow}`);
        }
        currentRowIndex = startRow + sortedParticipants.length;
      }
    }

    const renderNote = (rowIdx: number, text: string) => {
      worksheet.mergeCells(`A${rowIdx}:I${rowIdx}`);
      const c = worksheet.getCell(`A${rowIdx}`);
      c.value = text;
      c.font = { name: FONT_NAME, size: 9.5 };
      c.alignment = { vertical: 'middle', horizontal: 'left' };
      worksheet.getRow(rowIdx).height = density.noteRowHeight;
    };

    renderNote(currentRowIndex, 'Ghi chú 비고');
    renderNote(
      currentRowIndex + 1,
      '1) Nếu phát sinh dài hạn ghi rõ vào đây: từ năm 2022/........./............~ 2022/........./ ............'
    );
    renderNote(
      currentRowIndex + 2,
      'Phát sinh giờ ghi ở biểu trên/ 긴시간 발생할 경우 는 여기서 기록할것'
    );

    return { workbook, sortedDates };
  }

  async exportExcel(payload: OvertimeExportPayload): Promise<void> {
    const { workbook, sortedDates } = await this.buildWorkbook(payload);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const dateSuffix =
      sortedDates.length > 1
        ? `${sortedDates[0].replace(/[^0-9-]/g, '')}_den_${sortedDates[
            sortedDates.length - 1
          ].replace(/[^0-9-]/g, '')}`
        : (sortedDates[0] || '2026-11-16').replace(/[^0-9-]/g, '');

    const fileName = `Phieu_Tang_Ca_TV-PSGC2022_${dateSuffix}.xlsx`;

    const triggerSaveAs = async () => {
      const mod: any = await import('file-saver');
      const saveAsFn = mod.saveAs || mod.default?.saveAs || mod.default;
      if (typeof saveAsFn === 'function') {
        saveAsFn(blob, fileName);
      }
    };

    // Nâng cấp: Mở cửa sổ chọn thư mục thông minh, tự nhớ vị trí cho lần sau
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'Excel File',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                  ['.xlsx'],
              },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        await triggerSaveAs();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        await triggerSaveAs();
      } else {
        throw error; // Ném lỗi ra để hiển thị thông báo "Đã hủy"
      }
    }
  }
}

export const overtimeExportService = new OvertimeExportService();