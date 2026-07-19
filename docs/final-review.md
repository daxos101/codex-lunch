# Coordinator final review

- Review date: 2026-07-19
- Reviewed branch: `main`
- Mission statement: retained verbatim near the top of the root README

## Mission alignment

The integrated result stays focused on a dependable lunch decision:

- the nearest reviewed sources are shown first;
- dishes can appear as today’s menu only after explicit Stockholm-date evidence;
- source, retrieval time, last success, and reliability state remain visible;
- static/undated or restricted sources remain manual review instead of becoming
  invented menus; and
- one broken adapter produces a per-restaurant failure and does not stop the run.

The project does not claim exhaustive automation. Research found 130 named food
amenities inside 2 km, completed source review for 19 relevant candidates, and
enabled 18 operational records. Two authoritative sources are automated in this
release; the others are visible with honest availability states.

## Deliverables

| Deliverable              | Evidence                                                                                                                                  | Result |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Functional monorepo      | pnpm workspace with web, API, worker, shared, database, scraping                                                                          | Pass   |
| Mission README           | root README with setup, architecture, environment, database, collection, schedule, quality, deployment, additions, freshness, limitations | Pass   |
| Architecture decisions   | ADRs 0001–0003                                                                                                                            | Pass   |
| Reproducible nearby list | Overpass query, coordinate sources, Haversine method, research JSON, generated seed                                                       | Pass   |
| Morning collection       | 08:15 `Europe/Stockholm`, in-process and PostgreSQL overlap guards                                                                        | Pass   |
| Maintainable extraction  | common adapter interface, Addfood/Landet adapters, manual-review adapter, saved fixtures                                                  | Pass   |
| Persistent storage       | PostgreSQL migrations, snapshots, retained attempts, run summaries                                                                        | Pass   |
| Dashboard/backend        | responsive React UI and validated Fastify JSON API                                                                                        | Pass   |
| Automated tests          | 51 deterministic tests pass; two database integration tests and two live checks are separately gated                                      | Pass   |
| CI configuration         | PostgreSQL service plus seed, format, ESLint, types, deterministic tests, builds                                                          | Pass   |
| Deployment               | Render Blueprint, three production Dockerfiles, Docker Compose, nginx proxy                                                               | Pass   |
| Operations               | one/all/date collection, status, failures, summary, health, SQL and recovery runbooks                                                     | Pass   |
| Unsupported transparency | source-by-source research table and manual-review states                                                                                  | Pass   |

## Definition-of-done review

- [x] A fresh HTTPS clone installs with the frozen lockfile.
- [x] The generated restaurant seed is reproducible with no clean-tree diff.
- [x] Eligibility is coordinate-based and independently revalidated before seed.
- [x] Menu selection uses the current `Europe/Stockholm` date and Swedish
      weekday recognition.
- [x] Confirmed, stale, missing, closed, failed, and manual-review concepts are
      represented.
- [x] Every restaurant response retains website and original source URLs.
- [x] Non-confirmed states expose no current dishes through the API.
- [x] Per-restaurant isolation and partial-failure tests pass.
- [x] Deterministic tests make no live restaurant requests.
- [x] Formatting, ESLint, strict types, tests, and production builds pass.
- [x] No generated build artifacts or secrets are tracked.
- [x] Architecture, deployment, operations, discovery, and limitations are
      documented.
- [x] Placeholder menus are not presented as completed functionality.

## Verification record

The coordinator ran the following from a fresh clone:

```text
pnpm install --frozen-lockfile       pass
pnpm restaurants:build              pass (19 included, 18 enabled)
git diff --exit-code data/restaurants.json
                                       pass
pnpm format                          pass
pnpm lint                            pass
pnpm typecheck                       pass
pnpm test                            pass (51; gated DB/live suites skipped)
pnpm build                           pass
pnpm audit --prod --audit-level high
                                       pass (no known vulnerabilities)
docker compose config --quiet       pass
```

The local environment did not permit Docker-daemon access, so PostgreSQL-backed
repository tests could not run locally. They are deterministic, gated by
`TEST_DATABASE_URL`, and the checked-in CI job supplies PostgreSQL 16. Volatile
Addfood/Landet checks are separately gated by `LUNCH_LIVE_CHECK=1` and are not
part of the normal suite.

## Accepted limitations and next work

1. Implement fixture-backed Nygammalt and WKB adapters next.
2. Expand source review beyond the 19-candidate onboarding shortlist.
3. Confirm the Render Blueprint during an operator-authorized first deployment.
4. Consider a shared persistent HTTP cache only if source volume grows enough to
   justify it.
5. Recheck OSM discovery quarterly and manually review any candidate within
   25 m of the geographic boundary.
