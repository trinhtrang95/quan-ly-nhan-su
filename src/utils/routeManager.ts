import { useEffect } from 'react';
import { ActiveModule as BaseActiveModule } from '../types/hr';
import { LeaveSubTab, ReportSubTab } from '../components/Sidebar';

export type ActiveModule = BaseActiveModule | 'overtime';

export interface RouteState {
  module: ActiveModule;
  leaveSubTab: LeaveSubTab;
  reportSubTab: ReportSubTab;
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
      };
    }
    if (clean === '/don-nghi') {
      return {
        module: 'leave_logs',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
      };
    }
    if (clean === '/quy-phep-nam') {
      return {
        module: 'annual_report',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'leave_fund',
      };
    }
    if (clean === '/bao-cao-tang-ca' || clean === '/gio-tang-ca') {
      return {
        module: 'annual_report',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'overtime_hours',
      };
    }
    if (clean === '/bao-cao-tong-hop' || clean === '/bao-cao-thang') {
      return {
        module: 'annual_report',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
      };
    }
    if (clean === '/bao-cao-nam') {
      return {
        module: 'annual_report',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'annual_matrix',
      };
    }
    if (clean === '/tang-ca') {
      return {
        module: 'overtime',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
      };
    }
    if (clean === '/thiet-lap-chung') {
      return {
        module: 'general_settings',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
      };
    }
    if (clean === '/quan-ly-cong-viec-st') {
      return {
        module: 'st_work',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
      };
    }
    if (clean === '/cai-dat' || clean === '/he-thong') {
      return {
        module: 'settings',
        leaveSubTab: 'leave_requests',
        reportSubTab: 'monthly_summary',
      };
    }
    return {
      module: 'dashboard',
      leaveSubTab: 'leave_requests',
      reportSubTab: 'monthly_summary',
    };
  }

  static getPathnameForState(
    module: ActiveModule,
    _leaveSubTab: LeaveSubTab,
    reportSubTab?: ReportSubTab
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
    if (module === 'st_work') return '/quan-ly-cong-viec-st';
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
  onRouteChanged: (state: RouteState) => void
): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetPath = HRRouteManager.getPathnameForState(
      activeModule,
      leaveSubTab,
      reportSubTab
    );
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(
        null,
        '',
        `${targetPath}${window.location.search}${window.location.hash}`
      );
    }
  }, [activeModule, leaveSubTab, reportSubTab]);

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
