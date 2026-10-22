import type { Clock } from '../../core/clock';
import { AppError, isAppError, toAppError } from '../../core/errors';
import type { NetworkMonitor } from '../../core/network-monitor';
import type { StudyTask, TaskInput, TaskPatch, TaskStatus } from '../../domain/models';
import type { Loaded, TaskRepository } from '../../domain/repositories';
import { sortTasks } from '../../domain/task-rules';
import type { JsonCache } from '../local/json-cache';
import type { Outbox } from '../local/outbox';
import type { StudyApi } from '../remote/study-api';

const TASKS_CACHE_KEY = 'tasks';

type Deps = {
  api: StudyApi;
  cache: JsonCache;
  outbox: Outbox;
  network: NetworkMonitor;
  clock: Clock;
};

/** Only a real connectivity loss is queued. A timeout may have reached the server. */
function shouldQueue(error: AppError): boolean {
  return error.kind === 'offline';
}

function toInput(task: StudyTask): TaskInput {
  return {
    courseId: task.courseId,
    title: task.title,
    description: task.description,
    type: task.type,
    dueDate: task.dueDate,
    priority: task.priority,
    status: task.status,
  };
}

/**
 * Offline-first task repository.
 *
 * Read  : cache → paint → refresh in the background (the view-model decides when).
 * Write : apply locally first, then try the API; if the device is offline the
 *         operation goes to the `Outbox` and is replayed later.
 *
 * This class is the only place that knows about the cache + outbox combination,
 * which is why the whole offline story fits in one file that a student can explain.
 */
export class TaskRepositoryImpl implements TaskRepository {
  /**
   * `syncPending()` can be triggered by three things at once — the connectivity
   * listener, the "Đồng bộ ngay" button and the app returning to the foreground.
   * Without this guard the same queued `create` could be POSTed twice and the user
   * would see a duplicated task. Callers share the in-flight promise instead.
   */
  private syncInFlight: Promise<{ processed: number; remaining: number }> | null = null;

  constructor(private readonly deps: Deps) {}

  async loadTasks(): Promise<Loaded<StudyTask[]>> {
    const cached = await this.deps.cache.read<StudyTask[]>(TASKS_CACHE_KEY);
    if (cached) {
      return { data: sortTasks(cached.value), origin: 'cache', savedAt: cached.savedAt };
    }
    return this.refreshTasks();
  }

  async refreshTasks(): Promise<Loaded<StudyTask[]>> {
    try {
      const online = await this.deps.network.isOnline();
      if (!online) throw AppError.offline();

      const remote = await this.deps.api.fetchTasks();
      const merged = await this.applyPendingOperations(remote);
      const savedAt = this.deps.clock().getTime();
      await this.deps.cache.write(TASKS_CACHE_KEY, merged, savedAt);
      return { data: sortTasks(merged), origin: 'network', savedAt };
    } catch (error) {
      const cached = await this.deps.cache.read<StudyTask[]>(TASKS_CACHE_KEY);
      if (cached) {
        return { data: sortTasks(cached.value), origin: 'cache', savedAt: cached.savedAt };
      }
      throw toAppError(error);
    }
  }

  async createTask(input: TaskInput): Promise<{ task: StudyTask; synced: boolean }> {
    const now = this.deps.clock();
    const draft: StudyTask = {
      id: `local-${now.getTime()}`,
      courseId: input.courseId,
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type,
      dueDate: new Date(input.dueDate).toISOString(),
      priority: input.priority,
      status: input.status ?? 'todo',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      const online = await this.deps.network.isOnline();
      if (!online) throw AppError.offline();

      const created = await this.deps.api.createTask({ ...input, dueDate: draft.dueDate });
      await this.upsertCache(created);
      return { task: created, synced: true };
    } catch (error) {
      const appError = toAppError(error);
      if (!shouldQueue(appError)) throw appError;

      const pending: StudyTask = { ...draft, pendingSync: true };
      await this.deps.outbox.enqueue({
        entity: 'task',
        type: 'create',
        payload: pending as unknown as Record<string, unknown>,
      });
      await this.upsertCache(pending);
      return { task: pending, synced: false };
    }
  }

  async updateTask(id: string, patch: TaskPatch): Promise<{ task: StudyTask; synced: boolean }> {
    const cached = await this.readCachedTasks();
    const existing = cached.find((task) => task.id === id);
    if (!existing) {
      throw new AppError('unknown', { userMessage: 'Không tìm thấy công việc này.' });
    }

    const optimistic: StudyTask = {
      ...existing,
      ...patch,
      dueDate: patch.dueDate ? new Date(patch.dueDate).toISOString() : existing.dueDate,
      updatedAt: this.deps.clock().toISOString(),
    };
    await this.upsertCache(optimistic);

    // A task that only exists on the device: rewrite the queued create instead of
    // sending an update for an id the server has never seen.
    if (id.startsWith('local-')) {
      await this.rewritePendingCreate(optimistic);
      return { task: { ...optimistic, pendingSync: true }, synced: false };
    }

    try {
      const online = await this.deps.network.isOnline();
      if (!online) throw AppError.offline();

      const updated = await this.deps.api.updateTask(id, patch);
      await this.upsertCache(updated);
      return { task: updated, synced: true };
    } catch (error) {
      const appError = toAppError(error);
      if (!shouldQueue(appError)) {
        await this.upsertCache(existing); // roll the optimistic change back
        throw appError;
      }
      await this.deps.outbox.enqueue({
        entity: 'task',
        type: 'update',
        payload: { ...optimistic, pendingSync: undefined } as unknown as Record<string, unknown>,
      });
      return { task: { ...optimistic, pendingSync: true }, synced: false };
    }
  }

  setTaskStatus(id: string, status: TaskStatus): Promise<{ task: StudyTask; synced: boolean }> {
    return this.updateTask(id, { status });
  }

  async deleteTask(id: string): Promise<{ synced: boolean }> {
    const cached = await this.readCachedTasks();
    const existing = cached.find((task) => task.id === id);
    await this.removeFromCache(id);

    if (id.startsWith('local-')) {
      const operations = await this.deps.outbox.list();
      const pendingCreate = operations.find(
        (operation) => operation.type === 'create' && operation.payload.id === id,
      );
      if (pendingCreate) await this.deps.outbox.remove(pendingCreate.id);
      return { synced: false };
    }

    try {
      const online = await this.deps.network.isOnline();
      if (!online) throw AppError.offline();

      await this.deps.api.deleteTask(id);
      return { synced: true };
    } catch (error) {
      const appError = toAppError(error);
      if (!shouldQueue(appError)) {
        if (existing) await this.upsertCache(existing);
        throw appError;
      }
      await this.deps.outbox.enqueue({ entity: 'task', type: 'delete', payload: { id } });
      return { synced: false };
    }
  }

  syncPending(): Promise<{ processed: number; remaining: number }> {
    if (this.syncInFlight) return this.syncInFlight;

    this.syncInFlight = this.runSync().finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  private async runSync(): Promise<{ processed: number; remaining: number }> {
    const operations = await this.deps.outbox.list();
    let processed = 0;

    for (const operation of operations) {
      const payload = operation.payload as unknown as StudyTask;
      try {
        if (operation.type === 'create') {
          const created = await this.deps.api.createTask(toInput(payload));
          await this.replaceInCache(payload.id, created);
        } else if (operation.type === 'update') {
          const updated = await this.deps.api.updateTask(payload.id, toInput(payload));
          await this.upsertCache(updated);
        } else {
          await this.deps.api.deleteTask(payload.id);
        }
        await this.deps.outbox.remove(operation.id);
        processed += 1;
      } catch (error) {
        const appError = toAppError(error);
        if (isAppError(appError) && appError.kind === 'http' && appError.status === 404) {
          // The task no longer exists on the server: the operation is irrelevant.
          await this.deps.outbox.remove(operation.id);
          continue;
        }
        // Keep FIFO order: stop at the first failure and retry on the next sync.
        break;
      }
    }

    return { processed, remaining: await this.deps.outbox.size() };
  }

  pendingCount(): Promise<number> {
    return this.deps.outbox.size();
  }

  /** Superimposes queued local writes on top of the server list. */
  private async applyPendingOperations(remote: StudyTask[]): Promise<StudyTask[]> {
    const operations = await this.deps.outbox.list();
    let result = [...remote];

    for (const operation of operations) {
      const payload = operation.payload as unknown as StudyTask;
      if (operation.type === 'create') {
        result.push({ ...payload, pendingSync: true });
      } else if (operation.type === 'update') {
        result = result.map((task) =>
          task.id === payload.id ? { ...task, ...payload, pendingSync: true } : task,
        );
      } else {
        result = result.filter((task) => task.id !== payload.id);
      }
    }
    return result;
  }

  private async rewritePendingCreate(task: StudyTask): Promise<void> {
    const operations = await this.deps.outbox.list();
    const pendingCreate = operations.find(
      (operation) => operation.type === 'create' && operation.payload.id === task.id,
    );
    if (pendingCreate) {
      await this.deps.outbox.update(pendingCreate.id, {
        payload: { ...task, pendingSync: true } as unknown as Record<string, unknown>,
      });
    } else {
      await this.deps.outbox.enqueue({
        entity: 'task',
        type: 'update',
        payload: { ...task, pendingSync: true } as unknown as Record<string, unknown>,
      });
    }
  }

  private async readCachedTasks(): Promise<StudyTask[]> {
    const cached = await this.deps.cache.read<StudyTask[]>(TASKS_CACHE_KEY);
    return cached?.value ?? [];
  }

  private async writeCachedTasks(tasks: StudyTask[]): Promise<void> {
    await this.deps.cache.write(TASKS_CACHE_KEY, tasks, this.deps.clock().getTime());
  }

  private async upsertCache(task: StudyTask): Promise<void> {
    const tasks = await this.readCachedTasks();
    const index = tasks.findIndex((candidate) => candidate.id === task.id);
    if (index >= 0) tasks[index] = task;
    else tasks.push(task);
    await this.writeCachedTasks(tasks);
  }

  private async replaceInCache(oldId: string, task: StudyTask): Promise<void> {
    const tasks = await this.readCachedTasks();
    const index = tasks.findIndex((candidate) => candidate.id === oldId);
    if (index >= 0) tasks[index] = task;
    else tasks.push(task);
    await this.writeCachedTasks(tasks);
  }

  private async removeFromCache(id: string): Promise<void> {
    const tasks = await this.readCachedTasks();
    await this.writeCachedTasks(tasks.filter((task) => task.id !== id));
  }
}
