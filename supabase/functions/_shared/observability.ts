export type LogEvent = {
  event: string;
  correlationId: string;
  ownerId?: string | null;
  sessionId?: string | null;
  entityId?: string | null;
  durationMs?: number;
  status?: string;
  errorCode?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
};

export function getCorrelationId(req: Request): string {
  return (
    req.headers.get('x-correlation-id') ??
    req.headers.get('Idempotency-Key') ??
    crypto.randomUUID()
  );
}

export function logEvent(entry: LogEvent) {
  const payload = {
    ...entry,
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(payload));
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
  corsHeaders: Record<string, string> = {},
  correlationId?: string
) {
  const headers = {
    'content-type': 'application/json',
    ...corsHeaders,
    ...(correlationId ? { 'x-correlation-id': correlationId } : {})
  };
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) }
  });
}

export function errorResponse(options: {
  code: string;
  correlationId: string;
  status?: number;
  details?: unknown;
  corsHeaders?: Record<string, string>;
}) {
  const { code, correlationId, status = 400, details, corsHeaders = {} } = options;
  const payload = {
    error: code,
    correlationId,
    ...(typeof details !== 'undefined' ? { details } : {})
  };
  return jsonResponse(payload, { status }, corsHeaders, correlationId);
}
