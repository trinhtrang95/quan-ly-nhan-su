import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT || 3000);
const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';
let preferredGeminiModel = PRIMARY_GEMINI_MODEL;

interface EmployeeContextItem {
  id: string;
  fullName: string;
  employeeCode?: string;
  department?: string;
}

interface ParseScheduleRequestBody {
  imageBase64?: string;
  mimeType?: string;
  employeeList?: EmployeeContextItem[];
  defaultDate?: string;
}

const OVERTIME_SCHEDULE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    blocks: {
      type: Type.ARRAY,
      description: 'Danh sách các nhóm công việc tăng ca trích xuất từ ảnh lịch tăng ca.',
      items: {
        type: Type.OBJECT,
        properties: {
          overtimeDate: {
            type: Type.STRING,
            description:
              'Ngày tăng ca định dạng YYYY-MM-DD nếu có trong ảnh (hoặc DD/MM/YYYY); để rỗng "" nếu ảnh không ghi ngày.',
          },
          reasonVi: {
            type: Type.STRING,
            description: 'Lý do/công việc tăng ca bằng tiếng Việt (từ ô gộp hoặc dòng tương ứng).',
          },
          reasonKr: {
            type: Type.STRING,
            description: 'Bản dịch tiếng Hàn ngắn gọn, tự nhiên cho môi trường nhà máy sản xuất.',
          },
          startTime: {
            type: Type.STRING,
            description: 'Giờ bắt đầu tăng ca chung của nhóm theo chuẩn 24h HH:MM (ví dụ 16:10).',
          },
          endTime: {
            type: Type.STRING,
            description: 'Giờ kết thúc tăng ca chung của nhóm theo chuẩn 24h HH:MM (ví dụ 18:10).',
          },
          matchedParticipants: {
            type: Type.ARRAY,
            description: 'Danh sách nhân sự tham gia tăng ca đã đối chiếu với danh sách nhân viên.',
            items: {
              type: Type.OBJECT,
              properties: {
                employeeId: {
                  type: Type.STRING,
                  description: 'ID chính xác từ danh sách nhân sự cung cấp; để rỗng "" nếu không chắc chắn.',
                },
                rawName: {
                  type: Type.STRING,
                  description: 'Tên nhân sự gốc đọc được trong ảnh.',
                },
                startTime: {
                  type: Type.STRING,
                  description: 'Giờ bắt đầu riêng của nhân sự này (HH:MM). Nếu dùng giờ chung vẫn điền HH:MM.',
                },
                endTime: {
                  type: Type.STRING,
                  description: 'Giờ kết thúc riêng của nhân sự này (HH:MM). Nếu dùng giờ chung vẫn điền HH:MM.',
                },
              },
              required: ['employeeId', 'rawName', 'startTime', 'endTime'],
            },
          },
          unmatchedNames: {
            type: Type.ARRAY,
            description: 'Tên nhân sự trong ảnh làm tăng ca nhưng không khớp với danh sách hệ thống.',
            items: { type: Type.STRING },
          },
        },
        required: [
          'overtimeDate',
          'reasonVi',
          'reasonKr',
          'startTime',
          'endTime',
          'matchedParticipants',
          'unmatchedNames',
        ],
      },
    },
  },
  required: ['blocks'],
};

function isModelNotFoundError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || '');
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : undefined;
  return (
    status === 404 ||
    /404|NOT_FOUND|is not found|not supported for generateContent/i.test(message)
  );
}

function isQuotaExceededError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || '');
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : undefined;
  return (
    status === 429 ||
    /429|RESOURCE_EXHAUSTED|quota/i.test(message)
  );
}

function stripBase64DataPrefix(raw: string): string {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIdx !== -1) {
    return trimmed.slice(commaIdx + 1);
  }
  return trimmed;
}

function stripJsonCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function generateScheduleExtraction(
  ai: GoogleGenAI,
  model: string,
  cleanBase64: string,
  mimeType: string,
  prompt: string
) {
  return ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: OVERTIME_SCHEDULE_SCHEMA,
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/overtime/parse-schedule-image', async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        res.status(500).json({
          error: 'Máy chủ chưa cấu hình GEMINI_API_KEY nên chưa thể phân tích ảnh.',
        });
        return;
      }

      const body = (req.body || {}) as ParseScheduleRequestBody;
      const cleanBase64 = body.imageBase64 ? stripBase64DataPrefix(body.imageBase64) : '';
      const mimeType = (body.mimeType || '').trim();

      if (!cleanBase64 || !mimeType.startsWith('image/')) {
        res.status(400).json({
          error: 'Dữ liệu ảnh không hợp lệ. Vui lòng dán hoặc chọn lại ảnh lịch tăng ca.',
        });
        return;
      }

      const employeeList = Array.isArray(body.employeeList) ? body.employeeList.slice(0, 400) : [];
      const defaultDate = (body.defaultDate || '').trim();

      const serializedEmployees = employeeList
        .map((emp) => `${emp.id} | ${emp.fullName}${emp.employeeCode ? ` (${emp.employeeCode})` : ''}${emp.department ? ` [${emp.department}]` : ''}`)
        .join('\n');

      const prompt = [
        'Bạn là trợ lý trích xuất dữ liệu lịch tăng ca từ ảnh chụp màn hình Excel / Zalo của nhà máy sản xuất tại Việt Nam.',
        'Hãy đọc thật kỹ bảng trong ảnh (lưu ý các ô gộp merged cells theo cột Ngày, Lý do, hoặc Thời gian cho nhiều nhân sự) và trả về JSON theo đúng schema.',
        '',
        'QUY TẮC BẮT BUỘC:',
        '1. BỎ QUA hoàn toàn các dòng/người không tăng ca: ghi "Full time", "Fulltime", "Nghỉ PN", "Nghỉ phép", "Nghỉ", "OFF", hoặc khung giờ hành chính "07:30 - 16:10" / "07:30-16:10" / "7h30 - 16h10".',
        '2. Chuẩn hóa mọi giờ sang định dạng 24 giờ HH:MM (ví dụ: "16h10" -> "16:10", "18h10" -> "18:10", "20h40" -> "20:40", "8h" -> "08:00").',
        '3. Giữ nguyên TOÀN BỘ nội dung đa dòng và các gạch đầu dòng ("- ...", "* ...", "• ...") của Lý do tăng ca trong reasonVi (dùng ký tự xuống dòng \\n giữa các dòng, không gộp hay cắt bớt ý).',
        '4. Nếu các nhân sự có cùng ngày, cùng lý do tăng ca (kể cả từ ô merged cell), gom vào cùng 1 block trong mảng blocks. Nếu trong cùng block có 1-2 người giờ khác (ví dụ 16:10-20:10 thay vì 16:10-18:10), giữ giờ phổ biến nhất làm startTime/endTime chung của block và ghi đúng giờ riêng vào participant.startTime / participant.endTime.',
        '5. Nếu có nhiều nhóm lý do hoặc nhiều ngày khác nhau, tách thành nhiều phần tử trong mảng blocks.',
        `6. Ngày mặc định tham chiếu là ${defaultDate || 'hôm nay'}; nếu ảnh ghi ngày rõ ràng hãy chuyển sang YYYY-MM-DD, nếu không có ngày thì trả về "".`,
        '7. Đối chiếu tên nhân sự với danh sách hệ thống dưới đây (chỉ điền employeeId khi khớp tên chắc chắn, không phân biệt hoa thường; nếu không tìm thấy trong danh sách hãy đưa tên gốc vào unmatchedNames):',
        serializedEmployees || '(Không có danh sách nhân sự đính kèm)',
        '8. Dịch toàn bộ các dòng trong reasonVi sang reasonKr tương ứng từng dòng (giữ xuống dòng \\n), ngắn gọn, đúng thuật ngữ sản xuất nhà máy Hàn Quốc.',
      ].join('\n');

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      let modelUsed = preferredGeminiModel;
      let aiResponse;
      try {
        aiResponse = await generateScheduleExtraction(
          ai,
          preferredGeminiModel,
          cleanBase64,
          mimeType,
          prompt
        );
      } catch (primaryErr) {
        const alternateModel =
          preferredGeminiModel === PRIMARY_GEMINI_MODEL
            ? FALLBACK_GEMINI_MODEL
            : PRIMARY_GEMINI_MODEL;
        if (isModelNotFoundError(primaryErr) || isQuotaExceededError(primaryErr)) {
          preferredGeminiModel = alternateModel;
          modelUsed = alternateModel;
          aiResponse = await generateScheduleExtraction(
            ai,
            alternateModel,
            cleanBase64,
            mimeType,
            prompt
          );
        } else {
          throw primaryErr;
        }
      }

      const rawText = stripJsonCodeFences(aiResponse.text || '');
      if (!rawText) {
        res.status(502).json({
          error: 'AI không trả về dữ liệu văn bản từ ảnh này. Vui lòng thử ảnh rõ nét hơn.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as { blocks?: unknown[] };
      const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
      res.json({ blocks, modelUsed });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Lỗi không xác định khi phân tích ảnh lịch tăng ca.';
      console.error('[/api/overtime/parse-schedule-image] Error:', message);
      if (isQuotaExceededError(err)) {
        res.status(429).json({
          error:
            'Hệ thống AI tạm thời hết lượt quét miễn phí (429). Vui lòng thử lại sau ít phút hoặc nhập tay nội dung.',
        });
        return;
      }
      res.status(500).json({
        error: `Không thể phân tích ảnh lịch tăng ca: ${message}`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
