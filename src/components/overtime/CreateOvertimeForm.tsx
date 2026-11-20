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
 * Hàm dịch thực tế Tiếng Việt -> Tiếng Hàn qua API miễn phí của Google Translate
 */
const translateVnToKr = async (text: string): Promise<string> => {
  if (!text) return '';
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=ko&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await response.json();
    return data[0].map((item: [string]) => item[0]).join('');
  } catch (error) {
    console.error('Lỗi dịch thuật:', error);
    return 'Lỗi dịch...';
  }
};

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

export const CreateOvertimeForm: React.FC<CreateOvertimeFormProps> = ({
  employees = INITIAL_EMPLOYEES,
  groups = INITIAL_DEPARTMENT_GROUPS,
  initialDepartment = 'ALL',
  initialDate = '2026-11-16',
  onSaveAndExportPDF,
  onSaveAndExportExcel,
}) => {
  // Header / Form Header States
  const [selectedDepartment, setSelectedDepartment] =
    useState<string>(initialDepartment);
  const [overtimeDate, setOvertimeDate] = useState<string>(initialDate);

  // Form input states for current entry
  const [currentReasonVi, setCurrentReasonVi] = useState<string>('Trực sản xuất');
  const [currentReasonKr, setCurrentReasonKr] = useState<string>('생산 당직');
  const [isAutoTranslating, setIsAutoTranslating] = useState<boolean>(false);
  const [currentStartTime, setCurrentStartTime] = useState<string>('16:10');
  const [currentEndTime, setCurrentEndTime] = useState<string>('20:10');
  const [currentSelectedEmployeeIds, setCurrentSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeGroupFilter, setEmployeeGroupFilter] = useState<string>(initialDepartment);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>('');
  const isInitialReasonMountRef = useRef<boolean>(true);

  // Mảng State previewData chứa danh sách các Block đã được "Ghi nhận"
  const [previewData, setPreviewData] = useState<OvertimeTaskBlock[]>(() => [
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

  // Trạng thái đang xử lý lưu DB / xuất file
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Thông báo Toast / Status thân thiện trên giao diện
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

  // Danh sách nhân sự khả dụng theo Bộ lọc Nhóm & ô tìm kiếm
  const filteredEmployeesForInput = useMemo(() => {
    const byGroup =
      !employeeGroupFilter || employeeGroupFilter === 'ALL'
        ? employees
        : employees.filter((emp) => emp.department === employeeGroupFilter);

    const query = employeeSearchQuery.trim().toLowerCase();
    if (!query) return byGroup;
    return byGroup.filter(
      (emp) =>
        emp.fullName.toLowerCase().includes(query) ||
        emp.employeeCode.toLowerCase().includes(query) ||
        emp.department.toLowerCase().includes(query)
    );
  }, [employees, employeeGroupFilter, employeeSearchQuery]);

  // Tổng số lượt nhân sự và tổng số giờ tăng ca dự kiến từ previewData
  const summaryStats = useMemo(() => {
    let totalParticipants = 0;
    let totalHours = 0;
    for (const block of previewData) {
      const count = block.selectedEmployeeIds.length;
      const hours = OvertimeFormService.calculateDurationHours(
        block.startTime,
        block.endTime
      );
      totalParticipants += count;
      totalHours += count * hours;
    }
    return {
      blockCount: previewData.length,
      totalParticipants,
      totalHours: Number(totalHours.toFixed(2)),
    };
  }, [previewData]);

  // Hàm dịch tự động Tiếng Việt -> Tiếng Hàn qua Google Translate API
  const handleTranslate = async (sourceReasonVi: string): Promise<string> => {
    if (!sourceReasonVi.trim()) {
      setCurrentReasonKr('');
      return '';
    }
    const translatedText = await translateVnToKr(sourceReasonVi.trim());
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

  // Toggle chọn nhân viên trong form nhập liệu hiện tại (Immutability)
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

  // Hành động Hàng 6: Nút "Ghi nhận"
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

    const newBlock: OvertimeTaskBlock = {
      id: `ot-block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      reasonVi: currentReasonVi,
      reasonKr: finalReasonKr,
      startTime: normalizedStart,
      endTime: normalizedEnd,
      selectedEmployeeIds: [...currentSelectedEmployeeIds],
      isTranslating: false,
    };

    setPreviewData((prev) => [...prev, newBlock]);

    // Reset ô "Nhân sự" và "Lý do" về trống, giữ nguyên "Ngày" và "Giờ" để nhập tiếp nhóm khác.
    setCurrentReasonVi('');
    setCurrentReasonKr('');
    setCurrentSelectedEmployeeIds([]);
    showToast('Đã ghi nhận nhóm công việc vào bản xem trước (Preview).');
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

  // Chuẩn bị danh sách dòng cho bảng Preview / Print (TV-PSGC2022) với rowSpan chuẩn theo từng Block
  const printableBlockRows = useMemo(() => {
    let runningNo = 1;
    const activeBlocks =
      previewData.length > 0
        ? previewData
        : [
            {
              id: 'empty-print-block',
              reasonVi: 'Chưa có nhóm công việc được ghi nhận',
              reasonKr: '작업 내용 없음',
              startTime: currentStartTime,
              endTime: currentEndTime,
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
          fullName: emp ? emp.fullName : '(Chưa chọn nhân sự)',
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
  }, [previewData, employeeMap, currentStartTime, currentEndTime]);

  return (
    <div className="grid grid-cols-12 gap-6 h-screen overflow-hidden p-4 bg-slate-50 text-slate-800">
      {/* ===================================================================
          CỘT TRÁI (1/3) - BẢNG ĐIỀU KHIỂN / FORM NHẬP LIỆU (col-span-4)
      =================================================================== */}
      <div className="col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        {/* Hàng 1: Tiêu đề */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
          <h2 className="text-xl font-bold text-[#14539E]">Tạo phiếu tăng ca</h2>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#14539E] border border-blue-200">
            TV-PSGC2022
          </span>
        </div>

        {/* Form cuộn dọc */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Hàng 2: Chọn Ngày làm thêm & Bộ phận */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="overtime-department-select"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Bộ phận
              </label>
              <select
                id="overtime-department-select"
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setEmployeeGroupFilter(e.target.value);
                }}
                className="w-full h-10 px-3 py-2 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all cursor-pointer"
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
                className="block text-xs font-semibold text-slate-600 mb-1.5"
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
                  className="w-full h-10 pl-8 pr-2 py-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Hàng 3 (Nhóm công việc): Lý do (Tiếng Việt) tự động dịch Debounce 500ms -> Lý do (Tiếng Hàn) */}
          <div className="space-y-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Nội dung / Lý do công việc
              </span>
              {isAutoTranslating && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#14539E]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Đang dịch...</span>
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="reason-vi-input"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Lý do (Tiếng Việt)
              </label>
              <textarea
                id="reason-vi-input"
                rows={2}
                value={currentReasonVi}
                onChange={(e) => setCurrentReasonVi(e.target.value)}
                placeholder="VD: Lắp ráp máy quấn core PQ50 DATBIKE..."
                className="w-full p-2.5 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="reason-kr-input"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Lý do (Tiếng Hàn)
              </label>
              <textarea
                id="reason-kr-input"
                rows={2}
                value={currentReasonKr}
                onChange={(e) => setCurrentReasonKr(e.target.value)}
                placeholder="잔업. 특근사유 (Tự động dịch sau khi dừng gõ)..."
                className="w-full p-2.5 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all"
              />
            </div>
          </div>

          {/* Hàng 4 (Thời gian): Giờ bắt đầu & Giờ kết thúc (Định dạng 24h HH:mm, không AM/PM) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="start-time-input"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Giờ bắt đầu (24h)
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
                  title="Định dạng 24 giờ (HH:mm), ví dụ: 16:10"
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
                  className="w-full h-10 pl-8 pr-2 py-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="end-time-input"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Giờ kết thúc (24h)
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
                  title="Định dạng 24 giờ (HH:mm), ví dụ: 20:10"
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
                  className="w-full h-10 pl-8 pr-2 py-2 text-xs font-mono font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] focus:ring-2 focus:ring-[#14539E]/20 transition-all"
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

          {/* Hàng 5 (Nhân sự): Bộ lọc Nhóm + Tìm kiếm + Multi-select Checkbox */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Chọn nhân sự tham gia ({currentSelectedEmployeeIds.length} đã chọn)
              </span>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-[11px] font-medium text-[#14539E] hover:underline cursor-pointer"
              >
                {filteredEmployeesForInput.length > 0 &&
                filteredEmployeesForInput.every((e) =>
                  currentSelectedEmployeeIds.includes(e.id)
                )
                  ? 'Bỏ chọn tất cả'
                  : 'Chọn tất cả'}
              </button>
            </div>

            {/* Bộ lọc Nhóm & Ô tìm kiếm nhân sự */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                id="employee-group-filter"
                aria-label="Chọn theo bộ phận/nhóm"
                value={employeeGroupFilter}
                onChange={(e) => setEmployeeGroupFilter(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-medium text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                <option value="ALL">Chọn theo bộ phận/nhóm (Tất cả)</option>
                {departmentFilterOptions.map((deptName) => (
                  <option key={deptName} value={deptName}>
                    {deptName}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Tìm kiếm mã NV, họ tên"
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  placeholder="Tìm mã NV, họ tên..."
                  className="w-full h-9 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1.5">
              {filteredEmployeesForInput.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  Không tìm thấy nhân sự phù hợp.
                </div>
              ) : (
                filteredEmployeesForInput.map((emp) => {
                  const isSelected = currentSelectedEmployeeIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer transition-colors select-none ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-200 text-slate-900 font-semibold'
                          : 'bg-white border border-slate-100 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleEmployee(emp.id)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-white shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-[#14539E]/40 ${
                          isSelected ? 'bg-[#14539E] border-[#14539E]' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <div className="min-w-0 flex-1 truncate">
                        <span>{emp.fullName}</span>
                        <span className="text-slate-400 text-[11px] font-mono ml-1">
                          ({emp.employeeCode})
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Hàng 6: Nút Ghi nhận */}
          <button
            type="button"
            onClick={handleCommitBlock}
            className="w-full h-11 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#14539E] border border-blue-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi nhận vào danh sách xem trước</span>
          </button>

          {/* Danh sách các nhóm đã ghi nhận */}
          {previewData.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="text-xs font-bold text-slate-700">
                Các nhóm đã ghi nhận ({previewData.length}):
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {previewData.map((b, idx) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-bold text-[#14539E] mr-1">#{idx + 1}</span>
                      <span className="text-slate-700 truncate">{b.reasonVi || 'Không có lý do'}</span>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {b.selectedEmployeeIds.length} nhân sự • {b.startTime}-{b.endTime}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePreviewBlock(idx)}
                      className="p-1 rounded text-red-500 hover:bg-red-50 cursor-pointer"
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
          CỘT PHẢI (2/3) - KHỐI PREVIEW (col-span-8)
      =================================================================== */}
      <div className="col-span-8 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-start">
          {/* Thẻ div mô phỏng tờ giấy A4 ở giữa */}
          <div className="bg-white shadow-2xl p-8 max-w-4xl w-full mx-auto font-serif text-black rounded-lg space-y-4">
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

            {/* Dòng Bộ phận & Ngày làm thêm */}
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span>{formatDepartmentHeaderLabel(selectedDepartment)}</span>
              <span className="font-bold pr-24">
                {formatDateToFormStyle(overtimeDate)}
              </span>
            </div>

            {/* Bảng chính 7 cột với rowSpan gộp ô */}
            <table className="w-full border-collapse border border-black text-[11px]">
              <thead>
                <tr className="text-center">
                  <th className="border border-black px-1.5 py-1 w-8 font-normal">No</th>
                  <th className="border border-black px-2 py-1 w-44 font-normal">Danh sách làm thêm</th>
                  <th className="border border-black px-2 py-1 font-normal">Lý do làm thêm</th>
                  <th className="border border-black px-2 py-1 w-20 font-normal">Giờ bắt đầu</th>
                  <th className="border border-black px-2 py-1 w-20 font-normal">Giờ kết thúc</th>
                  <th className="border border-black px-2 py-1 w-24 font-normal">Tổng thời gian</th>
                  <th className="border border-black px-2 py-1 w-20 font-normal">Ký nhận</th>
                </tr>
                <tr className="text-center">
                  <th className="border border-black px-1.5 py-1 font-normal" />
                  <th className="border border-black px-2 py-1 font-normal">명단</th>
                  <th className="border border-black px-2 py-1 font-normal">잔업. 특근사유</th>
                  <th className="border border-black px-2 py-1 font-normal">시작</th>
                  <th className="border border-black px-2 py-1 font-normal">종료</th>
                  <th className="border border-black px-2 py-1 font-normal">총 시간</th>
                  <th className="border border-black px-2 py-1 font-normal">싸인</th>
                </tr>
              </thead>
              <tbody>
                {printableBlockRows.map((group) =>
                  group.rows.map((row) => (
                    <tr key={`${group.blockId}-${row.no}`} className="h-7">
                      <td className="border border-black px-1.5 py-1 text-center">
                        {row.no}
                      </td>
                      <td className="border border-black px-2 py-1 text-left">
                        {row.fullName}
                      </td>
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

        {/* Nút bấm ở góc phải dưới cùng */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
          <div className="text-xs text-slate-500">
            Biểu mẫu: <strong className="font-mono text-slate-700">TV-PSGC2022</strong> • Tổng số nhóm: <strong className="font-mono text-slate-700">{formatNumberVN(summaryStats.blockCount)}</strong> ({formatNumberVN(summaryStats.totalParticipants)} lượt)
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveAndExportPDFClick}
              className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#14539E] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
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
              disabled={isSubmitting}
              onClick={handleSaveAndExportExcelClick}
              className="h-9 px-5 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
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
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs font-medium max-w-md"
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
    </div>
  );
};

export default CreateOvertimeForm;
