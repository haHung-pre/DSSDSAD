import type { Clock } from '../../core/clock';
import type { NetworkMonitor } from '../../core/network-monitor';
import { toAppError } from '../../core/errors';
import type { Loaded } from '../../domain/repositories';
import type { JsonCache } from '../local/json-cache';

type Deps<T> = {
  cache: JsonCache;
  cacheKey: string;
  clock: Clock;
  network: NetworkMonitor;
  fetchRemote: () => Promise<T[]>;
};

/**
 * Read-only "stale-while-revalidate" repository used by courses, sessions and the
 * student profile: the UI always gets data immediately from the cache when it exists,
 * and `refresh()` replaces it with the server copy.
 *
 * If the network fails but a snapshot exists, the cached data is returned with
 * `origin: 'cache'` so the screen can show an "offline" banner instead of an error.
 */
export class CachedListRepository<T> {
  constructor(private readonly deps: Deps<T>) {}

  async load(): Promise<Loaded<T[]>> {
    const cached = await this.deps.cache.read<T[]>(this.deps.cacheKey);
    if (cached) {
      return { data: cached.value, origin: 'cache', savedAt: cached.savedAt };
    }
    return this.refresh();
  }

  async refresh(): Promise<Loaded<T[]>> {
    try {
      const online = await this.deps.network.isOnline();
      if (!online) throw toAppError(new Error('Network request failed'));

      const data = await this.deps.fetchRemote();
      const savedAt = this.deps.clock().getTime();
      await this.deps.cache.write(this.deps.cacheKey, data, savedAt);
      return { data, origin: 'network', savedAt };
    } catch (error) {
      const cached = await this.deps.cache.read<T[]>(this.deps.cacheKey);
      if (cached) {
        return { data: cached.value, origin: 'cache', savedAt: cached.savedAt };
      }
      throw toAppError(error);
    }
  }
}
