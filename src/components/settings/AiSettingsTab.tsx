import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Languages,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Terminal,
  X,
  Zap,
} from 'lucide-react';
import {
  AI_PROVIDERS_META,
  AiProviderConfig,
  AiProviderId,
  AiSettingsState,
  createDefaultAiSettings,
  fetchAiSettings,
  fetchServerAiStatus,
  getProviderQuotaStatus,
  parseMultiLineApiKeys,
  resetProviderUsageCounters,
  resolveClientViteGeminiKey,
  saveAiSettings,
  subscribeToAiSettingsRealtime,
  SUPABASE_AI_SETTINGS_SQL,
  TRANSLATION_PROVIDER_PRIORITY,
  VISION_PROVIDER_PRIORITY,
} from '../../services/aiSettingsService';
import { formatNumberVN } from '../../utils/errorAndSecurityService';

interface AiSettingsTabProps {
  onShowToast?: (message: string) => void;
}

const PROVIDER_DISPLAY_ORDER: AiProviderId[] = [
  'gemini',
  'groq',
  'mistral',
  'openrouter',
  'deepl',
];

const PROGRESS_WIDTH_CLASSES = [
  'w-0',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-full',
] as const;

export const AiSettingsTab: React.FC<AiSettingsTabProps> = ({ onShowToast }) => {
  const [settings, setSettings] = useState<AiSettingsState>(() =>
    createDefaultAiSettings()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<AiProviderId | 'all' | null>(
    null
  );
  const [storageSource, setStorageSource] = useState<'supabase' | 'local'>(
    'local'
  );
  const [schemaNeedsMigration, setSchemaNeedsMigration] =
    useState<boolean>(false);
  const [hasServerGeminiKey, setHasServerGeminiKey] = useState<boolean>(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const clientViteKeyPresent = useMemo(
    () => Boolean(resolveClientViteGeminiKey()),
    []
  );

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const [fetched, serverStatus] = await Promise.all([
        fetchAiSettings(),
        fetchServerAiStatus(true),
      ]);
      setSettings(fetched.settings);
      setStorageSource(fetched.source);
      setSchemaNeedsMigration(fetched.schemaNeedsMigration);
      setHasServerGeminiKey(serverStatus);
      setHasUnsavedChanges(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
    const unsubscribe = subscribeToAiSettingsRealtime((updated) => {
      setSettings((prev) => {
        // Avoid wiping unsaved key edits if user is typing right now
        if (hasUnsavedChanges) return prev;
        return updated;
      });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateProviderField = <K extends keyof AiProviderConfig>(
    providerId: AiProviderId,
    field: K,
    value: AiProviderConfig[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          [field]: value,
        },
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveAiSettings(settings);
      setSettings(result.settings);
      setStorageSource(result.source);
      setSchemaNeedsMigration(result.schemaNeedsMigration);
      setHasUnsavedChanges(false);
      onShowToast?.(
        result.source === 'supabase'
          ? 'Đã lưu cấu hình AI & hạn mức miễn phí lên Supabase Cloud.'
          : 'Đã lưu cấu hình AI vào máy cục bộ (tạo bảng public.ai_settings để đồng bộ Cloud).'
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể lưu cấu hình AI.';
      onShowToast?.(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetQuota = async (providerId?: AiProviderId) => {
    setIsResetting(providerId || 'all');
    try {
      const updated = await resetProviderUsageCounters(providerId);
      setSettings(updated);
      setHasUnsavedChanges(false);
      onShowToast?.(
        providerId
          ? `Đã đặt lại bộ đếm lượt dùng của ${AI_PROVIDERS_META[providerId].shortName}.`
          : 'Đã đặt lại bộ đếm hạn mức cho tất cả nhà cung cấp AI.'
      );
    } finally {
      setIsResetting(null);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_AI_SETTINGS_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = SUPABASE_AI_SETTINGS_SQL;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    }
  };

  const quotaStatuses = useMemo(() => {
    return PROVIDER_DISPLAY_ORDER.map((pid) =>
      getProviderQuotaStatus(pid, settings, { hasServerGeminiKey })
    );
  }, [settings, hasServerGeminiKey]);

  return (
    <section
      aria-label="Cấu hình AI & Theo dõi hạn mức miễn phí"
      data-testid="ai-settings-tab"
      className="space-y-4"
    >
      {/* Top Action Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#14539E] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Cài đặt AI Miễn phí &amp; Định tuyến Thông minh (Free Tier Routing)
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    storageSource === 'supabase' && !schemaNeedsMigration
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  <Database className="w-3 h-3" />
                  {storageSource === 'supabase' && !schemaNeedsMigration
                    ? 'Đã đồng bộ Supabase'
                    : 'Lưu cục bộ (localStorage)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Ưu tiên tối đa các gói API Miễn Phí (Google Gemini xoay vòng nhiều Key, Groq, Mistral, OpenRouter) và DeepL API Free cho dịch thuật Việt → Hàn, tự động chuyển dự phòng khi gặp lỗi 429/503.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              data-testid="ai-help-btn"
              title="Hướng dẫn sử dụng Cài đặt AI"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-[#14539E] text-xs font-bold transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span>HDSD</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              data-testid="ai-sql-modal-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-[#14539E]" />
              <span>Mã SQL bảng ai_settings</span>
            </button>
            <button
              type="button"
              disabled={isResetting !== null || isLoading}
              onClick={() => handleResetQuota()}
              data-testid="ai-reset-all-quota-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Đặt lại bộ đếm</span>
            </button>
            <button
              type="button"
              disabled={isSaving || isLoading}
              onClick={handleSave}
              data-testid="ai-save-settings-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#14539E] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>
                {isSaving
                  ? 'Đang lưu...'
                  : hasUnsavedChanges
                    ? 'Lưu cấu hình AI *'
                    : 'Lưu cấu hình AI'}
              </span>
            </button>
          </div>
        </div>

        {/* Supabase Migration Notice */}
        {schemaNeedsMigration && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Bảng <code className="font-mono font-bold">public.ai_settings</code> chưa được tạo trên Supabase — cấu hình hiện đang lưu an toàn trên trình duyệt. Hãy chạy mã SQL để đồng bộ giữa các máy.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Xem mã SQL ngay</span>
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          1. QUOTA MONITORING & WARNING CARDS (TOP OF AI SETTINGS)
      ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#0D9488]" />
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
              Theo dõi Dung lượng Miễn phí &amp; Cảnh báo Hạn mức (5 nhà cung cấp)
            </h4>
          </div>
          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={isLoading}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#14539E] cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới trạng thái</span>
          </button>
        </div>

        <div
          data-testid="ai-quota-cards-grid"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3"
        >
          {quotaStatuses.map((status) => {
            const meta = AI_PROVIDERS_META[status.providerId];
            const barColor =
              status.level === 'exhausted'
                ? 'bg-red-500'
                : status.level === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500';
            const cardBorder =
              status.level === 'exhausted'
                ? 'border-red-300 bg-red-50/40'
                : status.level === 'warning'
                  ? 'border-amber-300 bg-amber-50/40'
                  : 'border-slate-200 bg-slate-50/60';
            const badgeStyle = !status.isEnabled
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : !status.isConfigured
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : status.level === 'exhausted'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : status.level === 'warning'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200';

            const fillWidthPercent = Math.max(
              0,
              Math.min(100, status.percentRemaining)
            );
            const fillWidthClass =
              PROGRESS_WIDTH_CLASSES[
                Math.max(0, Math.min(20, Math.round(fillWidthPercent / 5)))
              ];

            return (
              <div
                key={status.providerId}
                data-testid={`ai-quota-card-${status.providerId}`}
                className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 ${cardBorder}`}
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 leading-snug">
                        {meta.name}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500">
                        {meta.supportsVision ? 'OCR Ảnh + Dịch' : 'Chuyên dịch VI → KO'}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${badgeStyle}`}
                    >
                      {status.statusBadge}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-800 pt-1">
                    {status.summaryText}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200/90 overflow-hidden">
                    {fillWidthPercent > 0 && (
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor} ${fillWidthClass}`}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {status.warningText && status.isConfigured && status.isEnabled && (
                    <div
                      className={`text-[11px] font-bold flex items-start gap-1 ${
                        status.level === 'exhausted'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{status.warningText}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/70">
                    <span>
                      {status.providerId === 'gemini'
                        ? `${status.keyCount} Key nhập${status.hasEnvFallback ? ' + Env' : ''}`
                        : status.isConfigured
                          ? 'Đã nhập API Key'
                          : 'Chưa có API Key'}
                    </span>
                    <button
                      type="button"
                      disabled={isResetting !== null}
                      onClick={() => handleResetQuota(status.providerId)}
                      className="font-semibold text-[#14539E] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Đặt lại
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Smart Routing Pipeline Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs">
            <Camera className="w-4 h-4 text-[#14539E] shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800">
                Luồng Quét ảnh Zalo AI (OCR Vision — tự động bỏ qua DeepL):
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 mt-0.5">
                {VISION_PROVIDER_PRIORITY.map((pid, idx) => (
                  <React.Fragment key={pid}>
                    {idx > 0 && <ArrowRight className="w-3 h-3 text-slate-400" />}
                    <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                      {AI_PROVIDERS_META[pid].shortName}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs">
            <Languages className="w-4 h-4 text-[#0D9488] shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800">
                Luồng Dịch Lý do tăng ca (Việt → Hàn — Từ điển nội bộ trước):
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 mt-0.5">
                <span className="px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 font-bold text-teal-800">
                  Từ điển nội bộ
                </span>
                {TRANSLATION_PROVIDER_PRIORITY.map((pid) => (
                  <React.Fragment key={pid}>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                      {AI_PROVIDERS_META[pid].shortName}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. 5 PROVIDER CONFIGURATION PANELS
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PROVIDER_DISPLAY_ORDER.map((pid) => {
          const meta = AI_PROVIDERS_META[pid];
          const cfg = settings.providers[pid];
          const usage = settings.usage[pid];
          const isKeyRevealed = Boolean(revealedKeys[pid]);
          const geminiKeys =
            pid === 'gemini' ? parseMultiLineApiKeys(cfg.apiKey) : [];

          return (
            <div
              key={pid}
              data-testid={`ai-provider-card-${pid}`}
              className={`bg-white rounded-xl border shadow-xs p-4 sm:p-5 flex flex-col justify-between gap-3.5 ${
                pid === 'deepl' ? 'lg:col-span-2 border-teal-200/90' : 'border-slate-200/80'
              }`}
            >
              {/* Provider Header & Enable Toggle */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      pid === 'deepl'
                        ? 'bg-teal-50 text-[#0D9488] border border-teal-200'
                        : 'bg-blue-50 text-[#14539E] border border-blue-200'
                    }`}
                  >
                    {pid === 'deepl' ? (
                      <Languages className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-extrabold text-slate-900">
                        {meta.name}
                      </h5>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          meta.supportsVision
                            ? 'bg-blue-50 text-[#14539E] border-blue-200'
                            : 'bg-teal-50 text-[#0F766E] border-teal-200'
                        }`}
                      >
                        {meta.roleLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {meta.freeTierSummary}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                      {meta.endpointLabel}
                    </p>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e) =>
                      updateProviderField(pid, 'enabled', e.target.checked)
                    }
                    data-testid={`ai-toggle-${pid}`}
                    className="w-3.5 h-3.5 rounded accent-[#14539E] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    {cfg.enabled ? 'Đang bật' : 'Đang tắt'}
                  </span>
                </label>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor={`ai-key-${pid}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {pid === 'gemini'
                        ? 'Danh sách API Key Gemini (mỗi dòng 1 Key để tự động xoay vòng)'
                        : `API Key ${meta.shortName}`}
                    </span>
                  </label>

                  {pid === 'gemini' && (hasServerGeminiKey || clientViteKeyPresent) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" />
                      Đã có Key môi trường ({hasServerGeminiKey ? 'GEMINI_API_KEY' : 'VITE_GEMINI_API_KEY'})
                    </span>
                  )}
                </div>

                {pid === 'gemini' ? (
                  <div className="space-y-1">
                    <textarea
                      id={`ai-key-${pid}`}
                      rows={3}
                      value={cfg.apiKey}
                      onChange={(e) =>
                        updateProviderField('gemini', 'apiKey', e.target.value)
                      }
                      data-testid="ai-key-input-gemini"
                      placeholder={'AIzaSy... (Key 1)\nAIzaSy... (Key 2 - dự phòng xoay vòng khi Key 1 chạm 429)'}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E] resize-y"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Đang nhận diện{' '}
                        <strong className="text-slate-800">{geminiKeys.length}</strong>{' '}
                        API Key nhập tay{geminiKeys.length > 1 ? ' (tự động xoay vòng sau mỗi lượt hoặc khi lỗi 429)' : ''}.
                      </span>
                      {usage.lastErrorCode && (
                        <span className="text-red-600 font-semibold">
                          Lỗi gần nhất: HTTP {usage.lastErrorCode}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center">
                    <input
                      id={`ai-key-${pid}`}
                      type={isKeyRevealed ? 'text' : 'password'}
                      value={cfg.apiKey}
                      onChange={(e) =>
                        updateProviderField(pid, 'apiKey', e.target.value)
                      }
                      data-testid={`ai-key-input-${pid}`}
                      placeholder={
                        pid === 'deepl'
                          ? 'Nhập DeepL API Free Auth Key (thường kết thúc bằng :fx)...'
                          : `Nhập API Key ${meta.shortName}...`
                      }
                      className="w-full pl-3 pr-9 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#14539E]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedKeys((prev) => ({
                          ...prev,
                          [pid]: !prev[pid],
                        }))
                      }
                      aria-label={isKeyRevealed ? 'Ẩn API Key' : 'Hiện API Key'}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {isKeyRevealed ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Model & Quota Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {meta.supportsVision && (
                  <div>
                    <label
                      htmlFor={`ai-vision-model-${pid}`}
                      className="block text-[11px] font-bold text-slate-600 mb-1"
                    >
                      Model đọc ảnh (OCR)
                    </label>
                    <input
                      id={`ai-vision-model-${pid}`}
                      type="text"
                      value={cfg.visionModel || ''}
                      onChange={(e) =>
                        updateProviderField(pid, 'visionModel', e.target.value)
                      }
                      placeholder={meta.defaultVisionModel}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                    />
                    {meta.modelPresets?.vision && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {meta.modelPresets.vision.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              updateProviderField(pid, 'visionModel', preset)
                            }
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                              cfg.visionModel === preset
                                ? 'bg-blue-50 text-[#14539E] border-blue-300 font-bold'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label
                    htmlFor={`ai-text-model-${pid}`}
                    className="block text-[11px] font-bold text-slate-600 mb-1"
                  >
                    {pid === 'deepl' ? 'Gói dịch vụ (Endpoint)' : 'Model dịch thuật (Text)'}
                  </label>
                  {pid === 'deepl' ? (
                    <input
                      id={`ai-text-model-${pid}`}
                      type="text"
                      readOnly
                      value="api-free.deepl.com/v2/translate (VI → KO)"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-100 text-slate-600"
                    />
                  ) : (
                    <>
                      <input
                        id={`ai-text-model-${pid}`}
                        type="text"
                        value={cfg.textModel}
                        onChange={(e) =>
                          updateProviderField(pid, 'textModel', e.target.value)
                        }
                        placeholder={meta.defaultTextModel}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                      />
                      {meta.modelPresets?.text && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {meta.modelPresets.text.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                updateProviderField(pid, 'textModel', preset)
                              }
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                                cfg.textModel === preset
                                  ? 'bg-blue-50 text-[#14539E] border-blue-300 font-bold'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`ai-limit-${pid}`}
                    className="block text-[11px] font-bold text-slate-600 mb-1"
                  >
                    {pid === 'deepl'
                      ? 'Hạn mức ký tự / tháng'
                      : pid === 'gemini'
                        ? 'Hạn mức lượt / ngày / Key'
                        : 'Hạn mức lượt / ngày'}
                  </label>
                  <input
                    id={`ai-limit-${pid}`}
                    type="number"
                    min={1}
                    value={
                      pid === 'deepl'
                        ? cfg.monthlyCharLimit || 500000
                        : cfg.dailyLimit || meta.defaultDailyLimit || 100
                    }
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value) || 1);
                      if (pid === 'deepl') {
                        updateProviderField('deepl', 'monthlyCharLimit', val);
                      } else {
                        updateProviderField(pid, 'dailyLimit', val);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#14539E]"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">
                    {pid === 'deepl'
                      ? `Đã dùng: ${formatNumberVN(usage.charsUsed)} ký tự (${usage.month})`
                      : `Đã dùng: ${formatNumberVN(usage.requestsUsed)} lượt (${usage.date})`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Save Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          {hasUnsavedChanges ? (
            <span className="font-bold text-amber-700">
              Bạn có thay đổi chưa lưu — bấm &quot;Lưu cấu hình AI&quot; để áp dụng ngay cho luồng Quét ảnh Zalo &amp; Dịch tự động.
            </span>
          ) : (
            <span>
              Cập nhật lần cuối:{' '}
              <strong className="font-mono text-slate-800">
                {settings.updatedAt
                  ? new Date(settings.updatedAt).toLocaleString('vi-VN')
                  : '—'}
              </strong>
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={isSaving || isLoading}
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>Lưu cấu hình AI</span>
        </button>
      </div>

      {/* =====================================================================
          SQL MODAL FOR public.ai_settings
      ===================================================================== */}
      {isSqlModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mã SQL tạo bảng ai_settings trên Supabase"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Terminal className="w-5 h-5 text-[#14539E] shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800 truncate">
                    Mã SQL tạo bảng Cấu hình &amp; Hạn mức AI (public.ai_settings)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chạy đoạn SQL này trong Supabase SQL Editor để đồng bộ cấu hình &amp; bộ đếm hạn mức AI cho mọi máy
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 min-h-0">
              <pre className="p-4 rounded-xl bg-slate-900 text-teal-300 font-mono text-xs overflow-x-auto leading-relaxed select-all border border-slate-800">
                <code>{SUPABASE_AI_SETTINGS_SQL}</code>
              </pre>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold cursor-pointer"
              >
                {sqlCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép mã SQL</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {/* =====================================================================
          HDSD MODAL (HƯỚNG DẪN SỬ DỤNG CÀI ĐẶT AI)
      ===================================================================== */}
      {isHelpModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hướng dẫn sử dụng Cài đặt AI"
          onClick={() => setIsHelpModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#14539E] shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 truncate">
                    Hướng dẫn sử dụng (HDSD) — Cài đặt AI &amp; Hạn mức Miễn phí
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cách thiết lập API Key miễn phí, cơ chế xoay vòng dự phòng và đồng bộ Supabase
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng hướng dẫn sử dụng"
                onClick={() => setIsHelpModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 min-h-0 text-xs text-slate-700 leading-relaxed">
              {/* Bước 1 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#14539E] text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>Nhập API Key cho các gói Miễn Phí (chỉ cần nhập nhà cung cấp bạn có)</span>
                </div>
                <ul className="list-disc pl-6 space-y-1 text-slate-600">
                  <li>
                    <strong className="text-slate-800">Google Gemini (Đọc ảnh + Dịch):</strong> Có thể dán <strong>nhiều API Key trên nhiều dòng</strong> (mỗi dòng 1 key). Hệ thống tự động xoay vòng từng key và chuyển key khác nếu chạm giới hạn 429.
                  </li>
                  <li>
                    <strong className="text-slate-800">DeepL API Free (Chuyên dịch Việt → Hàn):</strong> Miễn phí <strong>500.000 ký tự/tháng</strong>. Nhập Auth Key gói Free (thường kết thúc bằng <code className="font-mono bg-white px-1 rounded border border-slate-200">:fx</code>).
                  </li>
                  <li>
                    <strong className="text-slate-800">Groq / Mistral AI / OpenRouter:</strong> Dùng làm nguồn dịch siêu tốc và đọc ảnh dự phòng (Groq 1.000 lượt/ngày, OpenRouter 50 lượt/ngày gói <code className="font-mono bg-white px-1 rounded border border-slate-200">:free</code>, Mistral <code className="font-mono bg-white px-1 rounded border border-slate-200">pixtral-12b-2409</code>).
                  </li>
                  <li>
                    Sau khi nhập xong, bấm <strong className="text-[#14539E]">Lưu cấu hình AI</strong> để áp dụng ngay.
                  </li>
                </ul>
              </div>

              {/* Bước 2 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0D9488] text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>Cơ chế Định tuyến Thông minh &amp; Tự động Dự phòng</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-0.5">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <div className="font-bold text-[#14539E] mb-1">
                      Quét ảnh Zalo AI (OCR Vision)
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Tự động bỏ qua DeepL (chỉ dịch chữ) và thử lần lượt:{' '}
                      <strong>Gemini → Mistral → OpenRouter → Groq</strong>. Gặp lỗi 429/503 sẽ lập tức nhảy sang AI kế tiếp.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <div className="font-bold text-[#0F766E] mb-1">
                      Dịch Lý do tăng ca (Việt → Hàn)
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Kiểm tra <strong>Từ điển nội bộ</strong> trước (0 tốn lượt), sau đó gọi{' '}
                      <strong>DeepL Free → Groq → Gemini → Mistral → OpenRouter</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bước 3 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>Theo dõi Dung lượng &amp; Cảnh báo Sắp hết hạn mức</span>
                </div>
                <ul className="list-disc pl-6 space-y-1 text-slate-600">
                  <li>
                    <span className="font-bold text-emerald-700">Thanh xanh lá:</span> Dung lượng miễn phí còn dồi dào (&gt; 30% lượt ngày hoặc DeepL ≥ 50.000 ký tự).
                  </li>
                  <li>
                    <span className="font-bold text-amber-700">Thanh vàng + Cảnh báo:</span> Sắp hết dung lượng (≤ 30% lượt ngày hoặc DeepL &lt; 50.000 ký tự tháng này).
                  </li>
                  <li>
                    <span className="font-bold text-red-700">Thanh đỏ:</span> Đã hết lượt hoặc vừa gặp lỗi 429/456 — hệ thống tự bỏ qua nhà cung cấp này cho đến khi sang ngày mới (hoặc tháng mới với DeepL), hoặc bấm <strong>Đặt lại</strong> nếu bạn vừa đổi key mới.
                  </li>
                </ul>
              </div>

              {/* Bước 4 */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-extrabold text-slate-900">
                    4. Đồng bộ cấu hình AI lên Supabase giữa nhiều máy
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Chạy 1 lần đoạn mã tạo bảng <code className="font-mono font-bold">public.ai_settings</code> trong Supabase SQL Editor để lưu chung API Key &amp; bộ đếm hạn mức.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsHelpModalOpen(false);
                    setIsSqlModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-blue-300 hover:bg-blue-50 text-[#14539E] text-xs font-bold shrink-0 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Mở mã SQL bảng ai_settings</span>
                </button>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#14539E] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
