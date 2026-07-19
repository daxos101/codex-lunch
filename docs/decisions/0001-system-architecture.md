# ADR 0001: TypeScript services with PostgreSQL

- Status: accepted
- Date: 2026-07-19

## Context

The dashboard, API, scheduled ingestion, adapters, and operations need one
well-tested understanding of menu freshness. Collection must tolerate partial
failure and concurrent deployments must not create overlapping runs.

## Decision

Use a pnpm TypeScript monorepo:

- `apps/web`: Vite/React dashboard consuming a versioned JSON API;
- `apps/api`: Fastify HTTP service with public read and health endpoints;
- `apps/worker`: collection and operations CLI plus the production scheduler;
- `packages/shared`: Zod contracts, Stockholm date logic, geography, normalization;
- `packages/database`: PostgreSQL schema, migrations, and repositories;
- `packages/scraping`: bounded HTTP client and adapter registry.

PostgreSQL is the source of truth. Collection uses a database advisory lock and
per-restaurant transactions. Menu snapshots are unique by restaurant and date,
and attempts are retained for diagnostics. Production containers are stateless;
the web assets are deployable independently from the API and worker.

## Consequences

The shared language reduces contract drift and makes deterministic fixture tests
straightforward. PostgreSQL adds a local service dependency, handled by Docker
Compose, but gives durable state, indexing, uniqueness, and cross-process locks.
The static web app requires an API base URL at build time.
