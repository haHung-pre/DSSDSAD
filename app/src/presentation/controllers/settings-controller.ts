import type { Clock } from '../../core/clock';
import { AppError, toAppError } from '../../core/errors';
import type { NetworkMonitor } from '../../core/network-monitor';
import type { AppConfig } from '../../config/env';
import type { JsonCache } from '../../data/local/json-cache';
import type { TaskRepository } from '../../domain/repositories';
import { ObservableStore } from '../state/observable-store';

export type SettingsState = {
  apiBaseUrl: string;
  environment: string;
  timeoutMs: number;
  online: boolean | null;
  pending: number;
  cachedKeys: string[];
  lastSyncAt: number | null;
  isSyncing: boolean;
  isClearing: boolean;
  message: string | null;
  error: AppError | null;
};

type Deps = {
  config: AppConfig;
  taskRepository: TaskRepository;
  cache: JsonCache;
  network: NetworkMonitor;
  clock: Clock;
};

/** ViewModel for Settings: connection diagnostics, offline queue and cache tools. */
export class SettingsController extends ObservableStore<SettingsState> {
  constructor(private readonly deps: Deps) {
    super({
      apiBaseUrl: deps.config.apiBaseUrl,
      environment: deps.config.environment,
      timeoutMs: deps.config.requestTimeoutMs,
      online: null,
      pending: 0,
      cachedKeys: [],
      lastSyncAt: null,
      isSyncing: false,
      isClearing: false,
      message: null,
      error: null,
    });
  }

  load = async (): Promise<void> => {
    const [online, pending, cachedKeys] = await Promise.all([
      this.deps.network.isOnline(),
      this.deps.taskRepository.pendingCount(),
      this.deps.cache.keys(),
    ]);
    this.setState({ online, pending, cachedKeys });
  };

  syncNow = async (): Promise<void> => {
    this.setState({ isSyncing: true, message: null, error: null });

    try {
      const online = await this.deps.network.isOnline();
      this.setState({ online });

      if (!online) {
        this.setState({
          isSyncing: false,
          error: toAppError(new Error('Network request failed')),
        });
        return;
      }

      const result = await this.deps.taskRepository.syncPending();
      if (result.processed > 0) {
        await this.deps.taskRepository.refreshTasks();
      }

      this.setState({
        isSyncing: false,
        pending: result.remaining,
        lastSyncAt: this.deps.clock().getTime(),
        message:
          result.processed === 0
            ? 'Không có thay đổi nào cần đồng bộ.'
            : `Đã đồng bộ ${result.processed} thay đổi.`,
      });
    } catch (error) {
      this.setState({ isSyncing: false, error: toAppError(error) });
    }
  };

  /**
   * "Xoá dữ liệu lưu offline" wipes the read cache. Queued writes live in the outbox and are
   * NOT touched, but the cached copy is the only readable one until the next refresh, so
   * clearing while changes are still waiting makes the user's unsynced work vanish from every
   * screen until a sync succeeds. The action refuses instead, and says why.
   */
  clearCache = async (): Promise<void> => {
    this.setState({ isClearing: true, message: null, error: null });
    try {
      const pending = await this.deps.taskRepository.pendingCount();
      if (pending > 0) {
        this.setState({
          isClearing: false,
          pending,
          error: new AppError('storage', {
            userMessage: `Còn ${pending} thay đổi chưa đồng bộ. Hãy đồng bộ trước khi xoá dữ liệu ngoại tuyến.`,
            technicalMessage: `clearCache blocked: ${pending} pending outbox operations`,
          }),
        });
        return;
      }

      await this.deps.cache.clear();
      this.setState({
        isClearing: false,
        pending: 0,
        cachedKeys: [],
        message: 'Đã xoá dữ liệu lưu offline. Kéo làm mới các màn hình để tải lại.',
      });
    } catch (error) {
      this.setState({ isClearing: false, error: toAppError(error) });
    }
  };

  dismissMessage = (): void => {
    this.setState({ message: null, error: null });
  };
}
