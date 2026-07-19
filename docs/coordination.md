# Multi-agent coordination log

This is the lightweight handoff and status record for the Hägersten Lunch build.
The coordinating agent owns the integrated plan, shared contracts, mission
alignment, conflict prevention, review, and completion criteria.

## Working agreement

- The mission statement in the root README is the product filter for all work.
- Workstreams own non-overlapping paths until integration.
- Shared types and architecture changes are coordinated before dependent work.
- Restaurant content is included only with verifiable public-source evidence.
- The coordinating agent reviews every integrated result and keeps this file
  current.

## Workstreams

| Workstream                   | Ownership                                                        | Status   | Handoff                                                                      |
| ---------------------------- | ---------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| Coordination and integration | root files, shared contracts, API, database, CI, final review    | Complete | Clean-clone verification and mission/definition-of-done review recorded      |
| Restaurant discovery         | discovery evidence, candidates, sources, geographic verification | Complete | `ff30cbd`: 3 km net, 2 km Haversine gate, 21 reviewed candidates             |
| Collection and extraction    | scraping package, adapters, fixtures, worker behavior            | Complete | `d7c1665`: bounded HTTP, freshness, two live adapters, scheduler/CLI         |
| Dashboard                    | web application, accessible interaction, critical UI flows       | Complete | `a20a1d5`: responsive source-transparent UI and six deterministic flow tests |

## Decisions

| Date       | Decision                                                                             | Reason                                                                                 |
| ---------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 2026-07-19 | The production eligibility radius is 2 km; 3 km is only the candidate discovery net. | The 2 km core requirement is more specific than the introductory 3 km wording.         |
| 2026-07-19 | The project begins from the empty upstream repository.                               | `git ls-remote` returned no refs, so there was no prior history to preserve.           |
| 2026-07-19 | TypeScript monorepo is the initial architecture direction.                           | It enables one validated data contract across UI, API, worker, persistence, and tests. |
| 2026-07-19 | PostgreSQL stores snapshots, retained attempts, and run summaries.                   | Transactions, uniqueness, health inspection, and cross-process locking are required.   |
| 2026-07-19 | Only Addfood and Landet are automated in the first release.                          | Other reviewed sources lack equally safe current-date evidence and remain visible.     |
| 2026-07-19 | Use a persistent timezone-aware worker instead of a fixed UTC platform cron.         | 08:15 must remain Stockholm local time through DST; PostgreSQL prevents overlap.       |
| 2026-07-19 | Render is documented alongside a portable Docker Compose deployment.                 | Both support stateless services, PostgreSQL, migration/seed, health, and scheduling.   |

## Current status

- [x] Upstream and workspace inspected.
- [x] Mission statement recorded before substantial implementation.
- [x] Architecture and contracts established.
- [x] Reproducible restaurant inventory verified.
- [x] End-to-end collection and dashboard vertical slice.
- [x] Reliability, operations, fixtures, and CI configuration.
- [x] Clean-checkout verification.
- [x] Coordinator definition-of-done review.
- [x] Coherent commits pushed to GitHub.

## Unresolved issues

- Confirm the Render Blueprint after the first real provider sync; this build
  does not create production resources without operator authorization.
- Nygammalt and WKB have strong official weekly sources but still require
  adapter fixtures before they can leave manual-review state.
