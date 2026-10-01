import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadHighScore, saveHighScore } from './storage';

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('high score storage', () => {
  it('returns 0 when nothing is stored', () => {
    stubLocalStorage();
    expect(loadHighScore()).toBe(0);
  });

  it('round-trips a saved score', () => {
    stubLocalStorage();
    saveHighScore(1234);
    expect(loadHighScore()).toBe(1234);
  });

  it('ignores corrupt values', () => {
    stubLocalStorage({ 'maptap:high-score:v1': 'not-a-number' });
    expect(loadHighScore()).toBe(0);
  });

  it('survives localStorage throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(loadHighScore()).toBe(0);
    expect(() => saveHighScore(10)).not.toThrow();
  });
});
