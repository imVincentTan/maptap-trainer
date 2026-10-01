import { describe, expect, it } from 'vitest';
import {
  MAX_ROUND_SCORE,
  PERFECT_THRESHOLD_KM,
  SCORE_DECAY_KM,
  gradeForDistance,
  scoreForDistance,
} from './scoring';

describe('scoreForDistance', () => {
  it('awards max score within the perfect threshold', () => {
    expect(scoreForDistance(0)).toBe(MAX_ROUND_SCORE);
    expect(scoreForDistance(PERFECT_THRESHOLD_KM)).toBe(MAX_ROUND_SCORE);
  });

  it('follows exponential falloff past the threshold', () => {
    // One decay length out should score ~100/e ≈ 37.
    expect(scoreForDistance(SCORE_DECAY_KM)).toBe(37);
    expect(scoreForDistance(SCORE_DECAY_KM * 2)).toBe(14);
  });

  it('is monotonically non-increasing with distance', () => {
    let prev = MAX_ROUND_SCORE;
    for (let d = 0; d <= 20000; d += 137) {
      const s = scoreForDistance(d);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });

  it('stays within [0, 100]', () => {
    for (const d of [0, 1, 50, 500, 5000, 20000, 1e9]) {
      const s = scoreForDistance(d);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(MAX_ROUND_SCORE);
    }
  });

  it('rejects invalid input', () => {
    expect(scoreForDistance(-5)).toBe(0);
    expect(scoreForDistance(Number.NaN)).toBe(0);
    expect(scoreForDistance(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('gradeForDistance', () => {
  it('labels distances sensibly', () => {
    expect(gradeForDistance(10)).toBe('Bullseye!');
    expect(gradeForDistance(200)).toBe('Excellent');
    expect(gradeForDistance(500)).toBe('Great');
    expect(gradeForDistance(1000)).toBe('Good');
    expect(gradeForDistance(2000)).toBe('Not bad');
    expect(gradeForDistance(10000)).toBe('Way off');
  });
});
