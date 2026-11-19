import React, { useEffect, useState } from 'react';
import {
  DepartmentGroup,
  Employee,
  EmployeeAnnualMatrixRow,
  LeaveRecord,
  MatrixViewMode,
} from '../types/hr';
import { AnnualMatrixReportView } from './AnnualMatrixReportView';
import { ReportSubTab } from './Sidebar';

interface ReportDashboardProps {
  employees: Employee[];
  records: LeaveRecord[];
  groups: DepartmentGroup[];
  activeSubTab?: ReportSubTab;
  onSubTabChange?: (subTab: ReportSubTab) => void;
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
}

const REPORT_TABS: Array<{ id: 'month' | 'year'; label: string }> = [
  { id: 'month', label: 'Báo cáo tháng' },
  { id: 'year', label: 'Báo cáo năm' },
];

export const ReportDashboard: React.FC<ReportDashboardProps> = ({
  employees,
  records,
  groups,
  activeSubTab = 'monthly_summary',
  onSubTabChange,
  onExportMatrixExcel,
  onExportMatrixPDF,
  onInspectAttachment,
  onQuickAddForEmployeeMonth,
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'year'>(
    activeSubTab === 'annual_matrix' ? 'year' : 'month'
  );

  useEffect(() => {
    setViewMode(activeSubTab === 'annual_matrix' ? 'year' : 'month');
  }, [activeSubTab]);

  const handleToggleViewMode = (mode: 'month' | 'year') => {
    setViewMode(mode);
    onSubTabChange?.(mode === 'year' ? 'annual_matrix' : 'monthly_summary');
  };

  return (
    <div className="text-slate-800">
      {/* A. Cụm Header (Giao diện chuẩn Segmented Control - TUYỆT ĐỐI KHÔNG dùng subtitle/mô tả phụ) */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Báo cáo tổng hợp</h1>

        <div
          role="tablist"
          aria-label="Chọn chế độ báo cáo"
          className="inline-flex space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200"
        >
          {REPORT_TABS.map((tab) => {
            const isActive = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`report-tab-${tab.id}`}
                onClick={() => handleToggleViewMode(tab.id)}
                className={
                  isActive
                    ? 'bg-white text-[#14539E] shadow-sm font-medium rounded-md px-4 py-1.5 transition-all cursor-pointer text-sm'
                    : 'bg-transparent text-slate-500 hover:text-[#14539E]/80 font-medium rounded-md px-4 py-1.5 transition-all cursor-pointer text-sm'
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* B. Khu vực hiển thị nội dung (Conditional Rendering) */}
      {viewMode === 'month' ? (
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
      ) : (
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
    </div>
  );
};
