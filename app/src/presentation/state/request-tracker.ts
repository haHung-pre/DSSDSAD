/**
 * Guards a view-model against out-of-order asynchronous work.
 *
 * Two different problems, one small object:
 *
 * 1. **Stale response wins.** `load()` is called on every screen focus, and pull-to-refresh
 *    can start a second request while the first is still in flight. If the slower, *older*
 *    response arrives last it would overwrite fresher data — the list visibly jumps back.
 *    `begin()` hands out a token and `isLatest(token)` is false as soon as a newer request
 *    starts, so the old response is dropped instead of applied.
 *
 * 2. **A refresh clobbers an optimistic write.** `revalidate()` replaces the whole list with
 *    the server snapshot. If the user toggles a checkbox while that request is in flight,
 *    the response was built before the write existed and would flip the row back.
 *    `markLocalWrite()` bumps a version, and `isUnchanged(version)` tells the caller that the
 *    data changed underneath it, so it can keep the local state instead.
 *
 * Both are pure bookkeeping — no timers, no framework — which is why they are unit-tested.
 */
export class RequestTracker {
  private sequence = 0;
  private version = 0;

  /** Call at the start of a load/refresh; carry the returned token through the await. */
  begin(): { token: number; version: number } {
    this.sequence += 1;
    return { token: this.sequence, version: this.version };
  }

  /** False when a newer request started while this one was in flight. */
  isLatest(token: number): boolean {
    return token === this.sequence;
  }

  /** False when the user wrote data while the request was in flight. */
  isUnchanged(version: number): boolean {
    return version === this.version;
  }

  /** Call after every optimistic local change (toggle, edit, delete). */
  markLocalWrite(): void {
    this.version += 1;
  }
}
