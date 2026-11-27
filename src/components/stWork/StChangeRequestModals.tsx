import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  Pencil,
  X,
} from 'lucide-react';
import {
  formatStDateVN,
  getLocalIsoDateToday,
  ST_CHANGE_REQUEST_PROCESS_STAGES,
  ST_CHANGE_REQUEST_STATUSES,
  ST_STATUS_BADGE_META,
  StChangeRequest,
  StChangeRequestStatus,
  StProduct,
} from '../../utils/stWorkLogic';
import { updateStChangeRequest } from '../../services/stWorkService';

export function formatStChangeRequestError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }
  return 'Không thể lưu phiếu yêu cầu xuống Supabase. Vui lòng thử lại.';
}

export interface ProductCodeComboboxProps {
  value: string;
  products: StProduct[];
  onChangeValue: (code: string) => void;
  onSelectProduct: (product: StProduct) => void;
  placeholder?: string;
  ariaLabel?: string;
  showAllModelQuickBtn?: boolean;
  dataTestId?: string;
}

export const ProductCodeCombobox: React.FC<ProductCodeComboboxProps> = ({
  value,
  products,
  onChangeValue,
  onSelectProduct,
  placeholder = 'Chọn / nhập mã hàng...',
  ariaLabel = 'Mã hàng',
  showAllModelQuickBtn = false,
  dataTestId,
}) => {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list =
      q && q !== 'all model'
        ? products.filter(
            (p) =>
              p.product_code.toLowerCase().includes(q) ||
              p.product_name.toLowerCase().includes(q) ||
              p.specification.toLowerCase().includes(q)
          )
        : products;
    return list.slice(0, 12);
  }, [value, products]);

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1 min-w-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={value}
            data-testid={dataTestId}
            onFocus={() => {
              if (blurTimer.current) window.clearTimeout(blurTimer.current);
              setOpen(true);
            }}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => setOpen(false), 160);
            }}
            onChange={(e) => {
              onChangeValue(e.target.value);
              setOpen(true);
            }}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="w-full h-9 pl-2.5 pr-6 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
          />
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen((prev) => !prev);
            }}
            aria-label="Mở danh sách mã hàng"
            className="absolute right-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {open && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelectProduct(p);
                  setOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50/70 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#14539E]">
                    {p.product_code}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {p.line_name} · {p.customer_short_name}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 truncate">
                  {p.product_name}
                  {p.specification ? ` · ${p.specification}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showAllModelQuickBtn && (
        <button
          type="button"
          onClick={() => {
            onChangeValue('ALL MODEL');
            setOpen(false);
          }}
          title="Áp dụng cho toàn bộ mã hàng (ALL MODEL)"
          className={`h-9 px-2 rounded-lg border text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            value.trim().toUpperCase() === 'ALL MODEL'
              ? 'bg-[#14539E] text-white border-[#14539E]'
              : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-[#14539E] hover:text-[#14539E]'
          }`}
        >
          ALL MODEL
        </button>
      )}
    </div>
  );
};

// ==========================================
// Mini Status Update Modal
// ==========================================

export interface StChangeRequestStatusModalProps {
  request: StChangeRequest | null;
  groupOptions: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

export const StChangeRequestStatusModal: React.FC<
  StChangeRequestStatusModalProps
> = ({ request, groupOptions, onClose, onSaved, onShowToast }) => {
  const [status, setStatus] = useState<StChangeRequestStatus>('Đang kiểm tra');
  const [processedAt, setProcessedAt] = useState('');
  const [appliedVersion, setAppliedVersion] = useState('');
  const [assignedGroup, setAssignedGroup] = useState('ST');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!request) return;
    setStatus(request.status);
    setProcessedAt(request.processed_at || '');
    setAppliedVersion(request.applied_version || '');
    setAssignedGroup(request.assigned_group || 'ST');
    setNotes(request.notes || '');
    setErrorMsg('');
  }, [request]);

  if (!request) return null;

  const effectiveGroups = groupOptions.includes(assignedGroup)
    ? groupOptions
    : [assignedGroup, ...groupOptions].filter(Boolean);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    try {
      await updateStChangeRequest(request.id, {
        request_code: request.request_code,
        department: request.department,
        assigned_group: assignedGroup || 'ST',
        process_stage: request.process_stage,
        content: request.content,
        received_at: request.received_at,
        product_code: request.product_code,
        specification: request.specification,
        status,
        processed_at: processedAt.trim() || null,
        applied_version: appliedVersion.trim() || null,
        notes: notes.trim() || null,
      });
      await onSaved();
      onShowToast?.('Đã cập nhật tình trạng xử lý phiếu yêu cầu.');
      onClose();
    } catch (err) {
      const msg = formatStChangeRequestError(err);
      setErrorMsg(msg);
      onShowToast?.(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cập nhật tình trạng phiếu yêu cầu"
      data-testid="st-cr-status-modal"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <form
        onSubmit={(e) => void handleSave(e)}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                Cập nhật tình trạng xử lý
              </h3>
              <p className="text-[11px] text-slate-500 font-mono truncate">
                {request.request_code || 'Phiếu YC'} ·{' '}
                {formatStDateVN(request.received_at)} · {request.department}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ cập nhật tình trạng"
            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-xs">
          {/* Request Item Summary */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <strong className="text-slate-600">Mã hàng:</strong>{' '}
                <span className="font-mono font-bold text-[#14539E]">
                  {request.product_code || '—'}
                </span>
              </span>
              <span>
                <strong className="text-slate-600">Quy cách:</strong>{' '}
                <span className="text-slate-800">
                  {request.specification || '—'}
                </span>
              </span>
              <span>
                <strong className="text-slate-600">Công đoạn:</strong>{' '}
                <span className="font-semibold text-slate-800">
                  {request.process_stage || '—'}
                </span>
              </span>
            </div>
            <div className="text-slate-700 leading-relaxed">
              <strong className="text-slate-600">Nội dung YC:</strong>{' '}
              {request.content}
            </div>
          </div>

          {/* Status Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tình trạng xử lý <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ST_CHANGE_REQUEST_STATUSES.map((st) => {
                const active = status === st;
                const badge = ST_STATUS_BADGE_META[st];
                return (
                  <button
                    key={st}
                    type="button"
                    data-testid={`st-cr-status-option-${st}`}
                    onClick={() => {
                      setStatus(st);
                      if (st === 'Đã thay đổi' && !processedAt) {
                        setProcessedAt(getLocalIsoDateToday());
                      }
                    }}
                    className={`h-9 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      active
                        ? `${badge.bgClass} ${badge.textClass} ${badge.borderClass} ring-2 ring-[#14539E]/30`
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{st}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày áp dụng đơn giá thay đổi
              </label>
              <input
                type="date"
                data-testid="st-cr-status-processed-at"
                value={processedAt}
                onChange={(e) => setProcessedAt(e.target.value)}
                aria-label="Ngày áp dụng đơn giá thay đổi"
                className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phiên bản áp dụng
              </label>
              <input
                type="text"
                data-testid="st-cr-status-version"
                value={appliedVersion}
                onChange={(e) => setAppliedVersion(e.target.value)}
                placeholder="VD: A22, A7, A10..."
                aria-label="Phiên bản áp dụng"
                className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nhóm xử lý (Bộ phận Kỹ thuật)
            </label>
            <select
              data-testid="st-cr-status-group"
              value={assignedGroup}
              onChange={(e) => setAssignedGroup(e.target.value)}
              aria-label="Nhóm xử lý"
              className="w-full h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
            >
              {effectiveGroups.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú / Lý do xử lý
            </label>
            <textarea
              rows={2}
              data-testid="st-cr-status-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú kết quả kiểm tra, lý do không thay đổi hoặc lưu ý phiên bản..."
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] resize-none"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              data-testid="st-cr-status-error"
              className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            data-testid="st-cr-status-save-btn"
            className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Lưu cập nhật</span>
          </button>
        </div>
      </form>
    </div>
  );
};

// ==========================================
// Full Edit Row Modal
// ==========================================

export interface StChangeRequestEditModalProps {
  request: StChangeRequest | null;
  products: StProduct[];
  departmentOptions: string[];
  groupOptions: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

export const StChangeRequestEditModal: React.FC<
  StChangeRequestEditModalProps
> = ({
  request,
  products,
  departmentOptions,
  groupOptions,
  onClose,
  onSaved,
  onShowToast,
}) => {
  const [requestCode, setRequestCode] = useState('');
  const [receivedAt, setReceivedAt] = useState('');
  const [department, setDepartment] = useState('');
  const [assignedGroup, setAssignedGroup] = useState('ST');
  const [productCode, setProductCode] = useState('');
  const [specification, setSpecification] = useState('');
  const [processStage, setProcessStage] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<StChangeRequestStatus>('Đang kiểm tra');
  const [processedAt, setProcessedAt] = useState('');
  const [appliedVersion, setAppliedVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!request) return;
    setRequestCode(request.request_code || '');
    setReceivedAt(request.received_at || getLocalIsoDateToday());
    setDepartment(request.department || departmentOptions[0] || '');
    setAssignedGroup(request.assigned_group || 'ST');
    setProductCode(request.product_code || '');
    setSpecification(request.specification || '');
    setProcessStage(request.process_stage || '');
    setContent(request.content || '');
    setStatus(request.status);
    setProcessedAt(request.processed_at || '');
    setAppliedVersion(request.applied_version || '');
    setNotes(request.notes || '');
    setErrorMsg('');
  }, [request, departmentOptions]);

  if (!request) return null;

  const effectiveDepts = departmentOptions.includes(department)
    ? departmentOptions
    : [department, ...departmentOptions].filter(Boolean);
  const effectiveGroups = groupOptions.includes(assignedGroup)
    ? groupOptions
    : [assignedGroup, ...groupOptions].filter(Boolean);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department.trim()) {
      setErrorMsg('Vui lòng chọn Bộ phận yêu cầu.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Vui lòng nhập Nội dung yêu cầu thay đổi.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      await updateStChangeRequest(request.id, {
        request_code: requestCode.trim() || null,
        received_at: receivedAt || getLocalIsoDateToday(),
        department: department.trim(),
        assigned_group: assignedGroup.trim() || 'ST',
        product_code: productCode.trim(),
        specification: specification.trim(),
        process_stage: processStage.trim() || null,
        content: content.trim(),
        status,
        processed_at: processedAt.trim() || null,
        applied_version: appliedVersion.trim() || null,
        notes: notes.trim() || null,
      });
      await onSaved();
      onShowToast?.('Đã lưu chỉnh sửa hạng mục phiếu yêu cầu.');
      onClose();
    } catch (err) {
      const msg = formatStChangeRequestError(err);
      setErrorMsg(msg);
      onShowToast?.(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chỉnh sửa phiếu yêu cầu"
      data-testid="st-cr-edit-modal"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <form
        onSubmit={(e) => void handleSave(e)}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[#14539E]/10 text-[#14539E] flex items-center justify-center shrink-0">
              <Pencil className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 truncate">
              Chỉnh sửa hạng mục Phiếu yêu cầu
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ chỉnh sửa"
            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã phiếu
              </label>
              <input
                type="text"
                value={requestCode}
                onChange={(e) => setRequestCode(e.target.value)}
                placeholder="YC-YYYYMMDD-01"
                className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày nhận YC <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bộ phận YC <span className="text-rose-500">*</span>
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {effectiveDepts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nhóm xử lý
              </label>
              <select
                value={assignedGroup}
                onChange={(e) => setAssignedGroup(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {effectiveGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã hàng
              </label>
              <ProductCodeCombobox
                value={productCode}
                products={products}
                showAllModelQuickBtn
                onChangeValue={setProductCode}
                onSelectProduct={(prod) => {
                  setProductCode(prod.product_code);
                  if (prod.specification) setSpecification(prod.specification);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quy cách
              </label>
              <input
                type="text"
                value={specification}
                onChange={(e) => setSpecification(e.target.value)}
                placeholder="VD: EE4716, Rotor line..."
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Công đoạn
              </label>
              <select
                value={processStage}
                onChange={(e) => setProcessStage(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                <option value="">— Không chọn —</option>
                {ST_CHANGE_REQUEST_PROCESS_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nội dung yêu cầu thay đổi <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tình trạng
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const next = e.target.value as StChangeRequestStatus;
                  setStatus(next);
                  if (next === 'Đã thay đổi' && !processedAt) {
                    setProcessedAt(getLocalIsoDateToday());
                  }
                }}
                className="w-full h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {ST_CHANGE_REQUEST_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày áp dụng đơn giá
              </label>
              <input
                type="date"
                value={processedAt}
                onChange={(e) => setProcessedAt(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phiên bản áp dụng
              </label>
              <input
                type="text"
                value={appliedVersion}
                onChange={(e) => setAppliedVersion(e.target.value)}
                placeholder="VD: A22, A7..."
                className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm..."
              className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            data-testid="st-cr-edit-save-btn"
            className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </form>
    </div>
  );
};
