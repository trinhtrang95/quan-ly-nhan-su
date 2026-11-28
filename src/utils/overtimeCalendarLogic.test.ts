import test from 'node:test';
import assert from 'node:assert/strict';
import type { OvertimeFormWithItems } from '../services/hrService';
import { filterOvertimeForms } from '../utils/overtimeFormsService';
import {
  buildCalendarYearOptions,
  buildOvertimeMonthCalendarGrid,
  collectOvertimeFormDatesSet,
  parseYearMonthKey,
  shiftYearMonth,
} from './overtimeCalendarLogic';

function makeForm(
  overrides: Partial<OvertimeFormWithItems>
): OvertimeFormWithItems {
  return {
    id: 'f-1',
    form_code: 'TC-20261128',
    department: 'Kỹ thuật',
    overtime_date: '2026-11-28',
    overtime_dates: ['2026-11-28'],
    total_participants: 2,
    total_hours: 4,
    total_blocks: 1,
    status: 'Đã lưu',
    created_at: '2026-11-28T00:00:00.000Z',
    deleted_at: null,
    items: [],
    ...overrides,
  };
}

test('shiftYearMonth wraps across January and December cleanly', () => {
  assert.deepEqual(shiftYearMonth(2026, 1, -1), {
    year: 2025,
    month: 12,
    monthKey: '2025-12',
  });
  assert.deepEqual(shiftYearMonth(2026, 12, 1), {
    year: 2027,
    month: 1,
    monthKey: '2027-01',
  });
});

test('parseYearMonthKey falls back cleanly when monthKey is empty', () => {
  assert.deepEqual(parseYearMonthKey('', '2026-11-28'), {
    year: 2026,
    month: 11,
  });
  assert.deepEqual(parseYearMonthKey('2026-03', '2026-11-28'), {
    year: 2026,
    month: 3,
  });
});

test('collectOvertimeFormDatesSet marks only primary overtime_date while skipping secondary dates and soft-deleted forms', () => {
  const forms = [
    makeForm({
      id: 'f-1',
      overtime_date: '2026-11-10',
      overtime_dates: ['2026-11-10', '2026-11-12'],
    }),
    makeForm({
      id: 'f-2',
      overtime_date: '2026-11-15',
      overtime_dates: ['2026-11-15'],
      deleted_at: '2026-11-20T00:00:00.000Z',
    }),
  ];

  const dates = collectOvertimeFormDatesSet(forms);
  assert.equal(dates.has('2026-11-10'), true);
  assert.equal(dates.has('2026-11-12'), false);
  assert.equal(dates.has('2026-11-15'), false);
});

test('buildOvertimeMonthCalendarGrid aligns Monday-first columns, Sunday flags, and form dot markers', () => {
  // November 2026: Nov 1 is Sunday (col 6), so leadingOffset = 6 (Mon Oct 26 .. Sat Oct 31)
  const formDates = new Set(['2026-11-01', '2026-11-28']);
  const cells = buildOvertimeMonthCalendarGrid(2026, 11, formDates);

  assert.equal(cells.length % 7, 0);
  // First 6 cells belong to October 2026
  assert.equal(cells[0].isoDate, '2026-10-26');
  assert.equal(cells[0].inCurrentMonth, false);
  assert.equal(cells[5].isoDate, '2026-10-31');
  assert.equal(cells[5].inCurrentMonth, false);
  // Cell 6 is Sunday Nov 1, 2026
  assert.equal(cells[6].isoDate, '2026-11-01');
  assert.equal(cells[6].inCurrentMonth, true);
  assert.equal(cells[6].isSunday, true);
  assert.equal(cells[6].hasOvertimeForm, true);

  const nov28 = cells.find((c) => c.isoDate === '2026-11-28');
  assert.ok(nov28);
  assert.equal(nov28.inCurrentMonth, true);
  assert.equal(nov28.hasOvertimeForm, true);
});

test('filterOvertimeForms filters by overtime_date/overtime_dates and never leaks forms via created_at or updated_at', () => {
  const forms = [
    makeForm({
      id: 'f-multi',
      form_code: 'TC-20261110',
      overtime_date: '2026-11-10',
      overtime_dates: ['2026-11-10', '2026-11-12'],
    }),
    makeForm({
      id: 'f-nov30',
      form_code: 'TC-20261130',
      overtime_date: '2026-11-30',
      overtime_dates: ['2026-11-30'],
      created_at: '2026-11-28T08:00:00.000Z',
      updated_at: '2026-11-28T09:00:00.000Z',
    }),
  ];

  const bySecondaryDate = filterOvertimeForms(forms, '', '2026-11-12');
  assert.deepEqual(
    bySecondaryDate.map((f) => f.id),
    ['f-multi']
  );

  // Clicking 2026-11-28 must NOT include 2026-11-30 even if created_at/updated_at is 2026-11-28
  const byNov28 = filterOvertimeForms(forms, '', '2026-11-28');
  assert.deepEqual(byNov28, []);

  const byMonth = filterOvertimeForms(forms, '', '2026-11');
  assert.deepEqual(
    byMonth.map((f) => f.id),
    ['f-multi', 'f-nov30']
  );
});

test('buildCalendarYearOptions returns sorted descending years including form years and active year', () => {
  const forms = [
    makeForm({ id: 'f-1', overtime_date: '2024-05-01', overtime_dates: ['2024-05-01'] }),
  ];
  const years = buildCalendarYearOptions(forms, 2026, 2026);
  assert.equal(years[0], 2027);
  assert.equal(years.includes(2024), true);
  assert.equal(years.includes(2026), true);
});
