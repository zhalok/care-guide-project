# Care Guide web

React + TypeScript (Vite). In production nginx serves the built files and
forwards `/api/*` to the backend with the `/api` prefix removed
(`/api/notes` -> `app:3000/notes`), so the browser only talks to one origin.

## With Docker (everything)

    docker compose up --build        # from the project root
    ./scripts/seed-docker.sh         # alice / bob demo data (first time only)

Open http://localhost:8080 (`WEB_PORT` changes it).

## Local development

    npm run dev                      # http://localhost:5173

The Vite dev server proxies `/api` to http://localhost:3000 (set `API_URL` to
point elsewhere), so start the backend first (`npm run start:dev` in the root).

## Scripts

    npm test          # unit + component tests (vitest, jsdom)
    npm run typecheck
    npm run build     # type-check, then production build into dist/
