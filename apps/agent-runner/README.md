# Voyant Agent Runner

`apps/agent-runner` is the Cloudflare-ready shell for an always-on agent queue
runner. The first version is intentionally non-executing: it proves the deployed
Hono surface, bearer-token auth, scheduled handler shape, and control-plane
configuration without spending agent budget or mutating GitHub Projects.

## Endpoints

- `GET /health` returns public service health.
- `GET /api/capabilities` returns runner defaults, execution state, and
  control-plane configuration. Requires `AGENT_RUNNER_TOKENS`.
- `POST /api/supervisor/ticks` validates a supervisor tick request and returns
  the equivalent local command plan. It does not execute the command.

## Configuration

- `AGENT_RUNNER_TOKENS`: comma-separated bearer tokens for `/api/*`.
- `AGENT_RUNNER_ENABLED`: must be `true` before scheduled plans can be accepted.
- `AGENT_RUNNER_HOLDER`: default lease holder, for example `runner:cloudflare`.
- `AGENT_RUNNER_REPOSITORY`: default repository, for example `voyantjs/voyant`.
- `AGENT_CONTROL_PLANE_URL`: deployed control-plane URL.
- `AGENT_CONTROL_PLANE_TOKEN`: bearer token for the control plane.

Cron triggers should stay disabled until GitHub polling, execution policy,
budget controls, and provider credentials are wired into a later slice.
