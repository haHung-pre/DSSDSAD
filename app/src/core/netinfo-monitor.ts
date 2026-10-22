import NetInfo from '@react-native-community/netinfo';

import type { NetworkMonitor } from './network-monitor';

/**
 * NetInfo-backed connectivity check.
 *
 * `isInternetReachable` can be `null` while the first probe is running, so we treat
 * "unknown" as online and let the request itself fail with a timeout/offline error.
 */
export class NetInfoMonitor implements NetworkMonitor {
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return false;
    if (state.isInternetReachable === false) return false;
    return true;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    return NetInfo.addEventListener((state) => {
      listener(state.isConnected !== false && state.isInternetReachable !== false);
    });
  }
}
