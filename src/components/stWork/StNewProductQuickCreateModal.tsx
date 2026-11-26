import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, FileSpreadsheet, Loader2, Package, Plus, Upload, X } from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  getLocalIsoDateToday,
  StCustomer,
  StLine,
  StNewProductStatus,
  StProduct,
} from '../../utils/stWorkLogic';
import {
  createStCustomer,
  createStLine,
  createStProductWithInitialStatus,
  uploadImageToHrBucket,
} from '../../services/stWorkService';

export interface StNewProductQuickCreateModalProps {
  isOpen: boolean;
  lines: StLine[];
  customers: StCustomer[];
  existingProductCodes: Set<string>;
  onClose: () => void;
  onCreated: (product: StProduct, status: StNewProductStatus) => void;
  onRefresh: () => Promise<void>;
  onOpenImport?: () => void;
  onShowToast?: (message: string) => void;
}

export const StNewProductQuickCreateModal: React.FC<
  StNewProductQuickCreateModalProps
> = ({
  isOpen,
  lines,
  customers,
  existingProductCodes,
  onClose,
  onCreated,
  onRefresh,
  onOpenImport,
  onShowToast,
}) => {
  // Section 1: st_products fields
  const [lineName, setLineName] = useState<string>('');
  const [customerShort, setCustomerShort] = useState<string>('');
  const [productCode, setProductCode] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [specification, setSpecification] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isUploadingImg, setIsUploadingImg] = useState<boolean>(false);

  // Section 2: st_new_product_status fields
  const [hasProcessErp, setHasProcessErp] = useState<boolean>(true);
  const [processErpDate, setProcessErpDate] = useState<string>(() =>
    getLocalIsoDateToday()
  );
  const [notes, setNotes] = useState<string>('');

  // Form submission & validation
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Quick-add Line sub-modal
  const [quickLineOpen, setQuickLineOpen] = useState<boolean>(false);
  const [quickLineName, setQuickLineName] = useState<string>('');
  const [quickLineDesc, setQuickLineDesc] = useState<string>('');
  const [isSavingLine, setIsSavingLine] = useState<boolean>(false);

  // Quick-add Customer sub-modal
  const [quickCustOpen, setQuickCustOpen] = useState<boolean>(false);
  const [quickCustShort, setQuickCustShort] = useState<string>('');
  const [quickCustFull, setQuickCustFull] = useState<string>('');
  const [isSavingCust, setIsSavingCust] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setLineName((prev) => prev || lines[0]?.name || '');
    setCustomerShort((prev) => prev || customers[0]?.short_name || '');
    setProductCode('');
    setProductName('');
    setSpecification('');
    setImageUrl('');
    setHasProcessErp(true);
    setProcessErpDate(getLocalIsoDateToday());
    setNotes('');
    setFormError(null);
  }, [isOpen, lines, customers]);

  if (!isOpen) return null;

  const effectiveLine = lineName || lines[0]?.name || '';
  const effectiveCustomer = customerShort || customers[0]?.short_name || '';

  const handleUploadImage = async (file: File) => {
    setIsUploadingImg(true);
    try {
      const publicUrl = await uploadImageToHrBucket(file, 'st-products');
      setImageUrl(publicUrl);
      onShowToast?.('Đã nén và tải ảnh sản phẩm lên hệ thống.');
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsUploadingImg(false);
    }
  };

  const handleSaveQuickLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLineName.trim()) {
      onShowToast?.('Vui lòng nhập tên Line.');
      return;
    }
    setIsSavingLine(true);
    try {
      const nextSort =
        lines.reduce((max, l) => Math.max(max, l.sort_order || 0), 0) + 1;
      const created = await createStLine({
        name: quickLineName.trim(),
        description: quickLineDesc.trim() || null,
        sort_order: nextSort,
      });
      await onRefresh();
      setLineName(created.name);
      setQuickLineName('');
      setQuickLineDesc('');
      setQuickLineOpen(false);
      onShowToast?.(`Đã thêm nhanh Line "${created.name}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingLine(false);
    }
  };

  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustShort.trim()) {
      onShowToast?.('Vui lòng nhập Tên viết tắt của khách hàng.');
      return;
    }
    setIsSavingCust(true);
    try {
      const created = await createStCustomer({
        short_name: quickCustShort.trim(),
        full_name: quickCustFull.trim() || quickCustShort.trim(),
        notes: null,
      });
      await onRefresh();
      setCustomerShort(created.short_name);
      setQuickCustShort('');
      setQuickCustFull('');
      setQuickCustOpen(false);
      onShowToast?.(`Đã thêm nhanh Khách hàng "${created.short_name}".`);
    } catch (err) {
      onShowToast?.(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingCust(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanCode = productCode.trim();
    const cleanName = productName.trim();
    if (!effectiveLine) {
      setFormError('Vui lòng chọn hoặc nhấn "+" để thêm Line sản xuất.');
      return;
    }
    if (!effectiveCustomer) {
      setFormError('Vui lòng chọn hoặc nhấn "+" để thêm Khách hàng.');
      return;
    }
    if (!cleanCode) {
      setFormError('Vui lòng nhập Mã hàng.');
      return;
    }
    if (!cleanName) {
      setFormError('Vui lòng nhập Tên hàng.');
      return;
    }
    if (existingProductCodes.has(cleanCode.toLowerCase())) {
      setFormError(`Mã hàng "${cleanCode}" đã tồn tại trong Danh mục sản phẩm.`);
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const result = await createStProductWithInitialStatus({
        line_name: effectiveLine,
        customer_short_name: effectiveCustomer,
        product_code: cleanCode,
        product_name: cleanName,
        specification: specification.trim(),
        image_url: imageUrl.trim() || null,
        has_process_erp: hasProcessErp,
        process_erp_date: hasProcessErp
          ? processErpDate || getLocalIsoDateToday()
          : processErpDate || null,
        notes: notes.trim() || null,
      });

      onCreated(result.product, result.status);
      await onRefresh();
      onShowToast?.(
        `Đã thêm mã hàng "${result.product.product_code}" và đồng bộ sang Danh mục sản phẩm.`
      );
      onClose();
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      setFormError(msg);
      onShowToast?.(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thêm mã hàng mới"
        onClick={() => {
          if (!isSaving) onClose();
        }}
        className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4"
      >
        <form
          data-testid="st-quick-create-modal"
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2 bg-slate-50/80 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-[#14539E] inline-flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#14539E]">
                    Thêm mã hàng mới
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Lưu đồng thời vào Danh mục sản phẩm và bảng tiến độ Đơn giá mới
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              aria-label="Đóng cửa sổ thêm mã hàng mới"
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 inline-flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto space-y-4 text-xs">
            {formError && (
              <div
                data-testid="st-quick-create-error"
                className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
              >
                {formError}
              </div>
            )}

            {/* Section 1: Thông tin danh mục sản phẩm (st_products) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Package className="w-3.5 h-3.5 text-[#14539E]" />
                <span>1. Thông tin danh mục sản phẩm</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Line + Quick Add */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Line sản xuất <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      data-testid="st-quick-create-line"
                      value={effectiveLine}
                      onChange={(e) => setLineName(e.target.value)}
                      aria-label="Chọn Line sản xuất"
                      className="flex-1 min-w-0 h-8 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
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
                      data-testid="st-quick-create-add-line-btn"
                      onClick={() => setQuickLineOpen(true)}
                      title="Thêm nhanh Line mới"
                      aria-label="Thêm nhanh Line mới"
                      className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:border-[#14539E] text-[#14539E] inline-flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Khách hàng + Quick Add */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Khách hàng <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      data-testid="st-quick-create-customer"
                      value={effectiveCustomer}
                      onChange={(e) => setCustomerShort(e.target.value)}
                      aria-label="Chọn Khách hàng"
                      className="flex-1 min-w-0 h-8 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] cursor-pointer"
                    >
                      {customers.length === 0 ? (
                        <option value="">-- Chưa có Khách hàng --</option>
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
                      data-testid="st-quick-create-add-customer-btn"
                      onClick={() => setQuickCustOpen(true)}
                      title="Thêm nhanh Khách hàng mới"
                      aria-label="Thêm nhanh Khách hàng mới"
                      className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:border-[#14539E] text-[#14539E] inline-flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mã hàng * */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="st-quick-create-code"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder="VD: 2026-ST-001"
                    className="w-full h-8 px-2.5 font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>

                {/* Tên hàng * */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="st-quick-create-name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Nhập tên sản phẩm..."
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Quy cách */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quy cách
                  </label>
                  <input
                    type="text"
                    data-testid="st-quick-create-spec"
                    value={specification}
                    onChange={(e) => setSpecification(e.target.value)}
                    placeholder="VD: SUS304 1.2T"
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>

                {/* URL ảnh / Tải ảnh lên */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hình ảnh sản phẩm
                  </label>
                  <div className="flex items-center gap-1.5">
                    {imageUrl && (
                      <div className="w-8 h-8 rounded-lg border border-slate-300 overflow-hidden bg-white shrink-0">
                        <img
                          src={imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="URL ảnh hoặc tải ảnh lên..."
                      aria-label="URL ảnh sản phẩm mới"
                      className="flex-1 min-w-0 h-8 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                    />
                    <label
                      title="Tải ảnh từ máy tính"
                      className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#14539E] text-slate-700 hover:text-[#14539E] inline-flex items-center gap-1 cursor-pointer shrink-0 font-medium"
                    >
                      {isUploadingImg ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#14539E]" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>Tải lên</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingImg}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadImage(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Thông tin quy trình ban đầu (st_new_product_status) */}
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/35 p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. Thông tin quy trình ban đầu</span>
              </div>

              <div className="rounded-lg border border-emerald-200/80 bg-white px-3 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="st-quick-create-erp-check"
                    checked={hasProcessErp}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasProcessErp(checked);
                      setProcessErpDate((prev) =>
                        checked ? prev || getLocalIsoDateToday() : ''
                      );
                    }}
                    className="w-4 h-4 accent-[#14539E] rounded cursor-pointer"
                  />
                  <span>Đã có Quy trình ERP</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                    Ngày tạo QT:
                  </span>
                  <input
                    type="date"
                    data-testid="st-quick-create-erp-date"
                    value={processErpDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProcessErpDate(val);
                      if (val) setHasProcessErp(true);
                    }}
                    aria-label="Ngày tạo QT ban đầu"
                    className="h-8 w-36 px-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ghi chú
                </label>
                <textarea
                  rows={2}
                  data-testid="st-quick-create-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nhập ghi chú xử lý ban đầu (nếu có)..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div>
              {onOpenImport && (
                <button
                  type="button"
                  disabled={isSaving}
                  data-testid="st-quick-create-import-btn"
                  onClick={() => {
                    onClose();
                    onOpenImport();
                  }}
                  className="h-9 px-3 rounded-lg border border-[#14539E]/35 bg-white hover:bg-[#14539E] text-[#14539E] hover:text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Nhập từ file</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                data-testid="st-quick-create-save-btn"
                className="h-9 px-4 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Lưu mã hàng mới</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Quick-add Line Modal */}
      {quickLineOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thêm nhanh Line mới"
          onClick={() => !isSavingLine && setQuickLineOpen(false)}
          className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveQuickLine}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-[#14539E]">
                Thêm nhanh Line mới
              </span>
              <button
                type="button"
                onClick={() => setQuickLineOpen(false)}
                aria-label="Đóng"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
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
                  required
                  value={quickLineName}
                  onChange={(e) => setQuickLineName(e.target.value)}
                  placeholder="VD: Line 5..."
                  className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mô tả
                </label>
                <input
                  type="text"
                  value={quickLineDesc}
                  onChange={(e) => setQuickLineDesc(e.target.value)}
                  placeholder="Ghi chú ngắn (nếu có)..."
                  className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickLineOpen(false)}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingLine}
                className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isSavingLine && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Lưu Line</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick-add Customer Modal */}
      {quickCustOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thêm nhanh Khách hàng mới"
          onClick={() => !isSavingCust && setQuickCustOpen(false)}
          className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveQuickCustomer}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-[#14539E]">
                Thêm nhanh Khách hàng mới
              </span>
              <button
                type="button"
                onClick={() => setQuickCustOpen(false)}
                aria-label="Đóng"
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
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
                  required
                  value={quickCustShort}
                  onChange={(e) => setQuickCustShort(e.target.value)}
                  placeholder="VD: SAMSUNG, LG..."
                  className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên đầy đủ
                </label>
                <input
                  type="text"
                  value={quickCustFull}
                  onChange={(e) => setQuickCustFull(e.target.value)}
                  placeholder="Tên công ty đầy đủ..."
                  className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#14539E]"
                />
              </div>
            </div>
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickCustOpen(false)}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingCust}
                className="h-8 px-3.5 rounded-lg bg-[#14539E] hover:bg-[#0F3E77] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isSavingCust && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Lưu Khách hàng</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
