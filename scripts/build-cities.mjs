#!/usr/bin/env node
/**
 * Builds public/data/cities.json from GeoNames dumps (CC-BY 4.0, geonames.org).
 *
 * Sources (downloaded on demand into .data-cache/, key-free):
 *   - cities15000.zip        all cities with population >= 15000 or seats of admin divisions
 *   - admin1CodesASCII.txt   state/province-equivalent names
 *   - countryInfo.txt        country names
 *
 * Output rows are compact tuples: [name, admin1 | null, country, lat, lng]
 * with coordinates rounded to 4 decimal places (~11 m).
 *
 * Usage: npm run data:cities
 */
import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = process.env.GEONAMES_CACHE_DIR ?? join(ROOT, '.data-cache');
const OUT_FILE = join(ROOT, 'public', 'data', 'cities.json');

const SOURCES = {
  citiesZip: 'https://download.geonames.org/export/dump/cities15000.zip',
  admin1: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
  countries: 'https://download.geonames.org/export/dump/countryInfo.txt',
};

async function fetchIfMissing(url, dest) {
  if (existsSync(dest)) return;
  mkdirSync(dirname(dest), { recursive: true });
  console.log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed: ${url} (HTTP ${res.status})`);
  await pipeline(res.body, createWriteStream(dest));
}

function round4(n) {
  return Math.round(n * 1e4) / 1e4;
}

async function main() {
  const citiesZipPath = join(CACHE_DIR, 'cities15000.zip');
  const admin1Path = join(CACHE_DIR, 'admin1CodesASCII.txt');
  const countriesPath = join(CACHE_DIR, 'countryInfo.txt');
  await fetchIfMissing(SOURCES.citiesZip, citiesZipPath);
  await fetchIfMissing(SOURCES.admin1, admin1Path);
  await fetchIfMissing(SOURCES.countries, countriesPath);

  const countryName = new Map(); // ISO2 -> country name
  for (const line of readFileSync(countriesPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (f.length > 4 && f[0] && f[4]) countryName.set(f[0], f[4]);
  }

  const admin1Name = new Map(); // "ISO2.CODE" -> region name
  for (const line of readFileSync(admin1Path, 'utf8').split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    if (f.length > 1 && f[0] && f[1]) admin1Name.set(f[0], f[1]);
  }

  const citiesTxt = execFileSync('unzip', ['-p', citiesZipPath, 'cities15000.txt'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  const rows = [];
  let skipped = 0;
  for (const line of citiesTxt.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    // GeoNames columns: 1 name, 4 lat, 5 lng, 8 country code, 10 admin1 code
    const country = countryName.get(f[8]);
    const lat = Number(f[4]);
    const lng = Number(f[5]);
    if (!country || !f[1] || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped += 1;
      continue;
    }
    const admin1 = f[10] ? admin1Name.get(`${f[8]}.${f[10]}`) ?? null : null;
    rows.push([f[1], admin1, country, round4(lat), round4(lng)]);
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(rows));
  const mb = (JSON.stringify(rows).length / 1024 / 1024).toFixed(2);
  console.log(`wrote ${rows.length} cities to ${OUT_FILE} (${mb} MB, skipped ${skipped})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
