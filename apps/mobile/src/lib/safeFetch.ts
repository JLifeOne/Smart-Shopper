const fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch as any;

type SafeFetchOptions = RequestInit & { timeoutMs?: number };

export class SafeFetchError<T = unknown> extends Error {
  status: number;
  body: T | null;

  constructor(message: string, status: number, body: T | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function safeFetch<T>(input: RequestInfo | URL, init: SafeFetchOptions = {}): Promise<T> {
  const { timeoutMs = 10_000, ...requestInit } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(input, { ...requestInit, signal: controller.signal as any });
    const text = await response.text();
    const body = text && text.trim().length ? (JSON.parse(text) as T) : null;

    if (!response.ok) {
      throw new SafeFetchError('safeFetch_failed', response.status, body);
    }

    if (body == null) {
      throw new SafeFetchError('safeFetch_empty', response.status, null);
    }

    return body;
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') {
      throw new SafeFetchError('safeFetch_timeout', 408, null);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
