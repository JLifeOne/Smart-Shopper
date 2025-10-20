type AnalyticsPayload = Record<string, unknown>;

const queue: Array<{ event: string; payload?: AnalyticsPayload }> = [];

export function trackEvent(event: string, payload?: AnalyticsPayload) {
  if (!event) {
    return;
  }
  queue.push({ event, payload });
  if (__DEV__) {
    const details = payload ? JSON.stringify(payload) : '';
    console.log(`[analytics] ${event}${details ? ` ${details}` : ''}`);
  }
}

export function flushAnalytics() {
  if (!queue.length) {
    return;
  }
  queue.splice(0, queue.length);
}
