import { useEffect } from 'react';
import { ActiveModule as BaseActiveModule } from '../types/hr';
import { LeaveSubTab, ReportSubTab } from '../components/Sidebar';
import { StWorkSubTab } from './stWorkLogic';

export type ActiveModule = BaseActiveModule | 'overtime';

export interface RouteState {
  module: ActiveModule;
  leaveSubTab: LeaveSubTab;
  reportSubTab: ReportSubTab;
  stWorkSubTab: StWorkSubTab;
}

/**
 * Lớp quản lý định tuyến (OOP Service) tách biệt hoàn toàn khỏi giao diện App.tsx
 * theo nguyên tắc Single Responsibility Principle (SRP).
 */
export class HRRouteManager {
  static resolveFromPathname(pathname: string): RouteState {
    const clean = (pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
    if (clean === '/danh-sach-nhan-su' || clean === '/nhan-su') {
      return {
        module: 'employees',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'overview',
      };
    }
    if (clean === '/don-nghi') {
      return {
        module: 'leave_logs',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'overview',
      };
    }
    if (clean === '/quy-phep-nam') {
      return {
        module: 'annual_report',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'leave_fund',
        stWorkSubTab: 'overview',
      };
    }
    if (clean === '/bao-cao-tang-ca' || clean === '/gio-tang-ca') {
      return {
        module: 'annual_report',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'overtime_hours',
        stWorkSubTab: 'overview',
      };
    }
    if (clean === '/bao-cao-tong-hop' || clean === '/bao-cao-thang') {
      return {
        module: 'annual_report',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'overview',
      };
    }
    if (clean === '/bao-cao-nam') {
      return {
        module: 'annual_report',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'annual_matrix',
        stWorkSubTab: 'overview',
      };
    }
    if (clean === '/tang-ca') {
      return {
        module: 'overtime',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'overview',
      };
    }
    if (clean === '/thiet-lap-chung') {
      return {
        module: 'general_settings',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'overview',
      };
    }
    if (clean === '/quan-ly-cong-viec-st' || clean === '/st-tong-quan') {
      return {
        module: 'st_work',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'overview',
      };
    }
    if (clean === '/st-danh-muc-san-pham') {
      return {
        module: 'st_work',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'products_catalog',
      };
    }
    if (clean === '/st-don-gia-moi' || clean === '/st-ma-hang') {
      return {
        module: 'st_work',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'new_products',
      };
    }
    if (clean === '/st-phieu-yeu-cau') {
      return {
        module: 'st_work',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'change_requests',
      };
    }
    if (clean === '/st-bao-gia') {
      return {
        module: 'st_work',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'customer_quotes',
      };
    }
    if (clean === '/st-bao-cao') {
      return {
        module: 'st_work',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'reports',
      };
    }
    if (clean === '/cai-dat' || clean === '/he-thong') {
      return {
        module: 'settings',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
        stWorkSubTab: 'overview',
      };
    }
    return {
      module: 'dashboard',
      leaveSubTab: 'leave_requests',
      reportSubTab: 'monthly_summary',
      stWorkSubTab: 'overview',
    };
  }

  static getPathnameForState(
    module: ActiveModule,
    _leaveSubTab: LeaveSubTab,
    reportSubTab?: ReportSubTab,
    stWorkSubTab?: StWorkSubTab
  ): string {
    if (module === 'employees') return '/danh-sach-nhan-su';
    if (module === 'leave_logs') return '/don-nghi';
    if (module === 'annual_report') {
      if (reportSubTab === 'leave_fund') return '/quy-phep-nam';
      if (reportSubTab === 'overtime_hours') return '/bao-cao-tang-ca';
      if (reportSubTab === 'annual_matrix') return '/bao-cao-nam';
      return '/bao-cao-tong-hop';
    }
    if (module === 'overtime') return '/tang-ca';
    if (module === 'general_settings') return '/thiet-lap-chung';
    if (module === 'st_work') {
      if (stWorkSubTab === 'products_catalog') return '/st-danh-muc-san-pham';
      if (stWorkSubTab === 'new_products') return '/st-don-gia-moi';
      if (stWorkSubTab === 'change_requests') return '/st-phieu-yeu-cau';
      if (stWorkSubTab === 'customer_quotes') return '/st-bao-gia';
      if (stWorkSubTab === 'reports') return '/st-bao-cao';
      return '/quan-ly-cong-viec-st';
    }
    if (module === 'settings') return '/cai-dat';
    return '/';
  }
}

/**
 * Custom Hook đồng bộ hai chiều giữa State phân hệ ERP và URL trình duyệt
 */
export function useHRRouteSync(
  activeModule: ActiveModule,
  leaveSubTab: LeaveSubTab,
  reportSubTab: ReportSubTab,
  stWorkSubTab: StWorkSubTab,
  onRouteChanged: (state: RouteState) => void
): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetPath = HRRouteManager.getPathnameForState(
      activeModule,
      leaveSubTab,
      reportSubTab,
      stWorkSubTab
    );
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(
        null,
        '',
        `${targetPath}${window.location.search}${window.location.hash}`
      );
    }
  }, [activeModule, leaveSubTab, reportSubTab, stWorkSubTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const resolved = HRRouteManager.resolveFromPathname(
        window.location.pathname
      );
      onRouteChanged(resolved);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onRouteChanged]);
}
