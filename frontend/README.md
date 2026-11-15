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

## End-to-end test (Playwright)

Drives a real browser through the whole stack: Alice (admin) logs in, loads her
notes and more, opens Users, logs out; then Bob logs in, loads his notes and
more, and logs out. It needs the stack running and the demo data seeded:

    docker compose up -d && ./scripts/seed-docker.sh   # from the project root
    npx playwright install chromium                    # once
    npm run e2e                                        # from frontend/

Use your installed Chrome instead with `PW_CHANNEL=chrome npm run e2e`.
It runs in slow motion in a visible browser window (`SLOWMO=0` for full speed);
see the [root README](../README.md). A failure leaves a screenshot and trace in
`test-results/`.

## Scripts

    npm test          # unit + component tests (vitest, jsdom)
    npm run e2e       # browser test against the running stack
    npm run typecheck
    npm run build     # type-check, then production build into dist/
