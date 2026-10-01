import type { City } from '../game/cities';

interface HudProps {
  city: City;
  round: number;
  total: number;
  best: number;
  revealed: boolean;
}

export function Hud({ city, round, total, best, revealed }: HudProps) {
  return (
    <>
      <header className="hud-top">
        <div className="brand">
          maptap <span>trainer</span>
        </div>
        <div className="prompt-card">
          <div className="prompt-label">Round {round} — find this city</div>
          <div className="prompt-city">{city.name}</div>
          <div className="prompt-region">
            {[city.admin1, city.country].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="stats-card">
          <div className="stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{total.toLocaleString('en-US')}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Best</span>
            <span className="stat-value">{best.toLocaleString('en-US')}</span>
          </div>
        </div>
      </header>
      {!revealed && (
        <footer className="hint">Drag to rotate · Scroll to zoom · Click the globe to guess</footer>
      )}
    </>
  );
}
