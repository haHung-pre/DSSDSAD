import { toAppError, type AppError } from '../../core/errors';
import type { Course, StudyTask } from '../../domain/models';
import type { CourseRepository, TaskRepository } from '../../domain/repositories';
import type { ScreenStatus } from '../state/async-slice';
import { ObservableStore } from '../state/observable-store';
import { RequestTracker } from '../state/request-tracker';

export type TaskDetailState = {
  status: ScreenStatus;
  error: AppError | null;
  task: StudyTask | null;
  courses: Course[];
  busy: boolean;
  actionError: AppError | null;
};

type Deps = {
  taskRepository: TaskRepository;
  courseRepository: CourseRepository;
};

/** ViewModel for one task: read, toggle completion, delete. */
export class TaskDetailController extends ObservableStore<TaskDetailState> {
  constructor(
    private readonly taskId: string,
    private readonly deps: Deps,
  ) {
    super({ status: 'loading', error: null, task: null, courses: [], busy: false, actionError: null });
  }

  /** Drops stale responses and protects optimistic writes (see `RequestTracker`). */
  private readonly requests = new RequestTracker();

  load = async (): Promise<void> => {
    const { token, version } = this.requests.begin();
    try {
      const [tasks, courses] = await Promise.all([
        this.deps.taskRepository.loadTasks(),
        this.deps.courseRepository.loadCourses(),
      ]);
      if (!this.requests.isLatest(token)) return;
      const task = tasks.data.find((candidate) => candidate.id === this.taskId) ?? null;

      if (!task) {
        // The list and the detail disagree: the task was deleted elsewhere (or the deep link is
        // stale). That is not a failure — nothing to load, so it must not offer "Thử lại".
        this.setState({ status: 'empty', task: null, error: null });
        return;
      }

      this.setState({ status: 'ready', task, courses: courses.data, error: null });

      // Refresh in the background so a task edited on another device is up to date.
      // Skip it if the user already acted on this task while the request was in flight —
      // the server snapshot predates their write and would flip the checkbox back.
      const refreshed = await this.deps.taskRepository.refreshTasks();
      if (!this.requests.isLatest(token) || !this.requests.isUnchanged(version)) return;
      const fresh = refreshed.data.find((candidate) => candidate.id === this.taskId);
      if (fresh) this.setState({ task: fresh });
    } catch (error) {
      if (!this.requests.isLatest(token)) return;
      this.setState({ status: 'error', error: toAppError(error) });
    }
  };

  courseOf = (task: StudyTask | null): Course | undefined =>
    task ? this.getState().courses.find((course) => course.id === task.courseId) : undefined;

  toggleDone = async (): Promise<void> => {
    const task = this.getState().task;
    if (!task || this.getState().busy) return;
    const nextStatus = task.status === 'done' ? 'todo' : 'done';

    this.requests.markLocalWrite();
    this.setState({ task: { ...task, status: nextStatus }, busy: true, actionError: null });
    try {
      const result = await this.deps.taskRepository.setTaskStatus(task.id, nextStatus);
      this.setState({ task: result.task, busy: false });
    } catch (error) {
      this.setState({ task, busy: false, actionError: toAppError(error) });
    }
  };

  setStatus = async (status: StudyTask['status']): Promise<void> => {
    const task = this.getState().task;
    if (!task || this.getState().busy) return;
    this.requests.markLocalWrite();
    this.setState({ task: { ...task, status }, busy: true, actionError: null });
    try {
      const result = await this.deps.taskRepository.setTaskStatus(task.id, status);
      this.setState({ task: result.task, busy: false });
    } catch (error) {
      this.setState({ task, busy: false, actionError: toAppError(error) });
    }
  };

  remove = async (): Promise<boolean> => {
    const task = this.getState().task;
    // Deleting twice would send a second DELETE for an id the server has already removed.
    if (!task || this.getState().busy) return false;
    this.requests.markLocalWrite();
    this.setState({ busy: true, actionError: null });
    try {
      await this.deps.taskRepository.deleteTask(task.id);
      this.setState({ busy: false });
      return true;
    } catch (error) {
      this.setState({ busy: false, actionError: toAppError(error) });
      return false;
    }
  };

  clearActionError = (): void => this.setState({ actionError: null });
}
