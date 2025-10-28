export type ErrorCode =
  | 'auth/unauthorized'
  | 'net/timeout'
  | 'net/offline'
  | 'sync/conflict'
  | 'db/constraint'
  | 'input/validation'
  | 'unknown';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly context?: Record<string, unknown>;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    safeMessage?: string;
    cause?: unknown;
    retryable?: boolean;
    context?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.code = opts.code;
    this.cause = opts.cause;
    this.safeMessage = opts.safeMessage ?? 'Something went wrong. Please try again.';
    this.retryable = opts.retryable ?? false;
    this.context = opts.context;
  }
}

export const toAppError = (err: unknown, fallback: Partial<AppError> = {}) => {
  if (err instanceof AppError) {
    return err;
  }
  return new AppError({
    code: (fallback as any).code ?? 'unknown',
    message: (err as any)?.message ?? 'Unknown error',
    safeMessage: (fallback as any).safeMessage,
    retryable: (fallback as any).retryable ?? false,
    context: { raw: String(err) }
  });
};
