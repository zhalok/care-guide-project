#!/bin/sh
# One-shot: copy env, start containers, seed, run the Playwright e2e test.
# Usage: ./scripts/e2e-all.sh   (SLOWMO, PW_CHANNEL, BASE_URL pass through)
set -eu

cd "$(dirname "$0")/.."

# 1. Env: copy the example only if .env does not exist yet.
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi
if ! grep -Eq '^JWT_SECRET=.+' .env; then
  secret=$(openssl rand -hex 32)
  if grep -q '^JWT_SECRET=' .env; then
    sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$secret|" .env && rm -f .env.bak
  else
    echo "JWT_SECRET=$secret" >> .env
  fi
  echo "Generated JWT_SECRET in .env"
fi

# 2. Containers
docker compose up --build -d --wait

# 3. Seed
sh scripts/seed-docker.sh

# 4. Wait for the web frontend
url="${BASE_URL:-http://localhost:${WEB_PORT:-8080}}"
echo "Waiting for $url ..."
i=0
until curl -fsS -o /dev/null "$url"; do
  i=$((i + 1))
  [ "$i" -ge 60 ] && { echo "Timed out waiting for $url" >&2; exit 1; }
  sleep 2
done

# 5. e2e
cd frontend
[ -d node_modules ] || npm install
npx playwright install chromium
BASE_URL="$url" npm run e2e
