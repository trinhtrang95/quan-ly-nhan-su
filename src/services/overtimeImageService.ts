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

const CLIENT_FALLBACK_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
] as const;

function stripBase64DataUrlPrefix(raw: string): string {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIdx !== -1) {
    return trimmed.slice(commaIdx + 1);
  }
  return trimmed;
}

function stripMarkdownJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function parseViaClientViteKeyFallback(params: {
  apiKey: string;
  imageBase64: string;
  mimeType: string;
  employees: Employee[];
  defaultDate: string;
}): Promise<{ blocks: ScannedScheduleBlock[]; modelUsed: string }> {
  const cleanBase64 = stripBase64DataUrlPrefix(params.imageBase64);
  const serializedEmployees = params.employees
    .slice(0, 400)
    .map(
      (emp) =>
        `${emp.id} | ${emp.fullName}${emp.employeeCode ? ` (${emp.employeeCode})` : ''}${emp.department ? ` [${emp.department}]` : ''}`
    )
    .join('\n');

  const prompt = [
    'Bạn là trợ lý trích xuất dữ liệu lịch tăng ca từ ảnh chụp màn hình Excel / Zalo của nhà máy sản xuất tại Việt Nam.',
    'Hãy đọc thật kỹ bảng trong ảnh (lưu ý các ô gộp merged cells theo cột Ngày, Lý do, hoặc Thời gian cho nhiều nhân sự) và trả về JSON thuần hợp lệ.',
    '',
    'QUY TẮC BẮT BUỘC:',
    '1. BỎ QUA hoàn toàn các dòng/người không tăng ca: ghi "Full time", "Fulltime", "Nghỉ PN", "Nghỉ phép", "Nghỉ", "OFF", hoặc khung giờ hành chính "07:30 - 16:10" / "07:30-16:10" / "7h30 - 16h10".',
    '2. Chuẩn hóa mọi giờ sang định dạng 24 giờ HH:MM (ví dụ: "16h10" -> "16:10", "18h10" -> "18:10", "20h40" -> "20:40", "8h" -> "08:00").',
    '3. Giữ nguyên TOÀN BỘ nội dung đa dòng và các gạch đầu dòng ("- ...", "* ...", "• ...") của Lý do tăng ca trong reasonVi (dùng ký tự xuống dòng \\n giữa các dòng, không gộp hay cắt bớt ý).',
    '4. Nếu các nhân sự có cùng ngày, cùng lý do tăng ca (kể cả từ ô merged cell), gom vào cùng 1 block trong mảng blocks. Nếu trong cùng block có 1-2 người giờ khác, giữ giờ phổ biến nhất làm startTime/endTime chung và ghi giờ riêng vào participant.startTime / participant.endTime.',
    '5. Nếu có nhiều nhóm lý do hoặc nhiều ngày khác nhau, tách thành nhiều phần tử trong mảng blocks.',
    `6. Ngày mặc định tham chiếu là ${params.defaultDate || 'hôm nay'}; nếu ảnh ghi ngày rõ ràng hãy chuyển sang YYYY-MM-DD, nếu không có ngày thì trả về "".`,
    '7. Đối chiếu tên nhân sự với danh sách hệ thống dưới đây (chỉ điền employeeId khi khớp tên chắc chắn, không phân biệt hoa thường; nếu không tìm thấy hãy đưa tên gốc vào unmatchedNames):',
    serializedEmployees || '(Không có danh sách nhân sự đính kèm)',
    '8. Dịch toàn bộ các dòng trong reasonVi sang reasonKr tương ứng từng dòng (giữ xuống dòng \\n), ngắn gọn, đúng thuật ngữ sản xuất nhà máy Hàn Quốc.',
    '',
    'Định dạng JSON trả về: {"blocks":[{"overtimeDate":"","reasonVi":"","reasonKr":"","startTime":"16:10","endTime":"18:10","matchedParticipants":[{"employeeId":"","rawName":"","startTime":"16:10","endTime":"18:10"}],"unmatchedNames":[]}]}',
  ].join('\n');

  let lastStatus = 500;
  let lastErrorText = '';

  for (const model of CLIENT_FALLBACK_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      params.apiKey
    )}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: params.mimeType, data: cleanBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (res.status === 404 || res.status === 429) {
      lastStatus = res.status;
      lastErrorText = await res.text().catch(() => '');
      continue;
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(
        `Không thể phân tích ảnh lịch tăng ca (${res.status}): ${errBody || res.statusText}`
      );
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const rawText = stripMarkdownJsonFences(
      json.candidates?.[0]?.content?.parts?.[0]?.text || ''
    );
    if (!rawText) {
      throw new Error(
        'AI không trả về dữ liệu văn bản từ ảnh này. Vui lòng thử ảnh rõ nét hơn.'
      );
    }
    const parsed = JSON.parse(rawText) as { blocks?: ScannedScheduleBlock[] };
    return {
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
      modelUsed: model,
    };
  }

  if (lastStatus === 429) {
    throw new Error(
      'Hệ thống AI tạm thời hết lượt quét miễn phí (429). Vui lòng thử lại sau ít phút hoặc nhập tay nội dung.'
    );
  }
  throw new Error(
    `Không tìm thấy model Gemini Vision khả dụng (${lastStatus})${lastErrorText ? `: ${lastErrorText}` : '.'}`
  );
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

  if (response.status === 404) {
    const clientViteKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
    if (clientViteKey) {
      return parseViaClientViteKeyFallback({
        apiKey: clientViteKey,
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        employees: params.employees,
        defaultDate: params.defaultDate,
      });
    }
    throw new Error(
      'Không tìm thấy API máy chủ (/api/overtime/parse-schedule-image - 404). Vui lòng tải lại trang hoặc đảm bảo ứng dụng đang chạy kèm máy chủ Node/Express (npm run dev / npm run start).'
    );
  }

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
