import type { RestaurantMenu } from '@lunch/shared/contracts';

import {
  DIETARY_LABELS,
  formatDistance,
  formatPrice,
  formatTimestamp,
  STATUS_CONTENT,
} from '../format';
import { ArrowIcon, ExternalIcon, LocationIcon } from './Icons';
import { StatusBadge } from './StatusBadge';

export function RestaurantCard({ restaurant }: { restaurant: RestaurantMenu }) {
  const isConfirmed = restaurant.status === 'confirmed_today';
  const updatedAt = formatTimestamp(
    restaurant.retrievedAt ?? restaurant.lastRetrievalAttempt,
  );
  const status = STATUS_CONTENT[restaurant.status];

  return (
    <article
      className={`restaurant-card ${isConfirmed ? '' : 'restaurant-card--unavailable'}`}
    >
      <header className="restaurant-card__header">
        <div>
          <p className="restaurant-card__distance">
            <LocationIcon />
            {formatDistance(restaurant.distanceMeters)} från Tellusgången
          </p>
          <h2>{restaurant.name}</h2>
        </div>
        <StatusBadge status={restaurant.status} />
      </header>

      {isConfirmed ? (
        restaurant.dishes.length > 0 ? (
          <ul aria-label={`Dagens rätter på ${restaurant.name}`} className="dish-list">
            {restaurant.dishes.map((dish, index) => (
              <li className="dish" key={`${dish.name}-${index}`}>
                <div className="dish__topline">
                  <h3>{dish.name}</h3>
                  {dish.priceSek !== undefined && (
                    <span className="dish__price">{formatPrice(dish.priceSek)}</span>
                  )}
                </div>
                {dish.description && <p>{dish.description}</p>}
                {dish.dietary.length > 0 && (
                  <ul
                    aria-label={`Kostinformation för ${dish.name}`}
                    className="tag-list"
                  >
                    {dish.dietary.map((tag) => (
                      <li key={tag}>{DIETARY_LABELS[tag]}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="menu-message" role="status">
            <strong>Ingen rätt kunde läsas ut.</strong>
            <span>Menykällan är daterad idag, men saknar tydliga rätter.</span>
          </div>
        )
      ) : (
        <div className="menu-message" role="status">
          <strong>Ingen bekräftad meny att visa.</strong>
          <span>{restaurant.statusDetail ?? status.message}</span>
        </div>
      )}

      <footer className="restaurant-card__footer">
        <div className="restaurant-card__meta">
          <address>{restaurant.address}</address>
          <span>
            {updatedAt ? (
              <>
                Senast kontrollerad{' '}
                <time
                  dateTime={
                    restaurant.retrievedAt ??
                    restaurant.lastRetrievalAttempt ??
                    undefined
                  }
                >
                  {updatedAt}
                </time>
              </>
            ) : (
              'Har inte kontrollerats ännu'
            )}
          </span>
        </div>
        <div className="restaurant-card__links">
          <a href={restaurant.websiteUrl} rel="noreferrer" target="_blank">
            Webbplats <ExternalIcon />
          </a>
          <a
            className="source-link"
            href={restaurant.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Originalmeny <ArrowIcon />
          </a>
        </div>
      </footer>
    </article>
  );
}
