export type StWorkSubTab =
  | 'overview'
  | 'new_products'
  | 'change_requests'
  | 'customer_quotes'
  | 'reports';

export type StSetupSubTab = 'lines' | 'customers';

export type StChangeRequestStatus =
  | 'Mới'
  | 'Đang xử lý'
  | 'Chờ duyệt'
  | 'Đã xử lý'
  | 'Từ chối'
  | 'Đã áp dụng';

export const ST_CHANGE_REQUEST_STATUSES: StChangeRequestStatus[] = [
  'Mới',
  'Đang xử lý',
  'Chờ duyệt',
  'Đã xử lý',
  'Từ chối',
  'Đã áp dụng',
];

export const ST_STATUS_BADGE_META: Record<
  StChangeRequestStatus,
  { bgClass: string; textClass: string; borderClass: string }
> = {
  Mới: {
    bgClass: 'bg-sky-50',
    textClass: 'text-sky-700',
    borderClass: 'border-sky-200',
  },
  'Đang xử lý': {
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
  },
  'Chờ duyệt': {
    bgClass: 'bg-violet-50',
    textClass: 'text-violet-700',
    borderClass: 'border-violet-200',
  },
  'Đã xử lý': {
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    borderClass: 'border-teal-200',
  },
  'Từ chối': {
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
  },
  'Đã áp dụng': {
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
  },
};

export interface StLine {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface StCustomer {
  id: string;
  short_name: string;
  full_name: string;
  notes: string | null;
  created_at: string;
}

export interface StProduct {
  id: string;
  line_name: string;
  customer_short_name: string;
  product_name: string;
  product_code: string;
  specification: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StNewProductStatus {
  id: string;
  product_id: string;
  has_process: boolean;
  process_created_at: string | null;
  has_unit_price: boolean;
  unit_price: number | null;
  currency: string;
  price_created_at: string | null;
  price_applied_at: string | null;
  notes: string | null;
  updated_at: string;
}

export interface StProductWithStatus {
  product: StProduct;
  status: StNewProductStatus | null;
  isCompleted: boolean;
  progressCategory: 'completed' | 'pending_process' | 'pending_price';
  completionDays: number | null;
}

export interface StChangeRequest {
  id: string;
  department: string;
  content: string;
  received_at: string;
  product_code: string;
  specification: string;
  status: StChangeRequestStatus;
  processed_at: string | null;
  applied_version: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StCustomerQuote {
  id: string;
  quote_code: string | null;
  customer_short_name: string | null;
  status: string;
  quoted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StRealtimeChangeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRow: Record<string, unknown> | null;
  oldRow: Record<string, unknown> | null;
}

export type StOverviewPeriodMode = 'last_month' | 'this_month' | 'custom';
export type StReportPeriodMode = 'day' | 'month' | 'year';

export interface StResolvedPeriodRange {
  currentStart: string;
  currentEnd: string;
  prevStart: string;
  prevEnd: string;
  currentLabel: string;
  prevLabel: string;
}

export interface StOverviewMetrics {
  completedInPeriodCount: number;
  completedInPrevPeriodCount: number;
  completedDelta: number;
  inProgressTotalCount: number;
  pendingProcessCount: number;
  pendingPriceCount: number;
  avgCompletionDaysInPeriod: number | null;
  avgCompletionDaysAllCompleted: number | null;
  requestsInPeriodCount: number;
  requestsInPrevPeriodCount: number;
  requestsByDepartment: Array<{ department: string; count: number }>;
  requestsByStatus: Array<{ status: StChangeRequestStatus; count: number }>;
  quotesTotalCount: number;
  quotesQuotedCount: number;
  quotesRemainingCount: number;
}

export interface StReportComparisonRow {
  key: string;
  label: string;
  currentValue: number;
  previousValue: number;
  delta: number;
  unit: string;
  note: string;
}

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function getLocalIsoDateToday(referenceDate: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceDate);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

export function getLocalYearMonth(referenceDate: Date = new Date()): {
  year: number;
  month: number;
} {
  const iso = getLocalIsoDateToday(referenceDate);
  const [y, m] = iso.split('-').map(Number);
  return { year: y, month: m };
}

export function toIsoDateOnly(input?: string | null): string {
  if (!input) return '';
  const trimmed = String(input).trim();
  if (!trimmed) return '';
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return trimmed;
  }
  const prefixMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ]/);
  if (trimmed.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return getLocalIsoDateToday(parsed);
    }
  }
  if (prefixMatch) {
    return `${prefixMatch[1]}-${prefixMatch[2]}-${prefixMatch[3]}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return getLocalIsoDateToday(parsed);
}

export function formatStDateVN(input?: string | null): string {
  const iso = toIsoDateOnly(input);
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatNumberVN(num: number): string {
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatUnitPrice(
  amount?: number | null,
  currency: string = 'VND'
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  const formatted = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 4,
  }).format(amount);
  return `${formatted} ${currency || 'VND'}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function shiftIsoDateByDays(isoDate: string, deltaDays: number): string {
  const normalized = toIsoDateOnly(isoDate);
  if (!normalized) return '';
  const [y, m, d] = normalized.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(
    dt.getUTCDate()
  )}`;
}

export function calculateCompletionDays(
  registeredDate?: string | null,
  priceAppliedAt?: string | null
): number | null {
  const startIso = toIsoDateOnly(registeredDate);
  const endIso = toIsoDateOnly(priceAppliedAt);
  if (!startIso || !endIso) return null;

  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  const diffDays = Math.round((endMs - startMs) / 86400000);
  return diffDays >= 0 ? diffDays : 0;
}

export function isNewProductCompleted(
  status?: Pick<StNewProductStatus, 'has_process' | 'price_applied_at'> | null
): boolean {
  if (!status) return false;
  return Boolean(status.has_process && toIsoDateOnly(status.price_applied_at));
}

export function getNewProductProgressCategory(
  status?: Pick<StNewProductStatus, 'has_process' | 'price_applied_at'> | null
): 'completed' | 'pending_process' | 'pending_price' {
  if (isNewProductCompleted(status)) return 'completed';
  if (status?.has_process) return 'pending_price';
  return 'pending_process';
}

export function mergeProductsWithStatus(
  products: StProduct[],
  statuses: StNewProductStatus[]
): StProductWithStatus[] {
  const statusByProductId = new Map<string, StNewProductStatus>();
  for (const st of statuses) {
    if (st.product_id) {
      statusByProductId.set(st.product_id, st);
    }
  }

  return products.map((product) => {
    const status = statusByProductId.get(product.id) || null;
    const isCompleted = isNewProductCompleted(status);
    const progressCategory = getNewProductProgressCategory(status);
    const completionDays = isCompleted
      ? calculateCompletionDays(product.created_at, status?.price_applied_at)
      : null;

    return {
      product,
      status,
      isCompleted,
      progressCategory,
      completionDays,
    };
  });
}

export function buildMonthRange(year: number, month: number): {
  start: string;
  end: string;
  label: string;
} {
  const lastDay = daysInMonth(year, month);
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(lastDay)}`,
    label: `Tháng ${pad2(month)}/${year}`,
  };
}

export function getPreviousYearMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month <= 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

export function resolveOverviewPeriodRange(
  mode: StOverviewPeriodMode,
  customYear: number,
  customMonth: number,
  referenceDate: Date = new Date()
): StResolvedPeriodRange {
  const nowYM = getLocalYearMonth(referenceDate);
  let targetYM = nowYM;
  if (mode === 'last_month') {
    targetYM = getPreviousYearMonth(nowYM.year, nowYM.month);
  } else if (mode === 'custom') {
    targetYM = { year: customYear, month: customMonth };
  }

  const prevYM = getPreviousYearMonth(targetYM.year, targetYM.month);
  const current = buildMonthRange(targetYM.year, targetYM.month);
  const prev = buildMonthRange(prevYM.year, prevYM.month);

  return {
    currentStart: current.start,
    currentEnd: current.end,
    prevStart: prev.start,
    prevEnd: prev.end,
    currentLabel: current.label,
    prevLabel: prev.label,
  };
}

export function resolveReportPeriodRange(
  mode: StReportPeriodMode,
  params: {
    dayMode?: 'single' | 'range';
    singleDay?: string;
    rangeStart?: string;
    rangeEnd?: string;
    year: number;
    month: number;
  },
  referenceDate: Date = new Date()
): StResolvedPeriodRange {
  if (mode === 'day') {
    const todayIso = getLocalIsoDateToday(referenceDate);
    const isRange = params.dayMode === 'range';
    const rawStart = toIsoDateOnly(
      isRange ? params.rangeStart : params.singleDay
    ) || todayIso;
    const rawEnd = toIsoDateOnly(
      isRange ? params.rangeEnd : params.singleDay
    ) || rawStart;

    const currentStart = rawStart <= rawEnd ? rawStart : rawEnd;
    const currentEnd = rawStart <= rawEnd ? rawEnd : rawStart;

    const [sy, sm, sd] = currentStart.split('-').map(Number);
    const [ey, em, ed] = currentEnd.split('-').map(Number);
    const spanDays =
      Math.max(
        1,
        Math.round(
          (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000
        ) + 1
      );

    const prevEnd = shiftIsoDateByDays(currentStart, -1);
    const prevStart = shiftIsoDateByDays(prevEnd, -(spanDays - 1));

    return {
      currentStart,
      currentEnd,
      prevStart,
      prevEnd,
      currentLabel:
        currentStart === currentEnd
          ? `Ngày ${formatStDateVN(currentStart)}`
          : `${formatStDateVN(currentStart)} – ${formatStDateVN(currentEnd)}`,
      prevLabel:
        prevStart === prevEnd
          ? `Ngày ${formatStDateVN(prevStart)}`
          : `${formatStDateVN(prevStart)} – ${formatStDateVN(prevEnd)}`,
    };
  }

  if (mode === 'year') {
    const y = params.year;
    const py = y - 1;
    return {
      currentStart: `${y}-01-01`,
      currentEnd: `${y}-12-31`,
      prevStart: `${py}-01-01`,
      prevEnd: `${py}-12-31`,
      currentLabel: `Năm ${y}`,
      prevLabel: `Năm ${py}`,
    };
  }

  const cur = buildMonthRange(params.year, params.month);
  const prevYM = getPreviousYearMonth(params.year, params.month);
  const prev = buildMonthRange(prevYM.year, prevYM.month);
  return {
    currentStart: cur.start,
    currentEnd: cur.end,
    prevStart: prev.start,
    prevEnd: prev.end,
    currentLabel: cur.label,
    prevLabel: prev.label,
  };
}

export function isDateInRange(
  dateInput: string | null | undefined,
  startIso: string,
  endIso: string
): boolean {
  const iso = toIsoDateOnly(dateInput);
  if (!iso) return false;
  return iso >= startIso && iso <= endIso;
}

export function isQuoteCompleted(quote: StCustomerQuote): boolean {
  if (quote.quoted_at && toIsoDateOnly(quote.quoted_at)) return true;
  const st = (quote.status || '').trim().toLowerCase();
  return (
    st === 'đã báo giá' ||
    st === 'da bao gia' ||
    st === 'quoted' ||
    st === 'completed' ||
    st === 'hoàn thành'
  );
}

export function computeStOverviewMetrics(params: {
  productsWithStatus: StProductWithStatus[];
  changeRequests: StChangeRequest[];
  quotes: StCustomerQuote[];
  departments: string[];
  currentStart: string;
  currentEnd: string;
  prevStart: string;
  prevEnd: string;
}): StOverviewMetrics {
  const {
    productsWithStatus,
    changeRequests,
    quotes,
    departments,
    currentStart,
    currentEnd,
    prevStart,
    prevEnd,
  } = params;

  const completedInPeriod = productsWithStatus.filter(
    (item) =>
      item.isCompleted &&
      isDateInRange(item.status?.price_applied_at, currentStart, currentEnd)
  );
  const completedInPrevPeriod = productsWithStatus.filter(
    (item) =>
      item.isCompleted &&
      isDateInRange(item.status?.price_applied_at, prevStart, prevEnd)
  );

  const inProgressItems = productsWithStatus.filter((item) => !item.isCompleted);
  const pendingProcessCount = inProgressItems.filter(
    (item) => item.progressCategory === 'pending_process'
  ).length;
  const pendingPriceCount = inProgressItems.filter(
    (item) => item.progressCategory === 'pending_price'
  ).length;

  const periodDays = completedInPeriod
    .map((item) => item.completionDays)
    .filter((d): d is number => d !== null);
  const avgCompletionDaysInPeriod =
    periodDays.length > 0
      ? Number(
          (
            periodDays.reduce((sum, val) => sum + val, 0) / periodDays.length
          ).toFixed(1)
        )
      : null;

  const allCompletedDays = productsWithStatus
    .filter((item) => item.isCompleted)
    .map((item) => item.completionDays)
    .filter((d): d is number => d !== null);
  const avgCompletionDaysAllCompleted =
    allCompletedDays.length > 0
      ? Number(
          (
            allCompletedDays.reduce((sum, val) => sum + val, 0) /
            allCompletedDays.length
          ).toFixed(1)
        )
      : null;

  const requestsInPeriod = changeRequests.filter((req) =>
    isDateInRange(req.received_at, currentStart, currentEnd)
  );
  const requestsInPrevPeriod = changeRequests.filter((req) =>
    isDateInRange(req.received_at, prevStart, prevEnd)
  );

  const deptCountMap = new Map<string, number>();
  for (const dept of departments) {
    const clean = dept.trim();
    if (clean && !deptCountMap.has(clean)) {
      deptCountMap.set(clean, 0);
    }
  }
  for (const req of requestsInPeriod) {
    const cleanDept = (req.department || 'Khác').trim() || 'Khác';
    deptCountMap.set(cleanDept, (deptCountMap.get(cleanDept) || 0) + 1);
  }
  const requestsByDepartment = Array.from(deptCountMap.entries())
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department));

  const statusCountMap = new Map<StChangeRequestStatus, number>();
  for (const s of ST_CHANGE_REQUEST_STATUSES) {
    statusCountMap.set(s, 0);
  }
  for (const req of requestsInPeriod) {
    const st = ST_CHANGE_REQUEST_STATUSES.includes(req.status)
      ? req.status
      : 'Mới';
    statusCountMap.set(st, (statusCountMap.get(st) || 0) + 1);
  }
  const requestsByStatus = ST_CHANGE_REQUEST_STATUSES.map((status) => ({
    status,
    count: statusCountMap.get(status) || 0,
  }));

  const quotesTotalCount = quotes.length;
  const quotesQuotedCount = quotes.filter(isQuoteCompleted).length;
  const quotesRemainingCount = Math.max(0, quotesTotalCount - quotesQuotedCount);

  return {
    completedInPeriodCount: completedInPeriod.length,
    completedInPrevPeriodCount: completedInPrevPeriod.length,
    completedDelta: completedInPeriod.length - completedInPrevPeriod.length,
    inProgressTotalCount: inProgressItems.length,
    pendingProcessCount,
    pendingPriceCount,
    avgCompletionDaysInPeriod,
    avgCompletionDaysAllCompleted,
    requestsInPeriodCount: requestsInPeriod.length,
    requestsInPrevPeriodCount: requestsInPrevPeriod.length,
    requestsByDepartment,
    requestsByStatus,
    quotesTotalCount,
    quotesQuotedCount,
    quotesRemainingCount,
  };
}

export function computeStReportComparison(params: {
  productsWithStatus: StProductWithStatus[];
  changeRequests: StChangeRequest[];
  quotes: StCustomerQuote[];
  currentStart: string;
  currentEnd: string;
  prevStart: string;
  prevEnd: string;
}): StReportComparisonRow[] {
  const {
    productsWithStatus,
    changeRequests,
    quotes,
    currentStart,
    currentEnd,
    prevStart,
    prevEnd,
  } = params;

  const regCur = productsWithStatus.filter((p) =>
    isDateInRange(p.product.created_at, currentStart, currentEnd)
  ).length;
  const regPrev = productsWithStatus.filter((p) =>
    isDateInRange(p.product.created_at, prevStart, prevEnd)
  ).length;

  const procCur = productsWithStatus.filter(
    (p) =>
      p.status?.has_process &&
      isDateInRange(p.status.process_created_at, currentStart, currentEnd)
  ).length;
  const procPrev = productsWithStatus.filter(
    (p) =>
      p.status?.has_process &&
      isDateInRange(p.status.process_created_at, prevStart, prevEnd)
  ).length;

  const doneCurList = productsWithStatus.filter(
    (p) =>
      p.isCompleted &&
      isDateInRange(p.status?.price_applied_at, currentStart, currentEnd)
  );
  const donePrevList = productsWithStatus.filter(
    (p) =>
      p.isCompleted &&
      isDateInRange(p.status?.price_applied_at, prevStart, prevEnd)
  );

  const avgDaysCur = (() => {
    const days = doneCurList
      .map((i) => i.completionDays)
      .filter((d): d is number => d !== null);
    return days.length > 0
      ? Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1))
      : 0;
  })();
  const avgDaysPrev = (() => {
    const days = donePrevList
      .map((i) => i.completionDays)
      .filter((d): d is number => d !== null);
    return days.length > 0
      ? Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1))
      : 0;
  })();

  const reqRecCur = changeRequests.filter((r) =>
    isDateInRange(r.received_at, currentStart, currentEnd)
  ).length;
  const reqRecPrev = changeRequests.filter((r) =>
    isDateInRange(r.received_at, prevStart, prevEnd)
  ).length;

  const isDoneRequestStatus = (st: StChangeRequestStatus) =>
    st === 'Đã xử lý' || st === 'Đã áp dụng';
  const reqDoneCur = changeRequests.filter(
    (r) =>
      isDoneRequestStatus(r.status) &&
      isDateInRange(r.processed_at, currentStart, currentEnd)
  ).length;
  const reqDonePrev = changeRequests.filter(
    (r) =>
      isDoneRequestStatus(r.status) &&
      isDateInRange(r.processed_at, prevStart, prevEnd)
  ).length;

  const quoteCur = quotes.filter(
    (q) =>
      isQuoteCompleted(q) &&
      isDateInRange(q.quoted_at || q.created_at, currentStart, currentEnd)
  ).length;
  const quotePrev = quotes.filter(
    (q) =>
      isQuoteCompleted(q) &&
      isDateInRange(q.quoted_at || q.created_at, prevStart, prevEnd)
  ).length;

  return [
    {
      key: 'new_products_registered',
      label: 'Mã hàng mới đăng ký',
      currentValue: regCur,
      previousValue: regPrev,
      delta: regCur - regPrev,
      unit: 'mã',
      note: 'Số mã sản phẩm được tạo trong danh mục sản phẩm',
    },
    {
      key: 'process_created',
      label: 'Mã hàng đã tạo quy trình',
      currentValue: procCur,
      previousValue: procPrev,
      delta: procCur - procPrev,
      unit: 'mã',
      note: 'Tính theo ngày tạo quy trình',
    },
    {
      key: 'mass_production_completed',
      label: 'Mã hàng hoàn thành SX đại trà',
      currentValue: doneCurList.length,
      previousValue: donePrevList.length,
      delta: doneCurList.length - donePrevList.length,
      unit: 'mã',
      note: 'Đã tích Có quy trình và có Ngày áp dụng đơn giá',
    },
    {
      key: 'avg_completion_days',
      label: 'Thời gian hoàn thành trung bình',
      currentValue: avgDaysCur,
      previousValue: avgDaysPrev,
      delta: Number((avgDaysCur - avgDaysPrev).toFixed(1)),
      unit: 'ngày',
      note: 'Trung bình từ ngày đăng ký đến ngày áp dụng đơn giá',
    },
    {
      key: 'change_requests_received',
      label: 'Phiếu yêu cầu tiếp nhận',
      currentValue: reqRecCur,
      previousValue: reqRecPrev,
      delta: reqRecCur - reqRecPrev,
      unit: 'phiếu',
      note: 'Tính theo ngày tiếp nhận phiếu yêu cầu',
    },
    {
      key: 'change_requests_processed',
      label: 'Phiếu yêu cầu đã xử lý / áp dụng',
      currentValue: reqDoneCur,
      previousValue: reqDonePrev,
      delta: reqDoneCur - reqDonePrev,
      unit: 'phiếu',
      note: 'Trạng thái Đã xử lý hoặc Đã áp dụng theo ngày xử lý',
    },
    {
      key: 'customer_quotes_done',
      label: 'Báo giá khách hàng hoàn tất',
      currentValue: quoteCur,
      previousValue: quotePrev,
      delta: quoteCur - quotePrev,
      unit: 'báo giá',
      note: 'Đọc từ dữ liệu bảng st_customer_quotes',
    },
  ];
}

// ==========================================
// Row Normalizers & Realtime Pure Reducers
// ==========================================

export function normalizeStLineRow(row: Record<string, unknown>): StLine {
  return {
    id: String(row.id || ''),
    name: typeof row.name === 'string' ? row.name.trim() : '',
    description: typeof row.description === 'string' ? row.description : null,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order || 0),
    created_at:
      typeof row.created_at === 'string' && row.created_at
        ? row.created_at
        : new Date().toISOString(),
  };
}

export function normalizeStCustomerRow(row: Record<string, unknown>): StCustomer {
  return {
    id: String(row.id || ''),
    short_name: typeof row.short_name === 'string' ? row.short_name.trim() : '',
    full_name: typeof row.full_name === 'string' ? row.full_name.trim() : '',
    notes: typeof row.notes === 'string' ? row.notes : null,
    created_at:
      typeof row.created_at === 'string' && row.created_at
        ? row.created_at
        : new Date().toISOString(),
  };
}

export function normalizeStProductRow(row: Record<string, unknown>): StProduct {
  const nowIso = new Date().toISOString();
  return {
    id: String(row.id || ''),
    line_name: typeof row.line_name === 'string' ? row.line_name.trim() : '',
    customer_short_name:
      typeof row.customer_short_name === 'string'
        ? row.customer_short_name.trim()
        : '',
    product_name:
      typeof row.product_name === 'string' ? row.product_name.trim() : '',
    product_code:
      typeof row.product_code === 'string' ? row.product_code.trim() : '',
    specification:
      typeof row.specification === 'string' ? row.specification.trim() : '',
    image_url: typeof row.image_url === 'string' && row.image_url.trim() ? row.image_url.trim() : null,
    created_at:
      typeof row.created_at === 'string' && row.created_at ? row.created_at : nowIso,
    updated_at:
      typeof row.updated_at === 'string' && row.updated_at ? row.updated_at : nowIso,
  };
}

export function normalizeStNewProductStatusRow(
  row: Record<string, unknown>
): StNewProductStatus {
  const rawPrice = row.unit_price;
  const parsedPrice =
    rawPrice === null || rawPrice === undefined || rawPrice === ''
      ? null
      : Number(rawPrice);

  return {
    id: String(row.id || ''),
    product_id: String(row.product_id || ''),
    has_process: Boolean(row.has_process),
    process_created_at: toIsoDateOnly(
      typeof row.process_created_at === 'string' ? row.process_created_at : null
    ) || null,
    has_unit_price: Boolean(row.has_unit_price),
    unit_price: parsedPrice !== null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
    currency:
      typeof row.currency === 'string' && row.currency.trim()
        ? row.currency.trim()
        : 'VND',
    price_created_at: toIsoDateOnly(
      typeof row.price_created_at === 'string' ? row.price_created_at : null
    ) || null,
    price_applied_at: toIsoDateOnly(
      typeof row.price_applied_at === 'string' ? row.price_applied_at : null
    ) || null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    updated_at:
      typeof row.updated_at === 'string' && row.updated_at
        ? row.updated_at
        : new Date().toISOString(),
  };
}

export function normalizeStChangeRequestStatus(
  raw: unknown
): StChangeRequestStatus {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (ST_CHANGE_REQUEST_STATUSES.includes(s as StChangeRequestStatus)) {
    return s as StChangeRequestStatus;
  }
  return 'Mới';
}

export function normalizeStChangeRequestRow(
  row: Record<string, unknown>
): StChangeRequest {
  const nowIso = new Date().toISOString();
  return {
    id: String(row.id || ''),
    department: typeof row.department === 'string' ? row.department.trim() : '',
    content: typeof row.content === 'string' ? row.content.trim() : '',
    received_at:
      toIsoDateOnly(typeof row.received_at === 'string' ? row.received_at : null) ||
      getLocalIsoDateToday(),
    product_code:
      typeof row.product_code === 'string' ? row.product_code.trim() : '',
    specification:
      typeof row.specification === 'string' ? row.specification.trim() : '',
    status: normalizeStChangeRequestStatus(row.status),
    processed_at:
      toIsoDateOnly(typeof row.processed_at === 'string' ? row.processed_at : null) ||
      null,
    applied_version:
      typeof row.applied_version === 'string' && row.applied_version.trim()
        ? row.applied_version.trim()
        : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    created_at:
      typeof row.created_at === 'string' && row.created_at ? row.created_at : nowIso,
    updated_at:
      typeof row.updated_at === 'string' && row.updated_at ? row.updated_at : nowIso,
  };
}

export function normalizeStCustomerQuoteRow(
  row: Record<string, unknown>
): StCustomerQuote {
  const nowIso = new Date().toISOString();
  return {
    id: String(row.id || ''),
    quote_code:
      typeof row.quote_code === 'string' && row.quote_code.trim()
        ? row.quote_code.trim()
        : null,
    customer_short_name:
      typeof row.customer_short_name === 'string' &&
      row.customer_short_name.trim()
        ? row.customer_short_name.trim()
        : null,
    status: typeof row.status === 'string' ? row.status.trim() : 'Chờ báo giá',
    quoted_at:
      toIsoDateOnly(typeof row.quoted_at === 'string' ? row.quoted_at : null) ||
      null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    created_at:
      typeof row.created_at === 'string' && row.created_at ? row.created_at : nowIso,
    updated_at:
      typeof row.updated_at === 'string' && row.updated_at ? row.updated_at : nowIso,
  };
}

export function applyRealtimeStRow<T extends { id: string }>(
  list: T[],
  event: StRealtimeChangeEvent,
  normalizer: (row: Record<string, unknown>) => T,
  sortFn?: (a: T, b: T) => number
): T[] {
  if (event.eventType === 'DELETE') {
    const oldId =
      event.oldRow && typeof event.oldRow.id === 'string' ? event.oldRow.id : '';
    if (!oldId) return list;
    return list.filter((item) => item.id !== oldId);
  }

  if (!event.newRow) return list;
  const normalized = normalizer(event.newRow);
  if (!normalized.id) return list;

  const exists = list.some((item) => item.id === normalized.id);
  const next = exists
    ? list.map((item) => (item.id === normalized.id ? normalized : item))
    : [normalized, ...list];

  return sortFn ? [...next].sort(sortFn) : next;
}
