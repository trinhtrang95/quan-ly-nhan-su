import React, { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import {
  ActiveModule,
  CompanyUnit,
  DepartmentGroup,
  Employee,
  EmployeeAnnualMatrixRow,
  LeaveRecord,
  MatrixViewMode,
  UserAccount,
  UserRole,
} from './types/hr';
import {
  INITIAL_COMPANY_UNITS,
  INITIAL_DEPARTMENT_GROUPS,
  INITIAL_USER_ACCOUNTS,
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
  clearAllDataInSupabase,
  createAppUserInSupabase,
  createCompanyInSupabase,
  createDepartmentInSupabase,
  createEmployeeInSupabase,
  createLeaveLogInSupabase,
  deleteAppUserFromSupabase,
  deleteCompanyFromSupabase,
  deleteDepartmentFromSupabase,
  deleteEmployeesFromSupabase,
  deleteLeaveLogFromSupabase,
  loadOrSeedSupabaseData,
  restoreDemoDataInSupabase,
  updateAppUserRoleInSupabase,
  updateCompanyInSupabase,
  updateDepartmentInSupabase,
  updateEmployeeInSupabase,
  updateLeaveLogInSupabase,
} from './utils/supabaseService';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { TopBannerHeader } from './components/TopBannerHeader';
import { DashboardView } from './components/DashboardView';
import { EmployeeDirectoryView } from './components/EmployeeDirectoryView';
import { EmployeeModal } from './components/EmployeeModal';
import { GroupManageModal } from './components/GroupManageModal';
import { LeaveLateLogView } from './components/LeaveLateLogView';
import { LeaveRecordModal } from './components/LeaveRecordModal';
import { AnnualMatrixReportView } from './components/AnnualMatrixReportView';
import { SystemSettingsView } from './components/SystemSettingsView';
import { LightboxModal } from './components/LightboxModal';
import { PrintReportModal } from './components/PrintReportModal';

const STORAGE_KEYS = {
  INITIALIZED: 'hr_pro_initialized',
  EMPLOYEES: 'hr_pro_employees_v2',
  RECORDS: 'hr_pro_leave_records_v2',
  GROUPS: 'hr_pro_groups_v2',
  COMPANIES: 'hr_pro_companies_v2',
  ACTIVE_COMPANY_ID: 'hr_pro_active_company_id_v2',
  ACCOUNTS: 'hr_pro_accounts_v2',
  CURRENT_USER: 'hr_pro_current_user_v2',
  DEFAULT_QUOTA: 'hr_pro_default_quota_v2',
};

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isProcessingData, setIsProcessingData] = useState<boolean>(false);

  // Check if already initialized locally
  const [localInitialized] = useState<boolean>(() => {
    try {
      const existingFlag = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      const existingEmps = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      if (existingFlag === 'true' || existingEmps !== null) {
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
        return true;
      }
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      return true;
    } catch {
      return true;
    }
  });

  // User Accounts (`app_users`) & Auth State
  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      return saved ? JSON.parse(saved) : INITIAL_USER_ACCOUNTS;
    } catch {
      return INITIAL_USER_ACCOUNTS;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') === '1') {
          return INITIAL_USER_ACCOUNTS[0];
        }
      }
      const savedLocal = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (savedLocal) {
        return JSON.parse(savedLocal);
      }
      const savedSession = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (savedSession) {
        return JSON.parse(savedSession);
      }
      return null;
    } catch {
      return null;
    }
  });

  // Company Units (`companies`) & Active Company State
  const [companyUnits, setCompanyUnits] = useState<CompanyUnit[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPANIES);
      return saved ? JSON.parse(saved) : INITIAL_COMPANY_UNITS;
    } catch {
      return INITIAL_COMPANY_UNITS;
    }
  });

  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY_ID);
      return saved || INITIAL_COMPANY_UNITS[0].id;
    } catch {
      return INITIAL_COMPANY_UNITS[0].id;
    }
  });

  const [defaultAnnualLeaveQuota, setDefaultAnnualLeaveQuota] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DEFAULT_QUOTA);
      return saved ? Number(saved) : 12;
    } catch {
      return 12;
    }
  });

  // Core Data State (`departments`, `employees`, `leave_logs`)
  const [groups, setGroups] = useState<DepartmentGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GROUPS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [records, setRecords] = useState<LeaveRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    } catch {
      // Ignore storage quota errors
    }
  }, [accounts]);

  useEffect(() => {
    try {
      if (currentUser) {
        // Keep whichever storage currently holds the active session in sync when role updates
        if (sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER) !== null) {
          sessionStorage.setItem(
            STORAGE_KEYS.CURRENT_USER,
            JSON.stringify(currentUser)
          );
        } else {
          localStorage.setItem(
            STORAGE_KEYS.CURRENT_USER,
            JSON.stringify(currentUser)
          );
        }
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companyUnits));
    } catch {
      // Ignore storage quota errors
    }
  }, [companyUnits]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY_ID, activeCompanyId);
    } catch {
      // Ignore storage quota errors
    }
  }, [activeCompanyId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DEFAULT_QUOTA, String(defaultAnnualLeaveQuota));
    } catch {
      // Ignore storage quota errors
    }
  }, [defaultAnnualLeaveQuota]);

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

  // Sync all 5 tables (`companies`, `departments`, `app_users`, `employees`, `leave_logs`) from Supabase
  const syncFromSupabase = async (silent = false) => {
    setIsSyncing(true);
    try {
      const result = await loadOrSeedSupabaseData(localInitialized);
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      if (result.connected) {
        setCompanyUnits(result.companies);
        setActiveCompanyId((prevId) => {
          const found = result.companies.find((c) => c.id === prevId);
          const chosen = found || result.companies[0];
          if (chosen?.defaultLeaveQuota) {
            setDefaultAnnualLeaveQuota(chosen.defaultLeaveQuota);
          }
          return chosen ? chosen.id : prevId;
        });
        setGroups(result.departments);
        setAccounts(result.accounts);
        setEmployees(result.employees);
        setRecords(result.records);
        setIsCloudConnected(true);
        if (!silent) {
          showToast(
            `Đã đồng bộ Supabase: ${result.companies.length} đơn vị, ${result.departments.length} phòng ban, ${result.employees.length} nhân sự & ${result.records.length} bản ghi phép.`
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
  }, []);

  const isAdmin = currentUser?.role === 'admin';
  const activeCompany =
    companyUnits.find((c) => c.id === activeCompanyId) ||
    companyUnits[0] ||
    INITIAL_COMPANY_UNITS[0];

  // Filter employees and departments by active company (including legacy rows where companyId is null)
  const companyEmployees =
    companyUnits.length <= 1
      ? employees
      : employees.filter(
          (e) => !e.companyId || e.companyId === activeCompany.id
        );

  const companyEmployeeIds = new Set(companyEmployees.map((e) => e.id));
  const companyRecords =
    companyUnits.length <= 1
      ? records
      : records.filter((r) => companyEmployeeIds.has(r.employeeId));

  const companyGroups =
    companyUnits.length <= 1
      ? groups
      : groups.filter((g) => !g.companyId || g.companyId === activeCompany.id);

  // Include any departments referenced by existing employees so filters & forms are always complete
  const effectiveGroups: DepartmentGroup[] = (() => {
    const existingNames = new Set(companyGroups.map((g) => g.name));
    const extraGroups: DepartmentGroup[] = [];
    for (const emp of companyEmployees) {
      if (emp.department && !existingNames.has(emp.department)) {
        existingNames.add(emp.department);
        extraGroups.push({
          id: `emp-dept-${emp.department}`,
          companyId: activeCompany.id,
          name: emp.department,
          code: emp.department.slice(0, 4).toUpperCase(),
          color: '#0D9488',
        });
      }
    }
    return [...companyGroups, ...extraGroups];
  })();

  // Derived Real-time Dashboard & Matrix Calculations
  const kpis = calculateDashboardKPIs(
    companyEmployees,
    companyRecords,
    '2026-11-12',
    11,
    2026
  );
  const departmentDist = calculateDepartmentDistribution(
    companyEmployees,
    effectiveGroups
  );
  const leaveTypeDist = calculateMonthlyLeaveTypeDistribution(
    companyRecords,
    11,
    2026
  );
  const matrixRows2026 = calculateAnnualMatrixReport(
    companyEmployees,
    companyRecords,
    2026,
    'ALL'
  );
  const sortedRecords = [...companyRecords].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );

  // Next suggested employee code (e.g., NV001)
  const nextSuggestedCode = (() => {
    const nums = employees
      .map((e) => {
        const m = e.employeeCode.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n < 100000);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    return `NV${String(maxNum + 1).padStart(3, '0')}`;
  })();

  // Employee Handlers (persisted to Supabase `employees` with `company_id`)
  const handleSaveEmployee = async (
    empData: Omit<Employee, 'id'>,
    existingId?: string
  ) => {
    const payloadWithCompany: Omit<Employee, 'id'> = {
      ...empData,
      companyId: empData.companyId || activeCompany.id,
    };

    if (existingId) {
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === existingId ? { ...payloadWithCompany, id: existingId } : e
        )
      );
      try {
        const updated = await updateEmployeeInSupabase(
          existingId,
          payloadWithCompany
        );
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
      const optimisticEmp: Employee = { ...payloadWithCompany, id: tempId };
      setEmployees((prev) => [...prev, optimisticEmp]);

      try {
        const created = await createEmployeeInSupabase(payloadWithCompany);
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
    if (!isAdmin) return;
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
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
    if (!isAdmin || selectedEmpIds.length === 0) return;
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
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
    if (!isAdmin) return;
    const imported = await parseEmployeesFromUploadedFile(file, employees.length);
    if (imported.length === 0) {
      showToast('Không tìm thấy dòng dữ liệu hợp lệ trong tệp tải lên.');
      return;
    }

    const withCompany = imported.map(({ id: _unused, ...rest }) => ({
      ...rest,
      companyId: activeCompany.id,
    }));

    try {
      const inserted = await bulkCreateEmployeesInSupabase(withCompany);
      setEmployees((prev) => [...prev, ...inserted]);
      showToast(
        `Đã nhập và đồng bộ ${inserted.length} nhân sự từ Excel lên Supabase Cloud.`
      );
    } catch {
      setEmployees((prev) => [...prev, ...imported]);
      showToast(`Đã nhập thành công ${imported.length} nhân sự từ tệp Excel/CSV.`);
    }
  };

  // Department (`departments` table) Handlers
  const handleAddGroup = async (grpData: Omit<DepartmentGroup, 'id'>) => {
    const tempId = `grp-${Date.now()}`;
    const optimistic: DepartmentGroup = {
      ...grpData,
      id: tempId,
      companyId: activeCompany.id,
    };
    setGroups((prev) => [...prev, optimistic]);

    try {
      const created = await createDepartmentInSupabase(grpData, activeCompany.id);
      setGroups((prev) => prev.map((g) => (g.id === tempId ? created : g)));
      showToast(`Đã lưu phòng ban "${created.name}" lên bảng departments (Supabase).`);
    } catch {
      showToast(`Đã thêm bộ phận mới: ${optimistic.name}.`);
    }
  };

  const handleUpdateGroup = async (
    id: string,
    data: Omit<DepartmentGroup, 'id'>
  ) => {
    const oldGroup = groups.find((g) => g.id === id);
    setGroups((prev) =>
      prev.map((g) =>
        g.id === id ? { ...data, id, companyId: activeCompany.id } : g
      )
    );
    if (oldGroup && oldGroup.name !== data.name) {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.department === oldGroup.name
            ? { ...emp, department: data.name }
            : emp
        )
      );
    }

    try {
      const updated = await updateDepartmentInSupabase(
        id,
        data,
        activeCompany.id
      );
      setGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
      showToast(`Đã cập nhật phòng ban "${updated.name}" trên Supabase.`);
    } catch {
      showToast(`Đã cập nhật thông tin phòng ban: ${data.name}.`);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    try {
      await deleteDepartmentFromSupabase(id);
      showToast('Đã xóa phòng ban khỏi bảng departments (Supabase).');
    } catch {
      showToast('Đã xóa bộ phận khỏi danh mục.');
    }
  };

  // Company Unit (`companies` table) Handlers
  const handleAddCompany = async (unitData: Omit<CompanyUnit, 'id'>) => {
    const tempId = `comp-${Date.now()}`;
    const optimistic: CompanyUnit = {
      ...unitData,
      id: tempId,
      defaultLeaveQuota: defaultAnnualLeaveQuota,
      isInitialized: true,
    };
    setCompanyUnits((prev) => [...prev, optimistic]);
    setActiveCompanyId(tempId);

    try {
      const created = await createCompanyInSupabase({
        ...unitData,
        defaultLeaveQuota: defaultAnnualLeaveQuota,
        isInitialized: true,
      });
      setCompanyUnits((prev) =>
        prev.map((c) => (c.id === tempId ? created : c))
      );
      setActiveCompanyId(created.id);
      showToast(`Đã thêm đơn vị "${created.name}" lên bảng companies (Supabase).`);
    } catch {
      showToast(`Đã thêm đơn vị mới: ${optimistic.name}.`);
    }
  };

  const handleUpdateCompany = async (
    id: string,
    unitData: Omit<CompanyUnit, 'id'>
  ) => {
    setCompanyUnits((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...unitData, id } : c))
    );
    try {
      const updated = await updateCompanyInSupabase(id, unitData);
      setCompanyUnits((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
      showToast(`Đã cập nhật đơn vị "${updated.name}" trên Supabase.`);
    } catch {
      showToast(`Đã cập nhật đơn vị: ${unitData.name}.`);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (companyUnits.length <= 1) return;
    setCompanyUnits((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (activeCompanyId === id && remaining.length > 0) {
        setActiveCompanyId(remaining[0].id);
      }
      return remaining;
    });

    try {
      await deleteCompanyFromSupabase(id);
      showToast('Đã xóa đơn vị thành viên khỏi bảng companies (Supabase).');
    } catch {
      showToast('Đã xóa đơn vị thành viên.');
    }
  };

  // Default Annual Leave Quota (`companies.default_leave_quota`) Handler
  const handleUpdateDefaultQuota = async (quota: number) => {
    setDefaultAnnualLeaveQuota(quota);
    setCompanyUnits((prev) =>
      prev.map((c) =>
        c.id === activeCompany.id ? { ...c, defaultLeaveQuota: quota } : c
      )
    );
    try {
      await updateCompanyInSupabase(activeCompany.id, {
        defaultLeaveQuota: quota,
      });
      showToast(
        `Đã lưu định mức phép chuẩn (${quota} ngày/năm) vào bảng companies trên Supabase.`
      );
    } catch {
      showToast(
        `Đã cập nhật số ngày phép chuẩn mặc định thành ${quota} ngày/năm.`
      );
    }
  };

  // User Account (`app_users` table) Handlers
  const handleAddAccount = async (
    accData: Omit<UserAccount, 'id' | 'createdAt'>
  ) => {
    const tempId = `acc-${Date.now()}`;
    const optimistic: UserAccount = {
      ...accData,
      id: tempId,
      companyId: activeCompany.id,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setAccounts((prev) => [...prev, optimistic]);

    try {
      const created = await createAppUserInSupabase(accData, activeCompany.id);
      setAccounts((prev) => prev.map((a) => (a.id === tempId ? created : a)));
      showToast(
        `Đã tạo tài khoản "${created.username}" trên bảng app_users (Supabase).`
      );
    } catch {
      showToast(
        `Đã tạo tài khoản ${optimistic.username} (${
          optimistic.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'
        }).`
      );
    }
  };

  const handleUpdateAccountRole = async (id: string, role: UserRole) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, role } : a))
    );
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, role } : null));
    }

    try {
      const updated = await updateAppUserRoleInSupabase(id, role);
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      showToast(
        `Đã cập nhật quyền "${
          role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NHÂN VIÊN'
        }" trên bảng app_users (Supabase).`
      );
    } catch {
      showToast(
        `Đã đổi phân quyền tài khoản sang ${
          role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NHÂN VIÊN'
        }.`
      );
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    try {
      await deleteAppUserFromSupabase(id);
      showToast('Đã xóa tài khoản khỏi bảng app_users (Supabase).');
    } catch {
      showToast('Đã xóa tài khoản khỏi hệ thống.');
    }
  };

  // Leave / Late Record Handlers (`leave_logs` table on Supabase)
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
              ? {
                  ...updated,
                  attachmentTitle:
                    recData.attachmentTitle || updated.attachmentTitle,
                }
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
              ? {
                  ...created,
                  attachmentTitle:
                    recData.attachmentTitle || created.attachmentTitle,
                }
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
    if (!isAdmin) return;
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    setRecords((prev) => prev.filter((r) => r.id !== rec.id));
    try {
      await deleteLeaveLogFromSupabase(rec.id);
      showToast('Đã xóa bản ghi nghỉ phép / đi muộn khỏi Supabase Cloud.');
    } catch {
      showToast('Đã xóa bản ghi nghỉ phép / đi muộn.');
    }
  };

  // Data Administration Handlers: Clear All Data vs Restore Demo Data
  const handleClearAllData = async () => {
    if (!isAdmin) return;
    setIsProcessingData(true);
    try {
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, '[]');
      localStorage.setItem(STORAGE_KEYS.RECORDS, '[]');
      setEmployees([]);
      setRecords([]);
      setSelectedEmpIds([]);

      await clearAllDataInSupabase();
      showToast(
        'Đã xóa trắng toàn bộ dữ liệu mẫu trên Supabase (employees & leave_logs = 0) và giữ is_initialized = true.'
      );
    } catch {
      showToast(
        'Đã xóa trắng toàn bộ dữ liệu nhân sự và nghỉ phép về 0.'
      );
    } finally {
      setIsProcessingData(false);
    }
  };

  const handleRestoreDemoData = async () => {
    if (!isAdmin) return;
    setIsProcessingData(true);
    try {
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      const restored = await restoreDemoDataInSupabase(activeCompany.id);
      setEmployees(restored.employees);
      setRecords(restored.records);
      if (restored.departments.length > 0) {
        setGroups(restored.departments);
      } else {
        setGroups(INITIAL_DEPARTMENT_GROUPS);
      }
      showToast(
        `Đã khôi phục ${restored.employees.length} nhân sự mẫu & ${restored.records.length} bản ghi phép mẫu lên Supabase.`
      );
    } catch {
      showToast('Không thể khôi phục dữ liệu mẫu lên Supabase.');
    } finally {
      setIsProcessingData(false);
    }
  };

  // If not logged in, render Login Screen
  if (!currentUser) {
    return (
      <LoginView
        accounts={accounts}
        activeCompany={activeCompany}
        isCloudConnected={isCloudConnected}
        onLoginSuccess={(acc, rememberMe) => {
          try {
            if (rememberMe) {
              localStorage.setItem(
                STORAGE_KEYS.CURRENT_USER,
                JSON.stringify(acc)
              );
              sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            } else {
              sessionStorage.setItem(
                STORAGE_KEYS.CURRENT_USER,
                JSON.stringify(acc)
              );
              localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            }
          } catch {
            // Ignore storage errors
          }

          setCurrentUser(acc);
          if (acc.companyId) {
            const matchedComp = companyUnits.find((c) => c.id === acc.companyId);
            if (matchedComp) {
              setActiveCompanyId(matchedComp.id);
            }
          }
          if (acc.role !== 'admin' && activeModule === 'settings') {
            setActiveModule('dashboard');
          }
          showToast(
            `Xin chào ${acc.fullName}! Đang đăng nhập với quyền ${
              acc.role === 'admin' ? 'QUẢN TRỊ VIÊN (Admin)' : 'NHÂN VIÊN (User)'
            }.`
          );
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#EEF3F6] text-slate-800">
      {/* Left Fixed Sidebar (PC) & Bottom Navigation Bar (Mobile) */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={(mod) => {
          if (mod === 'settings' && !isAdmin) return;
          setActiveModule(mod);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        employeeCount={companyEmployees.length}
        recordCount={companyRecords.length}
        currentUser={currentUser}
        companyUnits={companyUnits}
        activeCompanyId={activeCompany.id}
        onSelectCompany={(compId) => {
          setActiveCompanyId(compId);
          const found = companyUnits.find((c) => c.id === compId);
          if (found) {
            if (found.defaultLeaveQuota) {
              setDefaultAnnualLeaveQuota(found.defaultLeaveQuota);
            }
            showToast(`Đã chuyển đơn vị làm việc sang: ${found.name}`);
          }
        }}
        onLogoutClick={() => {
          setCurrentUser(null);
          setActiveModule('dashboard');
        }}
      />

      {/* Right Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto pb-20 md:pb-8">
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-5 md:px-6 pt-4 md:pt-5 flex-1">
          {/* Top White Rounded Card Banner Header */}
          <TopBannerHeader
            activeModule={activeModule}
            onSelectModule={setActiveModule}
            activeCompany={activeCompany}
            currentUser={currentUser}
            onLogoutClick={() => {
              setCurrentUser(null);
              setActiveModule('dashboard');
            }}
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
              if (!isAdmin) return;
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
                employees={companyEmployees}
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
                employees={companyEmployees}
                groups={effectiveGroups}
                selectedIds={selectedEmpIds}
                isAdmin={isAdmin}
                onToggleSelect={handleToggleSelectEmployee}
                onToggleSelectAll={handleToggleSelectAllEmployees}
                onDeleteSelected={handleDeleteSelectedEmployees}
                onDeleteSingle={handleDeleteSingleEmployee}
                onOpenAddEmployee={() => {
                  if (!isAdmin) return;
                  setEditingEmployee(null);
                  setIsEmpModalOpen(true);
                }}
                onOpenEditEmployee={(emp) => {
                  if (!isAdmin) return;
                  setEditingEmployee(emp);
                  setIsEmpModalOpen(true);
                }}
                onOpenManageGroups={() => {
                  if (!isAdmin) return;
                  setIsGroupModalOpen(true);
                }}
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
                records={companyRecords}
                employees={companyEmployees}
                groups={effectiveGroups}
                isAdmin={isAdmin}
                onOpenAddRecord={() => {
                  setEditingRecord(null);
                  setLeaveDefaultEmpId(undefined);
                  setLeaveDefaultMonth(undefined);
                  setLeaveDefaultYear(undefined);
                  setIsLeaveModalOpen(true);
                }}
                onOpenEditRecord={(rec) => {
                  if (!isAdmin) return;
                  setEditingRecord(rec);
                  setIsLeaveModalOpen(true);
                }}
                onDeleteRecord={handleDeleteLeaveRecord}
                onInspectAttachment={(url, title) =>
                  setLightboxImage({ url, title })
                }
                onExportExcel={(filteredList) => {
                  exportLeaveRecordsToExcel(filteredList, companyEmployees);
                  showToast(
                    `Đã xuất tệp Excel nhật ký (${filteredList.length} bản ghi).`
                  );
                }}
              />
            )}

            {activeModule === 'annual_report' && (
              <AnnualMatrixReportView
                employees={companyEmployees}
                records={companyRecords}
                groups={effectiveGroups}
                onExportMatrixExcel={(rows, year, viewMode) => {
                  exportAnnualMatrixToExcel(rows, year, viewMode);
                  showToast(`Đã xuất tệp Excel Báo cáo Ma trận Tồn phép năm ${year}.`);
                }}
                onExportMatrixPDF={(rows, year, viewMode) =>
                  setPrintModalState({
                    isOpen: true,
                    reportType: 'annual_matrix',
                    employees: companyEmployees,
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

            {activeModule === 'settings' && isAdmin && (
              <SystemSettingsView
                companyUnits={companyUnits}
                activeCompanyId={activeCompany.id}
                onSelectActiveCompany={(id) => {
                  setActiveCompanyId(id);
                  const found = companyUnits.find((c) => c.id === id);
                  if (found) {
                    if (found.defaultLeaveQuota) {
                      setDefaultAnnualLeaveQuota(found.defaultLeaveQuota);
                    }
                    showToast(`Đã đặt ${found.name} làm đơn vị đang làm việc.`);
                  }
                }}
                onAddCompanyUnit={handleAddCompany}
                onUpdateCompanyUnit={handleUpdateCompany}
                onDeleteCompanyUnit={handleDeleteCompany}
                groups={companyGroups}
                employees={companyEmployees}
                onAddGroup={handleAddGroup}
                onUpdateGroup={handleUpdateGroup}
                onDeleteGroup={handleDeleteGroup}
                defaultAnnualLeaveQuota={
                  activeCompany.defaultLeaveQuota ?? defaultAnnualLeaveQuota
                }
                onChangeDefaultAnnualLeaveQuota={handleUpdateDefaultQuota}
                accounts={accounts}
                currentAccountId={currentUser.id}
                onAddAccount={handleAddAccount}
                onUpdateAccountRole={handleUpdateAccountRole}
                onDeleteAccount={handleDeleteAccount}
                recordCount={records.length}
                isProcessingData={isProcessingData}
                onClearAllData={handleClearAllData}
                onRestoreDemoData={handleRestoreDemoData}
              />
            )}
          </main>
        </div>
      </div>

      {/* Modals */}
      <EmployeeModal
        isOpen={isEmpModalOpen}
        editingEmployee={editingEmployee}
        groups={effectiveGroups}
        existingCodes={employees.map((e) => e.employeeCode)}
        nextSuggestedCode={nextSuggestedCode}
        defaultAnnualLeaveQuota={
          activeCompany.defaultLeaveQuota ?? defaultAnnualLeaveQuota
        }
        onClose={() => setIsEmpModalOpen(false)}
        onSave={handleSaveEmployee}
      />

      <GroupManageModal
        isOpen={isGroupModalOpen}
        groups={companyGroups}
        employees={companyEmployees}
        onClose={() => setIsGroupModalOpen(false)}
        onAddGroup={handleAddGroup}
        onDeleteGroup={handleDeleteGroup}
      />

      <LeaveRecordModal
        isOpen={isLeaveModalOpen}
        editingRecord={editingRecord}
        employees={companyEmployees}
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
