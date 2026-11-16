import React, { useEffect, useState } from 'react';
import { X, BookOpenCheck, Info } from 'lucide-react';
import {
  CompanyUnit,
  LeaveAccrualMode,
  LeavePolicyConfig,
} from '../types/hr';
import {
  loadLeavePolicyConfig,
  saveLeavePolicyConfig,
} from '../utils/hrCalculations';

interface AnnualLeaveRulesModalProps {
  isOpen: boolean;
  companyUnits: CompanyUnit[];
  activeCompanyId?: string;
  defaultAnnualLeaveQuota: number;
  isAdmin?: boolean;
  onClose: () => void;
  onUpdateCompanyQuota: (companyId: string, newQuota: number) => void;
  onChangeDefaultAnnualLeaveQuota?: (newQuota: number) => void;
}

const LEAVE_QUOTA_OPTIONS = [12, 14, 15, 16, 18, 20, 24];

export const AnnualLeaveRulesModal: React.FC<AnnualLeaveRulesModalProps> = ({
  isOpen,
  companyUnits,
  activeCompanyId,
  defaultAnnualLeaveQuota,
  isAdmin = true,
  onClose,
  onUpdateCompanyQuota,
  onChangeDefaultAnnualLeaveQuota,
}) => {
  const [policyConfig, setPolicyConfig] = useState<LeavePolicyConfig>(() =>
    loadLeavePolicyConfig()
  );

  useEffect(() => {
    const handlePolicyEvent = (e: Event) => {
      const detail = (e as CustomEvent<LeavePolicyConfig>).detail;
      if (detail) {
        setPolicyConfig(detail);
      } else {
        setPolicyConfig(loadLeavePolicyConfig());
      }
    };
    window.addEventListener('hr-leave-policy-change', handlePolicyEvent);
    return () =>
      window.removeEventListener('hr-leave-policy-change', handlePolicyEvent);
  }, []);

  if (!isOpen) return null;

  const activeUnit =
    companyUnits.find((c) => c.id === activeCompanyId) || companyUnits[0];

  const companyDisplayName =
    activeUnit &&
    activeUnit.name &&
    activeUnit.name.trim() !== '' &&
    activeUnit.name !== 'Công ty Mặc định'
      ? activeUnit.name
      : 'Công ty TNHH TransOn Việt Nam';

  const currentQuota =
    activeUnit?.defaultLeaveQuota ?? defaultAnnualLeaveQuota ?? 12;

  const handleQuotaChange = (newQuota: number) => {
    if (activeUnit) {
      onUpdateCompanyQuota(activeUnit.id, newQuota);
    }
    if (onChangeDefaultAnnualLeaveQuota) {
      onChangeDefaultAnnualLeaveQuota(newQuota);
    }
  };

  const handleToggleCarryOver = (checked: boolean) => {
    const next: LeavePolicyConfig = {
      ...policyConfig,
      allowCarryOver: checked,
    };
    setPolicyConfig(next);
    saveLeavePolicyConfig(next);
  };

  const handleSelectAccrualMode = (mode: LeaveAccrualMode) => {
    const next: LeavePolicyConfig = {
      ...policyConfig,
      accrualMode: mode,
    };
    setPolicyConfig(next);
    saveLeavePolicyConfig(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="annual-leave-rules-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal chuẩn màu thương hiệu #14539E */}
        <div className="bg-[#14539E] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpenCheck className="w-5 h-5 text-blue-100 shrink-0" />
            <div>
              <h2
                id="annual-leave-rules-modal-title"
                className="text-sm sm:text-base font-bold tracking-tight"
              >
                Cài đặt Quy định phép năm
              </h2>
              <p className="text-[11px] text-blue-100">
                Thiết lập định mức phép năm cơ bản và cơ chế tự động tính quỹ phép
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
          {/* 1. KHỐI CÀI ĐẶT LUẬT DUY NHẤT */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-4">
            {/* Hàng 1: Tên công ty & Dropdown chọn Phép năm cơ bản */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {companyDisplayName}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Định mức phép chuẩn 1 năm áp dụng cho nhân sự trong công ty
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label
                  htmlFor="leave-rules-base-quota-select"
                  className="text-xs font-medium text-slate-700 whitespace-nowrap"
                >
                  Phép năm cơ bản
                </label>
                <select
                  id="leave-rules-base-quota-select"
                  data-testid="leave-rules-base-quota-select"
                  value={currentQuota}
                  disabled={!isAdmin}
                  onChange={(e) => handleQuotaChange(Number(e.target.value))}
                  aria-label="Chọn Phép năm cơ bản"
                  className="h-8 px-3 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E] transition-colors cursor-pointer disabled:opacity-60"
                >
                  {LEAVE_QUOTA_OPTIONS.map((days) => (
                    <option key={days} value={days}>
                      {days} ngày
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hàng 2: Checkbox Cho phép dồn phép năm cũ */}
            <div className="pb-4 border-b border-slate-100">
              <label className="inline-flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="leave-rules-carryover-checkbox"
                  checked={policyConfig.allowCarryOver}
                  disabled={!isAdmin}
                  onChange={(e) => handleToggleCarryOver(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-[#14539E] cursor-pointer shrink-0"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800">
                    Cho phép dồn phép năm cũ
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Khi bật, số ngày phép dư từ năm trước sẽ được cộng dồn vào cột &ldquo;Tồn năm trước&rdquo; trên bảng Quỹ phép năm.
                  </p>
                </div>
              </label>
            </div>

            {/* Hàng 3: Tùy chọn (Radio buttons) chọn cơ chế tính */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Cơ chế tính quỹ phép năm nay
              </div>

              <div role="radiogroup" aria-label="Cơ chế tính quỹ phép năm" className="space-y-2">
                <label
                  data-testid="leave-rules-radio-upfront"
                  onClick={() => isAdmin && handleSelectAccrualMode('upfront')}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                    policyConfig.accrualMode === 'upfront'
                      ? 'bg-blue-50/40 border-[#14539E] ring-1 ring-[#14539E]'
                      : 'bg-white border-slate-200 hover:bg-slate-50/70'
                  }`}
                >
                  <input
                    type="radio"
                    name="leave-rules-accrual-mode"
                    value="upfront"
                    checked={policyConfig.accrualMode === 'upfront'}
                    disabled={!isAdmin}
                    onChange={() => handleSelectAccrualMode('upfront')}
                    className="mt-0.5 w-4 h-4 accent-[#14539E] cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800">
                      Cấp 1 lần đầu năm
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Nhân sự được cấp trọn vẹn 100% định mức phép năm (VD: {currentQuota} ngày) ngay từ đầu năm tại cột &ldquo;Tích lũy năm nay&rdquo;.
                    </p>
                  </div>
                </label>

                <label
                  data-testid="leave-rules-radio-monthly"
                  onClick={() => isAdmin && handleSelectAccrualMode('monthly')}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                    policyConfig.accrualMode === 'monthly'
                      ? 'bg-blue-50/40 border-[#14539E] ring-1 ring-[#14539E]'
                      : 'bg-white border-slate-200 hover:bg-slate-50/70'
                  }`}
                >
                  <input
                    type="radio"
                    name="leave-rules-accrual-mode"
                    value="monthly"
                    checked={policyConfig.accrualMode === 'monthly'}
                    disabled={!isAdmin}
                    onChange={() => handleSelectAccrualMode('monthly')}
                    className="mt-0.5 w-4 h-4 accent-[#14539E] cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800">
                      Tích lũy theo tháng
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Mỗi tháng làm việc thực tế trong năm cộng thêm phép theo tỷ lệ (VD: {Number((currentQuota / 12).toFixed(2))} ngày/tháng) tính đến tháng hiện tại dựa theo ngày vào công ty.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* 2. KHỐI THÔNG TIN (INFO BOX) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-slate-600">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-4 h-4 text-[#14539E] shrink-0" />
              <span>Nguyên lý vận hành:</span>
            </div>
            <p className="leading-relaxed">
              &bull; <strong>Phương trình:</strong> <code className="font-mono text-slate-800">Tổng quỹ phép = [Tích lũy năm nay] + [Tồn năm trước]</code> &bull; <code className="font-mono text-[#14539E]">Còn lại = [Tổng quỹ phép] - [Đã nghỉ]</code>.
            </p>
            <p className="leading-relaxed">
              &bull; <strong>Trừ phép tức thì:</strong> Mọi thao tác ghi nhận đơn nghỉ phép năm được tự động cập nhật ngay lập tức vào cột Đã nghỉ mà không cần quy trình chờ duyệt rườm rà.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
