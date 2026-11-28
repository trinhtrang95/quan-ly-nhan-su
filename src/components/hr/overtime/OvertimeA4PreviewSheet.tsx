import React, { useMemo } from 'react';
import {
  buildPrintableDateGroupsFromItems,
  DEFAULT_OVERTIME_DEPARTMENT,
  formatOvertimeDepartmentHeaderLabel,
  isOvertimeTimeBold,
  OvertimeFormWithItems,
  resolveOvertimeMainDepartment,
} from '../../../services/hrService';

export interface OvertimeA4PreviewSheetProps {
  form: OvertimeFormWithItems;
  knownSubGroups?: string[];
  variant?: 'inline' | 'modal';
  isPrintableTarget?: boolean;
}

function formatDateToFormStyle(isoDate: string): string {
  if (!isoDate) return '-';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export const OvertimeA4PreviewSheet: React.FC<OvertimeA4PreviewSheetProps> = ({
  form,
  knownSubGroups = [],
  variant = 'inline',
  isPrintableTarget = true,
}) => {
  const printableGroups = useMemo(
    () => buildPrintableDateGroupsFromItems(form.items || []),
    [form.items]
  );

  const mainDepartment = useMemo(
    () =>
      resolveOvertimeMainDepartment(
        form.department || DEFAULT_OVERTIME_DEPARTMENT,
        knownSubGroups
      ),
    [form.department, knownSubGroups]
  );

  const departmentHeaderLabel = useMemo(
    () => formatOvertimeDepartmentHeaderLabel(mainDepartment, knownSubGroups),
    [mainDepartment, knownSubGroups]
  );

  const fallbackFormattedDate = formatDateToFormStyle(form.overtime_date);

  return (
    <div
      style={{
        fontFamily: "'Times New Roman', 'Malgun Gothic', Arial, sans-serif",
      }}
      data-testid={
        variant === 'inline'
          ? 'inline-overtime-a4-preview'
          : 'modal-overtime-a4-preview'
      }
      className={`${
        isPrintableTarget ? 'overtime-print-sheet ' : ''
      }bg-white border border-slate-200 ${
        variant === 'modal' ? 'shadow-xl min-h-[1123px]' : 'shadow-sm'
      } p-5 sm:p-6 w-full max-w-[794px] mx-auto text-black rounded-sm space-y-3 flex flex-col justify-between`}
    >
      <div className="space-y-3">
        {/* Header top */}
        <div className="flex items-center justify-between text-xs mb-1">
          <span>Transon Viet nam Co., Ltd</span>
          <span className="pr-12">Biểu mẫu số: TV-PSGC2022</span>
        </div>

        {/* Title + 6-column signature block */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="pt-2">
            <div className="text-lg font-bold leading-snug">
              PHIẾU ĐỀ NGHỊ LÀM THÊM
            </div>
            <div className="text-base font-bold leading-snug">
              잔업. 특근 신청서
            </div>
          </div>
          <table className="border-collapse border border-black text-[11px] text-center">
            <thead>
              <tr>
                <th className="border border-black px-2 py-0.5 font-normal">
                  결
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  작성
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  검사
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  검사
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  검사
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  승인
                </th>
              </tr>
              <tr>
                <th className="border border-black px-2 py-0.5 font-normal">
                  xác
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  Người lập
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  Kiểm tra
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  Kiểm tra
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  Kiểm tra
                </th>
                <th className="border border-black px-3 py-0.5 font-normal">
                  Phê duyệt
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="h-14">
                <td className="border border-black px-2 align-bottom pb-1 text-[10px]">
                  <div>nhận</div>
                  <div className="border-t border-black mt-0.5 pt-0.5">재</div>
                </td>
                <td className="border border-black w-16" />
                <td className="border border-black w-16" />
                <td className="border border-black w-16" />
                <td className="border border-black w-16" />
                <td className="border border-black w-16" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Multi-date 7-column TV-PSGC2022 Table */}
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            {printableGroups.length === 0 ? (
              <>
                <tr className="h-7">
                  <td
                    colSpan={4}
                    className="border-0 bg-transparent text-left align-middle text-xs font-bold text-black pb-1"
                  >
                    {departmentHeaderLabel}
                  </td>
                  <td
                    colSpan={3}
                    className="border-0 bg-transparent text-center align-middle text-xs font-bold text-black pb-1"
                  >
                    {fallbackFormattedDate}
                  </td>
                </tr>
                <tr className="text-center font-normal">
                  <th className="border border-black px-1.5 py-0.5 w-8 min-w-[32px] font-normal">
                    No
                  </th>
                  <th className="border border-black px-2 py-0.5 w-40 min-w-[145px] font-normal">
                    Danh sách làm thêm
                  </th>
                  <th className="border border-black px-2.5 py-0.5 min-w-[220px] font-normal">
                    Lý do làm thêm
                  </th>
                  <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">
                    Giờ bắt đầu
                  </th>
                  <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">
                    Giờ kết thúc
                  </th>
                  <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">
                    Tổng thời gian
                  </th>
                  <th className="border border-black px-1.5 py-0.5 w-14 min-w-[50px] font-normal">
                    Ký nhận
                  </th>
                </tr>
                <tr className="text-center font-normal">
                  <th className="border border-black px-1.5 py-0.5 font-normal" />
                  <th className="border border-black px-2 py-0.5 font-normal">
                    명단
                  </th>
                  <th className="border border-black px-2.5 py-0.5 font-normal">
                    잔업. 특근사유
                  </th>
                  <th className="border border-black px-1.5 py-0.5 font-normal">
                    시작
                  </th>
                  <th className="border border-black px-1.5 py-0.5 font-normal">
                    종료
                  </th>
                  <th className="border border-black px-1.5 py-0.5 font-normal">
                    총 시간
                  </th>
                  <th className="border border-black px-1.5 py-0.5 font-normal">
                    싸인
                  </th>
                </tr>
                <tr className="h-10">
                  <td
                    colSpan={7}
                    className="border border-black px-3 py-3 text-center text-slate-500 italic"
                  >
                    Chưa có nhóm tăng ca nào — bấm nút (+) hoặc Camera ở cột trái để thêm nhóm.
                  </td>
                </tr>
              </>
            ) : (
              printableGroups.map((dateGroup, dateIdx) => (
                <React.Fragment key={dateGroup.date}>
                  <tr className={dateIdx === 0 ? 'h-7' : 'h-8'}>
                    <td
                      colSpan={4}
                      className={`border-0 bg-transparent text-left align-middle text-xs font-bold text-black ${
                        dateIdx === 0 ? 'pb-1' : 'pt-2 pb-1'
                      }`}
                    >
                      {departmentHeaderLabel}
                    </td>
                    <td
                      colSpan={3}
                      className={`border-0 bg-transparent text-center align-middle text-xs font-bold text-black ${
                        dateIdx === 0 ? 'pb-1' : 'pt-2 pb-1'
                      }`}
                    >
                      {dateGroup.formattedDate}
                    </td>
                  </tr>
                  <tr className="text-center font-normal">
                    <th className="border border-black px-1.5 py-0.5 w-8 min-w-[32px] font-normal">
                      No
                    </th>
                    <th className="border border-black px-2 py-0.5 w-40 min-w-[145px] font-normal">
                      Danh sách làm thêm
                    </th>
                    <th className="border border-black px-2.5 py-0.5 min-w-[220px] font-normal">
                      Lý do làm thêm
                    </th>
                    <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">
                      Giờ bắt đầu
                    </th>
                    <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">
                      Giờ kết thúc
                    </th>
                    <th className="border border-black px-1.5 py-0.5 w-16 min-w-[56px] font-normal">
                      Tổng thời gian
                    </th>
                    <th className="border border-black px-1.5 py-0.5 w-14 min-w-[50px] font-normal">
                      Ký nhận
                    </th>
                  </tr>
                  <tr className="text-center font-normal">
                    <th className="border border-black px-1.5 py-0.5 font-normal" />
                    <th className="border border-black px-2 py-0.5 font-normal">
                      명단
                    </th>
                    <th className="border border-black px-2.5 py-0.5 font-normal">
                      잔업. 특근사유
                    </th>
                    <th className="border border-black px-1.5 py-0.5 font-normal">
                      시작
                    </th>
                    <th className="border border-black px-1.5 py-0.5 font-normal">
                      종료
                    </th>
                    <th className="border border-black px-1.5 py-0.5 font-normal">
                      총 시간
                    </th>
                    <th className="border border-black px-1.5 py-0.5 font-normal">
                      싸인
                    </th>
                  </tr>
                  {dateGroup.blocks.map((block) =>
                    block.rows.map((row) => (
                      <tr
                        key={`${block.blockId}-${row.no}`}
                        className="h-7 min-h-[26px]"
                      >
                        <td className="border border-black px-1.5 py-0.5 text-center font-normal">
                          {row.no}
                        </td>
                        <td className="border border-black px-2 py-0.5 text-left font-normal">
                          {row.fullName}
                        </td>
                        {row.isFirstInBlock && (
                          <td
                            rowSpan={row.rowSpan}
                            className="border border-black px-2.5 py-1 text-left align-middle whitespace-pre-line font-normal leading-snug"
                          >
                            {row.combinedReason}
                          </td>
                        )}
                        <td
                          className={`border border-black px-1.5 py-0.5 text-center align-middle ${
                            isOvertimeTimeBold(row.startTimeFormatted)
                              ? 'font-bold'
                              : 'font-normal'
                          }`}
                        >
                          {row.startTimeFormatted}
                        </td>
                        <td
                          className={`border border-black px-1.5 py-0.5 text-center align-middle ${
                            isOvertimeTimeBold(row.endTimeFormatted)
                              ? 'font-bold'
                              : 'font-normal'
                          }`}
                        >
                          {row.endTimeFormatted}
                        </td>
                        <td className="border border-black px-1.5 py-0.5 text-center align-middle" />
                        <td className="border border-black px-1.5 py-0.5 text-center align-middle" />
                      </tr>
                    ))
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Notes Footer */}
      <div className="mt-2 text-[11px] space-y-0.5 leading-snug shrink-0">
        <div>Ghi chú 비고</div>
        <div>
          1) Nếu phát sinh dài hạn ghi rõ vào đây: từ năm
          2022/........./............~ 2022/........./ ............
        </div>
        <div>
          Phát sinh giờ ghi ở biểu trên/ 긴시간 발생할 경우 는 여기서
          기록할것
        </div>
      </div>
    </div>
  );
};

export default OvertimeA4PreviewSheet;
