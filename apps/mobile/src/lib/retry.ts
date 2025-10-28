export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function expoBackoff(attempt: number, base = 200, cap = 3000) {
  const interval = Math.min(cap, base * Math.pow(2, attempt));
  const jitter = Math.random() * (interval * 0.3);
  return Math.round(interval + jitter);
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, tag = 'op'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout:${tag}:${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  attempts = 3,
  backoffBase = 200,
  cap = 3000
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) {
        break;
      }
      await sleep(expoBackoff(i, backoffBase, cap));
    }
  }
  throw lastErr;
}
