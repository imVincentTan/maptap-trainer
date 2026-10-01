import { useCallback, useEffect, useState } from 'react';
import { Globe, type RevealState } from './components/Globe';
import { Hud } from './components/Hud';
import { ResultCard } from './components/ResultCard';
import { loadCities, pickRandomCity, type City } from './game/cities';
import { haversineKm, type LatLng } from './game/geo';
import { scoreForDistance } from './game/scoring';
import { loadHighScore, saveHighScore } from './game/storage';

type Phase = 'guessing' | 'revealed';

// ?debug=1 shows exact guess/actual coordinates — handy for verifying globe alignment.
const DEBUG = new URLSearchParams(window.location.search).has('debug');

export default function App() {
  const [cities, setCities] = useState<City[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const [city, setCity] = useState<City | null>(null);
  const [phase, setPhase] = useState<Phase>('guessing');
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [result, setResult] = useState<{ distanceKm: number; score: number } | null>(null);
  const [lastGuess, setLastGuess] = useState<LatLng | null>(null);
  const [total, setTotal] = useState(0);
  const [best, setBest] = useState<number>(() => loadHighScore());
  const [globeReady, setGlobeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCities()
      .then((pool) => {
        if (cancelled) return;
        setCities(pool);
        setCity(pickRandomCity(pool));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGuess = useCallback(
    (latLng: LatLng) => {
      if (phase !== 'guessing' || !city) return;
      const distanceKm = haversineKm(latLng, city);
      const score = scoreForDistance(distanceKm);
      const newTotal = total + score;
      setLastGuess(latLng);
      setResult({ distanceKm, score });
      setReveal({ guess: latLng, actual: { lat: city.lat, lng: city.lng } });
      setPhase('revealed');
      setTotal(newTotal);
      if (newTotal > best) {
        setBest(newTotal);
        saveHighScore(newTotal);
      }
    },
    [phase, city, total, best],
  );

  const handleNext = useCallback(() => {
    if (!cities) return;
    setCity((prev) => {
      if (cities.length < 2) return prev;
      let next = pickRandomCity(cities);
      while (next === prev) next = pickRandomCity(cities);
      return next;
    });
    setRound((r) => r + 1);
    setPhase('guessing');
    setReveal(null);
    setResult(null);
  }, [cities]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'revealed') return;
      if (e.target instanceof HTMLButtonElement) return; // let the button's own click fire
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, handleNext]);

  if (error) {
    return (
      <div className="center-msg">
        <h1>maptap trainer</h1>
        <p>Failed to load city data: {error}</p>
      </div>
    );
  }

  const ready = globeReady && cities !== null && city !== null;

  return (
    <div className="app">
      <Globe
        onGuess={handleGuess}
        reveal={reveal}
        guessEnabled={phase === 'guessing' && ready}
        onReady={() => setGlobeReady(true)}
      />
      {city && (
        <Hud city={city} round={round} total={total} best={best} revealed={phase === 'revealed'} />
      )}
      {phase === 'revealed' && result && city && (
        <ResultCard city={city} distanceKm={result.distanceKm} score={result.score} onNext={handleNext} />
      )}
      {DEBUG && city && (
        <div className="debug-readout">
          <div>target: {city.lat.toFixed(3)}, {city.lng.toFixed(3)}</div>
          <div>
            {lastGuess ? `guess: ${lastGuess.lat.toFixed(3)}, ${lastGuess.lng.toFixed(3)}` : 'guess: —'}
          </div>
        </div>
      )}
      {!ready && (
        <div className="loading-overlay">
          <h1>maptap trainer</h1>
          <p>Loading globe…</p>
        </div>
      )}
    </div>
  );
}
