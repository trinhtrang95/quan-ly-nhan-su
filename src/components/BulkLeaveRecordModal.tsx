import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Search,
  Check,
  Users,
  Copy,
  ChevronDown,
} from 'lucide-react';
import {
  DepartmentGroup,
  Employee,
  LeaveRecord,
  LeaveRecordType,
  RegimeSubtype,
  UserAccount,
} from '../types/hr';
import {
  calculateAnnualMatrixReport,
  formatDateVN,
  sortEmployees,
} from '../utils/hrCalculations';

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

/**
 * Tự động tính ngày kết thúc (endDate) dựa trên Ngày áp dụng chung (startDate) và Số ngày nghỉ (days):
 * - Nếu days = 1 (hoặc 0.5) => endDate = startDate (cùng ngày)
 * - Nếu days = 2 => endDate = startDate + 1 ngày
 * - Nếu days = 3 => endDate = startDate + 2 ngày
 */
function computeEndDateFromStartAndDays(startDateIso: string, days: number): string {
  if (!startDateIso) return startDateIso;
  const parts = startDateIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return startDateIso;

  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return startDateIso;

  const extraDays = Math.max(0, Math.ceil(Number(days) || 1) - 1);
  d.setDate(d.getDate() + extraDays);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

export const BulkLeaveRecordModal: React.FC<BulkLeaveRecordModalProps> = ({
  isOpen,
  employees,
  leaveRecords,
  currentUser,
  defaultYear,
  onClose,
  onSaveBulk,
}) => {
  const [activeTab, setActiveTab] = useState<'leave' | 'late'>('leave');
  const [commonDate, setCommonDate] = useState<string>(() => getTodayIsoString());

  // Combobox tìm kiếm thông minh duy nhất
  const [comboQuery, setComboQuery] = useState<string>('');
  const [isComboOpen, setIsComboOpen] = useState<boolean>(false);
  const comboContainerRef = useRef<HTMLDivElement>(null);

  // Danh sách nhân sự được chọn ban đầu luôn trống hoàn toàn
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

  // Đóng dropdown Combobox khi bấm ra ngoài
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        comboContainerRef.current &&
        !comboContainerRef.current.contains(e.target as Node)
      ) {
        setIsComboOpen(false);
      }
    };
    if (isComboOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isComboOpen]);

  // Khi vừa mở Modal lên, danh sách nhân sự tích chọn ban đầu trống hoàn toàn
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('leave');
    setCommonDate(getTodayIsoString());
    setComboQuery('');
    setIsComboOpen(false);
    setSelectedEmpIds([]);
    setRowConfigs({});
    setErrorMsg('');
  }, [isOpen]);

  if (!isOpen) return null;

  const comboboxFilteredEmployees = sortedEmployees.filter((e) => {
    const q = comboQuery.trim().toLowerCase();
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
      setErrorMsg('Vui lòng tìm và tích chọn ít nhất 1 nhân sự để ghi nhận hàng loạt.');
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

      if (recordAmount <= 0 || isNaN(recordAmount)) {
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

      const computedEndDate =
        activeTab === 'leave'
          ? computeEndDateFromStartAndDays(commonDate, recordAmount)
          : commonDate;

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
        endDate: computedEndDate,
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
        )}) đều đã có bản ghi cùng loại trong ngày ${formatDateVN(commonDate)}.`
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

            {/* 1. THANH CHUYỂN ĐỔI 2 TAB LỚN TRÊN CÙNG */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('leave');
                  setErrorMsg('');
                }}
                className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
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
                className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'late'
                    ? 'bg-[#0F232E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>⏰ Đi muộn Hàng loạt</span>
              </button>
            </div>

            {/* 2. THANH COMBOBOX TÌM KIẾM THÔNG MINH DUY NHẤT + NGÀY ÁP DỤNG CHUNG (NẰM NGAY DƯỚI 2 TAB LỚN) */}
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 flex flex-col sm:flex-row sm:items-end gap-2.5">
              {/* Ô Combobox tìm kiếm thông minh duy nhất giống hệt nút Ghi nhận mới */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="bulk-emp-combobox"
                    className="text-xs font-bold text-slate-800"
                  >
                    Tìm &amp; chọn nhân sự áp dụng <span className="text-red-500">*</span>
                  </label>
                  {selectedEmpIds.length > 0 && (
                    <span className="text-[11px] font-bold text-[#0F766E] bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                      Đã chọn: {selectedEmpIds.length} nhân sự
                    </span>
                  )}
                </div>

                <div ref={comboContainerRef} className="relative">
                  <div
                    onClick={() => setIsComboOpen(true)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white focus-within:bg-white focus-within:border-[#0D9488] transition-colors cursor-text"
                  >
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      id="bulk-emp-combobox"
                      type="text"
                      value={comboQuery}
                      onFocus={() => setIsComboOpen(true)}
                      onChange={(e) => {
                        setComboQuery(e.target.value);
                        setIsComboOpen(true);
                      }}
                      placeholder="Gõ Mã NV hoặc Họ và tên để tìm & tích chọn nhân sự xuống bảng..."
                      aria-label="Tìm và tích chọn nhân sự hàng loạt"
                      className="w-full text-xs font-semibold text-slate-800 bg-transparent outline-none"
                    />
                    {comboQuery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setComboQuery('');
                        }}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        aria-label="Xóa từ khóa tìm kiếm"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>

                  {isComboOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto z-40 divide-y divide-slate-100">
                      {comboboxFilteredEmployees.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs text-slate-400 text-center">
                          Không tìm thấy nhân sự phù hợp
                        </div>
                      ) : (
                        comboboxFilteredEmployees.map((emp) => {
                          const isSelected = selectedEmpIds.includes(emp.id);
                          const rem =
                            remainingLeaveMap.get(emp.id) ??
                            emp.standardAnnualLeave;
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                handleToggleEmployee(emp);
                                setComboQuery('');
                              }}
                              className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 hover:bg-teal-50/70 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-teal-50/90 font-bold text-[#0F766E]'
                                  : 'text-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                    isSelected
                                      ? 'bg-[#0D9488] border-[#0D9488] text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3" />}
                                </span>
                                <div className="truncate">
                                  <span className="font-mono font-bold text-slate-700">
                                    {emp.employeeCode}
                                  </span>{' '}
                                  — <span className="font-bold">{emp.fullName}</span>{' '}
                                  <span className="text-slate-500">
                                    ({emp.department || 'Chưa phân nhóm'})
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                                  rem > 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-red-50 text-red-600'
                                }`}
                              >
                                Tồn: {rem} ngày
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Ô chọn Ngày áp dụng chung */}
              <div className="sm:w-48 shrink-0 space-y-1">
                <label
                  htmlFor="bulk-common-date"
                  className="block text-xs font-bold text-slate-800 whitespace-nowrap"
                >
                  Ngày áp dụng chung <span className="text-red-500">*</span>
                </label>
                <input
                  id="bulk-common-date"
                  type="date"
                  required
                  value={commonDate}
                  onChange={(e) => setCommonDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50/60 hover:bg-white focus:bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#0D9488]"
                />
              </div>
            </div>

            {/* 3. BẢNG ĐIỀU CHỈNH TỪNG NGƯỜI */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              {selectedEmpIds.length === 0 ? (
                <div className="py-10 px-4 text-center text-xs text-slate-400 bg-slate-50/40">
                  Danh sách đang trống. Hãy gõ tên hoặc mã nhân viên vào ô tìm kiếm phía trên để chọn nhân sự cần ghi nhận.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full table-auto text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#0F232E] text-white text-[10px] font-bold uppercase tracking-wider z-10">
                      <tr>
                        <th className="py-2 px-3 whitespace-nowrap">
                          NHÂN SỰ &amp; TỒN PHÉP
                        </th>
                        {activeTab === 'leave' && (
                          <th className="py-2 px-2.5 whitespace-nowrap w-36">
                            LOẠI NGHỈ
                          </th>
                        )}
                        <th className="py-2 px-2.5 whitespace-nowrap w-44">
                          {activeTab === 'leave' ? 'SỐ LƯỢNG (NGÀY)' : 'SỐ LƯỢNG (GIỜ)'}
                        </th>
                        <th className="py-2 px-2.5 w-full min-w-[200px] whitespace-nowrap">
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
                        const computedEndDate = computeEndDateFromStartAndDays(
                          commonDate,
                          cfg.leaveAmount
                        );

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
                                    {emp.employeeCode} • {emp.department || 'Chưa phân bộ phận'}
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

                            {/* Cột 3: SỐ LƯỢNG (Ô input số gọn gàng + Tự động tính khoảng ngày nghỉ) */}
                            <td className="py-2 px-2.5 align-middle whitespace-nowrap">
                              {activeTab === 'leave' ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
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
                                      aria-label={`Số ngày nghỉ của ${emp.fullName}`}
                                      className="w-16 px-2 py-1 text-xs font-mono font-bold text-center rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#0D9488]"
                                    />
                                    <span className="text-xs font-semibold text-slate-600">
                                      ngày
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    {computedEndDate === commonDate ? (
                                      <span>Ngày {formatDateVN(commonDate)}</span>
                                    ) : (
                                      <span className="text-[#0F766E] font-semibold">
                                        {formatDateVN(commonDate)} → {formatDateVN(computedEndDate)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
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
                                    aria-label={`Số giờ đi muộn của ${emp.fullName}`}
                                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-center rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#0D9488]"
                                  />
                                  <span className="text-xs font-semibold text-slate-600">
                                    giờ
                                  </span>
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
