import { formatRelativeTime, parseDueInput, toDueInput } from '../format';

describe('due date input helpers', () => {
  it('parses "YYYY-MM-DD HH:mm" in local time', () => {
    const iso = parseDueInput('2026-10-31 17:00');
    expect(iso).not.toBeNull();
    const date = new Date(iso as string);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(31);
    expect(date.getHours()).toBe(17);
    expect(date.getMinutes()).toBe(0);
  });

  it('accepts a date without a time and defaults to end of day', () => {
    const iso = parseDueInput('2026-11-02');
    const date = new Date(iso as string);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
  });

  it('rejects invalid or impossible dates', () => {
    expect(parseDueInput('31/10/2026')).toBeNull();
    expect(parseDueInput('2026-02-31')).toBeNull();
    expect(parseDueInput('')).toBeNull();
    expect(parseDueInput('ngày mai')).toBeNull();
  });

  it('round-trips an ISO timestamp through the form value', () => {
    const iso = '2026-10-31T17:00:00.000+07:00';
    expect(parseDueInput(toDueInput(iso))).toBe(new Date(iso).toISOString());
  });

  it('describes recent timestamps in Vietnamese', () => {
    const now = new Date('2026-10-21T12:00:00+07:00');
    expect(formatRelativeTime(new Date('2026-10-21T11:59:30+07:00').getTime(), now)).toBe('vừa xong');
    expect(formatRelativeTime(new Date('2026-10-21T11:45:00+07:00').getTime(), now)).toBe('15 phút trước');
    expect(formatRelativeTime(new Date('2026-10-21T09:00:00+07:00').getTime(), now)).toBe('3 giờ trước');
  });
});
