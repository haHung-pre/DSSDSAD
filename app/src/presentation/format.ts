import type { StudyTask, TaskPriority, TaskType } from '../domain/models';

/** Presentation-only formatting helpers (pure functions, easy to unit-test). */

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function formatDayHeader(date: Date): string {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(iso: string): string {
  return `${formatTime(iso)} · ${formatDate(iso)}`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}`;
}

/** Converts an ISO timestamp into the editable "YYYY-MM-DD HH:mm" form value. */
export function toDueInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Parses "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" (local time) into an ISO string.
 * Returns `null` when the text is not a valid date, so the form can show an error
 * instead of silently saving a wrong deadline.
 */
export function parseDueInput(text: string): string | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) return null;

  const [, year, month, day, hours = '23', minutes = '59'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), 0, 0);

  if (Number.isNaN(date.getTime())) return null;
  // Reject impossible dates such as 2026-02-31 (JS would roll them over).
  if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return date.toISOString();
}

/** "vừa xong", "5 phút trước", "2 giờ trước", "12/10/2026". */
export function formatRelativeTime(timestamp: number, now: Date): string {
  const diffMs = now.getTime() - timestamp;
  if (diffMs < 0) return 'vừa xong';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatDate(new Date(timestamp).toISOString());
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  Assignment: 'Bài tập',
  Exam: 'Kiểm tra',
  Project: 'Đồ án',
  Reading: 'Đọc tài liệu',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  Low: 'Thấp',
  Medium: 'Trung bình',
  High: 'Cao',
};

export const TASK_STATUS_LABELS: Record<StudyTask['status'], string> = {
  todo: 'Chưa làm',
  doing: 'Đang làm',
  done: 'Hoàn thành',
};

export const SESSION_TYPE_LABELS: Record<string, string> = {
  Lecture: 'Lý thuyết',
  Lab: 'Thực hành',
  Tutorial: 'Thảo luận',
};
