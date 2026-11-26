import React, { useEffect, useMemo, useState } from 'react';
import { Search, RotateCcw, Upload, FileSpreadsheet, Settings } from 'lucide-react';
import {
  CompanyUnit,
  DepartmentGroup,
  Employee,
  LeaveBalanceRecord,
  LeavePolicyConfig,
  LeaveRecord,
} from '../../types/hr';
import {
  calculateLeaveAccrualBreakdown,
  calculateSeniorityText,
  calculateTotalQuota,
  formatDateVN,
  loadLeaveBalancesMap,
  loadLeavePolicyConfig,
  saveLeaveBalancesBatch,
  sortEmployees,
} from '../../utils/hrCalculations';
import {
  exportAnnualLeaveFundToExcel,
  OpeningBalanceImportRow,
} from '../../utils/exportUtils';
import { formatNumberVN } from '../../utils/errorAndSecurityService';
import { OpeningBalanceImportModal } from './OpeningBalanceImportModal';
import { AnnualLeaveRulesModal } from './AnnualLeaveRulesModal';

interface AnnualLeaveFundViewProps {
  employees: Employee[];
  records: LeaveRecord[];
  groups: DepartmentGroup[];
  companyUnits?: CompanyUnit[];
  activeCompanyId?: string;
  defaultAnnualLeaveQuota?: number;
  isAdmin?: boolean;
  onUpdateEmployeeQuota?: (employee: Employee, newQuota: number) => void;
  onUpdateCompanyQuota?: (companyId: string, newQuota: number) => void;
  onChangeDefaultAnnualLeaveQuota?: (newQuota: number) => void;
  onImportOpeningBalances?: (rows: OpeningBalanceImportRow[]) => void;
}

export const AnnualLeaveFundView: React.FC<AnnualLeaveFundViewProps> = ({
  employees,
  records,
  groups,
  companyUnits = [],
  activeCompanyId,
  defaultAnnualLeaveQuota = 12,
  onUpdateCompanyQuota,
  onChangeDefaultAnnualLeaveQuota,
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
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);

  // Đồng bộ thời gian thực khi thay đổi quy định ở modal "Quy định phép năm" hoặc khi Chốt số dư đầu kỳ
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
      const baseQuota = defaultAnnualLeaveQuota || emp.standardAnnualLeave || 12;
      const effectiveJoinDate = emp.join_date || emp.joinDate || '';
      const effectiveEmp: Employee = {
        ...emp,
        joinDate: effectiveJoinDate,
        join_date: effectiveJoinDate,
        standardAnnualLeave: baseQuota,
      };

      const breakdown = calculateLeaveAccrualBreakdown(
        effectiveEmp,
        records,
        currentYear,
        currentMonth,
        leavePolicy,
        baseQuota,
        leaveBalancesMap
      );

      const joinDateFormatted = formatDateVN(effectiveJoinDate) || '-';
      const seniorityText =
        breakdown.seniorityText || calculateSeniorityText(effectiveJoinDate);
      const totalQuota =
        breakdown.annualQuota || calculateTotalQuota(effectiveJoinDate, baseQuota);

      return {
        employee: effectiveEmp,
        joinDateFormatted,
        seniorityText,
        baseQuota: breakdown.baseQuota,
        bonusLeave: breakdown.bonusLeave,
        annualQuota: totalQuota,
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

  const fmtZero = (val: number) => formatNumberVN(val, true);

  return (
    <div className="space-y-3">
      {/* Tiêu đề trang & Cụm 3 nút hành động căn phải */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Góc trái: Tiêu đề + Dòng phụ Tổng số nhân sự */}
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
            Quỹ phép năm ({currentYear})
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tổng số: <strong className="font-semibold text-slate-700">{formatNumberVN(fundRows.length)}</strong> nhân sự
          </p>
        </div>

        {/* Góc phải: 3 nút thao tác xếp cạnh nhau */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Nút Quy định phép năm (Gear / Settings icon, outline button) */}
          <button
            type="button"
            onClick={() => setIsRulesModalOpen(true)}
            data-testid="open-rules-modal-btn"
            className="h-8 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Quy định phép năm</span>
          </button>

          {/* 2. Nút Nhập từ file (Upload icon, outline button) */}
          <button
            type="button"
            onClick={() => setIsOpeningBalanceModalOpen(true)}
            data-testid="open-opening-balance-modal-btn"
            className="h-8 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Nhập từ file</span>
          </button>

          {/* 3. Nút Xuất file (Excel icon, brand blue #14539E button) */}
          <button
            type="button"
            onClick={() => {
              exportAnnualLeaveFundToExcel(fundRows, currentYear);
            }}
            data-testid="export-leave-fund-excel-btn"
            className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-blue-600 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất file</span>
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
                <Search className="w-3.5 h-3.5" />
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

      {/* HÀNG 2: BẢNG DỮ LIỆU PHƯƠNG TRÌNH TOÁN HỌC MINH BẠCH (Zero-Noise: 0 -> "-") */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-auto relative">
          <table
            data-testid="annual-leave-fund-table"
            className="w-full text-left border-collapse text-xs"
          >
            <thead className="sticky top-0 z-20 bg-slate-50 shadow-2xs">
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="px-2 py-1.5 border-r border-slate-200 whitespace-nowrap w-24">
                  Mã NV
                </th>
                <th className="px-2 py-1.5 border-r border-slate-200 whitespace-nowrap">
                  Họ tên
                </th>
                <th className="px-2 py-1.5 border-r border-slate-200 whitespace-nowrap">
                  Nhóm
                </th>
                <th className="px-2 py-1.5 border-r border-slate-200 text-center whitespace-nowrap w-28">
                  Ngày vào làm
                </th>
                <th className="px-2 py-1.5 border-r border-slate-200 text-center whitespace-nowrap w-32">
                  Thâm niên
                </th>
                <th className="px-2 py-1.5 border-r border-slate-200 text-right whitespace-nowrap w-28">
                  Định mức/năm
                </th>
                <th className="px-2 py-1.5 border-r border-slate-200 text-right whitespace-nowrap w-32">
                  Tích lũy năm nay
                </th>
                <th className="px-2 py-1.5 border-r border-slate-200 text-right whitespace-nowrap w-28">
                  Tồn năm trước
                </th>
                <th className="px-2 py-1.5 border-r border-slate-200 text-right whitespace-nowrap w-32 text-slate-700 font-bold">
                  Tổng quỹ phép
                </th>
                <th className="px-2 py-1.5 border-r border-slate-200 text-right whitespace-nowrap w-24">
                  Đã nghỉ
                </th>
                <th className="px-2 py-1.5 text-right whitespace-nowrap w-28 text-[#14539E] font-bold">
                  Còn lại
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {fundRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="py-8 px-4 text-center text-slate-400 text-xs"
                  >
                    Không tìm thấy nhân sự phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                fundRows.map((row) => {
                  const emp = row.employee;
                  const bonusTooltip =
                    row.bonusLeave > 0
                      ? `${row.baseQuota} ngày cơ bản + ${row.bonusLeave} ngày thâm niên`
                      : undefined;
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* 1. Mã NV */}
                      <td className="px-2 py-1.5 border-r border-slate-200 font-mono font-semibold text-slate-700 align-middle whitespace-nowrap">
                        {emp.employeeCode}
                      </td>

                      {/* 2. Họ tên */}
                      <td className="px-2 py-1.5 border-r border-slate-200 font-medium text-slate-800 align-middle whitespace-nowrap">
                        {emp.fullName}
                      </td>

                      {/* 3. Nhóm */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-slate-600 align-middle whitespace-nowrap">
                        {emp.department || '-'}
                      </td>

                      {/* 4. Ngày vào làm (DD/MM/YYYY) */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 align-middle whitespace-nowrap">
                        {row.joinDateFormatted}
                      </td>

                      {/* 5. Thâm niên */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-center text-slate-600 align-middle whitespace-nowrap">
                        {row.seniorityText}
                      </td>

                      {/* 6. Định mức/năm (kèm Tooltip giải thích nếu > 12) */}
                      <td
                        title={bonusTooltip}
                        className="px-2 py-1.5 border-r border-slate-200 text-right font-mono tabular-nums text-slate-600 align-middle whitespace-nowrap relative group"
                      >
                        {row.bonusLeave > 0 ? (
                          <span className="inline-flex items-center justify-end gap-1 font-semibold text-[#14539E] cursor-help underline decoration-dotted underline-offset-2">
                            {fmtZero(row.annualQuota)}
                            <span
                              role="tooltip"
                              className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full right-2 mb-1 z-20 px-2 py-1 rounded bg-slate-800 text-white text-[11px] font-sans font-medium whitespace-nowrap shadow-md"
                            >
                              {bonusTooltip}
                            </span>
                          </span>
                        ) : (
                          fmtZero(row.annualQuota)
                        )}
                      </td>

                      {/* 7. Tích lũy năm nay */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-right font-mono tabular-nums text-slate-700 align-middle whitespace-nowrap">
                        {fmtZero(row.accruedThisYear)}
                      </td>

                      {/* 8. Tồn năm trước */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-right font-mono tabular-nums text-slate-600 align-middle whitespace-nowrap">
                        {fmtZero(row.carriedOverLastYear)}
                      </td>

                      {/* 9. Tổng quỹ phép = [Tích lũy năm nay] + [Tồn năm trước] */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-right font-mono tabular-nums font-bold text-slate-800 bg-slate-50/50 align-middle whitespace-nowrap">
                        {fmtZero(row.totalFund)}
                      </td>

                      {/* 10. Đã nghỉ */}
                      <td className="px-2 py-1.5 border-r border-slate-200 text-right font-mono tabular-nums text-slate-700 align-middle whitespace-nowrap">
                        {fmtZero(row.usedLeave)}
                      </td>

                      {/* 11. Còn lại = [Tổng quỹ phép] - [Đã nghỉ] */}
                      <td
                        className={`px-2 py-1.5 text-right font-mono tabular-nums font-bold align-middle whitespace-nowrap ${
                          row.remainingLeave >= 0
                            ? 'text-[#14539E]'
                            : 'text-red-600'
                        }`}
                      >
                        {fmtZero(row.remainingLeave)}
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
        records={records}
        defaultAnnualLeaveQuota={defaultAnnualLeaveQuota}
        currentMonth={currentMonth}
        currentYear={currentYear}
        onClose={() => setIsOpeningBalanceModalOpen(false)}
        onConfirmImport={handleConfirmOpeningBalanceImport}
      />

      {/* Modal Quy định phép năm */}
      <AnnualLeaveRulesModal
        isOpen={isRulesModalOpen}
        companyUnits={companyUnits}
        activeCompanyId={activeCompanyId}
        defaultAnnualLeaveQuota={defaultAnnualLeaveQuota}
        isAdmin={true}
        onClose={() => setIsRulesModalOpen(false)}
        onUpdateCompanyQuota={onUpdateCompanyQuota || (() => {})}
        onChangeDefaultAnnualLeaveQuota={onChangeDefaultAnnualLeaveQuota}
      />
    </div>
  );
};
