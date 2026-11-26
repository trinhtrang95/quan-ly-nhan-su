import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  LayoutGrid,
  Package,
  PackageCheck,
} from 'lucide-react';
import { DepartmentGroup } from '../../types/hr';
import { getFriendlyErrorMessage } from '../../utils/errorAndSecurityService';
import {
  applyRealtimeStRow,
  mergeProductsWithStatus,
  normalizeStChangeRequestRow,
  normalizeStCustomerQuoteRow,
  normalizeStCustomerRow,
  normalizeStLineRow,
  normalizeStNewProductStatusRow,
  normalizeStProductRow,
  StChangeRequest,
  StCustomer,
  StCustomerQuote,
  StLine,
  StNewProductStatus,
  StProduct,
  StWorkSubTab,
} from '../../utils/stWorkLogic';
import {
  fetchAllStWorkData,
  subscribeToStWorkRealtime,
} from '../../services/stWorkService';
import { StChangeRequestsTab } from './StChangeRequestsTab';
import { StCustomerQuotesTab } from './StCustomerQuotesTab';
import { StNewProductsTab } from './StNewProductsTab';
import { StOverviewTab } from './StOverviewTab';
import { StProductCatalogTab } from './StProductCatalogTab';
import { StReportTab } from './StReportTab';

export interface StWorkWorkspaceProps {
  groups: DepartmentGroup[];
  activeSubTab?: StWorkSubTab;
  onSubTabChange?: (tab: StWorkSubTab) => void;
  onShowToast?: (message: string) => void;
}

const SUB_TAB_META: Record<
  StWorkSubTab,
  {
    title: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  overview: {
    title: 'Tổng quan ST',
    subtitle:
      'Tổng hợp tiến độ mã hàng mới SX đại trà, phiếu yêu cầu thay đổi và báo giá khách hàng',
    icon: LayoutGrid,
  },
  products_catalog: {
    title: 'Danh mục sản phẩm',
    subtitle:
      'Quản lý thông tin chuẩn mã hàng, quy cách, Line, Khách hàng và hình ảnh sản phẩm',
    icon: Package,
  },
  new_products: {
    title: 'Đơn giá mới',
    subtitle: '',
    icon: PackageCheck,
  },
  change_requests: {
    title: 'Phiếu yêu cầu',
    subtitle:
      'Tiếp nhận và theo dõi xử lý các phiếu yêu cầu thay đổi từ các bộ phận',
    icon: ClipboardList,
  },
  customer_quotes: {
    title: 'Báo giá khách hàng',
    subtitle: 'Theo dõi hồ sơ báo giá khách hàng thuộc bộ phận ST',
    icon: FileSpreadsheet,
  },
  reports: {
    title: 'Báo cáo ST',
    subtitle:
      'Thống kê so sánh chỉ tiêu theo ngày / tháng / năm và xuất Excel 4 sheet chuyên nghiệp',
    icon: BarChart3,
  },
};

export const StWorkWorkspace: React.FC<StWorkWorkspaceProps> = ({
  groups,
  activeSubTab,
  onSubTabChange,
  onShowToast,
}) => {
  const [internalTab, setInternalTab] = useState<StWorkSubTab>('overview');
  const activeTab = activeSubTab ?? internalTab;

  const [lines, setLines] = useState<StLine[]>([]);
  const [customers, setCustomers] = useState<StCustomer[]>([]);
  const [products, setProducts] = useState<StProduct[]>([]);
  const [newProductStatuses, setNewProductStatuses] = useState<
    StNewProductStatus[]
  >([]);
  const [changeRequests, setChangeRequests] = useState<StChangeRequest[]>([]);
  const [customerQuotes, setCustomerQuotes] = useState<StCustomerQuote[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const loadSnapshot = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);

    try {
      const snapshot = await fetchAllStWorkData();
      setLines(snapshot.lines);
      setCustomers(snapshot.customers);
      setProducts(snapshot.products);
      setNewProductStatuses(snapshot.newProductStatuses);
      setChangeRequests(snapshot.changeRequests);
      setCustomerQuotes(snapshot.customerQuotes);
      setLoadError(null);
    } catch (err) {
      setLoadError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot(false);
  }, [loadSnapshot]);

  // Realtime sync across all 6 ST tables (zero localStorage)
  useEffect(() => {
    const unsubscribe = subscribeToStWorkRealtime((table, event) => {
      switch (table) {
        case 'st_lines':
          setLines((prev) =>
            applyRealtimeStRow(
              prev,
              event,
              normalizeStLineRow,
              (a, b) => a.sort_order - b.sort_order
            )
          );
          break;
        case 'st_customers':
          setCustomers((prev) =>
            applyRealtimeStRow(
              prev,
              event,
              normalizeStCustomerRow,
              (a, b) => a.short_name.localeCompare(b.short_name)
            )
          );
          break;
        case 'st_products':
          setProducts((prev) =>
            applyRealtimeStRow(prev, event, normalizeStProductRow, (a, b) =>
              b.created_at.localeCompare(a.created_at)
            )
          );
          break;
        case 'st_new_product_status':
          setNewProductStatuses((prev) =>
            applyRealtimeStRow(prev, event, normalizeStNewProductStatusRow)
          );
          break;
        case 'st_change_requests':
          setChangeRequests((prev) =>
            applyRealtimeStRow(
              prev,
              event,
              normalizeStChangeRequestRow,
              (a, b) => b.received_at.localeCompare(a.received_at)
            )
          );
          break;
        case 'st_customer_quotes':
          setCustomerQuotes((prev) =>
            applyRealtimeStRow(prev, event, normalizeStCustomerQuoteRow)
          );
          break;
      }

      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        void loadSnapshot(true);
      }, 650);
    });

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      unsubscribe();
    };
  }, [loadSnapshot]);

  const handleSelectTab = useCallback(
    (tab: StWorkSubTab) => {
      if (onSubTabChange) {
        onSubTabChange(tab);
      } else {
        setInternalTab(tab);
      }
      void loadSnapshot(true);
    },
    [onSubTabChange, loadSnapshot]
  );

  const productsWithStatus = useMemo(
    () => mergeProductsWithStatus(products, newProductStatuses),
    [products, newProductStatuses]
  );

  const handleStatusUpdated = useCallback((saved: StNewProductStatus) => {
    setNewProductStatuses((prev) => {
      const exists = prev.some(
        (s) => s.id === saved.id || s.product_id === saved.product_id
      );
      if (!exists) return [saved, ...prev];
      return prev.map((s) =>
        s.id === saved.id || s.product_id === saved.product_id ? saved : s
      );
    });
  }, []);

  const handleProductAndStatusCreated = useCallback(
    (product: StProduct, status: StNewProductStatus) => {
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === product.id);
        return exists
          ? prev.map((p) => (p.id === product.id ? product : p))
          : [product, ...prev];
      });
      handleStatusUpdated(status);
    },
    [handleStatusUpdated]
  );

  const currentMeta = SUB_TAB_META[activeTab];
  const HeaderIcon = currentMeta.icon;

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      {/* Compact Header (No Horizontal Sub-Tab Bar — Sidebar Accordion handles navigation) */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-5 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`rounded-lg bg-blue-50 border border-blue-200/80 text-[#14539E] flex items-center justify-center shrink-0 ${
                activeTab === 'new_products' ? 'w-9 h-9' : 'w-8 h-8'
              }`}
            >
              <HeaderIcon
                className={activeTab === 'new_products' ? 'w-5 h-5' : 'w-4 h-4'}
              />
            </span>
            <div className="min-w-0">
              <h1
                className={`font-bold text-slate-900 tracking-tight truncate ${
                  activeTab === 'new_products'
                    ? 'text-2xl leading-tight'
                    : 'text-sm sm:text-base'
                }`}
              >
                {currentMeta.title}
              </h1>
              {currentMeta.subtitle && (
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                  {currentMeta.subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Sub-Tab Body */}
      <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-4 overflow-hidden gap-3">
        {loadError && (
          <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadSnapshot(false)}
              className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
            <StOverviewTab
              productsWithStatus={productsWithStatus}
              changeRequests={changeRequests}
              customerQuotes={customerQuotes}
              groups={groups}
              isLoading={isLoading}
              onNavigateTab={handleSelectTab}
            />
          </div>
        )}

        {activeTab === 'products_catalog' && (
          <StProductCatalogTab
            lines={lines}
            customers={customers}
            products={products}
            isLoading={isLoading}
            onRefresh={() => loadSnapshot(true)}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'new_products' && (
          <StNewProductsTab
            lines={lines}
            customers={customers}
            productsWithStatus={productsWithStatus}
            isLoading={isLoading}
            onStatusUpdated={handleStatusUpdated}
            onProductAndStatusCreated={handleProductAndStatusCreated}
            onRefresh={() => loadSnapshot(true)}
            onNavigateToCatalog={() => handleSelectTab('products_catalog')}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'change_requests' && (
          <StChangeRequestsTab
            changeRequests={changeRequests}
            products={products}
            groups={groups}
            isLoading={isLoading}
            onRefresh={() => loadSnapshot(true)}
            onShowToast={onShowToast}
          />
        )}

        {activeTab === 'customer_quotes' && <StCustomerQuotesTab />}

        {activeTab === 'reports' && (
          <StReportTab
            productsWithStatus={productsWithStatus}
            changeRequests={changeRequests}
            customerQuotes={customerQuotes}
            onShowToast={onShowToast}
          />
        )}
      </div>
    </div>
  );
};
