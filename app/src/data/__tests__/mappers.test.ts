import { isAppError } from '../../core/errors';
import { mapCourse, mapCourses, mapProfile, mapSession, mapTask, mapTasks } from '../mappers';

/**
 * The mapping layer is the only place where untrusted JSON becomes a domain object, so it is
 * where "robust API handling" (B2) is actually decided: unknown enum values must not reach the
 * UI, an id may arrive as a number, and a broken payload must surface as one `AppError` instead
 * of `undefined` / `Invalid Date` rendering somewhere three screens later.
 */

const expectParseError = (run: () => unknown, fragment: string) => {
  try {
    run();
  } catch (error) {
    expect(isAppError(error)).toBe(true);
    if (isAppError(error)) {
      expect(error.kind).toBe('parse');
      expect(error.technicalMessage).toContain(fragment);
    }
    return;
  }
  throw new Error(`expected a parse AppError containing "${fragment}"`);
};

describe('mapTask', () => {
  const valid = {
    id: 7,
    courseId: '1',
    title: '  Nộp proposal  ',
    description: 'Ghi chú',
    type: 'Assignment',
    dueDate: '2026-10-22T17:00:00+07:00',
    priority: 'High',
    status: 'doing',
    createdAt: '2026-10-14T08:00:00+07:00',
    updatedAt: '2026-10-20T08:00:00+07:00',
  };

  it('maps a well-formed row, coercing ids and trimming the title', () => {
    const task = mapTask(valid);

    expect(task).toMatchObject({
      id: '7',
      courseId: 1,
      title: 'Nộp proposal',
      type: 'Assignment',
      priority: 'High',
      status: 'doing',
    });
  });

  it('normalises dates to ISO so comparisons and parsing are stable', () => {
    expect(mapTask(valid).dueDate).toBe(new Date(valid.dueDate).toISOString());
  });

  it('falls back for unknown enum values instead of showing raw server text', () => {
    const task = mapTask({ ...valid, type: 'Homework', priority: 'URGENT', status: 'archived' });

    expect(task.type).toBe('Assignment');
    expect(task.priority).toBe('Medium');
    expect(task.status).toBe('todo');
  });

  it('defaults the timestamps from the due date when the server omits them', () => {
    const task = mapTask({ id: 1, title: 'Chỉ có hạn chót', dueDate: valid.dueDate });

    expect(task.createdAt).toBe(task.dueDate);
    expect(task.updatedAt).toBe(task.dueDate);
  });

  it('rejects a row that cannot be rendered', () => {
    expectParseError(() => mapTask({ ...valid, id: undefined }), 'task.id');
    expectParseError(() => mapTask({ ...valid, title: '   ' }), 'has no title');
    expectParseError(() => mapTask({ ...valid, dueDate: 'không phải ngày' }), 'not a valid date');
    expectParseError(() => mapTask({ ...valid, dueDate: undefined }), 'dueDate');
    expectParseError(() => mapTask('not an object'), 'expected a JSON object');
    expectParseError(() => mapTask([]), 'expected a JSON object');
  });

  it('keeps the offline marker only when it is literally true', () => {
    expect(mapTask({ ...valid, pendingSync: true }).pendingSync).toBe(true);
    expect(mapTask({ ...valid, pendingSync: 'yes' }).pendingSync).toBeUndefined();
  });
});

describe('mapTasks / mapCourses / mapSessions', () => {
  it('maps a whole collection', () => {
    expect(mapTasks([{ id: 1, title: 'A', dueDate: '2026-10-22T17:00:00+07:00' }])).toHaveLength(1);
    expect(mapCourses([{ id: 1, code: 'INT1449' }])[0]).toMatchObject({ id: 1, code: 'INT1449' });
    expect(mapCourses([{ id: 1 }])[0]).toMatchObject({
      code: 'COURSE-1',
      name: 'Môn học',
      credits: 3,
      room: '—',
    });
  });

  it('rejects a payload that is not an array', () => {
    expectParseError(() => mapTasks({ tasks: [] }), 'expected a JSON array');
    expectParseError(() => mapCourses(null), 'expected a JSON array');
  });
});

describe('mapCourse', () => {
  it('rejects a course without a usable id', () => {
    expectParseError(() => mapCourse({ code: 'X' }), 'course.id');
    expectParseError(() => mapCourse({ id: 'abc' }), 'course.id');
  });
});

describe('mapSession', () => {
  it('clamps the weekday into 1…7 and defaults the times', () => {
    const session = mapSession({ id: 's1', courseId: 1, dayOfWeek: 9 });

    expect(session).toMatchObject({ dayOfWeek: 7, startTime: '07:00', endTime: '09:00', type: 'Lecture' });
    expect(mapSession({ id: 's2', courseId: 1, dayOfWeek: -3 }).dayOfWeek).toBe(1);
  });

  it('rejects a session without an id', () => {
    expectParseError(() => mapSession({ courseId: 1 }), 'session.id');
  });
});

describe('mapProfile', () => {
  it('always produces something a greeting can use', () => {
    expect(mapProfile({})).toMatchObject({ name: 'Sinh viên', studentId: '—', semester: '—' });
    expect(mapProfile({ name: 'Nguyễn Đức Hà Hùng' }).name).toBe('Nguyễn Đức Hà Hùng');
  });
});
