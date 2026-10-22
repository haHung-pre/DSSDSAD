/**
 * Connectivity is an infrastructure concern, so the repositories depend on this
 * small interface instead of on `@react-native-community/netinfo` directly.
 * That keeps the data layer unit-testable without mocking native modules.
 */
export interface NetworkMonitor {
  isOnline(): Promise<boolean>;
  subscribe(listener: (online: boolean) => void): () => void;
}
