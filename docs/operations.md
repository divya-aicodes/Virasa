# Operations runbook

## Monitoring and alerts

`GET /api/health` checks SQLite integrity and the append-only revision chain. A failure returns HTTP 503. `GET /api/metrics` exposes process uptime, request/error counters, status counts, and average latency in Prometheus text format; it requires the `x-metrics-token` header.

All requests emit one structured JSON log with request ID, method, path, status, and duration. Unexpected server errors send a throttled JSON notification to `ALERT_WEBHOOK_URL`. Alert on health failures, 5xx growth, latency, disk utilization, backup age, and certificate expiry. The built-in counters reset when the process restarts; use the monitoring platform for durable history.

## Backups and restore drills

Create a transactionally consistent compressed SQLite backup:

```bash
npm run backup --prefix server
npm run backup:test --prefix server -- server/backups/virasa-<timestamp>.db.gz
```

Schedule backups at least daily and copy them to encrypted off-site storage with object versioning. The restore test checks gzip recovery, SQLite integrity, required tables, and every revision hash link. Run a restore test after each backup in staging and a documented recovery drill at least quarterly. Set retention with `BACKUP_RETENTION_DAYS`.

Production media should use `STORAGE_DRIVER=s3`; enable bucket versioning, server-side encryption, lifecycle policy, blocked public ACLs, and CDN origin access control. Database backups do not include local upload files, which is why local storage is intended only for development.

## Incident handling

1. Remove write traffic but preserve read-only evidence where safe.
2. Save application logs, request IDs, health output, and a database snapshot.
3. Do not repair revision rows in place. Resolve bad records through the dispute/correction flow so history remains visible.
4. Restore to a new database path and run the restore test before switching traffic.
5. Record the incident and rotate affected sessions, API keys, SMTP credentials, or storage credentials.
