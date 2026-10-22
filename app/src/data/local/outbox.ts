import { toAppError } from '../../core/errors';
import type { KeyValueStore } from './key-value-store';

export type OutboxOperationType = 'create' | 'update' | 'delete';

export type OutboxOperation = {
  id: string;
  entity: 'task';
  type: OutboxOperationType;
  /** `create`/`update` carry the full task, `delete` carries `{ id }`. */
  payload: Record<string, unknown>;
  createdAt: number;
};

/**
 * The write queue that makes the app work offline.
 *
 * A write is applied to the local cache immediately (optimistic UI) and appended here.
 * When connectivity returns, `TaskRepositoryImpl.syncPending()` replays the queue in
 * FIFO order, which is what keeps "create → update → delete" of a task consistent.
 */
export class Outbox {
  /**
   * Every mutation is a read-modify-write on one JSON array, so two writes started in
   * the same tick (e.g. the user unticks two checkboxes quickly while offline) could
   * read the same list and the second `persist` would drop the first operation.
   * Chaining them on one promise makes the outbox effectively single-threaded.
   */
  private mutationChain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string = 'outbox:operations',
  ) {}

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.mutationChain.then(task, task);
    // keep the chain alive even when a mutation fails
    this.mutationChain = run.catch(() => undefined);
    return run;
  }

  async list(): Promise<OutboxOperation[]> {
    const raw = await this.store.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OutboxOperation[]) : [];
    } catch {
      return [];
    }
  }

  async size(): Promise<number> {
    return (await this.list()).length;
  }

  enqueue(operation: Omit<OutboxOperation, 'id' | 'createdAt'> & { id?: string }): Promise<OutboxOperation> {
    return this.serialize(async () => {
      const operations = await this.list();
      const entry: OutboxOperation = {
        ...operation,
        id: operation.id ?? `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
      };
      operations.push(entry);
      await this.persist(operations);
      return entry;
    });
  }

  /** Rewrites a queued operation, e.g. when the user edits a task that was created offline. */
  update(id: string, changes: Partial<Omit<OutboxOperation, 'id'>>): Promise<void> {
    return this.serialize(async () => {
      const operations = await this.list();
      await this.persist(
        operations.map((operation) => (operation.id === id ? { ...operation, ...changes } : operation)),
      );
    });
  }

  remove(id: string): Promise<void> {
    return this.serialize(async () => {
      const operations = await this.list();
      await this.persist(operations.filter((operation) => operation.id !== id));
    });
  }

  clear(): Promise<void> {
    return this.serialize(() => this.store.removeItem(this.key));
  }

  private async persist(operations: OutboxOperation[]): Promise<void> {
    try {
      await this.store.setItem(this.key, JSON.stringify(operations));
    } catch (error) {
      throw toAppError(error);
    }
  }
}
