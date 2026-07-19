# ADR 0003: Separate API, static web, and timezone-aware worker

- Status: accepted
- Date: 2026-07-19

## Context

The dashboard should be independently cacheable, ingestion failures must not
consume API capacity, and the 08:15 schedule must follow Stockholm daylight
saving. Scheduled runs also need durable state and cross-instance exclusion.

## Decision

Deploy the web dashboard as static assets, the API as a stateless service, a
long-running worker with a `Europe/Stockholm` cron scheduler, and managed
PostgreSQL. Use the direct database connection because advisory locks are
session-scoped. Provide both a Render Blueprint and Docker Compose reference.

The worker has two overlap guards: node-cron `noOverlap` for its own process and
a PostgreSQL advisory lock shared by all processes. Deployments run migrations
and the idempotent, distance-validating restaurant seed before API readiness.

## Consequences

The schedule stays at local 08:15 through DST and can be run manually with the
same code. A continuously running worker costs more than a UTC platform cron,
but avoids seasonal schedule changes and keeps operational commands available.
API, web, and worker can be rolled back independently while PostgreSQL preserves
attempt history.
