import React from 'react';
import { CalendarPlus, UserPlus, Cloud, RefreshCw, LogOut } from 'lucide-react';
import { ActiveModule, CompanyUnit, UserAccount } from '../types/hr';

interface TopBannerHeaderProps {
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
  onQuickAddLeave: () => void;
  onQuickAddEmployee: () => void;
  activeCompany: CompanyUnit;
  currentUser: UserAccount;
  onLogoutClick: () => void;
  isCloudConnected?: boolean;
  isSyncing?: boolean;
  onManualSync?: () => void;
}

const MODULE_TITLES: Record<ActiveModule, string> = {
  dashboard: 'Bảng điều khiển Tổng quan',
  employees: 'Hồ sơ & Danh bạ Nhân sự',
  leave_logs: 'Nhật ký Nghỉ phép & Đi muộn',
  annual_report: 'Ma trận Báo cáo Tồn phép Năm',
  settings: 'Cài đặt Đơn vị & Hệ thống',
};

export const TopBannerHeader: React.FC<TopBannerHeaderProps> = ({
  activeModule,
  onSelectModule,
  onQuickAddLeave,
  onQuickAddEmployee,
  activeCompany,
  currentUser,
  onLogoutClick,
  isCloudConnected = true,
  isSyncing = false,
  onManualSync,
}) => {
  const isAdmin = currentUser.role === 'admin';

  return (
    <header className="no-print bg-white rounded-xl border border-slate-200/80 shadow-xs px-4 py-3 md:px-6 md:py-3.5 mb-5 flex items-center justify-between gap-4">
      {/* Zone 1: Brand Title, Active Company & Supabase Cloud Status */}
      <div className="flex items-center gap-3 min-w-0">
        {activeCompany.logoUrl ? (
          <img
            src={activeCompany.logoUrl}
            alt={activeCompany.name}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white shrink-0 shadow-xs"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-[#0F232E] flex items-center justify-center text-[#2DD4BF] font-extrabold text-sm shrink-0 shadow-xs">
            TS
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight truncate">
            Hệ thống Quản lý Nhân sự &amp; Chấm công
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="truncate">{MODULE_TITLES[activeModule]}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onManualSync}
              title="Bấm để đồng bộ lại dữ liệu từ Supabase Cloud"
              data-testid="supabase-cloud-status"
              className={`inline-flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                isCloudConnected
                  ? 'text-[#0D9488] hover:text-[#0F766E]'
                  : 'text-amber-600 hover:text-amber-700'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isSyncing
                  ? 'Đang đồng bộ Cloud (Supabase)...'
                  : isCloudConnected
                  ? 'Đã kết nối Cloud (Supabase)'
                  : 'Chế độ Offline (Local)'}
              </span>
              <RefreshCw
                className={`w-3 h-3 ml-0.5 ${isSyncing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Zone 2: Concise Quick Navigation Links (Desktop) */}
      <nav
        aria-label="Liên kết nhanh"
        className="hidden xl:flex items-center gap-5 text-xs font-medium text-slate-600"
      >
        <button
          type="button"
          onClick={() => onSelectModule('dashboard')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeModule === 'dashboard'
              ? 'text-[#0D9488] font-semibold underline underline-offset-4'
              : ''
          }`}
        >
          Tổng quan
        </button>
        <button
          type="button"
          onClick={() => onSelectModule('employees')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeModule === 'employees'
              ? 'text-[#0D9488] font-semibold underline underline-offset-4'
              : ''
          }`}
        >
          Danh sách Nhân sự
        </button>
        <button
          type="button"
          onClick={() => onSelectModule('leave_logs')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeModule === 'leave_logs'
              ? 'text-[#0D9488] font-semibold underline underline-offset-4'
              : ''
          }`}
        >
          Ghi chép Phép &amp; Đi muộn
        </button>
        <button
          type="button"
          onClick={() => onSelectModule('annual_report')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeModule === 'annual_report'
              ? 'text-[#0D9488] font-semibold underline underline-offset-4'
              : ''
          }`}
        >
          Ma trận Tồn phép
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => onSelectModule('settings')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'settings'
                ? 'text-[#0D9488] font-semibold underline underline-offset-4'
                : ''
            }`}
          >
            Hệ thống / Cài đặt
          </button>
        )}
      </nav>

      {/* Zone 3: Primary Action CTA */}
      <div className="flex items-center gap-2 shrink-0">
        {activeModule === 'employees' && isAdmin ? (
          <button
            type="button"
            onClick={onQuickAddEmployee}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Thêm nhân sự</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onQuickAddLeave}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>+ Ghi nhận phép</span>
          </button>
        )}

        {/* Mobile Logout quick button (< 768px) */}
        <button
          type="button"
          onClick={onLogoutClick}
          aria-label="Đăng xuất trên thiết bị di động"
          title="Đăng xuất"
          className="md:hidden p-2 rounded-lg border border-red-200 bg-[#FEF2F2] text-[#EF4444] hover:bg-red-100 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
