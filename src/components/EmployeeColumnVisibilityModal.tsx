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
    // Keep canonical order
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
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/70">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0D9488] shrink-0 mt-0.5">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="column-visibility-modal-title"
                className="text-base font-bold text-slate-900"
              >
                Chọn hiển thị
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chọn các trường thông tin đưa ra bảng Danh sách nhân sự
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ Chọn hiển thị"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Control Bar: Selected Count + Quick Action Buttons */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              data-testid="column-visibility-count"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-[#0F766E] font-bold"
            >
              Đang chọn {draftColumns.length} cột
            </span>
            <span className="text-slate-500 hidden sm:inline">
              (Các cột cố định: STT, Mã nhân viên, Họ tên và Thao tác luôn hiển thị)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="btn-cols-default"
              onClick={handleResetDefault}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Mặc định
            </button>
            <button
              type="button"
              data-testid="btn-cols-select-all"
              onClick={handleSelectAll}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              data-testid="btn-cols-clear-all"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Bỏ hết
            </button>
          </div>
        </div>

        {/* Body: Categorized Checkbox Groups in Grid */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 flex-1">
          {EMPLOYEE_COLUMN_GROUPS.map((group) => {
            const selectedInGroup = group.columns.filter((c) =>
              selectedSet.has(c.id)
            ).length;

            return (
              <div
                key={group.key}
                className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4"
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/70">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {group.title}
                  </h4>
                  <span className="text-[11px] font-medium text-slate-400">
                    Đã chọn {selectedInGroup}/{group.columns.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {group.columns.map((col) => {
                    const checked = selectedSet.has(col.id);
                    return (
                      <label
                        key={col.id}
                        data-testid={`checkbox-col-${col.id}`}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all select-none ${
                          checked
                            ? 'bg-teal-50/80 border-teal-400 text-slate-900 shadow-2xs'
                            : 'bg-white border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
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

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Cột Nhân sự (tên, mã) luôn hiện. Bảng hiện đúng các cột đã chọn; nút Tải Excel của bảng tải đúng các cột đó.
          </p>

          <div className="flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="btn-cols-cancel"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              data-testid="btn-cols-apply"
              onClick={handleConfirmApply}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
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
