import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * A "now" that keeps moving.
 *
 * Every screen turns timestamps into words the student reads at a glance — "Hôm nay",
 * "Còn 2 ngày", "Quá hạn 1 ngày", the exam countdown. All of that is computed from
 * `new Date()` **at render time**, so a screen that is simply left open (the app sits in
 * the foreground overnight, or the phone is taken out of a pocket the next morning with
 * the app still mounted) keeps showing yesterday's labels until something else happens to
 * re-render it.
 *
 * This hook re-renders the screen once a minute — cheap, and enough for day-granularity
 * labels — and immediately when the app returns to the foreground, which is exactly the
 * moment the labels are most likely to be stale.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
