import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import {
  CompanyUnit,
  LeaveAccrualMode,
  LeavePolicyConfig,
} from '../../../types/hr';
import {
  loadLeavePolicyConfig,
  saveLeavePolicyConfig,
} from '../../../utils/hrCalculations';

interface AnnualLeaveRulesViewProps {
  companyUnits: CompanyUnit[];
  activeCompanyId?: string;
  defaultAnnualLeaveQuota: number;
  isAdmin?: boolean;
  onUpdateCompanyQuota: (companyId: string, newQuota: number) => void;
  onChangeDefaultAnnualLeaveQuota?: (newQuota: number) => void;
}

const LEAVE_QUOTA_OPTIONS = [12, 14, 15, 16, 18, 20, 24];

export const AnnualLeaveRulesView: React.FC<AnnualLeaveRulesViewProps> = ({
  companyUnits,
  activeCompanyId,
  defaultAnnualLeaveQuota,
  isAdmin = true,
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
    <div className="max-w-4xl space-y-4">
      {/* Tiêu đề màn hình */}
      <div>
        <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
          Quy định phép năm
        </h1>
        <p className="text-xs text-slate-500">
          Thiết lập định mức phép năm cơ bản và cơ chế tự động tính quỹ phép cho toàn công ty
        </p>
      </div>

      {/* 1. KHỐI CÀI ĐẶT LUẬT DUY NHẤT (SINGLE CONFIG CARD - VERTICAL LAYOUT) */}
      <div
        data-testid="leave-rules-single-config-card"
        className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4"
      >
        {/* Hàng 1: Tên công ty & Dropdown chọn Phép năm cơ bản */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800">
              {companyDisplayName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Định mức phép chuẩn 1 năm áp dụng cho nhân sự trong công ty
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label
              htmlFor="leave-rules-base-quota-select"
              className="text-xs sm:text-sm font-medium text-slate-700 whitespace-nowrap"
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
              className="h-9 px-3.5 text-xs sm:text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E] transition-colors cursor-pointer disabled:opacity-60"
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
              <span className="text-xs sm:text-sm font-semibold text-slate-800">
                Cho phép dồn phép năm cũ
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Khi bật, số ngày phép dư từ năm trước sẽ được cộng dồn vào cột &ldquo;Tồn năm trước&rdquo; trên bảng Quỹ phép năm.
              </p>
            </div>
          </label>
        </div>

        {/* Hàng 3: Tùy chọn (Radio buttons) chọn cơ chế tính */}
        <div className="space-y-2.5">
          <div className="text-xs sm:text-sm font-semibold text-slate-800">
            Cơ chế tính quỹ phép năm nay
          </div>

          <div
            role="radiogroup"
            aria-label="Cơ chế tính quỹ phép năm"
            className="space-y-2.5"
          >
            {/* Option 1: Cấp 1 lần đầu năm */}
            <label
              data-testid="leave-rules-radio-upfront"
              onClick={() => isAdmin && handleSelectAccrualMode('upfront')}
              className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer select-none ${
                policyConfig.accrualMode === 'upfront'
                  ? 'bg-blue-50/30 border-[#14539E] ring-1 ring-[#14539E]'
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
                <div className="text-xs sm:text-sm font-bold text-slate-800">
                  Cấp 1 lần đầu năm
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Nhân sự được cấp trọn vẹn 100% định mức phép năm (VD: {currentQuota} ngày) ngay từ đầu năm tại cột &ldquo;Tích lũy năm nay&rdquo;.
                </p>
              </div>
            </label>

            {/* Option 2: Tích lũy theo tháng */}
            <label
              data-testid="leave-rules-radio-monthly"
              onClick={() => isAdmin && handleSelectAccrualMode('monthly')}
              className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer select-none ${
                policyConfig.accrualMode === 'monthly'
                  ? 'bg-blue-50/30 border-[#14539E] ring-1 ring-[#14539E]'
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
                <div className="text-xs sm:text-sm font-bold text-slate-800">
                  Tích lũy theo tháng
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Mỗi tháng làm việc thực tế trong năm cộng thêm phép theo tỷ lệ (VD: {Number((currentQuota / 12).toFixed(2))} ngày/tháng) tính đến tháng hiện tại dựa theo ngày vào công ty.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* 2. KHỐI THÔNG TIN (INFO BOX) */}
      <div
        data-testid="leave-rules-info-box"
        className="bg-slate-100 border border-slate-200/80 rounded-lg p-5 space-y-3"
      >
        <div className="flex items-center gap-2 text-slate-800">
          <Info className="w-4 h-4 text-[#14539E] shrink-0" />
          <h3 className="text-sm font-bold text-slate-800">
            Cách phần mềm tính:
          </h3>
        </div>

        <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700 leading-relaxed">
          <li>
            <strong>Phương trình Quỹ phép năm tự động:</strong>{' '}
            <code>Tổng quỹ phép = [Tích lũy năm nay] + [Tồn năm trước]</code> và{' '}
            <code>Còn lại = [Tổng quỹ phép] - [Đã nghỉ]</code>.
          </li>
          <li>
            <strong>Định mức phép năm cơ bản (12 / 14 / 16 ngày):</strong> Người lao động làm việc trong điều kiện bình thường được hưởng <strong>12 ngày</strong> phép/năm; công việc nặng nhọc, độc hại, nguy hiểm được hưởng <strong>14 ngày</strong>; đặc biệt nặng nhọc, độc hại, nguy hiểm được hưởng <strong>16 ngày</strong>.
          </li>
          <li>
            <strong>Cách tính số tháng làm việc &amp; quy tắc làm tròn:</strong> Khi chọn chế độ <em>Tích lũy theo tháng</em>, số phép tích lũy năm nay được tính theo số tháng làm việc thực tế tính đến tháng hiện tại. Tháng vào làm có từ đủ 50% số ngày công trở lên được tính tròn 01 tháng làm việc.
          </li>
          <li>
            <strong>Tự động trừ phép tức thì (Real-time):</strong> Ngay khi HR bấm <strong>&ldquo;Lưu&rdquo;</strong> để ghi nhận một bản ghi nghỉ phép năm tại màn hình <em>Đơn nghỉ</em>, hệ thống lập tức cộng số ngày đó vào cột <strong>&ldquo;Đã nghỉ&rdquo;</strong> và trừ trực tiếp vào cột <strong>&ldquo;Còn lại&rdquo;</strong> ở màn hình <em>Quỹ phép năm</em> (không qua bước chờ duyệt).
          </li>
          <li>
            <strong>Thời gian nghỉ thai sản &amp; chế độ:</strong> Thời gian thử việc (nếu tiếp tục làm việc), nghỉ thai sản theo quy định BHXH và nghỉ chế độ có hưởng lương vẫn được tính là thời gian làm việc để tích lũy phép năm.
          </li>
        </ul>
      </div>
    </div>
  );
};
