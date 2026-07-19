# ADR 0002: Evidence-first freshness classification

- Status: accepted
- Date: 2026-07-19

## Context

Official lunch pages commonly retain weekly or old content. A successful HTTP
response is not evidence that dishes apply today.

## Decision

Adapters return normalized dishes plus explicit date evidence. The shared
pipeline alone assigns the stored state:

- `confirmed_today`: date or Swedish weekday evidence unambiguously matches the
  current Stockholm date and at least one dish was extracted;
- `closed`: the source explicitly marks that date or weekday closed;
- `not_published`: the current section is explicit but has no published dishes;
- `possibly_stale`: dishes exist, but evidence points to another date or cannot
  establish today;
- `extraction_failed`: retrieval or parsing failed;
- `manual_review`: the source cannot be automated safely or evidence conflicts.

Only `confirmed_today` dishes are returned as current menu dishes by the public
API. Raw excerpts are size-bounded, hashed, stored for diagnostics, and never
rendered as HTML.

## Consequences

The dashboard may show fewer dishes than a permissive scraper, but it will not
misrepresent old content. Adapter fixtures must cover both matching and stale
evidence.
