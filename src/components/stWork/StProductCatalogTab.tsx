import React, { useMemo, useState } from 'react';
import {
  Check,
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
  formatNumberVN,
  formatStDateVN,
  StCustomer,
  StLine,
  StProduct,
} from '../../utils/stWorkLogic';
import {
  createStCustomer,
  createStLine,
  createStProduct,
  deleteStProduct,
  updateStProduct,
  uploadImageToHrBucket,
} from '../../services/stWorkService';

export interface StProductCatalogTabProps {
  lines: StLine[];
  customers: StCustomer[];
  products: StProduct[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onShowToast?: (message: string) => void;
}

export const StProductCatalogTab: React.FC<StProductCatalogTabProps> = ({
  lines,
  customers,
  products,
  isLoading,
  onRefresh,
  onShowToast,
}) => {
  // Filter & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');

  // Registration bar state
  const [newProdLine, setNewProdLine] = useState<string>('');
  const [newProdCustomer, setNewProdCustomer] = useState<string>('');
  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdCode, setNewProdCode] = useState<string>('');
  const [newProdSpec, setNewProdSpec] = useState<string>('');
  const [newProdImageUrl, setNewProdImageUrl] = useState<string>('');
  const [isUploadingNewImg, setIsUploadingNewImg] = useState<boolean>(false);
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);

  // Quick-add Line modal
  const [quickLineModalOpen, setQuickLineModalOpen] = useState<boolean>(false);
  const [quickLineName, setQuickLineName] = useState<string>('');
  const [quickLineDesc, setQuickLineDesc] = useState<string>('');
  const [isSavingQuickLine, setIsSavingQuickLine] = useState<boolean>(false);

  // Quick-add Customer modal
  const [quickCustModalOpen, setQuickCustModalOpen] = useState<boolean>(false);
  const [quickCustShort, setQuickCustShort] = useState<string>('');
  const [quickCustFull, setQuickCustFull] = useState<string>('');
  const [quickCustNotes, setQuickCustNotes] = useState<string>('');
  const [isSavingQuickCust, setIsSavingQuickCust] = useState<boolean>(false);

  // Edit product modal
  const [editingProduct, setEditingProduct] = useState<StProduct | null>(null);
  const [editLine, setEditLine] = useState<string>('');
  const [editCustomer, setEditCustomer] = useState<string>('');
  const [editCode, setEditCode] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editSpec, setEditSpec] = useState<string>('');
  const [editImageUrl, setEditImageUrl] = useState<string>('');
  const [isUploadingEditImg, setIsUploadingEditImg] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<StProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Image preview & broken image fallback
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const effectiveNewLine = newProdLine || lines[0]?.name || '';
  const effectiveNewCustomer = newProdCustomer || customers[0]?.short_name || '';

  const lineNames = useMemo(() => {
    const set = new Set<string>(lines.map((l) => l.name));
    products.forEach((p) => {
      if (p.line_name) set.add(p.line_name);
    });
    return Array.from(set);
  }, [lines, products]);

  const customerNames = useMemo(() => {
    const set = new Set<string>(customers.map((c) => c.short_name));
    products.forEach((p) => {
      if (p.customer_short_name) set.add(p.customer_short_name);
    });
    return Array.from(set);
  }, [customers, products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (lineFilter !== 'ALL' && p.line_name !== lineFilter) return false;
      if (
        customerFilter !== 'ALL' &&
        p.customer_short_name !== customerFilter
      ) {
        return false;
      }
      if (q) {
        const hit =
          p.product_code.toLowerCase().includes(q) ||
          p.product_name.toLowerCase().includes(q) ||
          p.specification.toLowerCase().includes(q) ||
          p.customer_short_name.toLowerCase().includes(q) ||
          p.line_name.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [products, lineFilter, customerFilter, searchQuery]);

  const handleUploadImage = async (file: File, mode: 'new' | 'edit') => {
    if (mode === 'new') setIsUploadingNewImg(true);
    else setIsUploadingEditImg(true);

    try {
      const publicUrl = await uploadImageToHrBucket(file, 'st-products');
      if (mode === 'new') {
        setNewProdImageUrl(publicUrl);
      } else {
        setEditImageUrl(publicUrl);
        if (editingProduct) {
          setBrokenImages((prev) => {
            const copy = { ...prev };
            delete copy[editingProduct.id];
            return copy;
          });
        }
      }
      onShowToast?.('Đã nén và tải ảnh sản phẩm lên hệ thống.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      if (mode === 'new') setIsUploadingNewImg(false);
      else setIsUploadingEditImg(false);
    }
  };

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
        `Đã thêm sản phẩm "${product.product_code}" và đồng bộ sang tab Đơn giá mới.`
      );
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsAddingProduct(false);
    }
  };

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

  const handleOpenEditModal = (p: StProduct) => {
    setEditingProduct(p);
    setEditLine(p.line_name);
    setEditCustomer(p.customer_short_name);
    setEditCode(p.product_code);
    setEditName(p.product_name);
    setEditSpec(p.specification);
    setEditImageUrl(p.image_url || '');
  };

  const handleCloseEditModal = () => {
    if (isSavingEdit) return;
    setEditingProduct(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editLine || !editCustomer || !editCode.trim() || !editName.trim()) {
      onShowToast?.(
        'Line, Khách hàng, Mã hàng và Tên hàng không được để trống.'
      );
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateStProduct(editingProduct.id, {
        line_name: editLine,
        customer_short_name: editCustomer,
        product_name: editName.trim(),
        product_code: editCode.trim(),
        specification: editSpec.trim(),
        image_url: editImageUrl.trim() || null,
      });
      setBrokenImages((prev) => {
        const next = { ...prev };
        delete next[editingProduct.id];
        return next;
      });
      await onRefresh();
      onShowToast?.(`Đã cập nhật thông tin sản phẩm "${editCode.trim()}".`);
      setEditingProduct(null);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteStProduct(deleteTarget.id);
      await onRefresh();
      onShowToast?.(`Đã xóa sản phẩm "${deleteTarget.product_code}".`);
      setDeleteTarget(null);
      if (editingProduct?.id === deleteTarget.id) {
        setEditingProduct(null);
      }
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* 1. Filter Bar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64 lg:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã hàng, tên hàng, quy cách..."
              aria-label="Tìm kiếm trong danh mục sản phẩm"
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

          <select
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            aria-label="Lọc danh mục sản phẩm theo Line"
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
            aria-label="Lọc danh mục sản phẩm theo Khách hàng"
            className="h-8 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
          >
            <option value="ALL">Tất cả Khách hàng</option>
            {customerNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 font-mono tabular-nums">
          <span>Tổng:</span>
          <strong className="text-[#14539E]">
            {formatNumberVN(filteredProducts.length)}
          </strong>
          {filteredProducts.length !== products.length && (
            <span className="text-slate-400">
              / {formatNumberVN(products.length)}
            </span>
          )}
          <span>sản phẩm</span>
        </div>
      </div>

      {/* 2. Always-Visible Product Registration Bar (st_products) */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-center p-2 rounded-xl bg-slate-50 border border-slate-200">
          {/* Line + quick "+" */}
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
              data-testid="st-catalog-quick-add-line-btn"
              onClick={() => setQuickLineModalOpen(true)}
              title="Thêm nhanh Line mới"
              aria-label="Thêm nhanh Line mới"
              className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:border-[#14539E] text-[#14539E] inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Khách hàng + quick "+" */}
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
              data-testid="st-catalog-quick-add-customer-btn"
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

          {/* Hình ảnh */}
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
                aria-label="Xem ảnh đã chọn"
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
                  if (file) void handleUploadImage(file, 'new');
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* Thêm */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              data-testid="st-catalog-add-btn"
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

      {/* 3. Product Catalog Table (st_products) */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && products.length === 0 ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
            <span>Đang tải danh mục sản phẩm...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <PackageOpen className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600">
              Chưa có sản phẩm nào trong danh mục. Hãy điền thông tin ở khung phía trên để thêm mới.
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Không có sản phẩm nào khớp bộ lọc hiện tại.
          </div>
        ) : (
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-100 text-[10.5px] font-bold text-slate-600 uppercase tracking-tight shadow-[0_1px_0_0_rgba(203,213,225,1)]">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-100 px-2 py-2.5 w-11 min-w-[44px] text-center border-r border-b border-slate-200 whitespace-nowrap">
                  STT
                </th>
                <th className="px-2.5 py-2.5 w-20 border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  LINE
                </th>
                <th className="px-2.5 py-2.5 w-28 border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  KHÁCH HÀNG
                </th>
                <th className="px-2.5 py-2.5 w-36 border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  MÃ HÀNG
                </th>
                <th className="px-2.5 py-2.5 min-w-[160px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  TÊN HÀNG
                </th>
                <th className="px-2.5 py-2.5 min-w-[140px] border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  QUY CÁCH
                </th>
                <th className="px-2 py-2.5 w-20 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  HÌNH ẢNH
                </th>
                <th className="px-2.5 py-2.5 w-28 text-center border-r border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  NGÀY ĐĂNG KÝ
                </th>
                <th className="px-2 py-2.5 w-24 text-center border-b border-slate-200 bg-slate-100 whitespace-nowrap">
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredProducts.map((p, idx) => {
                const imgBroken = Boolean(brokenImages[p.id]);
                return (
                  <tr
                    key={p.id}
                    className="group bg-white hover:bg-[#F3F8FF] transition-colors"
                  >
                    <td className="sticky left-0 z-[5] bg-white group-hover:bg-[#F3F8FF] px-2 py-2.5 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-200/80 transition-colors">
                      {formatNumberVN(idx + 1)}
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-100 text-slate-700 font-medium whitespace-nowrap">
                      {p.line_name || '—'}
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-100 text-slate-700 font-medium whitespace-nowrap">
                      {p.customer_short_name || '—'}
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-100">
                      <button
                        type="button"
                        data-testid={`st-catalog-code-btn-${p.product_code}`}
                        onClick={() => handleOpenEditModal(p)}
                        className="font-mono font-bold text-[#14539E] hover:underline cursor-pointer text-left whitespace-nowrap"
                      >
                        {p.product_code}
                      </button>
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-100 text-slate-900 font-medium">
                      {p.product_name}
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-100 text-slate-600">
                      {p.specification || '—'}
                    </td>
                    <td className="px-2 py-2 border-r border-slate-100 text-center align-middle">
                      {p.image_url && !imgBroken ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              url: p.image_url || '',
                              title: `${p.product_code} - ${p.product_name}`,
                            })
                          }
                          title="Phóng to hình ảnh sản phẩm"
                          aria-label={`Xem ảnh ${p.product_code}`}
                          className="w-9 h-9 rounded-lg border border-slate-200 bg-white overflow-hidden inline-flex items-center justify-center hover:border-[#14539E] cursor-pointer"
                        >
                          <img
                            src={p.image_url}
                            alt={p.product_code}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenImages((prev) => ({
                                ...prev,
                                [p.id]: true,
                              }))
                            }
                            className="w-full h-full object-contain p-0.5"
                          />
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2.5 border-r border-slate-100 text-center font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                      {formatStDateVN(p.created_at)}
                    </td>
                    <td className="px-2 py-2 text-center align-middle">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`st-catalog-edit-btn-${p.product_code}`}
                          onClick={() => handleOpenEditModal(p)}
                          title={`Sửa sản phẩm ${p.product_code}`}
                          aria-label={`Sửa sản phẩm ${p.product_code}`}
                          className="w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:border-[#14539E] hover:text-[#14539E] hover:bg-blue-50/50 inline-flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid={`st-catalog-delete-btn-${p.product_code}`}
                          onClick={() => setDeleteTarget(p)}
                          title={`Xóa sản phẩm ${p.product_code}`}
                          aria-label={`Xóa sản phẩm ${p.product_code}`}
                          className="w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

      {/* Edit Product Modal (`st_products`) */}
      {editingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Chỉnh sửa sản phẩm ${editingProduct.product_code}`}
          onClick={handleCloseEditModal}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <form
            data-testid="st-catalog-edit-modal"
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-base font-bold text-[#14539E] truncate">
                  {editCode || editingProduct.product_code}
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Ngày ĐK: {formatStDateVN(editingProduct.created_at)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                aria-label="Đóng cửa sổ chỉnh sửa"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto text-xs grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Image preview & upload */}
              <div className="md:col-span-4 flex flex-col gap-2">
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  {editImageUrl && !brokenImages[editingProduct.id] ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          url: editImageUrl,
                          title: `${editCode || editingProduct.product_code} - ${
                            editName || editingProduct.product_name
                          }`,
                        })
                      }
                      title="Bấm để phóng to ảnh"
                      className="relative w-full h-44 bg-white flex items-center justify-center cursor-pointer group overflow-hidden"
                    >
                      <img
                        src={editImageUrl}
                        alt={editName || editingProduct.product_name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({
                            ...prev,
                            [editingProduct.id]: true,
                          }))
                        }
                        className="w-full h-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                      <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-slate-900/75 text-white text-[10px] font-medium inline-flex items-center gap-1">
                        <Maximize2 className="w-3 h-3" />
                        Phóng to
                      </span>
                    </button>
                  ) : (
                    <div className="w-full h-44 flex flex-col items-center justify-center gap-1.5 text-slate-400 p-3 bg-slate-50">
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                      <span className="text-[11px]">Chưa có hình ảnh</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={editImageUrl}
                    onChange={(e) => {
                      setEditImageUrl(e.target.value);
                      setBrokenImages((prev) => {
                        const next = { ...prev };
                        delete next[editingProduct.id];
                        return next;
                      });
                    }}
                    placeholder="Dán URL ảnh..."
                    aria-label="URL ảnh sản phẩm"
                    className="flex-1 min-w-0 h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                  <label
                    title="Tải ảnh mới"
                    className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#14539E] text-slate-700 hover:text-[#14539E] inline-flex items-center gap-1 cursor-pointer shrink-0 font-semibold"
                  >
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
                        if (file) void handleUploadImage(file, 'edit');
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Fields */}
              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full h-9 px-3 font-mono font-semibold text-[#14539E] bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Line sản xuất <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editLine}
                    onChange={(e) => setEditLine(e.target.value)}
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
                    value={editCustomer}
                    onChange={(e) => setEditCustomer(e.target.value)}
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
                    data-testid="st-catalog-edit-spec"
                    value={editSpec}
                    onChange={(e) => setEditSpec(e.target.value)}
                    placeholder="Nhập quy cách sản phẩm..."
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="h-8 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                data-testid="st-catalog-edit-save-btn"
                className="h-8 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? (
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Xóa sản phẩm ${deleteTarget.product_code}`}
          onClick={() => !isDeleting && setDeleteTarget(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            data-testid="st-catalog-delete-modal"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Xác nhận xóa sản phẩm
              </h3>
              <button
                type="button"
                onClick={() => !isDeleting && setDeleteTarget(null)}
                aria-label="Đóng"
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa sản phẩm{' '}
              <strong className="font-mono text-slate-900">
                {deleteTarget.product_code}
              </strong>{' '}
              ({deleteTarget.product_name}) khỏi danh mục? Bản ghi theo dõi liên
              kết bên tab Đơn giá mới cũng sẽ được xóa theo.
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                data-testid="st-catalog-confirm-delete-btn"
                onClick={() => void handleConfirmDelete()}
                className="h-8 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Xóa sản phẩm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Zoom Modal */}
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
