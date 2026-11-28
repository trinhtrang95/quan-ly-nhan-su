import React, { useMemo } from 'react';
import {
  buildPrintableDateGroupsFromItems,
  computeOvertimeA4Density,
  DEFAULT_OVERTIME_DEPARTMENT,
  formatOvertimeDepartmentHeaderLabel,
  isOvertimeTimeBold,
  OvertimeFormWithItems,
  resolveOvertimeMainDepartment,
} from '../../../services/hrService';

export interface PrintableA4Row {
  no: number;
  fullName: string;
  isFirstInBlock: boolean;
  rowSpan: number;
  combinedReason: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
}

export interface PrintableA4Block {
  blockId: string;
  rows: PrintableA4Row[];
}

export interface PrintableA4DateGroup {
  date: string;
  formattedDate: string;
  blocks: PrintableA4Block[];
}

export interface OvertimeA4PreviewSheetProps {
  form?: OvertimeFormWithItems;
  printableGroups?: PrintableA4DateGroup[];
  departmentHeaderLabel?: string;
  fallbackFormattedDate?: string;
  knownSubGroups?: string[];
  variant?: 'inline' | 'modal';
  isPrintableTarget?: boolean;
}

function formatDateToFormStyle(isoDate?: string): string {
  if (!isoDate) return '-';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export const OvertimeA4PreviewSheet: React.FC<OvertimeA4PreviewSheetProps> = ({
  form,
  printableGroups: explicitPrintableGroups,
  departmentHeaderLabel: explicitDepartmentHeaderLabel,
  fallbackFormattedDate: explicitFallbackDate,
  knownSubGroups = [],
  variant = 'inline',
  isPrintableTarget = true,
}) => {
  const resolvedGroups = useMemo<PrintableA4DateGroup[]>(() => {
    if (explicitPrintableGroups) return explicitPrintableGroups;
    return buildPrintableDateGroupsFromItems(form?.items || []);
  }, [explicitPrintableGroups, form?.items]);

  const totalRows = useMemo(
    () =>
      resolvedGroups.reduce(
        (sum, dg) =>
          sum + dg.blocks.reduce((bSum, b) => bSum + b.rows.length, 0),
        0
      ),
    [resolvedGroups]
  );

  const density = useMemo(
    () => computeOvertimeA4Density(totalRows),
    [totalRows]
  );

  const resolvedDepartmentLabel = useMemo(() => {
    if (explicitDepartmentHeaderLabel) return explicitDepartmentHeaderLabel;
    const mainDepartment = resolveOvertimeMainDepartment(
      form?.department || DEFAULT_OVERTIME_DEPARTMENT,
      knownSubGroups
    );
    return formatOvertimeDepartmentHeaderLabel(mainDepartment, knownSubGroups);
  }, [explicitDepartmentHeaderLabel, form?.department, knownSubGroups]);

  const fallbackFormattedDate =
    explicitFallbackDate || formatDateToFormStyle(form?.overtime_date);

  const renderTableHeaderRows = () => (
    <thead className="text-[10px] leading-[1.2]">
      <tr className="text-center font-normal">
        <th className="w-[32px] border border-black px-0.5 py-0.5 font-normal whitespace-nowrap">
          No
        </th>
        <th className="w-[175px] border border-black px-2 py-0.5 font-normal whitespace-nowrap">
          Danh sách làm thêm
        </th>
        <th className="border border-black px-2 py-0.5 font-normal">
          Lý do làm thêm
        </th>
        <th className="w-[66px] border border-black px-0 py-0.5 text-[9px] font-normal whitespace-nowrap">
          Giờ bắt đầu
        </th>
        <th className="w-[66px] border border-black px-0 py-0.5 text-[9px] font-normal whitespace-nowrap">
          Giờ kết thúc
        </th>
        <th className="w-[88px] border border-black px-0.5 py-0.5 font-normal whitespace-nowrap">
          Tổng thời gian
        </th>
        <th className="w-[62px] border border-black px-0.5 py-0.5 font-normal whitespace-nowrap">
          Ký nhận
        </th>
      </tr>
      <tr className="text-center font-normal">
        <th className="border border-black px-1 py-0.5 font-normal whitespace-nowrap" />
        <th className="border border-black px-2 py-0.5 font-normal whitespace-nowrap">
          명단
        </th>
        <th className="border border-black px-2 py-0.5 font-normal">
          잔업. 특근사유
        </th>
        <th className="border border-black px-0.5 py-0.5 font-normal whitespace-nowrap">
          시작
        </th>
        <th className="border border-black px-0.5 py-0.5 font-normal whitespace-nowrap">
          종료
        </th>
        <th className="border border-black px-0.5 py-0.5 font-normal whitespace-nowrap">
          총 시간
        </th>
        <th className="border border-black px-0.5 py-0.5 font-normal whitespace-nowrap">
          싸인
        </th>
      </tr>
    </thead>
  );

  const renderColGroup = () => (
    <colgroup>
      <col className="w-[32px]" />
      <col className="w-[175px]" />
      <col />
      <col className="w-[66px]" />
      <col className="w-[66px]" />
      <col className="w-[88px]" />
      <col className="w-[62px]" />
    </colgroup>
  );

  return (
    <div
      id={isPrintableTarget ? 'printable-overtime-sheet' : undefined}
      style={{
        fontFamily: "'Times New Roman', 'Malgun Gothic', Arial, sans-serif",
      }}
      data-testid={
        variant === 'inline'
          ? 'inline-overtime-a4-preview'
          : 'modal-overtime-a4-preview'
      }
      data-density-tier={density.tier}
      className={`${
        isPrintableTarget ? 'overtime-print-sheet ' : ''
      }bg-white border border-slate-200 ${
        variant === 'modal' ? 'shadow-sm min-h-[1123px]' : 'shadow-sm'
      } w-[794px] min-w-[794px] max-w-[794px] shrink-0 mx-auto px-7 pt-6 pb-8 text-black rounded-sm flex flex-col justify-between ${
        density.sheetSpaceClass
      }`}
    >
      <div className={density.sheetSpaceClass}>
        {/* Header top */}
        <div className="flex items-center justify-between text-xs mb-1">
          <span>Transon Viet nam Co., Ltd</span>
          <span className="pr-12">Biểu mẫu số: TV-PSGC2022</span>
        </div>

        {/* Title + 6-column fixed signature block (w-[340px]) */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className={density.headerTitleBlockClass}>
            <div className="text-lg font-bold leading-snug">
              PHIẾU ĐỀ NGHỊ LÀM THÊM
            </div>
            <div className="text-base font-bold leading-snug">
              잔업. 특근 신청서
            </div>
          </div>

          <table className="w-[340px] shrink-0 table-fixed border-collapse border border-black text-[11px] text-center">
            <colgroup>
              <col className="w-[40px]" />
              <col className="w-[60px]" />
              <col className="w-[60px]" />
              <col className="w-[60px]" />
              <col className="w-[60px]" />
              <col className="w-[60px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="border border-black px-1 py-0.5 font-normal">
                  결
                </th>
                <th className="border border-black px-1 py-0.5 font-normal">
                  작성
                </th>
                <th className="border border-black px-1 py-0.5 font-normal">
                  검사
                </th>
                <th className="border border-black px-1 py-0.5 font-normal">
                  검사
                </th>
                <th className="border border-black px-1 py-0.5 font-normal">
                  검사
                </th>
                <th className="border border-black px-1 py-0.5 font-normal">
                  승인
                </th>
              </tr>
              <tr>
                <th className="border border-black px-1 py-0.5 font-normal">
                  xác
                </th>
                <th className="border border-black px-1 py-0.5 font-normal whitespace-nowrap">
                  Người lập
                </th>
                <th className="border border-black px-1 py-0.5 font-normal whitespace-nowrap">
                  Kiểm tra
                </th>
                <th className="border border-black px-1 py-0.5 font-normal whitespace-nowrap">
                  Kiểm tra
                </th>
                <th className="border border-black px-1 py-0.5 font-normal whitespace-nowrap">
                  Kiểm tra
                </th>
                <th className="border border-black px-1 py-0.5 font-normal whitespace-nowrap">
                  Phê duyệt
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className={density.signatureRowHeightClass}>
                <td className="border border-black px-1 align-bottom pb-1 text-[10px]">
                  <div>nhận</div>
                  <div className="border-t border-black mt-0.5 pt-0.5">재</div>
                </td>
                <td className="border border-black" />
                <td className="border border-black" />
                <td className="border border-black" />
                <td className="border border-black" />
                <td className="border border-black" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Multi-date 7-column TV-PSGC2022 tables */}
        {resolvedGroups.length === 0 ? (
          <div>
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-black pb-1">
              <span data-testid="tv-psgc-department-header" className="truncate">
                {resolvedDepartmentLabel}
              </span>
              <span className="w-[216px] shrink-0 text-center tabular-nums">
                {fallbackFormattedDate}
              </span>
            </div>
            <table
              className={`w-full table-fixed border-collapse border border-black ${density.tableTextClass}`}
            >
              {renderColGroup()}
              {renderTableHeaderRows()}
              <tbody>
                <tr className="h-10">
                  <td
                    colSpan={7}
                    className="border border-black px-3 py-3 text-center text-slate-500 italic"
                  >
                    Chưa có nhóm tăng ca nào — bấm nút (+) hoặc Camera ở cột trái để thêm nhóm.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          resolvedGroups.map((dateGroup, dateIdx) => (
            <div
              key={dateGroup.date || `date-${dateIdx}`}
              className={
                dateIdx < resolvedGroups.length - 1
                  ? density.dateGroupMarginClass
                  : ''
              }
            >
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-black pb-1">
                <span
                  data-testid={
                    dateIdx === 0 ? 'tv-psgc-department-header' : undefined
                  }
                  className="truncate"
                >
                  {resolvedDepartmentLabel}
                </span>
                <span className="w-[216px] shrink-0 text-center tabular-nums">
                  {dateGroup.formattedDate}
                </span>
              </div>

              <table
                className={`w-full table-fixed border-collapse border border-black ${density.tableTextClass}`}
              >
                {renderColGroup()}
                {renderTableHeaderRows()}
                <tbody>
                  {dateGroup.blocks.map((block) =>
                    block.rows.map((row) => (
                      <tr key={`${block.blockId}-${row.no}`}>
                        <td
                          className={`border border-black px-1 ${density.cellPaddingClass} text-center align-middle font-normal whitespace-nowrap tabular-nums`}
                        >
                          {row.no}
                        </td>
                        <td
                          className={`border border-black px-2 ${density.cellPaddingClass} text-left align-middle font-normal whitespace-nowrap`}
                        >
                          {row.fullName}
                        </td>
                        {row.isFirstInBlock && (
                          <td
                            rowSpan={row.rowSpan}
                            className={`border border-black px-2 ${density.cellPaddingClass} text-left align-middle whitespace-pre-wrap break-words font-normal`}
                          >
                            {row.combinedReason}
                          </td>
                        )}
                        <td
                          className={`border border-black px-1 ${density.cellPaddingClass} text-center align-middle whitespace-nowrap ${
                            isOvertimeTimeBold(row.startTimeFormatted)
                              ? 'font-bold'
                              : 'font-normal'
                          }`}
                        >
                          {row.startTimeFormatted}
                        </td>
                        <td
                          className={`border border-black px-1 ${density.cellPaddingClass} text-center align-middle whitespace-nowrap ${
                            isOvertimeTimeBold(row.endTimeFormatted)
                              ? 'font-bold'
                              : 'font-normal'
                          }`}
                        >
                          {row.endTimeFormatted}
                        </td>
                        <td
                          className={`border border-black px-1 ${density.cellPaddingClass} text-center align-middle whitespace-nowrap`}
                        />
                        <td
                          className={`border border-black px-1 ${density.cellPaddingClass} text-center align-middle whitespace-nowrap`}
                        />
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* Notes Footer */}
      <div className={`${density.footerClass} shrink-0`}>
        <div>Ghi chú 비고</div>
        <div>
          1) Nếu phát sinh dài hạn ghi rõ vào đây: từ năm
          2022/........./............~ 2022/........./ ............
        </div>
        <div>
          Phát sinh giờ ghi ở biểu trên/ 긴시간 발생할 경우 는 여기서 기록할것
        </div>
      </div>
    </div>
  );
};

export default OvertimeA4PreviewSheet;
