import {
  getOvertimeSupabaseClient,
  overtimeSupabase,
} from '../utils/overtimeFormsService';
import { formatNumberVN } from '../utils/errorAndSecurityService';
import { Employee } from '../types/hr';
import { ScannedScheduleBlock } from '../utils/overtimeImageImportLogic';

export type AiProviderId = 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'deepl';

export type AiQuotaLevel = 'healthy' | 'warning' | 'exhausted';

export interface AiProviderConfig {
  id: AiProviderId;
  enabled: boolean;
  /** For Gemini: supports multiple API keys separated by newlines for automatic rotation. */
  apiKey: string;
  visionModel?: string;
  textModel: string;
  /** Daily request cap for Gemini / Groq / Mistral / OpenRouter. */
  dailyLimit?: number;
  /** Monthly character cap for DeepL API Free (500,000 chars/month). */
  monthlyCharLimit?: number;
}

export interface AiProviderUsageStats {
  date: string;
  requestsUsed: number;
  rateLimited: boolean;
  lastError?: string;
  lastErrorCode?: number;
  rotationIndex: number;
  month: string;
  charsUsed: number;
  quotaExceeded: boolean;
}

export interface AiSettingsState {
  id: string;
  providers: Record<AiProviderId, AiProviderConfig>;
  usage: Record<AiProviderId, AiProviderUsageStats>;
  updatedAt: string;
}

export interface SupabaseAiSettingsRow {
  id: string;
  providers: unknown;
  usage_stats: unknown;
  updated_at?: string | null;
}

export interface AiProviderMetadata {
  id: AiProviderId;
  name: string;
  shortName: string;
  roleLabel: string;
  supportsVision: boolean;
  supportsTranslation: boolean;
  endpointLabel: string;
  freeTierSummary: string;
  defaultVisionModel?: string;
  defaultTextModel: string;
  defaultDailyLimit?: number;
  defaultMonthlyCharLimit?: number;
  modelPresets?: {
    vision?: string[];
    text?: string[];
  };
}

export interface AiProviderQuotaStatus {
  providerId: AiProviderId;
  isConfigured: boolean;
  isEnabled: boolean;
  hasEnvFallback: boolean;
  keyCount: number;
  isMonthly: boolean;
  used: number;
  limit: number;
  remaining: number;
  percentRemaining: number;
  level: AiQuotaLevel;
  summaryText: string;
  warningText: string | null;
  statusBadge: string;
}

export interface AiRoutingAttempt {
  provider: AiProviderId;
  apiKeys: string[];
  model: string;
  includeServerEnvKey?: boolean;
}

export interface AiAttemptLog {
  provider: AiProviderId;
  status?: number;
  rateLimited?: boolean;
  quotaExceeded?: boolean;
  message?: string;
}

export const AI_SETTINGS_STORAGE_KEY = 'hr_pro_ai_settings_v1';
export const AI_SETTINGS_UPDATED_EVENT = 'hr-ai-settings-updated';
export const AI_NOTIFICATION_EVENT = 'hr-ai-notification';

export const VISION_PROVIDER_PRIORITY: readonly AiProviderId[] = [
  'gemini',
  'mistral',
  'openrouter',
  'groq',
] as const;

export const TRANSLATION_PROVIDER_PRIORITY: readonly AiProviderId[] = [
  'deepl',
  'groq',
  'gemini',
  'mistral',
  'openrouter',
] as const;

export const DEEPL_MONTHLY_CHAR_LIMIT = 500_000;
export const DEEPL_LOW_CHAR_THRESHOLD = 50_000;
export const DAILY_WARNING_PERCENT_THRESHOLD = 30;

export const AI_PROVIDERS_META: Record<AiProviderId, AiProviderMetadata> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    roleLabel: 'Đa năng (Đọc ảnh Zalo OCR + Dịch)',
    supportsVision: true,
    supportsTranslation: true,
    endpointLabel: 'Google AI (@google/genai) + VITE_GEMINI_API_KEY',
    freeTierSummary: 'Free Tier theo ngày • Nhập nhiều Key theo dòng để xoay vòng',
    defaultVisionModel: 'gemini-4-hydrogen',
    defaultTextModel: 'gemini-4-hydrogen',
    defaultDailyLimit: 1500,
    modelPresets: {
      vision: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
      text: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    },
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    shortName: 'Groq',
    roleLabel: 'Đa năng (Dịch siêu tốc + OCR dự phòng)',
    supportsVision: true,
    supportsTranslation: true,
    endpointLabel: 'https://api.groq.com/openai/v1/chat/completions',
    freeTierSummary: 'Gói Free 1.000 lượt/ngày (chuẩn OpenAI)',
    defaultVisionModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    defaultTextModel: 'llama-3.3-70b-versatile',
    defaultDailyLimit: 1000,
    modelPresets: {
      vision: ['meta-llama/llama-4-scout-17b-16e-instruct'],
      text: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    },
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    shortName: 'Mistral',
    roleLabel: 'Đa năng (Pixtral OCR + Mistral Small)',
    supportsVision: true,
    supportsTranslation: true,
    endpointLabel: 'https://api.mistral.ai/v1/chat/completions',
    freeTierSummary: 'Free Mode: pixtral-12b-2409 (ảnh) & mistral-small-latest (dịch)',
    defaultVisionModel: 'pixtral-12b-2409',
    defaultTextModel: 'mistral-small-latest',
    defaultDailyLimit: 500,
    modelPresets: {
      vision: ['pixtral-12b-2409'],
      text: ['mistral-small-latest', 'open-mistral-nemo'],
    },
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    shortName: 'OpenRouter',
    roleLabel: 'Đa năng (:free models)',
    supportsVision: true,
    supportsTranslation: true,
    endpointLabel: 'https://openrouter.ai/api/v1/chat/completions',
    freeTierSummary: 'Gói Free 50 lượt/ngày (openrouter/free hoặc model :free)',
    defaultVisionModel: 'openrouter/free',
    defaultTextModel: 'openrouter/free',
    defaultDailyLimit: 50,
    modelPresets: {
      vision: [
        'openrouter/free',
        'google/gemma-3-27b-it:free',
        'meta-llama/llama-3.2-11b-vision-instruct:free',
      ],
      text: ['openrouter/free', 'google/gemma-3-27b-it:free'],
    },
  },
  deepl: {
    id: 'deepl',
    name: 'DeepL API Free',
    shortName: 'DeepL Free',
    roleLabel: 'Chuyên dịch Việt → Hàn (Translation Only)',
    supportsVision: false,
    supportsTranslation: true,
    endpointLabel: 'https://api-free.deepl.com/v2/translate',
    freeTierSummary: 'Gói Free 500.000 ký tự/tháng (VI → KO chuẩn xác nhất)',
    defaultTextModel: 'deepl-free',
    defaultMonthlyCharLimit: DEEPL_MONTHLY_CHAR_LIMIT,
  },
};

export const SUPABASE_AI_SETTINGS_SQL = `-- Tạo bảng Cấu hình & Hạn mức AI (ai_settings)
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  providers JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_settings', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow public full access on ai_settings"
  ON public.ai_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.ai_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_settings;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';`;

export function getLocalTodayDateStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLocalMonthStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function parseMultiLineApiKeys(raw?: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    keys.push(trimmed);
  }
  return keys;
}

export function rotateKeysByIndex(keys: string[], startIndex: number): string[] {
  if (keys.length <= 1) return [...keys];
  const idx = ((startIndex % keys.length) + keys.length) % keys.length;
  return [...keys.slice(idx), ...keys.slice(0, idx)];
}

export function createDefaultAiSettings(now: Date = new Date()): AiSettingsState {
  const today = getLocalTodayDateStr(now);
  const month = getLocalMonthStr(now);

  return {
    id: 'default',
    providers: {
      gemini: {
        id: 'gemini',
        enabled: true,
        apiKey: '',
        visionModel: AI_PROVIDERS_META.gemini.defaultVisionModel,
        textModel: AI_PROVIDERS_META.gemini.defaultTextModel,
        dailyLimit: AI_PROVIDERS_META.gemini.defaultDailyLimit,
      },
      groq: {
        id: 'groq',
        enabled: true,
        apiKey: '',
        visionModel: AI_PROVIDERS_META.groq.defaultVisionModel,
        textModel: AI_PROVIDERS_META.groq.defaultTextModel,
        dailyLimit: AI_PROVIDERS_META.groq.defaultDailyLimit,
      },
      mistral: {
        id: 'mistral',
        enabled: true,
        apiKey: '',
        visionModel: AI_PROVIDERS_META.mistral.defaultVisionModel,
        textModel: AI_PROVIDERS_META.mistral.defaultTextModel,
        dailyLimit: AI_PROVIDERS_META.mistral.defaultDailyLimit,
      },
      openrouter: {
        id: 'openrouter',
        enabled: true,
        apiKey: '',
        visionModel: AI_PROVIDERS_META.openrouter.defaultVisionModel,
        textModel: AI_PROVIDERS_META.openrouter.defaultTextModel,
        dailyLimit: AI_PROVIDERS_META.openrouter.defaultDailyLimit,
      },
      deepl: {
        id: 'deepl',
        enabled: true,
        apiKey: '',
        textModel: AI_PROVIDERS_META.deepl.defaultTextModel,
        monthlyCharLimit: DEEPL_MONTHLY_CHAR_LIMIT,
      },
    },
    usage: {
      gemini: {
        date: today,
        requestsUsed: 0,
        rateLimited: false,
        rotationIndex: 0,
        month,
        charsUsed: 0,
        quotaExceeded: false,
      },
      groq: {
        date: today,
        requestsUsed: 0,
        rateLimited: false,
        rotationIndex: 0,
        month,
        charsUsed: 0,
        quotaExceeded: false,
      },
      mistral: {
        date: today,
        requestsUsed: 0,
        rateLimited: false,
        rotationIndex: 0,
        month,
        charsUsed: 0,
        quotaExceeded: false,
      },
      openrouter: {
        date: today,
        requestsUsed: 0,
        rateLimited: false,
        rotationIndex: 0,
        month,
        charsUsed: 0,
        quotaExceeded: false,
      },
      deepl: {
        date: today,
        requestsUsed: 0,
        rateLimited: false,
        rotationIndex: 0,
        month,
        charsUsed: 0,
        quotaExceeded: false,
      },
    },
    updatedAt: now.toISOString(),
  };
}

function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

export function normalizeUsageForCurrentPeriod(
  state: AiSettingsState,
  now: Date = new Date()
): AiSettingsState {
  const today = getLocalTodayDateStr(now);
  const currentMonth = getLocalMonthStr(now);
  const defaults = createDefaultAiSettings(now);

  const nextUsage = { ...state.usage };
  let changed = false;

  (Object.keys(defaults.providers) as AiProviderId[]).forEach((pid) => {
    const existing = nextUsage[pid] || defaults.usage[pid];
    let updated = { ...defaults.usage[pid], ...existing };

    if (updated.date !== today) {
      updated = {
        ...updated,
        date: today,
        requestsUsed: 0,
        rateLimited: false,
        lastError: undefined,
        lastErrorCode: undefined,
      };
      changed = true;
    }

    if (pid === 'deepl' && updated.month !== currentMonth) {
      updated = {
        ...updated,
        month: currentMonth,
        charsUsed: 0,
        quotaExceeded: false,
        lastError: undefined,
        lastErrorCode: undefined,
      };
      changed = true;
    }

    nextUsage[pid] = updated;
  });

  if (!changed) return state;
  return {
    ...state,
    usage: nextUsage,
  };
}

export function normalizeAiSettingsState(
  raw: Partial<AiSettingsState> | null | undefined,
  now: Date = new Date()
): AiSettingsState {
  const defaults = createDefaultAiSettings(now);
  if (!raw || typeof raw !== 'object') return defaults;

  const rawProviders = (raw.providers || {}) as Partial<
    Record<AiProviderId, Partial<AiProviderConfig>>
  >;
  const rawUsage = (raw.usage || {}) as Partial<
    Record<AiProviderId, Partial<AiProviderUsageStats>>
  >;

  const providers = { ...defaults.providers };
  const usage = { ...defaults.usage };

  (Object.keys(defaults.providers) as AiProviderId[]).forEach((pid) => {
    const defP = defaults.providers[pid];
    const incP = rawProviders[pid] || {};
    providers[pid] = {
      id: pid,
      enabled: typeof incP.enabled === 'boolean' ? incP.enabled : defP.enabled,
      apiKey: typeof incP.apiKey === 'string' ? incP.apiKey : defP.apiKey,
      visionModel:
        typeof incP.visionModel === 'string' && incP.visionModel.trim()
          ? incP.visionModel.trim()
          : defP.visionModel,
      textModel:
        typeof incP.textModel === 'string' && incP.textModel.trim()
          ? incP.textModel.trim()
          : defP.textModel,
      dailyLimit:
        typeof incP.dailyLimit === 'number' && Number.isFinite(incP.dailyLimit) && incP.dailyLimit > 0
          ? Math.round(incP.dailyLimit)
          : defP.dailyLimit,
      monthlyCharLimit:
        typeof incP.monthlyCharLimit === 'number' &&
        Number.isFinite(incP.monthlyCharLimit) &&
        incP.monthlyCharLimit > 0
          ? Math.round(incP.monthlyCharLimit)
          : defP.monthlyCharLimit,
    };

    const defU = defaults.usage[pid];
    const incU = rawUsage[pid] || {};
    usage[pid] = {
      date: typeof incU.date === 'string' && incU.date ? incU.date : defU.date,
      requestsUsed:
        typeof incU.requestsUsed === 'number' && Number.isFinite(incU.requestsUsed) && incU.requestsUsed >= 0
          ? Math.round(incU.requestsUsed)
          : 0,
      rateLimited: Boolean(incU.rateLimited),
      lastError: typeof incU.lastError === 'string' ? incU.lastError : undefined,
      lastErrorCode:
        typeof incU.lastErrorCode === 'number' ? incU.lastErrorCode : undefined,
      rotationIndex:
        typeof incU.rotationIndex === 'number' && Number.isFinite(incU.rotationIndex)
          ? Math.max(0, Math.round(incU.rotationIndex))
          : 0,
      month: typeof incU.month === 'string' && incU.month ? incU.month : defU.month,
      charsUsed:
        typeof incU.charsUsed === 'number' && Number.isFinite(incU.charsUsed) && incU.charsUsed >= 0
          ? Math.round(incU.charsUsed)
          : 0,
      quotaExceeded: Boolean(incU.quotaExceeded),
    };
  });

  return normalizeUsageForCurrentPeriod(
    {
      id: 'default',
      providers,
      usage,
      updatedAt:
        typeof raw.updatedAt === 'string' && raw.updatedAt
          ? raw.updatedAt
          : defaults.updatedAt,
    },
    now
  );
}

export function mapSupabaseRowToAiSettings(
  row: Partial<SupabaseAiSettingsRow> | null | undefined,
  now: Date = new Date()
): AiSettingsState {
  if (!row || typeof row !== 'object') {
    return createDefaultAiSettings(now);
  }
  const providers = parseJsonSafe<Partial<Record<AiProviderId, Partial<AiProviderConfig>>>>(
    row.providers,
    {}
  );
  const usage = parseJsonSafe<Partial<Record<AiProviderId, Partial<AiProviderUsageStats>>>>(
    row.usage_stats,
    {}
  );
  return normalizeAiSettingsState(
    {
      id: typeof row.id === 'string' && row.id ? row.id : 'default',
      providers: providers as Record<AiProviderId, AiProviderConfig>,
      usage: usage as Record<AiProviderId, AiProviderUsageStats>,
      updatedAt:
        typeof row.updated_at === 'string' && row.updated_at
          ? row.updated_at
          : now.toISOString(),
    },
    now
  );
}

export function resolveClientViteGeminiKey(): string {
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
    processEnv?.VITE_GEMINI_API_KEY ||
    ''
  ).trim();
}

export function getProviderQuotaStatus(
  providerId: AiProviderId,
  settings: AiSettingsState,
  options?: { hasServerGeminiKey?: boolean; now?: Date }
): AiProviderQuotaStatus {
  const normalized = normalizeUsageForCurrentPeriod(settings, options?.now);
  const cfg = normalized.providers[providerId];
  const usage = normalized.usage[providerId];
  const keys = parseMultiLineApiKeys(cfg.apiKey);
  const viteGeminiKey = providerId === 'gemini' ? resolveClientViteGeminiKey() : '';
  const hasEnvFallback =
    providerId === 'gemini' &&
    Boolean(options?.hasServerGeminiKey || viteGeminiKey);
  const isConfigured = keys.length > 0 || hasEnvFallback;

  if (providerId === 'deepl') {
    const limit = cfg.monthlyCharLimit || DEEPL_MONTHLY_CHAR_LIMIT;
    const used = Math.max(0, usage.charsUsed || 0);
    const remaining = Math.max(0, limit - used);
    const percentRemaining = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

    let level: AiQuotaLevel = 'healthy';
    let warningText: string | null = null;
    if (usage.quotaExceeded || remaining <= 0) {
      level = 'exhausted';
      warningText = 'Đã hết hạn mức miễn phí tháng này — tự động chuyển sang Groq/Gemini/Mistral';
    } else if (remaining < DEEPL_LOW_CHAR_THRESHOLD) {
      level = 'warning';
      warningText = 'Sắp hết dung lượng miễn phí tháng này (< 50.000 ký tự)';
    }

    const statusBadge = !cfg.enabled
      ? 'Đang tắt'
      : !isConfigured
        ? 'Chưa nhập Key'
        : level === 'exhausted'
          ? 'Hết hạn mức'
          : level === 'warning'
            ? 'Sắp hết (< 50K)'
            : 'Sẵn sàng';

    return {
      providerId,
      isConfigured,
      isEnabled: cfg.enabled,
      hasEnvFallback: false,
      keyCount: keys.length,
      isMonthly: true,
      used,
      limit,
      remaining,
      percentRemaining,
      level,
      summaryText: `Còn lại ${formatNumberVN(remaining)} / ${formatNumberVN(limit)} ký tự tháng này`,
      warningText,
      statusBadge,
    };
  }

  const meta = AI_PROVIDERS_META[providerId];
  const baseLimit = cfg.dailyLimit || meta.defaultDailyLimit || 100;
  // For Gemini with multiple user keys, each free key contributes a daily quota pool
  const effectiveMultiplier =
    providerId === 'gemini' && keys.length > 1 ? keys.length : 1;
  const limit = baseLimit * effectiveMultiplier;
  const used = Math.max(0, usage.requestsUsed || 0);
  const remaining = usage.rateLimited ? 0 : Math.max(0, limit - used);
  const percentRemaining = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

  let level: AiQuotaLevel = 'healthy';
  let warningText: string | null = null;
  if (usage.rateLimited || remaining <= 0) {
    level = 'exhausted';
    warningText = usage.rateLimited
      ? 'Đã chạm giới hạn 429 hôm nay — tự động dùng AI dự phòng'
      : 'Đã hết lượt miễn phí hôm nay';
  } else if (percentRemaining <= DAILY_WARNING_PERCENT_THRESHOLD) {
    level = 'warning';
    warningText = 'Sắp hết dung lượng miễn phí hôm nay';
  }

  const statusBadge = !cfg.enabled
    ? 'Đang tắt'
    : !isConfigured
      ? 'Chưa nhập Key'
      : level === 'exhausted'
        ? usage.rateLimited
          ? 'Lỗi 429 / Hết lượt'
          : 'Hết lượt'
        : level === 'warning'
          ? 'Sắp hết (≤ 30%)'
          : 'Sẵn sàng';

  return {
    providerId,
    isConfigured,
    isEnabled: cfg.enabled,
    hasEnvFallback,
    keyCount: keys.length,
    isMonthly: false,
    used,
    limit,
    remaining,
    percentRemaining,
    level,
    summaryText: `Còn lại ${formatNumberVN(remaining)} / ${formatNumberVN(limit)} lượt hôm nay`,
    warningText,
    statusBadge,
  };
}

export function buildVisionRoutingAttempts(
  settings: AiSettingsState,
  options?: { hasServerGeminiKey?: boolean; now?: Date }
): AiRoutingAttempt[] {
  const normalized = normalizeUsageForCurrentPeriod(settings, options?.now);
  const attempts: AiRoutingAttempt[] = [];
  const viteGeminiKey = resolveClientViteGeminiKey();

  for (const pid of VISION_PROVIDER_PRIORITY) {
    const cfg = normalized.providers[pid];
    const usage = normalized.usage[pid];
    if (!cfg || !cfg.enabled) continue;

    const status = getProviderQuotaStatus(pid, normalized, options);
    if (status.level === 'exhausted') continue;

    let keys = rotateKeysByIndex(
      parseMultiLineApiKeys(cfg.apiKey),
      usage.rotationIndex || 0
    );
    if (pid === 'gemini' && viteGeminiKey && !keys.includes(viteGeminiKey)) {
      keys = [...keys, viteGeminiKey];
    }

    const includeServerEnvKey = pid === 'gemini' && Boolean(options?.hasServerGeminiKey);
    if (keys.length === 0 && !includeServerEnvKey) continue;

    attempts.push({
      provider: pid,
      apiKeys: keys,
      model:
        cfg.visionModel ||
        AI_PROVIDERS_META[pid].defaultVisionModel ||
        cfg.textModel,
      ...(includeServerEnvKey ? { includeServerEnvKey: true } : {}),
    });
  }

  return attempts;
}

export function buildTranslationRoutingAttempts(
  settings: AiSettingsState,
  options?: { hasServerGeminiKey?: boolean; now?: Date }
): AiRoutingAttempt[] {
  const normalized = normalizeUsageForCurrentPeriod(settings, options?.now);
  const attempts: AiRoutingAttempt[] = [];
  const viteGeminiKey = resolveClientViteGeminiKey();

  for (const pid of TRANSLATION_PROVIDER_PRIORITY) {
    const cfg = normalized.providers[pid];
    const usage = normalized.usage[pid];
    if (!cfg || !cfg.enabled) continue;

    const status = getProviderQuotaStatus(pid, normalized, options);
    if (status.level === 'exhausted') continue;

    let keys = rotateKeysByIndex(
      parseMultiLineApiKeys(cfg.apiKey),
      usage.rotationIndex || 0
    );
    if (pid === 'gemini' && viteGeminiKey && !keys.includes(viteGeminiKey)) {
      keys = [...keys, viteGeminiKey];
    }

    const includeServerEnvKey = pid === 'gemini' && Boolean(options?.hasServerGeminiKey);
    if (keys.length === 0 && !includeServerEnvKey) continue;

    attempts.push({
      provider: pid,
      apiKeys: keys,
      model: cfg.textModel || AI_PROVIDERS_META[pid].defaultTextModel,
      ...(includeServerEnvKey ? { includeServerEnvKey: true } : {}),
    });
  }

  return attempts;
}

export function applyAiCallOutcomeToSettings(
  settings: AiSettingsState,
  outcome: {
    providerUsed?: AiProviderId;
    charsSentToDeepL?: number;
    attemptLogs?: AiAttemptLog[];
    now?: Date;
  }
): AiSettingsState {
  const now = outcome.now || new Date();
  const normalized = normalizeUsageForCurrentPeriod(settings, now);
  const nextUsage = { ...normalized.usage };

  for (const log of outcome.attemptLogs || []) {
    const prev = nextUsage[log.provider];
    if (!prev) continue;
    const isRateLimit = Boolean(log.rateLimited || log.status === 429);
    const isQuotaEx = Boolean(log.quotaExceeded || log.status === 456);
    nextUsage[log.provider] = {
      ...prev,
      rateLimited: isRateLimit ? true : prev.rateLimited,
      quotaExceeded: log.provider === 'deepl' && (isQuotaEx || isRateLimit) ? true : prev.quotaExceeded,
      lastError: log.message || prev.lastError,
      lastErrorCode: log.status ?? prev.lastErrorCode,
      rotationIndex:
        log.provider === 'gemini' ? (prev.rotationIndex || 0) + 1 : prev.rotationIndex,
    };
  }

  if (outcome.providerUsed) {
    const pid = outcome.providerUsed;
    const prev = nextUsage[pid];
    if (prev) {
      const keyCount = parseMultiLineApiKeys(normalized.providers[pid]?.apiKey).length;
      nextUsage[pid] = {
        ...prev,
        requestsUsed: (prev.requestsUsed || 0) + 1,
        charsUsed:
          pid === 'deepl'
            ? (prev.charsUsed || 0) + Math.max(0, outcome.charsSentToDeepL || 0)
            : prev.charsUsed,
        rotationIndex:
          pid === 'gemini' && keyCount > 1
            ? ((prev.rotationIndex || 0) + 1) % keyCount
            : prev.rotationIndex,
      };
    }
  }

  return {
    ...normalized,
    usage: nextUsage,
    updatedAt: now.toISOString(),
  };
}

function isMissingAiSettingsTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('42P01') ||
    msg.includes('PGRST205') ||
    msg.includes('does not exist') ||
    msg.includes('Could not find the table') ||
    msg.includes('42501')
  );
}

export function readLocalAiSettings(now: Date = new Date()): AiSettingsState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultAiSettings(now);
  }
  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultAiSettings(now);
    return normalizeAiSettingsState(JSON.parse(raw) as Partial<AiSettingsState>, now);
  } catch {
    return createDefaultAiSettings(now);
  }
}

export function writeLocalAiSettings(settings: AiSettingsState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
  try {
    window.dispatchEvent(
      new CustomEvent(AI_SETTINGS_UPDATED_EVENT, { detail: settings })
    );
  } catch {
    // Ignore event dispatch errors
  }
}

let cachedServerGeminiStatus: boolean | null = null;
let serverStatusPromise: Promise<boolean> | null = null;

export async function fetchServerAiStatus(forceRefresh = false): Promise<boolean> {
  if (cachedServerGeminiStatus !== null && !forceRefresh) {
    return cachedServerGeminiStatus;
  }
  if (typeof window === 'undefined') {
    const envKey =
      typeof process !== 'undefined'
        ? (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim()
        : '';
    return Boolean(envKey);
  }
  if (serverStatusPromise && !forceRefresh) {
    return serverStatusPromise;
  }
  serverStatusPromise = fetch('/api/ai/status')
    .then(async (res) => {
      if (!res.ok) return false;
      const json = (await res.json()) as { hasServerGeminiKey?: boolean };
      const val = Boolean(json.hasServerGeminiKey);
      cachedServerGeminiStatus = val;
      return val;
    })
    .catch(() => false)
    .finally(() => {
      serverStatusPromise = null;
    });
  return serverStatusPromise;
}

export async function fetchAiSettings(): Promise<{
  settings: AiSettingsState;
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  try {
    const rows = await overtimeSupabase.request<SupabaseAiSettingsRow[]>(
      'ai_settings?id=eq.default&select=*&limit=1'
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const mapped = mapSupabaseRowToAiSettings(rows[0]);
      writeLocalAiSettings(mapped);
      return {
        settings: mapped,
        source: 'supabase',
        schemaNeedsMigration: false,
      };
    }

    const fallbackLocal = readLocalAiSettings();
    return {
      settings: fallbackLocal,
      source: 'supabase',
      schemaNeedsMigration: false,
    };
  } catch (err) {
    if (isMissingAiSettingsTableError(err)) {
      return {
        settings: readLocalAiSettings(),
        source: 'local',
        schemaNeedsMigration: true,
      };
    }
    return {
      settings: readLocalAiSettings(),
      source: 'local',
      schemaNeedsMigration: false,
    };
  }
}

export async function saveAiSettings(
  nextSettings: AiSettingsState
): Promise<{
  settings: AiSettingsState;
  source: 'supabase' | 'local';
  schemaNeedsMigration: boolean;
}> {
  const now = new Date();
  const normalized = normalizeAiSettingsState(
    { ...nextSettings, updatedAt: now.toISOString() },
    now
  );
  writeLocalAiSettings(normalized);

  try {
    const payload = {
      id: 'default',
      providers: normalized.providers,
      usage_stats: normalized.usage,
      updated_at: normalized.updatedAt,
    };

    const existing = await overtimeSupabase.request<SupabaseAiSettingsRow[]>(
      'ai_settings?id=eq.default&select=id&limit=1'
    );

    if (Array.isArray(existing) && existing.length > 0) {
      await overtimeSupabase.request<SupabaseAiSettingsRow[]>(
        'ai_settings?id=eq.default&select=*',
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            providers: payload.providers,
            usage_stats: payload.usage_stats,
            updated_at: payload.updated_at,
          }),
        }
      );
    } else {
      await overtimeSupabase.request<SupabaseAiSettingsRow[]>(
        'ai_settings?select=*',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        }
      );
    }

    return {
      settings: normalized,
      source: 'supabase',
      schemaNeedsMigration: false,
    };
  } catch (err) {
    if (isMissingAiSettingsTableError(err)) {
      return {
        settings: normalized,
        source: 'local',
        schemaNeedsMigration: true,
      };
    }
    return {
      settings: normalized,
      source: 'local',
      schemaNeedsMigration: false,
    };
  }
}

export async function resetProviderUsageCounters(
  providerId?: AiProviderId
): Promise<AiSettingsState> {
  const { settings } = await fetchAiSettings();
  const now = new Date();
  const today = getLocalTodayDateStr(now);
  const month = getLocalMonthStr(now);
  const nextUsage = { ...settings.usage };

  const targets: AiProviderId[] = providerId
    ? [providerId]
    : (Object.keys(settings.providers) as AiProviderId[]);

  for (const pid of targets) {
    nextUsage[pid] = {
      date: today,
      requestsUsed: 0,
      rateLimited: false,
      lastError: undefined,
      lastErrorCode: undefined,
      rotationIndex: 0,
      month,
      charsUsed: 0,
      quotaExceeded: false,
    };
  }

  const saved = await saveAiSettings({
    ...settings,
    usage: nextUsage,
    updatedAt: now.toISOString(),
  });
  return saved.settings;
}

export function subscribeToAiSettingsRealtime(
  onUpdate: (settings: AiSettingsState) => void
): () => void {
  const client = getOvertimeSupabaseClient();
  const handleWindowEvent = (e: Event) => {
    const custom = e as CustomEvent<AiSettingsState>;
    if (custom.detail) {
      onUpdate(normalizeAiSettingsState(custom.detail));
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(AI_SETTINGS_UPDATED_EVENT, handleWindowEvent);
  }

  if (!client) {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(AI_SETTINGS_UPDATED_EVENT, handleWindowEvent);
      }
    };
  }

  const channel = client
    .channel('realtime:public:ai_settings')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ai_settings',
      },
      (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as Partial<SupabaseAiSettingsRow> | null;
        if (row && (row.id === 'default' || !row.id)) {
          const mapped = mapSupabaseRowToAiSettings(row);
          writeLocalAiSettings(mapped);
          onUpdate(mapped);
        }
      }
    )
    .subscribe();

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(AI_SETTINGS_UPDATED_EVENT, handleWindowEvent);
    }
    void client.removeChannel(channel);
  };
}

const recentToastTimestamps = new Map<string, number>();

export function emitAiNotification(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  dedupeKey?: string
): void {
  if (!message || typeof window === 'undefined') return;
  const key = dedupeKey || message;
  const now = Date.now();
  const last = recentToastTimestamps.get(key) || 0;
  // Avoid spamming identical quota alerts within 60 seconds
  if (now - last < 60_000) return;
  recentToastTimestamps.set(key, now);

  try {
    window.dispatchEvent(
      new CustomEvent(AI_NOTIFICATION_EVENT, {
        detail: { message, level },
      })
    );
  } catch {
    // Ignore event dispatch errors
  }
}

function notifyFallbackAndQuotaThresholds(
  settingsAfter: AiSettingsState,
  primaryRequested: AiProviderId | undefined,
  providerUsed: AiProviderId | undefined,
  attemptLogs: AiAttemptLog[],
  hasServerGeminiKey: boolean
): void {
  if (primaryRequested && providerUsed && primaryRequested !== providerUsed) {
    const fromName = AI_PROVIDERS_META[primaryRequested]?.shortName || primaryRequested;
    const toName = AI_PROVIDERS_META[providerUsed]?.shortName || providerUsed;
    emitAiNotification(
      `AI ${fromName} gặp sự cố hoặc hết lượt — đã tự động chuyển sang ${toName}.`,
      'warning',
      `fallback:${primaryRequested}->${providerUsed}`
    );
  }

  const touched = new Set<AiProviderId>();
  if (providerUsed) touched.add(providerUsed);
  for (const log of attemptLogs) {
    touched.add(log.provider);
  }

  for (const pid of touched) {
    const status = getProviderQuotaStatus(pid, settingsAfter, {
      hasServerGeminiKey,
    });
    const meta = AI_PROVIDERS_META[pid];
    if (status.level === 'warning') {
      emitAiNotification(
        `${meta.shortName}: ${status.warningText || 'Sắp hết dung lượng miễn phí'} (${status.summaryText}).`,
        'warning',
        `quota-warn:${pid}:${status.isMonthly ? settingsAfter.usage[pid].month : settingsAfter.usage[pid].date}`
      );
    } else if (status.level === 'exhausted') {
      emitAiNotification(
        `${meta.shortName}: ${status.warningText || 'Đã hết hạn mức miễn phí'}.`,
        'error',
        `quota-exhausted:${pid}:${status.isMonthly ? settingsAfter.usage[pid].month : settingsAfter.usage[pid].date}`
      );
    }
  }
}

export async function parseOvertimeScheduleImageWithRouting(params: {
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
  const [{ settings }, hasServerGeminiKey] = await Promise.all([
    fetchAiSettings(),
    fetchServerAiStatus(),
  ]);

  let attempts = buildVisionRoutingAttempts(settings, { hasServerGeminiKey });
  if (params.apiKeyOverride && params.apiKeyOverride.trim()) {
    const overrideKey = params.apiKeyOverride.trim();
    const existingGemini = attempts.find((a) => a.provider === 'gemini');
    if (existingGemini) {
      existingGemini.apiKeys = [
        overrideKey,
        ...existingGemini.apiKeys.filter((k) => k !== overrideKey),
      ];
    } else {
      attempts = [
        {
          provider: 'gemini',
          apiKeys: [overrideKey],
          model:
            settings.providers.gemini.visionModel ||
            AI_PROVIDERS_META.gemini.defaultVisionModel ||
            'gemini-4-hydrogen',
        },
        ...attempts,
      ];
    }
  }

  if (attempts.length === 0) {
    throw new Error(
      'Chưa có nhà cung cấp AI đọc ảnh nào khả dụng (hãy nhập API Key Gemini, Mistral, OpenRouter hoặc Groq trong Cài đặt AI).'
    );
  }

  const primaryProvider = attempts[0]?.provider;
  const employeeList = params.employees.slice(0, 400).map((emp) => ({
    id: emp.id,
    fullName: emp.fullName,
    employeeCode: emp.employeeCode,
    department: emp.department,
  }));

  const response = await fetch('/api/ai/vision-parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      employeeList,
      defaultDate: params.defaultDate,
      attempts,
    }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    blocks?: ScannedScheduleBlock[];
    providerUsed?: AiProviderId;
    modelUsed?: string;
    attemptLogs?: AiAttemptLog[];
    error?: string;
  };

  const attemptLogs = Array.isArray(json.attemptLogs) ? json.attemptLogs : [];
  const updatedSettings = applyAiCallOutcomeToSettings(settings, {
    providerUsed: response.ok ? json.providerUsed : undefined,
    attemptLogs,
  });
  await saveAiSettings(updatedSettings);
  notifyFallbackAndQuotaThresholds(
    updatedSettings,
    primaryProvider,
    response.ok ? json.providerUsed : undefined,
    attemptLogs,
    hasServerGeminiKey
  );

  if (!response.ok) {
    throw new Error(
      json.error ||
        `Không thể phân tích ảnh lịch tăng ca (${response.status}).`
    );
  }

  const providerUsed = json.providerUsed || primaryProvider;
  const modelLabel = json.modelUsed || attempts[0].model;
  return {
    blocks: Array.isArray(json.blocks) ? json.blocks : [],
    modelUsed: `${AI_PROVIDERS_META[providerUsed]?.shortName || providerUsed} (${modelLabel})`,
    providerUsed,
  };
}

export async function translateLinesWithAiRouting(
  lines: string[]
): Promise<{
  translations: string[];
  providerUsed: AiProviderId;
  modelUsed: string;
} | null> {
  const cleanLines = lines.map((l) => l.trim()).filter(Boolean);
  if (cleanLines.length === 0) return null;

  const [{ settings }, hasServerGeminiKey] = await Promise.all([
    fetchAiSettings(),
    fetchServerAiStatus(),
  ]);

  const attempts = buildTranslationRoutingAttempts(settings, {
    hasServerGeminiKey,
  });
  if (attempts.length === 0) {
    return null;
  }

  const primaryProvider = attempts[0]?.provider;
  const totalVietnameseChars = cleanLines.reduce((sum, l) => sum + l.length, 0);

  try {
    const response = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lines: cleanLines,
        attempts,
      }),
    });

    const json = (await response.json().catch(() => ({}))) as {
      translations?: string[];
      providerUsed?: AiProviderId;
      modelUsed?: string;
      charsUsed?: number;
      attemptLogs?: AiAttemptLog[];
      error?: string;
    };

    const attemptLogs = Array.isArray(json.attemptLogs) ? json.attemptLogs : [];
    const updatedSettings = applyAiCallOutcomeToSettings(settings, {
      providerUsed: response.ok ? json.providerUsed : undefined,
      charsSentToDeepL:
        json.providerUsed === 'deepl'
          ? json.charsUsed || totalVietnameseChars
          : 0,
      attemptLogs,
    });
    await saveAiSettings(updatedSettings);
    notifyFallbackAndQuotaThresholds(
      updatedSettings,
      primaryProvider,
      response.ok ? json.providerUsed : undefined,
      attemptLogs,
      hasServerGeminiKey
    );

    if (
      !response.ok ||
      !Array.isArray(json.translations) ||
      json.translations.length !== cleanLines.length
    ) {
      return null;
    }

    return {
      translations: json.translations.map((t) => String(t || '').trim()),
      providerUsed: json.providerUsed || primaryProvider,
      modelUsed: json.modelUsed || '',
    };
  } catch {
    return null;
  }
}
