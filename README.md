# maptap trainer

A globe guessing game. A realistic 3D satellite globe fills the screen; you're
prompted with a city and click where you think it is. You're scored 0–100 per
round by great-circle distance from the actual spot, with exponential falloff.
Rounds repeat endlessly with a running total; your all-time best total is kept
in `localStorage`.

## Run it

```bash
npm install
npm run dev
```

No API keys, accounts, or network access needed at runtime — the satellite
imagery and the city dataset are bundled with the app.

Other scripts:

```bash
npm test            # unit tests (vitest)
npm run build       # type-check + production build
npm run data:cities # regenerate public/data/cities.json from GeoNames dumps
```

## How to play

- **Drag** to rotate the globe, **scroll** to zoom.
- **Click** the globe to guess the prompted city.
- After each guess the globe rotates to the actual spot: green marker = actual
  location, orange marker = your guess, arc = great-circle path between them.
- Press **Enter** or the *Next city* button for the next round.

## Scoring

`score = round(100 * e^(-d / 2000))` where `d` is the great-circle distance in
km. Guesses within 50 km score a flat 100.

## Architecture

- `src/components/Globe.tsx` — three.js scene: textured sphere (NASA Blue
  Marble), bump map, atmosphere glow, markers, reveal arc, camera/rotation
  animation.
- `src/game/interaction.ts` — pointer layer (drag-rotate, wheel-zoom,
  click-to-guess). The guess trigger is a single `mode` option so a future
  **long-press-to-guess** toggle only touches this file.
- `src/game/geo.ts` — haversine distance and the lat/lng ↔ unit-sphere mapping
  that matches three.js `SphereGeometry` equirectangular UVs.
- `src/game/scoring.ts` — exponential-falloff scoring.
- `src/game/cities.ts` — city pool loading and random picks.
- `src/game/storage.ts` — localStorage high score.
- `scripts/build-cities.mjs` — regenerates the bundled city dataset.
- `?debug=1` URL param shows exact guess/target coordinates.

## Data & imagery credits

- City data: [GeoNames](https://www.geonames.org/) `cities15000` dump
  (~34k cities, population ≥ 15000 or admin seats), plus `admin1CodesASCII`
  and `countryInfo`. Licensed [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Earth texture: NASA Blue Marble Next Generation imagery (public domain),
  via the `three-globe` example assets. Bump map: NASA topography, same source.
