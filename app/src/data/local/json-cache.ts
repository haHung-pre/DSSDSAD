import { AppError, toAppError } from '../../core/errors';
import type { KeyValueStore } from './key-value-store';

export type CachedEntry<T> = {
  value: T;
  savedAt: number;
};

/**
 * JSON snapshots of API responses, stored under a namespace so that "clear cache"
 * can wipe app data without touching user preferences.
 */
export class JsonCache {
  constructor(
    private readonly store: KeyValueStore,
    private readonly namespace: string = 'cache',
  ) {}

  private key(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private get indexKey(): string {
    return `${this.namespace}:__index`;
  }

  async read<T>(key: string): Promise<CachedEntry<T> | null> {
    try {
      const raw = await this.store.getItem(this.key(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedEntry<T>;
      if (typeof parsed?.savedAt !== 'number' || parsed.value === undefined) return null;
      return parsed;
    } catch (error) {
      // A corrupted snapshot must never crash the app: treat it as "no cache".
      if (error instanceof AppError) throw error;
      throw new AppError('storage', {
        technicalMessage: `Failed to read cache entry "${key}"`,
        cause: error,
      });
    }
  }

  async write<T>(key: string, value: T, savedAt: number): Promise<void> {
    try {
      await this.store.setItem(this.key(key), JSON.stringify({ value, savedAt }));
      const index = (await this.readIndex()).filter((entry) => entry !== key);
      index.push(key);
      await this.store.setItem(this.indexKey, JSON.stringify(index));
    } catch (error) {
      throw toAppError(error);
    }
  }

  async remove(key: string): Promise<void> {
    await this.store.removeItem(this.key(key));
    const index = (await this.readIndex()).filter((entry) => entry !== key);
    await this.store.setItem(this.indexKey, JSON.stringify(index));
  }

  async clear(): Promise<void> {
    const index = await this.readIndex();
    await Promise.all(index.map((key) => this.store.removeItem(this.key(key))));
    await this.store.removeItem(this.indexKey);
  }

  /** Keys currently cached (helps the Settings screen show what is stored offline). */
  async keys(): Promise<string[]> {
    return this.readIndex();
  }

  private async readIndex(): Promise<string[]> {
    const raw = await this.store.getItem(this.indexKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
}
