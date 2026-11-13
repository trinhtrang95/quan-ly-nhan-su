import React, { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import {
  ActiveModule,
  DepartmentGroup,
  Employee,
  EmployeeAnnualMatrixRow,
  LeaveRecord,
  MatrixViewMode,
} from './types/hr';
import {
  INITIAL_DEPARTMENT_GROUPS,
  INITIAL_EMPLOYEES,
  INITIAL_LEAVE_RECORDS,
} from './data/mockData';
import {
  calculateAnnualMatrixReport,
  calculateDashboardKPIs,
  calculateDepartmentDistribution,
  calculateMonthlyLeaveTypeDistribution,
} from './utils/hrCalculations';
import {
  downloadEmployeeTemplateExcel,
  exportAnnualMatrixToExcel,
  exportEmployeesToExcel,
  exportLeaveRecordsToExcel,
  parseEmployeesFromUploadedFile,
} from './utils/exportUtils';
import {
  bulkCreateEmployeesInSupabase,
  createEmployeeInSupabase,
  createLeaveLogInSupabase,
  deleteEmployeesFromSupabase,
  deleteLeaveLogFromSupabase,
  loadOrSeedSupabaseData,
  supabase,
  updateEmployeeInSupabase,
  updateLeaveLogInSupabase,
} from './utils/supabaseService';
import { Sidebar } from './components/Sidebar';
import { TopBannerHeader } from './components/TopBannerHeader';
import { DashboardView } from './components/DashboardView';
import { EmployeeDirectoryView } from './components/EmployeeDirectoryView';
import { EmployeeModal } from './components/EmployeeModal';
import { GroupManageModal } from './components/GroupManageModal';
import { LeaveLateLogView } from './components/LeaveLateLogView';
import { LeaveRecordModal } from './components/LeaveRecordModal';
import { AnnualMatrixReportView } from './components/AnnualMatrixReportView';
import { LightboxModal } from './components/LightboxModal';
import { PrintReportModal } from './components/PrintReportModal';

const STORAGE_KEYS = {
  EMPLOYEES: 'hr_pro_employees_v2',
  RECORDS: 'hr_pro_leave_records_v2',
  GROUPS: 'hr_pro_groups_v2',
};

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Core Data State (with localStorage cache + live Supabase sync)
  const [groups, setGroups] = useState<DepartmentGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GROUPS);
      return saved ? JSON.parse(saved) : INITIAL_DEPARTMENT_GROUPS;
    } catch {
      return INITIAL_DEPARTMENT_GROUPS;
    }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  const [records, setRecords] = useState<LeaveRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
      return saved ? JSON.parse(saved) : INITIAL_LEAVE_RECORDS;
    } catch {
      return INITIAL_LEAVE_RECORDS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    } catch {
      // Ignore storage quota errors
    }
  }, [groups]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
    } catch {
      // Ignore storage quota errors
    }
  }, [employees]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    } catch {
      // Ignore storage quota errors
    }
  }, [records]);

  // Selection state in Employee Directory
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

  // Modals State
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LeaveRecord | null>(null);
  const [leaveDefaultEmpId, setLeaveDefaultEmpId] = useState<string | undefined>(
    undefined
  );
  const [leaveDefaultMonth, setLeaveDefaultMonth] = useState<number | undefined>(
    undefined
  );
  const [leaveDefaultYear, setLeaveDefaultYear] = useState<number | undefined>(
    undefined
  );

  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Print/PDF Report Modal State
  const [printModalState, setPrintModalState] = useState<{
    isOpen: boolean;
    reportType: 'employees' | 'annual_matrix';
    employees: Employee[];
    matrixRows: EmployeeAnnualMatrixRow[];
    year: number;
    viewMode: MatrixViewMode;
  }>({
    isOpen: false,
    reportType: 'annual_matrix',
    employees: [],
    matrixRows: [],
    year: 2026,
    viewMode: 'all',
  });

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Sync with Supabase on mount (auto-seed if Supabase tables are empty)
  const syncFromSupabase = async (silent = false) => {
    setIsSyncing(true);
    try {
      const result = await loadOrSeedSupabaseData();
      if (result.connected) {
        setEmployees(result.employees);
        setRecords(result.records);
        setIsCloudConnected(true);
        if (!silent) {
          showToast(
            `Đã đồng bộ ${result.employees.length} nhân sự & ${result.records.length} bản ghi từ Supabase Cloud.`
          );
        }
      } else {
        setIsCloudConnected(false);
      }
    } catch {
      setIsCloudConnected(false);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncFromSupabase(true);

    const channel = supabase
      .channel('hr-pro-cloud-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        () => {
          syncFromSupabase(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_logs' },
        () => {
          syncFromSupabase(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Derived Real-time Dashboard & Matrix Calculations
  const kpis = calculateDashboardKPIs(
    employees,
    records,
    '2026-11-12',
    11,
    2026
  );
  const departmentDist = calculateDepartmentDistribution(employees, groups);
  const leaveTypeDist = calculateMonthlyLeaveTypeDistribution(records, 11, 2026);
  const matrixRows2026 = calculateAnnualMatrixReport(
    employees,
    records,
    2026,
    'ALL'
  );
  const sortedRecords = [...records].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );

  // Next suggested employee code (e.g., NV009)
  const nextSuggestedCode = (() => {
    const nums = employees
      .map((e) => {
        const m = e.employeeCode.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    return `NV${String(maxNum + 1).padStart(3, '0')}`;
  })();

  // Employee Handlers (persisted to Supabase + instant UI update)
  const handleSaveEmployee = async (
    empData: Omit<Employee, 'id'>,
    existingId?: string
  ) => {
    if (existingId) {
      // Optimistic update
      setEmployees((prev) =>
        prev.map((e) => (e.id === existingId ? { ...empData, id: existingId } : e))
      );
      try {
        const updated = await updateEmployeeInSupabase(existingId, empData);
        setEmployees((prev) =>
          prev.map((e) => (e.id === existingId ? updated : e))
        );
        showToast(
          `Đã lưu cập nhật nhân sự ${empData.fullName} (${empData.employeeCode}) lên Supabase.`
        );
      } catch {
        showToast(
          `Đã cập nhật hồ sơ nhân sự ${empData.fullName} (${empData.employeeCode}).`
        );
      }
    } else {
      const tempId = `emp-${Date.now()}`;
      const optimisticEmp: Employee = { ...empData, id: tempId };
      setEmployees((prev) => [...prev, optimisticEmp]);

      try {
        const created = await createEmployeeInSupabase(empData);
        setEmployees((prev) =>
          prev.map((e) => (e.id === tempId ? created : e))
        );
        showToast(
          `Đã thêm nhân sự ${created.fullName} (${created.employeeCode}) lên Supabase Cloud.`
        );
      } catch {
        showToast(
          `Đã thêm nhân sự mới: ${optimisticEmp.fullName} (${optimisticEmp.employeeCode}).`
        );
      }
    }
  };

  const handleDeleteSingleEmployee = async (emp: Employee) => {
    setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    setRecords((prev) => prev.filter((r) => r.employeeId !== emp.id));
    setSelectedEmpIds((prev) => prev.filter((id) => id !== emp.id));

    try {
      await deleteEmployeesFromSupabase([emp.id]);
      showToast(
        `Đã xóa nhân sự ${emp.fullName} (${emp.employeeCode}) khỏi Supabase Cloud.`
      );
    } catch {
      showToast(`Đã xóa nhân sự ${emp.fullName} (${emp.employeeCode}).`);
    }
  };

  const handleDeleteSelectedEmployees = async () => {
    if (selectedEmpIds.length === 0) return;
    const idsToDelete = [...selectedEmpIds];
    const idSet = new Set(idsToDelete);
    setEmployees((prev) => prev.filter((e) => !idSet.has(e.id)));
    setRecords((prev) => prev.filter((r) => !idSet.has(r.employeeId)));
    setSelectedEmpIds([]);

    try {
      await deleteEmployeesFromSupabase(idsToDelete);
      showToast(`Đã xóa ${idsToDelete.length} hồ sơ nhân sự trên Supabase Cloud.`);
    } catch {
      showToast(`Đã xóa ${idsToDelete.length} hồ sơ nhân sự được chọn.`);
    }
  };

  const handleToggleSelectEmployee = (id: string) => {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllEmployees = (ids: string[]) => {
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedEmpIds.includes(id));
    if (allSelected) {
      setSelectedEmpIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedEmpIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleImportExcelFile = async (file: File) => {
    const imported = await parseEmployeesFromUploadedFile(file, employees.length);
    if (imported.length === 0) {
      showToast('Không tìm thấy dòng dữ liệu hợp lệ trong tệp tải lên.');
      return;
    }

    try {
      const inserted = await bulkCreateEmployeesInSupabase(
        imported.map(({ id: _unused, ...rest }) => rest)
      );
      setEmployees((prev) => [...prev, ...inserted]);
      showToast(
        `Đã nhập và đồng bộ ${inserted.length} nhân sự từ Excel lên Supabase Cloud.`
      );
    } catch {
      setEmployees((prev) => [...prev, ...imported]);
      showToast(`Đã nhập thành công ${imported.length} nhân sự từ tệp Excel/CSV.`);
    }
  };

  // Group Handlers
  const handleAddGroup = (grpData: Omit<DepartmentGroup, 'id'>) => {
    const newGrp: DepartmentGroup = {
      ...grpData,
      id: `grp-${Date.now()}`,
    };
    setGroups((prev) => [...prev, newGrp]);
    showToast(`Đã thêm bộ phận mới: ${newGrp.name}.`);
  };

  const handleDeleteGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    showToast('Đã xóa bộ phận khỏi danh mục.');
  };

  // Leave / Late Record Handlers (persisted to Supabase + instant UI update)
  const handleSaveLeaveRecord = async (
    recData: Omit<LeaveRecord, 'id'>,
    existingId?: string
  ) => {
    const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));
    const emp = empMap.get(recData.employeeId);

    if (existingId) {
      setRecords((prev) =>
        prev.map((r) => (r.id === existingId ? { ...recData, id: existingId } : r))
      );
      try {
        const updated = await updateLeaveLogInSupabase(
          existingId,
          recData,
          empMap
        );
        setRecords((prev) =>
          prev.map((r) =>
            r.id === existingId
              ? { ...updated, attachmentTitle: recData.attachmentTitle || updated.attachmentTitle }
              : r
          )
        );
        showToast(
          `Đã cập nhật bản ghi chấm phép của ${emp?.fullName || ''} trên Supabase.`
        );
      } catch {
        showToast(`Đã cập nhật bản ghi chấm phép của ${emp?.fullName || ''}.`);
      }
    } else {
      const tempId = `rec-${Date.now()}`;
      const optimisticRec: LeaveRecord = {
        ...recData,
        id: tempId,
      };
      setRecords((prev) => [optimisticRec, ...prev]);

      try {
        const created = await createLeaveLogInSupabase(recData, empMap);
        setRecords((prev) =>
          prev.map((r) =>
            r.id === tempId
              ? { ...created, attachmentTitle: recData.attachmentTitle || created.attachmentTitle }
              : r
          )
        );
        showToast(
          `Đã lưu ${recData.amount} ${
            recData.type === 'late_early' ? 'giờ đi muộn' : 'ngày nghỉ'
          } của ${emp?.fullName || ''} lên Supabase Cloud.`
        );
      } catch {
        showToast(
          `Đã ghi nhận ${recData.amount} ${
            recData.type === 'late_early' ? 'giờ đi muộn' : 'ngày nghỉ'
          } cho ${emp?.fullName || ''}.`
        );
      }
    }
  };

  const handleDeleteLeaveRecord = async (rec: LeaveRecord) => {
    setRecords((prev) => prev.filter((r) => r.id !== rec.id));
    try {
      await deleteLeaveLogFromSupabase(rec.id);
      showToast('Đã xóa bản ghi nghỉ phép / đi muộn khỏi Supabase Cloud.');
    } catch {
      showToast('Đã xóa bản ghi nghỉ phép / đi muộn.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#EEF3F6] text-slate-800">
      {/* Left Fixed Sidebar (PC) & Bottom Navigation Bar (Mobile) */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        employeeCount={employees.length}
        recordCount={records.length}
        onLogoutClick={() =>
          showToast('Phiên làm việc của Quản trị viên Trần Thu Trang đang hoạt động.')
        }
      />

      {/* Right Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto pb-20 md:pb-8">
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-5 md:px-6 pt-4 md:pt-5 flex-1">
          {/* Top White Rounded Card Banner Header */}
          <TopBannerHeader
            activeModule={activeModule}
            onSelectModule={setActiveModule}
            isCloudConnected={isCloudConnected}
            isSyncing={isSyncing}
            onManualSync={() => syncFromSupabase(false)}
            onQuickAddLeave={() => {
              setEditingRecord(null);
              setLeaveDefaultEmpId(undefined);
              setLeaveDefaultMonth(undefined);
              setLeaveDefaultYear(undefined);
              setIsLeaveModalOpen(true);
            }}
            onQuickAddEmployee={() => {
              setEditingEmployee(null);
              setIsEmpModalOpen(true);
            }}
          />

          {/* Main Active Module Content */}
          <main aria-label="Nội dung phân hệ chính">
            {activeModule === 'dashboard' && (
              <DashboardView
                kpis={kpis}
                departmentDist={departmentDist}
                leaveTypeDist={leaveTypeDist}
                employees={employees}
                recentRecords={sortedRecords}
                matrixRows={matrixRows2026}
                onNavigate={setActiveModule}
                onOpenAddLeave={() => {
                  setEditingRecord(null);
                  setLeaveDefaultEmpId(undefined);
                  setLeaveDefaultMonth(undefined);
                  setLeaveDefaultYear(undefined);
                  setIsLeaveModalOpen(true);
                }}
                onInspectAttachment={(url, title) =>
                  setLightboxImage({ url, title })
                }
              />
            )}

            {activeModule === 'employees' && (
              <EmployeeDirectoryView
                employees={employees}
                groups={groups}
                selectedIds={selectedEmpIds}
                onToggleSelect={handleToggleSelectEmployee}
                onToggleSelectAll={handleToggleSelectAllEmployees}
                onDeleteSelected={handleDeleteSelectedEmployees}
                onDeleteSingle={handleDeleteSingleEmployee}
                onOpenAddEmployee={() => {
                  setEditingEmployee(null);
                  setIsEmpModalOpen(true);
                }}
                onOpenEditEmployee={(emp) => {
                  setEditingEmployee(emp);
                  setIsEmpModalOpen(true);
                }}
                onOpenManageGroups={() => setIsGroupModalOpen(true)}
                onExportPDF={(filteredList) =>
                  setPrintModalState({
                    isOpen: true,
                    reportType: 'employees',
                    employees: filteredList,
                    matrixRows: [],
                    year: 2026,
                    viewMode: 'all',
                  })
                }
                onExportExcel={(filteredList) => {
                  exportEmployeesToExcel(filteredList);
                  showToast(
                    `Đã xuất tệp Excel danh sách ${filteredList.length} nhân sự.`
                  );
                }}
                onDownloadTemplate={() => {
                  downloadEmployeeTemplateExcel();
                  showToast('Đã tải xuống tệp mẫu Excel nhập danh sách nhân sự.');
                }}
                onImportExcelFile={handleImportExcelFile}
              />
            )}

            {activeModule === 'leave_logs' && (
              <LeaveLateLogView
                records={records}
                employees={employees}
                groups={groups}
                onOpenAddRecord={() => {
                  setEditingRecord(null);
                  setLeaveDefaultEmpId(undefined);
                  setLeaveDefaultMonth(undefined);
                  setLeaveDefaultYear(undefined);
                  setIsLeaveModalOpen(true);
                }}
                onOpenEditRecord={(rec) => {
                  setEditingRecord(rec);
                  setIsLeaveModalOpen(true);
                }}
                onDeleteRecord={handleDeleteLeaveRecord}
                onInspectAttachment={(url, title) =>
                  setLightboxImage({ url, title })
                }
                onExportExcel={(filteredList) => {
                  exportLeaveRecordsToExcel(filteredList, employees);
                  showToast(
                    `Đã xuất tệp Excel nhật ký (${filteredList.length} bản ghi).`
                  );
                }}
              />
            )}

            {activeModule === 'annual_report' && (
              <AnnualMatrixReportView
                employees={employees}
                records={records}
                groups={groups}
                onExportMatrixExcel={(rows, year, viewMode) => {
                  exportAnnualMatrixToExcel(rows, year, viewMode);
                  showToast(`Đã xuất tệp Excel Báo cáo Ma trận Tồn phép năm ${year}.`);
                }}
                onExportMatrixPDF={(rows, year, viewMode) =>
                  setPrintModalState({
                    isOpen: true,
                    reportType: 'annual_matrix',
                    employees,
                    matrixRows: rows,
                    year,
                    viewMode,
                  })
                }
                onInspectAttachment={(url, title) =>
                  setLightboxImage({ url, title })
                }
                onQuickAddForEmployeeMonth={(empId, month, year) => {
                  setEditingRecord(null);
                  setLeaveDefaultEmpId(empId);
                  setLeaveDefaultMonth(month);
                  setLeaveDefaultYear(year);
                  setIsLeaveModalOpen(true);
                }}
              />
            )}
          </main>
        </div>
      </div>

      {/* Modals */}
      <EmployeeModal
        isOpen={isEmpModalOpen}
        editingEmployee={editingEmployee}
        groups={groups}
        existingCodes={employees.map((e) => e.employeeCode)}
        nextSuggestedCode={nextSuggestedCode}
        onClose={() => setIsEmpModalOpen(false)}
        onSave={handleSaveEmployee}
      />

      <GroupManageModal
        isOpen={isGroupModalOpen}
        groups={groups}
        employees={employees}
        onClose={() => setIsGroupModalOpen(false)}
        onAddGroup={handleAddGroup}
        onDeleteGroup={handleDeleteGroup}
      />

      <LeaveRecordModal
        isOpen={isLeaveModalOpen}
        editingRecord={editingRecord}
        employees={employees}
        defaultEmployeeId={leaveDefaultEmpId}
        defaultMonth={leaveDefaultMonth}
        defaultYear={leaveDefaultYear}
        onClose={() => setIsLeaveModalOpen(false)}
        onSave={handleSaveLeaveRecord}
      />

      <LightboxModal
        imageUrl={lightboxImage?.url || null}
        title={lightboxImage?.title || ''}
        onClose={() => setLightboxImage(null)}
      />

      <PrintReportModal
        isOpen={printModalState.isOpen}
        reportType={printModalState.reportType}
        employees={printModalState.employees}
        matrixRows={printModalState.matrixRows}
        year={printModalState.year}
        viewMode={printModalState.viewMode}
        onClose={() =>
          setPrintModalState((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-16 md:bottom-5 right-4 z-50 bg-[#0F232E] text-white px-4 py-3 rounded-xl shadow-lg border border-teal-500/40 flex items-center gap-2.5 text-xs font-medium max-w-md"
        >
          <CheckCircle2 className="w-4 h-4 text-[#2DD4BF] shrink-0" />
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="Đóng thông báo"
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
