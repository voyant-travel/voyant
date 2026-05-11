# Voyant Agent Control Plane

Cloudflare-ready Hono Worker for supervised agent queue orchestration.

This app intentionally starts with a dry-run contract. It can answer health,
capability, and dispatch-planning requests, but it does not mutate GitHub,
create workspaces, run provider commands, or spend agent budget. Local runner
scripts remain the execution boundary until authentication, persistence, and
worker-to-runner transport are designed.

`/health` is public. `/api/*` requires a bearer token from
`AGENT_CONTROL_PLANE_TOKENS`, a comma-separated secret value configured in the
deployment environment. If no token is configured, API routes fail closed with
`control_plane_auth_not_configured`.

## Local Commands

```bash
pnpm -C apps/agent-control-plane test
pnpm -C apps/agent-control-plane check-types
pnpm -C apps/agent-control-plane dev
```

## Endpoints

- `GET /health`
- `GET /api/capabilities`
- `POST /api/dispatch-plans`

`POST /api/dispatch-plans` accepts ordered queue recommendations and returns the
first dispatchable plan that matches the optional filters. It mirrors the local
runner allow-list: `start`, `collect-ci`, `publish-evidence`, `open-pr`,
`sync-pr`, and `cleanup`. Pass `options.updateBody = true` to include
`--update-body` when the selected plan is `sync-pr`; other actions ignore that
option.
