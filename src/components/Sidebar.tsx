import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  LogOut,
  ShieldCheck,
  UserCheck,
  CalendarRange,
  FileText,
  Clock,
  SlidersHorizontal,
  Briefcase,
  LayoutGrid,
  PackageCheck,
  ClipboardList,
  FileSpreadsheet,
  BarChart3,
} from 'lucide-react';
import { ActiveModule as BaseActiveModule, CompanyUnit, UserAccount } from '../types/hr';
import { StWorkSubTab } from '../utils/stWorkLogic';

export type ActiveModule = BaseActiveModule | 'overtime';

export type LeaveSubTab = 'leave_requests' | 'leave_fund';
export type ReportSubTab =
  | 'monthly_summary'
  | 'annual_matrix'
  | 'leave_fund'
  | 'overtime_hours';

export type HrChildMenuId =
  | 'employees_list'
  | 'leave_requests'
  | 'overtime'
  | 'summary_report'
  | 'general_settings';

export type StWorkChildMenuId =
  | 'st_overview'
  | 'st_new_products'
  | 'st_change_requests'
  | 'st_customer_quotes'
  | 'st_reports';

export type NavChildMenuId = HrChildMenuId | StWorkChildMenuId;

export interface NavChildItem {
  id: NavChildMenuId;
  label: string;
  shortLabel: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  testId: string;
}

export interface NavParentItem {
  id: 'dashboard' | 'hr_module' | 'st_work' | 'settings';
  label: string;
  shortLabel: string;
  path?: string;
  icon: React.FC<{ className?: string }>;
  adminOnly?: boolean;
  children?: NavChildItem[];
}

export const NAVIGATION_DATA: NavParentItem[] = [
  {
    id: 'dashboard',
    label: 'Trang chủ',
    shortLabel: 'Trang chủ',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    id: 'hr_module',
    label: 'Nhân sự',
    shortLabel: 'Nhân sự',
    icon: Users,
    children: [
      {
        id: 'employees_list',
        label: 'Danh sách nhân sự',
        shortLabel: 'Nhân sự',
        path: '/danh-sach-nhan-su',
        icon: Users,
        testId: 'sidebar-subnav-employees-list',
      },
      {
        id: 'leave_requests',
        label: 'Đơn nghỉ',
        shortLabel: 'Đơn nghỉ',
        path: '/don-nghi',
        icon: FileText,
        testId: 'sidebar-subnav-leave-requests',
      },
      {
        id: 'overtime',
        label: 'Tăng ca',
        shortLabel: 'Tăng ca',
        path: '/tang-ca',
        icon: Clock,
        testId: 'sidebar-subnav-overtime',
      },
      {
        id: 'summary_report',
        label: 'Báo cáo tổng hợp',
        shortLabel: 'Báo cáo',
        path: '/bao-cao-tong-hop',
        icon: CalendarRange,
        testId: 'sidebar-subnav-summary-report',
      },
      {
        id: 'general_settings',
        label: 'Thiết lập chung',
        shortLabel: 'Thiết lập',
        path: '/thiet-lap-chung',
        icon: SlidersHorizontal,
        testId: 'sidebar-subnav-general-settings',
      },
    ],
  },
  {
    id: 'st_work',
    label: 'Quản lý công việc ST',
    shortLabel: 'CV ST',
    icon: Briefcase,
    children: [
      {
        id: 'st_overview',
        label: 'Tổng quan ST',
        shortLabel: 'Tổng quan',
        path: '/quan-ly-cong-viec-st',
        icon: LayoutGrid,
        testId: 'sidebar-subnav-st-overview',
      },
      {
        id: 'st_new_products',
        label: 'Danh mục Mã hàng',
        shortLabel: 'Mã hàng',
        path: '/st-ma-hang',
        icon: PackageCheck,
        testId: 'sidebar-subnav-st-new-products',
      },
      {
        id: 'st_change_requests',
        label: 'Phiếu yêu cầu',
        shortLabel: 'Phiếu YC',
        path: '/st-phieu-yeu-cau',
        icon: ClipboardList,
        testId: 'sidebar-subnav-st-change-requests',
      },
      {
        id: 'st_customer_quotes',
        label: 'Báo giá khách hàng',
        shortLabel: 'Báo giá',
        path: '/st-bao-gia',
        icon: FileSpreadsheet,
        testId: 'sidebar-subnav-st-customer-quotes',
      },
      {
        id: 'st_reports',
        label: 'Báo cáo ST',
        shortLabel: 'Báo cáo ST',
        path: '/st-bao-cao',
        icon: BarChart3,
        testId: 'sidebar-subnav-st-reports',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Hệ thống / Cài đặt',
    shortLabel: 'Cài đặt',
    path: '/cai-dat',
    icon: Settings,
    adminOnly: true,
  },
];

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
  leaveSubTab?: LeaveSubTab;
  onSelectLeaveSubTab?: (subTab: LeaveSubTab) => void;
  reportSubTab?: ReportSubTab;
  onSelectReportSubTab?: (subTab: ReportSubTab) => void;
  stWorkSubTab?: StWorkSubTab;
  onSelectStWorkSubTab?: (subTab: StWorkSubTab) => void;
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

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  leaveSubTab = 'leave_requests',
  onSelectLeaveSubTab,
  reportSubTab = 'monthly_summary',
  onSelectReportSubTab,
  stWorkSubTab = 'overview',
  onSelectStWorkSubTab,
  collapsed,
  onToggleCollapse,
  currentUser,
  isCloudConnected = true,
  onLogoutClick,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const visibleNavItems = useMemo(
    () => NAVIGATION_DATA.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );

  // Danh sách ID các Menu cha dạng Accordion (có menu con)
  const expandableParentIds = useMemo(
    () =>
      visibleNavItems
        .filter((item) => Array.isArray(item.children) && item.children.length > 0)
        .map((item) => item.id),
    [visibleNavItems]
  );

  // Kiểm tra xem người dùng có đang đứng ở một trong các menu con của Module "Nhân sự" hay không
  const isInsideHrModule =
    activeModule === 'employees' ||
    activeModule === 'leave_logs' ||
    activeModule === 'overtime' ||
    activeModule === 'annual_report' ||
    activeModule === 'general_settings';

  const isInsideStWorkModule = activeModule === 'st_work';

  // Global state quản lý trạng thái đóng/mở chung của tất cả các Menu cha
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(true);

  // State chi tiết từng Menu cha để đồng bộ với isAllExpanded và vẫn cho phép đóng/mở từng phân hệ
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() => ({
    hr_module: true,
    st_work: true,
  }));

  // Đảm bảo khi chuyển sang bất kỳ menu con nào của Module cha, menu cha luôn tự động mở (Expanded)
  useEffect(() => {
    if (isInsideHrModule || isInsideStWorkModule) {
      setExpandedMap((prev) => {
        const next: Record<string, boolean> = {
          ...prev,
          ...(isInsideHrModule ? { hr_module: true } : {}),
          ...(isInsideStWorkModule ? { st_work: true } : {}),
        };
        const allOpen = expandableParentIds.every((id) => Boolean(next[id]));
        setIsAllExpanded(allOpen);
        return next;
      });
    }
  }, [
    isInsideHrModule,
    isInsideStWorkModule,
    activeModule,
    leaveSubTab,
    reportSubTab,
    stWorkSubTab,
    expandableParentIds,
  ]);

  // Hàm xử lý nút "Thu gọn tất cả / Mở rộng tất cả"
  const handleToggleAllExpanded = () => {
    const nextExpanded = !isAllExpanded;
    setIsAllExpanded(nextExpanded);
    const updatedMap: Record<string, boolean> = {};
    for (const id of expandableParentIds) {
      updatedMap[id] = nextExpanded;
    }
    setExpandedMap(updatedMap);
  };

  // Hàm xử lý đóng/mở từng Menu cha riêng lẻ và đồng bộ ngược lại với isAllExpanded
  const handleToggleSingleParent = (parentId: string) => {
    setExpandedMap((prev) => {
      const nextVal = !prev[parentId];
      const next: Record<string, boolean> = { ...prev, [parentId]: nextVal };
      const allOpen = expandableParentIds.every((id) => Boolean(next[id]));
      setIsAllExpanded(allOpen);
      return next;
    });
  };

  const userInitials = (() => {
    const parts = currentUser.fullName.trim().split(' ').filter(Boolean);
    return parts.length >= 2
      ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : currentUser.fullName.slice(0, 2).toUpperCase();
  })();

  const isChildActive = (childId: NavChildMenuId): boolean => {
    switch (childId) {
      case 'employees_list':
        return activeModule === 'employees';
      case 'leave_requests':
        return activeModule === 'leave_logs';
      case 'overtime':
        return activeModule === 'overtime';
      case 'summary_report':
        return activeModule === 'annual_report';
      case 'general_settings':
        return activeModule === 'general_settings';
      case 'st_overview':
        return activeModule === 'st_work' && stWorkSubTab === 'overview';
      case 'st_new_products':
        return activeModule === 'st_work' && stWorkSubTab === 'new_products';
      case 'st_change_requests':
        return activeModule === 'st_work' && stWorkSubTab === 'change_requests';
      case 'st_customer_quotes':
        return activeModule === 'st_work' && stWorkSubTab === 'customer_quotes';
      case 'st_reports':
        return activeModule === 'st_work' && stWorkSubTab === 'reports';
      default:
        return false;
    }
  };

  const handleSelectNavChild = (
    parentId: 'hr_module' | 'st_work',
    childId: NavChildMenuId
  ) => {
    setExpandedMap((prev) => {
      const next: Record<string, boolean> = { ...prev, [parentId]: true };
      const allOpen = expandableParentIds.every((id) => Boolean(next[id]));
      setIsAllExpanded(allOpen);
      return next;
    });

    switch (childId) {
      case 'employees_list':
        onSelectModule('employees');
        break;
      case 'leave_requests':
        onSelectModule('leave_logs');
        onSelectLeaveSubTab?.('leave_requests');
        break;
      case 'overtime':
        onSelectModule('overtime');
        break;
      case 'summary_report':
        onSelectModule('annual_report');
        onSelectReportSubTab?.(reportSubTab);
        break;
      case 'general_settings':
        onSelectModule('general_settings');
        break;
      case 'st_overview':
        onSelectModule('st_work');
        onSelectStWorkSubTab?.('overview');
        break;
      case 'st_new_products':
        onSelectModule('st_work');
        onSelectStWorkSubTab?.('new_products');
        break;
      case 'st_change_requests':
        onSelectModule('st_work');
        onSelectStWorkSubTab?.('change_requests');
        break;
      case 'st_customer_quotes':
        onSelectModule('st_work');
        onSelectStWorkSubTab?.('customer_quotes');
        break;
      case 'st_reports':
        onSelectModule('st_work');
        onSelectStWorkSubTab?.('reports');
        break;
    }
  };

  const toggleAllTextLabel = isAllExpanded ? 'Thu gọn' : 'Mở tất cả';

  return (
    <>
      {/* PC Left Fixed Multi-level Brand Sidebar (CHÍNH XÁC MÃ #14539E) */}
      <aside
        aria-label="Thanh điều hướng chính"
        className={`no-print hidden md:flex flex-col shrink-0 bg-[#14539E] text-white/80 transition-all duration-200 select-none border-r border-white/15 shadow-sm ${
          collapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        {/* Brand Header + Collapse Toggle */}
        <div className="flex items-center justify-between h-15 px-4 border-b border-white/15">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/app-icon.svg"
              alt="Quản lý nhân sự"
              className="w-9 h-9 rounded-xl object-cover border border-white/25 shrink-0 shadow-xs bg-white/10"
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
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links (ERP Module Parent-Children Structure) */}
        <nav className="flex-1 px-3 pt-3 pb-4 space-y-1.5 overflow-y-auto">
          {/* Nút Text "Thu gọn" / "Mở tất cả" ở mép phải trên cùng của khu vực menu */}
          {!collapsed && (
            <div className="flex items-center justify-end px-2 pb-1">
              <button
                type="button"
                onClick={handleToggleAllExpanded}
                data-testid="sidebar-toggle-all-btn"
                className="text-sm text-white/70 hover:text-white font-medium cursor-pointer transition-colors"
              >
                {toggleAllTextLabel}
              </button>
            </div>
          )}

          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            // Module cha dạng Accordion: "Nhân sự" hoặc "Quản lý công việc ST" (gồm 5 menu con)
            if (
              (item.id === 'hr_module' || item.id === 'st_work') &&
              item.children
            ) {
              const isHrParent = item.id === 'hr_module';
              const isParentHighlighted = isHrParent
                ? isInsideHrModule
                : isInsideStWorkModule;
              const isModuleExpanded = Boolean(expandedMap[item.id]);

              return (
                <div key={item.id} className="space-y-1">
                  {/* Menu cha dạng Accordion */}
                  <button
                    type="button"
                    data-testid={
                      isHrParent
                        ? 'sidebar-nav-hr-parent'
                        : 'sidebar-nav-st-work-parent'
                    }
                    aria-expanded={!collapsed ? isModuleExpanded : undefined}
                    onClick={() => {
                      if (collapsed) {
                        onToggleCollapse();
                        setExpandedMap((prev) => ({
                          ...prev,
                          [item.id]: true,
                        }));
                        setIsAllExpanded(true);
                        if (!isParentHighlighted) {
                          if (isHrParent) {
                            onSelectModule('employees');
                          } else {
                            onSelectModule('st_work');
                            onSelectStWorkSubTab?.(stWorkSubTab);
                          }
                        }
                      } else {
                        handleToggleSingleParent(item.id);
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                      collapsed && isParentHighlighted
                        ? 'bg-white text-[#14539E] font-bold shadow-xs'
                        : 'bg-transparent text-white hover:bg-white/10 font-semibold'
                    } ${collapsed ? 'justify-center' : 'justify-between'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-5 h-5 shrink-0 ${
                          collapsed && isParentHighlighted
                            ? 'text-[#14539E]'
                            : 'text-white'
                        }`}
                      />
                      {!collapsed && (
                        <span className="truncate whitespace-nowrap">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <span className="text-white/80 shrink-0 transition-transform duration-200">
                        {isModuleExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                    )}
                  </button>

                  {/* 5 Menu con bên trong với đường kẻ dọc liền mạch border-white/20 */}
                  {!collapsed && (
                    <div
                      aria-hidden={!isModuleExpanded}
                      className={`grid transition-all duration-200 ease-in-out ${
                        isModuleExpanded
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div
                          data-testid={
                            isHrParent
                              ? 'sidebar-hr-children'
                              : 'sidebar-st-work-children'
                          }
                          className="relative ml-5 border-l border-white/20 space-y-1"
                        >
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            const active = isChildActive(child.id);
                            return (
                              <div key={child.id} className="relative pl-3">
                                {active && (
                                  <span
                                    aria-hidden="true"
                                    data-testid="sidebar-active-tree-indicator"
                                    className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#F59E0B] rounded-full z-10"
                                  />
                                )}
                                <button
                                  type="button"
                                  tabIndex={isModuleExpanded ? 0 : -1}
                                  data-testid={child.testId}
                                  onClick={() =>
                                    handleSelectNavChild(
                                      isHrParent ? 'hr_module' : 'st_work',
                                      child.id
                                    )
                                  }
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-all cursor-pointer text-left ${
                                    active
                                      ? 'bg-white text-[#14539E] font-bold shadow-sm'
                                      : 'text-white/80 hover:bg-white/10 hover:text-white font-medium'
                                  }`}
                                >
                                  <ChildIcon
                                    className={`w-4 h-4 shrink-0 ${
                                      active ? 'text-[#F59E0B]' : 'text-blue-100'
                                    }`}
                                  />
                                  <span className="leading-snug truncate">
                                    {child.label}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Các mục Menu cấp 1 đơn: "Trang chủ" và "Hệ thống / Cài đặt"
            const isTopActive =
              (item.id === 'dashboard' && activeModule === 'dashboard') ||
              (item.id === 'settings' && activeModule === 'settings');

            return (
              <button
                key={item.id}
                type="button"
                data-testid={`sidebar-nav-${item.id}`}
                onClick={() => {
                  if (item.id === 'dashboard') onSelectModule('dashboard');
                  else if (item.id === 'settings') onSelectModule('settings');
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                  isTopActive
                    ? 'bg-white text-[#14539E] font-bold shadow-sm'
                    : 'text-white/80 hover:bg-white/10 hover:text-white font-medium'
                } ${collapsed ? 'justify-center' : 'justify-between'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isTopActive ? 'text-[#14539E]' : 'text-blue-100'
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom Cloud Status & Logged-in Account Box */}
        <div className="p-3.5 border-t border-white/15 bg-black/10 space-y-3">
          {/* Cloud Status Indicator */}
          {!collapsed && (
            <div className="px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 flex items-center justify-between text-[11px]">
              <span className="text-blue-100">Trạng thái Cloud:</span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  isCloudConnected ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCloudConnected ? 'bg-emerald-300' : 'bg-amber-300'
                  }`}
                />
                {isCloudConnected ? 'Đã kết nối' : 'Đang kết nối lại'}
              </span>
            </div>
          )}

          {!collapsed ? (
            <div className="px-1 pt-0.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white font-bold text-xs shrink-0">
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
                    className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-100"
                  >
                    {isAdmin ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-white shrink-0" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-blue-100 shrink-0" />
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
                className="w-full mt-2.5 py-1.5 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                title={`${currentUser.fullName} (${isAdmin ? 'Admin' : 'User'})`}
                className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-bold"
              >
                {userInitials}
              </div>
              <button
                type="button"
                onClick={onLogoutClick}
                aria-label="Đăng xuất phiên làm việc"
                title="Đăng xuất"
                className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
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
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-[#14539E] border-t border-white/15 flex items-center justify-around px-1 shadow-lg overflow-x-auto"
      >
        <button
          type="button"
          onClick={() => onSelectModule('dashboard')}
          className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-2 transition-colors cursor-pointer ${
            activeModule === 'dashboard'
              ? 'bg-white text-[#14539E] font-bold'
              : 'text-white/80 hover:text-white'
          }`}
        >
          <LayoutDashboard
            className={`w-4 h-4 ${
              activeModule === 'dashboard' ? 'text-[#14539E]' : 'text-blue-100'
            }`}
          />
          <span className="text-[10px] leading-tight whitespace-nowrap">
            Trang chủ
          </span>
        </button>

        {NAVIGATION_DATA.find((i) => i.id === 'hr_module')?.children?.map((child) => {
          const ChildIcon = child.icon;
          const active = isChildActive(child.id);
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => handleSelectNavChild('hr_module', child.id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-2 transition-colors cursor-pointer ${
                active
                  ? 'bg-white text-[#14539E] font-bold'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <ChildIcon
                className={`w-4 h-4 ${
                  active ? 'text-[#14539E]' : 'text-blue-100'
                }`}
              />
              <span className="text-[10px] leading-tight whitespace-nowrap">
                {child.shortLabel}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onSelectModule('st_work')}
          className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-2 transition-colors cursor-pointer ${
            activeModule === 'st_work'
              ? 'bg-white text-[#14539E] font-bold'
              : 'text-white/80 hover:text-white'
          }`}
        >
          <Briefcase
            className={`w-4 h-4 ${
              activeModule === 'st_work' ? 'text-[#14539E]' : 'text-blue-100'
            }`}
          />
          <span className="text-[10px] leading-tight whitespace-nowrap">
            CV ST
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => onSelectModule('settings')}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-2 transition-colors cursor-pointer ${
              activeModule === 'settings'
                ? 'bg-white text-[#14539E] font-bold'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Settings
              className={`w-4 h-4 ${
                activeModule === 'settings' ? 'text-[#14539E]' : 'text-blue-100'
              }`}
            />
            <span className="text-[10px] leading-tight whitespace-nowrap">
              Cài đặt
            </span>
          </button>
        )}
      </nav>
    </>
  );
};
