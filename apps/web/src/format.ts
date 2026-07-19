import type { MenuStatus } from '@lunch/shared/contracts';

export const STATUS_CONTENT: Record<
  MenuStatus,
  {
    label: string;
    message: string;
    tone: 'positive' | 'warning' | 'neutral' | 'negative';
  }
> = {
  confirmed_today: {
    label: 'Bekräftad idag',
    message: 'Menyn är verifierad för dagens datum.',
    tone: 'positive',
  },
  possibly_stale: {
    label: 'Kan vara inaktuell',
    message: 'Källans datum kunde inte bekräftas. Ingen meny visas som aktuell.',
    tone: 'warning',
  },
  not_published: {
    label: 'Inte publicerad än',
    message: 'Restaurangen har ännu inte publicerat en verifierad meny för idag.',
    tone: 'neutral',
  },
  closed: {
    label: 'Stängt idag',
    message: 'Restaurangen uppger att den är stängd idag.',
    tone: 'neutral',
  },
  extraction_failed: {
    label: 'Kunde inte hämtas',
    message: 'Källan gick inte att läsa vid den senaste kontrollen.',
    tone: 'negative',
  },
  manual_review: {
    label: 'Behöver granskas',
    message: 'Menyn måste verifieras manuellt innan den kan visas.',
    tone: 'warning',
  },
};

export const DIETARY_LABELS = {
  vegetarian: 'Vegetarisk',
  vegan: 'Vegansk',
  gluten_free: 'Glutenfri',
  lactose_free: 'Laktosfri',
  fish: 'Fisk',
  meat: 'Kött',
} as const;

export type DietaryTag = keyof typeof DIETARY_LABELS;

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1_000) return `${distanceMeters} m`;
  return `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(distanceMeters / 1_000)} km`;
}

export function formatPrice(priceSek: number): string {
  return `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(priceSek)} kr`;
}

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Stockholm',
  }).format(parsed);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatTimestamp(timestamp: string | null): string | null {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(timestamp));
}
