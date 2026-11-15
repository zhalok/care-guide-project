# Care Guide

NestJS API with a React frontend, MongoDB, and OpenTelemetry metrics and traces,
all run with Docker Compose.

This guide covers how to build and run the stack, drive it with the browser
(e2e) test, stress it, and watch the metrics and traces.

Requires Docker with Compose v2 (`docker compose`) and, for the e2e test, Node.js.

## 1. Build and run with Docker Compose

```sh
cp .env.example .env          # first time only; set JWT_SECRET to a long random string
docker compose up --build -d  # build the images and start everything
./scripts/seed-docker.sh      # first time only: alice (admin) and bob (user), 10,000 notes each
```

`JWT_SECRET` is required: compose refuses to start without it.

| Service      | URL / port                | What it is                              |
| ------------ | ------------------------- | --------------------------------------- |
| `web`        | http://localhost:8080     | React frontend (nginx, proxies `/api/*`) |
| `app`        | http://localhost:3000     | NestJS API                              |
| `grafana`    | http://localhost:3001     | Dashboards and traces                   |
| `prometheus` | http://localhost:9090     | Metrics store                           |
| `tempo`      | localhost:4318 (OTLP)     | Trace store                             |
| `mongo`      | localhost:27017           | Database                                |

Ports can be changed with `WEB_PORT`, `APP_PORT`, `GRAFANA_PORT`,
`PROMETHEUS_PORT`, `OTLP_PORT` and `MONGO_PORT` in `.env`.

Demo logins (after seeding):

| User  | Email             | Password   | Role  |
| ----- | ----------------- | ---------- | ----- |
| Alice | alice@example.com | `alice123` | admin |
| Bob   | bob@example.com   | `bob123`   | user  |

`./scripts/seed-docker.sh` is safe to re-run: it replaces the seeded users' notes.

## 2. Run the e2e test (Playwright)

The test opens a real browser window and walks through the whole journey: Alice
logs in, loads and scrolls her notes, opens Users and logs out; then Bob logs
in, loads and scrolls his notes, and logs out. A red dot shows the cursor and
pulses on every click.

The stack must be running and seeded (section 1). Then, from `frontend/`:

```sh
cd frontend
npm install                   # first time only
npx playwright install chromium   # first time only
npm run e2e
```

It takes about a minute, because it runs in slow motion so you can follow it.

- **Speed:** `SLOWMO=<ms>` is the delay after every browser action (default
  1000). `SLOWMO=0 npm run e2e` runs at full speed (about 20 s plus the pauses).
  The pause after each step, the cursor glide and the typing delay are
  constants in `frontend/e2e/constants.ts`.
- **Browser:** `PW_CHANNEL=chrome npm run e2e` uses your installed Chrome
  instead of the downloaded Chromium.
- **Another URL:** `BASE_URL=http://host:port npm run e2e` (default
  http://localhost:8080).
- **Window:** the browser is always visible (`headless: false` in
  `frontend/playwright.config.ts`). On a machine without a screen, set it to
  `true` there.
- **On failure:** a screenshot and a trace are kept in `frontend/test-results/`.
  Open the trace with `npx playwright show-trace <path-to>/trace.zip`.

Where the test lives: `frontend/e2e/steps.ts` (the journey, step by step),
`frontend/e2e/helpers.ts` (cursor, scrolling, typing) and
`frontend/e2e/user-journey.spec.ts` (the runner).

## 3. Run the stress test

1000 concurrent copies of Bob each log in and then walk every page of
`GET /notes` (100 notes per page) until there are no more. It runs inside a Node
container on the compose network, so it needs the stack running and seeded
(section 1).

```sh
./scripts/stress-test.sh                 # 1000 users at once
USERS=100 ./scripts/stress-test.sh       # a smaller run
```

Other options (environment variables): `PAGE_SIZE`, `REQUEST_TIMEOUT_MS`,
`EXPECTED_PAGES`, `BOB_EMAIL`, `BOB_PASSWORD`, `OUTPUT`.

When it finishes it prints a summary (fulfilled and rejected users, requests per
second, login and page latency p50/p95/p99/max, and the reasons for any
failures). The full per-user report is written to
`loadtest/results/stress-<timestamp>.json` (git-ignored).

Start with a small `USERS` value if you are unsure the machine can take 1000.
Keep Grafana open while it runs (next section).

## 4. Observe metrics and traces

Open Grafana at http://localhost:3001. It allows anonymous viewing; to edit,
log in as `admin` with the `GRAFANA_ADMIN_PASSWORD` from `.env` (default
`admin`). Two dashboards are provisioned. Set the time range to the last 15 or
30 minutes while you run the e2e or stress test.

### Metrics: the "API latency" dashboard (home page)

Refreshes every 10 s. The API exports OpenTelemetry metrics, Prometheus scrapes
them every 5 s, and Grafana charts them:

- Latency percentiles (p50 / p95 / p99), overall and by route
- Request rate by route and by status code
- Server error ratio (5xx)
- Share of requests slower than 500 ms

During a stress run you should see request rate and the p95/p99 latency climb,
and the error ratio show any failures. Raw metrics can be queried in
Prometheus at http://localhost:9090.

### Traces: the "API traces" dashboard

- **Recent requests** lists the latest traces; **Slow requests (> 100 ms)**
  lists only the slow ones.
- Click a **trace ID** to open the **Trace waterfall**: the HTTP request at the
  top, then the controller, service and repository layers (tag `app.layer`),
  then the Mongoose and MongoDB calls. Bar length is duration, so the widest bar
  is where the time went.
- The same tables are at the bottom of the "API latency" dashboard.

To search traces yourself: Grafana, **Explore**, choose the **Tempo**
datasource, and filter by service `care-guide-api`.

### Quick checks

```sh
curl -s http://localhost:9090/api/v1/targets | grep -o '"health":"[a-z]*"'   # Prometheus scrape is "up"
docker compose logs tempo | tail                                             # traces are arriving
```

If the dashboards are empty, make some requests first (log in through
http://localhost:8080, or run the e2e test) and widen the time range.
