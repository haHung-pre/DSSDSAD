import type { Clock } from '../../core/clock';
import { AppError, toAppError } from '../../core/errors';
import type { Course, StudyTask, TaskStatus } from '../../domain/models';
import type { CourseRepository, TaskRepository } from '../../domain/repositories';
import { sortTasks, type TaskFilter } from '../../domain/task-rules';
import type { ScreenStatus } from '../state/async-slice';
import { ObservableStore } from '../state/observable-store';
import { RequestTracker } from '../state/request-tracker';

export type TasksState = {
  status: ScreenStatus;
  error: AppError | null;
  tasks: StudyTask[];
  courses: Course[];
  filter: TaskFilter;
  /** Free-text search (title / description / course code). */
  query: string;
  /** Set when the screen was opened from a course card. */
  courseId: number | null;
  isRefreshing: boolean;
  /** True when the last refresh could not reach the API (cached data is shown). */
  offline: boolean;
  savedAt: number | null;
  /** Writes waiting in the outbox. */
  pending: number;
  /** Task ids with a request in flight (row shows a spinner / is disabled). */
  busyTaskIds: string[];
  /** Error from a toggle/delete action — shown in a dismissible inline banner. */
  actionError: AppError | null;
};

type Deps = {
  taskRepository: TaskRepository;
  courseRepository: CourseRepository;
  clock: Clock;
};

const initialState = (): TasksState => ({
  status: 'idle',
  error: null,
  tasks: [],
  courses: [],
  filter: 'all',
  query: '',
  courseId: null,
  isRefreshing: false,
  offline: false,
  savedAt: null,
  pending: 0,
  busyTaskIds: [],
  actionError: null,
});

/**
 * ViewModel for the task list.
 *
 * Load   : cache first (instant), then revalidate in the background.
 * Toggle : optimistic — the checkbox flips immediately and is rolled back if the
 *          repository reports a non-offline failure.
 */
export class TasksController extends ObservableStore<TasksState> {
  /** Drops stale responses and protects optimistic writes (see `RequestTracker`). */
  private readonly requests = new RequestTracker();

  constructor(private readonly deps: Deps) {
    super(initialState());
  }

  load = async (): Promise<void> => {
    const { token } = this.requests.begin();
    const hasData = this.getState().tasks.length > 0;
    this.setState({ status: hasData ? 'ready' : 'loading', error: null });

    try {
      const [loaded, courses] = await Promise.all([
        this.deps.taskRepository.loadTasks(),
        this.deps.courseRepository.loadCourses(),
      ]);
      // A newer load (next focus, pull-to-refresh) owns the screen now.
      if (!this.requests.isLatest(token)) return;

      this.setState({
        status: 'ready',
        tasks: loaded.data,
        courses: courses.data,
        savedAt: loaded.savedAt,
        error: null,
        pending: await this.deps.taskRepository.pendingCount(),
      });
      await this.revalidate('silent');
    } catch (error) {
      if (!this.requests.isLatest(token)) return;
      this.setState({ status: 'error', error: toAppError(error) });
    }
  };

  /** Pull-to-refresh. */
  refresh = async (): Promise<void> => {
    await this.revalidate('user');
  };

  setFilter = (filter: TaskFilter): void => {
    this.setState({ filter });
  };

  setQuery = (query: string): void => {
    this.setState({ query });
  };

  /** Called by the screen when it is opened with a `courseId` route param. */
  setCourse = (courseId: number | null): void => {
    this.setState({ courseId });
  };

  clearActionError = (): void => {
    this.setState({ actionError: null });
  };

  toggleDone = async (id: string): Promise<void> => {
    const task = this.getState().tasks.find((candidate) => candidate.id === id);
    if (!task) return;

    const nextStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    this.patchTask(id, { status: nextStatus, updatedAt: this.deps.clock().toISOString() });
    this.setBusy(id, true);

    try {
      const result = await this.deps.taskRepository.setTaskStatus(id, nextStatus);
      this.replaceTask(result.task);
      this.setState({
        offline: result.synced ? this.getState().offline : true,
        pending: await this.deps.taskRepository.pendingCount(),
      });
    } catch (error) {
      this.replaceTask(task); // rollback
      this.setState({ actionError: toAppError(error) });
    } finally {
      this.setBusy(id, false);
    }
  };

  deleteTask = async (id: string): Promise<boolean> => {
    const snapshot = this.getState().tasks;
    const task = snapshot.find((candidate) => candidate.id === id);
    if (!task) return false;

    this.requests.markLocalWrite();
    this.setState({ tasks: snapshot.filter((candidate) => candidate.id !== id) });

    try {
      const result = await this.deps.taskRepository.deleteTask(id);
      this.setState({
        offline: result.synced ? this.getState().offline : true,
        pending: await this.deps.taskRepository.pendingCount(),
      });
      return true;
    } catch (error) {
      this.requests.markLocalWrite();
      this.setState({ tasks: snapshot, actionError: toAppError(error) });
      return false;
    }
  };

  private revalidate = async (mode: 'silent' | 'user'): Promise<void> => {
    const { token, version } = this.requests.begin();
    if (mode === 'user') this.setState({ isRefreshing: true, actionError: null });

    try {
      const loaded = await this.deps.taskRepository.refreshTasks();
      // Never let an older request — or a snapshot built before the user's last write —
      // overwrite what is on screen.
      if (!this.requests.isLatest(token) || !this.requests.isUnchanged(version)) return;

      this.setState({
        status: 'ready',
        tasks: loaded.data,
        savedAt: loaded.savedAt,
        error: null,
        offline: loaded.origin === 'cache',
        pending: await this.deps.taskRepository.pendingCount(),
      });
    } catch (error) {
      if (!this.requests.isLatest(token)) return;
      const appError = toAppError(error);
      if (this.getState().tasks.length === 0) {
        this.setState({ status: 'error', error: appError });
      } else {
        this.setState({ offline: true, actionError: mode === 'user' ? appError : null });
      }
    } finally {
      if (mode === 'user') this.setState({ isRefreshing: false });
    }
  };

  private replaceTask(task: StudyTask): void {
    this.requests.markLocalWrite();
    this.setState({
      tasks: sortTasks(
        this.getState().tasks.map((candidate) => (candidate.id === task.id ? task : candidate)),
      ),
    });
  }

  private patchTask(id: string, patch: Partial<StudyTask>): void {
    this.requests.markLocalWrite();
    this.setState({
      tasks: this.getState().tasks.map((candidate) =>
        candidate.id === id ? { ...candidate, ...patch } : candidate,
      ),
    });
  }

  private setBusy(id: string, busy: boolean): void {
    const current = this.getState().busyTaskIds;
    this.setState({
      busyTaskIds: busy ? [...new Set([...current, id])] : current.filter((candidate) => candidate !== id),
    });
  }
}
