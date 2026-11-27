export {
  getOvertimeSupabaseClient,
  getSupabaseClient,
  HR_IMAGES_BUCKET,
  overtimeSupabase,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from './supabaseClient';

// ==========================================
// CA LÀM VIỆC, LỊCH NGHỈ LỄ & QUY ĐỊNH TĂNG CA
// ==========================================
export {
  addManualCompanyHoliday,
  applyRealtimeHolidayPayload,
  applyRealtimeWorkShiftPayload,
  deleteCompanyHoliday,
  deleteWorkShift,
  fetchAllCompanyHolidays,
  fetchCompanyHolidays,
  fetchOvertimeSettings,
  fetchWorkShifts,
  loadHolidayPlanForYear,
  mapSupabaseRowToCompanyHoliday,
  mapSupabaseRowToOvertimeSettings,
  mapSupabaseRowToWorkShift,
  replaceGeneratedCompanyHolidays,
  saveHolidayPlanForYear,
  saveOvertimeSettings,
  saveWorkShift,
  setDefaultWorkShift,
  subscribeToCompanyHolidaysRealtime,
  subscribeToOvertimeSettingsRealtime,
  subscribeToWorkShiftsRealtime,
  SUPABASE_GENERAL_SETTINGS_SQL,
} from '../utils/workScheduleSupabase';
export type {
  CompanyHolidaysRealtimeEvent,
  OvertimeSettingsRealtimeEvent,
  SupabaseCompanyHolidayRow,
  SupabaseOvertimeSettingsRow,
  SupabaseWorkShiftRow,
  WorkShiftsRealtimeEvent,
} from '../utils/workScheduleSupabase';

// ==========================================
// KÝ HIỆU CHẤM CÔNG (ATTENDANCE SYMBOLS)
// ==========================================
export {
  applyRealtimeAttendanceSymbolPayload,
  deleteAttendanceSymbol,
  fetchAttendanceSymbols,
  mapSupabaseRowToAttendanceSymbol,
  readLocalAttendanceSymbols,
  subscribeToAttendanceSymbolsRealtime,
  upsertAttendanceSymbol,
  writeLocalAttendanceSymbols,
} from '../utils/attendanceSymbolsService';
export type {
  AttendanceSymbolsRealtimeEvent,
  AttendanceSymbolUpsertInput,
  SupabaseAttendanceSymbolRow,
} from '../utils/attendanceSymbolsService';

// ==========================================
// CẤU HÌNH HỆ THỐNG (ĐƠN VỊ, PHÒNG BAN, CHỨC VỤ, TÀI KHOẢN, SAO LƯU)
// ==========================================
export {
  authenticateAppUserInSupabase,
  clearAllDataInSupabase,
  compressImageClientSide,
  createAppUserInSupabase,
  createCompanyInSupabase,
  createDepartmentInSupabase,
  createPositionInSupabase,
  deleteAppUserFromSupabase,
  deleteCompanyFromSupabase,
  deleteDepartmentFromSupabase,
  deleteImageFromHrBucket,
  deletePositionFromSupabase,
  reorderDepartmentsInSupabase,
  restoreFromBackupInSupabase,
  SUPABASE_LEAVE_LOGS_SQL,
  updateAppUserRoleInSupabase,
  updateCompanyInSupabase,
  updateDepartmentInSupabase,
  updatePositionInSupabase,
  uploadImageToHrBucket,
} from '../utils/supabaseService';

// ==========================================
// BỘ PHẬN CẤP CÔNG TY (COMPANY DEPARTMENTS)
// ==========================================
export {
  COMPANY_DEPARTMENTS_EVENT,
  COMPANY_DEPARTMENTS_STORAGE_KEY,
  createCompanyDepartment,
  DEFAULT_COMPANY_DEPARTMENTS,
  deleteCompanyDepartment,
  fetchCompanyDepartments,
  generateCompanyDepartmentCode,
  mergeCompanyDepartmentOptions,
  normalizeCompanyDepartmentRow,
  readLocalCompanyDepartments,
  sortCompanyDepartments,
  subscribeToCompanyDepartmentsRealtime,
  updateCompanyDepartment,
  writeLocalCompanyDepartments,
} from '../utils/companyDepartmentsService';

