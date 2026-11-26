import React, { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Image as ImageIcon,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import { uploadImageToHrBucket } from '../../utils/supabaseService';
import {
  formatNumberVN,
  StCustomer,
  StLine,
  StProduct,
  StSetupSubTab,
} from '../../utils/stWorkLogic';
import {
  createStCustomer,
  createStLine,
  createStProduct,
  deleteStCustomer,
  deleteStLine,
  deleteStProduct,
  updateStCustomer,
  updateStLine,
  updateStProduct,
} from '../../utils/stWorkSupabase';

export interface StGeneralSetupTabProps {
  lines: StLine[];
  customers: StCustomer[];
  products: StProduct[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onShowToast?: (message: string) => void;
  onProductCreatedNavigate?: () => void;
}

export const StGeneralSetupTab: React.FC<StGeneralSetupTabProps> = ({
  lines,
  customers,
  products,
  isLoading,
  onRefresh,
  onShowToast,
}) => {
  const [setupSubTab, setSetupSubTab] = useState<StSetupSubTab>('products');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // ==========================================
  // 1.1. Danh mục sản phẩm state (`st_products`)
  // ==========================================
  const [newProdLine, setNewProdLine] = useState<string>('');
  const [newProdCustomer, setNewProdCustomer] = useState<string>('');
  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdCode, setNewProdCode] = useState<string>('');
  const [newProdSpec, setNewProdSpec] = useState<string>('');
  const [newProdImageUrl, setNewProdImageUrl] = useState<string>('');
  const [isUploadingNewImg, setIsUploadingNewImg] = useState<boolean>(false);
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProdLine, setEditProdLine] = useState<string>('');
  const [editProdCustomer, setEditProdCustomer] = useState<string>('');
  const [editProdName, setEditProdName] = useState<string>('');
  const [editProdCode, setEditProdCode] = useState<string>('');
  const [editProdSpec, setEditProdSpec] = useState<string>('');
  const [editProdImageUrl, setEditProdImageUrl] = useState<string>('');
  const [isUploadingEditImg, setIsUploadingEditImg] = useState<boolean>(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [confirmDeleteProdId, setConfirmDeleteProdId] = useState<string | null>(null);

  // ==========================================
  // 1.2. Line state (`st_lines`)
  // ==========================================
  const [newLineName, setNewLineName] = useState<string>('');
  const [newLineDesc, setNewLineDesc] = useState<string>('');
  const [isAddingLine, setIsAddingLine] = useState<boolean>(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editLineName, setEditLineName] = useState<string>('');
  const [editLineDesc, setEditLineDesc] = useState<string>('');
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [confirmDeleteLineId, setConfirmDeleteLineId] = useState<string | null>(null);

  // ==========================================
  // 1.3. Khách hàng state (`st_customers`)
  // ==========================================
  const [newCustShort, setNewCustShort] = useState<string>('');
  const [newCustFull, setNewCustFull] = useState<string>('');
  const [newCustNotes, setNewCustNotes] = useState<string>('');
  const [isAddingCust, setIsAddingCust] = useState<boolean>(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [editCustShort, setEditCustShort] = useState<string>('');
  const [editCustFull, setEditCustFull] = useState<string>('');
  const [editCustNotes, setEditCustNotes] = useState<string>('');
  const [savingCustId, setSavingCustId] = useState<string | null>(null);
  const [confirmDeleteCustId, setConfirmDeleteCustId] = useState<string | null>(null);

  const effectiveNewLine = newProdLine || lines[0]?.name || '';
  const effectiveNewCustomer = newProdCustomer || customers[0]?.short_name || '';

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.product_code.toLowerCase().includes(q) ||
        p.product_name.toLowerCase().includes(q) ||
        p.specification.toLowerCase().includes(q) ||
        p.customer_short_name.toLowerCase().includes(q) ||
        p.line_name.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

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
      onShowToast?.('Đã tải ảnh sản phẩm lên hệ thống.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      if (mode === 'new') setIsUploadingNewImg(false);
      else setIsUploadingEditImg(false);
    }
  };

  const handleAddProduct = async () => {
    if (!effectiveNewLine) {
      onShowToast?.('Vui lòng tạo ít nhất 1 Line trước khi thêm sản phẩm.');
      return;
    }
    if (!effectiveNewCustomer) {
      onShowToast?.('Vui lòng tạo ít nhất 1 Khách hàng trước khi thêm sản phẩm.');
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
        `Đã thêm mã hàng "${product.product_code}" và tự động khởi tạo sang tab Mã hàng mới.`
      );
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleStartEditProduct = (p: StProduct) => {
    setEditingProductId(p.id);
    setEditProdLine(p.line_name);
    setEditProdCustomer(p.customer_short_name);
    setEditProdName(p.product_name);
    setEditProdCode(p.product_code);
    setEditProdSpec(p.specification);
    setEditProdImageUrl(p.image_url || '');
    setConfirmDeleteProdId(null);
  };

  const handleSaveEditProduct = async (id: string) => {
    setSavingProductId(id);
    try {
      await updateStProduct(id, {
        line_name: editProdLine,
        customer_short_name: editProdCustomer,
        product_name: editProdName,
        product_code: editProdCode,
        specification: editProdSpec,
        image_url: editProdImageUrl || null,
      });
      await onRefresh();
      setEditingProductId(null);
      onShowToast?.(`Đã cập nhật mã hàng "${editProdCode.trim()}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingProductId(null);
    }
  };

  const handleDeleteProduct = async (p: StProduct) => {
    setSavingProductId(p.id);
    try {
      await deleteStProduct(p.id);
      await onRefresh();
      setConfirmDeleteProdId(null);
      onShowToast?.(`Đã xóa mã hàng "${p.product_code}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingProductId(null);
    }
  };

  // Line handlers
  const handleAddLine = async () => {
    if (!newLineName.trim()) {
      onShowToast?.('Vui lòng nhập tên Line.');
      return;
    }
    setIsAddingLine(true);
    try {
      const nextSort =
        lines.reduce((max, l) => Math.max(max, l.sort_order || 0), 0) + 1;
      await createStLine({
        name: newLineName.trim(),
        description: newLineDesc.trim() || null,
        sort_order: nextSort,
      });
      await onRefresh();
      setNewLineName('');
      setNewLineDesc('');
      onShowToast?.('Đã thêm Line sản xuất mới.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsAddingLine(false);
    }
  };

  const handleSaveLine = async (id: string) => {
    setSavingLineId(id);
    try {
      await updateStLine(id, {
        name: editLineName,
        description: editLineDesc || null,
      });
      await onRefresh();
      setEditingLineId(null);
      onShowToast?.('Đã cập nhật thông tin Line.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingLineId(null);
    }
  };

  const handleDeleteLine = async (id: string) => {
    setSavingLineId(id);
    try {
      await deleteStLine(id);
      await onRefresh();
      setConfirmDeleteLineId(null);
      onShowToast?.('Đã xóa Line.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingLineId(null);
    }
  };

  // Customer handlers
  const handleAddCustomer = async () => {
    if (!newCustShort.trim()) {
      onShowToast?.('Vui lòng nhập Tên viết tắt của khách hàng.');
      return;
    }
    setIsAddingCust(true);
    try {
      await createStCustomer({
        short_name: newCustShort.trim(),
        full_name: newCustFull.trim() || newCustShort.trim(),
        notes: newCustNotes.trim() || null,
      });
      await onRefresh();
      setNewCustShort('');
      setNewCustFull('');
      setNewCustNotes('');
      onShowToast?.('Đã thêm khách hàng mới.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsAddingCust(false);
    }
  };

  const handleSaveCustomer = async (id: string) => {
    setSavingCustId(id);
    try {
      await updateStCustomer(id, {
        short_name: editCustShort,
        full_name: editCustFull,
        notes: editCustNotes || null,
      });
      await onRefresh();
      setEditingCustId(null);
      onShowToast?.('Đã cập nhật thông tin khách hàng.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingCustId(null);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    setSavingCustId(id);
    try {
      await deleteStCustomer(id);
      await onRefresh();
      setConfirmDeleteCustId(null);
      onShowToast?.('Đã xóa khách hàng.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setSavingCustId(null);
    }
  };

  const subBtnBase =
    'h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* 3 Inner Sub-navigation Buttons */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSetupSubTab('products')}
            className={`${subBtnBase} ${
              setupSubTab === 'products'
                ? 'bg-[#14539E] text-white border-[#14539E]'
                : 'bg-white text-slate-700 border-slate-300 hover:border-[#14539E] hover:text-[#14539E]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Danh mục sản phẩm</span>
            <span className="font-mono text-[11px] opacity-80 tabular-nums">
              ({formatNumberVN(products.length)})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSetupSubTab('lines')}
            className={`${subBtnBase} ${
              setupSubTab === 'lines'
                ? 'bg-[#14539E] text-white border-[#14539E]'
                : 'bg-white text-slate-700 border-slate-300 hover:border-[#14539E] hover:text-[#14539E]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Line</span>
            <span className="font-mono text-[11px] opacity-80 tabular-nums">
              ({formatNumberVN(lines.length)})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSetupSubTab('customers')}
            className={`${subBtnBase} ${
              setupSubTab === 'customers'
                ? 'bg-[#14539E] text-white border-[#14539E]'
                : 'bg-white text-slate-700 border-slate-300 hover:border-[#14539E] hover:text-[#14539E]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Khách hàng</span>
            <span className="font-mono text-[11px] opacity-80 tabular-nums">
              ({formatNumberVN(customers.length)})
            </span>
          </button>
        </div>

        {setupSubTab === 'products' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã hàng, tên hàng, quy cách..."
              aria-label="Tìm kiếm danh mục sản phẩm"
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
        )}
      </div>

      {/* SUB-TAB 1.1: DANH MỤC SẢN PHẨM (7 COLUMNS) */}
      {setupSubTab === 'products' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Quick-Add Product Bar */}
          <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0 space-y-2">
            {customers.length === 0 && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2">
                <span>
                  Chưa có Khách hàng nào. Hãy thêm Khách hàng trước khi đăng ký Mã hàng mới.
                </span>
                <button
                  type="button"
                  onClick={() => setSetupSubTab('customers')}
                  className="font-semibold text-[#14539E] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Thêm Khách hàng ngay
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-center p-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="lg:col-span-2">
                <select
                  value={effectiveNewLine}
                  onChange={(e) => setNewProdLine(e.target.value)}
                  aria-label="Chọn Line sản xuất"
                  className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
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
              </div>

              <div className="lg:col-span-2">
                <select
                  value={effectiveNewCustomer}
                  onChange={(e) => setNewProdCustomer(e.target.value)}
                  aria-label="Chọn Khách hàng"
                  className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
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
              </div>

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

              <div className="lg:col-span-2 flex items-center gap-1">
                <input
                  type="text"
                  value={newProdImageUrl}
                  onChange={(e) => setNewProdImageUrl(e.target.value)}
                  placeholder="Dán URL ảnh hoặc tải lên..."
                  aria-label="URL hình ảnh sản phẩm"
                  className="flex-1 min-w-0 h-8 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
                <label
                  title="Tải ảnh từ máy tính"
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

          {/* 7-Column Table */}
          <div className="flex-1 min-h-0 overflow-auto">
            {isLoading && products.length === 0 ? (
              <div className="p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#14539E]" />
                <span>Đang tải danh mục sản phẩm...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Chưa có sản phẩm nào trong danh mục. Hãy nhập thông tin phía trên để đăng ký mã hàng đầu tiên.
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-2 py-2 w-12 text-center border-r border-slate-200/70">
                      STT
                    </th>
                    <th className="px-2.5 py-2 w-28 border-r border-slate-200/70">
                      Line
                    </th>
                    <th className="px-2.5 py-2 w-32 border-r border-slate-200/70">
                      Khách hàng
                    </th>
                    <th className="px-2.5 py-2 w-[22%] border-r border-slate-200/70">
                      Tên hàng
                    </th>
                    <th className="px-2.5 py-2 w-[16%] border-r border-slate-200/70">
                      Mã hàng
                    </th>
                    <th className="px-2.5 py-2 w-[20%] border-r border-slate-200/70">
                      Quy cách
                    </th>
                    <th className="px-2.5 py-2 w-44">Hình ảnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredProducts.map((p, idx) => {
                    const isEditing = editingProductId === p.id;
                    const isBusy = savingProductId === p.id;
                    const imgBroken = Boolean(brokenImages[p.id]);

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="px-2 py-1.5 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                          {formatNumberVN(idx + 1)}
                        </td>

                        <td className="px-2.5 py-1.5 border-r border-slate-100">
                          {isEditing ? (
                            <select
                              value={editProdLine}
                              onChange={(e) => setEditProdLine(e.target.value)}
                              aria-label="Sửa Line sản phẩm"
                              className="w-full h-7 px-1.5 text-xs bg-white border border-[#14539E] rounded"
                            >
                              {lines.map((l) => (
                                <option key={l.id} value={l.name}>
                                  {l.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-semibold text-slate-700">
                              {p.line_name}
                            </span>
                          )}
                        </td>

                        <td className="px-2.5 py-1.5 border-r border-slate-100">
                          {isEditing ? (
                            <select
                              value={editProdCustomer}
                              onChange={(e) => setEditProdCustomer(e.target.value)}
                              aria-label="Sửa Khách hàng sản phẩm"
                              className="w-full h-7 px-1.5 text-xs bg-white border border-[#14539E] rounded"
                            >
                              {customers.map((c) => (
                                <option key={c.id} value={c.short_name}>
                                  {c.short_name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-slate-800">
                              {p.customer_short_name}
                            </span>
                          )}
                        </td>

                        <td className="px-2.5 py-1.5 border-r border-slate-100">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editProdName}
                              onChange={(e) => setEditProdName(e.target.value)}
                              aria-label="Sửa Tên hàng"
                              className="w-full h-7 px-2 text-xs bg-white border border-[#14539E] rounded"
                            />
                          ) : (
                            <span className="text-slate-900 font-medium">
                              {p.product_name}
                            </span>
                          )}
                        </td>

                        <td className="px-2.5 py-1.5 border-r border-slate-100 font-mono">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editProdCode}
                              onChange={(e) => setEditProdCode(e.target.value)}
                              aria-label="Sửa Mã hàng"
                              className="w-full h-7 px-2 text-xs font-mono bg-white border border-[#14539E] rounded"
                            />
                          ) : (
                            <span className="font-semibold text-[#14539E]">
                              {p.product_code}
                            </span>
                          )}
                        </td>

                        <td className="px-2.5 py-1.5 border-r border-slate-100">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editProdSpec}
                              onChange={(e) => setEditProdSpec(e.target.value)}
                              aria-label="Sửa Quy cách"
                              className="w-full h-7 px-2 text-xs bg-white border border-[#14539E] rounded"
                            />
                          ) : (
                            <span className="text-slate-600">
                              {p.specification || '—'}
                            </span>
                          )}
                        </td>

                        <td className="px-2.5 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            {isEditing ? (
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={editProdImageUrl}
                                  onChange={(e) => setEditProdImageUrl(e.target.value)}
                                  placeholder="URL ảnh..."
                                  aria-label="Sửa URL ảnh sản phẩm"
                                  className="flex-1 min-w-0 h-7 px-1.5 text-xs bg-white border border-[#14539E] rounded"
                                />
                                <label
                                  title="Tải ảnh mới"
                                  className="h-7 w-7 rounded border border-slate-300 bg-white flex items-center justify-center cursor-pointer shrink-0"
                                >
                                  {isUploadingEditImg ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-[#14539E]" />
                                  ) : (
                                    <Upload className="w-3 h-3 text-slate-600" />
                                  )}
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
                            ) : p.image_url && !imgBroken ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    url: p.image_url!,
                                    title: `${p.product_code} - ${p.product_name}`,
                                  })
                                }
                                title="Xem ảnh lớn"
                                className="w-9 h-9 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 shrink-0 cursor-pointer hover:border-[#14539E]"
                              >
                                <img
                                  src={p.image_url}
                                  alt={p.product_name}
                                  referrerPolicy="no-referrer"
                                  onError={() =>
                                    setBrokenImages((prev) => ({
                                      ...prev,
                                      [p.id]: true,
                                    }))
                                  }
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ) : (
                              <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}

                            <div className="inline-flex items-center gap-1 shrink-0">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleSaveEditProduct(p.id)}
                                    aria-label={`Lưu mã hàng ${p.product_code}`}
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
                                    onClick={() => setEditingProductId(null)}
                                    aria-label="Hủy sửa"
                                    title="Hủy"
                                    className="w-7 h-7 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : confirmDeleteProdId === p.id ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleDeleteProduct(p)}
                                    className="h-7 px-2 rounded-md bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Xác nhận
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteProdId(null)}
                                    className="h-7 px-2 rounded-md border border-slate-300 text-slate-600 text-[11px] cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditProduct(p)}
                                    aria-label={`Sửa mã hàng ${p.product_code}`}
                                    title="Sửa sản phẩm"
                                    className="w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:border-[#14539E] hover:text-[#14539E] inline-flex items-center justify-center cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteProdId(p.id)}
                                    aria-label={`Xóa mã hàng ${p.product_code}`}
                                    title="Xóa sản phẩm"
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
      )}

      {/* SUB-TAB 1.2: LINE (`st_lines`) */}
      {setupSubTab === 'lines' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="text"
                value={newLineName}
                onChange={(e) => setNewLineName(e.target.value)}
                placeholder="Tên Line mới (VD: S Line, U1 Line)..."
                aria-label="Tên Line mới"
                className="flex-1 min-w-[180px] h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <input
                type="text"
                value={newLineDesc}
                onChange={(e) => setNewLineDesc(e.target.value)}
                placeholder="Mô tả / Ghi chú (nếu có)..."
                aria-label="Mô tả Line mới"
                className="flex-1 min-w-[180px] h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <button
                type="button"
                disabled={isAddingLine}
                onClick={() => void handleAddLine()}
                className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isAddingLine ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Thêm Line</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                <tr>
                  <th className="px-2 py-2 w-12 text-center border-r border-slate-200/70">
                    STT
                  </th>
                  <th className="px-3 py-2 w-56 border-r border-slate-200/70">
                    Tên Line
                  </th>
                  <th className="px-3 py-2 border-r border-slate-200/70">
                    Mô tả
                  </th>
                  <th className="px-3 py-2 w-28 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {lines.map((line, idx) => {
                  const isEditing = editingLineId === line.id;
                  const isBusy = savingLineId === line.id;
                  return (
                    <tr key={line.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                        {formatNumberVN(idx + 1)}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-semibold text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editLineName}
                            onChange={(e) => setEditLineName(e.target.value)}
                            aria-label="Sửa tên Line"
                            className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                          />
                        ) : (
                          line.name
                        )}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-slate-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editLineDesc}
                            onChange={(e) => setEditLineDesc(e.target.value)}
                            aria-label="Sửa mô tả Line"
                            className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                          />
                        ) : (
                          line.description || '—'
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleSaveLine(line.id)}
                                aria-label={`Lưu Line ${line.name}`}
                                className="w-7 h-7 rounded-md bg-emerald-600 text-white inline-flex items-center justify-center cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingLineId(null)}
                                aria-label="Hủy sửa Line"
                                className="w-7 h-7 rounded-md border border-slate-300 text-slate-600 inline-flex items-center justify-center cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : confirmDeleteLineId === line.id ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDeleteLine(line.id)}
                                className="h-7 px-2 rounded-md bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Xóa
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteLineId(null)}
                                className="h-7 px-2 rounded-md border border-slate-300 text-slate-600 text-[11px] cursor-pointer"
                              >
                                Hủy
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLineId(line.id);
                                  setEditLineName(line.name);
                                  setEditLineDesc(line.description || '');
                                  setConfirmDeleteLineId(null);
                                }}
                                aria-label={`Sửa Line ${line.name}`}
                                className="w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:border-[#14539E] hover:text-[#14539E] inline-flex items-center justify-center cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteLineId(line.id)}
                                aria-label={`Xóa Line ${line.name}`}
                                className="w-7 h-7 rounded-md border border-red-200 text-red-500 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 1.3: KHÁCH HÀNG (`st_customers`) */}
      {setupSubTab === 'customers' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="text"
                value={newCustShort}
                onChange={(e) => setNewCustShort(e.target.value)}
                placeholder="Tên viết tắt * (VD: SAMSUNG, LG)"
                aria-label="Tên viết tắt khách hàng"
                className="w-full lg:w-52 h-8 px-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <input
                type="text"
                value={newCustFull}
                onChange={(e) => setNewCustFull(e.target.value)}
                placeholder="Tên chi tiết đầy đủ..."
                aria-label="Tên chi tiết khách hàng"
                className="flex-1 min-w-[200px] h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <input
                type="text"
                value={newCustNotes}
                onChange={(e) => setNewCustNotes(e.target.value)}
                placeholder="Ghi chú..."
                aria-label="Ghi chú khách hàng"
                className="flex-1 min-w-[160px] h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
              />
              <button
                type="button"
                disabled={isAddingCust}
                onClick={() => void handleAddCustomer()}
                className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isAddingCust ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Thêm KH</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {customers.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Chưa có khách hàng nào. Hãy thêm khách hàng mới (VD: SAMSUNG, LG) ở thanh phía trên.
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-2 py-2 w-12 text-center border-r border-slate-200/70">
                      STT
                    </th>
                    <th className="px-3 py-2 w-44 border-r border-slate-200/70">
                      Tên viết tắt
                    </th>
                    <th className="px-3 py-2 w-[38%] border-r border-slate-200/70">
                      Tên chi tiết đầy đủ
                    </th>
                    <th className="px-3 py-2 border-r border-slate-200/70">
                      Ghi chú
                    </th>
                    <th className="px-3 py-2 w-28 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {customers.map((cust, idx) => {
                    const isEditing = editingCustId === cust.id;
                    const isBusy = savingCustId === cust.id;
                    return (
                      <tr key={cust.id} className="hover:bg-blue-50/30">
                        <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-500 tabular-nums border-r border-slate-100">
                          {formatNumberVN(idx + 1)}
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-100 font-bold text-[#14539E]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editCustShort}
                              onChange={(e) => setEditCustShort(e.target.value)}
                              aria-label="Sửa tên viết tắt khách hàng"
                              className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                            />
                          ) : (
                            cust.short_name
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-100 text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editCustFull}
                              onChange={(e) => setEditCustFull(e.target.value)}
                              aria-label="Sửa tên đầy đủ khách hàng"
                              className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                            />
                          ) : (
                            cust.full_name || '—'
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-100 text-slate-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editCustNotes}
                              onChange={(e) => setEditCustNotes(e.target.value)}
                              aria-label="Sửa ghi chú khách hàng"
                              className="w-full h-7 px-2 text-xs border border-[#14539E] rounded bg-white"
                            />
                          ) : (
                            cust.notes || '—'
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleSaveCustomer(cust.id)}
                                  aria-label={`Lưu khách hàng ${cust.short_name}`}
                                  className="w-7 h-7 rounded-md bg-emerald-600 text-white inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCustId(null)}
                                  aria-label="Hủy sửa khách hàng"
                                  className="w-7 h-7 rounded-md border border-slate-300 text-slate-600 inline-flex items-center justify-center cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : confirmDeleteCustId === cust.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleDeleteCustomer(cust.id)}
                                  className="h-7 px-2 rounded-md bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCustId(null)}
                                  className="h-7 px-2 rounded-md border border-slate-300 text-slate-600 text-[11px] cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCustId(cust.id);
                                    setEditCustShort(cust.short_name);
                                    setEditCustFull(cust.full_name);
                                    setEditCustNotes(cust.notes || '');
                                    setConfirmDeleteCustId(null);
                                  }}
                                  aria-label={`Sửa khách hàng ${cust.short_name}`}
                                  className="w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:border-[#14539E] hover:text-[#14539E] inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCustId(cust.id)}
                                  aria-label={`Xóa khách hàng ${cust.short_name}`}
                                  className="w-7 h-7 rounded-md border border-red-200 text-red-500 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
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
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.title}
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 truncate">
                {previewImage.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                aria-label="Đóng xem ảnh"
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex items-center justify-center max-h-[70vh]">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                referrerPolicy="no-referrer"
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
