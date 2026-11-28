import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = Number(process.env.PORT || 3000);
const GEMINI_VISION_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
] as const;
let preferredGeminiModel: (typeof GEMINI_VISION_MODELS)[number] =
  GEMINI_VISION_MODELS[0];

type AiProviderId = 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'deepl';

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

interface AiRoutingAttemptInput {
  provider: AiProviderId;
  apiKeys?: string[];
  model?: string;
  includeServerEnvKey?: boolean;
}

interface AiVisionParseBody extends ParseScheduleRequestBody {
  attempts?: AiRoutingAttemptInput[];
}

interface AiTranslateBody {
  lines?: string[];
  attempts?: AiRoutingAttemptInput[];
}

interface AiAttemptLog {
  provider: AiProviderId;
  status?: number;
  rateLimited?: boolean;
  quotaExceeded?: boolean;
  message?: string;
}

const PROVIDER_ENDPOINTS = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  deepl: 'https://api-free.deepl.com/v2/translate',
} as const;

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

const TRANSLATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    translations: {
      type: Type.ARRAY,
      description: 'Mảng bản dịch tiếng Hàn tương ứng 1-1 theo thứ tự từng dòng tiếng Việt đầu vào.',
      items: {
        type: Type.STRING,
      },
    },
  },
  required: ['translations'],
};

function getServerGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim();
}

function getErrorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const code = Number((err as { status?: unknown }).status);
    if (Number.isFinite(code) && code > 0) return code;
  }
  const msg = err instanceof Error ? err.message : String(err || '');
  const m = msg.match(/\b(400|401|403|404|429|456|500|502|503|504)\b/);
  return m ? Number(m[1]) : undefined;
}

function isModelNotFoundError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || '');
  const status = getErrorStatus(err);
  return (
    status === 404 ||
    /404|NOT_FOUND|is not found|not supported for generateContent/i.test(message)
  );
}

function isQuotaExceededError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || '');
  const status = getErrorStatus(err);
  return (
    status === 429 ||
    status === 456 ||
    /429|456|RESOURCE_EXHAUSTED|quota/i.test(message)
  );
}

function isRetryableUpstreamStatus(status: number | undefined): boolean {
  return (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 408 ||
    status === 429 ||
    status === 456 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function sanitizeUpstreamMessage(raw: string): string {
  // Never expose potential API keys in logs or client error strings
  return (raw || '')
    .replace(/AIza[0-9A-Za-z_-]{15,}/g, '[REDACTED_KEY]')
    .replace(/gsk_[0-9A-Za-z_-]{10,}/g, '[REDACTED_KEY]')
    .replace(/sk-or-v1-[0-9A-Za-z_-]{10,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/DeepL-Auth-Key\s+[^\s"']+/gi, 'DeepL-Auth-Key [REDACTED]')
    .slice(0, 260);
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
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace > 0 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }
  return stripped;
}

function buildVisionSchedulePrompt(
  employeeList: EmployeeContextItem[],
  defaultDate: string,
  includeJsonShape: boolean
): string {
  const serializedEmployees = employeeList
    .slice(0, 400)
    .map(
      (emp) =>
        `${emp.id} | ${emp.fullName}${emp.employeeCode ? ` (${emp.employeeCode})` : ''}${emp.department ? ` [${emp.department}]` : ''}`
    )
    .join('\n');

  const lines = [
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
  ];

  if (includeJsonShape) {
    lines.push(
      '',
      'Chỉ trả về JSON thuần hợp lệ (không giải thích thêm) theo mẫu:',
      '{"blocks":[{"overtimeDate":"","reasonVi":"","reasonKr":"","startTime":"16:10","endTime":"18:10","matchedParticipants":[{"employeeId":"","rawName":"","startTime":"16:10","endTime":"18:10"}],"unmatchedNames":[]}]}'
    );
  }

  return lines.join('\n');
}

async function generateScheduleExtractionWithGemini(
  apiKey: string,
  preferredModel: string | undefined,
  cleanBase64: string,
  mimeType: string,
  prompt: string
): Promise<{ blocks: unknown[]; modelUsed: string }> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });

  const candidateList: string[] = [];
  if (preferredModel && preferredModel.trim()) {
    candidateList.push(preferredModel.trim());
  }
  if (!candidateList.includes(preferredGeminiModel)) {
    candidateList.push(preferredGeminiModel);
  }
  for (const m of GEMINI_VISION_MODELS) {
    if (!candidateList.includes(m)) {
      candidateList.push(m);
    }
  }

  let lastErr: unknown = null;
  for (const candidateModel of candidateList) {
    try {
      const aiResponse = await ai.models.generateContent({
        model: candidateModel,
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

      const rawText = stripJsonCodeFences(aiResponse.text || '');
      if (!rawText) {
        throw new Error('AI không trả về dữ liệu văn bản từ ảnh này.');
      }
      const parsed = JSON.parse(rawText) as { blocks?: unknown[] };
      if (
        candidateModel === GEMINI_VISION_MODELS[0] ||
        candidateModel === GEMINI_VISION_MODELS[1]
      ) {
        preferredGeminiModel = candidateModel;
      }
      return {
        blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
        modelUsed: candidateModel,
      };
    } catch (err) {
      lastErr = err;
      if (isModelNotFoundError(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('Không thể kết nối tới model Gemini Vision khả dụng.');
}

async function generateScheduleExtractionWithOpenAiCompat(params: {
  provider: 'mistral' | 'openrouter' | 'groq';
  apiKey: string;
  model: string;
  cleanBase64: string;
  mimeType: string;
  prompt: string;
}): Promise<{ blocks: unknown[]; modelUsed: string }> {
  const endpoint = PROVIDER_ENDPOINTS[params.provider];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${params.apiKey}`,
  };
  if (params.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:3000';
    headers['X-Title'] = 'HR Pro Overtime OCR';
  }

  const body: Record<string, unknown> = {
    model: params.model,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: params.prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${params.mimeType};base64,${params.cleanBase64}`,
            },
          },
        ],
      },
    ],
  };

  if (params.provider === 'mistral' || params.provider === 'groq') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(
      `${params.provider} returned ${res.status}: ${sanitizeUpstreamMessage(errText || res.statusText)}`
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const json = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };

  const content = json.choices?.[0]?.message?.content;
  const rawContent = Array.isArray(content)
    ? content.map((p) => p?.text || '').join('')
    : typeof content === 'string'
      ? content
      : '';

  const cleaned = stripJsonCodeFences(rawContent);
  if (!cleaned) {
    throw new Error(`${params.provider} không trả về dữ liệu JSON.`);
  }
  const parsed = JSON.parse(cleaned) as { blocks?: unknown[] };
  return {
    blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    modelUsed: json.model || params.model,
  };
}

function cleanKoreanTranslationLine(raw: string): string {
  return (raw || '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.。!！]+$/, '')
    .trim();
}

async function translateWithDeepL(
  apiKey: string,
  lines: string[]
): Promise<{ translations: string[]; modelUsed: string }> {
  const res = await fetch(PROVIDER_ENDPOINTS.deepl, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: lines,
      source_lang: 'VI',
      target_lang: 'KO',
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(
      `DeepL returned ${res.status}: ${sanitizeUpstreamMessage(errText || res.statusText)}`
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const json = (await res.json()) as {
    translations?: Array<{ text?: string }>;
  };
  const out = Array.isArray(json.translations)
    ? json.translations.map((item) => cleanKoreanTranslationLine(item?.text || ''))
    : [];

  if (out.length !== lines.length || out.some((s) => !s)) {
    throw new Error('DeepL trả về thiếu số dòng dịch.');
  }

  return { translations: out, modelUsed: 'deepl-free' };
}

async function translateWithGemini(
  apiKey: string,
  preferredModel: string | undefined,
  lines: string[]
): Promise<{ translations: string[]; modelUsed: string }> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });

  const candidateList: string[] = [];
  if (preferredModel && preferredModel.trim()) {
    candidateList.push(preferredModel.trim());
  }
  for (const m of GEMINI_VISION_MODELS) {
    if (!candidateList.includes(m)) candidateList.push(m);
  }

  const prompt = [
    'Dịch danh sách các lý do tăng ca nhà máy sản xuất dưới đây từ Tiếng Việt sang Tiếng Hàn.',
    'YÊU CẦU:',
    '- Ngắn gọn, tự nhiên theo văn phong báo cáo tăng ca nhà máy Hàn Quốc (dạng danh từ/cụm danh từ, không dùng đuôi câu lịch sự dài dòng như 합니다/입니다).',
    `- Trả về mảng translations có đúng ${lines.length} phần tử theo đúng thứ tự.`,
    'Danh sách đầu vào (JSON):',
    JSON.stringify(lines),
  ].join('\n');

  let lastErr: unknown = null;
  for (const model of candidateList) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: TRANSLATION_SCHEMA,
        },
      });
      const raw = stripJsonCodeFences(response.text || '');
      const parsed = JSON.parse(raw) as { translations?: string[] };
      const out = Array.isArray(parsed.translations)
        ? parsed.translations.map((s) => cleanKoreanTranslationLine(String(s || '')))
        : [];
      if (out.length !== lines.length || out.some((s) => !s)) {
        throw new Error('Gemini trả về thiếu số dòng dịch.');
      }
      return { translations: out, modelUsed: model };
    } catch (err) {
      lastErr = err;
      if (isModelNotFoundError(err)) continue;
      throw err;
    }
  }

  throw lastErr || new Error('Gemini không dịch được nội dung.');
}

async function translateWithOpenAiCompat(params: {
  provider: 'groq' | 'mistral' | 'openrouter';
  apiKey: string;
  model: string;
  lines: string[];
}): Promise<{ translations: string[]; modelUsed: string }> {
  const endpoint = PROVIDER_ENDPOINTS[params.provider];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${params.apiKey}`,
  };
  if (params.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:3000';
    headers['X-Title'] = 'HR Pro Overtime Translator';
  }

  const prompt = [
    'Translate the following Vietnamese factory overtime reasons into concise Korean manufacturing terminology (noun phrases suitable for Korean overtime request forms, without polite endings like 합니다/입니다).',
    `Return ONLY valid JSON: {"translations": ["...", ...]} with EXACTLY ${params.lines.length} strings in the exact same order.`,
    'Input JSON array:',
    JSON.stringify(params.lines),
  ].join('\n');

  const body: Record<string, unknown> = {
    model: params.model,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  };
  if (params.provider === 'groq' || params.provider === 'mistral') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(
      `${params.provider} returned ${res.status}: ${sanitizeUpstreamMessage(errText || res.statusText)}`
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const json = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = stripJsonCodeFences(json.choices?.[0]?.message?.content || '');
  const parsed = JSON.parse(raw) as { translations?: string[] };
  const out = Array.isArray(parsed.translations)
    ? parsed.translations.map((s) => cleanKoreanTranslationLine(String(s || '')))
    : [];
  if (out.length !== params.lines.length || out.some((s) => !s)) {
    throw new Error(`${params.provider} trả về thiếu số dòng dịch.`);
  }

  return { translations: out, modelUsed: json.model || params.model };
}

function collectCandidateKeys(
  rawKeys: string[] | undefined,
  includeServerEnvKey?: boolean
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const k of rawKeys || []) {
    const clean = typeof k === 'string' ? k.trim() : '';
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  if (includeServerEnvKey) {
    const serverKey = getServerGeminiApiKey();
    if (serverKey && !seen.has(serverKey)) {
      seen.add(serverKey);
      result.push(serverKey);
    }
  }
  return result;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/ai/status', (_req: Request, res: Response) => {
    res.json({
      hasServerGeminiKey: Boolean(getServerGeminiApiKey()),
    });
  });

  app.post('/api/ai/vision-parse', async (req: Request, res: Response) => {
    const body = (req.body || {}) as AiVisionParseBody;
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
    const rawAttempts = Array.isArray(body.attempts) ? body.attempts : [];

    // Fallback default Gemini server attempt if client didn't pass attempts
    const attempts: AiRoutingAttemptInput[] =
      rawAttempts.length > 0
        ? rawAttempts
        : getServerGeminiApiKey()
          ? [{ provider: 'gemini', includeServerEnvKey: true, model: GEMINI_VISION_MODELS[0] }]
          : [];

    const attemptLogs: AiAttemptLog[] = [];
    const geminiPrompt = buildVisionSchedulePrompt(employeeList, defaultDate, false);
    const openAiPrompt = buildVisionSchedulePrompt(employeeList, defaultDate, true);

    for (const attempt of attempts) {
      if (
        attempt.provider !== 'gemini' &&
        attempt.provider !== 'mistral' &&
        attempt.provider !== 'openrouter' &&
        attempt.provider !== 'groq'
      ) {
        // DeepL or unknown provider does not support vision — skip
        continue;
      }

      const keys = collectCandidateKeys(
        attempt.apiKeys,
        attempt.provider === 'gemini' && Boolean(attempt.includeServerEnvKey)
      );
      if (keys.length === 0) continue;

      let providerFailedWithRetryable = false;

      for (const apiKey of keys) {
        try {
          if (attempt.provider === 'gemini') {
            const result = await generateScheduleExtractionWithGemini(
              apiKey,
              attempt.model,
              cleanBase64,
              mimeType,
              geminiPrompt
            );
            res.json({
              blocks: result.blocks,
              providerUsed: 'gemini',
              modelUsed: result.modelUsed,
              attemptLogs,
            });
            return;
          }

          const defaultModel =
            attempt.provider === 'mistral'
              ? 'pixtral-12b-2409'
              : attempt.provider === 'openrouter'
                ? 'openrouter/free'
                : 'meta-llama/llama-4-scout-17b-16e-instruct';

          const result = await generateScheduleExtractionWithOpenAiCompat({
            provider: attempt.provider,
            apiKey,
            model: attempt.model?.trim() || defaultModel,
            cleanBase64,
            mimeType,
            prompt: openAiPrompt,
          });
          res.json({
            blocks: result.blocks,
            providerUsed: attempt.provider,
            modelUsed: result.modelUsed,
            attemptLogs,
          });
          return;
        } catch (err) {
          const status = getErrorStatus(err);
          const rateLimited = status === 429 || isQuotaExceededError(err);
          const message = sanitizeUpstreamMessage(
            err instanceof Error ? err.message : String(err || '')
          );
          attemptLogs.push({
            provider: attempt.provider,
            status,
            rateLimited,
            message,
          });
          console.warn(
            `[/api/ai/vision-parse] Provider ${attempt.provider} failed (status=${status || 'unknown'}): ${message}`
          );

          // On Gemini multi-line key rotation, continue trying remaining keys before falling back
          if (attempt.provider === 'gemini') {
            providerFailedWithRetryable = true;
            continue;
          }

          if (isRetryableUpstreamStatus(status)) {
            providerFailedWithRetryable = true;
            break;
          }
          providerFailedWithRetryable = true;
          break;
        }
      }

      if (providerFailedWithRetryable) {
        continue;
      }
    }

    const anyRateLimit = attemptLogs.some((l) => l.rateLimited || l.status === 429);
    res.status(anyRateLimit ? 429 : 502).json({
      error: anyRateLimit
        ? 'Các nhà cung cấp AI đọc ảnh đều tạm hết lượt miễn phí (429). Vui lòng kiểm tra Cài đặt AI hoặc nhập thủ công.'
        : 'Không thể phân tích ảnh lịch tăng ca qua các nhà cung cấp AI đã cấu hình.',
      attemptLogs,
    });
  });

  app.post('/api/ai/translate', async (req: Request, res: Response) => {
    const body = (req.body || {}) as AiTranslateBody;
    const lines = Array.isArray(body.lines)
      ? body.lines.map((l) => String(l || '').trim()).filter(Boolean).slice(0, 100)
      : [];

    if (lines.length === 0) {
      res.status(400).json({ error: 'Không có dòng nội dung cần dịch.' });
      return;
    }

    const rawAttempts = Array.isArray(body.attempts) ? body.attempts : [];
    const attempts: AiRoutingAttemptInput[] =
      rawAttempts.length > 0
        ? rawAttempts
        : getServerGeminiApiKey()
          ? [{ provider: 'gemini', includeServerEnvKey: true, model: GEMINI_VISION_MODELS[0] }]
          : [];

    const attemptLogs: AiAttemptLog[] = [];
    const charsUsed = lines.reduce((sum, l) => sum + l.length, 0);

    for (const attempt of attempts) {
      if (
        attempt.provider !== 'deepl' &&
        attempt.provider !== 'groq' &&
        attempt.provider !== 'gemini' &&
        attempt.provider !== 'mistral' &&
        attempt.provider !== 'openrouter'
      ) {
        continue;
      }

      const keys = collectCandidateKeys(
        attempt.apiKeys,
        attempt.provider === 'gemini' && Boolean(attempt.includeServerEnvKey)
      );
      if (keys.length === 0) continue;

      for (const apiKey of keys) {
        try {
          if (attempt.provider === 'deepl') {
            const result = await translateWithDeepL(apiKey, lines);
            res.json({
              translations: result.translations,
              providerUsed: 'deepl',
              modelUsed: result.modelUsed,
              charsUsed,
              attemptLogs,
            });
            return;
          }

          if (attempt.provider === 'gemini') {
            const result = await translateWithGemini(apiKey, attempt.model, lines);
            res.json({
              translations: result.translations,
              providerUsed: 'gemini',
              modelUsed: result.modelUsed,
              charsUsed: 0,
              attemptLogs,
            });
            return;
          }

          const defaultModel =
            attempt.provider === 'groq'
              ? 'llama-3.3-70b-versatile'
              : attempt.provider === 'mistral'
                ? 'mistral-small-latest'
                : 'openrouter/free';

          const result = await translateWithOpenAiCompat({
            provider: attempt.provider,
            apiKey,
            model: attempt.model?.trim() || defaultModel,
            lines,
          });
          res.json({
            translations: result.translations,
            providerUsed: attempt.provider,
            modelUsed: result.modelUsed,
            charsUsed: 0,
            attemptLogs,
          });
          return;
        } catch (err) {
          const status = getErrorStatus(err);
          const rateLimited = status === 429;
          const quotaExceeded = status === 456 || (attempt.provider === 'deepl' && rateLimited);
          const message = sanitizeUpstreamMessage(
            err instanceof Error ? err.message : String(err || '')
          );
          attemptLogs.push({
            provider: attempt.provider,
            status,
            rateLimited,
            quotaExceeded,
            message,
          });
          console.warn(
            `[/api/ai/translate] Provider ${attempt.provider} failed (status=${status || 'unknown'}): ${message}`
          );

          if (attempt.provider === 'gemini') {
            continue;
          }
          break;
        }
      }
    }

    res.status(502).json({
      error: 'Không có nhà cung cấp AI dịch thuật khả dụng.',
      attemptLogs,
    });
  });

  app.post('/api/overtime/parse-schedule-image', async (req: Request, res: Response) => {
    try {
      const apiKey = getServerGeminiApiKey();
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
      const prompt = buildVisionSchedulePrompt(employeeList, defaultDate, false);
      const result = await generateScheduleExtractionWithGemini(
        apiKey,
        preferredGeminiModel,
        cleanBase64,
        mimeType,
        prompt
      );

      res.json({ blocks: result.blocks, modelUsed: result.modelUsed });
    } catch (err) {
      const message = sanitizeUpstreamMessage(
        err instanceof Error ? err.message : 'Lỗi không xác định khi phân tích ảnh lịch tăng ca.'
      );
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
    const { createServer: createViteServer } = await import('vite');
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
