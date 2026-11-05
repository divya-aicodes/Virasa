# Virasā — Heritage, Verified

Virasā is a provenance platform for India’s handmade heritage. Artisans document a work, approve ownership and publication, and submit evidence; archive administrators review it before a public certificate is issued. Every change appends a SHA-256-linked revision instead of rewriting history.

## Development phases

### Phase 1 — Working product foundation

- React 18 and Vite client with public collection, product, verification, artisan studio, and administration routes.
- Artisan and product registries with a guided multi-step product creation workflow.
- Canonical JSON records fingerprinted with SHA-256 and linked through `prev_hash` values.
- Unique accession IDs, public integrity verification, QR codes, and downloadable PDF certificates.
- Role-based authentication using scrypt password hashes, HttpOnly SameSite cookies, Bearer tokens, and service API keys.
- Admin-only **Maintain** navigation and protected administration endpoints.
- CORS allow-listing, rate limiting, secure HTTP headers, server-side validation, and hardened file uploads.
- Upload checks for extension, MIME type, magic bytes, file size, and controlled storage paths.

### Phase 2 — Credible heritage records

- Append-only `product_revisions` ledger with immutable snapshots, revision hashes, and previous-revision links.
- Required correction reasons for verified records and archival instead of destructive deletion.
- Artisan consent controls for public profiles, location data, media use, and certificate publication.
- `audit_log` records for protected actions, actors, timestamps, and workflow transitions.
- Evidence records with verification status, reviewer information, timestamps, MIME type, and SHA-256 media hashes.
- Dispute workflow covering `open`, `under_review`, `resolved`, and `rejected` states.
- Explicit artisan ownership approval through the `owner_approved` gate before administrator verification.
- PEHCHAN identity review for artisan onboarding, with `pending`, `verified`, `rejected`, and `reverification_required` states that gate public publication and certificates.
- Media asset management with ownership, canonical URL, original filename, MIME type, byte size, content hash, consent, replacement, and revocation data.
- Unicode PDF certificates using embedded fonts, `fontkit`, Devanagari support, and QR verification links.

### Phase 3 — Product maturity

- SQLite FTS5 indexes, synchronization triggers, BM25 relevance ranking, and server-side pagination.
- Protected administrator product editing that validates changes and appends a new immutable revision.
- Email verification and password reset through expiring, hashed, single-use tokens with SMTP or development-outbox delivery.
- Administrator TOTP MFA using QR enrollment, `otplib`, AES-GCM encrypted secrets, and MFA-aware route authorization.
- Playwright product-flow tests and automated accessibility checks using axe-core.
- Structured JSON request logs, request IDs, counters, Prometheus-format metrics, database and ledger health checks, and throttled webhook alerts.
- Consistent SQLite backups using `VACUUM INTO`, gzip compression, integrity checks, and automated restore tests.
- Local media storage for development or S3-compatible object storage with optional CDN delivery.
- Docker configuration, GitHub Actions CI, production deployment guidance, and an operations runbook.

## Stack

| Layer | Technology |
|---|---|
| Client | React, Vite, Tailwind CSS, Framer Motion |
| API | Node.js 22+, Express |
| Data | SQLite WAL, FTS5, SHA-256 revision ledger |
| Security | scrypt, HttpOnly cookies, TOTP MFA, AES-GCM secret encryption, rate limits |
| Media | Multer, local storage or S3-compatible storage/CDN |
| QA | Node test runner, Vitest, Playwright, axe-core |

## Validation status

The following checks passed in the local development environment:

| Check | Result |
|---|---|
| Backend automated tests | 68 / 68 passed |
| Frontend automated tests | 23 / 23 passed |
| Playwright browser checks | 7 / 7 passed: 3 product-flow scenarios and 4 axe accessibility scans |
| Production frontend build | Passed with 1,963 modules transformed |
| Backup restore validation | Passed with database integrity confirmed and 9 revisions verified |
| Dependency audit | 0 known npm vulnerabilities in the root, client, and server dependency trees |

The dependency audit covers vulnerabilities known to npm at the time of the scan. It does not prove that the application has no security defects. Automated accessibility scans also require manual keyboard, screen-reader, zoom, and usability testing before production acceptance.

## PEHCHAN artisan verification

New artisan registration requires the PEHCHAN ID printed on the artisan card together with the matching name, craft, village/town, district, and state. Virasā immediately creates a linked artisan profile in `pending` state. An archive administrator then compares those details with the Government of India [Artisan Database](https://indian.handicrafts.gov.in/en/search) before recording approval or a reason for rejection.

- Virasā does **not** request or store an Aadhaar number.
- This prototype uses a recorded manual review because no supported public government verification API is assumed or claimed.
- A PEHCHAN ID is unique in the Virasā registry and is never exposed through the public artisan API.
- Changing a PEHCHAN ID clears the previous approval and requires a new review.
- Unverified artisans may maintain their private profile, but their products cannot be submitted, publicly listed, verified, or issued a certificate.
- Seeded legacy demonstration artisans remain marked verified so the existing sample collection continues to work; this is migration compatibility, not evidence of a live government check.

The official government portal also supports PEHCHAN-ID/OTP artisan login. A production integration should use a formally supported government API or authorization flow if one becomes available; it should not scrape the public portal.

## Local setup

```bash
npm run setup
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:3001`. Development seed accounts use values from `server/.env`; the bundled defaults are demonstration credentials and production startup rejects them.

Use Node.js 22 for local Playwright runs, matching the browser-test CI job. The API and build are also tested on Node.js 24, but Playwright worker shutdown is unreliable on the current Windows Node.js 24 runtime.

## Commands

| Command | Purpose |
|---|---|
| `npm run setup` | Install client/server dependencies and seed local demo data |
| `npm run dev` | Start API and Vite client |
| `npm run build` | Build the production frontend |
| `npm test` | Run backend tests |
| `npm test --prefix client -- --run` | Run frontend unit/integration tests |
| `npm run test:e2e` | Run Playwright product flows |
| `npm run test:a11y` | Run automated WCAG A/AA checks |
| `npm run test:all` | Run backend, frontend, build, E2E, and accessibility suites |
| `npm run backup --prefix server` | Create a compressed consistent database backup |
| `npm run backup:test --prefix server -- <file>` | Restore and validate a backup |

## Core API

- `GET /api/products?q=&page=&limit=` and `GET /api/artisans?q=&page=&limit=` — FTS search and pagination.
- `GET /api/products/:id/history` — append-only revision history.
- `GET /api/verify/:id` and `/api/verify/:id/certificate` — public verification and certificate.
- `/api/auth/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password` — account lifecycle.
- `POST /api/artisans/:id/pehchan/verify` and `/pehchan/reject` — administrator PEHCHAN review decisions.
- `/api/auth/mfa/setup`, `/mfa/confirm`, `/mfa/login` — administrator MFA.
- `GET /api/health` — database and ledger readiness.
- `GET /api/metrics` — authenticated Prometheus-format telemetry.

Write operations require an authorized browser session or a configured service API key. Admin-only endpoints enforce the administrator role server-side.

## Production

Copy [`server/.env.example`](server/.env.example), provide every required production secret/service, and follow [`docs/production-deployment.md`](docs/production-deployment.md). Operational monitoring, object-storage, backup, and recovery procedures are in [`docs/operations.md`](docs/operations.md).

### Vercel hosted prototype

The repository includes [`vercel.json`](vercel.json) and a Vercel Function adapter so the GitHub repository can be imported directly into Vercel for demonstrations. Vercel does not provide persistent local filesystem storage for SQLite, so each warm function instance uses an isolated database and upload directory under `/tmp`, seeded from the bundled demonstration records. Changes, registrations, sessions, and uploaded media can reset at any time and may not be shared across function instances.

This mode is intentionally a prototype, not the production architecture. Do not enter real personal data or use it as the authoritative archive. A durable public release must use persistent database and object-storage services and the deployment model in [`docs/production-deployment.md`](docs/production-deployment.md).

Important limits:-

- SQLite supports one application writer well; migrate to PostgreSQL before horizontal multi-writer scaling.
- Email delivery, S3/CDN, monitoring, and alerts require external services configured by the deployer.
- Automated axe checks catch common WCAG failures but do not replace keyboard, screen-reader, zoom, and human usability testing.

## Docker

```bash
docker build -t virasa .
docker run --env-file server/.env -p 3001:3001 -v virasa-data:/data virasa
```

The image runs migrations and serves the built client but intentionally does not seed demonstration data.
