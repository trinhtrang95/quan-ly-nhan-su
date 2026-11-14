import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
  ShieldCheck,
  UserCheck,
  MonitorDown,
  X,
} from 'lucide-react';
import { ActiveModule, CompanyUnit, UserAccount } from '../types/hr';
import { usePWAInstall } from '../utils/pwaInstall';

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  employeeCount: number;
  recordCount: number;
  currentUser: UserAccount;
  companyUnits: CompanyUnit[];
  activeCompanyId: string;
  isCloudConnected?: boolean;
  onSelectCompany: (id: string) => void;
  onLogoutClick: () => void;
}

const NAV_ITEMS: {
  id: ActiveModule;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
  adminOnly?: boolean;
}[] = [
  {
    id: 'dashboard',
    label: 'Tổng quan hệ thống',
    shortLabel: 'Tổng quan',
    icon: LayoutDashboard,
    iconColor: 'text-sky-400',
  },
  {
    id: 'employees',
    label: 'Quản lý Nhân sự',
    shortLabel: 'Nhân sự',
    icon: Users,
    iconColor: 'text-emerald-400',
  },
  {
    id: 'leave_logs',
    label: 'Nghỉ phép & Đi muộn',
    shortLabel: 'Chấm phép',
    icon: CalendarClock,
    iconColor: 'text-amber-400',
  },
  {
    id: 'annual_report',
    label: 'Báo cáo tổng hợp',
    shortLabel: 'Báo cáo tổng hợp',
    icon: FileSpreadsheet,
    iconColor: 'text-purple-400',
  },
  {
    id: 'settings',
    label: 'Hệ thống / Cài đặt',
    shortLabel: 'Cài đặt',
    icon: Settings,
    iconColor: 'text-rose-400',
    adminOnly: true,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
  employeeCount,
  recordCount,
  currentUser,
  companyUnits,
  activeCompanyId,
  isCloudConnected = true,
  onSelectCompany,
  onLogoutClick,
}) => {
  const { isInstalled, promptInstall } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const isAdmin = currentUser.role === 'admin';
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  );
  const activeCompany =
    companyUnits.find((c) => c.id === activeCompanyId) || companyUnits[0];

  const userInitials = (() => {
    const parts = currentUser.fullName.trim().split(' ').filter(Boolean);
    return parts.length >= 2
      ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : currentUser.fullName.slice(0, 2).toUpperCase();
  })();

  const handleInstallClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'unavailable') {
      setShowInstallGuide(true);
    }
  };

  return (
    <>
      {/* PC Left Fixed Sidebar (>= 768px) */}
      <aside
        aria-label="Thanh điều hướng chính"
        className={`no-print hidden md:flex flex-col shrink-0 bg-[#0F232E] text-[#CBD5E1] transition-all duration-200 select-none border-r border-slate-800/80 ${
          collapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        {/* Brand Header + Collapse Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src={activeCompany?.logoUrl || '/app-icon.svg'}
              alt={activeCompany?.name || 'QL Nhân sự'}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover border border-teal-500/40 shrink-0 shadow-sm"
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-white font-bold text-xs tracking-tight leading-snug line-clamp-2">
                  Hệ thống Quản lý Nhân sự &amp; Chấm công
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            className="w-7 h-7 rounded-md bg-slate-800/90 hover:bg-[#163C45] text-slate-300 hover:text-[#2DD4BF] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          {!collapsed && (
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 tracking-wider">
              PHÂN HỆ QUẢN TRỊ
            </div>
          )}
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectModule(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#163C45] text-[#2DD4BF] font-semibold shadow-xs'
                    : 'text-[#CBD5E1] hover:bg-slate-800/60 hover:text-white'
                } ${collapsed ? 'justify-center' : 'justify-between'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? 'text-[#2DD4BF]' : item.iconColor
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  )}
                </div>

                {!collapsed && item.id === 'employees' && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-[#2DD4BF]' : 'text-slate-400'
                    }`}
                  >
                    {employeeCount}
                  </span>
                )}
                {!collapsed && item.id === 'leave_logs' && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-[#2DD4BF]' : 'text-slate-400'
                    }`}
                  >
                    {recordCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Workspace Dropdown, PWA Install Button, Cloud Status & Logged-in Account Box */}
        <div className="p-3 border-t border-slate-700/60 bg-[#0B1B24] space-y-2.5">
          {/* Desktop / Mobile PWA Install Button */}
          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallClick}
              data-testid="pwa-install-btn"
              title="Cài đặt ứng dụng Quản lý Nhân sự ra màn hình Desktop / Điện thoại"
              className={`w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:from-[#0F766E] hover:to-[#059669] text-white font-bold text-xs shadow-sm transition-all cursor-pointer ${
                collapsed ? 'p-2' : 'px-3 py-2'
              }`}
            >
              <MonitorDown className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">💻 Cài đặt App về máy</span>}
            </button>
          )}

          {/* Cloud Status Indicator */}
          {!collapsed && (
            <div className="px-2.5 py-1.5 rounded-lg bg-[#0F232E] border border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Trạng thái Cloud:</span>
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  isCloudConnected ? 'text-[#2DD4BF]' : 'text-amber-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCloudConnected ? 'bg-[#2DD4BF]' : 'bg-amber-400'
                  }`}
                />
                {isCloudConnected ? 'Đã kết nối Supabase' : 'Đang kết nối lại'}
              </span>
            </div>
          )}

          {!collapsed ? (
            <div className="space-y-2.5">
              {/* CÔNG TY ĐANG LÀM VIỆC Dropdown */}
              <div className="px-2.5 py-2 rounded-lg bg-[#163C45]/50 border border-teal-900/60">
                <label
                  htmlFor="sidebar-company-select"
                  className="flex items-center gap-1.5 text-[10px] font-bold text-[#2DD4BF] uppercase tracking-wider mb-1"
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>CÔNG TY ĐANG LÀM VIỆC</span>
                </label>
                <select
                  id="sidebar-company-select"
                  value={activeCompanyId}
                  onChange={(e) => onSelectCompany(e.target.value)}
                  className="w-full bg-[#0F232E] text-white text-xs font-semibold rounded-md px-2 py-1.5 border border-teal-800/80 focus:outline-none focus:border-[#2DD4BF] cursor-pointer truncate"
                >
                  {companyUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Logged-in Account & Role Info + Logout Button */}
              <div className="flex items-center justify-between gap-2 px-1 pt-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-teal-600/30 border border-teal-400/40 flex items-center justify-center text-[#2DD4BF] font-bold text-xs shrink-0">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <div
                      data-testid="sidebar-user-name"
                      className="text-xs font-semibold text-white truncate flex items-center gap-1"
                    >
                      <span className="truncate">{currentUser.fullName}</span>
                      {isAdmin ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-[#2DD4BF] shrink-0" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      )}
                    </div>
                    <div
                      data-testid="sidebar-user-role"
                      className={`text-[10px] font-bold tracking-wider uppercase truncate ${
                        isAdmin ? 'text-[#2DD4BF]' : 'text-sky-300'
                      }`}
                    >
                      {isAdmin ? 'QUẢN TRỊ VIÊN' : 'NHÂN VIÊN'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogoutClick}
                  data-testid="sidebar-logout-btn"
                  aria-label="Đăng xuất phiên làm việc"
                  title="Đăng xuất"
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-red-300 hover:text-white hover:bg-red-600/80 transition-colors shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                title={`${currentUser.fullName} (${
                  isAdmin ? 'QUẢN TRỊ VIÊN' : 'NHÂN VIÊN'
                })`}
                className="w-8 h-8 rounded-full bg-[#163C45] text-[#2DD4BF] flex items-center justify-center text-xs font-bold"
              >
                {userInitials}
              </div>
              <button
                type="button"
                onClick={onLogoutClick}
                aria-label="Đăng xuất phiên làm việc"
                title="Đăng xuất"
                className="p-2 rounded-lg text-red-300 hover:text-white hover:bg-red-600/80 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <nav
        aria-label="Điều hướng di động"
        className={`no-print md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-[#0F232E] border-t border-slate-800 grid ${
          visibleNavItems.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
        } px-1 shadow-lg`}
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModule(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg my-1 mx-0.5 transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#163C45] text-[#2DD4BF] font-semibold'
                  : 'text-[#CBD5E1] hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? 'text-[#2DD4BF]' : item.iconColor}`}
              />
              <span className="text-[10px] leading-tight whitespace-nowrap truncate max-w-full px-1">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* PWA Installation Guide Modal (when browser native prompt is not immediately available) */}
      {showInstallGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setShowInstallGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src="/app-icon.svg"
                  alt="QL Nhân sự"
                  className="w-10 h-10 rounded-xl shadow-xs"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Cài đặt Ứng dụng về Máy tính / Điện thoại
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chạy độc lập ngoài màn hình Desktop &amp; Taskbar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="font-bold text-slate-800 mb-1">
                  💻 Trên máy tính (Chrome / Microsoft Edge / Cốc Cốc):
                </p>
                <p>
                  Nhấn vào biểu tượng <strong>Cài đặt (hình màn hình có mũi tên xuống)</strong> nằm ở góc bên phải của thanh địa chỉ trình duyệt (URL), sau đó chọn <strong>Cài đặt (Install)</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="font-bold text-slate-800 mb-1">
                  📱 Trên iPhone / iPad / Mac (Safari):
                </p>
                <p>
                  Nhấn nút <strong>Chia sẻ (Share)</strong> trên thanh công cụ trình duyệt, sau đó chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong> hoặc <strong>Thêm vào Dock (Add to Dock)</strong>.
                </p>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="px-4 py-2 rounded-lg bg-[#0F232E] hover:bg-[#163546] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

