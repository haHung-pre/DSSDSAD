import type { Course, StudyTask } from './models';

/**
 * Pure task rules: filtering, sorting, counts and due-date wording.
 * Everything here is a plain function of (tasks, now) — which makes it trivial to
 * unit-test and easy to explain in the oral defense.
 */

export type TaskFilter = 'all' | 'upcoming' | 'overdue' | 'done';

export const TASK_FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'overdue', label: 'Quá hạn' },
  { key: 'done', label: 'Đã xong' },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isDone(task: StudyTask): boolean {
  return task.status === 'done';
}

/** Midnight of the given date in the local time zone. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Whole days between today and the due date, counted on calendar days so that a
 * task due at 23:00 tonight is "hôm nay" rather than "0.4 ngày".
 */
export function daysUntil(dueDate: string, now: Date): number {
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(now);
  return Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
}

export function isOverdue(task: StudyTask, now: Date): boolean {
  if (isDone(task)) return false;
  return new Date(task.dueDate).getTime() < now.getTime();
}

export function isDueToday(task: StudyTask, now: Date): boolean {
  return daysUntil(task.dueDate, now) === 0;
}

export function isDueThisWeek(task: StudyTask, now: Date): boolean {
  const days = daysUntil(task.dueDate, now);
  return days >= 0 && days <= 7;
}

/** Human wording for a due date, e.g. "Hôm nay", "Còn 3 ngày", "Quá hạn 2 ngày". */
export function dueLabel(task: StudyTask, now: Date): string {
  if (isDone(task)) return 'Đã hoàn thành';

  const due = new Date(task.dueDate);
  const days = daysUntil(task.dueDate, now);

  if (due.getTime() < now.getTime()) {
    const overdueDays = Math.max(1, -days);
    return `Quá hạn ${overdueDays} ngày`;
  }
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  if (days <= 7) return `Còn ${days} ngày`;
  return due.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

/**
 * The next exam that is still ahead of the student — the earliest open `Exam` task that is
 * neither completed nor overdue. Drives the "đếm ngược kỳ thi" card on the Today screen.
 *
 * An exam the student already finished must not be counted, and a past exam is not a
 * countdown either, so both are filtered out instead of shown as "0 ngày".
 */
export function nextExam(tasks: StudyTask[], now: Date): StudyTask | null {
  const upcoming = tasks
    .filter((task) => task.type === 'Exam' && !isDone(task) && !isOverdue(task, now))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return upcoming[0] ?? null;
}

export type ExamCountdown = {
  /** Whole calendar days left; 0 means the exam is today. */
  days: number;
  label: string;
  /** True in the last three days, so the UI can highlight the card. */
  urgent: boolean;
};

export function examCountdown(task: StudyTask, now: Date): ExamCountdown {
  const days = daysUntil(task.dueDate, now);
  const label = days === 0 ? 'Thi hôm nay' : days === 1 ? 'Thi ngày mai' : `Còn ${days} ngày`;
  return { days, label, urgent: days <= 3 };
}

export function filterTasks(tasks: StudyTask[], filter: TaskFilter, now: Date): StudyTask[] {
  switch (filter) {
    case 'upcoming':
      return tasks.filter((task) => !isDone(task) && !isOverdue(task, now));
    case 'overdue':
      return tasks.filter((task) => isOverdue(task, now));
    case 'done':
      return tasks.filter(isDone);
    case 'all':
    default:
      return tasks;
  }
}

/**
 * Order used everywhere: open tasks first by due date, completed tasks last
 * (most recently completed first) so the list does not jump around while ticking.
 */
export function sortTasks(tasks: StudyTask[]): StudyTask[] {
  return [...tasks].sort((a, b) => {
    const aDone = isDone(a);
    const bDone = isDone(b);
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (aDone && bDone) return b.updatedAt.localeCompare(a.updatedAt);
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export type TaskSummary = {
  total: number;
  done: number;
  open: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  /** 0…1, rounded to two decimals; 0 when there are no tasks. */
  completionRate: number;
};

export function summarize(tasks: StudyTask[], now: Date): TaskSummary {
  const total = tasks.length;
  const done = tasks.filter(isDone).length;
  const overdue = tasks.filter((task) => isOverdue(task, now)).length;
  const dueToday = tasks.filter((task) => !isDone(task) && isDueToday(task, now)).length;
  const dueThisWeek = tasks.filter((task) => !isDone(task) && isDueThisWeek(task, now)).length;

  return {
    total,
    done,
    open: total - done,
    overdue,
    dueToday,
    dueThisWeek,
    completionRate: total === 0 ? 0 : Math.round((done / total) * 100) / 100,
  };
}

/** Open tasks sorted by due date, limited — used by the "Deadline sắp tới" section. */
export function upcomingDeadlines(tasks: StudyTask[], now: Date, limit = 3): StudyTask[] {
  return tasks
    .filter((task) => !isDone(task))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, limit);
}

export function tasksForCourse(tasks: StudyTask[], courseId: number): StudyTask[] {
  return tasks.filter((task) => task.courseId === courseId);
}

/**
 * Case- and accent-insensitive search over the fields a student would type:
 * title, description and the course code. "bai tap" matches "Bài tập".
 */
export function searchTasks(tasks: StudyTask[], query: string, courses: Course[] = []): StudyTask[] {
  const needle = normalize(query);
  if (needle.length === 0) return tasks;

  const courseCodes = new Map(courses.map((course) => [course.id, normalize(course.code)]));

  return tasks.filter((task) => {
    const haystack = [
      normalize(task.title),
      normalize(task.description),
      courseCodes.get(task.courseId) ?? '',
    ].join(' ');
    return haystack.includes(needle);
  });
}

/**
 * Explicit Vietnamese/Latin fold table.
 *
 * `String.prototype.normalize('NFD')` needs full Unicode support, which is not
 * guaranteed on every JS engine a React Native app can run on (Hermes builds without
 * Intl, older Android WebViews). A literal table keeps search results identical
 * everywhere, and it is trivial to read in the oral defense.
 */
const DIACRITIC_FOLD: Record<string, string> = {
  a: 'àáạảãâầấậẩẫăằắặẳẵ',
  e: 'èéẹẻẽêềếệểễ',
  i: 'ìíịỉĩ',
  o: 'òóọỏõôồốộổỗơờớợởỡ',
  u: 'ùúụủũưừứựửữ',
  y: 'ỳýỵỷỹ',
  d: 'đ',
  c: 'ç',
  n: 'ñ',
};

const FOLD_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [plain, accented] of Object.entries(DIACRITIC_FOLD)) {
    for (const char of accented) map[char] = plain;
  }
  return map;
})();

/** Folds one character: lowercase + diacritics removed. Used when `normalize` is unavailable. */
export function foldChar(char: string): string {
  const lower = char.toLowerCase();
  return FOLD_MAP[lower] ?? lower;
}

/** Lower-cases and strips Vietnamese diacritics so "bai tap" finds "bài tập". */
export function normalize(text: string): string {
  const trimmed = text.trim();
  let folded: string;

  if (typeof trimmed.normalize === 'function') {
    try {
      // Fast path: handles every Latin script, not only Vietnamese.
      folded = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      folded = folded.replace(/đ/g, 'd').replace(/Đ/g, 'D');
    } catch {
      folded = Array.from(trimmed).map(foldChar).join('');
    }
  } else {
    folded = Array.from(trimmed).map(foldChar).join('');
  }

  return folded.toLowerCase().trim();
}
