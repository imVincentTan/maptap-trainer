const HIGH_SCORE_KEY = 'maptap:high-score:v1';

export function loadHighScore(): number {
  try {
    const raw = globalThis.localStorage?.getItem(HIGH_SCORE_KEY);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    globalThis.localStorage?.setItem(HIGH_SCORE_KEY, String(Math.round(score)));
  } catch {
    // Storage unavailable (private mode, quota) — high score just won't persist.
  }
}
