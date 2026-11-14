#!/bin/sh
# Seeds alice and bob (10,000 notes each) using the app's Docker image.
# Starts the compose MongoDB if it is not already running. Safe to re-run:
# it replaces the seeded users' notes. Development data only.
set -eu

cd "$(dirname "$0")/.."

# docker-compose.yml requires JWT_SECRET to be set; the seed does not use it.
: "${JWT_SECRET:=seed-only-not-used}"
export JWT_SECRET

docker compose up -d --wait mongo
docker compose run --rm --no-deps --build app node dist/seed/seed.js