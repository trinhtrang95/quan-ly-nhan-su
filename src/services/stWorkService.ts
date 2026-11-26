export {
  getOvertimeSupabaseClient,
  getSupabaseClient,
  HR_IMAGES_BUCKET,
  overtimeSupabase,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from './supabaseClient';

// ==========================================
// QUẢN LÝ CÔNG VIỆC ST (LINES, CUSTOMERS, PRODUCTS, STATUS, REQUESTS, QUOTES)
// ==========================================
export {
  createStChangeRequest,
  createStCustomer,
  createStLine,
  createStProduct,
  deleteStChangeRequest,
  deleteStCustomer,
  deleteStLine,
  deleteStProduct,
  fetchAllStWorkData,
  fetchStChangeRequests,
  fetchStCustomerQuotes,
  fetchStCustomers,
  fetchStLines,
  fetchStNewProductStatuses,
  fetchStProducts,
  ST_WORK_TABLES,
  subscribeToStWorkRealtime,
  updateStChangeRequest,
  updateStCustomer,
  updateStLine,
  updateStProduct,
  upsertStNewProductStatus,
} from '../utils/stWorkSupabase';
export type { StWorkSnapshot, StWorkTableName } from '../utils/stWorkSupabase';

export { uploadImageToHrBucket } from '../utils/supabaseService';
