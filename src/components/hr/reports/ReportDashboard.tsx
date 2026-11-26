import React, { useEffect, useState } from 'react';
import {
  CompanyUnit,
  DepartmentGroup,
  Employee,
  EmployeeAnnualMatrixRow,
  LeaveRecord,
  MatrixViewMode,
} from '../../../types/hr';
import { OpeningBalanceImportRow } from '../../../utils/exportUtils';
import { AnnualMatrixReportView } from './AnnualMatrixReportView';
import { AnnualLeaveFundView } from '../leave/AnnualLeaveFundView';
import { OvertimeHoursReportView } from '../overtime/OvertimeHoursReportView';
import { ReportSubTab } from '../../Sidebar';

interface ReportDashboardProps {
  employees: Employee[];
  records: LeaveRecord[];
  groups: DepartmentGroup[];
  companyUnits?: CompanyUnit[];
  activeCompanyId?: string;
  defaultAnnualLeaveQuota?: number;
  isAdmin?: boolean;
  activeSubTab?: ReportSubTab;
  onSubTabChange?: (subTab: ReportSubTab) => void;
  onUpdateEmployeeQuota?: (employee: Employee, newQuota: number) => void;
  onUpdateCompanyQuota?: (companyId: string, newQuota: number) => void;
  onChangeDefaultAnnualLeaveQuota?: (newQuota: number) => void;
  onImportOpeningBalances?: (rows: OpeningBalanceImportRow[]) => void;
  onExportMatrixExcel: (
    rows: EmployeeAnnualMatrixRow[],
    year: number,
    viewMode: MatrixViewMode
  ) => void;
  onExportMatrixPDF: (
    rows: EmployeeAnnualMatrixRow[],
    year: number,
    viewMode: MatrixViewMode
  ) => void;
  onInspectAttachment: (url: string, title: string) => void;
  onQuickAddForEmployeeMonth: (
    employeeId: string,
    month: number,
    year: number
  ) => void;
  onShowToast?: (msg: string) => void;
}

const REPORT_TABS: Array<{ id: ReportSubTab; label: string; testId: string }> = [
  { id: 'monthly_summary', label: 'Báo cáo tháng', testId: 'report-tab-month' },
  { id: 'annual_matrix', label: 'Báo cáo năm', testId: 'report-tab-year' },
  { id: 'leave_fund', label: 'Quỹ phép năm', testId: 'report-tab-leave-fund' },
  { id: 'overtime_hours', label: 'Giờ Tăng ca', testId: 'report-tab-overtime-hours' },
];

export const ReportDashboard: React.FC<ReportDashboardProps> = ({
  employees,
  records,
  groups,
  companyUnits = [],
  activeCompanyId,
  defaultAnnualLeaveQuota = 12,
  isAdmin = false,
  activeSubTab = 'monthly_summary',
  onSubTabChange,
  onUpdateEmployeeQuota,
  onUpdateCompanyQuota,
  onChangeDefaultAnnualLeaveQuota,
  onImportOpeningBalances,
  onExportMatrixExcel,
  onExportMatrixPDF,
  onInspectAttachment,
  onQuickAddForEmployeeMonth,
  onShowToast,
}) => {
  const [currentTab, setCurrentTab] = useState<ReportSubTab>(activeSubTab);

  useEffect(() => {
    setCurrentTab(activeSubTab);
  }, [activeSubTab]);

  const handleSelectTab = (tab: ReportSubTab) => {
    setCurrentTab(tab);
    onSubTabChange?.(tab);
  };

  return (
    <div className="text-slate-800">
      {/* A. Cụm Header (Giao diện chuẩn Segmented Control) */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Báo cáo tổng hợp</h1>

        <div
          role="tablist"
          aria-label="Chọn chế độ báo cáo"
          className="inline-flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200"
        >
          {REPORT_TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={tab.testId}
                onClick={() => handleSelectTab(tab.id)}
                className={
                  isActive
                    ? 'bg-white text-[#14539E] shadow-sm font-semibold rounded-md px-3.5 py-1.5 transition-all cursor-pointer text-sm whitespace-nowrap'
                    : 'bg-transparent text-slate-500 hover:text-[#14539E]/80 font-medium rounded-md px-3.5 py-1.5 transition-all cursor-pointer text-sm whitespace-nowrap'
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* B. Khu vực hiển thị nội dung theo tab đang chọn */}
      {currentTab === 'monthly_summary' && (
        <AnnualMatrixReportView
          employees={employees}
          records={records}
          groups={groups}
          activeSubTab="monthly_summary"
          onExportMatrixExcel={onExportMatrixExcel}
          onExportMatrixPDF={onExportMatrixPDF}
          onInspectAttachment={onInspectAttachment}
          onQuickAddForEmployeeMonth={onQuickAddForEmployeeMonth}
        />
      )}

      {currentTab === 'annual_matrix' && (
        <AnnualMatrixReportView
          employees={employees}
          records={records}
          groups={groups}
          activeSubTab="annual_matrix"
          onExportMatrixExcel={onExportMatrixExcel}
          onExportMatrixPDF={onExportMatrixPDF}
          onInspectAttachment={onInspectAttachment}
          onQuickAddForEmployeeMonth={onQuickAddForEmployeeMonth}
        />
      )}

      {currentTab === 'leave_fund' && (
        <AnnualLeaveFundView
          employees={employees}
          records={records}
          groups={groups}
          companyUnits={companyUnits}
          activeCompanyId={activeCompanyId}
          defaultAnnualLeaveQuota={defaultAnnualLeaveQuota}
          isAdmin={isAdmin}
          onUpdateEmployeeQuota={onUpdateEmployeeQuota}
          onUpdateCompanyQuota={onUpdateCompanyQuota}
          onChangeDefaultAnnualLeaveQuota={onChangeDefaultAnnualLeaveQuota}
          onImportOpeningBalances={onImportOpeningBalances}
        />
      )}

      {currentTab === 'overtime_hours' && (
        <OvertimeHoursReportView
          employees={employees}
          groups={groups}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
