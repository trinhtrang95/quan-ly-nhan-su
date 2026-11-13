import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { ActiveModule } from '../types/hr';

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  employeeCount: number;
  recordCount: number;
  onLogoutClick: () => void;
}

const NAV_ITEMS: {
  id: ActiveModule;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
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
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
  employeeCount,
  recordCount,
  onLogoutClick,
}) => {
  return (
    <>
      {/* PC Left Fixed Sidebar (>= 768px) */}
      <aside
        aria-label="Thanh điều hướng chính"
        className={`no-print hidden md:flex flex-col shrink-0 bg-[#0F232E] text-[#CBD5E1] transition-all duration-200 select-none border-r border-slate-800/80 ${
          collapsed ? 'w-[76px]' : 'w-[256px]'
        }`}
      >
        {/* Brand Header + Collapse Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-[#0D9488] flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm">
              HR
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="text-white font-bold text-base tracking-tight leading-tight whitespace-nowrap">
                  HR PRO
                </div>
                <div className="text-[11px] text-teal-300/80 font-medium truncate">
                  Enterprise HRM Suite
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
          {NAV_ITEMS.map((item) => {
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

        {/* Bottom Workspace & Admin Profile Box */}
        <div className="p-3 border-t border-slate-700/60 bg-[#0B1B24]">
          {!collapsed ? (
            <div className="space-y-2.5">
              <div className="px-2.5 py-2 rounded-lg bg-[#163C45]/50 border border-teal-900/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-300">
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-[#2DD4BF]" />
                  <span className="truncate">Khối Văn phòng Hà Nội</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-300 truncate">
                  Đơn vị: Công ty CP HR PRO
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-1 pt-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-teal-600/30 border border-teal-400/40 flex items-center justify-center text-[#2DD4BF] font-bold text-xs shrink-0">
                    QT
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate flex items-center gap-1">
                      <span>Trần Thu Trang</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#2DD4BF] shrink-0" />
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Quản trị viên HR
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogoutClick}
                  aria-label="Đăng xuất phiên làm việc"
                  title="Đăng xuất"
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors shrink-0 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                title="Quản trị viên: Trần Thu Trang (Khối Văn phòng Hà Nội)"
                className="w-8 h-8 rounded-full bg-[#163C45] text-[#2DD4BF] flex items-center justify-center text-xs font-bold"
              >
                QT
              </div>
              <button
                type="button"
                onClick={onLogoutClick}
                aria-label="Đăng xuất phiên làm việc"
                title="Đăng xuất"
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
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
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-[#0F232E] border-t border-slate-800 grid grid-cols-4 px-1 shadow-lg"
      >
        {NAV_ITEMS.map((item) => {
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
              <span className="text-[11px] leading-tight whitespace-nowrap truncate max-w-full px-1">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
