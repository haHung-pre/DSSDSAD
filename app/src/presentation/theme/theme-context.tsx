import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import type { PreferencesStore, ThemePreference } from '../../data/local/preferences';
import { darkColors, layout, lightColors, radius, spacing, typography, type ThemeColors } from './tokens';

export type Theme = {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  layout: typeof layout;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<Theme | null>(null);

type Props = {
  children: React.ReactNode;
  preferences: PreferencesStore;
};

/**
 * Light/dark tokens + the user's preference (persisted).
 * Screens only ever read `useTheme().colors`, never a literal hex value.
 */
export function ThemeProvider({ children, preferences }: Props) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    preferences
      .getTheme()
      .then((stored) => {
        if (!cancelled) setPreferenceState(stored);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [preferences]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      preferences.setTheme(next).catch(() => undefined);
    },
    [preferences],
  );

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const value = useMemo<Theme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      spacing,
      radius,
      typography,
      layout,
      isDark,
      preference,
      setPreference,
    }),
    [isDark, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
