import type { Session } from '../models';
import {
  compareTime,
  groupSessionsByDay,
  isoWeekday,
  nextSession,
  nextSessionInfo,
  sessionsForDay,
  toMinutes,
  todaySessions,
  weekDates,
  weekdayLabel,
} from '../schedule';

/**
 * The timetable rules drive two screens ("what is my next class?" on Today, and the week strip on
 * Lịch học) and they are pure functions over local time — exactly the kind of code that is wrong
 * on Sundays, at midnight or at a month boundary and nowhere else.
 */

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    courseId: 1,
    dayOfWeek: 4,
    startTime: '09:45',
    endTime: '11:45',
    room: 'A1-105',
    type: 'Lecture',
    ...overrides,
  };
}

// 2026-10-22 is a Thursday (ISO weekday 4).
const THURSDAY_10AM = new Date('2026-10-22T10:00:00+07:00');
const THURSDAY_6AM = new Date('2026-10-22T06:00:00+07:00');
const SUNDAY = new Date('2026-10-25T10:00:00+07:00');

describe('isoWeekday', () => {
  it('maps Monday…Saturday to 1…6 and Sunday to 7', () => {
    expect(isoWeekday(new Date('2026-10-19T09:00:00+07:00'))).toBe(1); // Monday
    expect(isoWeekday(new Date('2026-10-24T09:00:00+07:00'))).toBe(6); // Saturday
    expect(isoWeekday(SUNDAY)).toBe(7);
  });

  it('labels a weekday in Vietnamese', () => {
    expect(weekdayLabel(4)).toBe('Thứ 5');
    expect(weekdayLabel(7)).toBe('Chủ nhật');
    expect(weekdayLabel(9)).toBe('');
  });
});

describe('sessionsForDay / todaySessions', () => {
  it('keeps only that weekday, ordered by start time', () => {
    const sessions = [
      session({ id: 'late', startTime: '14:45', endTime: '16:45' }),
      session({ id: 'early', startTime: '07:00', endTime: '09:30' }),
      session({ id: 'other-day', dayOfWeek: 5 }),
    ];

    expect(sessionsForDay(sessions, 4).map((item) => item.id)).toEqual(['early', 'late']);
    expect(sessionsForDay(sessions, 5).map((item) => item.id)).toEqual(['other-day']);
  });

  it('uses the weekday of the given date', () => {
    expect(todaySessions([session({ id: 'thu' })], THURSDAY_10AM)).toHaveLength(1);
    expect(todaySessions([session({ id: 'thu' })], SUNDAY)).toHaveLength(0);
  });

  it('groups every weekday, including the empty ones', () => {
    const grouped = groupSessionsByDay([session()]);

    expect(Object.keys(grouped)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(grouped[4]).toHaveLength(1);
    expect(grouped[1]).toEqual([]);
  });

  it('compares "HH:mm" strings by time, not lexically by accident', () => {
    expect(compareTime('07:00', '09:45')).toBeLessThan(0);
    expect(compareTime('14:45', '09:45')).toBeGreaterThan(0);
    expect(toMinutes('07:05')).toBe(425);
    expect(toMinutes('00:00')).toBe(0);
  });
});

describe('nextSession', () => {
  it('returns the class that is still running rather than skipping to tomorrow', () => {
    // 10:00 is in the middle of the 09:45–11:45 lecture.
    expect(nextSession([session()], THURSDAY_10AM)?.id).toBe('s1');
  });

  it('returns the next class later the same day', () => {
    const sessions = [
      session({ id: 'morning', startTime: '07:00', endTime: '09:30' }),
      session({ id: 'afternoon', startTime: '14:45', endTime: '16:45' }),
    ];

    expect(nextSession(sessions, THURSDAY_10AM)?.id).toBe('afternoon');
  });

  it('rolls over to the next day when nothing is left today', () => {
    const sessions = [session({ id: 'today', endTime: '09:30' }), session({ id: 'friday', dayOfWeek: 5 })];
    const lateThursday = new Date('2026-10-22T20:00:00+07:00');

    expect(nextSession(sessions, lateThursday)?.id).toBe('friday');
  });

  it('wraps from Sunday back to Monday', () => {
    const sessions = [session({ id: 'monday', dayOfWeek: 1 })];

    expect(nextSession(sessions, SUNDAY)?.id).toBe('monday');
  });

  it('is null when there is nothing scheduled at all', () => {
    expect(nextSession([], THURSDAY_10AM)).toBeNull();
    expect(
      nextSession([session({ dayOfWeek: 4, endTime: '09:30' })], new Date('2026-10-22T21:00:00+07:00')),
    ).toBeNull();
  });

  it('marks the class that is running right now as ongoing, not upcoming', () => {
    // The hero card says "tiếp theo", so the screen needs to know the difference.
    const info = nextSessionInfo([session()], THURSDAY_10AM);

    expect(info).toMatchObject({ ongoing: true, weekday: 4 });
    expect(nextSessionInfo([session()], THURSDAY_6AM)).toMatchObject({ ongoing: false, weekday: 4 });
  });

  it('reports which weekday the next class falls on', () => {
    const sessions = [session({ id: 'monday', dayOfWeek: 1 })];

    expect(nextSessionInfo(sessions, THURSDAY_10AM)).toMatchObject({ weekday: 1, ongoing: false });
  });
});

describe('weekDates', () => {
  it('starts on Monday and ends on Sunday', () => {
    const week = weekDates(THURSDAY_10AM);

    expect(week).toHaveLength(7);
    expect(week[0].dayOfWeek).toBe(1);
    expect(week[0].date.getDate()).toBe(19);
    expect(week[6].dayOfWeek).toBe(7);
    expect(week[6].date.getDate()).toBe(25);
  });

  it('puts a Sunday in the week that started six days earlier', () => {
    const week = weekDates(SUNDAY);

    expect(week[0].date.getDate()).toBe(19); // Monday 19 Oct
    expect(week[6].date.getDate()).toBe(25); // the Sunday itself
  });

  it('crosses a month boundary correctly', () => {
    const week = weekDates(new Date('2026-11-01T09:00:00+07:00')); // Sunday 1 Nov

    expect(week[0].date.getDate()).toBe(26); // Mon 26 Oct
    expect(week[0].date.getMonth()).toBe(9); // October
    expect(week[6].date.getDate()).toBe(1);
    expect(week[6].date.getMonth()).toBe(10); // November
  });
});
