export interface City {
  name: string;
  /** Nearest state/province equivalent, when the dataset has one. */
  admin1: string | null;
  country: string;
  lat: number;
  lng: number;
}

/** Compact tuple form emitted by scripts/build-cities.mjs. */
type CityRow = [name: string, admin1: string | null, country: string, lat: number, lng: number];

let cache: City[] | null = null;

/** Loads the bundled GeoNames-derived city pool (public/data/cities.json). */
export async function loadCities(): Promise<City[]> {
  if (cache) return cache;
  const res = await fetch(`${import.meta.env.BASE_URL}data/cities.json`);
  if (!res.ok) throw new Error(`failed to load cities.json (HTTP ${res.status})`);
  const rows = (await res.json()) as CityRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('cities.json is empty or malformed');
  }
  cache = rows.map(([name, admin1, country, lat, lng]) => ({ name, admin1, country, lat, lng }));
  return cache;
}

/** Fully random pick — no difficulty ramp (v1 decision). */
export function pickRandomCity(cities: City[], rng: () => number = Math.random): City {
  if (cities.length === 0) throw new Error('city pool is empty');
  return cities[Math.min(cities.length - 1, Math.floor(rng() * cities.length))];
}

/** "City, Admin1, Country" — admin1 dropped when unknown. */
export function formatPlace(place: Pick<City, 'name' | 'admin1' | 'country'>): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join(', ');
}
