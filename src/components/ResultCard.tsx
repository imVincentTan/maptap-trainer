import { formatDistanceKm } from '../game/geo';
import { formatPlace, type City } from '../game/cities';
import { gradeForDistance } from '../game/scoring';

interface ResultCardProps {
  city: City;
  distanceKm: number;
  score: number;
  onNext: () => void;
}

export function ResultCard({ city, distanceKm, score, onNext }: ResultCardProps) {
  return (
    <div className="result-card" role="status">
      <div className="result-score">+{score}</div>
      <div className="result-details">
        <div className="result-grade">{gradeForDistance(distanceKm)}</div>
        <div className="result-distance">
          You were <strong>{formatDistanceKm(distanceKm)}</strong> away
        </div>
        <div className="result-actual">Actual spot: {formatPlace(city)}</div>
      </div>
      <button type="button" className="next-button" onClick={onNext}>
        Next city ⏎
      </button>
    </div>
  );
}
