#!/usr/bin/env bash
set -euo pipefail

# maptap-trainer has no package manifests, lockfiles, or application entrypoint yet.
# Confirm the checkout is present. This is safe to run more than once.
if [[ ! -f LICENSE ]]; then
  echo "maptap-trainer: expected LICENSE at the repository root" >&2
  exit 1
fi

echo "maptap-trainer: checkout verified; no project dependencies to install"
