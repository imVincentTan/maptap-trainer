import { describe, expect, it } from 'vitest';
import {
  formatDistanceKm,
  haversineKm,
  latLngToVec3,
  vec3ToLatLng,
  type LatLng,
} from './geo';

const NYC: LatLng = { lat: 40.7128, lng: -74.006 };
const LONDON: LatLng = { lat: 51.5074, lng: -0.1278 };
const TOKYO: LatLng = { lat: 35.6895, lng: 139.6917 };
const SYDNEY: LatLng = { lat: -33.8678, lng: 151.2073 };
const SAO_PAULO: LatLng = { lat: -23.5505, lng: -46.6333 };

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(NYC, NYC)).toBe(0);
  });

  it('matches known great-circle distances', () => {
    expect(haversineKm(NYC, LONDON)).toBeGreaterThan(5500);
    expect(haversineKm(NYC, LONDON)).toBeLessThan(5650);
    expect(haversineKm(TOKYO, SYDNEY)).toBeGreaterThan(7700);
    expect(haversineKm(TOKYO, SYDNEY)).toBeLessThan(7900);
  });

  it('is symmetric', () => {
    expect(haversineKm(NYC, TOKYO)).toBeCloseTo(haversineKm(TOKYO, NYC), 10);
  });

  it('handles antipodal points (~half Earth circumference)', () => {
    const antipode: LatLng = { lat: -NYC.lat, lng: NYC.lng + 180 };
    expect(haversineKm(NYC, antipode)).toBeCloseTo(20015, -2);
  });
});

describe('latLngToVec3 / vec3ToLatLng', () => {
  it('round-trips known cities', () => {
    for (const city of [NYC, LONDON, TOKYO, SYDNEY, SAO_PAULO]) {
      const back = vec3ToLatLng(latLngToVec3(city));
      expect(back.lat).toBeCloseTo(city.lat, 6);
      expect(back.lng).toBeCloseTo(city.lng, 6);
    }
  });

  it('round-trips edge cases', () => {
    for (const ll of [
      { lat: 0, lng: 0 },
      { lat: 89.9, lng: -179.9 },
      { lat: -89.9, lng: 179.9 },
      { lat: 0, lng: 180 },
      { lat: 0, lng: -180 },
    ] as LatLng[]) {
      const back = vec3ToLatLng(latLngToVec3(ll));
      expect(back.lat).toBeCloseTo(ll.lat, 6);
      expect(Math.abs(back.lng - ll.lng) % 360).toBeCloseTo(0, 4);
    }
  });

  it('maps to the three.js equirectangular sphere axes', () => {
    // lng 0 at +X, lng 90E at -Z, north pole at +Y (SphereGeometry UV convention)
    const origin = latLngToVec3({ lat: 0, lng: 0 });
    expect(origin.x).toBeCloseTo(1, 10);
    expect(origin.y).toBeCloseTo(0, 10);
    expect(origin.z).toBeCloseTo(0, 10);
    const east = latLngToVec3({ lat: 0, lng: 90 });
    expect(east.x).toBeCloseTo(0, 10);
    expect(east.z).toBeCloseTo(-1, 10);
    const northPole = latLngToVec3({ lat: 90, lng: 0 });
    expect(northPole.y).toBeCloseTo(1, 10);
  });

  it('respects radius', () => {
    const v = latLngToVec3(NYC, 2.5);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(2.5, 10);
  });
});

describe('formatDistanceKm', () => {
  it('formats metres under 1 km', () => {
    expect(formatDistanceKm(0.4)).toBe('400 m');
  });

  it('formats one decimal under 10 km', () => {
    expect(formatDistanceKm(7.25)).toBe('7.3 km');
  });

  it('formats rounded thousands above 10 km', () => {
    expect(formatDistanceKm(12345.6)).toBe('12,346 km');
  });
});
