/**
 * One error type for the whole app.
 *
 * The data layer translates every failure (socket error, timeout, HTTP status,
 * malformed JSON, storage problem) into an `AppError` so that view-models and
 * screens never have to know about `TypeError: Network request failed` or
 * `AbortError`. Screens render `userMessage`; `technicalMessage` is for logs only.
 */
export type AppErrorKind = 'offline' | 'timeout' | 'http' | 'parse' | 'storage' | 'unknown';

type AppErrorOptions = {
  status?: number;
  userMessage?: string;
  technicalMessage?: string;
  cause?: unknown;
};

const USER_MESSAGES: Record<AppErrorKind, string> = {
  offline: 'Không có kết nối mạng. Kiểm tra Wi-Fi/4G rồi thử lại.',
  timeout: 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.',
  http: 'Máy chủ trả về lỗi. Vui lòng thử lại sau ít phút.',
  parse: 'Dữ liệu nhận được không hợp lệ.',
  storage: 'Không đọc được dữ liệu trên thiết bị.',
  unknown: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
};

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status?: number;
  readonly userMessage: string;
  readonly technicalMessage: string;

  constructor(kind: AppErrorKind, options: AppErrorOptions = {}) {
    const technicalMessage = options.technicalMessage ?? options.userMessage ?? kind;
    super(technicalMessage);
    this.name = 'AppError';
    this.kind = kind;
    this.status = options.status;
    this.userMessage = options.userMessage ?? defaultUserMessage(kind, options.status);
    this.technicalMessage = technicalMessage;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }

  /** Can the user usefully press "Thử lại"? */
  get canRetry(): boolean {
    if (this.kind === 'http' && this.status !== undefined) {
      return this.status >= 500 || this.status === 408 || this.status === 429;
    }
    return this.kind !== 'parse';
  }

  static offline(cause?: unknown): AppError {
    return new AppError('offline', { cause });
  }

  static timeout(ms: number): AppError {
    return new AppError('timeout', { technicalMessage: `Request aborted after ${ms} ms` });
  }

  static http(status: number, technicalMessage?: string): AppError {
    return new AppError('http', { status, technicalMessage: technicalMessage ?? `HTTP ${status}` });
  }

  static parse(technicalMessage: string, cause?: unknown): AppError {
    return new AppError('parse', { technicalMessage, cause });
  }
}

function defaultUserMessage(kind: AppErrorKind, status?: number): string {
  if (kind === 'http' && status !== undefined) {
    if (status === 404) return 'Không tìm thấy dữ liệu cần tìm.';
    if (status === 400 || status === 422) return 'Dữ liệu gửi đi chưa hợp lệ.';
    if (status === 401 || status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    if (status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.';
  }
  return USER_MESSAGES[kind];
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Normalise anything thrown by the network/storage layers into an `AppError`. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof Error) {
    const name = error.name;
    const message = error.message.toLowerCase();

    if (name === 'AbortError' || message.includes('aborted')) {
      return new AppError('timeout', { technicalMessage: error.message, cause: error });
    }
    if (
      error instanceof TypeError ||
      message.includes('network request failed') ||
      message.includes('failed to fetch') ||
      message.includes('network error') ||
      message.includes('err_internet_disconnected')
    ) {
      return new AppError('offline', { technicalMessage: error.message, cause: error });
    }
    return new AppError('unknown', { technicalMessage: error.message, cause: error });
  }

  if (typeof error === 'string') {
    return new AppError('unknown', { technicalMessage: error });
  }

  return new AppError('unknown', { technicalMessage: 'Unknown error' });
}
