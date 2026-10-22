import { MemoryKeyValueStore } from '../local/key-value-store';
import { TaskDraftStore, type TaskDraft } from '../local/task-draft-store';

const draft: TaskDraft = {
  title: 'Nộp báo cáo tuần 5',
  description: 'Link nộp trên LMS',
  courseId: 1,
  type: 'Assignment',
  dueDateText: '2026-10-30 17:00',
  priority: 'High',
};

describe('TaskDraftStore', () => {
  it('returns null when nothing was saved', async () => {
    const store = new TaskDraftStore(new MemoryKeyValueStore());
    await expect(store.load()).resolves.toBeNull();
  });

  it('round-trips an unsaved form so input survives a restart', async () => {
    const store = new TaskDraftStore(new MemoryKeyValueStore());

    await store.save(draft);

    await expect(store.load()).resolves.toEqual(draft);
  });

  it('keeps the create draft and the edit draft of one task apart', async () => {
    const store = new TaskDraftStore(new MemoryKeyValueStore());

    await store.save(draft);
    await store.save({ ...draft, title: 'Bản sửa của task 7' }, '7');

    await expect(store.load()).resolves.toMatchObject({ title: draft.title });
    await expect(store.load('7')).resolves.toMatchObject({ title: 'Bản sửa của task 7' });
  });

  it('clears the draft after a successful save', async () => {
    const store = new TaskDraftStore(new MemoryKeyValueStore());
    await store.save(draft);

    await store.clear();

    await expect(store.load()).resolves.toBeNull();
  });

  it('ignores a corrupted draft instead of blocking the form', async () => {
    const kv = new MemoryKeyValueStore();
    await kv.setItem('draft:task-form', '{"title": 42');
    const store = new TaskDraftStore(kv);

    await expect(store.load()).resolves.toBeNull();
  });
});
