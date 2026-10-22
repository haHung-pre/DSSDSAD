import { MemoryKeyValueStore } from '../local/key-value-store';
import { Outbox } from '../local/outbox';

function setup() {
  const store = new MemoryKeyValueStore();
  return { store, outbox: new Outbox(store) };
}

describe('Outbox', () => {
  it('starts empty and grows with each queued operation', async () => {
    const { outbox } = setup();
    await expect(outbox.size()).resolves.toBe(0);

    await outbox.enqueue({ entity: 'task', type: 'delete', payload: { id: '1' } });

    await expect(outbox.size()).resolves.toBe(1);
  });

  it('keeps every operation when several writes are queued in the same tick', async () => {
    const { outbox } = setup();

    // Regression: enqueue() is a read-modify-write. Without serialisation the five
    // parallel calls all read the same (empty) list and only the last one survived,
    // which silently lost four offline edits.
    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        outbox.enqueue({ entity: 'task', type: 'update', payload: { id: `task-${index}` } }),
      ),
    );

    const operations = await outbox.list();
    expect(operations).toHaveLength(5);
    expect(operations.map((operation) => operation.payload.id)).toEqual([
      'task-0',
      'task-1',
      'task-2',
      'task-3',
      'task-4',
    ]);
  });

  it('serialises an update against a concurrent enqueue', async () => {
    const { outbox } = setup();
    const created = await outbox.enqueue({ entity: 'task', type: 'create', payload: { id: 'local-1' } });

    await Promise.all([
      outbox.update(created.id, { payload: { id: 'local-1', title: 'đã sửa' } }),
      outbox.enqueue({ entity: 'task', type: 'delete', payload: { id: '2' } }),
    ]);

    const operations = await outbox.list();
    expect(operations).toHaveLength(2);
    expect(operations[0].payload).toEqual({ id: 'local-1', title: 'đã sửa' });
  });

  it('removes one operation, then clears the whole queue', async () => {
    const { outbox } = setup();
    const first = await outbox.enqueue({ entity: 'task', type: 'delete', payload: { id: '1' } });
    await outbox.enqueue({ entity: 'task', type: 'delete', payload: { id: '2' } });

    await outbox.remove(first.id);
    expect(await outbox.size()).toBe(1);

    await outbox.clear();
    await expect(outbox.size()).resolves.toBe(0);
  });
});
