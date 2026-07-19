# Hägersten Lunch

> Build a dependable and easy-to-use dashboard that helps people working near Tellusgången 2 quickly discover what nearby restaurants are serving for lunch today. The system should automatically collect, validate, and present current lunch menus every morning while making data freshness and source reliability transparent.

Hägersten Lunch is a source-transparent daily lunch dashboard for people near Places
Telefonplan. It includes verified restaurants within a 2 km straight-line radius of
**Tellusgången 2, 126 26 Hägersten, Sweden**, collects their public lunch menus, and
clearly separates confirmed current menus from missing, stale, failed, or
manual-review data.

> The implementation is currently being built. This README will be expanded with
> verified setup, operating, deployment, and troubleshooting instructions as each
> capability is completed.

## Product overview

The dashboard is designed to answer one question quickly: “Where can I eat lunch
today, and what are they serving?” Results are searchable and sortable, retain a
link to the original source, and show both distance and freshness.

## Architecture overview

The repository will use a TypeScript monorepo with a web dashboard, an HTTP API,
a scheduled collection worker, shared validation, persistence, and
restaurant-specific adapters. See `docs/decisions/` for the decisions and their
trade-offs.

## Monorepo structure

The final package map and ownership boundaries will be documented here after the
initial vertical slice is integrated.

## Local setup

Verified clean-checkout setup instructions will be added before release.

## Environment variables

The checked-in `.env.example` will be the source of truth. Secrets must never be
committed.

## Database and migrations

Migration and seed commands will be documented after the persistence layer is
integrated.

## Menu collection

The worker will support all-restaurants, one-restaurant, date reprocessing,
fixture testing, and failure inspection from command-line tools.

## Schedule

Production collection will run every morning in the `Europe/Stockholm` timezone,
early enough to populate menus before lunch. Overlapping runs will be prevented.

## Quality commands

Install, test, lint, type-check, build, and optional live-source check commands
will be listed here after they have been verified.

## Deployment

Deployment configuration and platform-specific operating instructions will be
added before release.

## Adding or updating a restaurant

Restaurants will be managed as version-controlled source definitions with
verified coordinates, distances, discovery evidence, and adapter configuration.
The precise workflow will be documented after the adapter contract is complete.

## Freshness definitions

The product will distinguish at least:

- confirmed for today;
- possibly stale;
- not yet published;
- restaurant closed;
- extraction failed; and
- manual review required.

Only evidence that explicitly matches the current Stockholm date may be shown as
confirmed. The application must never invent menu content or present an old menu
as current.

## Known limitations

Known source gaps and restaurants that cannot be automated reliably will be
listed transparently before release.

## Scraping and source handling

Only public sources are used. The project prefers official structured feeds,
structured website data, official HTML, official documents, and then other
clearly official channels—in that order. It does not bypass authentication,
CAPTCHAs, paywalls, anti-bot measures, or access restrictions. Requests are
bounded by per-host rate limits, timeouts, retries, and caching.

## Geographic scope and discovery

The center is **Places Telefonplan – Coworking, Tellusgången 2, 126 26
Hägersten, Sweden**. Eligibility is determined from verified coordinates using a
recognized straight-line geospatial distance calculation. The product radius is
**2 km**; the wider 3 km area is used only as a discovery net so edge candidates
can be verified. The reproducible discovery procedure and evidence will live in
`docs/restaurant-discovery.md`.

