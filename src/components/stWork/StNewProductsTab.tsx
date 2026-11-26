import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  PackageOpen,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  calculateCompletionDays,
  formatNumberVN,
  formatStDateVN,
  getLocalIsoDateToday,
  StCustomer,
  StLine,
  StNewProductStatus,
  StProduct,
  StProductWithStatus,
} from '../../utils/stWorkLogic';
import {
  createStCustomer,
  createStLine,
  createStProduct,
  deleteStProduct,
  updateStProduct,
  uploadImageToHrBucket,
  upsertStNewProductStatus,
} from '../../services/stWorkService';

export interface StNewProductsTabProps {
  lines: StLine[];
  customers: StCustomer[];
  productsWithStatus: StProductWithStatus[];
  isLoading: boolean;
  onStatusUpdated: (saved: StNewProductStatus) => void;
  onRefresh: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

interface ProductStatusDraft {
  has_process: boolean;
  process_created_at: string;
  has_unit_price: boolean;
  unit_price: string;
  price_created_at: string;
  price_applied_at: string;
  notes: string;
}

type StatusFilterMode = 'all' | 'completed' | 'in_progress';

function toDraft(status: StNewProductStatus | null): ProductStatusDraft {
  return {
    has_process: Boolean(status?.has_process),
    process_created_at: status?.process_created_at || '',
    has_unit_price: Boolean(status?.has_unit_price),
    unit_price:
      status?.unit_price !== null && status?.unit_price !== undefined
        ? String(status.unit_price)
        : '',
    price_created_at: status?.price_created_at || '',
    price_applied_at: status?.price_applied_at || '',
    notes: status?.notes || '',
  };
}

export const StNewProductsTab: React.FC<StNewProductsTabProps> = ({
  lines,
  customers,
  productsWithStatus,
  isLoading,
  onStatusUpdated,
  onRefresh,
  onShowToast,
}) => {
  // Filter & Search state
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Registration bar state (merged Danh mục sản phẩm)
  const [newProdLine, setNewProdLine] = useState<string>('');
  const [newProdCustomer, setNewProdCustomer] = useState<string>('');
  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdCode, setNewProdCode] = useState<string>('');
  const [newProdSpec, setNewProdSpec] = useState<string>('');
  const [newProdImageUrl, setNewProdImageUrl] = useState<string>('');
  const [isUploadingNewImg, setIsUploadingNewImg] = useState<boolean>(false);
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);

  // Quick-add Line popup state
  const [quickLineModalOpen, setQuickLineModalOpen] = useState<boolean>(false);
  const [quickLineName, setQuickLineName] = useState<string>('');
  const [quickLineDesc, setQuickLineDesc] = useState<string>('');
  const [isSavingQuickLine, setIsSavingQuickLine] = useState<boolean>(false);

  // Quick-add Customer popup state
  const [quickCustModalOpen, setQuickCustModalOpen] = useState<boolean>(false);
  const [quickCustShort, setQuickCustShort] = useState<string>('');
  const [quickCustFull, setQuickCustFull] = useState<string>('');
  const [quickCustNotes, setQuickCustNotes] = useState<string>('');
  const [isSavingQuickCust, setIsSavingQuickCust] = useState<boolean>(false);

  // Detail modal state (click Mã hàng to inspect full details)
  const [detailProductId, setDetailProductId] = useState<string | null>(null);

  // Full edit modal state (product metadata + process/price/notes)
  const [editingItem, setEditingItem] = useState<StProductWithStatus | null>(null);
  const [editProdLine, setEditProdLine] = useState<string>('');
  const [editProdCustomer, setEditProdCustomer] = useState<string>('');
  const [editProdName, setEditProdName] = useState<string>('');
  const [editProdCode, setEditProdCode] = useState<string>('');
  const [editProdSpec, setEditProdSpec] = useState<string>('');
  const [editProdImageUrl, setEditProdImageUrl] = useState<string>('');
  const [editHasProcess, setEditHasProcess] = useState<boolean>(false);
  const [editProcessCreatedAt, setEditProcessCreatedAt] = useState<string>('');
  const [editHasUnitPrice, setEditHasUnitPrice] = useState<boolean>(false);
  const [editUnitPrice, setEditUnitPrice] = useState<string>('');
  const [editPriceCreatedAt, setEditPriceCreatedAt] = useState<string>('');
  const [editPriceAppliedAt, setEditPriceAppliedAt] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isUploadingEditImg, setIsUploadingEditImg] = useState<boolean>(false);
  const [isSavingEditProduct, setIsSavingEditProduct] = useState<boolean>(false);

  // Delete confirmation & broken/preview images
  const [confirmDeleteProdId, setConfirmDeleteProdId] = useState<string | null>(null);
  const [deletingProdId, setDeletingProdId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Status inline editing drafts
  const [drafts, setDrafts] = useState<Record<string, ProductStatusDraft>>({});
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});

  const effectiveNewLine = newProdLine || lines[0]?.name || '';
  const effectiveNewCustomer = newProdCustomer || customers[0]?.short_name || '';

  // Sync incoming Supabase/Realtime updates for rows not currently being edited
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, ProductStatusDraft> = {};
      for (const item of productsWithStatus) {
        const pid = item.product.id;
        if (dirtyMap[pid] && prev[pid]) {
          next[pid] = prev[pid];
        } else {
          next[pid] = toDraft(item.status);
        }
      }
      return next;
    });
  }, [productsWithStatus, dirtyMap]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return productsWithStatus.filter((item) => {
      if (lineFilter !== 'ALL' && item.product.line_name !== lineFilter) {
        return false;
      }
      if (
        customerFilter !== 'ALL' &&
        item.product.customer_short_name !== customerFilter
      ) {
        return false;
      }
      if (statusFilter === 'completed' && !item.isCompleted) return false;
      if (statusFilter === 'in_progress' && item.isCompleted) return false;

      if (q) {
        const hit =
          item.product.product_code.toLowerCase().includes(q) ||
          item.product.product_name.toLowerCase().includes(q) ||
          item.product.specification.toLowerCase().includes(q) ||
          item.product.customer_short_name.toLowerCase().includes(q) ||
          item.product.line_name.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    productsWithStatus,
    lineFilter,
    customerFilter,
    statusFilter,
    searchQuery,
  ]);

  const summaryCounts = useMemo(() => {
    const total = productsWithStatus.length;
    const completed = productsWithStatus.filter((i) => i.isCompleted).length;
    const inProgress = total - completed;
    return { total, completed, inProgress };
  }, [productsWithStatus]);

  const lineNames = useMemo(() => {
    const set = new Set<string>(lines.map((l) => l.name));
    productsWithStatus.forEach((p) => {
      if (p.product.line_name) set.add(p.product.line_name);
    });
    return Array.from(set);
  }, [lines, productsWithStatus]);

  const customerNames = useMemo(() => {
    const set = new Set<string>(customers.map((c) => c.short_name));
    productsWithStatus.forEach((p) => {
      if (p.product.customer_short_name) {
        set.add(p.product.customer_short_name);
      }
    });
    return Array.from(set);
  }, [customers, productsWithStatus]);

  const detailItem = useMemo(() => {
    if (!detailProductId) return null;
    return (
      productsWithStatus.find((item) => item.product.id === detailProductId) ||
      null
    );
  }, [detailProductId, productsWithStatus]);

  // Image upload with client-side compression via stWorkService
  const handleUploadProductImage = async (
    file: File,
    mode: 'new' | 'edit'
  ) => {
    if (mode === 'new') setIsUploadingNewImg(true);
    else setIsUploadingEditImg(true);

    try {
      const publicUrl = await uploadImageToHrBucket(file, 'st-products');
      if (mode === 'new') setNewProdImageUrl(publicUrl);
      else setEditProdImageUrl(publicUrl);
      onShowToast?.('Đã nén và tải ảnh sản phẩm lên hệ thống.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      if (mode === 'new') setIsUploadingNewImg(false);
      else setIsUploadingEditImg(false);
    }
  };

  // Register new product (saves to st_products + auto-creates st_new_product_status)
  const handleAddProduct = async () => {
    if (!effectiveNewLine) {
      onShowToast?.('Vui lòng chọn hoặc nhấn "+" để thêm Line sản xuất.');
      return;
    }
    if (!effectiveNewCustomer) {
      onShowToast?.('Vui lòng chọn hoặc nhấn "+" để thêm Khách hàng.');
      return;
    }
    if (!newProdName.trim() || !newProdCode.trim()) {
      onShowToast?.('Vui lòng nhập đầy đủ Tên hàng và Mã hàng.');
      return;
    }

    setIsAddingProduct(true);
    try {
      const { product } = await createStProduct({
        line_name: effectiveNewLine,
        customer_short_name: effectiveNewCustomer,
        product_name: newProdName.trim(),
        product_code: newProdCode.trim(),
        specification: newProdSpec.trim(),
        image_url: newProdImageUrl.trim() || null,
      });
      await onRefresh();
      setNewProdName('');
      setNewProdCode('');
      setNewProdSpec('');
      setNewProdImageUrl('');
      onShowToast?.(
        `Đã đăng ký mã hàng "${product.product_code}" và tự động khởi tạo dòng theo dõi.`
      );
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsAddingProduct(false);
    }
  };

  // Quick-add Line popup handler
  const handleSaveQuickLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLineName.trim()) {
      onShowToast?.('Vui lòng nhập tên Line.');
      return;
    }
    setIsSavingQuickLine(true);
    try {
      const nextSort =
        lines.reduce((max, l) => Math.max(max, l.sort_order || 0), 0) + 1;
      const created = await createStLine({
        name: quickLineName.trim(),
        description: quickLineDesc.trim() || null,
        sort_order: nextSort,
      });
      await onRefresh();
      setNewProdLine(created.name);
      setQuickLineName('');
      setQuickLineDesc('');
      setQuickLineModalOpen(false);
      onShowToast?.(`Đã thêm nhanh Line "${created.name}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingQuickLine(false);
    }
  };

  // Quick-add Customer popup handler
  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustShort.trim()) {
      onShowToast?.('Vui lòng nhập Tên viết tắt của khách hàng.');
      return;
    }
    setIsSavingQuickCust(true);
    try {
      const created = await createStCustomer({
        short_name: quickCustShort.trim(),
        full_name: quickCustFull.trim() || quickCustShort.trim(),
        notes: quickCustNotes.trim() || null,
      });
      await onRefresh();
      setNewProdCustomer(created.short_name);
      setQuickCustShort('');
      setQuickCustFull('');
      setQuickCustNotes('');
      setQuickCustModalOpen(false);
      onShowToast?.(`Đã thêm nhanh Khách hàng "${created.short_name}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingQuickCust(false);
    }
  };

  // Edit full product & status modal handlers
  const handleOpenEditProduct = (item: StProductWithStatus) => {
    const p = item.product;
    const currentDraft = drafts[p.id] || toDraft(item.status);
    setEditingItem(item);
    setEditProdLine(p.line_name);
    setEditProdCustomer(p.customer_short_name);
    setEditProdName(p.product_name);
    setEditProdCode(p.product_code);
    setEditProdSpec(p.specification);
    setEditProdImageUrl(p.image_url || '');
    setEditHasProcess(currentDraft.has_process);
    setEditProcessCreatedAt(currentDraft.process_created_at);
    setEditHasUnitPrice(currentDraft.has_unit_price);
    setEditUnitPrice(currentDraft.unit_price);
    setEditPriceCreatedAt(currentDraft.price_created_at);
    setEditPriceAppliedAt(currentDraft.price_applied_at);
    setEditNotes(currentDraft.notes);
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const trimmedPrice = editUnitPrice.trim();
    const parsedPrice = trimmedPrice === '' ? null : Number(trimmedPrice);
    if (trimmedPrice !== '' && (Number.isNaN(parsedPrice) || (parsedPrice ?? 0) < 0)) {
      onShowToast?.('Đơn giá phải là số không âm hợp lệ.');
      return;
    }

    const pid = editingItem.product.id;
    setIsSavingEditProduct(true);
    try {
      await updateStProduct(pid, {
        line_name: editProdLine,
        customer_short_name: editProdCustomer,
        product_name: editProdName,
        product_code: editProdCode,
        specification: editProdSpec,
        image_url: editProdImageUrl || null,
      });

      const savedStatus = await upsertStNewProductStatus({
        id: editingItem.status?.id || null,
        product_id: pid,
        has_process: editHasProcess,
        process_created_at: editProcessCreatedAt || null,
        has_unit_price: editHasUnitPrice,
        unit_price: parsedPrice,
        currency: editingItem.status?.currency || 'VND',
        price_created_at: editPriceCreatedAt || null,
        price_applied_at: editPriceAppliedAt || null,
        notes: editNotes.trim() || null,
      });

      setDirtyMap((prev) => {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      });
      setDrafts((prev) => ({ ...prev, [pid]: toDraft(savedStatus) }));
      onStatusUpdated(savedStatus);

      setBrokenImages((prev) => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
      await onRefresh();
      onShowToast?.(`Đã cập nhật thông tin mã hàng "${editProdCode.trim()}".`);
      setEditingItem(null);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingEditProduct(false);
    }
  };

  const handleDeleteProduct = async (p: StProduct) => {
    setDeletingProdId(p.id);
    try {
      await deleteStProduct(p.id);
      await onRefresh();
      setConfirmDeleteProdId(null);
      onShowToast?.(`Đã xóa mã hàng "${p.product_code}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setDeletingProdId(null);
    }
  };

  // Status inline edit persistence
  const persistDraft = async (
    item: StProductWithStatus,
    overrideDraft?: ProductStatusDraft,
    toastLabel?: string
  ) => {
    const pid = item.product.id;
    const draft = overrideDraft || drafts[pid] || toDraft(item.status);

    const trimmedPrice = draft.unit_price.trim();
    const parsedPrice = trimmedPrice === '' ? null : Number(trimmedPrice);
    if (trimmedPrice !== '' && Number.isNaN(parsedPrice)) {
      onShowToast?.('Đơn giá phải là số hợp lệ.');
      return;
    }

    setSavingMap((prev) => ({ ...prev, [pid]: true }));
    try {
      const saved = await upsertStNewProductStatus({
        id: item.status?.id || null,
        product_id: pid,
        has_process: draft.has_process,
        process_created_at: draft.process_created_at || null,
        has_unit_price: draft.has_unit_price,
        unit_price: parsedPrice,
        currency: item.status?.currency || 'VND',
        price_created_at: draft.price_created_at || null,
        price_applied_at: draft.price_applied_at || null,
        notes: draft.notes.trim() || null,
      });
      setDirtyMap((prev) => {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      });
      setDrafts((prev) => ({ ...prev, [pid]: toDraft(saved) }));
      onStatusUpdated(saved);
      if (toastLabel) {
        onShowToast?.(toastLabel);
      }
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingMap((prev) => {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      });
    }
  };

  const handleToggleProcess = (item: StProductWithStatus, checked: boolean) => {
    const pid = item.product.id;
    const current = drafts[pid] || toDraft(item.status);
    const updated: ProductStatusDraft = {
      ...current,
      has_process: checked,
      process_created_at: checked
        ? current.process_created_at || getLocalIsoDateToday()
        : '',
    };
    setDrafts((prev) => ({ ...prev, [pid]: updated }));
    void persistDraft(
      item,
      updated,
      `Đã cập nhật quy trình mã hàng "${item.product.product_code}".`
    );
  };

  const handleToggleUnitPrice = (
    item: StProductWithStatus,
    checked: boolean
  ) => {
    const pid = item.product.id;
    const current = drafts[pid] || toDraft(item.status);
    const updated: ProductStatusDraft = {
      ...current,
      has_unit_price: checked,
      price_created_at: checked
        ? current.price_created_at || getLocalIsoDateToday()
        : '',
      unit_price: checked ? current.unit_price : '',
      price_applied_at: checked ? current.price_applied_at : '',
    };
    setDrafts((prev) => ({ ...prev, [pid]: updated }));
    void persistDraft(
      item,
      updated,
      `Đã cập nhật trạng thái đơn giá mã "${item.product.product_code}".`
    );
  };

  const handleDateChange = (
    item: StProductWithStatus,
    field: 'process_created_at' | 'price_created_at' | 'price_applied_at',
    value: string
  ) => {
    const pid = item.product.id;
    const current = drafts[pid] || toDraft(item.status);
    const updated: ProductStatusDraft = {
      ...current,
      [field]: value,
      ...(field === 'process_created_at' && value ? { has_process: true } : {}),
      ...((field === 'price_created_at' || field === 'price_applied_at') &&
      value
        ? { has_unit_price: true }
        : {}),
    };
    setDrafts((prev) => ({ ...prev, [pid]: updated }));
    void persistDraft(item, updated);
  };

  const handleTextDraftChange = (
    item: StProductWithStatus,
    field: 'unit_price' | 'notes',
    value: string
  ) => {
    const pid = item.product.id;
    const current = drafts[pid] || toDraft(item.status);
    const updated: ProductStatusDraft = {
      ...current,
      [field]: value,
      ...(field === 'unit_price' && value.trim() !== ''
        ? { has_unit_price: true }
        : {}),
    };
    setDrafts((prev) => ({ ...prev, [pid]: updated }));
    setDirtyMap((prev) => ({ ...prev, [pid]: true }));
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Filter & KPI Strip */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative w-full sm:w-64 lg:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã hàng, tên hàng, quy cách..."
            aria-label="Tìm kiếm mã hàng mới"
            className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          aria-label="Lọc theo Line"
          className="h-8 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
        >
          <option value="ALL">Tất cả Line</option>
          {lineNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          aria-label="Lọc theo Khách hàng"
          className="h-8 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
        >
          <option value="ALL">Tất cả Khách hàng</option>
          {customerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="inline-flex items-center gap-1 p-0.5 bg-white border border-slate-300 rounded-lg">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-[#14539E] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({formatNumberVN(summaryCounts.total)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hoàn thành SX đại trà ({formatNumberVN(summaryCounts.completed)})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_progress')}
            className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'in_progress'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang dở dang ({formatNumberVN(summaryCounts.inProgress)})
          </button>
        </div>
      </div>

      {/* Product Registration Bar (Always visible, merged from Danh mục sản phẩm) */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-center p-2 rounded-xl bg-slate-50 border border-slate-200">
            {/* Line + quick "+" button */}
            <div className="lg:col-span-2 flex items-center gap-1">
              <select
                value={effectiveNewLine}
                onChange={(e) => setNewProdLine(e.target.value)}
                aria-label="Chọn Line sản xuất"
                className="flex-1 min-w-0 h-8 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {lines.length === 0 ? (
                  <option value="">-- Chưa có Line --</option>
                ) : (
                  lines.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                data-testid="st-quick-add-line-btn"
                onClick={() => setQuickLineModalOpen(true)}
                title="Thêm nhanh Line mới"
                aria-label="Thêm nhanh Line mới"
                className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:border-[#14539E] text-[#14539E] inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Khách hàng + quick "+" button */}
            <div className="lg:col-span-2 flex items-center gap-1">
              <select
                value={effectiveNewCustomer}
                onChange={(e) => setNewProdCustomer(e.target.value)}
                aria-label="Chọn Khách hàng"
                className="flex-1 min-w-0 h-8 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
              >
                {customers.length === 0 ? (
                  <option value="">-- Chưa có KH --</option>
                ) : (
                  customers.map((c) => (
                    <option key={c.id} value={c.short_name}>
                      {c.short_name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                data-testid="st-quick-add-customer-btn"
                onClick={() => setQuickCustModalOpen(true)}
                title="Thêm nhanh Khách hàng mới"
                aria-label="Thêm nhanh Khách hàng mới"
                className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:border-[#14539E] text-[#14539E] inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tên hàng */}
            <div className="lg:col-span-2">
              <input
                type="text"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="Tên hàng *"
                aria-label="Tên hàng mới"
                className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            {/* Mã hàng */}
            <div className="lg:col-span-2">
              <input
                type="text"
                value={newProdCode}
                onChange={(e) => setNewProdCode(e.target.value)}
                placeholder="Mã hàng *"
                aria-label="Mã hàng mới"
                className="w-full h-8 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            {/* Quy cách */}
            <div className="lg:col-span-1">
              <input
                type="text"
                value={newProdSpec}
                onChange={(e) => setNewProdSpec(e.target.value)}
                placeholder="Quy cách"
                aria-label="Quy cách mới"
                className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
            </div>

            {/* Hình ảnh (URL hoặc upload nén ảnh) */}
            <div className="lg:col-span-2 flex items-center gap-1">
              {newProdImageUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewImage({
                      url: newProdImageUrl,
                      title: newProdCode || newProdName || 'Ảnh xem trước',
                    })
                  }
                  title="Xem ảnh đã chọn"
                  className="w-8 h-8 rounded-lg border border-slate-300 overflow-hidden bg-white shrink-0 cursor-pointer"
                >
                  <img
                    src={newProdImageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </button>
              )}
              <input
                type="text"
                value={newProdImageUrl}
                onChange={(e) => setNewProdImageUrl(e.target.value)}
                placeholder="URL ảnh hoặc tải lên..."
                aria-label="URL hình ảnh sản phẩm"
                className="flex-1 min-w-0 h-8 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <label
                title="Tải ảnh từ máy tính (tự động nén nhẹ)"
                className="h-8 w-8 rounded-lg border border-slate-300 bg-white hover:border-[#14539E] text-slate-600 hover:text-[#14539E] inline-flex items-center justify-center cursor-pointer shrink-0"
              >
                {isUploadingNewImg ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#14539E]" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingNewImg}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadProductImage(file, 'new');
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {/* Nút Thêm */}
            <div className="lg:col-span-1 flex justify-end">
              <button
                type="button"
                disabled={isAddingProduct}
                onClick={() => void handleAddProduct()}
                className="w-full h-8 px-3 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isAddingProduct ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Thêm</span>
              </button>
          </div>
        </div>
      </div>

      {/* Main High-Density Unified Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && productsWithStatus.length === 0 ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
            <span>Đang tải danh mục mã hàng...</span>
          </div>
        ) : productsWithStatus.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <PackageOpen className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600">
              Chưa có mã hàng nào được đăng ký. Hãy điền thông tin ở thanh phía trên để thêm Mã hàng mới.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Không có mã hàng nào khớp bộ lọc hiện tại.
          </div>
        ) : (
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-2 py-2 w-12 text-center border-r border-slate-200/70">
                  STT
                </th>
                <th className="px-2.5 py-2 w-40 border-r border-slate-200/70">
                  Mã hàng
                </th>
                <th className="px-2.5 py-2 min-w-[180px] border-r border-slate-200/70">
                  Tên hàng
                </th>
                <th className="px-2.5 py-2 w-36 border-r border-slate-200/70">
                  Quy cách
                </th>
                <th className="px-2.5 py-2 w-48 border-r border-slate-200/70">
                  Quy trình
                </th>
                <th className="px-2.5 py-2 w-44 border-r border-slate-200/70">
                  Đơn giá
                </th>
                <th className="px-2.5 py-2 min-w-[190px] border-r border-slate-200/70">
                  Ghi chú
                </th>
                <th className="px-2 py-2 w-28 text-center">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredItems.map((item, idx) => {
                const p = item.product;
                const pid = p.id;
                const draft = drafts[pid] || toDraft(item.status);
                const isDirty = Boolean(dirtyMap[pid]);
                const isSaving = Boolean(savingMap[pid]);
                const isDeleting = deletingProdId === pid;
                const liveCompleted = Boolean(
                  draft.has_process && draft.price_applied_at
                );

                return (
                  <tr
                    key={pid}
                    className={`transition-colors ${
                      liveCompleted
                        ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                        : 'hover:bg-blue-50/30'
                    }`}
                  >
                    {/* 1. STT */}
                    <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                      {formatNumberVN(idx + 1)}
                    </td>

                    {/* 2. Mã hàng (khóa chính — bấm để mở Modal chi tiết) */}
                    <td className="px-2.5 py-2 border-r border-slate-100">
                      <button
                        type="button"
                        data-testid={`st-product-code-btn-${p.product_code}`}
                        onClick={() => setDetailProductId(pid)}
                        title="Bấm để xem chi tiết thông tin mã hàng"
                        className="font-mono font-bold text-[#14539E] hover:underline cursor-pointer text-left break-all"
                      >
                        {p.product_code}
                      </button>
                    </td>

                    {/* 3. Tên hàng */}
                    <td className="px-2.5 py-2 border-r border-slate-100 text-slate-900 font-medium">
                      {p.product_name}
                    </td>

                    {/* 4. Quy cách */}
                    <td className="px-2.5 py-2 border-r border-slate-100 text-slate-600">
                      {p.specification || '—'}
                    </td>

                    {/* 5. Quy trình: Checkbox nhanh + Ngày tạo quy trình gọn gàng */}
                    <td className="px-2.5 py-2 border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={draft.has_process}
                          onChange={(e) =>
                            handleToggleProcess(item, e.target.checked)
                          }
                          aria-label={`Có quy trình cho ${p.product_code}`}
                          title="Tích nếu đã có quy trình"
                          className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                        />
                        <input
                          type="date"
                          value={draft.process_created_at}
                          onChange={(e) =>
                            handleDateChange(
                              item,
                              'process_created_at',
                              e.target.value
                            )
                          }
                          aria-label={`Ngày tạo quy trình ${p.product_code}`}
                          className="flex-1 min-w-0 h-7 px-1.5 text-[11px] font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#14539E]"
                        />
                      </div>
                    </td>

                    {/* 6. Đơn giá: Checkbox nhanh + Nhập/hiển thị mức đơn giá */}
                    <td className="px-2.5 py-2 border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={draft.has_unit_price}
                          onChange={(e) =>
                            handleToggleUnitPrice(item, e.target.checked)
                          }
                          aria-label={`Có đơn giá cho ${p.product_code}`}
                          title="Tích nếu đã có đơn giá"
                          className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                        />
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={draft.unit_price}
                          onChange={(e) =>
                            handleTextDraftChange(
                              item,
                              'unit_price',
                              e.target.value
                            )
                          }
                          onBlur={() => {
                            if (isDirty) void persistDraft(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          placeholder="Đơn giá..."
                          aria-label={`Đơn giá ${p.product_code}`}
                          className="flex-1 min-w-0 h-7 px-1.5 text-xs font-mono text-right bg-white border border-slate-300 rounded focus:outline-none focus:border-[#14539E]"
                        />
                      </div>
                    </td>

                    {/* 7. Ghi chú */}
                    <td className="px-2.5 py-2 border-r border-slate-100">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={draft.notes}
                          onChange={(e) =>
                            handleTextDraftChange(item, 'notes', e.target.value)
                          }
                          onBlur={() => {
                            if (isDirty) void persistDraft(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void persistDraft(
                                item,
                                undefined,
                                `Đã lưu ghi chú mã "${p.product_code}".`
                              );
                            }
                          }}
                          placeholder="Ghi chú..."
                          aria-label={`Ghi chú ${p.product_code}`}
                          className="flex-1 min-w-0 h-7 px-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#14539E]"
                        />

                        {isSaving ? (
                          <span
                            title="Đang lưu trạng thái..."
                            className="w-6 h-7 rounded-md bg-blue-50 text-[#14539E] inline-flex items-center justify-center shrink-0"
                          >
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          </span>
                        ) : isDirty ? (
                          <button
                            type="button"
                            onClick={() =>
                              void persistDraft(
                                item,
                                undefined,
                                `Đã lưu cập nhật mã "${p.product_code}".`
                              )
                            }
                            aria-label={`Lưu trạng thái ${p.product_code}`}
                            title="Lưu trạng thái"
                            className="w-7 h-7 rounded-md bg-[#14539E] hover:bg-[#0F3E77] text-white inline-flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span
                            title="Đã đồng bộ"
                            className="w-5 h-7 rounded-md text-slate-300 inline-flex items-center justify-center shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 8. Thao tác */}
                    <td className="px-2 py-2 text-center">
                      {confirmDeleteProdId === pid ? (
                        <div className="inline-flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void handleDeleteProduct(p)}
                            className="h-7 px-2 rounded-md bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProdId(null)}
                            className="h-7 px-2 rounded-md border border-slate-300 text-slate-600 text-[11px] cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(item)}
                            aria-label={`Sửa thông tin mã hàng ${p.product_code}`}
                            title="Sửa đầy đủ thông tin mã hàng"
                            className="w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:border-[#14539E] hover:text-[#14539E] inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProdId(pid)}
                            aria-label={`Xóa mã hàng ${p.product_code}`}
                            title="Xóa mã hàng"
                            className="w-7 h-7 rounded-md border border-red-200 text-red-500 hover:bg-red-50 inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick-Add Line Modal */}
      {quickLineModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thêm nhanh Line sản xuất"
          onClick={() => setQuickLineModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveQuickLine}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Thêm nhanh Line sản xuất
              </h3>
              <button
                type="button"
                onClick={() => setQuickLineModalOpen(false)}
                aria-label="Đóng"
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên Line <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={quickLineName}
                  onChange={(e) => setQuickLineName(e.target.value)}
                  placeholder="VD: S Line, U1 Line..."
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mô tả / Ghi chú
                </label>
                <input
                  type="text"
                  value={quickLineDesc}
                  onChange={(e) => setQuickLineDesc(e.target.value)}
                  placeholder="Mô tả ngắn (nếu có)..."
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickLineModalOpen(false)}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingQuickLine}
                className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingQuickLine ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Lưu Line</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick-Add Customer Modal */}
      {quickCustModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thêm nhanh Khách hàng"
          onClick={() => setQuickCustModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveQuickCustomer}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Thêm nhanh Khách hàng
              </h3>
              <button
                type="button"
                onClick={() => setQuickCustModalOpen(false)}
                aria-label="Đóng"
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên viết tắt <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={quickCustShort}
                  onChange={(e) => setQuickCustShort(e.target.value)}
                  placeholder="VD: SAMSUNG, LG..."
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên chi tiết đầy đủ
                </label>
                <input
                  type="text"
                  value={quickCustFull}
                  onChange={(e) => setQuickCustFull(e.target.value)}
                  placeholder="Tên công ty khách hàng..."
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={quickCustNotes}
                  onChange={(e) => setQuickCustNotes(e.target.value)}
                  placeholder="Ghi chú thêm (nếu có)..."
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickCustModalOpen(false)}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingQuickCust}
                className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingQuickCust ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Lưu Khách hàng</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product Detail Modal (when clicking Mã hàng) */}
      {detailItem && (() => {
        const dp = detailItem.product;
        const dDraft = drafts[dp.id] || toDraft(detailItem.status);
        const detailCompleted = Boolean(
          dDraft.has_process && dDraft.price_applied_at
        );
        const detailDays = detailCompleted
          ? calculateCompletionDays(dp.created_at, dDraft.price_applied_at)
          : null;
        const imgBroken = Boolean(brokenImages[dp.id]);
        const unitPriceNum =
          dDraft.unit_price.trim() !== '' && !Number.isNaN(Number(dDraft.unit_price))
            ? Number(dDraft.unit_price)
            : null;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Chi tiết mã hàng ${dp.product_code}`}
            onClick={() => setDetailProductId(null)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-slate-50/70">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-base font-bold text-[#14539E] truncate">
                    {dp.product_code}
                  </span>
                  {detailCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" />
                      Hoàn thành SX đại trà
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      Đang dở dang
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailProductId(null)}
                  aria-label="Đóng chi tiết"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body: Clean 2-Column Layout */}
              <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Left Column: Product Image + Key Summary */}
                <div className="md:col-span-5 flex flex-col gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                    {dp.image_url && !imgBroken ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: dp.image_url!,
                            title: `${dp.product_code} - ${dp.product_name}`,
                          })
                        }
                        title="Bấm để phóng to toàn màn hình"
                        className="relative w-full aspect-square bg-white flex items-center justify-center cursor-pointer group overflow-hidden"
                      >
                        <img
                          src={dp.image_url}
                          alt={dp.product_name}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({
                              ...prev,
                              [dp.id]: true,
                            }))
                          }
                          className="w-full h-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-900/75 text-white text-[11px] font-medium inline-flex items-center gap-1 shadow-sm">
                          <Maximize2 className="w-3 h-3" />
                          Phóng to
                        </span>
                      </button>
                    ) : (
                      <div className="w-full aspect-square flex flex-col items-center justify-center gap-2 text-slate-400 p-4">
                        <ImageIcon className="w-10 h-10 text-slate-300" />
                        <span className="text-xs">Chưa có hình ảnh sản phẩm</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium">
                        Ngày đăng ký
                      </div>
                      <div className="mt-0.5 text-xs font-mono font-semibold text-slate-900 tabular-nums">
                        {formatStDateVN(dp.created_at) || '—'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium">
                        Số ngày hoàn thành
                      </div>
                      <div
                        className={`mt-0.5 text-xs font-mono font-bold tabular-nums ${
                          detailCompleted ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {detailCompleted
                          ? `${formatNumberVN(detailDays ?? 0)} ngày`
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Detailed Specs & Progress */}
                <div className="md:col-span-7 flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Mã hàng</div>
                      <div className="mt-0.5 font-mono font-bold text-[#14539E]">
                        {dp.product_code}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Tên hàng</div>
                      <div className="mt-0.5 font-semibold text-slate-900">
                        {dp.product_name}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Quy cách</div>
                      <div className="mt-0.5 font-medium text-slate-800">
                        {dp.specification || '—'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Line sản xuất</div>
                      <div className="mt-0.5 font-semibold text-slate-800">
                        {dp.line_name || '—'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Khách hàng</div>
                      <div className="mt-0.5 font-semibold text-slate-800">
                        {dp.customer_short_name || '—'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Hiện trạng</div>
                      <div className="mt-1">
                        {detailCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Hoàn thành SX đại trà
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                            <Clock className="w-3 h-3" />
                            Đang dở dang
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                      <div className="text-[11px] text-slate-500">
                        Trạng thái &amp; Ngày tạo quy trình
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className={`font-semibold ${
                            dDraft.has_process ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {dDraft.has_process ? 'Đã có quy trình' : 'Chưa có'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-700 tabular-nums">
                          {dDraft.process_created_at
                            ? formatStDateVN(dDraft.process_created_at)
                            : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                      <div className="text-[11px] text-slate-500">
                        Trạng thái &amp; Mức đơn giá
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className={`font-semibold ${
                            dDraft.has_unit_price ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {dDraft.has_unit_price ? 'Đã có đơn giá' : 'Chưa có'}
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {unitPriceNum !== null
                            ? `${formatNumberVN(unitPriceNum)} ${
                                detailItem.status?.currency || 'VND'
                              }`
                            : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">Ngày tạo đơn giá</div>
                      <div className="mt-0.5 font-mono font-medium text-slate-800 tabular-nums">
                        {dDraft.price_created_at
                          ? formatStDateVN(dDraft.price_created_at)
                          : '—'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                      <div className="text-[11px] text-slate-500">
                        Ngày áp dụng đơn giá SX đại trà
                      </div>
                      <div className="mt-0.5 font-mono font-medium text-slate-800 tabular-nums">
                        {dDraft.price_applied_at
                          ? formatStDateVN(dDraft.price_applied_at)
                          : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                    <div className="text-[11px] text-slate-500 font-medium mb-1">
                      Ghi chú
                    </div>
                    <div className="text-slate-800 whitespace-pre-wrap">
                      {dDraft.notes.trim() || 'Không có ghi chú.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setDetailProductId(null)}
                  className="h-8 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = detailItem;
                    setDetailProductId(null);
                    handleOpenEditProduct(target);
                  }}
                  className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full Edit Product & Status Modal */}
      {editingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Sửa thông tin mã hàng ${editingItem.product.product_code}`}
          onClick={() => setEditingItem(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveEditProduct}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
              <h3 className="text-sm font-bold text-slate-900">
                Cập nhật đầy đủ thông tin Mã hàng ({editingItem.product.product_code})
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                aria-label="Đóng"
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Product metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Line sản xuất <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editProdLine}
                    onChange={(e) => setEditProdLine(e.target.value)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#14539E]"
                  >
                    {lineNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Khách hàng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editProdCustomer}
                    onChange={(e) => setEditProdCustomer(e.target.value)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#14539E]"
                  >
                    {customerNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editProdCode}
                    onChange={(e) => setEditProdCode(e.target.value)}
                    className="w-full h-9 px-3 font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editProdName}
                    onChange={(e) => setEditProdName(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quy cách
                  </label>
                  <input
                    type="text"
                    value={editProdSpec}
                    onChange={(e) => setEditProdSpec(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hình ảnh (URL hoặc tải ảnh lên)
                  </label>
                  <div className="flex items-center gap-2">
                    {editProdImageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: editProdImageUrl,
                            title: editProdCode || editProdName || 'Ảnh sản phẩm',
                          })
                        }
                        title="Xem ảnh"
                        className="w-9 h-9 rounded-lg border border-slate-300 overflow-hidden bg-slate-50 shrink-0 cursor-pointer"
                      >
                        <img
                          src={editProdImageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    )}
                    <input
                      type="text"
                      value={editProdImageUrl}
                      onChange={(e) => setEditProdImageUrl(e.target.value)}
                      placeholder="Dán URL ảnh hoặc tải file..."
                      className="flex-1 h-9 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                    />
                    <label className="h-9 px-3 rounded-lg border border-slate-300 bg-white hover:border-[#14539E] text-slate-700 hover:text-[#14539E] inline-flex items-center gap-1.5 cursor-pointer shrink-0 font-semibold">
                      {isUploadingEditImg ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#14539E]" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>Tải ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingEditImg}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleUploadProductImage(file, 'edit');
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Process, Unit Price & Dates */}
              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editHasProcess}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditHasProcess(checked);
                        setEditProcessCreatedAt((prev) =>
                          checked ? prev || getLocalIsoDateToday() : ''
                        );
                      }}
                      className="w-4 h-4 accent-[#14539E] rounded cursor-pointer"
                    />
                    <span>Đã có quy trình</span>
                  </label>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Ngày tạo quy trình
                    </label>
                    <input
                      type="date"
                      value={editProcessCreatedAt}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditProcessCreatedAt(val);
                        if (val) setEditHasProcess(true);
                      }}
                      className="w-full h-9 px-2.5 font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editHasUnitPrice}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditHasUnitPrice(checked);
                        if (checked) {
                          setEditPriceCreatedAt(
                            (prev) => prev || getLocalIsoDateToday()
                          );
                        } else {
                          setEditUnitPrice('');
                          setEditPriceCreatedAt('');
                          setEditPriceAppliedAt('');
                        }
                      }}
                      className="w-4 h-4 accent-[#14539E] rounded cursor-pointer"
                    />
                    <span>Đã có đơn giá</span>
                  </label>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Mức đơn giá ({editingItem.status?.currency || 'VND'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editUnitPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditUnitPrice(val);
                        if (val.trim() !== '') setEditHasUnitPrice(true);
                      }}
                      placeholder="Nhập đơn giá..."
                      className="w-full h-9 px-2.5 font-mono text-right bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ngày tạo đơn giá
                  </label>
                  <input
                    type="date"
                    value={editPriceCreatedAt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditPriceCreatedAt(val);
                      if (val) setEditHasUnitPrice(true);
                    }}
                    className="w-full h-9 px-2.5 font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ngày áp dụng đơn giá SX đại trà
                  </label>
                  <input
                    type="date"
                    value={editPriceAppliedAt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditPriceAppliedAt(val);
                      if (val) setEditHasUnitPrice(true);
                    }}
                    className="w-full h-9 px-2.5 font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ghi chú
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Ghi chú thêm về quy trình, đơn giá, tiến độ..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingEditProduct}
                className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingEditProduct ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fullscreen Image Preview / Zoom Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.title}
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-900 truncate">
                {previewImage.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                aria-label="Đóng xem ảnh"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-900/5 flex items-center justify-center flex-1 min-h-0 overflow-auto">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                referrerPolicy="no-referrer"
                className="max-h-[80vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
