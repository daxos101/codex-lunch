import type { RestaurantMenu } from '@lunch/shared/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DashboardApiError, fetchDashboard } from './api';
import { Filters, type SortOrder } from './components/Filters';
import { CheckIcon, LocationIcon } from './components/Icons';
import { RestaurantCard } from './components/RestaurantCard';
import { type DietaryTag, formatDate, formatTimestamp } from './format';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'success'; data: Awaited<ReturnType<typeof fetchDashboard>> };

function matchesFilters(
  restaurant: RestaurantMenu,
  query: string,
  confirmedOnly: boolean,
  dietary: Set<DietaryTag>,
): boolean {
  if (confirmedOnly && restaurant.status !== 'confirmed_today') return false;

  if (dietary.size > 0) {
    if (restaurant.status !== 'confirmed_today') return false;
    const matchesDietary = restaurant.dishes.some((dish) =>
      [...dietary].every((selectedTag) => dish.dietary.includes(selectedTag)),
    );
    if (!matchesDietary) return false;
  }

  if (query.length > 0) {
    const searchable = [
      restaurant.name,
      restaurant.address,
      ...(restaurant.status === 'confirmed_today'
        ? restaurant.dishes.flatMap((dish) => [dish.name, dish.description ?? ''])
        : []),
    ]
      .join(' ')
      .toLocaleLowerCase('sv-SE');
    if (!searchable.includes(query.toLocaleLowerCase('sv-SE'))) return false;
  }

  return true;
}

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ phase: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [dietary, setDietary] = useState<Set<DietaryTag>>(new Set());
  const [sort, setSort] = useState<SortOrder>('distance');

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ phase: 'loading' });

    fetchDashboard(controller.signal)
      .then((data) => setLoadState({ phase: 'success', data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const message =
          error instanceof DashboardApiError
            ? error.message
            : 'Något oväntat gick fel när luncherna hämtades.';
        setLoadState({ phase: 'error', message });
      });

    return () => controller.abort();
  }, [reloadKey]);

  const toggleDietary = useCallback((tag: DietaryTag) => {
    setDietary((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setQuery('');
    setConfirmedOnly(false);
    setDietary(new Set());
    setSort('distance');
  }, []);

  const visibleRestaurants = useMemo(() => {
    if (loadState.phase !== 'success') return [];
    const filtered = loadState.data.restaurants.filter((restaurant) =>
      matchesFilters(restaurant, query.trim(), confirmedOnly, dietary),
    );
    return filtered.sort((a, b) =>
      sort === 'distance'
        ? a.distanceMeters - b.distanceMeters
        : a.name.localeCompare(b.name, 'sv-SE'),
    );
  }, [confirmedOnly, dietary, loadState, query, sort]);

  const data = loadState.phase === 'success' ? loadState.data : null;

  return (
    <>
      <a className="skip-link" href="#lunch-results">
        Hoppa till luncherna
      </a>

      <header className="site-header">
        <a aria-label="Tellus Lunch, startsida" className="brand" href="/">
          <span aria-hidden="true" className="brand__mark">
            TL
          </span>
          <span>Tellus Lunch</span>
        </a>
        <nav aria-label="Huvudnavigation">
          <a href="#lunch-results">Dagens lunch</a>
          <a href="#about">Om datan</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero__content">
            <p className="eyebrow">
              <span aria-hidden="true" className="pulse" />
              Lunchkollen i Hägersten
            </p>
            <h1>Vad blir det till lunch?</h1>
            <p className="hero__lede">
              Dagens verifierade menyer nära Tellusgången 2 — samlade på ett ställe, med
              tydlig källa och färskhetsstatus.
            </p>
            <div className="hero__location">
              <LocationIcon />
              <span>
                <strong>Places Telefonplan</strong>
                Tellusgången 2 · inom 2 km
              </span>
            </div>
          </div>

          <aside aria-label="Dagens sammanfattning" className="today-card">
            <p>{data ? formatDate(data.date) : 'Dagens lunch'}</p>
            <strong>{data ? data.summary.confirmed : '–'}</strong>
            <span>bekräftade menyer idag</span>
            {data && (
              <small>
                <CheckIcon />
                Uppdaterad {formatTimestamp(data.generatedAt)}
              </small>
            )}
          </aside>
        </section>

        <div className="page-shell">
          {loadState.phase === 'loading' && <LoadingState />}

          {loadState.phase === 'error' && (
            <ErrorState
              message={loadState.message}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          )}

          {data && data.restaurants.length === 0 && <EmptyCollectionState />}

          {data && data.restaurants.length > 0 && (
            <>
              <Filters
                confirmedOnly={confirmedOnly}
                dietary={dietary}
                onConfirmedOnlyChange={setConfirmedOnly}
                onDietaryChange={toggleDietary}
                onQueryChange={setQuery}
                onReset={resetFilters}
                onSortChange={setSort}
                query={query}
                resultCount={visibleRestaurants.length}
                sort={sort}
              />

              <section
                aria-labelledby="results-heading"
                id="lunch-results"
                tabIndex={-1}
              >
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Inom två kilometer</p>
                    <h2 id="results-heading">Dagens restauranger</h2>
                  </div>
                  <p>
                    Menyer visas bara som aktuella när källans datum har kunnat
                    verifieras för idag.
                  </p>
                </div>

                {visibleRestaurants.length > 0 ? (
                  <div className="restaurant-list">
                    {visibleRestaurants.map((restaurant) => (
                      <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state empty-state--compact" role="status">
                    <span aria-hidden="true">⌕</span>
                    <h2>Inga träffar med de filtren</h2>
                    <p>Prova en annan sökning eller rensa valda kostönskemål.</p>
                    <button
                      className="button button--secondary"
                      onClick={resetFilters}
                      type="button"
                    >
                      Rensa filter
                    </button>
                  </div>
                )}
              </section>
            </>
          )}

          <section className="about" id="about">
            <div>
              <p className="eyebrow">Så fungerar det</p>
              <h2>Färskhet framför gissningar.</h2>
            </div>
            <p>
              Vi kontrollerar restaurangernas egna, offentliga menykällor varje morgon.
              En grön markering betyder att menyn är verifierad för dagens datum i
              Stockholm. Om datumet är osäkert visar vi statusen — aldrig en gammal meny
              som om den vore ny.
            </p>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <span>Tellus Lunch</span>
        <p>Byggd för lunchbeslut nära Tellusgången 2.</p>
      </footer>
    </>
  );
}

function LoadingState() {
  return (
    <section aria-busy="true" aria-live="polite" className="loading-state">
      <span className="loader" />
      <h2>Hämtar dagens luncher…</h2>
      <p>Vi kontrollerar menyer och färskhet.</p>
    </section>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="error-state" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <h2>Luncherna kunde inte laddas</h2>
        <p>{message}</p>
      </div>
      <button className="button button--primary" onClick={onRetry} type="button">
        Försök igen
      </button>
    </section>
  );
}

function EmptyCollectionState() {
  return (
    <section className="empty-state" id="lunch-results">
      <span aria-hidden="true">○</span>
      <h2>Inga restauranger är tillgängliga än</h2>
      <p>Datakällorna har inte gett några restauranger för dagens sammanställning.</p>
    </section>
  );
}
