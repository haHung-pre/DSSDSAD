import type { AppConfig } from '../../config/env';
import type { JsonCache } from '../../data/local/json-cache';
import type { NetworkMonitor } from '../../core/network-monitor';
import type { TaskRepository } from '../../domain/repositories';
import { AppError } from '../../core/errors';
import { SettingsController } from '../controllers/settings-controller';

const NOW = new Date('2026-10-22T10:00:00+07:00');

const CONFIG: AppConfig = {
  apiBaseUrl: 'http://localhost:3000',
  requestTimeoutMs: 8000,
  environment: 'test',
};

/** The settings screen never talks to the network itself — it asks the cache, the network
 *  monitor and the task repository, so all three are trivial fakes here. */
function setup({
  online = true,
  pending = 0,
  processed = 0,
  remaining = 0,
  cacheKeys = ['tasks', 'courses'],
  clearThrows = false,
}: {
  online?: boolean;
  pending?: number;
  processed?: number;
  remaining?: number;
  cacheKeys?: string[];
  clearThrows?: boolean;
} = {}) {
  const cache = {
    keys: jest.fn().mockResolvedValue(cacheKeys),
    // The real `JsonCache` is what turns an AsyncStorage failure into `AppError('storage')`,
    // so the fake throws the same thing — the controller only has to display it.
    clear: clearThrows
      ? jest.fn().mockRejectedValue(new AppError('storage', { technicalMessage: 'disk full' }))
      : jest.fn().mockResolvedValue(undefined),
  } as unknown as JsonCache;
  const network: NetworkMonitor = {
    isOnline: jest.fn().mockResolvedValue(online),
    subscribe: jest.fn().mockReturnValue(() => undefined),
  };
  const taskRepository = {
    pendingCount: jest.fn().mockResolvedValue(pending),
    syncPending: jest.fn().mockResolvedValue({ processed, remaining }),
    refreshTasks: jest.fn().mockResolvedValue({ data: [], origin: 'network', savedAt: 0 }),
  } as unknown as TaskRepository;

  const controller = new SettingsController({
    config: CONFIG,
    taskRepository,
    cache,
    network,
    clock: () => NOW,
  });

  return { controller, cache, network, taskRepository };
}

describe('SettingsController', () => {
  it('reads the diagnostics it displays', async () => {
    const { controller } = setup({ online: false, pending: 2 });

    await controller.load();

    expect(controller.getState()).toMatchObject({
      online: false,
      pending: 2,
      cachedKeys: ['tasks', 'courses'],
      apiBaseUrl: 'http://localhost:3000',
      timeoutMs: 8000,
    });
  });

  it('explains why syncing does nothing when the device is offline', async () => {
    const { controller, taskRepository } = setup({ online: false });
    await controller.load();

    await controller.syncNow();

    expect(controller.getState().isSyncing).toBe(false);
    expect(controller.getState().error?.kind).toBe('offline');
    // Nothing is sent while the app knows it is offline — no doomed request, no lost queue.
    expect(taskRepository.syncPending).not.toHaveBeenCalled();
  });

  it('reports what a successful sync did and refreshes the list afterwards', async () => {
    const { controller, taskRepository } = setup({ processed: 3, remaining: 0 });

    await controller.syncNow();

    expect(controller.getState().message).toBe('Đã đồng bộ 3 thay đổi.');
    expect(controller.getState().pending).toBe(0);
    expect(taskRepository.refreshTasks).toHaveBeenCalledTimes(1);
  });

  it('says so instead of staying silent when there was nothing to sync', async () => {
    const { controller, taskRepository } = setup({ processed: 0, remaining: 0 });

    await controller.syncNow();

    expect(controller.getState().message).toBe('Không có thay đổi nào cần đồng bộ.');
    expect(taskRepository.refreshTasks).not.toHaveBeenCalled();
  });

  it('refuses to wipe the offline cache while changes are still waiting to sync', async () => {
    const { controller, cache } = setup({ pending: 2 });
    await controller.load();

    await controller.clearCache();

    // Clearing would make the user's unsynced work disappear from every screen until a sync
    // succeeds, so the action stops and explains itself instead of silently losing the view.
    expect(cache.clear).not.toHaveBeenCalled();
    expect(controller.getState().error?.userMessage).toContain('2 thay đổi chưa đồng bộ');
    expect(controller.getState().pending).toBe(2);
  });

  it('clears the cache once nothing is pending', async () => {
    const { controller, cache } = setup({ pending: 0 });
    await controller.load();

    await controller.clearCache();

    expect(cache.clear).toHaveBeenCalledTimes(1);
    expect(controller.getState().cachedKeys).toEqual([]);
    expect(controller.getState().message).toContain('Đã xoá dữ liệu lưu offline');
  });

  it('surfaces a storage failure instead of pretending the cache is gone', async () => {
    const { controller } = setup({ clearThrows: true });
    await controller.load();

    await controller.clearCache();

    expect(controller.getState().error?.kind).toBe('storage');
    expect(controller.getState().isClearing).toBe(false);
  });
});
