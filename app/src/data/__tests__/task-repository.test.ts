import { AppError } from '../../core/errors';
import type { NetworkMonitor } from '../../core/network-monitor';
import type { StudyTask } from '../../domain/models';
import { JsonCache } from '../local/json-cache';
import { MemoryKeyValueStore } from '../local/key-value-store';
import { Outbox } from '../local/outbox';
import type { StudyApi } from '../remote/study-api';
import { TaskRepositoryImpl } from '../repositories/task-repository';

class ToggleNetworkMonitor implements NetworkMonitor {
  constructor(public online = true) {}
  async isOnline(): Promise<boolean> {
    return this.online;
  }
  subscribe(): () => void {
    return () => undefined;
  }
}

const NOW = new Date('2026-10-21T09:00:00+07:00');

function makeTask(overrides: Partial<StudyTask> = {}): StudyTask {
  return {
    id: '1',
    courseId: 1,
    title: 'Nộp proposal',
    description: 'Mô tả',
    type: 'Assignment',
    dueDate: '2026-10-22T17:00:00+07:00',
    priority: 'High',
    status: 'todo',
    createdAt: '2026-10-14T08:00:00+07:00',
    updatedAt: '2026-10-14T08:00:00+07:00',
    ...overrides,
  };
}

function setup() {
  const store = new MemoryKeyValueStore();
  const cache = new JsonCache(store, 'cache');
  const outbox = new Outbox(store);
  const monitor = new ToggleNetworkMonitor();

  const api = {
    fetchTasks: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    fetchCourses: jest.fn(),
    fetchSessions: jest.fn(),
    fetchProfile: jest.fn(),
  } as unknown as StudyApi & {
    fetchTasks: jest.Mock;
    createTask: jest.Mock;
    updateTask: jest.Mock;
    deleteTask: jest.Mock;
  };

  const repository = new TaskRepositoryImpl({
    api,
    cache,
    outbox,
    network: monitor,
    clock: () => NOW,
  });

  return { repository, api, cache, outbox, monitor, store };
}

describe('TaskRepositoryImpl', () => {
  it('loads from the API and writes a cache snapshot on refresh', async () => {
    const { repository, api, cache } = setup();
    api.fetchTasks.mockResolvedValue([makeTask()]);

    const result = await repository.refreshTasks();

    expect(result.origin).toBe('network');
    expect(result.data).toHaveLength(1);
    const cached = await cache.read<StudyTask[]>('tasks');
    expect(cached?.value).toHaveLength(1);
    expect(cached?.savedAt).toBe(NOW.getTime());
  });

  it('serves the cache first and only then goes to the network', async () => {
    const { repository, api, cache } = setup();
    await cache.write('tasks', [makeTask({ id: 'cached' })], NOW.getTime() - 60_000);

    const loaded = await repository.loadTasks();

    expect(loaded.origin).toBe('cache');
    expect(loaded.data[0].id).toBe('cached');
    expect(api.fetchTasks).not.toHaveBeenCalled();
  });

  it('falls back to the cache when the refresh fails (airplane mode)', async () => {
    const { repository, api, cache, monitor } = setup();
    await cache.write('tasks', [makeTask({ id: 'cached' })], NOW.getTime() - 60_000);
    monitor.online = false;

    const result = await repository.refreshTasks();

    expect(result.origin).toBe('cache');
    expect(result.data[0].id).toBe('cached');
    expect(api.fetchTasks).not.toHaveBeenCalled();
  });

  it('throws an offline AppError when there is neither network nor cache', async () => {
    const { repository, monitor } = setup();
    monitor.online = false;

    await expect(repository.refreshTasks()).rejects.toMatchObject({ kind: 'offline' });
  });

  it('queues a create while offline and keeps the task visible', async () => {
    const { repository, cache, outbox, monitor } = setup();
    await cache.write('tasks', [], NOW.getTime());
    monitor.online = false;

    const result = await repository.createTask({
      courseId: 1,
      title: 'Bài tập offline',
      description: '',
      type: 'Assignment',
      dueDate: '2026-10-30T17:00:00+07:00',
      priority: 'Medium',
    });

    expect(result.synced).toBe(false);
    expect(result.task.id).toMatch(/^local-/);
    expect(await outbox.size()).toBe(1);
    const cached = await cache.read<StudyTask[]>('tasks');
    expect(cached?.value.map((task) => task.title)).toEqual(['Bài tập offline']);
  });

  it('replays the queued create when connectivity returns', async () => {
    const { repository, api, cache, monitor } = setup();
    await cache.write('tasks', [], NOW.getTime());
    monitor.online = false;
    const queued = await repository.createTask({
      courseId: 1,
      title: 'Bài tập offline',
      description: '',
      type: 'Assignment',
      dueDate: '2026-10-30T17:00:00+07:00',
      priority: 'Medium',
    });

    monitor.online = true;
    api.createTask.mockResolvedValue(makeTask({ id: '42', title: 'Bài tập offline' }));

    const syncResult = await repository.syncPending();

    expect(syncResult).toMatchObject({ processed: 1, remaining: 0 });
    expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bài tập offline' }));
    const cached = await cache.read<StudyTask[]>('tasks');
    expect(cached?.value.map((task) => task.id)).toEqual(['42']);
    expect(queued.task.id).toMatch(/^local-/);
  });

  it('does not lose a queued change when a refresh returns the old server list', async () => {
    const { repository, api, cache, monitor } = setup();
    const remote = makeTask({ id: '1', title: 'Tên cũ' });
    await cache.write('tasks', [remote], NOW.getTime());
    monitor.online = false;

    await repository.updateTask('1', { title: 'Tên mới' });
    expect(await repository.pendingCount()).toBe(1);

    monitor.online = true;
    api.fetchTasks.mockResolvedValue([remote]); // server still has the old title

    const result = await repository.refreshTasks();

    expect(result.data[0].title).toBe('Tên mới');
    expect(result.data[0].pendingSync).toBe(true);
  });

  it('replays the queue only once when two syncs start at the same time', async () => {
    const { repository, api, cache, monitor } = setup();
    await cache.write('tasks', [], NOW.getTime());
    monitor.online = false;
    await repository.createTask({
      courseId: 1,
      title: 'Bài tập offline',
      description: '',
      type: 'Assignment',
      dueDate: '2026-10-30T17:00:00+07:00',
      priority: 'Medium',
    });
    monitor.online = true;
    api.createTask.mockResolvedValue(makeTask({ id: '42', title: 'Bài tập offline' }));

    // The connectivity listener, the "Đồng bộ ngay" button and the foreground event
    // can all fire together: the create must still be POSTed exactly once.
    const [first, second] = await Promise.all([repository.syncPending(), repository.syncPending()]);

    expect(api.createTask).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ processed: 1, remaining: 0 });
  });

  it('does not queue writes that failed for a non-connectivity reason', async () => {
    const { repository, api, cache, outbox } = setup();
    await cache.write('tasks', [], NOW.getTime());
    api.createTask.mockRejectedValue(AppError.http(422, 'Invalid payload'));

    await expect(
      repository.createTask({
        courseId: 1,
        title: 'Sai dữ liệu',
        description: '',
        type: 'Assignment',
        dueDate: '2026-10-30T17:00:00+07:00',
        priority: 'Medium',
      }),
    ).rejects.toMatchObject({ kind: 'http', status: 422 });

    expect(await outbox.size()).toBe(0);
  });

  it('queues a delete while offline and removes it from the cache', async () => {
    const { repository, cache, monitor, outbox } = setup();
    await cache.write('tasks', [makeTask({ id: '1' })], NOW.getTime());
    monitor.online = false;

    const result = await repository.deleteTask('1');

    expect(result.synced).toBe(false);
    expect(await outbox.size()).toBe(1);
    const cached = await cache.read<StudyTask[]>('tasks');
    expect(cached?.value).toHaveLength(0);
  });
});
