import { AppError } from '../errors';
import { FetchHttpClient } from '../http-client';

type FakeResponse = { ok: boolean; status: number; text: () => Promise<string> };

function jsonResponse(body: unknown, status = 200): FakeResponse {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

describe('FetchHttpClient', () => {
  it('parses a successful JSON response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse([{ id: 1 }]));
    const client = new FetchHttpClient('http://api.test', 1000, fetchImpl as never);

    await expect(client.get('/tasks')).resolves.toEqual([{ id: 1 }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.test/tasks',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('joins base URL and path without doubling slashes', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}));
    const client = new FetchHttpClient('http://api.test/', 1000, fetchImpl as never);

    await client.get('/tasks/1');
    expect(fetchImpl.mock.calls[0][0]).toBe('http://api.test/tasks/1');
  });

  it('maps 404 to an http AppError that cannot be retried', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 404));
    const client = new FetchHttpClient('http://api.test', 1000, fetchImpl as never);

    await expect(client.get('/tasks/99')).rejects.toMatchObject({
      kind: 'http',
      status: 404,
      canRetry: false,
    });
  });

  it('maps 500 to a retryable http AppError', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 500));
    const client = new FetchHttpClient('http://api.test', 1000, fetchImpl as never);

    const error = await client.get('/tasks').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).canRetry).toBe(true);
    expect((error as AppError).userMessage).toContain('Máy chủ');
  });

  it('maps malformed JSON to a parse AppError', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '<html>' });
    const client = new FetchHttpClient('http://api.test', 1000, fetchImpl as never);

    await expect(client.get('/tasks')).rejects.toMatchObject({ kind: 'parse' });
  });

  it('aborts a hanging request and reports a timeout', async () => {
    const hangingFetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const client = new FetchHttpClient('http://api.test', 20, hangingFetch as never);

    await expect(client.get('/tasks')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('maps a network failure to an offline AppError', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const client = new FetchHttpClient('http://api.test', 1000, fetchImpl as never);

    const error = (await client.get('/tasks').catch((caught: unknown) => caught)) as AppError;
    expect(error.kind).toBe('offline');
    expect(error.userMessage).toContain('kết nối mạng');
  });

  it('sends a JSON body on POST', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ id: 7 }));
    const client = new FetchHttpClient('http://api.test', 1000, fetchImpl as never);

    await client.post('/tasks', { title: 'Nộp bài' });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ title: 'Nộp bài' }),
    });
  });
});
