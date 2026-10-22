import { RequestTracker } from '../state/request-tracker';

describe('RequestTracker', () => {
  it('reports only the most recently started request as current', () => {
    const tracker = new RequestTracker();

    const first = tracker.begin();
    const second = tracker.begin();

    expect(tracker.isLatest(first.token)).toBe(false);
    expect(tracker.isLatest(second.token)).toBe(true);
  });

  it('keeps the version stable until the user writes', () => {
    const tracker = new RequestTracker();

    const request = tracker.begin();
    expect(tracker.isUnchanged(request.version)).toBe(true);

    tracker.markLocalWrite();
    expect(tracker.isUnchanged(request.version)).toBe(false);
  });

  it('a new request carries the version that is current when it starts', () => {
    const tracker = new RequestTracker();
    tracker.markLocalWrite();

    const request = tracker.begin();
    expect(tracker.isUnchanged(request.version)).toBe(true);

    tracker.markLocalWrite();
    expect(tracker.isUnchanged(request.version)).toBe(false);
  });

  it('tracks the two concerns independently', () => {
    const tracker = new RequestTracker();
    const stale = tracker.begin();
    tracker.begin();
    tracker.markLocalWrite();

    expect(tracker.isLatest(stale.token)).toBe(false);
    expect(tracker.isUnchanged(stale.version)).toBe(false);
  });
});
