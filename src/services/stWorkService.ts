import { getOvertimeSupabaseClient, overtimeSupabase } from './supabaseClient';
import {
  encodeStepsIntoNotes,
  isNewProductCompleted,
  normalizeStChangeRequestRow,
  normalizeStCustomerQuoteRow,
  normalizeStCustomerRow,
  normalizeStLineRow,
  normalizeStNewProductStatusRow,
  normalizeStProductRow,
  StChangeRequest,
  StChangeRequestStatus,
  StCustomer,
  StCustomerQuote,
  StLine,
  StNewProductStatus,
  StProduct,
  StRealtimeChangeEvent,
} from '../utils/stWorkLogic';

export {
  getOvertimeSupabaseClient,
  getSupabaseClient,
  HR_IMAGES_BUCKET,
  overtimeSupabase,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from './supabaseClient';

export {
  compressImageClientSide,
  deleteImageFromHrBucket,
  uploadImageToHrBucket,
} from '../utils/supabaseService';

export interface StWorkSnapshot {
  lines: StLine[];
  customers: StCustomer[];
  products: StProduct[];
  newProductStatuses: StNewProductStatus[];
  changeRequests: StChangeRequest[];
  customerQuotes: StCustomerQuote[];
}

export const ST_WORK_TABLES = [
  'st_lines',
  'st_customers',
  'st_products',
  'st_new_product_status',
  'st_change_requests',
  'st_customer_quotes',
] as const;

export type StWorkTableName = (typeof ST_WORK_TABLES)[number];

export async function fetchStLines(): Promise<StLine[]> {
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_lines?select=*&order=sort_order.asc,created_at.asc'
  );
  return Array.isArray(rows) ? rows.map(normalizeStLineRow) : [];
}

export async function fetchStCustomers(): Promise<StCustomer[]> {
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_customers?select=*&order=short_name.asc,created_at.desc'
  );
  return Array.isArray(rows) ? rows.map(normalizeStCustomerRow) : [];
}

export async function fetchStProducts(): Promise<StProduct[]> {
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_products?select=*&order=created_at.desc'
  );
  return Array.isArray(rows) ? rows.map(normalizeStProductRow) : [];
}

export async function fetchStNewProductStatuses(): Promise<StNewProductStatus[]> {
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_new_product_status?select=*&order=updated_at.desc'
  );
  if (Array.isArray(rows) && rows.length > 0) {
    supportsNativeTwoStepColumns =
      'has_process_erp' in rows[0] && 'has_st' in rows[0];
  }
  return Array.isArray(rows)
    ? rows.map(normalizeStNewProductStatusRow)
    : [];
}

export async function fetchStChangeRequests(): Promise<StChangeRequest[]> {
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_change_requests?select=*&order=received_at.desc,created_at.desc'
  );
  return Array.isArray(rows) ? rows.map(normalizeStChangeRequestRow) : [];
}

export async function fetchStCustomerQuotes(): Promise<StCustomerQuote[]> {
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_customer_quotes?select=*&order=created_at.desc'
  );
  return Array.isArray(rows) ? rows.map(normalizeStCustomerQuoteRow) : [];
}

export async function fetchAllStWorkData(): Promise<StWorkSnapshot> {
  const [
    lines,
    customers,
    products,
    newProductStatuses,
    changeRequests,
    customerQuotes,
  ] = await Promise.all([
    fetchStLines(),
    fetchStCustomers(),
    fetchStProducts(),
    fetchStNewProductStatuses(),
    fetchStChangeRequests(),
    fetchStCustomerQuotes(),
  ]);

  return {
    lines,
    customers,
    products,
    newProductStatuses,
    changeRequests,
    customerQuotes,
  };
}

// ==========================================
// 1. ST LINES CRUD (`st_lines`)
// ==========================================

export async function createStLine(input: {
  name: string;
  description?: string | null;
  sort_order?: number;
}): Promise<StLine> {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Vui lòng nhập tên Line.');
  }
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_lines?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        name: cleanName,
        description: input.description?.trim() || null,
        sort_order: typeof input.sort_order === 'number' ? input.sort_order : 0,
      }),
    }
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error('Không thể tạo Line mới trên Supabase.');
  }
  return normalizeStLineRow(rows[0]);
}

export async function updateStLine(
  id: string,
  input: {
    name: string;
    description?: string | null;
    sort_order?: number;
  }
): Promise<StLine> {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Tên Line không được để trống.');
  }
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    `st_lines?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        name: cleanName,
        description: input.description?.trim() || null,
        ...(typeof input.sort_order === 'number'
          ? { sort_order: input.sort_order }
          : {}),
      }),
    }
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error('Không tìm thấy Line cần cập nhật.');
  }
  return normalizeStLineRow(rows[0]);
}

export async function deleteStLine(id: string): Promise<void> {
  await overtimeSupabase.request<void>(
    `st_lines?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
}

// ==========================================
// 2. ST CUSTOMERS CRUD (`st_customers`)
// ==========================================

export async function createStCustomer(input: {
  short_name: string;
  full_name: string;
  notes?: string | null;
}): Promise<StCustomer> {
  const cleanShort = input.short_name.trim();
  const cleanFull = input.full_name.trim();
  if (!cleanShort) {
    throw new Error('Vui lòng nhập Tên viết tắt của khách hàng.');
  }
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_customers?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        short_name: cleanShort,
        full_name: cleanFull || cleanShort,
        notes: input.notes?.trim() || null,
      }),
    }
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error('Không thể tạo Khách hàng mới trên Supabase.');
  }
  return normalizeStCustomerRow(rows[0]);
}

export async function updateStCustomer(
  id: string,
  input: {
    short_name: string;
    full_name: string;
    notes?: string | null;
  }
): Promise<StCustomer> {
  const cleanShort = input.short_name.trim();
  const cleanFull = input.full_name.trim();
  if (!cleanShort) {
    throw new Error('Tên viết tắt khách hàng không được để trống.');
  }
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    `st_customers?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        short_name: cleanShort,
        full_name: cleanFull || cleanShort,
        notes: input.notes?.trim() || null,
      }),
    }
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error('Không tìm thấy Khách hàng cần cập nhật.');
  }
  return normalizeStCustomerRow(rows[0]);
}

export async function deleteStCustomer(id: string): Promise<void> {
  await overtimeSupabase.request<void>(
    `st_customers?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
}

// ==========================================
// 3. ST PRODUCTS CRUD (`st_products`) + AUTO INIT `st_new_product_status`
// ==========================================

export async function createStProduct(input: {
  line_name: string;
  customer_short_name: string;
  product_name: string;
  product_code: string;
  specification?: string;
  image_url?: string | null;
}): Promise<{ product: StProduct; status: StNewProductStatus }> {
  const cleanLine = input.line_name.trim();
  const cleanCustomer = input.customer_short_name.trim();
  const cleanName = input.product_name.trim();
  const cleanCode = input.product_code.trim();
  const cleanSpec = (input.specification || '').trim();

  if (!cleanLine || !cleanCustomer || !cleanName || !cleanCode) {
    throw new Error(
      'Vui lòng nhập đầy đủ Line, Khách hàng, Tên hàng và Mã hàng.'
    );
  }

  const nowIso = new Date().toISOString();
  const productRows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_products?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        line_name: cleanLine,
        customer_short_name: cleanCustomer,
        product_name: cleanName,
        product_code: cleanCode,
        specification: cleanSpec,
        image_url: input.image_url?.trim() || null,
        updated_at: nowIso,
      }),
    }
  );

  if (!Array.isArray(productRows) || !productRows[0]) {
    throw new Error('Không thể tạo sản phẩm mới trên Supabase.');
  }

  const createdProduct = normalizeStProductRow(productRows[0]);

  // Tự động khởi tạo bản ghi tương ứng bên bảng st_new_product_status
  let createdStatus: StNewProductStatus | null = null;
  const existingStatusRows = await overtimeSupabase.request<
    Record<string, unknown>[]
  >(
    `st_new_product_status?product_id=eq.${encodeURIComponent(
      createdProduct.id
    )}&select=*&limit=1`
  );

  if (Array.isArray(existingStatusRows) && existingStatusRows[0]) {
    supportsNativeTwoStepColumns =
      'has_process_erp' in existingStatusRows[0] &&
      'has_st' in existingStatusRows[0];
    createdStatus = normalizeStNewProductStatusRow(existingStatusRows[0]);
  } else {
    const baseLegacyPayload = {
      product_id: createdProduct.id,
      has_process: false,
      process_created_at: null,
      has_unit_price: false,
      unit_price: null,
      currency: 'VND',
      price_created_at: null,
      price_applied_at: null,
      notes: null,
      updated_at: nowIso,
    };

    let statusRows: Record<string, unknown>[] = [];
    if (supportsNativeTwoStepColumns !== false) {
      try {
        statusRows = await overtimeSupabase.request<Record<string, unknown>[]>(
          'st_new_product_status?select=*',
          {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({
              ...baseLegacyPayload,
              has_process_erp: false,
              process_erp_date: null,
              has_st: false,
              st_date: null,
            }),
          }
        );
        supportsNativeTwoStepColumns = true;
      } catch (err) {
        if (isMissingWorkflowColumnError(err)) {
          supportsNativeTwoStepColumns = false;
        } else {
          throw err;
        }
      }
    }

    if (supportsNativeTwoStepColumns === false) {
      statusRows = await overtimeSupabase.request<Record<string, unknown>[]>(
        'st_new_product_status?select=*',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(baseLegacyPayload),
        }
      );
    }

    if (Array.isArray(statusRows) && statusRows[0]) {
      createdStatus = normalizeStNewProductStatusRow(statusRows[0]);
    }
  }

  return {
    product: createdProduct,
    status:
      createdStatus || {
        id: '',
        product_id: createdProduct.id,
        has_process_erp: false,
        process_erp_date: null,
        has_st: false,
        st_date: null,
        has_process: false,
        process_created_at: null,
        has_unit_price: false,
        unit_price: null,
        currency: 'VND',
        price_created_at: null,
        price_applied_at: null,
        notes: null,
        updated_at: nowIso,
      },
  };
}

export async function updateStProduct(
  id: string,
  input: {
    line_name: string;
    customer_short_name: string;
    product_name: string;
    product_code: string;
    specification?: string;
    image_url?: string | null;
  }
): Promise<StProduct> {
  const cleanLine = input.line_name.trim();
  const cleanCustomer = input.customer_short_name.trim();
  const cleanName = input.product_name.trim();
  const cleanCode = input.product_code.trim();
  const cleanSpec = (input.specification || '').trim();

  if (!cleanLine || !cleanCustomer || !cleanName || !cleanCode) {
    throw new Error(
      'Line, Khách hàng, Tên hàng và Mã hàng không được để trống.'
    );
  }

  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    `st_products?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        line_name: cleanLine,
        customer_short_name: cleanCustomer,
        product_name: cleanName,
        product_code: cleanCode,
        specification: cleanSpec,
        image_url: input.image_url?.trim() || null,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error('Không tìm thấy sản phẩm cần cập nhật.');
  }
  return normalizeStProductRow(rows[0]);
}

export async function deleteStProduct(id: string): Promise<void> {
  await overtimeSupabase.request<void>(
    `st_new_product_status?product_id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  ).catch(() => undefined);

  await overtimeSupabase.request<void>(
    `st_products?id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}

// ==========================================
// 4. ST NEW PRODUCT STATUS (`st_new_product_status`)
// ==========================================

let supportsNativeTwoStepColumns: boolean | null = null;

function isMissingWorkflowColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('42703') ||
    msg.includes('PGRST204') ||
    msg.includes('does not exist') ||
    msg.includes('Could not find the')
  );
}

export interface UpsertStNewProductStatusInput {
  id?: string | null;
  product_id: string;
  has_process_erp: boolean;
  process_erp_date: string | null;
  has_st: boolean;
  st_date: string | null;
  has_bom_erp?: boolean;
  bom_erp_date?: string | null;
  has_spec_erp?: boolean;
  spec_erp_date?: string | null;
  has_khsx?: boolean;
  khsx_date?: string | null;
  has_quote?: boolean;
  quote_date?: string | null;
  unit_price?: number | null;
  currency?: string;
  notes: string | null;
}

export async function upsertStNewProductStatus(
  input: UpsertStNewProductStatusInput
): Promise<StNewProductStatus> {
  const nowIso = new Date().toISOString();
  const twoStepValues = {
    has_process_erp: Boolean(input.has_process_erp),
    process_erp_date: input.process_erp_date || null,
    has_st: Boolean(input.has_st),
    st_date: input.st_date || null,
  };
  const completed = isNewProductCompleted(twoStepValues);
  const cleanUserNotes = input.notes?.trim() || null;

  const legacyBasePayload = {
    product_id: input.product_id,
    has_process: Boolean(twoStepValues.has_process_erp),
    process_created_at: twoStepValues.process_erp_date || null,
    has_unit_price: Boolean(input.has_quote),
    unit_price:
      input.unit_price !== null &&
      input.unit_price !== undefined &&
      !Number.isNaN(Number(input.unit_price))
        ? Number(input.unit_price)
        : null,
    currency: (input.currency || 'VND').trim() || 'VND',
    price_created_at: input.quote_date || null,
    price_applied_at: completed ? twoStepValues.st_date || null : null,
    updated_at: nowIso,
  };

  const nativePayload = {
    ...legacyBasePayload,
    ...twoStepValues,
    notes: cleanUserNotes,
  };

  const fallbackPayload = {
    ...legacyBasePayload,
    notes: encodeStepsIntoNotes(cleanUserNotes, {
      ...twoStepValues,
      ...(typeof input.has_bom_erp === 'boolean'
        ? { has_bom_erp: input.has_bom_erp, bom_erp_date: input.bom_erp_date || null }
        : {}),
      ...(typeof input.has_spec_erp === 'boolean'
        ? { has_spec_erp: input.has_spec_erp, spec_erp_date: input.spec_erp_date || null }
        : {}),
      ...(typeof input.has_khsx === 'boolean'
        ? { has_khsx: input.has_khsx, khsx_date: input.khsx_date || null }
        : {}),
      ...(typeof input.has_quote === 'boolean'
        ? { has_quote: input.has_quote, quote_date: input.quote_date || null }
        : {}),
    }),
  };

  let targetId = input.id || '';
  if (!targetId) {
    const existing = await overtimeSupabase.request<Record<string, unknown>[]>(
      `st_new_product_status?product_id=eq.${encodeURIComponent(
        input.product_id
      )}&select=id&limit=1`
    );
    if (Array.isArray(existing) && existing[0]?.id) {
      targetId = String(existing[0].id);
    }
  }

  const sendSave = async (bodyPayload: Record<string, unknown>) => {
    if (targetId) {
      const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
        `st_new_product_status?id=eq.${encodeURIComponent(targetId)}&select=*`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(bodyPayload),
        }
      );
      if (Array.isArray(rows) && rows[0]) {
        return normalizeStNewProductStatusRow(rows[0]);
      }
    }

    const inserted = await overtimeSupabase.request<Record<string, unknown>[]>(
      'st_new_product_status?select=*',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(bodyPayload),
      }
    );
    if (!Array.isArray(inserted) || !inserted[0]) {
      throw new Error('Không thể lưu trạng thái Mã hàng mới.');
    }
    return normalizeStNewProductStatusRow(inserted[0]);
  };

  if (supportsNativeTwoStepColumns !== false) {
    try {
      const saved = await sendSave(nativePayload);
      supportsNativeTwoStepColumns = true;
      return saved;
    } catch (err) {
      if (isMissingWorkflowColumnError(err)) {
        supportsNativeTwoStepColumns = false;
      } else {
        throw err;
      }
    }
  }

  return sendSave(fallbackPayload);
}

// ==========================================
// 5. ST CHANGE REQUESTS (`st_change_requests`)
// ==========================================

export async function createStChangeRequest(input: {
  department: string;
  content: string;
  received_at: string;
  product_code: string;
  specification: string;
  status: StChangeRequestStatus;
  processed_at?: string | null;
  applied_version?: string | null;
  notes?: string | null;
}): Promise<StChangeRequest> {
  const cleanDept = input.department.trim();
  const cleanContent = input.content.trim();
  if (!cleanDept || !cleanContent) {
    throw new Error('Vui lòng chọn Bộ phận YC và nhập Nội dung yêu cầu.');
  }
  const nowIso = new Date().toISOString();
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    'st_change_requests?select=*',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        department: cleanDept,
        content: cleanContent,
        received_at: input.received_at,
        product_code: input.product_code.trim(),
        specification: input.specification.trim(),
        status: input.status,
        processed_at: input.processed_at || null,
        applied_version: input.applied_version?.trim() || null,
        notes: input.notes?.trim() || null,
        updated_at: nowIso,
      }),
    }
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error('Không thể tạo Phiếu yêu cầu trên Supabase.');
  }
  return normalizeStChangeRequestRow(rows[0]);
}

export async function updateStChangeRequest(
  id: string,
  input: {
    department: string;
    content: string;
    received_at: string;
    product_code: string;
    specification: string;
    status: StChangeRequestStatus;
    processed_at?: string | null;
    applied_version?: string | null;
    notes?: string | null;
  }
): Promise<StChangeRequest> {
  const cleanDept = input.department.trim();
  const cleanContent = input.content.trim();
  if (!cleanDept || !cleanContent) {
    throw new Error('Bộ phận YC và Nội dung yêu cầu không được để trống.');
  }
  const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
    `st_change_requests?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        department: cleanDept,
        content: cleanContent,
        received_at: input.received_at,
        product_code: input.product_code.trim(),
        specification: input.specification.trim(),
        status: input.status,
        processed_at: input.processed_at || null,
        applied_version: input.applied_version?.trim() || null,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error('Không tìm thấy Phiếu yêu cầu cần cập nhật.');
  }
  return normalizeStChangeRequestRow(rows[0]);
}

export async function deleteStChangeRequest(id: string): Promise<void> {
  await overtimeSupabase.request<void>(
    `st_change_requests?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
}

// ==========================================
// 6. REALTIME SUBSCRIPTION ACROSS ALL 6 TABLES
// ==========================================

export function subscribeToStWorkRealtime(
  onTableEvent: (table: StWorkTableName, event: StRealtimeChangeEvent) => void,
  onStatusChange?: (status: string) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const client = getOvertimeSupabaseClient();
  const channelName = `st-work-realtime-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  let channel = client.channel(channelName);
  for (const table of ST_WORK_TABLES) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
        onTableEvent(table, {
          eventType,
          newRow: (payload.new as Record<string, unknown>) || null,
          oldRow: (payload.old as Record<string, unknown>) || null,
        });
      }
    );
  }

  channel.subscribe((status) => {
    onStatusChange?.(status);
  });

  return () => {
    void client.removeChannel(channel);
  };
}
