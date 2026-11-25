import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthCalendarDays,
  calculateNetShiftHours,
  calculateOvertimeNetHours,
  calculateShiftMetrics,
  convertLunarToSolarIso,
  createDefaultAdminShift,
  evaluateOvertimeDaySchedule,
  generateCompanyHolidaysForYear,
  getLunarHolidayAnchorsForYear,
  getMondayFirstMonthOffset,
  getNextWeekdayMode,
  resolveWorkShiftForDepartment,
  type WorkShift,
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

  it('resolves department-specific shift and falls back to default shift when unmatched', () => {
    const hc = createDefaultAdminShift();
    const peShift: WorkShift = {
      ...createDefaultAdminShift(),
      id: 'PE1',
      code: 'PE1',
      name: 'Ca PE',
      startTime: '07:30',
      endTime: '16:30',
      breakStart: '11:30',
      breakEnd: '12:30',
      workingDays: {
        mon: 'full_day',
        tue: 'full_day',
        wed: 'full_day',
        thu: 'full_day',
        fri: 'full_day',
        sat: 'morning',
        sun: 'off',
      },
      dayOverrides: {
        fri: { startTime: '07:30', endTime: '16:00' },
      },
      isDefault: false,
      departmentNames: ['PE', 'ST'],
    };

    assert.equal(resolveWorkShiftForDepartment([hc, peShift], 'PE').code, 'PE1');
    assert.equal(
      resolveWorkShiftForDepartment([hc, peShift], 'ALL', ['ST']).code,
      'PE1'
    );
    assert.equal(
      resolveWorkShiftForDepartment([hc, peShift], 'AUTO 1').code,
      'HC'
    );
  });

  it('evaluates holidays, compensatory days, makeup work, weekly off, and morning shifts for overtime auto-fill', () => {
    const hc = createDefaultAdminShift();
    const peShift: WorkShift = {
      ...createDefaultAdminShift(),
      id: 'PE1',
      code: 'PE1',
      name: 'Ca PE',
      startTime: '07:30',
      endTime: '16:30',
      breakStart: '11:30',
      breakEnd: '12:30',
      workingDays: {
        ...hc.workingDays,
        sat: 'morning',
      },
      dayOverrides: {
        fri: { endTime: '16:00' },
      },
      isDefault: false,
      departmentNames: ['PE'],
    };

    const holidays = [
      {
        id: 'h-tet',
        year: 2026,
        holidayDate: '2026-04-30',
        name: 'Ngày Giải phóng miền Nam (30/4)',
        holidayType: 'holiday' as const,
        isManual: false,
      },
      {
        id: 'h-comp',
        year: 2026,
        holidayDate: '2026-04-27',
        name: 'Nghỉ bù Giỗ Tổ',
        holidayType: 'compensatory' as const,
        isManual: false,
      },
      {
        id: 'h-makeup',
        year: 2026,
        holidayDate: '2026-05-09',
        name: 'Làm bù hoán đổi',
        holidayType: 'makeup_work' as const,
        isManual: true,
      },
    ];

    const holidayEval = evaluateOvertimeDaySchedule({
      isoDate: '2026-04-30',
      holidays,
      shifts: [hc, peShift],
      departmentName: 'ALL',
    });
    assert.equal(holidayEval.dayKind, 'holiday');
    assert.equal(holidayEval.suggestedStartTime, '08:00');
    assert.deepEqual(holidayEval.quickEndSuggestions, ['12:00', '17:00', '20:00']);
    assert.ok(holidayEval.bannerText.includes('Áp dụng đơn giá tăng ca Lễ/Tết'));

    const compEval = evaluateOvertimeDaySchedule({
      isoDate: '2026-04-27',
      holidays,
      shifts: [hc, peShift],
    });
    assert.equal(compEval.dayKind, 'compensatory_off');
    assert.equal(compEval.suggestedStartTime, '08:00');
    assert.ok(compEval.bannerText.includes('Ngày nghỉ bù / hoán đổi'));

    const makeupEval = evaluateOvertimeDaySchedule({
      isoDate: '2026-05-09',
      holidays,
      shifts: [hc, peShift],
    });
    assert.equal(makeupEval.dayKind, 'makeup_work');
    assert.equal(makeupEval.suggestedStartTime, '17:00');

    // Saturday morning on PE shift -> start at breakStart 11:30
    const satMorningEval = evaluateOvertimeDaySchedule({
      isoDate: '2026-11-21', // Saturday
      holidays,
      shifts: [hc, peShift],
      departmentName: 'PE',
    });
    assert.equal(satMorningEval.dayKind, 'morning_work');
    assert.equal(satMorningEval.suggestedStartTime, '11:30');

    // Friday override on PE shift -> end_time = 16:00
    const friOverrideEval = evaluateOvertimeDaySchedule({
      isoDate: '2026-11-20', // Friday
      holidays,
      shifts: [hc, peShift],
      departmentName: 'PE',
    });
    assert.equal(friOverrideEval.dayKind, 'working');
    assert.equal(friOverrideEval.suggestedStartTime, '16:00');

    // Sunday on HC shift -> weekly_off
    const sunOffEval = evaluateOvertimeDaySchedule({
      isoDate: '2026-11-22', // Sunday
      holidays,
      shifts: [hc, peShift],
    });
    assert.equal(sunOffEval.dayKind, 'weekly_off');
    assert.equal(sunOffEval.suggestedStartTime, '08:00');
    assert.deepEqual(sunOffEval.quickEndSuggestions, ['12:00', '17:00', '20:00']);
  });

  it('calculates net overtime hours subtracting overlapping mid-shift and dinner breaks without double counting', () => {
    // Sunday 08:00 - 17:00 with 12:00 - 13:00 lunch break -> 8h net
    const fullDay = calculateOvertimeNetHours({
      startTime: '08:00',
      endTime: '17:00',
      breakWindows: [{ startTime: '12:00', endTime: '13:00', label: 'Nghỉ giữa ca' }],
    });
    assert.equal(fullDay.rawHours, 9);
    assert.equal(fullDay.deductedBreakHours, 1);
    assert.equal(fullDay.netHours, 8);

    // Partial overlap 08:00 - 12:30 with 12:00 - 13:00 -> 4h net
    const partial = calculateOvertimeNetHours({
      startTime: '08:00',
      endTime: '12:30',
      breakWindows: [{ startTime: '12:00', endTime: '13:00', label: 'Nghỉ giữa ca' }],
    });
    assert.equal(partial.netHours, 4);

    // Full-day + evening 08:00 - 20:00 with 12:00-13:00 lunch AND 17:30-18:00 dinner -> 10.5h net
    const withDinner = calculateOvertimeNetHours({
      startTime: '08:00',
      endTime: '20:00',
      breakWindows: [
        { startTime: '12:00', endTime: '13:00', label: 'Nghỉ giữa ca' },
        { startTime: '17:30', endTime: '18:00', label: 'Nghỉ ăn tối' },
      ],
    });
    assert.equal(withDinner.rawHours, 12);
    assert.equal(withDinner.deductedBreakHours, 1.5);
    assert.equal(withDinner.netHours, 10.5);

    // Overlapping break ranges must not double subtract
    const overlappingBreaks = calculateOvertimeNetHours({
      startTime: '17:00',
      endTime: '20:00',
      breakWindows: [
        { startTime: '17:30', endTime: '18:00', label: 'Break 1' },
        { startTime: '17:45', endTime: '18:15', label: 'Break 2' },
      ],
    });
    assert.equal(overlappingBreaks.deductedBreakHours, 0.75);
    assert.equal(overlappingBreaks.netHours, 2.25);
  });
});

