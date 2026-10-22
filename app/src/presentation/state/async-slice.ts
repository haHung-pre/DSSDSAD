import type { AppError } from '../../core/errors';

/**
 * The UI states every data screen must handle (INSTRUCTION.md §4.4).
 *
 * - `idle`    — nothing requested yet; screens render it as loading.
 * - `loading` — request in flight.
 * - `ready`   — success, data on screen.
 * - `empty`   — the request *succeeded* but there is nothing to show for this screen: a list
 *               with no rows, or a record that no longer exists (deleted on another device).
 *               Kept apart from `error` on purpose: retrying cannot help, so the screen must
 *               offer a way *forward* (`Quay lại`) instead of a Retry button that never works.
 * - `error`   — the request failed (offline, timeout, HTTP status, malformed payload).
 */
export type ScreenStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export type AsyncSlice<T> = {
  status: ScreenStatus;
  data: T | null;
  error: AppError | null;
};

export const idleSlice = <T>(): AsyncSlice<T> => ({ status: 'idle', data: null, error: null });
