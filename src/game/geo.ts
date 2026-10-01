export interface LatLng {
  /** Latitude in degrees, positive north. */
  lat: number;
  /** Longitude in degrees, positive east. */
  lng: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const EARTH_RADIUS_KM = 6371;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Great-circle distance between two points on Earth, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG2RAD;
  const dLng = (b.lng - a.lng) * DEG2RAD;
  const lat1 = a.lat * DEG2RAD;
  const lat2 = b.lat * DEG2RAD;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Converts lat/lng to a point on a unit sphere using the same mapping that
 * three.js SphereGeometry uses for equirectangular textures:
 * lng 0 at +X, lng +90E at -Z, lat +90 at +Y.
 */
export function latLngToVec3(ll: LatLng, radius = 1): Vec3 {
  const lat = ll.lat * DEG2RAD;
  const lng = ll.lng * DEG2RAD;
  const cosLat = Math.cos(lat);
  return {
    x: radius * cosLat * Math.cos(lng),
    y: radius * Math.sin(lat),
    z: -radius * cosLat * Math.sin(lng),
  };
}

/** Inverse of {@link latLngToVec3}. */
export function vec3ToLatLng(v: Vec3): LatLng {
  const r = Math.hypot(v.x, v.y, v.z);
  return {
    lat: Math.asin(v.y / r) * RAD2DEG,
    lng: Math.atan2(-v.z, v.x) * RAD2DEG,
  };
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString('en-US')} km`;
}
