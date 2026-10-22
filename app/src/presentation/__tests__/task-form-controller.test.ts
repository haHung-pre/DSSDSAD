import type { StudyTask, TaskInput } from '../../domain/models';
import type { CourseRepository, TaskRepository } from '../../domain/repositories';
import { MemoryKeyValueStore } from '../../data/local/key-value-store';
import { TaskDraftStore } from '../../data/local/task-draft-store';
import { TaskFormController } from '../controllers/task-form-controller';

const NOW = new Date('2026-10-21T09:00:00+07:00');

const COURSES = [
  { id: 1, code: 'INT1449', name: 'Mobile', lecturer: '—', credits: 3, color: '#2F6FED', room: 'A2' },
  { id: 2, code: 'INT1433', name: 'Network', lecturer: '—', credits: 3, color: '#12A594', room: 'A2' },
];

function makeTask(overrides: Partial<StudyTask> = {}): StudyTask {
  return {
    id: '7',
    courseId: 1,
    title: 'Nộp proposal',
    description: 'Ghi chú',
    type: 'Assignment',
    dueDate: '2026-10-22T17:00:00+07:00',
    priority: 'High',
    status: 'todo',
    createdAt: '2026-10-14T08:00:00+07:00',
    updatedAt: '2026-10-14T08:00:00+07:00',
    ...overrides,
  };
}

function setup(tasks: StudyTask[] = [], existingStore?: MemoryKeyValueStore) {
  // The same key/value store can be shared between two setups to simulate a restart.
  const store = existingStore ?? new MemoryKeyValueStore();
  const draftStore = new TaskDraftStore(store);

  const taskRepository: TaskRepository = {
    loadTasks: jest.fn().mockResolvedValue({ data: tasks, origin: 'cache', savedAt: NOW.getTime() }),
    refreshTasks: jest.fn().mockResolvedValue({ data: tasks, origin: 'network', savedAt: NOW.getTime() }),
    createTask: jest.fn().mockImplementation(async (input: TaskInput) => ({
      task: makeTask({ id: '99', ...input }),
      synced: true,
    })),
    updateTask: jest.fn().mockImplementation(async (id: string, patch: Partial<TaskInput>) => ({
      task: makeTask({ id, ...patch }),
      synced: true,
    })),
    setTaskStatus: jest.fn(),
    deleteTask: jest.fn(),
    syncPending: jest.fn(),
    pendingCount: jest.fn().mockResolvedValue(0),
  };

  const courseRepository: CourseRepository = {
    loadCourses: jest.fn().mockResolvedValue({ data: COURSES, origin: 'cache', savedAt: NOW.getTime() }),
    refreshCourses: jest.fn().mockResolvedValue({ data: COURSES, origin: 'network', savedAt: NOW.getTime() }),
  };

  const controller = new TaskFormController({
    taskRepository,
    courseRepository,
    draftStore,
    clock: () => NOW,
  });

  return { controller, taskRepository, draftStore, store };
}

describe('TaskFormController', () => {
  it('fills a default deadline one week ahead at 17:00', async () => {
    const { controller } = setup();
    await controller.init();

    const state = controller.getState();
    expect(state.status).toBe('ready');
    expect(state.values.dueDateText).toBe('2026-10-28 17:00');
    expect(state.values.courseId).toBe(1);
  });

  it('reports validation errors instead of saving', async () => {
    const { controller, taskRepository } = setup();
    await controller.init();

    controller.setField('title', 'ab');
    controller.setField('dueDateText', '2026-02-31');
    const saved = await controller.save();

    expect(saved).toBe(false);
    expect(controller.getState().errors.title).toContain('3 ký tự');
    expect(controller.getState().errors.dueDate).toContain('không hợp lệ');
    expect(taskRepository.createTask).not.toHaveBeenCalled();
  });

  it('creates a task and clears the draft afterwards', async () => {
    const { controller, taskRepository, draftStore } = setup();
    await controller.init();

    controller.setField('title', 'Nộp báo cáo tuần 5');
    await expect(draftStore.load()).resolves.toMatchObject({ title: 'Nộp báo cáo tuần 5' });

    const saved = await controller.save();

    expect(saved).toBe(true);
    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Nộp báo cáo tuần 5', courseId: 1 }),
    );
    expect(controller.getState().lastSynced).toBe(true);
    await expect(draftStore.load()).resolves.toBeNull();
  });

  it('restores unsaved input after the app was killed mid-typing', async () => {
    const first = setup();
    await first.controller.init();
    // every keystroke persists the draft (setField)
    first.controller.setField('title', 'Đang nhập dở');
    first.controller.setField('priority', 'High');

    // a new controller over the same storage = a new mount after rotation / process death
    const revived = setup([], first.store);
    await revived.controller.init();

    expect(revived.controller.getState().values.title).toBe('Đang nhập dở');
    expect(revived.controller.getState().values.priority).toBe('High');
  });

  it('keeps the change but reports "not synced" when the write was queued offline', async () => {
    const { controller, taskRepository } = setup();
    (taskRepository.createTask as jest.Mock).mockResolvedValue({
      task: makeTask({ id: 'local-1' }),
      synced: false,
    });
    await controller.init();
    controller.setField('title', 'Tạo khi mất mạng');

    const saved = await controller.save();

    expect(saved).toBe(true);
    expect(controller.getState().lastSynced).toBe(false);
  });

  it('loads an existing task for editing and saves a patch', async () => {
    const task = makeTask();
    const { controller, taskRepository } = setup([task]);
    await controller.init('7');

    expect(controller.getState().isEditing).toBe(true);
    expect(controller.getState().values.title).toBe('Nộp proposal');

    controller.setField('title', 'Nộp proposal (bản 2)');
    await controller.save();

    expect(taskRepository.updateTask).toHaveBeenCalledWith(
      '7',
      expect.objectContaining({ title: 'Nộp proposal (bản 2)' }),
    );
  });

  it('discardDraft() empties the restored draft', async () => {
    const { controller } = setup();
    await controller.init();
    controller.setField('title', 'Nháp cũ');

    controller.discardDraft();

    expect(controller.getState().values.title).toBe('');
    expect(controller.getState().draftRestored).toBe(false);
  });

  it('a double tap on save creates the task only once', async () => {
    const { controller, taskRepository } = setup();
    await controller.init();
    controller.setField('title', 'Chỉ một lần');

    // Two presses land before React can re-render the button into its loading state.
    const [first, second] = await Promise.all([controller.save(), controller.save()]);

    expect(taskRepository.createTask).toHaveBeenCalledTimes(1);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });

  it('shows the not-found (empty) state when editing a task that was deleted elsewhere', async () => {
    const { controller } = setup([]);

    await controller.init('999');

    expect(controller.getState().status).toBe('empty');
    expect(controller.getState().error).toBeNull();
  });
});
