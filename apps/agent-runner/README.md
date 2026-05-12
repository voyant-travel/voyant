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
- `GET /api/supervisor/ticks/latest?repository=<owner/name>` returns the latest
  persisted supervisor tick for a repository. Requires `AGENT_RUNNER_TOKENS`
  and the `AGENT_RUNNER_TICKS` binding.

## Configuration

- `AGENT_RUNNER_TOKENS`: comma-separated bearer tokens for `/api/*`.
- `AGENT_RUNNER_ENABLED`: must be `true` before scheduled ticks can lease
  dispatch intents.
- `AGENT_RUNNER_HOLDER`: default lease holder, for example `runner:cloudflare`.
- `AGENT_RUNNER_REPOSITORY`: default repository, for example `voyantjs/voyant`.
- `AGENT_RUNNER_TICKS`: optional R2 binding for latest supervisor tick status.
- `AGENT_RUNNER_TICK_KEY_PREFIX`: optional R2 key prefix for supervisor ticks.
- `AGENT_CONTROL_PLANE_URL`: deployed control-plane URL.
- `AGENT_CONTROL_PLANE_TOKEN`: bearer token for the control plane.

Cron triggers should stay disabled until queue snapshots and control-plane
dispatch intent storage are configured. Keep provider execution outside this
Worker unless a later design adds explicit budget controls, sandbox policy, and
task-scoped credentials.
