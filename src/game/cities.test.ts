import { describe, expect, it } from 'vitest';
import { formatPlace, pickRandomCity, type City } from './cities';

const POOL: City[] = [
  { name: 'Tokyo', admin1: 'Tokyo', country: 'Japan', lat: 35.69, lng: 139.69 },
  { name: 'Paris', admin1: 'Île-de-France', country: 'France', lat: 48.85, lng: 2.35 },
  { name: 'Vaduz', admin1: null, country: 'Liechtenstein', lat: 47.14, lng: 9.52 },
];

describe('pickRandomCity', () => {
  it('picks deterministically from an injected rng', () => {
    expect(pickRandomCity(POOL, () => 0)).toBe(POOL[0]);
    expect(pickRandomCity(POOL, () => 0.999)).toBe(POOL[2]);
  });

  it('clamps an rng that returns exactly 1', () => {
    expect(pickRandomCity(POOL, () => 1)).toBe(POOL[2]);
  });

  it('throws on an empty pool', () => {
    expect(() => pickRandomCity([])).toThrow();
  });
});

describe('formatPlace', () => {
  it('joins city, admin1 and country', () => {
    expect(formatPlace(POOL[0])).toBe('Tokyo, Tokyo, Japan');
  });

  it('drops a missing admin1', () => {
    expect(formatPlace(POOL[2])).toBe('Vaduz, Liechtenstein');
  });
});
