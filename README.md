# Hägersten Lunch

> Build a dependable and easy-to-use dashboard that helps people working near Tellusgången 2 quickly discover what nearby restaurants are serving for lunch today. The system should automatically collect, validate, and present current lunch menus every morning while making data freshness and source reliability transparent.

Hägersten Lunch is a source-transparent daily lunch dashboard for people near
Places Telefonplan. It verifies restaurant coordinates, collects public lunch
menus, and separates confirmed current menus from stale, missing, failed, or
manual-review data.

## Geographic scope

The fixed center is **Places Telefonplan – Coworking, Tellusgången 2, 126 26
Hägersten, Sweden**, verified at WGS84 `59.299270, 17.994293`.

The production eligibility radius is **2 km straight-line distance**. The **3 km**
radius in the initial brief is used as a wider discovery net so candidates near
the boundary are checked rather than accepted from neighborhood names or search
rank. Eligibility is calculated from full-precision coordinates with the
Haversine great-circle formula and mean Earth radius `6,371,008.8 m`.

The reproducible [discovery procedure](docs/restaurant-discovery.md) found 294
named OSM food amenities in the 3 km net and 130 inside 2 km. The reviewed
operational shortlist contains 19 eligible candidates and two explicit boundary
exclusions. `pnpm restaurants:build` independently recalculates every distance
before creating [the database seed](data/restaurants.json).

## Product overview

The dashboard answers: “Where can I eat lunch today, and what are they serving?”
It provides:

- restaurant and dish search, dietary and confirmed-only filters, and
  distance/name sorting;
- dish prices and dietary markers when an authoritative source supplies them;
- distance, address, restaurant site, original menu source, and update time;
- explicit status and reliability messaging, including a clear no-current-menu
  state;
- accessible landmarks, keyboard navigation, responsive layouts, and
  deterministic loading/error/empty behavior.

The public API suppresses dishes unless their stored state is
`confirmed_today`. Restaurant content is returned as validated JSON and rendered
as text, never injected as source HTML.

## Architecture

This is a pnpm/TypeScript monorepo:

| Component           | Responsibility                                                                          |
| ------------------- | --------------------------------------------------------------------------------------- |
| `apps/web`          | React/Vite static dashboard and critical UI tests                                       |
| `apps/api`          | Fastify read API, validation, rate limiting, CORS, security headers, health checks      |
| `apps/worker`       | Collection CLI, 08:15 Stockholm scheduler, run summaries, operational queries           |
| `packages/shared`   | Zod contracts, Haversine, Stockholm dates, Swedish weekdays, normalization              |
| `packages/database` | PostgreSQL migration, idempotent seed, transactions, snapshots, attempts, advisory lock |
| `packages/scraping` | Bounded HTTP client, evidence classifier, adapter registry, fixtures                    |
| `data`              | Reproducible research snapshot and generated operational restaurant definitions         |
| `docs`              | ADRs, discovery evidence, operations, deployment, coordination, final review            |

The API and worker are stateless. PostgreSQL persists restaurants, retrieval
attempts, one current snapshot per restaurant/date, and collection-run
summaries. Each attempt is retained even when a same-date snapshot is updated.
A PostgreSQL advisory lock prevents overlap across worker instances; the
scheduler also uses an in-process `noOverlap` guard.

See [ADR 0001](docs/decisions/0001-system-architecture.md) and
[ADR 0002](docs/decisions/0002-freshness-evidence.md).

## Quick start with Docker

Prerequisites: Docker Engine with Compose.

```bash
git clone https://github.com/daxos101/codex-lunch.git
cd codex-lunch
docker compose up --build
```

Compose starts PostgreSQL, applies migrations, loads the verified restaurant
seed, then starts the API, scheduler, and web proxy. Open
`http://localhost:8080`. API readiness is at
`http://localhost:3001/health/ready`.

Stop services with `docker compose down`. Add `--volumes` only when you
intentionally want to delete the local database.

## Native local setup

Prerequisites: Node.js 22.22 or newer, Corepack/pnpm 10.12.1, and PostgreSQL 16
or newer.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
set -a && source .env && set +a
pnpm restaurants:build
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The Vite dashboard is at `http://localhost:5173`; it proxies `/api` to the
Fastify service at `http://localhost:3001`. Run one collection separately:

```bash
pnpm worker collect all
```

## Environment variables

| Variable               | Required            | Default                 | Purpose                                          |
| ---------------------- | ------------------- | ----------------------- | ------------------------------------------------ |
| `DATABASE_URL`         | API/worker/database | none                    | PostgreSQL connection URL; treat as a secret     |
| `DATABASE_SSL`         | no                  | `disable`               | `require` enables trusted-certificate TLS        |
| `API_HOST`             | no                  | `0.0.0.0`               | API bind address                                 |
| `API_PORT`             | no                  | `PORT` or `3001`        | API listen port                                  |
| `PORT`                 | platform            | none                    | Hosting-platform port fallback                   |
| `CORS_ORIGINS`         | no                  | `http://localhost:5173` | Comma-separated browser origins                  |
| `LOG_LEVEL`            | no                  | `info`                  | Structured API log level                         |
| `VITE_API_BASE_URL`    | web build           | empty                   | Public API origin; empty uses same-origin `/api` |
| `RESTAURANT_SEED_PATH` | no                  | `data/restaurants.json` | Alternate seed document                          |
| `TEST_DATABASE_URL`    | tests               | unset                   | Enables PostgreSQL repository integration tests  |
| `LUNCH_LIVE_CHECK`     | tests               | unset                   | Set to `1` only for opt-in live checks           |

Copy [.env.example](.env.example) for local values. `.env*` is ignored except
for checked-in examples. Production credentials belong in the platform’s secret
store and must not be committed.

## Database and migrations

```bash
pnpm db:migrate
pnpm restaurants:build
pnpm db:seed
```

Migrations are ordered SQL files in `packages/database/migrations` and recorded
in `schema_migrations`. The seed is idempotent by stable UUID; it updates
metadata and `enabled` state without deleting attempts or snapshots.

The seed command revalidates each stored distance against the fixed target.
Database constraints independently reject coordinates outside valid ranges,
unknown states, and distances beyond 2,000 m.

## Menu collection and operations

```bash
# All enabled restaurants for today's Stockholm date
pnpm worker collect all

# One restaurant
pnpm worker collect one addfood-telefonplan

# Reprocess a specific date
pnpm worker collect all --date 2026-07-17

# Inspect current source health and recent failures
pnpm worker status
pnpm worker failures --limit 50
pnpm worker summary

# Run the persistent scheduler
pnpm worker schedule
```

Collection continues when one source fails. Every adapter gets the same bounded
HTTP client: 10-second timeout, two retries with backoff and `Retry-After`
support, a 2 MB response limit, conditional process-local caching, and a 500 ms
minimum interval per host. Errors are categorized and logs are newline JSON.
Raw excerpts are size-limited diagnostics and are not exposed by the public API.

The worker runs every day at **08:15 `Europe/Stockholm`**, so daylight-saving
changes are handled by the timezone rather than fixed UTC arithmetic. Addfood
and Landet are currently automated. Other reviewed sources use a network-free
manual-review adapter until they have reliable date evidence.

See [operations and troubleshooting](docs/operations.md) for SQL inspection,
runbooks, and failure handling.

## Freshness definitions

| State               | Meaning                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `confirmed_today`   | Explicit date, or safe current week/weekday evidence, matches the requested Stockholm date and dishes exist |
| `possibly_stale`    | Dishes were found but evidence points elsewhere or cannot prove today                                       |
| `not_published`     | A current section exists but has no published dishes                                                        |
| `closed`            | The official source explicitly establishes closure for the date/day                                         |
| `extraction_failed` | Retrieval or parsing failed after bounded retries                                                           |
| `manual_review`     | Source automation is unsafe, unsupported, or evidence conflicts                                             |

Only `confirmed_today` dishes are presented as today’s menu. A successful HTTP
response alone is never enough. Explicit closure wins over future or retained
menu text.

## Adding, updating, or disabling a restaurant

1. Rerun or consult the documented Overpass discovery and verify name, address,
   WGS84 coordinates, official website, and public menu source.
2. Add the source-reviewed candidate to
   `data/research/restaurants.json`. Set `operationalEnabled: false` to retain a
   researched source without showing it in the dashboard.
3. Run `pnpm restaurants:build`. The command fails on an eligibility or distance
   mismatch and regenerates `data/restaurants.json`.
4. For reliable automation, implement a `MenuAdapter` in
   `packages/scraping/src/adapters`, register its stable ID, and add saved
   current/stale/closed fixtures. Until then, use `adapterId: null`; the
   generated `manual-review` adapter makes no network request.
5. Run `pnpm test`, `pnpm typecheck`, and `pnpm db:seed`.
6. Run `pnpm worker collect one <slug>` and inspect the source, state, timestamp,
   and stored attempt before enabling it.

Never add copied or inferred dishes to fixtures as production data. Fixtures
exist to test source shapes; live collection must retrieve public authoritative
content.

## Quality commands

```bash
pnpm format             # formatting check
pnpm lint               # package static checks
pnpm typecheck          # strict TypeScript checks
pnpm test               # deterministic suite; no live restaurant requests
pnpm build              # production web/API/worker builds
pnpm test:coverage

# Explicitly opt into volatile source checks:
LUNCH_LIVE_CHECK=1 pnpm --filter @lunch/scraping test -- live
```

The commands above are the release verification suite. Dependency versions are
locked in `pnpm-lock.yaml`; Dependabot checks npm dependency updates.

## Deployment

Two deployment paths are included:

- [Render Blueprint](render.yaml): managed PostgreSQL, Docker API, persistent
  scheduler worker, and static site. Set the prompted public API/CORS origins.
- [Docker Compose](compose.yaml): a single-host deployment using named
  PostgreSQL storage and same-origin nginx API proxy.

Both run migrations and the idempotent restaurant seed before serving. Detailed
configuration, TLS, backups, health checks, rollback, and smoke checks are in
[deployment.md](docs/deployment.md).

## Source handling and security

Only public sources are used, in this order: official API/feed, official
structured data, official HTML, official document, another clearly official
channel, then manual review. The collector does not bypass authentication,
CAPTCHAs, paywalls, bot restrictions, or access guidance. Browser automation
and OCR are intentionally absent because they would not create missing
freshness evidence.

Sensitive administrative functions are CLI/database operations, not public HTTP
endpoints. API query input is validated, response contracts are parsed,
untrusted HTML is never rendered, bodies are size-limited, CORS is allowlisted,
and health readiness tests the database separately from liveness.

## Known limitations

- The discovery snapshot found 130 named venues inside 2 km; 19 relevant
  candidates have completed source review. This is a transparent onboarding
  shortlist, not a claim of exhaustive menu automation.
- Only Addfood and Landet currently have enabled extraction adapters. Nygammalt
  and WKB are the next documented adapter-ready sources.
- Many nearby sites publish static or undated menus. They remain manual review
  even when the dishes look plausible.
- The HTTP conditional cache is process-local; PostgreSQL retains source hashes
  and attempts, but response bodies are not shared between worker replicas.
- Landet’s weekday-only evidence can confirm a same-day retrieval but
  deliberately cannot confirm a historical reprocessing date.
- OSM ways/relations use provider-returned centers. Any future candidate within
  25 m of the radius boundary requires entrance/building geometry review.
- There is no map view; the distance-sorted list is faster and avoids adding a
  third-party mapping dependency for the primary lunch decision.

The detailed unsupported/manual list and observed source limitations live in
[restaurant-discovery.md](docs/restaurant-discovery.md).
