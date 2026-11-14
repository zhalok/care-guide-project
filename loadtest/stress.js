
// Stress test: USERS (default 1000) copies of "Bob" run at the same moment.
// Each one logs in, then walks EVERY page of GET /notes (100 per page) by
// following nextCursor until it is null.
//
// All walks are started in one loop without awaiting, the promises are
// gathered, and Promise.allSettled waits for every one of them. The outcome of
// each user (and a summary) is written to a JSON file.
//
// Run:  ./scripts/stress-test.sh        (inside the compose network, recommended)
//   or: node loadtest/stress.js         (BASE_URL=http://localhost:8080/api)
//
// Environment: BASE_URL, USERS, PAGE_SIZE, BOB_EMAIL, BOB_PASSWORD,
// REQUEST_TIMEOUT_MS (default 60000), EXPECTED_PAGES (optional), OUTPUT.
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const env = process.env;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const config = {
  baseUrl: (env.BASE_URL ?? 'http://localhost:8080/api').replace(/\/$/, ''),
  users: Number(env.USERS ?? 1000),
  pageSize: Number(env.PAGE_SIZE ?? 100),
  email: env.BOB_EMAIL ?? 'bob@example.com',
  password: env.BOB_PASSWORD ?? 'bob123',
  requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 60_000),
  expectedPages: env.EXPECTED_PAGES ? Number(env.EXPECTED_PAGES) : null,
  output: env.OUTPUT ?? `loadtest/results/stress-${stamp}.json`,
};
// Safety stop so a server bug that never ends the cursor cannot loop forever.
const MAX_PAGES = 5000;

// ---- measurements shared by every user (so failed walks still count) ----
const metrics = {
  requests: 0,
  loginMs: [],
  pageMs: [],
  results: new Map(), // "page 200" / "login timeout" -> how many requests
};
const count = (key) => metrics.results.set(key, (metrics.results.get(key) ?? 0) + 1);

class WalkError extends Error {
  constructor(stage, message, page = null) {
    super(message);
    this.stage = stage;
    this.page = page;
  }
}

/** A short, stable name for a network failure. */
function describeError(error) {
  if (error?.name === 'TimeoutError') return 'timeout';
  return error?.cause?.code ?? error?.code ?? error?.name ?? 'error';
}

/** One HTTP call; the whole body is read inside the timing, like a browser. */
async function call(stage, urlPath, init = {}) {
  metrics.requests++;
  const started = performance.now();
  try {
    const res = await fetch(`${config.baseUrl}${urlPath}`, {
      ...init,
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    const text = await res.text();
    const ms = performance.now() - started;
    count(`${stage} ${res.status}`);
    return { status: res.status, text, ms };
  } catch (error) {
    count(`${stage} ${describeError(error)}`);
    throw new WalkError(stage, describeError(error));
  }
}

/** One user: log in as Bob, then walk every page. Rejects on any failure. */
async function runUser(id) {
  const started = performance.now();

  const login = await call('login', '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  metrics.loginMs.push(login.ms);
  if (login.status !== 200) throw new WalkError('login', `HTTP ${login.status}`);
  const { accessToken } = JSON.parse(login.text);

  let cursor = null;
  let pages = 0;
  let notes = 0;
  do {
    const query = new URLSearchParams({ limit: String(config.pageSize) });
    if (cursor) query.set('cursor', cursor);
    let page;
    try {
      page = await call('page', `/notes?${query}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      throw new WalkError('page', error.message, pages + 1);
    }
    metrics.pageMs.push(page.ms);
    if (page.status !== 200) {
      throw new WalkError('page', `HTTP ${page.status}`, pages + 1);
    }
    const body = JSON.parse(page.text);
    notes += body.items.length;
    pages++;
    cursor = body.nextCursor;
  } while (cursor && pages < MAX_PAGES);

  if (config.expectedPages !== null && pages !== config.expectedPages) {
    throw new WalkError('walk', `expected ${config.expectedPages} pages, got ${pages}`);
  }
  return {
    pages,
    notes,
    loginMs: round(login.ms),
    totalMs: round(performance.now() - started),
  };
}

// ---- reporting helpers ----
const round = (n) => Math.round(n * 10) / 10;

function stats(values) {
  if (values.length === 0) return { count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  const sum = sorted.reduce((total, v) => total + v, 0);
  return {
    count: sorted.length,
    minMs: round(sorted[0]),
    avgMs: round(sum / sorted.length),
    p50Ms: round(at(50)),
    p90Ms: round(at(90)),
    p95Ms: round(at(95)),
    p99Ms: round(at(99)),
    maxMs: round(sorted[sorted.length - 1]),
  };
}

const fmtSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

async function main() {
  console.log(
    `Starting ${config.users} users at once against ${config.baseUrl} ` +
      `(page size ${config.pageSize}, timeout ${fmtSeconds(config.requestTimeoutMs)})`,
  );
  const startedAt = new Date();
  const clock = performance.now();
  const progress = { ok: 0, failed: 0 };

  // Fire every user in one loop WITHOUT awaiting, so all of them run together.
  const walks = [];
  for (let user = 1; user <= config.users; user++) {
    walks.push(
      runUser(user).then(
        (value) => {
          progress.ok++;
          return value;
        },
        (error) => {
          progress.failed++;
          throw error;
        },
      ),
    );
  }

  const ticker = setInterval(() => {
    const done = progress.ok + progress.failed;
    console.log(
      `  ${fmtSeconds(performance.now() - clock)}: ${done}/${config.users} finished ` +
        `(${progress.ok} ok, ${progress.failed} failed), ${metrics.requests} requests sent`,
    );
  }, 10_000);

  const settled = await Promise.allSettled(walks);
  clearInterval(ticker);
  const elapsedMs = performance.now() - clock;

  // ---- per-user outcomes ----
  const outcomes = settled.map((result, index) =>
    result.status === 'fulfilled'
      ? { user: index + 1, status: 'fulfilled', ...result.value }
      : {
          user: index + 1,
          status: 'rejected',
          stage: result.reason?.stage ?? 'unknown',
          page: result.reason?.page ?? null,
          error: result.reason?.message ?? String(result.reason),
        },
  );
  const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
  const rejected = outcomes.filter((o) => o.status === 'rejected');

  const failureGroups = new Map();
  for (const o of rejected) {
    const key = `${o.stage}: ${o.error}`;
    failureGroups.set(key, (failureGroups.get(key) ?? 0) + 1);
  }

  const report = {
    config: { ...config, maxPages: MAX_PAGES },
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    elapsedSeconds: round(elapsedMs / 1000),
    summary: {
      users: config.users,
      fulfilled: fulfilled.length,
      rejected: rejected.length,
      successRatePercent: round((fulfilled.length / config.users) * 100),
      requests: {
        total: metrics.requests,
        perSecond: round(metrics.requests / (elapsedMs / 1000)),
        byResult: Object.fromEntries([...metrics.results].sort()),
      },
      pagesWalkedByFulfilledUsers: fulfilled.reduce((n, o) => n + o.pages, 0),
      loginLatency: stats(metrics.loginMs),
      pageLatency: stats(metrics.pageMs),
      fullWalkDuration: stats(fulfilled.map((o) => o.totalMs)),
      failures: [...failureGroups]
        .map(([reason, users]) => ({ reason, users }))
        .sort((a, b) => b.users - a.users),
    },
    outcomes,
  };

  await mkdir(path.dirname(config.output), { recursive: true });
  await writeFile(config.output, JSON.stringify(report, null, 2) + '\n');

  const s = report.summary;
  console.log(`\nFinished in ${fmtSeconds(elapsedMs)}: ${s.fulfilled} fulfilled, ${s.rejected} rejected`);
  console.log(`  requests: ${s.requests.total} (${s.requests.perSecond}/s)`);
  console.log(`  login latency: p50 ${s.loginLatency.p50Ms}ms, p95 ${s.loginLatency.p95Ms}ms, max ${s.loginLatency.maxMs}ms`);
  console.log(`  page latency:  p50 ${s.pageLatency.p50Ms}ms, p95 ${s.pageLatency.p95Ms}ms, p99 ${s.pageLatency.p99Ms}ms, max ${s.pageLatency.maxMs}ms`);
  for (const f of s.failures) console.log(`  failed (${f.users} users): ${f.reason}`);
  console.log(`Report written to ${config.output}`);

  process.exitCode = rejected.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('Stress test crashed:', error);
  process.exitCode = 2;
});
