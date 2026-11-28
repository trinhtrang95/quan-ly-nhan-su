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

test('parseOvertimeScheduleImage throws clear error when VITE_GEMINI_API_KEY is missing and never calls /api/', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error('Should not call fetch when API key is missing');
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
      /Chưa cấu hình VITE_GEMINI_API_KEY trên môi trường/
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevViteKey !== undefined) process.env.VITE_GEMINI_API_KEY = prevViteKey;
    if (prevGeminiKey !== undefined) process.env.GEMINI_API_KEY = prevGeminiKey;
  }
});

test('parseOvertimeScheduleImage calls Gemini v1beta directly and falls back on 404 without calling /api/', async () => {
  const originalFetch = globalThis.fetch;
  const calledUrls: string[] = [];
  let capturedBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calledUrls.push(url);
    assert.equal(url.includes('/api/overtime/parse-schedule-image'), false);

    if (url.includes('/models/gemini-2.5-flash:')) {
      return new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 });
    }

    capturedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
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
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const result = await parseOvertimeScheduleImage({
      imageBase64: 'data:image/png;base64,ZmFrZQ==',
      mimeType: 'image/png',
      employees: MOCK_EMPLOYEES,
      defaultDate: '2026-11-28',
      apiKeyOverride: 'test-key-123',
    });

    assert.equal(calledUrls.length, 2);
    assert.match(
      calledUrls[0],
      /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent\?key=test-key-123$/
    );
    assert.match(
      calledUrls[1],
      /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-4-hydrogen:generateContent\?key=test-key-123$/
    );
    assert.ok(capturedBody);
    assert.equal(result.modelUsed, 'gemini-4-hydrogen');
    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0].reasonVi, '- Kiểm tra line 1\n- Vệ sinh máy');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
