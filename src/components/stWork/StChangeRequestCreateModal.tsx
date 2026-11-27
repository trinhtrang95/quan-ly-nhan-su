import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ClipboardPlus,
  Copy,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  formatNumberVN,
  generateNextRequestCode,
  getLocalIsoDateToday,
  ST_CHANGE_REQUEST_PROCESS_STAGES,
  StChangeRequest,
  StProduct,
} from '../../utils/stWorkLogic';
import { createCompanyDepartment } from '../../utils/companyDepartmentsService';
import { batchCreateStChangeRequests } from '../../services/stWorkService';
import {
  formatStChangeRequestError,
  ProductCodeCombobox,
} from './StChangeRequestModals';

interface DraftChangeRequestItem {
  localKey: string;
  product_code: string;
  specification: string;
  process_stage: string;
  content: string;
  notes: string;
}

function createEmptyDraftItem(): DraftChangeRequestItem {
  return {
    localKey: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product_code: '',
    specification: '',
    process_stage: '',
    content: '',
    notes: '',
  };
}

export interface StChangeRequestCreateModalProps {
  isOpen: boolean;
  products: StProduct[];
  existingRequests: StChangeRequest[];
  departmentOptions: string[];
  groupOptions: string[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onOpenImportModal: () => void;
  onShowToast?: (message: string) => void;
}

export const StChangeRequestCreateModal: React.FC<
  StChangeRequestCreateModalProps
> = ({
  isOpen,
  products,
  existingRequests,
  departmentOptions,
  groupOptions,
  onClose,
  onCreated,
  onOpenImportModal,
  onShowToast,
}) => {
  const [requestCode, setRequestCode] = useState('');
  const [receivedAt, setReceivedAt] = useState('');
  const [department, setDepartment] = useState('');
  const [assignedGroup, setAssignedGroup] = useState('ST');
  const [items, setItems] = useState<DraftChangeRequestItem[]>([
    createEmptyDraftItem(),
  ]);

  // Inline quick-add Company Department state
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [isAddingDept, setIsAddingDept] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const today = getLocalIsoDateToday();
    setReceivedAt(today);
    setRequestCode(generateNextRequestCode(existingRequests, today));
    setDepartment((prev) =>
      prev && departmentOptions.includes(prev)
        ? prev
        : departmentOptions.includes('Sản xuất')
        ? 'Sản xuất'
        : departmentOptions[0] || 'Sản xuất'
    );
    setAssignedGroup(groupOptions.includes('ST') ? 'ST' : groupOptions[0] || 'ST');
    setItems([createEmptyDraftItem()]);
    setShowAddDept(false);
    setNewDeptName('');
    setErrorMsg('');
  }, [isOpen, existingRequests, departmentOptions, groupOptions]);

  if (!isOpen) return null;

  const effectiveDepts =
    department && !departmentOptions.includes(department)
      ? [department, ...departmentOptions]
      : departmentOptions;
  const effectiveGroups =
    assignedGroup && !groupOptions.includes(assignedGroup)
      ? [assignedGroup, ...groupOptions]
      : groupOptions;

  const handleReceivedAtChange = (nextDate: string) => {
    setReceivedAt(nextDate);
    if (!requestCode.trim() || /^YC-\d{8}-\d{2}$/i.test(requestCode.trim())) {
      setRequestCode(generateNextRequestCode(existingRequests, nextDate));
    }
  };

  const handleQuickCreateDepartment = async () => {
    const clean = newDeptName.trim();
    if (!clean) {
      setErrorMsg('Vui lòng nhập tên Bộ phận mới.');
      return;
    }
    setIsAddingDept(true);
    setErrorMsg('');
    try {
      const created = await createCompanyDepartment({ name: clean });
      setDepartment(created.name);
      setNewDeptName('');
      setShowAddDept(false);
      onShowToast?.(`Đã thêm bộ phận "${created.name}".`);
    } catch (err) {
      setErrorMsg(formatStChangeRequestError(err));
    } finally {
      setIsAddingDept(false);
    }
  };

  const updateItem = (
    localKey: string,
    patch: Partial<DraftChangeRequestItem>
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.localKey === localKey ? { ...item, ...patch } : item
      )
    );
  };

  const handleDuplicateItem = (source: DraftChangeRequestItem) => {
    const clone: DraftChangeRequestItem = {
      ...source,
      localKey: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.localKey === source.localKey);
      if (idx < 0) return [...prev, clone];
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });
  };

  const handleRemoveItem = (localKey: string) => {
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((i) => i.localKey !== localKey)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department.trim()) {
      setErrorMsg('Vui lòng chọn Bộ phận yêu cầu.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Phiếu cần có ít nhất 1 hạng mục.');
      return;
    }
    const missingContentIdx = items.findIndex((it) => !it.content.trim());
    if (missingContentIdx !== -1) {
      setErrorMsg(
        `Dòng #${missingContentIdx + 1}: Vui lòng nhập Nội dung yêu cầu thay đổi.`
      );
      return;
    }

    const effectiveReceivedAt = receivedAt || getLocalIsoDateToday();
    const effectiveCode =
      requestCode.trim() ||
      generateNextRequestCode(existingRequests, effectiveReceivedAt);

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await batchCreateStChangeRequests(
        items.map((it) => ({
          request_code: effectiveCode,
          received_at: effectiveReceivedAt,
          department: department.trim(),
          assigned_group: assignedGroup.trim() || 'ST',
          product_code: it.product_code.trim(),
          specification: it.specification.trim(),
          process_stage: it.process_stage.trim() || null,
          content: it.content.trim(),
          status: 'Đang kiểm tra',
          processed_at: null,
          applied_version: null,
          notes: it.notes.trim() || null,
        }))
      );
      await onCreated();
      onShowToast?.(
        `Đã lưu phiếu ${effectiveCode} (${formatNumberVN(items.length)} hạng mục).`
      );
      onClose();
    } catch (err) {
      const msg = formatStChangeRequestError(err);
      setErrorMsg(msg);
      onShowToast?.(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Thêm phiếu yêu cầu mới"
      data-testid="st-cr-create-modal"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
              <ClipboardPlus className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                Thêm Phiếu yêu cầu thay đổi
              </h3>
              <p className="text-xs text-slate-500 truncate">
                1 tờ phiếu có thể chứa nhiều mã hàng / hạng mục yêu cầu thay đổi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ thêm phiếu"
            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Phần 1 — Thông tin chung của tờ phiếu */}
          <section className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#14539E]">
                Phần 1 · Thông tin chung của tờ phiếu
              </h4>
              <span className="text-[11px] text-slate-500">
                Áp dụng chung cho toàn bộ các dòng bên dưới
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã phiếu
                </label>
                <input
                  type="text"
                  data-testid="st-cr-create-request-code"
                  value={requestCode}
                  onChange={(e) => setRequestCode(e.target.value)}
                  placeholder="YC-YYYYMMDD-01"
                  className="w-full h-9 px-2.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày nhận yêu cầu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  data-testid="st-cr-create-received-at"
                  value={receivedAt}
                  onChange={(e) => handleReceivedAtChange(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bộ phận yêu cầu <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1">
                  <select
                    data-testid="st-cr-create-dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    aria-label="Bộ phận yêu cầu"
                    className="flex-1 min-w-0 h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
                  >
                    {effectiveDepts.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-testid="st-cr-quick-add-dept-btn"
                    onClick={() => setShowAddDept((prev) => !prev)}
                    title="Thêm nhanh Bộ phận công ty mới"
                    aria-label="Thêm nhanh bộ phận mới"
                    className={`w-9 h-9 rounded-lg border inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      showAddDept
                        ? 'bg-[#14539E] text-white border-[#14539E]'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-[#14539E] hover:text-[#14539E]'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {showAddDept && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <input
                      type="text"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      placeholder="Tên bộ phận mới..."
                      className="flex-1 min-w-0 h-8 px-2 text-xs bg-white border border-[#14539E] rounded-lg focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isAddingDept}
                      onClick={() => void handleQuickCreateDepartment()}
                      aria-label="Xác nhận thêm bộ phận mới"
                      className="h-8 px-2.5 rounded-lg bg-[#14539E] text-white text-xs font-semibold inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      {isAddingDept ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nhóm xử lý (Kỹ thuật)
                </label>
                <select
                  data-testid="st-cr-create-group"
                  value={assignedGroup}
                  onChange={(e) => setAssignedGroup(e.target.value)}
                  aria-label="Nhóm xử lý (Bộ phận Kỹ thuật)"
                  className="w-full h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
                >
                  {effectiveGroups.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Phần 2 — Danh sách các Mã hàng / Hạng mục trong phiếu */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Phần 2 · Danh sách Mã hàng / Hạng mục yêu cầu ({items.length})
              </h4>
              <button
                type="button"
                data-testid="st-cr-add-item-row-btn"
                onClick={() =>
                  setItems((prev) => [...prev, createEmptyDraftItem()])
                }
                className="h-8 px-3 rounded-lg border border-[#14539E]/40 bg-blue-50/70 hover:bg-blue-100/70 text-[#14539E] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm dòng mã hàng</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={item.localKey}
                  data-testid={`st-cr-item-row-${idx}`}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#14539E]">
                      Hạng mục #{idx + 1}
                    </span>

                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        data-testid={`st-cr-duplicate-row-${idx}`}
                        onClick={() => handleDuplicateItem(item)}
                        title="Nhân bản dòng này"
                        aria-label={`Nhân bản dòng ${idx + 1}`}
                        className="h-7 px-2 rounded-md border border-slate-200 text-slate-600 hover:border-[#14539E] hover:text-[#14539E] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Nhân bản</span>
                      </button>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.localKey)}
                          title="Xóa dòng này"
                          aria-label={`Xóa dòng ${idx + 1}`}
                          className="w-7 h-7 rounded-md border border-rose-200 text-rose-500 hover:bg-rose-50 inline-flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Mã hàng
                      </label>
                      <ProductCodeCombobox
                        value={item.product_code}
                        products={products}
                        showAllModelQuickBtn
                        dataTestId={`st-cr-item-code-${idx}`}
                        ariaLabel={`Mã hàng dòng ${idx + 1}`}
                        placeholder="Chọn, gõ mã hoặc ALL MODEL..."
                        onChangeValue={(code) =>
                          updateItem(item.localKey, { product_code: code })
                        }
                        onSelectProduct={(prod) =>
                          updateItem(item.localKey, {
                            product_code: prod.product_code,
                            specification:
                              prod.specification || item.specification,
                          })
                        }
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Quy cách
                      </label>
                      <input
                        type="text"
                        data-testid={`st-cr-item-spec-${idx}`}
                        value={item.specification}
                        onChange={(e) =>
                          updateItem(item.localKey, {
                            specification: e.target.value,
                          })
                        }
                        placeholder="VD: EE4716, Rotor line..."
                        className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Công đoạn
                      </label>
                      <select
                        data-testid={`st-cr-item-stage-${idx}`}
                        value={item.process_stage}
                        onChange={(e) =>
                          updateItem(item.localKey, {
                            process_stage: e.target.value,
                          })
                        }
                        aria-label={`Công đoạn dòng ${idx + 1}`}
                        className="w-full h-9 px-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
                      >
                        <option value="">— Không chọn —</option>
                        {ST_CHANGE_REQUEST_PROCESS_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nội dung yêu cầu thay đổi{' '}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        data-testid={`st-cr-item-content-${idx}`}
                        value={item.content}
                        onChange={(e) =>
                          updateItem(item.localKey, { content: e.target.value })
                        }
                        placeholder="Nhập nội dung yêu cầu thay đổi quy trình / ST..."
                        className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Ghi chú
                      </label>
                      <input
                        type="text"
                        data-testid={`st-cr-item-notes-${idx}`}
                        value={item.notes}
                        onChange={(e) =>
                          updateItem(item.localKey, { notes: e.target.value })
                        }
                        placeholder="Ghi chú thêm (nếu có)..."
                        className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {errorMsg && (
            <div
              role="alert"
              data-testid="st-cr-create-error"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            disabled={isSubmitting}
            data-testid="st-cr-open-import-btn"
            onClick={() => {
              onClose();
              onOpenImportModal();
            }}
            className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Nhập từ file</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="st-cr-create-save-btn"
              className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                Lưu phiếu ({formatNumberVN(items.length)} hạng mục)
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
