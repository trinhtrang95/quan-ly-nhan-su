import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAiCallOutcomeToSettings,
  buildTranslationRoutingAttempts,
  buildVisionRoutingAttempts,
  createDefaultAiSettings,
  DEEPL_MONTHLY_CHAR_LIMIT,
  getProviderQuotaStatus,
  mapSupabaseRowToAiSettings,
  normalizeUsageForCurrentPeriod,
  parseMultiLineApiKeys,
  rotateKeysByIndex,
} from './aiSettingsService';

describe('aiSettingsService pure routing & quota logic', () => {
  it('parses multi-line Gemini API keys, skipping blanks/comments/duplicates and rotating round-robin', () => {
    const keys = parseMultiLineApiKeys(
      '\n  key-1  \n# comment\nkey-2\nkey-1\n  key-3 \n'
    );
    assert.deepEqual(keys, ['key-1', 'key-2', 'key-3']);
    assert.deepEqual(rotateKeysByIndex(keys, 0), ['key-1', 'key-2', 'key-3']);
    assert.deepEqual(rotateKeysByIndex(keys, 1), ['key-2', 'key-3', 'key-1']);
    assert.deepEqual(rotateKeysByIndex(keys, 2), ['key-3', 'key-1', 'key-2']);
  });

  it('auto-resets daily request counters on new local date and DeepL monthly chars on new month', () => {
    const day1 = new Date(2026, 10, 27, 10, 0, 0);
    const base = createDefaultAiSettings(day1);
    base.usage.gemini.requestsUsed = 1200;
    base.usage.gemini.rateLimited = true;
    base.usage.groq.requestsUsed = 900;
    base.usage.deepl.charsUsed = 480_000;
    base.usage.deepl.quotaExceeded = true;

    // Next day, same month (2026-11-28): daily counters reset, DeepL monthly counter kept
    const day2SameMonth = new Date(2026, 10, 28, 9, 0, 0);
    const normalizedSameMonth = normalizeUsageForCurrentPeriod(base, day2SameMonth);
    assert.equal(normalizedSameMonth.usage.gemini.requestsUsed, 0);
    assert.equal(normalizedSameMonth.usage.gemini.rateLimited, false);
    assert.equal(normalizedSameMonth.usage.groq.requestsUsed, 0);
    assert.equal(normalizedSameMonth.usage.deepl.charsUsed, 480_000);
    assert.equal(normalizedSameMonth.usage.deepl.quotaExceeded, true);

    // Next month (2026-12-01): DeepL monthly chars & quotaExceeded also reset
    const nextMonth = new Date(2026, 11, 1, 8, 0, 0);
    const normalizedNextMonth = normalizeUsageForCurrentPeriod(base, nextMonth);
    assert.equal(normalizedNextMonth.usage.deepl.charsUsed, 0);
    assert.equal(normalizedNextMonth.usage.deepl.quotaExceeded, false);
    assert.equal(normalizedNextMonth.usage.deepl.month, '2026-12');
  });

  it('computes healthy, warning (<=30% daily / <50K DeepL), and exhausted (429/456/0) quota statuses', () => {
    const now = new Date(2026, 10, 28, 12, 0, 0);
    const settings = createDefaultAiSettings(now);
    settings.providers.groq.apiKey = 'gsk_123';
    settings.providers.groq.dailyLimit = 1000;
    settings.usage.groq.requestsUsed = 200; // 80% remaining -> healthy
    let groqStatus = getProviderQuotaStatus('groq', settings, { now });
    assert.equal(groqStatus.level, 'healthy');
    assert.equal(groqStatus.remaining, 800);
    assert.equal(groqStatus.summaryText, 'Còn lại 800 / 1.000 lượt hôm nay');

    settings.usage.groq.requestsUsed = 750; // 25% remaining -> warning
    groqStatus = getProviderQuotaStatus('groq', settings, { now });
    assert.equal(groqStatus.level, 'warning');
    assert.equal(groqStatus.warningText, 'Sắp hết dung lượng miễn phí hôm nay');

    settings.usage.groq.rateLimited = true; // 429 -> exhausted
    groqStatus = getProviderQuotaStatus('groq', settings, { now });
    assert.equal(groqStatus.level, 'exhausted');
    assert.equal(groqStatus.remaining, 0);

    // DeepL monthly char thresholds
    settings.providers.deepl.apiKey = 'deepl-key:fx';
    settings.usage.deepl.charsUsed = 460_000; // 40,000 remaining < 50,000 -> warning
    let deeplStatus = getProviderQuotaStatus('deepl', settings, { now });
    assert.equal(deeplStatus.level, 'warning');
    assert.equal(deeplStatus.remaining, 40_000);
    assert.equal(
      deeplStatus.summaryText,
      `Còn lại 40.000 / ${DEEPL_MONTHLY_CHAR_LIMIT.toLocaleString('en-US').replace(/,/g, '.')} ký tự tháng này`
    );

    settings.usage.deepl.quotaExceeded = true;
    deeplStatus = getProviderQuotaStatus('deepl', settings, { now });
    assert.equal(deeplStatus.level, 'exhausted');
  });

  it('routes vision strictly Gemini -> Mistral -> OpenRouter -> Groq and skips DeepL & exhausted providers', () => {
    const now = new Date(2026, 10, 28, 12, 0, 0);
    const settings = createDefaultAiSettings(now);
    settings.providers.gemini.apiKey = 'gem-1\ngem-2';
    settings.providers.mistral.apiKey = 'mis-1';
    settings.providers.openrouter.apiKey = 'or-1';
    settings.providers.groq.apiKey = 'gsk-1';
    settings.providers.deepl.apiKey = 'deepl-1:fx';

    const attempts = buildVisionRoutingAttempts(settings, { now });
    assert.deepEqual(
      attempts.map((a) => a.provider),
      ['gemini', 'mistral', 'openrouter', 'groq']
    );
    assert.equal(attempts[0].model, 'gemini-4-hydrogen');
    assert.equal(attempts[1].model, 'pixtral-12b-2409');
    assert.equal(attempts[2].model, 'openrouter/free');
    assert.equal(attempts[3].model, 'meta-llama/llama-4-scout-17b-16e-instruct');

    // Mark Gemini rate-limited -> Mistral becomes primary vision provider
    settings.usage.gemini.rateLimited = true;
    const after429 = buildVisionRoutingAttempts(settings, { now });
    assert.deepEqual(
      after429.map((a) => a.provider),
      ['mistral', 'openrouter', 'groq']
    );
  });

  it('routes translation strictly DeepL -> Groq -> Gemini -> Mistral -> OpenRouter and records outcome stats', () => {
    const now = new Date(2026, 10, 28, 12, 0, 0);
    const settings = createDefaultAiSettings(now);
    settings.providers.deepl.apiKey = 'deepl-key:fx';
    settings.providers.groq.apiKey = 'gsk-key';
    settings.providers.gemini.apiKey = 'gem-key-1\ngem-key-2';
    settings.providers.mistral.apiKey = 'mis-key';
    settings.providers.openrouter.apiKey = 'or-key';

    const attempts = buildTranslationRoutingAttempts(settings, { now });
    assert.deepEqual(
      attempts.map((a) => a.provider),
      ['deepl', 'groq', 'gemini', 'mistral', 'openrouter']
    );

    // Simulate DeepL returning 456 quota exceeded and Groq succeeding
    const updated = applyAiCallOutcomeToSettings(settings, {
      providerUsed: 'groq',
      attemptLogs: [
        {
          provider: 'deepl',
          status: 456,
          quotaExceeded: true,
          message: 'Quota exceeded',
        },
      ],
      now,
    });
    assert.equal(updated.usage.deepl.quotaExceeded, true);
    assert.equal(updated.usage.groq.requestsUsed, 1);

    const nextAttempts = buildTranslationRoutingAttempts(updated, { now });
    assert.equal(nextAttempts[0].provider, 'groq');
  });

  it('maps Supabase ai_settings JSON row cleanly', () => {
    const now = new Date(2026, 10, 28, 12, 0, 0);
    const mapped = mapSupabaseRowToAiSettings(
      {
        id: 'default',
        providers: {
          gemini: { enabled: true, apiKey: 'k1\nk2', dailyLimit: 500 },
          deepl: { enabled: true, apiKey: 'dl:fx', monthlyCharLimit: 500000 },
        },
        usage_stats: {
          gemini: { date: '2026-11-28', requestsUsed: 10, rotationIndex: 1 },
          deepl: { month: '2026-11', charsUsed: 1234 },
        },
      },
      now
    );

    assert.equal(mapped.providers.gemini.apiKey, 'k1\nk2');
    assert.equal(mapped.providers.gemini.dailyLimit, 500);
    assert.equal(mapped.usage.gemini.requestsUsed, 10);
    assert.equal(mapped.usage.gemini.rotationIndex, 1);
    assert.equal(mapped.usage.deepl.charsUsed, 1234);
  });
});
