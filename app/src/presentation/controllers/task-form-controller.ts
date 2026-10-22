import type { Clock } from '../../core/clock';
import { toAppError, type AppError } from '../../core/errors';
import type { Course, TaskPriority, TaskType } from '../../domain/models';
import type { TaskDraftStore } from '../../data/local/task-draft-store';
import type { CourseRepository, TaskRepository } from '../../domain/repositories';
import { parseDueInput, toDueInput } from '../format';
import type { ScreenStatus } from '../state/async-slice';
import { ObservableStore } from '../state/observable-store';

export type TaskFormValues = {
  title: string;
  description: string;
  courseId: number | null;
  type: TaskType;
  dueDateText: string;
  priority: TaskPriority;
};

export type TaskFormErrors = Partial<Record<'title' | 'courseId' | 'dueDate', string>>;

export type TaskFormState = {
  isEditing: boolean;
  taskId: string | null;
  values: TaskFormValues;
  errors: TaskFormErrors;
  courses: Course[];
  status: ScreenStatus;
  error: AppError | null;
  isSaving: boolean;
  saveError: AppError | null;
  /** Result of the last save: true when the change reached the server immediately. */
  lastSynced: boolean | null;
  /** True when an unsaved draft from a previous session was restored into the form. */
  draftRestored: boolean;
};

type Deps = {
  taskRepository: TaskRepository;
  courseRepository: CourseRepository;
  draftStore: TaskDraftStore;
  clock: Clock;
};

function defaultValues(clock: Clock): TaskFormValues {
  // Default deadline: one week from now at 17:00, the usual PTIT submission time.
  const due = new Date(clock().getTime());
  due.setDate(due.getDate() + 7);
  due.setHours(17, 0, 0, 0);
  return {
    title: '',
    description: '',
    courseId: null,
    type: 'Assignment',
    dueDateText: toDueInput(due.toISOString()),
    priority: 'Medium',
  };
}

const initialState = (clock: Clock): TaskFormState => ({
  isEditing: false,
  taskId: null,
  values: defaultValues(clock),
  errors: {},
  courses: [],
  status: 'loading',
  error: null,
  isSaving: false,
  saveError: null,
  lastSynced: null,
  draftRestored: false,
});

/** ViewModel for the create/edit task form, including validation and save. */
export class TaskFormController extends ObservableStore<TaskFormState> {
  constructor(private readonly deps: Deps) {
    super(initialState(deps.clock));
  }

  async init(taskId?: string): Promise<void> {
    this.setState({ status: 'loading', error: null, taskId: taskId ?? null, isEditing: Boolean(taskId) });

    try {
      const [courses, tasks] = await Promise.all([
        this.deps.courseRepository.loadCourses(),
        taskId ? this.deps.taskRepository.loadTasks() : Promise.resolve(null),
      ]);

      const task = taskId ? tasks?.data.find((candidate) => candidate.id === taskId) : undefined;

      if (taskId && !task) {
        // Editing something that no longer exists: same reasoning as the detail screen — the
        // user needs a way back, not a retry button.
        this.setState({ status: 'empty', error: null });
        return;
      }

      const draft = await this.deps.draftStore.load(taskId);

      this.setState({
        status: 'ready',
        courses: courses.data,
        draftRestored: draft !== null && !taskId,
        values: draft
          ? { ...draft }
          : task
            ? {
                title: task.title,
                description: task.description,
                courseId: task.courseId,
                type: task.type,
                dueDateText: toDueInput(task.dueDate),
                priority: task.priority,
              }
            : {
                ...defaultValues(this.deps.clock),
                courseId: courses.data[0]?.id ?? null,
              },
      });
    } catch (error) {
      this.setState({ status: 'error', error: toAppError(error) });
    }
  }

  setField = <K extends keyof TaskFormValues>(field: K, value: TaskFormValues[K]): void => {
    this.setState({
      values: { ...this.getState().values, [field]: value },
      errors: { ...this.getState().errors, [field]: undefined },
      saveError: null,
      draftRestored: false,
    });
    this.persistDraft();
  };

  /** Throws the restored draft away and starts from the defaults again. */
  discardDraft = (): void => {
    const { courses } = this.getState();
    this.setState({
      values: {
        ...defaultValues(this.deps.clock),
        courseId: courses[0]?.id ?? null,
        title: '',
        description: '',
      },
      errors: {},
      draftRestored: false,
    });
    void this.deps.draftStore.clear(this.getState().taskId).catch(() => undefined);
  };

  private persistDraft(): void {
    const { values, taskId } = this.getState();
    void this.deps.draftStore.save({ ...values }, taskId).catch(() => undefined);
  }

  setQuickDueDate = (daysFromNow: number): void => {
    const due = new Date(this.deps.clock().getTime());
    due.setDate(due.getDate() + daysFromNow);
    due.setHours(17, 0, 0, 0);
    this.setField('dueDateText', toDueInput(due.toISOString()));
  };

  validate(): TaskFormErrors {
    const { values } = this.getState();
    const errors: TaskFormErrors = {};

    if (values.title.trim().length < 3) {
      errors.title = 'Tên công việc cần ít nhất 3 ký tự.';
    }
    if (values.courseId === null) {
      errors.courseId = 'Chọn môn học cho công việc này.';
    }
    if (!parseDueInput(values.dueDateText)) {
      errors.dueDate = 'Hạn chót không hợp lệ. Dùng dạng YYYY-MM-DD HH:mm.';
    }
    return errors;
  }

  /** Returns true when the form was saved (offline saves are queued, not lost). */
  save = async (): Promise<boolean> => {
    // A double tap on a slow phone must not create the task twice: the second press can
    // arrive before React has re-rendered the button into its loading state.
    if (this.getState().isSaving) return false;

    const errors = this.validate();
    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      return false;
    }

    const { values, taskId, isEditing } = this.getState();
    const dueDate = parseDueInput(values.dueDateText);
    if (!dueDate || values.courseId === null) return false;

    this.setState({ isSaving: true, saveError: null });

    const input = {
      title: values.title.trim(),
      description: values.description.trim(),
      courseId: values.courseId,
      type: values.type,
      priority: values.priority,
      dueDate,
    };

    try {
      const result =
        isEditing && taskId
          ? await this.deps.taskRepository.updateTask(taskId, input)
          : await this.deps.taskRepository.createTask(input);

      await this.deps.draftStore.clear(taskId).catch(() => undefined);
      this.setState({ isSaving: false, lastSynced: result.synced, draftRestored: false });
      return true;
    } catch (error) {
      this.setState({ isSaving: false, saveError: toAppError(error) });
      return false;
    }
  };
}
