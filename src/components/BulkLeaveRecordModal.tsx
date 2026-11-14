import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Check,
  Users,
  Copy,
} from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
  LeaveRecord,
  LeaveRecordType,
  RegimeSubtype,
  UserAccount,
} from '../types/hr';
import { calculateAnnualMatrixReport, sortEmployees } from '../utils/hrCalculations';

interface BulkLeaveRecordModalProps {
  isOpen: boolean;
  employees: Employee[];
  groups?: DepartmentGroup[];
  leaveRecords: LeaveRecord[];
  currentUser?: UserAccount | null;
  defaultYear?: number;
  onClose: () => void;
  onSaveBulk: (recordsData: Omit<LeaveRecord, 'id'>[]) => void;
}

interface BulkRowConfig {
  leaveType: 'annual_leave' | 'unpaid_leave' | 'regime_leave';
  regimeSubtype: RegimeSubtype;
  leaveAmount: number;
  lateHours: number;
  reason: string;
}

function getTodayIsoString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const PRIORITY_DEPT_FILTERS = [
  'Quản lý chung',
  'JIG/AUTO 2',
  'ME',
  'AUTO 1',
  'PE',
  'ST',
  'DOCUMENT',
  'IOT',
];

export const BulkLeaveRecordModal: React.FC<BulkLeaveRecordModalProps> = ({
  isOpen,
  employees,
  groups = [],
  leaveRecords,
  currentUser,
  defaultYear,
  onClose,
  onSaveBulk,
}) => {
  const [activeTab, setActiveTab] = useState<'leave' | 'late'>('leave');
  const [commonDate, setCommonDate] = useState<string>(() => getTodayIsoString());

  const [bulkSearch, setBulkSearch] = useState<string>('');
  const [bulkDeptFilter, setBulkDeptFilter] = useState<string>('ALL');
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [rowConfigs, setRowConfigs] = useState<Record<string, BulkRowConfig>>({});
  const [errorMsg, setErrorMsg] = useState<string>('');

  const targetYear =
    defaultYear || new Date(commonDate || Date.now()).getFullYear() || 2026;

  const remainingLeaveMap = useMemo(() => {
    const map = new Map<string, number>();
    if (employees.length === 0) return map;
    const rows = calculateAnnualMatrixReport(employees, leaveRecords, targetYear);
    for (const r of rows) {
      map.set(r.employee.id, r.remainingAnnualLeave);
    }
    return map;
  }, [employees, leaveRecords, targetYear]);

  const sortedEmployees = useMemo(() => {
    return sortEmployees(employees, null, null);
  }, [employees]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('leave');
    setCommonDate(getTodayIsoString());
    setBulkSearch('');
    setBulkDeptFilter('ALL');
    setSelectedEmpIds([]);
    setRowConfigs({});
    setErrorMsg('');
  }, [isOpen]);

  if (!isOpen) return null;

  const departmentFilterOptions = (() => {
    const set = new Set<string>();
    PRIORITY_DEPT_FILTERS.forEach((d) => set.add(d));
    groups.forEach((g) => {
      if (g.name) set.add(g.name);
    });
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  })();

  const filteredEmployees = sortedEmployees.filter((e) => {
    if (bulkDeptFilter !== 'ALL' && e.department !== bulkDeptFilter) {
      return false;
    }
    const q = bulkSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      e.fullName.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q)
    );
  });

  const createDefaultConfigForEmp = (emp: Employee): BulkRowConfig => {
    const rem = remainingLeaveMap.get(emp.id) ?? emp.standardAnnualLeave;
    return {
      leaveType: rem > 0 ? 'annual_leave' : 'unpaid_leave',
      regimeSubtype: 'Ốm đau / Viện phí',
      leaveAmount: 1,
      lateHours: 1,
      reason: '',
    };
  };

  const handleToggleEmployee = (emp: Employee) => {
    setErrorMsg('');
    setSelectedEmpIds((prev) => {
      if (prev.includes(emp.id)) {
        return prev.filter((id) => id !== emp.id);
      }
      return [...prev, emp.id];
    });

    setRowConfigs((prev) => {
      if (prev[emp.id]) return prev;
      return {
        ...prev,
        [emp.id]: createDefaultConfigForEmp(emp),
      };
    });
  };

  const handleSelectAllFiltered = () => {
    setErrorMsg('');
    const filteredIds = filteredEmployees.map((e) => e.id);
    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedEmpIds.includes(id));

    if (allSelected) {
      setSelectedEmpIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedEmpIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
      setRowConfigs((prev) => {
        const next = { ...prev };
        for (const emp of filteredEmployees) {
          if (!next[emp.id]) {
            next[emp.id] = createDefaultConfigForEmp(emp);
          }
        }
        return next;
      });
    }
  };

  const updateRowConfig = (empId: string, patch: Partial<BulkRowConfig>) => {
    setRowConfigs((prev) => {
      const emp = employees.find((e) => e.id === empId);
      const existing =
        prev[empId] ||
        (emp
          ? createDefaultConfigForEmp(emp)
          : {
              leaveType: 'annual_leave',
              regimeSubtype: 'Ốm đau / Viện phí',
              leaveAmount: 1,
              lateHours: 1,
              reason: '',
            });
      return {
        ...prev,
        [empId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  const handleCopyFirstReasonToAll = () => {
    if (selectedEmpIds.length === 0) return;
    const firstId = selectedEmpIds[0];
    const firstReason = rowConfigs[firstId]?.reason || '';
    setRowConfigs((prev) => {
      const next = { ...prev };
      for (const id of selectedEmpIds) {
        if (next[id]) {
          next[id] = { ...next[id], reason: firstReason };
        }
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (selectedEmpIds.length === 0) {
      setErrorMsg('Vui lòng tích chọn ít nhất 1 nhân sự để ghi nhận hàng loạt.');
      return;
    }

    const approverName =
      currentUser?.fullName?.trim() ||
      currentUser?.username?.trim() ||
      'Quản trị viên';
    const createdAtToday = new Date().toISOString().slice(0, 10);

    const existingSigSet = new Set(
      leaveRecords.map((r) => `${r.employeeId}|${r.type}|${r.startDate}`)
    );

    const recordsToInsert: Omit<LeaveRecord, 'id'>[] = [];
    const duplicateNames: string[] = [];

    for (const empId of selectedEmpIds) {
      const emp = employees.find((item) => item.id === empId);
      const cfg =
        rowConfigs[empId] ||
        (emp
          ? createDefaultConfigForEmp(emp)
          : {
              leaveType: 'annual_leave',
              regimeSubtype: 'Ốm đau / Viện phí',
              leaveAmount: 1,
              lateHours: 1,
              reason: '',
            });

      const recordType: LeaveRecordType =
        activeTab === 'late' ? 'late_early' : cfg.leaveType;
      const recordAmount =
        activeTab === 'late' ? Number(cfg.lateHours) : Number(cfg.leaveAmount);

      if (recordAmount <= 0) {
        setErrorMsg(
          `Số lượng của nhân sự ${emp?.fullName || ''} phải lớn hơn 0.`
        );
        return;
      }

      const sig = `${empId}|${recordType}|${commonDate}`;
      if (existingSigSet.has(sig)) {
        duplicateNames.push(emp?.fullName || empId);
        continue;
      }

      const defaultReason =
        activeTab === 'late'
          ? 'Đi muộn có báo cáo quản lý bộ phận'
          : 'Xin nghỉ phép giải quyết việc cá nhân';

      recordsToInsert.push({
        employeeId: empId,
        type: recordType,
        regimeSubtype:
          recordType === 'regime_leave' ? cfg.regimeSubtype : undefined,
        startDate: commonDate,
        endDate: commonDate,
        amount: recordAmount,
        reason: (cfg.reason || '').trim() || defaultReason,
        paperStatus: 'Chưa có',
        createdAt: createdAtToday,
        approvedBy: approverName,
      });
    }

    if (recordsToInsert.length === 0 && duplicateNames.length > 0) {
      setErrorMsg(
        `Chống trùng lặp: Tất cả nhân sự đã chọn (${duplicateNames.join(
          ', '
        )}) đều đã có bản ghi cùng loại trong ngày ${commonDate}.`
      );
      return;
    }

    onSaveBulk(recordsToInsert);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-leave-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="bg-[#0F232E] text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#2DD4BF]" />
            <h3
              id="bulk-leave-modal-title"
              className="text-sm font-bold tracking-wide"
            >
              Ghi nhận Hàng loạt (Nhiều nhân sự)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ ghi nhận hàng loạt"
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-3.5 space-y-2.5 overflow-y-auto flex-1 flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            {errorMsg && (
              <div className="px-3 py-1.5 rounded-lg bg-[#FEF2F2] border border-red-200 text-xs font-semibold text-[#EF4444]">
                {errorMsg}
              </div>
            )}

            {/* 1. THANH TRÊN CÙNG: 2 TAB (NGHỈ PHÉP HÀNG LOẠT | ĐI MUỘN HÀNG LOẠT) + NGÀY ÁP DỤNG CHUNG */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 p-1 rounded-lg flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('leave');
                    setErrorMsg('');
                  }}
                  className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'leave'
                      ? 'bg-[#0F232E] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>📅 Nghỉ phép Hàng loạt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('late');
                    setErrorMsg('');
                  }}
                  className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'late'
                      ? 'bg-[#0F232E] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>⏰ Đi muộn Hàng loạt</span>
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label
                  htmlFor="bulk-common-date"
                  className="text-xs font-bold text-slate-700 whitespace-nowrap"
                >
                  Ngày áp dụng chung:
                </label>
                <input
                  id="bulk-common-date"
                  type="date"
                  required
                  value={commonDate}
                  onChange={(e) => setCommonDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-mono font-bold bg-white rounded-lg border border-slate-300 focus:outline-none focus:border-[#0D9488]"
                />
              </div>
            </div>

            {/* 2. KHỐI CHỌN NHANH NHÂN SỰ */}
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative sm:w-52 shrink-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                    placeholder="Tìm Mã NV / Họ tên..."
                    className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 flex-1">
                  <button
                    type="button"
                    onClick={() => setBulkDeptFilter('ALL')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold shrink-0 border transition-colors cursor-pointer ${
                      bulkDeptFilter === 'ALL'
                        ? 'bg-[#0F232E] text-white border-[#0F232E]'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70'
                    }`}
                  >
                    Tất cả
                  </button>
                  {departmentFilterOptions.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setBulkDeptFilter(dept)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold shrink-0 border transition-colors cursor-pointer ${
                        bulkDeptFilter === dept
                          ? 'bg-[#0D9488] text-white border-[#0D9488]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-teal-50'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold text-[#0F766E] bg-teal-50 hover:bg-teal-100 border border-teal-200 shrink-0 cursor-pointer"
                >
                  {filteredEmployees.length > 0 &&
                  filteredEmployees.every((e) => selectedEmpIds.includes(e.id))
                    ? 'Bỏ chọn nhóm'
                    : 'Chọn cả nhóm'}
                </button>
              </div>

              {/* Danh sách nhân sự dạng chip */}
              <div className="max-h-28 overflow-y-auto p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {filteredEmployees.map((emp) => {
                  const checked = selectedEmpIds.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleToggleEmployee(emp)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-left text-[11px] transition-all cursor-pointer ${
                        checked
                          ? 'bg-teal-50 border-[#0D9488] text-[#0F766E] font-bold shadow-2xs'
                          : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-100/70'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                          checked
                            ? 'bg-[#0D9488] border-[#0D9488] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5" />}
                      </span>
                      <span
                        className="truncate"
                        title={`${emp.employeeCode} - ${emp.fullName} (${emp.department || ''})`}
                      >
                        {emp.fullName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. BẢNG ĐIỀU CHỈNH TỪNG NGƯỜI (SIÊU GỌN 3-4 CỘT, BỎ CỘT GIẤY PHÉP & ẢNH) */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              {selectedEmpIds.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/40">
                  Hãy bấm tích chọn nhân sự ở danh sách phía trên để nhập hàng loạt.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#0F232E] text-white text-[10px] font-bold uppercase tracking-wider z-10">
                      <tr>
                        <th className="py-2 px-3 whitespace-nowrap">
                          NHÂN SỰ &amp; TỒN PHÉP
                        </th>
                        {activeTab === 'leave' && (
                          <th className="py-2 px-2.5 whitespace-nowrap w-40">
                            LOẠI NGHỈ
                          </th>
                        )}
                        <th className="py-2 px-2.5 whitespace-nowrap w-52">
                          SỐ LƯỢNG
                        </th>
                        <th className="py-2 px-2.5 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <span>LÝ DO / GHI CHÚ</span>
                            {selectedEmpIds.length > 1 && (
                              <button
                                type="button"
                                onClick={handleCopyFirstReasonToAll}
                                title="Sao chép lý do của dòng đầu tiên cho tất cả nhân sự bên dưới"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 text-[10px] font-semibold normal-case tracking-normal cursor-pointer transition-colors"
                              >
                                <Copy className="w-2.5 h-2.5" />
                                <span>Sao chép lý do dòng đầu cho tất cả</span>
                              </button>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedEmpIds.map((empId) => {
                        const emp = employees.find((e) => e.id === empId);
                        if (!emp) return null;
                        const rem =
                          remainingLeaveMap.get(empId) ?? emp.standardAnnualLeave;
                        const cfg =
                          rowConfigs[empId] || createDefaultConfigForEmp(emp);

                        return (
                          <tr
                            key={empId}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            {/* Cột 1: NHÂN SỰ & TỒN PHÉP */}
                            <td className="py-2 px-3 align-middle whitespace-nowrap">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">
                                    {emp.fullName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-medium">
                                    {emp.department || 'Chưa phân bộ phận'}
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 border ${
                                    rem > 0
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-red-50 text-red-600 border-red-200'
                                  }`}
                                >
                                  Tồn: {rem} ngày phép
                                </span>
                              </div>
                            </td>

                            {/* Cột 2: LOẠI NGHỈ (Chỉ hiện ở Tab Nghỉ phép) */}
                            {activeTab === 'leave' && (
                              <td className="py-2 px-2.5 align-middle whitespace-nowrap">
                                <select
                                  value={cfg.leaveType}
                                  onChange={(e) =>
                                    updateRowConfig(empId, {
                                      leaveType: e.target.value as
                                        | 'annual_leave'
                                        | 'unpaid_leave'
                                        | 'regime_leave',
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:border-[#0D9488] text-slate-800 cursor-pointer"
                                >
                                  <option value="annual_leave">Phép năm</option>
                                  <option value="unpaid_leave">Không lương</option>
                                  <option value="regime_leave">Chế độ</option>
                                </select>
                              </td>
                            )}

                            {/* Cột 3: SỐ LƯỢNG */}
                            <td className="py-2 px-2.5 align-middle whitespace-nowrap">
                              {activeTab === 'leave' ? (
                                <div className="flex items-center gap-1">
                                  {[1, 0.5].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() =>
                                        updateRowConfig(empId, {
                                          leaveAmount: preset,
                                        })
                                      }
                                      className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                                        cfg.leaveAmount === preset
                                          ? 'bg-[#0D9488] text-white border-[#0D9488]'
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-teal-50'
                                      }`}
                                    >
                                      {preset} ngày
                                    </button>
                                  ))}
                                  <input
                                    type="number"
                                    min={0.5}
                                    max={180}
                                    step={0.5}
                                    value={cfg.leaveAmount}
                                    onChange={(e) =>
                                      updateRowConfig(empId, {
                                        leaveAmount: Number(e.target.value),
                                      })
                                    }
                                    className="w-14 px-1.5 py-1 text-xs font-mono font-bold text-center rounded-md border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  {[0.5, 1, 1.5, 2].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() =>
                                        updateRowConfig(empId, {
                                          lateHours: preset,
                                        })
                                      }
                                      className={`px-1.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                                        cfg.lateHours === preset
                                          ? 'bg-amber-600 text-white border-amber-600'
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
                                      }`}
                                    >
                                      {preset}h
                                    </button>
                                  ))}
                                  <input
                                    type="number"
                                    min={0.25}
                                    max={8}
                                    step={0.25}
                                    value={cfg.lateHours}
                                    onChange={(e) =>
                                      updateRowConfig(empId, {
                                        lateHours: Number(e.target.value),
                                      })
                                    }
                                    className="w-14 px-1.5 py-1 text-xs font-mono font-bold text-center rounded-md border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                                  />
                                </div>
                              )}
                            </td>

                            {/* Cột 4: LÝ DO / GHI CHÚ + Nút ✕ bỏ nhân sự */}
                            <td className="py-2 px-2.5 align-middle">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={cfg.reason}
                                  onChange={(e) =>
                                    updateRowConfig(empId, {
                                      reason: e.target.value,
                                    })
                                  }
                                  placeholder={
                                    activeTab === 'late'
                                      ? 'Nhập lý do đi muộn (VD: Hỏng xe, tắc đường...)'
                                      : 'Nhập lý do xin nghỉ phép...'
                                  }
                                  className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#0D9488]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleToggleEmployee(emp)}
                                  title="Bỏ nhân sự này khỏi danh sách"
                                  aria-label={`Bỏ ${emp.fullName} khỏi danh sách`}
                                  className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div className="text-[11px] text-slate-500">
              Mặc định tự động gán trạng thái Giấy phép:{' '}
              <strong className="text-red-600">Chưa có</strong> (có thể bấm 1 chạm trên bảng để đổi sau)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>✓ Lưu hàng loạt ({selectedEmpIds.length} nhân sự)</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
