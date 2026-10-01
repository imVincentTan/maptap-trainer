export const MAX_ROUND_SCORE = 100;

/**
 * Decay constant for the exponential falloff, in kilometres.
 * score = 100 * e^(-d / DECAY), so one decay length (~2000 km) scores ~37.
 */
export const SCORE_DECAY_KM = 2000;

/** Anything this close counts as a perfect tap. */
export const PERFECT_THRESHOLD_KM = 50;

/** Exponential falloff from 100 points by great-circle distance. */
export function scoreForDistance(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  if (distanceKm <= PERFECT_THRESHOLD_KM) return MAX_ROUND_SCORE;
  return Math.max(0, Math.round(MAX_ROUND_SCORE * Math.exp(-distanceKm / SCORE_DECAY_KM)));
}

/** Short human label for how good a guess was. */
export function gradeForDistance(distanceKm: number): string {
  if (distanceKm <= PERFECT_THRESHOLD_KM) return 'Bullseye!';
  if (distanceKm <= 250) return 'Excellent';
  if (distanceKm <= 750) return 'Great';
  if (distanceKm <= 1500) return 'Good';
  if (distanceKm <= 3000) return 'Not bad';
  return 'Way off';
}
