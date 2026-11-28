import test from 'node:test';
import assert from 'node:assert/strict';
import { Employee } from '../types/hr';
import { parseOvertimeScheduleImage } from './overtimeImageService';

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    employeeCode: 'TS001',
    fullName: 'Nguyễn Văn An',
    dob: '1995-01-01',
    gender: 'Nam',
    cccd: '001095000001',
    phone: '0901000001',
    address: 'Hà Nội',
    department: 'AUTO 1',
    position: 'Kỹ thuật viên',
    joinDate: '2022-01-01',
    standardAnnualLeave: 12,
    status: 'Đang làm việc',
    avatarUrl: '',
  },
];

test('parseOvertimeScheduleImage throws clear error when no vision provider key is configured', async () => {
  const originalFetch = globalThis.fetch;
  let visionApiCalled = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/ai/vision-parse')) {
      visionApiCalled = true;
    }
    throw new Error('Should not call vision API without any provider key');
  }) as typeof fetch;

  const prevViteKey = process.env.VITE_GEMINI_API_KEY;
  const prevGeminiKey = process.env.GEMINI_API_KEY;
  delete process.env.VITE_GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    await assert.rejects(
      () =>
        parseOvertimeScheduleImage({
          imageBase64: 'ZmFrZQ==',
          mimeType: 'image/png',
          employees: MOCK_EMPLOYEES,
          defaultDate: '2026-11-28',
        }),
      /Chưa có nhà cung cấp AI đọc ảnh nào khả dụng/
    );
    assert.equal(visionApiCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevViteKey !== undefined) process.env.VITE_GEMINI_API_KEY = prevViteKey;
    if (prevGeminiKey !== undefined) process.env.GEMINI_API_KEY = prevGeminiKey;
  }
});

test('parseOvertimeScheduleImage routes via /api/ai/vision-parse and returns provider fallback metadata', async () => {
  const originalFetch = globalThis.fetch;
  const calledUrls: string[] = [];
  let capturedPayload: {
    attempts?: Array<{ provider: string; apiKeys: string[] }>;
  } = {};

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calledUrls.push(url);

    if (url.includes('/api/ai/vision-parse')) {
      capturedPayload = JSON.parse(String(init?.body || '{}')) as {
        attempts?: Array<{ provider: string; apiKeys: string[] }>;
      };
      return new Response(
        JSON.stringify({
          providerUsed: 'mistral',
          modelUsed: 'pixtral-12b-2409',
          attemptLogs: [
            {
              provider: 'gemini',
              status: 429,
              rateLimited: true,
              message: 'Resource exhausted',
            },
          ],
          blocks: [
            {
              overtimeDate: '2026-11-28',
              reasonVi: '- Kiểm tra line 1\n- Vệ sinh máy',
              reasonKr: '- 1라인 점검\n- 설비 청소',
              startTime: '16:10',
              endTime: '18:10',
              matchedParticipants: [
                {
                  employeeId: 'emp-1',
                  rawName: 'Nguyễn Văn An',
                  startTime: '16:10',
                  endTime: '18:10',
                },
              ],
              unmatchedNames: [],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'unexpected url' }), { status: 404 });
  }) as typeof fetch;

  try {
    const result = await parseOvertimeScheduleImage({
      imageBase64: 'data:image/png;base64,ZmFrZQ==',
      mimeType: 'image/png',
      employees: MOCK_EMPLOYEES,
      defaultDate: '2026-11-28',
      apiKeyOverride: 'test-key-123',
    });

    assert.ok(calledUrls.some((u) => u.includes('/api/ai/vision-parse')));
    const attempts = capturedPayload.attempts || [];
    assert.ok(attempts.length > 0);
    assert.equal(attempts[0].provider, 'gemini');
    assert.equal(attempts[0].apiKeys[0], 'test-key-123');
    assert.equal(result.providerUsed, 'mistral');
    assert.equal(result.modelUsed, 'Mistral (pixtral-12b-2409)');
    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0].reasonVi, '- Kiểm tra line 1\n- Vệ sinh máy');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
