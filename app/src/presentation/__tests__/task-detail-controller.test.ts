import type { Course, StudyTask } from '../../domain/models';
import type { CourseRepository, Loaded, TaskRepository } from '../../domain/repositories';
import { TaskDetailController } from '../controllers/task-detail-controller';

const NOW = new Date('2026-10-21T09:00:00+07:00');

const COURSE: Course = {
  id: 1,
  code: 'INT1449',
  name: 'Phát triển ứng dụng di động',
  lecturer: 'TS. Nguyễn Văn A',
  credits: 3,
  color: '#2F6FED',
  room: 'A2-301',
};

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

const loaded = <T>(data: T): Loaded<T> => ({ data, origin: 'network', savedAt: NOW.getTime() });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup(overrides: Partial<TaskRepository> = {}) {
  const task = makeTask();
  const taskRepository: TaskRepository = {
    loadTasks: jest.fn().mockResolvedValue(loaded([task])),
    refreshTasks: jest.fn().mockResolvedValue(loaded([task])),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    setTaskStatus: jest.fn().mockResolvedValue({ task: { ...task, status: 'done' }, synced: true }),
    deleteTask: jest.fn().mockResolvedValue({ synced: true }),
    syncPending: jest.fn().mockResolvedValue({ processed: 0, remaining: 0 }),
    pendingCount: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
  const courseRepository: CourseRepository = {
    loadCourses: jest.fn().mockResolvedValue(loaded([COURSE])),
    refreshCourses: jest.fn().mockResolvedValue(loaded([COURSE])),
  };

  return { controller: new TaskDetailController('1', { taskRepository, courseRepository }), taskRepository };
}

describe('TaskDetailController', () => {
  it('loads the task and its course', async () => {
    const { controller } = setup();

    await controller.load();

    expect(controller.getState().status).toBe('ready');
    expect(controller.getState().task?.title).toBe('Nộp proposal');
    expect(controller.courseOf(controller.getState().task)?.code).toBe('INT1449');
  });

  it('shows the not-found (empty) state when the task no longer exists — not a retryable error', async () => {
    const { controller } = setup({ loadTasks: jest.fn().mockResolvedValue(loaded([])) });

    await controller.load();

    // A deleted task is not a failure: retrying the same request would fail identically, so the
    // screen must offer a way back instead of a "Thử lại" button (.docs/testing-guide.md).
    expect(controller.getState().status).toBe('empty');
    expect(controller.getState().error).toBeNull();
    expect(controller.getState().task).toBeNull();
  });

  it('still shows a retryable error when the load itself failed', async () => {
    const { controller } = setup({
      loadTasks: jest.fn().mockRejectedValue(new TypeError('Network request failed')),
    });

    await controller.load();

    expect(controller.getState().status).toBe('error');
    expect(controller.getState().error?.canRetry).toBe(true);
  });

  it('toggles the status optimistically and keeps the server answer', async () => {
    const { controller } = setup();
    await controller.load();

    await controller.toggleDone();

    expect(controller.getState().task?.status).toBe('done');
    expect(controller.getState().busy).toBe(false);
  });

  it('a double tap on delete sends only one request', async () => {
    const inFlight = deferred<{ synced: boolean }>();
    const { controller, taskRepository } = setup({
      deleteTask: jest.fn().mockReturnValue(inFlight.promise),
    });
    await controller.load();

    const firstDelete = controller.remove();
    const secondDelete = controller.remove(); // the second tap lands while the first is open

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(1);
    expect(await secondDelete).toBe(false);

    inFlight.resolve({ synced: true });
    expect(await firstDelete).toBe(true);
  });

  it('ignores a second status change while one is in flight', async () => {
    const inFlight = deferred<{ task: StudyTask; synced: boolean }>();
    const { controller, taskRepository } = setup({
      setTaskStatus: jest.fn().mockReturnValue(inFlight.promise),
    });
    await controller.load();

    const first = controller.setStatus('doing');
    await controller.setStatus('done'); // must be ignored: one request in flight

    inFlight.resolve({ task: makeTask({ status: 'doing' }), synced: true });
    await first;

    expect(taskRepository.setTaskStatus).toHaveBeenCalledTimes(1);
    expect(controller.getState().task?.status).toBe('doing');
  });
});
