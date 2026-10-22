import type { ExpoConfig } from 'expo/config';

/**
 * App configuration.
 *
 * The API base URL is NEVER hard-coded inside the source code: it comes from the
 * environment (`EXPO_PUBLIC_API_URL`, see `.env.example`) and is exposed to the app
 * through `expo-constants` (`extra.apiBaseUrl` -> `src/config/env.ts`).
 *
 * When nothing is configured we fall back to a per-platform development default so a
 * fresh clone still works with the mock API from `backend/`.
 */
const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
const requestTimeoutMs = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 8000);

const config: ExpoConfig = {
  name: 'StudyMate',
  slug: 'studymate',
  version: '1.0.0',
  // Not locked: the layout must survive rotation (INSTRUCTION.md §6, B1).
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'studymate',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'edu.ptit.studymate',
  },
  android: {
    package: 'edu.ptit.studymate',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#0B1220',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  extra: {
    apiBaseUrl,
    requestTimeoutMs: Number.isFinite(requestTimeoutMs) ? requestTimeoutMs : 8000,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  },
};

export default config;
