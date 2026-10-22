/** Domain models — framework-agnostic, no React Native imports in this folder. */

export type TaskType = 'Assignment' | 'Exam' | 'Project' | 'Reading';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'todo' | 'doing' | 'done';

export const TASK_TYPES: TaskType[] = ['Assignment', 'Exam', 'Project', 'Reading'];
export const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];
export const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];

export interface Course {
  id: number;
  code: string;
  name: string;
  lecturer: string;
  credits: number;
  /** Hex colour used for the course badge throughout the UI. */
  color: string;
  room: string;
}

export interface StudyTask {
  id: string;
  courseId: number;
  title: string;
  description: string;
  type: TaskType;
  /** ISO-8601 timestamp. */
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * Set when the task only exists on the device and is waiting in the outbox to be
   * pushed to the API. Never sent to the server.
   */
  pendingSync?: boolean;
}

export type SessionType = 'Lecture' | 'Lab' | 'Tutorial';

export interface Session {
  id: string;
  courseId: number;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  dayOfWeek: number;
  /** "HH:mm" in local time. */
  startTime: string;
  endTime: string;
  room: string;
  type: SessionType;
}

export interface StudentProfile {
  id: number;
  name: string;
  studentId: string;
  className: string;
  faculty: string;
  semester: string;
  avatar: string;
}

/** What the user fills in the task form (no ids / no timestamps). */
export interface TaskInput {
  courseId: number;
  title: string;
  description: string;
  type: TaskType;
  dueDate: string;
  priority: TaskPriority;
  status?: TaskStatus;
}

export type TaskPatch = Partial<TaskInput>;
