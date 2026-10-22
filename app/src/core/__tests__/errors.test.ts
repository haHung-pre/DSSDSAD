import { AppError, isAppError, toAppError } from '../errors';

/**
 * `AppError.canRetry` is the app's one rule for "would pressing Retry help?".
 * `ErrorState` uses it to decide whether to render the button at all, so the rule
 * deserves its own test: if it silently flips, the UI starts offering a button that
 * cannot work (404) or hides one that could (offline).
 */
describe('AppError.canRetry', () => {
  it('offers a retry for transient failures', () => {
    expect(AppError.offline().canRetry).toBe(true);
    expect(AppError.timeout(8000).canRetry).toBe(true);
    expect(AppError.http(500).canRetry).toBe(true);
    expect(AppError.http(503).canRetry).toBe(true);
    expect(AppError.http(408).canRetry).toBe(true);
    expect(AppError.http(429).canRetry).toBe(true);
    expect(new AppError('storage', { technicalMessage: 'quota' }).canRetry).toBe(true);
  });

  it('refuses a retry when the same request would fail the same way', () => {
    // The record is gone / the caller may not touch it / the body was rejected:
    // repeating the request cannot change the answer.
    expect(AppError.http(404).canRetry).toBe(false);
    expect(AppError.http(400).canRetry).toBe(false);
    expect(AppError.http(422).canRetry).toBe(false);
    expect(AppError.http(403).canRetry).toBe(false);
  });

  it('refuses a retry for a payload that does not parse', () => {
    // Same URL, same server version -> the same broken body comes back.
    expect(AppError.parse('tasks[0].dueDate is not a date').canRetry).toBe(false);
  });
});

describe('AppError messages', () => {
  it('never leaks the technical message to the user', () => {
    const error = AppError.parse('tasks[0].title missing');

    expect(error.technicalMessage).toBe('tasks[0].title missing');
    expect(error.userMessage).not.toContain('tasks[0]');
    expect(error.userMessage).toBe('Dữ liệu nhận được không hợp lệ.');
  });

  it('explains a 404 in the user’s words', () => {
    expect(AppError.http(404).userMessage).toBe('Không tìm thấy dữ liệu cần tìm.');
    expect(AppError.http(401).userMessage).toBe('Bạn không có quyền thực hiện thao tác này.');
    expect(AppError.http(500).userMessage).toBe('Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.');
  });
});

describe('toAppError', () => {
  it('maps what fetch actually throws in React Native and on the web', () => {
    expect(toAppError(new TypeError('Network request failed')).kind).toBe('offline');
    expect(toAppError(new Error('Failed to fetch')).kind).toBe('offline');
    const aborted = new Error('The operation was aborted.');
    aborted.name = 'AbortError';
    expect(toAppError(aborted).kind).toBe('timeout');
  });

  it('passes AppError through untouched', () => {
    const original = AppError.http(500, 'boom');
    expect(toAppError(original)).toBe(original);
  });

  it('wraps anything else as unknown, keeping the text for the logs', () => {
    const wrapped = toAppError('something odd');

    expect(wrapped.kind).toBe('unknown');
    expect(wrapped.technicalMessage).toBe('something odd');
    expect(isAppError(wrapped)).toBe(true);
  });
});
