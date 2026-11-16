import React, { useEffect, useState } from 'react';
import { Eye, X, Check } from 'lucide-react';
import {
  ALL_EMPLOYEE_COLUMNS,
  DEFAULT_VISIBLE_EMPLOYEE_COLUMNS,
  EMPLOYEE_COLUMN_GROUPS,
  EmployeeColumnId,
} from '../utils/employeeColumns';

interface EmployeeColumnVisibilityModalProps {
  isOpen: boolean;
  visibleColumns: EmployeeColumnId[];
  onClose: () => void;
  onApply: (nextColumns: EmployeeColumnId[]) => void;
}

export const EmployeeColumnVisibilityModal: React.FC<
  EmployeeColumnVisibilityModalProps
> = ({ isOpen, visibleColumns, onClose, onApply }) => {
  const [draftColumns, setDraftColumns] = useState<EmployeeColumnId[]>(
    visibleColumns
  );

  useEffect(() => {
    if (isOpen) {
      setDraftColumns(visibleColumns);
    }
  }, [isOpen, visibleColumns]);

  if (!isOpen) return null;

  const selectedSet = new Set<EmployeeColumnId>(draftColumns);

  const handleToggleColumn = (colId: EmployeeColumnId) => {
    setDraftColumns((prev) => {
      if (prev.includes(colId)) {
        return prev.filter((id) => id !== colId);
      }
      const nextSet = new Set<EmployeeColumnId>([...prev, colId]);
      // Maintain canonical order defined in ALL_EMPLOYEE_COLUMNS
      return ALL_EMPLOYEE_COLUMNS.map((c) => c.id).filter((id) =>
        nextSet.has(id)
      );
    });
  };

  const handleResetDefault = () => {
    setDraftColumns([...DEFAULT_VISIBLE_EMPLOYEE_COLUMNS]);
  };

  const handleSelectAll = () => {
    setDraftColumns(ALL_EMPLOYEE_COLUMNS.map((c) => c.id));
  };

  const handleClearAll = () => {
    setDraftColumns([]);
  };

  const handleConfirmApply = () => {
    const ordered = ALL_EMPLOYEE_COLUMNS.map((c) => c.id).filter((id) =>
      selectedSet.has(id)
    );
    onApply(ordered);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="column-visibility-modal-title"
      data-testid="employee-column-visibility-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Modal Header + Quick Actions on 1 Unified Top Bar */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0D9488] shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  id="column-visibility-modal-title"
                  className="text-sm sm:text-base font-bold text-slate-900 leading-tight"
                >
                  Chọn hiển thị
                </h3>
                <span
                  data-testid="column-visibility-count"
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-[#0F766E] text-[11px] font-bold"
                >
                  Đang chọn {draftColumns.length} cột
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                Chọn các trường thông tin đưa ra bảng Nhân sự
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="btn-cols-default"
              onClick={handleResetDefault}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Mặc định
            </button>
            <button
              type="button"
              data-testid="btn-cols-select-all"
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              data-testid="btn-cols-clear-all"
              onClick={handleClearAll}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Bỏ hết
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ Chọn hiển thị"
              className="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ultra-Compact No-Scroll Body: Fixed 3-Column x 2-Row Grid (grid-cols-3) */}
        {/* Row 1: Công việc | Cá nhân | Liên hệ */}
        {/* Row 2: Gia đình, người thân | Bảo hiểm, ngân hàng | Theo dõi */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {EMPLOYEE_COLUMN_GROUPS.map((group) => {
            const selectedInGroup = group.columns.filter((c) =>
              selectedSet.has(c.id)
            ).length;
            const useTwoColSubGrid = group.columns.length > 5;

            return (
              <div
                key={group.key}
                className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-2.5 flex flex-col"
              >
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200/70">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 leading-none">
                    {group.title}
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-400 leading-none">
                    {selectedInGroup}/{group.columns.length}
                  </span>
                </div>

                <div
                  className={
                    useTwoColSubGrid
                      ? 'grid grid-cols-2 gap-x-1.5 gap-y-1'
                      : 'grid grid-cols-1 gap-y-1'
                  }
                >
                  {group.columns.map((col) => {
                    const checked = selectedSet.has(col.id);
                    return (
                      <label
                        key={col.id}
                        data-testid={`checkbox-col-${col.id}`}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] leading-tight font-medium cursor-pointer transition-colors select-none ${
                          checked
                            ? 'bg-teal-50/90 border-teal-400 text-slate-900'
                            : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleColumn(col.id)}
                          className="w-3.5 h-3.5 rounded accent-[#0D9488] cursor-pointer shrink-0"
                        />
                        <span className="truncate" title={col.label}>
                          {col.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact Modal Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[11px] text-slate-500 leading-tight">
            Cột Nhân sự (tên, mã) luôn hiện. Bảng hiện đúng các cột đã chọn; nút Tải Excel của bảng tải đúng các cột đó.
          </p>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              data-testid="btn-cols-cancel"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              data-testid="btn-cols-apply"
              onClick={handleConfirmApply}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Áp dụng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
