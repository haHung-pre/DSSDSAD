import type { KeyValueStore } from './key-value-store';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'prefs:theme';

/** Small, non-sensitive user preferences. Kept out of the JSON cache on purpose. */
export class PreferencesStore {
  constructor(private readonly store: KeyValueStore) {}

  async getTheme(): Promise<ThemePreference> {
    const raw = await this.store.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  }

  async setTheme(theme: ThemePreference): Promise<void> {
    await this.store.setItem(THEME_KEY, theme);
  }
}
