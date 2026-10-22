import type { Clock } from '../../core/clock';
import { toAppError, type AppError } from '../../core/errors';
import type { Course, Session, StudentProfile, StudyTask } from '../../domain/models';
import type {
  CourseRepository,
  ProfileRepository,
  ScheduleRepository,
  TaskRepository,
} from '../../domain/repositories';
import type { ScreenStatus } from '../state/async-slice';
import { ObservableStore } from '../state/observable-store';
import { RequestTracker } from '../state/request-tracker';

export type HomeState = {
  status: ScreenStatus;
  error: AppError | null;
  profile: StudentProfile | null;
  courses: Course[];
  sessions: Session[];
  tasks: StudyTask[];
  isRefreshing: boolean;
  offline: boolean;
  savedAt: number | null;
  pending: number;
};

type Deps = {
  profileRepository: ProfileRepository;
  courseRepository: CourseRepository;
  scheduleRepository: ScheduleRepository;
  taskRepository: TaskRepository;
  clock: Clock;
};

const initialState = (): HomeState => ({
  status: 'idle',
  error: null,
  profile: null,
  courses: [],
  sessions: [],
  tasks: [],
  isRefreshing: false,
  offline: false,
  savedAt: null,
  pending: 0,
});

/**
 * ViewModel for the "Hôm nay" dashboard: today's classes, the next class, upcoming
 * deadlines and the overall completion rate. All the calculations themselves live in
 * `domain/task-rules.ts` and `domain/schedule.ts` — this class only owns state.
 */
export class HomeController extends ObservableStore<HomeState> {
  /** Drops stale responses (see `RequestTracker`). */
  private readonly requests = new RequestTracker();

  constructor(private readonly deps: Deps) {
    super(initialState());
  }

  load = async (): Promise<void> => {
    const { token } = this.requests.begin();
    const hasData = this.getState().tasks.length > 0 || this.getState().sessions.length > 0;
    this.setState({ status: hasData ? 'ready' : 'loading', error: null });

    const [profile, courses, sessions, tasks] = await Promise.allSettled([
      this.deps.profileRepository.loadProfile(),
      this.deps.courseRepository.loadCourses(),
      this.deps.scheduleRepository.loadSessions(),
      this.deps.taskRepository.loadTasks(),
    ]);
    if (!this.requests.isLatest(token)) return;

    if (tasks.status === 'rejected' && sessions.status === 'rejected') {
      // Both the timetable and the tasks are unavailable: show the error that happened.
      // (Tasks first, because a missing deadline list is the harder failure to ignore.)
      this.setState({ status: 'error', error: toAppError(tasks.reason) });
      return;
    }

    if (
      tasks.status === 'rejected' &&
      this.getState().tasks.length === 0 &&
      this.getState().sessions.length === 0
    ) {
      this.setState({ status: 'error', error: toAppError(tasks.reason) });
      return;
    }

    this.setState({
      status: 'ready',
      error: null,
      profile: profile.status === 'fulfilled' ? profile.value.data : this.getState().profile,
      courses: courses.status === 'fulfilled' ? courses.value.data : this.getState().courses,
      sessions: sessions.status === 'fulfilled' ? sessions.value.data : this.getState().sessions,
      tasks: tasks.status === 'fulfilled' ? tasks.value.data : this.getState().tasks,
      savedAt: tasks.status === 'fulfilled' ? tasks.value.savedAt : this.getState().savedAt,
      pending: await this.deps.taskRepository.pendingCount(),
    });

    await this.revalidate('silent');
  };

  refresh = async (): Promise<void> => {
    await this.revalidate('user');
  };

  private revalidate = async (mode: 'silent' | 'user'): Promise<void> => {
    const { token } = this.requests.begin();
    if (mode === 'user') this.setState({ isRefreshing: true });

    const [profile, courses, sessions, tasks] = await Promise.allSettled([
      this.deps.profileRepository.refreshProfile(),
      this.deps.courseRepository.refreshCourses(),
      this.deps.scheduleRepository.refreshSessions(),
      this.deps.taskRepository.refreshTasks(),
    ]);
    if (!this.requests.isLatest(token)) return;

    const offline =
      tasks.status === 'rejected' ||
      (tasks.status === 'fulfilled' && tasks.value.origin === 'cache') ||
      (sessions.status === 'fulfilled' && sessions.value.origin === 'cache');

    this.setState({
      profile: profile.status === 'fulfilled' ? profile.value.data : this.getState().profile,
      courses: courses.status === 'fulfilled' ? courses.value.data : this.getState().courses,
      sessions: sessions.status === 'fulfilled' ? sessions.value.data : this.getState().sessions,
      tasks: tasks.status === 'fulfilled' ? tasks.value.data : this.getState().tasks,
      savedAt: tasks.status === 'fulfilled' ? tasks.value.savedAt : this.getState().savedAt,
      offline,
      pending: await this.deps.taskRepository.pendingCount(),
      ...(mode === 'user' ? { isRefreshing: false } : {}),
    });
  };
}
