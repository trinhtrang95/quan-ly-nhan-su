import React, { useEffect, useMemo, useState } from 'react';
import { Search, RotateCcw, Upload, X, CheckCircle2 } from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
  LeaveBalanceRecord,
  LeavePolicyConfig,
  LeaveRecord,
} from '../types/hr';
import {
  calculateLeaveAccrualBreakdown,
  loadLeaveBalancesMap,
  loadLeavePolicyConfig,
  saveLeaveBalancesBatch,
  sortEmployees,
} from '../utils/hrCalculations';
import { OpeningBalanceImportRow } from '../utils/exportUtils';
import { OpeningBalanceImportModal } from './OpeningBalanceImportModal';

interface AnnualLeaveFundViewProps {
  employees: Employee[];
  records: LeaveRecord[];
  groups: DepartmentGroup[];
  defaultAnnualLeaveQuota?: number;
  isAdmin?: boolean;
  onUpdateEmployeeQuota?: (employee: Employee, newQuota: number) => void;
  onImportOpeningBalances?: (rows: OpeningBalanceImportRow[]) => void;
}

export const AnnualLeaveFundView: React.FC<AnnualLeaveFundViewProps> = ({
  employees,
  records,
  groups,
  defaultAnnualLeaveQuota = 12,
  onImportOpeningBalances,
}) => {
  const currentYear = 2026;
  const currentMonth = 11;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [leavePolicy, setLeavePolicy] = useState<LeavePolicyConfig>(() =>
    loadLeavePolicyConfig()
  );
  const [leaveBalancesMap, setLeaveBalancesMap] = useState<
    Record<string, LeaveBalanceRecord>
  >(() => loadLeaveBalancesMap(currentYear));
  const [isOpeningBalanceModalOpen, setIsOpeningBalanceModalOpen] =
    useState<boolean>(false);

  // Đồng bộ thời gian thực khi thay đổi quy định ở màn hình "Quy định phép năm" hoặc khi Chốt số dư đầu kỳ
  useEffect(() => {
    const handlePolicyChange = (e: Event) => {
      const detail = (e as CustomEvent<LeavePolicyConfig>).detail;
      if (detail) {
        setLeavePolicy(detail);
      } else {
        setLeavePolicy(loadLeavePolicyConfig());
      }
    };
    const handleBalancesChange = () => {
      setLeaveBalancesMap(loadLeaveBalancesMap(currentYear));
      setLeavePolicy(loadLeavePolicyConfig());
    };
    window.addEventListener('hr-leave-policy-change', handlePolicyChange);
    window.addEventListener('hr-leave-balances-change', handleBalancesChange);
    return () => {
      window.removeEventListener('hr-leave-policy-change', handlePolicyChange);
      window.removeEventListener(
        'hr-leave-balances-change',
        handleBalancesChange
      );
    };
  }, [currentYear]);

  const departmentNames = useMemo(() => {
    const names = groups.map((g) => g.name).filter(Boolean);
    return Array.from(new Set(names));
  }, [groups]);

  const handleConfirmOpeningBalanceImport = (
    rows: OpeningBalanceImportRow[]
  ) => {
    const updatedMap = saveLeaveBalancesBatch(
      rows.map((r) => ({
        employeeCode: r.employeeCode,
        employeeId: r.employee.id,
        fullName: r.fullName,
        carried_over: r.carried_over,
        used_leave: r.used_leave,
        cutoffDate: `${currentYear}-10-31`,
      })),
      records,
      currentYear
    );
    setLeaveBalancesMap(updatedMap);
    setLeavePolicy(loadLeavePolicyConfig());
    if (onImportOpeningBalances) {
      onImportOpeningBalances(rows);
    }
  };

  // Tính toán bảng phương trình toán học minh bạch cho từng nhân sự
  const fundRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = sortEmployees(
      employees.filter((emp) => {
        if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) {
          return false;
        }
        if (!q) return true;
        return (
          emp.employeeCode.toLowerCase().includes(q) ||
          emp.fullName.toLowerCase().includes(q) ||
          (emp.department || '').toLowerCase().includes(q)
        );
      }),
      null,
      null
    );

    return filtered.map((emp) => {
      const effectiveEmp: Employee = {
        ...emp,
        standardAnnualLeave:
          defaultAnnualLeaveQuota || emp.standardAnnualLeave || 12,
      };

      const breakdown = calculateLeaveAccrualBreakdown(
        effectiveEmp,
        records,
        currentYear,
        currentMonth,
        leavePolicy,
        defaultAnnualLeaveQuota,
        leaveBalancesMap
      );

      return {
        employee: emp,
        annualQuota: breakdown.annualQuota,
        accruedThisYear: breakdown.accruedLeaveDays,
        carriedOverLastYear: breakdown.carriedOverLeaveDays,
        totalFund: breakdown.totalLeaveFund,
        usedLeave: breakdown.usedAnnualLeaveDays,
        remainingLeave: breakdown.remainingAnnualLeave,
        hasOpeningBalance: breakdown.hasOpeningBalance,
      };
    });
  }, [
    employees,
    records,
    departmentFilter,
    searchQuery,
    leavePolicy,
    leaveBalancesMap,
    defaultAnnualLeaveQuota,
    currentYear,
    currentMonth,
  ]);

  const importedCount = Object.keys(leaveBalancesMap).length;

  return (
    <div className="space-y-3">
      {/* Tiêu đề trang gọn gàng chuẩn ERP */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
            Quỹ phép năm ({currentYear})
          </h1>
          <p className="text-xs text-slate-500">
            Phương trình tự động: <code className="font-mono text-slate-700">Tổng quỹ phép = [Tích lũy năm nay] + [Tồn năm trước]</code> &bull; <code className="font-mono text-[#14539E] font-semibold">Còn lại = [Tổng quỹ phép] - [Đã nghỉ]</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {importedCount > 0 && (
            <span
              data-testid="opening-balance-status-badge"
              className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-[#14539E] font-semibold inline-flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã chốt số dư đầu kỳ (đến 31/10): {importedCount} NV</span>
            </span>
          )}
          <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600">
            Cơ chế:{' '}
            <strong className="text-slate-800">
              {leavePolicy.accrualMode === 'monthly'
                ? `Tích lũy theo tháng (T1-T${currentMonth})`
                : 'Cấp 1 lần đầu năm'}
            </strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600">
            Tổng số:{' '}
            <strong className="font-mono font-bold text-[#14539E]">
              {fundRows.length}
            </strong>{' '}
            nhân sự
          </span>
          <button
            type="button"
            onClick={() => setIsOpeningBalanceModalOpen(true)}
            data-testid="open-opening-balance-modal-btn"
            className="h-8 px-3 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Nhập từ file (Chốt số dư đầu kỳ)</span>
          </button>
        </div>
      </div>

      {/* HÀNG 1: BỘ LỌC (Tìm kiếm & Nhóm/Bộ phận) trên 1 hàng ngang trong Card trắng */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Ô Tìm kiếm (Search input) */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo Mã NV hoặc Họ tên nhân sự..."
              aria-label="Tìm kiếm nhân sự trong quỹ phép năm"
              data-testid="leave-fund-search-input"
              className="w-full h-8 pl-8 pr-8 text-xs bg-white rounded-lg border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown chọn Nhóm/Bộ phận */}
          <div className="w-full sm:w-64 shrink-0">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Lọc theo Nhóm hoặc Bộ phận"
              data-testid="leave-fund-dept-select"
              className="w-full h-8 px-3 text-xs font-medium bg-white rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:border-[#14539E] focus:ring-1 focus:ring-[#14539E] transition-colors cursor-pointer"
            >
              <option value="ALL">Tất cả Nhóm / Bộ phận</option>
              {departmentNames.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Nút đặt lại bộ lọc */}
          {(searchQuery.trim() !== '' || departmentFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDepartmentFilter('ALL');
              }}
              className="h-8 px-3 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* HÀNG 2: BẢNG DỮ LIỆU PHƯƠNG TRÌNH TOÁN HỌC MINH BẠCH (High Density: px-2 py-1.5, border-slate-100) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table
            data-testid="annual-leave-fund-table"
            className="w-full text-left border-collapse text-xs"
          >
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="px-2 py-1.5 border-r border-slate-100 whitespace-nowrap w-24">
                  Mã NV
                </th>
                <th className="px-2 py-1.5 border-r border-slate-100 whitespace-nowrap">
                  Họ tên
                </th>
                <th className="px-2 py-1.5 border-r border-slate-100 whitespace-nowrap">
                  Nhóm
                </th>
                <th className="px-2 py-1.5 border-r border-slate-100 text-right whitespace-nowrap w-28">
                  Định mức/năm
                </th>
                <th className="px-2 py-1.5 border-r border-slate-100 text-right whitespace-nowrap w-32">
                  Tích lũy năm nay
                </th>
                <th className="px-2 py-1.5 border-r border-slate-100 text-right whitespace-nowrap w-28">
                  Tồn năm trước
                </th>
                <th className="px-2 py-1.5 border-r border-slate-100 text-right whitespace-nowrap w-32 text-slate-700 font-bold">
                  Tổng quỹ phép
                </th>
                <th className="px-2 py-1.5 border-r border-slate-100 text-right whitespace-nowrap w-24">
                  Đã nghỉ
                </th>
                <th className="px-2 py-1.5 text-right whitespace-nowrap w-28 text-[#14539E] font-bold">
                  Còn lại
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {fundRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-8 px-4 text-center text-slate-400 text-xs"
                  >
                    Không tìm thấy nhân sự phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                fundRows.map((row) => {
                  const emp = row.employee;
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* 1. Mã NV */}
                      <td className="px-2 py-1.5 border-r border-slate-100 font-mono font-semibold text-slate-700 align-middle whitespace-nowrap">
                        {emp.employeeCode}
                      </td>

                      {/* 2. Họ tên */}
                      <td className="px-2 py-1.5 border-r border-slate-100 font-medium text-slate-800 align-middle whitespace-nowrap">
                        {emp.fullName}
                      </td>

                      {/* 3. Nhóm */}
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-600 align-middle whitespace-nowrap">
                        {emp.department || '-'}
                      </td>

                      {/* 4. Định mức/năm */}
                      <td className="px-2 py-1.5 border-r border-slate-100 text-right font-mono tabular-nums text-slate-600 align-middle whitespace-nowrap">
                        {row.annualQuota}
                      </td>

                      {/* 5. Tích lũy năm nay */}
                      <td className="px-2 py-1.5 border-r border-slate-100 text-right font-mono tabular-nums text-slate-700 align-middle whitespace-nowrap">
                        {row.accruedThisYear}
                      </td>

                      {/* 6. Tồn năm trước */}
                      <td className="px-2 py-1.5 border-r border-slate-100 text-right font-mono tabular-nums text-slate-600 align-middle whitespace-nowrap">
                        {row.carriedOverLastYear}
                      </td>

                      {/* 7. Tổng quỹ phép = [Tích lũy năm nay] + [Tồn năm trước] */}
                      <td className="px-2 py-1.5 border-r border-slate-100 text-right font-mono tabular-nums font-bold text-slate-800 bg-slate-50/50 align-middle whitespace-nowrap">
                        {row.totalFund}
                      </td>

                      {/* 8. Đã nghỉ (Từ đơn Đã duyệt ở màn hình Đơn nghỉ) */}
                      <td className="px-2 py-1.5 border-r border-slate-100 text-right font-mono tabular-nums text-slate-700 align-middle whitespace-nowrap">
                        {row.usedLeave}
                      </td>

                      {/* 9. Còn lại = [Tổng quỹ phép] - [Đã nghỉ] */}
                      <td
                        className={`px-2 py-1.5 text-right font-mono tabular-nums font-bold align-middle whitespace-nowrap ${
                          row.remainingLeave >= 0
                            ? 'text-[#14539E]'
                            : 'text-red-600'
                        }`}
                      >
                        {row.remainingLeave}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Chốt số dư phép đầu kỳ qua file Excel (.xlsx/.csv) */}
      <OpeningBalanceImportModal
        isOpen={isOpeningBalanceModalOpen}
        employees={employees}
        defaultAnnualLeaveQuota={defaultAnnualLeaveQuota}
        currentMonth={currentMonth}
        currentYear={currentYear}
        onClose={() => setIsOpeningBalanceModalOpen(false)}
        onConfirmImport={handleConfirmOpeningBalanceImport}
      />
    </div>
  );
};
