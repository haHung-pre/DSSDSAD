import { useEffect } from 'react';
import { AppState } from 'react-native';

import { services } from '../../app/services';

/**
 * Replays the offline write queue automatically, on two events:
 *
 *  1. the connectivity listener reports "online again", and
 *  2. the app returns to the foreground — the common real case: the phone was in a
 *     pocket in a basement (offline), then the student opens the app on the stairs.
 *     Without this, nothing would sync until the user visited Settings.
 *
 * Failures are swallowed on purpose: the user can retry from Settings, the next
 * successful sync picks the operations up again, and `syncPending()` is guarded
 * against running twice at the same time.
 */
export function useAutoSync(): void {
  useEffect(() => {
    const sync = () => {
      void services.taskRepository.syncPending().catch(() => undefined);
    };

    const unsubscribeNetwork = services.network.subscribe((online) => {
      if (online) sync();
    });

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    return () => {
      unsubscribeNetwork();
      subscription.remove();
    };
  }, []);
}
