import React, { useMemo, useState } from 'react';
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
  getPendingWorkflowStep,
  isNewProductCompleted,
  ST_WORKFLOW_STEPS,
  StCustomer,
  StLine,
  StNewProductStatus,
  StProduct,
  StProductWithStatus,
  StWorkflowBoolField,
  StWorkflowDateField,
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

type StatusFilterMode = 'all' | 'completed' | 'in_progress';

interface ModalStepState {
  has_process_erp: boolean;
  process_erp_date: string;
  has_st: boolean;
  st_date: string;
}

function toModalStepState(status: StNewProductStatus | null): ModalStepState {
  return {
    has_process_erp: Boolean(status?.has_process_erp),
    process_erp_date: status?.process_erp_date || '',
    has_st: Boolean(status?.has_st),
    st_date: status?.st_date || '',
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

  // Registration bar state (always visible)
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

  // Modal A: Compact Mini Progress Modal (opened by clicking Action icon in table)
  const [progressModalItem, setProgressModalItem] =
    useState<StProductWithStatus | null>(null);
  const [miniSteps, setMiniSteps] = useState<ModalStepState>(() =>
    toModalStepState(null)
  );
  const [miniNotes, setMiniNotes] = useState<string>('');
  const [isSavingMini, setIsSavingMini] = useState<boolean>(false);

  // Modal B: Full Product Detail & Progress Modal (opened by clicking Mã hàng link)
  const [activeModalItem, setActiveModalItem] =
    useState<StProductWithStatus | null>(null);
  const [modalLine, setModalLine] = useState<string>('');
  const [modalCustomer, setModalCustomer] = useState<string>('');
  const [modalCode, setModalCode] = useState<string>('');
  const [modalName, setModalName] = useState<string>('');
  const [modalSpec, setModalSpec] = useState<string>('');
  const [modalImageUrl, setModalImageUrl] = useState<string>('');
  const [modalSteps, setModalSteps] = useState<ModalStepState>(() =>
    toModalStepState(null)
  );
  const [modalNotes, setModalNotes] = useState<string>('');
  const [isUploadingModalImg, setIsUploadingModalImg] = useState<boolean>(false);
  const [isSavingModal, setIsSavingModal] = useState<boolean>(false);

  // Delete confirmation (inside Full Detail Modal) & image preview state
  const [confirmDeleteInDetail, setConfirmDeleteInDetail] =
    useState<boolean>(false);
  const [isDeletingProduct, setIsDeletingProduct] = useState<boolean>(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const effectiveNewLine = newProdLine || lines[0]?.name || '';
  const effectiveNewCustomer = newProdCustomer || customers[0]?.short_name || '';

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

  // Live preview status inside Mini Progress Modal
  const miniLivePreview = useMemo(() => {
    if (!progressModalItem) {
      return {
        isCompleted: false,
        pendingStep: null,
        waitingLabel: 'Chưa tạo Quy trình ERP',
      };
    }
    const statusCandidate = {
      ...miniSteps,
      st_date: miniSteps.st_date || null,
    };
    const completed = isNewProductCompleted(statusCandidate);
    const pendingStep = getPendingWorkflowStep(statusCandidate);
    return {
      isCompleted: completed,
      pendingStep,
      waitingLabel: pendingStep
        ? pendingStep.waitingLabel
        : 'Hoàn thành SX đại trà',
    };
  }, [progressModalItem, miniSteps]);

  // Live preview status inside Full Detail Modal
  const modalLivePreview = useMemo(() => {
    if (!activeModalItem) {
      return {
        isCompleted: false,
        pendingStep: null,
        waitingLabel: 'Chưa tạo Quy trình ERP',
        completionDays: null as number | null,
      };
    }
    const statusCandidate = {
      ...modalSteps,
      st_date: modalSteps.st_date || null,
    };
    const completed = isNewProductCompleted(statusCandidate);
    const pendingStep = getPendingWorkflowStep(statusCandidate);
    const completionDays = completed
      ? calculateCompletionDays(
          activeModalItem.product.created_at,
          modalSteps.st_date
        )
      : null;

    return {
      isCompleted: completed,
      pendingStep,
      waitingLabel: pendingStep
        ? pendingStep.waitingLabel
        : 'Hoàn thành SX đại trà',
      completionDays,
    };
  }, [activeModalItem, modalSteps]);

  // Image upload with client-side compression via stWorkService
  const handleUploadProductImage = async (
    file: File,
    mode: 'new' | 'modal'
  ) => {
    if (mode === 'new') setIsUploadingNewImg(true);
    else setIsUploadingModalImg(true);

    try {
      const publicUrl = await uploadImageToHrBucket(file, 'st-products');
      if (mode === 'new') {
        setNewProdImageUrl(publicUrl);
      } else {
        setModalImageUrl(publicUrl);
        if (activeModalItem) {
          setBrokenImages((prev) => {
            const copy = { ...prev };
            delete copy[activeModalItem.product.id];
            return copy;
          });
        }
      }
      onShowToast?.('Đã nén và tải ảnh sản phẩm lên hệ thống.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      if (mode === 'new') setIsUploadingNewImg(false);
      else setIsUploadingModalImg(false);
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
        `Đã đăng ký mã hàng "${product.product_code}" và khởi tạo tiến độ theo dõi (Quy trình ERP → ST).`
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

  // Modal A handlers: Compact Mini Progress Modal
  const handleOpenProgressModal = (item: StProductWithStatus) => {
    setProgressModalItem(item);
    setMiniSteps(toModalStepState(item.status));
    setMiniNotes(item.status?.notes || '');
  };

  const handleCloseProgressModal = () => {
    if (isSavingMini) return;
    setProgressModalItem(null);
  };

  const handleToggleMiniStep = (
    boolField: StWorkflowBoolField,
    dateField: StWorkflowDateField,
    checked: boolean
  ) => {
    setMiniSteps((prev) => ({
      ...prev,
      [boolField]: checked,
      [dateField]: checked ? prev[dateField] || getLocalIsoDateToday() : '',
    }));
  };

  const handleChangeMiniStepDate = (
    boolField: StWorkflowBoolField,
    dateField: StWorkflowDateField,
    dateVal: string
  ) => {
    setMiniSteps((prev) => ({
      ...prev,
      [dateField]: dateVal,
      ...(dateVal ? { [boolField]: true } : {}),
    }));
  };

  const handleSaveMiniProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressModalItem) return;

    const pid = progressModalItem.product.id;
    setIsSavingMini(true);
    try {
      const savedStatus = await upsertStNewProductStatus({
        id: progressModalItem.status?.id || null,
        product_id: pid,
        has_process_erp: miniSteps.has_process_erp,
        process_erp_date: miniSteps.process_erp_date || null,
        has_st: miniSteps.has_st,
        st_date: miniSteps.st_date || null,
        unit_price: progressModalItem.status?.unit_price ?? null,
        currency: progressModalItem.status?.currency || 'VND',
        notes: miniNotes.trim() || null,
      });

      onStatusUpdated(savedStatus);
      await onRefresh();
      onShowToast?.(
        `Đã lưu tiến độ mã hàng "${progressModalItem.product.product_code}".`
      );
      setProgressModalItem(null);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingMini(false);
    }
  };

  // Modal B handlers: Full Product Detail & Progress Modal
  const handleOpenDetailModal = (item: StProductWithStatus) => {
    const p = item.product;
    setActiveModalItem(item);
    setConfirmDeleteInDetail(false);
    setModalLine(p.line_name);
    setModalCustomer(p.customer_short_name);
    setModalCode(p.product_code);
    setModalName(p.product_name);
    setModalSpec(p.specification);
    setModalImageUrl(p.image_url || '');
    setModalSteps(toModalStepState(item.status));
    setModalNotes(item.status?.notes || '');
  };

  const handleCloseDetailModal = () => {
    if (isSavingModal || isDeletingProduct) return;
    setConfirmDeleteInDetail(false);
    setActiveModalItem(null);
  };

  const handleToggleModalStep = (
    boolField: StWorkflowBoolField,
    dateField: StWorkflowDateField,
    checked: boolean
  ) => {
    setModalSteps((prev) => ({
      ...prev,
      [boolField]: checked,
      [dateField]: checked ? prev[dateField] || getLocalIsoDateToday() : '',
    }));
  };

  const handleChangeModalStepDate = (
    boolField: StWorkflowBoolField,
    dateField: StWorkflowDateField,
    dateVal: string
  ) => {
    setModalSteps((prev) => ({
      ...prev,
      [dateField]: dateVal,
      ...(dateVal ? { [boolField]: true } : {}),
    }));
  };

  const handleSaveModalUpdates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalItem) return;

    if (!modalLine || !modalCustomer || !modalCode.trim() || !modalName.trim()) {
      onShowToast?.(
        'Line, Khách hàng, Mã hàng và Tên hàng không được để trống.'
      );
      return;
    }

    const pid = activeModalItem.product.id;
    setIsSavingModal(true);
    try {
      await updateStProduct(pid, {
        line_name: modalLine,
        customer_short_name: modalCustomer,
        product_name: modalName.trim(),
        product_code: modalCode.trim(),
        specification: modalSpec.trim(),
        image_url: modalImageUrl.trim() || null,
      });

      const savedStatus = await upsertStNewProductStatus({
        id: activeModalItem.status?.id || null,
        product_id: pid,
        has_process_erp: modalSteps.has_process_erp,
        process_erp_date: modalSteps.process_erp_date || null,
        has_st: modalSteps.has_st,
        st_date: modalSteps.st_date || null,
        unit_price: activeModalItem.status?.unit_price ?? null,
        currency: activeModalItem.status?.currency || 'VND',
        notes: modalNotes.trim() || null,
      });

      onStatusUpdated(savedStatus);
      setBrokenImages((prev) => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
      await onRefresh();
      onShowToast?.(
        `Đã lưu cập nhật thông tin & tiến độ mã hàng "${modalCode.trim()}".`
      );
      setActiveModalItem(null);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleDeleteProduct = async (p: StProduct) => {
    setIsDeletingProduct(true);
    try {
      await deleteStProduct(p.id);
      await onRefresh();
      setConfirmDeleteInDetail(false);
      setActiveModalItem(null);
      if (progressModalItem?.product.id === p.id) {
        setProgressModalItem(null);
      }
      onShowToast?.(`Đã xóa mã hàng "${p.product_code}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsDeletingProduct(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* 1. Filter & KPI Strip (Search -> Line -> Customer -> Status) */}
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

      {/* 2. Always-Visible Product Registration Bar */}
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

      {/* 3. Read-Only 13-Column Table with Single-Row Sticky Header */}
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
            <thead className="sticky top-0 z-10 bg-slate-100 text-[10.5px] font-bold text-slate-600 uppercase tracking-tight shadow-[0_1px_0_0_rgba(203,213,225,1)]">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-100 px-1.5 py-2.5 w-9 min-w-[36px] max-w-[36px] text-center border-r border-b border-slate-200 whitespace-nowrap">
                  STT
                </th>
                <th className="px-1.5 py-2.5 w-14 min-w-[52px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  LINE
                </th>
                <th className="px-1.5 py-2.5 w-20 min-w-[74px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  KHÁCH HÀNG
                </th>
                <th className="px-2 py-2.5 w-24 min-w-[88px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  MÃ HÀNG
                </th>
                <th className="px-2 py-2.5 min-w-[96px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  TÊN HÀNG
                </th>
                <th className="px-1.5 py-2.5 w-18 min-w-[68px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  QUY CÁCH
                </th>
                <th className="px-1.5 py-2.5 w-24 min-w-[90px] text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  QUY TRÌNH ERP
                </th>
                <th className="px-1.5 py-2.5 w-22 min-w-[84px] text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  NGÀY TẠO QT
                </th>
                <th className="px-1.5 py-2.5 w-12 min-w-[44px] text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  ST
                </th>
                <th className="px-1.5 py-2.5 w-22 min-w-[84px] text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  NGÀY ÁP DỤNG
                </th>
                <th className="px-1.5 py-2.5 w-32 min-w-[128px] text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  HIỆN TRẠNG
                </th>
                <th className="px-1.5 py-2.5 min-w-[64px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  GHI CHÚ
                </th>
                <th className="px-1.5 py-2.5 w-[68px] min-w-[68px] text-center border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredItems.map((item, idx) => {
                const p = item.product;
                const pid = p.id;
                const st = item.status;
                const hasProcessErp = Boolean(st?.has_process_erp);
                const hasSt = Boolean(st?.has_st);
                const isWaitingSt = !hasSt && hasProcessErp;
                const stickyCellBg = item.isCompleted
                  ? 'bg-[#F4FBF7] group-hover:bg-[#EAF7F0]'
                  : 'bg-white group-hover:bg-[#F3F8FF]';

                return (
                  <tr
                    key={pid}
                    className={`group transition-colors ${
                      item.isCompleted
                        ? 'bg-[#F4FBF7] hover:bg-[#EAF7F0]'
                        : 'bg-white hover:bg-[#F3F8FF]'
                    }`}
                  >
                    {/* 1. STT (pinned left) */}
                    <td
                      className={`sticky left-0 z-[5] px-1.5 py-2.5 w-9 min-w-[36px] max-w-[36px] text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-200/80 transition-colors ${stickyCellBg}`}
                    >
                      {formatNumberVN(idx + 1)}
                    </td>

                    {/* 2. LINE */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-slate-700 font-medium whitespace-nowrap">
                      {p.line_name || '—'}
                    </td>

                    {/* 3. KHÁCH HÀNG */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-slate-700 font-medium whitespace-nowrap">
                      {p.customer_short_name || '—'}
                    </td>

                    {/* 4. MÃ HÀNG (#14539E, hover underline, click opens Full Detail Modal) */}
                    <td className="px-2 py-2.5 border-r border-slate-100">
                      <button
                        type="button"
                        data-testid={`st-product-code-btn-${p.product_code}`}
                        onClick={() => handleOpenDetailModal(item)}
                        title="Bấm để xem chi tiết thông tin mã hàng"
                        className="font-mono font-bold text-[#14539E] hover:underline cursor-pointer text-left whitespace-nowrap"
                      >
                        {p.product_code}
                      </button>
                    </td>

                    {/* 5. TÊN HÀNG */}
                    <td className="px-2 py-2.5 border-r border-slate-100 text-slate-900 font-medium">
                      {p.product_name}
                    </td>

                    {/* 6. QUY CÁCH */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-slate-600">
                      {p.specification || '—'}
                    </td>

                    {/* 7. QUY TRÌNH ERP (Icon-only) */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-center align-middle">
                      {hasProcessErp ? (
                        <span
                          title="Đã có Quy trình ERP"
                          aria-label="Quy trình ERP: Đã có"
                          className="inline-flex items-center justify-center"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </span>
                      ) : (
                        <span
                          title="Đang chờ Quy trình ERP"
                          aria-label="Quy trình ERP: Đang chờ"
                          className="inline-flex items-center justify-center"
                        >
                          <Clock className="w-4 h-4 text-amber-500" />
                        </span>
                      )}
                    </td>

                    {/* 8. NGÀY TẠO QT */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-center font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                      {formatStDateVN(st?.process_erp_date)}
                    </td>

                    {/* 9. ST (Icon-only) */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-center align-middle">
                      {hasSt ? (
                        <span
                          title="Đã hoàn thành ST"
                          aria-label="ST: Đã hoàn thành"
                          className="inline-flex items-center justify-center"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </span>
                      ) : isWaitingSt ? (
                        <span
                          title="Đã có Quy trình ERP – đang chờ ST"
                          aria-label="ST: Đang chờ"
                          className="inline-flex items-center justify-center"
                        >
                          <Clock className="w-4 h-4 text-amber-500" />
                        </span>
                      ) : (
                        <span
                          aria-label="ST: Chưa tới lượt"
                          className="text-slate-300 font-medium select-none"
                        >
                          —
                        </span>
                      )}
                    </td>

                    {/* 10. NGÀY ÁP DỤNG */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-center font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                      {formatStDateVN(st?.st_date)}
                    </td>

                    {/* 11. HIỆN TRẠNG (Auto Badge) */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-center align-middle whitespace-nowrap">
                      {item.isCompleted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold whitespace-nowrap">
                          Hoàn thành SX đại trà
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold whitespace-nowrap">
                          Đang dở dang
                        </span>
                      )}
                    </td>

                    {/* 12. GHI CHÚ */}
                    <td className="px-1.5 py-2.5 border-r border-slate-100 text-slate-600">
                      <div
                        className="line-clamp-2 break-words"
                        title={st?.notes || ''}
                      >
                        {st?.notes || '—'}
                      </div>
                    </td>

                    {/* 13. THAO TÁC (Icon-only Cập nhật tiến độ, NO delete button) */}
                    <td className="px-1.5 py-2 text-center align-middle">
                      <button
                        type="button"
                        data-testid={`st-product-progress-btn-${p.product_code}`}
                        onClick={() => handleOpenProgressModal(item)}
                        title="Cập nhật tiến độ"
                        aria-label="Cập nhật tiến độ"
                        className="w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:border-[#14539E] hover:text-[#14539E] hover:bg-blue-50/50 inline-flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
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

      {/* MODAL A: Compact Mini Progress Update Modal (opened from Action icon in table) */}
      {progressModalItem && (() => {
        const mp = progressModalItem.product;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Cập nhật tiến độ mã hàng ${mp.product_code}`}
            onClick={handleCloseProgressModal}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          >
            <form
              data-testid="st-mini-progress-modal"
              onSubmit={handleSaveMiniProgress}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Compact Header: Mã hàng & Tên hàng */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2 bg-slate-50/80 shrink-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#14539E]">
                      {mp.product_code}
                    </span>
                    {miniLivePreview.isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        Hoàn thành SX đại trà
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                        <Clock className="w-3 h-3" />
                        {miniLivePreview.waitingLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">
                    {mp.product_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseProgressModal}
                  aria-label="Đóng cửa sổ cập nhật tiến độ"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body: 2 Milestones (Quy trình ERP & ST) + Notes */}
              <div className="p-4 overflow-y-auto space-y-3 text-xs">
                <div className="space-y-2.5">
                  {ST_WORKFLOW_STEPS.map((step) => {
                    const checked = miniSteps[step.boolField];
                    const dateVal = miniSteps[step.dateField];
                    const dateLabel =
                      step.key === 'process_erp' ? 'Ngày tạo QT' : 'Ngày áp dụng';
                    const isWaiting =
                      !checked && miniLivePreview.pendingStep?.key === step.key;

                    return (
                      <div
                        key={step.key}
                        className={`rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                          checked
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : isWaiting
                            ? 'bg-amber-50/60 border-amber-200'
                            : 'bg-slate-50/50 border-slate-200'
                        }`}
                      >
                        <label className="inline-flex items-center gap-2.5 font-semibold text-slate-900 cursor-pointer min-w-0 flex-1">
                          <input
                            type="checkbox"
                            data-testid={`st-mini-check-${step.key}`}
                            checked={checked}
                            onChange={(e) =>
                              handleToggleMiniStep(
                                step.boolField,
                                step.dateField,
                                e.target.checked
                              )
                            }
                            className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                          />
                          <span className="truncate">
                            Bước {step.order}: {step.label}
                          </span>
                        </label>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                            {dateLabel}:
                          </span>
                          <input
                            type="date"
                            data-testid={`st-mini-date-${step.key}`}
                            value={dateVal}
                            onChange={(e) =>
                              handleChangeMiniStepDate(
                                step.boolField,
                                step.dateField,
                                e.target.value
                              )
                            }
                            aria-label={dateLabel}
                            className="h-8 w-36 px-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] shrink-0"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ghi chú
                  </label>
                  <textarea
                    rows={2}
                    data-testid="st-mini-notes"
                    value={miniNotes}
                    onChange={(e) => setMiniNotes(e.target.value)}
                    placeholder="Nhập ghi chú xử lý..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] resize-none"
                  />
                </div>
              </div>

              {/* Footer: Hủy / Lưu tiến độ */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseProgressModal}
                  className="h-8 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingMini}
                  data-testid="st-mini-save-btn"
                  className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingMini ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu tiến độ</span>
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* MODAL B: Full Product Detail & Progress Modal (opened by clicking Mã hàng link) */}
      {activeModalItem && (() => {
        const dp = activeModalItem.product;
        const imgBroken = Boolean(brokenImages[dp.id]);

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Chi tiết thông tin mã hàng ${dp.product_code}`}
            onClick={handleCloseDetailModal}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          >
            <form
              data-testid="st-full-detail-modal"
              onSubmit={handleSaveModalUpdates}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-slate-50/80">
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="font-mono text-base font-bold text-[#14539E] truncate">
                    {modalCode || dp.product_code}
                  </span>
                  {modalLivePreview.isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" />
                      Hoàn thành SX đại trà
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      {modalLivePreview.waitingLabel}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCloseDetailModal}
                  aria-label="Đóng cửa sổ"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body: 2 Clear Parts */}
              <div className="p-5 overflow-y-auto space-y-5 text-xs">
                {/* PART 1: Product Information */}
                <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      1. Thông tin sản phẩm
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-mono tabular-nums">
                      <span>
                        Ngày ĐK:{' '}
                        <strong className="text-slate-900">
                          {formatStDateVN(dp.created_at)}
                        </strong>
                      </span>
                      <span>
                        Số ngày hoàn thành:{' '}
                        <strong
                          className={
                            modalLivePreview.isCompleted
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }
                        >
                          {modalLivePreview.isCompleted
                            ? `${formatNumberVN(
                                modalLivePreview.completionDays ?? 0
                              )} ngày`
                            : '—'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Product Image + Zoom + Upload */}
                    <div className="md:col-span-4 flex flex-col gap-2">
                      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        {modalImageUrl && !imgBroken ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: modalImageUrl,
                                title: `${modalCode || dp.product_code} - ${
                                  modalName || dp.product_name
                                }`,
                              })
                            }
                            title="Bấm để phóng to toàn màn hình"
                            className="relative w-full h-48 bg-white flex items-center justify-center cursor-pointer group overflow-hidden"
                          >
                            <img
                              src={modalImageUrl}
                              alt={modalName || dp.product_name}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenImages((prev) => ({
                                  ...prev,
                                  [dp.id]: true,
                                }))
                              }
                              className="w-full h-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.02]"
                            />
                            <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-slate-900/75 text-white text-[10px] font-medium inline-flex items-center gap-1 shadow-xs">
                              <Maximize2 className="w-3 h-3" />
                              Phóng to
                            </span>
                          </button>
                        ) : (
                          <div className="w-full h-48 flex flex-col items-center justify-center gap-1.5 text-slate-400 p-3 bg-slate-50">
                            <ImageIcon className="w-8 h-8 text-slate-300" />
                            <span className="text-[11px]">
                              Chưa có hình ảnh sản phẩm
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={modalImageUrl}
                          onChange={(e) => {
                            setModalImageUrl(e.target.value);
                            setBrokenImages((prev) => {
                              const next = { ...prev };
                              delete next[dp.id];
                              return next;
                            });
                          }}
                          placeholder="Dán URL ảnh hoặc tải ảnh..."
                          aria-label="URL ảnh sản phẩm"
                          className="flex-1 min-w-0 h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                        />
                        <label
                          title="Đổi / tải ảnh mới"
                          className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#14539E] text-slate-700 hover:text-[#14539E] inline-flex items-center gap-1 cursor-pointer shrink-0 font-semibold"
                        >
                          {isUploadingModalImg ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#14539E]" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>Tải ảnh</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingModalImg}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file)
                                void handleUploadProductImage(file, 'modal');
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Editable Product Fields */}
                    <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Mã hàng <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={modalCode}
                          onChange={(e) => setModalCode(e.target.value)}
                          className="w-full h-9 px-3 font-mono font-semibold text-[#14539E] bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Tên hàng <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={modalName}
                          onChange={(e) => setModalName(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Line sản xuất <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={modalLine}
                          onChange={(e) => setModalLine(e.target.value)}
                          className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
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
                          value={modalCustomer}
                          onChange={(e) => setModalCustomer(e.target.value)}
                          className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
                        >
                          {customerNames.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Quy cách
                        </label>
                        <input
                          type="text"
                          value={modalSpec}
                          onChange={(e) => setModalSpec(e.target.value)}
                          placeholder="Nhập quy cách sản phẩm..."
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* PART 2: 2-Milestone Completion History (Quy trình ERP -> ST) */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      2. Tiến độ 2 mốc (Quy trình ERP → ST)
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Hoàn thành SX đại trà khi cả Quy trình ERP và ST (có Ngày áp dụng) đều hoàn tất
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ST_WORKFLOW_STEPS.map((step) => {
                      const checked = modalSteps[step.boolField];
                      const dateVal = modalSteps[step.dateField];
                      const dateLabel =
                        step.key === 'process_erp'
                          ? 'Ngày tạo QT'
                          : 'Ngày áp dụng';
                      const isWaiting =
                        !checked &&
                        modalLivePreview.pendingStep?.key === step.key;

                      return (
                        <div
                          key={step.key}
                          className={`rounded-xl border p-3 transition-colors space-y-2 ${
                            checked
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : isWaiting
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-slate-50/60 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="inline-flex items-center gap-2 font-bold text-slate-900 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                data-testid={`st-detail-check-${step.key}`}
                                checked={checked}
                                onChange={(e) =>
                                  handleToggleModalStep(
                                    step.boolField,
                                    step.dateField,
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 accent-[#14539E] rounded cursor-pointer shrink-0"
                              />
                              <span className="truncate text-xs">
                                Bước {step.order}: {step.label}
                              </span>
                            </label>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-slate-600">
                              {dateLabel}:
                            </span>
                            <input
                              type="date"
                              data-testid={`st-detail-date-${step.key}`}
                              value={dateVal}
                              onChange={(e) =>
                                handleChangeModalStepDate(
                                  step.boolField,
                                  step.dateField,
                                  e.target.value
                                )
                              }
                              aria-label={dateLabel}
                              className="w-40 h-8 px-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Ghi chú
                    </label>
                    <textarea
                      rows={2}
                      value={modalNotes}
                      onChange={(e) => setModalNotes(e.target.value)}
                      placeholder="Nhập ghi chú xử lý, vướng mắc hoặc thông tin bổ sung..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] resize-none"
                    />
                  </div>
                </section>
              </div>

              {/* Modal Footer (includes safe inline delete inside Detail modal) */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div>
                  {confirmDeleteInDetail ? (
                    <div className="inline-flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-rose-700">
                        Xác nhận xóa mã hàng này?
                      </span>
                      <button
                        type="button"
                        disabled={isDeletingProduct}
                        data-testid="st-detail-confirm-delete-btn"
                        onClick={() => void handleDeleteProduct(dp)}
                        className="h-7 px-2.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingProduct ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteInDetail(false)}
                        className="h-7 px-2.5 rounded-md border border-slate-300 bg-white text-slate-600 text-[11px] cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="st-detail-delete-trigger"
                      onClick={() => setConfirmDeleteInDetail(true)}
                      className="h-8 px-2.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa mã hàng</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseDetailModal}
                    className="h-8 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingModal}
                    data-testid="st-modal-save-btn"
                    className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingModal ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Lưu cập nhật</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        );
      })()}

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
