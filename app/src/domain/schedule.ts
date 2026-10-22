import type { Session } from './models';

export const WEEKDAYS: { index: number; label: string; short: string }[] = [
  { index: 1, label: 'Thứ 2', short: 'T2' },
  { index: 2, label: 'Thứ 3', short: 'T3' },
  { index: 3, label: 'Thứ 4', short: 'T4' },
  { index: 4, label: 'Thứ 5', short: 'T5' },
  { index: 5, label: 'Thứ 6', short: 'T6' },
  { index: 6, label: 'Thứ 7', short: 'T7' },
  { index: 7, label: 'Chủ nhật', short: 'CN' },
];

/** JS `getDay()` is 0 = Sunday; convert to ISO weekday 1..7. */
export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function weekdayLabel(dayOfWeek: number): string {
  return WEEKDAYS.find((day) => day.index === dayOfWeek)?.label ?? '';
}

export function compareTime(a: string, b: string): number {
  return a.localeCompare(b);
}

export function sessionsForDay(sessions: Session[], dayOfWeek: number): Session[] {
  return sessions
    .filter((session) => session.dayOfWeek === dayOfWeek)
    .sort((a, b) => compareTime(a.startTime, b.startTime));
}

export function todaySessions(sessions: Session[], now: Date): Session[] {
  return sessionsForDay(sessions, isoWeekday(now));
}

export function groupSessionsByDay(sessions: Session[]): Record<number, Session[]> {
  const grouped: Record<number, Session[]> = {};
  for (const day of WEEKDAYS) {
    grouped[day.index] = sessionsForDay(sessions, day.index);
  }
  return grouped;
}

/** "07:00" -> 7 * 60 = 420 minutes since midnight. */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return (hours || 0) * 60 + (minutes || 0);
}

export type NextSessionInfo = {
  session: Session;
  /**
   * True when the class has already started and has not finished yet. The Today screen says
   * "tiếp theo" (next); a class that is running right now is not "next", so the screen needs
   * this flag to label the card honestly.
   */
  ongoing: boolean;
  /** ISO weekday (1…7) the class falls on, so the card can say "Thứ 3" when it is not today. */
  weekday: number;
};

/**
 * The next class within the next 7 days: the one running now if any, otherwise the next one
 * whose end time has not passed.
 */
export function nextSessionInfo(sessions: Session[], now: Date): NextSessionInfo | null {
  if (sessions.length === 0) return null;

  const today = isoWeekday(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset += 1) {
    const day = ((today - 1 + offset) % 7) + 1;
    const candidates = sessionsForDay(sessions, day).filter((session) => {
      if (offset > 0) return true;
      return toMinutes(session.endTime) > nowMinutes;
    });

    if (candidates.length > 0) {
      const session = candidates[0];
      return {
        session,
        ongoing: offset === 0 && toMinutes(session.startTime) <= nowMinutes,
        weekday: day,
      };
    }
  }
  return null;
}

/** The next class starting after `now` within the next 7 days, if any. */
export function nextSession(sessions: Session[], now: Date): Session | null {
  return nextSessionInfo(sessions, now)?.session ?? null;
}

/** The Monday-based week that contains `now`, used by the timetable day picker. */
export function weekDates(now: Date): { dayOfWeek: number; date: Date }[] {
  const monday = new Date(now.getTime());
  monday.setDate(now.getDate() - (isoWeekday(now) - 1));
  return WEEKDAYS.map((day, index) => {
    const date = new Date(monday.getTime());
    date.setDate(monday.getDate() + index);
    return { dayOfWeek: day.index, date };
  });
}
