import { Employee } from '../types/hr';
import { ScannedScheduleBlock } from '../utils/overtimeImageImportLogic';
import {
  AiProviderId,
  parseOvertimeScheduleImageWithRouting,
} from './aiSettingsService';

export interface ReadImageForScanResult {
  imageBase64: string;
  mimeType: string;
  previewDataUrl: string;
}

export function readImageFileForOvertimeScan(
  file: Blob
): Promise<ReadImageForScanResult> {
  return new Promise((resolve, reject) => {
    const mimeType = file.type || 'image/png';
    if (!mimeType.startsWith('image/')) {
      reject(new Error('Tệp được chọn không phải là hình ảnh hợp lệ.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl || !dataUrl.includes(',')) {
        reject(new Error('Không thể đọc dữ liệu hình ảnh.'));
        return;
      }
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      resolve({
        imageBase64: base64,
        mimeType,
        previewDataUrl: dataUrl,
      });
    };
    reader.onerror = () => {
      reject(new Error('Lỗi khi đọc tệp hình ảnh từ bộ nhớ tạm.'));
    };
    reader.readAsDataURL(file);
  });
}

function stripBase64DataUrlPrefix(raw: string): string {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIdx !== -1) {
    return trimmed.slice(commaIdx + 1);
  }
  return trimmed;
}

export function resolveBrowserGeminiApiKey(overrideKey?: string): string {
  if (overrideKey && overrideKey.trim()) {
    return overrideKey.trim();
  }
  const importMetaEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string | undefined> }).env
      : undefined;
  const processEnv =
    typeof process !== 'undefined'
      ? (process.env as Record<string, string | undefined> | undefined)
      : undefined;

  return (
    importMetaEnv?.VITE_GEMINI_API_KEY ||
    importMetaEnv?.GEMINI_API_KEY ||
    processEnv?.VITE_GEMINI_API_KEY ||
    processEnv?.GEMINI_API_KEY ||
    ''
  ).trim();
}

export async function parseOvertimeScheduleImage(params: {
  imageBase64: string;
  mimeType: string;
  employees: Employee[];
  defaultDate: string;
  apiKeyOverride?: string;
}): Promise<{
  blocks: ScannedScheduleBlock[];
  modelUsed: string;
  providerUsed: AiProviderId;
}> {
  const cleanBase64 = stripBase64DataUrlPrefix(params.imageBase64 || '');
  const mimeType = (params.mimeType || '').trim();
  if (!cleanBase64 || !mimeType.startsWith('image/')) {
    throw new Error(
      'Dữ liệu ảnh không hợp lệ. Vui lòng dán hoặc chọn lại ảnh lịch tăng ca.'
    );
  }

  return parseOvertimeScheduleImageWithRouting({
    imageBase64: cleanBase64,
    mimeType,
    employees: params.employees,
    defaultDate: params.defaultDate,
    apiKeyOverride: params.apiKeyOverride,
  });
}
