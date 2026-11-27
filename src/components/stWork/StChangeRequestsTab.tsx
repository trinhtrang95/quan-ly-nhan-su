import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { CompanyDepartment, DepartmentGroup } from '../../types/hr';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  formatNumberVN,
  formatStDateVN,
  getLocalIsoDateToday,
  ST_CHANGE_REQUEST_STATUSES,
  ST_STATUS_BADGE_META,
  StChangeRequest,
  StChangeRequestStatus,
  StProduct,
} from '../../utils/stWorkLogic';
import {
  createStChangeRequest,
  DEFAULT_COMPANY_DEPARTMENTS,
  deleteStChangeRequest,
  mergeCompanyDepartmentOptions,
  updateStChangeRequest,
} from '../../services/stWorkService';

export interface StChangeRequestsTabProps {
  changeRequests: StChangeRequest[];
  products: StProduct[];
  companyDepartments?: CompanyDepartment[];
  groups?: DepartmentGroup[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

interface ProductCodeComboboxProps {
  value: string;
  products: StProduct[];
  onChangeValue: (code: string) => void;
  onSelectProduct: (product: StProduct) => void;
  placeholder?: string;
  ariaLabel?: string;
  compact?: boolean;
}

const ProductCodeCombobox: React.FC<ProductCodeComboboxProps> = ({
  value,
  products,
  onChangeValue,
  onSelectProduct,
  placeholder = 'Chọn / nhập mã hàng...',
  ariaLabel = 'Mã hàng',
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q
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
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
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
          className={`w-full pr-6 font-mono bg-white border rounded-lg focus:outline-none focus:border-[#14539E] ${
            compact
              ? 'h-7 px-2 text-xs border-[#14539E]'
              : 'h-8 px-2.5 text-xs border-slate-300'
          }`}
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
        <div className="absolute left-0 right-0 mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
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
  );
};

export const StChangeRequestsTab: React.FC<StChangeRequestsTabProps> = ({
  changeRequests,
  products,
  companyDepartments = DEFAULT_COMPANY_DEPARTMENTS,
  isLoading,
  onRefresh,
  onShowToast,
}) => {
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(true);

  const departmentOptions = useMemo(
    () =>
      mergeCompanyDepartmentOptions(
        companyDepartments,
        changeRequests.map((r) => r.department)
      ),
    [companyDepartments, changeRequests]
  );

  // New Change Request form state
  const [newDept, setNewDept] = useState<string>('');
  const [newContent, setNewContent] = useState<string>('');
  const [newReceivedAt, setNewReceivedAt] = useState<string>(() =>
    getLocalIsoDateToday()
  );
  const [newProductCode, setNewProductCode] = useState<string>('');
  const [newSpec, setNewSpec] = useState<string>('');
  const [newStatus, setNewStatus] = useState<StChangeRequestStatus>('Mới');
  const [newProcessedAt, setNewProcessedAt] = useState<string>('');
  const [newAppliedVersion, setNewAppliedVersion] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Edit row state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDept, setEditDept] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [editReceivedAt, setEditReceivedAt] = useState<string>('');
  const [editProductCode, setEditProductCode] = useState<string>('');
  const [editSpec, setEditSpec] = useState<string>('');
  const [editStatus, setEditStatus] = useState<StChangeRequestStatus>('Mới');
  const [editProcessedAt, setEditProcessedAt] = useState<string>('');
  const [editAppliedVersion, setEditAppliedVersion] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const effectiveNewDept = newDept || departmentOptions[0] || '';

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return changeRequests.filter((req) => {
      if (deptFilter !== 'ALL' && req.department !== deptFilter) return false;
      if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
      if (q) {
        const hit =
          req.product_code.toLowerCase().includes(q) ||
          req.content.toLowerCase().includes(q) ||
          req.specification.toLowerCase().includes(q) ||
          req.department.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [changeRequests, deptFilter, statusFilter, searchQuery]);

  const handleAddRequest = async () => {
    if (!effectiveNewDept) {
      onShowToast?.('Vui lòng chọn Bộ phận yêu cầu.');
      return;
    }
    if (!newContent.trim()) {
      onShowToast?.('Vui lòng nhập Nội dung yêu cầu.');
      return;
    }
    setIsAdding(true);
    try {
      await createStChangeRequest({
        department: effectiveNewDept,
        content: newContent.trim(),
        received_at: newReceivedAt || getLocalIsoDateToday(),
        product_code: newProductCode.trim(),
        specification: newSpec.trim(),
        status: newStatus,
        processed_at: newProcessedAt || null,
        applied_version: newAppliedVersion.trim() || null,
        notes: newNotes.trim() || null,
      });
      await onRefresh();
      setNewContent('');
      setNewProductCode('');
      setNewSpec('');
      setNewStatus('Mới');
      setNewProcessedAt('');
      setNewAppliedVersion('');
      setNewNotes('');
      onShowToast?.('Đã thêm phiếu yêu cầu thay đổi mới.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (req: StChangeRequest) => {
    setEditingId(req.id);
    setEditDept(req.department);
    setEditContent(req.content);
    setEditReceivedAt(req.received_at);
    setEditProductCode(req.product_code);
    setEditSpec(req.specification);
    setEditStatus(req.status);
    setEditProcessedAt(req.processed_at || '');
    setEditAppliedVersion(req.applied_version || '');
    setEditNotes(req.notes || '');
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (id: string) => {
    setBusyId(id);
    try {
      await updateStChangeRequest(id, {
        department: editDept,
        content: editContent,
        received_at: editReceivedAt || getLocalIsoDateToday(),
        product_code: editProductCode,
        specification: editSpec,
        status: editStatus,
        processed_at: editProcessedAt || null,
        applied_version: editAppliedVersion || null,
        notes: editNotes || null,
      });
      await onRefresh();
      setEditingId(null);
      onShowToast?.('Đã cập nhật phiếu yêu cầu.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteStChangeRequest(id);
      await onRefresh();
      setConfirmDeleteId(null);
      onShowToast?.('Đã xóa phiếu yêu cầu.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Top Filter Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Lọc theo Bộ phận yêu cầu"
            className="h-8 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
          >
            <option value="ALL">Tất cả Bộ phận YC</option>
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Lọc theo Tình trạng xử lý"
            className="h-8 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
          >
            <option value="ALL">Tất cả Tình trạng</option>
            {ST_CHANGE_REQUEST_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã hàng, nội dung..."
              aria-label="Tìm kiếm phiếu yêu cầu"
              className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
            showAddForm
              ? 'bg-[#14539E] text-white border-[#14539E]'
              : 'bg-white text-[#14539E] border-[#14539E]/40 hover:bg-blue-50'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddForm ? 'Ẩn khung thêm phiếu' : 'Thêm phiếu yêu cầu'}</span>
        </button>
      </div>

      {/* Quick-Add Change Request Form */}
      {showAddForm && (
        <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40 shrink-0">
                <select
                  value={effectiveNewDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  aria-label="Bộ phận yêu cầu mới"
                  className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
                >
                  {departmentOptions.length === 0 ? (
                    <option value="">-- Chưa có Bộ phận --</option>
                  ) : (
                    departmentOptions.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex-1 min-w-[220px]">
                <input
                  type="text"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Nội dung yêu cầu *"
                  aria-label="Nội dung yêu cầu mới"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>

              <div className="w-[140px] shrink-0">
                <input
                  type="date"
                  value={newReceivedAt}
                  onChange={(e) => setNewReceivedAt(e.target.value)}
                  aria-label="Ngày tiếp nhận"
                  title="Ngày tiếp nhận"
                  className="w-full h-8 px-2 text-[11px] font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>

              <div className="w-48 shrink-0">
                <ProductCodeCombobox
                  value={newProductCode}
                  products={products}
                  ariaLabel="Mã hàng phiếu yêu cầu mới"
                  onChangeValue={(code) => setNewProductCode(code)}
                  onSelectProduct={(prod) => {
                    setNewProductCode(prod.product_code);
                    setNewSpec(prod.specification || '');
                  }}
                />
              </div>

              <div className="w-36 shrink-0">
                <input
                  type="text"
                  value={newSpec}
                  onChange={(e) => setNewSpec(e.target.value)}
                  placeholder="Quy cách"
                  aria-label="Quy cách mới"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/70">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">
                  Tình trạng:
                </span>
                <select
                  value={newStatus}
                  onChange={(e) => {
                    const nextStatus = e.target.value as StChangeRequestStatus;
                    setNewStatus(nextStatus);
                    if (
                      (nextStatus === 'Đã xử lý' ||
                        nextStatus === 'Đã áp dụng') &&
                      !newProcessedAt
                    ) {
                      setNewProcessedAt(getLocalIsoDateToday());
                    }
                  }}
                  aria-label="Tình trạng xử lý mới"
                  className="h-8 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
                >
                  {ST_CHANGE_REQUEST_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">
                  Ngày xử lý:
                </span>
                <input
                  type="date"
                  value={newProcessedAt}
                  onChange={(e) => setNewProcessedAt(e.target.value)}
                  aria-label="Ngày xử lý mới"
                  className="h-8 px-2 text-[11px] font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>

              <div className="w-32 shrink-0">
                <input
                  type="text"
                  value={newAppliedVersion}
                  onChange={(e) => setNewAppliedVersion(e.target.value)}
                  placeholder="Phiên bản"
                  aria-label="Phiên bản áp dụng mới"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>

              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Ghi chú thêm (nếu có)..."
                aria-label="Ghi chú phiếu yêu cầu mới"
                className="flex-1 min-w-[180px] h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />

              <button
                type="button"
                disabled={isAdding}
                onClick={() => void handleAddRequest()}
                className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isAdding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Thêm phiếu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strictly 10-Column Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && changeRequests.length === 0 ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
            <span>Đang tải danh sách phiếu yêu cầu...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ClipboardList className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500">
              {changeRequests.length === 0
                ? 'Chưa có phiếu yêu cầu thay đổi nào. Hãy nhập thông tin phía trên để tạo phiếu mới.'
                : 'Không có phiếu yêu cầu nào khớp bộ lọc hiện tại.'}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-2 py-2 w-10 text-center border-r border-slate-200/70">
                  STT
                </th>
                <th className="px-2 py-2 w-28 border-r border-slate-200/70">
                  Bộ phận YC
                </th>
                <th className="px-2 py-2 border-r border-slate-200/70">
                  Nội dung yêu cầu
                </th>
                <th className="px-2 py-2 w-24 border-r border-slate-200/70">
                  Ngày tiếp nhận
                </th>
                <th className="px-2 py-2 w-24 border-r border-slate-200/70">
                  Mã hàng
                </th>
                <th className="px-2 py-2 w-24 border-r border-slate-200/70">
                  Quy cách
                </th>
                <th className="px-2 py-2 w-24 border-r border-slate-200/70">
                  Tình trạng xử lý
                </th>
                <th className="px-2 py-2 w-24 border-r border-slate-200/70">
                  Ngày xử lý
                </th>
                <th className="px-2 py-2 w-20 border-r border-slate-200/70">
                  Phiên bản áp dụng
                </th>
                <th className="px-2 py-2 w-44">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredRequests.map((req, idx) => {
                const isEditing = editingId === req.id;
                const isBusy = busyId === req.id;
                const badge = ST_STATUS_BADGE_META[req.status];

                return (
                  <tr
                    key={req.id}
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-2 py-1.5 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                      {formatNumberVN(idx + 1)}
                    </td>

                    <td className="px-2.5 py-1.5 border-r border-slate-100 font-semibold text-slate-800">
                      {isEditing ? (
                        <select
                          value={editDept}
                          onChange={(e) => setEditDept(e.target.value)}
                          aria-label="Sửa Bộ phận YC"
                          className="w-full h-7 px-1.5 text-xs border border-[#14539E] rounded bg-white"
                        >
                          {departmentOptions.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      ) : (
                        req.department
                      )}
                    </td>

                    <td className="px-2.5 py-1.5 border-r border-slate-100 text-slate-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          aria-label="Sửa Nội dung yêu cầu"
                          className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                        />
                      ) : (
                        req.content
                      )}
                    </td>

                    <td className="px-2.5 py-1.5 border-r border-slate-100 font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editReceivedAt}
                          onChange={(e) => setEditReceivedAt(e.target.value)}
                          aria-label="Sửa Ngày tiếp nhận"
                          className="w-full h-7 px-1 text-[11px] font-mono border border-[#14539E] rounded bg-white"
                        />
                      ) : (
                        formatStDateVN(req.received_at)
                      )}
                    </td>

                    <td className="px-2.5 py-1.5 border-r border-slate-100 font-mono font-semibold text-[#14539E]">
                      {isEditing ? (
                        <ProductCodeCombobox
                          value={editProductCode}
                          products={products}
                          compact
                          ariaLabel="Sửa Mã hàng"
                          onChangeValue={(code) => setEditProductCode(code)}
                          onSelectProduct={(prod) => {
                            setEditProductCode(prod.product_code);
                            setEditSpec(prod.specification || '');
                          }}
                        />
                      ) : (
                        req.product_code || '—'
                      )}
                    </td>

                    <td className="px-2.5 py-1.5 border-r border-slate-100 text-slate-600">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editSpec}
                          onChange={(e) => setEditSpec(e.target.value)}
                          aria-label="Sửa Quy cách"
                          className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                        />
                      ) : (
                        req.specification || '—'
                      )}
                    </td>

                    <td className="px-2.5 py-1.5 border-r border-slate-100">
                      {isEditing ? (
                        <select
                          value={editStatus}
                          onChange={(e) => {
                            const nextSt = e.target
                              .value as StChangeRequestStatus;
                            setEditStatus(nextSt);
                            if (
                              (nextSt === 'Đã xử lý' ||
                                nextSt === 'Đã áp dụng') &&
                              !editProcessedAt
                            ) {
                              setEditProcessedAt(getLocalIsoDateToday());
                            }
                          }}
                          aria-label="Sửa Tình trạng xử lý"
                          className="w-full h-7 px-1.5 text-xs border border-[#14539E] rounded bg-white"
                        >
                          {ST_CHANGE_REQUEST_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                        >
                          {req.status}
                        </span>
                      )}
                    </td>

                    <td className="px-2.5 py-1.5 border-r border-slate-100 font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editProcessedAt}
                          onChange={(e) => setEditProcessedAt(e.target.value)}
                          aria-label="Sửa Ngày xử lý"
                          className="w-full h-7 px-1 text-[11px] font-mono border border-[#14539E] rounded bg-white"
                        />
                      ) : (
                        formatStDateVN(req.processed_at)
                      )}
                    </td>

                    <td className="px-2.5 py-1.5 border-r border-slate-100 font-mono text-slate-700">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editAppliedVersion}
                          onChange={(e) =>
                            setEditAppliedVersion(e.target.value)
                          }
                          aria-label="Sửa Phiên bản áp dụng"
                          className="w-full h-7 px-2 text-xs font-mono border border-[#14539E] rounded bg-white"
                        />
                      ) : (
                        req.applied_version || '—'
                      )}
                    </td>

                    {/* Column 10: Ghi chú + inline Edit/Delete controls */}
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            aria-label="Sửa Ghi chú"
                            className="flex-1 min-w-0 h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                          />
                        ) : (
                          <span className="text-slate-600 truncate">
                            {req.notes || '—'}
                          </span>
                        )}

                        <div className="inline-flex items-center gap-1 shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleSaveEdit(req.id)}
                                aria-label="Lưu phiếu yêu cầu"
                                title="Lưu"
                                className="w-7 h-7 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center justify-center cursor-pointer"
                              >
                                {isBusy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                aria-label="Hủy sửa phiếu yêu cầu"
                                title="Hủy"
                                className="w-7 h-7 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : confirmDeleteId === req.id ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDelete(req.id)}
                                className="h-7 px-2 rounded-md bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Xác nhận
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="h-7 px-2 rounded-md border border-slate-300 text-slate-600 text-[11px] cursor-pointer"
                              >
                                Hủy
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(req)}
                                aria-label="Sửa phiếu yêu cầu"
                                title="Sửa phiếu"
                                className="w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:border-[#14539E] hover:text-[#14539E] inline-flex items-center justify-center cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(req.id)}
                                aria-label="Xóa phiếu yêu cầu"
                                title="Xóa phiếu"
                                className="w-7 h-7 rounded-md border border-red-200 text-red-500 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
