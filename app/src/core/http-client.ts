import { AppError, toAppError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RequestOptions = {
  /** Overrides the client-wide timeout, e.g. for uploads. */
  timeoutMs?: number;
  signal?: AbortSignal;
};

/**
 * Minimal HTTP contract used by the data layer. Screens and view-models never
 * touch `fetch` directly; they only see repositories, and repositories only see this.
 */
export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  delete(path: string, options?: RequestOptions): Promise<void>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * `fetch` + JSON + a hard timeout, with every failure mapped to an `AppError`.
 *
 * Timeouts use `AbortController` because React Native's `fetch` has no built-in
 * timeout: without it a request on a flaky network can hang forever and the user
 * would stare at a spinner.
 */
export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl: string, timeoutMs: number, fetchImpl?: FetchLike) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete(path: string, options?: RequestOptions): Promise<void> {
    await this.request<unknown>('DELETE', path, undefined, options);
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/${path.replace(/^\/+/, '')}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw AppError.http(response.status, `HTTP ${response.status} on ${method} ${path}`);
      }

      if (response.status === 204) return undefined as T;

      const raw = await response.text();
      if (raw.trim().length === 0) return undefined as T;

      try {
        return JSON.parse(raw) as T;
      } catch (error) {
        throw AppError.parse(`Malformed JSON from ${method} ${path}`, error);
      }
    } catch (error) {
      throw toAppError(error);
    } finally {
      clearTimeout(timer);
    }
  }
}
