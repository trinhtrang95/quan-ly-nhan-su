import React, { useEffect, useState } from 'react';
import {
  X,
  Camera,
  FileCheck2,
  Search,
  Check,
  Trash2,
  CalendarClock,
  Loader2,
} from 'lucide-react';
import {
  Employee,
  LeaveRecord,
  LeaveRecordType,
  RegimeSubtype,
} from '../types/hr';
import { createLeaveSlipSvgDataUri } from '../data/mockData';
import { formatDateVN, LEAVE_TYPE_META } from '../utils/hrCalculations';
import { uploadImageToHrBucket } from '../utils/supabaseService';

interface LeaveRecordModalProps {
  isOpen: boolean;
  editingRecord: LeaveRecord | null;
  employees: Employee[];
  defaultEmployeeId?: string;
  defaultMonth?: number;
  defaultYear?: number;
  onClose: () => void;
  onSave: (recordData: Omit<LeaveRecord, 'id'>, existingId?: string) => void;
}

export const LeaveRecordModal: React.FC<LeaveRecordModalProps> = ({
  isOpen,
  editingRecord,
  employees,
  defaultEmployeeId,
  defaultMonth,
  defaultYear,
  onClose,
  onSave,
}) => {
  const [empSearch, setEmpSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<LeaveRecordType>('annual_leave');
  const [regimeSubtype, setRegimeSubtype] = useState<RegimeSubtype>('Ốm đau / Viện phí');
  const [startDate, setStartDate] = useState('2026-11-12');
  const [endDate, setEndDate] = useState('2026-11-12');
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentTitle, setAttachmentTitle] = useState<string>('');
  const [paperStatus, setPaperStatus] = useState<'Chưa có' | 'Đã có'>('Đã có');
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setEmpSearch('');
    setIsUploadingProof(false);

    if (editingRecord) {
      setEmployeeId(editingRecord.employeeId);
      setType(editingRecord.type);
      setRegimeSubtype(editingRecord.regimeSubtype || 'Ốm đau / Viện phí');
      setStartDate(editingRecord.startDate);
      setEndDate(editingRecord.endDate);
      setAmount(editingRecord.amount);
      setReason(editingRecord.reason);
      setAttachmentUrl(editingRecord.attachmentUrl || '');
      setAttachmentTitle(editingRecord.attachmentTitle || '');
      setPaperStatus(
        editingRecord.paperStatus ||
          (editingRecord.attachmentUrl ? 'Đã có' : 'Chưa có')
      );
    } else {
      const initialEmp = defaultEmployeeId || employees[0]?.id || '';
      setEmployeeId(initialEmp);
      setType('annual_leave');
      setRegimeSubtype('Ốm đau / Viện phí');

      const y = defaultYear || 2026;
      const m = defaultMonth ? String(defaultMonth).padStart(2, '0') : '11';
      const defaultDate = `${y}-${m}-12`;
      setStartDate(defaultDate);
      setEndDate(defaultDate);
      setAmount(1);
      setReason('');
      setAttachmentUrl('');
      setAttachmentTitle('');
      setPaperStatus('Chưa có');
    }
  }, [isOpen, editingRecord, defaultEmployeeId, defaultMonth, defaultYear, employees]);

  if (!isOpen) return null;

  const filteredEmployees = employees.filter((e) => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      e.fullName.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  });

  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const isLateMode = type === 'late_early';

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProof(true);
    try {
      const publicUrl = await uploadImageToHrBucket(file, 'proofs');
      setAttachmentUrl(publicUrl);
      setAttachmentTitle(
        `Ảnh chụp giấy phép (${file.name}) - ${selectedEmployee?.fullName || ''}`
      );
    } catch {
      setErrorMsg('Không thể tải ảnh giấy phép lên Cloud. Vui lòng thử lại.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setErrorMsg('Vui lòng chọn nhân sự cần ghi nhận.');
      return;
    }
    if (Number(amount) <= 0) {
      setErrorMsg(
        isLateMode
          ? 'Số giờ đi muộn phải lớn hơn 0.'
          : 'Số ngày nghỉ phải lớn hơn 0.'
      );
      return;
    }

    const finalReason =
      reason.trim() ||
      (isLateMode
        ? 'Đi muộn có báo cáo quản lý bộ phận'
        : 'Xin nghỉ phép giải quyết việc cá nhân');

    onSave(
      {
        employeeId,
        type,
        regimeSubtype: type === 'regime_leave' ? regimeSubtype : undefined,
        startDate,
        endDate: isLateMode ? startDate : endDate < startDate ? startDate : endDate,
        amount: Number(amount),
        reason: finalReason,
        attachmentUrl: attachmentUrl.trim() || undefined,
        attachmentTitle: attachmentTitle.trim() || undefined,
        paperStatus,
        createdAt: new Date().toISOString().slice(0, 10),
        approvedBy: 'Trần Thu Trang',
      },
      editingRecord?.id
    );
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#0F232E] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="w-5 h-5 text-[#2DD4BF]" />
            <div>
              <h3 id="leave-modal-title" className="text-sm sm:text-base font-bold">
                {editingRecord
                  ? 'Cập nhật Ghi chép Nghỉ phép / Đi muộn'
                  : 'Ghi nhận Nghỉ phép & Đi muộn Mới'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Tự động đồng bộ vào Dashboard và Bảng Ma trận Tồn phép 12 tháng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ ghi nhận phép"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-red-200 text-xs font-medium text-[#EF4444]">
              {errorMsg}
            </div>
          )}

          {/* Step 1: Employee Quick Search & Dropdown */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <label
              htmlFor="leave-emp-select"
              className="block text-xs font-bold text-slate-800"
            >
              1. Chọn nhân sự áp dụng <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => {
                    setEmpSearch(e.target.value);
                    const matches = employees.filter(
                      (emp) =>
                        emp.fullName
                          .toLowerCase()
                          .includes(e.target.value.toLowerCase()) ||
                        emp.employeeCode
                          .toLowerCase()
                          .includes(e.target.value.toLowerCase())
                    );
                    if (matches.length > 0) {
                      setEmployeeId(matches[0].id);
                    }
                  }}
                  placeholder="Lọc nhanh Mã NV / Họ tên..."
                  aria-label="Tìm nhanh nhân viên theo mã hoặc tên"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div className="sm:col-span-7">
                <select
                  id="leave-emp-select"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488] text-slate-800 cursor-pointer"
                >
                  {filteredEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} — {emp.fullName} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Step 2: Leave / Late Record Type Radio Cards */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-800">
              2. Loại hình ghi chép <span className="text-red-500">*</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: 'annual_leave',
                    title: 'Nghỉ phép năm',
                    desc: 'Trừ trực tiếp vào quỹ phép tồn trong năm',
                  },
                  {
                    id: 'unpaid_leave',
                    title: 'Nghỉ không lương',
                    desc: 'Nghỉ việc riêng không hưởng lương (không trừ phép)',
                  },
                  {
                    id: 'regime_leave',
                    title: 'Nghỉ chế độ (Ốm đau, Thai sản, Hiếu/Hỷ)',
                    desc: 'Hưởng chế độ BHXH / Luật Lao động',
                  },
                  {
                    id: 'late_early',
                    title: 'Đi muộn / Về sớm',
                    desc: 'Tính theo số giờ đi muộn hoặc về sớm',
                  },
                ] as { id: LeaveRecordType; title: string; desc: string }[]
              ).map((opt) => {
                const active = type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setType(opt.id);
                      if (opt.id === 'late_early') {
                        setAmount(1.5);
                        setEndDate(startDate);
                      } else if (type === 'late_early') {
                        setAmount(1);
                      }
                    }}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'border-[#0D9488] bg-teal-50/60 ring-1 ring-[#0D9488]'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          active ? 'text-[#0F766E]' : 'text-slate-800'
                        }`}
                      >
                        {opt.title}
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          active
                            ? 'border-[#0D9488] bg-[#0D9488] text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {active && <Check className="w-2.5 h-2.5" />}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            {type === 'regime_leave' && (
              <div className="pt-2">
                <label
                  htmlFor="regime-subtype-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Chi tiết chế độ áp dụng:
                </label>
                <select
                  id="regime-subtype-select"
                  value={regimeSubtype}
                  onChange={(e) => setRegimeSubtype(e.target.value as RegimeSubtype)}
                  className="w-full sm:w-72 px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                >
                  <option value="Ốm đau / Viện phí">Ốm đau / Viện phí (BHXH)</option>
                  <option value="Thai sản">Chế độ Thai sản / Khám thai</option>
                  <option value="Hiếu / Hỷ">Nghỉ Hiếu / Hỷ (Kết hôn, Tang chế)</option>
                  <option value="Công tác / Khác">Công tác / Chế độ khác</option>
                </select>
              </div>
            )}
          </div>

          {/* Step 3: Date Range & Quantity (Days vs Hours) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label
                htmlFor="leave-start-date"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {isLateMode ? 'Ngày đi muộn / về sớm' : 'Từ ngày'}
              </label>
              <input
                id="leave-start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (isLateMode || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            {!isLateMode && (
              <div>
                <label
                  htmlFor="leave-end-date"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Đến ngày
                </label>
                <input
                  id="leave-end-date"
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
                />
              </div>
            )}

            <div className={isLateMode ? 'sm:col-span-2' : ''}>
              <label
                htmlFor="leave-amount-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {isLateMode
                  ? 'Số giờ đi muộn / về sớm (VD: 1.5 giờ)'
                  : 'Số ngày nghỉ (VD: 1 ngày, 0.5 ngày)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="leave-amount-input"
                  type="number"
                  min={0.5}
                  max={isLateMode ? 8 : 180}
                  step={0.5}
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
                />
                <span className="text-xs font-bold text-slate-600 shrink-0">
                  {isLateMode ? 'Giờ' : 'Ngày'}
                </span>
              </div>
            </div>
          </div>

          {/* Step 4: Detailed Reason */}
          <div>
            <label
              htmlFor="leave-reason-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Lý do / Ghi chú chi tiết
            </label>
            <textarea
              id="leave-reason-input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isLateMode
                  ? 'Nhập lý do đi muộn / về sớm (VD: Tắc đường, hỏng xe, đưa con đi khám bệnh...)'
                  : 'Nhập lý do xin nghỉ phép, bàn giao công việc hoặc thông tin giấy viện phí...'
              }
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          {/* Step 5: Camera / Photo Upload for Leave Slip (accept="image/*" capture="environment") */}
          <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Đính kèm Ảnh chụp Giấy xin phép / Giấy viện phí
                </div>
                <p className="text-[11px] text-slate-500">
                  Trên điện thoại có thể bấm mở thẳng Camera sau để chụp trực tiếp giấy phép lưu trữ.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs">
                  {isUploadingProof ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isUploadingProof
                      ? 'Đang tải lên Cloud...'
                      : 'Chụp / Tải ảnh giấy phép thực tế'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={isUploadingProof}
                    onChange={handlePhotoUpload}
                    className="hidden"
                    aria-label="Chụp hoặc tải ảnh giấy phép"
                  />
                </label>
              </div>
            </div>

            {/* Hiện trạng giấy phép selector */}
            <div className="pt-2 border-t border-teal-200/60 flex items-center justify-between gap-3">
              <label
                htmlFor="paper-status-select"
                className="text-xs font-bold text-slate-800"
              >
                Hiện trạng giấy phép:
              </label>
              <select
                id="paper-status-select"
                value={paperStatus}
                onChange={(e) => setPaperStatus(e.target.value as 'Chưa có' | 'Đã có')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border focus:outline-none bg-white cursor-pointer ${
                  paperStatus === 'Đã có'
                    ? 'border-emerald-300 text-emerald-700 bg-emerald-50/50'
                    : 'border-red-300 text-red-600 bg-red-50/50'
                }`}
              >
                <option value="Chưa có">Chưa có (Chưa nộp)</option>
                <option value="Đã có">Đã có (Đã viết &amp; nộp)</option>
              </select>
            </div>

            {attachmentUrl && (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={attachmentUrl}
                    alt="Xem trước ảnh giấy phép"
                    referrerPolicy="no-referrer"
                    className="w-12 h-14 object-cover rounded border border-slate-300 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {attachmentTitle || 'Ảnh chụp giấy phép đã đính kèm'}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-medium">
                      Đã sẵn sàng lưu trữ vào hồ sơ chấm công
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttachmentUrl('');
                    setAttachmentTitle('');
                  }}
                  aria-label="Xóa ảnh đính kèm"
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
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
