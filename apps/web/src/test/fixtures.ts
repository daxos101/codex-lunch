import type { DashboardResponse, RestaurantMenu } from '@lunch/shared/contracts';

const baseRestaurant: Omit<
  RestaurantMenu,
  | 'id'
  | 'slug'
  | 'name'
  | 'address'
  | 'distanceMeters'
  | 'status'
  | 'statusDetail'
  | 'dishes'
> = {
  latitude: 59.298,
  longitude: 17.993,
  websiteUrl: 'https://example.com',
  menuSourceUrl: 'https://example.com/lunch',
  menuSourceType: 'html',
  menuDate: '2026-07-19',
  lastRetrievalAttempt: '2026-07-19T08:16:00.000Z',
  lastSuccessfulRetrieval: '2026-07-19T08:16:00.000Z',
  retrievedAt: '2026-07-19T08:16:00.000Z',
  sourceUrl: 'https://example.com/lunch',
};

export const dashboardFixture: DashboardResponse = {
  date: '2026-07-19',
  timeZone: 'Europe/Stockholm',
  generatedAt: '2026-07-19T08:18:00.000Z',
  target: {
    name: 'Places Telefonplan',
    address: 'Tellusgången 2, 126 26 Hägersten, Sweden',
    latitude: 59.298,
    longitude: 17.993,
    radiusMeters: 2_000,
  },
  restaurants: [
    {
      ...baseRestaurant,
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'ateljen',
      name: 'Ateljén',
      address: 'Telefonvägen 30',
      distanceMeters: 260,
      status: 'confirmed_today',
      dishes: [
        {
          name: 'Rostad blomkål med tahini',
          description: 'Linser, örter och citron',
          priceSek: 135,
          dietary: ['vegetarian', 'gluten_free'],
        },
        {
          name: 'Dagens fisk med brynt smör',
          priceSek: 149,
          dietary: ['fish'],
        },
      ],
    },
    {
      ...baseRestaurant,
      id: '22222222-2222-4222-8222-222222222222',
      slug: 'soderbergs-bistro',
      name: 'Söderbergs Bistro',
      address: 'Midsommarvägen 12',
      distanceMeters: 740,
      status: 'confirmed_today',
      dishes: [
        {
          name: 'Krämig linssoppa',
          description: 'Surdegsbröd och örtolja',
          priceSek: 119,
          dietary: ['vegan'],
        },
      ],
    },
    {
      ...baseRestaurant,
      id: '33333333-3333-4333-8333-333333333333',
      slug: 'gamla-hornan',
      name: 'Gamla Hörnan',
      address: 'Hägerstensvägen 100',
      distanceMeters: 1_240,
      status: 'possibly_stale',
      statusDetail: 'Källan visar en meny från förra veckan.',
      menuDate: '2026-07-12',
      dishes: [
        {
          name: 'Gammal pannbiff',
          priceSek: 125,
          dietary: ['meat'],
        },
      ],
    },
  ],
  summary: {
    total: 3,
    confirmed: 2,
    unavailable: 1,
  },
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}
