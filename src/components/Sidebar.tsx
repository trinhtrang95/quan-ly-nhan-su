import React from 'react';
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
    label: 'Báo cáo Tồn phép năm',
    shortLabel: 'Báo cáo năm',
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
  onSelectCompany,
  onLogoutClick,
}) => {
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
            <div className="w-9 h-9 rounded-lg bg-[#0D9488] flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm">
              {activeCompany?.shortName || 'HR'}
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="text-white font-bold text-base tracking-tight leading-tight whitespace-nowrap">
                  HR PRO
                </div>
                <div className="text-[11px] text-teal-300/80 font-medium truncate">
                  {activeCompany?.code || 'Enterprise HRM'}
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

        {/* Bottom Workspace Dropdown & Logged-in Account Box */}
        <div className="p-3 border-t border-slate-700/60 bg-[#0B1B24]">
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
    </>
  );
};
