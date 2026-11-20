import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
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

export interface OvertimeParticipant {
  employeeId: string;
  startTime: string;
  endTime: string;
}

export interface OvertimeTaskBlock {
  id: string;
  overtimeDate: string; // YYYY-MM-DD
  reasonVi: string;
  reasonKr: string;
  startTime: string; // Giờ chung
  endTime: string;   // Giờ chung
  selectedEmployeeIds: string[];
  participants: OvertimeParticipant[]; // Từng nhân sự kèm giờ riêng
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
 * Từ điển các cụm từ tăng ca phổ biến trong nhà máy để dịch tức thì
 */
const FACTORY_DICTIONARY: Record<string, string> = {
  'trực sản xuất': '생산 당직',
  'sửa máy': '설비 수리',
  'hàng gấp': '긴급 생산',
  'đổi model': '모델 교체',
  'vệ sinh': '청소',
  'kiểm tra hàng': '품질 검사',
  'đóng gói': '포장 작업',
  'bảo dưỡng': '정기 보수',
  'họp sản xuất': '생산 회의',
};

/**
 * Hàm dịch thực tế Tiếng Việt -> Tiếng Hàn qua Từ điển nhà máy hoặc Google Translate API
 */
const translateVnToKr = async (text: string): Promise<string> => {
  if (!text) return '';
  const cleaned = text.trim().toLowerCase();
  if (FACTORY_DICTIONARY[cleaned]) {
    return FACTORY_DICTIONARY[cleaned];
  }
  for (const [k, v] of Object.entries(FACTORY_DICTIONARY)) {
    if (cleaned === k) return v;
  }
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=ko&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await response.json();
    return data[0].map((item: [string]) => item[0]).join('');
  } catch (error) {
    console.error('Lỗi dịch thuật:', error);
    return text;
  }
};

/**
 * Lớp dịch vụ xử lý logic nghiệp vụ Phiếu tăng ca (OOP Domain Service)
 */
class OvertimeFormService {
  static createEmptyBlock(defaultDate = '2026-11-16'): OvertimeTaskBlock {
    return {
      id: `ot-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      overtimeDate: defaultDate,
      reasonVi: '',
      reasonKr: '',
      startTime: '16:10',
      endTime: '20:10',
      selectedEmployeeIds: [],
      participants: [],
      isTranslating: false,
    };
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

  static sanitize24hTimeInput(raw: string): string {
    const cleaned = raw.replace(/[^\d:]/g, '');
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx !== -1) {
      const before = cleaned.slice(0, colonIdx).slice(0, 2);
      const after = cleaned
        .slice(colonIdx + 1)
        .replace(/:/g, '')
        .slice(0, 2);
      return `${before}:${after}`;
    }
    const digitsOnly = cleaned.slice(0, 4);
    if (digitsOnly.length >= 3) {
      return `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2)}`;
    }
    return digitsOnly;
  }

  static normalize24hTime(raw: string, fallback: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    const match = trimmed.match(/^(\d{1,2}):?(\d{0,2})$/);
    if (!match) return fallback;
    const rawHours = parseInt(match[1], 10);
    const rawMinutes = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
    if (Number.isNaN(rawHours) || Number.isNaN(rawMinutes)) return fallback;
    const clampedHours = Math.min(23, Math.max(0, rawHours));
    const clampedMinutes = Math.min(59, Math.max(0, rawMinutes));
    return `${String(clampedHours).padStart(2, '0')}:${String(clampedMinutes).padStart(2, '0')}`;
  }
}

interface PrintableRow {
  no: number;
  fullName: string;
  isFirstInBlock: boolean;
  rowSpan: number;
  combinedReason: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
}

interface PrintableDateGroup {
  date: string;
  formattedDate: string;
  blocks: {
    blockId: string;
    rows: PrintableRow[];
  }[];
}

export const CreateOvertimeForm: React.FC<CreateOvertimeFormProps> = ({
  employees = INITIAL_EMPLOYEES,
  groups = INITIAL_DEPARTMENT_GROUPS,
  initialDepartment = 'ALL',
  initialDate = '2026-11-16',
  onSaveAndExportPDF,
  onSaveAndExportExcel,
}) => {
  // =========================================================================
  // 1. STATE QUẢN LÝ FORM & BỘ LỌC
  // =========================================================================

  // Hàng 1: Bộ phận / Nhóm & Ngày làm thêm
  const [selectedDepartment, setSelectedDepartment] =
    useState<string>(initialDepartment);
  const [overtimeDate, setOvertimeDate] = useState<string>(initialDate);

  // Hàng 2: Giờ tăng ca (Giờ chung)
  const [currentStartTime, setCurrentStartTime] = useState<string>('16:10');
  const [currentEndTime, setCurrentEndTime] = useState<string>('20:10');

  // Hàng 3: Chọn nhân sự + State chỉnh giờ riêng từng cá nhân
  const [currentSelectedEmployeeIds, setCurrentSelectedEmployeeIds] = useState<string[]>([]);
  const [customTimes, setCustomTimes] = useState<
    Record<string, { startTime: string; endTime: string }>
  >({});
  const [editingTimeEmpId, setEditingTimeEmpId] = useState<string | null>(null);
  const [employeeGroupFilter, setEmployeeGroupFilter] = useState<string>(initialDepartment);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>('');

  // Hàng 4: Lý do tăng ca (Tiếng Việt -> Tiếng Hàn)
  const [currentReasonVi, setCurrentReasonVi] = useState<string>('Trực sản xuất');
  const [currentReasonKr, setCurrentReasonKr] = useState<string>('생산 당직');
  const [isAutoTranslating, setIsAutoTranslating] = useState<boolean>(false);
  const isInitialReasonMountRef = useRef<boolean>(true);

  // Hàng 6: Mảng State previewData chứa danh sách các Block đã được "Ghi nhận"
  const [previewData, setPreviewData] = useState<OvertimeTaskBlock[]>([]);

  // Trạng thái đang xử lý lưu DB / xuất file
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Thông báo Toast thân thiện trên giao diện
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Bản đồ tra cứu nhanh nhân viên theo ID
  const employeeMap = useMemo(
    () => new Map<string, Employee>(employees.map((e) => [e.id, e])),
    [employees]
  );

  // Danh sách bộ phận/nhóm duy nhất cho dropdown lọc nhân sự
  const departmentFilterOptions = useMemo(() => {
    const names = new Set<string>();
    groups.forEach((g) => {
      if (g.name?.trim()) names.add(g.name.trim());
    });
    employees.forEach((emp) => {
      if (emp.department?.trim()) names.add(emp.department.trim());
    });
    return Array.from(names);
  }, [groups, employees]);

  // 1. Tìm danh sách nhân sự đã được ghi nhận trong cùng ngày (overtimeDate đang chọn)
  const alreadyRecordedIdsForCurrentDate = useMemo(() => {
    const set = new Set<string>();
    for (const block of previewData) {
      if ((block.overtimeDate || '') === overtimeDate) {
        if (Array.isArray(block.participants) && block.participants.length > 0) {
          for (const p of block.participants) {
            if (p.employeeId) set.add(p.employeeId);
          }
        }
        if (Array.isArray(block.selectedEmployeeIds)) {
          for (const id of block.selectedEmployeeIds) {
            if (id) set.add(id);
          }
        }
      }
    }
    return set;
  }, [previewData, overtimeDate]);

  // 2. Danh sách nhân sự khả dụng theo Bộ lọc Nhóm & ô tìm kiếm (Loại trừ người đã ghi nhận hôm nay)
  const filteredEmployeesForInput = useMemo(() => {
    // Loại trừ các nhân sự đã được ghi nhận trong cùng ngày overtimeDate
    const available = employees.filter(
      (emp) => !alreadyRecordedIdsForCurrentDate.has(emp.id)
    );

    const byGroup =
      !employeeGroupFilter || employeeGroupFilter === 'ALL'
        ? available
        : available.filter((emp) => emp.department === employeeGroupFilter);

    const query = employeeSearchQuery.trim().toLowerCase();
    if (!query) return byGroup;
    return byGroup.filter(
      (emp) =>
        emp.fullName.toLowerCase().includes(query) ||
        emp.employeeCode.toLowerCase().includes(query) ||
        emp.department.toLowerCase().includes(query)
    );
  }, [
    employees,
    employeeGroupFilter,
    employeeSearchQuery,
    alreadyRecordedIdsForCurrentDate,
  ]);

  // Tự động dọn dẹp các ID đã chọn nếu chúng đã nằm trong danh sách đã ghi nhận của ngày này
  useEffect(() => {
    setCurrentSelectedEmployeeIds((prev) => {
      const valid = prev.filter(
        (id) => !alreadyRecordedIdsForCurrentDate.has(id)
      );
      return valid.length === prev.length ? prev : valid;
    });
  }, [alreadyRecordedIdsForCurrentDate]);

  // Thống kê tổng số nhóm, tổng số lượt nhân sự và số ngày tăng ca
  const summaryStats = useMemo(() => {
    let totalParticipants = 0;
    let totalHours = 0;
    const dateSet = new Set<string>();

    for (const block of previewData) {
      if (block.overtimeDate) dateSet.add(block.overtimeDate);
      const parts =
        Array.isArray(block.participants) && block.participants.length > 0
          ? block.participants
          : block.selectedEmployeeIds.map((id) => ({
              employeeId: id,
              startTime: block.startTime,
              endTime: block.endTime,
            }));
      totalParticipants += parts.length;
      for (const p of parts) {
        totalHours += OvertimeFormService.calculateDurationHours(
          p.startTime || block.startTime,
          p.endTime || block.endTime
        );
      }
    }

    return {
      blockCount: previewData.length,
      totalParticipants,
      totalHours: Number(totalHours.toFixed(2)),
      datesCount: dateSet.size || (previewData.length > 0 ? 1 : 0),
    };
  }, [previewData]);

  // Hàm dịch tự động Tiếng Việt -> Tiếng Hàn
  const handleTranslate = async (sourceReasonVi: string): Promise<string> => {
    if (!sourceReasonVi.trim()) {
      return '';
    }
    const translatedText = await translateVnToKr(sourceReasonVi);
    return translatedText;
  };

  // Real-time Translation với Debounce 500ms khi người dùng nhập Lý do (Tiếng Việt)
  useEffect(() => {
    if (isInitialReasonMountRef.current) {
      isInitialReasonMountRef.current = false;
      return;
    }

    if (!currentReasonVi.trim()) {
      setIsAutoTranslating(false);
      setCurrentReasonKr('');
      return;
    }

    let isCancelled = false;
    setIsAutoTranslating(true);
    const debounceTimer = window.setTimeout(async () => {
      const translatedText = await handleTranslate(currentReasonVi);
      if (!isCancelled) {
        setCurrentReasonKr(translatedText);
        setIsAutoTranslating(false);
      }
    }, 500);

    return () => {
      isCancelled = true;
      window.clearTimeout(debounceTimer);
    };
  }, [currentReasonVi]);

  // Toggle chọn nhân viên trong form nhập liệu hiện tại
  const handleToggleEmployee = (empId: string) => {
    setCurrentSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  // Chọn tất cả / Bỏ chọn tất cả nhân sự đang lọc
  const handleSelectAllFiltered = () => {
    const filteredIds = filteredEmployeesForInput.map((e) => e.id);
    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => currentSelectedEmployeeIds.includes(id));
    if (allSelected) {
      setCurrentSelectedEmployeeIds((prev) =>
        prev.filter((id) => !filteredIds.includes(id))
      );
    } else {
      setCurrentSelectedEmployeeIds((prev) =>
        Array.from(new Set([...prev, ...filteredIds]))
      );
    }
  };

  // =========================================================================
  // 2. HÀNG 5: HÀNH ĐỘNG GHI NHẬN VÀO DANH SÁCH XEM TRƯỚC
  // =========================================================================
  const handleCommitBlock = async () => {
    if (currentSelectedEmployeeIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một nhân sự tham gia nhóm công việc này.');
      return;
    }
    if (!currentReasonVi.trim()) {
      showToast('Vui lòng nhập lý do tăng ca (Tiếng Việt).');
      return;
    }

    const normalizedStart = OvertimeFormService.normalize24hTime(
      currentStartTime,
      '16:10'
    );
    const normalizedEnd = OvertimeFormService.normalize24hTime(
      currentEndTime,
      '20:10'
    );
    setCurrentStartTime(normalizedStart);
    setCurrentEndTime(normalizedEnd);

    const finalReasonKr =
      currentReasonKr.trim() ||
      (await translateVnToKr(currentReasonVi.trim()));

    // Xây dựng mảng participants lưu kèm giờ riêng của từng nhân sự
    const participants: OvertimeParticipant[] = currentSelectedEmployeeIds.map(
      (empId) => {
        const custom = customTimes[empId];
        return {
          employeeId: empId,
          startTime: custom?.startTime
            ? OvertimeFormService.normalize24hTime(custom.startTime, normalizedStart)
            : normalizedStart,
          endTime: custom?.endTime
            ? OvertimeFormService.normalize24hTime(custom.endTime, normalizedEnd)
            : normalizedEnd,
        };
      }
    );

    const newBlock: OvertimeTaskBlock = {
      id: `ot-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      overtimeDate: overtimeDate || '2026-11-16',
      reasonVi: currentReasonVi.trim(),
      reasonKr: finalReasonKr.trim(),
      startTime: normalizedStart,
      endTime: normalizedEnd,
      selectedEmployeeIds: [...currentSelectedEmployeeIds],
      participants,
      isTranslating: false,
    };

    setPreviewData((prev) => [...prev, newBlock]);

    // Reset các ô đã chọn và form nhưng giữ nguyên overtimeDate, startTime, endTime
    setCurrentReasonVi('');
    setCurrentReasonKr('');
    setCurrentSelectedEmployeeIds([]);
    setCustomTimes({});
    setEditingTimeEmpId(null);
    showToast(
      `Đã ghi nhận nhóm [${formatDateToFormStyle(newBlock.overtimeDate)}] vào danh sách xem trước!`
    );
  };

  // Xóa một block khỏi previewData
  const handleRemovePreviewBlock = (index: number) => {
    setPreviewData((prev) => prev.filter((_, idx) => idx !== index));
    showToast('Đã xóa nhóm công việc khỏi bản xem trước.');
  };

  const buildPayload = (): CreateOvertimeFormPayload => ({
    department: selectedDepartment,
    overtimeDate,
    blocks: previewData,
  });

  const persistFlattenedRecordsToSupabase = async () => {
    const flattenedRecords = flattenOvertimeBlocksToRecords(
      previewData,
      selectedDepartment,
      overtimeDate,
      employees
    );
    await insertOvertimeRecords(flattenedRecords);
    return flattenedRecords;
  };

  const handleSaveAndExportExcelClick = async () => {
    if (previewData.length === 0) {
      showToast('Vui lòng ghi nhận ít nhất một nhóm công việc trước khi xuất Excel.');
      return;
    }
    setIsSubmitting(true);
    try {
      const flattened = await persistFlattenedRecordsToSupabase();

      await overtimeExportService.exportExcel({
        department: selectedDepartment,
        overtimeDate,
        blocks: previewData,
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

  const handleSaveAndExportPDFClick = async () => {
    if (previewData.length === 0) {
      showToast('Vui lòng ghi nhận ít nhất một nhóm công việc trước khi xuất PDF.');
      return;
    }
    setIsSubmitting(true);
    try {
      const flattened = await persistFlattenedRecordsToSupabase();

      const payload = buildPayload();
      onSaveAndExportPDF?.(payload);

      showToast(
        `Đã lưu ${formatNumberVN(
          flattened.length
        )} bản ghi tăng ca vào hệ thống. Đang mở hộp thoại in PDF biểu mẫu TV-PSGC2022...`
      );

      setTimeout(() => {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          window.print();
        }
      }, 150);
    } catch (error) {
      showToast(getFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 3. XỬ LÝ DỮ LIỆU HIỂN THỊ PREVIEW & PRINT (IN GIỜ RIÊNG CỦA TỪNG CÁ NHÂN)
  // =========================================================================
  const printableDateGroups = useMemo((): PrintableDateGroup[] => {
    if (previewData.length === 0) {
      // Nhóm Draft đang soạn thảo
      const draftParticipants: OvertimeParticipant[] =
        currentSelectedEmployeeIds.length > 0
          ? currentSelectedEmployeeIds.map((id) => ({
              employeeId: id,
              startTime:
                customTimes[id]?.startTime
                  ? OvertimeFormService.normalize24hTime(
                      customTimes[id].startTime,
                      currentStartTime
                    )
                  : currentStartTime,
              endTime:
                customTimes[id]?.endTime
                  ? OvertimeFormService.normalize24hTime(
                      customTimes[id].endTime,
                      currentEndTime
                    )
                  : currentEndTime,
            }))
          : [
              {
                employeeId: '__EMPTY_PARTICIPANT__',
                startTime: currentStartTime || '16:10',
                endTime: currentEndTime || '20:10',
              },
            ];

      const combinedReason = buildCombinedReasonText(
        currentReasonVi || 'Trực sản xuất',
        currentReasonKr || '생산 당직'
      );

      return [
        {
          date: overtimeDate,
          formattedDate: formatDateToFormStyle(overtimeDate),
          blocks: [
            {
              blockId: 'draft-block',
              rows: draftParticipants.map((p, idx) => {
                const emp = employeeMap.get(p.employeeId);
                return {
                  no: idx + 1,
                  fullName: emp ? emp.fullName : '(Chưa chọn nhân sự)',
                  isFirstInBlock: idx === 0,
                  rowSpan: draftParticipants.length,
                  combinedReason,
                  startTimeFormatted: formatTimeToFormStyle(p.startTime),
                  endTimeFormatted: formatTimeToFormStyle(p.endTime),
                };
              }),
            },
          ],
        },
      ];
    }

    // Gom các block đã ghi nhận theo overtimeDate
    const mapByDate = new Map<string, OvertimeTaskBlock[]>();
    for (const block of previewData) {
      const d = block.overtimeDate || overtimeDate;
      if (!mapByDate.has(d)) {
        mapByDate.set(d, []);
      }
      mapByDate.get(d)!.push(block);
    }

    const sortedDates = Array.from(mapByDate.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    return sortedDates.map((date) => {
      const blocksForDate = mapByDate.get(date)!;
      let runningNo = 1;

      const processedBlocks = blocksForDate.map((block) => {
        const participants: OvertimeParticipant[] =
          Array.isArray(block.participants) && block.participants.length > 0
            ? block.participants
            : block.selectedEmployeeIds.length > 0
            ? block.selectedEmployeeIds.map((id) => ({
                employeeId: id,
                startTime: block.startTime,
                endTime: block.endTime,
              }))
            : [
                {
                  employeeId: '__EMPTY_PARTICIPANT__',
                  startTime: block.startTime,
                  endTime: block.endTime,
                },
              ];

        const combinedReason = buildCombinedReasonText(
          block.reasonVi,
          block.reasonKr
        );

        const rows: PrintableRow[] = participants.map((p, idxInBlock) => {
          const emp = employeeMap.get(p.employeeId);
          const no = runningNo;
          runningNo += 1;
          return {
            no,
            fullName: emp ? emp.fullName : '(Chưa chọn nhân sự)',
            isFirstInBlock: idxInBlock === 0,
            rowSpan: participants.length,
            combinedReason,
            startTimeFormatted: formatTimeToFormStyle(
              p.startTime || block.startTime
            ),
            endTimeFormatted: formatTimeToFormStyle(
              p.endTime || block.endTime
            ),
          };
        });

        return {
          blockId: block.id,
          rows,
        };
      });

      return {
        date,
        formattedDate: formatDateToFormStyle(date),
        blocks: processedBlocks,
      };
    });
  }, [
    previewData,
    employeeMap,
    overtimeDate,
    currentSelectedEmployeeIds,
    customTimes,
    currentReasonVi,
    currentReasonKr,
    currentStartTime,
    currentEndTime,
  ]);

  return (
    <div className="flex flex-col lg:flex-row w-full h-full flex-1 min-h-0 overflow-hidden p-4 gap-4 bg-slate-50 text-slate-800">
      {/* ===================================================================
          CỘT TRÁI (1/3) - BẢNG ĐIỀU KHIỂN TỐI GIẢN 6 HÀNG (MINIMALIST UI)
      =================================================================== */}
      <div className="w-full lg:w-1/3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        {/* Header form */}
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
          <h2 className="text-base font-bold text-[#14539E]">Tạo phiếu tăng ca</h2>
          <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#14539E] border border-blue-200 shrink-0">
            TV-PSGC2022
          </span>
        </div>

        {/* 6 Hàng nhập liệu tối giản */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {/* ===============================================================
              HÀNG 1: Nhóm & Ngày làm thêm (grid 2 cột)
          =============================================================== */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="overtime-department-select"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Bộ phận / Nhóm
              </label>
              <select
                id="overtime-department-select"
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setEmployeeGroupFilter(e.target.value);
                }}
                className="w-full h-9 px-2.5 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                <option value="ALL">Tất cả bộ phận</option>
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
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Ngày làm thêm
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="overtime-date-input"
                  type="date"
                  value={overtimeDate}
                  onChange={(e) => setOvertimeDate(e.target.value)}
                  className="w-full h-9 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* ===============================================================
              HÀNG 2: Giờ tăng ca (Giờ chung) (grid 2 cột)
          =============================================================== */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="start-time-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Giờ bắt đầu (chung)
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="start-time-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{2}:[0-9]{2}"
                  maxLength={5}
                  list="overtime-24h-slots"
                  placeholder="16:10"
                  value={currentStartTime}
                  onChange={(e) =>
                    setCurrentStartTime(
                      OvertimeFormService.sanitize24hTimeInput(e.target.value)
                    )
                  }
                  onBlur={() =>
                    setCurrentStartTime((prev) =>
                      OvertimeFormService.normalize24hTime(prev, '16:10')
                    )
                  }
                  className="w-full h-9 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="end-time-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Giờ kết thúc (chung)
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="end-time-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{2}:[0-9]{2}"
                  maxLength={5}
                  list="overtime-24h-slots"
                  placeholder="20:10"
                  value={currentEndTime}
                  onChange={(e) =>
                    setCurrentEndTime(
                      OvertimeFormService.sanitize24hTimeInput(e.target.value)
                    )
                  }
                  onBlur={() =>
                    setCurrentEndTime((prev) =>
                      OvertimeFormService.normalize24hTime(prev, '20:10')
                    )
                  }
                  className="w-full h-9 pl-8 pr-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>

            <datalist id="overtime-24h-slots">
              <option value="07:00" />
              <option value="08:00" />
              <option value="12:00" />
              <option value="16:10" />
              <option value="17:00" />
              <option value="17:30" />
              <option value="18:00" />
              <option value="18:30" />
              <option value="19:00" />
              <option value="19:30" />
              <option value="20:00" />
              <option value="20:10" />
              <option value="20:30" />
              <option value="21:00" />
              <option value="21:30" />
              <option value="22:00" />
              <option value="23:00" />
            </datalist>
          </div>

          {/* ===============================================================
              HÀNG 3: Chọn nhân sự (Tích hợp chỉnh giờ riêng - Smart Inline Edit)
          =============================================================== */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600">
                Nhân sự tham gia ({currentSelectedEmployeeIds.length} đã chọn)
                {alreadyRecordedIdsForCurrentDate.size > 0 && (
                  <span className="text-slate-400 font-normal ml-1">
                    ({alreadyRecordedIdsForCurrentDate.size} đã ghi nhận)
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-[11px] font-semibold text-[#14539E] hover:underline cursor-pointer"
              >
                {filteredEmployeesForInput.length > 0 &&
                filteredEmployeesForInput.every((e) =>
                  currentSelectedEmployeeIds.includes(e.id)
                )
                  ? 'Bỏ chọn tất cả'
                  : 'Chọn tất cả'}
              </button>
            </div>

            {/* Lọc theo nhóm & Ô tìm kiếm */}
            <div className="grid grid-cols-2 gap-2">
              <select
                id="employee-group-filter"
                aria-label="Lọc theo nhóm"
                value={employeeGroupFilter}
                onChange={(e) => setEmployeeGroupFilter(e.target.value)}
                className="w-full h-8 px-2 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                <option value="ALL">Lọc nhóm: Tất cả</option>
                {departmentFilterOptions.map((deptName) => (
                  <option key={deptName} value={deptName}>
                    {deptName}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Tìm mã, tên..."
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  placeholder="Tìm mã, tên..."
                  className="w-full h-8 pl-7 pr-2 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>

            {/* Danh sách checkbox nhân viên với Smart Inline Edit */}
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-1.5 space-y-1">
              {filteredEmployeesForInput.length === 0 ? (
                <div className="text-center py-3 text-xs text-slate-400">
                  {alreadyRecordedIdsForCurrentDate.size > 0
                    ? `Nhân sự đã được ghi nhận vào ngày ${formatDateToFormStyle(overtimeDate)}.`
                    : 'Không tìm thấy nhân sự phù hợp.'}
                </div>
              ) : (
                filteredEmployeesForInput.map((emp) => {
                  const isSelected = currentSelectedEmployeeIds.includes(emp.id);
                  const empStartTime = customTimes[emp.id]?.startTime || currentStartTime;
                  const empEndTime = customTimes[emp.id]?.endTime || currentEndTime;
                  const isCustomized = !!customTimes[emp.id];
                  const isEditingThis = editingTimeEmpId === emp.id;

                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleToggleEmployee(emp.id)}
                      className={`flex items-center justify-between gap-1.5 p-1.5 rounded-md text-xs cursor-pointer transition-colors select-none ${
                        isSelected
                          ? 'bg-blue-50/80 border border-blue-200 text-slate-900 font-semibold'
                          : 'bg-white border border-slate-100 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          aria-hidden="true"
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-white shrink-0 ${
                            isSelected
                              ? 'bg-[#14539E] border-[#14539E]'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </span>
                        <div className="min-w-0 flex-1 truncate">
                          <span>{emp.fullName}</span>
                          <span className="text-slate-400 text-[10px] font-mono ml-1">
                            ({emp.employeeCode})
                          </span>
                        </div>
                      </div>

                      {/* Smart Inline Edit: chỉ hiển thị khi nhân viên được tick chọn */}
                      {isSelected && (
                        <div
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isEditingThis ? (
                            <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-[#14539E] shadow-2xs">
                              <input
                                type="text"
                                maxLength={5}
                                value={empStartTime}
                                onChange={(e) => {
                                  const val = OvertimeFormService.sanitize24hTimeInput(
                                    e.target.value
                                  );
                                  setCustomTimes((prev) => ({
                                    ...prev,
                                    [emp.id]: {
                                      startTime: val,
                                      endTime:
                                        prev[emp.id]?.endTime || currentEndTime,
                                    },
                                  }));
                                }}
                                onBlur={() => {
                                  setCustomTimes((prev) => ({
                                    ...prev,
                                    [emp.id]: {
                                      startTime: OvertimeFormService.normalize24hTime(
                                        empStartTime,
                                        currentStartTime
                                      ),
                                      endTime:
                                        prev[emp.id]?.endTime || currentEndTime,
                                    },
                                  }));
                                }}
                                className="w-11 h-5 text-[10px] font-mono text-center border border-slate-200 rounded px-0.5 focus:outline-none focus:border-[#14539E]"
                                placeholder="16:10"
                              />
                              <span className="text-[10px] text-slate-400">-</span>
                              <input
                                type="text"
                                maxLength={5}
                                value={empEndTime}
                                onChange={(e) => {
                                  const val = OvertimeFormService.sanitize24hTimeInput(
                                    e.target.value
                                  );
                                  setCustomTimes((prev) => ({
                                    ...prev,
                                    [emp.id]: {
                                      startTime:
                                        prev[emp.id]?.startTime || currentStartTime,
                                      endTime: val,
                                    },
                                  }));
                                }}
                                onBlur={() => {
                                  setCustomTimes((prev) => ({
                                    ...prev,
                                    [emp.id]: {
                                      startTime:
                                        prev[emp.id]?.startTime || currentStartTime,
                                      endTime: OvertimeFormService.normalize24hTime(
                                        empEndTime,
                                        currentEndTime
                                      ),
                                    },
                                  }));
                                }}
                                className="w-11 h-5 text-[10px] font-mono text-center border border-slate-200 rounded px-0.5 focus:outline-none focus:border-[#14539E]"
                                placeholder="20:10"
                              />
                              <button
                                type="button"
                                onClick={() => setEditingTimeEmpId(null)}
                                className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                title="Xong"
                              >
                                <Check className="w-3 h-3 stroke-[2.5]" />
                              </button>
                              {isCustomized && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomTimes((prev) => {
                                      const next = { ...prev };
                                      delete next[emp.id];
                                      return next;
                                    });
                                    setEditingTimeEmpId(null);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                                  title="Khôi phục giờ chung"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingTimeEmpId(emp.id)}
                              className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                isCustomized
                                  ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                              }`}
                              title="Click để sửa giờ riêng cho nhân sự này"
                            >
                              <Clock
                                className={`w-2.5 h-2.5 ${
                                  isCustomized
                                    ? 'text-amber-600'
                                    : 'text-slate-400'
                                }`}
                              />
                              <span>
                                {empStartTime} - {empEndTime}
                              </span>
                              {isCustomized && (
                                <span className="w-1 h-1 rounded-full bg-amber-500" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ===============================================================
              HÀNG 4: Lý do tăng ca (Tiếng Việt & Tiếng Hàn)
          =============================================================== */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="reason-vi-input"
                className="block text-[11px] font-semibold text-slate-600"
              >
                Lý do (Tiếng Việt)
              </label>
              {isAutoTranslating && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#14539E]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Đang dịch...</span>
                </span>
              )}
            </div>
            <textarea
              id="reason-vi-input"
              rows={2}
              value={currentReasonVi}
              onChange={(e) => setCurrentReasonVi(e.target.value)}
              placeholder="VD: Trực sản xuất, sửa máy, hàng gấp..."
              className="w-full p-2 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E]/20 transition-all"
            />

            <label
              htmlFor="reason-kr-input"
              className="block text-[11px] font-semibold text-slate-600"
            >
              Lý do (Tiếng Hàn)
            </label>
            <textarea
              id="reason-kr-input"
              rows={2}
              value={currentReasonKr}
              onChange={(e) => setCurrentReasonKr(e.target.value)}
              placeholder="생산 당직 (Tự động dịch sau 500ms dừng gõ)..."
              className="w-full p-2 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E]/20 transition-all"
            />
          </div>

          {/* ===============================================================
              HÀNG 5: Nút Ghi nhận (Ngắn gọn, không tiêu đề thừa)
          =============================================================== */}
          <button
            type="button"
            onClick={handleCommitBlock}
            className="w-full h-10 rounded-xl bg-[#14539E] hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Ghi nhận</span>
          </button>

          {/* ===============================================================
              HÀNG 6: Các nhóm đã ghi nhận
          =============================================================== */}
          {previewData.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span>Các nhóm đã ghi nhận ({previewData.length}):</span>
                <span className="text-[10px] font-normal text-slate-500">
                  {summaryStats.datesCount} ngày • {summaryStats.totalParticipants} lượt
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {previewData.map((b, idx) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#14539E]">#{idx + 1}</span>
                        <span className="font-bold text-slate-800 font-mono text-[11px]">
                          [{formatDateToFormStyle(b.overtimeDate)}]
                        </span>
                        <span className="text-slate-800 font-medium truncate">
                          {b.reasonVi || 'Không có lý do'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {b.selectedEmployeeIds.length} nhân sự • {b.startTime}-{b.endTime}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePreviewBlock(idx)}
                      className="p-1.5 rounded text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                      title="Xóa nhóm này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================
          CỘT PHẢI (2/3) - KHỐI PREVIEW A4 CHUẨN BIỂU MẪU TV-PSGC2022
      =================================================================== */}
      <div className="w-full lg:w-2/3 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-start">
          {/* Thẻ div mô phỏng tờ giấy A4 ở giữa với font hỗ trợ chuẩn tiếng Việt và tiếng Hàn */}
          <div
            style={{
              fontFamily: "'Times New Roman', 'Malgun Gothic', Arial, sans-serif",
            }}
            className="bg-white shadow-2xl p-6 sm:p-8 max-w-4xl w-full mx-auto text-black rounded-lg space-y-4"
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

              {/* Bảng chữ ký góc phải */}
              <table className="border-collapse border border-black text-[11px] text-center">
                <thead>
                  <tr>
                    <th className="border border-black px-2 py-0.5 font-normal">결</th>
                    <th className="border border-black px-3 py-0.5 font-normal">작성</th>
                    <th className="border border-black px-3 py-0.5 font-normal">검사</th>
                    <th className="border border-black px-3 py-0.5 font-normal">검사</th>
                    <th className="border border-black px-3 py-0.5 font-normal">검사</th>
                    <th className="border border-black px-3 py-0.5 font-normal">승인</th>
                  </tr>
                  <tr>
                    <th className="border border-black px-2 py-0.5 font-normal">xác</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Người lập</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Kiểm tra</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Kiểm tra</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Kiểm tra</th>
                    <th className="border border-black px-3 py-0.5 font-normal">Phê duyệt</th>
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

            {/* Bảng chính 7 cột chuẩn: Lặp lại tiêu đề và phân cách theo từng ngày */}
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                {printableDateGroups.map((dateGroup, dateIdx) => (
                  <React.Fragment key={dateGroup.date}>
                    {/* Hàng Tiêu đề Ngày & Bộ phận: chia thành 2 ô gộp (colSpan 4 & colSpan 3) để căn thẳng hàng dọc 100% */}
                    <tr className={dateIdx === 0 ? 'h-7' : 'h-9'}>
                      <td
                        colSpan={4}
                        className={`border-0 bg-transparent text-left align-middle text-xs font-bold text-black ${
                          dateIdx === 0 ? 'pb-1.5' : 'pt-3 pb-1.5'
                        }`}
                      >
                        {dateIdx === 0
                          ? formatDepartmentHeaderLabel(selectedDepartment)
                          : ''}
                      </td>
                      <td
                        colSpan={3}
                        className={`border-0 bg-transparent text-center align-middle text-xs font-bold text-black ${
                          dateIdx === 0 ? 'pb-1.5' : 'pt-3 pb-1.5'
                        }`}
                      >
                        {dateGroup.formattedDate}
                      </td>
                    </tr>

                    {/* 2 dòng tiêu đề cột của bảng */}
                    <tr className="text-center font-normal">
                      <th className="border border-black px-1.5 py-1 w-8 font-normal">No</th>
                      <th className="border border-black px-2 py-1 w-44 font-normal">Danh sách làm thêm</th>
                      <th className="border border-black px-2 py-1 font-normal">Lý do làm thêm</th>
                      <th className="border border-black px-2 py-1 w-20 font-normal">Giờ bắt đầu</th>
                      <th className="border border-black px-2 py-1 w-20 font-normal">Giờ kết thúc</th>
                      <th className="border border-black px-2 py-1 w-24 font-normal">Tổng thời gian</th>
                      <th className="border border-black px-2 py-1 w-20 font-normal">Ký nhận</th>
                    </tr>
                    <tr className="text-center font-normal">
                      <th className="border border-black px-1.5 py-1 font-normal" />
                      <th className="border border-black px-2 py-1 font-normal">명단</th>
                      <th className="border border-black px-2 py-1 font-normal">잔업. 특근사유</th>
                      <th className="border border-black px-2 py-1 font-normal">시작</th>
                      <th className="border border-black px-2 py-1 font-normal">종료</th>
                      <th className="border border-black px-2 py-1 font-normal">총 시간</th>
                      <th className="border border-black px-2 py-1 font-normal">싸인</th>
                    </tr>

                    {/* Dữ liệu các dòng của ngày này với No reset đếm lại từ 1 */}
                    {dateGroup.blocks.map((group) =>
                      group.rows.map((row) => (
                        <tr key={`${group.blockId}-${row.no}`} className="h-7">
                          {/* Cột (1): No */}
                          <td className="border border-black px-1.5 py-1 text-center font-normal">
                            {row.no}
                          </td>
                          {/* Cột (2): Danh sách làm thêm */}
                          <td className="border border-black px-2 py-1 text-left font-normal">
                            {row.fullName}
                          </td>
                          {/* Cột (3): Lý do làm thêm gộp ô rowSpan theo số nhân sự của nhóm đó */}
                          {row.isFirstInBlock && (
                            <td
                              rowSpan={row.rowSpan}
                              className="border border-black px-2.5 py-1.5 text-left align-middle whitespace-pre-line font-normal"
                            >
                              {row.combinedReason}
                            </td>
                          )}
                          {/* Cột (4): Giờ bắt đầu - In chính xác giờ của từng cá nhân */}
                          <td className="border border-black px-2 py-1 text-center font-bold align-middle">
                            {row.startTimeFormatted}
                          </td>
                          {/* Cột (5): Giờ kết thúc - In chính xác giờ của từng cá nhân */}
                          <td className="border border-black px-2 py-1 text-center font-bold align-middle">
                            {row.endTimeFormatted}
                          </td>
                          {/* Cột (6): Tổng thời gian - Từng dòng nhân viên */}
                          <td className="border border-black px-2 py-1 text-center align-middle" />
                          {/* Cột (7): Ký nhận - Từng dòng nhân viên */}
                          <td className="border border-black px-2 py-1 text-center align-middle" />
                        </tr>
                      ))
                    )}
                  </React.Fragment>
                ))}
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

        {/* Nút bấm ở góc phải dưới cùng */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 px-6 shrink-0 shadow-sm">
          <div className="text-xs text-slate-500">
            Biểu mẫu: <strong className="font-mono text-slate-700">TV-PSGC2022</strong> • Tổng số nhóm:{' '}
            <strong className="font-mono text-slate-700">
              {formatNumberVN(summaryStats.blockCount)}
            </strong>{' '}
            ({formatNumberVN(summaryStats.totalParticipants)} lượt • {summaryStats.datesCount} ngày)
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isSubmitting || previewData.length === 0}
              onClick={handleSaveAndExportPDFClick}
              className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#14539E] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Lưu &amp; Xuất PDF</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting || previewData.length === 0}
              onClick={handleSaveAndExportExcelClick}
              className="h-9 px-5 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              )}
              <span>Lưu &amp; Xuất Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs font-medium max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{toastMessage}</span>
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
    </div>
  );
};

export default CreateOvertimeForm;
