#!/usr/bin/env bash
set -euo pipefail

# maptap-trainer is a Vite + React + TypeScript app. Install dependencies from
# the lockfile. This is safe to run more than once.
if [[ ! -f LICENSE ]]; then
  echo "maptap-trainer: expected LICENSE at the repository root" >&2
  exit 1
fi

npm ci
