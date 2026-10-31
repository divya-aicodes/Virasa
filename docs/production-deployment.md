# Production deployment

Virasā is a single Node.js service serving the API and the built React application. Production should run one application replica against a persistent SQLite volume. Horizontal multi-writer scaling requires migration to PostgreSQL first.

## Required services

- Node.js 22 or the provided Docker image.
- A persistent encrypted volume for `DB_PATH`.
- An S3-compatible private upload bucket fronted by an HTTPS CDN.
- SMTP for email verification and password recovery.
- A scheduler for backups and restore drills.
- A Prometheus-compatible scraper and an alert webhook receiver.

## Build and configure

```bash
npm ci --prefix server
npm ci --prefix client
npm run build
NODE_ENV=production node server/index.js
```

Set every production value documented in `server/.env.example`. At minimum, use explicit HTTPS `BASE_URL` and `ALLOWED_ORIGINS`, a random `MFA_ENCRYPTION_KEY` and `METRICS_TOKEN` of at least 32 characters, SMTP, and S3/CDN settings. Prefer workload identity/IAM roles over static AWS access keys.

The service refuses to start if demo passwords, localhost origins, insecure URLs, or missing security secrets are detected. The Docker image does not seed data automatically. Run `npm run seed --prefix server` only for an intentional demonstration environment with `SEED_DEMO_DATA=true` and strong account passwords.

## Release sequence

1. Snapshot the database and run a restore test.
2. Build and scan the image and dependencies.
3. Deploy to staging, run `npm run test:e2e` and `npm run test:a11y` against the release.
4. Deploy one production instance with the persistent database volume mounted.
5. Check `/api/health`; scrape `/api/metrics` with `x-metrics-token`.
6. Enrol every administrator in MFA from **Maintain → Administrator security** before granting operational access.
7. Run a smoke test covering sign-in, search, upload, verification, certificate download, and password recovery.

## Reverse proxy

Terminate TLS at the platform load balancer, preserve `X-Forwarded-For` and `X-Request-Id`, and redirect HTTP to HTTPS. The app trusts one proxy hop in production. Do not expose the SQLite volume, `/api/metrics`, SMTP credentials, or S3 credentials publicly.

## Rollback

Application rollback is an image/tag rollback. Data rollback is deliberately separate: stop writes, preserve the failed database for investigation, restore a tested backup to a new path, point `DB_PATH` to it, and verify `/api/health` before reopening traffic. Never overwrite the only database copy.
