import { AppError } from '../../core/errors';
import type { StudyTask } from '../../domain/models';
import type { Loaded, TaskRepository } from '../../domain/repositories';
import { TasksController } from '../controllers/tasks-controller';
import type { TasksState } from '../controllers/tasks-controller';

const NOW = new Date('2026-10-21T09:00:00+07:00');

function makeTask(overrides: Partial<StudyTask> = {}): StudyTask {
  return {
    id: '1',
    courseId: 1,
    title: 'Nộp proposal',
    description: '',
    type: 'Assignment',
    dueDate: '2026-10-22T17:00:00+07:00',
    priority: 'High',
    status: 'todo',
    createdAt: '2026-10-14T08:00:00+07:00',
    updatedAt: '2026-10-14T08:00:00+07:00',
    ...overrides,
  };
}

const loaded = (
  data: StudyTask[],
  origin: Loaded<StudyTask[]>['origin'] = 'network',
): Loaded<StudyTask[]> => ({
  data,
  origin,
  savedAt: origin === 'cache' ? NOW.getTime() - 120_000 : NOW.getTime(),
});

function createRepository(overrides: Partial<TaskRepository> = {}) {
  const task = makeTask();
  const repository: TaskRepository = {
    loadTasks: jest.fn().mockResolvedValue(loaded([task], 'cache')),
    refreshTasks: jest.fn().mockResolvedValue(loaded([task], 'network')),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    setTaskStatus: jest.fn().mockResolvedValue({ task, synced: true }),
    deleteTask: jest.fn().mockResolvedValue({ synced: true }),
    syncPending: jest.fn().mockResolvedValue({ processed: 0, remaining: 0 }),
    pendingCount: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
  return repository;
}

function createController(repository: TaskRepository) {
  return new TasksController({
    taskRepository: repository,
    courseRepository: {
      loadCourses: jest.fn().mockResolvedValue({ data: [], origin: 'cache', savedAt: 0 }),
      refreshCourses: jest.fn().mockResolvedValue({ data: [], origin: 'network', savedAt: 0 }),
    },
    clock: () => NOW,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function recordStates(controller: TasksController): TasksState[] {
  const states: TasksState[] = [];
  controller.subscribe(() => states.push(controller.getState()));
  return states;
}

describe('TasksController', () => {
  it('goes loading → ready and prefers fresh network data', async () => {
    const controller = createController(createRepository());
    const states = recordStates(controller);

    await controller.load();

    expect(states[0].status).toBe('loading');
    expect(controller.getState()).toMatchObject({ status: 'ready', offline: false });
    expect(controller.getState().tasks).toHaveLength(1);
  });

  it('exposes an error state with a retryable message when nothing is cached', async () => {
    const controller = createController(
      createRepository({
        loadTasks: jest.fn().mockRejectedValue(AppError.offline()),
        refreshTasks: jest.fn().mockRejectedValue(AppError.offline()),
      }),
    );

    await controller.load();

    const state = controller.getState();
    expect(state.status).toBe('error');
    expect(state.error?.kind).toBe('offline');
    expect(state.error?.userMessage).toContain('kết nối mạng');
  });

  it('keeps cached data and flags offline when the refresh fails', async () => {
    const controller = createController(
      createRepository({
        loadTasks: jest.fn().mockResolvedValue(loaded([makeTask()], 'cache')),
        refreshTasks: jest.fn().mockResolvedValue(loaded([makeTask()], 'cache')),
      }),
    );

    await controller.load();

    const state = controller.getState();
    expect(state.status).toBe('ready');
    expect(state.offline).toBe(true);
    expect(state.tasks).toHaveLength(1);
  });

  it('toggles a task optimistically and keeps the server result', async () => {
    const done = makeTask({ status: 'done', updatedAt: NOW.toISOString() });
    const repository = createRepository({
      setTaskStatus: jest.fn().mockResolvedValue({ task: done, synced: true }),
    });
    const controller = createController(repository);
    await controller.load();

    await controller.toggleDone('1');

    expect(repository.setTaskStatus).toHaveBeenCalledWith('1', 'done');
    expect(controller.getState().tasks[0].status).toBe('done');
    expect(controller.getState().actionError).toBeNull();
  });

  it('rolls the toggle back when the repository fails', async () => {
    const repository = createRepository({
      setTaskStatus: jest.fn().mockRejectedValue(AppError.http(500)),
    });
    const controller = createController(repository);
    await controller.load();

    await controller.toggleDone('1');

    const state = controller.getState();
    expect(state.tasks[0].status).toBe('todo');
    expect(state.actionError?.kind).toBe('http');
  });

  it('reports offline when a write was only queued', async () => {
    const repository = createRepository({
      setTaskStatus: jest.fn().mockResolvedValue({ task: makeTask({ status: 'done' }), synced: false }),
      pendingCount: jest.fn().mockResolvedValue(1),
    });
    const controller = createController(repository);
    await controller.load();

    await controller.toggleDone('1');

    expect(controller.getState().offline).toBe(true);
    expect(controller.getState().pending).toBe(1);
  });

  it('removes the task from the list after a successful delete', async () => {
    const controller = createController(createRepository());
    await controller.load();

    const removed = await controller.deleteTask('1');

    expect(removed).toBe(true);
    expect(controller.getState().tasks).toHaveLength(0);
  });

  it('stores the selected filter', async () => {
    const controller = createController(createRepository());
    await controller.load();

    controller.setFilter('overdue');

    expect(controller.getState().filter).toBe('overdue');
  });

  // ─────────────────────────────────────────── request ordering (regression tests)
  it('ignores a slow earlier load that resolves after a newer one', async () => {
    const slow = deferred<Loaded<StudyTask[]>>();
    const fast = deferred<Loaded<StudyTask[]>>();
    const loadTasks = jest.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const controller = createController(
      createRepository({
        loadTasks,
        refreshTasks: jest.fn().mockRejectedValue(AppError.offline()),
      }),
    );

    // Two loads overlap: the screen regains focus while the first request is still open.
    const firstLoad = controller.load();
    const secondLoad = controller.load();

    fast.resolve(loaded([makeTask({ id: '2', title: 'Mới' })]));
    await secondLoad;

    // The older response arrives last and must NOT overwrite the fresher list.
    slow.resolve(loaded([makeTask({ id: '1', title: 'Cũ' })]));
    await firstLoad;

    expect(controller.getState().tasks.map((task) => task.title)).toEqual(['Mới']);
  });

  it('does not let a background refresh revert an optimistic toggle', async () => {
    const inFlight = deferred<Loaded<StudyTask[]>>();
    const repository = createRepository({
      refreshTasks: jest
        .fn()
        .mockResolvedValueOnce(loaded([makeTask()])) // the silent refresh started by load()
        .mockReturnValueOnce(inFlight.promise), // the one we will race against the toggle
      setTaskStatus: jest.fn().mockResolvedValue({ task: makeTask({ status: 'done' }), synced: true }),
    });
    const controller = createController(repository);
    await controller.load();

    const refreshing = controller.refresh();
    await controller.toggleDone('1'); // the user ticks the checkbox while the refresh is open

    // The snapshot was built before the write, so it still says "todo".
    inFlight.resolve(loaded([makeTask({ status: 'todo' })]));
    await refreshing;

    expect(controller.getState().tasks[0].status).toBe('done');
  });
});
