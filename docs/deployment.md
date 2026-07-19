# Deployment

The repository supports a Render Blueprint and a single-host Docker Compose
deployment. In either path, PostgreSQL is persistent and the API/worker
containers are disposable.

## Render Blueprint

[`render.yaml`](../render.yaml) defines:

- PostgreSQL 16 in Frankfurt with external ingress disabled;
- a Docker API service with readiness checks;
- a continuously running Docker background worker; and
- a static React site.

The worker stays resident because Render cron expressions are evaluated in UTC,
while this product must follow `Europe/Stockholm` across daylight-saving
changes. The Node scheduler runs at 08:15 in that timezone. Database-backed
locking remains the final overlap guard.

Render’s [Blueprint reference](https://render.com/docs/blueprint-spec) documents
the checked-in service fields and validation options. Render recommends using
the database’s [internal connection URL](https://render.com/docs/postgresql-creating-connecting)
for same-region services. The Blueprint uses the direct `connectionString`, not
PgBouncer, because transaction-mode pooling does not preserve the session-level
advisory lock used by the worker; see Render’s
[connection-pooling notes](https://render.com/docs/postgresql-connection-pooling).

### Deploy

1. Push the repository and confirm GitHub Actions passes.
2. In Render, create a Blueprint from
   `https://github.com/daxos101/codex-lunch.git`.
3. Supply `CORS_ORIGINS` for the API when prompted, for example
   `https://hagersten-lunch-web.onrender.com`.
4. Supply `VITE_API_BASE_URL` for the static build, for example
   `https://hagersten-lunch-api.onrender.com`.
5. Review the paid instance/database plans and region before applying.
6. Let the API pre-deploy command run migrations and the idempotent restaurant
   seed.
7. Complete the smoke checks below.

All three services use `checksPass` deployment triggers. Render stores the
database URL through a Blueprint `fromDatabase` reference; it is not committed.
The database blocks public ingress with `ipAllowList: []`.

### Render TLS and database setting

The browser-facing services receive Render-managed HTTPS. `DATABASE_SSL=disable`
is intentional for the private internal URL. If an operator instead configures
an external database URL, set `DATABASE_SSL=require` and use a publicly trusted
certificate. Do not weaken certificate verification in code.

## Docker Compose

For a development-like single host:

```bash
docker compose up --build -d
docker compose ps
docker compose logs migrate seed api worker web
```

The startup order is PostgreSQL health, migration, idempotent seed, API/worker,
then nginx. Web traffic enters on port 8080 and nginx proxies same-origin
`/api/*`; port 3001 is exposed for direct health and API diagnostics.

For a public host:

1. replace the example database password with a secret or point
   `DATABASE_URL` at managed PostgreSQL;
2. remove the public API port unless operations require it;
3. put a TLS-terminating reverse proxy/load balancer in front of port 8080;
4. restrict inbound network rules;
5. enable automated PostgreSQL backups and test restoration;
6. route JSON logs to retained centralized storage; and
7. configure process, readiness, missed-run, and partial-failure alerts.

The Compose file is not a substitute for host patching, firewalling, secret
rotation, or database backups.

## Images

The API and worker Dockerfiles:

- pin Node 22.22 Alpine;
- install from the frozen lockfile;
- create bundled Node production entries;
- deploy production dependencies only; and
- run as the unprivileged `node` user.

The web image uses an unprivileged nginx image, immutable asset caching, SPA
fallback, a same-origin API proxy, and defensive browser headers. The API sets
Helmet headers, read-only CORS methods, body bounds, and per-instance rate
limits.

Build independently:

```bash
docker build -f Dockerfile.api -t hagersten-lunch-api .
docker build -f Dockerfile.worker -t hagersten-lunch-worker .
docker build -f Dockerfile.web -t hagersten-lunch-web .
```

## Migration and rollback policy

Migrations are forward-only, ordered, and recorded in `schema_migrations`.
Deploy schema changes so the previous API remains compatible during rollout.
The current migration is additive/idempotent.

Application rollback:

1. redeploy the previously passing Git commit;
2. leave compatible database migrations applied;
3. run the seed from the rollback commit only if its restaurant metadata is
   intentionally authoritative; and
4. verify that the worker is not duplicated across old/new services.

For an incompatible future schema change, write and rehearse an explicit data
rollback before deployment. Never improvise destructive SQL during an incident.

## Smoke checks

After deployment:

```bash
curl --fail https://API_HOST/health/live
curl --fail https://API_HOST/health/ready
curl --fail https://API_HOST/api/v1/lunch
```

Then verify:

- the response date equals the current Stockholm date;
- all distances are at most 2,000 m;
- each result has website and source URLs;
- only `confirmed_today` results have dishes;
- last-attempt/last-success timestamps are plausible;
- the web app loads, searches, filters, and links to source pages;
- `worker status` lists the seeded enabled restaurants; and
- one manual `collect one` persists a source attempt without affecting other
  restaurants.

## Secrets and access

There is no public mutation/admin endpoint. Operators need protected deployment
or database access to seed, collect, inspect failures, or reprocess dates. Use
least-privilege provider roles, rotate PostgreSQL credentials, restrict external
database access, and never paste connection URLs into issues or logs.
