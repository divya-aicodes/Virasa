import crypto from 'node:crypto';

const startedAt = Date.now();
const metrics = { requests: 0, errors: 0, durationMs: 0, byStatus: new Map() };
let lastAlertAt = 0;

export function requestTelemetry(req, res, next) {
  const started = process.hrtime.bigint();
  const requestPath = String(req.originalUrl || req.url || '').split('?')[0];
  req.requestId = String(req.headers['x-request-id'] || crypto.randomUUID()).slice(0, 100);
  res.setHeader('X-Request-Id', req.requestId);
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    metrics.requests += 1;
    metrics.durationMs += durationMs;
    metrics.byStatus.set(res.statusCode, (metrics.byStatus.get(res.statusCode) || 0) + 1);
    if (res.statusCode >= 500) metrics.errors += 1;
    const record = { level: res.statusCode >= 500 ? 'error' : 'info', type: 'http', requestId: req.requestId, method: req.method, path: requestPath, status: res.statusCode, durationMs: Number(durationMs.toFixed(2)), at: new Date().toISOString() };
    console.log(JSON.stringify(record));
  });
  next();
}

export function metricsText() {
  const avg = metrics.requests ? metrics.durationMs / metrics.requests : 0;
  const lines = [
    '# HELP virasa_uptime_seconds Process uptime.',
    '# TYPE virasa_uptime_seconds gauge',
    `virasa_uptime_seconds ${(Date.now() - startedAt) / 1000}`,
    '# HELP virasa_http_requests_total HTTP requests handled.',
    '# TYPE virasa_http_requests_total counter',
    `virasa_http_requests_total ${metrics.requests}`,
    `virasa_http_errors_total ${metrics.errors}`,
    `virasa_http_request_duration_ms_avg ${avg.toFixed(3)}`,
  ];
  for (const [status, count] of metrics.byStatus) lines.push(`virasa_http_responses_total{status="${status}"} ${count}`);
  return `${lines.join('\n')}\n`;
}

export async function alertOnError(error, req) {
  const webhook = String(process.env.ALERT_WEBHOOK_URL || '').trim();
  if (!webhook || Date.now() - lastAlertAt < 60_000) return;
  lastAlertAt = Date.now();
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Virasā API error', requestId: req?.requestId, path: String(req?.originalUrl || req?.url || '').split('?')[0], message: error?.message, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (alertError) {
    console.error(JSON.stringify({ level: 'error', type: 'alert_delivery_failed', message: alertError.message, at: new Date().toISOString() }));
  }
}
