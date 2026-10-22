import { AppError } from '../../core/errors';
import type { Course, Session, StudentProfile, StudyTask } from '../../domain/models';
import type { Loaded } from '../../domain/repositories';
import { HomeController } from '../controllers/home-controller';

const NOW = new Date('2026-10-21T09:00:00+07:00');

const loaded = <T>(data: T, origin: Loaded<T>['origin'] = 'network'): Loaded<T> => ({
  data,
  origin,
  savedAt: NOW.getTime(),
});

const profile: StudentProfile = {
  id: 1,
  name: 'Nguyễn Đức Hà Hùng',
  studentId: 'B23DCCE039',
  className: 'D23CQCE01-B',
  faculty: 'Công nghệ thông tin 1',
  semester: 'Học kỳ 1 · 2026-2027',
  avatar: '',
};

const course: Course = {
  id: 1,
  code: 'INT1449',
  name: 'Phát triển ứng dụng di động',
  lecturer: 'TS. Nguyễn Văn A',
  room: 'A2-301',
  credits: 3,
  color: '#2563eb',
};

const session: Session = {
  id: '1',
  courseId: 1,
  dayOfWeek: 3,
  startTime: '09:30',
  endTime: '11:30',
  room: 'A2-301',
  type: 'Lecture',
};

const task: StudyTask = {
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
};

type Overrides = {
  profile?: () => Promise<Loaded<StudentProfile>>;
  courses?: () => Promise<Loaded<Course[]>>;
  sessions?: () => Promise<Loaded<Session[]>>;
  tasks?: () => Promise<Loaded<StudyTask[]>>;
  refreshTasks?: () => Promise<Loaded<StudyTask[]>>;
};

function createController(overrides: Overrides = {}) {
  return new HomeController({
    profileRepository: {
      loadProfile: overrides.profile ?? jest.fn().mockResolvedValue(loaded(profile)),
      refreshProfile: jest.fn().mockResolvedValue(loaded(profile)),
    },
    courseRepository: {
      loadCourses: overrides.courses ?? jest.fn().mockResolvedValue(loaded([course])),
      refreshCourses: jest.fn().mockResolvedValue(loaded([course])),
    },
    scheduleRepository: {
      loadSessions: overrides.sessions ?? jest.fn().mockResolvedValue(loaded([session])),
      refreshSessions: jest.fn().mockResolvedValue(loaded([session])),
    },
    taskRepository: {
      loadTasks: overrides.tasks ?? jest.fn().mockResolvedValue(loaded([task])),
      refreshTasks: overrides.refreshTasks ?? jest.fn().mockResolvedValue(loaded([task])),
      createTask: jest.fn(),
      updateTask: jest.fn(),
      setTaskStatus: jest.fn(),
      deleteTask: jest.fn(),
      syncPending: jest.fn().mockResolvedValue({ processed: 0, remaining: 0 }),
      pendingCount: jest.fn().mockResolvedValue(0),
    },
    clock: () => NOW,
  });
}

describe('HomeController', () => {
  it('renders the dashboard from the repositories', async () => {
    const controller = createController();

    await controller.load();

    const state = controller.getState();
    expect(state.status).toBe('ready');
    expect(state.profile?.name).toBe('Nguyễn Đức Hà Hùng');
    expect(state.tasks).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
  });

  it('shows the tasks error when both the timetable and the tasks fail', async () => {
    const controller = createController({
      tasks: jest.fn().mockRejectedValue(AppError.http(500)),
      sessions: jest.fn().mockRejectedValue(AppError.offline()),
    });

    await controller.load();

    // Regression: the screen used to pick `sessions.reason`, so a server failure on the
    // deadline list was reported as "you are offline" — the retry then never helped.
    const state = controller.getState();
    expect(state.status).toBe('error');
    expect(state.error?.kind).toBe('http');
    expect(state.error?.status).toBe(500);
    expect(state.error?.userMessage).toContain('Máy chủ');
  });

  it('still shows the dashboard when only the timetable fails', async () => {
    const controller = createController({
      sessions: jest.fn().mockRejectedValue(AppError.offline()),
    });

    await controller.load();

    const state = controller.getState();
    expect(state.status).toBe('ready');
    expect(state.error).toBeNull();
    expect(state.tasks).toHaveLength(1);
  });

  it('keeps the list and flags offline when the refresh fails', async () => {
    const controller = createController({
      tasks: jest.fn().mockResolvedValue(loaded([task], 'cache')),
      refreshTasks: jest.fn().mockRejectedValue(AppError.offline()),
    });
    await controller.load();
    expect(controller.getState().status).toBe('ready');

    await controller.refresh();

    const state = controller.getState();
    expect(state.status).toBe('ready');
    expect(state.tasks).toHaveLength(1);
    expect(state.isRefreshing).toBe(false);
    expect(state.offline).toBe(true);
  });
});
