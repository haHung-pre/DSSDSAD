import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppConfig = {
  /** Base URL of the REST API, without a trailing slash. */
  apiBaseUrl: string;
  /** Abort a request after this many milliseconds. */
  requestTimeoutMs: number;
  environment: string;
};

const DEFAULT_TIMEOUT_MS = 8000;

function readExtra(): Record<string, unknown> {
  return (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
}

/**
 * Development defaults used only when `EXPO_PUBLIC_API_URL` is not configured.
 * `localhost` inside an emulator/device points at the device itself, which is why
 * the Android emulator needs the special `10.0.2.2` host alias.
 */
function platformDefaultBaseUrl(): string {
  if (Platform.OS === 'web') {
    // Served by scripts/preview.mjs, which proxies /api -> http://localhost:3000.
    return '/api';
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function loadConfig(): AppConfig {
  const extra = readExtra();

  const configuredBaseUrl =
    typeof extra.apiBaseUrl === 'string' && extra.apiBaseUrl.trim().length > 0
      ? extra.apiBaseUrl.trim()
      : null;

  const timeoutCandidate = extra.requestTimeoutMs;
  const requestTimeoutMs =
    typeof timeoutCandidate === 'number' && Number.isFinite(timeoutCandidate) && timeoutCandidate > 0
      ? timeoutCandidate
      : DEFAULT_TIMEOUT_MS;

  return {
    apiBaseUrl: stripTrailingSlash(configuredBaseUrl ?? platformDefaultBaseUrl()),
    requestTimeoutMs,
    environment: typeof extra.environment === 'string' ? extra.environment : 'development',
  };
}

/** Single source of truth for runtime configuration (read once at startup). */
export const appConfig: AppConfig = loadConfig();
