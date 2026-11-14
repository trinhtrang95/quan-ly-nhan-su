import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Camera,
  Search,
  Check,
  Trash2,
  CalendarClock,
  Loader2,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
  LeaveRecord,
  LeaveRecordType,
  RegimeSubtype,
  UserAccount,
} from '../types/hr';
import { calculateAnnualMatrixReport, sortEmployees } from '../utils/hrCalculations';
import {
  compressImageClientSide,
  deleteImageFromHrBucket,
  uploadImageToHrBucket,
} from '../utils/supabaseService';

interface LeaveRecordModalProps {
  isOpen: boolean;
  editingRecord: LeaveRecord | null;
  employees: Employee[];
  groups?: DepartmentGroup[];
  leaveRecords: LeaveRecord[];
  currentUser?: UserAccount | null;
  defaultEmployeeId?: string;
  defaultMonth?: number;
  defaultYear?: number;
  onClose: () => void;
  onSave: (recordData: Omit<LeaveRecord, 'id'>, existingId?: string) => void;
}

function estimateDataUrlSizeKB(url?: string): number | null {
  if (!url) return null;
  if (url.startsWith('data:')) {
    const commaIdx = url.indexOf(',');
    const base64Length = commaIdx !== -1 ? url.length - (commaIdx + 1) : url.length;
    const bytes = Math.round((base64Length * 3) / 4);
    return Math.max(1, Math.round(bytes / 1024));
  }
  return null;
}

function getTodayDateString(defaultMonth?: number, defaultYear?: number): string {
  const now = new Date();
  const y = defaultYear || now.getFullYear();
  const m = defaultMonth ? defaultMonth : now.getMonth() + 1;
  const d =
    defaultMonth && defaultMonth !== now.getMonth() + 1 ? 12 : now.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const LEAVE_REASON_CHIPS = ['Việc gia đình', 'Khám bệnh', 'Ốm'];
const LATE_REASON_CHIPS = ['Hỏng xe', 'Tắc đường', 'Việc đột xuất'];

export const LeaveRecordModal: React.FC<LeaveRecordModalProps> = ({
  isOpen,
  editingRecord,
  employees,
  leaveRecords,
  currentUser,
  defaultEmployeeId,
  defaultMonth,
  defaultYear,
  onClose,
  onSave,
}) => {
  // 1. Top Business Tab: 'leave' (📅 Nghỉ phép) vs 'late' (⏰ Đi muộn)
  const [activeTab, setActiveTab] = useState<'leave' | 'late'>('leave');

  // 2. Employee Combobox state
  const [employeeId, setEmployeeId] = useState<string>('');
  const [comboQuery, setComboQuery] = useState<string>('');
  const [isComboOpen, setIsComboOpen] = useState<boolean>(false);
  const comboContainerRef = useRef<HTMLDivElement | null>(null);

  // 3. Leave Type & Date/Time state
  const [leaveSubType, setLeaveSubType] = useState<
    'annual_leave' | 'unpaid_leave' | 'regime_leave'
  >('annual_leave');
  const [regimeSubtype, setRegimeSubtype] =
    useState<RegimeSubtype>('Ốm đau / Viện phí');
  const [startDate, setStartDate] = useState<string>(() =>
    getTodayDateString(defaultMonth, defaultYear)
  );
  const [endDate, setEndDate] = useState<string>(() =>
    getTodayDateString(defaultMonth, defaultYear)
  );
  const [leaveDays, setLeaveDays] = useState<number>(1);
  const [lateHours, setLateHours] = useState<number>(1);

  // 4. Reason & Paper / Attachment state
  const [reason, setReason] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentTitle, setAttachmentTitle] = useState<string>('');
  const [compressedSizeKB, setCompressedSizeKB] = useState<number | null>(null);
  const [paperStatus, setPaperStatus] = useState<'Chưa có' | 'Đã có'>('Chưa có');
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        comboContainerRef.current &&
        !comboContainerRef.current.contains(e.target as Node)
      ) {
        setIsComboOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const targetYear =
    defaultYear || new Date(startDate || Date.now()).getFullYear() || 2026;

  const remainingLeaveMap = useMemo(() => {
    const map = new Map<string, number>();
    if (employees.length === 0) return map;
    const rows = calculateAnnualMatrixReport(employees, leaveRecords, targetYear);
    for (const r of rows) {
      map.set(r.employee.id, r.remainingAnnualLeave);
    }
    return map;
  }, [employees, leaveRecords, targetYear]);

  const sortedEmployees = useMemo(() => {
    return sortEmployees(employees, null, null);
  }, [employees]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setIsUploadingProof(false);
    setIsComboOpen(false);
    setComboQuery('');

    if (editingRecord) {
      setEmployeeId(editingRecord.employeeId);
      if (editingRecord.type === 'late_early') {
        setActiveTab('late');
        setLateHours(editingRecord.amount || 1);
        setLeaveDays(1);
      } else {
        setActiveTab('leave');
        setLeaveSubType(editingRecord.type);
        setLeaveDays(editingRecord.amount || 1);
        setLateHours(1);
      }
      setRegimeSubtype(editingRecord.regimeSubtype || 'Ốm đau / Viện phí');
      setStartDate(editingRecord.startDate);
      setEndDate(editingRecord.endDate || editingRecord.startDate);
      setReason(editingRecord.reason || '');
      setAttachmentUrl(editingRecord.attachmentUrl || '');
      setAttachmentTitle(editingRecord.attachmentTitle || '');
      setCompressedSizeKB(estimateDataUrlSizeKB(editingRecord.attachmentUrl));
      setPaperStatus(
        editingRecord.paperStatus ||
          (editingRecord.attachmentUrl ? 'Đã có' : 'Chưa có')
      );
    } else {
      setActiveTab('leave');
      const initialEmpId = defaultEmployeeId || '';
      setEmployeeId(initialEmpId);

      const rem = initialEmpId ? remainingLeaveMap.get(initialEmpId) ?? 12 : 12;
      setLeaveSubType(rem > 0 ? 'annual_leave' : 'unpaid_leave');
      setRegimeSubtype('Ốm đau / Viện phí');

      const todayIso = getTodayDateString(defaultMonth, defaultYear);
      setStartDate(todayIso);
      setEndDate(todayIso);
      setLeaveDays(1);
      setLateHours(1);
      setReason('');
      setAttachmentUrl('');
      setAttachmentTitle('');
      setCompressedSizeKB(null);
      setPaperStatus('Chưa có');
    }
  }, [
    isOpen,
    editingRecord,
    defaultEmployeeId,
    defaultMonth,
    defaultYear,
    employees,
    sortedEmployees,
  ]);

  if (!isOpen) return null;

  const calcDays = (s: string, e: string): number => {
    if (!s || !e) return 1;
    const d1 = new Date(s);
    const d2 = new Date(e);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;
    const diff =
      Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, 0.5);
  };

  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const selectedEmpRemaining = selectedEmployee
    ? remainingLeaveMap.get(selectedEmployee.id) ??
      selectedEmployee.standardAnnualLeave
    : 0;

  const comboboxFilteredEmployees = sortedEmployees.filter((e) => {
    const q = comboQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      e.fullName.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q)
    );
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setIsUploadingProof(true);
    try {
      const compressed = await compressImageClientSide(file, 1000, 0.7);

      if (attachmentUrl) {
        deleteImageFromHrBucket(attachmentUrl).catch(() => {});
      }

      const publicUrl = await uploadImageToHrBucket(
        compressed.compressedFile,
        'proofs',
        true,
        compressed.dataUrl
      );

      setAttachmentUrl(publicUrl);
      setCompressedSizeKB(compressed.compressedSizeKB);
      setAttachmentTitle(
        `Ảnh giấy phép (${compressed.compressedSizeKB} KB) - ${
          selectedEmployee?.fullName || ''
        }`
      );
      setPaperStatus('Đã có');
    } catch {
      setErrorMsg('Không thể xử lý và tải ảnh giấy phép. Vui lòng chọn ảnh khác.');
    } finally {
      setIsUploadingProof(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    if (attachmentUrl) {
      deleteImageFromHrBucket(attachmentUrl).catch(() => {});
    }
    setAttachmentUrl('');
    setAttachmentTitle('');
    setCompressedSizeKB(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!employeeId) {
      setErrorMsg('Vui lòng chọn nhân sự cần ghi nhận.');
      return;
    }

    const finalType: LeaveRecordType =
      activeTab === 'late' ? 'late_early' : leaveSubType;
    const finalAmount =
      activeTab === 'late' ? Number(lateHours) : Number(leaveDays);

    if (finalAmount <= 0) {
      setErrorMsg(
        activeTab === 'late'
          ? 'Số giờ đi muộn phải lớn hơn 0.'
          : 'Số ngày nghỉ phải lớn hơn 0.'
      );
      return;
    }

    if (!editingRecord) {
      const isDuplicate = leaveRecords.some(
        (r) =>
          r.employeeId === employeeId &&
          r.type === finalType &&
          r.startDate === startDate
      );
      if (isDuplicate) {
        setErrorMsg(
          `Nhân sự ${
            selectedEmployee?.fullName || ''
          } đã có bản ghi cùng loại trong ngày ${startDate}.`
        );
        return;
      }
    }

    const approverName =
      editingRecord?.approvedBy ||
      currentUser?.fullName?.trim() ||
      currentUser?.username?.trim() ||
      'Quản trị viên';
    const createdAtToday = new Date().toISOString().slice(0, 10);

    const finalReason =
      reason.trim() ||
      (activeTab === 'late'
        ? 'Đi muộn có báo cáo quản lý bộ phận'
        : 'Xin nghỉ phép giải quyết việc cá nhân');

    onSave(
      {
        employeeId,
        type: finalType,
        regimeSubtype:
          finalType === 'regime_leave' ? regimeSubtype : undefined,
        startDate,
        endDate:
          activeTab === 'late'
            ? startDate
            : endDate < startDate
              ? startDate
              : endDate,
        amount: finalAmount,
        reason: finalReason,
        attachmentUrl: attachmentUrl.trim() || undefined,
        attachmentTitle: attachmentTitle.trim() || undefined,
        paperStatus,
        createdAt: createdAtToday,
        approvedBy: approverName,
      },
      editingRecord?.id
    );
    onClose();
  };

  const quickReasonChips =
    activeTab === 'late' ? LATE_REASON_CHIPS : LEAVE_REASON_CHIPS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="bg-[#0F232E] text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#2DD4BF]" />
            <h3 id="leave-modal-title" className="text-sm font-bold tracking-wide">
              {editingRecord
                ? 'Cập nhật Ghi chép Nghỉ phép & Đi muộn'
                : 'Ghi nhận Nghỉ phép & Đi muộn Mới'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ ghi nhận"
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-3.5 space-y-2.5 overflow-y-auto flex-1 flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            {errorMsg && (
              <div className="px-3 py-1.5 rounded-lg bg-[#FEF2F2] border border-red-200 text-xs font-semibold text-[#EF4444]">
                {errorMsg}
              </div>
            )}

            {/* 1. TRÊN CÙNG: 2 TAB (📅 Nghỉ phép | ⏰ Đi muộn) */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('leave');
                  setErrorMsg('');
                }}
                className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'leave'
                    ? 'bg-[#0F232E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>📅 Nghỉ phép</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('late');
                  setEndDate(startDate);
                  setErrorMsg('');
                }}
                className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'late'
                    ? 'bg-[#0F232E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>⏰ Đi muộn</span>
              </button>
            </div>

            {/* 2. KHỐI 1: CHỌN NHÂN SỰ ÁP DỤNG (1 ô Combobox duy nhất + Badge Tồn phép năm góc phải) */}
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Chọn nhân sự áp dụng <span className="text-red-500">*</span>
                </span>

                {selectedEmployee && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md inline-flex items-center gap-1 ${
                      selectedEmpRemaining > 0
                        ? 'bg-teal-100 text-teal-800 border border-teal-200'
                        : 'bg-red-100 text-red-700 border border-red-300'
                    }`}
                  >
                    {selectedEmpRemaining <= 0 && (
                      <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                    )}
                    <span>
                      Tồn phép năm ({targetYear}): {selectedEmpRemaining} ngày
                    </span>
                  </span>
                )}
              </div>

              <div ref={comboContainerRef} className="relative">
                <div
                  onClick={() => setIsComboOpen(true)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white focus-within:bg-white focus-within:border-[#0D9488] transition-colors cursor-text"
                >
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={
                      isComboOpen
                        ? comboQuery
                        : selectedEmployee
                          ? `${selectedEmployee.employeeCode} — ${selectedEmployee.fullName} (${
                              selectedEmployee.department || 'Chưa phân bộ phận'
                            })`
                          : comboQuery
                    }
                    onFocus={() => {
                      setComboQuery('');
                      setIsComboOpen(true);
                    }}
                    onChange={(e) => {
                      setComboQuery(e.target.value);
                      setIsComboOpen(true);
                    }}
                    placeholder="Gõ Mã NV hoặc Họ và tên để tìm & chọn nhanh..."
                    aria-label="Tìm và chọn nhân sự"
                    className="w-full text-xs font-semibold text-slate-800 bg-transparent outline-none"
                  />
                  {(selectedEmployee || comboQuery) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEmployeeId('');
                        setComboQuery('');
                        setIsComboOpen(true);
                      }}
                      className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      aria-label="Xóa nhân sự đã chọn"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                {isComboOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto z-40 divide-y divide-slate-100">
                    {comboboxFilteredEmployees.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-slate-400 text-center">
                        Không tìm thấy nhân sự phù hợp
                      </div>
                    ) : (
                      comboboxFilteredEmployees.map((emp) => {
                        const isSelected = emp.id === employeeId;
                        const rem =
                          remainingLeaveMap.get(emp.id) ??
                          emp.standardAnnualLeave;
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setEmployeeId(emp.id);
                              setComboQuery('');
                              setIsComboOpen(false);
                              if (!editingRecord) {
                                setLeaveSubType(
                                  rem > 0 ? 'annual_leave' : 'unpaid_leave'
                                );
                              }
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 hover:bg-teal-50/70 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-teal-50/90 font-bold text-[#0F766E]'
                                : 'text-slate-800'
                            }`}
                          >
                            <div className="truncate">
                              <span className="font-mono font-bold text-slate-700">
                                {emp.employeeCode}
                              </span>{' '}
                              — <span className="font-bold">{emp.fullName}</span>{' '}
                              <span className="text-slate-500">
                                ({emp.department || 'Chưa phân nhóm'})
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                                rem > 0
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-red-50 text-red-600'
                              }`}
                            >
                              Tồn: {rem} ngày
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. KHỐI 2: LOẠI HÌNH & THỜI GIAN */}
            <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2">
              {activeTab === 'leave' ? (
                <>
                  {/* 3 nút Loại hình nghỉ phép */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div
                      className={`${
                        leaveSubType === 'regime_leave'
                          ? 'sm:col-span-8'
                          : 'sm:col-span-12'
                      } grid grid-cols-3 gap-1.5`}
                    >
                      {(
                        [
                          { id: 'annual_leave', title: 'Nghỉ phép năm' },
                          { id: 'unpaid_leave', title: 'Nghỉ không lương' },
                          { id: 'regime_leave', title: 'Nghỉ chế độ' },
                        ] as {
                          id: 'annual_leave' | 'unpaid_leave' | 'regime_leave';
                          title: string;
                        }[]
                      ).map((opt) => {
                        const active = leaveSubType === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setLeaveSubType(opt.id)}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                              active
                                ? 'border-[#0D9488] bg-teal-50 ring-1 ring-[#0D9488] font-bold text-[#0F766E]'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                            }`}
                          >
                            <span className="truncate">{opt.title}</span>
                            <span
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                active
                                  ? 'border-[#0D9488] bg-[#0D9488] text-white'
                                  : 'border-slate-300'
                              }`}
                            >
                              {active && <Check className="w-2.5 h-2.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {leaveSubType === 'regime_leave' && (
                      <div className="sm:col-span-4">
                        <select
                          value={regimeSubtype}
                          onChange={(e) =>
                            setRegimeSubtype(e.target.value as RegimeSubtype)
                          }
                          aria-label="Chọn chế độ nghỉ"
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-teal-300 bg-white text-slate-800 focus:outline-none focus:border-[#0D9488]"
                        >
                          <option value="Ốm đau / Viện phí">
                            Ốm đau / Viện phí (BHXH)
                          </option>
                          <option value="Thai sản">Chế độ Thai sản / Khám thai</option>
                          <option value="Hiếu / Hỷ">Nghỉ Hiếu / Hỷ</option>
                          <option value="Công tác / Khác">Công tác / Chế độ khác</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Cảnh báo nếu hết phép mà vẫn chọn Nghỉ phép năm */}
                  {selectedEmployee &&
                    selectedEmpRemaining <= 0 &&
                    leaveSubType === 'annual_leave' && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          Nhân sự {selectedEmployee.fullName} đã hết phép năm (Tồn:{' '}
                          {selectedEmpRemaining} ngày). Khuyến nghị chọn{' '}
                          <strong>Nghỉ không lương</strong>.
                        </span>
                      </div>
                    )}

                  {/* Từ ngày, Đến ngày, Số ngày nghỉ (0.5 ngày, 1 ngày) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end pt-0.5">
                    <div className="sm:col-span-3">
                      <label
                        htmlFor="leave-start-date"
                        className="block text-[11px] font-bold text-slate-700 mb-0.5"
                      >
                        Từ ngày
                      </label>
                      <input
                        id="leave-start-date"
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setStartDate(newStart);
                          if (endDate < newStart) {
                            setEndDate(newStart);
                            setLeaveDays(1);
                          } else {
                            setLeaveDays(calcDays(newStart, endDate));
                          }
                        }}
                        className="w-full px-2.5 py-1 text-xs font-mono bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label
                        htmlFor="leave-end-date"
                        className="block text-[11px] font-bold text-slate-700 mb-0.5"
                      >
                        Đến ngày
                      </label>
                      <input
                        id="leave-end-date"
                        type="date"
                        required
                        min={startDate}
                        value={endDate}
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          setEndDate(newEnd);
                          setLeaveDays(calcDays(startDate, newEnd));
                        }}
                        className="w-full px-2.5 py-1 text-xs font-mono bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label
                        htmlFor="leave-days-input"
                        className="block text-[11px] font-bold text-slate-700 mb-0.5"
                      >
                        Số ngày nghỉ
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          id="leave-days-input"
                          type="number"
                          min={0.5}
                          max={180}
                          step={0.5}
                          required
                          value={leaveDays}
                          onChange={(e) => setLeaveDays(Number(e.target.value))}
                          className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
                        />
                        <span className="text-xs font-bold text-slate-600 shrink-0">
                          ngày
                        </span>
                        <div className="flex items-center gap-1 ml-1">
                          {[0.5, 1].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setLeaveDays(preset)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                                leaveDays === preset
                                  ? 'bg-[#0D9488] text-white border-[#0D9488]'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50 hover:border-teal-300'
                              }`}
                            >
                              {preset} ngày
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Tab Đi muộn: Chỉ hiện Ngày đi muộn và Số giờ đi muộn (0.5h, 1h, 1.5h, 2h) */
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="late-date-input"
                      className="block text-[11px] font-bold text-slate-700 mb-0.5"
                    >
                      Ngày đi muộn
                    </label>
                    <input
                      id="late-date-input"
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setEndDate(e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
                    />
                  </div>

                  <div className="sm:col-span-8">
                    <label
                      htmlFor="late-hours-input"
                      className="block text-[11px] font-bold text-slate-700 mb-0.5"
                    >
                      Số giờ đi muộn
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        id="late-hours-input"
                        type="number"
                        min={0.25}
                        max={8}
                        step={0.25}
                        required
                        value={lateHours}
                        onChange={(e) => setLateHours(Number(e.target.value))}
                        className="w-20 px-2.5 py-1.5 text-xs font-mono font-bold bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0 mr-1">
                        giờ
                      </span>
                      {[0.5, 1, 1.5, 2].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setLateHours(preset)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                            lateHours === preset
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                          }`}
                        >
                          {preset}h
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. KHỐI 3: LÝ DO & GIẤY PHÉP */}
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
              {/* Bên trái (7/12): Lý do / Ghi chú + Chip chọn nhanh */}
              <div className="md:col-span-7 space-y-1">
                <label
                  htmlFor="leave-reason-input"
                  className="block text-[11px] font-bold text-slate-700"
                >
                  Lý do / Ghi chú
                </label>
                <input
                  id="leave-reason-input"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    activeTab === 'late'
                      ? 'Nhập lý do đi muộn...'
                      : 'Nhập lý do xin nghỉ phép...'
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
                />
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 mr-0.5">
                    Chọn nhanh:
                  </span>
                  {quickReasonChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setReason(chip)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                        reason === chip
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bên phải (5/12): Trạng thái Giấy phép (Chưa có / Đã có) + Nút 📷 Đính kèm ảnh giấy phép */}
              <div className="md:col-span-5 p-2 rounded-xl bg-teal-50/40 border border-teal-200/80 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-800">
                    Giấy phép:
                  </span>
                  <div className="inline-flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPaperStatus('Chưa có')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                        paperStatus === 'Chưa có'
                          ? 'bg-red-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Chưa có
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperStatus('Đã có')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                        paperStatus === 'Đã có'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Đã có
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                    {isUploadingProof ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isUploadingProof
                        ? 'Đang tải ảnh...'
                        : attachmentUrl
                          ? 'Đổi ảnh giấy phép'
                          : 'Đính kèm ảnh giấy phép'}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      disabled={isUploadingProof}
                      onChange={handlePhotoUpload}
                      className="hidden"
                      aria-label="Đính kèm ảnh giấy phép"
                    />
                  </label>
                </div>

                {attachmentUrl && (
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white border border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={attachmentUrl}
                        alt="Xem trước ảnh giấy phép"
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 object-cover rounded border border-slate-300 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 truncate">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>
                            {compressedSizeKB !== null
                              ? `Đã tối ưu: ${compressedSizeKB} KB`
                              : 'Đã đính kèm ảnh'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Thay ảnh khác"
                        className="p-1 rounded border border-teal-200 bg-teal-50 text-[#0F766E] hover:bg-teal-100 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        title="Xóa ảnh"
                        className="p-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingRecord ? 'Lưu thay đổi' : 'Xác nhận ghi chép'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
