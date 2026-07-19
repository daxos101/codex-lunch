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

| Workstream | Ownership | Status | Handoff |
| --- | --- | --- | --- |
| Coordination and integration | root files, shared contracts, API, database, CI, final review | In progress | Mission and initial plan recorded |
| Restaurant discovery | discovery evidence, candidates, sources, geographic verification | Pending | Awaiting shared restaurant schema |
| Collection and extraction | scraping package, adapters, fixtures, worker behavior | Pending | Awaiting architecture contract |
| Dashboard | web application, accessible interaction, critical UI flows | Pending | Awaiting API contract and sample data |

## Decisions

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-07-19 | The production eligibility radius is 2 km; 3 km is only the candidate discovery net. | The 2 km core requirement is more specific than the introductory 3 km wording. |
| 2026-07-19 | The project begins from the empty upstream repository. | `git ls-remote` returned no refs, so there was no prior history to preserve. |
| 2026-07-19 | TypeScript monorepo is the initial architecture direction. | It enables one validated data contract across UI, API, worker, persistence, and tests. |

## Current status

- [x] Upstream and workspace inspected.
- [x] Mission statement recorded before substantial implementation.
- [ ] Architecture and contracts established.
- [ ] Reproducible restaurant inventory verified.
- [ ] End-to-end collection and dashboard vertical slice.
- [ ] Reliability, operations, fixtures, and CI.
- [ ] Clean-checkout verification.
- [ ] Coordinator definition-of-done review.
- [ ] Coherent commits pushed to GitHub.

## Unresolved issues

- Confirm target coordinates from a reproducible geocoder and record evidence.
- Select hosting and persistent database deployment target.
- Determine which nearby official menu sources can be automated reliably.

