import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Languages,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { DepartmentGroup, Employee } from '../../types/hr';
import { INITIAL_DEPARTMENT_GROUPS, INITIAL_EMPLOYEES } from '../../data/mockData';
import {
  formatNumberVN,
  getFriendlyErrorMessage,
} from '../../utils/errorAndSecurityService';
import {
  flattenOvertimeBlocksToRecords,
  insertOvertimeRecords,
} from '../../utils/supabaseService';
import {
  buildCombinedReasonText,
  formatDateToFormStyle,
  formatDepartmentHeaderLabel,
  formatTimeToFormStyle,
  overtimeExportService,
} from '../../utils/overtimeExportService';

export interface OvertimeTaskBlock {
  id: string;
  reasonVi: string;
  reasonKr: string;
  startTime: string;
  endTime: string;
  selectedEmployeeIds: string[];
  isTranslating?: boolean;
}

export interface CreateOvertimeFormPayload {
  department: string;
  overtimeDate: string;
  blocks: OvertimeTaskBlock[];
}

export interface CreateOvertimeFormProps {
  employees?: Employee[];
  groups?: DepartmentGroup[];
  initialDepartment?: string;
  initialDate?: string;
  onSaveAndExportPDF?: (payload: CreateOvertimeFormPayload) => void;
  onSaveAndExportExcel?: (payload: CreateOvertimeFormPayload) => void;
}

/**
 * Từ điển đối chiếu bản dịch mẫu Tiếng Việt -> Tiếng Hàn chuẩn nghiệp vụ sản xuất (TV-PSGC2022)
 */
const MOCK_VI_TO_KR_DICTIONARY: Array<{ keywords: string[]; kr: string }> = [
  {
    keywords: ['trực sản xuất', 'truc san xuat'],
    kr: '생산 당직',
  },
  {
    keywords: ['sự cố trên line', 'su co tren line', 'xử lý sự cố', 'sử lý sự cố'],
    kr: '라인 이상 조치',
  },
  {
    keywords: ['3d5s', 'u-line', 'thẩm định'],
    kr: 'U-Line 3D5S 관련 작업 진행',
  },
  {
    keywords: ['quấn core', 'pq50', 'datbike'],
    kr: 'PQ50 DATBIKE 코어 권선기 조립',
  },
  {
    keywords: ['jig auto'],
    kr: '심사 준비를 위한 AUTO JIG 조치',
  },
  {
    keywords: ['atq2815', 'cài đặt chuyền'],
    kr: 'ATQ2815 2IN1 라인 셋업',
  },
  {
    keywords: ['sq2118', 'lắp máy tự động'],
    kr: 'SQ2118 자동화 설비 1호기 설치',
  },
  {
    keywords: ['eol', 'motor fan', 'cải tiến máy'],
    kr: 'Motor Fan EOL 설비 개선',
  },
  {
    keywords: ['setup motor fan'],
    kr: 'Motor Fan 라인 셋업 작업 진행',
  },
  {
    keywords: ['đối sách motor fan'],
    kr: 'Motor Fan 대책 항목',
  },
  {
    keywords: ['đơn hàng mới', 'theo dõi đơn hàng'],
    kr: '신규 발주 건 모니터링',
  },
  {
    keywords: ['tỷ lệ đạt st', 'kiểm tra tỷ lệ'],
    kr: '10월 ST 달성률 확인',
  },
  {
    keywords: ['solum audit', 'chuẩn bị tài liệu'],
    kr: 'SOLUM Audit 대응 자료 준비',
  },
  {
    keywords: ['theo dõi dữ liệu', 'u, c, e line'],
    kr: 'U, C, E LINE 데이터 모니터링',
  },
];

/**
 * Lớp dịch vụ xử lý logic nghiệp vụ Phiếu tăng ca (OOP Domain Service)
 */
class OvertimeFormService {
  static createEmptyBlock(): OvertimeTaskBlock {
    return {
      id: `ot-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      reasonVi: '',
      reasonKr: '',
      startTime: '16:10',
      endTime: '20:10',
      selectedEmployeeIds: [],
      isTranslating: false,
    };
  }

  static translateReasonToKorean(reasonVi: string): string {
    const trimmed = reasonVi.trim();
    if (!trimmed) return '';

    const lines = trimmed
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const translatedLines = lines.map((line) => {
      const normalized = line.toLowerCase();
      const matched = MOCK_VI_TO_KR_DICTIONARY.find((entry) =>
        entry.keywords.some((kw) => normalized.includes(kw))
      );
      if (matched) {
        return matched.kr;
      }
      return `[KR] ${line.replace(/^\d+[\.\)]\s*/, '')} 관련 잔업 진행`;
    });

    return translatedLines.join('\n');
  }

  static calculateDurationHours(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (
      Number.isNaN(startH) ||
      Number.isNaN(startM) ||
      Number.isNaN(endH) ||
      Number.isNaN(endM)
    ) {
      return 0;
    }
    const startTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = endH * 60 + endM;
    const diffMinutes = endTotalMinutes - startTotalMinutes;
    if (diffMinutes <= 0) return 0;
    return Number((diffMinutes / 60).toFixed(2));
  }
}

export const CreateOvertimeForm: React.FC<CreateOvertimeFormProps> = ({
  employees = INITIAL_EMPLOYEES,
  groups = INITIAL_DEPARTMENT_GROUPS,
  initialDepartment = 'ALL',
  initialDate = '2026-11-16',
  onSaveAndExportPDF,
  onSaveAndExportExcel,
}) => {
  // Header Filter States
  const [selectedDepartment, setSelectedDepartment] =
    useState<string>(initialDepartment);
  const [overtimeDate, setOvertimeDate] = useState<string>(initialDate);

  // Danh sách các Block (Nhóm công việc)
  const [blocks, setBlocks] = useState<OvertimeTaskBlock[]>(() => [
    {
      id: 'ot-block-initial-1',
      reasonVi: 'Trực sản xuất',
      reasonKr: '생산 당직',
      startTime: '16:10',
      endTime: '20:10',
      selectedEmployeeIds: [],
      isTranslating: false,
    },
  ]);

  // Từ khóa tìm kiếm nhanh nhân sự trong từng Block
  const [employeeSearchByBlock, setEmployeeSearchByBlock] = useState<
    Record<string, string>
  >({});

  // Trạng thái đang xử lý lưu DB / xuất file
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Thông báo Toast / Status thân thiện trên giao diện
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Bản đồ tra cứu nhanh nhân viên theo ID
  const employeeMap = useMemo(
    () => new Map<string, Employee>(employees.map((e) => [e.id, e])),
    [employees]
  );

  // Danh sách nhân sự khả dụng theo Bộ phận đã chọn trên Header
  const availableEmployees = useMemo(() => {
    if (!selectedDepartment || selectedDepartment === 'ALL') {
      return employees;
    }
    return employees.filter((emp) => emp.department === selectedDepartment);
  }, [employees, selectedDepartment]);

  // Tổng số lượt nhân sự và tổng số giờ tăng ca dự kiến
  const summaryStats = useMemo(() => {
    let totalParticipants = 0;
    let totalHours = 0;
    for (const block of blocks) {
      const count = block.selectedEmployeeIds.length;
      const hours = OvertimeFormService.calculateDurationHours(
        block.startTime,
        block.endTime
      );
      totalParticipants += count;
      totalHours += count * hours;
    }
    return {
      blockCount: blocks.length,
      totalParticipants,
      totalHours: Number(totalHours.toFixed(2)),
    };
  }, [blocks]);

  // Hàm mock dịch tự động Tiếng Việt -> Tiếng Hàn theo index của Block
  const handleTranslate = (index: number) => {
    const targetBlock = blocks[index];
    if (!targetBlock) return;

    if (!targetBlock.reasonVi.trim()) {
      showToast(
        `Vui lòng nhập Lý do (Tiếng Việt) ở Nhóm công việc #${index + 1} trước khi dịch tự động.`
      );
      return;
    }

    setBlocks((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, isTranslating: true } : item
      )
    );

    const translatedText = OvertimeFormService.translateReasonToKorean(
      targetBlock.reasonVi
    );

    setBlocks((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              reasonKr: translatedText,
              isTranslating: false,
            }
          : item
      )
    );

    showToast(
      `Đã dịch tự động lý do tăng ca sang Tiếng Hàn cho Nhóm công việc #${index + 1}.`
    );
  };

  // Cập nhật trường dữ liệu của một Block
  const handleUpdateBlockField = <K extends keyof OvertimeTaskBlock>(
    index: number,
    field: K,
    value: OvertimeTaskBlock[K]
  ) => {
    setBlocks((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  };

  // Thêm một Nhóm công việc (Block) mới
  const handleAddBlock = () => {
    setBlocks((prev) => [...prev, OvertimeFormService.createEmptyBlock()]);
  };

  // Xóa một Nhóm công việc (Block)
  const handleRemoveBlock = (index: number) => {
    if (blocks.length <= 1) {
      setBlocks([OvertimeFormService.createEmptyBlock()]);
      return;
    }
    setBlocks((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Chọn / Bỏ chọn một nhân viên trong Block
  const handleToggleEmployeeInBlock = (index: number, employeeId: string) => {
    setBlocks((prev) =>
      prev.map((block, idx) => {
        if (idx !== index) return block;
        const exists = block.selectedEmployeeIds.includes(employeeId);
        const nextIds = exists
          ? block.selectedEmployeeIds.filter((id) => id !== employeeId)
          : [...block.selectedEmployeeIds, employeeId];
        return {
          ...block,
          selectedEmployeeIds: nextIds,
        };
      })
    );
  };

  // Chọn tất cả hoặc bỏ chọn tất cả nhân viên đang hiển thị trong Block
  const handleSelectAllFilteredInBlock = (
    index: number,
    filteredIds: string[]
  ) => {
    setBlocks((prev) =>
      prev.map((block, idx) => {
        if (idx !== index) return block;
        const allSelected =
          filteredIds.length > 0 &&
          filteredIds.every((id) => block.selectedEmployeeIds.includes(id));

        if (allSelected) {
          return {
            ...block,
            selectedEmployeeIds: block.selectedEmployeeIds.filter(
              (id) => !filteredIds.includes(id)
            ),
          };
        }

        const merged = Array.from(
          new Set([...block.selectedEmployeeIds, ...filteredIds])
        );
        return {
          ...block,
          selectedEmployeeIds: merged,
        };
      })
    );
  };

  const buildPayload = (): CreateOvertimeFormPayload => ({
    department: selectedDepartment,
    overtimeDate,
    blocks,
  });

  /**
   * Phẳng hóa (Flatten) các Block thành mảng OvertimeRecord[] (mỗi nhân viên 1 dòng)
   * và lưu vào bảng `overtime_records` trên Supabase.
   */
  const persistFlattenedRecordsToSupabase = async () => {
    const flattenedRecords = flattenOvertimeBlocksToRecords(
      blocks,
      selectedDepartment,
      overtimeDate,
      employees
    );
    await insertOvertimeRecords(flattenedRecords);
    return flattenedRecords;
  };

  /**
   * Xử lý nút "Lưu & Xuất Excel":
   * Async -> Lưu DB (Flatten) -> Nếu thành công gọi overtimeExportService.exportExcel() -> Hiển thị Toast thành công.
   */
  const handleSaveAndExportExcelClick = async () => {
    setIsSubmitting(true);
    try {
      const flattened = await persistFlattenedRecordsToSupabase();

      await overtimeExportService.exportExcel({
        department: selectedDepartment,
        overtimeDate,
        blocks,
        employees,
      });

      const payload = buildPayload();
      onSaveAndExportExcel?.(payload);

      showToast(
        `Đã lưu ${formatNumberVN(
          flattened.length
        )} bản ghi tăng ca vào hệ thống và xuất file Excel chuẩn biểu mẫu TV-PSGC2022 thành công!`
      );
    } catch (error) {
      showToast(getFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Xử lý nút "Lưu & Xuất PDF":
   * Async -> Lưu DB (Flatten) -> Gọi window.print() để in bảng HTML clone từ form Excel TV-PSGC2022.
   */
  const handleSaveAndExportPDFClick = async () => {
    setIsSubmitting(true);
    try {
      const flattened = await persistFlattenedRecordsToSupabase();

      const payload = buildPayload();
      onSaveAndExportPDF?.(payload);

      showToast(
        `Đã lưu ${formatNumberVN(
          flattened.length
        )} bản ghi tăng ca vào hệ thống. Đang mở cửa sổ in PDF biểu mẫu TV-PSGC2022...`
      );

      setTimeout(() => {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          window.print();
        }
      }, 100);
    } catch (error) {
      showToast(getFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Chuẩn bị danh sách dòng cho bảng HTML Print Clone (TV-PSGC2022) với rowSpan chuẩn theo từng Block
  const printableBlockRows = useMemo(() => {
    let runningNo = 1;
    const activeBlocks =
      blocks.length > 0
        ? blocks
        : [
            {
              id: 'empty-print-block',
              reasonVi: '',
              reasonKr: '',
              startTime: '16:10',
              endTime: '20:10',
              selectedEmployeeIds: [],
            },
          ];

    return activeBlocks.map((block) => {
      const participantIds =
        block.selectedEmployeeIds.length > 0
          ? block.selectedEmployeeIds
          : ['__EMPTY_PARTICIPANT__'];

      const rows = participantIds.map((empId, idxInBlock) => {
        const emp = employeeMap.get(empId);
        const no = runningNo;
        runningNo += 1;
        return {
          no,
          fullName: emp ? emp.fullName : '',
          isFirstInBlock: idxInBlock === 0,
          rowSpan: participantIds.length,
          combinedReason: buildCombinedReasonText(
            block.reasonVi,
            block.reasonKr
          ),
          startTimeFormatted: formatTimeToFormStyle(block.startTime),
          endTimeFormatted: formatTimeToFormStyle(block.endTime),
        };
      });

      return {
        blockId: block.id,
        rows,
      };
    });
  }, [blocks, employeeMap]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* ===================================================================
          GIAO DIỆN NHẬP LIỆU TRÊN MÀN HÌNH (ẨN KHI IN BẰNG print:hidden / no-print)
      =================================================================== */}
      <div className="no-print print:hidden w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-28 space-y-5">
        {/* 1. HEADER: TIÊU ĐỀ TRANG & BỘ LỌC CỐ ĐỊNH (BỘ PHẬN + NGÀY LÀM THÊM) */}
        <header className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-800">
              Tạo phiếu tăng ca (TV-PSGC2022)
            </h1>

            {/* Thống kê nhanh theo chuẩn định dạng số Việt Nam */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">
                Số nhóm:{' '}
                <strong className="font-mono text-[#14539E]">
                  {formatNumberVN(summaryStats.blockCount)}
                </strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">
                Nhân sự tham gia:{' '}
                <strong className="font-mono text-[#14539E]">
                  {formatNumberVN(summaryStats.totalParticipants)}
                </strong>{' '}
                lượt
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">
                Tổng giờ dự kiến:{' '}
                <strong className="font-mono text-[#14539E]">
                  {formatNumberVN(summaryStats.totalHours)}
                </strong>{' '}
                giờ
              </span>
            </div>
          </div>

          {/* Bộ lọc cố định: Dropdown chọn Bộ phận và Datepicker chọn Ngày làm thêm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label
                htmlFor="overtime-department-select"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Bộ phận
              </label>
              <select
                id="overtime-department-select"
                data-testid="overtime-department-select"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all cursor-pointer"
              >
                <option value="ALL">
                  Kỹ Thuật 기술 — Tất cả nhóm ({formatNumberVN(groups.length)})
                </option>
                {groups.map((grp) => (
                  <option key={grp.id} value={grp.name}>
                    {grp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="overtime-date-input"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Ngày làm thêm
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="overtime-date-input"
                  data-testid="overtime-date-input"
                  type="date"
                  value={overtimeDate}
                  onChange={(e) => setOvertimeDate(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 py-2 text-sm font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all cursor-pointer"
                />
              </div>
            </div>
          </div>
        </header>

        {/* 2. BODY: DANH SÁCH CÁC BLOCK (NHÓM CÔNG VIỆC) & NÚT THÊM NHÓM */}
        <div className="space-y-4">
          {blocks.map((block, index) => {
            const searchKeyword = (
              employeeSearchByBlock[block.id] || ''
            ).trim();
            const normalizedQuery = searchKeyword.toLowerCase();

            const filteredEmployees = availableEmployees.filter((emp) => {
              if (!normalizedQuery) return true;
              return (
                emp.fullName.toLowerCase().includes(normalizedQuery) ||
                emp.employeeCode.toLowerCase().includes(normalizedQuery) ||
                emp.department.toLowerCase().includes(normalizedQuery)
              );
            });

            const filteredIds = filteredEmployees.map((e) => e.id);
            const isAllFilteredSelected =
              filteredIds.length > 0 &&
              filteredIds.every((id) => block.selectedEmployeeIds.includes(id));

            const durationHours = OvertimeFormService.calculateDurationHours(
              block.startTime,
              block.endTime
            );

            return (
              <section
                key={block.id}
                data-testid={`overtime-task-block-${index}`}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Tiêu đề Card Block + Nút "Xóa nhóm này" ở góc phải */}
                <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#14539E] text-white text-xs font-bold font-mono">
                      {formatNumberVN(index + 1)}
                    </span>
                    <h2 className="text-sm font-bold text-slate-800">
                      Nhóm công việc #{formatNumberVN(index + 1)}
                    </h2>
                    {durationHours > 0 && (
                      <span className="text-xs text-slate-500 font-mono">
                        ({formatNumberVN(durationHours)} giờ/người)
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    data-testid={`remove-block-btn-${index}`}
                    onClick={() => handleRemoveBlock(index)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600/80 bg-red-50/70 hover:bg-red-100 hover:text-red-700 border border-red-200/60 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa nhóm này</span>
                  </button>
                </div>

                {/* Nội dung 3 Hàng của Block */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* HÀNG 1 (LÝ DO): Input Lý do (Tiếng Việt) + Nút Icon "Dịch tự động" + Input Lý do (Tiếng Hàn) */}
                  <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-start">
                    {/* Lý do (Tiếng Việt) */}
                    <div className="lg:col-span-5">
                      <label
                        htmlFor={`reason-vi-${block.id}`}
                        className="block text-xs font-semibold text-slate-600 mb-1.5"
                      >
                        Lý do (Tiếng Việt)
                      </label>
                      <input
                        id={`reason-vi-${block.id}`}
                        data-testid={`reason-vi-input-${index}`}
                        type="text"
                        value={block.reasonVi}
                        onChange={(e) =>
                          handleUpdateBlockField(
                            index,
                            'reasonVi',
                            e.target.value
                          )
                        }
                        placeholder="VD: 1. Lắp ráp máy quấn core PQ50 DATBIKE..."
                        className="w-full h-10 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all"
                      />
                    </div>

                    {/* Nút Icon "Dịch tự động" gọi hàm mock handleTranslate(index) */}
                    <div className="lg:col-span-1 flex lg:flex-col items-center justify-center lg:pt-6">
                      <button
                        type="button"
                        data-testid={`auto-translate-btn-${index}`}
                        onClick={() => handleTranslate(index)}
                        title="Dịch tự động sang Tiếng Hàn"
                        aria-label="Dịch tự động sang Tiếng Hàn"
                        className="h-10 px-3 lg:px-2.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-[#14539E] text-slate-700 hover:text-white inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                      >
                        <Languages className="w-4 h-4 shrink-0" />
                        <span className="lg:hidden">Dịch tự động</span>
                      </button>
                    </div>

                    {/* Lý do (Tiếng Hàn) */}
                    <div className="lg:col-span-5">
                      <label
                        htmlFor={`reason-kr-${block.id}`}
                        className="block text-xs font-semibold text-slate-600 mb-1.5"
                      >
                        Lý do (Tiếng Hàn)
                      </label>
                      <input
                        id={`reason-kr-${block.id}`}
                        data-testid={`reason-kr-input-${index}`}
                        type="text"
                        value={block.reasonKr}
                        onChange={(e) =>
                          handleUpdateBlockField(
                            index,
                            'reasonKr',
                            e.target.value
                          )
                        }
                        placeholder="잔업. 특근사유 (Tự động điền hoặc chỉnh sửa)..."
                        className="w-full h-10 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* HÀNG 2 (THỜI GIAN): Input Giờ bắt đầu (type="time") + Input Giờ kết thúc (type="time") */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label
                        htmlFor={`start-time-${block.id}`}
                        className="block text-xs font-semibold text-slate-600 mb-1.5"
                      >
                        Giờ bắt đầu
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id={`start-time-${block.id}`}
                          data-testid={`start-time-input-${index}`}
                          type="time"
                          value={block.startTime}
                          onChange={(e) =>
                            handleUpdateBlockField(
                              index,
                              'startTime',
                              e.target.value
                            )
                          }
                          className="w-full h-10 pl-9 pr-3 py-2 text-sm font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`end-time-${block.id}`}
                        className="block text-xs font-semibold text-slate-600 mb-1.5"
                      >
                        Giờ kết thúc
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id={`end-time-${block.id}`}
                          data-testid={`end-time-input-${index}`}
                          type="time"
                          value={block.endTime}
                          onChange={(e) =>
                            handleUpdateBlockField(
                              index,
                              'endTime',
                              e.target.value
                            )
                          }
                          className="w-full h-10 pl-9 pr-3 py-2 text-sm font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* HÀNG 3 (NHÂN SỰ): Danh sách Checkbox / Multi-select chọn HÀNG LOẠT nhân viên tham gia nhóm công việc */}
                  <div className="pt-1 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Users className="w-3.5 h-3.5 text-[#14539E]" />
                        <span>
                          Nhân sự tham gia nhóm công việc (Đã chọn{' '}
                          <strong className="font-mono text-[#14539E]">
                            {formatNumberVN(block.selectedEmployeeIds.length)}
                          </strong>
                          /{formatNumberVN(availableEmployees.length)} nhân viên)
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        {/* Ô tìm kiếm nhanh nhân viên trong Block */}
                        <div className="relative w-52">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) =>
                              setEmployeeSearchByBlock((prev) => ({
                                ...prev,
                                [block.id]: e.target.value,
                              }))
                            }
                            placeholder="Tìm Mã NV, Họ tên..."
                            className="w-full h-8 pl-8 pr-6 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#14539E]"
                          />
                          {searchKeyword && (
                            <button
                              type="button"
                              onClick={() =>
                                setEmployeeSearchByBlock((prev) => ({
                                  ...prev,
                                  [block.id]: '',
                                }))
                              }
                              aria-label="Xóa tìm kiếm nhân sự"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Nút Chọn hàng loạt / Bỏ chọn tất cả */}
                        <button
                          type="button"
                          data-testid={`select-all-employees-btn-${index}`}
                          onClick={() =>
                            handleSelectAllFilteredInBlock(index, filteredIds)
                          }
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-[#14539E] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {isAllFilteredSelected
                            ? 'Bỏ chọn tất cả'
                            : 'Chọn tất cả'}
                        </button>
                      </div>
                    </div>

                    {/* Khung danh sách Checkbox chọn hàng loạt nhân viên */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                      <div className="max-h-52 overflow-y-auto p-2.5">
                        {filteredEmployees.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-500">
                            Không tìm thấy nhân sự phù hợp với bộ lọc hiện tại.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {filteredEmployees.map((emp) => {
                              const isChecked =
                                block.selectedEmployeeIds.includes(emp.id);
                              return (
                                <label
                                  key={emp.id}
                                  data-testid={`emp-checkbox-label-${index}-${emp.employeeCode}`}
                                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs transition-all cursor-pointer select-none ${
                                    isChecked
                                      ? 'bg-blue-50/70 border-[#14539E] text-slate-900 shadow-2xs'
                                      : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-white'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      handleToggleEmployeeInBlock(index, emp.id)
                                    }
                                    className="sr-only"
                                  />
                                  <span
                                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                                      isChecked
                                        ? 'bg-[#14539E] border-[#14539E] text-white'
                                        : 'bg-white border-slate-300'
                                    }`}
                                  >
                                    {isChecked && (
                                      <Check className="w-3 h-3 stroke-[2.5]" />
                                    )}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate leading-snug">
                                      {emp.fullName}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono truncate">
                                      {emp.employeeCode} • {emp.department}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          {/* Nút "+ Thêm nhóm công việc" (Nút viền đứt outline, chữ #14539E, nằm dưới cùng) */}
          <button
            type="button"
            data-testid="add-overtime-block-btn"
            onClick={handleAddBlock}
            className="w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-[#14539E]/40 hover:border-[#14539E] bg-white/80 hover:bg-blue-50/40 text-[#14539E] font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Thêm nhóm công việc</span>
          </button>
        </div>
      </div>

      {/* 3. FOOTER: THANH HÀNH ĐỘNG CỐ ĐỊNH DƯỚI ĐÁY (STICKY FOOTER - ẨN KHI IN) */}
      <footer className="no-print print:hidden sticky bottom-0 z-30 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-500">
            Biểu mẫu áp dụng:{' '}
            <strong className="text-slate-700 font-mono">TV-PSGC2022</strong> •
            Tổng cộng{' '}
            <strong className="text-slate-800 font-mono">
              {formatNumberVN(summaryStats.blockCount)}
            </strong>{' '}
            nhóm công việc ({formatNumberVN(summaryStats.totalParticipants)}{' '}
            lượt nhân sự)
          </div>

          <div className="flex items-center justify-end gap-3">
            {/* Nút phụ outline: Lưu & Xuất PDF */}
            <button
              type="button"
              disabled={isSubmitting}
              data-testid="save-export-pdf-btn"
              onClick={handleSaveAndExportPDFClick}
              className="h-10 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 hover:text-[#14539E] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              ) : (
                <FileText className="w-4 h-4 text-slate-500" />
              )}
              <span>Lưu &amp; Xuất PDF</span>
            </button>

            {/* Nút chính bg-[#14539E] text-white: Lưu & Xuất Excel */}
            <button
              type="button"
              disabled={isSubmitting}
              data-testid="save-export-excel-btn"
              onClick={handleSaveAndExportExcelClick}
              className="h-10 px-5 py-2 rounded-lg bg-[#14539E] hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-white" />
              )}
              <span>Lưu &amp; Xuất Excel</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Toast Notification (Ẩn khi in) */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          data-testid="overtime-toast"
          className="no-print print:hidden fixed bottom-20 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs font-medium max-w-md"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Đóng thông báo"
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ===================================================================
          4. BẢN IN HTML CLONE TỪ FORM EXCEL TV-PSGC2022 (CHỈ HIỆN KHI IN @media print)
      =================================================================== */}
      <div
        data-testid="overtime-print-sheet"
        className="hidden print:block bg-white text-black p-4 font-serif"
      >
        {/* Dòng 1: Tên công ty (trái) & Mã biểu mẫu (phải) */}
        <div className="flex items-center justify-between text-xs mb-2">
          <span>Transon Viet nam Co., Ltd</span>
          <span className="pr-12">Biểu mẫu số: TV-PSGC2022</span>
        </div>

        {/* Cụm Tiêu đề lớn (trái) & Bảng chữ ký phê duyệt (phải) */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="pt-3">
            <div className="text-lg font-bold leading-snug">
              PHIẾU ĐỀ NGHỊ LÀM THÊM
            </div>
            <div className="text-base font-bold leading-snug">
              잔업. 특근 신청서
            </div>
          </div>

          {/* Bảng chữ ký góc phải (Người lập, Kiểm tra, Phê duyệt) */}
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

        {/* Dòng Bộ phận & Ngày làm thêm */}
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span>{formatDepartmentHeaderLabel(selectedDepartment)}</span>
          <span className="font-bold pr-24">
            {formatDateToFormStyle(overtimeDate)}
          </span>
        </div>

        {/* Bảng chính 7 cột với rowSpan gộp cột (3), (4), (5), (6) theo từng Block */}
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="text-center">
              <th className="border border-black px-1.5 py-1 w-8 font-normal">
                No
              </th>
              <th className="border border-black px-2 py-1 w-44 font-normal">
                Danh sách làm thêm
              </th>
              <th className="border border-black px-2 py-1 font-normal">
                Lý do làm thêm
              </th>
              <th className="border border-black px-2 py-1 w-20 font-normal">
                Giờ bắt đầu
              </th>
              <th className="border border-black px-2 py-1 w-20 font-normal">
                Giờ kết thúc
              </th>
              <th className="border border-black px-2 py-1 w-24 font-normal">
                Tổng thời gian
              </th>
              <th className="border border-black px-2 py-1 w-20 font-normal">
                Ký nhận
              </th>
            </tr>
            <tr className="text-center">
              <th className="border border-black px-1.5 py-1 font-normal" />
              <th className="border border-black px-2 py-1 font-normal">
                명단
              </th>
              <th className="border border-black px-2 py-1 font-normal">
                잔업. 특근사유
              </th>
              <th className="border border-black px-2 py-1 font-normal">
                시작
              </th>
              <th className="border border-black px-2 py-1 font-normal">
                종료
              </th>
              <th className="border border-black px-2 py-1 font-normal">
                총 시간
              </th>
              <th className="border border-black px-2 py-1 font-normal">
                싸인
              </th>
            </tr>
          </thead>
          <tbody>
            {printableBlockRows.map((group) =>
              group.rows.map((row) => (
                <tr key={`${group.blockId}-${row.no}`} className="h-7">
                  {/* Cột 1: No */}
                  <td className="border border-black px-1.5 py-1 text-center">
                    {row.no}
                  </td>
                  {/* Cột 2: Danh sách làm thêm */}
                  <td className="border border-black px-2 py-1 text-left">
                    {row.fullName}
                  </td>
                  {/* Cột 3, 4, 5, 6: Gộp theo Block (rowSpan) */}
                  {row.isFirstInBlock && (
                    <>
                      <td
                        rowSpan={row.rowSpan}
                        className="border border-black px-2.5 py-1.5 text-left align-middle whitespace-pre-line"
                      >
                        {row.combinedReason}
                      </td>
                      <td
                        rowSpan={row.rowSpan}
                        className="border border-black px-2 py-1 text-center font-bold align-middle"
                      >
                        {row.startTimeFormatted}
                      </td>
                      <td
                        rowSpan={row.rowSpan}
                        className="border border-black px-2 py-1 text-center font-bold align-middle"
                      >
                        {row.endTimeFormatted}
                      </td>
                      <td
                        rowSpan={row.rowSpan}
                        className="border border-black px-2 py-1 text-center align-middle"
                      />
                    </>
                  )}
                  {/* Cột 7: Ký nhận */}
                  <td className="border border-black px-2 py-1" />
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer Ghi chú song ngữ Việt - Hàn dưới cùng */}
        <div className="mt-2 text-[11px] space-y-0.5 leading-snug">
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
    </div>
  );
};

export default CreateOvertimeForm;
