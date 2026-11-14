import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { ActiveModule, CompanyUnit, UserAccount } from '../types/hr';

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
    label: 'Trang chủ',
    shortLabel: 'Trang chủ',
    icon: LayoutDashboard,
    iconColor: 'text-sky-400',
  },
  {
    id: 'employees',
    label: 'Danh sách nhân sự',
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
  isCloudConnected = true,
  onLogoutClick,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const userInitials = (() => {
    const parts = currentUser.fullName.trim().split(' ').filter(Boolean);
    return parts.length >= 2
      ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : currentUser.fullName.slice(0, 2).toUpperCase();
  })();

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
              src="/app-icon.svg"
              alt="Quản lý nhân sự"
              className="w-9 h-9 rounded-xl object-cover border border-teal-500/40 shrink-0 shadow-sm"
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-base font-bold text-white tracking-wide whitespace-nowrap">
                  Quản lý nhân sự
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

        {/* Bottom Cloud Status & Logged-in Account Box */}
        <div className="p-3.5 border-t border-slate-700/60 bg-[#0B1B24] space-y-3">
          {/* Cloud Status Indicator */}
          {!collapsed && (
            <div className="px-2.5 py-1.5 rounded-lg bg-[#0F232E] border border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Trạng thái Cloud:</span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  isCloudConnected ? 'text-[#2DD4BF]' : 'text-amber-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCloudConnected ? 'bg-[#2DD4BF]' : 'bg-amber-400'
                  }`}
                />
                {isCloudConnected ? 'Đã kết nối' : 'Đang kết nối lại'}
              </span>
            </div>
          )}

          {!collapsed ? (
            <div className="px-1 pt-0.5">
              {/* Hàng trên: Avatar + Họ tên đầy đủ 100% + Vai trò (Admin / User) */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-600/30 border border-teal-400/40 flex items-center justify-center text-[#2DD4BF] font-bold text-xs shrink-0">
                  {userInitials}
                </div>
                <div className="flex-1">
                  <div
                    data-testid="sidebar-user-name"
                    className="text-xs font-bold text-white leading-snug break-words"
                  >
                    {currentUser.fullName}
                  </div>
                  <div
                    data-testid="sidebar-user-role"
                    className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${
                      isAdmin ? 'text-[#2DD4BF]' : 'text-sky-300'
                    }`}
                  >
                    {isAdmin ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-[#2DD4BF] shrink-0" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    )}
                    <span>{isAdmin ? 'Admin' : 'User'}</span>
                  </div>
                </div>
              </div>

              {/* Hàng dưới: Nút Đăng xuất nằm riêng 1 dòng */}
              <button
                type="button"
                onClick={onLogoutClick}
                data-testid="sidebar-logout-btn"
                aria-label="Đăng xuất phiên làm việc"
                title="Đăng xuất"
                className="w-full mt-2.5 py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                title={`${currentUser.fullName} (${isAdmin ? 'Admin' : 'User'})`}
                className="w-8 h-8 rounded-full bg-[#163C45] text-[#2DD4BF] flex items-center justify-center text-xs font-bold"
              >
                {userInitials}
              </div>
              <button
                type="button"
                onClick={onLogoutClick}
                aria-label="Đăng xuất phiên làm việc"
                title="Đăng xuất"
                className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
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
    </>
  );
};


