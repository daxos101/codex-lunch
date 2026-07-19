# Restaurant discovery and source review

Research snapshot: 2026-07-19 UTC / 2026-07-20 in `Europe/Stockholm`.

This document records how lunch candidates are discovered and how a much smaller set is allowed into the operational dashboard. The governing principle is the project mission: help people near Tellusgången 2 find a dependable lunch today while making freshness and source reliability transparent. A restaurant being nearby is not enough to call its menu current.

The machine-readable research record is [`data/research/restaurants.json`](../data/research/restaurants.json).

## Target point

The fixed target is:

- Places Telefonplan - Coworking
- Tellusgången 2, 126 26 Hägersten, Sweden
- WGS84 / EPSG:4326: `59.299270, 17.994293`

[Places' official Telefonplan page](https://www.joinplaces.co/en/kontor/telefonplan) confirms the coworking name and street address. [Hitta's address record](https://www.hitta.se/stockholms%2Bl%C3%A4n/h%C3%A4gersten/tellusg%C3%A5ngen%2B2/omr%C3%A5de/1011617436) exposes the address coordinate as `59.29927, 17.994293` (and labels it EPSG:4326 in the page data). Nominatim was also queried during research, but it resolved segments of Tellusgången rather than house number 2, so its result was not used as the origin.

The product radius is **2,000 m straight-line distance**. A wider **3,000 m discovery net** is deliberately used to expose boundary cases and avoid trusting search-result order.

## Reproducible discovery

OpenStreetMap food amenities are queried through the public Overpass API:

```overpass
[out:json][timeout:45];
nwr[amenity~"^(restaurant|cafe|fast_food|food_court)$"]
  (around:3000,59.299270,17.994293);
out center tags;
```

Endpoint: [Overpass API interpreter](https://overpass-api.de/api/interpreter). Data is from [OpenStreetMap](https://www.openstreetmap.org/copyright) under ODbL 1.0. The captured OSM data timestamp was `2026-07-19T23:06:57Z`.

The snapshot returned 302 elements. After independently calculating distance from the returned node coordinate or way/relation center, 300 centers were no farther than 3 km. Of those, 294 had names; 130 named venues were within 2 km, 164 named venues were between 2 and 3 km, and four unnamed features were within 2 km.

The counts are a reproducible discovery baseline, not an assertion that all 130 nearby mapped venues publish lunch menus. Cafés, evening restaurants, duplicate or stale map records, and venues with only a static all-day menu are expected. The source-reviewed shortlist in the JSON intentionally records the candidates most relevant to daily lunch ingestion plus boundary and unsupported examples.

### Distance calculation

Distances use the recognized Haversine great-circle formula, with mean Earth radius `6,371,008.8 m`:

```text
Δφ = radians(candidate latitude - target latitude)
Δλ = radians(candidate longitude - target longitude)
a  = sin²(Δφ/2) + cos(target latitude) × cos(candidate latitude) × sin²(Δλ/2)
d  = 2 × 6,371,008.8 × asin(√a)
```

Eligibility is `d <= 2000`, evaluated before display rounding. This matters at Liljeholmen: Bastard Burgers is inside at 1,973.3 m, while Caffè Nero is outside at 2,000.9 m and Thai Rung is outside at 2,017.1 m. Those decisions come from coordinates, not the shared `Liljeholmen` neighborhood label.

Ways and relations use the center returned by Overpass. Any future candidate close to 2,000 m should be rechecked against entrance or building geometry before onboarding. Restaurant coordinates should also be refreshed periodically because OSM is mutable.

## Source qualification

For each shortlisted venue, research follows the required preference order:

1. official structured feed or API;
2. structured content on the official site;
3. official HTML menu;
4. official PDF or document;
5. another clearly used official publishing channel;
6. manual review.

No authentication, bot protection, CAPTCHA, paywall, or access restriction was bypassed. Ordinary public HTTP responses and public search indexing were used. Restaurant content is not copied into the research data; only URLs, source shapes, and observed freshness risks are stored.

An operational adapter may label a menu `confirmed_current` only when the source provides enough evidence to match the Stockholm date: an exact date, the current ISO week plus weekday, or a clearly current daily section. A successful HTTP request is not freshness evidence. A source with an undated weekday rotation can be useful but must remain `possibly_stale` or `manual_review` unless another authoritative signal establishes currency.

Explicit closure has priority over future or old dish content. For example, at this research snapshot:

- [Addfood](https://www.addfood.se/home/lunchmeny/) advertised week 33 but explicitly said it was summer-closed during weeks 29-32. The future dishes must not be shown during the closure.
- [Landet](https://www.landet.nu/lunch/) explicitly said lunch was closed and would return 24 August.
- [WKB Västberga](https://wkb.se/?page_id=83) explicitly published vacation closure for weeks 28-31.
- [Nygammalt](https://www.restaurangnygammalt.se/index.php/lunchmeny/) still displayed week 29 after Stockholm entered week 30; its dishes are stale until the page changes.
- [Västertorps Hjärta](https://vastertorpshjarta.se/) displayed week 26 in week 30; its otherwise parseable weekly menu is stale.
- [Bastard Burgers' Stockholm lunch page](https://bastardburgers.com/se/dagens-lunch/stockholm/) explicitly said daily lunch was unavailable during summer even though the [Liljeholmen restaurant](https://bastardburgers.com/se/restaurants/liljeholmen/) remained open with its regular menu.

These are useful acceptance cases for adapters and fixtures: `restaurant_closed`, `not_yet_published`, and `possibly_stale` are valid, informative outcomes and must not be collapsed into extraction failure.

## Recommended onboarding order

The first operational pair is:

| Restaurant | Distance | Official source | Adapter ID | Why first |
| --- | ---: | --- | --- | --- |
| Addfood / Tellus Restaurang | 105.7 m | [weekly lunch HTML](https://www.addfood.se/home/lunchmeny/) | `addfood-weekly-html` | Week number, weekday sections, allergens, and explicit closures |
| Restaurang Landet | 112.6 m | [daily/weekly lunch HTML](https://www.landet.nu/lunch/) | `landet-daily-html` | Today's weekday section, full week, and explicit closure state |

Both are extremely close, authoritative, publicly accessible, and provide complementary freshness cases. Nygammalt and WKB Västberga are the next strongest adapter candidates. They have stable official weekly HTML, but their current observed pages also prove why week validation is mandatory.

Other useful official sources include [Indian Lotus](https://indianlotus.se/) for an undated weekday rotation, [Tokai Sushi](https://www.tokaisushi.se/meny) for a client-rendered lunch mode, and [Tellus Pizza](https://www.telluspizza.com/menu/) for a structured all-day menu. These should not be presented as changing daily specials without a date-bearing publication signal. Sushibar Masahiro had a previously indexed static lunch page, but its hostname did not resolve during direct verification and it remains manual-review only.

## Unsupported and manual-review cases

The JSON is deliberately candid about sources that are nearby but not safe to automate:

| Venue | Distance | Current disposition | Reason |
| --- | ---: | --- | --- |
| Krubb Telefonplan | 107.4 m | Manual review | Official menu is static and undated |
| Thai Wok Orkidé | 333.1 m | Manual review | Dishes are image-based and not date-specific; HTML is useful for closure only |
| Sushibar Masahiro | 487.8 m | Manual review | Previously indexed lunch source hostname did not resolve during verification |
| The Meeting | 653.0 m | Manual review | Official site verifies lunch-buffet hours, not today's buffet dishes |
| Café Elektra | 1,000.9 m | Manual review | Official site verifies lunch service; dish list was found only on an unverified third party |
| Spiskroken | 1,068.5 m | Manual review pending publisher confirmation | Dedicated Kvartersmenyn profile looks maintained, but channel ownership was not independently verified |
| The Swan | 1,156.4 m | Manual review | Current official site found, but no date-bearing daily lunch publication |
| Restaurant Kransen | 1,212.2 m | Unsupported for weekday lunch | Available official/general evidence does not establish weekday lunch; mapped weekday opening begins at 15:00 |
| Vintervikens Trädgårdskafé | 1,357.7 m | Manual review | Official site confirms daily lunch, but specific food varies across event/social posts without a stable daily source |
| Caffè Nero Liljeholmen | 2,000.9 m | Excluded | Outside the strict geographic boundary |
| Thai Rung Liljeholmen | 2,017.1 m | Excluded | Outside the strict geographic boundary despite a valid official site |

Browser automation and OCR are not justified for these sources at present: neither would create missing date evidence, and OCR of a menu image could turn old content into a falsely current result. A restaurant can be added later when it exposes a reliable public source or confirms an official publishing channel.

## Refresh and review procedure

The discovery process should be rerun quarterly and whenever a user reports a missing nearby restaurant:

1. Execute the recorded Overpass query and preserve the response timestamp.
2. Calculate Haversine distance independently from the fixed target coordinate.
3. Diff OSM type/ID, name, coordinates, website, and opening-hours tags against the prior snapshot.
4. Recheck every candidate within 25 m of the 2 km boundary against entrance/building geometry.
5. Search for the restaurant's official website and follow its menu links before considering aggregators.
6. Record source category, public accessibility, date shape, closure behavior, and automation feasibility.
7. Add an operational restaurant only after address/name matching and the `<= 2000 m` gate pass.
8. Add or update a deterministic saved fixture before enabling its adapter.
9. Keep unsupported candidates visible in this research record; do not silently drop failed sources.

OSM data can be incomplete or stale, and restaurant sites change without notice. This research therefore supports, but does not replace, ongoing source health checks, last-success reporting, and manual review queues.
