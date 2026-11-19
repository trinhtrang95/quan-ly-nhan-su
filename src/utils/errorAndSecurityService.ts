import { UserAccount } from '../types/hr';

/**
 * Chuẩn JSON trả về thống nhất cho mọi lỗi từ tầng Service / API
 */
export interface StandardApiErrorResponse {
  success: false;
  message: string;
  code: number;
}

const viNumberFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 2,
});

/**
 * Định dạng số theo chuẩn Việt Nam (dấu '.' phân cách hàng nghìn, dấu ',' cho phần thập phân).
 * Nếu giá trị bằng 0 và zeroAsDash = true thì trả về '-'.
 */
export function formatNumberVN(
  value: number | null | undefined,
  zeroAsDash: boolean = false
): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return zeroAsDash ? '-' : '0';
  if (num === 0 && zeroAsDash) return '-';
  return viNumberFormatter.format(num);
}

/**
 * Chuẩn hóa lỗi ở tầng Service / Backend theo định dạng JSON duy nhất:
 * { success: false, message: string, code: number }
 */
export function normalizeApiError(
  error: unknown,
  defaultCode: number = 500,
  fallbackMessage: string = 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau.'
): StandardApiErrorResponse {
  let statusCode = defaultCode;
  if (error instanceof Error) {
    const match = error.message.match(/\((\d{3})\)/);
    if (match) {
      statusCode = Number(match[1]);
    }
  }
  return {
    success: false,
    message: fallbackMessage,
    code: statusCode,
  };
}

/**
 * Chuyển đổi mọi lỗi kỹ thuật (API / Database) sang thông báo tiếng Việt thân thiện cho End-user,
 * tuyệt đối không phơi bày raw error.message hay tên bảng/cột DB ra giao diện.
 */
export function getFriendlyErrorMessage(
  _error: unknown,
  customFriendlyMessage?: string
): string {
  return (
    customFriendlyMessage ||
    'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau.'
  );
}

/**
 * Masking dữ liệu nhạy cảm của tài khoản trước khi hiển thị hoặc xuất file sao lưu xuống Client
 */
export function maskSensitiveUserAccount(account: UserAccount): UserAccount {
  return {
    ...account,
    password: '••••••••',
  };
}
