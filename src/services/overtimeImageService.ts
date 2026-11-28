import { Employee } from '../types/hr';
import { ScannedScheduleBlock } from '../utils/overtimeImageImportLogic';

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

export async function parseOvertimeScheduleImage(params: {
  imageBase64: string;
  mimeType: string;
  employees: Employee[];
  defaultDate: string;
}): Promise<{ blocks: ScannedScheduleBlock[]; modelUsed?: string }> {
  const response = await fetch('/api/overtime/parse-schedule-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      defaultDate: params.defaultDate,
      employeeList: params.employees.map((emp) => ({
        id: emp.id,
        fullName: emp.fullName,
        employeeCode: emp.employeeCode,
        department: emp.department,
      })),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    blocks?: ScannedScheduleBlock[];
    modelUsed?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error || `Lỗi máy chủ (${response.status}) khi phân tích ảnh lịch tăng ca.`
    );
  }

  return {
    blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
    modelUsed: payload.modelUsed,
  };
}
