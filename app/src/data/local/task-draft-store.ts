import type { TaskPriority, TaskType } from '../../domain/models';
import { toAppError } from '../../core/errors';
import type { KeyValueStore } from './key-value-store';

/** The part of the form worth restoring after a rotation, a background kill or a crash. */
export type TaskDraft = {
  title: string;
  description: string;
  courseId: number | null;
  type: TaskType;
  dueDateText: string;
  priority: TaskPriority;
};

const KEY_PREFIX = 'draft:task-form';

function keyFor(taskId?: string | null): string {
  return taskId ? `${KEY_PREFIX}:${taskId}` : KEY_PREFIX;
}

/**
 * Stores the create/edit form while the user is typing.
 *
 * Why it exists: `INSTRUCTION.md` §6 (B1) asks that user input survives rotation, and
 * Android may also kill the activity in the background ("Don't keep activities"), which
 * would drop a half-typed deadline. The draft is written on every change (the payload is
 * a few hundred bytes) and removed once the form is saved or explicitly discarded.
 */
export class TaskDraftStore {
  constructor(private readonly store: KeyValueStore) {}

  async load(taskId?: string | null): Promise<TaskDraft | null> {
    try {
      const raw = await this.store.getItem(keyFor(taskId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<TaskDraft>;
      if (typeof parsed?.title !== 'string' || typeof parsed?.dueDateText !== 'string') return null;
      return {
        title: parsed.title,
        description: typeof parsed.description === 'string' ? parsed.description : '',
        courseId: typeof parsed.courseId === 'number' ? parsed.courseId : null,
        type: (parsed.type ?? 'Assignment') as TaskType,
        dueDateText: parsed.dueDateText,
        priority: (parsed.priority ?? 'Medium') as TaskPriority,
      };
    } catch (error) {
      // A broken draft must never block the form: fall back to the defaults.
      if (error instanceof SyntaxError) return null;
      throw toAppError(error);
    }
  }

  async save(draft: TaskDraft, taskId?: string | null): Promise<void> {
    try {
      await this.store.setItem(keyFor(taskId), JSON.stringify(draft));
    } catch (error) {
      throw toAppError(error);
    }
  }

  async clear(taskId?: string | null): Promise<void> {
    try {
      await this.store.removeItem(keyFor(taskId));
    } catch (error) {
      throw toAppError(error);
    }
  }
}
