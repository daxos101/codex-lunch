import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const researchPath = new URL('../data/research/restaurants.json', import.meta.url);
const outputPath = new URL('../data/restaurants.json', import.meta.url);
const EARTH_RADIUS_METERS = 6_371_008.8;
const PRODUCT_RADIUS_METERS = 2_000;

function stableUuid(slug) {
  const hash = createHash('sha256')
    .update(`hagersten-lunch:${slug}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hash[12] = '5';
  hash[16] = ['8', '9', 'a', 'b'][Number.parseInt(hash[16], 16) % 4];
  const value = hash.join('');
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join('-');
}

function sourceType(category) {
  if (category.includes('pdf')) return 'pdf';
  if (category.includes('api') || category.includes('feed')) return 'api';
  if (category.includes('structured')) return 'structured_data';
  return 'html';
}

const research = JSON.parse(await readFile(researchPath, 'utf8'));
const target = research.target.coordinates;

function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineMeters(from, to) {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

for (const candidate of research.reviewedCandidates) {
  const distance = haversineMeters(target, candidate.coordinates);
  const eligible = distance <= PRODUCT_RADIUS_METERS;
  if (eligible !== candidate.eligible) {
    throw new Error(
      `${candidate.id}: eligibility does not match calculated ${distance.toFixed(1)}m distance`,
    );
  }
  if (Math.abs(distance - candidate.distanceMeters) > 0.15) {
    throw new Error(
      `${candidate.id}: research distance differs from calculated distance`,
    );
  }
}

const restaurants = research.reviewedCandidates
  .filter((candidate) => candidate.eligible)
  .map((candidate) => ({
    id: stableUuid(candidate.id),
    slug: candidate.id,
    name: candidate.name,
    address: candidate.address,
    latitude: candidate.coordinates.latitude,
    longitude: candidate.coordinates.longitude,
    distanceMeters: Math.round(haversineMeters(target, candidate.coordinates)),
    websiteUrl: candidate.websiteUrl,
    menuSourceUrl:
      candidate.menuSource.authority === 'official'
        ? candidate.menuSource.url
        : candidate.websiteUrl,
    menuSourceType:
      candidate.menuSource.authority === 'official'
        ? sourceType(candidate.menuSource.category)
        : 'manual',
    enabled: candidate.operationalEnabled ?? candidate.researchStatus !== 'unsupported',
    adapter: candidate.adapterId ?? 'manual-review',
  }))
  .sort((left, right) => left.distanceMeters - right.distanceMeters);

const output = {
  schemaVersion: 1,
  generatedFrom: 'data/research/restaurants.json',
  researchGeneratedAtUtc: research.generatedAtUtc,
  target: research.target,
  restaurants,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({
    event: 'restaurant_seed_built',
    included: restaurants.length,
    enabled: restaurants.filter((restaurant) => restaurant.enabled).length,
    output: 'data/restaurants.json',
  })}\n`,
);
