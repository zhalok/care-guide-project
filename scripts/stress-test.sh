#!/bin/sh
# Stress test: USERS (default 1000) concurrent users each log in as Bob and walk
# every page of GET /notes (100 per page). Runs loadtest/stress.js in a Node
# container joined to the compose network, so it needs the stack running:
#   docker compose up -d
# The report is written to loadtest/results/stress-<timestamp>.json.
#
#   ./scripts/stress-test.sh                    # 1000 users at once
#   USERS=100 ./scripts/stress-test.sh          # smaller run
#
# Other options (see loadtest/stress.js): PAGE_SIZE, REQUEST_TIMEOUT_MS,
# EXPECTED_PAGES, BOB_EMAIL, BOB_PASSWORD, OUTPUT.
set -eu

cd "$(dirname "$0")/.."

NODE_IMAGE="${NODE_IMAGE:-node:22-alpine}"

WEB_CONTAINER="$(docker compose ps -q web)"
if [ -z "$WEB_CONTAINER" ]; then
  echo "The 'web' service is not running. Start the stack first: docker compose up -d" >&2
  exit 1
fi
# Join the compose network and call nginx by its service name.
NETWORK="$(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}' "$WEB_CONTAINER")"

mkdir -p loadtest/results

exec docker run --rm \
  --network "$NETWORK" \
  --ulimit nofile=65536:65536 \
  --user "$(id -u):$(id -g)" \
  -w /app \
  -e BASE_URL="${BASE_URL:-http://web/api}" \
  -e USERS="${USERS:-1000}" \
  -e PAGE_SIZE="${PAGE_SIZE:-100}" \
  -e REQUEST_TIMEOUT_MS="${REQUEST_TIMEOUT_MS:-60000}" \
  -e EXPECTED_PAGES="${EXPECTED_PAGES:-}" \
  -e BOB_EMAIL="${BOB_EMAIL:-bob@example.com}" \
  -e BOB_PASSWORD="${BOB_PASSWORD:-bob123}" \
  -e OUTPUT="${OUTPUT:-loadtest/results/stress-$(date +%Y%m%d-%H%M%S).json}" \
  -v "$PWD/loadtest:/app/loadtest" \
  "$NODE_IMAGE" node loadtest/stress.js
