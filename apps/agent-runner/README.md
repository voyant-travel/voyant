# Voyant Agent Runner

`apps/agent-runner` is the Cloudflare-ready shell for an always-on agent queue
runner. It proves the deployed Hono surface, bearer-token auth, scheduled
handler shape, and control-plane configuration without executing lifecycle
commands in the Worker.

When explicitly enabled, the runner can perform a lease-only supervisor tick:
it calls the control plane to acquire one dispatch intent from the latest stored
queue snapshot. It still does not mutate GitHub directly, create workspaces, run
provider commands, or spend model budget.

## Endpoints

- `GET /health` returns public service health.
- `GET /api/capabilities` returns runner defaults, execution state, and
  control-plane configuration. Requires `AGENT_RUNNER_TOKENS`.
- `POST /api/supervisor/ticks` validates a supervisor tick request and returns
  the equivalent local command plan. By default it is a dry run. With
  `AGENT_RUNNER_ENABLED=true` and `{ "dryRun": false }`, it leases one dispatch
  intent from `POST /api/dispatch-intents/latest` on the control plane. When
  `AGENT_RUNNER_TICKS` is bound, the result is persisted as the latest
  supervisor tick for the repository.
  For deployment smoke tests, pass
  `{ "dryRun": true, "validateControlPlane": true }` to call the control
  plane's read-only latest dispatch-plan endpoint without leasing work.
  If the control plane rejects the lease because an active intent already
  exists, the tick result includes that active intent so operators can inspect
  the holder and expiration from the persisted supervisor status.
- `GET /api/supervisor/status?repository=<owner/name>&limit=<n>` returns a
  non-mutating operator view with runner capabilities, tick storage state, the
  latest persisted supervisor tick, and recent tick history. If `repository` is
  omitted, the configured `AGENT_RUNNER_REPOSITORY` is used. The endpoint still
  returns capabilities when `AGENT_RUNNER_TICKS` is not bound.
- `GET /api/supervisor/ticks/latest?repository=<owner/name>` returns the latest
  persisted supervisor tick for a repository. Requires `AGENT_RUNNER_TOKENS`
  and the `AGENT_RUNNER_TICKS` binding.
- `GET /api/supervisor/ticks/recent?repository=<owner/name>&limit=<n>` returns
  recent persisted supervisor ticks for a repository. `limit` defaults to 20
  and is clamped to 1..50.

## Configuration

- `AGENT_RUNNER_TOKENS`: comma-separated bearer tokens for `/api/*`.
- `AGENT_RUNNER_ENABLED`: must be `true` before scheduled ticks can lease
  dispatch intents.
- `AGENT_RUNNER_ALLOWED_ACTIONS`: optional comma-separated lifecycle action
  allow-list. Defaults to all runner-supported lifecycle actions.
- `AGENT_RUNNER_ACTION`: optional default lifecycle action filter, useful when
  `AGENT_RUNNER_ALLOWED_ACTIONS` restricts Cron to one action such as `sync-pr`.
- `AGENT_RUNNER_HOLDER`: default lease holder, for example `runner:cloudflare`.
- `AGENT_RUNNER_MAX_LEASE_TTL_SECONDS`: optional maximum lease TTL. Defaults to
  900 seconds and is clamped to 60..3600 seconds.
- `AGENT_RUNNER_REPOSITORY`: default repository, for example `voyantjs/voyant`.
- `AGENT_RUNNER_TICKS`: optional R2 binding for latest supervisor tick status
  and recent supervisor tick history.
- `AGENT_RUNNER_TICK_KEY_PREFIX`: optional R2 key prefix for supervisor ticks.
- `AGENT_CONTROL_PLANE_URL`: deployed control-plane URL.
- `AGENT_CONTROL_PLANE_TOKEN`: bearer token for the control plane.

Cron triggers should stay disabled until queue snapshots and control-plane
dispatch intent storage are configured. Keep provider execution outside this
Worker unless a later design adds explicit budget controls, sandbox policy, and
task-scoped credentials.

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
pnpm agent:queue:deployed-status -- --repo voyantjs/voyant
```

The status command uses the same environment, checks the deployed control-plane
and runner endpoints, and prints the latest plus recent control-plane queue
snapshots and runner supervisor ticks. Add `--issue <number> --action <name>`
to include the active dispatch pointer for one lifecycle action.
Pass `--smoke-tick` after submitting at least one queue snapshot to validate
that the deployed runner can call the control plane's read-only dispatch-plan
path:

```bash
pnpm agent:queue:deployment-doctor -- --smoke-tick --repo voyantjs/voyant --json
```

Inspect recent persisted runner ticks with:

```bash
AGENT_RUNNER_URL=https://agent-runner.example.workers.dev \
AGENT_RUNNER_TOKEN=... \
pnpm agent:queue:history -- --source runner --repo voyantjs/voyant
```
