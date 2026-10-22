import type { StudyTask } from '../models';
import {
  daysUntil,
  examCountdown,
  nextExam,
  dueLabel,
  filterTasks,
  isOverdue,
  normalize,
  searchTasks,
  sortTasks,
  summarize,
  upcomingDeadlines,
} from '../task-rules';

const NOW = new Date('2026-10-21T09:00:00+07:00');

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

describe('task rules', () => {
  it('counts calendar days, not raw milliseconds', () => {
    expect(daysUntil('2026-10-21T23:00:00+07:00', NOW)).toBe(0);
    expect(daysUntil('2026-10-22T01:00:00+07:00', NOW)).toBe(1);
    expect(daysUntil('2026-10-19T09:00:00+07:00', NOW)).toBe(-2);
  });

  it('formats the due label for today, tomorrow, this week and overdue tasks', () => {
    expect(dueLabel(makeTask({ dueDate: '2026-10-21T23:00:00+07:00' }), NOW)).toBe('Hôm nay');
    expect(dueLabel(makeTask({ dueDate: '2026-10-22T23:00:00+07:00' }), NOW)).toBe('Ngày mai');
    expect(dueLabel(makeTask({ dueDate: '2026-10-25T23:00:00+07:00' }), NOW)).toBe('Còn 4 ngày');
    expect(dueLabel(makeTask({ dueDate: '2026-10-18T09:00:00+07:00' }), NOW)).toBe('Quá hạn 3 ngày');
    expect(dueLabel(makeTask({ status: 'done' }), NOW)).toBe('Đã hoàn thành');
  });

  it('never marks a completed task as overdue', () => {
    expect(isOverdue(makeTask({ dueDate: '2026-10-18T09:00:00+07:00' }), NOW)).toBe(true);
    expect(isOverdue(makeTask({ dueDate: '2026-10-18T09:00:00+07:00', status: 'done' }), NOW)).toBe(false);
  });

  it('filters by upcoming, overdue and done', () => {
    const tasks = [
      makeTask({ id: 'a', dueDate: '2026-10-18T09:00:00+07:00' }),
      makeTask({ id: 'b', dueDate: '2026-10-23T09:00:00+07:00' }),
      makeTask({ id: 'c', dueDate: '2026-10-20T09:00:00+07:00', status: 'done' }),
    ];

    expect(filterTasks(tasks, 'overdue', NOW).map((task) => task.id)).toEqual(['a']);
    expect(filterTasks(tasks, 'upcoming', NOW).map((task) => task.id)).toEqual(['b']);
    expect(filterTasks(tasks, 'done', NOW).map((task) => task.id)).toEqual(['c']);
    expect(filterTasks(tasks, 'all', NOW)).toHaveLength(3);
  });

  it('sorts open tasks by due date and pushes completed tasks to the end', () => {
    const tasks = [
      makeTask({ id: 'done', status: 'done', dueDate: '2026-10-01T09:00:00+07:00' }),
      makeTask({ id: 'late', dueDate: '2026-10-25T09:00:00+07:00' }),
      makeTask({ id: 'soon', dueDate: '2026-10-22T09:00:00+07:00' }),
    ];

    expect(sortTasks(tasks).map((task) => task.id)).toEqual(['soon', 'late', 'done']);
  });

  it('summarises counts and completion rate', () => {
    const tasks = [
      makeTask({ id: 'a', dueDate: '2026-10-18T09:00:00+07:00' }),
      makeTask({ id: 'b', dueDate: '2026-10-21T23:00:00+07:00' }),
      makeTask({ id: 'c', dueDate: '2026-10-23T09:00:00+07:00' }),
      makeTask({ id: 'd', status: 'done' }),
    ];

    expect(summarize(tasks, NOW)).toEqual({
      total: 4,
      done: 1,
      open: 3,
      overdue: 1,
      dueToday: 1,
      dueThisWeek: 2,
      completionRate: 0.25,
    });
  });

  it('returns the soonest open deadlines, limited', () => {
    const tasks = [
      makeTask({ id: 'done', status: 'done', dueDate: '2026-10-22T09:00:00+07:00' }),
      makeTask({ id: 'b', dueDate: '2026-10-30T09:00:00+07:00' }),
      makeTask({ id: 'a', dueDate: '2026-10-23T09:00:00+07:00' }),
      makeTask({ id: 'c', dueDate: '2026-11-02T09:00:00+07:00' }),
    ];

    expect(upcomingDeadlines(tasks, NOW, 2).map((task) => task.id)).toEqual(['a', 'b']);
  });
});

describe('search', () => {
  const courses = [
    { id: 1, code: 'INT1449', name: 'Mobile', lecturer: '—', credits: 3, color: '#2F6FED', room: 'A2' },
    { id: 2, code: 'INT1433', name: 'Network', lecturer: '—', credits: 3, color: '#12A594', room: 'A2' },
  ];
  const tasks = [
    makeTask({ id: 'a', title: 'Nộp proposal đồ án', description: 'Tài liệu ở LMS' }),
    makeTask({ id: 'b', courseId: 2, title: 'Bài tập socket TCP', description: '' }),
  ];

  it('strips Vietnamese diacritics so typing without accents works', () => {
    expect(normalize('Bài tập Đồ án')).toBe('bai tap do an');
  });

  it('finds by title, description and course code', () => {
    expect(searchTasks(tasks, 'proposal', courses).map((task) => task.id)).toEqual(['a']);
    expect(searchTasks(tasks, 'lms', courses).map((task) => task.id)).toEqual(['a']);
    expect(searchTasks(tasks, 'int1433', courses).map((task) => task.id)).toEqual(['b']);
    expect(searchTasks(tasks, 'bai tap', courses).map((task) => task.id)).toEqual(['b']);
  });

  it('returns everything for an empty query and nothing for a miss', () => {
    expect(searchTasks(tasks, '   ', courses)).toHaveLength(2);
    expect(searchTasks(tasks, 'không có gì', courses)).toHaveLength(0);
  });
});

describe('normalize (search text folding)', () => {
  it('folds Vietnamese diacritics both ways', () => {
    expect(normalize('Bài tập Socket TCP đa luồng')).toBe('bai tap socket tcp da luong');
    expect(normalize('ĐỌC CHƯƠNG 1')).toBe('doc chuong 1');
  });

  it('still works on engines without String.prototype.normalize (Hermes without Intl)', () => {
    // Some React Native engines ship a JS runtime whose String.prototype.normalize is
    // missing or throws. Search must degrade, not crash the list.
    const original = String.prototype.normalize;
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(String.prototype, 'normalize', { value: undefined, configurable: true });
    try {
      expect(normalize('Bài tập đa luồng')).toBe('bai tap da luong');
      expect(
        searchTasks(
          [makeTask({ title: 'Ôn tập chương 3', description: 'Biến ngẫu nhiên' })],
          'bien ngau nhien',
        ),
      ).toHaveLength(1);
    } finally {
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(String.prototype, 'normalize', { value: original, configurable: true });
    }
  });

  it('falls back when normalize throws at runtime', () => {
    const original = String.prototype.normalize;
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(String.prototype, 'normalize', {
      value: () => {
        throw new RangeError('invalid form');
      },
      configurable: true,
    });
    try {
      expect(normalize('Đề cương')).toBe('de cuong');
    } finally {
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(String.prototype, 'normalize', { value: original, configurable: true });
    }
  });
});

describe('nextExam / examCountdown (đếm ngược kỳ thi)', () => {
  it('picks the earliest exam that is still ahead', () => {
    const tasks = [
      makeTask({ id: 'a', type: 'Exam', dueDate: '2026-11-05T08:00:00+07:00' }),
      makeTask({ id: 'b', type: 'Exam', dueDate: '2026-10-25T08:00:00+07:00' }),
      makeTask({ id: 'c', type: 'Assignment', dueDate: '2026-10-22T08:00:00+07:00' }),
    ];

    expect(nextExam(tasks, NOW)?.id).toBe('b');
  });

  it('ignores finished and overdue exams', () => {
    const tasks = [
      makeTask({ id: 'done', type: 'Exam', dueDate: '2026-11-01T08:00:00+07:00', status: 'done' }),
      makeTask({ id: 'past', type: 'Exam', dueDate: '2026-10-18T08:00:00+07:00' }),
    ];

    expect(nextExam(tasks, NOW)).toBeNull();
  });

  it('counts whole calendar days and marks the last three as urgent', () => {
    const exam = makeTask({ type: 'Exam', dueDate: '2026-10-24T08:00:00+07:00' });
    expect(examCountdown(exam, NOW)).toEqual({ days: 3, label: 'Còn 3 ngày', urgent: true });

    const later = makeTask({ type: 'Exam', dueDate: '2026-11-05T08:00:00+07:00' });
    expect(examCountdown(later, NOW)).toEqual({ days: 15, label: 'Còn 15 ngày', urgent: false });
  });

  it('says "today" / "tomorrow" instead of "0 ngày"', () => {
    expect(examCountdown(makeTask({ type: 'Exam', dueDate: '2026-10-21T08:00:00+07:00' }), NOW).label).toBe(
      'Thi hôm nay',
    );
    expect(examCountdown(makeTask({ type: 'Exam', dueDate: '2026-10-22T08:00:00+07:00' }), NOW).label).toBe(
      'Thi ngày mai',
    );
  });
});
