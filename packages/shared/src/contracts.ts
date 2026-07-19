import { z } from 'zod';

export const STOCKHOLM_TIME_ZONE = 'Europe/Stockholm';
export const PRODUCT_RADIUS_METERS = 2_000;
export const TARGET_LOCATION = {
  name: 'Places Telefonplan – Coworking',
  address: 'Tellusgången 2, 126 26 Hägersten, Sweden',
  latitude: 59.29927,
  longitude: 17.994293,
  radiusMeters: PRODUCT_RADIUS_METERS,
} as const;

export const menuStatusSchema = z.enum([
  'confirmed_today',
  'possibly_stale',
  'not_published',
  'closed',
  'extraction_failed',
  'manual_review',
]);

export type MenuStatus = z.infer<typeof menuStatusSchema>;

export const menuSourceTypeSchema = z.enum([
  'api',
  'structured_data',
  'html',
  'pdf',
  'official_channel',
  'manual',
]);

export const dietaryTagSchema = z.enum([
  'vegetarian',
  'vegan',
  'gluten_free',
  'lactose_free',
  'fish',
  'meat',
]);

export const dishSchema = z.object({
  name: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(500).optional(),
  priceSek: z.number().nonnegative().max(10_000).optional(),
  dietary: z.array(dietaryTagSchema).default([]),
});

export type Dish = z.infer<typeof dishSchema>;

export const restaurantSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  distanceMeters: z.number().int().nonnegative().max(PRODUCT_RADIUS_METERS),
  websiteUrl: z.string().url(),
  menuSourceUrl: z.string().url(),
  menuSourceType: menuSourceTypeSchema,
  enabled: z.boolean(),
  adapter: z.string().trim().min(1),
});

export type Restaurant = z.infer<typeof restaurantSchema>;

export const restaurantMenuSchema = restaurantSchema
  .omit({ enabled: true, adapter: true })
  .extend({
    status: menuStatusSchema,
    statusDetail: z.string().max(500).optional(),
    menuDate: z.string().date().nullable(),
    dishes: z.array(dishSchema),
    lastRetrievalAttempt: z.string().datetime().nullable(),
    lastSuccessfulRetrieval: z.string().datetime().nullable(),
    retrievedAt: z.string().datetime().nullable(),
    sourceUrl: z.string().url(),
  });

export type RestaurantMenu = z.infer<typeof restaurantMenuSchema>;

export const dashboardResponseSchema = z.object({
  date: z.string().date(),
  timeZone: z.literal(STOCKHOLM_TIME_ZONE),
  generatedAt: z.string().datetime(),
  target: z.object({
    name: z.string(),
    address: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    radiusMeters: z.literal(PRODUCT_RADIUS_METERS),
  }),
  restaurants: z.array(restaurantMenuSchema),
  summary: z.object({
    total: z.number().int().nonnegative(),
    confirmed: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
  }),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const collectionResultSchema = z.object({
  status: menuStatusSchema,
  statusDetail: z.string().max(500).optional(),
  menuDate: z.string().date().nullable(),
  dishes: z.array(dishSchema),
  sourceUrl: z.string().url(),
  retrievedAt: z.string().datetime(),
  rawExcerpt: z.string().max(20_000).optional(),
  sourceHash: z.string().min(1).optional(),
});

export type CollectionResult = z.infer<typeof collectionResultSchema>;
