# Operations and troubleshooting

This runbook covers routine collection, source health, failures, and recovery.
All dates passed to the worker are interpreted as calendar dates in
`Europe/Stockholm`.

## Normal daily sequence

At 08:15 Stockholm time the long-running worker:

1. attempts the PostgreSQL advisory lock `hagersten-lunch:collection`;
2. creates a `collection_runs` record;
3. reads enabled, distance-verified restaurants;
4. processes up to three restaurants concurrently while serializing requests per
   source host;
5. writes one retained `collection_attempts` row per restaurant;
6. upserts the restaurant/date `menu_snapshots` row transactionally;
7. updates per-restaurant last-attempt, last-confirmed-success, and current
   status; and
8. persists a completed, partial-failure, or failed run summary and releases the
   lock.

The process-level scheduler uses `noOverlap`, while the PostgreSQL session lock
protects across replicas and manual runs. A lock is also released in a `finally`
block. If the database session is lost, PostgreSQL releases it automatically.

## Operator commands

Load the same environment as the API/worker, then:

```bash
pnpm worker collect all
pnpm worker collect one landet-telefonplan
pnpm worker collect all --date 2026-07-17
pnpm worker status
pnpm worker failures --limit 50
pnpm worker summary
```

The first three commands are mutating: they retrieve public sources and store
attempts/snapshots. The inspection commands are read-only. A partial-failure or
failed collection exits non-zero so an external monitor can alert.

In a Docker Compose deployment:

```bash
docker compose exec worker node dist/cli.js status
docker compose exec worker node dist/cli.js failures --limit 50
docker compose run --rm worker node dist/cli.js collect one addfood-telefonplan
```

## Structured log events

API and worker logs are newline JSON. Useful worker event names include:

| Event                                   | Meaning                                                     |
| --------------------------------------- | ----------------------------------------------------------- |
| `collection_scheduler_started`          | Scheduler registered with cron and timezone                 |
| `collection_run_started`                | Lock acquired and restaurant set selected                   |
| `restaurant_collection_started`         | Adapter execution began                                     |
| `source_fetch_failed`                   | Bounded HTTP attempt failed; contains category/retryability |
| `restaurant_collection_completed`       | Adapter result classified and normalized                    |
| `restaurant_collection_failed`          | Adapter or fetch failed safely                              |
| `collection_attempt_persistence_failed` | Source work completed but transaction failed                |
| `collection_run_completed`              | Counts and each restaurant outcome are available            |
| `collection_run_skipped_overlap`        | Another process holds the PostgreSQL lock                   |

Logs include source URLs but never database credentials or response bodies.
`raw_excerpt` is retained in PostgreSQL for bounded debugging.

## Direct inspection

Use `psql "$DATABASE_URL"` or the hosting provider’s protected database console.

```sql
-- Source health, nearest first
SELECT slug, current_menu_status, last_retrieval_attempt,
       last_successful_retrieval, status_detail
FROM restaurants
WHERE enabled
ORDER BY distance_meters;

-- Manual-review queue
SELECT slug, name, menu_source_url, status_detail
FROM restaurants
WHERE enabled AND current_menu_status = 'manual_review'
ORDER BY distance_meters;

-- Most recent failed attempts
SELECT r.slug, a.target_date, a.finished_at, a.error_category, a.status_detail
FROM collection_attempts a
JOIN restaurants r ON r.id = a.restaurant_id
WHERE a.status IN ('extraction_failed', 'manual_review')
ORDER BY a.finished_at DESC
LIMIT 50;

-- Latest run summary
SELECT target_date, started_at, finished_at, status,
       attempted_count, successful_count, failed_count, summary
FROM collection_runs
ORDER BY started_at DESC
LIMIT 1;
```

Do not edit a snapshot to `confirmed_today` manually. Correct the adapter or
source definition, add a fixture, and reprocess the date so evidence follows the
normal validation path.

## Error categories and first response

| Category                                      | First response                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `timeout`, `network`, retryable `http_status` | Check provider availability and retry later; bounded retries already ran              |
| `blocked`                                     | Stop automation for that source; do not bypass the restriction                        |
| `unsupported_content_type`                    | Confirm the official source changed format; add a deliberate adapter if allowed       |
| `response_too_large`                          | Review source shape before changing the 2 MB safety bound                             |
| `parse`, `invalid_content`                    | Save a sanitized fixture, update the source-specific adapter, run stale/current tests |
| `adapter_not_found`, `configuration`          | Correct the version-controlled adapter ID or use `manual-review`                      |
| `persistence`                                 | Check database readiness, storage, constraints, and transaction errors                |

An HTTP 401/403 becomes `manual_review`, not an invitation to circumvent access
control. A page shape change becomes an extraction failure, not a guessed menu.

## Source-change procedure

1. Confirm the source is still public and authoritative.
2. Save the smallest representative HTML fixture with personal/tracking data
   removed.
3. Add tests for current, stale, closed, empty, and malformed cases relevant to
   the source.
4. Update only the restaurant-specific adapter or a backwards-compatible shared
   helper.
5. Run deterministic tests without the network.
6. Optionally run `LUNCH_LIVE_CHECK=1 pnpm --filter @lunch/scraping test -- live`.
7. Reprocess the affected date and verify the attempt plus public API output.

## Restaurant lifecycle

`data/research/restaurants.json` is the maintained evidence record.
`data/restaurants.json` is generated and must not be hand-edited.

```bash
pnpm restaurants:build
pnpm db:seed
```

Set `operationalEnabled: false` on a researched candidate to disable it without
destroying history. Removing a row from the seed does not delete the database
record; disable it explicitly first. Adding an adapter requires a registered
stable ID and saved fixture tests before setting it on an enabled restaurant.

## Recovery

- **Worker stopped:** restart it. The next 08:15 run proceeds normally; run
  `collect all` to catch up.
- **Overlap reported:** inspect the other worker before intervening. Advisory
  locks are session-scoped; terminating the genuinely stuck database session
  releases it.
- **Bad same-day classification:** disable the restaurant, fix the fixture and
  adapter, deploy, seed, then reprocess the date. Until then the API will not
  expose non-confirmed dishes.
- **Database unavailable:** the API liveness endpoint remains 200 but readiness
  returns 503. Restore PostgreSQL first; source retries do not apply to
  persistence errors.
- **Restore from backup:** restore to a new PostgreSQL instance, run migrations,
  point API/worker secrets to it, run the idempotent seed, inspect the last run,
  then resume collection.

## Health and alerting

Monitor:

- `GET /health/live` for process liveness;
- `GET /health/ready` for API plus database readiness;
- worker process state;
- absence of a completed run by 09:00 Stockholm time;
- `partial_failure`/`failed` run status;
- each source’s last confirmed success age; and
- growth in `manual_review` or `extraction_failed`.

Do not alert merely because a restaurant is explicitly closed or has not yet
published. Those are valid product states.
