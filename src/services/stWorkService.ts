import { getOvertimeSupabaseClient, overtimeSupabase } from './supabaseClient';
import {
  encodeStepsIntoNotes,
  extractEncodedStepsFromNotes,
  getLocalIsoDateToday,
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

async function fetchAllPaginatedRows(
  tableQueryWithoutRange: string,
  pageSize: number = 1000
): Promise<Record<string, unknown>[]> {
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const sep = tableQueryWithoutRange.includes('?') ? '&' : '?';
    const batch = await overtimeSupabase.request<Record<string, unknown>[]>(
      `${tableQueryWithoutRange}${sep}limit=${pageSize}&offset=${offset}`
    );
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }
    allRows.push(...batch);
    if (batch.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return allRows;
}

export async function fetchStProducts(): Promise<StProduct[]> {
  const rows = await fetchAllPaginatedRows(
    'st_products?select=*&order=created_at.desc,product_code.asc'
  );
  return rows.map(normalizeStProductRow);
}

export async function fetchStNewProductStatuses(): Promise<StNewProductStatus[]> {
  const rows = await fetchAllPaginatedRows(
    'st_new_product_status?select=*&order=updated_at.desc'
  );
  if (rows.length > 0) {
    supportsNativeTwoStepColumns =
      'has_process_erp' in rows[0] && 'has_st' in rows[0];
    supportsNativeStageColumns =
      'has_stage_win' in rows[0] && 'has_stage_fin' in rows[0];
  }
  return rows.map(normalizeStNewProductStatusRow);
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

  let syncedStatuses = newProductStatuses;
  try {
    const missingCreated = await ensureMissingStNewProductStatuses(
      products,
      newProductStatuses
    );
    if (missingCreated.length > 0) {
      syncedStatuses = [...missingCreated, ...newProductStatuses];
    }
  } catch {
    // Non-fatal: UI still renders every st_products row via mergeProductsWithStatus
  }

  return {
    lines,
    customers,
    products,
    newProductStatuses: syncedStatuses,
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
    supportsNativeStageColumns =
      'has_stage_win' in existingStatusRows[0] &&
      'has_stage_fin' in existingStatusRows[0];
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
        has_stage_win: false,
        stage_win_date: null,
        has_stage_cut: false,
        stage_cut_date: null,
        has_stage_sol: false,
        stage_sol_date: null,
        has_stage_ass: false,
        stage_ass_date: null,
        has_stage_imp: false,
        stage_imp_date: null,
        has_stage_sol2: false,
        stage_sol2_date: null,
        has_stage_fin: false,
        stage_fin_date: null,
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

export async function createStProductWithInitialStatus(input: {
  line_name: string;
  customer_short_name: string;
  product_name: string;
  product_code: string;
  specification?: string;
  image_url?: string | null;
  has_process_erp: boolean;
  process_erp_date?: string | null;
  notes?: string | null;
}): Promise<{ product: StProduct; status: StNewProductStatus }> {
  const { product, status: initialStatus } = await createStProduct({
    line_name: input.line_name,
    customer_short_name: input.customer_short_name,
    product_name: input.product_name,
    product_code: input.product_code,
    specification: input.specification,
    image_url: input.image_url,
  });

  const cleanDate = input.has_process_erp
    ? input.process_erp_date?.trim() || getLocalIsoDateToday()
    : input.process_erp_date?.trim() || null;
  const cleanNotes = input.notes?.trim() || null;

  if (!input.has_process_erp && !cleanDate && !cleanNotes) {
    return { product, status: initialStatus };
  }

  const updatedStatus = await upsertStNewProductStatus({
    id: initialStatus.id || null,
    product_id: product.id,
    has_process_erp: Boolean(input.has_process_erp),
    process_erp_date: cleanDate,
    has_st: false,
    st_date: null,
    notes: cleanNotes,
  });

  return { product, status: updatedStatus };
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

export interface StProductBatchImportItem {
  line_name: string;
  customer_short_name: string;
  product_code: string;
  product_name: string;
  specification: string;
  notes: string;
}

export interface StProductBatchUpdateItem extends StProductBatchImportItem {
  existing_id: string;
  existing_image_url: string | null;
  existing_created_at: string;
}

export interface BatchImportStProductsResult {
  insertedCount: number;
  updatedCount: number;
  insertedProducts: StProduct[];
  updatedProducts: StProduct[];
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function batchImportStProducts(input: {
  rowsToInsert: StProductBatchImportItem[];
  rowsToUpdate: StProductBatchUpdateItem[];
}): Promise<BatchImportStProductsResult> {
  const nowIso = new Date().toISOString();
  const insertedProducts: StProduct[] = [];
  const updatedProducts: StProduct[] = [];

  // 1. Batch insert new products
  for (const chunk of chunkArray(input.rowsToInsert, 50)) {
    if (chunk.length === 0) continue;
    const payload = chunk.map((item) => ({
      line_name: item.line_name.trim(),
      customer_short_name: item.customer_short_name.trim(),
      product_name: item.product_name.trim(),
      product_code: item.product_code.trim(),
      specification: item.specification.trim(),
      image_url: null,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
      'st_products?select=*',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      }
    );

    const createdChunk = Array.isArray(rows)
      ? rows.map(normalizeStProductRow)
      : [];
    insertedProducts.push(...createdChunk);

    // Initialize linked st_new_product_status rows for newly inserted products
    if (createdChunk.length > 0) {
      const notesByCode = new Map<string, string>();
      chunk.forEach((item) => {
        const cleanNote = item.notes.trim();
        if (cleanNote) {
          notesByCode.set(item.product_code.trim().toLowerCase(), cleanNote);
        }
      });

      const createdIds = createdChunk.map((p) => p.id).filter(Boolean);
      const existingStatusByProductId = new Map<string, Record<string, unknown>>();
      if (createdIds.length > 0) {
        const inFilter = createdIds.map((id) => encodeURIComponent(id)).join(',');
        const existingRows = await overtimeSupabase
          .request<Record<string, unknown>[]>(
            `st_new_product_status?product_id=in.(${inFilter})&select=*`
          )
          .catch(() => []);
        if (Array.isArray(existingRows)) {
          existingRows.forEach((r) => {
            if (r.product_id) {
              existingStatusByProductId.set(String(r.product_id), r);
            }
          });
        }
      }

      const missingStatusPayloads: Record<string, unknown>[] = [];
      for (const prod of createdChunk) {
        const noteText = notesByCode.get(prod.product_code.trim().toLowerCase()) || null;
        const existingRow = existingStatusByProductId.get(prod.id);
        if (!existingRow) {
          missingStatusPayloads.push({
            product_id: prod.id,
            has_process: false,
            process_created_at: null,
            has_unit_price: false,
            unit_price: null,
            currency: 'VND',
            price_created_at: null,
            price_applied_at: null,
            notes: noteText,
            updated_at: nowIso,
            ...(supportsNativeTwoStepColumns !== false
              ? {
                  has_process_erp: false,
                  process_erp_date: null,
                  has_st: false,
                  st_date: null,
                }
              : {}),
          });
        } else if (noteText) {
          const parsedExisting = normalizeStNewProductStatusRow(existingRow);
          const { steps } = extractEncodedStepsFromNotes(
            typeof existingRow.notes === 'string' ? existingRow.notes : null
          );
          const finalNotes =
            supportsNativeStageColumns === false || steps
              ? encodeStepsIntoNotes(noteText, parsedExisting)
              : noteText;
          await overtimeSupabase.request<void>(
            `st_new_product_status?id=eq.${encodeURIComponent(parsedExisting.id)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ notes: finalNotes, updated_at: nowIso }),
            }
          );
        }
      }

      if (missingStatusPayloads.length > 0) {
        try {
          await overtimeSupabase.request<Record<string, unknown>[]>(
            'st_new_product_status',
            {
              method: 'POST',
              body: JSON.stringify(missingStatusPayloads),
            }
          );
          if (supportsNativeTwoStepColumns !== false) {
            supportsNativeTwoStepColumns = true;
          }
        } catch (err) {
          if (isMissingWorkflowColumnError(err)) {
            supportsNativeTwoStepColumns = false;
            const legacyPayloads = missingStatusPayloads.map((p) => ({
              product_id: p.product_id,
              has_process: false,
              process_created_at: null,
              has_unit_price: false,
              unit_price: null,
              currency: 'VND',
              price_created_at: null,
              price_applied_at: null,
              notes: p.notes ?? null,
              updated_at: nowIso,
            }));
            await overtimeSupabase.request<Record<string, unknown>[]>(
              'st_new_product_status',
              {
                method: 'POST',
                body: JSON.stringify(legacyPayloads),
              }
            );
          } else {
            throw err;
          }
        }
      }
    }
  }

  // 2. Batch upsert overwritten products on PK id
  for (const chunk of chunkArray(input.rowsToUpdate, 50)) {
    if (chunk.length === 0) continue;
    const payload = chunk.map((item) => ({
      id: item.existing_id,
      line_name: item.line_name.trim(),
      customer_short_name: item.customer_short_name.trim(),
      product_name: item.product_name.trim(),
      product_code: item.product_code.trim(),
      specification: item.specification.trim(),
      image_url: item.existing_image_url,
      created_at: item.existing_created_at,
      updated_at: nowIso,
    }));

    const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
      'st_products?on_conflict=id&select=*',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(payload),
      }
    );

    const updatedChunk = Array.isArray(rows)
      ? rows.map(normalizeStProductRow)
      : [];
    updatedProducts.push(...updatedChunk);

    // Sync non-empty notes onto linked st_new_product_status if provided
    const notesTargets = chunk.filter((item) => item.notes.trim());
    if (notesTargets.length > 0) {
      const targetIds = notesTargets
        .map((item) => encodeURIComponent(item.existing_id))
        .join(',');
      const statusRows = await overtimeSupabase
        .request<Record<string, unknown>[]>(
          `st_new_product_status?product_id=in.(${targetIds})&select=*`
        )
        .catch(() => []);
      const statusMap = new Map<string, Record<string, unknown>>();
      if (Array.isArray(statusRows)) {
        statusRows.forEach((r) => {
          if (r.product_id) statusMap.set(String(r.product_id), r);
        });
      }

      for (const item of notesTargets) {
        const cleanNote = item.notes.trim();
        const existingStatus = statusMap.get(item.existing_id);
        if (existingStatus) {
          const parsedStatus = normalizeStNewProductStatusRow(existingStatus);
          const { steps } = extractEncodedStepsFromNotes(
            typeof existingStatus.notes === 'string' ? existingStatus.notes : null
          );
          const finalNotes =
            supportsNativeStageColumns === false || steps
              ? encodeStepsIntoNotes(cleanNote, parsedStatus)
              : cleanNote;
          await overtimeSupabase.request<void>(
            `st_new_product_status?id=eq.${encodeURIComponent(parsedStatus.id)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ notes: finalNotes, updated_at: nowIso }),
            }
          );
        } else {
          await overtimeSupabase.request<void>('st_new_product_status', {
            method: 'POST',
            body: JSON.stringify({
              product_id: item.existing_id,
              has_process: false,
              process_created_at: null,
              has_unit_price: false,
              unit_price: null,
              currency: 'VND',
              price_created_at: null,
              price_applied_at: null,
              notes: cleanNote,
              updated_at: nowIso,
            }),
          });
        }
      }
    }
  }

  return {
    insertedCount: insertedProducts.length,
    updatedCount: updatedProducts.length,
    insertedProducts,
    updatedProducts,
  };
}

// ==========================================
// 4. ST NEW PRODUCT STATUS (`st_new_product_status`)
// ==========================================

let supportsNativeTwoStepColumns: boolean | null = null;
let supportsNativeStageColumns: boolean | null = null;

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
  has_stage_win?: boolean;
  stage_win_date?: string | null;
  has_stage_cut?: boolean;
  stage_cut_date?: string | null;
  has_stage_sol?: boolean;
  stage_sol_date?: string | null;
  has_stage_ass?: boolean;
  stage_ass_date?: string | null;
  has_stage_imp?: boolean;
  stage_imp_date?: string | null;
  has_stage_sol2?: boolean;
  stage_sol2_date?: string | null;
  has_stage_fin?: boolean;
  stage_fin_date?: string | null;
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
  const stageFields = {
    has_stage_win: Boolean(input.has_stage_win),
    stage_win_date: input.stage_win_date || null,
    has_stage_cut: Boolean(input.has_stage_cut),
    stage_cut_date: input.stage_cut_date || null,
    has_stage_sol: Boolean(input.has_stage_sol),
    stage_sol_date: input.stage_sol_date || null,
    has_stage_ass: Boolean(input.has_stage_ass),
    stage_ass_date: input.stage_ass_date || null,
    has_stage_imp: Boolean(input.has_stage_imp),
    stage_imp_date: input.stage_imp_date || null,
    has_stage_sol2: Boolean(input.has_stage_sol2),
    stage_sol2_date: input.stage_sol2_date || null,
    has_stage_fin: Boolean(input.has_stage_fin),
    stage_fin_date: input.stage_fin_date || null,
  };
  const twoStepValues = {
    has_process_erp: Boolean(input.has_process_erp),
    process_erp_date: input.process_erp_date || null,
    has_st: Boolean(input.has_st),
    st_date: input.st_date || null,
  };
  const completed = isNewProductCompleted({
    ...twoStepValues,
    ...stageFields,
  });
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
    ...stageFields,
    notes: cleanUserNotes,
  };

  const fallbackPayload = {
    ...legacyBasePayload,
    notes: encodeStepsIntoNotes(cleanUserNotes, {
      ...twoStepValues,
      ...stageFields,
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
      throw new Error('Không thể lưu trạng thái Đơn giá mới.');
    }
    return normalizeStNewProductStatusRow(inserted[0]);
  };

  if (
    supportsNativeTwoStepColumns !== false &&
    supportsNativeStageColumns !== false
  ) {
    try {
      const saved = await sendSave(nativePayload);
      supportsNativeTwoStepColumns = true;
      supportsNativeStageColumns = true;
      return saved;
    } catch (err) {
      if (isMissingWorkflowColumnError(err)) {
        supportsNativeStageColumns = false;
      } else {
        throw err;
      }
    }
  }

  return sendSave(fallbackPayload);
}

function buildStatusPayloads(
  input: UpsertStNewProductStatusInput,
  nowIso: string
): {
  nativePayload: Record<string, unknown>;
  fallbackPayload: Record<string, unknown>;
} {
  const stageFields = {
    has_stage_win: Boolean(input.has_stage_win),
    stage_win_date: input.stage_win_date || null,
    has_stage_cut: Boolean(input.has_stage_cut),
    stage_cut_date: input.stage_cut_date || null,
    has_stage_sol: Boolean(input.has_stage_sol),
    stage_sol_date: input.stage_sol_date || null,
    has_stage_ass: Boolean(input.has_stage_ass),
    stage_ass_date: input.stage_ass_date || null,
    has_stage_imp: Boolean(input.has_stage_imp),
    stage_imp_date: input.stage_imp_date || null,
    has_stage_sol2: Boolean(input.has_stage_sol2),
    stage_sol2_date: input.stage_sol2_date || null,
    has_stage_fin: Boolean(input.has_stage_fin),
    stage_fin_date: input.stage_fin_date || null,
  };
  const twoStepValues = {
    has_process_erp: Boolean(input.has_process_erp),
    process_erp_date: input.process_erp_date || null,
    has_st: Boolean(input.has_st),
    st_date: input.st_date || null,
  };
  const completed = isNewProductCompleted({
    ...twoStepValues,
    ...stageFields,
  });
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
    ...stageFields,
    notes: cleanUserNotes,
  };

  const fallbackPayload = {
    ...legacyBasePayload,
    notes: encodeStepsIntoNotes(cleanUserNotes, {
      ...twoStepValues,
      ...stageFields,
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

  return { nativePayload, fallbackPayload };
}

export async function ensureMissingStNewProductStatuses(
  products: StProduct[],
  statuses: StNewProductStatus[]
): Promise<StNewProductStatus[]> {
  if (products.length === 0) return [];
  const existingProductIds = new Set(
    statuses.map((s) => s.product_id).filter(Boolean)
  );
  const missingProducts = products.filter(
    (p) => p.id && !existingProductIds.has(p.id)
  );
  if (missingProducts.length === 0) return [];

  const nowIso = new Date().toISOString();
  const created: StNewProductStatus[] = [];

  for (const chunk of chunkArray(missingProducts, 50)) {
    const legacyPayloads = chunk.map((p) => ({
      product_id: p.id,
      has_process: false,
      process_created_at: null,
      has_unit_price: false,
      unit_price: null,
      currency: 'VND',
      price_created_at: null,
      price_applied_at: null,
      notes: null,
      updated_at: nowIso,
    }));

    const tryPost = async (withTwoStep: boolean) => {
      const body = withTwoStep
        ? legacyPayloads.map((p) => ({
            ...p,
            has_process_erp: false,
            process_erp_date: null,
            has_st: false,
            st_date: null,
          }))
        : legacyPayloads;
      const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
        'st_new_product_status?select=*',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(body),
        }
      );
      return Array.isArray(rows) ? rows.map(normalizeStNewProductStatusRow) : [];
    };

    if (supportsNativeTwoStepColumns !== false) {
      try {
        const res = await tryPost(true);
        supportsNativeTwoStepColumns = true;
        created.push(...res);
        continue;
      } catch (err) {
        if (isMissingWorkflowColumnError(err)) {
          supportsNativeTwoStepColumns = false;
        } else {
          throw err;
        }
      }
    }

    const res = await tryPost(false);
    created.push(...res);
  }

  return created;
}

export async function batchUpsertStNewProductStatuses(
  inputs: UpsertStNewProductStatusInput[]
): Promise<StNewProductStatus[]> {
  if (inputs.length === 0) return [];
  const nowIso = new Date().toISOString();

  // Resolve existing st_new_product_status ids for any items missing input.id
  const idByProductId = new Map<string, string>();
  const unresolvedProductIds: string[] = [];
  for (const item of inputs) {
    if (item.id) {
      idByProductId.set(item.product_id, item.id);
    } else if (item.product_id) {
      unresolvedProductIds.push(item.product_id);
    }
  }

  for (const idChunk of chunkArray(unresolvedProductIds, 50)) {
    const inFilter = idChunk.map((pid) => encodeURIComponent(pid)).join(',');
    const existingRows = await overtimeSupabase
      .request<Record<string, unknown>[]>(
        `st_new_product_status?product_id=in.(${inFilter})&select=id,product_id`
      )
      .catch(() => []);
    if (Array.isArray(existingRows)) {
      existingRows.forEach((r) => {
        if (r.product_id && r.id) {
          idByProductId.set(String(r.product_id), String(r.id));
        }
      });
    }
  }

  const toUpdate: UpsertStNewProductStatusInput[] = [];
  const toInsert: UpsertStNewProductStatusInput[] = [];

  for (const item of inputs) {
    const resolvedId = item.id || idByProductId.get(item.product_id) || '';
    if (resolvedId) {
      toUpdate.push({ ...item, id: resolvedId });
    } else {
      toInsert.push(item);
    }
  }

  const savedAll: StNewProductStatus[] = [];

  const sendBatchUpdate = async (
    chunk: UpsertStNewProductStatusInput[],
    useNative: boolean
  ): Promise<StNewProductStatus[]> => {
    const payload = chunk.map((item) => {
      const { nativePayload, fallbackPayload } = buildStatusPayloads(
        item,
        nowIso
      );
      return {
        id: item.id,
        ...(useNative ? nativePayload : fallbackPayload),
      };
    });
    const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
      'st_new_product_status?on_conflict=id&select=*',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(payload),
      }
    );
    return Array.isArray(rows) ? rows.map(normalizeStNewProductStatusRow) : [];
  };

  const sendBatchInsert = async (
    chunk: UpsertStNewProductStatusInput[],
    useNative: boolean
  ): Promise<StNewProductStatus[]> => {
    const payload = chunk.map((item) => {
      const { nativePayload, fallbackPayload } = buildStatusPayloads(
        item,
        nowIso
      );
      return useNative ? nativePayload : fallbackPayload;
    });
    const rows = await overtimeSupabase.request<Record<string, unknown>[]>(
      'st_new_product_status?select=*',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      }
    );
    return Array.isArray(rows) ? rows.map(normalizeStNewProductStatusRow) : [];
  };

  for (const chunk of chunkArray(toUpdate, 50)) {
    if (
      supportsNativeTwoStepColumns !== false &&
      supportsNativeStageColumns !== false
    ) {
      try {
        const res = await sendBatchUpdate(chunk, true);
        supportsNativeTwoStepColumns = true;
        supportsNativeStageColumns = true;
        savedAll.push(...res);
        continue;
      } catch (err) {
        if (isMissingWorkflowColumnError(err)) {
          supportsNativeStageColumns = false;
        } else {
          throw err;
        }
      }
    }
    const res = await sendBatchUpdate(chunk, false);
    savedAll.push(...res);
  }

  for (const chunk of chunkArray(toInsert, 50)) {
    if (
      supportsNativeTwoStepColumns !== false &&
      supportsNativeStageColumns !== false
    ) {
      try {
        const res = await sendBatchInsert(chunk, true);
        supportsNativeTwoStepColumns = true;
        supportsNativeStageColumns = true;
        savedAll.push(...res);
        continue;
      } catch (err) {
        if (isMissingWorkflowColumnError(err)) {
          supportsNativeStageColumns = false;
        } else {
          throw err;
        }
      }
    }
    const res = await sendBatchInsert(chunk, false);
    savedAll.push(...res);
  }

  return savedAll;
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

export {
  DEFAULT_COMPANY_DEPARTMENTS,
  fetchCompanyDepartments,
  mergeCompanyDepartmentOptions,
  readLocalCompanyDepartments,
  subscribeToCompanyDepartmentsRealtime,
} from '../utils/companyDepartmentsService';

