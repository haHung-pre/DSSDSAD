import type { Course, Session, StudentProfile, StudyTask, TaskInput, TaskPatch } from './models';

/**
 * Repository contracts (the "data layer boundary").
 * View-models depend on these interfaces only, which is what makes the whole
 * layer testable with in-memory fakes and swappable between mock API and a real one.
 */

export type DataOrigin = 'network' | 'cache';

export type Loaded<T> = {
  data: T;
  origin: DataOrigin;
  /** Timestamp of the cached snapshot that produced this data. */
  savedAt: number;
};

export interface TaskRepository {
  /** Cache-first read used for the first paint; throws `AppError` when nothing is available. */
  loadTasks(): Promise<Loaded<StudyTask[]>>;
  /** Always hits the API (pull-to-refresh). Falls back to the cache when the request fails. */
  refreshTasks(): Promise<Loaded<StudyTask[]>>;
  createTask(input: TaskInput): Promise<{ task: StudyTask; synced: boolean }>;
  updateTask(id: string, patch: TaskPatch): Promise<{ task: StudyTask; synced: boolean }>;
  setTaskStatus(id: string, status: StudyTask['status']): Promise<{ task: StudyTask; synced: boolean }>;
  deleteTask(id: string): Promise<{ synced: boolean }>;
  /** Replays queued write operations; returns how many were pushed. */
  syncPending(): Promise<{ processed: number; remaining: number }>;
  pendingCount(): Promise<number>;
}

export interface CourseRepository {
  loadCourses(): Promise<Loaded<Course[]>>;
  refreshCourses(): Promise<Loaded<Course[]>>;
}

export interface ScheduleRepository {
  loadSessions(): Promise<Loaded<Session[]>>;
  refreshSessions(): Promise<Loaded<Session[]>>;
}

export interface ProfileRepository {
  loadProfile(): Promise<Loaded<StudentProfile>>;
  refreshProfile(): Promise<Loaded<StudentProfile>>;
}
