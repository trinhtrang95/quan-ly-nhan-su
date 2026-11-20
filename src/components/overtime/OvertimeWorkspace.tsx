import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, FilePlus2, Pencil } from 'lucide-react';
import { DepartmentGroup, Employee } from '../../types/hr';
import { formatNumberVN } from '../../utils/errorAndSecurityService';
import {
  fetchOvertimeForms,
  OvertimeFormWithItems,
  saveOvertimeFormToHistory,
  softDeleteOvertimeForm,
  updateOvertimeFormInHistory,
} from '../../utils/overtimeFormsService';
import {
  CreateOvertimeForm,
  CreateOvertimeFormPayload,
} from './CreateOvertimeForm';
import { OvertimeLog } from './OvertimeLog';

export type OvertimeTabId = 'create' | 'log';

export interface OvertimeWorkspaceProps {
  employees: Employee[];
  groups: DepartmentGroup[];
  initialTab?: OvertimeTabId;
  onShowToast?: (message: string) => void;
}

export const OvertimeWorkspace: React.FC<OvertimeWorkspaceProps> = ({
  employees,
  groups,
  initialTab = 'create',
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<OvertimeTabId>(initialTab);
  const [forms, setForms] = useState<OvertimeFormWithItems[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState<boolean>(true);
  const [editingForm, setEditingForm] = useState<OvertimeFormWithItems | null>(
    null
  );

  const loadForms = useCallback(async () => {
    setIsLoadingForms(true);
    try {
      const { forms: fetched } = await fetchOvertimeForms();
      setForms(fetched);
    } finally {
      setIsLoadingForms(false);
    }
  }, []);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  const handleSaveForm = async (payload: CreateOvertimeFormPayload) => {
    if (editingForm) {
      const updated = await updateOvertimeFormInHistory(editingForm, {
        department: payload.department,
        overtimeDate: payload.overtimeDate,
        blocks: payload.blocks,
        employees,
      });
      setForms((prev) =>
        prev.map((f) => (f.id === updated.id ? updated : f))
      );
      setEditingForm(null);
      onShowToast?.(
        `Đã cập nhật phiếu tăng ca ${updated.form_code} (${formatNumberVN(
          updated.total_participants
        )} lượt).`
      );
      setActiveTab('log');
      return;
    }

    const saved = await saveOvertimeFormToHistory({
      department: payload.department,
      overtimeDate: payload.overtimeDate,
      blocks: payload.blocks,
      employees,
    });

    setForms((prev) => [saved, ...prev.filter((f) => f.id !== saved.id)]);
    onShowToast?.(
      `Đã lưu phiếu tăng ca ${saved.form_code} (${formatNumberVN(
        saved.total_participants
      )} lượt) vào Nhật ký.`
    );
    setActiveTab('log');
  };

  const handleStartEditForm = (form: OvertimeFormWithItems) => {
    setEditingForm(form);
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    setEditingForm(null);
    setActiveTab('log');
  };

  const handleSoftDelete = async (formId: string) => {
    await softDeleteOvertimeForm(formId);
    setForms((prev) => prev.filter((f) => f.id !== formId));
    if (editingForm?.id === formId) {
      setEditingForm(null);
    }
  };

  const activeFormsCount = forms.filter((f) => !f.deleted_at).length;

  return (
    <div className="flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-slate-50">
      {/* 2-Tab Navigation Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0 no-print">
        <div
          role="tablist"
          aria-label="Phân hệ Tăng ca"
          className="inline-flex flex-wrap items-center gap-1 min-w-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            onClick={() => setActiveTab('create')}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'create'
                ? 'bg-[#14539E] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {editingForm ? (
              <Pencil className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {editingForm
                ? `Đang sửa: ${editingForm.form_code}`
                : 'Tạo phiếu tăng ca'}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'log'}
            onClick={() => {
              setEditingForm(null);
              setActiveTab('log');
            }}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'log'
                ? 'bg-[#14539E] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
            <span>Nhật ký phiếu tăng ca</span>
            <span
              className={`font-mono text-[11px] tabular-nums ${
                activeTab === 'log' ? 'text-blue-100' : 'text-slate-400'
              }`}
            >
              ({formatNumberVN(activeFormsCount)})
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 shrink-0 whitespace-nowrap pr-1">
          Biểu mẫu chuẩn:{' '}
          <span className="font-mono font-semibold text-slate-700">
            TV-PSGC2022
          </span>
        </div>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'create' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden">
          <CreateOvertimeForm
            key={editingForm ? `edit-${editingForm.id}` : 'create-new'}
            employees={employees}
            groups={groups}
            editingForm={editingForm}
            onCancelEdit={handleCancelEdit}
            onSaveOnly={handleSaveForm}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <OvertimeLog
            forms={forms}
            employees={employees}
            isLoading={isLoadingForms}
            onRefresh={loadForms}
            onEdit={handleStartEditForm}
            onSoftDelete={handleSoftDelete}
            onSwitchToCreate={() => {
              setEditingForm(null);
              setActiveTab('create');
            }}
            onShowToast={onShowToast}
          />
        </div>
      )}
    </div>
  );
};

export default OvertimeWorkspace;
