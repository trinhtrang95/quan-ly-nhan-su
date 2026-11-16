import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  ShieldCheck,
  UserCheck,
  CalendarRange,
  Layers,
} from 'lucide-react';
import { ActiveModule, CompanyUnit, UserAccount } from '../types/hr';

export type ReportSubTab = 'monthly_summary' | 'annual_matrix';

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
  reportSubTab?: ReportSubTab;
  onSelectReportSubTab?: (subTab: ReportSubTab) => void;
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
  adminOnly?: boolean;
  hasSubmenu?: boolean;
}[] = [
  {
    id: 'dashboard',
    label: 'Trang chủ',
    shortLabel: 'Trang chủ',
    icon: LayoutDashboard,
  },
  {
    id: 'employees',
    label: 'Nhân sự',
    shortLabel: 'Nhân sự',
    icon: Users,
  },
  {
    id: 'leave_logs',
    label: 'Nghỉ phép & Đi muộn',
    shortLabel: 'Chấm phép',
    icon: CalendarClock,
  },
  {
    id: 'annual_report',
    label: 'Báo cáo tổng hợp',
    shortLabel: 'Báo cáo',
    icon: FileSpreadsheet,
    hasSubmenu: true,
  },
  {
    id: 'settings',
    label: 'Hệ thống / Cài đặt',
    shortLabel: 'Cài đặt',
    icon: Settings,
    adminOnly: true,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  reportSubTab = 'monthly_summary',
  onSelectReportSubTab,
  collapsed,
  onToggleCollapse,
  employeeCount,
  recordCount,
  currentUser,
  isCloudConnected = true,
  onLogoutClick,
}) => {
  // Mặc định mở rộng menu cha "Báo cáo tổng hợp"
  const [isReportsExpanded, setIsReportsExpanded] = useState<boolean>(true);

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

  const handleSelectReportChild = (subTab: ReportSubTab) => {
    onSelectModule('annual_report');
    if (onSelectReportSubTab) {
      onSelectReportSubTab(subTab);
    }
  };

  return (
    <>
      {/* PC Left Fixed Multi-level Dark Slate Sidebar (#1e293b / bg-slate-800) */}
      <aside
        aria-label="Thanh điều hướng chính"
        className={`no-print hidden md:flex flex-col shrink-0 bg-slate-800 text-slate-300 transition-all duration-200 select-none border-r border-slate-700/80 shadow-sm ${
          collapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        {/* Brand Header + Collapse Toggle */}
        <div className="flex items-center justify-between h-15 px-4 border-b border-slate-700/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/app-icon.svg"
              alt="Quản lý nhân sự"
              className="w-9 h-9 rounded-xl object-cover border border-slate-600 shrink-0 shadow-xs bg-slate-700/50"
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
            className="w-7 h-7 rounded-md bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links (Multi-level Tree) */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {!collapsed && (
            <div className="px-3 pb-1.5 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
              PHÂN HỆ QUẢN TRỊ
            </div>
          )}

          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;

            // Menu đa cấp: "Báo cáo tổng hợp"
            if (item.hasSubmenu) {
              const isParentHighlighted = isActive;
              const isMonthlyActive =
                isActive && reportSubTab === 'monthly_summary';
              const isAnnualActive =
                isActive && reportSubTab === 'annual_matrix';

              return (
                <div key={item.id} className="space-y-1">
                  {/* Menu cha: Báo cáo tổng hợp */}
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        onSelectModule('annual_report');
                      } else if (!isActive) {
                        setIsReportsExpanded(true);
                        onSelectModule('annual_report');
                      } else {
                        setIsReportsExpanded((prev) => !prev);
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                      collapsed && isActive
                        ? 'bg-white text-blue-600 font-bold shadow-xs'
                        : isParentHighlighted
                        ? 'bg-slate-700/70 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white font-medium'
                    } ${collapsed ? 'justify-center' : 'justify-between'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-5 h-5 shrink-0 ${
                          collapsed && isActive
                            ? 'text-blue-600'
                            : isParentHighlighted
                            ? 'text-white'
                            : 'text-slate-300'
                        }`}
                      />
                      {!collapsed && (
                        <span className="truncate whitespace-nowrap">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <span className="text-slate-400 shrink-0">
                        {isReportsExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                    )}
                  </button>

                  {/* Các Menu con thụt lề + đường kẻ dọc mỏng dẫn hướng thị giác */}
                  {!collapsed && isReportsExpanded && (
                    <div className="ml-5 pl-3 border-l border-slate-600/80 space-y-1 py-0.5">
                      {/* Menu con 1: Báo cáo tháng */}
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectReportChild('monthly_summary')
                        }
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer text-left ${
                          isMonthlyActive
                            ? 'bg-white text-blue-600 font-bold shadow-sm'
                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white font-medium'
                        }`}
                      >
                        <CalendarRange
                          className={`w-4 h-4 shrink-0 ${
                            isMonthlyActive
                              ? 'text-blue-600'
                              : 'text-slate-400'
                          }`}
                        />
                        <span className="leading-snug">Báo cáo tháng</span>
                      </button>

                      {/* Menu con 2: Báo cáo năm */}
                      <button
                        type="button"
                        onClick={() => handleSelectReportChild('annual_matrix')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer text-left ${
                          isAnnualActive
                            ? 'bg-white text-blue-600 font-bold shadow-sm'
                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white font-medium'
                        }`}
                      >
                        <Layers
                          className={`w-4 h-4 shrink-0 ${
                            isAnnualActive ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="leading-snug">Báo cáo năm</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // Các mục Menu cấp 1 thông thường
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectModule(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-blue-600 font-bold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white font-medium'
                } ${collapsed ? 'justify-center' : 'justify-between'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? 'text-blue-600' : 'text-slate-300'
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </div>

                {!collapsed && item.id === 'employees' && (
                  <span
                    className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {employeeCount}
                  </span>
                )}
                {!collapsed && item.id === 'leave_logs' && (
                  <span
                    className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-bold'
                        : 'text-slate-400'
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
        <div className="p-3.5 border-t border-slate-700/80 bg-slate-900/40 space-y-3">
          {/* Cloud Status Indicator */}
          {!collapsed && (
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Trạng thái Cloud:</span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  isCloudConnected ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCloudConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {isCloudConnected ? 'Đã kết nối' : 'Đang kết nối lại'}
              </span>
            </div>
          )}

          {!collapsed ? (
            <div className="px-1 pt-0.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
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
                    className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300"
                  >
                    {isAdmin ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span>{isAdmin ? 'Admin' : 'User'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogoutClick}
                data-testid="sidebar-logout-btn"
                aria-label="Đăng xuất phiên làm việc"
                title="Đăng xuất"
                className="w-full mt-2.5 py-1.5 px-3 rounded-lg bg-slate-700/70 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                title={`${currentUser.fullName} (${isAdmin ? 'Admin' : 'User'})`}
                className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold"
              >
                {userInitials}
              </div>
              <button
                type="button"
                onClick={onLogoutClick}
                aria-label="Đăng xuất phiên làm việc"
                title="Đăng xuất"
                className="p-2 rounded-lg bg-slate-700/70 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
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
        className={`no-print md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-slate-800 border-t border-slate-700 grid ${
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
                  ? 'bg-white text-blue-600 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-blue-600' : 'text-slate-300'
                }`}
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
