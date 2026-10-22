import { toAppError, type AppError } from '../../core/errors';
import type { Course, StudyTask } from '../../domain/models';
import type { CourseRepository, TaskRepository } from '../../domain/repositories';
import type { ScreenStatus } from '../state/async-slice';
import { ObservableStore } from '../state/observable-store';
import { RequestTracker } from '../state/request-tracker';

export type CoursesState = {
  status: ScreenStatus;
  error: AppError | null;
  courses: Course[];
  tasks: StudyTask[];
  isRefreshing: boolean;
  offline: boolean;
};

type Deps = {
  courseRepository: CourseRepository;
  taskRepository: TaskRepository;
};

const initialState = (): CoursesState => ({
  status: 'idle',
  error: null,
  courses: [],
  tasks: [],
  isRefreshing: false,
  offline: false,
});

/** ViewModel for the course list; task counts per course come from the same cache. */
export class CoursesController extends ObservableStore<CoursesState> {
  private readonly requests = new RequestTracker();

  constructor(private readonly deps: Deps) {
    super(initialState());
  }

  load = async (): Promise<void> => {
    const { token } = this.requests.begin();
    this.setState({ status: this.getState().courses.length > 0 ? 'ready' : 'loading', error: null });

    const [courses, tasks] = await Promise.allSettled([
      this.deps.courseRepository.loadCourses(),
      this.deps.taskRepository.loadTasks(),
    ]);
    if (!this.requests.isLatest(token)) return;

    if (courses.status === 'rejected') {
      this.setState({ status: 'error', error: toAppError(courses.reason) });
      return;
    }

    this.setState({
      status: 'ready',
      courses: courses.value.data,
      tasks: tasks.status === 'fulfilled' ? tasks.value.data : this.getState().tasks,
      error: null,
    });

    await this.revalidate('silent');
  };

  refresh = async (): Promise<void> => {
    await this.revalidate('user');
  };

  private revalidate = async (mode: 'silent' | 'user'): Promise<void> => {
    const { token } = this.requests.begin();
    if (mode === 'user') this.setState({ isRefreshing: true });

    const [courses, tasks] = await Promise.allSettled([
      this.deps.courseRepository.refreshCourses(),
      this.deps.taskRepository.refreshTasks(),
    ]);
    if (!this.requests.isLatest(token)) return;

    if (courses.status === 'rejected' && this.getState().courses.length === 0) {
      this.setState({
        status: 'error',
        error: toAppError(courses.reason),
        isRefreshing: false,
      });
      return;
    }

    this.setState({
      courses: courses.status === 'fulfilled' ? courses.value.data : this.getState().courses,
      tasks: tasks.status === 'fulfilled' ? tasks.value.data : this.getState().tasks,
      offline:
        courses.status === 'rejected' ||
        courses.value.origin === 'cache' ||
        (tasks.status === 'fulfilled' && tasks.value.origin === 'cache'),
      isRefreshing: false,
    });
  };
}
