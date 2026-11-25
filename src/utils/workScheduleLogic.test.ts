import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthCalendarDays,
  calculateNetShiftHours,
  calculateShiftMetrics,
  convertLunarToSolarIso,
  createDefaultAdminShift,
  generateCompanyHolidaysForYear,
  getLunarHolidayAnchorsForYear,
  getMondayFirstMonthOffset,
  getNextWeekdayMode,
} from './workScheduleLogic';

describe('workScheduleLogic', () => {
  it('cycles weekday work modes in exact 4-state loop', () => {
    assert.equal(getNextWeekdayMode('full_day'), 'morning');
    assert.equal(getNextWeekdayMode('morning'), 'biweekly');
    assert.equal(getNextWeekdayMode('biweekly'), 'off');
    assert.equal(getNextWeekdayMode('off'), 'full_day');
  });

  it('computes default HC shift as 8 hours/day and 40 hours/week', () => {
    const hc = createDefaultAdminShift();
    assert.equal(hc.code, 'HC');
    assert.equal(hc.standardDailyHours, 8);
    assert.equal(hc.weeklyHours, 40);
    assert.equal(hc.isDefault, true);
  });

  it('supports overnight shifts, morning-only days, biweekly days, and per-day overrides', () => {
    // Overnight shift 22:00 - 06:00 with 01:00 - 02:00 break = 7 hours
    assert.equal(
      calculateNetShiftHours('22:00', '06:00', '01:00', '02:00'),
      7
    );

    const customMetrics = calculateShiftMetrics({
      startTime: '08:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      workingDays: {
        mon: 'full_day',
        tue: 'full_day',
        wed: 'full_day',
        thu: 'full_day',
        fri: 'full_day',
        sat: 'morning', // 08:00 - 12:00 = 4h
        sun: 'biweekly', // 8h * 0.5 = 4h average
      },
      dayOverrides: {
        fri: { startTime: '08:00', endTime: '16:00', breakStart: '12:00', breakEnd: '13:00' }, // 7h
      },
    });
    assert.equal(customMetrics.standardDailyHours, 8);
    // 8*4 + 7 + 4 + 4 = 47h
    assert.equal(customMetrics.weeklyHours, 47);
  });

  it('calculates Vietnamese Lunar New Year (Mung 1 Tet) and Hung Kings (10/3 AL) accurately across years', () => {
    assert.equal(convertLunarToSolarIso(1, 1, 2025, 0), '2025-01-29');
    assert.equal(convertLunarToSolarIso(10, 3, 2025, 0), '2025-04-07');

    const y2026 = getLunarHolidayAnchorsForYear(2026);
    assert.equal(y2026.tetFirstDayIso, '2026-02-17');
    assert.equal(y2026.hungKingsIso, '2026-04-26');

    const y2027 = getLunarHolidayAnchorsForYear(2027);
    assert.equal(y2027.tetFirstDayIso, '2027-02-06');
    assert.equal(y2027.hungKingsIso, '2027-04-16');

    const y2028 = getLunarHolidayAnchorsForYear(2028);
    assert.equal(y2028.tetFirstDayIso, '2028-01-26');
    assert.equal(y2028.hungKingsIso, '2028-04-04');
  });

  it('auto-generates 2026 statutory holidays, adds compensatory days off when falling on default shift rest days, and preserves manual entries', () => {
    const hc = createDefaultAdminShift();
    const manualExisting = [
      {
        id: 'manual-swap-1',
        year: 2026,
        holidayDate: '2026-05-02',
        name: 'Làm bù hoán đổi',
        holidayType: 'makeup_work' as const,
        isManual: true,
      },
      {
        id: 'old-auto-1',
        year: 2026,
        holidayDate: '2026-01-01',
        name: 'Old auto',
        holidayType: 'holiday' as const,
        isManual: false,
      },
    ];

    const holidays = generateCompanyHolidaysForYear(
      {
        year: 2026,
        tetPlan: '1+4', // 16/02 (Mon), 17/02 (Tue), 18/02 (Wed), 19/02 (Thu), 20/02 (Fri) -> 0 weekend days
        nationalDayPlan: '09-01_09-02',
        includeCultureDay: true,
      },
      hc,
      manualExisting
    );

    const dates = holidays.map((h) => `${h.holidayDate}:${h.holidayType}`);
    // 10/3 AL 2026 = 2026-04-26 (Sunday) -> Nghỉ bù on 2026-04-27 (Monday)!
    assert.ok(dates.includes('2026-04-26:holiday'));
    assert.ok(dates.includes('2026-04-27:compensatory'));
    // Culture day 24/11 included
    assert.ok(dates.includes('2026-11-24:holiday'));
    // Manual entry preserved, old auto entry replaced
    assert.ok(holidays.some((h) => h.id === 'manual-swap-1'));
    assert.ok(!holidays.some((h) => h.id === 'old-auto-1'));
  });

  it('handles consecutive weekend holidays in 2027 without colliding compensatory days', () => {
    const hc = createDefaultAdminShift();
    // 2027 Mung 1 Tet is 2027-02-06 (Saturday). With 1+4 plan: 05(Fri), 06(Sat), 07(Sun), 08(Mon), 09(Tue)
    // Sat 06 & Sun 07 are weekly rest days -> compensatory days must land on 10(Wed) and 11(Thu)!
    const holidays2027 = generateCompanyHolidaysForYear(
      {
        year: 2027,
        tetPlan: '1+4',
        nationalDayPlan: '09-02_09-03',
        includeCultureDay: false,
      },
      hc,
      []
    );

    const compDates = holidays2027
      .filter((h) => h.holidayType === 'compensatory')
      .map((h) => h.holidayDate);

    // 2027-02-10, 2027-02-11 (for Sat+Sun Tet), plus 2027-05-03 (for Sat 01/05)
    assert.ok(compDates.includes('2027-02-10'));
    assert.ok(compDates.includes('2027-02-11'));
    assert.ok(compDates.includes('2027-05-03'));
    assert.ok(!holidays2027.some((h) => h.holidayDate === '2027-11-24'));
  });

  it('builds 12-month calendar day categories reflecting default shift + holiday exceptions', () => {
    const hc = createDefaultAdminShift();
    hc.workingDays.sat = 'morning';

    const holidays = [
      {
        id: 'h1',
        year: 2026,
        holidayDate: '2026-04-26',
        name: 'Giỗ Tổ',
        holidayType: 'holiday' as const,
        isManual: false,
      },
      {
        id: 'h2',
        year: 2026,
        holidayDate: '2026-04-27',
        name: 'Nghỉ bù',
        holidayType: 'compensatory' as const,
        isManual: false,
      },
      {
        id: 'h3',
        year: 2026,
        holidayDate: '2026-04-12',
        name: 'Làm bù',
        holidayType: 'makeup_work' as const,
        isManual: true,
      },
    ];

    const aprilDays = buildMonthCalendarDays(2026, 4, hc, holidays);
    assert.equal(aprilDays.length, 30);
    // 2026-04-01 is Wednesday -> offset from Monday is 2
    assert.equal(getMondayFirstMonthOffset(2026, 4), 2);

    const findDay = (iso: string) => aprilDays.find((d) => d.isoDate === iso);
    assert.equal(findDay('2026-04-26')?.category, 'holiday');
    assert.equal(findDay('2026-04-27')?.category, 'compensatory_swap');
    assert.equal(findDay('2026-04-12')?.category, 'makeup_work');
    assert.equal(findDay('2026-04-18')?.category, 'morning_work'); // Saturday morning on shift
    assert.equal(findDay('2026-04-19')?.category, 'weekly_off'); // Sunday off on shift
    assert.equal(findDay('2026-04-20')?.category, 'working'); // Monday working
  });
});
