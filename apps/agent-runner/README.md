# Voyant Agent Runner

`apps/agent-runner` is the Cloudflare-ready shell for an always-on agent queue
runner. It proves the deployed Hono surface, bearer-token auth, scheduled
handler shape, and control-plane configuration without executing lifecycle
commands in the Worker.

When explicitly enabled, the runner can perform a lease-only supervisor tick:
it calls the control plane to acquire one dispatch intent from the latest stored
queue snapshot. It still does not mutate GitHub directly, create workspaces, run
provider commands, or spend model budget.

The deployment uses three Cloudflare persistence surfaces:

- R2 (`AGENT_RUNNER_TICKS`) stores raw supervisor tick and lease history
  artifacts.
- D1 (`AGENT_RUNNER_DB`) stores the queryable run ledger: runs, leases, and
  supervisor events.
- Durable Objects (`AGENT_RUNNER_COORDINATOR`) provide per-key coordination
  and locks. They are not the source of truth for run history.

## Endpoints

- `GET /health` returns public service health.
- `GET /api/capabilities` returns runner defaults, execution state, and
  control-plane configuration. Requires `AGENT_RUNNER_TOKENS`.
- `POST /api/supervisor/ticks` validates a supervisor tick request and returns
  the equivalent local command plan. By default it is a dry run. With
  `AGENT_RUNNER_ENABLED=true` and `{ "dryRun": false }`, it leases one dispatch
  intent from `POST /api/dispatch-intents/latest` on the control plane. When
  `AGENT_RUNNER_TICKS` is bound, the result is persisted as the latest
  supervisor tick for the repository. If `AGENT_RUNNER_MAX_DAILY_LEASES` is
  configured, real leases are refused once the R2 lease-specific history shows
  the daily limit has been used.
  For deployment smoke tests, pass
  `{ "dryRun": true, "validateControlPlane": true }` to call the control
  plane's read-only latest dispatch-plan endpoint without leasing work.
  If the control plane rejects the lease because an active intent already
  exists, the tick result includes that active intent so operators can inspect
  the holder and expiration from the persisted supervisor status.
- `GET /api/supervisor/status?repository=<owner/name>&limit=<n>` returns a
  non-mutating operator view with runner capabilities, tick storage state, the
  latest persisted supervisor tick, recent tick history, and recent
  lease-budget history when available. If `repository` is omitted, the
  configured `AGENT_RUNNER_REPOSITORY` is used. The endpoint still returns
  capabilities when `AGENT_RUNNER_TICKS` is not bound.
- `GET /api/supervisor/ticks/latest?repository=<owner/name>` returns the latest
  persisted supervisor tick for a repository. Requires `AGENT_RUNNER_TOKENS`
  and the `AGENT_RUNNER_TICKS` binding.
- `GET /api/supervisor/ticks/recent?repository=<owner/name>&limit=<n>` returns
  recent persisted supervisor ticks for a repository. `limit` defaults to 20
  and is clamped to 1..50.
- `GET /api/supervisor/leases/recent?repository=<owner/name>&limit=<n>` returns
  recent successful deployed leases from the lease-budget history. Pass `since`
  with an ISO timestamp to inspect a specific budget window.
- `GET /api/ledger/status?repository=<owner/name>` returns D1-backed run and
  lease counts for the repository.
- `GET /api/ledger/runs/recent?repository=<owner/name>&limit=<n>` returns
  recent D1 ledger runs.
- `GET /api/ledger/leases/recent?repository=<owner/name>&limit=<n>` returns
  recent D1 ledger leases. Pass `since` with an ISO timestamp to inspect a
  specific window.

## Configuration

- `AGENT_RUNNER_TOKENS`: comma-separated bearer tokens for `/api/*`.
- `AGENT_RUNNER_ENABLED`: must be `true` before scheduled ticks can lease
  dispatch intents.
- `AGENT_RUNNER_ALLOWED_ACTIONS`: optional comma-separated lifecycle action
  allow-list. Defaults to runner-supported lifecycle actions except opt-in CI
  repair actions.
- `AGENT_RUNNER_ACTION`: optional default lifecycle action filter, useful when
  `AGENT_RUNNER_ALLOWED_ACTIONS` restricts Cron to one action such as `sync-pr`
  or `collect-review`.
  Add `repair-ci` or `remote-repair-ci` to `AGENT_RUNNER_ALLOWED_ACTIONS` only
  when the runner environment also configures the corresponding supervised
  repair command outside this Worker.
- `AGENT_RUNNER_HOLDER`: default lease holder, for example `runner:cloudflare`.
- `AGENT_RUNNER_LEASE_TTL_SECONDS`: optional default lease TTL used when a
  supervisor tick does not provide `ttlSeconds`. Keep this short for Cron
  because the Worker is lease-only and command execution remains external.
- `AGENT_RUNNER_MAX_DAILY_LEASES`: optional daily lease budget for deployed
  API and Cron ticks. Requires `AGENT_RUNNER_TICKS`; real leases are refused if
  the budget is configured without persistent tick storage. The value is
  clamped to 1..100.
- `AGENT_RUNNER_MAX_LEASE_TTL_SECONDS`: optional maximum lease TTL. Defaults to
  900 seconds and is clamped to 60..3600 seconds.
- `AGENT_RUNNER_REPOSITORY`: default repository, for example `voyant-travel/voyant`.
- `AGENT_RUNNER_TICKS`: optional R2 binding for latest supervisor tick status
  recent supervisor tick history, and lease-budget history.
- `AGENT_RUNNER_TICK_KEY_PREFIX`: optional R2 key prefix for supervisor ticks.
- `AGENT_RUNNER_DB`: D1 binding for the queryable run ledger. Apply
  `migrations/0001_agent_runner_ledger.sql` before enabling Cron.
- `AGENT_RUNNER_COORDINATOR`: Durable Object binding for run/repository
  coordination locks.
- `AGENT_SPRITE_POOL`: optional comma-separated Sprite pool, for example
  `voyant-agent-01:2,voyant-agent-02:2,voyant-agent-03:2`. Each `:<n>` creates
  `n` logical slots on that Sprite. The runner leases one slot before asking
  the control plane for `remote-bootstrap`; the control plane injects the
  matching `--workspace sandbox:sprite:<slot>` value into the leased command.
- `AGENT_CONTROL_PLANE_URL`: deployed control-plane URL.
- `AGENT_CONTROL_PLANE_TOKEN`: bearer token for the control plane.

Cron triggers should stay constrained to one lifecycle action. For remote
bootstrap, configure `AGENT_RUNNER_ACTION=remote-bootstrap`,
`AGENT_RUNNER_ALLOWED_ACTIONS=remote-bootstrap`, and `AGENT_SPRITE_POOL`. The
Worker only leases a dispatch intent and a Sprite slot; provider execution
still happens in a trusted external executor with task-scoped credentials.

## Deployment Pilot

Create the D1 database and replace the placeholder `database_id` in
`wrangler.jsonc` before deploying:

```bash
pnpm -C apps/agent-runner wrangler d1 create voyant-agent-runner
pnpm -C apps/agent-runner wrangler d1 migrations apply voyant-agent-runner --remote
```

Bind an R2 bucket as `AGENT_RUNNER_TICKS`, configure the Durable Object binding
from `wrangler.jsonc`, then set secrets:

```bash
pnpm -C apps/agent-runner wrangler secret put AGENT_RUNNER_TOKENS
pnpm -C apps/agent-runner wrangler secret put AGENT_CONTROL_PLANE_TOKEN
```

Deploy with `AGENT_RUNNER_ENABLED=false` first. Run deployment doctor and
deployed status checks. Only then set a narrow action allow-list, a short lease
TTL, a daily lease budget, and enable Cron.

Run command execution from a trusted external executor, not inside the Worker.
For a bounded always-on loop:

```bash
pnpm agent:queue:executor -- \
  --holder runner:executor-1 \
  --iterations 10 \
  --sleep-seconds 60 \
  --event-log .agent-runs/executor.jsonl \
  --implementation-command 'codex exec --sandbox danger-full-access --skip-git-repo-check "<agent prompt>"' \
  --release-expired-intents \
  --yes
```

The dedicated executor host is the sandbox boundary for implementation work.
Use `codex exec --sandbox danger-full-access` on trusted server runners so
Codex can run the package manager, tests, browser tooling, and repository
scripts without the local bubblewrap sandbox blocking normal shell execution.
Do not use this mode for shared or untrusted runner hosts.

Use narrower action filters and command templates in production. Without a
concrete implementation command or browser dev-server command, implementation
and browser-capture recommendations remain visible to operators but are not
leaseable by the executor.

Rollback is intentionally simple during the pilot: disable Cron, set
`AGENT_RUNNER_ENABLED=false`, and redeploy the previous Worker version. R2 and
D1 data can remain in place for postmortem evidence because the coordinator is
only an ephemeral lock surface.

Before enabling Cron, validate the deployed control plane and runner app from
the repository checkout:

```bash
pnpm agent:queue:deployment-doctor -- --json
```

The command reads `AGENT_CONTROL_PLANE_URL`, `AGENT_CONTROL_PLANE_TOKEN`,
`AGENT_RUNNER_URL`, and `AGENT_RUNNER_TOKEN`, calls both capability endpoints,
checks the runner supervisor status endpoint, and reports persistence and
execution mode without printing token values.

For steady-state operator checks without a smoke tick:

```bash
pnpm agent:queue:deployed-status -- --repo voyant-travel/voyant
```

The status command uses the same environment, checks the deployed control-plane
and runner endpoints, and prints the latest plus recent control-plane queue
snapshots, current read-only dispatch plan, runner supervisor ticks, and recent
runner leases. The dispatch plan uses the deployed runner's default action
filter when one is configured. It also reports the deployed runner policy,
including allowed action count, default action, whether an action filter is
required, and whether CI repair actions are explicitly enabled. It also prints
the configured daily lease budget when present. Add `--issue <number>
--action <name>` to include the active dispatch pointer for one lifecycle
action.
Pass `--smoke-tick` after submitting at least one queue snapshot to validate
that the deployed runner can call the control plane's read-only dispatch-plan
path:

```bash
pnpm agent:queue:deployment-doctor -- --smoke-tick --repo voyant-travel/voyant --json
```

Inspect recent persisted runner ticks with:

```bash
AGENT_RUNNER_URL=https://agent-runner.example.workers.dev \
AGENT_RUNNER_TOKEN=... \
pnpm agent:queue:history -- --source runner --repo voyant-travel/voyant
```
