# Virasā — Heritage, Verified

**Virasā** (विरसा — "legacy / heritage") is a provenance platform that preserves India's handmade
craft traditions by binding each artwork to a tamper-evident chain of provenance records.

A Madhubani painting, a Warli mural, a Pattachitra panel — every piece is documented by the
artisan with its maker, village, materials, and the individual steps of its creation. Those
records are linked together with SHA-256 hashes into a lightweight chained ledger. Anyone with a
QR scan or an accession ID can recompute the fingerprints, confirm the chain is unbroken, and
download a certificate of authenticity.

> Proof should feel as human as the hands it protects.

---

## Why this exists

- **3,00,000+** artisan livelihoods depend on endangered craft traditions.
- **₹1,200 Cr** is lost each year to counterfeit handicrafts.
- A single **QR scan** lets a buyer meet the maker and verify every documented step.

Unlike heavyweight blockchain stacks, Virasā needs **no wallets, no gas fees, and no crypto
expertise** — only a chained ledger any browser can verify.

---

## Features

- **Chained provenance ledger** — each product hashes the canonical record plus the previous
  block's hash (`prev_hash`). Alter one field and every downstream check fails.
- **Artisan registry** — record name, village, district, state, craft, bio, and photo.
- **Multi-step making process** — upload a main artwork photo plus up to 4 creation-step photos
  with captions.
- **Instant verification** — enter an accession ID (`KC-…`) and the server recomputes the
  fingerprint and checks every link in the chain.
- **Search & pagination** on the API for both products and artisans (server-side).
- **Registry management (Admin)** — a `/admin` dashboard to search, create, edit, and delete
  artisans, inspect products, and remove invalid product records.
- **PDF certificates** — a branded, QR-coded certificate of authenticity per product.
- **Secure uploads** — MIME/extension allow-list, magic-byte sniffing, file-size limits.
- **API-key auth** for all write endpoints, plus per-route rate limiting.
- **Accounts & sessions** — sign-up and sign-in with scrypt-hashed passwords and HttpOnly session
  cookies; artisans manage only their linked profiles and products, while admins manage the registry.
- **Bilingual artisan flow** — English / हिन्दी.
- **Production-ready serving** — the Express server also serves the built React client with SPA
  fallback, so a single server is all you need to deploy.

---

## Tech stack

| Layer | Tools |
|-------|-------|
| Frontend | React 18, Vite 5, Tailwind CSS v4, Framer Motion, lucide-react |
| Backend | Node.js 22+ (`node:sqlite`), Express 4 |
| Data | SQLite (WAL mode), chained SHA-256 hashes via `node:crypto` |
| Extras | pdf-lib (certificates), qrcode (QR codes), multer (uploads), express-rate-limit |
| Tests | Node's built-in test runner (`node --test`) |

Requires **Node.js ≥ 22.5** for the stable built-in SQLite module.

---

## Getting started

```bash
# 1. Install everything and seed the database
npm run setup

# 2. Configure environment (optional)
cp server/.env.example server/.env

# 3. Run in development (server on :3001, client on :5173)
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` and `/uploads` to the API.

---

## Scripts

Run from the repo root:

| Command | Description |
|---------|-------------|
| `npm run setup` | Install server + client deps and seed the database |
| `npm run dev` | Start API (`:3001`) and Vite client (`:5173`) together |
| `npm run seed` | Seed / re-seed the database (idempotent) |
| `npm run build` | Build the React client into `client/dist` |
| `npm test` | Run server tests |
| `npm run test --prefix client` | Run frontend (Vitest) tests |
| `npm start` | Production: serve the built client + API on `:3001` |

### Docker

```bash
docker build -t virasa .
docker run -p 3001:3001 -v virasa-data:/data \
  -e SEED_DEMO_DATA=true \
  -e ADMIN_PASSWORD=<strong-password> \
  -e ARTISAN_PASSWORD=<strong-password> \
  -e ALLOWED_ORIGINS=https://virasa.example.com \
  -e BASE_URL=https://virasa.example.com \
  -e API_KEYS=<service-key> virasa
```

The named volume preserves the SQLite database and uploaded media across container replacement.
Production demo seeding is opt-in and refuses the bundled development passwords.

---

## Environment variables

Copy `server/.env.example` to `server/.env`. Key values:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | API/production port |
| `NODE_ENV` | `development` | `production` enables client serving |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3001` | CORS allow-list |
| `BASE_URL` | `http://localhost:3001` | Base used in certificate QR links |
| `API_KEYS` | *(empty)* | Optional service keys for trusted non-browser writes |
| `RATE_WINDOW_MS` / `RATE_MAX` | `900000` / `200` | Global rate limit |
| `WRITE_MAX` / `UPLOAD_MAX` | `20` / `30` | Per-window write/upload limits |
| `DB_PATH` | `kalachain.db` | SQLite file location |
| `UPLOAD_DIR` | `uploads` | Uploaded media directory |
| `SEED_DEMO_DATA` | `false` | Explicit production gate for bundled demo data |

> Write endpoints always require a signed-in authorized account or service key. Service clients
> must send API keys only through the `x-api-key` header; query-string keys are rejected.

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## API reference

Base URL: `/api` (proxied in dev, served directly in production).

### Health & discovery

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness + counts |
| GET | `/api` | Endpoint index |

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create an account (`name`, `email`, `password`; optional `artisanId`) |
| POST | `/api/auth/login` | Sign in, returns `{ token, user }` (Bearer token, 7-day session) |
| POST | `/api/auth/logout` | Invalidate the session (auth) |
| GET | `/api/auth/me` | Current user (auth) |

Send the token as `Authorization: Bearer <token>`. Registering a role of `admin` requires the
`ADMIN_SIGNUP_KEY` set on the server. Passwords are hashed with Node's `scrypt` (salted,
constant-time comparison) and stored in the `users` table; session tokens live in the
`sessions` table and expire after 7 days.

**Role separation.** Browser authentication uses an HttpOnly, `SameSite=Lax` session cookie.
Bearer sessions remain available for non-browser API clients. Admin sessions and valid service
API keys can manage the full registry. Artisan accounts may create one linked artisan profile and
may create, update, or delete only products belonging to that profile. Configure development demo
account passwords in `server/.env`; production refuses known bundled passwords.

The client guards `/admin` behind a valid admin session and redirects anonymous visitors to
`/login`.

### Artisans

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/artisans` | List (supports `q`, `craft`, `state`, `page`, `limit`) |
| GET | `/api/artisans/:id` | Single artisan |
| POST | `/api/artisans` | Create artisan (auth) |
| PATCH | `/api/artisans/:id` | Update artisan (auth) |
| DELETE | `/api/artisans/:id` | Delete artisan if no products linked (auth) |

```json
{
  "name": "Sunita Devi",
  "village": "Ranti, Madhubani",
  "craft": "Madhubani Painting",
  "state": "Bihar",
  "district": "Madhubani",
  "bio": "Third-generation Mithila artist.",
  "photo": "/uploads/avatar-ART-MITHILA1.svg"
}
```

**Pagination.** Add `page` and `limit` to receive a paginated response:

```json
{ "data": [ … ], "total": 9, "page": 1, "limit": 20, "totalPages": 1 }
```

Without `page`/`limit` the route returns a plain array (backward compatible).

### Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List (supports `q`, `category`, `craft`, `page`, `limit`) |
| GET | `/api/products/:id` | Single product |
| POST | `/api/products` | Create product + append to chain (auth) |
| PATCH | `/api/products/:id` | Update product + re-link chain (auth) |
| DELETE | `/api/products/:id` | Delete product + re-link chain (auth) |

```json
{
  "artisan_id": "ART-MITHILA1",
  "title": "Krishna Leela — Peacock Dance",
  "description": "Hand-painted with natural dyes.",
  "image": "/uploads/product-KC-A1B2C3-final.svg",
  "steps": [
    { "image": "/uploads/...-step1.svg", "caption": "Outline drawn by hand" }
  ],
  "materials": ["Handmade paper", "Vegetable dyes"],
  "price": 4500,
  "category": "Madhubani"
}
```

### Verification & certificates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/verify/:id` | Recompute fingerprint + chain check |
| GET | `/api/verify` | Full chain (ordered blocks) |
| GET | `/api/verify/:id/certificate` | Download PDF certificate |

`GET /api/verify/:id` response:

```json
{
  "valid": true,
  "verify": {
    "valid": true,
    "hash": "d66b9484…",
    "prevHash": "GENESIS",
    "chainIndex": 1,
    "chainLength": 9,
    "recomputed": "d66b9484…",
    "chainLink": true
  },
  "product": { "id": "KC-A1B2C3", "title": "…", "artisan_name": "…", "…": "…" }
}
```

### Uploads

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | `multipart/form-data` `files` (max 10, 5 MB each, JPG/PNG/WebP) (auth) |
| GET | `/uploads/*` | Static uploaded assets |

---

## How the chain works

1. A product is created with its canonical fields: `id, artisan_id, title, description, image,
   steps, materials, price, category, created_at`.
2. The server reads the **last** block in the ledger.
3. `hash = sha256(canonical JSON + "|" + prev_hash)` — the previous block's hash is the
   `GENESIS` marker for the first block.
4. On verification the server recomputes every block from genesis through the selected record,
   checks contiguous indexes, and confirms every previous-hash link. Any direct database tampering
   produces a mismatch and the record is reported invalid.

**Important trust boundary:** this is a mutable, tamper-evident operational registry—not an
externally anchored immutable blockchain. Authorized edits or deletions deliberately re-link the
chain in one SQLite transaction. Direct, unauthorized database changes are detectable; authorized
history preservation and append-only revisions are planned separately.

See `server/lib/hashchain.js` and `server/lib/canonical.js`.

---

## Running tests

```bash
npm test                # server suite (validation, chain integrity, HTTP API)
npm run test --prefix client   # frontend (Vitest + Testing Library)
```

The server suite covers validation, chain integrity (including tamper detection), search &
pagination, and the full HTTP API — including update/delete with chain re-linking — against an
isolated throwaway SQLite database, so it never touches real data.

---

## Continuous integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the server tests and builds the
client on Node 22 and 24 for every push and pull request.

---

## Project structure

```
Virasā/
├── client/                 # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── pages/          # Landing, Gallery, ProductPage, VerifyPage, ArtisanPanel, Admin
│   │   ├── components/     # Navbar and shared UI helpers
│   │   ├── lib/api.js      # fetch wrapper
│   │   ├── test/           # Vitest tests
│   │   └── main.jsx / App.jsx
│   └── vite.config.js      # dev proxy for /api and /uploads; vitest config
├── server/                 # Express + SQLite backend
│   ├── index.js            # entry point (starts server)
│   ├── app.js              # the Express app (importable, testable)
│   ├── db.js               # schema + connection
│   ├── seed.js             # curated dataset + chain bootstrap
│   ├── routes/             # artisans, products, verify
│   ├── lib/                # hashchain, canonical, validate, certificate
│   └── test/               # node --test suites
├── .github/workflows/ci.yml # CI pipeline
├── Dockerfile / .dockerignore / .nvmrc
├── .gitignore
└── package.json
```

---

## Deployment

1. Build the client: `npm run build`.
2. Copy `server/.env.example` → `server/.env`; set strong account passwords, an HTTPS
   `BASE_URL`, explicit `ALLOWED_ORIGINS`, and any service `API_KEYS`.
3. Run `npm start` (or `NODE_ENV=production node server/index.js`). The API and the built
   client are served together on `PORT` (default `3001`).

The app is a single Node process with an embedded SQLite database. Production deployments must
mount durable storage for both `DB_PATH` and `UPLOAD_DIR` and must back up that volume. Horizontal
multi-instance deployment requires moving the database and media to shared services first.

---

## License

For academic / hackathon demonstration use (Smart India Hackathon 2026).
