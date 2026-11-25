import React, { useState } from 'react';
import { Clock, Pencil, Plus, Users } from 'lucide-react';
import { DepartmentGroup } from '../../types/hr';
import { formatNumberVN } from '../../utils/errorAndSecurityService';
import {
  WEEKDAY_MODE_LABELS,
  WEEKDAY_ORDER,
  WeekdayWorkMode,
  WorkShift,
} from '../../utils/workScheduleLogic';
import { WorkShiftModal } from './WorkShiftModal';

export interface WorkShiftsTabProps {
  shifts: WorkShift[];
  groups: DepartmentGroup[];
  isLoading: boolean;
  isSaving: boolean;
  onSaveShift: (
    shiftData: Omit<WorkShift, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onSetDefaultShift: (shiftId: string) => Promise<void>;
  onDeleteShift: (shiftId: string) => Promise<void>;
}

function getCardWeekdayStyle(mode: WeekdayWorkMode): string {
  switch (mode) {
    case 'full_day':
      return 'bg-[#14539E]/10 text-[#14539E] border-[#14539E]/30 font-bold';
    case 'morning':
      return 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
    case 'biweekly':
      return 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold';
    case 'off':
    default:
      return 'bg-slate-100 text-slate-400 border-slate-200 font-medium opacity-70';
  }
}

function getCardWeekdayBadgeSuffix(mode: WeekdayWorkMode): string | null {
  if (mode === 'morning') return 'Sáng';
  if (mode === 'biweekly') return 'Cách tuần';
  return null;
}

export const WorkShiftsTab: React.FC<WorkShiftsTabProps> = ({
  shifts,
  groups,
  isLoading,
  isSaving,
  onSaveShift,
  onSetDefaultShift,
  onDeleteShift,
}) => {
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);

  const handleOpenAdd = () => {
    setEditingShift(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (shift: WorkShift) => {
    setEditingShift(shift);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Danh sách Ca làm việc
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Thiết lập khung giờ làm việc chuẩn theo ca và phân bổ phạm vi phòng
            ban. Ca mặc định dùng để xác định ngày nghỉ hằng tuần.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="h-9 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm ca làm việc</span>
        </button>
      </div>

      {isLoading && shifts.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-60 rounded-2xl border border-slate-200 bg-white animate-pulse p-5"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shifts.map((shift) => {
            const scopeText = shift.isDefault
              ? 'Toàn công ty (Ca mặc định)'
              : shift.departmentNames.length > 0
                ? shift.departmentNames.join(', ')
                : 'Chưa gán phòng ban áp dụng';

            return (
              <div
                key={shift.id}
                data-testid={`work-shift-card-${shift.code}`}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-3.5 hover:border-slate-300 transition-colors"
              >
                {/* Card Header: Badge Code + Name + Default tag + Edit button */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-white shrink-0"
                        style={{ backgroundColor: shift.color || '#14539E' }}
                      >
                        {shift.code}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {shift.name}
                        </h3>
                        {shift.isDefault && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700 whitespace-nowrap shrink-0">
                            Ca mặc định
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(shift)}
                      aria-label={`Sửa ca ${shift.code} - ${shift.name}`}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-[#14539E] hover:text-[#14539E] text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Sửa</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {shift.startTime} – {shift.endTime}
                      </span>
                    </span>
                    {shift.breakStart && shift.breakEnd && (
                      <span className="whitespace-nowrap text-slate-500">
                        · Nghỉ {shift.breakStart}–{shift.breakEnd}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2 Stat Boxes */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2">
                    <div className="text-[11px] text-slate-500 font-medium">
                      Giờ công / ca
                    </div>
                    <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {formatNumberVN(shift.standardDailyHours)}{' '}
                      <span className="text-xs font-sans font-medium text-slate-500">
                        giờ
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2">
                    <div className="text-[11px] text-slate-500 font-medium">
                      Giờ / tuần
                    </div>
                    <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {formatNumberVN(shift.weeklyHours)}{' '}
                      <span className="text-xs font-sans font-medium text-slate-500">
                        giờ
                      </span>
                    </div>
                  </div>
                </div>

                {/* 7 Weekday Cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAY_ORDER.map((day) => {
                    const mode = shift.workingDays?.[day.key] ?? 'off';
                    const sub = getCardWeekdayBadgeSuffix(mode);
                    return (
                      <div
                        key={day.key}
                        title={`${day.fullLabel}: ${WEEKDAY_MODE_LABELS[mode]}`}
                        className={`rounded-lg border py-1.5 px-0.5 text-center flex flex-col items-center justify-center min-h-[38px] ${getCardWeekdayStyle(
                          mode
                        )}`}
                      >
                        <span className="text-[11px] leading-tight">
                          {day.shortLabel}
                        </span>
                        {sub && (
                          <span className="text-[9px] leading-none mt-0.5 truncate max-w-full px-0.5">
                            {sub}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer Scope & Metadata */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate" title={scopeText}>
                      Phạm vi: <strong className="font-semibold">{scopeText}</strong>
                    </span>
                  </div>
                  {(shift.earlyMinutes > 0 || shift.hourlyRatePercent !== 100) && (
                    <span className="font-mono text-[10px] text-slate-500 shrink-0 tabular-nums">
                      {shift.earlyMinutes > 0 ? `+${shift.earlyMinutes}p ` : ''}
                      {shift.hourlyRatePercent !== 100
                        ? `${formatNumberVN(shift.hourlyRatePercent)}%`
                        : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Dashed "+ Thêm ca làm việc" Card */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="min-h-[228px] rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#14539E] bg-white/60 hover:bg-blue-50/40 p-6 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-[#14539E] transition-colors cursor-pointer group"
          >
            <span className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-[#14539E]/10 flex items-center justify-center transition-colors">
              <Plus className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold">+ Thêm ca làm việc</span>
            <span className="text-[11px] text-slate-400 group-hover:text-[#14539E]/80 text-center max-w-[200px]">
              Tạo ca hành chính khác, ca kíp hoặc ca riêng cho từng phòng ban
            </span>
          </button>
        </div>
      )}

      <WorkShiftModal
        isOpen={modalOpen}
        editingShift={editingShift}
        existingShifts={shifts}
        groups={groups}
        isSaving={isSaving}
        onClose={() => setModalOpen(false)}
        onSave={async (data) => {
          await onSaveShift(data);
          setModalOpen(false);
        }}
        onSetDefault={async (id) => {
          await onSetDefaultShift(id);
        }}
        onDelete={async (id) => {
          await onDeleteShift(id);
          setModalOpen(false);
        }}
      />
    </div>
  );
};
