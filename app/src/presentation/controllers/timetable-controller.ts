import type { Clock } from '../../core/clock';
import { toAppError, type AppError } from '../../core/errors';
import type { Course, Session } from '../../domain/models';
import type { CourseRepository, ScheduleRepository } from '../../domain/repositories';
import { isoWeekday, sessionsForDay } from '../../domain/schedule';
import type { ScreenStatus } from '../state/async-slice';
import { ObservableStore } from '../state/observable-store';
import { RequestTracker } from '../state/request-tracker';

export type TimetableState = {
  status: ScreenStatus;
  error: AppError | null;
  sessions: Session[];
  courses: Course[];
  selectedDay: number;
  isRefreshing: boolean;
  offline: boolean;
};

type Deps = {
  scheduleRepository: ScheduleRepository;
  courseRepository: CourseRepository;
  clock: Clock;
};

/** ViewModel for the weekly timetable screen. */
export class TimetableController extends ObservableStore<TimetableState> {
  /** Drops stale responses (see `RequestTracker`). */
  private readonly requests = new RequestTracker();

  constructor(private readonly deps: Deps) {
    super({
      status: 'idle',
      error: null,
      sessions: [],
      courses: [],
      selectedDay: isoWeekday(deps.clock()),
      isRefreshing: false,
      offline: false,
    });
  }

  load = async (): Promise<void> => {
    const { token } = this.requests.begin();
    this.setState({ status: this.getState().sessions.length > 0 ? 'ready' : 'loading', error: null });

    const [sessions, courses] = await Promise.allSettled([
      this.deps.scheduleRepository.loadSessions(),
      this.deps.courseRepository.loadCourses(),
    ]);
    if (!this.requests.isLatest(token)) return;

    if (sessions.status === 'rejected') {
      this.setState({ status: 'error', error: toAppError(sessions.reason) });
      return;
    }

    this.setState({
      status: 'ready',
      error: null,
      sessions: sessions.value.data,
      courses: courses.status === 'fulfilled' ? courses.value.data : this.getState().courses,
    });

    await this.revalidate('silent');
  };

  refresh = async (): Promise<void> => {
    await this.revalidate('user');
  };

  selectDay = (day: number): void => {
    this.setState({ selectedDay: day });
  };

  /** Classes of the selected day, sorted by start time (pure domain helper). */
  sessionsOfSelectedDay = (): Session[] =>
    sessionsForDay(this.getState().sessions, this.getState().selectedDay);

  private revalidate = async (mode: 'silent' | 'user'): Promise<void> => {
    const { token } = this.requests.begin();
    if (mode === 'user') this.setState({ isRefreshing: true });

    const [sessions, courses] = await Promise.allSettled([
      this.deps.scheduleRepository.refreshSessions(),
      this.deps.courseRepository.refreshCourses(),
    ]);
    if (!this.requests.isLatest(token)) return;

    if (sessions.status === 'rejected' && this.getState().sessions.length === 0) {
      this.setState({ status: 'error', error: toAppError(sessions.reason), isRefreshing: false });
      return;
    }

    this.setState({
      sessions: sessions.status === 'fulfilled' ? sessions.value.data : this.getState().sessions,
      courses: courses.status === 'fulfilled' ? courses.value.data : this.getState().courses,
      offline: sessions.status === 'rejected' || sessions.value.origin === 'cache',
      isRefreshing: false,
    });
  };
}
