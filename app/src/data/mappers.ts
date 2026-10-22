import { AppError } from '../core/errors';
import type {
  Course,
  Session,
  SessionType,
  StudentProfile,
  StudyTask,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '../domain/models';

/**
 * DTO -> domain mapping.
 *
 * The API is a json-server mock today, but the app is written as if it were a real
 * backend: ids may arrive as numbers, unknown enum values fall back, and a missing
 * required field produces a `parse` AppError instead of `undefined` leaking into the UI.
 */

type Raw = Record<string, unknown>;

function asObject(raw: unknown, entity: string): Raw {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw AppError.parse(`${entity}: expected a JSON object`);
  }
  return raw as Raw;
}

function asArray(raw: unknown, entity: string): unknown[] {
  if (!Array.isArray(raw)) throw AppError.parse(`${entity}: expected a JSON array`);
  return raw;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function asDate(value: unknown, field: string): string {
  const text = asString(value);
  if (!text) throw AppError.parse(`task.dueDate is missing`);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw AppError.parse(`task.${field} is not a valid date: "${text}"`);
  return parsed.toISOString();
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = asString(value);
  return (allowed as readonly string[]).includes(text) ? (text as T) : fallback;
}

const TASK_TYPE_VALUES: readonly TaskType[] = ['Assignment', 'Exam', 'Project', 'Reading'];
const TASK_PRIORITY_VALUES: readonly TaskPriority[] = ['Low', 'Medium', 'High'];
const TASK_STATUS_VALUES: readonly TaskStatus[] = ['todo', 'doing', 'done'];
const SESSION_TYPE_VALUES: readonly SessionType[] = ['Lecture', 'Lab', 'Tutorial'];

export function mapTask(raw: unknown): StudyTask {
  const item = asObject(raw, 'task');
  const id = asString(item.id);
  if (!id) throw AppError.parse('task.id is missing');
  const title = asString(item.title).trim();
  if (!title) throw AppError.parse(`task ${id} has no title`);

  return {
    id,
    courseId: asNumber(item.courseId),
    title,
    description: asString(item.description),
    type: oneOf(item.type, TASK_TYPE_VALUES, 'Assignment'),
    dueDate: asDate(item.dueDate, 'dueDate'),
    priority: oneOf(item.priority, TASK_PRIORITY_VALUES, 'Medium'),
    status: oneOf(item.status, TASK_STATUS_VALUES, 'todo'),
    createdAt: asDate(item.createdAt ?? item.dueDate, 'createdAt'),
    updatedAt: asDate(item.updatedAt ?? item.createdAt ?? item.dueDate, 'updatedAt'),
    ...(item.pendingSync === true ? { pendingSync: true } : {}),
  };
}

export function mapTasks(raw: unknown): StudyTask[] {
  return asArray(raw, 'tasks').map(mapTask);
}

export function mapCourse(raw: unknown): Course {
  const item = asObject(raw, 'course');
  const id = asNumber(item.id, Number.NaN);
  if (Number.isNaN(id)) throw AppError.parse('course.id is missing');
  return {
    id,
    code: asString(item.code, `COURSE-${id}`),
    name: asString(item.name, 'Môn học'),
    lecturer: asString(item.lecturer, '—'),
    credits: asNumber(item.credits, 3),
    color: asString(item.color, '#2F6FED'),
    room: asString(item.room, '—'),
  };
}

export function mapCourses(raw: unknown): Course[] {
  return asArray(raw, 'courses').map(mapCourse);
}

export function mapSession(raw: unknown): Session {
  const item = asObject(raw, 'session');
  const id = asString(item.id);
  if (!id) throw AppError.parse('session.id is missing');
  return {
    id,
    courseId: asNumber(item.courseId),
    dayOfWeek: Math.min(7, Math.max(1, asNumber(item.dayOfWeek, 1))),
    startTime: asString(item.startTime, '07:00'),
    endTime: asString(item.endTime, '09:00'),
    room: asString(item.room, '—'),
    type: oneOf(item.type, SESSION_TYPE_VALUES, 'Lecture'),
  };
}

export function mapSessions(raw: unknown): Session[] {
  return asArray(raw, 'sessions').map(mapSession);
}

export function mapProfile(raw: unknown): StudentProfile {
  const item = asObject(raw, 'profile');
  return {
    id: asNumber(item.id, 1),
    name: asString(item.name, 'Sinh viên'),
    studentId: asString(item.studentId, '—'),
    className: asString(item.className, '—'),
    faculty: asString(item.faculty, '—'),
    semester: asString(item.semester, '—'),
    avatar: asString(item.avatar),
  };
}
