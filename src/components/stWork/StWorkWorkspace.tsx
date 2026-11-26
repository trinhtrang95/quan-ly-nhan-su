import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  LayoutGrid,
  PackageCheck,
  RefreshCw,
  SlidersHorizontal,
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
} from '../../utils/stWorkSupabase';
import { StChangeRequestsTab } from './StChangeRequestsTab';
import { StCustomerQuotesTab } from './StCustomerQuotesTab';
import { StGeneralSetupTab } from './StGeneralSetupTab';
import { StNewProductsTab } from './StNewProductsTab';
import { StOverviewTab } from './StOverviewTab';
import { StReportTab } from './StReportTab';

export interface StWorkWorkspaceProps {
  groups: DepartmentGroup[];
  onShowToast?: (message: string) => void;
}

const SUB_TABS: Array<{
  id: StWorkSubTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutGrid },
  { id: 'new_products', label: 'Mã hàng mới', icon: PackageCheck },
  { id: 'change_requests', label: 'Phiếu yêu cầu', icon: ClipboardList },
  { id: 'customer_quotes', label: 'Báo giá khách hàng', icon: FileSpreadsheet },
  { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
  { id: 'general_setup', label: 'Thiết lập chung', icon: SlidersHorizontal },
];

export const StWorkWorkspace: React.FC<StWorkWorkspaceProps> = ({
  groups,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<StWorkSubTab>('overview');
  const [lines, setLines] = useState<StLine[]>([]);
  const [customers, setCustomers] = useState<StCustomer[]>([]);
  const [products, setProducts] = useState<StProduct[]>([]);
  const [newProductStatuses, setNewProductStatuses] = useState<
    StNewProductStatus[]
  >([]);
  const [changeRequests, setChangeRequests] = useState<StChangeRequest[]>([]);
  const [customerQuotes, setCustomerQuotes] = useState<StCustomerQuote[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const loadSnapshot = useCallback(async (silent: boolean = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);

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
      setIsRefreshing(false);
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

  const handleSelectTab = (tab: StWorkSubTab) => {
    setActiveTab(tab);
    void loadSnapshot(true);
  };

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

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      {/* Workspace Header + 6 Bordered Sub-Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-5 py-3 shrink-0 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Quản lý công việc ST
            </h1>
            <p className="text-xs text-slate-500">
              Theo dõi mã hàng mới SX đại trà, phiếu yêu cầu thay đổi, báo giá khách hàng và báo cáo định kỳ
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSnapshot(true)}
            disabled={isRefreshing}
            title="Làm mới dữ liệu từ Supabase"
            className="h-8 px-3 rounded-lg bg-white border border-slate-300 hover:border-[#14539E] text-slate-700 hover:text-[#14539E] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </button>
        </div>

        {/* 6 Bordered Sub-Tab Buttons */}
        <div
          role="tablist"
          aria-label="Phân hệ Quản lý công việc ST"
          className="flex flex-wrap items-center gap-2"
        >
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`st-subtab-${tab.id}`}
                onClick={() => handleSelectTab(tab.id)}
                className={`h-9 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 border transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#14539E] text-white border-[#14539E] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-[#14539E] hover:text-[#14539E]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
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

        {activeTab === 'new_products' && (
          <StNewProductsTab
            lines={lines}
            customers={customers}
            productsWithStatus={productsWithStatus}
            isLoading={isLoading}
            onStatusUpdated={handleStatusUpdated}
            onShowToast={onShowToast}
            onNavigateTab={handleSelectTab}
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

        {activeTab === 'general_setup' && (
          <StGeneralSetupTab
            lines={lines}
            customers={customers}
            products={products}
            isLoading={isLoading}
            onRefresh={() => loadSnapshot(true)}
            onShowToast={onShowToast}
          />
        )}
      </div>
    </div>
  );
};
