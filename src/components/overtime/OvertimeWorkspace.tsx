import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, FilePlus2 } from 'lucide-react';
import { DepartmentGroup, Employee } from '../../types/hr';
import { formatNumberVN } from '../../utils/errorAndSecurityService';
import {
  fetchOvertimeForms,
  OvertimeFormWithItems,
  saveOvertimeFormToHistory,
  softDeleteOvertimeForm,
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

  const handleSoftDelete = async (formId: string) => {
    await softDeleteOvertimeForm(formId);
    setForms((prev) => prev.filter((f) => f.id !== formId));
  };

  const activeFormsCount = forms.filter((f) => !f.deleted_at).length;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 2-Tab Navigation Header */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-3 no-print">
        <div
          role="tablist"
          aria-label="Phân hệ Tăng ca"
          className="inline-flex items-center gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            onClick={() => setActiveTab('create')}
            className={`h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'create'
                ? 'bg-[#14539E] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Tạo phiếu tăng ca</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'log'}
            onClick={() => setActiveTab('log')}
            className={`h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'log'
                ? 'bg-[#14539E] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
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

        <div className="text-xs text-slate-500 hidden sm:block">
          Biểu mẫu chuẩn:{' '}
          <span className="font-mono font-semibold text-slate-700">
            TV-PSGC2022
          </span>
        </div>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'create' ? (
        <CreateOvertimeForm
          employees={employees}
          groups={groups}
          onSaveOnly={handleSaveForm}
        />
      ) : (
        <OvertimeLog
          forms={forms}
          employees={employees}
          isLoading={isLoadingForms}
          onRefresh={loadForms}
          onSoftDelete={handleSoftDelete}
          onSwitchToCreate={() => setActiveTab('create')}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};

export default OvertimeWorkspace;
