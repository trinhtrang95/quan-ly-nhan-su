import React, { useMemo } from 'react';
import {
  X,
  Pencil,
  Calendar,
  Phone,
  CreditCard,
  MapPin,
  Clock,
  Eye,
  Briefcase,
  User,
  FileCheck2,
} from 'lucide-react';
import { Employee, LeaveRecord, WorkStatus } from '../types/hr';
import {
  calculateAnnualMatrixReport,
  formatDateVN,
  LEAVE_TYPE_META,
} from '../utils/hrCalculations';

interface EmployeeProfileDrawerProps {
  employee: Employee | null;
  records: LeaveRecord[];
  isAdmin?: boolean;
  onClose: () => void;
  onEditEmployee: (emp: Employee) => void;
  onInspectAttachment?: (url: string, title: string) => void;
}

export function renderStatusBadge(status?: WorkStatus | string) {
  const s = (status || 'Đang làm việc').trim();
  if (s === 'Đang làm việc') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        Đang làm việc
      </span>
    );
  }
  if (s === 'Tạm nghỉ' || s === 'Đang thử việc' || s === 'Nghỉ thai sản') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        {s}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
      {s || 'Đã nghỉ việc'}
    </span>
  );
}

export const EmployeeProfileDrawer: React.FC<EmployeeProfileDrawerProps> = ({
  employee,
  records,
  isAdmin = true,
  onClose,
  onEditEmployee,
  onInspectAttachment,
}) => {
  const currentYear = 2026;

  const { kpiStats, recentRecords } = useMemo(() => {
    if (!employee) {
      return {
        kpiStats: {
          standardQuota: 12,
          usedDays: 0,
          remainingDays: 12,
          lateCount: 0,
          lateHours: 0,
        },
        recentRecords: [] as LeaveRecord[],
      };
    }

    const matrixRows = calculateAnnualMatrixReport(
      [employee],
      records,
      currentYear,
      'ALL'
    );
    const row = matrixRows[0];

    const empRecords = records
      .filter((r) => r.employeeId === employee.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .slice(0, 5);

    return {
      kpiStats: {
        standardQuota: employee.standardAnnualLeave ?? 12,
        usedDays: row ? row.totalAnnualUsed : 0,
        remainingDays: row
          ? row.remainingAnnualLeave
          : employee.standardAnnualLeave ?? 12,
        lateCount: row ? row.totalLateCount : 0,
        lateHours: row ? row.totalLateHours : 0,
      },
      recentRecords: empRecords,
    };
  }, [employee, records]);

  if (!employee) return null;

  const joinDateDisplay = employee.joinDate
    ? formatDateVN(employee.joinDate)
    : '-';
  const phoneDisplay = (employee.phone || '').trim() || '-';
  const dobDisplay = employee.dob ? formatDateVN(employee.dob) : '-';
  const genderDisplay = (employee.gender || '').trim() || '-';
  const cccdDisplay = (employee.cccd || '').trim() || '-';
  const cccdDateDisplay = employee.cccdDate
    ? formatDateVN(employee.cccdDate)
    : '-';
  const addressDisplay = (employee.address || '').trim() || '-';
  const deptDisplay = (employee.department || '').trim() || '-';
  const posDisplay = (employee.position || '').trim() || '-';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-employee-name"
      data-testid="employee-profile-drawer"
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      {/* Slide-over panel (width 450px - 520px) */}
      <div
        className="relative w-full max-w-[500px] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header của Drawer */}
        <div className="bg-[#0F232E] text-white px-6 py-5 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src={employee.avatarUrl}
                alt={employee.fullName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover border-2 border-[#0D9488] shadow-md shrink-0 bg-slate-800"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono tabular-nums text-xs font-bold text-[#2DD4BF] bg-teal-950/80 border border-teal-700/60 px-2 py-0.5 rounded-md">
                    {employee.employeeCode || '-'}
                  </span>
                  {renderStatusBadge(employee.status)}
                </div>
                <h3
                  id="drawer-employee-name"
                  className="text-base sm:text-lg font-bold text-white mt-1.5 truncate"
                >
                  {employee.fullName || '-'}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 truncate">
                  <Briefcase className="w-3.5 h-3.5 text-[#2DD4BF] shrink-0" />
                  <span className="font-medium text-slate-200">
                    {deptDisplay}
                  </span>
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                  <span className="text-teal-300 font-medium">
                    {posDisplay}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng ngăn kéo hồ sơ"
              data-testid="btn-close-drawer-top"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 2. Khối Thống kê nhanh Chấm công & Phép năm (3 ô KPI nhỏ) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Thống kê Chấm công &amp; Phép năm ({currentYear})
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] font-medium text-slate-500">
                  Tổng phép năm
                </div>
                <div
                  data-testid="drawer-kpi-total-leave"
                  className="text-base font-mono tabular-nums font-bold text-slate-900 mt-1"
                >
                  {kpiStats.standardQuota}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ngày
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80">
                <div className="text-[11px] font-medium text-teal-800">
                  Đã nghỉ / Còn tồn
                </div>
                <div
                  data-testid="drawer-kpi-used-remaining"
                  className="text-base font-mono tabular-nums font-bold text-[#0D9488] mt-1"
                >
                  {kpiStats.usedDays} / {kpiStats.remainingDays}{' '}
                  <span className="text-xs font-normal text-teal-700">
                    ngày
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80">
                <div className="text-[11px] font-medium text-rose-800">
                  Lượt đi muộn
                </div>
                <div
                  data-testid="drawer-kpi-late"
                  className="text-base font-mono tabular-nums font-bold text-rose-600 mt-1"
                >
                  {kpiStats.lateCount}{' '}
                  <span className="text-xs font-normal text-rose-700">lần</span>{' '}
                  <span className="text-xs font-mono text-rose-500">
                    ({kpiStats.lateHours}h)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Khối Thông tin Cá nhân & Pháp lý (Lưới 2 cột rõ ràng) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Thông tin Cá nhân &amp; Pháp lý
            </h4>
            <div className="grid grid-cols-2 gap-3 bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 text-xs">
              <div>
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Ngày vào làm</span>
                </div>
                <div
                  data-testid="drawer-field-join-date"
                  className="font-mono tabular-nums font-semibold text-slate-800 mt-1"
                >
                  {joinDateDisplay}
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Số điện thoại</span>
                </div>
                <div
                  data-testid="drawer-field-phone"
                  className="font-mono tabular-nums font-semibold text-slate-800 mt-1"
                >
                  {phoneDisplay}
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ngày sinh</span>
                </div>
                <div
                  data-testid="drawer-field-dob"
                  className="font-mono tabular-nums font-semibold text-slate-800 mt-1"
                >
                  {dobDisplay}
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Giới tính</span>
                </div>
                <div
                  data-testid="drawer-field-gender"
                  className="font-semibold text-slate-800 mt-1"
                >
                  {genderDisplay}
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Số CCCD</span>
                </div>
                <div
                  data-testid="drawer-field-cccd"
                  className="font-mono tabular-nums font-semibold text-slate-800 mt-1"
                >
                  {cccdDisplay}
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ngày cấp CCCD</span>
                </div>
                <div
                  data-testid="drawer-field-cccd-date"
                  className="font-mono tabular-nums font-semibold text-slate-800 mt-1"
                >
                  {cccdDateDisplay}
                </div>
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-200/70">
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Địa chỉ thường trú</span>
                </div>
                <div
                  data-testid="drawer-field-address"
                  className="font-semibold text-slate-800 mt-1 leading-relaxed"
                >
                  {addressDisplay}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Khối Lịch sử Nghỉ phép / Đi muộn gần đây (5 bản ghi mới nhất) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Lịch sử Nghỉ phép / Đi muộn gần đây
              </h4>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {recentRecords.length} bản ghi gần nhất
              </span>
            </div>

            {recentRecords.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                Nhân sự này chưa có bản ghi nghỉ phép hoặc đi muộn nào.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentRecords.map((rec) => {
                  const meta = LEAVE_TYPE_META[rec.type];
                  return (
                    <div
                      key={rec.id}
                      className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="font-semibold"
                          style={{ color: meta.textColor }}
                        >
                          {meta.shortLabel}
                          {rec.regimeSubtype ? ` (${rec.regimeSubtype})` : ''}
                        </span>
                        <span className="font-mono tabular-nums font-bold text-slate-800">
                          {rec.amount} {meta.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums mt-1">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>
                          {formatDateVN(rec.startDate)}
                          {rec.endDate && rec.endDate !== rec.startDate
                            ? ` → ${formatDateVN(rec.endDate)}`
                            : ''}
                        </span>
                      </div>

                      {rec.reason && (
                        <p className="text-slate-600 mt-1.5 line-clamp-2">
                          {rec.reason}
                        </p>
                      )}

                      {rec.attachmentUrl && onInspectAttachment && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() =>
                              onInspectAttachment(
                                rec.attachmentUrl!,
                                rec.attachmentTitle ||
                                  `Đơn phép - ${employee.fullName}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0D9488] hover:text-[#0F766E] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem ảnh giấy phép đính kèm</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 5. Footer của Drawer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          {isAdmin && (
            <button
              type="button"
              data-testid="btn-drawer-edit-employee"
              onClick={() => {
                onClose();
                onEditEmployee(employee);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Chỉnh sửa hồ sơ</span>
            </button>
          )}
          <button
            type="button"
            data-testid="btn-drawer-close"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
